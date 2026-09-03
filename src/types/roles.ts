/** Roles are descriptive client types only; Supabase RLS remains the source of authorization. */
export type AppRole = "employee" | "manager" | "hr" | "admin" | "recruiter";

export const attendanceEligibleRoles: readonly AppRole[] = [
  "employee",
  "manager",
  "hr",
];

/** Leave management is available to employees, managers, and HR (not admin, not recruiter). */
export const leaveEligibleRoles: readonly AppRole[] = [
  "employee",
  "manager",
  "hr",
];

/** Daily work assignments are available to employees, managers, and HR (not admin, not recruiter). */
export const workEligibleRoles: readonly AppRole[] = [
  "employee",
  "manager",
  "hr",
];

/** Manager module is available strictly to managers (not admin, not recruiter). */
export const managerEligibleRoles: readonly AppRole[] = ["manager"];
