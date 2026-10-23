import type { Metadata } from "next";
import Link from "next/link";
import { DraftNote } from "@/components/draft-note";

export const metadata: Metadata = {
  title: "Prohibited items",
  description: "What can't be listed on Partsaur, and the rules for refrigerant.",
  alternates: { canonical: "/prohibited" },
};

const PROHIBITED = [
  { name: "Recalled items", detail: "Anything under a manufacturer or CPSC recall, unless it's been repaired under that recall and you say so." },
  { name: "Reclaimed or unverified refrigerant", detail: "Only virgin refrigerant in sealed, original factory cylinders. No recovered, reclaimed, mixed, or unlabeled refrigerant, and no partially used cylinders." },
  { name: "Stolen goods", detail: "If you can't say where it came from, don't list it. We cooperate with law enforcement." },
  { name: "Counterfeit or relabeled parts", detail: "Knock-offs sold as a name brand, or parts with altered labels or part numbers." },
  { name: "Hazardous waste", detail: "Contaminated oil, failed compressors still holding refrigerant, PCB-containing capacitors, or anything that needs hazmat disposal." },
  { name: "Things that aren't parts or tools", detail: "Partsaur is for trade parts, equipment, and tools." },
];

export default function ProhibitedPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <DraftNote />
      <h1 className="text-3xl font-black sm:text-4xl">Prohibited items</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        These can&apos;t be listed. Listings that break the rules get removed, and repeat offenders lose
        their account. See one? Tap <span className="font-semibold text-foreground">Report this listing</span>.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        {PROHIBITED.map((p) => (
          <li key={p.name} className="rounded-xl border-2 bg-card p-5">
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="mt-1 text-muted-foreground">{p.detail}</p>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="text-2xl font-black">Refrigerant rules</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
          <li>Buyers must have an approved EPA Section 608 certification on file to contact a refrigerant seller.</li>
          <li>Sellers: list the refrigerant type, cylinder size, and that it&apos;s virgin, in its sealed factory cylinder.</li>
          <li>Partsaur verifies buyer certifications but doesn&apos;t inspect what&apos;s sold — sellers are responsible for following EPA rules.</li>
        </ul>
      </section>

      <p className="mt-8 text-muted-foreground">
        Also see <Link href="/conditions" className="font-semibold text-primary underline">condition standards</Link>.
      </p>
    </div>
  );
}
