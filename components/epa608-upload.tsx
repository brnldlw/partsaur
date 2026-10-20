"use client";

import { useActionState, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { submitCertification, type CertState } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resizeImage } from "@/lib/image-resize";
import { createClient } from "@/lib/supabase/client";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function Epa608Upload({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<CertState, FormData>(submitCertification, { ok: false });
  const [path, setPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = file.type === "application/pdf" ? file : await resizeImage(file, 2000, 0.9);
      if (!ALLOWED.includes(blob.type)) {
        setError("Use a photo (JPG/PNG) or a PDF.");
        return;
      }
      const ext = blob.type === "application/pdf" ? "pdf" : blob.type.split("/")[1].replace("jpeg", "jpg");
      const newPath = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await createClient().storage.from("certifications").upload(newPath, blob, {
        contentType: blob.type,
      });
      if (upErr) {
        setError("Upload failed. Try again.");
        return;
      }
      setPath(newPath);
      setFileName(file.name);
    } finally {
      setUploading(false);
    }
  }

  if (state.ok) {
    return (
      <p role="status" className="rounded-lg border-2 border-primary bg-primary/10 p-4 font-semibold">
        Submitted. We&apos;ll review it — usually within a day.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="storage_path" value={path ?? ""} />
      <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center font-semibold hover:border-primary">
        {uploading ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6 text-primary" />}
        {fileName ? `Uploaded: ${fileName}` : "Photo of your EPA 608 card (or PDF)"}
        <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cert_number" className="font-semibold">
          Certification number <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="cert_number" name="cert_number" maxLength={40} className="h-12 text-base" />
      </div>
      {(error || state.error) && <p role="alert" className="font-medium text-destructive">{error ?? state.error}</p>}
      <Button type="submit" size="xl" disabled={!path || pending || uploading}>
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
      <p className="text-xs text-muted-foreground">Only you and Partsaur staff can see this file.</p>
    </form>
  );
}
