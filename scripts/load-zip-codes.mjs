// Loads US zip code centroids into the zip_codes table.
// Source: US Census Gazetteer ZCTA file (public domain).
//
//   curl -LO https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip
//   unzip 2024_Gaz_zcta_national.zip
//   node --env-file=.env.local scripts/load-zip-codes.mjs 2024_Gaz_zcta_national.txt
//
// Safe to re-run (upserts).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node --env-file=.env.local scripts/load-zip-codes.mjs <gazetteer.txt>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const [header, ...lines] = readFileSync(file, "utf8").trim().split("\n");
const cols = header.split("\t").map((c) => c.trim());
const iZip = cols.indexOf("GEOID");
const iLat = cols.indexOf("INTPTLAT");
const iLng = cols.indexOf("INTPTLONG");

const rows = lines
  .map((line) => line.split("\t").map((v) => v.trim()))
  .map((v) => ({ zip: v[iZip], lat: Number(v[iLat]), lng: Number(v[iLng]) }))
  .filter((r) => /^\d{5}$/.test(r.zip) && Number.isFinite(r.lat) && Number.isFinite(r.lng))
  .map((r) => ({ ...r, location: `SRID=4326;POINT(${r.lng} ${r.lat})` }));

const BATCH = 1000;
for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from("zip_codes").upsert(rows.slice(i, i + BATCH));
  if (error) {
    console.error(`Failed at row ${i}:`, error.message);
    process.exit(1);
  }
  process.stdout.write(`\r${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
}
console.log("\nDone.");
