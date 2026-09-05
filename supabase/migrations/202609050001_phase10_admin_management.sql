-- ============================================================
-- Migration: 202609050001_phase10_admin_management.sql
-- Description:
--   Phase 10 Admin Management Foundation
--   Provides organization-level system administration RPCs for Admin role:
--     1. get_admin_dashboard_summary()
--     2. get_admin_employee_directory(...)
--     3. get_admin_employee_details(p_employee_id)
--     4. admin_update_employee_organization(...)
--     5. Department CRUD (get, create, update, delete with orphan prevention)
--     6. Designation CRUD (get, create, update, delete with orphan prevention)
--     7. Team CRUD (get, create, update, delete with orphan prevention)
--     8. Location CRUD (get, create, update, delete with orphan prevention)
--     9. Role & Access management (overview, assign, remove with self-lockout prevention)
--    10. get_admin_organization_structure()
--
-- Security Rules:
--   - Caller must be authenticated
--   - Caller must hold 'admin' role
--   - Strict organization scoping via current_organization_id()
--   - Zero attendance data exposed to Admin
--   - IDOR protection across all queries and mutations
-- ============================================================

-- 1. GET ADMIN DASHBOARD SUMMARY
-- ============================================================
create or replace function public.get_admin_dashboard_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid            uuid := auth.uid();
  v_org_id                uuid;
  v_org_name              text;
  v_total_employees       integer := 0;
  v_active_employees      integer := 0;
  v_inactive_employees    integer := 0;
  v_terminated_employees  integer := 0;
  v_total_departments     integer := 0;
  v_total_teams           integer := 0;
  v_total_designations    integer := 0;
  v_total_locations       integer := 0;
  v_total_users           integer := 0;
  v_admin_users           integer := 0;
  v_hr_users              integer := 0;
  v_manager_users         integer := 0;
  v_employee_users        integer := 0;
  v_recruiter_users       integer := 0;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view the Admin dashboard' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select name into v_org_name
  from public.organizations
  where id = v_org_id;

  -- 1. Employee headcount metrics (permanent HR lifecycle status)
  select
    count(*),
    count(*) filter (where employment_status = 'active'),
    count(*) filter (where employment_status = 'inactive'),
    count(*) filter (where employment_status = 'terminated')
  into
    v_total_employees,
    v_active_employees,
    v_inactive_employees,
    v_terminated_employees
  from public.employees
  where organization_id = v_org_id;

  -- 2. Organization structure counts
  select count(*) into v_total_departments
  from public.departments
  where organization_id = v_org_id;

  select count(*) into v_total_teams
  from public.teams
  where organization_id = v_org_id;

  select count(*) into v_total_designations
  from public.designations
  where organization_id = v_org_id;

  select count(*) into v_total_locations
  from public.locations
  where organization_id = v_org_id;

  -- 3. Total users in organization
  select count(*) into v_total_users
  from public.profiles
  where organization_id = v_org_id;

  -- 4. Role assignment breakdown in organization
  select
    count(*) filter (where ur.role_key = 'admin'),
    count(*) filter (where ur.role_key = 'hr'),
    count(*) filter (where ur.role_key = 'manager'),
    count(*) filter (where ur.role_key = 'employee'),
    count(*) filter (where ur.role_key = 'recruiter')
  into
    v_admin_users,
    v_hr_users,
    v_manager_users,
    v_employee_users,
    v_recruiter_users
  from public.user_roles ur
  join public.profiles p on p.id = ur.profile_id
  where p.organization_id = v_org_id;

  return jsonb_build_object(
    'organization_id', v_org_id,
    'organization_name', coalesce(v_org_name, 'Organization'),
    'total_employees', coalesce(v_total_employees, 0),
    'active_employees', coalesce(v_active_employees, 0),
    'inactive_employees', coalesce(v_inactive_employees, 0),
    'terminated_employees', coalesce(v_terminated_employees, 0),
    'total_departments', coalesce(v_total_departments, 0),
    'total_teams', coalesce(v_total_teams, 0),
    'total_designations', coalesce(v_total_designations, 0),
    'total_locations', coalesce(v_total_locations, 0),
    'total_users', coalesce(v_total_users, 0),
    'roles_breakdown', jsonb_build_object(
      'admin', coalesce(v_admin_users, 0),
      'hr', coalesce(v_hr_users, 0),
      'manager', coalesce(v_manager_users, 0),
      'employee', coalesce(v_employee_users, 0),
      'recruiter', coalesce(v_recruiter_users, 0)
    )
  );
