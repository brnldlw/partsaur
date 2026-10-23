import Link from "next/link";
import { connection } from "next/server";
import { startPlanCheckout } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WaitlistForm } from "@/components/waitlist-form";
import { ACTIVE_STATUSES, MAX_BRANCHES, PAID_PLAN_CONFIG, type PaidPlan } from "@/lib/billing";
import { getSpotsLeft } from "@/lib/founding-spots";
import { PLAN_LABELS } from "@/lib/plans";
import { getAccount } from "@/lib/profile";
import { isStripeEnabled } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const SHOP_PERKS = ["Unlimited listings", "Your own storefront page", "Bulk CSV upload", "Priority in Wanted matches"];
const SUPPLY_PERKS: { text: string; soon?: boolean }[] = [
  { text: "Everything in the Shop plan" },
  { text: "Multi-location", soon: true },
  { text: "Dead-stock feed + regional reach", soon: true },
  { text: "Analytics", soon: true },
];

async function viewerState() {
  const { user, profile, business } = await getAccount();
  if (!user) return { kind: "signed_out" as const };
  if (!profile) return { kind: "onboarding" as const };
  if (!business) return { kind: "no_business" as const };
  const { data: b } = await createAdminClient()
    .from("businesses")
    .select("plan, subscription_status")
    .eq("id", business.id)
    .single();
  if (b && b.plan !== "free" && ACTIVE_STATUSES.has(b.subscription_status ?? "active")) {
    return { kind: "subscribed" as const, plan: b.plan as PaidPlan };
  }
  return { kind: "can_buy" as const };
}

function Cta({ plan, viewer, stripeOn }: { plan: PaidPlan; viewer: Awaited<ReturnType<typeof viewerState>>; stripeOn: boolean }) {
  const config = PAID_PLAN_CONFIG[plan];
  if (!stripeOn) {
    return config.founding ? (
      <WaitlistForm plan={plan as "founding_shop" | "founding_supply"} />
    ) : (
      <p className="text-sm text-muted-foreground">Checkout opens soon.</p>
    );
  }
  switch (viewer.kind) {
    case "signed_out":
      return <Button asChild size="xl" className="w-full"><Link href="/login?next=/pricing">Sign in to get started</Link></Button>;
    case "onboarding":
      return <Button asChild size="xl" className="w-full"><Link href="/onboarding">Finish account setup</Link></Button>;
    case "no_business":
      return (
        <div className="flex flex-col gap-2">
          <Button asChild size="xl" variant="outline" className="w-full"><Link href="/account">Add your business first</Link></Button>
          <p className="text-xs text-muted-foreground">In Account, set &quot;I&apos;m a…&quot; to Shop or Supply House.</p>
        </div>
      );
    case "subscribed":
      return (
        <Button asChild size="xl" variant="outline" className="w-full">
          <Link href="/account">{viewer.plan === plan ? "Your current plan" : `You're on ${PLAN_LABELS[viewer.plan]}`}</Link>
        </Button>
      );
    case "can_buy":
      return (
        <form action={startPlanCheckout} className="flex flex-col gap-2">
          <input type="hidden" name="plan" value={plan} />
          {config.perBranch && (
            <label className="flex items-center justify-between gap-3 font-semibold">
              Branches
              <Input type="number" name="branches" min={1} max={MAX_BRANCHES} defaultValue={1} inputMode="numeric" className="h-12 w-24 text-base" />
            </label>
          )}
          <Button type="submit" size="xl" className="w-full">
            {config.founding ? `Lock in $${config.priceCents / 100}/mo` : `Subscribe — $${config.priceCents / 100}/mo${config.perBranch ? " per branch" : ""}`}
          </Button>
        </form>
      );
  }
}

export async function PlanOffer() {
  await connection();
  const [spots, viewer] = await Promise.all([getSpotsLeft(), viewerState()]);
  const stripeOn = isStripeEnabled();

  const cards: { plan: PaidPlan; perks: { text: string; soon?: boolean }[]; spots?: { left: number; cap: number } }[] = [
    spots.founding_shop.left > 0
      ? { plan: "founding_shop", perks: SHOP_PERKS.map((text) => ({ text })), spots: spots.founding_shop }
      : { plan: "shop_pro", perks: SHOP_PERKS.map((text) => ({ text })) },
    spots.founding_supply.left > 0
      ? { plan: "founding_supply", perks: SUPPLY_PERKS, spots: spots.founding_supply }
      : { plan: "supply_house", perks: SUPPLY_PERKS },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map(({ plan, perks, spots: s }) => {
        const config = PAID_PLAN_CONFIG[plan];
        return (
          <div key={plan} className="flex flex-col gap-4 rounded-xl border-2 bg-card p-5">
            <div>
              <h3 className="text-xl font-bold">{config.name}</h3>
              <p className="mt-1">
                <span className="text-4xl font-black">${config.priceCents / 100}</span>
                <span className="text-muted-foreground">
                  /mo{config.perBranch ? " per branch" : ""}{config.founding ? " — locked for life" : ""}
                </span>
              </p>
            </div>

            {s && (
              <div>
                <p className="font-semibold" aria-live="polite">
                  <span className="text-primary">{s.left}</span> of {s.cap} {config.name} spots left
                </p>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(s.left / s.cap) * 100}%` }} />
                </div>
              </div>
            )}

            <ul className="flex flex-col gap-1.5 text-sm">
              {perks.map((p) => (
                <li key={p.text} className="flex gap-2">
                  <span className="text-primary" aria-hidden>✓</span>
                  <span>
                    {p.text}
                    {p.soon && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">coming soon</span>}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-auto"><Cta plan={plan} viewer={viewer} stripeOn={stripeOn} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function PlanOfferSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => <div key={i} className="h-80 animate-pulse rounded-xl border-2 bg-muted/40" />)}
    </div>
  );
}
