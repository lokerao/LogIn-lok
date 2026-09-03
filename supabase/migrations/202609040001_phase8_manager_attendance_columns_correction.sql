-- ============================================================
-- LogIn Workforce Application
-- Phase 8 Additive Corrective Migration:
-- Manager RPCs Attendance Columns Alignment
--
-- PURPOSE:
-- Updates the 3 Phase 8 RPC definitions (get_manager_dashboard_summary,
-- get_manager_direct_reports, get_direct_report_details) to query
-- public.attendance_records using the canonical Phase 5 schema columns:
--   - attendance_date (instead of work_date)
--   - check_in_at (instead of check_in_time)
--   - check_out_at (instead of check_out_time)
--   - check_in_verification_status (instead of status)
--
-- All JSON output properties expected by TypeScript interfaces
-- (work_date, check_in_time, check_out_time, status) remain identical.
--
-- This migration is completely additive and safe to run directly in Supabase
-- on top of 202609030004_phase8_manager_hierarchy.sql.
-- ============================================================

-- ============================================================
-- 1. RPC: GET MANAGER DASHBOARD SUMMARY
-- ============================================================
create or replace function public.get_manager_dashboard_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid          uuid := auth.uid();
  v_manager_emp         record;
  v_direct_reports_count integer := 0;
  v_att_checked_in      integer := 0;
  v_att_checked_out     integer := 0;
  v_att_not_clocked_in  integer := 0;
  v_pending_leaves      integer := 0;
  v_work_today_total    integer := 0;
  v_work_in_progress    integer := 0;
  v_work_completed      integer := 0;
  v_work_overdue        integer := 0;
  v_today               date := current_date;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['manager']) then
    raise exception 'Only managers are permitted to view the manager dashboard' using errcode = '42501';
  end if;

  -- Resolve manager employee record
  select
    e.id, e.organization_id, e.employee_code, e.first_name, e.last_name,
    t.name as team_name, d.name as department_name
  into v_manager_emp
  from public.employees e
  left join public.teams t on t.id = e.team_id
  left join public.departments d on d.id = e.department_id
  where e.profile_id = v_caller_uid and e.employment_status = 'active';

  if v_manager_emp.id is null then
    raise exception 'Active manager employee record not found' using errcode = '42501';
  end if;

  -- 1. Count direct reports
  select count(*) into v_direct_reports_count
  from public.employees
  where manager_employee_id = v_manager_emp.id
    and organization_id = v_manager_emp.organization_id
    and employment_status = 'active';

  if v_direct_reports_count > 0 then
    -- 2. Team attendance today (using canonical attendance_date and check_out_at)
    select
      count(*) filter (where check_out_at is null),
      count(*) filter (where check_out_at is not null)
    into v_att_checked_in, v_att_checked_out
    from public.attendance_records
    where attendance_date = v_today
      and employee_id in (
        select id from public.employees
        where manager_employee_id = v_manager_emp.id
          and employment_status = 'active'
      );

    v_att_not_clocked_in := greatest(0, v_direct_reports_count - coalesce(v_att_checked_in, 0) - coalesce(v_att_checked_out, 0));

    -- 3. Pending leave requests from direct reports
    select count(*) into v_pending_leaves
    from public.leave_requests
    where status = 'pending'
      and employee_id in (
        select id from public.employees
        where manager_employee_id = v_manager_emp.id
          and employment_status = 'active'
      );

    -- 4. Work assignments from direct reports
    select
      count(*) filter (where work_date = v_today),
      count(*) filter (where work_date = v_today and status = 'in_progress'),
      count(*) filter (where work_date = v_today and status = 'completed'),
      count(*) filter (where status not in ('completed', 'cancelled') and (work_date < v_today or (work_date = v_today and due_time is not null and due_time < current_time)))
    into v_work_today_total, v_work_in_progress, v_work_completed, v_work_overdue
    from public.work_assignments
    where employee_id in (
      select id from public.employees
      where manager_employee_id = v_manager_emp.id
        and employment_status = 'active'
    );
  end if;

  return jsonb_build_object(
    'manager_name', trim(concat(v_manager_emp.first_name, ' ', v_manager_emp.last_name)),
    'employee_code', v_manager_emp.employee_code,
    'team_name', coalesce(v_manager_emp.team_name, 'General Team'),
    'department_name', v_manager_emp.department_name,
    'direct_reports_count', v_direct_reports_count,
    'attendance', jsonb_build_object(
      'checked_in', coalesce(v_att_checked_in, 0),
      'checked_out', coalesce(v_att_checked_out, 0),
      'not_clocked_in', coalesce(v_att_not_clocked_in, 0)
    ),
    'pending_leaves_count', v_pending_leaves,
    'work', jsonb_build_object(
      'today_total', coalesce(v_work_today_total, 0),
      'in_progress', coalesce(v_work_in_progress, 0),
      'completed', coalesce(v_work_completed, 0),
      'overdue', coalesce(v_work_overdue, 0)
    )
  );
