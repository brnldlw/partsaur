import Link from "next/link";
import { Suspense } from "react";
import { Camera, Megaphone, Search, Store, Warehouse, Wrench } from "lucide-react";
import { PlanOffer, PlanOfferSkeleton } from "@/components/plan-offer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WaitlistForm } from "@/components/waitlist-form";
import { TRADES } from "@/lib/site";
import { cn } from "@/lib/utils";

const AUDIENCES = [
  {
    icon: Wrench,
    title: "For Techs",
    lead: "Find parts fast.",
    body: "Search by part number and see who has it within driving distance. Post a Wanted request and let the shelves come to you.",
  },
  {
    icon: Store,
    title: "For Shops",
    lead: "Turn dead stock into cash.",
    body: "Leftover-from-job and overstock parts are money sitting on a shelf. Snap a photo of the box and it's listed in under 30 seconds.",
  },
  {
    icon: Warehouse,
    title: "For Supply Houses",
    lead: "Clear obsolete inventory.",
    body: "Put discontinued and slow-moving stock in front of every tech in your region who's hunting for exactly that part.",
  },
];

const FEATURES = [
  {
    icon: Camera,
    title: "Photo-to-listing",
    body: "Snap the box label or nameplate — Partsaur reads the brand, part number, and ratings for you.",
  },
  {
    icon: Megaphone,
    title: "Wanted board",
    body: "\"Need this by Friday within 150 miles.\" We ping sellers nearby who have it.",
  },
  {
    icon: Search,
    title: "Search by part number",
    body: "Dashes, spaces, whatever — we match the part number the way techs actually type it.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:pt-20">
        <div className="flex flex-wrap gap-2">
          {TRADES.map((t) => (
            <span
              key={t.value}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                t.status === "live" ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {t.label}
              {t.status === "coming_soon" && " · Coming Soon"}
            </span>
          ))}
        </div>
        <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Find the part.
          <br />
          <span className="text-primary">Sell the dead stock.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Job&apos;s stalled and the part is 3 weeks out. Someone nearby has it sitting on a shelf.
          Partsaur connects you — HVAC/R, electrical, plumbing, and more.
        </p>
        <form action="/search" className="mt-8 flex max-w-2xl gap-2">
          <Input
            name="q"
            placeholder="Part #, brand, or what it is"
            aria-label="Search parts"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-14 flex-1 text-lg"
          />
          <Button type="submit" size="xl" className="h-14 px-5" aria-label="Search">
            <Search className="!size-5" /> <span className="hidden sm:inline">Search</span>
          </Button>
        </form>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="xl" variant="outline">
            <Link href="/sell/new">Sell a part</Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href="#founding">Founding pricing</Link>
          </Button>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {AUDIENCES.map(({ icon: Icon, title, lead, body }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <Icon className="size-8 text-primary" aria-hidden />
              <h2 className="mt-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {title}
              </h2>
              <p className="mt-1 text-xl font-bold">{lead}</p>
              <p className="mt-2 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-black sm:text-3xl">Built for the job site</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-6 text-primary" aria-hidden />
              </div>
              <div>
                <h3 className="font-bold">{title}</h3>
                <p className="text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Founding offer */}
      <section id="founding" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-10">
        <h2 className="text-2xl font-black sm:text-3xl">Founding members</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The first 50 shops and first 10 supply houses lock in their price for life. Buying and
          posting Wanted requests is always free.{" "}
          <Link href="/pricing" className="font-semibold text-primary underline-offset-4 hover:underline">
            Full pricing
          </Link>
        </p>
        <div className="mt-6">
          <Suspense fallback={<PlanOfferSkeleton />}>
            <PlanOffer />
          </Suspense>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="mx-auto max-w-2xl scroll-mt-20 px-4 py-10">
        <div className="rounded-2xl border-2 bg-card p-5 sm:p-8">
          <h2 className="text-2xl font-black sm:text-3xl">Not ready to sign up?</h2>
          <p className="mb-6 mt-2 text-muted-foreground">
            Tell us your trade and zip, and we&apos;ll let you know when parts start showing up
            near you.
          </p>
          <WaitlistForm />
        </div>
      </section>
    </>
  );
}
