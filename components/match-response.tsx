"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { confirmHaveIt, confirmNo } from "@/app/actions/wanted";
import { Button } from "@/components/ui/button";

type Result = Awaited<ReturnType<typeof confirmHaveIt>>;

export function MatchResponse({ token, answer, label }: { token: string; answer: "yes" | "no"; label: string }) {
  const [result, setResult] = useState<Result | "no" | null>(null);
  const [pending, setPending] = useState(false);

  if (result === "no") {
    return <p role="status" className="rounded-xl border-2 p-4 font-semibold">Got it — we won&apos;t ask you about this one again.</p>;
  }
  if (result?.ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" />
        <div>
          <p className="text-lg font-bold">
            {result.alreadySent ? "Already sent." : `We sent ${result.requester.name} your contact info.`}
          </p>
          <p className="text-muted-foreground">
            They&apos;ll reach out. Or email them first:{" "}
            <a className="break-all font-semibold underline"
              href={`mailto:${result.requester.email}?subject=${encodeURIComponent(`Partsaur: I have ${result.label}`)}`}>
              {result.requester.email}
            </a>
          </p>
        </div>
      </div>
    );
  }
  if (result && !result.ok) {
    const msg = { closed: "This request is closed — they already found one. Thanks anyway!", not_found: "This link isn't valid anymore.", own_request: "This is your own request." };
    return <p role="alert" className="rounded-xl border-2 p-4">{msg[result.reason]}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="xl" disabled={pending} variant={answer === "yes" ? "default" : "outline"}
        onClick={async () => { setPending(true); setResult(await confirmHaveIt(token)); setPending(false); }}>
        {pending ? "Sending…" : `Yes, I have ${label}`}
      </Button>
      <Button size="xl" disabled={pending} variant={answer === "no" ? "default" : "outline"}
        onClick={async () => { setPending(true); await confirmNo(token); setResult("no"); setPending(false); }}>
        No, I don&apos;t have it
      </Button>
      <p className="text-sm text-muted-foreground">
        Saying yes sends them your name, email, and phone (if you&apos;ve chosen to show it).
      </p>
    </div>
  );
}
