import type { PropsWithChildren } from "react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { getSupabase } from "@/lib/supabase";

export type EmployeeDetails = {
  displayName: string | null;
  avatarPath: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string | null;
  department: string | null;
  team: string | null;
  designation: string | null;
  location: string | null;
  joiningDate: string | null;
  employmentType: string;
  employmentStatus: string;
};
type EmployeeContextValue = {
  employee: EmployeeDetails | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<string | null>;
};
const EmployeeContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!session) {
      setEmployee(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: requestError } = await getSupabase()
      .from("employees")
      .select(
        "employee_code, first_name, last_name, work_email, phone, joining_date, employment_type, employment_status, profiles!inner(display_name, avatar_path), departments(name), teams(name), designations(name), locations(name)",
      )
      .eq("profile_id", session.user.id)
      .maybeSingle();
    if (requestError) {
      setEmployee(null);
      setError("Your employee profile could not be loaded. Please try again.");
    } else if (!data) {
      setEmployee(null);
      setError(
        "Your employee record is not ready yet. Please contact your administrator.",
      );
    } else {
      const profile = data.profiles as unknown as {
        display_name: string | null;
        avatar_path: string | null;
      };
      const named = (value: unknown) =>
        (value as { name?: string } | null)?.name ?? null;
      const canonicalName = `${data.first_name} ${data.last_name}`.trim();
      setEmployee({
        displayName: profile.display_name || canonicalName,
        avatarPath: profile.avatar_path,
        employeeCode: data.employee_code,
        firstName: data.first_name,
        lastName: data.last_name,
        workEmail: data.work_email,
        phone: data.phone,
        joiningDate: data.joining_date,
        employmentType: data.employment_type,
        employmentStatus: data.employment_status,
        department: named(data.departments),
        team: named(data.teams),
        designation: named(data.designations),
        location: named(data.locations),
      });
    }
    setIsLoading(false);
  }, [session]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!session) return "Your session has expired. Please sign in again.";
      const value = name.trim();
      if (!value || value.length > 100)
        return "Enter a name between 1 and 100 characters.";
      const { error: requestError } = await getSupabase()
        .from("profiles")
        .update({ display_name: value })
        .eq("id", session.user.id);
      if (requestError)
        return "Your profile could not be saved. Please try again.";
      await refresh();
      return null;
    },
    [refresh, session],
  );
  const value = useMemo(
    () => ({ employee, isLoading, error, refresh, updateDisplayName }),
    [employee, error, isLoading, refresh, updateDisplayName],
  );
  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
}
export function useEmployee() {
  const value = useContext(EmployeeContext);
  if (!value)
    throw new Error("useEmployee must be used within EmployeeProvider.");
  return value;
}
