import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less client using the publishable key. For public reads/inserts
 * that RLS already allows (waitlist signup, Founding counter).
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
