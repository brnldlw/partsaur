import type { Metadata } from "next";
import { DraftLegalPage } from "@/components/draft-legal-page";

export const metadata: Metadata = {
  title: "Terms of Service (Draft)",
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <DraftLegalPage title="Terms of Service">
      <p>
        Partsaur is a marketplace that connects people who have parts with people who need them.
        These terms will describe how the service works and what&apos;s expected of buyers and
        sellers.
      </p>
      <h2>Transactions</h2>
      <p>
        Buyers and sellers arrange payment and pickup directly. Partsaur is not a party to the
        sale and does not guarantee any part&apos;s condition, fitness, or availability.
      </p>
      <h2>Prohibited items</h2>
      <p>
        Recalled items and unverified or reclaimed refrigerant may not be listed. Refrigerant
        sales follow EPA Section 608 rules.
      </p>
      <h2>Subscriptions</h2>
      <p>
        Paid plans bill monthly through Stripe. Founding prices stay locked while the
        subscription remains active.
      </p>
    </DraftLegalPage>
  );
}
