import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { Store } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { BUSINESS_TYPES } from "@/lib/plans";
import type { SearchHit } from "@/lib/search";
import { createPublicClient } from "@/lib/supabase/public";

type Storefront = { id: string; name: string; type: string; zip: string | null; slug: string; created_at: string };

async function getStorefront(slug: string) {
  "use cache";
  cacheTag(`shop:${slug}`);
  cacheLife("minutes");
  if (!/^[a-z0-9-]{1,140}$/.test(slug)) return null;
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("storefront_public", { p_slug: slug });
  const shop = (data?.[0] ?? null) as Storefront | null;
  if (!shop) return null;

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, brand, part_number, condition, category, price_cents, quantity, pickup, ships, zip, is_refrigerant, created_at, listing_photos(storage_path, sort_order)")
    .eq("business_id", shop.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "listing_photos" })
    .limit(1, { referencedTable: "listing_photos" })
    .limit(500);

  const hits: SearchHit[] = (listings ?? []).map((l) => ({
    ...l,
    cover_path: l.listing_photos[0]?.storage_path ?? null,
    zip_lat: null,
    zip_lng: null,
    miles: null,
    match_rank: 3,
    total: listings?.length ?? 0,
  }));
  return { shop, hits };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefront(slug);
  if (!data) return { title: "Storefront not found" };
  return {
    title: `${data.shop.name} — parts for sale`,
    description: `${data.hits.length} parts for sale from ${data.shop.name}${data.shop.zip ? ` near ${data.shop.zip}` : ""}. Overstock and dead stock on Partsaur.`,
    alternates: { canonical: `/shop/${data.shop.slug}` },
  };
}

async function Shop({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefront(slug);
  if (!data) notFound();
  const { shop, hits } = data;
  const typeLabel = BUSINESS_TYPES.find((t) => t.value === shop.type)?.label;

  return (
    <>
      <div className="mb-6 flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Store className="size-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black leading-tight">{shop.name}</h1>
          <p className="text-muted-foreground">
            {[typeLabel, shop.zip && `Near ${shop.zip}`, `On Partsaur since ${new Date(shop.created_at).getFullYear()}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <p className="mb-4 font-semibold">{hits.length} part{hits.length === 1 ? "" : "s"} for sale</p>
      {hits.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {hits.map((h) => <li key={h.id}><ListingCard hit={h} /></li>)}
        </ul>
      ) : (
        <p className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">Nothing listed right now.</p>
      )}
    </>
  );
}

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Shop params={params} />
      </Suspense>
    </div>
  );
}
