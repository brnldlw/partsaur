"use client";

import { useActionState, useState } from "react";
import { createWanted, type WantedFormState } from "@/app/actions/wanted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoriesFor, isCategoryOf, LIVE_TRADES } from "@/lib/trades";
import { cn } from "@/lib/utils";
import { WANTED_RADII } from "@/lib/wanted";

const fieldClass = "h-12 text-base";
const selectClass =
  "flex h-12 w-full rounded-md border border-input bg-background px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function WantedForm({
  defaults,
}: {
  defaults: { part_number?: string; brand?: string; zip: string; trade: string };
}) {
  const [state, action, pending] = useActionState<WantedFormState, FormData>(createWanted, { ok: false });
  const [radius, setRadius] = useState(150);
  const [trade, setTrade] = useState(defaults.trade);
  const [category, setCategory] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="part_number" className="font-semibold">Part / model number</Label>
          <Input id="part_number" name="part_number" defaultValue={defaults.part_number} maxLength={80}
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            placeholder="ZP36K5E-PFV-830" className={cn(fieldClass, "font-mono")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand" className="font-semibold">Brand</Label>
          <Input id="brand" name="brand" defaultValue={defaults.brand} maxLength={80} placeholder="Copeland" className={fieldClass} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description" className="font-semibold">
          What is it? <span className="font-normal text-muted-foreground">(required if no part #)</span>
        </Label>
        <textarea id="description" name="description" maxLength={1000} rows={3}
          placeholder="3 ton R-410A scroll, 208/230 1ph. Will take an equivalent."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Trade</legend>
        <input type="hidden" name="trade" value={trade} />
        <div className="flex flex-wrap gap-2">
          {LIVE_TRADES.map((t) => (
            <button key={t.value} type="button" aria-pressed={trade === t.value}
              onClick={() => { setTrade(t.value); if (!isCategoryOf(t.value, category)) setCategory(""); }}
              className={cn("flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold",
                trade === t.value ? "border-primary bg-primary/10 text-primary" : "hover:border-foreground/30")}>
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category" className="font-semibold">Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="">Not sure</option>
            {categoriesFor(trade).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="needed_by" className="font-semibold">Needed by <span className="font-normal text-muted-foreground">(blank = ASAP)</span></Label>
          <Input id="needed_by" name="needed_by" type="date" min={today} className={fieldClass} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">How far would you drive?</legend>
        <input type="hidden" name="radius_miles" value={radius} />
        <div className="flex flex-wrap gap-2">
          {WANTED_RADII.map((r) => (
            <button key={r} type="button" onClick={() => setRadius(r)} aria-pressed={radius === r}
              className={cn("flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold",
                radius === r ? "border-primary bg-primary/10 text-primary" : "hover:border-foreground/30")}>
              {r} mi
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="zip" className="font-semibold">From zip</Label>
        <Input id="zip" name="zip" defaultValue={defaults.zip} inputMode="numeric" pattern="\d{5}" maxLength={5}
          required className={fieldClass} />
      </div>

      <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        Your request is public (first name and rough distance only). We&apos;ll email sellers nearby who
        have it. When a seller says they have it, we send you their contact info and share your email
        with them.
      </p>

      {state.error && <p role="alert" className="font-medium text-destructive">{state.error}</p>}
      <Button type="submit" size="xl" disabled={pending}>{pending ? "Posting…" : "Post Wanted request"}</Button>
    </form>
  );
}
