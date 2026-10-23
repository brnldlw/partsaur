"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import { listingTag } from "@/lib/listings";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

async function sellerOf(listingId: string) {
  const admin = createAdminClient();
  const { data: l } = await admin
    .from("listings")
    .select("id, title, seller_id, status, moderation, moderation_prev_status")
    .eq("id", listingId)
    .maybeSingle();
  if (!l) return null;
  const { data: u } = await admin.auth.admin.getUserById(l.seller_id);
  return { listing: l, email: u?.user?.email ?? null };
}

export async function dismissReports(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listing_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/reports");
  const admin = createAdminClient();
  await admin
    .from("reports")
    .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .eq("status", "open");

  // Un-hide if 3 reports had auto-hidden it.
  const { data: l } = await admin.from("listings").select("moderation, moderation_prev_status").eq("id", listingId).maybeSingle();
  if (l?.moderation === "auto_hidden") {
    const { error } = await admin
      .from("listings")
      .update({ moderation: null, status: l.moderation_prev_status ?? "active", moderation_prev_status: null })
      .eq("id", listingId);
    if (error) console.error("restore after dismiss failed:", error.message);
  }
  updateTag(listingTag(listingId));
  redirect(back);
}

export async function removeListing(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listing_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  const back = String(formData.get("back") ?? "/admin/reports");
  const found = await sellerOf(listingId);
  if (!found) redirect(back);
  const { listing, email } = found;

  const admin = createAdminClient();
  await admin
    .from("listings")
    .update({
      moderation: "admin_removed",
      moderation_prev_status: listing.moderation ? listing.moderation_prev_status : listing.status,
      status: "removed",
    })
    .eq("id", listingId);
  await admin
    .from("reports")
    .update({ status: "actioned", reviewed_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .eq("status", "open");
  updateTag(listingTag(listingId));

  if (email) {
    await sendEmail({
      kind: "listing_removed",
      to: email,
      toUserId: listing.seller_id,
      refId: listingId,
      replyTo: CONTACT_EMAIL,
      subject: `Your Partsaur listing was removed: ${listing.title}`,
      lines: [
        `We removed your listing "${listing.title}".`,
        reason ? `Reason: ${reason}` : "It didn't meet our listing rules.",
        `See what's not allowed: ${SITE_URL}/prohibited`,
        "Think we got it wrong? Just reply to this email.",
      ],
    });
  }
  redirect(back);
}

export async function restoreListing(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listing_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/listings");
  const admin = createAdminClient();
  const { data: l } = await admin.from("listings").select("moderation_prev_status").eq("id", listingId).maybeSingle();
  const { error } = await admin
    .from("listings")
    .update({ moderation: null, status: l?.moderation_prev_status ?? "active", moderation_prev_status: null })
    .eq("id", listingId);
  if (error) console.error("restore failed:", error.message);
  updateTag(listingTag(listingId));
  redirect(back);
}

export async function reviewCertification(formData: FormData) {
  await requireAdmin();
  const certId = String(formData.get("cert_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") redirect("/admin/certs");

  const admin = createAdminClient();
  const { data: cert } = await admin
    .from("certifications")
    .update({ status: decision })
    .eq("id", certId)
    .eq("status", "pending")
    .select("profile_id")
    .maybeSingle();

  if (cert) {
    const { data: u } = await admin.auth.admin.getUserById(cert.profile_id);
    if (u?.user?.email) {
      await sendEmail({
        kind: "cert_reviewed",
        to: u.user.email,
        toUserId: cert.profile_id,
        refId: certId,
        replyTo: CONTACT_EMAIL,
        subject: decision === "approved" ? "You're EPA 608 verified on Partsaur" : "We couldn't verify your EPA 608 card",
        lines:
          decision === "approved"
            ? ["Your EPA 608 certification is approved.", "You can now contact sellers about refrigerant listings."]
            : [
                "We couldn't verify the EPA 608 card you uploaded.",
                "Usually the photo was blurry or cut off. Upload a clearer photo of the full card from your Account page.",
                "Questions? Just reply to this email.",
              ],
        buttons: [{ label: decision === "approved" ? "Find refrigerant" : "Upload again", url: `${SITE_URL}${decision === "approved" ? "/search?category=refrigerant" : "/account#epa608"}` }],
      });
    }
  }
  redirect("/admin/certs");
}
