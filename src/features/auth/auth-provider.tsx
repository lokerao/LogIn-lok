import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AppRole } from '@/types/roles';
type Identity = { displayName: string | null; status: 'invited' | 'active' | 'suspended' | 'disabled'; roles: AppRole[] };
type AuthContextValue = { session: Session | null; identity: Identity | null; isReady: boolean; configurationError: boolean; signIn: (email: string, password: string) => Promise<string | null>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
function isRole(value: string): value is AppRole { return ['employee', 'manager', 'hr', 'admin', 'recruiter'].includes(value); }
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null); const [identity, setIdentity] = useState<Identity | null>(null); const [isReady, setIsReady] = useState(!isSupabaseConfigured);
  const loadIdentity = useCallback(async (nextSession: Session | null) => {
    if (!nextSession || !isSupabaseConfigured) { setIdentity(null); return; }
    const { data, error } = await getSupabase().from('profiles').select('display_name, account_status, user_roles(role_key)').eq('id', nextSession.user.id).maybeSingle();
    if (error || !data) { setIdentity(null); return; }
    const roles = (data.user_roles ?? []).map((entry: { role_key: string }) => entry.role_key).filter(isRole);
    setIdentity({ displayName: data.display_name, status: data.account_status as Identity['status'], roles });
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    void supabase.auth.getSession().then(async ({ data }) => { setSession(data.session); await loadIdentity(data.session); setIsReady(true); });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); void loadIdentity(nextSession); });
    return () => subscription.subscription.unsubscribe();
  }, [loadIdentity]);
  const signIn = useCallback(async (email: string, password: string) => { if (!isSupabaseConfigured) return 'Supabase has not been configured on this device.'; const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password }); return error?.message ?? null; }, []);
  const signOut = useCallback(async () => { if (isSupabaseConfigured) await getSupabase().auth.signOut(); }, []);
  const value = useMemo(() => ({ session, identity, isReady, configurationError: !isSupabaseConfigured, signIn, signOut }), [identity, isReady, session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider.'); return value; }
