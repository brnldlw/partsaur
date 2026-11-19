import { ShareLink } from "@/components/share-link";
import { referralLink } from "@/lib/referrals";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export async function ReferralCard({ code }: { code: string | null }) {
  if (!code) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_referral_stats");
  const stats = (data?.[0] ?? { signed_up: 0, sellers: 0 }) as { signed_up: number; sellers: number };

  return (
    <section className="mb-8 flex flex-col gap-3 rounded-xl border-2 bg-card p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Invite sellers</p>
        <p className="mt-1 text-2xl font-black">
          You&apos;ve brought in {stats.sellers} seller{stats.sellers === 1 ? "" : "s"}
        </p>
        <p className="text-muted-foreground">
          Know a shop with a back room full of dead stock? Send them your link. You get credit when
          they sign up and post their first listing.
          {stats.signed_up > stats.sellers &&
            ` ${stats.signed_up - stats.sellers} more signed up and haven't listed yet.`}
        </p>
      </div>
      <ShareLink url={referralLink(SITE_URL, code)} />
    </section>
  );
}
