-- ============================================================
-- Migration: 202609040009_phase9_separate_employment_and_attendance_status
-- Description:
--   Strictly separates Permanent Employment Status (HR lifecycle)
--   from Daily Attendance Status (today's check-in/out records)
--   and Daily Leave Status (today's approved leave).
--
-- Core Business Concepts:
--   1. Permanent Employment Status (e.employment_status):
--      - Values: 'active', 'inactive', 'terminated'
--      - Controlled exclusively by HR lifecycle actions
--      - NEVER automatically mutated by check-in, check-out, or leave
--      - Active employees who have not checked in remain employment_status = 'active'
--      - Active employees who have checked out remain employment_status = 'active'
--      - Active employees on approved leave remain employment_status = 'active'
--
--   2. Daily Attendance Status:
--      - Values: 'not_checked_in', 'checked_in', 'checked_out'
--      - Automatically derived from today's attendance records
--      - 'not_checked_in' and 'checked_out' are NEVER called 'inactive'
--
--   3. Daily Leave Status:
--      - Values: 'on_leave', 'none'
--      - Derived from approved leave covering current calendar date
--      - Emergency check-in during approved leave sets attendance to 'checked_in'
--        with 'working_on_leave = true' and working hours running
--      - Checkout sets attendance to 'checked_out' (employment_status remains 'active')
--
-- RPCs Updated:
--   1. get_hr_dashboard_summary():
--      - Active/Inactive/Terminated headcount counts from permanent employment_status
--      - Separate today operational counts: working_today_count, today_checked_out_count,
--        today_not_checked_in_count, on_leave_employees
--   2. get_hr_employee_directory():
--      - Returns employment_status, today_attendance_status, today_leave_status
--      - Filter handles permanent ('active', 'inactive', 'terminated') and
--        operational ('checked_in', 'checked_out', 'not_checked_in', 'on_leave')
--   3. get_hr_employee_details():
--      - Returns employment_status, today_attendance_status, today_leave_status,
--        today_check_in_time, today_check_out_time, working_on_leave
--      - Preserves all canonical Phase 4 column references from 202609040008
-- ============================================================

-- 1. GET HR DASHBOARD SUMMARY
-- ============================================================
create or replace function public.get_hr_dashboard_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid             uuid := auth.uid();
  v_org_id                 uuid;
  v_today                  date := current_date;
  v_total_employees        integer;
  v_active_employees       integer;
  v_inactive_employees     integer;
  v_terminated_employees   integer;
  v_on_leave_employees     integer;
  v_departments_count      integer;
  v_teams_count            integer;
  v_pending_leaves         integer;
  v_pending_attendance     integer;
  v_pending_talent         integer;
  v_working_today          integer;
  v_today_checked_out      integer;
  v_today_not_checked_in   integer;
  v_work_today_total       integer;
  v_work_in_progress       integer;
  v_work_completed         integer;
  v_work_overdue           integer;
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

  -- 1. Permanent Employment Status Counts (from employees.employment_status)
  select
    count(*) filter (where e.employment_status <> 'terminated'),
    count(*) filter (where e.employment_status = 'active'),
    count(*) filter (where e.employment_status = 'inactive'),
    count(*) filter (where e.employment_status = 'terminated')
  into
    v_total_employees,
    v_active_employees,
    v_inactive_employees,
    v_terminated_employees
  from public.employees e
  where e.organization_id = v_org_id;

  -- 2. Today's Operational Attendance & Leave Counts
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
    -- Checked in / working right now (active employment + open attendance session)
    count(*) filter (where e.employment_status = 'active' and att.id is not null and att.check_out_at is null),
    -- Checked out today (active employment + closed attendance session)
    count(*) filter (where e.employment_status = 'active' and att.id is not null and att.check_out_at is not null),
    -- Not checked in today (active employment + no attendance record today)
    count(*) filter (where e.employment_status = 'active' and att.id is null),
    -- On approved leave today (active employment + approved leave covers today)
    count(*) filter (where e.employment_status = 'active' and lv.employee_id is not null)
  into
    v_working_today,
    v_today_checked_out,
    v_today_not_checked_in,
    v_on_leave_employees
  from public.employees e
  left join today_att att on att.employee_id = e.id
  left join today_leaves lv on lv.employee_id = e.id
  where e.organization_id = v_org_id;

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

grant execute on function public.get_hr_dashboard_summary() to authenticated;


-- 2. GET HR EMPLOYEE DIRECTORY
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
        when lv_today.employee_id is not null and att.id is null then 'on_leave'
        else e.employment_status
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
  -- Join today's latest attendance session (multi-session safe)
  left join (
    select distinct on (employee_id) employee_id, id, check_in_at, check_out_at
    from public.attendance_records
    where attendance_date = v_today
    order by employee_id, check_in_at desc
  ) att on att.employee_id = e.id
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
      -- Permanent HR employment status filters
      or (p_status in ('active', 'inactive', 'terminated') and e.employment_status = p_status)
      -- Operational attendance filters
      or (p_status = 'checked_in' and att.id is not null and att.check_out_at is null)
      or (p_status = 'checked_out' and att.id is not null and att.check_out_at is not null)
      or (p_status = 'not_checked_in' and att.id is null and e.employment_status = 'active')
      -- Operational leave filter
      or (p_status = 'on_leave' and lv_today.employee_id is not null and e.employment_status = 'active')
    )
    and (p_department_id is null or e.department_id = p_department_id);

  return v_result;
end;
$$;

grant execute on function public.get_hr_employee_directory(text, text, uuid) to authenticated;


-- 3. GET HR EMPLOYEE DETAILS
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

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
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
      when lv_today.employee_id is not null and att.id is null then 'on_leave'
      else e.employment_status
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

  -- 5. Talent profile summary and detailed items (Canonical Phase 4 column mapping from 0008)
  select
    case
      when tp.employee_id is not null then
        jsonb_build_object(
          'talent_id', tp.talent_id,
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
                'proficiency', es.proficiency,
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
                'company', exp.company,
                'job_title', exp.job_title,
                'employment_type', exp.employment_type,
                'start_date', exp.start_date,
                'end_date', exp.end_date,
                'is_current', exp.is_current,
                'description', exp.description,
                'review_status', exp.review_status,
                'reviewer_notes', exp.reviewer_notes
              ) order by exp.start_date desc nulls last
            )
            from public.experiences exp
            where exp.employee_id = p_employee_id
          ), '[]'::jsonb),
          'education', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', edu.id,
                'institution', edu.institution,
                'qualification', edu.qualification,
                'field_of_study', edu.field_of_study,
                'start_date', edu.start_date,
                'end_date', edu.end_date,
                'description', edu.description,
                'review_status', edu.review_status,
                'reviewer_notes', edu.reviewer_notes
              ) order by edu.start_date desc nulls last
            )
            from public.education edu
            where edu.employee_id = p_employee_id
          ), '[]'::jsonb),
          'certifications', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', cert.id,
                'name', cert.name,
                'issuer', cert.issuer,
                'issue_date', cert.issue_date,
                'expiry_date', cert.expiry_date,
                'credential_id', cert.credential_id,
                'verification_url', cert.verification_url,
                'review_status', cert.review_status,
                'reviewer_notes', cert.reviewer_notes
              ) order by cert.issue_date desc nulls last
            )
            from public.certifications cert
            where cert.employee_id = p_employee_id
          ), '[]'::jsonb),
          'projects', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', proj.id,
                'name', proj.name,
                'role', proj.role,
                'description', proj.description,
                'technologies', proj.technologies,
                'start_date', proj.start_date,
                'end_date', proj.end_date,
                'is_current', proj.is_current,
                'project_url', proj.project_url,
                'review_status', proj.review_status,
                'reviewer_notes', proj.reviewer_notes
              ) order by proj.start_date desc nulls last
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
                'achieved_on', ach.achieved_on,
                'issuer', ach.issuer,
                'review_status', ach.review_status,
                'reviewer_notes', ach.reviewer_notes
              ) order by ach.achieved_on desc nulls last
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
      'employment_status', v_emp.employment_status, -- Permanent HR lifecycle status ('active', 'inactive', 'terminated')
      'current_workforce_status', v_emp.current_workforce_status,
      'today_attendance_status', v_emp.today_attendance_status, -- 'checked_in', 'checked_out', 'not_checked_in'
      'today_leave_status', v_emp.today_leave_status, -- 'on_leave', 'none'
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

