import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

let client: SupabaseClient | undefined;

/**
 * Returns the authenticated, RLS-protected Supabase client.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Add the public values to .env.local using .env.example.",
    );
  }

  client ??= createClient(url, publishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}
