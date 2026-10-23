import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { conversationTitle, getConversations, timeAgo } from "@/lib/conversations";
import { photoUrl } from "@/lib/listings";
import { getAccount } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

async function Inbox() {
  const { user, profile } = await getAccount();
  if (!user) redirect("/login?next=/messages");
  if (!profile) redirect("/onboarding");
  const conversations = await getConversations();

  if (!conversations.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
        <MessageCircle className="size-8" />
        No messages yet. Tap <span className="font-semibold text-foreground">Message seller</span> on any listing to start one.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link href={`/messages/${c.id}`} className="flex gap-3 p-3 hover:bg-accent">
            <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {c.cover_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(c.cover_path)} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn("truncate", c.unread ? "font-black" : "font-semibold")}>{c.other_name}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</span>
              </div>
              <p className="truncate text-sm text-muted-foreground">{conversationTitle(c)}</p>
              <p className={cn("truncate text-sm", c.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {c.last_body
                  ? `${c.last_sender_id === user.id ? "You: " : ""}${c.last_body}`
                  : c.i_am === "buyer" ? "Say hi — ask if it's still available." : "No messages yet."}
              </p>
            </div>
            {c.unread > 0 && (
              <span className="flex size-6 shrink-0 items-center justify-center self-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {c.unread}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function MessagesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-black">Messages</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Inbox />
      </Suspense>
    </div>
  );
}
