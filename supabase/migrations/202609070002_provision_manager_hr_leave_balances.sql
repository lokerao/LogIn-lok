-- Migration: 202609070002_provision_manager_hr_leave_balances.sql
-- Description:
-- 1. Provision personal leave balances dynamically for Manager and HR roles using existing leave_types configuration.
-- 2. Create reusable security-definer helper public.provision_employee_leave_balances().
-- 3. Create on-demand RPC public.provision_my_leave_balances() for client-side self-healing.
-- 4. Create trigger on public.employees to auto-provision balances for active employees.
-- 5. Update submit_leave_request to auto-provision balance if missing prior to balance check.
-- 6. Execute idempotent backfill for all active employees for the current year.

-- ============================================================
-- 1. REUSABLE PROVISIONING FUNCTION
-- ============================================================
create or replace function public.provision_employee_leave_balances(
  p_employee_id uuid,
  p_year        int default extract(year from current_date)::int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.employees
  where id = p_employee_id and employment_status = 'active';

  if v_org_id is null then
    return;
  end if;

  -- Dynamically insert balance rows for all active leave types in the employee's organization.
  -- Existing balance rows are NEVER overwritten (preserves allocated_days and used_days).
  insert into public.leave_balances (
    employee_id,
    organization_id,
    leave_type_id,
    year,
    allocated_days,
    used_days
  )
  select
    p_employee_id,
    v_org_id,
    lt.id,
    p_year,
    lt.max_days_per_year::numeric(5,1),
    0
  from public.leave_types lt
  where lt.organization_id = v_org_id
    and lt.is_active = true
  on conflict (employee_id, leave_type_id, year) do nothing;
end;
$$;

-- ============================================================
-- 2. ON-DEMAND RPC FOR AUTHENTICATED USER
-- ============================================================
create or replace function public.provision_my_leave_balances(
  p_year int default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid  uuid := auth.uid();
  v_employee_id uuid;
  v_year        int := coalesce(p_year, extract(year from current_date)::int);
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter', 'talent_viewer']) or not public.has_role(array['employee', 'manager', 'hr']) then
    raise exception 'You are not permitted to provision leave balances' using errcode = '42501';
  end if;

  select id into v_employee_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_employee_id is not null then
    perform public.provision_employee_leave_balances(v_employee_id, v_year);
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.provision_my_leave_balances(int) to authenticated;

-- ============================================================
-- 3. AUTO-PROVISION TRIGGER ON EMPLOYEES TABLE
-- ============================================================
create or replace function public.trig_provision_employee_leave_balances()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.employment_status = 'active' then
    perform public.provision_employee_leave_balances(new.id, extract(year from current_date)::int);
  end if;
  return new;
end;
$$;

drop trigger if exists on_employee_provision_leave_balances on public.employees;
create trigger on_employee_provision_leave_balances
  after insert or update of employment_status on public.employees
  for each row
  execute function public.trig_provision_employee_leave_balances();

-- ============================================================
-- 4. UPDATE SUBMIT_LEAVE_REQUEST (AUTO-PROVISION ON SUBMISSION)
-- ============================================================
create or replace function public.submit_leave_request(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_is_half_day boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid    uuid := auth.uid();
  v_employee_id   uuid;
  v_org_id        uuid;
  v_type_ok       boolean;
  v_allows_half   boolean;
  v_days          numeric(4, 1);
  v_allocated     numeric(4, 1);
  v_used          numeric(4, 1);
  v_pending_days  numeric(4, 1);
  v_effective_bal numeric(4, 1);
  v_request_id    uuid;
  v_overlap       boolean;
  v_year          int;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Admin & Recruiter forbidden; Employee, Manager, and HR roles permitted
  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['employee', 'manager', 'hr']) then
    raise exception 'You are not permitted to submit leave requests' using errcode = '42501';
  end if;

  -- Active employee consistency
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

  -- Past date restriction: Block leave application for past dates (< current_date)
  if p_start_date < current_date then
    raise exception 'Leave requests cannot be submitted for past dates' using errcode = '22023';
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

  -- 2. Fetch allocated and used days (auto-provisioning if missing)
  select allocated_days, used_days into v_allocated, v_used
  from public.leave_balances
  where employee_id = v_employee_id
    and leave_type_id = p_leave_type_id
    and year = v_year;

  if v_allocated is null then
    perform public.provision_employee_leave_balances(v_employee_id, v_year);

    select allocated_days, used_days into v_allocated, v_used
    from public.leave_balances
    where employee_id = v_employee_id
      and leave_type_id = p_leave_type_id
      and year = v_year;
  end if;

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
-- 5. IDEMPOTENT BACKFILL FOR ALL CURRENT ACTIVE EMPLOYEES
-- ============================================================
insert into public.leave_balances (
  employee_id,
  organization_id,
  leave_type_id,
  year,
  allocated_days,
  used_days
)
select
  e.id,
  e.organization_id,
  lt.id,
  extract(year from current_date)::int,
  lt.max_days_per_year::numeric(5,1),
  0
from public.employees e
join public.leave_types lt
  on lt.organization_id = e.organization_id and lt.is_active = true
where e.employment_status = 'active'
on conflict (employee_id, leave_type_id, year) do nothing;
