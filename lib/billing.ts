import type { Plan } from "@/lib/plans";

export type PaidPlan = Exclude<Plan, "free">;

/** Monthly subscription plans. Founding plans are capped (see founding_spots_left). */
export const PAID_PLAN_CONFIG: Record<
  PaidPlan,
  { name: string; priceCents: number; lookupKey: string; audience: "shop" | "supply"; founding: boolean; perBranch: boolean }
> = {
  founding_shop: { name: "Founding Shop", priceCents: 1900, lookupKey: "founding_shop_monthly", audience: "shop", founding: true, perBranch: false },
  shop_pro: { name: "Shop Pro", priceCents: 3900, lookupKey: "shop_pro_monthly", audience: "shop", founding: false, perBranch: false },
  founding_supply: { name: "Founding Supply House", priceCents: 9900, lookupKey: "founding_supply_monthly", audience: "supply", founding: true, perBranch: false },
  supply_house: { name: "Supply House", priceCents: 19900, lookupKey: "supply_house_branch_monthly", audience: "supply", founding: false, perBranch: true },
};

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === "string" && value in PAID_PLAN_CONFIG;
}

/** Stripe statuses where we keep the plan on (past_due = Stripe is still retrying the card). */
export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export const MAX_BRANCHES = 50;
