import { CATEGORIES, CONDITIONS } from "@/lib/categories";
import { createPublicClient } from "@/lib/supabase/public";

export const RADII = [25, 50, 100, 150, 300] as const;
export const DEFAULT_RADIUS = 150;
export const PAGE_SIZE = 30;
export const MAP_LIMIT = 100;

export type SearchQuery = {
  q?: string;
  zip?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  category?: string;
  condition?: string;
  view?: string;
  page?: string;
};

export type SearchHit = {
  id: string;
  title: string;
  brand: string | null;
  part_number: string | null;
  condition: string;
  category: string;
  price_cents: number | null;
  quantity: number;
  pickup: boolean;
  ships: boolean;
  zip: string;
  is_refrigerant: boolean;
  created_at: string;
  cover_path: string | null;
  zip_lat: number | null;
  zip_lng: number | null;
  miles: number | null;
  match_rank: number;
  total: number;
};

export type SearchLocation = { lat: number; lng: number; label: string };

/** Turns ?zip= or ?lat=&lng= (or a fallback zip, e.g. the user's profile) into a point. */
export async function resolveLocation(
  query: SearchQuery,
  fallbackZip?: string | null,
): Promise<SearchLocation | null> {
  const zip = query.zip?.trim();
  if (zip && /^\d{5}$/.test(zip)) return zipLocation(zip);

  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (query.lat && query.lng && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng, label: "your location" };
  }
  return fallbackZip ? zipLocation(fallbackZip) : null;
}

async function zipLocation(zip: string): Promise<SearchLocation | null> {
  const { data } = await createPublicClient().from("zip_codes").select("lat, lng").eq("zip", zip).maybeSingle();
  return data ? { lat: data.lat, lng: data.lng, label: zip } : null;
}

export function parseRadius(value: string | undefined): number | null {
  if (value === "any") return null;
  const n = Number(value);
  return (RADII as readonly number[]).includes(n) ? n : DEFAULT_RADIUS;
}

export function cleanFilter(value: string | undefined, options: readonly { value: string }[]) {
  return value && options.some((o) => o.value === value) ? value : null;
}

export async function searchListings(opts: {
  q?: string | null;
  location: SearchLocation | null;
  radius: number | null;
  category?: string | null;
  condition?: string | null;
  partId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ hits: SearchHit[]; total: number }> {
  const { data, error } = await createPublicClient().rpc("search_listings", {
    q: opts.q?.slice(0, 100) || null,
    lat: opts.location?.lat ?? null,
    lng: opts.location?.lng ?? null,
    radius_miles: opts.location ? opts.radius : null,
    p_category: opts.category ?? null,
    p_condition: opts.condition ?? null,
    p_part_id: opts.partId ?? null,
    lim: opts.limit ?? PAGE_SIZE,
    off: opts.offset ?? 0,
  });
  if (error) {
    console.error("search_listings failed:", error.message);
    return { hits: [], total: 0 };
  }
  const hits = (data ?? []) as SearchHit[];
  return { hits, total: hits[0]?.total ?? 0 };
}

/** Builds a /search URL from the current query with some values changed. */
export function searchHref(query: SearchQuery, changes: Partial<Record<keyof SearchQuery, string | null>>) {
  const params = new URLSearchParams();
  const merged = { ...query, ...changes };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const s = params.toString();
  return s ? `/search?${s}` : "/search";
}

export { CATEGORIES, CONDITIONS };
