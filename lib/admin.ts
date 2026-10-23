import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Who can open /admin. Add an email here to give someone access. */
export const ADMIN_EMAILS = ["brian@stockedtruck.com"];

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}

/** For admin pages and actions: returns the admin user, or 404s for everyone else. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  return user;
}
