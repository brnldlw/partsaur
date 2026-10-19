import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "You're a Founding member",
  robots: { index: false },
};

export default function FoundingSuccessPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
      <CheckCircle2 className="size-12 text-primary" aria-hidden />
      <h1 className="text-3xl font-black sm:text-4xl">You&apos;re in.</h1>
      <p className="text-lg text-muted-foreground">
        Your Founding price is locked. Stripe will email your receipt. We&apos;ll email you as soon
        as you can start listing parts.
      </p>
      <p className="text-muted-foreground">
        Questions? <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <Button asChild size="xl" className="mt-2">
        <Link href="/">Back to Partsaur</Link>
      </Button>
    </div>
  );
}