end;
$$;

grant execute on function public.get_admin_dashboard_summary() to authenticated;


-- 2. GET ADMIN EMPLOYEE DIRECTORY
-- ============================================================
create or replace function public.get_admin_employee_directory(
  p_search text default null,
  p_department_id uuid default null,
  p_designation_id uuid default null,
  p_team_id uuid default null,
  p_location_id uuid default null,
  p_employment_status text default null,
  p_role_key text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_result       jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view the employee directory' using errcode = '42501';
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
      'employment_status', e.employment_status,
      'employment_type', e.employment_type,
      'joining_date', e.joining_date,
      'profile_id', e.profile_id,
      'display_name', p.display_name,
      'account_status', p.account_status,
      'department_id', dept.id,
      'department_name', dept.name,
      'designation_id', des.id,
      'designation_name', des.name,
      'team_id', tm.id,
      'team_name', tm.name,
      'location_id', loc.id,
      'location_name', loc.name,
      'location_city', loc.city,
      'manager_employee_id', mgr.id,
      'manager_name', case when mgr.id is not null then trim(concat(mgr.first_name, ' ', mgr.last_name)) else null end,
      'manager_code', mgr.employee_code,
      'roles', coalesce((
        select jsonb_agg(ur.role_key order by ur.role_key)
        from public.user_roles ur
        where ur.profile_id = e.profile_id
      ), '[]'::jsonb)
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
  left join public.departments dept on dept.id = e.department_id
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.locations loc on loc.id = e.location_id
  left join public.employees mgr on mgr.id = e.manager_employee_id
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
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_designation_id is null or e.designation_id = p_designation_id)
    and (p_team_id is null or e.team_id = p_team_id)
    and (p_location_id is null or e.location_id = p_location_id)
    and (p_employment_status is null or p_employment_status = 'all' or e.employment_status = p_employment_status)
    and (
      p_role_key is null
      or p_role_key = 'all'
      or exists (
        select 1 from public.user_roles ur
        where ur.profile_id = e.profile_id and ur.role_key = p_role_key
      )
    );

  return v_result;
end;
$$;

grant execute on function public.get_admin_employee_directory(text, uuid, uuid, uuid, uuid, text, text) to authenticated;


