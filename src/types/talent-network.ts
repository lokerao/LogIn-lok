/**
 * Types for Phase 11: Cross-Organization Talent Viewer & Talent Network
 */

export type TalentAccessStatus =
  "not_requested" | "pending" | "approved" | "rejected" | "suspended";

export type TalentNetworkOrganization = {
  id: string;
  name: string;
  access_status: TalentAccessStatus;
  requested_at: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  approved_talent_count: number;
};

export type TalentNetworkSkill = {
  id?: string;
  name: string;
  category?: string | null;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
};

export type TalentNetworkProfileListItem = {
  talent_id: string;
  organization_id: string;
  organization_name: string;
  professional_name: string | null;
  professional_title: string | null;
  summary: string | null;
  skills: TalentNetworkSkill[];
  experience_count: number;
  certifications_count: number;
  projects_count: number;
};

export type TalentNetworkExperience = {
  id: string;
  company: string;
  job_title: string;
  employment_type: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
};

export type TalentNetworkEducation = {
  id: string;
  institution: string;
  qualification: string;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export type TalentNetworkCertification = {
  id: string;
  name: string;
  issuer: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  verification_url: string | null;
};

export type TalentNetworkProject = {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  technologies: string[];
  start_date: string | null;
  end_date: string | null;
  project_url: string | null;
};

export type TalentNetworkAchievement = {
  id: string;
  title: string;
  description: string | null;
  achieved_on: string | null;
  issuer: string | null;
};

export type TalentNetworkProfileDetails = {
  talent_id: string;
  organization_id: string;
  organization_name: string;
  professional_name: string | null;
  professional_title: string | null;
  summary: string | null;
  has_resume: boolean;
  skills: TalentNetworkSkill[];
  experiences: TalentNetworkExperience[];
  education: TalentNetworkEducation[];
  certifications: TalentNetworkCertification[];
  projects: TalentNetworkProject[];
  achievements: TalentNetworkAchievement[];
};

export type TalentViewerAccessRequestItem = {
  id: string;
  organization_id: string;
  organization_name: string;
  status: TalentAccessStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
};

export type OrganizationIncomingAccessRequest = {
  id: string;
  viewer_profile_id: string;
  viewer_name: string;
  viewer_avatar: string | null;
  status: TalentAccessStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  reviewed_by_name: string | null;
};

export type TalentSearchFilter = {
  organization_id?: string | null;
  search?: string | null;
  skill?: string | null;
  limit?: number;
  offset?: number;
};

export type OrganizationTalentAuditLogItem = {
  id: string;
  action_type:
    "REQUEST_ORGANIZATION_ACCESS" | "SEARCH_TALENT" | "VIEW_TALENT_PROFILE";
  viewer_name: string;
  viewer_profile_id: string;
  talent_profile_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
