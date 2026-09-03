-- Phase 8: Manager Experience & Organization Hierarchy
-- Migration: 202609030004_phase8_manager_hierarchy.sql
-- Safe to apply to existing Phase 1-7 schema. Does not recreate any existing objects.

-- ============================================================
-- 1. HIERARCHY INTEGRITY TRIGGER ON EMPLOYEES
-- ============================================================
create function public.validate_employee_hierarchy() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mgr_org    uuid;
  v_mgr_status public.employment_status;
  v_team_org   uuid;
  v_dept_org   uuid;
  v_cur_id     uuid;
  v_depth      int := 0;
begin
  -- 1. Self-reporting check
  if new.manager_employee_id is not null and new.manager_employee_id = new.id then
    raise exception 'An employee cannot be their own manager' using errcode = '23514';
  end if;

  -- 2. Manager relationship validation
  if new.manager_employee_id is not null then
    select organization_id, employment_status into v_mgr_org, v_mgr_status
    from public.employees
    where id = new.manager_employee_id;

    if v_mgr_org is null then
      raise exception 'Manager employee % not found', new.manager_employee_id using errcode = '23503';
    end if;

    if v_mgr_org <> new.organization_id then
      raise exception 'Manager organization (%) does not match employee organization (%)',
        v_mgr_org, new.organization_id using errcode = '23514';
    end if;

    if v_mgr_status <> 'active' and new.employment_status = 'active' then
      raise exception 'An active employee cannot report to an inactive manager' using errcode = '23514';
    end if;

    -- Cycle detection (walk up ancestor chain up to 20 levels)
    v_cur_id := new.manager_employee_id;
    while v_cur_id is not null and v_depth < 20 loop
      if v_cur_id = new.id then
        raise exception 'Circular manager hierarchy detected' using errcode = '23514';
      end if;
      select manager_employee_id into v_cur_id
      from public.employees
      where id = v_cur_id;
      v_depth := v_depth + 1;
    end loop;
  end if;

  -- 3. Team relationship validation
  if new.team_id is not null then
    select organization_id into v_team_org
    from public.teams
    where id = new.team_id;

    if v_team_org is null then
      raise exception 'Team % not found', new.team_id using errcode = '23503';
    end if;

    if v_team_org <> new.organization_id then
      raise exception 'Team organization (%) does not match employee organization (%)',
        v_team_org, new.organization_id using errcode = '23514';
    end if;
  end if;

  -- 4. Department relationship validation
  if new.department_id is not null then
    select organization_id into v_dept_org
    from public.departments
    where id = new.department_id;

    if v_dept_org is null then
      raise exception 'Department % not found', new.department_id using errcode = '23503';
    end if;

    if v_dept_org <> new.organization_id then
      raise exception 'Department organization (%) does not match employee organization (%)',
        v_dept_org, new.organization_id using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger employees_hierarchy_guard
  before insert or update on public.employees
  for each row execute function public.validate_employee_hierarchy();

-- ============================================================
-- 2. REFERENCE TABLE RLS POLICIES FOR MANAGERS
-- ============================================================
-- Allow managers to read teams in their organization
create policy teams_manager_org_read on public.teams
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role(array['manager'])
    and not public.has_role(array['admin', 'recruiter'])
  );

-- Allow managers to read departments in their organization
create policy departments_manager_org_read on public.departments
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role(array['manager'])
    and not public.has_role(array['admin', 'recruiter'])
  );

