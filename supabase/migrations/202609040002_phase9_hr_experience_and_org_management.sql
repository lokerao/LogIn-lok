-- ============================================================
-- LogIn Workforce Application
-- PHASE 9: HR Experience & Organization Management Migration
--
-- Adds organization-level operational RPCs for HR:
--   1. get_hr_dashboard_summary()
--   2. get_hr_employee_directory(p_search, p_status, p_department_id)
--   3. get_hr_employee_details(p_employee_id)
--   4. update_employee_employment_status(p_employee_id, p_status, p_notes)
--   5. get_hr_organization_structure()
--   6. get_hr_pending_talent_reviews()
--   7. review_talent_profile(p_employee_id, p_action, p_notes)
-- ============================================================

-- ============================================================
-- 1. RPC: GET HR DASHBOARD SUMMARY
-- ============================================================
create or replace function public.get_hr_dashboard_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid          uuid := auth.uid();
  v_org_id              uuid;
  v_total_employees     integer := 0;
  v_active_employees    integer := 0;
  v_inactive_employees  integer := 0;
  v_on_leave_employees  integer := 0;
  v_departments_count   integer := 0;
  v_teams_count         integer := 0;
  v_pending_leaves      integer := 0;
  v_pending_attendance  integer := 0;
  v_pending_talent      integer := 0;
  v_working_today       integer := 0;
  v_work_today_total    integer := 0;
  v_work_in_progress    integer := 0;
  v_work_completed      integer := 0;
  v_work_overdue        integer := 0;
  v_today               date := current_date;
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

  -- 1. Employee headcount metrics
  select
    count(*),
    count(*) filter (where employment_status = 'active'),
    count(*) filter (where employment_status in ('inactive', 'terminated')),
    count(*) filter (where employment_status = 'on_leave')
  into
    v_total_employees,
    v_active_employees,
    v_inactive_employees,
    v_on_leave_employees
  from public.employees
  where organization_id = v_org_id;

  -- 2. Organization structure counts
  select count(*) into v_departments_count
  from public.departments
  where organization_id = v_org_id;

  select count(*) into v_teams_count
  from public.teams
  where organization_id = v_org_id;

  -- 3. Pending leave requests in this organization
  select count(*) into v_pending_leaves
  from public.leave_requests lr
  join public.employees e on e.id = lr.employee_id
  where e.organization_id = v_org_id
    and lr.status = 'pending';

  -- 4. Attendance verification pending in this organization
  select count(*) into v_pending_attendance
  from public.attendance_records ar
  where ar.organization_id = v_org_id
    and (ar.check_in_verification_status = 'pending' or ar.check_out_verification_status = 'pending');

  -- 5. Pending talent profile reviews in this organization
  select count(*) into v_pending_talent
  from public.talent_profiles tp
  join public.employees e on e.id = tp.employee_id
  where e.organization_id = v_org_id
    and tp.review_status = 'pending';

  -- 6. Employees currently clocked-in today
  select count(distinct ar.employee_id) into v_working_today
  from public.attendance_records ar
  where ar.organization_id = v_org_id
    and ar.attendance_date = v_today
    and ar.check_out_at is null;

  -- 7. Organization work assignment metrics for today
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

-- ============================================================
-- 2. RPC: GET HR EMPLOYEE DIRECTORY
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
      'first_name', e.first_name,
      'last_name', e.last_name,
      'work_email', e.work_email,
      'phone', e.phone,
      'employment_status', e.employment_status,
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
      'talent_review_status', coalesce(tp.review_status, 'none')
    ) order by e.first_name, e.last_name
  ), '[]'::jsonb)
  into v_result
  from public.employees e
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.departments dept on dept.id = e.department_id
  left join public.locations loc on loc.id = e.location_id
  left join public.employees mgr on mgr.id = e.manager_employee_id
  -- Join today's attendance record
  left join public.attendance_records att on att.employee_id = e.id and att.attendance_date = v_today
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
    and (p_status is null or e.employment_status = p_status::public.employment_status)
    and (p_department_id is null or e.department_id = p_department_id)
    and (
      p_search is null
      or trim(p_search) = ''
      or e.first_name ilike '%' || trim(p_search) || '%'
      or e.last_name ilike '%' || trim(p_search) || '%'
      or e.employee_code ilike '%' || trim(p_search) || '%'
      or e.work_email ilike '%' || trim(p_search) || '%'
    );

  return v_result;
end;
$$;

