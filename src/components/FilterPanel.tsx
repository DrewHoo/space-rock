import { Segmented, Slider, Tooltip } from "antd";
import { useCallback, useRef, useState } from "react";
import type { FilterState, MeteoriteClass } from "../types/meteorite";
// import { DebounceSelect } from "./DebounceSelect";
import { WikiTag } from "./WikiDrawer";

const CLASS_GROUPS: MeteoriteClass[] = [
  "H-chondrite",
  "L-chondrite",
  "LL-chondrite",
  "Carbonaceous",
  "Iron",
  "Achondrite",
  "Enstatite",
  "Stony-iron",
  "Martian",
  "Lunar",
  "Other",
];

interface FilterPanelProps {
  filters: FilterState;
  onUpdate: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
  fetchMeteoriteNames: (
    search: string,
  ) => Promise<{ label: string; value: string }[]>;
}

const INITIAL_X = 16;
const INITIAL_Y = 16;

export function FilterPanel({
  filters,
  onUpdate,
  onReset,
  totalCount,
  filteredCount,
  // fetchMeteoriteNames,
}: FilterPanelProps) {
  const [position, setPosition] = useState({ x: INITIAL_X, y: INITIAL_Y });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position.x, position.y],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current == null) return;
    setPosition({
      x: dragRef.current.posX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.posY + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }, []);

  const handleClassGroupsChange = useCallback(
    (cls: MeteoriteClass, checked: boolean) => {
      onUpdate(
        "classGroups",
        checked
          ? [...filters.classGroups, cls]
          : filters.classGroups.filter((c) => c !== cls),
      );
    },
    [onUpdate, filters.classGroups],
  );

  return (
    <div
      className="absolute z-10 flex flex-row items-stretch text-sm select-none"
      style={{ left: position.x, top: position.y }}
    >
      {/* Filter panel */}
      <div className="flex flex-col w-48 max-h-[calc(100vh-6rem)] overflow-hidden bg-white rounded-lg border border-gray-200 shadow-lg">
        {/* Drag handle */}
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 cursor-grab active:cursor-grabbing border-b border-gray-100 bg-gray-50/80 rounded-t-lg touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <h2 className="font-semibold text-base text-gray-800">Filters</h2>
          <button
            type="button"
            onClick={onReset}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800 shrink-0"
          >
            Clear all
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 overflow-y-auto select-text">
          <div className="text-xs text-gray-500">
            Showing {filteredCount.toLocaleString()} of{" "}
            {totalCount.toLocaleString()} meteorites
          </div>

          {/* Search */}
          {/* <div> // implemented this but haven't found it useful in practice
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Search by name
            </span>
            <DebounceSelect
              placeholder="e.g., Allende"
              value={filters.search || undefined}
              onChange={(v) => onUpdate("search", v ?? "")}
              fetchOptions={fetchMeteoriteNames}
              allowClear
              style={{ width: "100%" }}
            />
          </div> */}

          {/* Year Range */}
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Year: {filters.yearRange[0]} &ndash; {filters.yearRange[1]}
            </span>
            <Slider
              range
              min={860}
              max={2025}
              value={filters.yearRange}
              onChange={(value) =>
                onUpdate("yearRange", value as [number, number])
              }
            />
          </div>

          {/* Mass Range (log scale: 0 = 0g, 8 ≈ 100t) */}
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Mass: {massLabel(filters.massRange[0])} &ndash;{" "}
              {massLabel(filters.massRange[1])}
            </span>
            <Slider
              range
              min={0}
              max={8}
              step={0.1}
              tooltip={{
                formatter: (value) =>
                  value ? massLabel(Math.round(10 ** value - 1)) : massLabel(0),
              }}
              value={[
                Math.log10(filters.massRange[0] + 1),
                Math.log10(filters.massRange[1] + 1),
              ]}
              onChange={(value) => {
                const [a, b] = value as [number, number];
                onUpdate("massRange", [
                  Math.round(10 ** a - 1),
                  Math.round(10 ** b - 1),
                ]);
              }}
            />
          </div>

          {/* Fall/Found */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-gray-600">
                Fall / Found
              </span>
              <Tooltip
                title={
                  <>
                    A meteorite <strong>fall</strong> (observed fall) is one
                    collected after its fall from space that was observed by
                    people or automated devices. Any other meteorite is called a{" "}
                    <strong>find</strong>.
                  </>
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help"
                  aria-hidden
                >
                  <title>Fall vs Found</title>
                  <path
                    fillRule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </Tooltip>
            </div>
            <Segmented<FilterState["fall"]>
              options={["All", "Fell", "Found"]}
              value={filters.fall}
              onChange={(value) => onUpdate("fall", value)}
            />
          </div>

          {/* Classification Groups */}
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Classification
            </span>
            <div className="flex flex-wrap gap-1">
              {CLASS_GROUPS.map((cls) => (
                <WikiTag
                  key={cls}
                  classification={cls}
                  checked={filters.classGroups.includes(cls)}
                  onChange={(checked) => handleClassGroupsChange(cls, checked)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function massLabel(grams: number): string {
  if (grams >= 1_000_000) return `${(grams / 1_000_000).toFixed(0)}t`;
  if (grams >= 1_000) return `${(grams / 1_000).toFixed(0)}kg`;
  return `${grams}g`;
}
