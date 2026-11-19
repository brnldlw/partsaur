import Link from "next/link";
import { startPlanCheckout } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { getSpotsLeft } from "@/lib/founding-spots";
import { isLaunchPassActive, LAUNCH_PASS_END_LABEL, launchPassDaysLeft } from "@/lib/launch";
import type { Business, Profile } from "@/lib/profile";
import { isPaid } from "@/lib/seller";
import { isStripeEnabled } from "@/lib/stripe";

/** Account page: days left on the Free Launch Pass + the Founding upgrade. Hidden for paying accounts. */
export async function LaunchPassCard({
  profile,
  business,
}: {
  profile: Profile;
  business: Business | null;
}) {
  if (!isLaunchPassActive() || isPaid(business)) return null;

  const days = launchPassDaysLeft();
  const spots = await getSpotsLeft();
  const supply = profile.role === "supply_house" || business?.type === "supply_house";
  const plan = supply ? "founding_supply" : "founding_shop";
  const price = supply ? 99 : 19;
  const spotsLeft = spots[plan].left;

  return (
    <section className="mb-8 flex flex-col gap-3 rounded-xl border-2 border-primary bg-primary/10 p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Free Launch Pass</p>
        <p className="mt-1 text-2xl font-black">
          {days} day{days === 1 ? "" : "s"} left
        </p>
        <p className="text-muted-foreground">
          Unlimited listings, bulk CSV upload{business ? ", and your storefront" : ""} — free until {LAUNCH_PASS_END_LABEL}.
          After that you&apos;re on Free (10 active listings). Listings already up stay up.
        </p>
      </div>

      {spotsLeft > 0 ? (
        isStripeEnabled() && business ? (
          <form action={startPlanCheckout}>
            <input type="hidden" name="plan" value={plan} />
            <Button type="submit" size="xl" className="w-full">Lock in Founding ${price}/mo for life</Button>
          </form>
        ) : (
          <Button asChild size="xl" className="w-full">
            <Link href="/pricing#founding">Lock in Founding ${price}/mo for life</Link>
          </Button>
        )
      ) : (
        <Button asChild size="xl" variant="outline" className="w-full"><Link href="/pricing">See plans</Link></Button>
      )}
      <p className="text-sm text-muted-foreground">
        {spotsLeft > 0
          ? `${spotsLeft} Founding spots left. Nothing to do if you'd rather stay free.`
          : "Founding spots are gone. Nothing to do if you'd rather stay free."}
        {!business && spotsLeft > 0 && " Plans are for shops — set “I'm a…” to Shop below to add your business."}
      </p>
    </section>
  );
}
