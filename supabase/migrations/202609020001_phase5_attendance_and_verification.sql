-- Phase 5: Attendance Recording and HR Verification Foundation

create type public.attendance_verification_status as enum ('pending', 'approved', 'rejected');

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendance_date date not null default (now() at time zone 'utc')::date,
  check_in_at timestamptz not null default now(),
  check_in_photo_path text not null check (check_in_photo_path ~ '^attendance/[0-9a-f-]+/[0-9a-f-]+/check-in\.(jpg|jpeg|png)$'),
  check_in_verification_status public.attendance_verification_status not null default 'pending',
  check_in_reviewed_by uuid references public.profiles(id) on delete set null,
  check_in_reviewed_at timestamptz,
  check_in_review_notes text check (check_in_review_notes is null or char_length(check_in_review_notes) <= 1000),
  check_out_at timestamptz check (check_out_at is null or check_in_at <= check_out_at),
  check_out_photo_path text check (check_out_photo_path is null or check_out_photo_path ~ '^attendance/[0-9a-f-]+/[0-9a-f-]+/check-out\.(jpg|jpeg|png)$'),
  check_out_verification_status public.attendance_verification_status check (check_out_verification_status is null or check_out_verification_status in ('pending', 'approved', 'rejected')),
  check_out_reviewed_by uuid references public.profiles(id) on delete set null,
  check_out_reviewed_at timestamptz,
  check_out_review_notes text check (check_out_review_notes is null or char_length(check_out_review_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (check_out_at is null and check_out_photo_path is null and check_out_verification_status is null) or
    (check_out_at is not null and check_out_photo_path is not null and check_out_verification_status is not null)
  )
);

create index attendance_employee_date_idx on public.attendance_records (employee_id, attendance_date desc);
create index attendance_org_date_idx on public.attendance_records (organization_id, attendance_date desc);
create index attendance_check_in_status_idx on public.attendance_records (check_in_verification_status);
create index attendance_check_out_status_idx on public.attendance_records (check_out_verification_status);
create unique index attendance_active_open_session_idx on public.attendance_records (employee_id) where (check_out_at is null);

create trigger attendance_records_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- Security helper functions
create function public.owns_attendance_employee(target_emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where id = target_emp and profile_id = auth.uid()
  )
$$;

create function public.is_hr_for_org(target_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['hr']) and target_org = public.current_organization_id()
$$;

create function public.can_manager_read_attendance(target_emp uuid, target_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['manager']) and exists (
    select 1 from public.employees subordinate
    join public.employees manager on manager.id = subordinate.manager_employee_id
    where manager.profile_id = auth.uid()
      and subordinate.id = target_emp
      and manager.organization_id = target_org
      and subordinate.organization_id = target_org
  )
$$;

grant execute on function public.owns_attendance_employee(uuid), public.is_hr_for_org(uuid), public.can_manager_read_attendance(uuid, uuid) to authenticated;

-- Anti-tampering guard trigger
create function public.prevent_employee_attendance_tampering() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_hr_for_org(new.organization_id) then
      if new.check_in_verification_status <> 'pending' or
         new.check_in_reviewed_by is not null or
         new.check_in_reviewed_at is not null or
         new.check_in_review_notes is not null or
         new.check_out_at is not null or
         new.check_out_photo_path is not null or
         new.check_out_verification_status is not null or
         new.check_out_reviewed_by is not null or
         new.check_out_reviewed_at is not null or
         new.check_out_review_notes is not null then
        raise exception 'Employees cannot set review or checkout fields on check-in' using errcode = '42501';
      end if;
      new.check_in_at := now();
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.is_hr_for_org(new.organization_id) then
      -- Employee update check:
      if new.check_in_at is distinct from old.check_in_at or
         new.check_in_photo_path is distinct from old.check_in_photo_path or
         new.check_in_verification_status is distinct from old.check_in_verification_status or
         new.check_in_reviewed_by is distinct from old.check_in_reviewed_by or
         new.check_in_reviewed_at is distinct from old.check_in_reviewed_at or
         new.check_in_review_notes is distinct from old.check_in_review_notes or
         new.check_out_verification_status is distinct from coalesce(old.check_out_verification_status, 'pending') or
         new.check_out_reviewed_by is distinct from old.check_out_reviewed_by or
         new.check_out_reviewed_at is distinct from old.check_out_reviewed_at or
         new.check_out_review_notes is distinct from old.check_out_review_notes then
        raise exception 'Employees cannot modify timestamps or review fields' using errcode = '42501';
      end if;

      if old.check_out_at is not null then
        raise exception 'Completed attendance sessions cannot be modified' using errcode = '42501';
      end if;

      if new.check_out_at is not null then
        new.check_out_at := now();
        new.check_out_verification_status := 'pending';
        new.check_out_reviewed_by := null;
        new.check_out_reviewed_at := null;
        new.check_out_review_notes := null;
      end if;
    else
      -- HR update: preserve original check-in and check-out timestamps and photos
      if new.check_in_at is distinct from old.check_in_at or
         new.check_out_at is distinct from old.check_out_at or
         new.check_in_photo_path is distinct from old.check_in_photo_path or
         new.check_out_photo_path is distinct from old.check_out_photo_path then
        raise exception 'Attendance timestamps and photos cannot be altered by review' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger attendance_records_tamper_guard before insert or update on public.attendance_records
  for each row execute function public.prevent_employee_attendance_tampering();

-- RLS on attendance_records
alter table public.attendance_records enable row level security;

