-- ============================================================
-- Migration: 202609050002_phase10_admin_directory_enum_fix.sql
-- Description:
--   Additive correction for Phase 10 Admin Management.
--   Fixes runtime PostgreSQL error in public.get_admin_employee_directory():
--     "operator does not exist: employee_status = text"
--   Casts e.employment_status::text for safe comparison against
--   p_employment_status (text), eliminating custom enum type mismatch.
--
-- Security Rules Preserved:
--   - Caller must be authenticated
--   - Caller must hold 'admin' role
--   - Strict organization scoping via current_organization_id()
--   - IDOR protection across all records
--   - Zero attendance data exposed to Admin
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
    and (
      p_employment_status is null
      or trim(p_employment_status) = ''
      or p_employment_status = 'all'
      or e.employment_status::text = p_employment_status
    )
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

