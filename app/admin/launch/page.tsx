import type { Metadata } from "next";
import { Suspense } from "react";
import { runLaunchReminders } from "@/app/actions/admin";
import { DailyBars, LabeledBars } from "@/components/admin-bar-chart";
import { AdminFallback, AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { FOUNDING_SELLER_CAP, isLaunchPassActive, LAUNCH_PASS_END_LABEL_LONG, launchPassDaysLeft } from "@/lib/launch";
import { getOverLimitSellers, reminderStage } from "@/lib/launch-emails";
import { createAdminClient } from "@/lib/supabase/admin";
import { tradeLabel } from "@/lib/trades";

export const metadata: Metadata = { title: "Admin · Launch", robots: { index: false } };

type Stats = {
  signups_per_day: { day: string; n: number }[];
  listings_per_day: { day: string; n: number }[];
  listings_by_trade: { trade: string; n: number }[];
  top_referrers: { id: string; name: string; email: string | null; code: string; signed_up: number; sellers: number }[];
  badges_left: number;
  total_profiles: number;
  total_sellers: number;
  referred_signups: number;
};

async function Launch({ searchParams }: { searchParams: Promise<{ ran?: string }> }) {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data, error }, overLimit, { ran }, { data: sentLog }] = await Promise.all([
    admin.rpc("admin_launch_stats", { p_days: 30 }),
    getOverLimitSellers(),
    searchParams,
    admin.from("email_log").select("kind").in("kind", ["launch_pass_7d", "launch_pass_1d"]).limit(10_000),
  ]);
  if (error || !data) {
    return <p className="rounded-lg border-2 border-destructive p-4">Couldn&apos;t load stats — has migration 0010 been run? ({error?.message})</p>;
  }
  const s = data as Stats;
  const stage = reminderStage();
  const sent7 = (sentLog ?? []).filter((r) => r.kind === "launch_pass_7d").length;
  const sent1 = (sentLog ?? []).filter((r) => r.kind === "launch_pass_1d").length;

  const tiles = [
    { label: "Launch Pass", value: isLaunchPassActive() ? `${launchPassDaysLeft()} days left` : "Ended" },
    { label: "Founding Seller badges left", value: `${s.badges_left} / ${FOUNDING_SELLER_CAP}` },
    { label: "Accounts", value: s.total_profiles },
    { label: "Accounts that have listed", value: s.total_sellers },
    { label: "Signed up by referral", value: s.referred_signups },
    { label: "Over 10 listings, no plan", value: overLimit.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      {ran && <p role="status" className="rounded-lg border-2 border-primary bg-primary/10 p-3 font-semibold">{ran}</p>}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-xl border-2 bg-card p-4">
            <p className="text-sm text-muted-foreground">{t.label}</p>
            <p className="text-2xl font-black">{t.value}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <DailyBars title="New accounts per day" rows={s.signups_per_day ?? []} />
        <DailyBars title="Listings posted per day" rows={s.listings_per_day ?? []} />
      </div>

      <LabeledBars title="Active listings by trade" rows={(s.listings_by_trade ?? []).map((r) => ({ label: tradeLabel(r.trade) || r.trade, n: r.n }))} />

      <section className="rounded-xl border-2 bg-card p-4">
        <h2 className="font-bold">Top referrers</h2>
        <p className="text-sm text-muted-foreground">“Sellers” = people they referred who posted a listing. Rewards aren&apos;t set up yet — this just tracks it.</p>
        {s.top_referrers?.length ? (
          <div className="-mx-4 mt-3 overflow-x-auto px-4">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2">Who</th><th>Code</th><th className="text-right">Signed up</th><th className="text-right">Sellers</th></tr>
              </thead>
              <tbody>
                {s.top_referrers.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2"><p className="font-semibold">{r.name}</p><p className="text-muted-foreground">{r.email}</p></td>
                    <td className="font-mono">{r.code}</td>
                    <td className="text-right">{r.signed_up}</td>
                    <td className="text-right text-lg font-black">{r.sellers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No referrals yet.</p>
        )}
      </section>

      <section className="rounded-xl border-2 bg-card p-4">
        <h2 className="font-bold">Launch Pass ending emails</h2>
        <p className="text-sm text-muted-foreground">
          Sent automatically each morning: from March 24 (“ends March 31”) and from March 30 (“ends tomorrow”) to
          sellers with more than 10 active listings and no paid plan. Each person gets each email once. Uses the
          low-priority daily cap, so message notifications always go first. Pass ends {LAUNCH_PASS_END_LABEL_LONG}.
        </p>
        <p className="mt-2 text-sm">7-day emails sent: <b>{sent7}</b> · 1-day emails sent: <b>{sent1}</b> · Right now: <b>{stage ? `${stage.label} window` : "outside the send windows"}</b></p>
        {overLimit.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer py-1">Who would get it ({overLimit.length})</summary>
            <ul className="mt-1">
              {overLimit.map((o) => <li key={o.user_id} className="border-t py-1">{o.display_name} · {o.email} · {o.active_listings} listings</li>)}
            </ul>
          </details>
        )}
        {stage && (
          <form action={runLaunchReminders} className="mt-3">
            <Button type="submit" size="xl" variant="outline">Send any that are due now</Button>
          </form>
        )}
      </section>
    </div>
  );
}

export default function AdminLaunchPage({ searchParams }: { searchParams: Promise<{ ran?: string }> }) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminShell active="/admin/launch"><Launch searchParams={searchParams} /></AdminShell>
    </Suspense>
  );
}
