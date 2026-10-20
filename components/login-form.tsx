"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = () =>
    `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });
    setPending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many login emails right now. Wait a minute and try again."
          : error.message,
      );
    } else {
      setSent(true);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setPending(false);
      setError("That code didn't work. Check it, or request a new email.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function google() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-lg border-2 border-primary bg-primary/10 p-4">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-lg font-bold">Check your email</p>
            <p className="text-muted-foreground">
              We sent a login link to <span className="font-semibold text-foreground">{email}</span>.
              Tap it — or type the code from the email below.
            </p>
          </div>
        </div>
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <Label htmlFor="code" className="font-semibold">Login code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="123456"
            className="h-12 text-center text-2xl tracking-[0.3em]"
            required
          />
          {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
          <Button type="submit" size="xl" disabled={pending || code.length < 6}>
            {pending ? "Checking…" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setCode("");
            setError(null);
          }}
          className="py-2 text-sm text-muted-foreground underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {googleEnabled && (
        <>
          <Button type="button" size="xl" variant="outline" onClick={google}>
            <GoogleIcon />
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <Label htmlFor="email" className="font-semibold">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          placeholder="you@shop.com"
          className="h-12 text-base"
          required
        />
        {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
        <Button type="submit" size="xl" disabled={pending}>
          {pending ? "Sending…" : "Email me a login link"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        No password needed. New here? This creates your free account.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
