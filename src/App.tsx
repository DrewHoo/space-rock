import { debounce } from "es-toolkit";
import { useCallback, useEffect, useRef, useState } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { FilterPanel } from "./components/FilterPanel";
import { MapView } from "./components/MapView";
import { ProjectionPicker } from "./components/ProjectionPicker";
import { SummaryStats } from "./components/SummaryStats";
import { useDuckDB } from "./hooks/useDuckDB";
import { useFilters } from "./hooks/useFilters";
import type { ProjectionKey } from "./lib/projections";
import type { Meteorite } from "./types/meteorite";

function App() {
  const { query, ready, error: dbError } = useDuckDB();
  const { filters, updateFilter, resetFilters, buildWhereClause } =
    useFilters();

  const [data, setData] = useState<Meteorite[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [projection, setProjection] = useState<ProjectionKey>("equal-earth");
  const [selected, setSelected] = useState<Meteorite | null>(null);
  const [_loading, setLoading] = useState(true);

  // Fetch total count on init
  useEffect(() => {
    if (!ready) return;
    query("SELECT COUNT(*)::INT as count FROM meteorites").then((rows) => {
      setTotalCount(Number(rows[0].count));
    });
  }, [ready, query]);

  const queryRef = useRef(query);
  const readyRef = useRef(ready);
  const buildWhereClauseRef = useRef(buildWhereClause);
  queryRef.current = query;
  readyRef.current = ready;
  buildWhereClauseRef.current = buildWhereClause;

  const runFilteredQueryRef = useRef<ReturnType<
    typeof debounce<() => void>
  > | null>(null);
  if (!runFilteredQueryRef.current) {
    runFilteredQueryRef.current = debounce(
      () => {
        const q = queryRef.current;
        if (!readyRef.current || !q) return;
        const where = buildWhereClauseRef.current();
        setLoading(true);
        q(
          `SELECT name, id, nametype, recclass, class_group, mass, fall, year, reclat, reclong
         FROM meteorites
         WHERE ${where}
         ORDER BY year`,
        )
          .then((rows) => {
            setData(rows as unknown as Meteorite[]);
            setLoading(false);
          })
          .catch((err) => {
            console.error("Query error:", err);
            setLoading(false);
          });
      },
      300,
      { edges: ["leading", "trailing"] },
    );
  }
  const runFilteredQuery = runFilteredQueryRef.current;

  // Fetch filtered data when filters change (debounced 300ms). filters in deps required so effect re-runs and invokes debounced query.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filters intentionally in deps to trigger debounced query on filter change
  useEffect(() => {
    if (!ready) return;
    runFilteredQuery();
    return () => runFilteredQuery.cancel();
  }, [ready, filters, runFilteredQuery]);

  const handleSelect = useCallback((meteorite: Meteorite | null) => {
    setSelected(meteorite);
  }, []);

  const fetchMeteoriteNames = useCallback(
    async (search: string): Promise<{ label: string; value: string }[]> => {
      if (!search.trim()) return [];
      const escaped = search.replace(/'/g, "''");
      const rows = await query(
        `SELECT DISTINCT name FROM meteorites WHERE name ILIKE '%${escaped}%' ORDER BY name LIMIT 50`,
      );
      return (rows as { name: string }[]).map((row) => ({
        label: row.name,
        value: row.name,
      }));
    },
    [query],
  );

  if (dbError) {
    return (
      <div className="h-full flex items-center justify-center text-red-600">
        Failed to load database: {dbError}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full" />
        <span className="text-sm">Loading DuckDB &amp; meteorite data...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">Meteorite Explorer</h1>
        <ProjectionPicker value={projection} onChange={setProjection} />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 relative overflow-auto">
          <MapView
            data={data}
            projection={projection}
            onSelect={handleSelect}
          />
          <FilterPanel
            filters={filters}
            onUpdate={updateFilter}
            onReset={resetFilters}
            totalCount={totalCount}
            filteredCount={data.length}
            fetchMeteoriteNames={fetchMeteoriteNames}
          />
          <DetailPanel meteorite={selected} onClose={() => setSelected(null)} />
        </div>
        <SummaryStats data={data} projection={projection} />
      </main>
    </div>
  );
}

export default App;
