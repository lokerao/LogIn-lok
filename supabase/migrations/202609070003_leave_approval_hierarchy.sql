-- Migration: 202609070003_leave_approval_hierarchy.sql
-- Description:
-- 1. Implement leave approval hierarchy:
--    - Employee personal leave -> assigned Manager (or HR organizational authority)
--    - Manager personal leave -> HR
--    - HR personal leave -> Admin
-- 2. Strictly prohibit self-approval (applicant cannot approve their own leave).
-- 3. Prohibit lower-level roles from approving higher-level users' personal leave.
-- 4. Prohibit peer managers from approving other managers' personal leave (must go to HR).
-- 5. Prohibit peer HR users from approving other HR users' personal leave (must go to Admin).
-- 6. Update leave_requests_select RLS policy to scope visible requests according to the hierarchy.

-- ============================================================
-- 1. HELPER FUNCTIONS TO IDENTIFY EMPLOYEE ROLES
-- ============================================================
create or replace function public.is_hr_employee(target_emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    join public.user_roles ur on ur.profile_id = e.profile_id
    where e.id = target_emp and ur.role_key = 'hr'
  );
$$;

create or replace function public.is_manager_employee(target_emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    join public.user_roles ur on ur.profile_id = e.profile_id
    where e.id = target_emp and ur.role_key = 'manager'
  ) and not exists (
    select 1 from public.employees e
    join public.user_roles ur on ur.profile_id = e.profile_id
    where e.id = target_emp and ur.role_key = 'hr'
  );
$$;

grant execute on function
  public.is_hr_employee(uuid),
  public.is_manager_employee(uuid)
to authenticated;

-- ============================================================
-- 2. REVIEW LEAVE REQUEST RPC WITH HIERARCHICAL ENFORCEMENT
-- ============================================================
create or replace function public.review_leave_request(
  p_request_id uuid,
  p_action     text,
  p_notes      text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid             uuid := auth.uid();
  v_req                    record;
  v_bal                    record;
  v_reviewer_org           uuid := public.current_organization_id();
  v_is_admin               boolean := public.has_role(array['admin']);
  v_is_hr                  boolean := public.has_role(array['hr']);
  v_is_manager             boolean := public.has_role(array['manager']);
  v_applicant_profile_id   uuid;
  v_applicant_is_hr        boolean := false;
  v_applicant_is_manager   boolean := false;
  v_can_review             boolean := false;
  v_new_status             public.leave_request_status;
  v_year                   int;
  v_available              numeric(5,1);
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Recruiter and Talent Viewer are always forbidden
  if public.has_role(array['recruiter', 'talent_viewer']) then
    raise exception 'You are not permitted to review leave requests' using errcode = '42501';
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

  -- Organization scoping
  if v_req.organization_id <> v_reviewer_org then
    raise exception 'You cannot review leave requests outside your organization' using errcode = '42501';
  end if;

  -- 2. Identify applicant identity and role
  select profile_id into v_applicant_profile_id
  from public.employees
  where id = v_req.employee_id;

  if v_applicant_profile_id is null then
    raise exception 'Employee record not found for leave request' using errcode = 'P0002';
  end if;

  -- Anti-self-approval rule: Applicant can NEVER approve their own leave request
  if v_applicant_profile_id = v_caller_uid then
    raise exception 'You are not permitted to review your own leave request' using errcode = '42501';
  end if;

  select
    exists(select 1 from public.user_roles where profile_id = v_applicant_profile_id and role_key = 'hr'),
    exists(select 1 from public.user_roles where profile_id = v_applicant_profile_id and role_key = 'manager')
  into v_applicant_is_hr, v_applicant_is_manager;

  -- 3. Enforce strict approval hierarchy
  if v_applicant_is_hr then
    -- LEVEL 3: HR personal leave -> Admin only
    if v_is_admin then
      v_can_review := true;
    else
      raise exception 'Only an Administrator can review HR personal leave requests' using errcode = '42501';
    end if;

  elsif v_applicant_is_manager then
    -- LEVEL 2: Manager personal leave -> HR only
    if v_is_hr then
      v_can_review := true;
    else
      raise exception 'Only HR can review Manager personal leave requests' using errcode = '42501';
    end if;

  else
    -- LEVEL 1: Employee personal leave -> Assigned Manager (or HR organizational authority)
    if v_is_manager and public.can_manager_review_leave(v_req.employee_id, v_req.organization_id) then
      v_can_review := true;
    elsif v_is_hr then
      v_can_review := true;
    else
      raise exception 'You are not authorized to review this employee leave request' using errcode = '42501';
    end if;
  end if;

  if not v_can_review then
    raise exception 'You are not authorized to review this leave request' using errcode = '42501';
  end if;

  -- 4. Concurrency-safe balance verification & deduction on approval
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

  -- 5. Update request status and audit fields
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

grant execute on function public.review_leave_request(uuid, text, text) to authenticated;

-- ============================================================
-- 3. RLS POLICIES ON LEAVE_REQUESTS
-- ============================================================
drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    not public.has_role(array['recruiter', 'talent_viewer']) and (
      -- 1. Applicants can select their own personal requests
      (public.has_role(array['employee', 'manager', 'hr']) and public.owns_leave_employee(employee_id)) or
      -- 2. Managers can select subordinate employee requests (excluding other managers and HR)
      (public.has_role(array['manager']) and public.can_manager_review_leave(employee_id, organization_id)
        and not public.is_manager_employee(employee_id) and not public.is_hr_employee(employee_id)) or
      -- 3. HR can select organization employee and manager requests (excluding other HR personal requests)
      (public.has_role(array['hr']) and organization_id = public.current_organization_id()
        and not public.is_hr_employee(employee_id)) or
      -- 4. Admin can select organization HR requests for approval
      (public.has_role(array['admin']) and organization_id = public.current_organization_id()
        and public.is_hr_employee(employee_id))
    )
  );
