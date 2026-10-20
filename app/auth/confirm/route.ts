import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";

// Handles every way back from Supabase Auth:
//  - ?token_hash=&type=  (login email link — works even if opened in a different browser)
//  - ?code=              (Google sign-in, or the default Supabase email template)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: searchParams.get("error_description") ?? "Login link is missing or expired." };
  }

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next);
}
