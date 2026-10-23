import Link from "next/link";
import { openBillingPortal } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { PAID_PLAN_CONFIG } from "@/lib/billing";
import { PLAN_LABELS } from "@/lib/plans";
import type { Business, Profile } from "@/lib/profile";
import { isStripeEnabled } from "@/lib/stripe";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const BANNERS: Record<string, string> = {
  need_business: "Add your business first: set “I'm a…” to Shop or Supply House below and save.",
  already_subscribed: "You already have a plan. Use Manage billing to change it.",
  portal_error: "Couldn't open billing. Try again in a minute.",
};

export function BillingCard({
  profile,
  business,
  email,
  billing,
}: {
  profile: Profile;
  business: Business | null;
  email: string;
  billing?: string;
}) {
  const plan = business?.plan ?? "free";
  const paid = plan !== "free";
  const isFounding = plan === "founding_shop" || plan === "founding_supply";
  const status = business?.subscription_status;

  return (
    <section className="mb-8 flex flex-col gap-3 rounded-xl border-2 bg-card p-5">
      {billing === "success" && (
        <p role="status" className="rounded-lg border-2 border-primary bg-primary/10 p-3 font-semibold">
          {paid ? `You're on ${PLAN_LABELS[plan]}. Thanks for backing Partsaur!` : "Payment received — your plan turns on in a few seconds. Refresh if it hasn't."}
        </p>
      )}
      {billing && BANNERS[billing] && <p role="alert" className="rounded-lg border-2 p-3 font-semibold">{BANNERS[billing]}</p>}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Plan</p>
        <p className="mt-1 text-2xl font-black">
          {PLAN_LABELS[plan]}
          {isFounding && <span className="ml-2 text-base font-semibold text-primary">— price locked</span>}
        </p>
        {business && <p className="text-muted-foreground">{business.name}</p>}
      </div>

      {paid && business && (
        <div className="text-sm text-muted-foreground">
          <p>
            ${(PAID_PLAN_CONFIG[plan].priceCents / 100) * (PAID_PLAN_CONFIG[plan].perBranch ? business.branches : 1)}/mo
            {PAID_PLAN_CONFIG[plan].perBranch && ` · ${business.branches} branch${business.branches === 1 ? "" : "es"}`}
            {business.current_period_end && !business.cancel_at_period_end && ` · renews ${date(business.current_period_end)}`}
          </p>
          {status === "past_due" && (
            <p className="mt-2 rounded-lg border-2 border-destructive p-3 font-semibold text-destructive">
              Your last payment didn&apos;t go through. Update your card in Manage billing to keep your plan.
            </p>
          )}
          {business.cancel_at_period_end && business.current_period_end && (
            <p className="mt-2 rounded-lg border-2 p-3 font-semibold text-foreground">
              Canceled — your plan stays on until {date(business.current_period_end)}.
              {isFounding && " After that, the Founding price can't be restarted."}
            </p>
          )}
        </div>
      )}

      {!paid && (
        <p className="text-muted-foreground">
          {profile.role === "tech" && !business
            ? "Free: search, message sellers, post Wanted requests, and up to 10 listings."
            : "Free: up to 10 active listings. Go unlimited with bulk upload and your own storefront."}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {business?.stripe_customer_id && isStripeEnabled() && (
          <form action={openBillingPortal} className="sm:flex-1">
            <Button type="submit" size="xl" variant="outline" className="w-full">Manage billing</Button>
          </form>
        )}
        {!paid && (
          <Button asChild size="xl" className="sm:flex-1"><Link href="/pricing">See plans</Link></Button>
        )}
        {paid && business?.slug && (
          <Button asChild size="xl" variant="outline" className="sm:flex-1"><Link href={`/shop/${business.slug}`}>Your storefront</Link></Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Signed in as {email}</p>
    </section>
  );
}
