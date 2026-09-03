export type LeaveRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type LeaveType = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  max_days_per_year: number;
  allows_half_day: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LeaveBalance = {
  id: string;
  employee_id: string;
  organization_id: string;
  leave_type_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  /** Derived client-side: allocated_days - used_days */
  available_days: number;
  // joined
  leave_types?: Pick<
    LeaveType,
    "id" | "name" | "allows_half_day" | "max_days_per_year"
  > | null;
};

export type LeaveRequest = {
  id: string;
  employee_id: string;
  organization_id: string;
  leave_type_id: string;
  start_date: string; // ISO date string YYYY-MM-DD
  end_date: string; // ISO date string YYYY-MM-DD
  is_half_day: boolean;
  requested_days: number;
  reason: string;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  leave_types?: Pick<LeaveType, "id" | "name"> | null;
  employees?: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    profiles?: { display_name: string | null } | null;
  } | null;
};
