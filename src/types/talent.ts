export type TalentVisibility = "private" | "organization" | "recruiters";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type ProficiencyLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type TalentProfile = {
  employee_id: string;
  talent_id: string;
  professional_name: string | null;
  professional_title: string | null;
  summary: string | null;
  visibility: TalentVisibility;
  review_status: ReviewStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeSkill = {
  id: string;
  employee_id: string;
  skill_id: string;
  proficiency: ProficiencyLevel;
  review_status: ReviewStatus;
  reviewer_notes?: string | null;
  skill_name: string;
  skill_category: string | null;
};

export type Experience = {
  id: string;
  employee_id: string;
  company: string;
  job_title: string;
  employment_type: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  review_status: ReviewStatus;
};

export type Education = {
  id: string;
  employee_id: string;
  institution: string;
  qualification: string;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  review_status: ReviewStatus;
};

export type Certification = {
  id: string;
  employee_id: string;
  name: string;
  issuer: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  verification_url: string | null;
  review_status: ReviewStatus;
};

export type Project = {
  id: string;
  employee_id: string;
  name: string;
  role: string | null;
  description: string | null;
  technologies: string[];
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  project_url: string | null;
  visibility: TalentVisibility;
  review_status: ReviewStatus;
};

export type Achievement = {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  achieved_on: string | null;
  issuer: string | null;
  review_status: ReviewStatus;
};

export type Resume = {
  id: string;
  employee_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
};
