-- ============================================================
-- Migration: 202609060001_phase11_deprecate_recruiter_role.sql
-- Description:
--   Permanently deprecates the legacy 'recruiter' role.
--   1. Ensures 'talent_viewer' role exists in public.roles.
--   2. Migrates all existing 'recruiter' user_roles to 'talent_viewer'.
--   3. Updates 'test recruiter' display names in profiles to 'Talent Viewer'.
--   4. Removes 'recruiter' from public.roles and updates constraint.
--   5. Updates Admin RPCs to enforce only ('employee', 'manager', 'hr', 'admin', 'talent_viewer').
-- ============================================================

-- 1. Ensure 'talent_viewer' role exists in public.roles
insert into public.roles (key, description)
values ('talent_viewer', 'Cross-organization Talent Network viewer access')
on conflict (key) do nothing;

-- 2. Migrate existing 'recruiter' role assignments to 'talent_viewer'
insert into public.user_roles (profile_id, role_key)
select profile_id, 'talent_viewer'
from public.user_roles
where role_key = 'recruiter'
on conflict (profile_id, role_key) do nothing;

delete from public.user_roles
where role_key = 'recruiter';

-- 3. Clean up display names for test recruiter accounts
update public.profiles
set display_name = 'Talent Viewer'
where display_name = 'test recruiter';

-- 4. Remove 'recruiter' from public.roles
delete from public.roles where key = 'recruiter';

-- 5. Update roles_key_check constraint on public.roles
alter table public.roles drop constraint if exists roles_key_check;
alter table public.roles add constraint roles_key_check check (
  key in ('employee', 'manager', 'hr', 'admin', 'talent_viewer')
);

-- 6. Update Admin role management RPCs
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

  -- Validate role key (recruiter permanently removed)
  if p_role_key not in ('employee', 'manager', 'hr', 'admin', 'talent_viewer') then
    raise exception 'Invalid role key "%". Allowed: employee, manager, hr, admin, talent_viewer', p_role_key using errcode = '22023';
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

  -- Validate role key (recruiter permanently removed)
  if p_role_key not in ('employee', 'manager', 'hr', 'admin', 'talent_viewer') then
    raise exception 'Invalid role key "%". Allowed: employee, manager, hr, admin, talent_viewer', p_role_key using errcode = '22023';
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

-- 7. Update get_admin_dashboard_summary to remove recruiter breakdown
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
  v_talent_viewer_users   integer := 0;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['admin']) then
    raise exception 'Only Admin personnel are permitted to view admin dashboard' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select name into v_org_name from public.organizations where id = v_org_id;

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

  select count(*) into v_total_departments from public.departments where organization_id = v_org_id;
  select count(*) into v_total_teams from public.teams where organization_id = v_org_id;
  select count(*) into v_total_designations from public.designations where organization_id = v_org_id;
  select count(*) into v_total_locations from public.locations where organization_id = v_org_id;

  select count(distinct id) into v_total_users
  from public.profiles
  where organization_id = v_org_id;

  select count(distinct ur.profile_id) into v_admin_users
  from public.user_roles ur
  join public.profiles pr on pr.id = ur.profile_id
  where pr.organization_id = v_org_id and ur.role_key = 'admin';

  select count(distinct ur.profile_id) into v_hr_users
  from public.user_roles ur
  join public.profiles pr on pr.id = ur.profile_id
  where pr.organization_id = v_org_id and ur.role_key = 'hr';

  select count(distinct ur.profile_id) into v_manager_users
  from public.user_roles ur
  join public.profiles pr on pr.id = ur.profile_id
  where pr.organization_id = v_org_id and ur.role_key = 'manager';

  select count(distinct ur.profile_id) into v_employee_users
  from public.user_roles ur
  join public.profiles pr on pr.id = ur.profile_id
  where pr.organization_id = v_org_id and ur.role_key = 'employee';

  select count(distinct ur.profile_id) into v_talent_viewer_users
  from public.user_roles ur
  join public.profiles pr on pr.id = ur.profile_id
  where pr.organization_id = v_org_id and ur.role_key = 'talent_viewer';

  return jsonb_build_object(
    'organization_id', v_org_id,
    'organization_name', coalesce(v_org_name, 'Organization'),
    'total_employees', v_total_employees,
    'active_employees', v_active_employees,
    'inactive_employees', v_inactive_employees,
    'terminated_employees', v_terminated_employees,
    'total_departments', v_total_departments,
    'total_teams', v_total_teams,
    'total_designations', v_total_designations,
    'total_locations', v_total_locations,
    'total_users', v_total_users,
    'roles_breakdown', jsonb_build_object(
      'admin', v_admin_users,
      'hr', v_hr_users,
      'manager', v_manager_users,
      'employee', v_employee_users,
      'talent_viewer', v_talent_viewer_users
    )
  );
end;
$$;

grant execute on function public.admin_assign_user_role(uuid, text),
                         public.admin_remove_user_role(uuid, text),
                         public.get_admin_dashboard_summary()
to authenticated;

