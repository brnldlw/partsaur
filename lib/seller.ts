import { FREE_LISTING_LIMIT } from "@/lib/categories";
import { PAID_PLANS } from "@/lib/listings";
import type { Business, Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export function isPaid(business: Business | null) {
  return Boolean(business && PAID_PLANS.has(business.plan));
}

/** Active listing count + whether the seller can add another. */
export async function getListingAllowance(profile: Profile, business: Business | null) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", profile.id)
    .eq("status", "active");
  const active = count ?? 0;
  const unlimited = isPaid(business);
  return { active, unlimited, limit: FREE_LISTING_LIMIT, canAdd: unlimited || active < FREE_LISTING_LIMIT };
}

export function contactNote(profile: Profile) {
  return profile.show_phone && profile.phone
    ? "Signed-in buyers will see your email and phone number so they can reach you. Change this on your Account page."
    : "Signed-in buyers will see your email so they can reach you. You can also show your phone number — turn it on in your Account page.";
}
