import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminFallback, AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/admin";
import { PLAN_LABELS, type Plan } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Signups · Admin", robots: { index: false } };

const TABS = [
  { key: "waitlist", label: "Waitlist" },
  { key: "users", label: "Users" },
  { key: "founding", label: "Founding" },
  { key: "alerts", label: "Notify-me" },
];

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Table({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap p-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="whitespace-nowrap p-2">{c ?? "—"}</td>)}</tr>
          ))}
          {!rows.length && <tr><td colSpan={head.length} className="p-6 text-center text-muted-foreground">Nothing yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

async function Signups({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab = "waitlist" } = await searchParams;
  const admin = createAdminClient();

  let content: React.ReactNode = null;
  if (tab === "users") {
    const [{ data: auth }, { data: profiles }] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
      admin.from("profiles").select("id, display_name, trade, role, zip, epa608_verified, businesses(name, plan)"),
    ]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const users = [...(auth?.users ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    content = (
      <Table
        head={["Joined", "Email", "Name", "Trade", "Role", "Zip", "Business", "Plan", "EPA"]}
        rows={users.map((u) => {
          const p = byId.get(u.id);
          const b = p?.businesses as unknown as { name: string; plan: Plan } | null;
          return [when(u.created_at), u.email ?? "", p?.display_name ?? "(not set up)", p?.trade ?? null, p?.role ?? null, p?.zip ?? null, b?.name ?? null, b ? PLAN_LABELS[b.plan] : "Free", p?.epa608_verified ? "✓" : null];
        })}
      />
    );
  } else if (tab === "founding") {
    const { data } = await admin.from("founding_signups").select("email, plan, stripe_subscription_id, created_at").order("created_at", { ascending: false });
    content = <Table head={["Date", "Email", "Plan", "Stripe subscription"]}
      rows={(data ?? []).map((r) => [when(r.created_at), r.email, PLAN_LABELS[r.plan as Plan] ?? r.plan, r.stripe_subscription_id])} />;
  } else if (tab === "alerts") {
    const { data } = await admin.from("part_alerts").select("email, brand, part_number, zip, created_at, notified_at").order("created_at", { ascending: false }).limit(500);
    content = <Table head={["Date", "Email", "Part", "Zip", "Notified"]}
      rows={(data ?? []).map((r) => [when(r.created_at), r.email, [r.brand, r.part_number].filter(Boolean).join(" "), r.zip, r.notified_at ? when(r.notified_at) : null])} />;
  } else {
    const { data } = await admin.from("waitlist").select("email, trade, role, zip, plan_interest, created_at").order("created_at", { ascending: false }).limit(1000);
    content = <Table head={["Date", "Email", "Trade", "Role", "Zip", "Interested in"]}
      rows={(data ?? []).map((r) => [when(r.created_at), r.email, r.trade, r.role, r.zip, r.plan_interest ? PLAN_LABELS[r.plan_interest as Plan] : null])} />;
  }

  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/signups?tab=${t.key}`}
            className={cn("flex h-10 items-center rounded-lg border px-3 text-sm font-semibold", tab === t.key && "border-primary bg-primary text-primary-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}

export default function AdminSignupsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell active="/admin/signups"><Signups searchParams={searchParams} /></AdminShell>
    </Suspense>
  );
}
