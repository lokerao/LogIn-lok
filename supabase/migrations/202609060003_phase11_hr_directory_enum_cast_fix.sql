-- ============================================================
-- Migration: 202609060003_phase11_hr_directory_enum_cast_fix.sql
-- Description:
--   Phase 11 HR Hub Additive PostgreSQL Type Correction
--   Fixes runtime PostgreSQL error in public.get_hr_employee_directory():
--     "operator does not exist: employment_status = text"
--
-- Root Cause:
--   e.employment_status is of enum type public.employment_status.
--   p_status is a function parameter of type text.
--   The comparison `e.employment_status = p_status` failed because PostgreSQL
--   has no operator for (employment_status, text).
--
-- Fix:
--   Safely handles enum/text comparison using both e.employment_status::text = p_status
--   and explicit enum casting guarded by validation, while preserving:
--     - Exact function signature: (p_search text, p_status text, p_department_id uuid)
--     - Strict HR authorization (admin and talent_viewer forbidden)
--     - Organization scoping via current_organization_id()
--     - Database boundary excluding external talent_viewer profiles
--     - Complete absence of legacy recruiter role
-- ============================================================

-- 1. GET HR EMPLOYEE DIRECTORY (ENUM CAST & BOUNDARY SAFE)
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

  if public.has_role(array['admin', 'talent_viewer']) or not public.has_role(array['hr']) then
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
        when e.first_name = 'Test' and e.last_name in ('Employee', 'Recruiter') and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee', 'Test Recruiter', 'test recruiter')
          then substring(split_part(trim(p.display_name), ' ', 1) from 1 for 100)
        else e.first_name
      end,
      'last_name', case
        when e.first_name = 'Test' and e.last_name in ('Employee', 'Recruiter') and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee', 'Test Recruiter', 'test recruiter')
          then substring(coalesce(nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), ''), split_part(trim(p.display_name), ' ', 1)) from 1 for 100)
        else e.last_name
      end,
      'work_email', e.work_email,
      'phone', e.phone,
      'employment_status', e.employment_status,
      'current_workforce_status', case
        when e.employment_status::text = 'terminated' then 'terminated'
        when e.employment_status::text = 'inactive' then 'inactive'
        when att.id is not null and att.check_out_at is null then 'active'
        when lv_today.employee_id is not null and att.id is null then 'on_leave'
        else e.employment_status::text
      end,
      'today_attendance_status', case
        when att.id is not null and att.check_out_at is null then 'checked_in'
        when att.id is not null and att.check_out_at is not null then 'checked_out'
        else 'not_checked_in'
      end,
      'today_leave_status', case
        when lv_today.employee_id is not null then 'on_leave'
        else 'none'
      end,
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
      'today_check_in_time', to_char(att.check_in_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'today_check_out_time', to_char(att.check_out_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'pending_leaves_count', coalesce(lv.pending_cnt, 0),
      'active_tasks_count', coalesce(wk.active_cnt, 0),
      'talent_review_status', tp.review_status
    ) order by
      case
        when e.first_name = 'Test' and e.last_name in ('Employee', 'Recruiter') and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee', 'Test Recruiter', 'test recruiter')
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
  left join (
    select distinct on (employee_id) employee_id, id, check_in_at, check_out_at
    from public.attendance_records
    where attendance_date = v_today
    order by employee_id, check_in_at desc
  ) att on att.employee_id = e.id
  left join (
    select distinct employee_id
    from public.leave_requests
    where status = 'approved'
      and v_today >= start_date
      and v_today <= end_date
  ) lv_today on lv_today.employee_id = e.id
  left join (
    select employee_id, count(*) as pending_cnt
    from public.leave_requests
    where status = 'pending'
    group by employee_id
  ) lv on lv.employee_id = e.id
  left join (
    select
      employee_id,
      count(*) filter (where status in ('assigned', 'in_progress', 'blocked')) as active_cnt
    from public.work_assignments
    where work_date = v_today
    group by employee_id
  ) wk on wk.employee_id = e.id
  left join public.talent_profiles tp on tp.employee_id = e.id
  where e.organization_id = v_org_id
    -- Database boundary: external talent viewers can NEVER be returned as employees
    and not exists (
      select 1 from public.user_roles ur
      where ur.profile_id = e.profile_id
        and ur.role_key = 'talent_viewer'
    )
    and (
      p_search is null
      or trim(p_search) = ''
      or e.first_name ilike '%' || trim(p_search) || '%'
      or e.last_name ilike '%' || trim(p_search) || '%'
      or concat(e.first_name, ' ', e.last_name) ilike '%' || trim(p_search) || '%'
      or p.display_name ilike '%' || trim(p_search) || '%'
      or e.employee_code ilike '%' || trim(p_search) || '%'
      or e.work_email ilike '%' || trim(p_search) || '%'
      or des.name ilike '%' || trim(p_search) || '%'
      or dept.name ilike '%' || trim(p_search) || '%'
    )
    and (
      p_status is null
      or p_status = 'all'
      -- Permanent HR employment status filters with safe enum/text type handling
      or (
        p_status in ('active', 'inactive', 'terminated')
        and (
          e.employment_status::text = p_status
          or e.employment_status = case p_status
            when 'active' then 'active'::public.employment_status
            when 'inactive' then 'inactive'::public.employment_status
            when 'terminated' then 'terminated'::public.employment_status
            else null
          end
        )
      )
      -- Operational attendance filters
      or (p_status = 'checked_in' and att.id is not null and att.check_out_at is null)
      or (p_status = 'checked_out' and att.id is not null and att.check_out_at is not null)
      or (p_status = 'not_checked_in' and att.id is null and e.employment_status::text = 'active')
      -- Operational leave filter
      or (p_status = 'on_leave' and lv_today.employee_id is not null and e.employment_status::text = 'active')
    )
    and (p_department_id is null or e.department_id = p_department_id);

  return v_result;
end;
$$;

-- 2. GET HR DASHBOARD SUMMARY (ENUM-SAFE COMPARISONS)
-- ============================================================
create or replace function public.get_hr_dashboard_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid            uuid := auth.uid();
  v_org_id                uuid;
  v_today                 date := current_date;
  v_total_employees       integer := 0;
  v_active_employees      integer := 0;
  v_inactive_employees    integer := 0;
  v_terminated_employees  integer := 0;
  v_on_leave_employees    integer := 0;
  v_working_today         integer := 0;
  v_today_checked_out     integer := 0;
  v_today_not_checked_in  integer := 0;
  v_departments_count     integer := 0;
  v_teams_count           integer := 0;
  v_pending_leaves        integer := 0;
  v_pending_attendance    integer := 0;
  v_pending_talent        integer := 0;
  v_work_today_total      integer := 0;
  v_work_in_progress      integer := 0;
  v_work_completed        integer := 0;
  v_work_overdue          integer := 0;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'talent_viewer']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to view HR dashboard' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  -- Permanent employment status counts (excluding external talent viewers, safe enum comparison)
  select
    count(*),
    count(*) filter (where employment_status::text = 'active'),
    count(*) filter (where employment_status::text = 'inactive'),
    count(*) filter (where employment_status::text = 'terminated')
  into
    v_total_employees,
    v_active_employees,
    v_inactive_employees,
    v_terminated_employees
  from public.employees e
  where e.organization_id = v_org_id
    and not exists (
      select 1 from public.user_roles ur
      where ur.profile_id = e.profile_id
        and ur.role_key = 'talent_viewer'
    );

  -- Operational today counts (scoped to active employees, excluding talent viewers)
  with today_att as (
    select distinct on (employee_id) employee_id, id, check_in_at, check_out_at
    from public.attendance_records
    where attendance_date = v_today
    order by employee_id, check_in_at desc
  ),
  today_leaves as (
    select distinct employee_id
    from public.leave_requests
    where status = 'approved'
      and v_today >= start_date
      and v_today <= end_date
  )
  select
    count(*) filter (where e.employment_status::text = 'active' and att.id is not null and att.check_out_at is null),
    count(*) filter (where e.employment_status::text = 'active' and att.id is not null and att.check_out_at is not null),
    count(*) filter (where e.employment_status::text = 'active' and att.id is null),
    count(*) filter (where e.employment_status::text = 'active' and lv.employee_id is not null)
  into
    v_working_today,
    v_today_checked_out,
    v_today_not_checked_in,
    v_on_leave_employees
  from public.employees e
  left join today_att att on att.employee_id = e.id
  left join today_leaves lv on lv.employee_id = e.id
  where e.organization_id = v_org_id
    and not exists (
      select 1 from public.user_roles ur
      where ur.profile_id = e.profile_id
        and ur.role_key = 'talent_viewer'
    );

  -- Organization structure counts
  select count(*) into v_departments_count from public.departments where organization_id = v_org_id;
  select count(*) into v_teams_count from public.teams where organization_id = v_org_id;

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
    'terminated_employees', coalesce(v_terminated_employees, 0),
    'on_leave_employees', coalesce(v_on_leave_employees, 0),
    'departments_count', coalesce(v_departments_count, 0),
    'teams_count', coalesce(v_teams_count, 0),
    'pending_leaves_count', coalesce(v_pending_leaves, 0),
    'pending_attendance_count', coalesce(v_pending_attendance, 0),
    'pending_talent_reviews_count', coalesce(v_pending_talent, 0),
    'working_today_count', coalesce(v_working_today, 0),
    'today_checked_in_count', coalesce(v_working_today, 0),
    'today_checked_out_count', coalesce(v_today_checked_out, 0),
    'today_not_checked_in_count', coalesce(v_today_not_checked_in, 0),
    'work_summary', jsonb_build_object(
      'today_total', coalesce(v_work_today_total, 0),
      'in_progress', coalesce(v_work_in_progress, 0),
      'completed', coalesce(v_work_completed, 0),
      'overdue', coalesce(v_work_overdue, 0)
    )
  );
