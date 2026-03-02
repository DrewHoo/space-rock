import { useCallback, useState } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { FilterPanel } from "./components/FilterPanel";
import { MapView } from "./components/MapView";
import { ProjectionPicker } from "./components/ProjectionPicker";
import { SummaryStats } from "./components/SummaryStats";
import { useDuckDbFilteredData } from "./hooks/useDuckDbFilteredData";
import type { ProjectionKey } from "./lib/projections";
import type { Meteorite } from "./types/meteorite";

function App() {
  const {
    data,
    totalCount,
    filters,
    updateFilter,
    resetFilters,
    ready,
    error,
    query,
  } = useDuckDbFilteredData();

  const [projection, setProjection] = useState<ProjectionKey>("equal-earth");
  const [selected, setSelected] = useState<Meteorite | null>(null);

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

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600">
        Failed to load database: {error}
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
