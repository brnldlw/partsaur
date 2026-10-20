"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { getSellerContact, type ContactResult } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";

export function ContactSeller({
  listingId,
  listingTitle,
  signedIn,
}: {
  listingId: string;
  listingTitle: string;
  signedIn: boolean;
}) {
  const [result, setResult] = useState<ContactResult | null>(null);
  const [pending, setPending] = useState(false);
  const next = `/listing/${listingId}`;

  if (!signedIn || (result && !result.ok && result.reason === "sign_in")) {
    return (
      <Button asChild size="xl" className="w-full">
        <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in to contact seller</Link>
      </Button>
    );
  }

  if (!result) {
    return (
      <Button
        type="button"
        size="xl"
        className="w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setResult(await getSellerContact(listingId));
          setPending(false);
        }}
      >
        {pending ? "Loading…" : "Contact seller"}
      </Button>
    );
  }

  if (!result.ok) {
    const messages: Record<string, React.ReactNode> = {
      onboarding: (
        <>Finish setting up your account first. <Link href="/onboarding" className="font-semibold underline">Set up</Link></>
      ),
      not_available: "This listing isn't available anymore.",
      epa608_required: (
        <>
          Refrigerant sales require an approved EPA 608 certification.{" "}
          <Link href="/account#epa608" className="font-semibold underline">Upload your card</Link> — approval usually
          takes a day.
        </>
      ),
      error: "Something went wrong. Try again.",
    };
    return <p role="alert" className="rounded-lg border-2 p-4">{messages[result.reason]}</p>;
  }

  const subject = encodeURIComponent(`Partsaur: ${listingTitle}`);
  const body = encodeURIComponent(`Hi ${result.name}, I saw your listing on Partsaur: ${listingTitle}. Is it still available?\n\n`);
  const smsBody = encodeURIComponent(`Hi, saw your Partsaur listing: ${listingTitle}. Still available?`);

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-primary p-4">
      <p className="font-bold">Contact {result.name}</p>
      {result.phone && (
        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="xl"><a href={`tel:${result.phone}`}><Phone /> Call</a></Button>
          <Button asChild size="xl" variant="outline"><a href={`sms:${result.phone}?&body=${smsBody}`}><MessageSquare /> Text</a></Button>
        </div>
      )}
      <Button asChild size="xl" variant={result.phone ? "outline" : "default"}>
        <a href={`mailto:${result.email}?subject=${subject}&body=${body}`}><Mail /> Email</a>
      </Button>
      <p className="break-all text-sm text-muted-foreground">
        {result.email}
        {result.phone && ` · ${result.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}`}
      </p>
      <p className="text-xs text-muted-foreground">
        Arrange payment and pickup directly. Inspect parts before you pay.
      </p>
    </div>
  );
}
