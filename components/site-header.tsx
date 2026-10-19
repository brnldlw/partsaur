import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-2xl" aria-label="Partsaur home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Button asChild variant="ghost" className="h-11 px-3 text-base">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button asChild className="h-11 px-4 text-base font-semibold">
            <Link href="/#waitlist">Join</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
