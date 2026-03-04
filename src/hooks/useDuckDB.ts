import * as duckdb from "@duckdb/duckdb-wasm";
// Import the worker and WASM files as URLs for Vite
import duckdbWorkerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import duckdbWasmUrl from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import { useCallback, useEffect, useRef, useState } from "react";

export function useDuckDB() {
  const connRef = useRef<duckdb.AsyncDuckDBConnection | null>(null);
  const dbRef = useRef<duckdb.AsyncDuckDB | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        console.log("Initializing DuckDB");
        const logger = new duckdb.ConsoleLogger();
        const worker = new Worker(duckdbWorkerUrl, { type: "module" });
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(duckdbWasmUrl);

        const conn = await db.connect();

        // Load parquet file (relative so it works with GitHub Pages base path)
        const response = await fetch("data/meteorites.parquet");
        const buffer = await response.arrayBuffer();
        await db.registerFileBuffer("meteorites.parquet", new Uint8Array(buffer));

        await conn.query(
          "CREATE TABLE meteorites AS SELECT * FROM read_parquet('meteorites.parquet')",
        );

        if (!cancelled) {
          dbRef.current = db;
          connRef.current = conn;
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      connRef.current?.close();
      dbRef.current?.terminate();
    };
  }, []);

  const query = useCallback(async (sql: string): Promise<Record<string, unknown>[]> => {
    if (!connRef.current) throw new Error("DuckDB not initialized");
    const result = await connRef.current.query(sql);
    return result.toArray().map((row: Record<string, unknown>) => ({
      ...row,
    }));
  }, []);

  return { query, ready, error };
}