-- 3. GET ADMIN EMPLOYEE DETAILS
-- ============================================================
create or replace function public.get_admin_employee_details(p_employee_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid    uuid := auth.uid();
  v_org_id        uuid;
  v_emp           record;
  v_direct_reports integer := 0;
  v_roles         jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view employee details' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

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
    e.employment_status, e.employment_type, e.joining_date,
    e.created_at, e.updated_at,
    e.profile_id, p.display_name, p.account_status,
    e.department_id, dept.name as department_name,
    e.designation_id, des.name as designation_name,
    e.team_id, tm.name as team_name,
    e.location_id, loc.name as location_name, loc.city as location_city, loc.country_code as location_country,
    e.manager_employee_id,
    case when mgr.id is not null then trim(concat(mgr.first_name, ' ', mgr.last_name)) else null end as manager_name,
    mgr.employee_code as manager_code
  into v_emp
  from public.employees e
  left join public.profiles p on p.id = e.profile_id
  left join public.departments dept on dept.id = e.department_id
  left join public.designations des on des.id = e.designation_id
  left join public.teams tm on tm.id = e.team_id
  left join public.locations loc on loc.id = e.location_id
  left join public.employees mgr on mgr.id = e.manager_employee_id
  where e.id = p_employee_id and e.organization_id = v_org_id;

  if not found then
    raise exception 'Employee record not found in your organization' using errcode = 'P0002';
  end if;

  select count(*) into v_direct_reports
  from public.employees
  where manager_employee_id = p_employee_id and organization_id = v_org_id;

  select coalesce(jsonb_agg(ur.role_key order by ur.role_key), '[]'::jsonb)
  into v_roles
  from public.user_roles ur
  where ur.profile_id = v_emp.profile_id;

  return jsonb_build_object(
    'id', v_emp.id,
    'employee_code', v_emp.employee_code,
    'first_name', v_emp.first_name,
    'last_name', v_emp.last_name,
    'display_name', coalesce(v_emp.display_name, trim(concat(v_emp.first_name, ' ', v_emp.last_name))),
    'work_email', v_emp.work_email,
    'phone', v_emp.phone,
    'employment_status', v_emp.employment_status,
    'employment_type', v_emp.employment_type,
    'joining_date', v_emp.joining_date,
    'created_at', v_emp.created_at,
    'updated_at', v_emp.updated_at,
    'profile_id', v_emp.profile_id,
    'account_status', v_emp.account_status,
    'department_id', v_emp.department_id,
    'department_name', v_emp.department_name,
    'designation_id', v_emp.designation_id,
    'designation_name', v_emp.designation_name,
    'team_id', v_emp.team_id,
    'team_name', v_emp.team_name,
    'location_id', v_emp.location_id,
    'location_name', v_emp.location_name,
    'location_city', v_emp.location_city,
    'location_country', v_emp.location_country,
    'manager_employee_id', v_emp.manager_employee_id,
    'manager_name', v_emp.manager_name,
    'manager_code', v_emp.manager_code,
    'direct_reports_count', v_direct_reports,
    'roles', v_roles
  );
end;
$$;

grant execute on function public.get_admin_employee_details(uuid) to authenticated;


-- 4. ADMIN UPDATE EMPLOYEE ORGANIZATIONAL ASSIGNMENTS
-- ============================================================
create or replace function public.admin_update_employee_organization(
  p_employee_id uuid,
  p_department_id uuid default null,
  p_designation_id uuid default null,
  p_team_id uuid default null,
  p_location_id uuid default null,
  p_manager_employee_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_emp_rec      record;
  v_team_dept    uuid;
  v_cycle_found  boolean;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to update employee organizational assignments' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select id, employee_code, organization_id into v_emp_rec
  from public.employees
  where id = p_employee_id and organization_id = v_org_id;

  if not found then
    raise exception 'Target employee not found in your organization' using errcode = 'P0002';
  end if;

  -- Validate department
  if p_department_id is not null then
    if not exists (select 1 from public.departments where id = p_department_id and organization_id = v_org_id) then
      raise exception 'Selected department does not exist in your organization' using errcode = '23503';
    end if;
  end if;

  -- Validate designation
  if p_designation_id is not null then
    if not exists (select 1 from public.designations where id = p_designation_id and organization_id = v_org_id) then
      raise exception 'Selected designation does not exist in your organization' using errcode = '23503';
    end if;
  end if;

  -- Validate team and department alignment
  if p_team_id is not null then
    select department_id into v_team_dept
    from public.teams
    where id = p_team_id and organization_id = v_org_id;

    if not found then
      raise exception 'Selected team does not exist in your organization' using errcode = '23503';
    end if;

    -- If department is provided and team belongs to a specific department, ensure matching
    if p_department_id is not null and v_team_dept is not null and v_team_dept <> p_department_id then
      raise exception 'The selected team belongs to a different department' using errcode = '23514';
    end if;
  end if;

  -- Validate location
  if p_location_id is not null then
    if not exists (select 1 from public.locations where id = p_location_id and organization_id = v_org_id) then
      raise exception 'Selected location does not exist in your organization' using errcode = '23503';
    end if;
  end if;

  -- Validate manager
  if p_manager_employee_id is not null then
    if p_manager_employee_id = p_employee_id then
      raise exception 'An employee cannot be their own manager' using errcode = '23514';
    end if;

    if not exists (select 1 from public.employees where id = p_manager_employee_id and organization_id = v_org_id) then
      raise exception 'Selected manager does not exist in your organization' using errcode = '23503';
    end if;

    -- Hierarchy cycle detection
    with recursive subordinates as (
      select id from public.employees where manager_employee_id = p_employee_id and organization_id = v_org_id
      union all
      select e.id from public.employees e join subordinates s on e.manager_employee_id = s.id where e.organization_id = v_org_id
    )
    select exists (select 1 from subordinates where id = p_manager_employee_id)
    into v_cycle_found;

    if v_cycle_found then
      raise exception 'Hierarchy cycle detected: An employee cannot report to one of their direct or indirect subordinates' using errcode = '23514';
    end if;
  end if;

  update public.employees
  set department_id = p_department_id,
      designation_id = p_designation_id,
      team_id = p_team_id,
      location_id = p_location_id,
      manager_employee_id = p_manager_employee_id,
      updated_at = now()
  where id = p_employee_id;

  return public.get_admin_employee_details(p_employee_id);
end;
$$;

grant execute on function public.admin_update_employee_organization(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;


-- 5. DEPARTMENT MANAGEMENT RPCS
-- ============================================================
create or replace function public.get_admin_departments() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view departments' using errcode = '42501';
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
      'team_count', (select count(*) from public.teams where department_id = d.id and organization_id = v_org_id),
      'created_at', d.created_at,
      'updated_at', d.updated_at
    ) order by d.name
  ), '[]'::jsonb)
  into v_result
  from public.departments d
  where d.organization_id = v_org_id;

  return v_result;
