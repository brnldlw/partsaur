import { cacheLife } from "next/cache";

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = "/account") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/**
 * Whether Google sign-in is switched on in Supabase (Authentication →
 * Providers). Checked live so the button appears with no code change.
 */
export async function isGoogleEnabled() {
  "use cache";
  cacheLife("minutes");
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return Boolean(settings.external?.google);
  } catch {
    return false;
  }
}