-- ============================================================
-- 3. RPC: GET HR EMPLOYEE FULL DETAILS
-- ============================================================
create or replace function public.get_hr_employee_details(p_employee_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid    uuid := auth.uid();
  v_org_id        uuid;
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

  -- Validate target employee belongs to this organization
  select
    e.id, e.employee_code, e.first_name, e.last_name, e.work_email, e.phone,
    e.employment_status, e.employment_type, e.joining_date,
    des.name as designation, tm.name as team, dept.name as department, loc.name as location,
    mgr.id as manager_id,
    case when mgr.id is not null then trim(concat(mgr.first_name, ' ', mgr.last_name)) else null end as manager_name,
    mgr.employee_code as manager_code,
    p.display_name
  into v_emp
  from public.employees e
  left join public.profiles p on p.id = e.profile_id
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.departments dept on dept.id = e.department_id
  left join public.locations loc on loc.id = e.location_id
  left join public.employees mgr on mgr.id = e.manager_employee_id
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
      'check_out_photo_path', att.check_out_photo_path
    ) order by att.attendance_date desc, att.created_at desc
  ), '[]'::jsonb)
  into v_attendance
  from (
    select id, attendance_date, check_in_at, check_out_at, check_in_verification_status, check_out_verification_status, check_in_photo_path, check_out_photo_path, created_at
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
      'review_notes', lr.review_notes,
      'created_at', lr.created_at
    ) order by lr.created_at desc
  ), '[]'::jsonb)
  into v_leaves
  from (
    select lr.id, lr.leave_type_id, lr.start_date, lr.end_date, lr.requested_days, lr.is_half_day, lr.status, lr.reason, lr.review_notes, lr.created_at
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

  -- 5. Talent profile summary
  select case
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
        'achievements_count', (select count(*) from public.achievements where employee_id = p_employee_id)
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
      'employment_status', v_emp.employment_status,
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

-- ============================================================
-- 4. RPC: UPDATE EMPLOYEE EMPLOYMENT STATUS (HR LIFECYCLE)
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

  -- Validate target employee exists in same organization
  select id, profile_id, employee_code, first_name, last_name, employment_status
  into v_target_emp
  from public.employees
  where id = p_employee_id and organization_id = v_org_id;

  if v_target_emp.id is null then
    raise exception 'Target employee not found in your organization' using errcode = '42501';
  end if;

  -- Disallow HR modifying their own employee status
  if v_target_emp.profile_id = v_caller_uid then
    raise exception 'HR personnel cannot modify their own employment status' using errcode = '42501';
  end if;

  -- Validate status enum
  if p_status not in ('active', 'on_leave', 'inactive', 'terminated') then
    raise exception 'Invalid employment status "%". Valid values: active, on_leave, inactive, terminated', p_status using errcode = '22023';
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

-- ============================================================
-- 5. RPC: GET HR ORGANIZATION STRUCTURE
-- ============================================================
create or replace function public.get_hr_organization_structure() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_result       jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to view organization structure' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'employee_count', (select count(*) from public.employees where department_id = d.id and organization_id = v_org_id),
      'teams', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'member_count', (select count(*) from public.employees where team_id = t.id and organization_id = v_org_id),
            'manager', (
              select jsonb_build_object(
                'id', m.id,
                'employee_code', m.employee_code,
                'name', trim(concat(m.first_name, ' ', m.last_name))
              )
              from public.employees m
              where m.team_id = t.id
                and m.organization_id = v_org_id
                and exists (select 1 from public.user_roles ur where ur.profile_id = m.profile_id and ur.role_key = 'manager')
              limit 1
            ),
            'members', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', mem.id,
                  'employee_code', mem.employee_code,
                  'name', trim(concat(mem.first_name, ' ', mem.last_name)),
                  'designation', des.name,
                  'status', mem.employment_status
                ) order by mem.first_name, mem.last_name
              )
              from public.employees mem
              left join public.designations des on des.id = mem.designation_id
              where mem.team_id = t.id
                and mem.organization_id = v_org_id
            ), '[]'::jsonb)
          ) order by t.name
        )
        from public.teams t
        where t.department_id = d.id and t.organization_id = v_org_id
      ), '[]'::jsonb)
    ) order by d.name
  ), '[]'::jsonb)
  into v_result
  from public.departments d
  where d.organization_id = v_org_id;

  return v_result;
end;
$$;

