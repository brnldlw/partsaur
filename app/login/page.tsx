import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { LoginForm } from "@/components/login-form";
import { isGoogleEnabled, safeNext } from "@/lib/auth";
import { cleanReferralCode, REFERRAL_COOKIE } from "@/lib/referrals";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, googleEnabled, jar] = await Promise.all([searchParams, isGoogleEnabled(), cookies()]);
  const referralCode = cleanReferralCode(jar.get(REFERRAL_COOKIE)?.value);
  return <LoginForm next={safeNext(next)} googleEnabled={googleEnabled} referralCode={referralCode} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-black">Sign in to Partsaur</h1>
      <p className="mb-6 mt-2 text-muted-foreground">
        Free for techs and buyers. We&apos;ll email you a link — no password to remember.
      </p>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted/40" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
