import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { emailReservedSpots } from "@/app/actions/admin";
import { AdminFallback, AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { getSpotsLeft } from "@/lib/founding-spots";
import { isStripeEnabled } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

async function Overview() {
  await requireAdmin();
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const head = { count: "exact" as const, head: true };
  const n = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [waitlist, profiles, active, wantedOpen, reportsOpen, certsPending, emailsToday, alerts, spots, conversations] = await Promise.all([
    n(admin.from("waitlist").select("id", head)),
    n(admin.from("profiles").select("id", head)),
    n(admin.from("listings").select("id", head).eq("status", "active")),
    n(admin.from("wanted_requests").select("id", head).eq("status", "open")),
    n(admin.from("reports").select("id", head).eq("status", "open")),
    n(admin.from("certifications").select("id", head).eq("status", "pending")),
    n(admin.from("email_log").select("id", head).gte("created_at", since)),
    n(admin.from("part_alerts").select("id", head).is("notified_at", null)),
    getSpotsLeft(),
    n(admin.from("conversations").select("id", head)),
  ]);
  const reservedWaiting = await n(
    admin.from("waitlist").select("id", head).not("plan_interest", "is", null).is("checkout_emailed_at", null),
  );

  const tiles: { label: string; value: string | number; href?: string; alert?: boolean }[] = [
    { label: "Open reports", value: reportsOpen, href: "/admin/reports", alert: reportsOpen > 0 },
    { label: "EPA 608 waiting", value: certsPending, href: "/admin/certs", alert: certsPending > 0 },
    { label: "Users", value: profiles, href: "/admin/signups?tab=users" },
    { label: "Waitlist", value: waitlist, href: "/admin/signups" },
    { label: "Active listings", value: active, href: "/admin/listings" },
    { label: "Open Wanted", value: wantedOpen },
    { label: "Conversations", value: conversations },
    { label: "Waiting on Notify-me", value: alerts, href: "/admin/signups?tab=alerts" },
    { label: "Founding Shop sold", value: `${spots.founding_shop.cap - spots.founding_shop.left} / ${spots.founding_shop.cap}`, href: "/admin/signups?tab=founding" },
    { label: "Founding Supply sold", value: `${spots.founding_supply.cap - spots.founding_supply.left} / ${spots.founding_supply.cap}`, href: "/admin/signups?tab=founding" },
    { label: "Emails sent (24h)", value: `${emailsToday} / 100`, alert: emailsToday > 80 },
  ];

  return (
    <>
    {reservedWaiting > 0 && isStripeEnabled() && (
      <form action={emailReservedSpots} className="mb-6 flex flex-col gap-2 rounded-xl border-2 border-primary bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">
          {reservedWaiting} {reservedWaiting === 1 ? "person" : "people"} reserved a Founding spot before checkout opened.
        </p>
        <Button type="submit" size="xl">Email them (up to 40)</Button>
      </form>
    )}
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => {
        const inner = (
          <div className={`h-full rounded-xl border-2 p-4 ${t.alert ? "border-primary bg-primary/10" : "bg-card"}`}>
            <p className="text-sm text-muted-foreground">{t.label}</p>
            <p className="text-2xl font-black">{t.value}</p>
          </div>
        );
        return <li key={t.label}>{t.href ? <Link href={t.href}>{inner}</Link> : inner}</li>;
      })}
    </ul>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell active="/admin"><Overview /></AdminShell>
    </Suspense>
  );
}
