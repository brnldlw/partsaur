import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { getAccount } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false },
};

async function Onboarding() {
  const { user, profile } = await getAccount();
  if (!user) redirect("/login?next=/onboarding");
  if (profile) redirect("/account");
  return <ProfileForm mode="onboarding" />;
}

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-black">Welcome to Partsaur</h1>
      <p className="mb-8 mt-2 text-muted-foreground">
        A few quick questions so we can show you parts nearby.
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/40" />}>
        <Onboarding />
      </Suspense>
    </div>
  );
}
