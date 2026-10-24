"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_TRADE, getTrade, isCategoryOf } from "@/lib/trades";
import { haveItFromPage, respondHaveIt, respondNo, runWantedMatching, type HaveItResult } from "@/lib/matching";
import { getAccount } from "@/lib/profile";
import { SITE_URL } from "@/lib/site";
import { getBoostPriceId, getStripe, isStripeEnabled } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { WANTED_RADII } from "@/lib/wanted";

export type WantedFormState = { ok: boolean; error?: string };

export async function createWanted(_prev: WantedFormState, formData: FormData): Promise<WantedFormState> {
  const { user, profile } = await getAccount();
  if (!user) redirect("/login?next=/wanted/new");
  if (!profile) redirect("/onboarding");

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const partNumber = get("part_number");
  const brand = get("brand");
  const description = get("description");
  const tradeIn = get("trade");
  const trade = getTrade(tradeIn)?.status === "live" ? tradeIn : getTrade(profile.trade)?.status === "live" ? profile.trade : DEFAULT_TRADE;
  const category = get("category");
  const neededBy = get("needed_by");
  const radius = Number(get("radius_miles") || 150);
  const zip = get("zip") || profile.zip;

  if (!partNumber && !description) return { ok: false, error: "Enter a part number or describe what you need." };
  if (partNumber.length > 80) return { ok: false, error: "Part number is too long." };
  if (brand.length > 80) return { ok: false, error: "Brand is too long." };
  if (description.length > 1000) return { ok: false, error: "Description is too long (max 1000 characters)." };
  if (category && !isCategoryOf(trade, category)) return { ok: false, error: "Pick a category from that trade." };
  if (!(WANTED_RADII as readonly number[]).includes(radius)) return { ok: false, error: "Pick a distance." };
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: "Zip code should be 5 digits." };
  if (neededBy) {
    const d = new Date(neededBy + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(d.getTime()) || d < today) return { ok: false, error: "Needed-by date can't be in the past." };
  }

  const supabase = await createClient();
  const { data: zipRow } = await supabase.from("zip_codes").select("zip").eq("zip", zip).maybeSingle();
  if (!zipRow) return { ok: false, error: `We don't recognize zip code ${zip}.` };

  const { data, error } = await supabase
    .from("wanted_requests")
    .insert({
      requester_id: user.id,
      part_number: partNumber || null,
      brand: brand || null,
      description: description || null,
      category: category || null,
      trade,
      needed_by: neededBy || null,
      radius_miles: radius,
      zip,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("WANTED_LIMIT")) {
      return { ok: false, error: "You can post 5 Wanted requests a day. Try again tomorrow." };
    }
    console.error("wanted insert failed:", error.message);
    return { ok: false, error: "Couldn't post. Please try again." };
  }

  after(() => runWantedMatching(data.id).catch((e) => console.error("wanted matching failed:", e)));
  redirect(`/wanted/${data.id}?new=1`);
}

export async function setWantedStatus(formData: FormData) {
  const { user } = await getAccount();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["open", "filled", "closed"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("wanted_requests").update({ status }).eq("id", id).eq("requester_id", user.id);
  redirect(`/wanted/${id}`);
}

export async function startBoostCheckout(formData: FormData) {
  const { user } = await getAccount();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!isStripeEnabled()) redirect(`/wanted/${id}`);

  const supabase = await createClient();
  const { data: wanted } = await supabase
    .from("wanted_requests")
    .select("id, status")
    .eq("id", id)
    .eq("requester_id", user.id)
    .maybeSingle();
  if (!wanted || wanted.status !== "open") redirect(`/wanted/${id}`);

  const stripe = getStripe();
  const origin = (await headers()).get("origin") ?? SITE_URL;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: await getBoostPriceId(stripe), quantity: 1 }],
    customer_email: user.email,
    metadata: { kind: "wanted_boost", wanted_id: id, user_id: user.id },
    success_url: `${origin}/wanted/${id}?boosted=1`,
    cancel_url: `${origin}/wanted/${id}`,
  });
  redirect(session.url!);
}

/** "I have one" button on a request page (signed-in sellers). */
export async function haveItAction(wantedId: string): Promise<HaveItResult | { ok: false; reason: "sign_in" | "onboarding" }> {
  const { user, profile } = await getAccount();
  if (!user) return { ok: false, reason: "sign_in" };
  if (!profile) return { ok: false, reason: "onboarding" };
  return haveItFromPage(wantedId, user.id);
}

/** Confirm page for the email buttons (a POST, so link scanners can't click it). */
export async function confirmHaveIt(token: string): Promise<HaveItResult> {
  return respondHaveIt(token);
}

export async function confirmNo(token: string) {
  await respondNo(token);
}

export async function unsubscribeWantedEmails(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return false;
  const { data } = await createAdminClient()
    .from("profiles")
    .update({ wanted_pings: false })
    .eq("email_token", token)
    .select("id");
  return Boolean(data?.length);
}
