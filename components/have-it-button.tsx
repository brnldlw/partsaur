"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { haveItAction } from "@/app/actions/wanted";
import { Button } from "@/components/ui/button";

type Result = Awaited<ReturnType<typeof haveItAction>>;

export function HaveItButton({ wantedId, signedIn }: { wantedId: string; signedIn: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);

  if (!signedIn || (result && !result.ok && result.reason === "sign_in")) {
    return (
      <Button asChild size="xl" className="w-full">
        <Link href={`/login?next=${encodeURIComponent(`/wanted/${wantedId}`)}`}>Sign in — I have one</Link>
      </Button>
    );
  }

  if (result?.ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" />
        <div>
          <p className="font-bold">We sent {result.requester.name} your contact info.</p>
          <p className="text-muted-foreground">
            They&apos;ll reach out — or email them first:{" "}
            <a className="break-all font-semibold underline" href={`mailto:${result.requester.email}?subject=${encodeURIComponent(`Partsaur: I have ${result.label}`)}`}>
              {result.requester.email}
            </a>
          </p>
          {result.conversationId && (
            <Link href={`/messages/${result.conversationId}`} className="mt-2 inline-block font-semibold text-primary underline">
              Message them on Partsaur
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (result && !result.ok) {
    const msg: Record<string, string> = {
      onboarding: "Finish setting up your account first.",
      closed: "This request is closed — they found one.",
      own_request: "This is your request.",
      not_found: "This request isn't available anymore.",
    };
    return <p role="alert" className="rounded-lg border-2 p-4">{msg[result.reason]}</p>;
  }

  return (
    <Button type="button" size="xl" className="w-full" disabled={pending}
      onClick={async () => {
        setPending(true);
        setResult(await haveItAction(wantedId));
        setPending(false);
      }}>
      {pending ? "Sending…" : "I have one"}
    </Button>
  );
}
