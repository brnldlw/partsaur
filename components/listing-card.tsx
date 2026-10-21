import Link from "next/link";
import { MapPin } from "lucide-react";
import { conditionLabel } from "@/lib/categories";
import { formatPrice, photoUrl } from "@/lib/listings";
import type { SearchHit } from "@/lib/search";

export function ListingCard({ hit }: { hit: SearchHit }) {
  return (
    <Link href={`/listing/${hit.id}`} className="flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary">
      <div className="size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {hit.cover_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(hit.cover_path)} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-bold leading-snug">{hit.title}</p>
        {hit.part_number && (
          <p className="truncate font-mono text-sm">
            {hit.brand && <span className="font-sans font-semibold">{hit.brand} </span>}
            {hit.part_number}
          </p>
        )}
        <p className="mt-1 text-lg font-black">{formatPrice(hit.price_cents)}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>{conditionLabel(hit.condition)}</span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {hit.miles != null ? `${Math.max(1, Math.round(hit.miles))} mi` : hit.zip}
          </span>
          {hit.ships && <span>Ships</span>}
          {hit.match_rank === 0 && <span className="font-semibold text-primary">Exact part #</span>}
        </p>
      </div>
    </Link>
  );
}
