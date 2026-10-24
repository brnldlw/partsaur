import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { ListingCard } from "@/components/listing-card";
import { LocationButton } from "@/components/location-button";
import { NotifyForm } from "@/components/notify-form";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/listings";
import { getAccount } from "@/lib/profile";
import { SITE_URL } from "@/lib/site";
import { resolveLocation, searchListings, type SearchQuery } from "@/lib/search";
import { createPublicClient } from "@/lib/supabase/public";

type Part = {
  id: string;
  brand: string | null;
  part_number: string;
  category: string | null;
  trade: string;
  slug: string;
};

async function getPart(slug: string): Promise<Part | null> {
  "use cache";
  cacheTag(`part:${slug}`);
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) {
    cacheLife("days");
    return null;
  }
  const { data } = await createPublicClient()
    .from("parts")
    .select("id, brand, part_number, category, trade, slug")
    .eq("slug", slug)
    .maybeSingle<Part>();
  // Parts are created when listed, so don't remember "not found" for long.
  if (data) cacheLife("days");
  else cacheLife("seconds");
  return data;
}

const partName = (p: Part) => [p.brand, p.part_number].filter(Boolean).join(" ");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const part = await getPart(slug);
  if (!part) return { title: "Part not found" };
  const name = partName(part);
  const description = `Find ${name}${part.category ? ` (${categoryLabel(part.category, part.trade)})` : ""} in stock near you — overstock and dead stock from local shops and supply houses. Free to search.`;
  return {
    title: `${name} — in stock near you`,
    description,
    alternates: { canonical: `/part/${part.slug}` },
    openGraph: { title: `${name} for sale`, description, url: `/part/${part.slug}` },
  };
}

async function PartListings({ part, searchParams }: { part: Part; searchParams: Promise<SearchQuery> }) {
  const [query, { user, profile }] = await Promise.all([searchParams, getAccount()]);
  const location = await resolveLocation(query, profile?.zip);
  const { hits, total } = await searchListings({ location, radius: null, partId: part.id, limit: 50 });

  const prices = hits.map((h) => h.price_cents).filter((p): p is number => p != null);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: partName(part),
    mpn: part.part_number,
    ...(part.brand && { brand: { "@type": "Brand", name: part.brand } }),
    ...(part.category && { category: categoryLabel(part.category, part.trade) }),
    url: `${SITE_URL}/part/${part.slug}`,
    ...(low != null && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: (low / 100).toFixed(2),
        highPrice: (high! / 100).toFixed(2),
        offerCount: prices.length,
        availability: "https://schema.org/InStock",
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <p className="text-lg">
        {total === 0 ? (
          "None listed right now."
        ) : (
          <>
            <span className="font-bold">{total} available</span>
            {low != null && (
              <span className="text-muted-foreground">
                {" "}· {low === high ? formatPrice(low) : `${formatPrice(low)} – ${formatPrice(high)}`}
              </span>
            )}
          </>
        )}
      </p>

      {total > 0 && !location && (
        <div className="flex flex-col gap-2 rounded-lg border-2 border-primary bg-primary/10 p-3">
          <p className="font-semibold">Add your location to see the closest ones first.</p>
          <div className="self-start"><LocationButton basePath={`/part/${part.slug}`} /></div>
        </div>
      )}

      {hits.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {hits.map((h) => (
            <li key={h.id}><ListingCard hit={h} /></li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-xl border-2 border-primary p-4">
        <p className="font-bold">Unit down and you need it now?</p>
        <p className="text-muted-foreground">Post a Wanted request and we&apos;ll ping sellers nearby who have it.</p>
        <Button asChild size="xl" className="mt-1">
          <Link href={`/wanted/new?pn=${encodeURIComponent(part.part_number)}${part.brand ? `&brand=${encodeURIComponent(part.brand)}` : ""}`}>
            Post a Wanted request
          </Link>
        </Button>
      </div>

      <NotifyForm
        partNumber={part.part_number}
        brand={part.brand}
        partId={part.id}
        defaultEmail={user?.email}
        defaultZip={profile?.zip}
      />
    </>
  );
}

async function PartView({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchQuery> }) {
  const { slug } = await params;
  const part = await getPart(slug);
  if (!part) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        {part.category && (
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{categoryLabel(part.category, part.trade)}</p>
        )}
        <h1 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">
          {part.brand && <span>{part.brand} </span>}
          <span className="font-mono">{part.part_number}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Overstock, dead stock, and leftover-from-job parts listed by techs, shops, and supply houses.{" "}
          <Link href={`/search?q=${encodeURIComponent(part.part_number)}`} className="font-semibold text-primary underline-offset-4 hover:underline">
            Search similar part numbers
          </Link>
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <PartListings part={part} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

export default function PartPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchQuery>;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <PartView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
