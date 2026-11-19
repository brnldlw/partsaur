import Link from "next/link";
import { cacheLife } from "next/cache";
import { PartyPopper } from "lucide-react";
import { isLaunchPassActive, LAUNCH_PASS_END_LABEL } from "@/lib/launch";
import { cn } from "@/lib/utils";

/** "Free Launch: list unlimited parts free until March 31." Disappears on its own when the pass ends. */
export async function LaunchBanner({ className, link = true }: { className?: string; link?: boolean }) {
  "use cache";
  cacheLife("hours");
  if (!isLaunchPassActive()) return null;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4", className)}>
      <PartyPopper className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="text-lg font-bold leading-snug">
          Free Launch: list unlimited parts free until {LAUNCH_PASS_END_LABEL}.
        </p>
        <p className="text-sm text-muted-foreground">
          Bulk CSV upload and your own storefront included. No card needed.
          {link && (
            <>
              {" "}
              <Link href="/pricing#launch-pass" className="font-semibold text-primary underline-offset-4 hover:underline">
                How it works
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
