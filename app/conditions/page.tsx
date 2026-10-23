import type { Metadata } from "next";
import Link from "next/link";
import { DraftNote } from "@/components/draft-note";

export const metadata: Metadata = {
  title: "Condition standards",
  description: "What New in box, New old stock, Used working and For parts mean on Partsaur.",
  alternates: { canonical: "/conditions" },
};

const STANDARDS = [
  {
    name: "New in box",
    means: "Never installed. In the original manufacturer box, sealed or factory-packed.",
    examples: "Capacitor still in shrink wrap. Compressor on its original pallet with the box intact.",
    disclose: "Box damage, missing manuals or hardware.",
  },
  {
    name: "New, open box",
    means: "Never installed. Box opened — usually to check the part, or a job changed.",
    examples: "Board pulled out to compare pins, then put back. Motor returned from a job before install.",
    disclose: "Anything missing from the box (mounting kit, wiring harness, instructions).",
  },
  {
    name: "New old stock",
    means: "Never installed, but it's been on a shelf a while — often discontinued or superseded.",
    examples: "Obsolete control board from a supply house closeout. A 10-year-old TXV still in its box.",
    disclose: "Age if you know it, shelf wear, faded labels, whether it's been superseded.",
  },
  {
    name: "Used, working",
    means: "Pulled from service and known to work when removed (or bench-tested).",
    examples: "Motor removed during a changeout that ran fine. Board swapped while diagnosing.",
    disclose: "How you know it works, how long it ran, any cosmetic damage.",
  },
  {
    name: "For parts / not working",
    means: "Sold as-is. Doesn't work, or you can't confirm it does.",
    examples: "Failed board with good relays. Compressor with a bad winding but good fittings.",
    disclose: "What's wrong, if you know.",
  },
];

export default function ConditionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <DraftNote />
      <h1 className="text-3xl font-black sm:text-4xl">Condition standards</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Pick the condition that honestly fits. When in doubt, pick the lower one — a buyer who gets
        better than expected comes back.
      </p>
      <ul className="mt-8 flex flex-col gap-4">
        {STANDARDS.map((s) => (
          <li key={s.name} className="rounded-xl border-2 bg-card p-5">
            <h2 className="text-xl font-bold">{s.name}</h2>
            <p className="mt-1">{s.means}</p>
            <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Examples:</span> {s.examples}</p>
            <p className="mt-1 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Mention in the description:</span> {s.disclose}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-muted-foreground">
        Also see <Link href="/prohibited" className="font-semibold text-primary underline">what can&apos;t be listed</Link>.
      </p>
    </div>
  );
}
