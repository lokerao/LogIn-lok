-- Phase 6: Leave Management
-- Migration: 202609030002_phase6_leave_management.sql
-- Safe to apply to existing Phase 1-5 schema. Does not recreate any existing objects.

-- ============================================================
-- 1. STATUS ENUM
-- ============================================================
create type public.leave_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- ============================================================
-- 2. LEAVE TYPES TABLE (org-scoped; HR manage only; Admin/Recruiter excluded)
-- ============================================================
create table public.leave_types (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references public.organizations(id) on delete cascade,
  name              text        not null check (char_length(trim(name)) between 2 and 80),
  description       text        check (description is null or char_length(trim(description)) <= 500),
  max_days_per_year int         not null default 0 check (max_days_per_year >= 0),
  allows_half_day   boolean     not null default false,
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, name)
);

create index leave_types_org_active_idx on public.leave_types (organization_id) where is_active = true;

create trigger leave_types_updated_at
  before update on public.leave_types
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. LEAVE BALANCES TABLE (per employee, per type, per year)
-- ============================================================
create table public.leave_balances (
  id              uuid         primary key default gen_random_uuid(),
  employee_id     uuid         not null references public.employees(id) on delete cascade,
  organization_id uuid         not null references public.organizations(id) on delete cascade,
  leave_type_id   uuid         not null references public.leave_types(id) on delete cascade,
  year            int          not null check (year between 2000 and 2100),
  allocated_days  numeric(5,1) not null default 0 check (allocated_days >= 0),
  used_days       numeric(5,1) not null default 0 check (used_days >= 0),
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),
  unique (employee_id, leave_type_id, year),
  -- Requirement 7: strictly prevent used_days from exceeding allocated_days
  check (used_days <= allocated_days)
);

create index leave_balances_employee_year_idx on public.leave_balances (employee_id, year);
create index leave_balances_org_idx on public.leave_balances (organization_id, year);

create trigger leave_balances_updated_at
  before update on public.leave_balances
  for each row execute function public.set_updated_at();

-- Database-level organization consistency for leave_balances
create function public.validate_leave_balance_org_consistency() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_emp_org  uuid;
  v_type_org uuid;
begin
  select organization_id into v_emp_org
  from public.employees
  where id = new.employee_id;

  if v_emp_org is null then
    raise exception 'Employee % not found', new.employee_id using errcode = '23503';
  end if;

  if v_emp_org <> new.organization_id then
    raise exception 'Employee organization (%) does not match balance organization (%)',
      v_emp_org, new.organization_id using errcode = '23514';
  end if;

  select organization_id into v_type_org
  from public.leave_types
  where id = new.leave_type_id;

  if v_type_org is null then
    raise exception 'Leave type % not found', new.leave_type_id using errcode = '23503';
  end if;

  if v_type_org <> new.organization_id then
    raise exception 'Leave type organization (%) does not match balance organization (%)',
      v_type_org, new.organization_id using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger leave_balances_org_consistency_guard
  before insert or update on public.leave_balances
  for each row execute function public.validate_leave_balance_org_consistency();

-- ============================================================
-- 4. LEAVE REQUESTS TABLE
-- ============================================================
create table public.leave_requests (
  id              uuid         primary key default gen_random_uuid(),
  employee_id     uuid         not null references public.employees(id) on delete cascade,
  organization_id uuid         not null references public.organizations(id) on delete cascade,
  leave_type_id   uuid         not null references public.leave_types(id) on delete restrict,
  start_date      date         not null,
  end_date        date         not null,
  is_half_day     boolean      not null default false,
  requested_days  numeric(5,1) not null check (requested_days > 0),
  reason          text         not null check (char_length(trim(reason)) between 5 and 1000),
  status          public.leave_request_status not null default 'pending',
  reviewed_by     uuid         references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  reviewer_notes  text         check (reviewer_notes is null or char_length(reviewer_notes) <= 1000),
  cancelled_at    timestamptz,
  cancelled_by    uuid         references public.profiles(id) on delete set null,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),
  check (start_date <= end_date),
  -- Prevent cross-year leave requests at table level
  check (extract(year from start_date) = extract(year from end_date)),
  check (not is_half_day or start_date = end_date),
  check (
    (reviewed_by is null and reviewed_at is null) or
    (reviewed_by is not null and reviewed_at is not null)
  ),
  check (
    (cancelled_by is null and cancelled_at is null) or
    (cancelled_by is not null and cancelled_at is not null)
  )
);

