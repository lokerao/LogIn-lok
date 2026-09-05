export type PermanentEmploymentStatus = "active" | "inactive" | "terminated";
export type DailyAttendanceStatus =
  | "checked_in"
  | "checked_out"
  | "not_checked_in";
export type DailyLeaveStatus = "on_leave" | "none";

export type CurrentWorkforceStatus =
  | "active"
  | "on_leave"
  | "inactive"
  | "terminated";

export type EmploymentStatus =
  | "active"
  | "on_leave"
  | "inactive"
  | "terminated";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type TodayShiftStatus = DailyAttendanceStatus | "not_clocked_in";

export interface HRWorkSummary {
  today_total: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

export interface HRDashboardSummary {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  terminated_employees?: number;
  on_leave_employees: number;
  departments_count: number;
  teams_count: number;
  pending_leaves_count: number;
  pending_attendance_count: number;
  pending_talent_reviews_count: number;
  working_today_count: number;
  today_checked_in_count?: number;
  today_checked_out_count?: number;
  today_not_checked_in_count?: number;
  work_summary: HRWorkSummary;
}

export interface HREmployeeListItem {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string;
  phone: string | null;
  employment_status: PermanentEmploymentStatus | EmploymentStatus;
  current_workforce_status?: CurrentWorkforceStatus;
  today_attendance_status: TodayShiftStatus;
  today_leave_status?: DailyLeaveStatus;
  has_approved_leave_today?: boolean;
  working_on_leave?: boolean;
  employment_type: EmploymentType;
  joining_date: string | null;
  department_id: string | null;
  department_name: string | null;
  team_id: string | null;
  team_name: string | null;
  designation_id: string | null;
  designation_name: string | null;
  manager_employee_id: string | null;
  manager_name: string | null;
  manager_code: string | null;
  location_id: string | null;
  location_name: string | null;
  today_check_in_time: string | null;
  today_check_out_time: string | null;
  pending_leaves_count: number;
  active_tasks_count: number;
  talent_review_status: "pending" | "approved" | "rejected" | null;
}

export type HRDirectoryFilterStatus =
  | "all"
  | "active"
  | "inactive"
  | "terminated"
  | "checked_in"
  | "checked_out"
  | "not_checked_in"
  | "on_leave";

export interface HREmployeeDirectoryFilter {
  search?: string;
  status?: HRDirectoryFilterStatus | CurrentWorkforceStatus;
  department_id?: string;
  departmentId?: string;
}

export interface HRAttendanceHistoryItem {
  id: string;
  attendance_date: string;
  check_in_at: string;
  check_out_at: string | null;
  check_in_verification_status: "pending" | "approved" | "rejected";
  check_out_verification_status: "pending" | "approved" | "rejected" | null;
  check_in_photo_path: string;
  check_out_photo_path: string | null;
  leave_reconciled?: boolean;
}

export interface HRLeaveBalanceItem {
  leave_type_name: string;
  allocated_days: number;
  used_days: number;
  available_days: number;
}

export interface HRLeaveRequestItem {
  id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  requested_days: number;
  is_half_day: boolean;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string | null;
  reviewer_notes: string | null;
  review_notes?: string | null;
  created_at: string;
}

export interface HRWorkAssignmentItem {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "assigned" | "in_progress" | "blocked" | "completed" | "cancelled";
  progress_percent: number;
  work_date: string;
  due_time: string | null;
  created_at: string;
}

export interface HRSkillItem {
  id: string;
  skill_id?: string;
  name: string;
  category: string | null;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
}

export interface HRExperienceItem {
  id: string;
  company: string;
  job_title: string;
  employment_type: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
}

export interface HREducationItem {
  id: string;
  institution: string;
  qualification: string;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
}

export interface HRCertificationItem {
  id: string;
  name: string;
  issuer: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  verification_url: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
}

export interface HRProjectItem {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  technologies: string[];
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  project_url: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
}

export interface HRAchievementItem {
  id: string;
  title: string;
  description: string | null;
  achieved_on: string | null;
  issuer: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
}

export interface HRTalentProfileSummary {
  talent_id: string;
  professional_name: string | null;
  professional_title: string | null;
  summary: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes: string | null;
  skills_count: number;
  experiences_count: number;
  projects_count: number;
  certifications_count: number;
  education_count: number;
  achievements_count: number;
  skills?: HRSkillItem[];
  experiences?: HRExperienceItem[];
  education?: HREducationItem[];
  certifications?: HRCertificationItem[];
  projects?: HRProjectItem[];
  achievements?: HRAchievementItem[];
}

export interface HREmployeeFullDetails {
  employee: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    work_email: string;
    phone: string | null;
    employment_status: PermanentEmploymentStatus | EmploymentStatus;
    current_workforce_status?: CurrentWorkforceStatus;
    today_attendance_status?: DailyAttendanceStatus;
    today_leave_status?: DailyLeaveStatus;
    today_check_in_time?: string | null;
    today_check_out_time?: string | null;
    has_approved_leave_today?: boolean;
    working_on_leave?: boolean;
    employment_type: EmploymentType;
    joining_date: string | null;
    designation: string | null;
    team: string | null;
    department: string | null;
    location: string | null;
    manager_name: string | null;
    manager_code: string | null;
  };
  attendance_history: HRAttendanceHistoryItem[];
  leave_balances: HRLeaveBalanceItem[];
  leave_requests: HRLeaveRequestItem[];
  work_assignments: HRWorkAssignmentItem[];
  talent_profile: HRTalentProfileSummary | null;
}

export interface HRTeamMember {
  id: string;
  employee_code: string;
  name: string;
  designation: string | null;
  status: EmploymentStatus;
}

export interface HRTeamStructure {
  id: string;
  name: string;
  member_count: number;
  manager: {
    id: string;
    employee_code: string;
    name: string;
  } | null;
  members: HRTeamMember[];
}

export interface HRDepartmentStructure {
  id: string;
  name: string;
  employee_count: number;
  teams: HRTeamStructure[];
}

export interface HRPendingTalentReview {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string | null;
  department: string | null;
  talent_id: string;
  professional_name: string | null;
  professional_title: string | null;
  summary: string | null;
  review_status: "pending" | "approved" | "rejected";
  submitted_at: string;
  pending_skills_count: number;
  pending_experiences_count: number;
  pending_education_count: number;
  pending_certifications_count: number;
  pending_projects_count: number;
  pending_achievements_count: number;
  skills?: HRSkillItem[];
  experiences?: HRExperienceItem[];
  education?: HREducationItem[];
  certifications?: HRCertificationItem[];
  projects?: HRProjectItem[];
  achievements?: HRAchievementItem[];
}
