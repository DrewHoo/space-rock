/**
 * Convert cleaned JSON to Parquet using @duckdb/node-api
 * Run with: npx tsx scripts/to-parquet.ts
 */

import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

async function main() {
  const rootDir = join(import.meta.dirname, "..");
  const jsonPath = join(rootDir, "public", "data", "meteorites.json");
  const parquetPath = join(rootDir, "public", "data", "meteorites.parquet");

  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  await conn.run(`
    COPY (SELECT * FROM read_json_auto('${jsonPath}'))
    TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION ZSTD)
  `);

  console.log(`Wrote ${parquetPath}`);

  const result = await conn.run(`
    SELECT COUNT(*) as cnt FROM read_parquet('${parquetPath}')
  `);
  const reader = result.getRows();
  const rows = reader.toArray();
  console.log(`Verified: ${rows[0][0]} records in parquet file`);
}

main().catch(console.error);
