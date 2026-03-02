/**
 * Data preparation script: converts meteorite-landings.json → meteorites.parquet
 * Run with: npx tsx scripts/prepare-data.ts
 */

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLASS_GROUP_PATTERNS: [RegExp, string][] = [
  [/^H\d?$|^H[3-7]|^H\/L|^H~/, "H-chondrite"],
  [/^L\d?$|^L[3-7]|^L\/LL|^L~/, "L-chondrite"],
  [/^LL\d?$|^LL[3-7]|^LL~/, "LL-chondrite"],
  [/^C[IKMOVRHLB]|^C[1-4]|^Carbonaceous/, "Carbonaceous"],
  [/^E[HL]\d?$|^E[HL][3-7]|^Enstatite|^EH|^EL/, "Enstatite"],
  [
    /^Eucrite|^Diogenite|^Howardite|^Ureilite|^Aubrite|^Acapulcoite|^Lodranite|^Angrite|^Brachinite|^Winonaite/,
    "Achondrite",
  ],
  [
    /^Iron|^IC$|^IIAB|^IIB|^IIC|^IID|^IIE|^IIF|^IIIAB|^IIIC|^IIID|^IIIE|^IIIF|^IVA|^IVB|^IAB|^IC-|^Iron/,
    "Iron",
  ],
  [/^Pallasite|^Mesosiderite/, "Stony-iron"],
  [/^Martian|^Shergottite|^Nakhlite|^Chassignite|^SNC/, "Martian"],
  [/^Lunar/, "Lunar"],
];

function classifyGroup(recclass: string): string {
  for (const [pattern, group] of CLASS_GROUP_PATTERNS) {
    if (pattern.test(recclass)) return group;
  }
  return "Other";
}

interface RawRecord {
  name: string;
  id: string;
  nametype: string;
  recclass: string;
  mass: string | null;
  fall: string;
  year: string | null;
  reclat: string | null;
  reclong: string | null;
}

// Socrata format: data is array of arrays, columns defined in meta
function parseSocrataRow(row: (string | number | null | unknown)[]): RawRecord | null {
  // Columns: 0-7 are meta, 8=name, 9=id, 10=nametype, 11=recclass, 12=mass, 13=fall, 14=year, 15=reclat, 16=reclong
  return {
    name: row[8] as string,
    id: row[9] as string,
    nametype: row[10] as string,
    recclass: row[11] as string,
    mass: row[12] as string | null,
    fall: row[13] as string,
    year: row[14] as string | null,
    reclat: row[15] as string | null,
    reclong: row[16] as string | null,
  };
}

function main() {
  const rootDir = join(import.meta.dirname, "..");
  const inputPath = join(rootDir, "meteorite-landings.json");
  const outputDir = join(rootDir, "public", "data");
  const outputPath = join(outputDir, "meteorites.json");

  console.log("Reading meteorite-landings.json...");
  const raw = JSON.parse(readFileSync(inputPath, "utf-8"));

  const rows: (string | number | null | unknown)[][] = raw.data;
  console.log(`Raw records: ${rows.length}`);

  const cleaned: Record<string, unknown>[] = [];

  for (const row of rows) {
    const rec = parseSocrataRow(row);
    if (!rec) continue;

    let lat = rec.reclat ? parseFloat(rec.reclat) : null;
    let lon = rec.reclong ? parseFloat(rec.reclong) : null;

    // Treat 0,0 coordinates as data errors (Gulf of Guinea, not a real landing site)
    if (lat === 0 && lon === 0) {
      lat = null;
      lon = null;
    }

    // Parse year from datetime string
    let year: number | null = null;
    if (rec.year) {
      const match = rec.year.match(/^(\d{4})/);
      if (match) year = parseInt(match[1], 10);
    }

    const mass = rec.mass ? parseFloat(rec.mass) : null;

    cleaned.push({
      name: rec.name,
      id: parseInt(rec.id, 10),
      nametype: rec.nametype,
      recclass: rec.recclass,
      class_group: classifyGroup(rec.recclass),
      mass,
      fall: rec.fall,
      year,
      reclat: lat,
      reclong: lon,
    });
  }

  console.log(`Cleaned records: ${cleaned.length}`);

  // Log class group distribution
  const groupCounts: Record<string, number> = {};
  for (const r of cleaned) {
    const g = r.class_group as string;
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  }
  console.log("Class group distribution:");
  for (const [g, c] of Object.entries(groupCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${g}: ${c}`);
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(cleaned));
  console.log(`Wrote ${outputPath}`);

  // Now convert to parquet using DuckDB CLI if available, otherwise leave as JSON
  console.log("\nAttempting Parquet conversion with DuckDB CLI...");
  try {
    const parquetPath = join(outputDir, "meteorites.parquet");
    execSync(
      `duckdb -c "COPY (SELECT * FROM read_json_auto('${outputPath}')) TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION ZSTD)"`,
      { stdio: "inherit" },
    );
    console.log(`Wrote ${parquetPath}`);
  } catch {
    console.log("DuckDB CLI not found. Will use JSON fallback in the app.");
    console.log("To install: brew install duckdb");
  }
}

main();
