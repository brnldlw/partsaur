export const SITE_NAME = "Partsaur";
export const SITE_TAGLINE = "Find the part. Sell the dead stock.";
export const SITE_DESCRIPTION =
  "Unit's down and the part is 3 weeks out? Someone nearby has it on a shelf. Partsaur is the marketplace for HVAC/R overstock, dead stock, and obsolete parts.";
export const CONTACT_EMAIL = "brian@stockedtruck.com";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export { TRADE_LIST as TRADES } from "@/lib/trades";

export const ROLES = [
  { value: "tech", label: "Tech" },
  { value: "shop", label: "Shop / Contractor" },
  { value: "supply_house", label: "Supply House" },
] as const;

export type Trade = string;
export type Role = (typeof ROLES)[number]["value"];
