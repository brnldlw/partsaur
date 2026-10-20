"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard } from "@/components/radio-card";
import { FOUNDING_PLANS, type FoundingPlan } from "@/lib/founding";
import { ROLES, TRADES, type Trade } from "@/lib/site";

/**
 * Plain waitlist (trade + role + email + zip), or — when `plan` is given —
 * a "Reserve your Founding spot" form used before Stripe is switched on.
 */
export function WaitlistForm({ plan }: { plan?: FoundingPlan }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlist,
    { ok: false },
  );
  const [trade, setTrade] = useState<Trade>("hvacr");
  const [role, setRole] = useState<string>(plan ? FOUNDING_PLANS[plan].role : "tech");
  const id = plan ?? "waitlist";

  if (state.ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border-2 border-primary bg-primary/10 p-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" />
        <div>
          <p className="text-lg font-bold">
            {plan ? "Your spot is reserved." : "You're on the list."}
          </p>
          <p className="text-muted-foreground">
            {plan
              ? `We'll email you when ${FOUNDING_PLANS[plan].name} checkout opens. Your spot is held at the Founding price.`
              : trade === "hvacr"
                ? "We'll email you the day Partsaur opens in your area."
                : "We'll email you when your trade opens up."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {plan ? (
        <>
          <input type="hidden" name="trade" value="hvacr" />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="plan_interest" value={plan} />
        </>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Your trade</legend>
            <div className="grid grid-cols-3 gap-2">
              {TRADES.map((t) => (
                <RadioCard
                  key={t.value}
                  name="trade"
                  value={t.value}
                  checked={trade === t.value}
                  onSelect={() => setTrade(t.value)}
                  label={t.label}
                  sublabel={t.status}
                  highlightSublabel={t.status === "Launching"}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">I&apos;m a…</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <RadioCard
                  key={r.value}
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onSelect={() => setRole(r.value)}
                  label={r.label}
                />
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-email`} className="font-semibold">Email</Label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@shop.com"
            className="h-12 text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-zip`} className="font-semibold">Zip code</Label>
          <Input
            id={`${id}-zip`}
            name="zip"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            autoComplete="postal-code"
            placeholder="12345"
            className="h-12 text-base"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="font-medium text-destructive">{state.error}</p>
      )}

      <Button type="submit" size="xl" disabled={pending} className="w-full">
        {pending ? "Saving…" : plan ? "Reserve my spot" : "Join the waitlist"}
      </Button>
    </form>
  );
}
