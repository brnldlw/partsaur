import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Wordmark } from "@/components/wordmark";
import { CONTACT_EMAIL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 w-full border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Wordmark className="text-lg" />
          <p className="text-muted-foreground">Find the part. Sell the dead stock.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/pricing" className="py-2 hover:underline">Pricing</Link>
          <Link href="/terms" className="py-2 hover:underline">Terms</Link>
          <Link href="/privacy" className="py-2 hover:underline">Privacy</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="py-2 hover:underline">
            {CONTACT_EMAIL}
          </a>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
