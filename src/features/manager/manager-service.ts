import { getSupabase } from "@/lib/supabase";
import type {
    DirectReportFullDetails,
    DirectReportSummary,
    ManagerDashboardSummary,
} from "@/types/manager";

/**
 * Fetch executive summary for manager dashboard.
 * Computed atomically on the server via SECURITY DEFINER RPC.
 */
export async function fetchManagerDashboardSummary(): Promise<ManagerDashboardSummary> {
  const { data, error } = await getSupabase().rpc(
    "get_manager_dashboard_summary",
  );

  if (error) {
    throw new Error(
      error.message || "Failed to load manager dashboard summary.",
    );
  }

  return data as unknown as ManagerDashboardSummary;
}

/**
 * Fetch authorized direct reports for the authenticated manager.
 * Enforces manager hierarchy and organization isolation.
 */
export async function fetchMyDirectReports(): Promise<DirectReportSummary[]> {
  const { data, error } = await getSupabase().rpc("get_manager_direct_reports");

  if (error) {
    throw new Error(error.message || "Failed to load direct reports.");
  }

  return (data as unknown as DirectReportSummary[]) ?? [];
}

/**
 * Fetch full profile, recent attendance timestamps, leave balances,
 * pending leaves, and active Phase 7 work assignments for a direct report.
 */
export async function fetchDirectReportDetails(
  employeeId: string,
): Promise<DirectReportFullDetails> {
  const { data, error } = await getSupabase().rpc("get_direct_report_details", {
    p_employee_id: employeeId,
  });

  if (error) {
    throw new Error(error.message || "Failed to load direct report details.");
  }

  return data as unknown as DirectReportFullDetails;
}