end;
$$;

-- 3. GET HR EMPLOYEE DETAILS (ENUM-SAFE COMPARISONS)
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
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'talent_viewer']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to view employee details' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  -- Validate and fetch target employee with permanent and operational attendance status
  select
    e.id, e.employee_code,
    case
      when e.first_name = 'Test' and e.last_name in ('Employee', 'Recruiter') and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee', 'Test Recruiter', 'test recruiter')
        then substring(split_part(trim(p.display_name), ' ', 1) from 1 for 100)
      else e.first_name
    end as first_name,
    case
      when e.first_name = 'Test' and e.last_name in ('Employee', 'Recruiter') and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee', 'Test Recruiter', 'test recruiter')
        then substring(coalesce(nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), ''), split_part(trim(p.display_name), ' ', 1)) from 1 for 100)
      else e.last_name
    end as last_name,
    e.work_email, e.phone,
    e.employment_status,
    case
      when e.employment_status::text = 'terminated' then 'terminated'
      when e.employment_status::text = 'inactive' then 'inactive'
      when att.id is not null and att.check_out_at is null then 'active'
      when lv_today.employee_id is not null and att.id is null then 'on_leave'
      else e.employment_status::text
    end as current_workforce_status,
    case
      when att.id is not null and att.check_out_at is null then 'checked_in'
      when att.id is not null and att.check_out_at is not null then 'checked_out'
      else 'not_checked_in'
    end as today_attendance_status,
    case
      when lv_today.employee_id is not null then 'on_leave'
      else 'none'
    end as today_leave_status,
    (lv_today.employee_id is not null) as has_approved_leave_today,
    (lv_today.employee_id is not null and att.id is not null and att.check_out_at is null) as working_on_leave,
    to_char(att.check_in_at at time zone 'Asia/Kolkata', 'HH12:MI AM') as today_check_in_time,
    to_char(att.check_out_at at time zone 'Asia/Kolkata', 'HH12:MI AM') as today_check_out_time,
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
  left join (
    select distinct on (employee_id) employee_id, id, check_in_at, check_out_at
    from public.attendance_records
    where attendance_date = v_today
    order by employee_id, check_in_at desc
  ) att on att.employee_id = e.id
  left join (
    select distinct employee_id
    from public.leave_requests
    where status = 'approved'
      and v_today >= start_date
      and v_today <= end_date
  ) lv_today on lv_today.employee_id = e.id
  where e.id = p_employee_id
    and e.organization_id = v_org_id
    and not exists (
      select 1 from public.user_roles ur
      where ur.profile_id = e.profile_id
        and ur.role_key = 'talent_viewer'
    );

  if not found then
    raise exception 'Employee not found or access denied' using errcode = 'P0002';
  end if;

  -- Historical attendance (last 30 calendar days)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ar.id,
      'attendance_date', ar.attendance_date,
      'check_in_at', ar.check_in_at,
      'check_out_at', ar.check_out_at,
      'check_in_time', to_char(ar.check_in_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'check_out_time', to_char(ar.check_out_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'total_duration_minutes', case
        when ar.check_out_at is not null then
          round(extract(epoch from (ar.check_out_at - ar.check_in_at)) / 60.0)::integer
        else null
      end,
      'status', case
        when ar.check_out_at is null then 'checked_in'
        else 'completed'
      end,
      'check_in_verification_status', ar.check_in_verification_status,
      'check_out_verification_status', ar.check_out_verification_status
    ) order by ar.attendance_date desc, ar.check_in_at desc
  ), '[]'::jsonb)
  into v_attendance
  from public.attendance_records ar
  where ar.employee_id = p_employee_id
    and ar.attendance_date >= current_date - interval '30 days';

  -- Current year leave balances
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'leave_type', lb.leave_type,
      'allocated_days', lb.allocated_days,
      'used_days', lb.used_days,
      'pending_days', lb.pending_days,
      'remaining_days', (lb.allocated_days - lb.used_days - lb.pending_days)
    ) order by lb.leave_type
  ), '[]'::jsonb)
  into v_balances
  from public.leave_balances lb
  where lb.employee_id = p_employee_id
    and lb.year = v_year;

  -- Leave requests history
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', lr.id,
      'leave_type', lr.leave_type,
      'start_date', lr.start_date,
      'end_date', lr.end_date,
      'total_days', lr.total_days,
      'reason', lr.reason,
      'status', lr.status,
      'rejection_reason', lr.rejection_reason,
      'applied_at', lr.created_at
    ) order by lr.created_at desc
  ), '[]'::jsonb)
  into v_leaves
  from public.leave_requests lr
  where lr.employee_id = p_employee_id;

  -- Active and recent work assignments
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', wa.id,
      'title', wa.title,
      'description', wa.description,
      'status', wa.status,
      'priority', wa.priority,
      'work_date', wa.work_date,
      'due_time', wa.due_time,
      'created_at', wa.created_at
    ) order by wa.work_date desc, wa.created_at desc
  ), '[]'::jsonb)
  into v_assignments
  from public.work_assignments wa
  where wa.employee_id = p_employee_id;

  -- Talent profile summary
  select jsonb_build_object(
    'talent_id', tp.talent_id,
    'professional_title', tp.professional_title,
    'review_status', tp.review_status,
    'visibility', tp.visibility,
    'skills_count', (select count(*) from public.employee_skills where employee_id = p_employee_id),
    'experiences_count', (select count(*) from public.experiences where employee_id = p_employee_id),
    'certifications_count', (select count(*) from public.certifications where employee_id = p_employee_id)
  )
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
      'employment_status', v_emp.employment_status,
      'current_workforce_status', v_emp.current_workforce_status,
      'today_attendance_status', v_emp.today_attendance_status,
      'today_leave_status', v_emp.today_leave_status,
      'has_approved_leave_today', v_emp.has_approved_leave_today,
      'working_on_leave', v_emp.working_on_leave,
      'today_check_in_time', v_emp.today_check_in_time,
      'today_check_out_time', v_emp.today_check_out_time,
      'employment_type', v_emp.employment_type,
      'joining_date', v_emp.joining_date,
      'designation', v_emp.designation,
      'team', v_emp.team,
      'department', v_emp.department,
      'location', v_emp.location,
      'manager_id', v_emp.manager_id,
      'manager_name', v_emp.manager_name,
      'manager_code', v_emp.manager_code
    ),
    'attendance', v_attendance,
    'leave_balances', v_balances,
    'leave_requests', v_leaves,
    'work_assignments', v_assignments,
    'talent', v_talent
  );
end;
$$;

grant execute on function public.get_hr_employee_directory(text, text, uuid) to authenticated;
grant execute on function public.get_hr_dashboard_summary() to authenticated;
grant execute on function public.get_hr_employee_details(uuid) to authenticated;

