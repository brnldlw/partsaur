import type { Metadata } from "next";
import { DraftLegalPage } from "@/components/draft-legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy (Draft)",
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <DraftLegalPage title="Privacy Policy">
      <h2>What we collect</h2>
      <p>
        When you join the waitlist we store your email, trade, role, and zip code. When you buy a
        subscription, Stripe processes your payment; we store your email and Stripe customer ID,
        never your card number.
      </p>
      <h2>How we use it</h2>
      <p>
        To tell you when Partsaur opens near you, to run your account, and to match parts to
        people nearby. We don&apos;t sell your information.
      </p>
      <h2>Your choices</h2>
      <p>Email us anytime to see or delete what we have about you.</p>
    </DraftLegalPage>
  );
}
