import type Stripe from "stripe";
import { isFoundingPlan } from "@/lib/founding";
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

  return Response.json({ received: true });
}
