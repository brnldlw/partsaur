import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORY_VALUES, CONDITION_VALUES } from "@/lib/categories";

const DEFAULT_MODEL = "claude-sonnet-5-5";
// Models that accept server-side refusal fallback ("default" routing) on the Claude API.
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export const ExtractedPartSchema = z.object({
  brand: z.string().nullable().describe("Manufacturer brand as printed, e.g. Copeland, Emerson, Carrier"),
  part_number: z.string().nullable().describe("Manufacturer part/model number exactly as printed"),
  title: z.string().describe("Short listing title, under 80 chars, e.g. 'Copeland ZP36K5E-PFV-830 Scroll Compressor'"),
  description: z.string().describe("1-3 plain sentences a tech would want: what it is, what it fits, key ratings"),
  category: z.enum(CATEGORY_VALUES),
  trade: z.enum(["hvacr", "electrical", "plumbing"]),
  condition_guess: z.enum(CONDITION_VALUES).nullable().describe("Only if visible from the photo (sealed box, used, etc.)"),
  specs: z.object({
    voltage: z.string().nullable(),
    phase: z.string().nullable(),
    hz: z.string().nullable(),
    amps: z.string().nullable().describe("RLA/LRA/FLA as printed"),
    hp: z.string().nullable(),
    rpm: z.string().nullable(),
    refrigerant: z.string().nullable().describe("Refrigerant type it is rated for, e.g. R-410A"),
    capacity: z.string().nullable().describe("Tonnage, BTU, MFD, lbs, etc."),
    other: z.string().nullable().describe("Any other useful rating, comma-separated"),
  }),
  is_refrigerant: z.boolean().describe("True ONLY if the item itself is refrigerant (cylinder/jug of gas)"),
  confidence: z.enum(["low", "medium", "high"]).describe("How sure you are of brand + part number"),
});

export type ExtractedPart = z.infer<typeof ExtractedPartSchema>;

const SYSTEM = `You read photos of HVAC/R, electrical and plumbing parts for a parts marketplace used by field technicians.
The photo is usually a box label, nameplate, or data sticker, sometimes the bare part.

Extract what is actually printed or clearly visible. Rules:
- Copy brand and part/model number exactly as printed (keep dashes and suffixes). If unreadable, use null. Never invent a part number.
- If there are several numbers, prefer the manufacturer part/model number over serial numbers, UPCs, or date codes.
- Pick the single best category. Refrigerant is only for the refrigerant itself (cylinders/jugs), not parts rated for a refrigerant.
- Write the description for another tech: what the part is, what it fits, and key ratings. No marketing language.
- If the photo isn't a part at all, set confidence to low, leave brand and part_number null, and say so in the description.`;

export type ExtractResult =
  | { ok: true; data: ExtractedPart; model: string }
  | { ok: false; error: string };

export async function extractPartFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Photo reading isn't set up yet." };
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const fallback = FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(ExtractedPartSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: "Read this part photo and fill in the listing fields." },
          ],
        },
      ],
      ...fallback,
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ok: false, error: "Couldn't read that photo. Fill in the details by hand." };
    }
    return { ok: true, data: response.parsed_output, model: response.model };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Photo reading is busy. Try again in a minute, or type it in." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
    } else {
      console.error("Photo extraction failed:", error);
    }
    return { ok: false, error: "Couldn't read that photo. Fill in the details by hand." };
  }
}
