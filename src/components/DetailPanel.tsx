import { formatMass } from "../lib/format";
import type { Meteorite } from "../types/meteorite";

interface DetailPanelProps {
  meteorite: Meteorite | null;
  onClose: () => void;
}

export function DetailPanel({ meteorite, onClose }: DetailPanelProps) {
  if (!meteorite) return null;

  return (
    <div className="absolute bottom-2 left-2 z-10 w-72 bg-white/95 backdrop-blur rounded-lg shadow-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">{meteorite.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          &times;
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-gray-500">Year</dt>
        <dd>{meteorite.year ?? "Unknown"}</dd>
        <dt className="text-gray-500">Classification</dt>
        <dd>{meteorite.recclass}</dd>
        <dt className="text-gray-500">Group</dt>
        <dd>{meteorite.class_group}</dd>
        <dt className="text-gray-500">Mass</dt>
        <dd>{formatMass(meteorite.mass)}</dd>
        <dt className="text-gray-500">Status</dt>
        <dd>{meteorite.fall}</dd>
        <dt className="text-gray-500">Coordinates</dt>
        <dd>
          {meteorite.reclat != null && meteorite.reclong != null
            ? `${meteorite.reclat.toFixed(3)}, ${meteorite.reclong.toFixed(3)}`
            : "Unknown"}
        </dd>
      </dl>
      <div className="mt-2 flex gap-2">
        {meteorite.reclat != null && meteorite.reclong != null && (
          <a
            href={`https://www.google.com/maps?q=${meteorite.reclat},${meteorite.reclong}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
