import Link from "next/link";
import { Clock, MapPin, Zap } from "lucide-react";
import { categoryLabel } from "@/lib/categories";
import { tradeLabel } from "@/lib/trades";
import { milesText, neededByText, wantedLabel } from "@/lib/wanted";
import type { WantedHit } from "@/lib/wanted-search";
import { cn } from "@/lib/utils";

export function WantedCard({ hit }: { hit: WantedHit }) {
  return (
    <Link href={`/wanted/${hit.id}`}
      className={cn("flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary", hit.boosted && "border-2 border-primary")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold leading-snug">
          {hit.part_number ? <span className="font-mono">{wantedLabel(hit)}</span> : wantedLabel(hit)}
        </p>
        {hit.boosted && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            <Zap className="size-3" /> Urgent
          </span>
        )}
      </div>
      {hit.part_number && hit.description && <p className="line-clamp-2 text-sm text-muted-foreground">{hit.description}</p>}
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1 font-semibold text-foreground"><Clock className="size-3.5" />Needed {neededByText(hit.needed_by)}</span>
        <span className="flex items-center gap-1"><MapPin className="size-3.5" />{hit.miles != null ? `${milesText(hit.miles)} away` : `Near ${hit.zip}`}</span>
        <span>{tradeLabel(hit.trade)}{hit.category && ` · ${categoryLabel(hit.category, hit.trade)}`}</span>
        <span>{hit.requester_name}</span>
      </p>
    </Link>
  );
}
