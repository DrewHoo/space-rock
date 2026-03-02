import * as Plot from "@observablehq/plot";
import { useEffect, useRef } from "react";
import * as topojson from "topojson-client";
import worldDataJson from "world-atlas/countries-110m.json";
import { PROJECTION_MAP, type ProjectionKey } from "../lib/projections";
import { parseWorldAtlas } from "../lib/world-atlas-schema";
import type { Meteorite, MeteoriteClass } from "../types/meteorite";

const worldData = parseWorldAtlas(worldDataJson);

const land = topojson.feature(worldData, worldData.objects.land);
const countries = topojson.feature(worldData, worldData.objects.countries);

const CLASS_COLORS: Record<MeteoriteClass, string> = {
  "H-chondrite": "#e41a1c",
  "L-chondrite": "#377eb8",
  "LL-chondrite": "#4daf4a",
  Carbonaceous: "#984ea3",
  Iron: "#ff7f00",
  Achondrite: "#a65628",
  Enstatite: "#f781bf",
  "Stony-iron": "#999999",
  Martian: "#e7298a",
  Lunar: "#66a61e",
  Other: "#b3b3b3",
};

interface MapViewProps {
  data: Meteorite[];
  projection: ProjectionKey;
  onSelect: (meteorite: Meteorite | null) => void;
}

export function MapView({ data, projection, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = Math.min(containerRef.current.clientWidth * 0.55, 600);
    const projectionOption =
      PROJECTION_MAP[projection] ??
      ("equal-earth" satisfies Plot.ProjectionName);

    const plot = Plot.plot({
      width,
      height,
      projection: projectionOption,
      color: {
        domain: Object.keys(CLASS_COLORS),
        range: Object.values(CLASS_COLORS),
        legend: true,
      },
      marks: [
        Plot.graticule({ stroke: "#e5e7eb", strokeOpacity: 0.5 }),
        Plot.geo(land, { fill: "#f3f4f6", stroke: "#d1d5db" }),
        Plot.geo(countries, {
          stroke: "#9ca3af",
          strokeWidth: 0.5,
          fill: "none",
        }),
        Plot.dot(
          data.filter((d) => d.reclat != null && d.reclong != null),
          {
            x: "reclong",
            y: "reclat",
            r: (d: Meteorite) =>
              d.mass
                ? Math.max(1.5, Math.sqrt(Math.log10(d.mass + 1)) * 1.5)
                : 1.5,
            fill: "class_group",
            fillOpacity: 0.65,
            stroke: "#00000022",
            strokeWidth: 0.3,
            tip: true,
            title: (d: Meteorite) =>
              `${d.name}\nYear: ${d.year ?? "Unknown"}\nMass: ${d.mass != null ? `${d.mass.toLocaleString()}g` : "Unknown"}\nClass: ${d.recclass} (${d.class_group})`,
            channels: {
              name: "name",
              year: "year",
              mass: "mass",
              class: "recclass",
            },
          },
        ),
      ],
    });

    // Add click handler for meteorite selection
    plot.addEventListener("click", (event: Event) => {
      const target = event.target as SVGElement;
      if (target.tagName === "circle") {
        const title = target.querySelector("title")?.textContent;
        if (title) {
          const name = title.split("\n")[0];
          const match = data.find((d) => d.name === name);
          if (match) onSelect(match);
        }
      }
    });

    containerRef.current.replaceChildren(plot);
    return () => plot.remove();
  }, [data, projection, onSelect]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden pl-4 pr-4 bg-white"
    />
  );
}
