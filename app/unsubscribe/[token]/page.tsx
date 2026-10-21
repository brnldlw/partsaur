import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeButton } from "@/components/unsubscribe-button";

export const metadata: Metadata = { title: "Stop Wanted emails", robots: { index: false } };

async function Unsub({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <UnsubscribeButton token={token} />;
}

export default function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-3xl font-black">Stop Wanted emails?</h1>
      <p className="text-muted-foreground">
        You won&apos;t get emails when techs nearby need a part you might have. Login emails and replies
        to your own requests still come through.
      </p>
      <Suspense><Unsub params={params} /></Suspense>
    </div>
  );
}
