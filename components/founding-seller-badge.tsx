import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

export function FoundingSellerBadge({ number, className }: { number: number | null | undefined; className?: string }) {
  if (!number) return null;
  return (
    <span
      title={`Founding Seller #${number} — one of the first 100 sellers on Partsaur`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary",
        className,
      )}
    >
      <Award className="size-3.5" aria-hidden />
      Founding Seller #{number}
    </span>
  );
}
