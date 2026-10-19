import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-black tracking-tight", className)}>
      Parts<span className="text-primary">aur</span>
    </span>
  );
}