create policy attendance_select_scope on public.attendance_records for select to authenticated
  using (
    public.owns_attendance_employee(employee_id) or
    public.is_hr_for_org(organization_id) or
    public.can_manager_read_attendance(employee_id, organization_id)
  );

create policy attendance_insert_self on public.attendance_records for insert to authenticated
  with check (
    public.owns_attendance_employee(employee_id) and
    organization_id = (select organization_id from public.employees where id = employee_id)
  );

create policy attendance_update_scope on public.attendance_records for update to authenticated
  using (
    public.owns_attendance_employee(employee_id) or
    public.is_hr_for_org(organization_id)
  )
  with check (
    public.owns_attendance_employee(employee_id) or
    public.is_hr_for_org(organization_id)
  );

-- Storage bucket for attendance photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance', 'attendance', false, 5242880, array['image/jpeg', 'image/png', 'image/jpg'])
on conflict (id) do nothing;

create function public.owns_attendance_storage_object(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where profile_id = auth.uid()
      and id::text = split_part(object_name, '/', 1)
  )
$$;

create function public.can_hr_read_attendance_storage(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['hr']) and exists (
    select 1 from public.employees
    where id::text = split_part(object_name, '/', 1)
      and organization_id = public.current_organization_id()
  )
$$;

create function public.can_manager_read_attendance_storage(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['manager']) and exists (
    select 1 from public.employees subordinate
    join public.employees manager on manager.id = subordinate.manager_employee_id
    where manager.profile_id = auth.uid()
      and subordinate.id::text = split_part(object_name, '/', 1)
      and manager.organization_id = subordinate.organization_id
  )
$$;

grant execute on function public.owns_attendance_storage_object(text), public.can_hr_read_attendance_storage(text), public.can_manager_read_attendance_storage(text) to authenticated;

create policy attendance_storage_select_scope on storage.objects for select to authenticated
  using (
    bucket_id = 'attendance' and (
      public.owns_attendance_storage_object(name) or
      public.can_hr_read_attendance_storage(name) or
      public.can_manager_read_attendance_storage(name)
    )
  );

create policy attendance_storage_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance' and public.owns_attendance_storage_object(name));

create policy attendance_storage_update_own on storage.objects for update to authenticated
  using (bucket_id = 'attendance' and public.owns_attendance_storage_object(name))
  with check (bucket_id = 'attendance' and public.owns_attendance_storage_object(name));

create policy attendance_storage_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'attendance' and public.owns_attendance_storage_object(name));

-- Atomic Check-in RPC
create function public.record_attendance_check_in(
  p_photo_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_employee_id uuid;
  v_org_id uuid;
  v_record_id uuid;
  v_active_exists boolean;
begin
  select id, organization_id into v_employee_id, v_org_id
  from public.employees where profile_id = auth.uid();

  if v_employee_id is null then
    raise exception 'Employee record not found for authenticated user' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.attendance_records
    where employee_id = v_employee_id and check_out_at is null
  ) into v_active_exists;

  if v_active_exists then
    raise exception 'An active check-in session is already in progress' using errcode = '23505';
  end if;

  insert into public.attendance_records (
    employee_id,
    organization_id,
    attendance_date,
    check_in_at,
    check_in_photo_path,
    check_in_verification_status
  ) values (
    v_employee_id,
    v_org_id,
    (now() at time zone 'utc')::date,
    now(),
    p_photo_path,
    'pending'
  )
  returning id into v_record_id;

  return v_record_id;
end;
$$;

-- Atomic Check-out RPC
create function public.record_attendance_check_out(
  p_attendance_id uuid,
  p_photo_path text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_employee_id uuid;
begin
  select id into v_employee_id
  from public.employees where profile_id = auth.uid();

  if v_employee_id is null then
    raise exception 'Employee record not found for authenticated user' using errcode = '42501';
  end if;

  update public.attendance_records
  set
    check_out_at = now(),
    check_out_photo_path = p_photo_path,
    check_out_verification_status = 'pending'
  where id = p_attendance_id
    and employee_id = v_employee_id
    and check_out_at is null;

  if not found then
    raise exception 'Active check-in session not found or already completed' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

-- HR Review RPC
create function public.review_attendance_photo(
  p_attendance_id uuid,
  p_event_type text, -- 'check_in' or 'check_out'
  p_status public.attendance_verification_status,
  p_notes text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid();

  if not public.has_role(array['hr']) then
    raise exception 'Only HR role can verify attendance photos' using errcode = '42501';
  end if;

  if p_event_type = 'check_in' then
    update public.attendance_records
    set
      check_in_verification_status = p_status,
      check_in_reviewed_by = auth.uid(),
      check_in_reviewed_at = now(),
      check_in_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id and organization_id = v_org_id;
  elsif p_event_type = 'check_out' then
    update public.attendance_records
    set
      check_out_verification_status = p_status,
      check_out_reviewed_by = auth.uid(),
      check_out_reviewed_at = now(),
      check_out_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id and organization_id = v_org_id;
  else
    raise exception 'Invalid event type. Must be check_in or check_out' using errcode = '22023';
  end if;

  if not found then
    raise exception 'Attendance record not found in your organization' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

grant execute on function public.record_attendance_check_in(text),
                         public.record_attendance_check_out(uuid, text),
                         public.review_attendance_photo(uuid, text, public.attendance_verification_status, text)
to authenticated;

-- Grants for attendance_records table
grant select, insert, update on public.attendance_records to authenticated;
grant usage on type public.attendance_verification_status to authenticated;
revoke all on public.attendance_records from anon;


