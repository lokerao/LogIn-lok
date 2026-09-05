-- ============================================================
-- Migration: 202609050003_phase11_talent_network.sql
-- Description:
--   Phase 11 Cross-Organization Talent Viewer & Talent Network
--   Establishes:
--     1. public.talent_access_status enum ('pending', 'approved', 'rejected', 'suspended')
--     2. public.roles extension to support 'talent_viewer' alongside 'recruiter'
--     3. public.talent_viewer_access_requests table
--     4. public.talent_network_audit_logs table
--     5. Row Level Security policies
--     6. Secure RPC functions:
--        - is_talent_viewer()
--        - get_talent_network_organizations()
--        - request_talent_organization_access(uuid)
--        - get_my_talent_organization_access()
--        - get_talent_network_profiles(...)
--        - get_talent_network_profile_details(text)
--        - get_organization_talent_viewer_requests()
--        - review_talent_viewer_access_request(uuid, text, text)
--
-- Security Rules:
--   - Talent Viewer is NOT an employee and has zero workforce/attendance/leave/salary data
--   - Organizations discoverable by Talent Viewer, but talent profiles accessible ONLY upon approved access
--   - Approval is organization-scoped (HR/Admin of Org A cannot approve Org B)
--   - Only approved professional talent profiles (review_status = 'approved') exposed
--   - Strict IDOR protections on all queries and mutations
-- ============================================================

-- 1. ENUM & ROLE DEFINITIONS
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'talent_access_status') then
    create type public.talent_access_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
end;
$$;

alter table public.roles drop constraint if exists roles_key_check;
alter table public.roles add constraint roles_key_check check (
  key in ('employee', 'manager', 'hr', 'admin', 'recruiter', 'talent_viewer')
);

insert into public.roles (key, description)
values ('talent_viewer', 'Cross-organization Talent Network viewer access')
on conflict (key) do nothing;


-- 2. TABLES
-- ============================================================
create table if not exists public.talent_viewer_access_requests (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status public.talent_access_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viewer_profile_id, organization_id)
);

create table if not exists public.talent_network_audit_logs (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  talent_profile_id uuid references public.talent_profiles(employee_id) on delete set null,
  action_type text not null check (action_type in ('REQUEST_ORGANIZATION_ACCESS', 'SEARCH_TALENT', 'VIEW_TALENT_PROFILE')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for efficient lookup
create index if not exists idx_tvr_viewer on public.talent_viewer_access_requests(viewer_profile_id, status);
create index if not exists idx_tvr_org on public.talent_viewer_access_requests(organization_id, status);
create index if not exists idx_tna_viewer on public.talent_network_audit_logs(viewer_profile_id, created_at desc);


-- 3. ROW LEVEL SECURITY
-- ============================================================
alter table public.talent_viewer_access_requests enable row level security;
alter table public.talent_network_audit_logs enable row level security;

-- Viewer can read their own requests; HR/Admin can read requests for their organization
drop policy if exists tvr_select_policy on public.talent_viewer_access_requests;
create policy tvr_select_policy on public.talent_viewer_access_requests
  for select to authenticated
  using (
    viewer_profile_id = auth.uid()
    or (
      public.has_role(array['hr', 'admin'])
      and organization_id = public.current_organization_id()
    )
  );

-- Viewer can insert access request for themselves (strictly pending status only)
drop policy if exists tvr_insert_policy on public.talent_viewer_access_requests;
create policy tvr_insert_policy on public.talent_viewer_access_requests
  for insert to authenticated
  with check (
    viewer_profile_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- HR / Admin can update requests for their own organization
drop policy if exists tvr_update_policy on public.talent_viewer_access_requests;
create policy tvr_update_policy on public.talent_viewer_access_requests
  for update to authenticated
  using (
    public.has_role(array['hr', 'admin'])
    and organization_id = public.current_organization_id()
  )
  with check (
    public.has_role(array['hr', 'admin'])
    and organization_id = public.current_organization_id()
  );

-- Audit logs: viewer reads own logs; HR/Admin reads logs for their organization
drop policy if exists tna_select_policy on public.talent_network_audit_logs;
create policy tna_select_policy on public.talent_network_audit_logs
  for select to authenticated
  using (
    viewer_profile_id = auth.uid()
    or (
      public.has_role(array['hr', 'admin'])
      and organization_id = public.current_organization_id()
    )
  );


-- 4. HELPER FUNCTION: is_talent_viewer()
-- ============================================================
create or replace function public.is_talent_viewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where profile_id = auth.uid()
      and role_key = 'talent_viewer'
  );
$$;

grant execute on function public.is_talent_viewer() to authenticated;


-- 5. RPC: get_talent_network_organizations()
-- Returns participating organizations and the caller's request status
-- ============================================================
create or replace function public.get_talent_network_organizations() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_talent_viewer() then
    raise exception 'Only authorized Talent Viewers can discover organizations' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'access_status', coalesce(tvr.status::text, 'not_requested'),
      'requested_at', tvr.requested_at,
      'reviewed_at', tvr.reviewed_at,
      'reviewer_notes', tvr.reviewer_notes,
      'approved_talent_count', case
        when tvr.status = 'approved' then (
          select count(*)
          from public.talent_profiles tp
          join public.employees e on e.id = tp.employee_id
          where e.organization_id = o.id
            and tp.review_status = 'approved'
            and e.employment_status::text <> 'terminated'
        )
        else 0
      end
    ) order by o.name
  ), '[]'::jsonb)
  into v_result
  from public.organizations o
  left join public.talent_viewer_access_requests tvr
    on tvr.organization_id = o.id
   and tvr.viewer_profile_id = v_caller_uid;

  return v_result;
