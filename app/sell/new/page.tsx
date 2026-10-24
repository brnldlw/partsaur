import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingForm } from "@/components/listing-form";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/profile";
import { contactNote, getListingAllowance } from "@/lib/seller";
import { DEFAULT_TRADE, getTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "List a part",
  robots: { index: false },
};

async function NewListing() {
  const { user, profile, business } = await getAccount();
  if (!user) redirect("/login?next=/sell/new");
  if (!profile) redirect("/onboarding");

  const allowance = await getListingAllowance(profile, business);
  if (!allowance.canAdd) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border-2 p-5">
        <p className="text-lg font-bold">You&apos;re at {allowance.limit} active listings.</p>
        <p className="text-muted-foreground">
          Free accounts can have {allowance.limit} active listings. Mark one sold or remove one to
          list another — or go unlimited with a Founding Shop plan.
        </p>
        <Button asChild size="xl"><Link href="/dashboard/listings">My listings</Link></Button>
        <Button asChild size="xl" variant="outline"><Link href="/pricing">See plans</Link></Button>
      </div>
    );
  }

  return (
    <>
      {!allowance.unlimited && (
        <p className="mb-6 text-sm text-muted-foreground">
          {allowance.active} of {allowance.limit} free listings used.
        </p>
      )}
      <ListingForm
        userId={user.id}
        contactNote={contactNote(profile)}
        initial={{
          title: "",
          brand: "",
          part_number: "",
          description: "",
          trade: getTrade(profile.trade)?.status === "live" ? profile.trade : DEFAULT_TRADE,
          category: "",
          condition: "",
          quantity: "1",
          price: "",
          pickup: true,
          ships: false,
          zip: business?.zip ?? profile.zip,
        }}
      />
    </>
  );
}

export default function SellPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-black">List a part</h1>
      <p className="mb-6 text-muted-foreground">Snap the label. Check the details. Done.</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/40" />}>
        <NewListing />
      </Suspense>
    </div>
  );
}
