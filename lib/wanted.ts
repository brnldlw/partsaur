export const WANTED_RADII = [25, 50, 100, 150, 300] as const;
export const LIKELY_PINGS_PER_DAY = { free: 3, paid: 10 } as const;
export const LIKELY_PINGS_PER_REQUEST = 20;
export const BOOST_HOURS = 72;
export const BOOST_PRICE_CENTS = 900;

type WantedLike = { part_number: string | null; brand: string | null; description: string | null };

/** "Copeland ZP36K5E-PFV-830", or the description if no part number. */
export function wantedLabel(w: WantedLike) {
  const name = [w.brand, w.part_number].filter(Boolean).join(" ");
  if (w.part_number) return name;
  const d = (w.description ?? "").trim();
  return [w.brand, d.length > 60 ? d.slice(0, 57) + "…" : d].filter(Boolean).join(" ") || "a part";
}

export function neededByText(date: string | null) {
  if (!date) return "ASAP";
  const d = new Date(date + "T12:00:00");
  return "by " + d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function milesText(miles: number | null | undefined) {
  return miles == null ? "" : `${Math.max(1, Math.round(miles))} mi`;
}
