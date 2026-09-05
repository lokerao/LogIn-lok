import { getSupabase } from "@/lib/supabase";
import type {
  AdminDashboardSummary,
  AdminDepartment,
  AdminDesignation,
  AdminEmployeeDetails,
  AdminEmployeeFilter,
  AdminEmployeeListItem,
  AdminLocation,
  AdminOrgDepartmentStructure,
  AdminTeam,
  AdminUserRoleItem,
  UpdateEmployeeOrgPayload,
} from "@/types/admin";
import type { AppRole } from "@/types/roles";

/**
 * Fetch high-level organization administration dashboard summary.
 */
export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { data, error } = await getSupabase().rpc(
    "get_admin_dashboard_summary",
  );
  if (error) {
    throw new Error(error.message || "Failed to load admin dashboard summary.");
  }
  return data as AdminDashboardSummary;
}

/**
 * Fetch organization employee list for administration.
 */
export async function fetchAdminEmployees(
  filter?: AdminEmployeeFilter,
): Promise<AdminEmployeeListItem[]> {
  const { data, error } = await getSupabase().rpc(
    "get_admin_employee_directory",
    {
      p_search: filter?.search?.trim() || null,
      p_department_id: filter?.department_id || null,
      p_designation_id: filter?.designation_id || null,
      p_team_id: filter?.team_id || null,
      p_location_id: filter?.location_id || null,
      p_employment_status:
        filter?.employment_status && filter.employment_status !== "all"
          ? filter.employment_status
          : null,
      p_role_key:
        filter?.role_key && filter.role_key !== "all" ? filter.role_key : null,
    },
  );
  if (error) {
    throw new Error(error.message || "Failed to load employee directory.");
  }
  return (data as AdminEmployeeListItem[]) ?? [];
}

/**
 * Fetch full administrative details for an employee.
 */
export async function fetchAdminEmployeeDetails(
  employeeId: string,
): Promise<AdminEmployeeDetails> {
  const { data, error } = await getSupabase().rpc(
    "get_admin_employee_details",
    {
      p_employee_id: employeeId,
    },
  );
  if (error) {
    throw new Error(error.message || "Failed to load employee details.");
  }
  return data as AdminEmployeeDetails;
}

/**
 * Update employee organizational assignments (dept, designation, team, location, manager).
 */
export async function updateEmployeeOrganization(
  employeeId: string,
  payload: UpdateEmployeeOrgPayload,
): Promise<AdminEmployeeDetails> {
  const { data, error } = await getSupabase().rpc(
    "admin_update_employee_organization",
    {
      p_employee_id: employeeId,
      p_department_id: payload.department_id || null,
      p_designation_id: payload.designation_id || null,
      p_team_id: payload.team_id || null,
      p_location_id: payload.location_id || null,
      p_manager_employee_id: payload.manager_employee_id || null,
    },
  );
  if (error) {
    throw new Error(
      error.message || "Failed to update employee organizational assignments.",
    );
  }
  return data as AdminEmployeeDetails;
}

/**
 * Fetch all organization departments.
 */
export async function fetchAdminDepartments(): Promise<AdminDepartment[]> {
  const { data, error } = await getSupabase().rpc("get_admin_departments");
  if (error) {
    throw new Error(error.message || "Failed to load departments.");
  }
  return (data as AdminDepartment[]) ?? [];
}

/**
 * Create a department.
 */
export async function createAdminDepartment(
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_create_department", {
    p_name: name.trim(),
  });
  if (error) {
    throw new Error(error.message || "Failed to create department.");
  }
  return data as { id: string; name: string };
}

/**
 * Update a department.
 */
export async function updateAdminDepartment(
  departmentId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_update_department", {
    p_department_id: departmentId,
    p_name: name.trim(),
  });
  if (error) {
    throw new Error(error.message || "Failed to update department.");
  }
  return data as { id: string; name: string };
}

/**
 * Delete a department (fails safely if employees/teams assigned).
 */
export async function deleteAdminDepartment(
  departmentId: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("admin_delete_department", {
    p_department_id: departmentId,
  });
  if (error) {
    throw new Error(error.message || "Failed to delete department.");
  }
}

/**
 * Fetch all organization designations.
 */
export async function fetchAdminDesignations(): Promise<AdminDesignation[]> {
  const { data, error } = await getSupabase().rpc("get_admin_designations");
  if (error) {
    throw new Error(error.message || "Failed to load designations.");
  }
  return (data as AdminDesignation[]) ?? [];
}

/**
 * Create a designation.
 */
export async function createAdminDesignation(
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_create_designation", {
    p_name: name.trim(),
  });
  if (error) {
    throw new Error(error.message || "Failed to create designation.");
  }
  return data as { id: string; name: string };
}

/**
 * Update a designation.
 */
export async function updateAdminDesignation(
  designationId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_update_designation", {
    p_designation_id: designationId,
    p_name: name.trim(),
  });
  if (error) {
    throw new Error(error.message || "Failed to update designation.");
  }
  return data as { id: string; name: string };
}

