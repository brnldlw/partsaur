"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { extractPartFromImage, type ExtractResult } from "@/lib/ai/extract-part";
import { MAX_PHOTOS } from "@/lib/categories";
import { MAX_IMPORT_ROWS, parseListingInput } from "@/lib/listing-input";
import { listingTag, PAID_PLANS } from "@/lib/listings";
import { runListingMatching } from "@/lib/matching";
import { getAccount } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DAILY_AI_LIMIT = 30;
const PHOTO_BUCKET = "listing-photos";

async function requireSeller() {
  const account = await getAccount();
  if (!account.user) redirect("/login?next=/sell/new");
  if (!account.profile) redirect("/onboarding");
  return { ...account, user: account.user, profile: account.profile };
}

function friendlyDbError(message: string) {
  if (message.includes("MODERATED")) return "This listing is under review by Partsaur and can't be changed right now.";
  if (message.includes("LISTING_LIMIT")) {
    return "Free accounts can have 10 active listings. Mark one sold or remove one — or upgrade for unlimited.";
  }
  console.error("listing write failed:", message);
  return "Couldn't save. Please try again.";
}

// ---------------------------------------------------------------
// Photo → listing fields
// ---------------------------------------------------------------
export async function readPhoto(storagePath: string): Promise<ExtractResult> {
  const { user } = await requireSeller();
  if (!storagePath.startsWith(`${user.id}/`)) return { ok: false, error: "That photo isn't yours." };

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("ai_extractions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_AI_LIMIT) {
    return { ok: false, error: "You've hit today's photo-reading limit. Type the details in for now." };
  }

  const { data: file, error } = await admin.storage.from(PHOTO_BUCKET).download(storagePath);
  if (error || !file) return { ok: false, error: "Couldn't load that photo. Try uploading it again." };

  const mediaType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  await admin.from("ai_extractions").insert({ user_id: user.id });
  return extractPartFromImage(base64, mediaType);
}

// ---------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------
export type ListingFormState = { ok: boolean; error?: string };