end;
$$;

create or replace function public.admin_create_department(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_clean_name text;
  v_new_id     uuid;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to create departments' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Department name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  if exists (select 1 from public.departments where organization_id = v_org_id and lower(name) = lower(v_clean_name)) then
    raise exception 'A department with this name already exists in your organization' using errcode = '23505';
  end if;

  insert into public.departments (organization_id, name)
  values (v_org_id, v_clean_name)
  returning id into v_new_id;

  return jsonb_build_object('id', v_new_id, 'name', v_clean_name);
end;
$$;

create or replace function public.admin_update_department(p_department_id uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_clean_name text;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to update departments' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.departments where id = p_department_id and organization_id = v_org_id) then
    raise exception 'Department not found in your organization' using errcode = 'P0002';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Department name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  if exists (select 1 from public.departments where organization_id = v_org_id and lower(name) = lower(v_clean_name) and id <> p_department_id) then
    raise exception 'Another department with this name already exists' using errcode = '23505';
  end if;

  update public.departments
  set name = v_clean_name, updated_at = now()
  where id = p_department_id and organization_id = v_org_id;

  return jsonb_build_object('id', p_department_id, 'name', v_clean_name);
end;
$$;

create or replace function public.admin_delete_department(p_department_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_emp_count  integer;
  v_team_count integer;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to delete departments' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.departments where id = p_department_id and organization_id = v_org_id) then
    raise exception 'Department not found in your organization' using errcode = 'P0002';
  end if;

  -- Orphan check: assigned employees
  select count(*) into v_emp_count
  from public.employees
  where department_id = p_department_id and organization_id = v_org_id;

  if v_emp_count > 0 then
    raise exception 'Cannot delete department: % employee(s) are currently assigned to it. Please reassign them first.', v_emp_count using errcode = '23503';
  end if;

  -- Orphan check: assigned teams
  select count(*) into v_team_count
  from public.teams
  where department_id = p_department_id and organization_id = v_org_id;

  if v_team_count > 0 then
    raise exception 'Cannot delete department: % team(s) are currently assigned to it. Please reassign or delete them first.', v_team_count using errcode = '23503';
  end if;

  delete from public.departments
  where id = p_department_id and organization_id = v_org_id;

  return jsonb_build_object('success', true, 'deleted_id', p_department_id);
end;
$$;

grant execute on function public.get_admin_departments(),
                         public.admin_create_department(text),
                         public.admin_update_department(uuid, text),
                         public.admin_delete_department(uuid)
to authenticated;


-- 6. DESIGNATION MANAGEMENT RPCS
-- ============================================================
create or replace function public.get_admin_designations() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view designations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', des.id,
      'name', des.name,
      'employee_count', (select count(*) from public.employees where designation_id = des.id and organization_id = v_org_id),
      'created_at', des.created_at,
      'updated_at', des.updated_at
    ) order by des.name
  ), '[]'::jsonb)
  into v_result
  from public.designations des
  where des.organization_id = v_org_id;

  return v_result;
end;
$$;

