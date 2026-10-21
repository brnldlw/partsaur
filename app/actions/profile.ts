"use server";

import { redirect } from "next/navigation";
import { BUSINESS_TYPES } from "@/lib/plans";
import { ROLES, TRADES } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok: boolean; error?: string };

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export async function saveProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const mode = get("mode");
  const displayName = get("display_name");
  const phone = normalizePhone(get("phone"));
  const trade = get("trade");
  const role = get("role");
  const zip = get("zip");

  if (!displayName || displayName.length > 80) return { ok: false, error: "Enter your name." };
  if (phone && phone.length !== 10) return { ok: false, error: "Phone should be 10 digits." };
  const showPhone = formData.get("show_phone") === "on";
  if (showPhone && !phone) return { ok: false, error: "Add a phone number to show it to buyers." };
  if (!TRADES.some((t) => t.value === trade)) return { ok: false, error: "Pick a trade." };
  if (!ROLES.some((r) => r.value === role)) return { ok: false, error: "Pick your role." };
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: "Zip code should be 5 digits." };

  const isBusiness = role !== "tech";
  const businessName = get("business_name");
  const businessType = get("business_type");
  const businessAddress = get("business_address");
  const businessZip = get("business_zip") || zip;

  if (isBusiness) {
    if (!businessName || businessName.length > 120) return { ok: false, error: "Enter your business name." };
    if (!BUSINESS_TYPES.some((t) => t.value === businessType)) return { ok: false, error: "Pick a business type." };
    if (businessAddress.length > 200) return { ok: false, error: "Address is too long." };
    if (!/^\d{5}$/.test(businessZip)) return { ok: false, error: "Business zip should be 5 digits." };
  }

  const zipsToCheck = [...new Set(isBusiness ? [zip, businessZip] : [zip])];
  const { data: knownZips } = await supabase.from("zip_codes").select("zip").in("zip", zipsToCheck);
  for (const z of zipsToCheck) {
    if (!knownZips?.some((k) => k.zip === z)) {
      return { ok: false, error: `We don't recognize zip code ${z}. Double-check it.` };
    }
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .maybeSingle();

  let businessId: string | null = existing?.business_id ?? null;

  if (isBusiness) {
    const business = {
      name: businessName,
      type: businessType,
      address: businessAddress || null,
      zip: businessZip,
    };
    if (businessId) {
      const { error } = await supabase.from("businesses").update(business).eq("id", businessId);
      if (error) return fail("business update", error.message);
    } else {
      const { data, error } = await supabase
        .from("businesses")
        .insert({ ...business, owner_id: user.id })
        .select("id")
        .single();
      if (error) return fail("business insert", error.message);
      businessId = data.id;
    }
  }

  // Switching to "tech" keeps the business linked so nothing is lost.
  const profile = {
    display_name: displayName,
    phone: phone || null,
    show_phone: showPhone,
    wanted_pings: formData.get("wanted_pings") === "on",
    trade,
    role,
    business_id: businessId,
    zip,
  };
  const { error } = existing
    ? await supabase.from("profiles").update(profile).eq("id", user.id)
    : await supabase.from("profiles").insert({ ...profile, id: user.id });
  if (error) return fail("profile save", error.message);

  if (mode === "onboarding") redirect("/account?welcome=1");
  return { ok: true };
}

function fail(step: string, message: string): ProfileState {
  console.error(`${step} failed:`, message);
  return { ok: false, error: "Couldn't save. Please try again." };
}
