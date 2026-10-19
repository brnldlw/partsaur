"use server";

import { isFoundingPlan } from "@/lib/founding";
import { ROLES, TRADES } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export type WaitlistState = { ok: boolean; error?: string };

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const trade = String(formData.get("trade") ?? "hvacr");
  const role = String(formData.get("role") ?? "");
  const zip = String(formData.get("zip") ?? "").trim();
  const plan = formData.get("plan_interest");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!TRADES.some((t) => t.value === trade)) {
    return { ok: false, error: "Pick a trade." };
  }
  if (!ROLES.some((r) => r.value === role)) {
    return { ok: false, error: "Pick what best describes you." };
  }
  if (zip && !/^\d{5}$/.test(zip)) {
    return { ok: false, error: "Zip code should be 5 digits." };
  }

  const { error } = await createPublicClient()
    .from("waitlist")
    .insert({
      email,
      trade,
      role,
      zip: zip || null,
      plan_interest: isFoundingPlan(plan) ? plan : null,
    });

  // 23505 = already signed up with this email; treat as success.
  if (error && error.code !== "23505") {
    console.error("waitlist insert failed:", error.message);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}
