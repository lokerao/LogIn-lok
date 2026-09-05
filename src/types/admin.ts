import type { AppRole } from "./roles";

export interface AdminRoleBreakdown {
  admin: number;
  hr: number;
  manager: number;
  employee: number;
  recruiter: number;
}

export interface AdminDashboardSummary {
  organization_id: string;
  organization_name: string;
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  terminated_employees: number;
  total_departments: number;
  total_teams: number;
  total_designations: number;
  total_locations: number;
  total_users: number;
  roles_breakdown: AdminRoleBreakdown;
}

export interface AdminEmployeeListItem {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string;
  phone: string | null;
  employment_status: "active" | "inactive" | "terminated";
  employment_type: "full_time" | "part_time" | "contract" | "intern";
  joining_date: string | null;
  profile_id: string;
  display_name: string | null;
  account_status: "invited" | "active" | "suspended" | "disabled";
  department_id: string | null;
  department_name: string | null;
  designation_id: string | null;
  designation_name: string | null;
  team_id: string | null;
  team_name: string | null;
  location_id: string | null;
  location_name: string | null;
  location_city: string | null;
  manager_employee_id: string | null;
  manager_name: string | null;
  manager_code: string | null;
  roles: AppRole[];
}

export interface AdminEmployeeDetails extends AdminEmployeeListItem {
  created_at: string;
  updated_at: string;
  location_country: string | null;
  direct_reports_count: number;
}

export interface UpdateEmployeeOrgPayload {
  department_id: string | null;
  designation_id: string | null;
  team_id: string | null;
  location_id: string | null;
  manager_employee_id: string | null;
}

export interface AdminDepartment {
  id: string;
  name: string;
  employee_count: number;
  team_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminDesignation {
  id: string;
  name: string;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminTeam {
  id: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
  employee_count: number;
  manager: {
    id: string;
    employee_code: string;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLocation {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRoleItem {
  profile_id: string;
  display_name: string | null;
  account_status: "invited" | "active" | "suspended" | "disabled";
  employee_id: string | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  work_email: string | null;
  designation: string | null;
  department: string | null;
  roles: AppRole[];
}

export interface AdminOrgMember {
  id: string;
  employee_code: string;
  name: string;
  designation: string | null;
  status: string;
}

export interface AdminOrgTeamStructure {
  id: string;
  name: string;
  member_count: number;
  manager: {
    id: string;
    employee_code: string;
    name: string;
  } | null;
  members: AdminOrgMember[];
}

export interface AdminOrgDepartmentStructure {
  id: string;
  name: string;
  employee_count: number;
  teams: AdminOrgTeamStructure[];
}

export interface AdminEmployeeFilter {
  search?: string;
  department_id?: string;
  designation_id?: string;
  team_id?: string;
  location_id?: string;
  employment_status?: "all" | "active" | "inactive" | "terminated";
  role_key?: "all" | AppRole;
}
