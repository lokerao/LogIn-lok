import { getSupabase } from "@/lib/supabase";
import type {
    CreateWorkAssignmentParams,
    DirectReport,
    ManageWorkAssignmentParams,
    UpdateWorkProgressParams,
    WorkAssignment,
    WorkAssignmentStatus,
    WorkAssignmentUpdate,
    WorkSegment,
} from "@/types/work";

/** Get local today date string YYYY-MM-DD */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Format a date string YYYY-MM-DD for display (e.g. "03 Sep 2026") */
export function formatWorkDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format time string HH:MM:SS or HH:MM to 12-hour format (e.g. "5:30 PM") */
export function formatDueTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, "0");
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/** Determines whether an assignment is overdue based on date, due time, and status */
export function isAssignmentOverdue(
  assignment: Pick<WorkAssignment, "work_date" | "due_time" | "status">,
): boolean {
  if (assignment.status === "completed" || assignment.status === "cancelled") {
    return false;
  }
  const today = getTodayDateString();
  if (assignment.work_date < today) {
    return true;
  }
  if (assignment.work_date === today && assignment.due_time) {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const [dueH, dueM] = assignment.due_time.split(":").map(Number);
    if (!isNaN(dueH) && !isNaN(dueM)) {
      if (
        dueH < currentHours ||
        (dueH === currentHours && dueM < currentMinutes)
      ) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================
// EMPLOYEE QUERIES
// ============================================================

export async function fetchMyAssignments(
  segment: WorkSegment = "today",
): Promise<WorkAssignment[]> {
  const today = getTodayDateString();
  let query = getSupabase().from("work_assignments").select(`
      *,
      assigned_by_profile:profiles!assigned_by (display_name)
    `);

  if (segment === "today") {
    query = query
      .eq("work_date", today)
      .order("created_at", { ascending: false });
  } else if (segment === "upcoming") {
    query = query
      .gt("work_date", today)
      .not("status", "in", '("completed","cancelled")')
      .order("work_date", { ascending: true });
  } else {
    // history: past dates or completed/cancelled
    query = query
      .or(`work_date.lt.${today},status.in.("completed","cancelled")`)
      .order("work_date", { ascending: false })
      .limit(50);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    assigned_by_name: row.assigned_by_profile?.display_name ?? null,
  }));
}

export async function fetchAssignmentDetails(
  assignmentId: string,
): Promise<{ assignment: WorkAssignment; updates: WorkAssignmentUpdate[] }> {
  const { data: assignmentData, error: assignmentError } = await getSupabase()
    .from("work_assignments")
    .select(
      `
      *,
      assigned_by_profile:profiles!assigned_by (display_name),
      employee:employees!employee_id (id, employee_code, first_name, last_name, designation:designations(name))
    `,
    )
    .eq("id", assignmentId)
    .single();

  if (assignmentError) throw assignmentError;

  const { data: updatesData, error: updatesError } = await getSupabase()
    .from("work_assignment_updates")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });

  if (updatesError) throw updatesError;

  const emp = assignmentData.employee;
  const empName = emp ? `${emp.first_name} ${emp.last_name}`.trim() : null;

  const assignment: WorkAssignment = {
    ...assignmentData,
    assigned_by_name: assignmentData.assigned_by_profile?.display_name ?? null,
    employee_name: empName,
    employee_code: emp?.employee_code ?? null,
    designation: emp?.designation?.name ?? null,
  };

  return {
    assignment,
    updates: (updatesData as WorkAssignmentUpdate[]) ?? [],
  };
}

export async function submitWorkProgress(
  params: UpdateWorkProgressParams,
): Promise<void> {
  const { error } = await getSupabase().rpc("update_work_progress", {
    p_assignment_id: params.assignmentId,
    p_status: params.status,
    p_progress_percent: params.progressPercent,
    p_update_text: params.updateText.trim(),
  });

  if (error) throw error;
}

// ============================================================
// MANAGER QUERIES
// ============================================================

