import { Resend } from "resend";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM = "Partsaur <alerts@partsaur.com>";

// Resend free plan: 100/day. Keep headroom, and stop "maybe" pings first.
const DAILY_CAP = 95;
const DAILY_CAP_LOW_PRIORITY = 60;
const LOW_PRIORITY = new Set(["likely_match"]);

export type EmailKind =
  | "exact_match"
  | "likely_match"
  | "have_it"
  | "new_listing"
  | "part_alert"
  | "new_message"
  | "listing_removed"
  | "cert_reviewed";

export type Email = {
  kind: EmailKind;
  to: string;
  toUserId?: string | null;
  refId?: string | null;
  subject: string;
  /** Plain-text lines. Links are written as-is. */
  lines: string[];
  buttons?: { label: string; url: string }[];
  replyTo?: string;
  unsubscribeUrl?: string;
};

export async function emailsSentSince(hours: number, filter?: { kind?: EmailKind; userId?: string }) {
  let query = createAdminClient()
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - hours * 3600_000).toISOString());
  if (filter?.kind) query = query.eq("kind", filter.kind);
  if (filter?.userId) query = query.eq("to_user_id", filter.userId);
  const { count } = await query;
  return count ?? 0;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(email: Email) {
  const footer = email.unsubscribeUrl
    ? `Don't want these? Stop Wanted emails: ${email.unsubscribeUrl}`
    : "You're getting this because of activity on your Partsaur account.";

  const text = [
    ...email.lines,
    "",
    ...(email.buttons ?? []).map((b) => `${b.label}: ${b.url}`),
    "",
    "—",
    "Partsaur · " + SITE_URL,
    footer,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:520px">
${email.lines.map((l) => (l ? `<p style="margin:0 0 12px">${esc(l)}</p>` : "")).join("\n")}
${(email.buttons ?? [])
  .map(
    (b, i) =>
      `<a href="${esc(b.url)}" style="display:inline-block;margin:8px 8px 8px 0;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none;${
        i === 0 ? "background:#ea580c;color:#fff" : "background:#f1f1f1;color:#111;border:1px solid #ddd"
      }">${esc(b.label)}</a>`,
  )
  .join("")}
<p style="margin:24px 0 0;font-size:13px;color:#666">Partsaur · <a href="${SITE_URL}" style="color:#666">${SITE_URL.replace(/^https?:\/\//, "")}</a><br>${
    email.unsubscribeUrl
      ? `Don't want these? <a href="${esc(email.unsubscribeUrl)}" style="color:#666">Stop Wanted emails</a>`
      : "You're getting this because of activity on your Partsaur account."
  }</p></div>`;

  return { text, html };
}

/** Sends one email, respecting daily caps. Returns false if skipped or failed. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not set; skipped ${email.kind} email`);
    return false;
  }

  const sentToday = await emailsSentSince(24);
  const cap = LOW_PRIORITY.has(email.kind) ? DAILY_CAP_LOW_PRIORITY : DAILY_CAP;
  if (sentToday >= cap) {
    console.warn(`Daily email cap reached (${sentToday}); skipped ${email.kind}`);
    return false;
  }

  const { text, html } = render(email);
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: FROM,
    to: email.to,
    subject: email.subject,
    text,
    html,
    replyTo: email.replyTo,
    headers: email.unsubscribeUrl
      ? { "List-Unsubscribe": `<${email.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  });
  if (error) {
    console.error(`Resend ${email.kind} failed:`, error.message);
    return false;
  }

  await createAdminClient().from("email_log").insert({
    kind: email.kind,
    to_user_id: email.toUserId ?? null,
    to_email: email.to,
    ref_id: email.refId ?? null,
  });
  return true;
}
