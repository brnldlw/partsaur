import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { ACTIVE_STATUSES, isPaidPlan } from "@/lib/billing";
import { isFoundingPlan } from "@/lib/founding";
import { listingTag } from "@/lib/listings";
import { runWantedMatching } from "@/lib/matching";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOST_HOURS } from "@/lib/wanted";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

class RetryLater extends Error {}

/** Plan changes show/hide storefronts and "Sold by" links — refresh those pages now. */
async function refreshBusinessPages(filter: { id?: string; subscriptionId?: string }) {
  let q = createAdminClient().from("businesses").select("id, slug");
  q = filter.id ? q.eq("id", filter.id) : q.eq("stripe_subscription_id", filter.subscriptionId!);
  const { data: b } = await q.maybeSingle();
  if (!b) return;
  if (b.slug) revalidateTag(`shop:${b.slug}`, { expire: 0 });
  const { data: listings } = await createAdminClient().from("listings").select("id").eq("business_id", b.id).eq("status", "active").limit(500);
  for (const l of listings ?? []) revalidateTag(listingTag(l.id), { expire: 0 });
}

function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`${what} failed:`, error.message);
    throw new RetryLater(what);
  }
}

/** Subscription checkout finished → turn the plan on. */
async function onSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const plan = session.metadata?.plan;
  const businessId = session.metadata?.business_id;
  const subscriptionId = idOf(session.subscription);
  const customerId = idOf(session.customer);
  if (!isPaidPlan(plan) || !subscriptionId) return;
  const admin = createAdminClient();

  if (businessId) {
    const quantity = session.metadata?.branches ? Number(session.metadata.branches) : undefined;
    const { error } = await admin
      .from("businesses")
      .update({
        plan,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: "active",
        cancel_at_period_end: false,
        ...(quantity ? { branches: quantity } : {}),
      })
      .eq("id", businessId);
    check(error, "business plan update");
    await refreshBusinessPages({ id: businessId });
  }

  // Founding purchases count toward the cap (presale ones have no business yet).
  if (isFoundingPlan(plan)) {
    const { error } = await admin.from("founding_signups").upsert(
      {
        email: session.customer_details?.email ?? null,
        plan,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        business_id: businessId ?? null,
        status: "active",
      },
      { onConflict: "stripe_subscription_id", ignoreDuplicates: true },
    );
    check(error, "founding_signups insert");
  }

  await admin.from("founding_holds").delete().eq("stripe_session_id", session.id);
}

/** Status / branches / cancellation changed, or the subscription ended. */
async function onSubscriptionChange(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const ended = !ACTIVE_STATUSES.has(sub.status);
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end;

  const update: Record<string, unknown> = {
    subscription_status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    ...(item?.quantity ? { branches: item.quantity } : {}),
  };
  if (ended) update.plan = "free";

  const { error } = await admin.from("businesses").update(update).eq("stripe_subscription_id", sub.id);
  check(error, "subscription sync");
  if (ended) await refreshBusinessPages({ subscriptionId: sub.id });

  if (ended) {
    // Founding price is gone once canceled (the spot isn't given back).
    const { error: fsError } = await admin
      .from("founding_signups")
      .update({ status: "canceled" })
      .eq("stripe_subscription_id", sub.id);
    check(fsError, "founding status update");
  }
}

/** $9 Urgent Wanted Boost paid. */
async function onBoostPaid(session: Stripe.Checkout.Session) {
  const wantedId = session.metadata?.wanted_id;
  if (!wantedId || session.payment_status !== "paid") return;
  const admin = createAdminClient();
  const { data: wanted } = await admin.from("wanted_requests").select("boosted_until").eq("id", wantedId).maybeSingle();
  if (!wanted) return;

  // Stack boosts: extend from the current end if still boosted.
  const start = Math.max(Date.now(), wanted.boosted_until ? Date.parse(wanted.boosted_until) : 0);
  const { error } = await admin
    .from("wanted_requests")
    .update({ boosted_until: new Date(start + BOOST_HOURS * 3600_000).toISOString() })
    .eq("id", wantedId);
  check(error, "boost update");

  // Wider radius → ping sellers who were out of range before.
  await runWantedMatching(wantedId).catch((e) => console.error("boost matching failed:", e));
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (err) {
    console.error("Stripe signature check failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription") await onSubscriptionCheckout(session);
        else if (session.mode === "payment" && session.metadata?.kind === "wanted_boost") await onBoostPaid(session);
        break;
      }
      case "checkout.session.expired":
        // Walked away from checkout → give the Founding spot back.
        await createAdminClient().from("founding_holds").delete().eq("stripe_session_id", event.data.object.id);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscriptionChange(event.data.object);
        break;
    }
  } catch (e) {
    if (e instanceof RetryLater) return new Response("DB error", { status: 500 }); // Stripe retries
    throw e;
  }

  return Response.json({ received: true });
}
