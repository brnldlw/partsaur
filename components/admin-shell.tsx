import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/certs", label: "EPA 608" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/signups", label: "Signups" },
];

export async function AdminShell({ active, children }: { active: string; children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-black">Admin</h1>
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href}
            className={cn("flex h-11 shrink-0 items-center rounded-full border-2 px-4 text-sm font-semibold",
              active === t.href ? "border-primary bg-primary/10 text-primary" : "hover:border-foreground/30")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

export function AdminFallback() {
  return <div className="mx-auto mt-8 h-64 max-w-5xl animate-pulse rounded-xl bg-muted/40" />;
}
