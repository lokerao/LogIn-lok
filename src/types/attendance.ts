export type AttendanceVerificationStatus = "pending" | "approved" | "rejected";

export type AttendanceRecord = {
  id: string;
  employee_id: string;
  organization_id: string;
  attendance_date: string;
  check_in_at: string;
  check_in_photo_path: string;
  check_in_verification_status: AttendanceVerificationStatus;
  check_in_reviewed_by?: string | null;
  check_in_reviewed_at?: string | null;
  check_in_review_notes?: string | null;
  check_out_at?: string | null;
  check_out_photo_path?: string | null;
  check_out_verification_status?: AttendanceVerificationStatus | null;
  check_out_reviewed_by?: string | null;
  check_out_reviewed_at?: string | null;
  check_out_review_notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined employee details (for HR/Manager views)
  employees?: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    profiles?: {
      display_name: string | null;
    } | null;
  } | null;
};

export type AttendanceMode = "check_in" | "check_out";
