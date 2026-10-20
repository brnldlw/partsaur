export const PLAN_LABELS = {
  free: "Free",
  founding_shop: "Founding Shop",
  shop_pro: "Shop Pro",
  founding_supply: "Founding Supply House",
  supply_house: "Supply House",
} as const;

export type Plan = keyof typeof PLAN_LABELS;

export const BUSINESS_TYPES = [
  { value: "contractor", label: "Contractor / Shop" },
  { value: "supply_house", label: "Supply House" },
  { value: "surplus", label: "Surplus Dealer" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];
