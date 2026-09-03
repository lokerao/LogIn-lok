import { getSupabase } from "@/lib/supabase";
import type { LeaveBalance, LeaveRequest, LeaveType } from "@/types/leave";

/** Format a date string YYYY-MM-DD for display (e.g. "03 Sep 2026"). */
export function formatLeaveDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format duration, e.g. "3 days" or "0.5 days" */
export function formatLeaveDays(days: number): string {
  if (days === 0.5) return "½ day";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Validate a date string input: must be YYYY-MM-DD */
export function isValidDateString(s: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) && !isNaN(new Date(s.trim()).getTime())
  );
}

/** Calculate preview duration (client-side estimate, server recalculates authoritatively). */
export function previewDays(
  start: string,
  end: string,
  isHalfDay: boolean,
): number | null {
  if (!isValidDateString(start) || !isValidDateString(end)) return null;
  if (isHalfDay) return 0.5;
  const startMs = new Date(start + "T00:00:00").getTime();
  const endMs = new Date(end + "T00:00:00").getTime();
  if (endMs < startMs) return null;
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

// ============================================================
// EMPLOYEE QUERIES
// ============================================================

export async function fetchLeaveTypes(): Promise<LeaveType[]> {
  const { data, error } = await getSupabase()
    .from("leave_types")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data as LeaveType[]) ?? [];
}

export async function fetchMyLeaveBalances(
  year?: number,
): Promise<LeaveBalance[]> {
  const targetYear = year ?? new Date().getFullYear();
  const { data, error } = await getSupabase()
    .from("leave_balances")
    .select("*, leave_types(id, name, allows_half_day, max_days_per_year)")
    .eq("year", targetYear)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const allocated = Number(r.allocated_days ?? 0);
    const used = Number(r.used_days ?? 0);
    return {
      ...r,
      allocated_days: allocated,
      used_days: used,
      available_days: allocated - used,
    } as LeaveBalance;
  });
}

export async function fetchMyLeaveRequests(
  limit = 30,
): Promise<LeaveRequest[]> {
  const { data, error } = await getSupabase()
    .from("leave_requests")
    .select("*, leave_types(id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as LeaveRequest[]) ?? [];
}

// ============================================================
// SUBMIT / CANCEL (Employee RPCs)
// ============================================================

export async function submitLeaveRequest(params: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  isHalfDay?: boolean;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("submit_leave_request", {
    p_leave_type_id: params.leaveTypeId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_reason: params.reason.trim(),
    p_is_half_day: params.isHalfDay ?? false,
  });
  if (error)
    throw new Error(error.message || "Could not submit leave request.");
  return data as string;
}

export async function cancelLeaveRequest(requestId: string): Promise<void> {
  const { error } = await getSupabase().rpc("cancel_leave_request", {
    p_request_id: requestId,
  });
  if (error)
    throw new Error(error.message || "Could not cancel leave request.");
}

// ============================================================
// HR / MANAGER QUERIES
// ============================================================

export async function fetchHRLeaveRequests(
  statusFilter?: "pending" | "approved" | "rejected" | "cancelled",
  limit = 50,
): Promise<LeaveRequest[]> {
  let query = getSupabase()
    .from("leave_requests")
    .select(
      `
      *,
      leave_types(id, name),
      employees!inner(id, employee_code, first_name, last_name, profiles(display_name))
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as LeaveRequest[]) ?? [];
}

export async function fetchManagerLeaveRequests(
  statusFilter?: "pending" | "approved" | "rejected" | "cancelled",
  limit = 50,
): Promise<LeaveRequest[]> {
  let query = getSupabase()
    .from("leave_requests")
    .select(
      `
      *,
      leave_types(id, name),
      employees!inner(id, employee_code, first_name, last_name, profiles(display_name))
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as LeaveRequest[]) ?? [];
}

// ============================================================
// REVIEW RPC (Manager / HR)
// ============================================================

export async function reviewLeaveRequest(
  requestId: string,
  action: "approve" | "reject",
  notes?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("review_leave_request", {
    p_request_id: requestId,
    p_action: action,
    p_notes: notes?.trim() || null,
  });
  if (error)
    throw new Error(error.message || `Could not ${action} leave request.`);
}
