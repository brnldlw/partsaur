import { CONTACT_EMAIL } from "@/lib/site";

export function DraftLegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div
        role="note"
        className="mb-8 rounded-lg border-2 border-primary bg-primary/10 p-4 font-semibold"
      >
        DRAFT — placeholder text, not yet reviewed by a lawyer. Questions:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
      </div>
      <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
      <div className="mt-6 flex flex-col gap-4 text-muted-foreground [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground">
        {children}
      </div>
    </div>
  );
}
