"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, MessageSquare, Phone } from "lucide-react";
import { getSellerContact, type ContactResult } from "@/app/actions/listings";
import { startListingConversation } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";

const CONTACT_ERRORS: Record<string, React.ReactNode> = {
  onboarding: (
    <>Finish setting up your account first. <Link href="/onboarding" className="font-semibold underline">Set up</Link></>
  ),
  not_available: "This listing isn't available anymore.",
  own_listing: "This is your listing.",
  epa608_required: (
    <>
      Refrigerant sales require an approved EPA 608 certification.{" "}
      <Link href="/account#epa608" className="font-semibold underline">Upload your card</Link> — approval usually takes a day.
    </>
  ),
  error: "Something went wrong. Try again.",
};

export function ContactSeller({
  listingId,
  listingTitle,
  signedIn,
  error,
}: {
  listingId: string;
  listingTitle: string;
  signedIn: boolean;
  /** From ?contact= after a failed "Message seller". */
  error?: string;
}) {
  const [phone, setPhone] = useState<ContactResult | null>(null);
  const [pending, setPending] = useState(false);

  if (!signedIn) {
    return (
      <Button asChild size="xl" className="w-full">
        <Link href={`/login?next=${encodeURIComponent(`/listing/${listingId}`)}`}>Sign in to message seller</Link>
      </Button>
    );
  }

  const smsBody = encodeURIComponent(`Hi, saw your Partsaur listing: ${listingTitle}. Still available?`);
  const phoneError = phone && !phone.ok ? phone.reason : null;
  const shownError = error ?? phoneError;

  return (
    <div className="flex flex-col gap-2">
      {shownError && <p role="alert" className="rounded-lg border-2 p-4">{CONTACT_ERRORS[shownError] ?? CONTACT_ERRORS.error}</p>}
      <form action={startListingConversation}>
        <input type="hidden" name="listing_id" value={listingId} />
        <Button type="submit" size="xl" className="w-full"><MessageCircle /> Message seller</Button>
      </form>

      {!phone ? (
        <Button type="button" variant="outline" size="xl" disabled={pending}
          onClick={async () => {
            setPending(true);
            setPhone(await getSellerContact(listingId));
            setPending(false);
          }}>
          <Phone /> {pending ? "Loading…" : "Call or text"}
        </Button>
      ) : phone.ok && phone.phone ? (
        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="xl" variant="outline"><a href={`tel:${phone.phone}`}><Phone /> Call {phone.name}</a></Button>
          <Button asChild size="xl" variant="outline"><a href={`sms:${phone.phone}?&body=${smsBody}`}><MessageSquare /> Text</a></Button>
        </div>
      ) : phone.ok ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{phone.name} prefers messages — use Message seller.</p>
      ) : null}

      <p className="text-xs text-muted-foreground">Arrange payment and pickup directly. Inspect parts before you pay.</p>
    </div>
  );
}
