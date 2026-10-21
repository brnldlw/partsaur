"use server";

import { createClient } from "@/lib/supabase/server";

export type AlertState = { ok: boolean; error?: string };

export async function createPartAlert(_prev: AlertState, formData: FormData): Promise<AlertState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const partNumber = String(formData.get("part_number") ?? "").trim().slice(0, 80);
  const brand = String(formData.get("brand") ?? "").trim().slice(0, 80);
  const partId = String(formData.get("part_id") ?? "") || null;
  const zip = String(formData.get("zip") ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!partNumber) return { ok: false, error: "Enter the part number you need." };
  if (zip && !/^\d{5}$/.test(zip)) return { ok: false, error: "Zip code should be 5 digits." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { error } = await supabase.from("part_alerts").insert({
    email,
    user_id: data?.claims?.sub ?? null,
    part_id: partId,
    brand: brand || null,
    part_number: partNumber,
    zip: zip || null,
  });

  // 23505 = already signed up for this part.
  if (error && error.code !== "23505") {
    console.error("part_alerts insert failed:", error.message);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}