end;
$$;

-- ============================================================
-- 2. RPC: GET MANAGER DIRECT REPORTS
-- ============================================================
create or replace function public.get_manager_direct_reports() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_manager_id   uuid;
  v_org_id       uuid;
  v_today        date := current_date;
  v_result       jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['manager']) then
    raise exception 'Only managers are permitted to view direct reports' using errcode = '42501';
  end if;

  select id, organization_id into v_manager_id, v_org_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_manager_id is null then
    raise exception 'Active manager employee record not found' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'employee_code', e.employee_code,
      'first_name', e.first_name,
      'last_name', e.last_name,
      'work_email', e.work_email,
      'phone', e.phone,
      'employment_status', e.employment_status,
      'employment_type', e.employment_type,
      'joining_date', e.joining_date,
      'designation', des.name,
      'team', tm.name,
      'department', dept.name,
      'location', loc.name,
      'today_attendance_status', case
        when att.id is not null and att.check_out_at is null then 'checked_in'
        when att.id is not null and att.check_out_at is not null then 'checked_out'
        else 'not_clocked_in'
      end,
      'today_check_in_time', to_char(att.check_in_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'today_check_out_time', to_char(att.check_out_at at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'pending_leaves_count', coalesce(lv.pending_cnt, 0),
      'active_tasks_count', coalesce(wk.active_cnt, 0),
      'completed_tasks_count', coalesce(wk.completed_cnt, 0)
    ) order by e.first_name, e.last_name
  ), '[]'::jsonb)
  into v_result
  from public.employees e
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.departments dept on dept.id = e.department_id
  left join public.locations loc on loc.id = e.location_id
  -- Join today's attendance record (using canonical attendance_date)
  left join public.attendance_records att on att.employee_id = e.id and att.attendance_date = v_today
  -- Aggregate pending leaves
  left join (
    select employee_id, count(*) as pending_cnt
    from public.leave_requests
    where status = 'pending'
    group by employee_id
  ) lv on lv.employee_id = e.id
  -- Aggregate today's work assignments
  left join (
    select
      employee_id,
      count(*) filter (where status in ('assigned', 'in_progress', 'blocked')) as active_cnt,
      count(*) filter (where status = 'completed') as completed_cnt
    from public.work_assignments
    where work_date = v_today
    group by employee_id
  ) wk on wk.employee_id = e.id
  where e.manager_employee_id = v_manager_id
    and e.organization_id = v_org_id
    and e.employment_status = 'active';

  return v_result;
end;
$$;

