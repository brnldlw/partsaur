import Link from "next/link";
import { connection } from "next/server";
import { startFoundingCheckout } from "@/app/actions/founding";
import { Button } from "@/components/ui/button";
import { WaitlistForm } from "@/components/waitlist-form";
import { FOUNDING_PLANS, type FoundingPlan } from "@/lib/founding";
import { getSpotsLeft } from "@/lib/founding-spots";
import { isStripeEnabled } from "@/lib/stripe";

const PERKS: Record<FoundingPlan, string[]> = {
  founding_shop: [
    "Unlimited listings",
    "Your own storefront page",
    "Bulk CSV upload",
    "Priority in Wanted matches",
  ],
  founding_supply: [
    "Everything in Founding Shop",
    "Multi-location",
    "Dead-stock feed + regional reach",
    "Analytics",
  ],
};

export async function FoundingOffer() {
  await connection();
  const spots = await getSpotsLeft();
  const stripeOn = isStripeEnabled();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(Object.keys(FOUNDING_PLANS) as FoundingPlan[]).map((plan) => {
        const config = FOUNDING_PLANS[plan];
        const { cap, left } = spots[plan];
        const soldOut = left <= 0;
        return (
          <div key={plan} className="flex flex-col gap-4 rounded-xl border-2 bg-card p-5">
            <div>
              <h3 className="text-xl font-bold">{config.name}</h3>
              <p className="mt-1">
                <span className="text-4xl font-black">${config.priceCents / 100}</span>
                <span className="text-muted-foreground">/mo — locked for life</span>
              </p>
            </div>

            <div>
              <p className="font-semibold" aria-live="polite">
                {soldOut ? (
                  "All Founding spots are taken."
                ) : (
                  <>
                    <span className="text-primary">{left}</span> of {cap} {config.name} spots left
                  </>
                )}
              </p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(left / cap) * 100}%` }} />
              </div>
            </div>

            <ul className="flex flex-col gap-1.5 text-sm">
              {PERKS[plan].map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span className="text-primary" aria-hidden>✓</span>
                  {perk}
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              {soldOut ? (
                <Button asChild size="xl" variant="outline" className="w-full">
                  <Link href="/pricing">See current pricing</Link>
                </Button>
              ) : stripeOn ? (
                <form action={startFoundingCheckout}>
                  <input type="hidden" name="plan" value={plan} />
                  <Button type="submit" size="xl" className="w-full">
                    Lock in ${config.priceCents / 100}/mo
                  </Button>
                </form>
              ) : (
                <WaitlistForm plan={plan} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FoundingOfferSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-80 animate-pulse rounded-xl border-2 bg-muted/40" />
      ))}
    </div>
  );
}
