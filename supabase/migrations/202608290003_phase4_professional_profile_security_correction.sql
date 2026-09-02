-- Corrective migration for the already-applied Phase 4 schema. No existing policy is weakened.

create function public.add_own_skill(
  skill_name text,
  skill_category text,
  skill_proficiency public.proficiency_level
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_skill_id uuid;
  v_name text := trim(skill_name);
  v_category text := nullif(trim(skill_category), '');
begin
  if v_name is null or char_length(v_name) not between 1 and 80 then
    raise exception 'Invalid skill name' using errcode = '22023';
  end if;
  if v_category is not null and char_length(v_category) > 80 then
    raise exception 'Invalid skill category' using errcode = '22023';
  end if;

  select id into v_employee_id from public.employees where profile_id = auth.uid();
  if v_employee_id is null then
    raise exception 'Employee record not found' using errcode = '42501';
  end if;

  select id into v_skill_id from public.skills where lower(name) = lower(v_name);
  if v_skill_id is null then
    insert into public.skills (name, category) values (v_name, v_category)
    on conflict (lower(name)) do nothing
    returning id into v_skill_id;
    if v_skill_id is null then
      select id into v_skill_id from public.skills where lower(name) = lower(v_name);
    end if;
  end if;

  insert into public.employee_skills (employee_id, skill_id, proficiency)
  values (v_employee_id, v_skill_id, skill_proficiency)
  on conflict (employee_id, skill_id) do update set proficiency = excluded.proficiency;
  return v_skill_id;
end;
$$;

revoke all on function public.add_own_skill(text, text, public.proficiency_level) from public;
grant execute on function public.add_own_skill(text, text, public.proficiency_level) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create function public.owns_resume_object(object_name text) returns boolean
language sql stable security definer set search_path = public, storage
as $$
  select exists (
    select 1 from public.employees
    where profile_id = auth.uid()
      and id::text = (storage.foldername(object_name))[1]
  )
$$;
revoke all on function public.owns_resume_object(text) from public;
grant execute on function public.owns_resume_object(text) to authenticated;

create policy resumes_storage_select_own on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.owns_resume_object(name));
create policy resumes_storage_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and public.owns_resume_object(name));
create policy resumes_storage_update_own on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and public.owns_resume_object(name))
  with check (bucket_id = 'resumes' and public.owns_resume_object(name));
create policy resumes_storage_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and public.owns_resume_object(name));