end;
$$;

grant execute on function public.get_talent_network_organizations() to authenticated;


-- 6. RPC: request_talent_organization_access(p_organization_id uuid)
-- Submits or re-submits an access request to a target organization
-- ============================================================
create or replace function public.request_talent_organization_access(
  p_organization_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid   uuid := auth.uid();
  v_existing     public.talent_viewer_access_requests%rowtype;
  v_new_req      public.talent_viewer_access_requests%rowtype;
  v_org_name     text;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_talent_viewer() then
    raise exception 'Only authorized Talent Viewers can request organization access' using errcode = '42501';
  end if;

  -- Validate organization exists
  select name into v_org_name
  from public.organizations
  where id = p_organization_id;

  if not found then
    raise exception 'Target organization does not exist' using errcode = 'P0002';
  end if;

  -- Check existing request
  select * into v_existing
  from public.talent_viewer_access_requests
  where viewer_profile_id = v_caller_uid
    and organization_id = p_organization_id;

  if found then
    if v_existing.status = 'pending' then
      raise exception 'You already have a pending access request for this organization' using errcode = 'P0001';
    elsif v_existing.status = 'approved' then
      raise exception 'You already have approved access to this organization' using errcode = 'P0001';
    else
      -- If rejected or suspended, allow re-requesting
      update public.talent_viewer_access_requests
      set status = 'pending',
          requested_at = now(),
          reviewed_by = null,
          reviewed_at = null,
          reviewer_notes = null,
          updated_at = now()
      where id = v_existing.id
      returning * into v_new_req;
    end if;
  else
    insert into public.talent_viewer_access_requests (
      viewer_profile_id,
      organization_id,
      status
    ) values (
      v_caller_uid,
      p_organization_id,
      'pending'
    ) returning * into v_new_req;
  end if;

  -- Record audit log
  insert into public.talent_network_audit_logs (
    viewer_profile_id,
    organization_id,
    action_type,
    metadata
  ) values (
    v_caller_uid,
    p_organization_id,
    'REQUEST_ORGANIZATION_ACCESS',
    jsonb_build_object('organization_name', v_org_name)
  );

  return jsonb_build_object(
    'id', v_new_req.id,
    'organization_id', v_new_req.organization_id,
    'organization_name', v_org_name,
    'status', v_new_req.status,
    'requested_at', v_new_req.requested_at
  );
end;
$$;

grant execute on function public.request_talent_organization_access(uuid) to authenticated;


-- 7. RPC: get_my_talent_organization_access()
-- Returns all access requests for the authenticated Talent Viewer
-- ============================================================
create or replace function public.get_my_talent_organization_access() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_talent_viewer() then
    raise exception 'Only authorized Talent Viewers can view access requests' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tvr.id,
      'organization_id', o.id,
      'organization_name', o.name,
      'status', tvr.status,
      'requested_at', tvr.requested_at,
      'reviewed_at', tvr.reviewed_at,
      'reviewer_notes', tvr.reviewer_notes
    ) order by tvr.requested_at desc
  ), '[]'::jsonb)
  into v_result
  from public.talent_viewer_access_requests tvr
  join public.organizations o on o.id = tvr.organization_id
  where tvr.viewer_profile_id = v_caller_uid;

  return v_result;
