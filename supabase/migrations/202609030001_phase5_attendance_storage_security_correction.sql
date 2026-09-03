-- Phase 5: Storage RLS Helper Functions Correction for Private Attendance Photos
-- Description: Updates attendance storage helper functions to robustly extract employee_id
-- using standard PostgreSQL split_part(object_name, '/', 1), ensuring reliable signed URL evaluation.

create or replace function public.owns_attendance_storage_object(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where profile_id = auth.uid()
      and id::text = split_part(object_name, '/', 1)
  )
$$;

create or replace function public.can_hr_read_attendance_storage(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['hr']) and exists (
    select 1 from public.employees
    where id::text = split_part(object_name, '/', 1)
      and organization_id = public.current_organization_id()
  )
$$;

create or replace function public.can_manager_read_attendance_storage(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['manager']) and exists (
    select 1 from public.employees subordinate
    join public.employees manager on manager.id = subordinate.manager_employee_id
    where manager.profile_id = auth.uid()
      and subordinate.id::text = split_part(object_name, '/', 1)
      and manager.organization_id = subordinate.organization_id
  )
$$;

grant execute on function public.owns_attendance_storage_object(text),
                         public.can_hr_read_attendance_storage(text),
                         public.can_manager_read_attendance_storage(text)
to authenticated;

