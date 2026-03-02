import type * as Plot from "@observablehq/plot";
import { geoAzimuthalEquidistant } from "d3-geo";

export type ProjectionKey =
  | "equal-earth"
  | "natural-earth"
  | "transverse-mercator"
  | "south-polar"
  | "north-polar";

export const PROJECTION_LABELS: Record<ProjectionKey, string> = {
  "equal-earth": "Equal Earth",
  "natural-earth": "Equirectangular",
  "south-polar": "South Polar (Antarctica)",
  "north-polar": "North Polar (Arctic)",
  "transverse-mercator": "Transverse Mercator",
};

/** Whether a point (lat, long) is visible in the current projection. Full-globe projections show all points; polar projections show one hemisphere. */
export function isPointVisibleInProjection(projection: ProjectionKey, lat: number): boolean {
  if (projection === "south-polar") return lat <= 0;
  if (projection === "north-polar") return lat >= 0;
  return true;
}

export const PROJECTION_MAP: Record<ProjectionKey, Plot.ProjectionName | Plot.ProjectionFactory> = {
  "equal-earth": "equal-earth",
  "natural-earth": "equirectangular",
  "transverse-mercator": "transverse-mercator",
  "south-polar": southPolarProjection,
  "north-polar": northPolarProjection,
};

/** South Polar Azimuthal Equidistant: Antarctica centered and undistorted. */
function southPolarProjection({ width, height }: { width: number; height: number }) {
  const size = Math.min(width, height);
  return geoAzimuthalEquidistant()
    .rotate([0, 90]) // center on South Pole
    .translate([width / 2, height / 2])
    .scale(size / Math.PI)
    .clipAngle(90);
}

/** North Polar Azimuthal Equidistant: Arctic centered and undistorted. */
function northPolarProjection({ width, height }: { width: number; height: number }) {
  const size = Math.min(width, height);
  return geoAzimuthalEquidistant()
    .rotate([0, -90]) // center on North Pole
    .translate([width / 2, height / 2])
    .scale(size / Math.PI)
    .clipAngle(90);
}
