import type Stripe from "stripe";
import { isFoundingPlan } from "@/lib/founding";
import { runWantedMatching } from "@/lib/matching";
import { BOOST_HOURS } from "@/lib/wanted";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch (err) {
    console.error("Stripe signature check failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const plan = session.metadata?.plan;

    if (session.mode === "subscription" && isFoundingPlan(plan) && session.subscription) {
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null);

      // Upsert on subscription id so Stripe retries don't double-count.
      const { error } = await createAdminClient()
        .from("founding_signups")
        .upsert(
          {
            email: session.customer_details?.email ?? null,
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          },
          { onConflict: "stripe_subscription_id", ignoreDuplicates: true },
        );

      if (error) {
        console.error("founding_signups insert failed:", error.message);
        // 500 tells Stripe to retry later.
        return new Response("DB error", { status: 500 });
      }
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const wantedId = session.metadata?.wanted_id;
    if (session.mode === "payment" && session.metadata?.kind === "wanted_boost" && wantedId && session.payment_status === "paid") {
      const admin = createAdminClient();
      const { data: wanted } = await admin
        .from("wanted_requests")
        .select("boosted_until")
        .eq("id", wantedId)
        .maybeSingle();
      if (wanted) {
        // Stack boosts: extend from the current end if still boosted.
        const start = Math.max(Date.now(), wanted.boosted_until ? Date.parse(wanted.boosted_until) : 0);
        const { error } = await admin
          .from("wanted_requests")
          .update({ boosted_until: new Date(start + BOOST_HOURS * 3600_000).toISOString() })
          .eq("id", wantedId);
        if (error) {
          console.error("boost update failed:", error.message);
          return new Response("DB error", { status: 500 });
        }
        // Wider radius → ping sellers who were out of range before.
        await runWantedMatching(wantedId).catch((e) => console.error("boost matching failed:", e));
      }
    }
  }

  return Response.json({ received: true });
}
