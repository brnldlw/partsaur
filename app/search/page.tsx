import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { List, Map as MapIcon, Search } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { LocationButton } from "@/components/location-button";
import { NotifyForm } from "@/components/notify-form";
import { ResultsMap } from "@/components/results-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccount } from "@/lib/profile";
import {
  CATEGORIES,
  CONDITIONS,
  DEFAULT_RADIUS,
  MAP_LIMIT,
  PAGE_SIZE,
  RADII,
  cleanFilter,
  parseRadius,
  resolveLocation,
  searchHref,
  searchListings,
  type SearchQuery,
} from "@/lib/search";
import { cn } from "@/lib/utils";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchQuery> }): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `${q} — parts for sale` : "Search parts",
    robots: { index: false, follow: true },
  };
}

const selectClass =
  "h-12 w-full rounded-md border border-input bg-background px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

async function Results({ searchParams }: { searchParams: Promise<SearchQuery> }) {
  const query = await searchParams;
  const { user, profile } = await getAccount();

  const q = query.q?.trim() || null;
  const location = await resolveLocation(query, profile?.zip);
  const radius = parseRadius(query.radius);
  const category = cleanFilter(query.category, CATEGORIES);
  const condition = cleanFilter(query.condition, CONDITIONS);
  const view = query.view === "map" ? "map" : "list";
  const page = Math.max(1, Number(query.page) || 1);
  const usingGps = Boolean(query.lat && query.lng && !query.zip);

  const { hits, total } = await searchListings({
    q,
    location,
    radius,
    category,
    condition,
    limit: view === "map" ? MAP_LIMIT : PAGE_SIZE * page,
  });

  return (
    <>
      {/* Search + filters */}
      <form action="/search" className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Part #, brand, or what it is"
            aria-label="Search parts"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 flex-1 text-base"
          />
          <Button type="submit" size="xl" aria-label="Search"><Search /></Button>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            name="zip"
            defaultValue={query.zip ?? ""}
            placeholder={usingGps ? "Using your location" : profile?.zip ? `Zip (${profile.zip})` : "Zip code"}
            aria-label="Zip code"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            className="h-12 text-base"
          />
          <Suspense>
            <LocationButton />
          </Suspense>
        </div>
        {usingGps && (
          <>
            <input type="hidden" name="lat" value={query.lat} />
            <input type="hidden" name="lng" value={query.lng} />
          </>
        )}
        {query.radius && <input type="hidden" name="radius" value={query.radius} />}
        {view === "map" && <input type="hidden" name="view" value="map" />}

        <div className="grid grid-cols-2 gap-2">
          <select name="category" defaultValue={category ?? ""} aria-label="Category" className={selectClass}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select name="condition" defaultValue={condition ?? ""} aria-label="Condition" className={selectClass}>
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </form>

      {/* Radius */}
      {location && (
        <nav aria-label="Distance" className="mt-4 flex flex-wrap gap-2">
          {[...RADII.map(String), "any"].map((r) => {
            const active = r === "any" ? radius === null : radius === Number(r);
            return (
              <Link
                key={r}
                href={searchHref(query, { radius: r === String(DEFAULT_RADIUS) ? null : r, page: null })}
                className={cn(
                  "flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold",
                  active ? "border-primary bg-primary/10 text-primary" : "hover:border-foreground/30",
                )}
              >
                {r === "any" ? "Any distance" : `${r} mi`}
              </Link>
            );
          })}
        </nav>
      )}

      {/* No location yet */}
      {!location && (
        <div role="note" className="mt-4 rounded-lg border-2 border-primary bg-primary/10 p-3 font-semibold">
          Add your zip or use your location to see what&apos;s near you.
        </div>
      )}

      {/* Summary + view toggle */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "No listings found"
            : `${total} listing${total === 1 ? "" : "s"}`}
          {location && (radius ? ` within ${radius} mi of ${location.label}` : ` · sorted by distance from ${location.label}`)}
        </p>
        <div className="flex shrink-0 overflow-hidden rounded-lg border">
          <Link href={searchHref(query, { view: null })} aria-current={view === "list"}
            className={cn("flex h-11 items-center gap-1.5 px-3 text-sm font-semibold", view === "list" && "bg-primary text-primary-foreground")}>
            <List className="size-4" /> List
          </Link>
          <Link href={searchHref(query, { view: "map", page: null })} aria-current={view === "map"}
            className={cn("flex h-11 items-center gap-1.5 px-3 text-sm font-semibold", view === "map" && "bg-primary text-primary-foreground")}>
            <MapIcon className="size-4" /> Map
          </Link>
        </div>
      </div>

      {/* Results */}
      <div className="mt-4">
        {hits.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              {q ? <>Nothing listed for <span className="font-semibold text-foreground">{q}</span> yet</> : "Nothing listed yet"}
              {location && radius ? ` within ${radius} miles.` : "."}{" "}
              {location && radius && (
                <Link href={searchHref(query, { radius: "any" })} className="font-semibold text-primary underline">
                  Search any distance
                </Link>
              )}
            </p>
            {q && (
              <>
                <Button asChild size="xl">
                  <Link href={`/wanted/new?pn=${encodeURIComponent(q)}`}>Post a Wanted request for {q.length > 24 ? "it" : q}</Link>
                </Button>
                <NotifyForm partNumber={q} editablePartNumber defaultEmail={user?.email} defaultZip={profile?.zip} />
              </>
            )}
          </div>
        ) : view === "map" ? (
          <>
            <ResultsMap hits={hits} center={location} />
            {total > hits.length && (
              <p className="mt-2 text-sm text-muted-foreground">Showing the first {hits.length} on the map.</p>
            )}
          </>
        ) : (
          <>
            <ul className="grid gap-3 md:grid-cols-2">
              {hits.map((h) => (
                <li key={h.id}><ListingCard hit={h} /></li>
              ))}
            </ul>
            {total > hits.length && (
              <Button asChild size="xl" variant="outline" className="mt-4 w-full">
                <Link href={searchHref(query, { page: String(page + 1) })} scroll={false}>Show more</Link>
              </Button>
            )}
            {q && (
              <div className="mt-8">
                <NotifyForm partNumber={q} editablePartNumber defaultEmail={user?.email} defaultZip={profile?.zip} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function SearchPage({ searchParams }: { searchParams: Promise<SearchQuery> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-black">Find a part</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