end;
$$;

grant execute on function public.get_my_talent_organization_access() to authenticated;


-- 8. RPC: get_talent_network_profiles(...)
-- Discover approved talent profiles across approved organizations
-- ============================================================
create or replace function public.get_talent_network_profiles(
  p_organization_id uuid default null,
  p_search          text default null,
  p_skill           text default null,
  p_limit           int  default 50,
  p_offset          int  default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid       uuid := auth.uid();
  v_approved_org_ids uuid[];
  v_result           jsonb;
  v_safe_limit       int := greatest(1, least(coalesce(p_limit, 50), 100));
  v_safe_offset      int := greatest(0, coalesce(p_offset, 0));
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_talent_viewer() then
    raise exception 'Only authorized Talent Viewers can access the Talent Network' using errcode = '42501';
  end if;

  -- 1. Gather approved organizations for caller
  select coalesce(array_agg(organization_id), '{}'::uuid[])
  into v_approved_org_ids
  from public.talent_viewer_access_requests
  where viewer_profile_id = v_caller_uid
    and status = 'approved';

  -- If specific organization requested, verify approval
  if p_organization_id is not null then
    if not (p_organization_id = any(v_approved_org_ids)) then
      raise exception 'Access to this organization talent is not approved' using errcode = '42501';
    end if;
  elsif array_length(v_approved_org_ids, 1) is null then
    -- No approved organizations yet, return empty list
    return '[]'::jsonb;
  end if;

  -- 2. Query approved talent profiles strictly within approved organizations
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'talent_id', tp.talent_id,
      'organization_id', o.id,
      'organization_name', o.name,
      'professional_name', tp.professional_name,
      'professional_title', tp.professional_title,
      'summary', tp.summary,
      'skills', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', s.name,
            'proficiency', es.proficiency
          ) order by s.name
        )
        from public.employee_skills es
        join public.skills s on s.id = es.skill_id
        where es.employee_id = tp.employee_id
          and es.review_status = 'approved'
      ), '[]'::jsonb),
      'experience_count', (
        select count(*)
        from public.experiences exp
        where exp.employee_id = tp.employee_id
          and exp.review_status = 'approved'
      ),
      'certifications_count', (
        select count(*)
        from public.certifications cert
        where cert.employee_id = tp.employee_id
          and cert.review_status = 'approved'
      ),
      'projects_count', (
        select count(*)
        from public.projects proj
        where proj.employee_id = tp.employee_id
          and proj.review_status = 'approved'
      )
    ) order by tp.talent_id
  ), '[]'::jsonb)
  into v_result
  from (
    select tp_inner.*, e_inner.organization_id
    from public.talent_profiles tp_inner
    join public.employees e_inner on e_inner.id = tp_inner.employee_id
    where tp_inner.review_status = 'approved'
      and e_inner.employment_status::text <> 'terminated'
      and (
        (p_organization_id is not null and e_inner.organization_id = p_organization_id)
        or (p_organization_id is null and e_inner.organization_id = any(v_approved_org_ids))
      )
      and (
        p_search is null
        or trim(p_search) = ''
        or tp_inner.professional_name ilike '%' || trim(p_search) || '%'
        or tp_inner.professional_title ilike '%' || trim(p_search) || '%'
        or tp_inner.summary ilike '%' || trim(p_search) || '%'
      )
      and (
        p_skill is null
        or trim(p_skill) = ''
        or exists (
          select 1
          from public.employee_skills es2
          join public.skills s2 on s2.id = es2.skill_id
          where es2.employee_id = tp_inner.employee_id
            and es2.review_status = 'approved'
            and s2.name ilike '%' || trim(p_skill) || '%'
        )
      )
    order by tp_inner.talent_id
    limit v_safe_limit
    offset v_safe_offset
  ) tp
  join public.organizations o on o.id = tp.organization_id;

  -- 3. Record search audit log
  insert into public.talent_network_audit_logs (
    viewer_profile_id,
    organization_id,
    action_type,
    metadata
  ) values (
    v_caller_uid,
    p_organization_id,
    'SEARCH_TALENT',
    jsonb_build_object(
      'search', p_search,
      'skill', p_skill,
      'limit', v_safe_limit,
      'offset', v_safe_offset
    )
  );

  return v_result;
