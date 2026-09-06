import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { AppRole } from "@/types/roles";
import type { Session } from "@supabase/supabase-js";
import type { PropsWithChildren } from "react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
type Identity = {
  displayName: string | null;
  status: "invited" | "active" | "suspended" | "disabled";
  roles: AppRole[];
};
type AuthContextValue = {
  session: Session | null;
  identity: Identity | null;
  isReady: boolean;
  configurationError: boolean;
  isRecoveringPassword: boolean;
  setIsRecoveringPassword: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (
    email: string,
  ) => Promise<{ success: boolean; error?: string }>;
  verifyRecoveryOtp: (
    email: string,
    token: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithRecoverySession: (
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<string | null>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
function isRole(value: string): value is AppRole {
  return ["employee", "manager", "hr", "admin", "talent_viewer"].includes(
    value,
  );
}
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isReady, setIsReady] = useState(!isSupabaseConfigured);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const loadIdentity = useCallback(async (nextSession: Session | null) => {
    if (!nextSession || !isSupabaseConfigured) {
      setIdentity(null);
      return;
    }
    const [profileRes, rolesRes] = await Promise.all([
      getSupabase()
        .from("profiles")
        .select("display_name, account_status")
        .eq("id", nextSession.user.id)
        .maybeSingle(),
      getSupabase()
        .from("user_roles")
        .select("role_key")
        .eq("profile_id", nextSession.user.id),
    ]);

    if (profileRes.error || !profileRes.data) {
      setIdentity(null);
      return;
    }

    const roles = (rolesRes.data ?? [])
      .map((entry: { role_key: string }) => entry.role_key)
      .filter(isRole);

    setIdentity({
      displayName: profileRes.data.display_name,
      status: profileRes.data.account_status as Identity["status"],
      roles,
    });
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadIdentity(data.session);
      setIsReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoveringPassword(true);
        }
        setSession(nextSession);
        void loadIdentity(nextSession);
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, [loadIdentity]);
  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured)
        return "Supabase has not been configured on this device.";
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return error.message;
      if (data.session) {
        await loadIdentity(data.session);
      }
      return null;
    },
    [loadIdentity],
  );
  const signOut = useCallback(async () => {
    setIsRecoveringPassword(false);
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
  }, []);
  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: "Supabase has not been configured on this device.",
      };
    }
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(
        email.trim(),
      );
      if (error) {
        if (
          error.status === 429 ||
          error.message.toLowerCase().includes("rate")
        ) {
          return {
            success: false,
            error:
              "Too many requests. Please wait a moment before trying again.",
          };
        }
        // Generic success to prevent account enumeration
        return { success: true };
      }
      return { success: true };
    } catch {
      return {
        success: false,
        error:
          "Unable to connect to the authentication server. Please check your network.",
      };
    }
  }, []);
  const verifyRecoveryOtp = useCallback(
    async (email: string, token: string) => {
      if (!isSupabaseConfigured) {
        return {
          success: false,
          error: "Supabase has not been configured on this device.",
        };
      }
      try {
        setIsRecoveringPassword(true);
        const { data, error } = await getSupabase().auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: "recovery",
        });

        if (error) {
          setIsRecoveringPassword(false);
          return {
            success: false,
            error: error.message || "Invalid or expired verification code.",
          };
        }

        if (data.session) {
          setSession(data.session);
        }
        return { success: true };
      } catch {
        setIsRecoveringPassword(false);
        return {
          success: false,
          error: "Unable to verify code. Please check your network connection.",
        };
      }
    },
    [],
  );
  const resetPasswordWithRecoverySession = useCallback(
    async (newPassword: string) => {
      if (!isSupabaseConfigured) {
        return {
          success: false,
          error: "Supabase has not been configured on this device.",
        };
      }
      try {
        const { error } = await getSupabase().auth.updateUser({
          password: newPassword,
        });

        if (error) {
          return {
            success: false,
            error:
              error.message || "Could not update password. Please try again.",
          };
        }

        // On successful reset: sign out the recovery session so the user logs in normally
        await getSupabase().auth.signOut();
        setIsRecoveringPassword(false);
        setSession(null);
        setIdentity(null);
        return { success: true };
      } catch {
        return {
          success: false,
          error: "An unexpected error occurred while updating password.",
        };
      }
    },
    [],
  );
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!isSupabaseConfigured) {
        return "Supabase has not been configured on this device.";
      }
      const userEmail = session?.user?.email;
      if (!userEmail) {
        return "No active session found. Please sign in again.";
      }

      // Re-authenticate to verify current password
      const { error: verifyError } = await getSupabase().auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyError) {
        return "Current password is incorrect.";
      }

      // Update password
      const { error: updateError } = await getSupabase().auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return updateError.message || "Could not update password. Please try again.";
      }

      return null;
    },
    [session],
  );
  const value = useMemo(
    () => ({
      session,
      identity,
      isReady,
      configurationError: !isSupabaseConfigured,
      isRecoveringPassword,
      setIsRecoveringPassword,
      signIn,
      signOut,
      requestPasswordReset,
      verifyRecoveryOtp,
      resetPasswordWithRecoverySession,
      changePassword,
    }),
    [
      changePassword,
      identity,
      isReady,
      isRecoveringPassword,
      requestPasswordReset,
      resetPasswordWithRecoverySession,
      session,
      signIn,
      signOut,
      verifyRecoveryOtp,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
