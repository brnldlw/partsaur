"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_STATUSES, MAX_BRANCHES, PAID_PLAN_CONFIG, isPaidPlan } from "@/lib/billing";
import { getSpotsLeft } from "@/lib/founding-spots";
import { isFoundingPlan } from "@/lib/founding";
import { getAccount } from "@/lib/profile";
import { SITE_URL } from "@/lib/site";
import { getPlanPriceId, getStripe, isStripeEnabled } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const HOLD_MINUTES = 30; // Stripe's shortest checkout expiry

export async function startPlanCheckout(formData: FormData) {
  const plan = formData.get("plan");
  if (!isPaidPlan(plan) || !isStripeEnabled()) redirect("/pricing");

  const { user, profile, business } = await getAccount();
  if (!user) redirect("/login?next=/pricing");
  if (!profile) redirect("/onboarding");
  if (!business) redirect("/account?billing=need_business");

  const admin = createAdminClient();
  const { data: b } = await admin
    .from("businesses")
    .select("id, plan, stripe_customer_id, subscription_status")
    .eq("id", business.id)
    .single();
  if (b && b.plan !== "free" && ACTIVE_STATUSES.has(b.subscription_status ?? "active")) {
    redirect("/account?billing=already_subscribed");
  }

  const config = PAID_PLAN_CONFIG[plan];
  // Shop Pro / Supply House only open up once the Founding spots are gone.
  const spots = await getSpotsLeft();
  if (!config.founding) {
    const founding = config.audience === "shop" ? "founding_shop" : "founding_supply";
    if (spots[founding].left > 0) redirect("/pricing");
  }

  const branches = config.perBranch
    ? Math.min(MAX_BRANCHES, Math.max(1, Math.floor(Number(formData.get("branches")) || 1)))
    : 1;

  // Hold a Founding spot for the length of checkout.
  let holdId: string | null = null;
  if (isFoundingPlan(plan)) {
    const { data } = await admin.rpc("reserve_founding_spot", { p_plan: plan, p_minutes: HOLD_MINUTES });
    if (!data) redirect("/pricing?soldout=" + plan);
    holdId = data as string;
  }

  const stripe = getStripe();
  const origin = (await headers()).get("origin") ?? SITE_URL;
  const metadata = { kind: "plan", plan, business_id: business.id, user_id: user.id, branches: String(branches) };
  let url: string;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: await getPlanPriceId(stripe, plan), quantity: branches }],
      ...(b?.stripe_customer_id ? { customer: b.stripe_customer_id } : { customer_email: user.email }),
      client_reference_id: business.id,
      metadata,
      subscription_data: { metadata },
      expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60 + 60,
      success_url: `${origin}/account?billing=success`,
      cancel_url: `${origin}/pricing`,
    });
    url = session.url!;
    if (holdId) await admin.from("founding_holds").update({ stripe_session_id: session.id }).eq("id", holdId);
  } catch (e) {
    if (holdId) await admin.from("founding_holds").delete().eq("id", holdId);
    console.error("checkout session failed:", e);
    redirect("/pricing?error=checkout");
  }
  redirect(url);
}

export async function openBillingPortal() {
  const { user, business } = await getAccount();
  if (!user) redirect("/login?next=/account");
  if (!business || !isStripeEnabled()) redirect("/account");

  const { data: b } = await createAdminClient()
    .from("businesses")
    .select("stripe_customer_id")
    .eq("id", business.id)
    .single();
  if (!b?.stripe_customer_id) redirect("/pricing");

  const origin = (await headers()).get("origin") ?? SITE_URL;
  let url: string;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: b.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    url = session.url;
  } catch (e) {
    console.error("billing portal failed:", e);
    redirect("/account?billing=portal_error");
  }
  redirect(url);
}
