"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resizeImage } from "@/lib/image-resize";
import { createClient } from "@/lib/supabase/client";

export type Photo = { path: string; url: string };

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function PhotoPicker({
  userId,
  bucket,
  photos,
  onChange,
  max,
  onUploaded,
}: {
  userId: string;
  bucket: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  max: number;
  /** Called after each photo finishes uploading. */
  onUploaded?: (photo: Photo, isFirst: boolean) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = max - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Up to ${max} photos.`);

    const supabase = createClient();
    let current = photos;
    setUploading((n) => n + picked.length);
    for (const file of picked) {
      try {
        const blob = await resizeImage(file);
        const type = blob.type;
        if (!ALLOWED.includes(type)) {
          setError("That photo format isn't supported. Try a JPG or PNG.");
          continue;
        }
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, blob, { contentType: type, cacheControl: "31536000" });
        if (upErr) {
          setError("Upload failed. Check your signal and try again.");
          continue;
        }
        const photo = { path, url: URL.createObjectURL(blob) };
        const isFirst = current.length === 0;
        current = [...current, photo];
        onChange(current);
        onUploaded?.(photo, isFirst);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const full = photos.length >= max;

  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <li key={p.path} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">
                  Cover
                </span>
              )}
              <div className="absolute bottom-1 right-1 flex gap-1">
                {i > 0 && (
                  <button
                    type="button"
                    aria-label="Make cover photo"
                    onClick={() => onChange([p, ...photos.filter((x) => x.path !== p.path)])}
                    className="flex size-9 items-center justify-center rounded-full bg-background/90 shadow"
                  >
                    <Star className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => onChange(photos.filter((x) => x.path !== p.path))}
                  className="flex size-9 items-center justify-center rounded-full bg-background/90 shadow"
                >
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-lg border bg-muted">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 && uploading > 0 && (
        <div className="flex h-24 items-center justify-center gap-2 rounded-lg border bg-muted">
          <Loader2 className="size-5 animate-spin" /> Uploading…
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="xl" disabled={full} onClick={() => cameraRef.current?.click()}>
          <Camera /> Take photo
        </Button>
        <Button type="button" size="xl" variant="outline" disabled={full} onClick={() => galleryRef.current?.click()}>
          <ImagePlus /> Choose
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-sm text-muted-foreground">
        {photos.length} of {max} photos. First photo is the cover.
      </p>
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </div>
  );
}
