"use client";

import { useActionState, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { readPhoto, saveListing, type ListingFormState } from "@/app/actions/listings";
import { PhotoPicker, type Photo } from "@/components/photo-picker";
import { RadioCard } from "@/components/radio-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExtractedPart } from "@/lib/ai/extract-part";
import { CONDITIONS, MAX_PHOTOS } from "@/lib/categories";
import { categoriesFor, getCategory, isCategoryOf, LIVE_TRADES } from "@/lib/trades";
import { cn } from "@/lib/utils";

export type ListingFormValues = {
  title: string;
  brand: string;
  part_number: string;
  description: string;
  trade: string;
  category: string;
  condition: string;
  quantity: string;
  price: string;
  pickup: boolean;
  ships: boolean;
  zip: string;
};

type AiState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "done"; confidence: ExtractedPart["confidence"] }
  | { status: "error"; message: string };

const selectClass =
  "flex h-12 w-full rounded-md border border-input bg-background px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function specsToText(specs: ExtractedPart["specs"]) {
  return specs
    .filter((x) => x.label && x.value)
    .map((x) => `${x.label}: ${x.value}`)
    .join(" · ");
}

export function ListingForm({
  userId,
  listingId,
  initial,
  initialPhotos = [],
  contactNote,
}: {
  userId: string;
  listingId?: string;
  initial: ListingFormValues;
  initialPhotos?: Photo[];
  contactNote: string;
}) {
  const [state, action, pending] = useActionState<ListingFormState, FormData>(saveListing, { ok: false });
  const [values, setValues] = useState(initial);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  const [aiExtracted, setAiExtracted] = useState<ExtractedPart | null>(null);
  const isEdit = Boolean(listingId);
  const category = getCategory(values.trade, values.category);

  const set = <K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function runAi(photo: Photo) {
    setAi({ status: "reading" });
    const result = await readPhoto(photo.path);
    if (!result.ok) {
      setAi({ status: "error", message: result.error });
      return;
    }
    const d = result.data;
    const specs = specsToText(d.specs);
    setAiExtracted(d);
    setValues((v) => ({
      ...v,
      title: d.title || v.title,
      brand: d.brand ?? v.brand,
      part_number: d.part_number ?? v.part_number,
      description: [d.description, specs].filter(Boolean).join("\n\n") || v.description,
      trade: d.trade,
      category: d.category,
      condition: d.condition_guess ?? v.condition,
    }));
    setAi({ status: "done", confidence: d.confidence });
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {listingId && <input type="hidden" name="listing_id" value={listingId} />}
      <input type="hidden" name="photos" value={JSON.stringify(photos.map((p) => p.path))} />
      <input type="hidden" name="ai_extracted" value={aiExtracted ? JSON.stringify(aiExtracted) : ""} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Photos</h2>
        {!isEdit && (
          <p className="text-muted-foreground">
            Start with the <span className="font-semibold text-foreground">box label or nameplate</span> —
            we&apos;ll read it and fill in the details for you.
          </p>
        )}
        <PhotoPicker
          userId={userId}
          bucket="listing-photos"
          photos={photos}
          onChange={setPhotos}
          max={MAX_PHOTOS}
          onUploaded={(photo, isFirst) => {
            if (isFirst && !isEdit && ai.status === "idle") runAi(photo);
          }}
        />
        {photos.length > 0 && ai.status !== "reading" && (
          <button
            type="button"
            onClick={() => runAi(photos[0])}
            className="flex items-center gap-1.5 self-start py-2 text-sm font-semibold text-primary"
          >
            <Sparkles className="size-4" />
            {ai.status === "idle" ? "Fill in from cover photo" : "Read cover photo again"}
          </button>
        )}
        {ai.status === "reading" && (
          <div role="status" className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/10 p-3 font-semibold">
            <Loader2 className="size-5 animate-spin" /> Reading the label…
          </div>
        )}
        {ai.status === "done" && (
          <div role="status" className="rounded-lg border-2 border-primary bg-primary/10 p-3">
            <p className="font-semibold">Filled in from your photo — check it before listing.</p>
            {ai.confidence !== "high" && (
              <p className="text-sm text-muted-foreground">
                The label was hard to read. Double-check the part number.
              </p>
            )}
          </div>
        )}
        {ai.status === "error" && (
          <p role="alert" className="rounded-lg border p-3 text-muted-foreground">{ai.message}</p>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-bold">Details</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="title" className="font-semibold">Title</Label>
          <Input id="title" name="title" value={values.title} onChange={(e) => set("title", e.target.value)}
            maxLength={140} required placeholder="Copeland 3 Ton Scroll Compressor" className="h-12 text-base" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand" className="font-semibold">Brand</Label>
            <Input id="brand" name="brand" value={values.brand} onChange={(e) => set("brand", e.target.value)}
              maxLength={80} placeholder="Copeland" className="h-12 text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="part_number" className="font-semibold">Part / model number</Label>
            <Input id="part_number" name="part_number" value={values.part_number}
              onChange={(e) => set("part_number", e.target.value)} maxLength={80}
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              placeholder="ZP36K5E-PFV-830" className="h-12 font-mono text-base" />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Trade</legend>
          <input type="hidden" name="trade" value={values.trade} />
          <div className="flex flex-wrap gap-2">
            {LIVE_TRADES.map((t) => (
              <button key={t.value} type="button" aria-pressed={values.trade === t.value}
                onClick={() => setValues((v) => ({ ...v, trade: t.value, category: isCategoryOf(t.value, v.category) ? v.category : "" }))}
                className={cn("flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold",
                  values.trade === t.value ? "border-primary bg-primary/10 text-primary" : "hover:border-foreground/30")}>
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category" className="font-semibold">Category</Label>
          <select id="category" name="category" value={values.category}
            onChange={(e) => set("category", e.target.value)} required className={selectClass}>
            <option value="" disabled>Pick one…</option>
            {categoriesFor(values.trade).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {category?.confirm && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-primary bg-primary/10 p-3">
              <input type="checkbox" name="category_confirm" required className="mt-0.5 size-5 shrink-0 accent-primary" />
              <span className="font-semibold">{category.confirm.label}</span>
            </label>
          )}
          {values.category === "refrigerant" && (
            <p className="text-sm text-muted-foreground">
              Only buyers with an approved EPA 608 cert can contact you about refrigerant. No
              reclaimed or unverified refrigerant.
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">
            Condition{" "}
            <a href="/conditions" target="_blank" className="font-normal text-primary underline">What do these mean?</a>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CONDITIONS.map((c) => (
              <RadioCard key={c.value} name="condition" value={c.value} checked={values.condition === c.value}
                onSelect={() => set("condition", c.value)} label={c.label} sublabel={c.hint} />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="description" className="font-semibold">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <textarea id="description" name="description" value={values.description}
            onChange={(e) => set("description", e.target.value)} maxLength={4000} rows={5}
            placeholder="What it fits, ratings, why you have it…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-bold">Price & pickup</h2>
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="price" className="font-semibold">Price ($)</Label>
            <Input id="price" name="price" value={values.price} onChange={(e) => set("price", e.target.value)}
              inputMode="decimal" placeholder="Make offer" className="h-12 text-base" />
            <p className="text-xs text-muted-foreground">Leave blank for &quot;Make offer&quot;</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quantity" className="font-semibold">Quantity</Label>
            <Input id="quantity" name="quantity" value={values.quantity}
              onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" required className="h-12 text-base" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["pickup", "ships"] as const).map((key) => (
            <label key={key}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="checkbox" name={key} checked={values[key]}
                onChange={(e) => set(key, e.target.checked)} className="size-5 accent-primary" />
              <span className="font-semibold">
                {key === "pickup" ? "Local pickup" : category?.freight ? "Will ship (freight)" : "Will ship"}
              </span>
            </label>
          ))}
        </div>
        {category?.freight && (
          <p className="-mt-2 text-sm text-muted-foreground">
            Big item — buyers will see <span className="font-semibold text-foreground">{values.ships ? "Pickup or freight" : "Pickup only"}</span>.
            If you ship it, it goes by freight; say in the description who arranges it and roughly what it weighs.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="zip" className="font-semibold">Where is it? (zip)</Label>
          <Input id="zip" name="zip" value={values.zip} onChange={(e) => set("zip", e.target.value)}
            inputMode="numeric" pattern="\d{5}" maxLength={5} required className="h-12 text-base" />
        </div>
      </section>

      <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        {contactNote} By listing, you confirm this isn&apos;t a{" "}
        <a href="/prohibited" target="_blank" className="font-semibold underline">prohibited item</a>.
      </p>

      {state.error && <p role="alert" className="font-medium text-destructive">{state.error}</p>}

      <Button type="submit" size="xl" disabled={pending || ai.status === "reading"}>
        {pending ? "Saving…" : isEdit ? "Save changes" : "List it"}
      </Button>
    </form>
  );
}
