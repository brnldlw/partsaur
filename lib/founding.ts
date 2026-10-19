export const FOUNDING_PLANS = {
  founding_shop: {
    name: "Founding Shop",
    cap: 50,
    priceCents: 1900,
    lookupKey: "founding_shop_monthly",
    role: "shop",
  },
  founding_supply: {
    name: "Founding Supply House",
    cap: 10,
    priceCents: 9900,
    lookupKey: "founding_supply_monthly",
    role: "supply_house",
  },
} as const;

export type FoundingPlan = keyof typeof FOUNDING_PLANS;

export function isFoundingPlan(value: unknown): value is FoundingPlan {
  return typeof value === "string" && value in FOUNDING_PLANS;
}
