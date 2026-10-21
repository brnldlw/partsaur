import { createPublicClient } from "@/lib/supabase/public";
import type { SearchLocation } from "@/lib/search";

export type WantedHit = {
  id: string;
  part_number: string | null;
  brand: string | null;
  description: string | null;
  category: string | null;
  needed_by: string | null;
  radius_miles: number;
  zip: string;
  status: string;
  boosted: boolean;
  created_at: string;
  requester_id: string;
  requester_name: string;
  miles: number | null;
  total: number;
};

export async function searchWanted(opts: {
  location: SearchLocation | null;
  radius: number | null;
  q?: string | null;
  id?: string | null;
  limit?: number;
}): Promise<{ hits: WantedHit[]; total: number }> {
  const { data, error } = await createPublicClient().rpc("search_wanted", {
    lat: opts.location?.lat ?? null,
    lng: opts.location?.lng ?? null,
    radius_miles: opts.location ? opts.radius : null,
    q: opts.q?.slice(0, 100) || null,
    p_id: opts.id ?? null,
    lim: opts.limit ?? 50,
    off: 0,
  });
  if (error) {
    console.error("search_wanted failed:", error.message);
    return { hits: [], total: 0 };
  }
  const hits = (data ?? []) as WantedHit[];
  return { hits, total: hits[0]?.total ?? 0 };
}
