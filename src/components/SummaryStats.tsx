import { formatMass, formatNumber } from "../lib/format";
import { isPointVisibleInProjection, type ProjectionKey } from "../lib/projections";
import type { Meteorite } from "../types/meteorite";

interface SummaryStatsProps {
  data: Meteorite[];
  projection: ProjectionKey;
}

export function SummaryStats({ data, projection }: SummaryStatsProps) {
  if (data.length === 0) return null;

  const mapped = data.filter(
    (d) =>
      d.reclat != null &&
      d.reclong != null &&
      isPointVisibleInProjection(projection, d.reclat),
  );
  const unmapped = data.length - mapped.length;
  const totalMass = data.reduce((sum, d) => sum + (d.mass ?? 0), 0);
  const withMass = data.filter((d) => d.mass != null);
  const avgMass = withMass.length > 0 ? totalMass / withMass.length : 0;
  const fell = data.filter((d) => d.fall === "Fell").length;
  const found = data.filter((d) => d.fall === "Found").length;

  return (
    <div className="flex gap-6 px-4 py-2 text-xs text-gray-600 border-t border-gray-200 bg-gray-50">
      <span>
        <strong>{formatNumber(mapped.length)}</strong> mapped
        {unmapped > 0 && (
          <>
            {" "}
            | <strong>{formatNumber(unmapped)}</strong> unmapped
          </>
        )}
      </span>
      <span>
        Total mass: <strong>{formatMass(totalMass)}</strong>
      </span>
      <span>
        Avg mass: <strong>{formatMass(avgMass)}</strong>
      </span>
      <span>
        Fell: <strong>{formatNumber(fell)}</strong> | Found: <strong>{formatNumber(found)}</strong>
      </span>
    </div>
  );
}
