-- ============================================================
-- LogIn — Phase 9 Additive Migration
-- Canonical Employee Identity & HR Directory Name Resolution Fix
-- Migration: 202609040005_phase9_canonical_identity_and_hr_directory_fix.sql
-- ============================================================

-- ============================================================
-- 1. UPDATE CANONICAL EMPLOYEE IDENTITY (EMP-AFB027F -> Aneesh Varma)
-- ============================================================
-- Explicitly set first_name and last_name in public.employees
update public.employees
set first_name = 'Aneesh',
    last_name = 'Varma'
where employee_code = 'EMP-AFB027F'
   or work_email = 'varmaaneesh45@gmail.com';

-- Ensure public.profiles matches canonical display name
update public.profiles p
set display_name = 'Aneesh Varma'
from public.employees e
where e.profile_id = p.id
  and (e.employee_code = 'EMP-AFB027F' or e.work_email = 'varmaaneesh45@gmail.com');

-- Also sync any other employees where first_name='Test' and last_name='Employee'
-- but profiles.display_name has been customized to a real name
update public.employees e
set first_name = substring(split_part(trim(p.display_name), ' ', 1) from 1 for 100),
    last_name = substring(
      coalesce(
        nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), ''),
        split_part(trim(p.display_name), ' ', 1)
      ) from 1 for 100
    )
from public.profiles p
where e.profile_id = p.id
  and e.first_name = 'Test'
  and e.last_name = 'Employee'
  and p.display_name is not null
  and trim(p.display_name) not in ('', 'Test Employee', 'Employee');


-- ============================================================
-- 2. BI-DIRECTIONAL SYNCHRONIZATION TRIGGERS WITH RECURSION PROTECTION
-- ============================================================

-- Trigger A: When profiles.display_name is updated (e.g. by employee in Profile screen),
-- sync first_name and last_name to public.employees
create or replace function public.sync_employee_names_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_trimmed text;
  v_first   text;
  v_rest    text;
begin
  -- Prevent trigger recursion
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_trimmed := trim(coalesce(new.display_name, ''));
  if v_trimmed <> '' and (old.display_name is distinct from new.display_name) then
    -- Defense-in-depth: if called within an authenticated session, ensure caller owns this profile
    if auth.uid() is not null and new.id <> auth.uid() then
      return new;
    end if;

    -- Safely clamp length to 100 characters per employees table check constraints
    v_first := substring(split_part(v_trimmed, ' ', 1) from 1 for 100);
    v_rest  := nullif(trim(substr(v_trimmed, length(split_part(v_trimmed, ' ', 1)) + 1)), '');
    v_rest  := substring(coalesce(v_rest, v_first) from 1 for 100);

    update public.employees
    set first_name = v_first,
        last_name = v_rest
    where profile_id = new.id
      and (first_name is distinct from v_first or last_name is distinct from v_rest);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_employee_names_from_profile on public.profiles;
create trigger trg_sync_employee_names_from_profile
after update of display_name on public.profiles
for each row execute function public.sync_employee_names_from_profile();

-- Trigger B: When employees first_name or last_name is updated,
-- sync display_name to public.profiles
create or replace function public.sync_profile_display_name_from_employee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full text;
begin
  -- Prevent trigger recursion
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_full := trim(concat(coalesce(new.first_name, ''), ' ', coalesce(new.last_name, '')));
  if new.profile_id is not null and v_full <> '' then
    update public.profiles
    set display_name = v_full
    where id = new.profile_id
      and display_name is distinct from v_full;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_display_name on public.employees;
create trigger trg_sync_profile_display_name
after insert or update of first_name, last_name, profile_id on public.employees
for each row execute function public.sync_profile_display_name_from_employee();


-- ============================================================
-- 3. RPC: GET HR EMPLOYEE DIRECTORY (ROBUST CANONICAL NAME RESOLUTION)
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
          then split_part(trim(p.display_name), ' ', 1)
        else e.first_name
      end,
      'last_name', case
        when e.first_name = 'Test' and e.last_name = 'Employee' and p.display_name is not null and trim(p.display_name) not in ('', 'Test Employee')
          then coalesce(nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), ''), split_part(trim(p.display_name), ' ', 1))
        else e.last_name
      end,
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
  -- Talent profile status (returns NULL if employee has no talent profile)
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
      or p.display_name ilike '%' || trim(p_search) || '%'
    );

  return v_result;
end;
$$;

grant execute on function public.get_hr_employee_directory(text, text, uuid) to authenticated;

