-- Phase 7: Daily Work Assignments & Work Progress
-- Migration: 202609030003_phase7_work_assignments.sql
-- Safe to apply to existing Phase 1-6 schema. Does not recreate any existing objects.

-- ============================================================
-- 1. ENUMS
-- ============================================================
create type public.work_assignment_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.work_assignment_status as enum ('assigned', 'in_progress', 'blocked', 'completed', 'cancelled');

-- ============================================================
-- 2. WORK ASSIGNMENTS TABLE
-- ============================================================
create table public.work_assignments (
  id               uuid                           primary key default gen_random_uuid(),
  organization_id  uuid                           not null references public.organizations(id) on delete cascade,
  employee_id      uuid                           not null references public.employees(id) on delete cascade,
  assigned_by      uuid                           not null references public.profiles(id) on delete restrict,
  work_date        date                           not null,
  title            text                           not null check (char_length(trim(title)) between 3 and 120),
  description      text                           check (description is null or char_length(trim(description)) <= 2000),
  expected_outcome text                           check (expected_outcome is null or char_length(trim(expected_outcome)) <= 1000),
  priority         public.work_assignment_priority not null default 'medium',
  due_time         time,
  status           public.work_assignment_status   not null default 'assigned',
  progress_percent int                            not null default 0 check (progress_percent between 0 and 100),
  completed_at     timestamptz,
  created_at       timestamptz                    not null default now(),
  updated_at       timestamptz                    not null default now(),
  check (
    (status = 'completed' and completed_at is not null and progress_percent = 100) or
    (status <> 'completed' and completed_at is null)
  )
);

create index work_assignments_org_date_idx on public.work_assignments (organization_id, work_date desc);
create index work_assignments_emp_date_idx on public.work_assignments (employee_id, work_date desc);
create index work_assignments_emp_status_idx on public.work_assignments (employee_id, status);
create index work_assignments_assigned_by_idx on public.work_assignments (assigned_by);

create trigger work_assignments_updated_at
  before update on public.work_assignments
  for each row execute function public.set_updated_at();

-- Database-level organization consistency for work_assignments
create function public.validate_work_assignment_org_consistency() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_emp_org uuid;
begin
  select organization_id into v_emp_org
  from public.employees
  where id = new.employee_id;

  if v_emp_org is null then
    raise exception 'Employee % not found', new.employee_id using errcode = '23503';
  end if;

  if v_emp_org <> new.organization_id then
    raise exception 'Employee organization (%) does not match assignment organization (%)',
      v_emp_org, new.organization_id using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger work_assignments_org_consistency_guard
  before insert or update on public.work_assignments
  for each row execute function public.validate_work_assignment_org_consistency();

-- ============================================================
-- 3. WORK ASSIGNMENT UPDATES TABLE (Progress history)
-- ============================================================
create table public.work_assignment_updates (
  id                uuid                           primary key default gen_random_uuid(),
  assignment_id     uuid                           not null references public.work_assignments(id) on delete cascade,
  employee_id       uuid                           not null references public.employees(id) on delete cascade,
  organization_id   uuid                           not null references public.organizations(id) on delete cascade,
  update_text       text                           not null check (char_length(trim(update_text)) between 2 and 1000),
  progress_percent  int                            not null check (progress_percent between 0 and 100),
  status_at_update  public.work_assignment_status   not null,
  created_at        timestamptz                    not null default now()
);

create index work_updates_assignment_idx on public.work_assignment_updates (assignment_id, created_at desc);
create index work_updates_employee_idx on public.work_assignment_updates (employee_id, created_at desc);
create index work_updates_org_idx on public.work_assignment_updates (organization_id, created_at desc);

-- Database-level organization consistency for work_assignment_updates
create function public.validate_work_update_org_consistency() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_assign_org uuid;
begin
  select organization_id into v_assign_org
  from public.work_assignments
  where id = new.assignment_id;

  if v_assign_org is null then
    raise exception 'Work assignment % not found', new.assignment_id using errcode = '23503';
  end if;

  if v_assign_org <> new.organization_id then
    raise exception 'Assignment organization (%) does not match update organization (%)',
      v_assign_org, new.organization_id using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger work_updates_org_consistency_guard
  before insert or update on public.work_assignment_updates
  for each row execute function public.validate_work_update_org_consistency();

-- ============================================================
-- 4. ANTI-TAMPERING TRIGGER
-- ============================================================
create function public.prevent_work_assignment_tampering() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- Core identity fields are immutable
    if new.id <> old.id or
       new.organization_id <> old.organization_id or
       new.employee_id <> old.employee_id or
       new.assigned_by <> old.assigned_by or
       new.created_at <> old.created_at then
      raise exception 'Core assignment fields are immutable' using errcode = '42501';
    end if;

    -- Cancelled is a terminal state
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'Cancelled work assignments cannot be modified or reopened' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger work_assignments_tamper_guard
  before update on public.work_assignments
  for each row execute function public.prevent_work_assignment_tampering();

-- ============================================================
-- 5. SECURITY HELPER FUNCTIONS
-- ============================================================
create function public.owns_work_employee(target_emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where id = target_emp and profile_id = auth.uid()
  )
