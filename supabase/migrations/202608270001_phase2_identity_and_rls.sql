-- Phase 2 identity, organization, and least-privilege RLS foundation.
create extension if not exists pgcrypto;

create type public.account_status as enum ('invited', 'active', 'suspended', 'disabled');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'intern');
create type public.employment_status as enum ('active', 'on_leave', 'inactive', 'terminated');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete restrict,
  display_name text check (char_length(trim(display_name)) between 1 and 100),
  avatar_path text check (avatar_path is null or avatar_path !~ '^(https?:)?//'),
  account_status public.account_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  key text primary key check (key in ('employee', 'manager', 'hr', 'admin', 'recruiter')),
  description text not null
);
insert into public.roles (key, description) values
  ('employee', 'Standard employee access'), ('manager', 'Authorized team management access'),
  ('hr', 'Human resources operations access'), ('admin', 'Organization administration access'),
  ('recruiter', 'Restricted future talent-profile access');

create table public.user_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null references public.roles(key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_key)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create table public.locations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100), city text, country_code char(2), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, name), check (country_code is null or country_code ~ '^[A-Z]{2}$')
);
create table public.designations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create table public.teams (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null, name text not null check (char_length(trim(name)) between 2 and 100), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create table public.employees (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  employee_code text not null check (employee_code ~ '^[A-Z0-9-]{3,32}$'), first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100), work_email text not null check (work_email = lower(work_email)), phone text,
  department_id uuid references public.departments(id) on delete set null, team_id uuid references public.teams(id) on delete set null,
  designation_id uuid references public.designations(id) on delete set null, manager_employee_id uuid references public.employees(id) on delete set null,
  employment_type public.employment_type not null default 'full_time', employment_status public.employment_status not null default 'active',
  joining_date date, location_id uuid references public.locations(id) on delete set null, profile_photo_path text check (profile_photo_path is null or profile_photo_path !~ '^(https?:)?//'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, employee_code), unique (organization_id, work_email), check (manager_employee_id is null or manager_employee_id <> id)
);
create index employees_profile_id_idx on public.employees(profile_id);
create index employees_manager_idx on public.employees(manager_employee_id);
create index employees_organization_team_idx on public.employees(organization_id, team_id);
create index user_roles_profile_idx on public.user_roles(profile_id);

create function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger departments_updated_at before update on public.departments for each row execute function public.set_updated_at();
create trigger locations_updated_at before update on public.locations for each row execute function public.set_updated_at();
create trigger designations_updated_at before update on public.designations for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();

-- App metadata can only be set by trusted server/admin workflows; a user-created profile starts unassigned and locked down.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.current_organization_id() returns uuid language sql stable security definer set search_path = public as $$ select organization_id from public.profiles where id = auth.uid() $$;
create function public.has_role(requested text[]) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where profile_id = auth.uid() and role_key = any(requested)) $$;
create function public.is_hr_or_admin() returns boolean language sql stable security definer set search_path = public as $$ select public.has_role(array['hr', 'admin']) $$;
create function public.manages_profile(target_profile uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['manager']) and exists (select 1 from public.employees subordinate join public.employees manager on manager.id = subordinate.manager_employee_id where manager.profile_id = auth.uid() and subordinate.profile_id = target_profile and manager.organization_id = subordinate.organization_id) $$;
create function public.can_read_employee(target_profile uuid, target_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select target_profile = auth.uid() or (target_org = public.current_organization_id() and (public.is_hr_or_admin() or public.manages_profile(target_profile))) $$;
revoke all on function public.current_organization_id(), public.has_role(text[]), public.is_hr_or_admin(), public.manages_profile(uuid), public.can_read_employee(uuid, uuid) from public;
grant execute on function public.current_organization_id(), public.has_role(text[]), public.is_hr_or_admin(), public.manages_profile(uuid), public.can_read_employee(uuid, uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.locations enable row level security;
alter table public.designations enable row level security;
alter table public.teams enable row level security;
alter table public.employees enable row level security;

create policy profiles_select_scope on public.profiles for select to authenticated using (public.can_read_employee(id, organization_id));
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and organization_id = public.current_organization_id());
create policy roles_select_assigned on public.roles for select to authenticated using (exists (select 1 from public.user_roles where user_roles.profile_id = auth.uid() and user_roles.role_key = roles.key));
create policy user_roles_select_self_or_admin on public.user_roles for select to authenticated using (profile_id = auth.uid() or (public.has_role(array['admin']) and exists (select 1 from public.profiles target where target.id = user_roles.profile_id and target.organization_id = public.current_organization_id())));
create policy user_roles_admin_manage on public.user_roles for all to authenticated using (public.has_role(array['admin']) and exists (select 1 from public.profiles target where target.id = user_roles.profile_id and target.organization_id = public.current_organization_id())) with check (public.has_role(array['admin']) and exists (select 1 from public.profiles target where target.id = user_roles.profile_id and target.organization_id = public.current_organization_id()));
create policy employees_read_scope on public.employees for select to authenticated using (public.can_read_employee(profile_id, organization_id));
create policy employees_hr_admin_manage on public.employees for all to authenticated using (organization_id = public.current_organization_id() and public.is_hr_or_admin()) with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());
create policy organizations_admin_read on public.organizations for select to authenticated using (id = public.current_organization_id() and public.is_hr_or_admin());
create policy organizations_admin_manage on public.organizations for all to authenticated using (id = public.current_organization_id() and public.has_role(array['admin'])) with check (id = public.current_organization_id() and public.has_role(array['admin']));

create function public.org_scope_policy(table_name regclass) returns void language plpgsql security definer set search_path = public as $$ begin execute format('create policy %I_read on %s for select to authenticated using (organization_id = public.current_organization_id() and public.is_hr_or_admin())', table_name::text || '_scope', table_name); execute format('create policy %I_manage on %s for all to authenticated using (organization_id = public.current_organization_id() and public.is_hr_or_admin()) with check (organization_id = public.current_organization_id() and public.is_hr_or_admin())', table_name::text || '_manage', table_name); end; $$;
select public.org_scope_policy('public.departments'); select public.org_scope_policy('public.locations'); select public.org_scope_policy('public.designations'); select public.org_scope_policy('public.teams');
drop function public.org_scope_policy(regclass);

revoke all on public.organizations, public.profiles, public.roles, public.user_roles, public.departments, public.locations, public.designations, public.teams, public.employees from anon, authenticated;
grant select, update (display_name, avatar_path) on public.profiles to authenticated;
grant select on public.roles, public.user_roles, public.employees to authenticated;
grant select, insert, update, delete on public.organizations, public.departments, public.locations, public.designations, public.teams, public.employees, public.user_roles to authenticated;
