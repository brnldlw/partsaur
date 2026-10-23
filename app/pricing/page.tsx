import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlanOffer, PlanOfferSkeleton } from "@/components/plan-offer";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free for buyers and techs. Free for up to 10 listings. Founding Shop $19/mo locked for life.",
  alternates: { canonical: "/pricing" },
};

const TIERS = [
  {
    who: "Buyers / Techs",
    price: "Free",
    gets: "Search, contact sellers, post Wanted requests",
  },
  {
    who: "Individual sellers",
    price: "Free",
    gets: "Up to 10 active listings",
  },
  {
    who: "Founding Shop",
    note: "First 50 shops",
    price: "$19/mo",
    priceNote: "locked for life",
    gets: "Unlimited listings, storefront page, bulk CSV upload, priority in Wanted matches",
    highlight: true,
  },
  {
    who: "Shop Pro",
    note: "After the first 50",
    price: "$39/mo",
    gets: "Same as Founding Shop",
  },
  {
    who: "Founding Supply House",
    note: "First 10 supply houses",
    price: "$99/mo",
    priceNote: "locked",
    gets: "Everything in Shop, plus (coming soon) multi-location, dead-stock feed, regional reach, analytics",
    highlight: true,
  },
  {
    who: "Supply House",
    note: "After the first 10",
    price: "$199/mo",
    priceNote: "per branch",
    gets: "Same as Founding Supply House",
  },
  {
    who: "Urgent Wanted Boost",
    price: "$9",
    priceNote: "one-time",
    gets: "Wider radius ping + pinned to the top for 72 hours",
  },
];

async function Banner({ searchParams }: { searchParams: Promise<{ soldout?: string; error?: string }> }) {
  const { soldout, error } = await searchParams;
  if (soldout) {
    return (
      <p role="alert" className="mb-6 rounded-lg border-2 border-primary bg-primary/10 p-3 font-semibold">
        The last Founding spot was just taken. The regular plan below has the same features.
      </p>
    );
  }
  if (error) {
    return <p role="alert" className="mb-6 rounded-lg border-2 border-destructive p-3 font-semibold">Checkout didn&apos;t start. Please try again.</p>;
  }
  return null;
}

export default function PricingPage({ searchParams }: { searchParams: Promise<{ soldout?: string; error?: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Suspense><Banner searchParams={searchParams} /></Suspense>
      <h1 className="text-3xl font-black sm:text-5xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        No surprises. Finding parts is free. Selling a few parts is free. Shops and supply houses
        that list a lot pay a flat monthly price.
      </p>

      <ul className="mt-8 divide-y rounded-xl border bg-card">
        {TIERS.map((t) => (
          <li
            key={t.who}
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
            <div className="sm:w-1/3">
              <p className="text-lg font-bold">
                {t.who}
                {t.highlight && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">
                    Founding
                  </span>
                )}
              </p>
              {t.note && <p className="text-sm text-muted-foreground">{t.note}</p>}
            </div>
            <p className="sm:w-1/4">
              <span className="text-2xl font-black">{t.price}</span>
              {t.priceNote && (
                <span className="text-sm text-muted-foreground"> {t.priceNote}</span>
              )}
            </p>
            <p className="text-muted-foreground sm:flex-1">{t.gets}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-muted-foreground">
        For now, buyers and sellers arrange pickup and payment directly. Partsaur doesn&apos;t
        take a cut of your sale. Cancel anytime from your Account page — Founding prices stay locked
        as long as you stay subscribed.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-black sm:text-3xl">Claim a Founding spot</h2>
        <p className="mb-6 mt-2 text-muted-foreground">
          When the Founding spots are gone, they&apos;re gone. The price stays locked as long as
          you stay subscribed.
        </p>
        <Suspense fallback={<PlanOfferSkeleton />}>
          <PlanOffer />
        </Suspense>
      </section>

      <p className="mt-10 text-center">
        Just want to buy parts?{" "}
        <Link href="/#waitlist" className="font-semibold text-primary underline-offset-4 hover:underline">
          Join the free waitlist
        </Link>
      </p>
    </div>
  );
}
