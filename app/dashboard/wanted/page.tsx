import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { neededByText, wantedLabel } from "@/lib/wanted";

export const metadata: Metadata = { title: "My Wanted requests", robots: { index: false } };

async function MyWanted() {
  const { user, profile } = await getAccount();
  if (!user) redirect("/login?next=/dashboard/wanted");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("wanted_requests")
    .select("id, part_number, brand, description, needed_by, status, created_at, matches(seller_response)")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!requests?.length) {
    return (
      <div className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
        No requests yet. Need a part? Post one and we&apos;ll ping sellers nearby.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => {
        const haveIt = r.matches.filter((m) => m.seller_response === "have_it").length;
        return (
          <li key={r.id}>
            <Link href={`/wanted/${r.id}`} className="flex flex-col gap-1 rounded-xl border bg-card p-4 hover:border-primary">
              <p className="font-bold">{wantedLabel(r)}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold capitalize text-foreground">{r.status}</span> · Needed {neededByText(r.needed_by)}
                {haveIt > 0 && <span className="font-semibold text-primary"> · {haveIt} have it</span>}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function MyWantedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-black">My Wanted requests</h1>
      <Button asChild size="xl" className="mb-6 w-full"><Link href="/wanted/new"><Plus /> Post a Wanted request</Link></Button>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/40" />}>
        <MyWanted />
      </Suspense>
    </div>
  );
}
