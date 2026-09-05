import { getSupabase } from "@/lib/supabase";
import type {
    EmploymentStatus,
    HRDashboardSummary,
    HRDepartmentStructure,
    HREmployeeDirectoryFilter,
    HREmployeeFullDetails,
    HREmployeeListItem,
    HRPendingTalentReview,
    PermanentEmploymentStatus
} from "@/types/hr";

/**
 * Fetch organization-level operational statistics for the authenticated HR user.
 */
export async function fetchHRDashboardSummary(): Promise<HRDashboardSummary> {
  const { data, error } = await getSupabase().rpc("get_hr_dashboard_summary");

  if (error) {
    throw new Error(error.message || "Failed to load HR dashboard summary.");
  }

  return data as HRDashboardSummary;
}

/**
 * Fetch organization employees with server-side search and filtering.
 */
export async function fetchHREmployeeDirectory(
  filter?: HREmployeeDirectoryFilter,
): Promise<HREmployeeListItem[]> {
  const { data, error } = await getSupabase().rpc("get_hr_employee_directory", {
    p_search: filter?.search?.trim() || null,
    p_status: filter?.status || null,
    p_department_id: filter?.departmentId || null,
  });

  if (error) {
    throw new Error(error.message || "Failed to load employee directory.");
  }

  return (data as HREmployeeListItem[]) ?? [];
}

/**
 * Fetch complete HR employee profile details (attendance, leave, work, talent).
 */
export async function fetchHREmployeeDetails(
  employeeId: string,
): Promise<HREmployeeFullDetails> {
  const { data, error } = await getSupabase().rpc("get_hr_employee_details", {
    p_employee_id: employeeId,
  });

  if (error) {
    throw new Error(error.message || "Failed to load employee details.");
  }

  return data as HREmployeeFullDetails;
}

/**
 * Update employment lifecycle status for an employee.
 */
export async function updateEmployeeStatus(
  employeeId: string,
  status: PermanentEmploymentStatus | EmploymentStatus,
  notes?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc(
    "update_employee_employment_status",
    {
      p_employee_id: employeeId,
      p_status: status,
      p_notes: notes?.trim() || null,
    },
  );

  if (error) {
    throw new Error(error.message || "Failed to update employee status.");
  }
}

/**
 * Fetch organization hierarchy structure (departments -> teams -> managers -> employees).
 */
export async function fetchHROrganizationStructure(): Promise<
  HRDepartmentStructure[]
> {
  const { data, error } = await getSupabase().rpc(
    "get_hr_organization_structure",
  );

  if (error) {
    throw new Error(error.message || "Failed to load organization structure.");
  }

  return (data as HRDepartmentStructure[]) ?? [];
}

/**
 * Fetch pending talent profile reviews across the organization.
 */
export async function fetchHRPendingTalentReviews(): Promise<
  HRPendingTalentReview[]
> {
  const { data, error } = await getSupabase().rpc(
    "get_hr_pending_talent_reviews",
  );

  if (error) {
    throw new Error(error.message || "Failed to load pending talent reviews.");
  }

  return (data as HRPendingTalentReview[]) ?? [];
}

/**
 * Review (approve or reject) an employee's submitted talent profile.
 */
export async function reviewTalentProfile(
  employeeId: string,
  action: "approve" | "reject",
  notes?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("review_talent_profile", {
    p_employee_id: employeeId,
    p_action: action,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    throw new Error(error.message || `Failed to ${action} talent profile.`);
  }
}
