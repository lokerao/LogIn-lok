export type WorkAssignmentPriority = "low" | "medium" | "high" | "urgent";

export type WorkAssignmentStatus =
  "assigned" | "in_progress" | "blocked" | "completed" | "cancelled";

export interface WorkAssignment {
  id: string;
  organization_id: string;
  employee_id: string;
  assigned_by: string;
  work_date: string; // YYYY-MM-DD
  title: string;
  description: string | null;
  expected_outcome: string | null;
  priority: WorkAssignmentPriority;
  due_time: string | null; // HH:MM:SS or HH:MM
  status: WorkAssignmentStatus;
  progress_percent: number; // 0-100
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields for display
  assigned_by_name?: string | null;
  employee_name?: string | null;
  employee_code?: string | null;
  designation?: string | null;
}

export interface WorkAssignmentUpdate {
  id: string;
  assignment_id: string;
  employee_id: string;
  organization_id: string;
  update_text: string;
  progress_percent: number;
  status_at_update: WorkAssignmentStatus;
  created_at: string;
}

export interface CreateWorkAssignmentParams {
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  title: string;
  description?: string;
  priority: WorkAssignmentPriority;
  expectedOutcome?: string;
  dueTime?: string; // HH:MM
}

export interface UpdateWorkProgressParams {
  assignmentId: string;
  status: "in_progress" | "blocked" | "completed";
  progressPercent: number; // 0-100
  updateText: string;
}

export interface ManageWorkAssignmentParams {
  assignmentId: string;
  action: "cancel" | "reopen";
  notes?: string;
}

export interface DirectReport {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string | null;
  department: string | null;
}

export type WorkSegment = "today" | "upcoming" | "history";
