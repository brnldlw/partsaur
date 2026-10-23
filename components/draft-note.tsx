import { CONTACT_EMAIL } from "@/lib/site";

export function DraftNote() {
  return (
    <p role="note" className="mb-6 rounded-lg border-2 border-primary bg-primary/10 p-3 text-sm font-semibold">
      DRAFT — being finalized. Questions or suggestions: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
    </p>
  );
}
