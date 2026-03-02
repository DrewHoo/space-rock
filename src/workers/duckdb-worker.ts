import * as duckdb from "@duckdb/duckdb-wasm";

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

async function init() {
  const DUCKDB_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);

  if (!bundle.mainWorker) throw new Error("DuckDB mainWorker not available");
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  conn = await db.connect();

  // Load the parquet file
  const response = await fetch("/data/meteorites.parquet");
  const buffer = await response.arrayBuffer();
  await db.registerFileBuffer("meteorites.parquet", new Uint8Array(buffer));

  await conn.query(`
    CREATE TABLE meteorites AS SELECT * FROM read_parquet('meteorites.parquet')
  `);

  return true;
}

async function query(sql: string): Promise<Record<string, unknown>[]> {
  if (!conn) throw new Error("DuckDB not initialized");
  const result = await conn.query(sql);
  return result.toArray().map((row: Record<string, unknown>) => ({ ...row }));
}

// Message handler
self.onmessage = async (e: MessageEvent) => {
  const { id, type, sql } = e.data;

  try {
    if (type === "init") {
      await init();
      self.postMessage({ id, result: true });
    } else if (type === "query") {
      const rows = await query(sql);
      self.postMessage({ id, result: rows });
    }
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