create index leave_requests_employee_idx on public.leave_requests (employee_id, created_at desc);
create index leave_requests_org_status_idx on public.leave_requests (organization_id, status, start_date);
create index leave_requests_pending_idx on public.leave_requests (organization_id) where status = 'pending';

create trigger leave_requests_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

-- Database-level organization consistency for leave_requests
create function public.validate_leave_request_org_consistency() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_emp_org  uuid;
  v_type_org uuid;
begin
  select organization_id into v_emp_org
  from public.employees
  where id = new.employee_id;

  if v_emp_org is null or v_emp_org <> new.organization_id then
    raise exception 'Employee organization (%) does not match request organization (%)',
      v_emp_org, new.organization_id using errcode = '23514';
  end if;

  select organization_id into v_type_org
  from public.leave_types
  where id = new.leave_type_id;

  if v_type_org is null or v_type_org <> new.organization_id then
    raise exception 'Leave type organization (%) does not match request organization (%)',
      v_type_org, new.organization_id using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger leave_requests_org_consistency_guard
  before insert or update on public.leave_requests
  for each row execute function public.validate_leave_request_org_consistency();

-- ============================================================
-- 5. ANTI-TAMPERING TRIGGER
-- ============================================================
create function public.prevent_leave_request_tampering() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.reviewed_by is not null or new.reviewed_at is not null or
       new.reviewer_notes is not null or new.cancelled_at is not null or
       new.cancelled_by is not null then
      raise exception 'Reviewer and cancellation fields must be null on creation' using errcode = '42501';
    end if;
    if new.status <> 'pending' then
      raise exception 'New leave requests must have pending status' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- Core immutable fields
    if new.employee_id <> old.employee_id or new.organization_id <> old.organization_id or
       new.leave_type_id <> old.leave_type_id or new.start_date <> old.start_date or
       new.end_date <> old.end_date or new.is_half_day <> old.is_half_day or
       new.requested_days <> old.requested_days or new.reason <> old.reason then
      raise exception 'Core leave request fields are immutable after submission' using errcode = '42501';
    end if;

    -- Terminal state enforcement
    if old.status = 'cancelled' then
      raise exception 'Cancelled leave requests cannot be modified' using errcode = '42501';
    end if;
    if old.status in ('approved', 'rejected') and new.status <> old.status then
      raise exception 'Resolved leave requests (% status) cannot change status', old.status using errcode = '42501';
    end if;

    -- Valid state transitions from pending
    if old.status = 'pending' and new.status not in ('approved', 'rejected', 'cancelled') then
      raise exception 'Invalid status transition from pending to %', new.status using errcode = '42501';
    end if;

    -- Audit trail consistency
    if new.status = 'cancelled' then
      if new.cancelled_by is null or new.cancelled_at is null then
        raise exception 'Cancellation audit fields must be populated' using errcode = '42501';
      end if;
      if new.reviewed_by is not null or new.reviewed_at is not null then
        raise exception 'Cancelled requests cannot contain review details' using errcode = '42501';
      end if;
    end if;

    if new.status in ('approved', 'rejected') then
      if new.reviewed_by is null or new.reviewed_at is null then
        raise exception 'Reviewer audit fields must be populated' using errcode = '42501';
      end if;
      if new.cancelled_at is not null or new.cancelled_by is not null then
        raise exception 'Reviewed requests cannot contain cancellation details' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger leave_requests_tamper_guard
  before insert or update on public.leave_requests
  for each row execute function public.prevent_leave_request_tampering();

