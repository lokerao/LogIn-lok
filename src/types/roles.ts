/** Roles are descriptive client types only; Supabase RLS remains the source of authorization. */
export type AppRole = 'employee' | 'manager' | 'hr' | 'admin' | 'recruiter';

export const attendanceEligibleRoles: readonly AppRole[] = ['employee', 'manager', 'hr'];
