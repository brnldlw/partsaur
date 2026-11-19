import { cacheLife, cacheTag } from "next/cache";
import { FOUNDING_SELLER_CAP } from "@/lib/launch";
import { createPublicClient } from "@/lib/supabase/public";

export const FOUNDING_SELLER_TAG = "founding-seller-badges";

/** Live count of Founding Seller badges still available. null if the DB isn't set up yet. */
export async function getFoundingSellerBadgesLeft(): Promise<number | null> {
  "use cache";
  cacheTag(FOUNDING_SELLER_TAG);
  cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("founding_seller_badges_left");
  if (error || typeof data !== "number") {
    if (error) console.error("founding_seller_badges_left failed:", error.message);
    return null;
  }
  return Math.max(0, Math.min(FOUNDING_SELLER_CAP, data));
}
