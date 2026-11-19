export const REFERRAL_COOKIE = "ps_ref";
export const REFERRAL_COOKIE_DAYS = 60;

/** Codes are 6 characters from an alphabet without look-alikes. */
export function cleanReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : null;
}

export function referralLink(siteUrl: string, code: string) {
  return `${siteUrl.replace(/\/$/, "")}/r/${code}`;
}