-- ============================================================
-- 3. RPC: GET DIRECT REPORT FULL DETAILS
-- ============================================================
create or replace function public.get_direct_report_details(p_employee_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid    uuid := auth.uid();
  v_manager_id    uuid;
  v_org_id        uuid;
  v_emp           record;
  v_year          integer := extract(year from current_date)::integer;
  v_attendance    jsonb;
  v_balances      jsonb;
  v_leaves        jsonb;
  v_assignments   jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['manager']) then
    raise exception 'Only managers are permitted to view direct report details' using errcode = '42501';
  end if;

  select id, organization_id into v_manager_id, v_org_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_manager_id is null then
    raise exception 'Active manager employee record not found' using errcode = '42501';
  end if;

  -- Validate that requested employee is indeed a direct report of this manager in this org
  select
    e.id, e.employee_code, e.first_name, e.last_name, e.work_email, e.phone,
    e.employment_status, e.employment_type, e.joining_date,
    des.name as designation, tm.name as team, dept.name as department, loc.name as location
  into v_emp
  from public.employees e
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.departments dept on dept.id = e.department_id
  left join public.locations loc on loc.id = e.location_id
  where e.id = p_employee_id
    and e.manager_employee_id = v_manager_id
    and e.organization_id = v_org_id
    and e.employment_status = 'active';

  if v_emp.id is null then
    raise exception 'Direct report not found or you are not authorized to view this employee' using errcode = '42501';
  end if;

  -- 1. Recent attendance history (last 5 records, canonical attendance_records columns)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', att.id,
      'work_date', att.attendance_date,
      'check_in_time', att.check_in_at,
      'check_out_time', att.check_out_at,
      'status', att.check_in_verification_status
    ) order by att.attendance_date desc
  ), '[]'::jsonb)
  into v_attendance
  from (
    select id, attendance_date, check_in_at, check_out_at, check_in_verification_status
    from public.attendance_records
    where employee_id = p_employee_id
    order by attendance_date desc
    limit 5
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

  -- 3. Recent leave requests (last 5)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', lr.id,
      'leave_type_name', lt.name,
      'start_date', lr.start_date,
      'end_date', lr.end_date,
      'requested_days', lr.requested_days,
      'is_half_day', lr.is_half_day,
      'status', lr.status,
      'created_at', lr.created_at
    ) order by lr.created_at desc
  ), '[]'::jsonb)
  into v_leaves
  from (
    select lr.id, lr.leave_type_id, lr.start_date, lr.end_date, lr.requested_days, lr.is_half_day, lr.status, lr.created_at
    from public.leave_requests lr
    where lr.employee_id = p_employee_id
    order by lr.created_at desc
    limit 5
  ) lr
  join public.leave_types lt on lt.id = lr.leave_type_id;

  -- 4. Recent work assignments (last 5)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', wk.id,
      'title', wk.title,
      'priority', wk.priority,
      'status', wk.status,
      'progress_percent', wk.progress_percent,
      'work_date', wk.work_date,
      'due_time', wk.due_time
    ) order by wk.work_date desc, wk.created_at desc
  ), '[]'::jsonb)
  into v_assignments
  from (
    select id, title, priority, status, progress_percent, work_date, due_time, created_at
    from public.work_assignments
    where employee_id = p_employee_id
    order by work_date desc, created_at desc
    limit 5
  ) wk;

  return jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'employee_code', v_emp.employee_code,
      'first_name', v_emp.first_name,
      'last_name', v_emp.last_name,
      'work_email', v_emp.work_email,
      'phone', v_emp.phone,
      'employment_status', v_emp.employment_status,
      'employment_type', v_emp.employment_type,
      'joining_date', v_emp.joining_date,
      'designation', v_emp.designation,
      'team', v_emp.team,
      'department', v_emp.department,
      'location', v_emp.location
    ),
    'attendance_history', v_attendance,
    'leave_balances', v_balances,
    'leave_requests', v_leaves,
    'work_assignments', v_assignments
  );
end;
$$;

-- ============================================================
-- 4. GRANTS
-- ============================================================
grant execute on function public.get_manager_dashboard_summary() to authenticated;
grant execute on function public.get_manager_direct_reports() to authenticated;
grant execute on function public.get_direct_report_details(uuid) to authenticated;
