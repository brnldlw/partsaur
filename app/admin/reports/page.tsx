import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { dismissReports, removeListing } from "@/app/actions/admin";
import { AdminFallback, AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/admin";
import { formatPrice, photoUrl } from "@/lib/listings";
import { reportReasonLabel } from "@/lib/reports";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Reports · Admin", robots: { index: false } };

type ReportRow = {
  id: string;
  reason: string;
  note: string | null;
  created_at: string;
  listing_id: string;
  listings: {
    id: string; title: string; part_number: string | null; price_cents: number | null; status: string;
    moderation: string | null; seller_id: string; listing_photos: { storage_path: string; sort_order: number }[];
  } | null;
};

async function Reports() {
  await requireAdmin();
  const { data } = await createAdminClient()
    .from("reports")
    .select("id, reason, note, created_at, listing_id, listings(id, title, part_number, price_cents, status, moderation, seller_id, listing_photos(storage_path, sort_order))")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as ReportRow[];

  const byListing = new Map<string, ReportRow[]>();
  for (const r of rows) byListing.set(r.listing_id, [...(byListing.get(r.listing_id) ?? []), r]);

  if (!byListing.size) {
    return <p className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">No open reports. 👍</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {[...byListing.entries()].map(([listingId, reports]) => {
        const l = reports[0].listings;
        const cover = l?.listing_photos.sort((a, b) => a.sort_order - b.sort_order)[0];
        return (
          <li key={listingId} className="rounded-xl border-2 bg-card p-4">
            <div className="flex gap-3">
              <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(cover.storage_path)} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <Link href={`/listing/${listingId}`} className="font-bold underline">{l?.title ?? "Listing"}</Link>
                <p className="text-sm text-muted-foreground">
                  {l?.part_number} · {formatPrice(l?.price_cents ?? null)} · status {l?.status}
                  {l?.moderation === "auto_hidden" && <span className="font-semibold text-primary"> · auto-hidden (3+ reports)</span>}
                </p>
                <p className="mt-1 font-semibold">{reports.length} report{reports.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="rounded bg-muted p-2">
                  <span className="font-semibold">{reportReasonLabel(r.reason)}</span>
                  {r.note && <span className="text-muted-foreground"> — {r.note}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <form action={removeListing} className="contents">
                <input type="hidden" name="listing_id" value={listingId} />
                <Input name="reason" placeholder="Reason for seller (optional)" maxLength={300} className="h-11 text-base" />
                <Button type="submit" variant="destructive" className="h-11">Remove listing</Button>
              </form>
              <form action={dismissReports}>
                <input type="hidden" name="listing_id" value={listingId} />
                <Button type="submit" variant="outline" className="h-11 w-full">Dismiss</Button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell active="/admin/reports"><Reports /></AdminShell>
    </Suspense>
  );
}