-- ============================================================
-- 3. RPC: GET MANAGER DASHBOARD SUMMARY
-- ============================================================
create function public.get_manager_dashboard_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid          uuid := auth.uid();
  v_manager_emp         record;
  v_direct_reports_count int;
  v_att_checked_in      int := 0;
  v_att_checked_out     int := 0;
  v_att_not_clocked_in  int := 0;
  v_pending_leaves      int := 0;
  v_work_today_total    int := 0;
  v_work_in_progress    int := 0;
  v_work_completed      int := 0;
  v_work_overdue        int := 0;
  v_today               date := current_date;
  v_team_name           text;
  v_dept_name           text;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Role verification
  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['manager']) then
    raise exception 'Only managers are permitted to access manager dashboard summary' using errcode = '42501';
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

  v_team_name := v_manager_emp.team_name;
  v_dept_name := v_manager_emp.department_name;

  -- 1. Count active direct reports
  select count(*) into v_direct_reports_count
  from public.employees
  where manager_employee_id = v_manager_emp.id
    and organization_id = v_manager_emp.organization_id
    and employment_status = 'active';

  if v_direct_reports_count > 0 then
    -- 2. Team attendance today
    select
      count(*) filter (where check_out_time is null),
      count(*) filter (where check_out_time is not null)
    into v_att_checked_in, v_att_checked_out
    from public.attendance_records
    where work_date = v_today
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
    'manager_name', trim(v_manager_emp.first_name || ' ' || v_manager_emp.last_name),
    'employee_code', v_manager_emp.employee_code,
    'team_name', v_team_name,
    'department_name', v_dept_name,
    'direct_reports_count', coalesce(v_direct_reports_count, 0),
    'attendance', jsonb_build_object(
      'checked_in', coalesce(v_att_checked_in, 0),
      'checked_out', coalesce(v_att_checked_out, 0),
      'not_clocked_in', coalesce(v_att_not_clocked_in, 0)
    ),
    'pending_leaves_count', coalesce(v_pending_leaves, 0),
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
-- 4. RPC: GET MANAGER DIRECT REPORTS
-- ============================================================
create function public.get_manager_direct_reports() returns jsonb
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
        when att.id is not null and att.check_out_time is null then 'checked_in'
        when att.id is not null and att.check_out_time is not null then 'checked_out'
        else 'not_clocked_in'
      end,
      'today_check_in_time', to_char(att.check_in_time at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      'today_check_out_time', to_char(att.check_out_time at time zone 'Asia/Kolkata', 'HH12:MI AM'),
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
  -- Join today's attendance record
  left join public.attendance_records att on att.employee_id = e.id and att.work_date = v_today
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
-- 5. RPC: GET DIRECT REPORT FULL DETAILS
-- ============================================================
create function public.get_direct_report_details(p_employee_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid    uuid := auth.uid();
  v_manager_id    uuid;
  v_org_id        uuid;
  v_emp           record;
  v_attendance    jsonb;
  v_leaves        jsonb;
  v_balances      jsonb;
  v_tasks         jsonb;
  v_year          int := extract(year from current_date)::int;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if public.has_role(array['admin', 'recruiter']) or not public.has_role(array['manager']) then
    raise exception 'Only managers are permitted to inspect direct report details' using errcode = '42501';
  end if;

  select id, organization_id into v_manager_id, v_org_id
  from public.employees
  where profile_id = v_caller_uid and employment_status = 'active';

  if v_manager_id is null then
    raise exception 'Active manager employee record not found' using errcode = '42501';
  end if;

  -- Verify direct report hierarchy & org isolation
  select
    e.id, e.employee_code, e.first_name, e.last_name, e.work_email, e.phone,
    e.joining_date, e.employment_type, e.employment_status,
    p.display_name,
    des.name as designation, tm.name as team, dept.name as department, loc.name as location
  into v_emp
  from public.employees e
  left join public.profiles p on p.id = e.profile_id
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.departments dept on dept.id = e.department_id
  left join public.locations loc on loc.id = e.location_id
  where e.id = p_employee_id
    and e.manager_employee_id = v_manager_id
    and e.organization_id = v_org_id;

  if v_emp.id is null then
    raise exception 'Direct report not found or you are not authorized to view this employee' using errcode = '42501';
  end if;

  -- 1. Recent attendance history (last 5 records, timestamps only)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', att.id,
      'work_date', att.work_date,
      'check_in_time', att.check_in_time,
      'check_out_time', att.check_out_time,
      'status', att.status
    ) order by att.work_date desc
  ), '[]'::jsonb)
  into v_attendance
  from (
    select id, work_date, check_in_time, check_out_time, status
    from public.attendance_records
    where employee_id = p_employee_id
    order by work_date desc
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
      'reason', lr.reason,
      'status', lr.status,
      'created_at', lr.created_at
    ) order by lr.created_at desc
  ), '[]'::jsonb)
  into v_leaves
  from (
    select id, leave_type_id, start_date, end_date, requested_days, is_half_day, reason, status, created_at
    from public.leave_requests
    where employee_id = p_employee_id
    order by created_at desc
    limit 5
  ) lr
  join public.leave_types lt on lt.id = lr.leave_type_id;

  -- 4. Recent Phase 7 work assignments (last 5)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', wa.id,
      'work_date', wa.work_date,
      'title', wa.title,
      'priority', wa.priority,
      'status', wa.status,
      'progress_percent', wa.progress_percent,
      'due_time', wa.due_time
    ) order by wa.work_date desc, wa.created_at desc
  ), '[]'::jsonb)
  into v_tasks
  from (
    select id, work_date, title, priority, status, progress_percent, due_time, created_at
    from public.work_assignments
    where employee_id = p_employee_id
    order by work_date desc, created_at desc
    limit 5
  ) wa;

  return jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'employee_code', v_emp.employee_code,
      'first_name', v_emp.first_name,
      'last_name', v_emp.last_name,
      'display_name', v_emp.display_name,
      'work_email', v_emp.work_email,
      'phone', v_emp.phone,
      'joining_date', v_emp.joining_date,
      'employment_type', v_emp.employment_type,
      'employment_status', v_emp.employment_status,
      'designation', v_emp.designation,
      'team', v_emp.team,
      'department', v_emp.department,
      'location', v_emp.location
    ),
    'attendance_history', v_attendance,
    'leave_balances', v_balances,
    'leave_requests', v_leaves,
    'work_assignments', v_tasks
  );
end;
$$;

-- ============================================================
-- 6. GRANTS
-- ============================================================
grant execute on function
  public.get_manager_dashboard_summary(),
  public.get_manager_direct_reports(),
  public.get_direct_report_details(uuid)
to authenticated;
