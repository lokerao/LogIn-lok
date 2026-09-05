-- ============================================================
-- LogIn — Phase 9 Additive Migration
-- Industrial Workforce Status & Approved-Leave / Attendance Logic
-- Migration: 202609040006_phase9_workforce_status_and_leave_attendance_logic.sql
-- ============================================================

-- ============================================================
-- 1. ADD LEAVE_RECONCILED COLUMN TO ATTENDANCE_RECORDS
-- ============================================================
alter table public.attendance_records
  add column if not exists leave_reconciled boolean not null default false;

-- ============================================================
-- 2. RECONCILE ATTENDANCE ON APPROVED LEAVE DAY (review_attendance_photo)
-- ============================================================
-- When HR verifies/approves an attendance record for a date covered by
-- an approved leave request:
-- - The verified working hours remain valid.
-- - The day is treated as worked attendance.
-- - That worked day must NOT consume the employee's leave entitlement.
-- - Deducts from used_days in public.leave_balances (refunds 1.0 or 0.5 day).
-- - Prevents double-counting as both leave and worked attendance.
-- ============================================================
create or replace function public.review_attendance_photo(
  p_attendance_id uuid,
  p_event_type text, -- 'check_in' or 'check_out'
  p_status public.attendance_verification_status,
  p_notes text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_att          record;
  v_lr           record;
  v_refund_days  numeric(5,1);
  v_year         integer;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select organization_id into v_org_id from public.profiles where id = v_caller_uid;

  if not public.has_role(array['hr']) then
    raise exception 'Only HR role can verify attendance photos' using errcode = '42501';
  end if;

  select * into v_att
  from public.attendance_records
  where id = p_attendance_id and organization_id = v_org_id
  for update;

  if not found then
    raise exception 'Attendance record not found in your organization' using errcode = 'P0002';
  end if;

  if p_event_type = 'check_in' then
    update public.attendance_records
    set
      check_in_verification_status = p_status,
      check_in_reviewed_by = v_caller_uid,
      check_in_reviewed_at = now(),
      check_in_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id;
  elsif p_event_type = 'check_out' then
    update public.attendance_records
    set
      check_out_verification_status = p_status,
      check_out_reviewed_by = v_caller_uid,
      check_out_reviewed_at = now(),
      check_out_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id;
  else
    raise exception 'Invalid event type. Must be check_in or check_out' using errcode = '22023';
  end if;

  -- Reconcile attendance on approved leave day upon approval
  if p_status = 'approved' and not v_att.leave_reconciled then
    select lr.id, lr.leave_type_id, lr.is_half_day, lr.requested_days
    into v_lr
    from public.leave_requests lr
    where lr.employee_id = v_att.employee_id
      and lr.status = 'approved'
      and v_att.attendance_date >= lr.start_date
      and v_att.attendance_date <= lr.end_date
    limit 1;

    if v_lr.id is not null then
      v_refund_days := case when v_lr.is_half_day then 0.5 else 1.0 end;
      v_year := extract(year from v_att.attendance_date)::integer;

      update public.leave_balances
      set used_days = greatest(0, used_days - v_refund_days),
          updated_at = now()
      where employee_id = v_att.employee_id
        and leave_type_id = v_lr.leave_type_id
        and year = v_year;

      update public.attendance_records
      set leave_reconciled = true
      where id = p_attendance_id;
    end if;
  elsif p_status = 'rejected' and v_att.leave_reconciled then
    select lr.id, lr.leave_type_id, lr.is_half_day
    into v_lr
    from public.leave_requests lr
    where lr.employee_id = v_att.employee_id
      and lr.status = 'approved'
      and v_att.attendance_date >= lr.start_date
      and v_att.attendance_date <= lr.end_date
    limit 1;

    if v_lr.id is not null then
      v_refund_days := case when v_lr.is_half_day then 0.5 else 1.0 end;
      v_year := extract(year from v_att.attendance_date)::integer;

      update public.leave_balances
      set used_days = used_days + v_refund_days,
          updated_at = now()
      where employee_id = v_att.employee_id
        and leave_type_id = v_lr.leave_type_id
        and year = v_year;

      update public.attendance_records
      set leave_reconciled = false
      where id = p_attendance_id;
    end if;
  end if;

  return true;
end;
$$;

grant execute on function public.review_attendance_photo(uuid, text, public.attendance_verification_status, text) to authenticated;


-- ============================================================
-- 3. GUARD CHECK-IN AGAINST TERMINATED / INACTIVE EMPLOYEES
-- ============================================================
-- Ensures permanently inactive or terminated employees cannot check in.
-- Approved leave does NOT block check-in (emergency work is allowed).
-- ============================================================
create or replace function public.record_attendance_check_in(
  p_photo_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_employee_id uuid;
  v_org_id uuid;
  v_status public.employment_status;
  v_record_id uuid;
  v_active_exists boolean;
begin
  select id, organization_id, employment_status into v_employee_id, v_org_id, v_status
  from public.employees where profile_id = auth.uid();

  if v_employee_id is null then
    raise exception 'Employee record not found for authenticated user' using errcode = '42501';
  end if;

  if v_status = 'terminated' then
    raise exception 'Terminated employees cannot check in' using errcode = '42501';
  end if;
  if v_status = 'inactive' then
    raise exception 'Inactive employees cannot check in. Contact HR to reactivate your profile.' using errcode = '42501';
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

grant execute on function public.record_attendance_check_in(text) to authenticated;


-- ============================================================
-- 4. UPDATE EMPLOYEE EMPLOYMENT STATUS (HR LIFECYCLE ACTIONS ONLY)
-- ============================================================
-- Valid actions: 'active' (reactivate), 'inactive', 'terminated'.
-- Daily 'on_leave' is an automatically derived daily workforce status
-- and cannot be set as a permanent lifecycle action.
-- ============================================================
create or replace function public.update_employee_employment_status(
  p_employee_id uuid,
  p_status text,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_target_emp   record;
  v_valid_status public.employment_status;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to update employment status' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select id, profile_id, employee_code, first_name, last_name, employment_status
  into v_target_emp
  from public.employees
  where id = p_employee_id and organization_id = v_org_id;

  if v_target_emp.id is null then
    raise exception 'Target employee not found in your organization' using errcode = '42501';
  end if;

  if v_target_emp.profile_id = v_caller_uid then
    raise exception 'HR personnel cannot modify their own employment status' using errcode = '42501';
  end if;

  if p_status not in ('active', 'inactive', 'terminated') then
    raise exception 'Invalid HR lifecycle status "%". Valid actions: active (reactivate), inactive, terminated. Daily "on_leave" is derived automatically from approved leave requests.', p_status using errcode = '22023';
  end if;

  v_valid_status := p_status::public.employment_status;

  update public.employees
  set employment_status = v_valid_status,
      updated_at = now()
  where id = p_employee_id;

  return jsonb_build_object(
    'employee_id', p_employee_id,
    'employee_code', v_target_emp.employee_code,
    'old_status', v_target_emp.employment_status,
    'new_status', v_valid_status,
    'updated_at', now()
  );
end;
$$;

grant execute on function public.update_employee_employment_status(uuid, text, text) to authenticated;


-- ============================================================
-- 5. DYNAMIC HR DASHBOARD SUMMARY (DERIVED DAILY WORKFORCE STATUS)
-- ============================================================
create or replace function public.get_hr_dashboard_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid        uuid := auth.uid();
  v_org_id            uuid;
  v_today             date := current_date;
  v_total_employees   integer;
  v_active_employees  integer;
  v_inactive_employees integer;
  v_on_leave_employees integer;
  v_departments_count integer;
  v_teams_count       integer;
  v_pending_leaves    integer;
  v_pending_attendance integer;
  v_pending_talent    integer;
  v_working_today     integer;
  v_work_today_total  integer;
  v_work_in_progress  integer;
  v_work_completed    integer;
  v_work_overdue      integer;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to view the HR dashboard' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  -- Dynamic Daily Workforce Status counts for today:
  -- - Total: all enrolled employees (excluding permanently terminated)
  -- - Active: currently checked in and working today (att.id is not null and check_out_at is null)
  -- - On Leave: approved leave today and NOT checked in
  -- - Inactive: not currently working today, or checked out, or permanently inactive
  with emp_daily as (
    select
      e.id,
      e.employment_status as perm_status,
      case
        when e.employment_status = 'terminated' then 'terminated'
        when e.employment_status = 'inactive' then 'inactive'
        when att.id is not null and att.check_out_at is null then 'active'
        when att.id is not null and att.check_out_at is not null then 'inactive'
        when lv_today.employee_id is not null then 'on_leave'
        else 'inactive'
      end as daily_status
    from public.employees e
    left join public.attendance_records att on att.employee_id = e.id and att.attendance_date = v_today
    left join (
      select distinct employee_id
      from public.leave_requests
      where status = 'approved'
        and v_today >= start_date
        and v_today <= end_date
    ) lv_today on lv_today.employee_id = e.id
    where e.organization_id = v_org_id
  )
  select
    count(*) filter (where perm_status <> 'terminated'),
    count(*) filter (where daily_status = 'active'),
    count(*) filter (where daily_status = 'inactive'),
    count(*) filter (where daily_status = 'on_leave')
  into
    v_total_employees,
    v_active_employees,
    v_inactive_employees,
    v_on_leave_employees
  from emp_daily;

  -- Organization structure counts
  select count(*) into v_departments_count
  from public.departments
  where organization_id = v_org_id;

  select count(*) into v_teams_count
  from public.teams
  where organization_id = v_org_id;

  -- Pending leave requests
  select count(*) into v_pending_leaves
  from public.leave_requests lr
  join public.employees e on e.id = lr.employee_id
  where e.organization_id = v_org_id
    and lr.status = 'pending';

  -- Attendance verification pending
  select count(*) into v_pending_attendance
  from public.attendance_records ar
  where ar.organization_id = v_org_id
    and (ar.check_in_verification_status = 'pending' or ar.check_out_verification_status = 'pending');

  -- Pending talent profile reviews
  select count(*) into v_pending_talent
  from public.talent_profiles tp
  join public.employees e on e.id = tp.employee_id
  where e.organization_id = v_org_id
    and tp.review_status = 'pending';

  -- Employees currently clocked-in today
  select count(distinct ar.employee_id) into v_working_today
  from public.attendance_records ar
  where ar.organization_id = v_org_id
    and ar.attendance_date = v_today
    and ar.check_out_at is null;

  -- Work assignments metrics for today
  select
    count(*),
    count(*) filter (where status = 'in_progress'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status not in ('completed', 'cancelled') and (work_date < v_today or (work_date = v_today and due_time is not null and due_time < current_time)))
  into
    v_work_today_total,
    v_work_in_progress,
    v_work_completed,
    v_work_overdue
  from public.work_assignments
  where organization_id = v_org_id
    and (work_date = v_today or (status not in ('completed', 'cancelled') and work_date < v_today));

  return jsonb_build_object(
    'total_employees', coalesce(v_total_employees, 0),
    'active_employees', coalesce(v_active_employees, 0),
    'inactive_employees', coalesce(v_inactive_employees, 0),
    'on_leave_employees', coalesce(v_on_leave_employees, 0),
    'departments_count', coalesce(v_departments_count, 0),
    'teams_count', coalesce(v_teams_count, 0),
    'pending_leaves_count', coalesce(v_pending_leaves, 0),
    'pending_attendance_count', coalesce(v_pending_attendance, 0),
    'pending_talent_reviews_count', coalesce(v_pending_talent, 0),
    'working_today_count', coalesce(v_working_today, 0),
    'work_summary', jsonb_build_object(
      'today_total', coalesce(v_work_today_total, 0),
      'in_progress', coalesce(v_work_in_progress, 0),
      'completed', coalesce(v_work_completed, 0),
      'overdue', coalesce(v_work_overdue, 0)
    )
  );
end;
$$;

grant execute on function public.get_hr_dashboard_summary() to authenticated;


-- ============================================================
-- 6. GET HR EMPLOYEE DIRECTORY (WITH DERIVED DAILY WORKFORCE STATUS)
-- ============================================================
create or replace function public.get_hr_employee_directory(
  p_search text default null,
  p_status text default null,
  p_department_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_today        date := current_date;
  v_result       jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to view the employee directory' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'employee_code', e.employee_code,
      'first_name', case
        when e.first_name = 'Test' and e.last_name = 'Employee' and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee')
          then substring(split_part(trim(p.display_name), ' ', 1) from 1 for 100)
        else e.first_name
      end,
      'last_name', case
        when e.first_name = 'Test' and e.last_name = 'Employee' and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee')
          then substring(coalesce(nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), ''), split_part(trim(p.display_name), ' ', 1)) from 1 for 100)
        else e.last_name
      end,
      'work_email', e.work_email,
      'phone', e.phone,
      'employment_status', e.employment_status, -- Permanent HR lifecycle status ('active', 'inactive', 'terminated')
      'current_workforce_status', case
        when e.employment_status = 'terminated' then 'terminated'
        when e.employment_status = 'inactive' then 'inactive'
        when att.id is not null and att.check_out_at is null then 'active'
        when att.id is not null and att.check_out_at is not null then 'inactive'
        when lv_today.employee_id is not null then 'on_leave'
        else 'inactive'
      end, -- Automatically derived daily workforce status
      'has_approved_leave_today', (lv_today.employee_id is not null),
      'working_on_leave', (lv_today.employee_id is not null and att.id is not null and att.check_out_at is null),
      'employment_type', e.employment_type,
      'joining_date', e.joining_date,
      'department_id', dept.id,
      'department_name', dept.name,
      'team_id', tm.id,
      'team_name', tm.name,
      'designation_id', des.id,
      'designation_name', des.name,
      'manager_employee_id', mgr.id,
      'manager_name', case when mgr.id is not null then trim(concat(mgr.first_name, ' ', mgr.last_name)) else null end,
      'manager_code', mgr.employee_code,
      'location_id', loc.id,
      'location_name', loc.name,
      'today_attendance_status', case
        when att.id is not null and att.check_out_at is null then 'checked_in'
        when att.id is not null and att.check_out_at is not null then 'checked_out'
        else 'not_clocked_in'
      end,
      'today_check_in_time', to_char(att.check_in_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'today_check_out_time', to_char(att.check_out_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'pending_leaves_count', coalesce(lv.pending_cnt, 0),
      'active_tasks_count', coalesce(wk.active_cnt, 0),
      'talent_review_status', tp.review_status
    ) order by
      case
        when e.first_name = 'Test' and e.last_name = 'Employee' and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee')
          then split_part(trim(p.display_name), ' ', 1)
        else e.first_name
      end,
      e.last_name
  ), '[]'::jsonb)
  into v_result
  from public.employees e
  left join public.profiles p on p.id = e.profile_id
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.departments dept on dept.id = e.department_id
  left join public.locations loc on loc.id = e.location_id
  left join public.employees mgr on mgr.id = e.manager_employee_id
  -- Join today's attendance record
  left join public.attendance_records att on att.employee_id = e.id and att.attendance_date = v_today
  -- Join today's approved leave record (inclusive start_date to end_date)
  left join (
    select distinct employee_id
    from public.leave_requests
    where status = 'approved'
      and v_today >= start_date
      and v_today <= end_date
  ) lv_today on lv_today.employee_id = e.id
  -- Aggregate pending leaves
  left join (
    select employee_id, count(*) as pending_cnt
    from public.leave_requests
    where status = 'pending'
    group by employee_id
  ) lv on lv.employee_id = e.id
  -- Aggregate active work assignments
  left join (
    select
      employee_id,
      count(*) filter (where status in ('assigned', 'in_progress', 'blocked')) as active_cnt
    from public.work_assignments
    where work_date = v_today
    group by employee_id
  ) wk on wk.employee_id = e.id
  -- Talent profile status
  left join public.talent_profiles tp on tp.employee_id = e.id
  where e.organization_id = v_org_id
    -- Status filtering applies against Current Daily Workforce Status
    and (
      p_status is null
      or p_status = 'all'
      or (
        case
          when e.employment_status = 'terminated' then 'terminated'
          when e.employment_status = 'inactive' then 'inactive'
          when att.id is not null and att.check_out_at is null then 'active'
          when att.id is not null and att.check_out_at is not null then 'inactive'
          when lv_today.employee_id is not null then 'on_leave'
          else 'inactive'
        end
      ) = p_status
    )
    and (p_department_id is null or e.department_id = p_department_id)
    and (
      p_search is null
      or trim(p_search) = ''
      or e.first_name ilike '%' || trim(p_search) || '%'
      or e.last_name ilike '%' || trim(p_search) || '%'
      or e.employee_code ilike '%' || trim(p_search) || '%'
      or e.work_email ilike '%' || trim(p_search) || '%'
      or p.display_name ilike '%' || trim(p_search) || '%'
    );

  return v_result;
end;
$$;

grant execute on function public.get_hr_employee_directory(text, text, uuid) to authenticated;


-- ============================================================
-- 7. GET HR EMPLOYEE DETAILS (WITH DERIVED DAILY WORKFORCE STATUS)
-- ============================================================
create or replace function public.get_hr_employee_details(p_employee_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid    uuid := auth.uid();
  v_org_id        uuid;
  v_today         date := current_date;
  v_emp           record;
  v_year          integer := extract(year from current_date)::integer;
  v_attendance    jsonb;
  v_balances      jsonb;
  v_leaves        jsonb;
  v_assignments   jsonb;
  v_talent        jsonb;
  v_today_leave   jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to view employee details' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  -- Validate and fetch target employee with derived workforce status
  select
    e.id, e.employee_code,
    case
      when e.first_name = 'Test' and e.last_name = 'Employee' and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee')
        then substring(split_part(trim(p.display_name), ' ', 1) from 1 for 100)
      else e.first_name
    end as first_name,
    case
      when e.first_name = 'Test' and e.last_name = 'Employee' and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee')
        then substring(coalesce(nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), ''), split_part(trim(p.display_name), ' ', 1)) from 1 for 100)
      else e.last_name
    end as last_name,
    e.work_email, e.phone,
    e.employment_status, -- Permanent HR lifecycle status
    case
      when e.employment_status = 'terminated' then 'terminated'
      when e.employment_status = 'inactive' then 'inactive'
      when att.id is not null and att.check_out_at is null then 'active'
      when att.id is not null and att.check_out_at is not null then 'inactive'
      when lv_today.employee_id is not null then 'on_leave'
      else 'inactive'
    end as current_workforce_status, -- Derived daily status
    (lv_today.employee_id is not null) as has_approved_leave_today,
    (lv_today.employee_id is not null and att.id is not null and att.check_out_at is null) as working_on_leave,
    e.employment_type, e.joining_date,
    des.name as designation, tm.name as team, dept.name as department, loc.name as location,
    mgr.id as manager_id,
    case when mgr.id is not null then trim(concat(mgr.first_name, ' ', mgr.last_name)) else null end as manager_name,
    mgr.employee_code as manager_code,
    coalesce(trim(concat(e.first_name, ' ', e.last_name)), p.display_name) as display_name
  into v_emp
  from public.employees e
  left join public.profiles p on p.id = e.profile_id
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.departments dept on dept.id = e.department_id
  left join public.locations loc on loc.id = e.location_id
  left join public.employees mgr on mgr.id = e.manager_employee_id
  left join public.attendance_records att on att.employee_id = e.id and att.attendance_date = v_today
  left join (
    select distinct employee_id
    from public.leave_requests
    where status = 'approved'
      and v_today >= start_date
      and v_today <= end_date
  ) lv_today on lv_today.employee_id = e.id
  where e.id = p_employee_id
    and e.organization_id = v_org_id;

  if v_emp.id is null then
    raise exception 'Employee not found in your organization' using errcode = '42501';
  end if;

  -- 1. Recent attendance history (last 10 records)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', att.id,
      'attendance_date', att.attendance_date,
      'check_in_at', att.check_in_at,
      'check_out_at', att.check_out_at,
      'check_in_verification_status', att.check_in_verification_status,
      'check_out_verification_status', att.check_out_verification_status,
      'check_in_photo_path', att.check_in_photo_path,
      'check_out_photo_path', att.check_out_photo_path,
      'leave_reconciled', att.leave_reconciled
    ) order by att.attendance_date desc, att.created_at desc
  ), '[]'::jsonb)
  into v_attendance
  from (
    select id, attendance_date, check_in_at, check_out_at, check_in_verification_status, check_out_verification_status, check_in_photo_path, check_out_photo_path, leave_reconciled, created_at
    from public.attendance_records
    where employee_id = p_employee_id
    order by attendance_date desc, created_at desc
    limit 10
  ) att;

  -- 2. Leave balances for current year
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'leave_type_name', lt.name,
      'allocated_days', lb.allocated_days,
      'used_days', lb.used_days,
      'available_days', lb.allocated_days - lb.used_days
    ) order by lt.name
  ), '[]'::jsonb)
  into v_balances
  from public.leave_balances lb
  join public.leave_types lt on lt.id = lb.leave_type_id
  where lb.employee_id = p_employee_id and lb.year = v_year;

  -- 3. Recent leave requests (last 10)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', lr.id,
      'leave_type_name', lt.name,
      'start_date', lr.start_date,
      'end_date', lr.end_date,
      'requested_days', lr.requested_days,
      'is_half_day', lr.is_half_day,
      'status', lr.status,
      'reason', lr.reason,
      'reviewer_notes', lr.reviewer_notes,
      'review_notes', lr.reviewer_notes,
      'created_at', lr.created_at
    ) order by lr.created_at desc
  ), '[]'::jsonb)
  into v_leaves
  from (
    select lr.id, lr.leave_type_id, lr.start_date, lr.end_date, lr.requested_days, lr.is_half_day, lr.status, lr.reason, lr.reviewer_notes, lr.created_at
    from public.leave_requests lr
    where lr.employee_id = p_employee_id
    order by lr.created_at desc
    limit 10
  ) lr
  join public.leave_types lt on lt.id = lr.leave_type_id;

  -- 4. Recent work assignments (last 10)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', wk.id,
      'title', wk.title,
      'description', wk.description,
      'priority', wk.priority,
      'status', wk.status,
      'progress_percent', wk.progress_percent,
      'work_date', wk.work_date,
      'due_time', wk.due_time,
      'created_at', wk.created_at
    ) order by wk.work_date desc, wk.created_at desc
  ), '[]'::jsonb)
  into v_assignments
  from (
    select id, title, description, priority, status, progress_percent, work_date, due_time, created_at
    from public.work_assignments
    where employee_id = p_employee_id
    order by work_date desc, created_at desc
    limit 10
  ) wk;

  -- 5. Talent profile summary and detailed items
  select
    case
      when tp.id is not null then
        jsonb_build_object(
          'talent_id', tp.id,
          'professional_name', tp.professional_name,
          'professional_title', tp.professional_title,
          'summary', tp.summary,
          'review_status', tp.review_status,
          'reviewer_notes', tp.reviewer_notes,
          'skills_count', (select count(*) from public.employee_skills where employee_id = p_employee_id),
          'experiences_count', (select count(*) from public.experiences where employee_id = p_employee_id),
          'projects_count', (select count(*) from public.projects where employee_id = p_employee_id),
          'certifications_count', (select count(*) from public.certifications where employee_id = p_employee_id),
          'education_count', (select count(*) from public.education where employee_id = p_employee_id),
          'achievements_count', (select count(*) from public.achievements where employee_id = p_employee_id),
          'skills', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', es.id,
                'name', s.name,
                'category', s.category,
                'proficiency', es.proficiency_level,
                'review_status', es.review_status,
                'reviewer_notes', es.reviewer_notes
              ) order by s.name
            )
            from public.employee_skills es
            join public.skills s on s.id = es.skill_id
            where es.employee_id = p_employee_id
          ), '[]'::jsonb),
          'experiences', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', exp.id,
                'company', exp.company_name,
                'job_title', exp.title,
                'employment_type', exp.employment_type,
                'start_date', exp.start_date,
                'end_date', exp.end_date,
                'is_current', exp.is_current,
                'description', exp.description,
                'review_status', exp.review_status,
                'reviewer_notes', exp.reviewer_notes
              ) order by exp.start_date desc
            )
            from public.experiences exp
            where exp.employee_id = p_employee_id
          ), '[]'::jsonb),
          'education', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', edu.id,
                'institution', edu.institution_name,
                'qualification', edu.degree,
                'field_of_study', edu.field_of_study,
                'start_date', edu.start_date,
                'end_date', edu.end_date,
                'description', edu.description,
                'review_status', edu.review_status,
                'reviewer_notes', edu.reviewer_notes
              ) order by edu.start_date desc
            )
            from public.education edu
            where edu.employee_id = p_employee_id
          ), '[]'::jsonb),
          'certifications', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', cert.id,
                'name', cert.name,
                'issuer', cert.issuing_organization,
                'issue_date', cert.issue_date,
                'expiry_date', cert.expiration_date,
                'credential_id', cert.credential_id,
                'verification_url', cert.credential_url,
                'review_status', cert.review_status,
                'reviewer_notes', cert.reviewer_notes
              ) order by cert.issue_date desc
            )
            from public.certifications cert
            where cert.employee_id = p_employee_id
          ), '[]'::jsonb),
          'projects', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', proj.id,
                'name', proj.title,
                'role', proj.role,
                'description', proj.description,
                'technologies', proj.technologies,
                'start_date', proj.start_date,
                'end_date', proj.end_date,
                'is_current', proj.is_current,
                'project_url', proj.project_url,
                'review_status', proj.review_status,
                'reviewer_notes', proj.reviewer_notes
              ) order by proj.start_date desc
            )
            from public.projects proj
            where proj.employee_id = p_employee_id
          ), '[]'::jsonb),
          'achievements', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', ach.id,
                'title', ach.title,
                'description', ach.description,
                'achieved_on', ach.date_awarded,
                'issuer', ach.issuer,
                'review_status', ach.review_status,
                'reviewer_notes', ach.reviewer_notes
              ) order by ach.date_awarded desc
            )
            from public.achievements ach
            where ach.employee_id = p_employee_id
          ), '[]'::jsonb)
        )
      else null
    end
  into v_talent
  from public.talent_profiles tp
  where tp.employee_id = p_employee_id;

  return jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'employee_code', v_emp.employee_code,
      'first_name', v_emp.first_name,
      'last_name', v_emp.last_name,
      'display_name', v_emp.display_name,
      'work_email', v_emp.work_email,
      'phone', v_emp.phone,
      'employment_status', v_emp.employment_status, -- Permanent HR lifecycle status
      'current_workforce_status', v_emp.current_workforce_status, -- Derived daily status
      'has_approved_leave_today', v_emp.has_approved_leave_today,
      'working_on_leave', v_emp.working_on_leave,
      'employment_type', v_emp.employment_type,
      'joining_date', v_emp.joining_date,
      'designation', v_emp.designation,
      'team', v_emp.team,
      'department', v_emp.department,
      'location', v_emp.location,
      'manager_name', v_emp.manager_name,
      'manager_code', v_emp.manager_code
    ),
    'attendance_history', v_attendance,
    'leave_balances', v_balances,
    'leave_requests', v_leaves,
    'work_assignments', v_assignments,
    'talent_profile', v_talent
  );
end;
$$;

grant execute on function public.get_hr_employee_details(uuid) to authenticated;