export async function saveListing(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const { user, profile, business } = await requireSeller();
  const supabase = await createClient();

  const parsed = parseListingInput({
    title: formData.get("title"),
    brand: formData.get("brand"),
    part_number: formData.get("part_number"),
    description: formData.get("description"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    pickup: formData.get("pickup") === "on",
    ships: formData.get("ships") === "on",
    zip: formData.get("zip"),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  let photos: string[];
  try {
    photos = JSON.parse(String(formData.get("photos") ?? "[]"));
  } catch {
    return { ok: false, error: "Photo list was garbled. Reload and try again." };
  }
  if (!Array.isArray(photos) || photos.some((p) => typeof p !== "string" || !p.startsWith(`${user.id}/`))) {
    return { ok: false, error: "Photo list was garbled. Reload and try again." };
  }
  if (photos.length > MAX_PHOTOS) return { ok: false, error: `Up to ${MAX_PHOTOS} photos.` };

  const { data: zipRow } = await supabase.from("zip_codes").select("zip").eq("zip", parsed.data.zip).maybeSingle();
  if (!zipRow) return { ok: false, error: `We don't recognize zip code ${parsed.data.zip}.` };

  const listingId = String(formData.get("listing_id") ?? "") || null;
  const fields = { ...parsed.data, trade: profile.trade, business_id: business?.id ?? null };

  let id: string;
  if (listingId) {
    const { error } = await supabase.from("listings").update(fields).eq("id", listingId).eq("seller_id", user.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    id = listingId;
  } else {
    let aiExtracted: unknown = null;
    try {
      aiExtracted = JSON.parse(String(formData.get("ai_extracted") || "null"));
    } catch {
      aiExtracted = null;
    }
    const { data, error } = await supabase
      .from("listings")
      .insert({ ...fields, seller_id: user.id, status: "active", ai_extracted: aiExtracted })
      .select("id")
      .single();
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    id = data.id;
  }

  // Replace the photo list; delete storage files that were dropped.
  const { data: existing } = await supabase.from("listing_photos").select("storage_path").eq("listing_id", id);
  const removed = (existing ?? []).map((p) => p.storage_path).filter((p) => !photos.includes(p));
  await supabase.from("listing_photos").delete().eq("listing_id", id);
  if (photos.length) {
    const { error } = await supabase
      .from("listing_photos")
      .insert(photos.map((storage_path, sort_order) => ({ listing_id: id, storage_path, sort_order })));
    if (error) return { ok: false, error: friendlyDbError(error.message) };
  }
  if (removed.length) await supabase.storage.from(PHOTO_BUCKET).remove(removed);

  updateTag(listingTag(id));
  if (!listingId) {
    after(() => runListingMatching(id).catch((e) => console.error("listing matching failed:", e)));
  }
  redirect(listingId ? "/dashboard/listings?saved=1" : `/listing/${id}?new=1`);
}

// ---------------------------------------------------------------
// Mark sold / remove / relist
// ---------------------------------------------------------------
export async function setListingStatus(formData: FormData) {
  const { user } = await requireSeller();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["active", "sold", "removed"].includes(status)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("listings").update({ status }).eq("id", id).eq("seller_id", user.id);
  updateTag(listingTag(id));
  if (error) {
    const msg = error.message.includes("LISTING_LIMIT") ? "limit" : error.message.includes("MODERATED") ? "moderated" : "error";
    redirect(`/dashboard/listings?error=${msg}`);
  }
  redirect("/dashboard/listings");
}

// ---------------------------------------------------------------
// Bulk CSV import (paid plans)
// ---------------------------------------------------------------
export type ImportResult = { ok: boolean; imported?: number; error?: string; rowErrors?: { row: number; error: string }[] };

export async function importListings(rows: Record<string, unknown>[]): Promise<ImportResult> {
  const { user, profile, business } = await requireSeller();
  if (!business || !PAID_PLANS.has(business.plan)) {
    return { ok: false, error: "Bulk upload is part of the Founding Shop and Supply House plans." };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: `Up to ${MAX_IMPORT_ROWS} rows per upload.` };

  const defaultZip = business.zip ?? profile.zip;
  const rowErrors: { row: number; error: string }[] = [];
  const valid = rows.flatMap((raw, i) => {
    const parsed = parseListingInput(raw, defaultZip);
    if (!parsed.ok) {
      rowErrors.push({ row: i + 1, error: parsed.error });
      return [];
    }
    return [parsed.data];
  });
  if (rowErrors.length) return { ok: false, error: "Fix the highlighted rows and try again.", rowErrors };

  const supabase = await createClient();
  const zips = [...new Set(valid.map((r) => r.zip))];
  const { data: known } = await supabase.from("zip_codes").select("zip").in("zip", zips);
  const knownSet = new Set((known ?? []).map((z) => z.zip));
  valid.forEach((r, i) => {
    if (!knownSet.has(r.zip)) rowErrors.push({ row: i + 1, error: `Unknown zip code ${r.zip}.` });
  });
  if (rowErrors.length) return { ok: false, error: "Fix the highlighted rows and try again.", rowErrors };

  const { data: inserted, error } = await supabase
    .from("listings")
    .insert(
      valid.map((r) => ({
        ...r,
        seller_id: user.id,
        business_id: business.id,
        trade: profile.trade,
        status: "active",
      })),
    )
    .select("id, part_number");
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  // Match listings with part numbers against open Wanted requests / alerts.
  const toMatch = (inserted ?? []).filter((l) => l.part_number).map((l) => l.id);
  after(async () => {
    for (const listingId of toMatch) {
      await runListingMatching(listingId).catch((e) => console.error("listing matching failed:", e));
    }
  });
  return { ok: true, imported: valid.length };
}

// ---------------------------------------------------------------
// Contact seller (signed-in buyers; refrigerant needs EPA 608)
// ---------------------------------------------------------------
export type ContactResult =
  | { ok: true; name: string; phone: string | null }
  | { ok: false; reason: "sign_in" | "onboarding" | "not_available" | "epa608_required" | "error" };

export async function getSellerContact(listingId: string): Promise<ContactResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listing_contact", { p_id: listingId });
  if (error) {
    if (error.code === "42501") return { ok: false, reason: "sign_in" };
    console.error("listing_contact failed:", error.message);
    return { ok: false, reason: "error" };
  }
  if (data?.error) return { ok: false, reason: data.error };
  return { ok: true, name: data.name, phone: data.phone };
}

// ---------------------------------------------------------------
// EPA 608 certification upload
// ---------------------------------------------------------------
export type CertState = { ok: boolean; error?: string };

export async function submitCertification(_prev: CertState, formData: FormData): Promise<CertState> {
  const { user } = await requireSeller();
  const certNumber = String(formData.get("cert_number") ?? "").trim();
  const storagePath = String(formData.get("storage_path") ?? "");
  if (certNumber.length > 40) return { ok: false, error: "Cert number is too long." };
  if (!storagePath.startsWith(`${user.id}/`)) return { ok: false, error: "Upload a photo of your card first." };

  const supabase = await createClient();
  const { error } = await supabase.from("certifications").insert({
    profile_id: user.id,
    type: "epa608",
    cert_number: certNumber || null,
    storage_path: storagePath,
  });
  if (error) {
    console.error("certification insert failed:", error.message);
    return { ok: false, error: "Couldn't submit. Please try again." };
  }
  return { ok: true };
}
