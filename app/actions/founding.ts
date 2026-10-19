"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isFoundingPlan } from "@/lib/founding";
import { getSpotsLeft } from "@/lib/founding-spots";
import { SITE_URL } from "@/lib/site";
import { getFoundingPriceId, getStripe, isStripeEnabled } from "@/lib/stripe";

export async function startFoundingCheckout(formData: FormData) {
  const plan = formData.get("plan");
  if (!isFoundingPlan(plan) || !isStripeEnabled()) redirect("/pricing");

  const spots = await getSpotsLeft();
  if (spots[plan].left <= 0) redirect("/pricing?soldout=" + plan);

  const stripe = getStripe();
  const origin = (await headers()).get("origin") ?? SITE_URL;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: await getFoundingPriceId(stripe, plan), quantity: 1 }],
    metadata: { plan },
    subscription_data: { metadata: { plan } },
    allow_promotion_codes: false,
    success_url: `${origin}/founding/success?plan=${plan}`,
    cancel_url: `${origin}/pricing`,
  });

  redirect(session.url!);
}