end;
$$;

grant execute on function public.get_talent_network_profiles(uuid, text, text, int, int) to authenticated;


-- 9. RPC: get_talent_network_profile_details(p_talent_id text)
-- Fetch full approved professional portfolio for a specific Talent ID
-- ============================================================
create or replace function public.get_talent_network_profile_details(
  p_talent_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_emp_id     uuid;
  v_org_id     uuid;
  v_org_name   text;
  v_tp         public.talent_profiles%rowtype;
  v_is_approved boolean;
  v_has_resume boolean;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_talent_viewer() then
    raise exception 'Only authorized Talent Viewers can view Talent Network profiles' using errcode = '42501';
  end if;

  -- Look up talent profile and owning organization
  select tp.employee_id, e.organization_id, o.name
  into v_emp_id, v_org_id, v_org_name
  from public.talent_profiles tp
  join public.employees e on e.id = tp.employee_id
  join public.organizations o on o.id = e.organization_id
  where tp.talent_id = p_talent_id
    and tp.review_status = 'approved'
    and e.employment_status::text <> 'terminated';

  if not found then
    raise exception 'Talent Profile not found or not approved for the Talent Network' using errcode = 'P0002';
  end if;

  -- Verify viewer has approved access to this organization
  select exists (
    select 1
    from public.talent_viewer_access_requests
    where viewer_profile_id = v_caller_uid
      and organization_id = v_org_id
      and status = 'approved'
  ) into v_is_approved;

  if not v_is_approved then
    raise exception 'Access to this organization talent is not approved' using errcode = '42501';
  end if;

  -- Check if approved resume exists
  select exists (
    select 1 from public.resumes where employee_id = v_emp_id
  ) into v_has_resume;

  select * into v_tp from public.talent_profiles where employee_id = v_emp_id;

  -- Record view audit log
  insert into public.talent_network_audit_logs (
    viewer_profile_id,
    organization_id,
    talent_profile_id,
    action_type,
    metadata
  ) values (
    v_caller_uid,
    v_org_id,
    v_emp_id,
    'VIEW_TALENT_PROFILE',
    jsonb_build_object('talent_id', p_talent_id)
  );

  return jsonb_build_object(
    'talent_id', v_tp.talent_id,
    'organization_id', v_org_id,
    'organization_name', v_org_name,
    'professional_name', v_tp.professional_name,
    'professional_title', v_tp.professional_title,
    'summary', v_tp.summary,
    'has_resume', v_has_resume,
    'skills', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', es.id,
          'name', s.name,
          'category', s.category,
          'proficiency', es.proficiency
        ) order by s.name
      )
      from public.employee_skills es
      join public.skills s on s.id = es.skill_id
      where es.employee_id = v_emp_id
        and es.review_status = 'approved'
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
          'description', exp.description
        ) order by exp.start_date desc
      )
      from public.experiences exp
      where exp.employee_id = v_emp_id
        and exp.review_status = 'approved'
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
          'description', edu.description
        ) order by edu.start_date desc nulls last
      )
      from public.education edu
      where edu.employee_id = v_emp_id
        and edu.review_status = 'approved'
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
          'verification_url', cert.verification_url
        ) order by cert.issue_date desc nulls last
      )
      from public.certifications cert
      where cert.employee_id = v_emp_id
        and cert.review_status = 'approved'
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
          'project_url', proj.project_url
        ) order by proj.start_date desc nulls last
      )
      from public.projects proj
      where proj.employee_id = v_emp_id
        and proj.review_status = 'approved'
    ), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ach.id,
          'title', ach.title,
          'description', ach.description,
          'achieved_on', ach.achieved_on,
          'issuer', ach.issuer
        ) order by ach.achieved_on desc nulls last
      )
      from public.achievements ach
      where ach.employee_id = v_emp_id
        and ach.review_status = 'approved'
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_talent_network_profile_details(text) to authenticated;


