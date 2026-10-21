"use client";

import { useActionState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { createPartAlert, type AlertState } from "@/app/actions/alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NotifyForm({
  partNumber,
  brand,
  partId,
  defaultEmail,
  defaultZip,
  editablePartNumber = false,
}: {
  partNumber: string;
  brand?: string | null;
  partId?: string | null;
  defaultEmail?: string | null;
  defaultZip?: string | null;
  editablePartNumber?: boolean;
}) {
  const [state, action, pending] = useActionState<AlertState, FormData>(createPartAlert, { ok: false });

  if (state.ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" />
        <p>
          <span className="font-bold">You&apos;re on the list.</span>{" "}
          <span className="text-muted-foreground">We&apos;ll email you when one gets listed.</span>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border-2 bg-card p-4">
      <p className="flex items-center gap-2 text-lg font-bold">
        <BellRing className="size-5 text-primary" /> Need this part? Get notified when one&apos;s listed.
      </p>
      {partId && <input type="hidden" name="part_id" value={partId} />}
      {brand && <input type="hidden" name="brand" value={brand} />}
      {editablePartNumber ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="alert-pn" className="font-semibold">Part number</Label>
          <Input id="alert-pn" name="part_number" defaultValue={partNumber} maxLength={80} required
            className="h-12 font-mono text-base" />
        </div>
      ) : (
        <input type="hidden" name="part_number" value={partNumber} />
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="alert-email" className="font-semibold">Email</Label>
          <Input id="alert-email" name="email" type="email" required defaultValue={defaultEmail ?? ""}
            autoComplete="email" inputMode="email" placeholder="you@shop.com" className="h-12 text-base" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="alert-zip" className="font-semibold">Zip</Label>
          <Input id="alert-zip" name="zip" defaultValue={defaultZip ?? ""} inputMode="numeric" pattern="\d{5}"
            maxLength={5} placeholder="12345" className="h-12 text-base" />
        </div>
      </div>
      {state.error && <p role="alert" className="font-medium text-destructive">{state.error}</p>}
      <Button type="submit" size="xl" disabled={pending}>{pending ? "Saving…" : "Notify me"}</Button>
    </form>
  );
}
