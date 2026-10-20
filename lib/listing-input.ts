import { CATEGORIES, CONDITIONS, type Category, type Condition } from "@/lib/categories";

export type ListingInput = {
  title: string;
  brand: string | null;
  part_number: string | null;
  description: string | null;
  category: Category;
  condition: Condition;
  quantity: number;
  price_cents: number | null;
  pickup: boolean;
  ships: boolean;
  zip: string;
};

export type ParseResult = { ok: true; data: ListingInput } | { ok: false; error: string };

const str = (v: unknown) => (v == null ? "" : String(v)).trim();
const optional = (v: unknown, max: number, name: string): string | null | Error => {
  const s = str(v);
  if (s.length > max) return new Error(`${name} is too long (max ${max} characters).`);
  return s || null;
};

const YES = new Set(["yes", "y", "true", "1", "on", "x"]);
const NO = new Set(["no", "n", "false", "0", "off", ""]);

function bool(v: unknown, name: string): boolean | Error {
  if (typeof v === "boolean") return v;
  const s = str(v).toLowerCase();
  if (YES.has(s)) return true;
  if (NO.has(s)) return false;
  return new Error(`${name} should be yes or no.`);
}

/** Matches a category by its code ("motors_fans") or label ("Motors & Fans"). */
function matchOption<T extends string>(
  v: unknown,
  options: readonly { value: T; label: string }[],
): T | null {
  const s = str(v).toLowerCase();
  if (!s) return null;
  return (
    options.find((o) => o.value === s)?.value ??
    options.find((o) => o.label.toLowerCase() === s)?.value ??
    options.find((o) => o.label.toLowerCase().split(" (")[0] === s)?.value ??
    null
  );
}

/** "$1,250.00" → 125000. Blank → null (make offer). */
export function parsePriceCents(v: unknown): number | null | Error {
  const s = str(v).replace(/[$,\s]/g, "");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return new Error("Price should be a number like 125 or 125.50.");
  const cents = Math.round(Number(s) * 100);
  if (cents > 100_000_000) return new Error("Price is too high.");
  return cents;
}

/** Shared by the listing form (server) and CSV import (browser preview + server). */
export function parseListingInput(raw: Record<string, unknown>, defaultZip?: string): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, error });

  const title = str(raw.title);
  if (!title) return fail("Add a title.");
  if (title.length > 140) return fail("Title is too long (max 140 characters).");

  const brand = optional(raw.brand, 80, "Brand");
  if (brand instanceof Error) return fail(brand.message);
  const partNumber = optional(raw.part_number, 80, "Part number");
  if (partNumber instanceof Error) return fail(partNumber.message);
  const description = optional(raw.description, 4000, "Description");
  if (description instanceof Error) return fail(description.message);

  const category = matchOption(raw.category, CATEGORIES);
  if (!category) return fail(raw.category ? `Unknown category "${str(raw.category)}".` : "Pick a category.");
  const condition = matchOption(raw.condition, CONDITIONS);
  if (!condition) return fail(raw.condition ? `Unknown condition "${str(raw.condition)}".` : "Pick a condition.");

  const qtyRaw = str(raw.quantity) || "1";
  const quantity = Number(qtyRaw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    return fail("Quantity should be a whole number from 1 to 9999.");
  }

  const price = parsePriceCents(raw.price);
  if (price instanceof Error) return fail(price.message);

  const pickup = bool(raw.pickup ?? "yes", "Pickup");
  if (pickup instanceof Error) return fail(pickup.message);
  const ships = bool(raw.ships ?? "no", "Ships");
  if (ships instanceof Error) return fail(ships.message);
  if (!pickup && !ships) return fail("Choose pickup, shipping, or both.");

  const zip = str(raw.zip) || defaultZip || "";
  if (!/^\d{5}$/.test(zip)) return fail("Zip code should be 5 digits.");

  return {
    ok: true,
    data: {
      title,
      brand,
      part_number: partNumber,
      description,
      category,
      condition,
      quantity,
      price_cents: price,
      pickup,
      ships,
      zip,
    },
  };
}

export const CSV_COLUMNS = [
  "title",
  "brand",
  "part_number",
  "description",
  "category",
  "condition",
  "quantity",
  "price",
  "pickup",
  "ships",
  "zip",
] as const;

export const MAX_IMPORT_ROWS = 500;
