import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { MapPin, Package, Truck } from "lucide-react";
import { ContactSeller } from "@/components/contact-seller";
import { ReportButton } from "@/components/report-button";
import { Button } from "@/components/ui/button";
import { categoryLabel, conditionLabel } from "@/lib/categories";
import { milesBetween } from "@/lib/geo";
import { formatPrice, listingTag, photoUrl } from "@/lib/listings";
import { getAccount } from "@/lib/profile";
import { SITE_URL } from "@/lib/site";
import { getCategory, tradeLabel } from "@/lib/trades";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

type PublicListing = {
  id: string;
  seller_id: string;
  title: string;
  trade: string;
  brand: string | null;
  part_number: string | null;
  description: string | null;
  category: string;
  condition: string;
  quantity: number;
  price_cents: number | null;
  pickup: boolean;
  ships: boolean;
  zip: string;
  status: string;
  is_refrigerant: boolean;
  created_at: string;
  seller_name: string;
  business_name: string | null;
  lat: number | null;
  lng: number | null;
  part_slug: string | null;
  storefront_slug: string | null;
  photos: { storage_path: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPublicListing(id: string): Promise<PublicListing | null> {
  "use cache";
  cacheTag(listingTag(id));
  cacheLife("hours");
  if (!UUID.test(id)) return null;

  const supabase = createPublicClient();
  const [{ data: rows }, { data: photos }] = await Promise.all([
    supabase.rpc("listing_public", { p_id: id }),
    supabase.from("listing_photos").select("storage_path").eq("listing_id", id).order("sort_order"),
  ]);
  const row = rows?.[0];
  return row ? { ...row, photos: photos ?? [] } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublicListing(id);
  if (!listing) return { title: "Listing not found" };
  const title = `${listing.title}${listing.part_number && !listing.title.includes(listing.part_number) ? ` (${listing.part_number})` : ""}`;
  const description = `${conditionLabel(listing.condition)} · ${formatPrice(listing.price_cents)} · near ${listing.zip}. ${listing.description?.slice(0, 120) ?? ""}`;
  const image = listing.photos[0] ? photoUrl(listing.photos[0].storage_path) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/listing/${listing.id}` },
    openGraph: { title, description, images: image ? [image] : undefined },
  };
}

async function ViewerPanel({
  listing,
  searchParams,
}: {
  listing: PublicListing;
  searchParams: Promise<{ new?: string; contact?: string }>;
}) {
  const [{ user, profile }, { new: isNew, contact }] = await Promise.all([getAccount(), searchParams]);
  const isOwner = user?.id === listing.seller_id;

  let miles: number | null = null;
  if (profile && listing.lat != null && listing.lng != null) {
    const supabase = await createClient();
    const { data: z } = await supabase.from("zip_codes").select("lat, lng").eq("zip", profile.zip).maybeSingle();
    if (z) miles = milesBetween(z, { lat: listing.lat, lng: listing.lng });
  }

  return (
    <div className="flex flex-col gap-3">
      {isNew && isOwner && (
        <div role="status" className="rounded-lg border-2 border-primary bg-primary/10 p-3">
          <p className="font-bold">Your listing is live.</p>
          <p className="text-sm text-muted-foreground">Share the link, or list another part.</p>
        </div>
      )}
      <p className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="size-4" />
        {miles != null ? `About ${Math.max(1, Math.round(miles))} mi away` : `Near ${listing.zip}`}
      </p>
      {listing.status === "sold" ? (
        <p className="rounded-lg bg-muted p-4 text-center font-bold">Sold</p>
      ) : isOwner ? (
        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="xl"><Link href={`/dashboard/listings/${listing.id}/edit`}>Edit</Link></Button>
          <Button asChild size="xl" variant="outline"><Link href="/sell/new">List another</Link></Button>
        </div>
      ) : (
        <ContactSeller listingId={listing.id} listingTitle={listing.title} signedIn={Boolean(user)} error={contact} />
      )}
      {!isOwner && <ReportButton listingId={listing.id} signedIn={Boolean(user)} />}
    </div>
  );
}

async function ListingView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; contact?: string }>;
}) {
  const { id } = await params;
  const listing = await getPublicListing(id);
  if (!listing) notFound();

  const [cover, ...rest] = listing.photos;
  const categoryDef = getCategory(listing.trade, listing.category);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    ...(listing.part_number && { mpn: listing.part_number }),
    ...(listing.brand && { brand: { "@type": "Brand", name: listing.brand } }),
    ...(cover && { image: photoUrl(cover.storage_path) }),
    ...(listing.description && { description: listing.description.slice(0, 500) }),
    ...(listing.price_cents != null && {
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: (listing.price_cents / 100).toFixed(2),
        availability: listing.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        itemCondition: listing.condition === "used_working" || listing.condition === "for_parts"
          ? "https://schema.org/UsedCondition"
          : "https://schema.org/NewCondition",
        url: `${SITE_URL}/listing/${listing.id}`,
      },
    }),
  };

  return (
    <article className="grid gap-6 md:grid-cols-2">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="flex flex-col gap-2">
        <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(cover.storage_path)} alt={listing.title} className="size-full object-contain" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">No photo</div>
          )}
        </div>
        {rest.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {rest.map((p) => (
              <a key={p.storage_path} href={photoUrl(p.storage_path)} target="_blank" rel="noreferrer"
                className="aspect-square overflow-hidden rounded-lg border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(p.storage_path)} alt="" className="size-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Link href="/conditions" className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
            {conditionLabel(listing.condition)}
          </Link>
          <span className="rounded-full border px-3 py-1 text-sm">{tradeLabel(listing.trade)} · {categoryLabel(listing.category, listing.trade)}</span>
          {listing.is_refrigerant && (
            <span className="rounded-full border border-primary px-3 py-1 text-sm font-semibold">EPA 608 required</span>
          )}
        </div>
        {categoryDef?.confirm && (
          <p role="note" className="rounded-lg border-2 border-primary bg-primary/10 p-3 text-sm font-semibold">
            {categoryDef.confirm.caution}
          </p>
        )}
        <h1 className="text-2xl font-black leading-tight sm:text-3xl">{listing.title}</h1>
        {(listing.brand || listing.part_number) && (
          <p className="text-lg">
            {listing.brand && <span className="font-semibold">{listing.brand} </span>}
            {listing.part_number && <span className="font-mono">{listing.part_number}</span>}
            {listing.part_slug && (
              <Link href={`/part/${listing.part_slug}`} className="ml-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                See all for this part
              </Link>
            )}
          </p>
        )}
        <p className="text-3xl font-black">
          {formatPrice(listing.price_cents)}
          {listing.quantity > 1 && <span className="ml-2 text-base font-normal text-muted-foreground">· {listing.quantity} available</span>}
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          {listing.pickup && (
            <span className="flex items-center gap-1.5">
              <Package className="size-4" /> {categoryDef?.freight && !listing.ships ? <b>Pickup only</b> : "Local pickup"}
            </span>
          )}
          {listing.ships && (
            <span className="flex items-center gap-1.5">
              <Truck className="size-4" /> {categoryDef?.freight ? <b>Ships by freight</b> : "Ships"}
            </span>
          )}
        </div>

        <Suspense fallback={<div className="h-14 animate-pulse rounded-lg bg-muted/40" />}>
          <ViewerPanel listing={listing} searchParams={searchParams} />
        </Suspense>

        <p className="text-sm text-muted-foreground">
          Sold by{" "}
          {listing.storefront_slug ? (
            <Link href={`/shop/${listing.storefront_slug}`} className="font-semibold text-primary underline-offset-4 hover:underline">
              {listing.business_name}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{listing.business_name ?? listing.seller_name}</span>
          )}
          {listing.business_name && ` (${listing.seller_name})`}
        </p>

        {listing.description && (
          <div>
            <h2 className="mb-1 font-bold">Details</h2>
            <p className="whitespace-pre-line text-muted-foreground">{listing.description}</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; contact?: string }>;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <ListingView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
