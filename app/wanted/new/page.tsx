import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WantedForm } from "@/components/wanted-form";
import { getAccount } from "@/lib/profile";
import { DEFAULT_TRADE, getTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "Post a Wanted request",
  robots: { index: false },
};

async function NewWanted({ searchParams }: { searchParams: Promise<{ pn?: string; brand?: string }> }) {
  const [{ user, profile }, { pn, brand }] = await Promise.all([getAccount(), searchParams]);
  const next = `/wanted/new${pn ? `?pn=${encodeURIComponent(pn)}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}` : ""}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!profile) redirect("/onboarding");
  const trade = getTrade(profile.trade)?.status === "live" ? profile.trade : DEFAULT_TRADE;
  return <WantedForm defaults={{ part_number: pn?.slice(0, 80), brand: brand?.slice(0, 80), zip: profile.zip, trade }} />;
}

export default function NewWantedPage({ searchParams }: { searchParams: Promise<{ pn?: string; brand?: string }> }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-black">Post a Wanted request</h1>
      <p className="mb-6 text-muted-foreground">Unit down? Tell us what you need. We&apos;ll ping sellers nearby who have it.</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/40" />}>
        <NewWanted searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