/**
 * Delete a designation (fails safely if employees assigned).
 */
export async function deleteAdminDesignation(
  designationId: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("admin_delete_designation", {
    p_designation_id: designationId,
  });
  if (error) {
    throw new Error(error.message || "Failed to delete designation.");
  }
}

/**
 * Fetch all organization teams.
 */
export async function fetchAdminTeams(): Promise<AdminTeam[]> {
  const { data, error } = await getSupabase().rpc("get_admin_teams");
  if (error) {
    throw new Error(error.message || "Failed to load teams.");
  }
  return (data as AdminTeam[]) ?? [];
}

/**
 * Create a team.
 */
export async function createAdminTeam(
  name: string,
  departmentId?: string | null,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_create_team", {
    p_name: name.trim(),
    p_department_id: departmentId || null,
  });
  if (error) {
    throw new Error(error.message || "Failed to create team.");
  }
  return data as { id: string; name: string };
}

/**
 * Update a team.
 */
export async function updateAdminTeam(
  teamId: string,
  name: string,
  departmentId?: string | null,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_update_team", {
    p_team_id: teamId,
    p_name: name.trim(),
    p_department_id: departmentId || null,
  });
  if (error) {
    throw new Error(error.message || "Failed to update team.");
  }
  return data as { id: string; name: string };
}

/**
 * Delete a team (fails safely if employees assigned).
 */
export async function deleteAdminTeam(teamId: string): Promise<void> {
  const { error } = await getSupabase().rpc("admin_delete_team", {
    p_team_id: teamId,
  });
  if (error) {
    throw new Error(error.message || "Failed to delete team.");
  }
}

/**
 * Fetch all organization locations.
 */
export async function fetchAdminLocations(): Promise<AdminLocation[]> {
  const { data, error } = await getSupabase().rpc("get_admin_locations");
  if (error) {
    throw new Error(error.message || "Failed to load locations.");
  }
  return (data as AdminLocation[]) ?? [];
}

/**
 * Create a location.
 */
export async function createAdminLocation(
  name: string,
  city?: string | null,
  countryCode?: string | null,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_create_location", {
    p_name: name.trim(),
    p_city: city?.trim() || null,
    p_country_code: countryCode?.trim() || null,
  });
  if (error) {
    throw new Error(error.message || "Failed to create location.");
  }
  return data as { id: string; name: string };
}

/**
 * Update a location.
 */
export async function updateAdminLocation(
  locationId: string,
  name: string,
  city?: string | null,
  countryCode?: string | null,
): Promise<{ id: string; name: string }> {
  const { data, error } = await getSupabase().rpc("admin_update_location", {
    p_location_id: locationId,
    p_name: name.trim(),
    p_city: city?.trim() || null,
    p_country_code: countryCode?.trim() || null,
  });
  if (error) {
    throw new Error(error.message || "Failed to update location.");
  }
  return data as { id: string; name: string };
}

/**
 * Delete a location (fails safely if employees assigned).
 */
export async function deleteAdminLocation(locationId: string): Promise<void> {
  const { error } = await getSupabase().rpc("admin_delete_location", {
    p_location_id: locationId,
  });
  if (error) {
    throw new Error(error.message || "Failed to delete location.");
  }
}

/**
 * Fetch role overview across organization users.
 */
export async function fetchAdminRolesOverview(): Promise<AdminUserRoleItem[]> {
  const { data, error } = await getSupabase().rpc("get_admin_roles_overview");
  if (error) {
    throw new Error(error.message || "Failed to load roles overview.");
  }
  return (data as AdminUserRoleItem[]) ?? [];
}

/**
 * Assign an application role to a user.
 */
export async function assignUserRole(
  profileId: string,
  roleKey: AppRole,
): Promise<void> {
  const { error } = await getSupabase().rpc("admin_assign_user_role", {
    p_profile_id: profileId,
    p_role_key: roleKey,
  });
  if (error) {
    throw new Error(error.message || "Failed to assign role.");
  }
}

/**
 * Remove an application role from a user.
 */
export async function removeUserRole(
  profileId: string,
  roleKey: AppRole,
): Promise<void> {
  const { error } = await getSupabase().rpc("admin_remove_user_role", {
    p_profile_id: profileId,
    p_role_key: roleKey,
  });
  if (error) {
    throw new Error(error.message || "Failed to remove role.");
  }
}

/**
 * Fetch hierarchical organization structure.
 */
export async function fetchAdminOrganizationStructure(): Promise<
  AdminOrgDepartmentStructure[]
> {
  const { data, error } = await getSupabase().rpc(
    "get_admin_organization_structure",
  );
  if (error) {
    throw new Error(
      error.message || "Failed to load organization hierarchy structure.",
    );
  }
  return (data as AdminOrgDepartmentStructure[]) ?? [];
}
