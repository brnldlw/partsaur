"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ProfileState } from "@/app/actions/profile";
import { RadioCard } from "@/components/radio-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/plans";
import type { Business, Profile } from "@/lib/profile";
import { ROLES, TRADES, type Role, type Trade } from "@/lib/site";

const DEFAULT_BUSINESS_TYPE: Record<Role, BusinessType> = {
  tech: "contractor",
  shop: "contractor",
  supply_house: "supply_house",
};

function Field({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      <Input id={id} name={id} className="h-12 text-base" {...props} />
    </div>
  );
}

export function ProfileForm({
  mode,
  profile,
  business,
}: {
  mode: "onboarding" | "account";
  profile?: Profile | null;
  business?: Business | null;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {
    ok: false,
  });
  const [trade, setTrade] = useState<Trade>(profile?.trade ?? "hvacr");
  const [role, setRole] = useState<Role>(profile?.role ?? "tech");
  const [businessType, setBusinessType] = useState<BusinessType>(
    business?.type ?? DEFAULT_BUSINESS_TYPE[role],
  );
  const isBusiness = role !== "tech";

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="mode" value={mode} />

      <Field
        id="display_name"
        label="Your name"
        defaultValue={profile?.display_name}
        autoComplete="name"
        maxLength={80}
        required
      />
      <Field
        id="phone"
        label="Phone"
        hint="(optional)"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="555-555-5555"
        defaultValue={profile?.phone ?? ""}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Your trade</legend>
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
        {trade !== "hvacr" && (
          <p className="text-sm text-muted-foreground">
            We&apos;re opening HVAC/R first. Your account is ready — we&apos;ll email you when your
            trade opens up.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">I&apos;m a…</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <RadioCard
              key={r.value}
              name="role"
              value={r.value}
              checked={role === r.value}
              onSelect={() => {
                setRole(r.value);
                if (!business) setBusinessType(DEFAULT_BUSINESS_TYPE[r.value]);
              }}
              label={r.label}
            />
          ))}
        </div>
      </fieldset>

      <Field
        id="zip"
        label="Your zip code"
        hint="(used to find parts near you)"
        inputMode="numeric"
        pattern="\d{5}"
        maxLength={5}
        autoComplete="postal-code"
        placeholder="12345"
        defaultValue={profile?.zip}
        required
      />

      {isBusiness && (
        <section className="flex flex-col gap-5 rounded-xl border-2 p-4">
          <h2 className="text-lg font-bold">Business</h2>
          <Field
            id="business_name"
            label="Business name"
            defaultValue={business?.name}
            autoComplete="organization"
            maxLength={120}
            required
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold">Business type</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((t) => (
                <RadioCard
                  key={t.value}
                  name="business_type"
                  value={t.value}
                  checked={businessType === t.value}
                  onSelect={() => setBusinessType(t.value)}
                  label={t.label}
                />
              ))}
            </div>
          </fieldset>
          <Field
            id="business_address"
            label="Street address"
            hint="(optional)"
            autoComplete="street-address"
            maxLength={200}
            defaultValue={business?.address ?? ""}
          />
          <Field
            id="business_zip"
            label="Business zip"
            hint="(if different from yours)"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            placeholder="12345"
            defaultValue={business?.zip ?? ""}
          />
        </section>
      )}

      {state.error && <p role="alert" className="font-medium text-destructive">{state.error}</p>}
      {state.ok && <p role="status" className="font-medium text-primary">Saved.</p>}

      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Saving…" : mode === "onboarding" ? "Finish setup" : "Save changes"}
      </Button>
    </form>
  );
}
