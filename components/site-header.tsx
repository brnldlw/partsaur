import Link from "next/link";
import { Suspense } from "react";
import { Megaphone, MessageCircle, Search, UserRound } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

async function AccountButton() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return <SignInButton />;
  const { data: unread } = await supabase.rpc("my_unread_count");
  return (
    <>
      <Button asChild variant="ghost" className="relative h-11 px-2.5 text-base sm:px-3">
        <Link href="/messages" aria-label={unread ? `Messages, ${unread} unread` : "Messages"}>
          <MessageCircle className="!size-5" />
          <span className="hidden md:inline">Messages</span>
          {unread ? (
            <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Link>
      </Button>
      <Button asChild variant="ghost" className="h-11 px-2.5 text-base sm:px-3">
        <Link href="/account" aria-label="Account"><UserRound className="!size-5" /><span className="hidden md:inline">Account</span></Link>
      </Button>
      <Button asChild className="h-11 px-4 text-base font-semibold">
        <Link href="/sell/new">Sell</Link>
      </Button>
    </>
  );
}

function SignInButton() {
  return (
    <Button asChild className="h-11 px-4 text-base font-semibold">
      <Link href="/login">Sign in</Link>
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" className="text-2xl" aria-label="Partsaur home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-2">
          <Button asChild variant="ghost" className="h-11 px-2.5 text-base sm:px-3">
            <Link href="/search" aria-label="Search parts"><Search className="!size-5" /><span className="hidden md:inline">Search</span></Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 px-2.5 text-base sm:px-3">
            <Link href="/wanted" aria-label="Wanted board"><Megaphone className="!size-5" /><span className="hidden md:inline">Wanted</span></Link>
          </Button>
          <Button asChild variant="ghost" className="hidden h-11 px-3 text-base md:inline-flex">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Suspense fallback={<SignInButton />}>
            <AccountButton />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}