create or replace function public.admin_create_designation(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_clean_name text;
  v_new_id     uuid;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to create designations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Designation name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  if exists (select 1 from public.designations where organization_id = v_org_id and lower(name) = lower(v_clean_name)) then
    raise exception 'A designation with this name already exists in your organization' using errcode = '23505';
  end if;

  insert into public.designations (organization_id, name)
  values (v_org_id, v_clean_name)
  returning id into v_new_id;

  return jsonb_build_object('id', v_new_id, 'name', v_clean_name);
end;
$$;

create or replace function public.admin_update_designation(p_designation_id uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_clean_name text;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to update designations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.designations where id = p_designation_id and organization_id = v_org_id) then
    raise exception 'Designation not found in your organization' using errcode = 'P0002';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Designation name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  if exists (select 1 from public.designations where organization_id = v_org_id and lower(name) = lower(v_clean_name) and id <> p_designation_id) then
    raise exception 'Another designation with this name already exists' using errcode = '23505';
  end if;

  update public.designations
  set name = v_clean_name, updated_at = now()
  where id = p_designation_id and organization_id = v_org_id;

  return jsonb_build_object('id', p_designation_id, 'name', v_clean_name);
end;
$$;

create or replace function public.admin_delete_designation(p_designation_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_emp_count  integer;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to delete designations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.designations where id = p_designation_id and organization_id = v_org_id) then
    raise exception 'Designation not found in your organization' using errcode = 'P0002';
  end if;

  select count(*) into v_emp_count
  from public.employees
  where designation_id = p_designation_id and organization_id = v_org_id;

  if v_emp_count > 0 then
    raise exception 'Cannot delete designation: % employee(s) are currently assigned to it. Please reassign them first.', v_emp_count using errcode = '23503';
  end if;

  delete from public.designations
  where id = p_designation_id and organization_id = v_org_id;

  return jsonb_build_object('success', true, 'deleted_id', p_designation_id);
end;
$$;

grant execute on function public.get_admin_designations(),
                         public.admin_create_designation(text),
                         public.admin_update_designation(uuid, text),
                         public.admin_delete_designation(uuid)
to authenticated;


-- 7. TEAM MANAGEMENT RPCS
-- ============================================================
create or replace function public.get_admin_teams() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view teams' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'department_id', t.department_id,
      'department_name', d.name,
      'employee_count', (select count(*) from public.employees where team_id = t.id and organization_id = v_org_id),
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
      'created_at', t.created_at,
      'updated_at', t.updated_at
    ) order by t.name
  ), '[]'::jsonb)
  into v_result
  from public.teams t
  left join public.departments d on d.id = t.department_id
  where t.organization_id = v_org_id;

  return v_result;
end;
$$;

create or replace function public.admin_create_team(p_name text, p_department_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_clean_name text;
  v_new_id     uuid;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to create teams' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Team name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  if p_department_id is not null then
    if not exists (select 1 from public.departments where id = p_department_id and organization_id = v_org_id) then
      raise exception 'Selected department does not exist in your organization' using errcode = '23503';
    end if;
  end if;

  if exists (select 1 from public.teams where organization_id = v_org_id and lower(name) = lower(v_clean_name)) then
    raise exception 'A team with this name already exists in your organization' using errcode = '23505';
  end if;

  insert into public.teams (organization_id, name, department_id)
  values (v_org_id, v_clean_name, p_department_id)
  returning id into v_new_id;

  return jsonb_build_object('id', v_new_id, 'name', v_clean_name, 'department_id', p_department_id);
end;
$$;

create or replace function public.admin_update_team(p_team_id uuid, p_name text, p_department_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_clean_name text;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to update teams' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id and organization_id = v_org_id) then
    raise exception 'Team not found in your organization' using errcode = 'P0002';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Team name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  if p_department_id is not null then
    if not exists (select 1 from public.departments where id = p_department_id and organization_id = v_org_id) then
      raise exception 'Selected department does not exist in your organization' using errcode = '23503';
    end if;
  end if;

  if exists (select 1 from public.teams where organization_id = v_org_id and lower(name) = lower(v_clean_name) and id <> p_team_id) then
    raise exception 'Another team with this name already exists' using errcode = '23505';
  end if;

  update public.teams
  set name = v_clean_name, department_id = p_department_id, updated_at = now()
  where id = p_team_id and organization_id = v_org_id;

  return jsonb_build_object('id', p_team_id, 'name', v_clean_name, 'department_id', p_department_id);
end;
$$;

create or replace function public.admin_delete_team(p_team_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_emp_count  integer;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to delete teams' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id and organization_id = v_org_id) then
    raise exception 'Team not found in your organization' using errcode = 'P0002';
  end if;

  select count(*) into v_emp_count
  from public.employees
  where team_id = p_team_id and organization_id = v_org_id;

  if v_emp_count > 0 then
    raise exception 'Cannot delete team: % employee(s) are currently assigned to it. Please reassign them first.', v_emp_count using errcode = '23503';
  end if;

  delete from public.teams
  where id = p_team_id and organization_id = v_org_id;

  return jsonb_build_object('success', true, 'deleted_id', p_team_id);
end;
$$;

grant execute on function public.get_admin_teams(),
                         public.admin_create_team(text, uuid),
                         public.admin_update_team(uuid, text, uuid),
                         public.admin_delete_team(uuid)
to authenticated;


-- 8. LOCATION MANAGEMENT RPCS
-- ============================================================
create or replace function public.get_admin_locations() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view locations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', loc.id,
      'name', loc.name,
      'city', loc.city,
      'country_code', loc.country_code,
      'employee_count', (select count(*) from public.employees where location_id = loc.id and organization_id = v_org_id),
      'created_at', loc.created_at,
      'updated_at', loc.updated_at
    ) order by loc.name
  ), '[]'::jsonb)
  into v_result
  from public.locations loc
  where loc.organization_id = v_org_id;

  return v_result;