-- 10. RPC: get_organization_talent_viewer_requests()
-- Review queue for HR / Admin to inspect incoming Talent Viewer requests
-- ============================================================
create or replace function public.get_organization_talent_viewer_requests() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['hr', 'admin']) then
    raise exception 'Only HR and Admin personnel can review Talent Viewer requests' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tvr.id,
      'viewer_profile_id', tvr.viewer_profile_id,
      'viewer_name', coalesce(p.display_name, 'Talent Viewer'),
      'viewer_avatar', p.avatar_path,
      'status', tvr.status,
      'requested_at', tvr.requested_at,
      'reviewed_at', tvr.reviewed_at,
      'reviewer_notes', tvr.reviewer_notes,
      'reviewed_by_name', rev.display_name
    ) order by
      case when tvr.status = 'pending' then 0 else 1 end,
      tvr.requested_at desc
  ), '[]'::jsonb)
  into v_result
  from public.talent_viewer_access_requests tvr
  join public.profiles p on p.id = tvr.viewer_profile_id
  left join public.profiles rev on rev.id = tvr.reviewed_by
  where tvr.organization_id = v_org_id;

  return v_result;
end;
$$;

grant execute on function public.get_organization_talent_viewer_requests() to authenticated;


-- 11. RPC: review_talent_viewer_access_request(...)
-- Approve, reject, or suspend a Talent Viewer's organization access
-- ============================================================
create or replace function public.review_talent_viewer_access_request(
  p_request_id uuid,
  p_status     text,
  p_notes      text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid  uuid := auth.uid();
  v_org_id      uuid;
  v_valid_status public.talent_access_status;
  v_updated     public.talent_viewer_access_requests%rowtype;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['hr', 'admin']) then
    raise exception 'Only HR and Admin personnel can review Talent Viewer requests' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid review status. Allowed values: approved, rejected, suspended' using errcode = 'P0001';
  end if;

  v_valid_status := p_status::public.talent_access_status;

  -- Ensure request belongs to caller's organization (strict IDOR protection)
  update public.talent_viewer_access_requests
  set status = v_valid_status,
      reviewed_by = v_caller_uid,
      reviewed_at = now(),
      reviewer_notes = trim(p_notes),
      updated_at = now()
  where id = p_request_id
    and organization_id = v_org_id
  returning * into v_updated;

  if not found then
    raise exception 'Access request not found in your organization' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_updated.id,
    'organization_id', v_updated.organization_id,
    'status', v_updated.status,
    'reviewed_at', v_updated.reviewed_at,
    'reviewer_notes', v_updated.reviewer_notes
  );
end;
$$;

grant execute on function public.review_talent_viewer_access_request(uuid, text, text) to authenticated;


-- 12. RPC: get_organization_talent_audit_logs(p_limit int)
-- Review log for HR / Admin to inspect external viewer activity on their organization's talent
-- ============================================================
create or replace function public.get_organization_talent_audit_logs(
  p_limit int default 50
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid uuid := auth.uid();
  v_org_id     uuid;
  v_result     jsonb;
  v_safe_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_role(array['hr', 'admin']) then
    raise exception 'Only HR and Admin personnel can view organization audit logs' using errcode = '42501';
  end if;

  v_org_id := public.current_organization_id();
  if v_org_id is null then
    raise exception 'Organization not found for authenticated profile' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', al.id,
      'action_type', al.action_type,
      'viewer_name', coalesce(p.display_name, 'Talent Viewer'),
      'viewer_profile_id', al.viewer_profile_id,
      'talent_profile_id', al.talent_profile_id,
      'metadata', al.metadata,
      'created_at', al.created_at
    ) order by al.created_at desc
  ), '[]'::jsonb)
  into v_result
  from (
    select * from public.talent_network_audit_logs
    where organization_id = v_org_id
    order by created_at desc
    limit v_safe_limit
  ) al
  join public.profiles p on p.id = al.viewer_profile_id;

  return v_result;
end;
$$;

grant execute on function public.get_organization_talent_audit_logs(int) to authenticated;


