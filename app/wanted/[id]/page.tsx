import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Clock, MapPin, Zap } from "lucide-react";
import { setWantedStatus, startBoostCheckout } from "@/app/actions/wanted";
import { HaveItButton } from "@/components/have-it-button";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/categories";
import { tradeLabel } from "@/lib/trades";
import { getAccount } from "@/lib/profile";
import { resolveLocation } from "@/lib/search";
import { isStripeEnabled } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { milesText, neededByText, wantedLabel } from "@/lib/wanted";
import { searchWanted } from "@/lib/wanted-search";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; boosted?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Wanted request" };
  const { hits } = await searchWanted({ location: null, radius: null, id });
  const w = hits[0];
  if (!w) return { title: "Wanted request", robots: { index: false } };
  return {
    title: `Wanted: ${wantedLabel(w)}`,
    description: `A tech near ${w.zip} needs ${wantedLabel(w)} ${neededByText(w.needed_by)}. Have one? Let them know on Partsaur.`,
  };
}

/** Owner-only: who was pinged and who said they have it (with contact). */
async function OwnerPanel({ wantedId, status, boostedUntil }: { wantedId: string; status: string; boostedUntil: string | null }) {
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("seller_id, match_type, seller_response, miles, notified_at")
    .eq("wanted_id", wantedId);
  const haveIt = (matches ?? []).filter((m) => m.seller_response === "have_it");
  const { data: convs } = await supabase.from("conversations").select("id, seller_id").eq("wanted_id", wantedId);
  const threadBySeller = new Map((convs ?? []).map((c) => [c.seller_id, c.id]));
  const pinged = (matches ?? []).filter((m) => m.notified_at).length;

  // Sellers who said "have it" agreed to share contact info with this requester.
  const admin = createAdminClient();
  const sellers = await Promise.all(
    haveIt.map(async (m) => {
      const [{ data: auth }, { data: p }] = await Promise.all([
        admin.auth.admin.getUserById(m.seller_id),
        admin.from("profiles").select("display_name, phone, show_phone").eq("id", m.seller_id).maybeSingle(),
      ]);
      return { ...m, name: p?.display_name ?? "Seller", email: auth?.user?.email ?? "", phone: p?.show_phone ? p.phone : null };
    }),
  );
  const boosted = boostedUntil && Date.parse(boostedUntil) > Date.now();

  return (
    <section className="flex flex-col gap-4 rounded-xl border-2 p-4">
      <h2 className="text-lg font-bold">Your request</h2>
      <p className="text-muted-foreground">
        {pinged} seller{pinged === 1 ? "" : "s"} pinged so far · {haveIt.length} said they have it.
        We&apos;ll email you as more answer or list one.
      </p>

      {sellers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sellers.map((s) => (
            <li key={s.seller_id} className="rounded-lg border-2 border-primary bg-primary/10 p-3">
              <p className="font-bold">{s.name}{s.miles != null && <span className="font-normal text-muted-foreground"> · {milesText(s.miles)} away</span>}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {threadBySeller.get(s.seller_id) && (
                  <Button asChild className="h-11"><Link href={`/messages/${threadBySeller.get(s.seller_id)}`}>Message</Link></Button>
                )}
                <Button asChild variant="outline" className="h-11"><a href={`mailto:${s.email}`}>Email</a></Button>
                {s.phone && <Button asChild variant="outline" className="h-11"><a href={`tel:${s.phone}`}>Call</a></Button>}
                {s.phone && <Button asChild variant="outline" className="h-11"><a href={`sms:${s.phone}`}>Text</a></Button>}
              </div>
              <p className="mt-1 break-all text-sm text-muted-foreground">{s.email}</p>
            </li>
          ))}
        </ul>
      )}

      {status === "open" && (
        <>
          {boosted ? (
            <p className="flex items-center gap-2 font-semibold text-primary">
              <Zap className="size-4" /> Boosted until {new Date(boostedUntil!).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </p>
          ) : isStripeEnabled() ? (
            <form action={startBoostCheckout}>
              <input type="hidden" name="id" value={wantedId} />
              <Button type="submit" size="xl" variant="outline" className="w-full">
                <Zap /> Urgent Boost — $9 · double the radius, pinned 72 hrs
              </Button>
            </form>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <form action={setWantedStatus}>
              <input type="hidden" name="id" value={wantedId} />
              <input type="hidden" name="status" value="filled" />
              <Button type="submit" size="xl" className="w-full">Got it — filled</Button>
            </form>
            <form action={setWantedStatus}>
              <input type="hidden" name="id" value={wantedId} />
              <input type="hidden" name="status" value="closed" />
              <Button type="submit" size="xl" variant="ghost" className="w-full">Close</Button>
            </form>
          </div>
        </>
      )}
      {status !== "open" && (
        <form action={setWantedStatus}>
          <input type="hidden" name="id" value={wantedId} />
          <input type="hidden" name="status" value="open" />
          <p className="mb-2 font-semibold capitalize">Status: {status}</p>
          <Button type="submit" size="xl" variant="outline" className="w-full">Reopen</Button>
        </form>
      )}
    </section>
  );
}

async function WantedView({ params, searchParams }: Params) {
  const [{ id }, { new: isNew, boosted }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const { user, profile } = await getAccount();

  // Owner can see their request in any status; everyone else only open ones.
  const supabase = await createClient();
  const { data: own } = user
    ? await supabase
        .from("wanted_requests")
        .select("id, requester_id, part_number, brand, description, trade, category, needed_by, zip, status, boosted_until, radius_miles")
        .eq("id", id)
        .eq("requester_id", user.id)
        .maybeSingle()
    : { data: null };

  const location = await resolveLocation({}, profile?.zip);
  const { hits } = await searchWanted({ location, radius: null, id });
  const pub = hits[0];
  if (!own && !pub) notFound();

  const w = own ?? pub!;
  const isOwner = Boolean(own);
  const isBoosted = own ? Boolean(own.boosted_until && Date.parse(own.boosted_until) > Date.now()) : pub!.boosted;

  return (
    <div className="flex flex-col gap-5">
      {isNew && isOwner && (
        <div role="status" className="rounded-lg border-2 border-primary bg-primary/10 p-3">
          <p className="font-bold">Posted. We&apos;re pinging sellers nearby now.</p>
          <p className="text-sm text-muted-foreground">You&apos;ll get an email the moment someone says they have it.</p>
        </div>
      )}
      {boosted && isOwner && (
        <div role="status" className="rounded-lg border-2 border-primary bg-primary/10 p-3 font-bold">
          Boost paid — your request is pinned and reaching twice as far for 72 hours.
        </div>
      )}

      <div>
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Wanted · {tradeLabel(w.trade)} {w.category && <span>· {categoryLabel(w.category, w.trade)}</span>}
          {isBoosted && <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"><Zap className="size-3" />Urgent</span>}
        </p>
        <h1 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">
          {w.part_number ? <span className="font-mono">{wantedLabel(w)}</span> : wantedLabel(w)}
        </h1>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-lg">
        <span className="flex items-center gap-1.5 font-bold"><Clock className="size-5" /> Needed {neededByText(w.needed_by)}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-5" />
          {!isOwner && pub?.miles != null ? `${milesText(pub.miles)} away` : `Near ${w.zip}`}
        </span>
      </div>

      {w.description && <p className="whitespace-pre-line text-muted-foreground">{w.description}</p>}
      {!isOwner && pub && <p className="text-sm text-muted-foreground">Posted by {pub.requester_name}</p>}

      {isOwner ? (
        <OwnerPanel wantedId={w.id} status={own!.status} boostedUntil={own!.boosted_until} />
      ) : (
        <div className="flex flex-col gap-2">
          <HaveItButton wantedId={w.id} signedIn={Boolean(user)} />
          <p className="text-sm text-muted-foreground">We&apos;ll send them your name and email so they can reach you.</p>
        </div>
      )}

      {w.part_number && (
        <Link href={`/search?q=${encodeURIComponent(w.part_number)}`} className="self-start font-semibold text-primary underline-offset-4 hover:underline">
          Search listings for {w.part_number}
        </Link>
      )}
    </div>
  );
}

export default function WantedPage(props: Params) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <WantedView {...props} />
      </Suspense>
    </div>
  );
}
