import "server-only";
import { sendEmail, emailsSentSince } from "@/lib/email/send";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LIKELY_PINGS_PER_DAY,
  LIKELY_PINGS_PER_REQUEST,
  milesText,
  neededByText,
  wantedLabel,
} from "@/lib/wanted";

type Wanted = {
  id: string;
  requester_id: string;
  part_number: string | null;
  brand: string | null;
  description: string | null;
  needed_by: string | null;
  status: string;
};

type Person = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  wantedPings: boolean;
  emailToken: string;
};

async function getPerson(userId: string): Promise<Person | null> {
  const admin = createAdminClient();
  const [{ data: auth }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("profiles")
      .select("display_name, phone, show_phone, wanted_pings, email_token")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (!auth?.user?.email || !profile) return null;
  return {
    id: userId,
    email: auth.user.email,
    name: profile.display_name,
    phone: profile.show_phone ? profile.phone : null,
    wantedPings: profile.wanted_pings,
    emailToken: profile.email_token,
  };
}

async function getWanted(id: string): Promise<Wanted | null> {
  const { data } = await createAdminClient()
    .from("wanted_requests")
    .select("id, requester_id, part_number, brand, description, needed_by, status")
    .eq("id", id)
    .maybeSingle<Wanted>();
  return data;
}

const unsubscribeUrl = (p: Person) => `${SITE_URL}/api/unsubscribe/${p.emailToken}`;
const respondUrl = (token: string, answer: "yes" | "no") => `${SITE_URL}/m/${token}?a=${answer}`;
const formatPhone = (p: string) => p.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");

/** Records a match once per (request, seller). Returns its token, or null if it already existed. */
async function recordMatch(row: {
  wanted_id: string;
  seller_id: string;
  listing_id?: string | null;
  match_type: "exact" | "likely" | "ping";
  miles: number | null;
}) {
  const { data } = await createAdminClient()
    .from("matches")
    .upsert(row, { onConflict: "wanted_id,seller_id", ignoreDuplicates: true })
    .select("id, response_token");
  return data?.[0] ?? null;
}

async function markNotified(matchId: string) {
  await createAdminClient().from("matches").update({ notified_at: new Date().toISOString() }).eq("id", matchId);
}

/** New (or boosted) Wanted request → ping sellers who have it or probably do. */
export async function runWantedMatching(wantedId: string) {
  const admin = createAdminClient();
  const wanted = await getWanted(wantedId);
  if (!wanted || wanted.status !== "open") return;
  const label = wantedLabel(wanted);
  const when = neededByText(wanted.needed_by);

  // Exact: they have this part number listed.
  const { data: exact } = await admin.rpc("wanted_exact_matches", { p_wanted_id: wantedId });
  const exactRows = ((exact ?? []) as { seller_id: string; listing_id: string; listing_title: string; miles: number; paid: boolean }[])
    .sort((a, b) => Number(b.paid) - Number(a.paid) || a.miles - b.miles);

  for (const m of exactRows) {
    const match = await recordMatch({ wanted_id: wantedId, seller_id: m.seller_id, listing_id: m.listing_id, match_type: "exact", miles: m.miles });
    if (!match) continue;
    const seller = await getPerson(m.seller_id);
    if (!seller?.wantedPings) continue;
    const sent = await sendEmail({
      kind: "exact_match",
      to: seller.email,
      toUserId: seller.id,
      refId: wantedId,
      subject: `Someone ${milesText(m.miles)} away needs ${label}`,
      lines: [
        `Someone ${milesText(m.miles)} away needs ${label} ${when}.`,
        `You have one listed: ${m.listing_title}`,
        "Still have it? One tap and we'll send them your contact info.",
      ],
      buttons: [
        { label: "I have it", url: respondUrl(match.response_token, "yes") },
        { label: "No", url: respondUrl(match.response_token, "no") },
      ],
      unsubscribeUrl: unsubscribeUrl(seller),
    });
    if (sent) await markNotified(match.id);
  }

  // Likely: same brand nearby. Capped per seller per day and per request.
  const { data: likely } = await admin.rpc("wanted_likely_sellers", { p_wanted_id: wantedId });
  let pinged = 0;
  for (const m of (likely ?? []) as { seller_id: string; miles: number; paid: boolean }[]) {
    if (pinged >= LIKELY_PINGS_PER_REQUEST) break;
    const cap = m.paid ? LIKELY_PINGS_PER_DAY.paid : LIKELY_PINGS_PER_DAY.free;
    if ((await emailsSentSince(24, { kind: "likely_match", userId: m.seller_id })) >= cap) continue;

    const seller = await getPerson(m.seller_id);
    if (!seller?.wantedPings) continue;
    const match = await recordMatch({ wanted_id: wantedId, seller_id: m.seller_id, match_type: "likely", miles: m.miles });
    if (!match) continue;
    const sent = await sendEmail({
      kind: "likely_match",
      to: seller.email,
      toUserId: seller.id,
      refId: wantedId,
      subject: `Someone ${milesText(m.miles)} away needs ${label}. Have one?`,
      lines: [
        `Someone ${milesText(m.miles)} away needs ${label} ${when}.`,
        ...(wanted.description && wanted.part_number ? [`Details: ${wanted.description}`] : []),
        "You sell this brand nearby, so we thought you might have one on the shelf.",
      ],
      buttons: [
        { label: "I have it", url: respondUrl(match.response_token, "yes") },
        { label: "No", url: respondUrl(match.response_token, "no") },
      ],
      unsubscribeUrl: unsubscribeUrl(seller),
    });
    if (sent) {
      await markNotified(match.id);
      pinged++;
    }
  }
}

/** New listing → tell requesters and "notify me" sign-ups who want it. */
export async function runListingMatching(listingId: string) {
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, title, brand, part_number, seller_id, zip")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing?.part_number) return;
  const listingUrl = `${SITE_URL}/listing/${listing.id}`;
  const label = [listing.brand, listing.part_number].filter(Boolean).join(" ");

  const { data: wanted } = await admin.rpc("listing_wanted_matches", { p_listing_id: listingId });
  for (const w of (wanted ?? []) as { wanted_id: string; requester_id: string; miles: number }[]) {
    const match = await recordMatch({ wanted_id: w.wanted_id, seller_id: listing.seller_id, listing_id: listing.id, match_type: "exact", miles: w.miles });
    if (!match) continue;
    const requester = await getPerson(w.requester_id);
    if (!requester) continue;
    const sent = await sendEmail({
      kind: "new_listing",
      to: requester.email,
      toUserId: requester.id,
      refId: w.wanted_id,
      subject: `Just listed: ${label}, ${milesText(w.miles)} from you`,
      lines: [
        `Someone just listed ${label}, ${milesText(w.miles)} from you.`,
        listing.title,
        "If you got your part, close your Wanted request so sellers stop pinging you.",
      ],
      buttons: [
        { label: "See the listing", url: listingUrl },
        { label: "Close my request", url: `${SITE_URL}/wanted/${w.wanted_id}` },
      ],
    });
    if (sent) await markNotified(match.id);
  }

  const { data: alerts } = await admin.rpc("listing_alert_matches", { p_listing_id: listingId });
  for (const a of (alerts ?? []) as { alert_id: string; email: string; user_id: string | null; miles: number | null }[]) {
    const where = a.miles != null ? `, ${milesText(a.miles)} from you` : "";
    const sent = await sendEmail({
      kind: "part_alert",
      to: a.email,
      toUserId: a.user_id,
      refId: a.alert_id,
      subject: `Just listed: ${label}${where}`,
      lines: [
        `You asked us to let you know when ${label} was listed on Partsaur. Someone just listed one${where}.`,
        listing.title,
        "This was a one-time notice.",
      ],
      buttons: [{ label: "See the listing", url: listingUrl }],
    });
    if (sent) await admin.from("part_alerts").update({ notified_at: new Date().toISOString() }).eq("id", a.alert_id);
  }
}

export type HaveItResult =
  | { ok: true; requester: { name: string; email: string }; label: string; alreadySent: boolean; conversationId: string | null }
  | { ok: false; reason: "not_found" | "closed" | "own_request" };

/** Seller said "I have it" → open a conversation and email the requester the seller's contact. */
export async function respondHaveIt(token: string): Promise<HaveItResult> {
  const admin = createAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("id, wanted_id, seller_id, miles, seller_response")
    .eq("response_token", token)
    .maybeSingle();
  if (!match) return { ok: false, reason: "not_found" };

  const wanted = await getWanted(match.wanted_id);
  if (!wanted) return { ok: false, reason: "not_found" };
  if (wanted.requester_id === match.seller_id) return { ok: false, reason: "own_request" };
  const [requester, seller] = await Promise.all([getPerson(wanted.requester_id), getPerson(match.seller_id)]);
  if (!requester || !seller) return { ok: false, reason: "not_found" };
  const label = wantedLabel(wanted);
  const requesterInfo = { name: requester.name.split(" ")[0], email: requester.email };

  if (match.seller_response === "have_it") {
    const { data: existing } = await admin
      .from("conversations")
      .select("id")
      .eq("wanted_id", wanted.id)
      .eq("seller_id", seller.id)
      .maybeSingle();
    return { ok: true, requester: requesterInfo, label, alreadySent: true, conversationId: existing?.id ?? null };
  }
  if (wanted.status !== "open") return { ok: false, reason: "closed" };

  await admin
    .from("matches")
    .update({ seller_response: "have_it", responded_at: new Date().toISOString() })
    .eq("id", match.id);
  const { error: convError } = await admin
    .from("conversations")
    .upsert(
      { wanted_id: wanted.id, buyer_id: requester.id, seller_id: seller.id },
      { onConflict: "wanted_id,seller_id", ignoreDuplicates: true },
    );
  if (convError) console.error("conversation upsert failed:", convError.message);
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("wanted_id", wanted.id)
    .eq("seller_id", seller.id)
    .maybeSingle();
  const threadUrl = conv ? `${SITE_URL}/messages/${conv.id}` : `${SITE_URL}/wanted/${wanted.id}`;

  await sendEmail({
    kind: "have_it",
    to: requester.email,
    toUserId: requester.id,
    refId: wanted.id,
    replyTo: seller.email,
    subject: `${seller.name.split(" ")[0]} has ${label}`,
    lines: [
      `Good news: ${seller.name}${match.miles != null ? ` (${milesText(match.miles)} away)` : ""} says they have ${label}.`,
      "Reply to this email to reach them directly, or:",
      `Email: ${seller.email}`,
      ...(seller.phone ? [`Phone: ${formatPhone(seller.phone)}`] : []),
      "Arrange payment and pickup directly. Inspect parts before you pay.",
    ],
    buttons: [
      { label: "Message them on Partsaur", url: threadUrl },
      { label: "View your request", url: `${SITE_URL}/wanted/${wanted.id}` },
    ],
  });

  return { ok: true, requester: requesterInfo, label, alreadySent: false, conversationId: conv?.id ?? null };
}

export async function respondNo(token: string) {
  // Never overwrite a "have it".
  await createAdminClient()
    .from("matches")
    .update({ seller_response: "no", responded_at: new Date().toISOString() })
    .eq("response_token", token)
    .is("seller_response", null);
}

/** A signed-in seller tapped "I have one" on the request page. */
export async function haveItFromPage(wantedId: string, sellerId: string): Promise<HaveItResult> {
  const wanted = await getWanted(wantedId);
  if (!wanted) return { ok: false, reason: "not_found" };
  if (wanted.requester_id === sellerId) return { ok: false, reason: "own_request" };
  await recordMatch({ wanted_id: wantedId, seller_id: sellerId, match_type: "ping", miles: null });
  const { data } = await createAdminClient()
    .from("matches")
    .select("response_token")
    .eq("wanted_id", wantedId)
    .eq("seller_id", sellerId)
    .single();
  return respondHaveIt(data!.response_token);
}
