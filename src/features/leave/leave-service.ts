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

/** Get local today date string YYYY-MM-DD */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert backend date string (YYYY-MM-DD) to UI display date string (DD-MM-YYYY).
 * Safe from timezone shifts (operates on date component parts).
 */
export function toDisplayDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  if (!year || !month || !day) return "";
  return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
}

/**
 * Convert UI display date string (DD-MM-YYYY) to backend date string (YYYY-MM-DD).
 * Safe from timezone shifts (operates on date component parts).
 */
export function toBackendDate(displayStr: string | null): string {
  if (!displayStr) return "";
  const parts = displayStr.trim().split("-");
  if (parts.length !== 3) return "";
  const [day, month, year] = parts;
  if (!year || !month || !day) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Convert JS Date to backend string (YYYY-MM-DD) using local date getters (timezone safe).
 */
export function dateToBackendString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert JS Date to UI display string (DD-MM-YYYY) using local date getters (timezone safe).
 */
export function dateToDisplayString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}-${month}-${year}`;
}

/**
 * Convert backend string (YYYY-MM-DD) to a local JS Date object at noon (12:00:00).
 * Setting noon prevents any daylight saving or timezone boundary day shifts.
 */
export function backendStringToDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  if (
    parts.length === 3 &&
    !isNaN(parts[0]) &&
    !isNaN(parts[1]) &&
    !isNaN(parts[2])
  ) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date();
}

/**
 * Get today's local Date object at start of day.
 */
export function getTodayDateObject(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
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

/** Fetch active employee ID for the authenticated user */
async function getCurrentActiveEmployeeId(): Promise<string | null> {
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user) return null;

  const { data } = await getSupabase()
    .from("employees")
    .select("id")
    .eq("profile_id", user.id)
    .eq("employment_status", "active")
    .maybeSingle();

  return data?.id ?? null;
}

// ============================================================
// EMPLOYEE / PERSONAL LEAVE QUERIES
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
  const employeeId = await getCurrentActiveEmployeeId();
  if (!employeeId) return [];

  const targetYear = year ?? new Date().getFullYear();
  let { data, error } = await getSupabase()
    .from("leave_balances")
    .select("*, leave_types(id, name, allows_half_day, max_days_per_year)")
    .eq("employee_id", employeeId)
    .eq("year", targetYear)
    .order("created_at", { ascending: true });
  if (error) throw error;

  // If no balances are configured yet for the active employee, trigger provisioning and reload
  if (!data || data.length === 0) {
    const { error: rpcErr } = await getSupabase().rpc(
      "provision_my_leave_balances",
      {
        p_year: targetYear,
      },
    );
    if (!rpcErr) {
      const refetched = await getSupabase()
        .from("leave_balances")
        .select("*, leave_types(id, name, allows_half_day, max_days_per_year)")
        .eq("employee_id", employeeId)
        .eq("year", targetYear)
        .order("created_at", { ascending: true });
      if (!refetched.error && refetched.data) {
        data = refetched.data;
      }
    }
  }

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
  const employeeId = await getCurrentActiveEmployeeId();
  if (!employeeId) return [];

  const { data, error } = await getSupabase()
    .from("leave_requests")
    .select("*, leave_types(id, name)")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as LeaveRequest[]) ?? [];
}

// ============================================================
// SUBMIT / CANCEL (Personal Leave RPCs)
// ============================================================

export async function submitLeaveRequest(params: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  isHalfDay?: boolean;
}): Promise<string> {
  const today = getTodayDateString();
  if (params.startDate < today) {
    throw new Error("Leave requests cannot be submitted for past dates.");
  }
  if (params.endDate < params.startDate) {
    throw new Error("End date cannot be before start date.");
  }

  const trimmedReason = params.reason.trim();
  if (!trimmedReason) {
    throw new Error("Please enter a reason for your leave.");
  }
  if (trimmedReason.length < 5) {
    throw new Error("Reason must be at least 5 characters.");
  }
  if (trimmedReason.length > 1000) {
    throw new Error("Reason cannot exceed 1000 characters.");
  }

  const { data, error } = await getSupabase().rpc("submit_leave_request", {
    p_leave_type_id: params.leaveTypeId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_reason: trimmedReason,
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

export async function fetchAdminHRLeaveRequests(
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
// REVIEW RPC (Manager / HR / Admin)
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