$$;

create function public.can_manager_manage_work(target_emp uuid, target_org uuid) returns boolean
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
  public.owns_work_employee(uuid),
  public.can_manager_manage_work(uuid, uuid)
to authenticated;

-- ============================================================
-- 6. RLS POLICIES (Admin & Recruiter Excluded)
-- ============================================================
alter table public.work_assignments enable row level security;
alter table public.work_assignment_updates enable row level security;

-- work_assignments SELECT:
-- Employee reads own; HR reads org; Manager reads direct reports.
-- Admin & Recruiter: NO ACCESS.
create policy work_assignments_select on public.work_assignments
  for select to authenticated
  using (
    not public.has_role(array['admin', 'recruiter']) and (
      (public.has_role(array['employee']) and public.owns_work_employee(employee_id)) or
      (public.has_role(array['hr']) and organization_id = public.current_organization_id()) or
      (public.has_role(array['manager']) and public.can_manager_manage_work(employee_id, organization_id))
    )
  );

-- work_assignment_updates SELECT:
-- Employee reads own; HR reads org; Manager reads direct reports.
-- Admin & Recruiter: NO ACCESS.
create policy work_assignment_updates_select on public.work_assignment_updates
  for select to authenticated
  using (
    not public.has_role(array['admin', 'recruiter']) and (
      (public.has_role(array['employee']) and public.owns_work_employee(employee_id)) or
      (public.has_role(array['hr']) and organization_id = public.current_organization_id()) or
      (public.has_role(array['manager']) and public.can_manager_manage_work(employee_id, organization_id))
    )
  );

-- Direct INSERT, UPDATE, DELETE revoked for authenticated and anon.
-- State mutations are restricted exclusively to SECURITY DEFINER RPCs.

-- ============================================================
-- 7. RPC: CREATE WORK ASSIGNMENT (Manager only)
-- ============================================================
create function public.create_work_assignment(
  p_employee_id      uuid,
  p_work_date        date,
  p_title            text,
  p_description      text default null,
  p_priority         text default 'medium',
  p_expected_outcome text default null,
  p_due_time         time default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid      uuid := auth.uid();
  v_manager_emp_id  uuid;
  v_org_id          uuid;
  v_subordinate_ok  boolean;
  v_priority_enum   public.work_assignment_priority;
  v_assignment_id   uuid;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Admin & Recruiter forbidden; Manager role required
  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['manager']) then
    raise exception 'Only managers are permitted to create work assignments' using errcode = '42501';
  end if;

  -- Resolve active manager employee record
  select id, organization_id into v_manager_emp_id, v_org_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_manager_emp_id is null then
    raise exception 'Active manager employee record not found' using errcode = '42501';
  end if;

  -- Verify subordinate belongs to same org and reports directly to caller
  select exists (
    select 1 from public.employees
    where id = p_employee_id
      and organization_id = v_org_id
      and manager_employee_id = v_manager_emp_id
      and employment_status = 'active'
  ) into v_subordinate_ok;

  if not v_subordinate_ok then
    raise exception 'Target employee is not an active direct report in your organization' using errcode = '42501';
  end if;

  -- Validate title and date
  if char_length(trim(coalesce(p_title, ''))) < 3 then
    raise exception 'Task title must be at least 3 characters' using errcode = '22023';
  end if;
  if p_work_date is null then
    raise exception 'Work date is required' using errcode = '22023';
  end if;

  -- Validate priority
  begin
    v_priority_enum := p_priority::public.work_assignment_priority;
  exception when others then
    raise exception 'Invalid priority. Must be low, medium, high, or urgent' using errcode = '22023';
  end;

  -- Insert assignment
  insert into public.work_assignments (
    organization_id, employee_id, assigned_by, work_date,
    title, description, expected_outcome, priority, due_time,
    status, progress_percent
  ) values (
    v_org_id, p_employee_id, v_caller_uid, p_work_date,
    trim(p_title), nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_expected_outcome, '')), ''),
    v_priority_enum, p_due_time,
    'assigned', 0
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

