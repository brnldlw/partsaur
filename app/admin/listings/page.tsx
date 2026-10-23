import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { removeListing, restoreListing } from "@/app/actions/admin";
import { AdminFallback, AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/admin";
import { formatPrice } from "@/lib/listings";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Listings · Admin", robots: { index: false } };

async function Listings({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const term = q?.trim().replace(/[%,()]/g, " ").slice(0, 80);
  let query = createAdminClient()
    .from("listings")
    .select("id, title, brand, part_number, price_cents, status, moderation, zip, created_at, is_refrigerant")
    .order("created_at", { ascending: false })
    .limit(100);
  if (term) query = query.or(`title.ilike.%${term}%,part_number.ilike.%${term}%,brand.ilike.%${term}%`);
  const { data: listings } = await query;
  const back = `/admin/listings${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <form action="/admin/listings" className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Title, brand, or part #" className="h-12 flex-1 text-base" />
        <Button type="submit" size="xl">Search</Button>
      </form>
      <ul className="divide-y rounded-xl border bg-card">
        {(listings ?? []).map((l) => (
          <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`/listing/${l.id}`} className="font-bold underline">{l.title}</Link>
              <p className="text-sm text-muted-foreground">
                {[l.brand, l.part_number].filter(Boolean).join(" ")} · {formatPrice(l.price_cents)} · {l.zip} ·{" "}
                <span className="font-semibold">{l.status}</span>
                {l.moderation && <span className="font-semibold text-destructive"> · {l.moderation.replace("_", " ")}</span>}
                {l.is_refrigerant && " · refrigerant"}
              </p>
            </div>
            {l.moderation ? (
              <form action={restoreListing}>
                <input type="hidden" name="listing_id" value={l.id} />
                <input type="hidden" name="back" value={back} />
                <Button type="submit" variant="outline" className="h-11">Restore</Button>
              </form>
            ) : (
              <form action={removeListing} className="flex gap-2">
                <input type="hidden" name="listing_id" value={l.id} />
                <input type="hidden" name="back" value={back} />
                <Input name="reason" placeholder="Reason (optional)" maxLength={300} className="h-11 w-44 text-base" />
                <Button type="submit" variant="destructive" className="h-11">Remove</Button>
              </form>
            )}
          </li>
        ))}
        {!listings?.length && <li className="p-6 text-center text-muted-foreground">No listings found.</li>}
      </ul>
    </>
  );
}

export default function AdminListingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell active="/admin/listings"><Listings searchParams={searchParams} /></AdminShell>
    </Suspense>
  );
}
