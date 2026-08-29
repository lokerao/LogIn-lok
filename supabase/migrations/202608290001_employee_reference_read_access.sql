-- Employees may read only the organization reference records attached to their own employee row.
create policy departments_employee_assigned_read on public.departments for select to authenticated using (
  exists (select 1 from public.employees where employees.profile_id = auth.uid() and employees.department_id = departments.id)
);
create policy teams_employee_assigned_read on public.teams for select to authenticated using (
  exists (select 1 from public.employees where employees.profile_id = auth.uid() and employees.team_id = teams.id)
);
create policy designations_employee_assigned_read on public.designations for select to authenticated using (
  exists (select 1 from public.employees where employees.profile_id = auth.uid() and employees.designation_id = designations.id)
);
create policy locations_employee_assigned_read on public.locations for select to authenticated using (
  exists (select 1 from public.employees where employees.profile_id = auth.uid() and employees.location_id = locations.id)
);