end;
$$;

create or replace function public.admin_create_location(
  p_name text,
  p_city text default null,
  p_country_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_clean_name   text;
  v_clean_city   text;
  v_clean_cc     char(2);
  v_new_id       uuid;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to create locations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Location name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  v_clean_city := nullif(trim(p_city), '');

  if p_country_code is not null and trim(p_country_code) <> '' then
    v_clean_cc := upper(trim(p_country_code))::char(2);
    if v_clean_cc !~ '^[A-Z]{2}$' then
      raise exception 'Country code must be a 2-letter uppercase ISO code (e.g. IN, US)' using errcode = '22023';
    end if;
  else
    v_clean_cc := null;
  end if;

  if exists (select 1 from public.locations where organization_id = v_org_id and lower(name) = lower(v_clean_name)) then
    raise exception 'A location with this name already exists in your organization' using errcode = '23505';
  end if;

  insert into public.locations (organization_id, name, city, country_code)
  values (v_org_id, v_clean_name, v_clean_city, v_clean_cc)
  returning id into v_new_id;

  return jsonb_build_object('id', v_new_id, 'name', v_clean_name, 'city', v_clean_city, 'country_code', v_clean_cc);
end;
$$;

create or replace function public.admin_update_location(
  p_location_id uuid,
  p_name text,
  p_city text default null,
  p_country_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_clean_name   text;
  v_clean_city   text;
  v_clean_cc     char(2);
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to update locations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.locations where id = p_location_id and organization_id = v_org_id) then
    raise exception 'Location not found in your organization' using errcode = 'P0002';
  end if;

  v_clean_name := trim(p_name);
  if v_clean_name is null or char_length(v_clean_name) < 2 or char_length(v_clean_name) > 100 then
    raise exception 'Location name must be between 2 and 100 characters' using errcode = '22023';
  end if;

  v_clean_city := nullif(trim(p_city), '');

  if p_country_code is not null and trim(p_country_code) <> '' then
    v_clean_cc := upper(trim(p_country_code))::char(2);
    if v_clean_cc !~ '^[A-Z]{2}$' then
      raise exception 'Country code must be a 2-letter uppercase ISO code (e.g. IN, US)' using errcode = '22023';
    end if;
  else
    v_clean_cc := null;
  end if;

  if exists (select 1 from public.locations where organization_id = v_org_id and lower(name) = lower(v_clean_name) and id <> p_location_id) then
    raise exception 'Another location with this name already exists' using errcode = '23505';
  end if;

  update public.locations
  set name = v_clean_name, city = v_clean_city, country_code = v_clean_cc, updated_at = now()
  where id = p_location_id and organization_id = v_org_id;

  return jsonb_build_object('id', p_location_id, 'name', v_clean_name, 'city', v_clean_city, 'country_code', v_clean_cc);
end;
$$;

create or replace function public.admin_delete_location(p_location_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_emp_count  integer;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to delete locations' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if not exists (select 1 from public.locations where id = p_location_id and organization_id = v_org_id) then
    raise exception 'Location not found in your organization' using errcode = 'P0002';
  end if;

  select count(*) into v_emp_count
  from public.employees
  where location_id = p_location_id and organization_id = v_org_id;

  if v_emp_count > 0 then
    raise exception 'Cannot delete location: % employee(s) are currently assigned to it. Please reassign them first.', v_emp_count using errcode = '23503';
  end if;

  delete from public.locations
  where id = p_location_id and organization_id = v_org_id;

  return jsonb_build_object('success', true, 'deleted_id', p_location_id);
end;
$$;

grant execute on function public.get_admin_locations(),
                         public.admin_create_location(text, text, text),
                         public.admin_update_location(uuid, text, text, text),
                         public.admin_delete_location(uuid)
to authenticated;


-- 9. ROLE AND ACCESS MANAGEMENT RPCS
-- ============================================================
create or replace function public.get_admin_roles_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view user roles' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profile_id', p.id,
      'display_name', p.display_name,
      'account_status', p.account_status,
      'employee_id', e.id,
      'employee_code', e.employee_code,
      'first_name', e.first_name,
      'last_name', e.last_name,
      'work_email', e.work_email,
      'designation', des.name,
      'department', dept.name,
      'roles', coalesce((
        select jsonb_agg(ur.role_key order by ur.role_key)
        from public.user_roles ur
        where ur.profile_id = p.id
      ), '[]'::jsonb)
    ) order by coalesce(e.first_name, p.display_name)
  ), '[]'::jsonb)
  into v_result
  from public.profiles p
  left join public.employees e on e.profile_id = p.id
  left join public.designations des on des.id = e.designation_id
  left join public.departments dept on dept.id = e.department_id
  where p.organization_id = v_org_id;

  return v_result;
