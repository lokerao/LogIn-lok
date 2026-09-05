/** Roles are descriptive client types only; Supabase RLS remains the source of authorization. */
export type AppRole = "employee" | "manager" | "hr" | "admin" | "talent_viewer";

export const attendanceEligibleRoles: readonly AppRole[] = [
  "employee",
  "manager",
  "hr",
];

/** Leave management is available to employees, managers, and HR (not admin, not talent_viewer). */
export const leaveEligibleRoles: readonly AppRole[] = [
  "employee",
  "manager",
  "hr",
];

/** Daily work assignments are available to employees, managers, and HR (not admin, not talent_viewer). */
export const workEligibleRoles: readonly AppRole[] = [
  "employee",
  "manager",
  "hr",
];

/** Manager module is available strictly to managers (not admin, not talent_viewer). */
export const managerEligibleRoles: readonly AppRole[] = ["manager"];

/** HR operational module is available strictly to HR (not admin, not talent_viewer). */
export const hrEligibleRoles: readonly AppRole[] = ["hr"];

/** Admin management module is available strictly to system administrators (not HR, not manager, not employee, not talent_viewer). */
export const adminEligibleRoles: readonly AppRole[] = ["admin"];

/** Talent Network / Talent Viewer module is available strictly to external talent viewers ('talent_viewer'). */
export const talentViewerEligibleRoles: readonly AppRole[] = ["talent_viewer"];

/** Helper to identify if user holds the explicit Talent Viewer role */
export function isTalentViewer(roles?: readonly AppRole[] | null): boolean {
  return Boolean(roles?.some((r) => r === "talent_viewer"));
}
