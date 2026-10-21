import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchResponse } from "@/components/match-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { milesText, neededByText, wantedLabel } from "@/lib/wanted";

export const metadata: Metadata = { title: "Do you have it?", robots: { index: false } };

async function Respond({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ a?: string }> }) {
  const [{ token }, { a }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  // The token itself is the credential (from the seller's email).
  const { data: match } = await createAdminClient()
    .from("matches")
    .select("miles, wanted_requests(part_number, brand, description, needed_by, status)")
    .eq("response_token", token)
    .maybeSingle();
  const w = match?.wanted_requests as unknown as
    | { part_number: string | null; brand: string | null; description: string | null; needed_by: string | null; status: string }
    | null;
  if (!match || !w) notFound();
  const label = wantedLabel(w);

  return (
    <>
      <h1 className="text-3xl font-black leading-tight">
        Someone {match.miles != null ? `${milesText(match.miles)} away ` : ""}needs {label}
      </h1>
      <p className="text-lg text-muted-foreground">Needed {neededByText(w.needed_by)}</p>
      {w.description && <p className="text-muted-foreground">{w.description}</p>}
      {w.status !== "open" ? (
        <p className="rounded-xl border-2 p-4">This request is closed — they already found one. Thanks anyway!</p>
      ) : (
        <MatchResponse token={token} answer={a === "no" ? "no" : "yes"} label={label} />
      )}
    </>
  );
}

export default function MatchPage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ a?: string }> }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Respond {...props} />
      </Suspense>
    </div>
  );
}
