import { NextResponse, type NextRequest } from "next/server";
import { cleanReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/referrals";

// partsaur.com/r/CODE → remember who sent them, then show the home page.
// The code is attached to the account when they finish signing up.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = cleanReferralCode(raw);
  const res = NextResponse.redirect(new URL("/", request.url), 307);
  if (code) {
    res.cookies.set(REFERRAL_COOKIE, code, {
      maxAge: REFERRAL_COOKIE_DAYS * 86_400,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return res;
}
