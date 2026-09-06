-- Migration: 202609070001_manager_hr_leave_application_and_past_date_restriction.sql
-- Description:
-- 1. Allow Employee, Manager, and HR roles to submit personal leave requests.
-- 2. Restrict leave application for past dates (< current_date).
-- 3. Allow Employee, Manager, and HR roles to cancel their own pending leave requests.
-- 4. Update RLS policies on leave_balances and leave_requests to allow Employee, Manager, and HR to read their own personal leave records.

-- ============================================================
-- 1. SUBMIT LEAVE REQUEST RPC
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
-- 2. CANCEL LEAVE REQUEST RPC
-- ============================================================
create or replace function public.cancel_leave_request(
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

  -- Admin & Recruiter forbidden; Employee, Manager, and HR roles permitted
  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['employee', 'manager', 'hr']) then
    raise exception 'You are not permitted to cancel leave requests' using errcode = '42501';
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
    raise exception 'Only pending leave requests can be cancelled' using errcode = '22023';
  end if;

  update public.leave_requests
  set status = 'cancelled',
      updated_at = now()
  where id = p_request_id;

  return true;
end;
$$;

grant execute on function
  public.submit_leave_request(uuid, date, date, text, boolean),
  public.cancel_leave_request(uuid)
to authenticated;

-- ============================================================
-- 3. RLS POLICIES (Allow Employee, Manager, HR to select own records)
-- ============================================================
drop policy if exists leave_balances_select on public.leave_balances;
create policy leave_balances_select on public.leave_balances
  for select to authenticated
  using (
    not public.has_role(array['admin', 'recruiter']) and (
      (public.has_role(array['employee', 'manager', 'hr']) and public.owns_leave_employee(employee_id)) or
      (public.has_role(array['hr']) and organization_id = public.current_organization_id()) or
      (public.has_role(array['manager']) and public.can_manager_review_leave(employee_id, organization_id))
    )
  );

drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    not public.has_role(array['admin', 'recruiter']) and (
      (public.has_role(array['employee', 'manager', 'hr']) and public.owns_leave_employee(employee_id)) or
      (public.has_role(array['hr']) and organization_id = public.current_organization_id()) or
      (public.has_role(array['manager']) and public.can_manager_review_leave(employee_id, organization_id))
    )
  );
