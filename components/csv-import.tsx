"use client";

import { useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { FileUp } from "lucide-react";
import { importListings, type ImportResult } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import { categoryLabel, conditionLabel } from "@/lib/categories";
import { CSV_COLUMNS, MAX_IMPORT_ROWS, parseListingInput } from "@/lib/listing-input";
import { formatPrice } from "@/lib/listings";
import { cn } from "@/lib/utils";

type Row = { raw: Record<string, string>; error: string | null };

export function CsvImport({ defaultZip }: { defaultZip: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setFileError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: ({ data, meta }) => {
        const missing = ["title", "category", "condition"].filter((c) => !meta.fields?.includes(c));
        if (missing.length) {
          setFileError(`Missing column(s): ${missing.join(", ")}. Start from the template.`);
          setRows(null);
          return;
        }
        if (data.length > MAX_IMPORT_ROWS) {
          setFileError(`That file has ${data.length} rows. Up to ${MAX_IMPORT_ROWS} per upload — split it up.`);
          setRows(null);
          return;
        }
        setRows(
          data.map((raw) => {
            const parsed = parseListingInput(raw, defaultZip);
            return { raw, error: parsed.ok ? null : parsed.error };
          }),
        );
      },
      error: () => setFileError("Couldn't read that file. Save it as CSV and try again."),
    });
  }

  async function runImport() {
    if (!rows) return;
    setPending(true);
    const res = await importListings(rows.map((r) => r.raw));
    setPending(false);
    setResult(res);
    if (res.rowErrors) {
      setRows((current) =>
        current?.map((r, i) => ({ ...r, error: res.rowErrors!.find((e) => e.row === i + 1)?.error ?? r.error })) ?? null,
      );
    }
  }

  const bad = rows?.filter((r) => r.error).length ?? 0;

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border-2 border-primary bg-primary/10 p-5">
        <p className="text-lg font-bold">Imported {result.imported} listings.</p>
        <p className="text-muted-foreground">They&apos;re live now. Add photos from My listings → Edit.</p>
        <Button asChild size="xl"><Link href="/dashboard/listings">Go to my listings</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
        <li>
          <a href="/listing-template.csv" download className="font-semibold text-primary underline">
            Download the template
          </a>{" "}
          and open it in Excel or Google Sheets.
        </li>
        <li>One part per row. Leave price blank for &quot;Make offer&quot;. Zip defaults to {defaultZip}.</li>
        <li>Save as CSV and upload it here.</li>
      </ol>
      <p className="text-sm text-muted-foreground">Columns: {CSV_COLUMNS.join(", ")}</p>

      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 font-semibold hover:border-primary">
        <FileUp className="size-6 text-primary" />
        Choose CSV file
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>

      {fileError && <p role="alert" className="font-medium text-destructive">{fileError}</p>}

      {rows && (
        <>
          <p className="font-semibold">
            {rows.length} rows · {bad ? <span className="text-destructive">{bad} need fixing</span> : "all look good"}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Part #</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Condition</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const parsed = parseListingInput(r.raw, defaultZip);
                  return (
                    <tr key={i} className={cn("border-t align-top", r.error && "bg-destructive/10")}>
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">
                        {r.raw.title}
                        {r.error && <p className="font-semibold text-destructive">{r.error}</p>}
                      </td>
                      <td className="p-2 font-mono">{r.raw.part_number}</td>
                      <td className="p-2">{parsed.ok ? categoryLabel(parsed.data.category) : r.raw.category}</td>
                      <td className="p-2">{parsed.ok ? conditionLabel(parsed.data.condition) : r.raw.condition}</td>
                      <td className="p-2">{r.raw.quantity || 1}</td>
                      <td className="p-2">{parsed.ok ? formatPrice(parsed.data.price_cents) : r.raw.price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {result?.error && <p role="alert" className="font-medium text-destructive">{result.error}</p>}
          <Button type="button" size="xl" onClick={runImport} disabled={pending || bad > 0}>
            {pending ? "Importing…" : bad ? "Fix the red rows first" : `Import ${rows.length} listings`}
          </Button>
        </>
      )}
    </div>
  );
}
