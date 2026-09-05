export interface ManagerDashboardSummary {
  manager_name: string;
  employee_code: string;
  team_name: string | null;
  department_name: string | null;
  direct_reports_count: number;
  attendance: {
    checked_in: number;
    checked_out: number;
    not_clocked_in: number;
  };
  pending_leaves_count: number;
  work: {
    today_total: number;
    in_progress: number;
    completed: number;
    overdue: number;
  };
}

export type TodayAttendanceStatus =
  "checked_in" | "checked_out" | "not_clocked_in";

export interface DirectReportSummary {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string;
  phone: string | null;
  employment_status: string;
  employment_type: string;
  joining_date: string | null;
  designation: string | null;
  team: string | null;
  department: string | null;
  location: string | null;
  today_attendance_status: TodayAttendanceStatus;
  today_check_in_time: string | null;
  today_check_out_time: string | null;
  pending_leaves_count: number;
  active_tasks_count: number;
  completed_tasks_count: number;
}

export interface DirectReportAttendanceItem {
  id: string;
  work_date: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
}

export interface DirectReportLeaveBalance {
  leave_type_name: string;
  allocated_days: number;
  used_days: number;
  available_days: number;
}

export interface DirectReportLeaveRequest {
  id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  requested_days: number;
  is_half_day: boolean;
  reason: string | null;
  status: string;
  created_at: string;
}

export interface DirectReportWorkTask {
  id: string;
  work_date: string;
  title: string;
  priority: string;
  status: string;
  progress_percent: number;
  due_time: string | null;
  created_at: string;
}

export interface DirectReportFullDetails {
  employee: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    work_email: string;
    phone: string | null;
    joining_date: string | null;
    employment_type: string;
    employment_status: string;
    designation: string | null;
    team: string | null;
    department: string | null;
    location: string | null;
  };
  attendance_history: DirectReportAttendanceItem[];
  leave_balances: DirectReportLeaveBalance[];
  leave_requests: DirectReportLeaveRequest[];
  work_assignments: DirectReportWorkTask[];
}