-- ============================================================
-- 6. SECURITY HELPER FUNCTIONS
-- ============================================================
create function public.owns_leave_employee(target_emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where id = target_emp and profile_id = auth.uid()
  )
$$;

create function public.can_manager_review_leave(target_emp uuid, target_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['manager'])
    and not public.has_role(array['admin', 'recruiter'])
    and exists (
      select 1 from public.employees subordinate
      join public.employees manager on manager.id = subordinate.manager_employee_id
      where manager.profile_id = auth.uid()
        and subordinate.id = target_emp
        and manager.organization_id = target_org
        and subordinate.organization_id = target_org
    )
$$;

grant execute on function
  public.owns_leave_employee(uuid),
  public.can_manager_review_leave(uuid, uuid)
to authenticated;

-- ============================================================
-- 7. RLS POLICIES (Hardened Role Matrix: Admin/Recruiter Excluded)
-- ============================================================
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;

-- leave_types:
-- Employees, Managers, HR read active types; HR manages types. Admin & Recruiter: NO ACCESS.
create policy leave_types_read on public.leave_types
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and is_active = true
    and public.has_role(array['employee', 'manager', 'hr'])
    and not public.has_role(array['admin', 'recruiter'])
  );

create policy leave_types_manage on public.leave_types
  for all to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role(array['hr'])
    and not public.has_role(array['admin', 'recruiter'])
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role(array['hr'])
    and not public.has_role(array['admin', 'recruiter'])
  );

-- leave_balances:
-- Employee reads own; HR reads org; Manager reads direct reports; HR manages balances.
-- Admin & Recruiter: NO ACCESS.
create policy leave_balances_select on public.leave_balances
  for select to authenticated
  using (
    not public.has_role(array['admin', 'recruiter']) and (
      (public.has_role(array['employee']) and public.owns_leave_employee(employee_id)) or
      (public.has_role(array['hr']) and organization_id = public.current_organization_id()) or
      (public.has_role(array['manager']) and public.can_manager_review_leave(employee_id, organization_id))
    )
  );

create policy leave_balances_manage on public.leave_balances
  for all to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role(array['hr'])
    and not public.has_role(array['admin', 'recruiter'])
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role(array['hr'])
    and not public.has_role(array['admin', 'recruiter'])
  );

-- leave_requests:
-- Employee reads own; HR reads org; Manager reads direct reports.
-- Admin & Recruiter: NO ACCESS.
-- NO direct INSERT, UPDATE, or DELETE policies for any role!
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    not public.has_role(array['admin', 'recruiter']) and (
      (public.has_role(array['employee']) and public.owns_leave_employee(employee_id)) or
      (public.has_role(array['hr']) and organization_id = public.current_organization_id()) or
      (public.has_role(array['manager']) and public.can_manager_review_leave(employee_id, organization_id))
    )
  );

