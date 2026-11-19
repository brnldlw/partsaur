"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your link:", url);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Partsaur", text: "List your dead stock free on Partsaur:", url });
        return;
      } catch {
        // cancelled — fall through to copy
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="select-all break-all rounded-lg border-2 bg-background p-3 font-mono text-base">{url}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="xl" onClick={share}><Share2 /> Share</Button>
        <Button type="button" size="xl" variant="outline" onClick={copy}>
          {copied ? <><Check /> Copied</> : <><Copy /> Copy</>}
        </Button>
      </div>
    </div>
  );
}