-- ============================================================
-- 8. RPC: UPDATE WORK PROGRESS (Employee only, Atomic)
-- ============================================================
create function public.update_work_progress(
  p_assignment_id    uuid,
  p_status           text,
  p_progress_percent int,
  p_update_text      text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid     uuid := auth.uid();
  v_employee_id    uuid;
  v_assignment     record;
  v_new_status     public.work_assignment_status;
  v_progress       int;
  v_completed_at   timestamptz;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Admin & Recruiter forbidden; Employee role required
  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['employee']) then
    raise exception 'Only employees are permitted to update work progress' using errcode = '42501';
  end if;

  -- Resolve active employee record
  select id into v_employee_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_employee_id is null then
    raise exception 'Active employee record not found' using errcode = '42501';
  end if;

  -- Validate note text
  if char_length(trim(coalesce(p_update_text, ''))) < 2 then
    raise exception 'Progress update note must be at least 2 characters' using errcode = '22023';
  end if;

  -- Validate status parameter
  begin
    v_new_status := p_status::public.work_assignment_status;
  exception when others then
    raise exception 'Invalid status value' using errcode = '22023';
  end;

  -- Employees may only transition to in_progress, blocked, or completed
  if v_new_status not in ('in_progress', 'blocked', 'completed') then
    raise exception 'Employees can only set status to in_progress, blocked, or completed' using errcode = '42501';
  end if;

  -- Lock assignment row FOR UPDATE
  select * into v_assignment
  from public.work_assignments
  where id = p_assignment_id
    and employee_id = v_employee_id
  for update;

  if not found then
    raise exception 'Work assignment not found or does not belong to you' using errcode = 'P0002';
  end if;

  -- Terminal state check
  if v_assignment.status in ('completed', 'cancelled') then
    raise exception 'Cannot update a completed or cancelled assignment' using errcode = '42501';
  end if;

  -- Progress percentage handling
  if v_new_status = 'completed' then
    v_progress := 100;
    v_completed_at := now();
  else
    if p_progress_percent is null or p_progress_percent < 0 or p_progress_percent > 100 then
      raise exception 'Progress percent must be between 0 and 100' using errcode = '22023';
    end if;
    v_progress := p_progress_percent;
    v_completed_at := null;
  end if;

  -- Atomic update of assignment
  update public.work_assignments
  set
    status           = v_new_status,
    progress_percent = v_progress,
    completed_at     = v_completed_at,
    updated_at       = now()
  where id = p_assignment_id;

  -- Insert progress update audit record
  insert into public.work_assignment_updates (
    assignment_id, employee_id, organization_id,
    update_text, progress_percent, status_at_update
  ) values (
    p_assignment_id, v_employee_id, v_assignment.organization_id,
    trim(p_update_text), v_progress, v_new_status
  );

  return true;
end;
$$;

-- ============================================================
-- 9. RPC: MANAGE WORK ASSIGNMENT (Manager cancel / reopen)
-- ============================================================
create function public.manager_manage_work_assignment(
  p_assignment_id uuid,
  p_action        text,
  p_notes         text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid     uuid := auth.uid();
  v_assignment     record;
  v_can_manage     boolean;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['manager']) then
    raise exception 'Only managers are permitted to manage work assignments' using errcode = '42501';
  end if;

  if p_action not in ('cancel', 'reopen') then
    raise exception 'Invalid management action. Must be cancel or reopen' using errcode = '22023';
  end if;

  -- Lock assignment row FOR UPDATE
  select * into v_assignment
  from public.work_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'Work assignment not found' using errcode = 'P0002';
  end if;

  -- Check manager relationship
  v_can_manage := public.can_manager_manage_work(v_assignment.employee_id, v_assignment.organization_id);
  if not v_can_manage then
    raise exception 'You are not authorized to manage work for this employee' using errcode = '42501';
  end if;

  if p_action = 'cancel' then
    if v_assignment.status = 'cancelled' then
      raise exception 'Assignment is already cancelled' using errcode = '22023';
    end if;

    update public.work_assignments
    set
      status       = 'cancelled',
      completed_at = null,
      updated_at   = now()
    where id = p_assignment_id;

    -- Add audit note if provided
    if p_notes is not null and char_length(trim(p_notes)) >= 2 then
      insert into public.work_assignment_updates (
        assignment_id, employee_id, organization_id,
        update_text, progress_percent, status_at_update
      ) values (
        p_assignment_id, v_assignment.employee_id, v_assignment.organization_id,
        'Manager cancelled: ' || trim(p_notes), v_assignment.progress_percent, 'cancelled'
      );
    end if;

  elsif p_action = 'reopen' then
    if v_assignment.status <> 'completed' then
      raise exception 'Only completed assignments can be reopened' using errcode = '22023';
    end if;

    update public.work_assignments
    set
      status           = 'in_progress',
      progress_percent = 90,
      completed_at     = null,
      updated_at       = now()
    where id = p_assignment_id;

    insert into public.work_assignment_updates (
      assignment_id, employee_id, organization_id,
      update_text, progress_percent, status_at_update
    ) values (
      p_assignment_id, v_assignment.employee_id, v_assignment.organization_id,
      coalesce('Manager reopened: ' || nullif(trim(p_notes), ''), 'Assignment reopened for revision by manager'),
      90, 'in_progress'
    );
  end if;

  return true;
end;
$$;

-- ============================================================
-- 10. GRANTS AND PRIVILEGES
-- ============================================================
grant execute on function
  public.create_work_assignment(uuid, date, text, text, text, text, time),
  public.update_work_progress(uuid, text, int, text),
  public.manager_manage_work_assignment(uuid, text, text)
to authenticated;

grant select on public.work_assignments to authenticated;
grant select on public.work_assignment_updates to authenticated;

revoke insert, update, delete on public.work_assignments from authenticated, anon;
revoke insert, update, delete on public.work_assignment_updates from authenticated, anon;
revoke all on public.work_assignments, public.work_assignment_updates from anon;

grant usage on type public.work_assignment_priority to authenticated;
grant usage on type public.work_assignment_status to authenticated;
