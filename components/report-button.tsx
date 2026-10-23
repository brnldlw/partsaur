"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { reportListing, type ReportState } from "@/app/actions/reports";
import { RadioCard } from "@/components/radio-card";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS } from "@/lib/reports";

export function ReportButton({ listingId, signedIn }: { listingId: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState<ReportState, FormData>(reportListing, { ok: false });

  if (state.ok) {
    return <p role="status" className="text-sm text-muted-foreground">Thanks — we&apos;ll take a look.</p>;
  }
  if (!open) {
    return signedIn ? (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start py-2 text-sm text-muted-foreground underline">
        <Flag className="size-4" /> Report this listing
      </button>
    ) : (
      <Link href={`/login?next=${encodeURIComponent(`/listing/${listingId}`)}`}
        className="flex items-center gap-1.5 self-start py-2 text-sm text-muted-foreground underline">
        <Flag className="size-4" /> Report this listing
      </Link>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border-2 p-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <p className="font-bold">What&apos;s wrong with this listing?</p>
      <div className="grid gap-2">
        {REPORT_REASONS.map((r) => (
          <RadioCard key={r.value} name="reason" value={r.value} checked={reason === r.value}
            onSelect={() => setReason(r.value)} label={r.label} />
        ))}
      </div>
      <textarea name="note" maxLength={1000} rows={2} placeholder="Anything we should know? (optional)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" />
      {state.error && <p role="alert" className="font-medium text-destructive">{state.error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" size="xl" disabled={!reason || pending}>{pending ? "Sending…" : "Send report"}</Button>
        <Button type="button" size="xl" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
