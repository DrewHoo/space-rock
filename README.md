# Meteorite Explorer

Interactive, browser-based exploration of NASA's Meteorite Landings dataset. The app renders tens of thousands of meteorite records on a world map and lets you filter by year, mass, classification, and fall/found status — all powered by DuckDB running entirely in the browser via WebAssembly.

You can view the site on github pages here: [https://drewhoo.github.io/space-rock/](https://drewhoo.github.io/space-rock/)

## Where the data comes from

### Source dataset

The primary dataset is NASA’s **Meteorite Landings** dataset, available from the NASA Open Data Portal as CSV, JSON, RDF, and XML:

- [Meteorite Landings dataset](https://data.nasa.gov/dataset/meteorite-landings)

This project uses the JSON export of that dataset (in Socrata “data + meta” format) saved as `meteorite-landings.json` at the project root.

### Cleaning and enrichment

The data preparation is handled by `scripts/prepare-data.ts`:

- Reads `meteorite-landings.json` and extracts the relevant columns from the Socrata-style `data` array.
- Parses latitude/longitude and treats \((0, 0)\) as invalid coordinates (many entries are erroneous Gulf of Guinea points).
- Extracts the integer `year` from the provided datetime string.
- Parses `mass` as a floating-point value in grams.
- Derives a higher-level `class_group` from the raw `recclass` field using regex-based grouping (e.g., L/H/LL chondrites, irons, carbonaceous, achondrites, etc.).
- Writes a cleaned, flattened JSON file to `public/data/meteorites.json`.

You can run this script with:

```bash
npx tsx scripts/prepare-data.ts
```

### Converting to Parquet for DuckDB

To make querying efficient in the browser, the cleaned JSON is converted into a columnar Parquet file. This can happen in two ways:

1. **Via DuckDB CLI (preferred when available)**  
   `scripts/prepare-data.ts` attempts to call the DuckDB CLI:

   ```bash
   duckdb -c "COPY (SELECT * FROM read_json_auto('public/data/meteorites.json')) TO 'public/data/meteorites.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)"
   ```

   If the CLI is installed (e.g., `brew install duckdb` on macOS), this produces `public/data/meteorites.parquet` directly.

2. **Via DuckDB Node API**  
   Alternatively, you can explicitly run the Node-based converter:

   ```bash
   npx tsx scripts/to-parquet.ts
   ```

   This script uses `@duckdb/node-api` to execute:

   - `read_json_auto('public/data/meteorites.json')`
   - `COPY ... TO 'public/data/meteorites.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)`
   - Then verifies the row count by reading the resulting Parquet file.

### Using DuckDB-WASM in the browser

On the client side, the `useDuckDB` hook sets up DuckDB-WASM:

- Loads the DuckDB WASM binary and worker from `@duckdb/duckdb-wasm`.
- Fetches `/data/meteorites.parquet` as a static asset, registers it with DuckDB, and creates an in-memory `meteorites` table from `read_parquet('meteorites.parquet')`.
- Exposes a `query(sql: string)` function so React components can issue arbitrary SQL.

The `useDuckDbFilteredData` hook builds dynamic SQL `WHERE` clauses from the current filter state and runs DuckDB queries to return filtered meteorite records. This keeps all filtering logic in SQL while avoiding any backend server — everything runs in the browser against a Parquet file.

## Running the app locally

### Prerequisites

- Node.js 18+ (recommended)  
- Optional but recommended: DuckDB CLI (`brew install duckdb` on macOS) for one-step JSON→Parquet conversion.

### Install dependencies

```bash
npm install
```

### Prepare data (JSON and Parquet)

1. Place the NASA JSON export at the project root as `meteorite-landings.json`.
2. Run the data prep script:

   ```bash
   npx tsx scripts/prepare-data.ts
   ```

3. If the DuckDB CLI is not installed but you have Node, you can always run:

   ```bash
   npx tsx scripts/to-parquet.ts
   ```

After these steps, you should have:

- `public/data/meteorites.json` // this one can be deleted; need to adjust the script
- `public/data/meteorites.parquet`

### Start the dev server

```bash
npm run dev
```

Then open the printed URL (typically `http://localhost:5173/`) in your browser.

## Project structure (high level)

- `src/` – React app source
  - `hooks/useDuckDB.ts` – initializes DuckDB-WASM and exposes `query`.
  - `hooks/useDuckDbFilteredData.ts` – filter state + SQL-based querying.
  - `types/meteorite.ts` – TypeScript types for meteorite records and filters.
- `public/data/` – static data assets
  - `meteorites.json` – cleaned JSON (intermediate).
  - `meteorites.parquet` – final columnar dataset used by DuckDB-WASM.
- `scripts/`
  - `prepare-data.ts` – clean raw NASA JSON and (optionally) convert to Parquet via DuckDB CLI.
  - `to-parquet.ts` – convert cleaned JSON to Parquet using `@duckdb/node-api`.
