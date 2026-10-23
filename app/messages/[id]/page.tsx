import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { MessageThread } from "@/components/message-thread";
import { conversationTitle, getConversations } from "@/lib/conversations";
import { photoUrl } from "@/lib/listings";
import { getAccount } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { user, profile } = await getAccount();
  if (!user) redirect(`/login?next=/messages/${id}`);
  if (!profile) redirect("/onboarding");

  const [conv] = await getConversations(id);
  if (!conv) notFound();

  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id")
    .eq("conversation_id", id)
    .order("created_at")
    .limit(500);

  const href = conv.listing_id ? `/listing/${conv.listing_id}` : conv.wanted_id ? `/wanted/${conv.wanted_id}` : null;

  return (
    <>
      <div className="sticky top-16 z-10 -mx-4 mb-4 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/messages" aria-label="Back to messages" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-accent">
          <ChevronLeft className="size-6" />
        </Link>
        {conv.cover_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(conv.cover_path)} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
        )}
        <div className="min-w-0">
          <p className="truncate font-bold">{conv.other_name}</p>
          {href ? (
            <Link href={href} className="block truncate text-sm text-primary underline-offset-4 hover:underline">{conversationTitle(conv)}</Link>
          ) : (
            <p className="truncate text-sm text-muted-foreground">{conversationTitle(conv)}</p>
          )}
        </div>
      </div>
      <MessageThread
        conversationId={id}
        userId={user.id}
        otherName={conv.other_name}
        initial={messages ?? []}
        placeholder={conv.i_am === "buyer" && !messages?.length ? "Is this still available?" : "Write a message…"}
      />
    </>
  );
}

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-0">
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Thread params={params} />
      </Suspense>
    </div>
  );
}
