/**
 * Free Launch Pass: every account gets paid seller features (unlimited
 * listings, bulk CSV upload, storefront) until the end of March 31, 2027,
 * US Eastern. Keep in sync with public.launch_pass_active() in
 * supabase/migrations/0010_launch_promo.sql.
 */
export const LAUNCH_PASS_ENDS_AT = new Date("2027-04-01T04:00:00Z"); // midnight Eastern (EDT)
export const LAUNCH_PASS_END_LABEL = "March 31";
export const LAUNCH_PASS_END_LABEL_LONG = "March 31, 2027";

export const FOUNDING_SELLER_CAP = 100;

export function isLaunchPassActive(now = Date.now()) {
  return now < LAUNCH_PASS_ENDS_AT.getTime();
}

/** Whole days left, counting today. 0 once it's over. */
export function launchPassDaysLeft(now = Date.now()) {
  const ms = LAUNCH_PASS_ENDS_AT.getTime() - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
