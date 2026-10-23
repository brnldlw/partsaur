import { createClient } from "@/lib/supabase/server";
import type { BusinessType, Plan } from "@/lib/plans";
import type { Role, Trade } from "@/lib/site";

export type Profile = {
  id: string;
  display_name: string;
  phone: string | null;
  trade: Trade;
  role: Role;
  business_id: string | null;
  zip: string;
  epa608_verified: boolean;
  show_phone: boolean;
  wanted_pings: boolean;
};

export type Business = {
  id: string;
  name: string;
  type: BusinessType;
  address: string | null;
  zip: string | null;
  plan: Plan;
  slug: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  branches: number;
};

/** Signed-in user plus their profile and business (null if not set up yet). */
export async function getAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, business: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, phone, trade, role, business_id, zip, epa608_verified, show_phone, wanted_pings")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  let business: Business | null = null;
  if (profile?.business_id) {
    const { data } = await supabase
      .from("businesses")
      .select("id, name, type, address, zip, plan, slug, stripe_customer_id, subscription_status, current_period_end, cancel_at_period_end, branches")
      .eq("id", profile.business_id)
      .maybeSingle<Business>();
    business = data;
  }

  return { user, profile, business };
}
