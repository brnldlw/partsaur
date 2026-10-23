"use server";

import { updateTag } from "next/cache";
import { listingTag } from "@/lib/listings";
import { getAccount } from "@/lib/profile";
import { REPORT_REASONS } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";


export type ReportState = { ok: boolean; error?: string };

export async function reportListing(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const { user, profile } = await getAccount();
  if (!user || !profile) return { ok: false, error: "Sign in to report a listing." };

  const listingId = String(formData.get("listing_id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!REPORT_REASONS.some((r) => r.value === reason)) return { ok: false, error: "Pick a reason." };
  if (note.length > 1000) return { ok: false, error: "Note is too long." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: user.id, listing_id: listingId, reason, note: note || null });
  if (error) {
    if (error.code === "23505") return { ok: true }; // already reported
    if (error.message.includes("OWN_LISTING")) return { ok: false, error: "That's your own listing." };
    console.error("report insert failed:", error.message);
    return { ok: false, error: "Couldn't send the report. Try again." };
  }
  // A 3rd report auto-hides the listing; drop the cached page.
  updateTag(listingTag(listingId));
  return { ok: true };
}
