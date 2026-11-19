import { cn } from "@/lib/utils";

/** Small reassurance line: buying side is always free. */
export function FreeForBuyers({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">Free for buyers.</span>{" "}
      {children ?? "Searching, messaging sellers, and posting Wanted requests never cost a thing."}
    </p>
  );
}