end;
$$;

create or replace function public.admin_assign_user_role(
  p_profile_id uuid,
  p_role_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to assign roles' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  -- Validate role key
  if p_role_key not in ('employee', 'manager', 'hr', 'admin', 'recruiter') then
    raise exception 'Invalid role key "%". Allowed: employee, manager, hr, admin, recruiter', p_role_key using errcode = '22023';
  end if;

  -- Validate profile in caller organization
  if not exists (select 1 from public.profiles where id = p_profile_id and organization_id = v_org_id) then
    raise exception 'Target user profile not found in your organization' using errcode = 'P0002';
  end if;

  -- Assign role
  insert into public.user_roles (profile_id, role_key)
  values (p_profile_id, p_role_key)
  on conflict (profile_id, role_key) do nothing;

  return jsonb_build_object('success', true, 'profile_id', p_profile_id, 'assigned_role', p_role_key);
end;
$$;

create or replace function public.admin_remove_user_role(
  p_profile_id uuid,
  p_role_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_org_id       uuid;
  v_other_admins integer;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to remove roles' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  -- Validate role key
  if p_role_key not in ('employee', 'manager', 'hr', 'admin', 'recruiter') then
    raise exception 'Invalid role key "%". Allowed: employee, manager, hr, admin, recruiter', p_role_key using errcode = '22023';
  end if;

  -- Validate profile in caller organization
  if not exists (select 1 from public.profiles where id = p_profile_id and organization_id = v_org_id) then
    raise exception 'Target user profile not found in your organization' using errcode = 'P0002';
  end if;

  -- Self-lockout prevention: cannot remove own admin role if sole remaining administrator
  if p_role_key = 'admin' and p_profile_id = v_caller_uid then
    select count(*) into v_other_admins
    from public.user_roles ur
    join public.profiles pr on pr.id = ur.profile_id
    where ur.role_key = 'admin'
      and pr.organization_id = v_org_id
      and ur.profile_id <> v_caller_uid;

    if v_other_admins = 0 then
      raise exception 'Cannot remove your own Admin role: you are the only remaining administrator in this organization.' using errcode = '42501';
    end if;
  end if;

  delete from public.user_roles
  where profile_id = p_profile_id and role_key = p_role_key;

  return jsonb_build_object('success', true, 'profile_id', p_profile_id, 'removed_role', p_role_key);
end;
$$;

grant execute on function public.get_admin_roles_overview(),
                         public.admin_assign_user_role(uuid, text),
                         public.admin_remove_user_role(uuid, text)
to authenticated;


-- 10. GET ADMIN ORGANIZATION STRUCTURE
-- ============================================================
create or replace function public.get_admin_organization_structure() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view organization structure' using errcode = '42501';
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
              where mem.team_id = t.id and mem.organization_id = v_org_id
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

grant execute on function public.get_admin_organization_structure() to authenticated;

