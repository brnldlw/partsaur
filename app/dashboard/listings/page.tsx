import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus, Upload } from "lucide-react";
import { setListingStatus } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import { conditionLabel } from "@/lib/categories";
import { formatPrice, photoUrl } from "@/lib/listings";
import { getAccount } from "@/lib/profile";
import { getListingAllowance } from "@/lib/seller";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My listings",
  robots: { index: false },
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  sold: "bg-muted text-muted-foreground",
  removed: "bg-muted text-muted-foreground line-through",
  draft: "bg-muted text-muted-foreground",
};

function StatusButton({ id, status, label, variant = "outline" }: {
  id: string; status: string; label: string; variant?: "outline" | "ghost";
}) {
  return (
    <form action={setListingStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} className="h-11 w-full px-3">{label}</Button>
    </form>
  );
}

async function Listings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const [{ user, profile, business }, { error, saved }] = await Promise.all([getAccount(), searchParams]);
  if (!user) redirect("/login?next=/dashboard/listings");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const [{ data: listings }, allowance] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, part_number, condition, price_cents, quantity, status, moderation, is_refrigerant, listing_photos(storage_path, sort_order)")
      .eq("seller_id", user.id)
      .or("status.neq.removed,moderation.not.is.null")
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "listing_photos" })
      .limit(1, { referencedTable: "listing_photos" }),
    getListingAllowance(profile, business),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="xl" className="flex-1"><Link href="/sell/new"><Plus /> List a part</Link></Button>
        {allowance.unlimited && (
          <Button asChild size="xl" variant="outline" className="flex-1">
            <Link href="/dashboard/listings/import"><Upload /> Bulk upload (CSV)</Link>
          </Button>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {allowance.unlimited
          ? `${allowance.active} active listings · unlimited plan`
          : `${allowance.active} of ${allowance.limit} free active listings used`}
      </p>

      {saved && <p role="status" className="mb-4 rounded-lg border-2 border-primary bg-primary/10 p-3 font-semibold">Saved.</p>}
      {error === "limit" && (
        <p role="alert" className="mb-4 rounded-lg border-2 border-destructive p-3">
          You&apos;re at {allowance.limit} active listings. Mark one sold or remove one first —{" "}
          <Link href="/pricing" className="font-semibold underline">or go unlimited</Link>.
        </p>
      )}
      {error === "moderated" && <p role="alert" className="mb-4 font-medium text-destructive">That listing is under review by Partsaur and can&apos;t be changed.</p>}
      {error === "error" && <p role="alert" className="mb-4 font-medium text-destructive">Something went wrong. Try again.</p>}

      {!listings?.length ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
          No listings yet. Got a part on the shelf? Snap the label and list it in 30 seconds.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((l) => {
            const cover = l.listing_photos[0];
            return (
              <li key={l.id} className="rounded-xl border bg-card p-3">
                <Link href={`/listing/${l.id}`} className="flex gap-3">
                  <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl(cover.storage_path)} alt="" className="size-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{l.title}</p>
                    {l.part_number && <p className="truncate font-mono text-sm">{l.part_number}</p>}
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(l.price_cents)} · Qty {l.quantity} · {conditionLabel(l.condition)}
                    </p>
                    {l.moderation ? (
                      <span className="mt-1 inline-block rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                        {l.moderation === "auto_hidden" ? "Hidden — under review" : "Removed by Partsaur"}
                      </span>
                    ) : (
                      <span className={cn("mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLE[l.status])}>
                        {l.status}
                      </span>
                    )}
                  </div>
                </Link>
                {l.moderation ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {l.moderation === "auto_hidden"
                      ? "Several people reported this listing, so it's hidden while we take a look."
                      : "This listing broke our rules and was removed. Check your email for details."}
                  </p>
                ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button asChild variant="outline" className="h-11 px-3">
                    <Link href={`/dashboard/listings/${l.id}/edit`}>Edit</Link>
                  </Button>
                  {l.status === "active" ? (
                    <StatusButton id={l.id} status="sold" label="Mark sold" />
                  ) : (
                    <StatusButton id={l.id} status="active" label="Relist" />
                  )}
                  <StatusButton id={l.id} status="removed" label="Remove" variant="ghost" />
                </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function DashboardListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-black">My listings</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/40" />}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
