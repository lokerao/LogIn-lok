-- ============================================================
-- Migration: 202609040008_phase9_hr_employee_details_column_fix
-- Description:
--   Restores canonical Phase 4 column mappings in get_hr_employee_details(uuid)
--   Fixes regression introduced in 202609040006 where invalid column names
--   (e.g., tp.id, es.proficiency_level, exp.company_name, edu.institution_name,
--   cert.issuing_organization, proj.title, ach.date_awarded) caused HR Hub
--   Employee Details modal to fail with error 42703 (undefined_column).
--
-- Preserves all Phase 9 daily workforce status logic:
--   - current_workforce_status
--   - has_approved_leave_today
--   - working_on_leave
--   - employment_status (permanent HR lifecycle)
--   - attendance_history with leave_reconciled
--   - Multi-session safe attendance join
--   - Canonical employee identity resolution
--   - Strict SECURITY DEFINER and search_path = public
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

  -- 5. Talent profile summary and detailed items (Canonical Phase 4 column mapping)
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

