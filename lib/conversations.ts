import { createClient } from "@/lib/supabase/server";
import { wantedLabel } from "@/lib/wanted";

export type ConversationRow = {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  cover_path: string | null;
  wanted_id: string | null;
  wanted_part_number: string | null;
  wanted_brand: string | null;
  wanted_description: string | null;
  other_id: string;
  other_name: string;
  i_am: "buyer" | "seller";
  last_message_at: string;
  last_body: string | null;
  last_sender_id: string | null;
  unread: number;
};

export async function getConversations(id?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations", { p_id: id ?? null });
  if (error) console.error("my_conversations failed:", error.message);
  return (data ?? []) as ConversationRow[];
}

export function conversationTitle(c: ConversationRow) {
  if (c.listing_title) return c.listing_title;
  if (c.wanted_id) {
    return `Wanted: ${wantedLabel({ part_number: c.wanted_part_number, brand: c.wanted_brand, description: c.wanted_description })}`;
  }
  return "Conversation";
}

export function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
