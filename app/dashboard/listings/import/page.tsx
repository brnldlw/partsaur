import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CsvImport } from "@/components/csv-import";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/profile";
import { isPaid } from "@/lib/seller";

export const metadata: Metadata = {
  title: "Bulk upload",
  robots: { index: false },
};

async function Import() {
  const { user, profile, business } = await getAccount();
  if (!user) redirect("/login?next=/dashboard/listings/import");
  if (!profile) redirect("/onboarding");

  if (!isPaid(business)) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border-2 p-5">
        <p className="text-lg font-bold">Bulk upload is a Founding Shop feature.</p>
        <p className="text-muted-foreground">
          Upload your whole dead-stock list from a spreadsheet at once. Included with Founding Shop
          ($19/mo, locked for life) and Supply House plans.
        </p>
        <Button asChild size="xl"><Link href="/pricing">See plans</Link></Button>
      </div>
    );
  }
  return <CsvImport defaultZip={business?.zip ?? profile.zip} />;
}

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-black">Bulk upload</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/40" />}>
        <Import />
      </Suspense>
    </div>
  );
}
