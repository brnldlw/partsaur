import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingForm } from "@/components/listing-form";
import { photoUrl } from "@/lib/listings";
import { getAccount } from "@/lib/profile";
import { contactNote } from "@/lib/seller";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit listing",
  robots: { index: false },
};

async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getAccount();
  if (!user) redirect(`/login?next=/dashboard/listings/${id}/edit`);
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, brand, part_number, description, trade, category, condition, quantity, price_cents, pickup, ships, zip, listing_photos(storage_path, sort_order)")
    .eq("id", id)
    .eq("seller_id", user.id)
    .order("sort_order", { referencedTable: "listing_photos" })
    .maybeSingle();
  if (!listing) notFound();

  return (
    <ListingForm
      userId={user.id}
      listingId={listing.id}
      contactNote={contactNote(profile)}
      initialPhotos={listing.listing_photos.map((p) => ({ path: p.storage_path, url: photoUrl(p.storage_path) }))}
      initial={{
        title: listing.title,
        brand: listing.brand ?? "",
        part_number: listing.part_number ?? "",
        description: listing.description ?? "",
        trade: listing.trade,
        category: listing.category,
        condition: listing.condition,
        quantity: String(listing.quantity),
        price: listing.price_cents == null ? "" : String(listing.price_cents / 100),
        pickup: listing.pickup,
        ships: listing.ships,
        zip: listing.zip,
      }}
    />
  );
}

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-black">Edit listing</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/40" />}>
        <EditListing params={params} />
      </Suspense>
    </div>
  );
}
