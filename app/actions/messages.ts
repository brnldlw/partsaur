"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { notifyNewMessage } from "@/lib/messaging";
import { getAccount } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startListingConversation(formData: FormData) {
  const listingId = String(formData.get("listing_id") ?? "");
  if (!UUID.test(listingId)) redirect("/search");
  const { user, profile } = await getAccount();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/listing/${listingId}`)}`);
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_listing_conversation", { p_listing_id: listingId });
  if (error || !data?.id) {
    if (error) console.error("start_listing_conversation failed:", error.message);
    redirect(`/listing/${listingId}?contact=${data?.error ?? "error"}`);
  }
  redirect(`/messages/${data.id}`);
}

export type SentMessage = { id: string; body: string; created_at: string; sender_id: string };
export type SendResult = { ok: true; message: SentMessage } | { ok: false; error: string };

export async function sendMessage(conversationId: string, rawBody: string): Promise<SendResult> {
  const body = rawBody.trim();
  if (!body) return { ok: false, error: "Type a message first." };
  if (body.length > 4000) return { ok: false, error: "That message is too long (max 4000 characters)." };
  if (!UUID.test(conversationId)) return { ok: false, error: "Conversation not found." };

  const { user } = await getAccount();
  if (!user) return { ok: false, error: "Sign in again to send." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body })
    .select("id, body, created_at, sender_id")
    .single();
  if (error) {
    console.error("message insert failed:", error.message);
    return { ok: false, error: "Couldn't send. Check your signal and try again." };
  }

  after(() => notifyNewMessage(conversationId, user.id, body).catch((e) => console.error("message email failed:", e)));
  return { ok: true, message: data };
}

export async function markConversationRead(conversationId: string) {
  if (!UUID.test(conversationId)) return;
  const { user } = await getAccount();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);
}
