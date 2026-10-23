"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { markConversationRead, sendMessage, type SentMessage } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString("en-US", today ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MessageThread({
  conversationId,
  userId,
  otherName,
  initial,
  placeholder,
}: {
  conversationId: string;
  userId: string;
  otherName: string;
  initial: SentMessage[];
  placeholder: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const add = (m: SentMessage) =>
    setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));

  // Live updates: new messages from the other person appear without a refresh.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as SentMessage;
          add(m);
          if (m.sender_id !== userId) markConversationRead(conversationId);
        },
      )
      .subscribe();
    markConversationRead(conversationId).then(() => router.refresh());
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || pending) return;
    setPending(true);
    setError(null);
    const res = await sendMessage(conversationId, draft);
    setPending(false);
    if (res.ok) {
      add(res.message);
      setDraft("");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="flex flex-col">
      <ol className="flex flex-col gap-2 pb-4" aria-live="polite">
        {messages.length === 0 && (
          <li className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
            Start the conversation with {otherName}.
          </li>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <li key={m.id} className={cn("flex max-w-[85%] flex-col", mine ? "self-end items-end" : "self-start items-start")}>
              <p className={cn("whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-base",
                mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
                {m.body}
              </p>
              <span className="px-1 text-xs text-muted-foreground">{timeLabel(m.created_at)}</span>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ol>

      <form onSubmit={send}
        className="sticky bottom-0 flex items-end gap-2 border-t bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) send(e);
          }}
          rows={1}
          maxLength={4000}
          placeholder={placeholder}
          aria-label="Message"
          className="max-h-40 min-h-12 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-3 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" size="xl" disabled={pending || !draft.trim()} aria-label="Send"><Send /></Button>
      </form>
      {error && <p role="alert" className="pb-2 font-medium text-destructive">{error}</p>}
    </div>
  );
}