export async function fetchDirectReports(): Promise<DirectReport[]> {
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Find manager employee record
  const { data: managerEmp, error: managerError } = await getSupabase()
    .from("employees")
    .select("id, organization_id")
    .eq("profile_id", user.id)
    .eq("employment_status", "active")
    .single();

  if (managerError || !managerEmp) {
    return [];
  }

  // Fetch active direct reports
  const { data: reports, error: reportsError } = await getSupabase()
    .from("employees")
    .select(
      "id, employee_code, first_name, last_name, designation:designations(name), department:departments(name)",
    )
    .eq("manager_employee_id", managerEmp.id)
    .eq("organization_id", managerEmp.organization_id)
    .eq("employment_status", "active")
    .order("first_name");

  if (reportsError) throw reportsError;
  return (
    (reports ?? []).map((r: any) => ({
      id: r.id,
      employee_code: r.employee_code,
      first_name: r.first_name,
      last_name: r.last_name,
      designation: r.designation?.name ?? null,
      department: r.department?.name ?? null,
    })) ?? []
  );
}

export async function fetchTeamAssignments(filter?: {
  employeeId?: string;
  status?: WorkAssignmentStatus;
  onlyOverdue?: boolean;
}): Promise<WorkAssignment[]> {
  let query = getSupabase()
    .from("work_assignments")
    .select(
      `
      *,
      assigned_by_profile:profiles!assigned_by (display_name),
      employee:employees!employee_id (id, employee_code, first_name, last_name, designation:designations(name))
    `,
    )
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter?.employeeId) {
    query = query.eq("employee_id", filter.employeeId);
  }
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  let assignments: WorkAssignment[] = (data ?? []).map((row: any) => {
    const emp = row.employee;
    const empName = emp ? `${emp.first_name} ${emp.last_name}`.trim() : null;
    return {
      ...row,
      assigned_by_name: row.assigned_by_profile?.display_name ?? null,
      employee_name: empName,
      employee_code: emp?.employee_code ?? null,
      designation: emp?.designation?.name ?? null,
    };
  });

  if (filter?.onlyOverdue) {
    assignments = assignments.filter((a) => isAssignmentOverdue(a));
  }

  return assignments;
}

export async function createWorkAssignment(
  params: CreateWorkAssignmentParams,
): Promise<string> {
  const { data, error } = await getSupabase().rpc("create_work_assignment", {
    p_employee_id: params.employeeId,
    p_work_date: params.workDate,
    p_title: params.title.trim(),
    p_description: params.description?.trim() || null,
    p_priority: params.priority,
    p_expected_outcome: params.expectedOutcome?.trim() || null,
    p_due_time: params.dueTime || null,
  });

  if (error) throw error;
  return data as string;
}

export async function managerManageWorkAssignment(
  params: ManageWorkAssignmentParams,
): Promise<void> {
  const { error } = await getSupabase().rpc("manager_manage_work_assignment", {
    p_assignment_id: params.assignmentId,
    p_action: params.action,
    p_notes: params.notes?.trim() || null,
  });

  if (error) throw error;
}

// ============================================================
// HR QUERIES
// ============================================================

export async function fetchHROrganizationWork(filter?: {
  status?: WorkAssignmentStatus;
  onlyOverdue?: boolean;
}): Promise<WorkAssignment[]> {
  let query = getSupabase()
    .from("work_assignments")
    .select(
      `
      *,
      assigned_by_profile:profiles!assigned_by (display_name),
      employee:employees!employee_id (id, employee_code, first_name, last_name, designation:designations(name))
    `,
    )
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  let assignments: WorkAssignment[] = (data ?? []).map((row: any) => {
    const emp = row.employee;
    const empName = emp ? `${emp.first_name} ${emp.last_name}`.trim() : null;
    return {
      ...row,
      assigned_by_name: row.assigned_by_profile?.display_name ?? null,
      employee_name: empName,
      employee_code: emp?.employee_code ?? null,
      designation: emp?.designation?.name ?? null,
    };
  });

  if (filter?.onlyOverdue) {
    assignments = assignments.filter((a) => isAssignmentOverdue(a));
  }

  return assignments;
}
