import Stripe from "stripe";
import { FOUNDING_PLANS, type FoundingPlan } from "@/lib/founding";

export function isStripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * Finds the monthly price for a Founding plan by its lookup key, creating the
 * product + price in Stripe the first time. No price IDs to copy around.
 */
export async function getFoundingPriceId(stripe: Stripe, plan: FoundingPlan) {
  const config = FOUNDING_PLANS[plan];
  const existing = await stripe.prices.list({
    lookup_keys: [config.lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: config.priceCents,
    recurring: { interval: "month" },
    lookup_key: config.lookupKey,
    product_data: { name: `Partsaur ${config.name}` },
  });
  return price.id;
}
