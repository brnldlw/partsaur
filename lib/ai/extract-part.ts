import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CONDITION_VALUES } from "@/lib/categories";
import { ALL_CATEGORY_VALUES, LIVE_TRADES, isCategoryOf } from "@/lib/trades";

const DEFAULT_MODEL = "claude-sonnet-5-5";
// Models that accept server-side refusal fallback ("default" routing) on the Claude API.
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

const TRADE_VALUES = LIVE_TRADES.map((t) => t.value) as [string, ...string[]];

export const ExtractedPartSchema = z.object({
  trade: z.enum(TRADE_VALUES).describe("Pick the trade first"),
  category: z.enum(ALL_CATEGORY_VALUES).describe("A category code from the chosen trade's list"),
  brand: z.string().nullable().describe("Manufacturer brand as printed, e.g. Copeland, Square D, Watts"),
  part_number: z.string().nullable().describe("Manufacturer part/model/catalog number exactly as printed"),
  title: z.string().describe("Short listing title, under 80 chars, e.g. 'Square D QO120 20A 1-Pole Breaker'"),
  description: z.string().describe("1-3 plain sentences a tech would want: what it is, what it fits, key ratings"),
  condition_guess: z.enum(CONDITION_VALUES).nullable().describe("Only if visible from the photo (sealed box, used, etc.)"),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("Ratings printed on the label, e.g. {label:'Amps', value:'20'}. Only what's actually printed."),
  is_refrigerant: z.boolean().describe("True ONLY if the item itself is refrigerant (cylinder/jug of gas)"),
  confidence: z.enum(["low", "medium", "high"]).describe("How sure you are of brand + part number"),
});

export type ExtractedPart = z.infer<typeof ExtractedPartSchema>;

const TRADE_GUIDE = LIVE_TRADES.map(
  (t) =>
    `## ${t.label} (trade code: ${t.value})\nRead from labels: ${t.aiReads}\nCategories:\n` +
    t.categories.map((c) => `- ${c.value}: ${c.label}`).join("\n"),
).join("\n\n");

const SYSTEM = `You read photos of trade parts for a marketplace used by field technicians (HVAC/R, electrical, plumbing and more).
The photo is usually a box label, nameplate, or data sticker, sometimes the bare part.

Extract what is actually printed or clearly visible. Rules:
- Pick the trade first, then a category code from THAT trade's list below. If nothing fits, use "other".
- Copy brand and part/model/catalog number exactly as printed (keep dashes and suffixes). If unreadable, use null. Never invent a part number.
- If there are several numbers, prefer the manufacturer part/model number over serial numbers, UPCs, or date codes.
- Specs: list the ratings printed on the label that matter for that trade (see "Read from labels").
- Refrigerant is only for the refrigerant itself (cylinders/jugs), not parts rated for a refrigerant.
- Write the description for another tech: what the part is, what it fits, and key ratings. No marketing language.
- If the photo isn't a part at all, set confidence to low, leave brand and part_number null, and say so in the description.

${TRADE_GUIDE}`;

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
    const data = response.parsed_output;
    if (data.is_refrigerant && data.trade === "hvacr") data.category = "refrigerant";
    // Category must belong to the chosen trade.
    if (!isCategoryOf(data.trade, data.category)) data.category = "other";
    return { ok: true, data, model: response.model };
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
