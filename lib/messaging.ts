import "server-only";
import { sendEmail } from "@/lib/email/send";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { wantedLabel } from "@/lib/wanted";

const NOTIFY_EVERY_MINUTES = 15;

/** Email the other person about a new message — at most once per thread every 15 minutes. */
export async function notifyNewMessage(conversationId: string, senderId: string, body: string) {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("conversations")
    .select("id, buyer_id, seller_id, buyer_notified_at, seller_notified_at, listings(title), wanted_requests(part_number, brand, description)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!c) return;

  const recipientIsBuyer = c.seller_id === senderId;
  const recipientId = recipientIsBuyer ? c.buyer_id : c.seller_id;
  const lastNotified = recipientIsBuyer ? c.buyer_notified_at : c.seller_notified_at;
  if (lastNotified && Date.now() - Date.parse(lastNotified) < NOTIFY_EVERY_MINUTES * 60_000) return;

  const [{ data: recipient }, { data: sender }] = await Promise.all([
    admin.auth.admin.getUserById(recipientId),
    admin.from("profiles").select("display_name").eq("id", senderId).maybeSingle(),
  ]);
  if (!recipient?.user?.email) return;

  const listing = c.listings as unknown as { title: string } | null;
  const wanted = c.wanted_requests as unknown as Parameters<typeof wantedLabel>[0] | null;
  const about = listing?.title ?? (wanted ? wantedLabel(wanted) : "your part");
  const from = (sender?.display_name ?? "Someone").split(" ")[0];
  const preview = body.length > 280 ? body.slice(0, 277) + "…" : body;

  const sent = await sendEmail({
    kind: "new_message",
    to: recipient.user.email,
    toUserId: recipientId,
    refId: conversationId,
    subject: `New message from ${from} about ${about}`,
    lines: [`${from} sent you a message about ${about}:`, `“${preview}”`, "Reply on Partsaur — replies to this email won't reach them."],
    buttons: [{ label: "Reply", url: `${SITE_URL}/messages/${conversationId}` }],
  });
  if (sent) {
    await admin
      .from("conversations")
      .update(recipientIsBuyer ? { buyer_notified_at: new Date().toISOString() } : { seller_notified_at: new Date().toISOString() })
      .eq("id", conversationId);
  }
}