-- ============================================================
-- 6. RPC: GET HR PENDING TALENT REVIEWS
-- ============================================================
create or replace function public.get_hr_pending_talent_reviews() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_result       jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to view pending talent reviews' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'employee_id', e.id,
      'employee_code', e.employee_code,
      'employee_name', trim(concat(e.first_name, ' ', e.last_name)),
      'designation', des.name,
      'department', dept.name,
      'talent_id', tp.talent_id,
      'professional_name', tp.professional_name,
      'professional_title', tp.professional_title,
      'summary', tp.summary,
      'review_status', tp.review_status,
      'submitted_at', tp.updated_at,
      'pending_skills_count', (select count(*) from public.employee_skills where employee_id = e.id and review_status = 'pending'),
      'pending_experiences_count', (select count(*) from public.experiences where employee_id = e.id and review_status = 'pending'),
      'pending_education_count', (select count(*) from public.education where employee_id = e.id and review_status = 'pending'),
      'pending_certifications_count', (select count(*) from public.certifications where employee_id = e.id and review_status = 'pending'),
      'pending_projects_count', (select count(*) from public.projects where employee_id = e.id and review_status = 'pending'),
      'pending_achievements_count', (select count(*) from public.achievements where employee_id = e.id and review_status = 'pending')
    ) order by tp.updated_at desc
  ), '[]'::jsonb)
  into v_result
  from public.talent_profiles tp
  join public.employees e on e.id = tp.employee_id
  left join public.designations des on des.id = e.designation_id
  left join public.departments dept on dept.id = e.department_id
  where e.organization_id = v_org_id
    and tp.review_status = 'pending';

  return v_result;
end;
$$;

-- ============================================================
-- 7. RPC: REVIEW TALENT PROFILE (APPROVE / REJECT)
-- ============================================================
create or replace function public.review_talent_profile(
  p_employee_id uuid,
  p_action text,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid     uuid := auth.uid();
  v_org_id         uuid;
  v_target_emp     record;
  v_new_status     public.professional_review_status;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['hr']) then
    raise exception 'Only HR personnel are permitted to review talent profiles' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  -- Validate target employee exists in same organization
  select id, employee_code, first_name, last_name
  into v_target_emp
  from public.employees
  where id = p_employee_id and organization_id = v_org_id;

  if v_target_emp.id is null then
    raise exception 'Target employee not found in your organization' using errcode = '42501';
  end if;

  -- Validate action
  if p_action not in ('approve', 'reject') then
    raise exception 'Invalid action "%". Valid values: approve, reject', p_action using errcode = '22023';
  end if;

  if p_action = 'approve' then
    v_new_status := 'approved'::public.professional_review_status;
  else
    v_new_status := 'rejected'::public.professional_review_status;
  end if;

  -- 1. Update talent_profiles table
  update public.talent_profiles
  set review_status = v_new_status,
      reviewed_by = v_caller_uid,
      reviewed_at = now(),
      reviewer_notes = p_notes,
      updated_at = now()
  where employee_id = p_employee_id;

  -- 2. Update child talent sections that are pending
  update public.employee_skills
  set review_status = v_new_status, reviewed_by = v_caller_uid, reviewed_at = now(), reviewer_notes = p_notes, updated_at = now()
  where employee_id = p_employee_id and review_status = 'pending';

  update public.experiences
  set review_status = v_new_status, reviewed_by = v_caller_uid, reviewed_at = now(), reviewer_notes = p_notes, updated_at = now()
  where employee_id = p_employee_id and review_status = 'pending';

  update public.education
  set review_status = v_new_status, reviewed_by = v_caller_uid, reviewed_at = now(), reviewer_notes = p_notes, updated_at = now()
  where employee_id = p_employee_id and review_status = 'pending';

  update public.certifications
  set review_status = v_new_status, reviewed_by = v_caller_uid, reviewed_at = now(), reviewer_notes = p_notes, updated_at = now()
  where employee_id = p_employee_id and review_status = 'pending';

  update public.projects
  set review_status = v_new_status, reviewed_by = v_caller_uid, reviewed_at = now(), reviewer_notes = p_notes, updated_at = now()
  where employee_id = p_employee_id and review_status = 'pending';

  update public.achievements
  set review_status = v_new_status, reviewed_by = v_caller_uid, reviewed_at = now(), reviewer_notes = p_notes, updated_at = now()
  where employee_id = p_employee_id and review_status = 'pending';

  return jsonb_build_object(
    'employee_id', p_employee_id,
    'employee_code', v_target_emp.employee_code,
    'status', v_new_status,
    'reviewed_at', now()
  );
end;
$$;

-- ============================================================
-- 8. GRANTS
-- ============================================================
grant execute on function public.get_hr_dashboard_summary() to authenticated;
grant execute on function public.get_hr_employee_directory(text, text, uuid) to authenticated;
grant execute on function public.get_hr_employee_details(uuid) to authenticated;
grant execute on function public.update_employee_employment_status(uuid, text, text) to authenticated;
grant execute on function public.get_hr_organization_structure() to authenticated;
grant execute on function public.get_hr_pending_talent_reviews() to authenticated;
grant execute on function public.review_talent_profile(uuid, text, text) to authenticated;
