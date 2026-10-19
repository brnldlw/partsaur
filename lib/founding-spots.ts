import { isFoundingPlan, type FoundingPlan } from "@/lib/founding";
import { createPublicClient } from "@/lib/supabase/public";

export type SpotsLeft = Record<FoundingPlan, { cap: number; left: number }>;

/** Live counts from the DB. Falls back to full caps if the DB isn't set up yet. */
export async function getSpotsLeft(): Promise<SpotsLeft> {
  const spots: SpotsLeft = {
    founding_shop: { cap: 50, left: 50 },
    founding_supply: { cap: 10, left: 10 },
  };
  const { data, error } = await createPublicClient().rpc("founding_spots_left");
  if (error) {
    console.error("founding_spots_left failed:", error.message);
    return spots;
  }
  for (const row of data as { plan: string; cap: number; spots_left: number }[]) {
    if (isFoundingPlan(row.plan)) {
      spots[row.plan] = { cap: row.cap, left: row.spots_left };
    }
  }
  return spots;
}
