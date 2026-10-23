import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { BillingCard } from "@/components/billing-card";
import { Epa608Upload } from "@/components/epa608-upload";
import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { isAdminEmail } from "@/lib/admin";
import { getAccount } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

async function Account({ searchParams }: { searchParams: Promise<{ welcome?: string; billing?: string }> }) {
  const [{ user, profile, business }, { welcome, billing }] = await Promise.all([
    getAccount(),
    searchParams,
  ]);
  if (!user) redirect("/login?next=/account");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { data: certs } = await supabase
    .from("certifications")
    .select("status, created_at")
    .eq("type", "epa608")
    .order("created_at", { ascending: false })
    .limit(1);
  const latestCert = certs?.[0];

  return (
    <>
      {welcome && (
        <div role="status" className="mb-6 rounded-lg border-2 border-primary bg-primary/10 p-4">
          <p className="text-lg font-bold">You&apos;re all set, {profile.display_name}.</p>
          <p className="text-muted-foreground">
            Search for a part, list one off your shelf, or post a Wanted request.
          </p>
        </div>
      )}

      <BillingCard profile={profile} business={business} email={user.email ?? ""} billing={billing} />

      <div className="mb-8 grid grid-cols-2 gap-2">
        <Button asChild size="xl"><Link href="/sell/new">List a part</Link></Button>
        <Button asChild size="xl" variant="outline"><Link href="/dashboard/listings">My listings</Link></Button>
        <Button asChild size="xl" variant="outline"><Link href="/dashboard/wanted">My Wanted requests</Link></Button>
        <Button asChild size="xl" variant="outline"><Link href="/messages">Messages</Link></Button>
        {isAdminEmail(user.email) && (
          <Button asChild size="xl" variant="outline" className="col-span-2"><Link href="/admin">Admin</Link></Button>
        )}
      </div>

      <h2 className="mb-4 text-xl font-bold">Profile</h2>
      <ProfileForm mode="account" profile={profile} business={business} />

      <section id="epa608" className="mt-10 scroll-mt-20 border-t pt-6">
        <h2 className="mb-2 text-xl font-bold">EPA 608 certification</h2>
        {profile.epa608_verified ? (
          <p className="rounded-lg border-2 border-primary bg-primary/10 p-4 font-semibold">
            ✓ Verified — you can buy refrigerant listings.
          </p>
        ) : latestCert?.status === "pending" ? (
          <p className="rounded-lg border-2 p-4">Submitted — under review, usually within a day.</p>
        ) : (
          <>
            <p className="mb-4 text-muted-foreground">
              Required to contact sellers about refrigerant.
              {latestCert?.status === "rejected" && " Your last upload couldn't be verified — try a clearer photo."}
            </p>
            <Epa608Upload userId={user.id} />
          </>
        )}
      </section>

      <form action={signOut} className="mt-10 border-t pt-6">
        <Button type="submit" variant="outline" size="xl" className="w-full">
          Sign out
        </Button>
      </form>
    </>
  );
}

export default function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; billing?: string }>;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-black">Your account</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/40" />}>
        <Account searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