-- ============================================================
-- 8. SUBMIT LEAVE REQUEST RPC (Hardened Concurrency & Effective Balance)
-- ============================================================
create function public.submit_leave_request(
  p_leave_type_id uuid,
  p_start_date    date,
  p_end_date      date,
  p_reason        text,
  p_is_half_day   boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid    uuid := auth.uid();
  v_employee_id   uuid;
  v_org_id        uuid;
  v_request_id    uuid;
  v_days          numeric(5,1);
  v_allocated     numeric(5,1);
  v_used          numeric(5,1);
  v_pending_days  numeric(5,1);
  v_effective_bal numeric(5,1);
  v_allows_half   boolean;
  v_type_ok       boolean;
  v_overlap       boolean;
  v_year          int;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Admin & Recruiter forbidden; only Employee role permitted
  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['employee']) then
    raise exception 'Only employees are permitted to submit leave requests' using errcode = '42501';
  end if;

  select id, organization_id into v_employee_id, v_org_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_employee_id is null then
    raise exception 'Active employee record not found for user' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Start date and end date are required' using errcode = '22023';
  end if;
  if p_start_date > p_end_date then
    raise exception 'Start date cannot be after end date' using errcode = '22023';
  end if;

  -- Prevent cross-calendar-year requests
  if extract(year from p_start_date) <> extract(year from p_end_date) then
    raise exception 'Leave requests cannot span multiple calendar years. Please submit separate requests for each year.' using errcode = '22023';
  end if;

  if p_is_half_day and p_start_date <> p_end_date then
    raise exception 'Half-day requests must be for a single day' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Reason must be at least 5 characters' using errcode = '22023';
  end if;

  select true, allows_half_day into v_type_ok, v_allows_half
  from public.leave_types
  where id = p_leave_type_id
    and organization_id = v_org_id
    and is_active = true;

  if not coalesce(v_type_ok, false) then
    raise exception 'Leave type not found or not available in your organization' using errcode = '22023';
  end if;
  if p_is_half_day and not coalesce(v_allows_half, false) then
    raise exception 'This leave type does not support half-day requests' using errcode = '22023';
  end if;

  v_days := case when p_is_half_day then 0.5
                 else (p_end_date - p_start_date + 1)::numeric end;

  v_year := extract(year from p_start_date)::int;

  -- ============================================================
  -- CONCURRENCY PROTECTION: Acquire transaction-scoped advisory lock
  -- Keyed to employee to serialize concurrent check+insert pipelines
  -- ============================================================
  perform pg_advisory_xact_lock(hashtext('leave_submission')::integer, hashtext(v_employee_id::text)::integer);

  -- 1. Overlap validation while holding lock
  select exists (
    select 1 from public.leave_requests
    where employee_id = v_employee_id
      and status in ('pending', 'approved')
      and not (end_date < p_start_date or start_date > p_end_date)
  ) into v_overlap;

  if v_overlap then
    raise exception 'An active leave request already overlaps with these dates' using errcode = '23505';
  end if;

  -- 2. Fetch allocated and used days
  select allocated_days, used_days into v_allocated, v_used
  from public.leave_balances
  where employee_id = v_employee_id
    and leave_type_id = p_leave_type_id
    and year = v_year;

  if v_allocated is null then
    raise exception 'No leave balance allocated for employee for year %', v_year using errcode = '23514';
  end if;

  -- 3. Sum requested_days for pending requests of the same employee, type, and year
  select coalesce(sum(requested_days), 0) into v_pending_days
  from public.leave_requests
  where employee_id = v_employee_id
    and leave_type_id = p_leave_type_id
    and status = 'pending'
    and extract(year from start_date)::int = v_year;

  -- 4. Calculate effective available balance: allocated - used - pending
  v_effective_bal := v_allocated - v_used - v_pending_days;

  if v_days > v_effective_bal then
    raise exception 'Insufficient leave balance. Effective available: % day(s) (Allocated: %, Used: %, Pending: %), Requested: % day(s)',
      v_effective_bal, v_allocated, v_used, v_pending_days, v_days using errcode = '23514';
  end if;

  -- 5. Insert pending request while holding lock
  insert into public.leave_requests (
    employee_id, organization_id, leave_type_id,
    start_date, end_date, is_half_day, requested_days, reason, status
  ) values (
    v_employee_id, v_org_id, p_leave_type_id,
    p_start_date, p_end_date, p_is_half_day, v_days,
    trim(p_reason), 'pending'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- ============================================================
-- 9. CANCEL LEAVE REQUEST RPC (Active Employee Consistent)
-- ============================================================
create function public.cancel_leave_request(
  p_request_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid     uuid := auth.uid();
  v_employee_id    uuid;
  v_current_status public.leave_request_status;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Admin & Recruiter forbidden; only Employee role permitted
  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['employee']) then
    raise exception 'Only employees are permitted to cancel leave requests' using errcode = '42501';
  end if;

  -- Active employee consistency
  select id into v_employee_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_employee_id is null then
    raise exception 'Active employee record not found for user' using errcode = '42501';
  end if;

  select status into v_current_status
  from public.leave_requests
  where id = p_request_id and employee_id = v_employee_id
  for update;

  if not found then
    raise exception 'Leave request not found or does not belong to you' using errcode = 'P0002';
  end if;

  if v_current_status <> 'pending' then
    raise exception 'Only pending requests can be cancelled. Current status: %', v_current_status using errcode = '22023';
  end if;

  update public.leave_requests
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_caller_uid
  where id = p_request_id and employee_id = v_employee_id;

  return true;
end;
$$;

-- ============================================================
-- 10. REVIEW LEAVE REQUEST RPC (Atomic Review, Concurrency Safe)
-- ============================================================
create function public.review_leave_request(
  p_request_id uuid,
  p_action     text,
  p_notes      text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_req          record;
  v_bal          record;
  v_reviewer_org uuid := public.current_organization_id();
  v_is_hr        boolean := public.has_role(array['hr']);
  v_is_manager   boolean := public.has_role(array['manager']);
  v_can_review   boolean := false;
  v_new_status   public.leave_request_status;
  v_year         int;
  v_available    numeric(5,1);
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Admin & Recruiter forbidden
  if public.has_role(array['admin', 'recruiter']) then
    raise exception 'Admin and Recruiter roles are not permitted to review leave requests' using errcode = '42501';
  end if;

  -- Action mapping
  if p_action = 'approve' then
    v_new_status := 'approved'::public.leave_request_status;
  elsif p_action = 'reject' then
    v_new_status := 'rejected'::public.leave_request_status;
  else
    raise exception 'Invalid action. Must be approve or reject' using errcode = '22023';
  end if;

  -- 1. Lock request row to prevent concurrent review races
  select * into v_req
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Leave request not found' using errcode = 'P0002';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Leave request has already been reviewed or cancelled (current status: %)', v_req.status using errcode = '22023';
  end if;

  -- 2. Authorization verification
  if v_is_hr and v_req.organization_id = v_reviewer_org then
    v_can_review := true;
  elsif v_is_manager then
    v_can_review := public.can_manager_review_leave(v_req.employee_id, v_req.organization_id);
  end if;

  if not v_can_review then
    raise exception 'You are not authorized to review this leave request' using errcode = '42501';
  end if;

  -- 3. Concurrency-safe balance verification & deduction on approval
  if p_action = 'approve' then
    v_year := extract(year from v_req.start_date)::int;

    -- Lock balance row
    select * into v_bal
    from public.leave_balances
    where employee_id = v_req.employee_id
      and leave_type_id = v_req.leave_type_id
      and year = v_year
    for update;

    if not found then
      raise exception 'No leave balance allocated for employee for year %', v_year using errcode = '23514';
    end if;

    v_available := v_bal.allocated_days - v_bal.used_days;

    if v_req.requested_days > v_available then
      raise exception 'Cannot approve request: insufficient leave balance. Available: % day(s), Requested: % day(s)',
        v_available, v_req.requested_days using errcode = '23514';
    end if;

    update public.leave_balances
    set used_days = used_days + v_req.requested_days
    where id = v_bal.id;
  end if;

  -- 4. Update request status and audit fields
  update public.leave_requests
  set
    status         = v_new_status,
    reviewed_by    = v_caller_uid,
    reviewed_at    = now(),
    reviewer_notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_request_id;

  return true;
end;
$$;

-- ============================================================
-- 11. GRANTS AND PRIVILEGES
-- ============================================================
grant execute on function
  public.submit_leave_request(uuid, date, date, text, boolean),
  public.cancel_leave_request(uuid),
  public.review_leave_request(uuid, text, text)
to authenticated;

grant select on public.leave_types to authenticated;
grant insert, update, delete on public.leave_types to authenticated;

grant select on public.leave_balances to authenticated;
grant insert, update, delete on public.leave_balances to authenticated;

-- Direct INSERT/UPDATE/DELETE revoked from leave_requests for authenticated & anon
grant select on public.leave_requests to authenticated;
revoke insert, update, delete on public.leave_requests from authenticated, anon;
revoke all on public.leave_types, public.leave_balances, public.leave_requests from anon;

grant usage on type public.leave_request_status to authenticated;

