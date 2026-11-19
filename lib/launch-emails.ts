import "server-only";
import { sendEmail, type EmailKind } from "@/lib/email/send";
import { getSpotsLeft } from "@/lib/founding-spots";
import { LAUNCH_PASS_END_LABEL, LAUNCH_PASS_ENDS_AT } from "@/lib/launch";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Reminder windows (midnight US Eastern). If the daily email cap stops a run
// partway, the next day's run picks up whoever hasn't been emailed yet.
const SEVEN_DAY_FROM = new Date("2027-03-24T04:00:00Z"); // March 24
const ONE_DAY_FROM = new Date("2027-03-30T04:00:00Z"); // March 30

export type ReminderStage = { kind: Extract<EmailKind, "launch_pass_7d" | "launch_pass_1d">; label: string };

export function reminderStage(now = new Date()): ReminderStage | null {
  if (now >= LAUNCH_PASS_ENDS_AT) return null;
  if (now >= ONE_DAY_FROM) return { kind: "launch_pass_1d", label: "1 day before" };
  if (now >= SEVEN_DAY_FROM) return { kind: "launch_pass_7d", label: "7 days before" };
  return null;
}

export type OverLimitSeller = {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  active_listings: number;
  has_business: boolean;
};

/** Sellers with more than 10 active listings and no paid plan. */
export async function getOverLimitSellers(): Promise<OverLimitSeller[]> {
  const { data, error } = await createAdminClient().rpc("launch_pass_over_limit_sellers");
  if (error) {
    console.error("launch_pass_over_limit_sellers failed:", error.message);
    return [];
  }
  return (data ?? []) as OverLimitSeller[];
}

export type ReminderRun = { stage: string | null; eligible: number; alreadySent: number; sent: number; stoppedEarly: boolean };

export async function sendLaunchPassReminders(now = new Date()): Promise<ReminderRun> {
  const stage = reminderStage(now);
  if (!stage) return { stage: null, eligible: 0, alreadySent: 0, sent: 0, stoppedEarly: false };

  const admin = createAdminClient();
  const [sellers, { data: log }, spots] = await Promise.all([
    getOverLimitSellers(),
    admin.from("email_log").select("to_user_id").eq("kind", stage.kind).limit(10_000),
    getSpotsLeft(),
  ]);
  const done = new Set((log ?? []).map((r) => r.to_user_id));
  const todo = sellers.filter((s) => !done.has(s.user_id));

  let sent = 0;
  let stoppedEarly = false;
  for (const s of todo) {
    const supply = s.role === "supply_house";
    const foundingLeft = supply ? spots.founding_supply.left : spots.founding_shop.left;
    const offer = supply
      ? foundingLeft > 0
        ? `Founding Supply House is $99/mo, locked — only ${foundingLeft} spots left.`
        : "Supply House plans keep everything unlimited."
      : foundingLeft > 0
        ? `Lock in Founding Shop at $19/mo for life — only ${foundingLeft} of 50 spots left. Unlimited listings, your storefront, bulk upload, and priority in Wanted matches.`
        : "Shop Pro ($39/mo) keeps everything unlimited.";
    const first = s.display_name.split(" ")[0] || "there";
    const when = stage.kind === "launch_pass_1d" ? "tomorrow" : `on ${LAUNCH_PASS_END_LABEL}`;

    const ok = await sendEmail({
      kind: stage.kind,
      to: s.email,
      toUserId: s.user_id,
      subject:
        stage.kind === "launch_pass_1d"
          ? "Your Partsaur Launch Pass ends tomorrow"
          : `Your Partsaur Launch Pass ends ${LAUNCH_PASS_END_LABEL}`,
      lines: [
        `Hi ${first},`,
        `Thanks for listing on Partsaur early. Your Free Launch Pass ends ${when}.`,
        `You have ${s.active_listings} active listings. After ${LAUNCH_PASS_END_LABEL}, free accounts can have 10. Your listings stay up — you just can't add new ones until you're under 10 or on a plan.`,
        offer,
        "No card on file, nothing to cancel. If you do nothing, you simply go back to the free plan.",
      ],
      buttons: [
        {
          label: foundingLeft > 0 ? (supply ? "Lock in $99/mo" : "Lock in $19/mo for life") : "See plans",
          url: `${SITE_URL}/pricing#founding`,
        },
        { label: "My listings", url: `${SITE_URL}/dashboard/listings` },
      ],
    });
    if (!ok) {
      stoppedEarly = true; // daily cap (or Resend down) — tomorrow's run continues
      break;
    }
    sent++;
  }
  return { stage: stage.label, eligible: sellers.length, alreadySent: sellers.length - todo.length, sent, stoppedEarly };
}
