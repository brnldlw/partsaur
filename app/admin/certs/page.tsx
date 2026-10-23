import type { Metadata } from "next";
import { Suspense } from "react";
import { reviewCertification } from "@/app/actions/admin";
import { AdminFallback, AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "EPA 608 · Admin", robots: { index: false } };

async function Certs() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: certs } = await admin
    .from("certifications")
    .select("id, profile_id, cert_number, storage_path, created_at, profiles(display_name, zip)")
    .eq("status", "pending")
    .order("created_at")
    .limit(100);

  if (!certs?.length) {
    return <p className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">No certifications waiting.</p>;
  }

  const rows = await Promise.all(
    certs.map(async (c) => {
      const [{ data: signed }, { data: u }] = await Promise.all([
        admin.storage.from("certifications").createSignedUrl(c.storage_path, 600),
        admin.auth.admin.getUserById(c.profile_id),
      ]);
      const profile = c.profiles as unknown as { display_name: string; zip: string } | null;
      return { ...c, url: signed?.signedUrl ?? null, email: u?.user?.email ?? "", profile };
    }),
  );

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {rows.map((c) => (
        <li key={c.id} className="flex flex-col gap-3 rounded-xl border-2 bg-card p-4">
          <div>
            <p className="font-bold">{c.profile?.display_name}</p>
            <p className="break-all text-sm text-muted-foreground">{c.email} · {c.profile?.zip}</p>
            <p className="text-sm">Cert #: <span className="font-mono">{c.cert_number ?? "—"}</span></p>
            <p className="text-xs text-muted-foreground">Submitted {new Date(c.created_at).toLocaleString("en-US")}</p>
          </div>
          {c.url && (c.storage_path.endsWith(".pdf") ? (
            <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Open PDF (link expires in 10 min)</a>
          ) : (
            <a href={c.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.url} alt="EPA 608 card" className="max-h-72 w-full rounded-lg border object-contain" />
            </a>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <form action={reviewCertification}>
              <input type="hidden" name="cert_id" value={c.id} />
              <input type="hidden" name="decision" value="approved" />
              <Button type="submit" size="xl" className="w-full">Approve</Button>
            </form>
            <form action={reviewCertification}>
              <input type="hidden" name="cert_id" value={c.id} />
              <input type="hidden" name="decision" value="rejected" />
              <Button type="submit" size="xl" variant="outline" className="w-full">Reject</Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminCertsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell active="/admin/certs"><Certs /></AdminShell>
    </Suspense>
  );
}
