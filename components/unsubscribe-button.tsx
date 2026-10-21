"use client";

import { useState } from "react";
import { unsubscribeWantedEmails } from "@/app/actions/wanted";
import { Button } from "@/components/ui/button";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  if (state === "done") {
    return (
      <p role="status" className="rounded-xl border-2 border-primary bg-primary/10 p-4 font-semibold">
        Done — no more Wanted emails. You can turn them back on in your Account page.
      </p>
    );
  }
  return (
    <>
      <Button size="xl" disabled={state === "pending"}
        onClick={async () => {
          setState("pending");
          setState((await unsubscribeWantedEmails(token)) ? "done" : "error");
        }}>
        {state === "pending" ? "Saving…" : "Stop Wanted emails"}
      </Button>
      {state === "error" && <p role="alert" className="text-destructive">That link isn&apos;t valid. Change this in your Account page instead.</p>}
    </>
  );
}
