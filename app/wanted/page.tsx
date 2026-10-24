import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Search } from "lucide-react";
import { LocationButton } from "@/components/location-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WantedCard } from "@/components/wanted-card";
import { getAccount } from "@/lib/profile";
import { getTrade, LIVE_TRADES } from "@/lib/trades";
import { DEFAULT_RADIUS, RADII, parseRadius, resolveLocation, type SearchQuery } from "@/lib/search";
import { searchWanted } from "@/lib/wanted-search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Wanted board — parts techs need now",
  description: "Techs posting the parts they need right now. Have one on the shelf? Let them know.",
  alternates: { canonical: "/wanted" },
};

function href(query: SearchQuery, changes: Partial<SearchQuery>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...query, ...changes })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `/wanted?${s}` : "/wanted";
}

async function Board({ searchParams }: { searchParams: Promise<SearchQuery> }) {
  const query = await searchParams;
  const { profile } = await getAccount();
  const location = await resolveLocation(query, profile?.zip);
  const radius = parseRadius(query.radius);
  const q = query.q?.trim() || null;
  const usingGps = Boolean(query.lat && query.lng && !query.zip);
  const trade = getTrade(query.trade) ? query.trade! : null;
  const { hits, total } = await searchWanted({ location, radius, q, trade });

  return (
    <>
      <form action="/wanted" className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Filter by part # or brand" aria-label="Filter"
            autoCapitalize="characters" autoCorrect="off" className="h-12 flex-1 text-base" />
          <Button type="submit" size="xl" aria-label="Filter"><Search /></Button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input name="zip" defaultValue={query.zip ?? ""} aria-label="Zip code" inputMode="numeric" pattern="\d{5}" maxLength={5}
            placeholder={usingGps ? "Using your location" : profile?.zip ? `Zip (${profile.zip})` : "Zip code"} className="h-12 text-base" />
          <Suspense><LocationButton basePath="/wanted" /></Suspense>
        </div>
        {usingGps && (<><input type="hidden" name="lat" value={query.lat} /><input type="hidden" name="lng" value={query.lng} /></>)}
        {query.radius && <input type="hidden" name="radius" value={query.radius} />}
        {trade && <input type="hidden" name="trade" value={trade} />}
      </form>

      <nav aria-label="Trade" className="mt-4 flex flex-wrap gap-2">
        {[{ value: "", label: "All trades" }, ...LIVE_TRADES].map((t) => (
          <Link key={t.value || "all"} href={href(query, { trade: t.value || undefined })}
            className={cn("flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold",
              (trade ?? "") === t.value ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/30")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {location ? (
        <nav aria-label="Distance" className="mt-4 flex flex-wrap gap-2">
          {[...RADII.map(String), "any"].map((r) => {
            const active = r === "any" ? radius === null : radius === Number(r);
            return (
              <Link key={r} href={href(query, { radius: r === String(DEFAULT_RADIUS) ? undefined : r })}
                className={cn("flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold",
                  active ? "border-primary bg-primary/10 text-primary" : "hover:border-foreground/30")}>
                {r === "any" ? "Any distance" : `${r} mi`}
              </Link>
            );
          })}
        </nav>
      ) : (
        <div role="note" className="mt-4 rounded-lg border-2 border-primary bg-primary/10 p-3 font-semibold">
          Add your zip or use your location to see what&apos;s needed near you.
        </div>
      )}

      <p className="mt-5 text-sm text-muted-foreground">
        {total} open request{total === 1 ? "" : "s"}
        {location && (radius ? ` within ${radius} mi of ${location.label}` : ` · nearest to ${location.label} first`)}
      </p>

      {hits.length === 0 ? (
        <div className="mt-4 rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
          No open requests here yet. Need something? Post the first one.
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {hits.map((h) => <li key={h.id}><WantedCard hit={h} /></li>)}
        </ul>
      )}
    </>
  );
}

export default function WantedBoardPage({ searchParams }: { searchParams: Promise<SearchQuery> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Wanted</h1>
          <p className="text-muted-foreground">Parts techs need right now. Have one on the shelf? Tell them.</p>
        </div>
        <Button asChild size="xl"><Link href="/wanted/new"><Plus /> Post a Wanted request</Link></Button>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
