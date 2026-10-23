import Stripe from "stripe";
import { PAID_PLAN_CONFIG, type PaidPlan } from "@/lib/billing";
import { BOOST_PRICE_CENTS } from "@/lib/wanted";

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
 * Finds the monthly price for a plan by its lookup key, creating the product +
 * price in Stripe the first time. No price IDs to copy around.
 */
export async function getPlanPriceId(stripe: Stripe, plan: PaidPlan) {
  const config = PAID_PLAN_CONFIG[plan];
  const existing = await stripe.prices.list({ lookup_keys: [config.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: config.priceCents,
    recurring: { interval: "month" },
    lookup_key: config.lookupKey,
    product_data: { name: `Partsaur ${config.name}${config.perBranch ? " (per branch)" : ""}` },
  });
  return price.id;
}

/** One-time $9 Urgent Wanted Boost price, created on first use. */
export async function getBoostPriceId(stripe: Stripe) {
  const lookupKey = "wanted_boost_once";
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: BOOST_PRICE_CENTS,
    lookup_key: lookupKey,
    product_data: { name: "Partsaur Urgent Wanted Boost (72 hours)" },
  });
  return price.id;
}
