# Meteorite Explorer — Application Spec

## Overview

A browser-based interactive visualization app for exploring NASA's Meteorite Landings dataset (~45,000 records). Users can explore where and when meteorites were found on a world map, filter by various metadata dimensions, and switch between map projections optimized for land-mass visualization. All data querying happens client-side via DuckDB-WASM — there is no backend.

---

## Goals

- Let users visually explore global meteorite landing data with responsive, interactive maps
- Minimize ocean dead space on the map (most meteorites are recovered on land)
- Support rich filtering and faceting across meteorite metadata
- Keep the architecture simple: static site, no server, all computation in the browser
- Ship a polished, performant UI that handles 45k points without jank

---

## Tech Stack

| Layer | Technology |
|---|---|
| Build tool | Vite |
| UI framework | React 18+ with TypeScript |
| Styling | Tailwind CSS 4 |
| Data engine | DuckDB-WASM (running in a Web Worker) |
| Visualization | Observable Plot (via `@observablehq/plot`) |
| Map projections | d3-geo + d3-geo-projection (used by Observable Plot under the hood) |
| Base map geometry | Natural Earth 110m shapefiles (land + country boundaries), converted to TopoJSON for efficient loading (defer this) |
| Data format | Parquet (converted from NASA's JSON source, bundled as a static asset) |

---

## Data

### Primary Dataset

**NASA Meteorite Landings** — available from NASA's Open Data Portal.

[meteorite-landings.json](./meteorite-landings.json)

Key fields per record:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Meteorite name (unique identifier) |
| `id` | integer | NASA ID |
| `nametype` | string | "Valid" or "Relict" |
| `recclass` | string | Classification (e.g., "L5", "H6", "Iron, IAB-sLL") |
| `mass` | float | Mass in grams (nullable — many records missing mass) |
| `fall` | string | "Fell" (observed falling) or "Found" (discovered later) |
| `year` | datetime | Year of fall/find (extract year integer; some dates are malformed) |
| `reclat` | float | Latitude (nullable) |
| `reclong` | float | Longitude (nullable) |
| `geolocation` | object | `{type: "Point", coordinates: [long, lat]}` (redundant with reclat/reclong) |

**Data prep (build-time script):**

1. Clean: drop records with null lat/long, extract year as integer, parse mass as float
2. Derive a simplified `class_group` column from `recclass` (e.g., group "L4", "L5", "L6" → "L-chondrite"; "Iron, IAB-sLL" → "Iron")
3. Convert to Parquet using DuckDB CLI or a Python script
4. Place the `.parquet` file in `public/data/meteorites.parquet`

### Base Map Data

**Natural Earth 110m** — low-resolution world boundaries suitable for a thematic map.

Files needed:
- `ne_110m_land.shp` → convert to TopoJSON (`land.json`)
- `ne_110m_admin_0_countries.shp` → convert to TopoJSON (`countries.json`)

Use `topojson-server` CLI (`geo2topo`) and `topojson-simplify` (`toposimplify`) to produce compact TopoJSON files. Bundle in `public/data/`.

Alternatively, use the prepacked world-atlas npm package (`world-atlas/countries-110m.json`) which provides Natural Earth 110m as TopoJSON out of the box.

---

## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────┐
│  Browser (Main Thread)                          │
│                                                 │
│  React App                                      │
│  ├── FilterPanel (controls)                     │
│  ├── MapView (Observable Plot)                  │
│  ├── ProjectionPicker                           │
│  ├── DetailPanel (selected meteorite info)      │
│  └── SummaryStats                               │
│         │                                       │
│         │ postMessage (SQL query)                │
│         ▼                                       │
│  ┌─────────────────────┐                        │
│  │  Web Worker          │                       │
│  │  DuckDB-WASM         │                       │
│  │  ├── meteorites.parq │                       │
│  │  └── SQL engine      │                       │
│  └─────────────────────┘                        │
│         │                                       │
│         │ postMessage (Arrow result)             │
│         ▼                                       │
│  React state update → re-render Plot            │
└─────────────────────────────────────────────────┘
```

### DuckDB-WASM Worker

Create a dedicated Web Worker (`src/workers/duckdb-worker.ts`) that:

1. On initialization: loads DuckDB-WASM, creates an in-memory database, registers the Parquet file from a fetch of `/data/meteorites.parquet` using `registerFileURL` or `registerFileBuffer`
2. Exposes a message-based API: receives SQL strings, executes them, and returns results as serialized Arrow IPC buffers (or plain JSON arrays for simplicity)
3. All queries are parameterized to prevent injection if any user input flows into SQL

Create a React hook `useDuckDB` that:
- Initializes the worker on mount
- Provides a `query(sql: string, params?: any[]) => Promise<Row[]>` function
- Manages loading/error states
- Memoizes the worker instance across renders

### Query Patterns

All filtering is expressed as SQL. The UI builds a query dynamically based on active filters:

```sql
SELECT name, id, recclass, class_group, mass, fall, year, reclat, reclong
FROM meteorites
WHERE 1=1
  AND year BETWEEN ? AND ?          -- year range slider
  AND mass BETWEEN ? AND ?          -- mass range slider  
  AND fall = ?                      -- Fell/Found toggle
  AND class_group IN (?, ?, ?)      -- multi-select class filter
ORDER BY year
```

For aggregate views (histograms, class distribution):

```sql
SELECT class_group, COUNT(*) as count, AVG(mass) as avg_mass
FROM meteorites
WHERE ...
GROUP BY class_group
ORDER BY count DESC
```

---

## UI Layout

### Main Layout

```
┌──────────────────────────────────────────────────────┐
│  Header: "Meteorite Explorer"     [Projection ▾]     │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Filters   │           Map View                      │
│  Panel     │     (Observable Plot)                   │
│            │                                         │
│  - Year    │                                         │
│  - Mass    │                                         │
│  - Class   │                                         │
│  - Fall/   │                                         │
│    Found   │                                         │
│            │                                         │
│            ├─────────────────────────────────────────┤
│            │      Summary Stats / Timeline           │
│  Detail    │      (small chart below map)             │
│  Card      │                                         │
└────────────┴─────────────────────────────────────────┘
```

### Components

#### `App` (root)
- Manages global filter state
- Initializes DuckDB worker
- Coordinates data flow between filters, map, and detail views

#### `FilterPanel`
- **Year range**: dual-handle range slider, min 860 to max 2025 (data spans ~860 AD to present)
- **Mass range**: logarithmic dual-handle slider (masses range from <1g to 60,000,000g)
- **Classification**: multi-select dropdown/checklist of `class_group` values, with counts
- **Fall/Found**: toggle or radio buttons — "All", "Fell", "Found"
- **Text search**: search-as-you-type on meteorite name
- Shows active filter count and "Clear all" button

#### `ProjectionPicker`
- Dropdown or segmented control in the header
- Options (in this order):
  1. **Equal Earth** (default) — equal-area, rectangular, great d3 support
  2. **Natural Earth** — aesthetically pleasing pseudocylindrical
  3. **Interrupted Goode Homolosine** — "orange peel" cuts through oceans
  4. **Airocean (Dymaxion)** — icosahedral unfolding, minimal ocean waste
- Changing projection re-renders the Plot with the new projection function
- Store selection in URL query param for shareability

#### `MapView`
- Renders using Observable Plot's `Plot.plot()` with the `geo` mark
- Layers (bottom to top):
  1. **Graticule**: light grid lines for orientation
  2. **Land**: filled polygons from TopoJSON (light gray or muted color)
  3. **Country borders**: thin stroke on country boundaries
  4. **Meteorite dots**: circles positioned at `[reclong, reclat]`, sized by mass (log scale), colored by `class_group` or `fall` status
- Dot sizing: use a `sqrt` or `log` scale for radius so the 60-ton Hoba meteorite doesn't dominate. Minimum dot size of 2px so small meteorites remain visible.
- Dot coloring: default to a categorical color scale by `class_group` (top 8 groups get distinct colors, rest are "Other" in gray). Allow toggle to color by `fall` (Fell = warm color, Found = cool color).
- Interaction:
  - Hover: tooltip showing name, year, mass, classification
  - Click: select meteorite, populate DetailPanel
- The Plot should be regenerated (not mutated) when filters or projection change. Observable Plot is declarative — build a new spec and call `Plot.plot()`.

#### `DetailPanel`
- Shows full metadata for the selected meteorite
- Appears in the sidebar below filters (or as a slide-out panel on mobile)
- Fields: name, year, classification (full `recclass`), class group, mass (formatted with units — g/kg/tonnes), fall/found status, coordinates
- Link to external resources: Google Maps pin, Meteoritical Bulletin entry

#### `SummaryStats`
- Small bar below the map or in the sidebar
- Shows: total meteorites matching current filters, mass distribution sparkline, year histogram
- Updates reactively as filters change

#### `TimelineChart`
- Small Observable Plot chart below the map
- Histogram of meteorite finds/falls by decade
- Brush interaction: selecting a range on the timeline updates the year filter (bidirectional sync with FilterPanel)

---

## Map Projection Details

Observable Plot uses d3 projections natively via the `projection` option in `Plot.plot()`:

```js
import * as Plot from "@observablehq/plot";
import { geoEqualEarth, geoNaturalEarth1 } from "d3-geo";
import { geoInterruptedHomolosine, geoAirocean } from "d3-geo-projection";

const projections = {
  "equal-earth": geoEqualEarth,
  "natural-earth": geoNaturalEarth1,
  "goode": geoInterruptedHomolosine,
  "airocean": geoAirocean,
};

// Observable Plot accepts projection as a config option:
Plot.plot({
  projection: {
    type: projections[selectedProjection],
    domain: landGeoJSON,  // fit projection to land bounds
  },
  marks: [
    Plot.graticule(),
    Plot.geo(land, { fill: "#e0e0e0" }),
    Plot.geo(countries, { stroke: "#999", strokeWidth: 0.5 }),
    Plot.dot(meteorites, {
      x: "reclong",
      y: "reclat",
      r: d => Math.max(2, Math.sqrt(d.mass) * 0.01),
      fill: "class_group",
      fillOpacity: 0.6,
      tip: true,  // built-in tooltips
    }),
  ],
})
```

**Note on Airocean/Dymaxion**: Observable Plot may not directly accept `geoAirocean` as a projection type string. You may need to pass it as a pre-configured d3 projection instance. Test this — if Plot doesn't handle the icosahedral clipping correctly, consider rendering the Airocean view as a separate d3 SVG (not Plot) or dropping it in favor of the three well-supported projections.

---

## Observable Plot Integration with React

Observable Plot produces a DOM element (SVG or HTML). In React, use a ref-based pattern:

```tsx
import * as Plot from "@observablehq/plot";
import { useRef, useEffect } from "react";

function MapView({ data, projection, colorBy }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const plot = Plot.plot({
      width: containerRef.current.clientWidth,
      projection: { type: projection },
      marks: [/* ... */],
    });

    containerRef.current.replaceChildren(plot);
    return () => plot.remove();
  }, [data, projection, colorBy]);

  return <div ref={containerRef} />;
}
```

This is the standard pattern — Plot is not a React component library, so you manage the DOM element lifecycle via `useEffect` and a container ref.

---

## Performance Considerations

- **45k dots is manageable** for SVG but will be slow with complex interactions. If performance is an issue, consider:
  - Canvas rendering: Observable Plot supports `Plot.dot(..., { render: "canvas" })` — check current API
  - Aggregation: at zoomed-out views, use hexbin aggregation (`Plot.hexbin`) to show density instead of individual dots
  - Filtering: DuckDB queries should return only the columns needed for rendering (not all 20 fields)
- **DuckDB initialization**: the WASM binary is ~4MB. Load it asynchronously and show a loading state. The Parquet file will be ~2-5MB.
- **Projection switching**: each switch triggers a full re-render of the Plot. This should be fast (<100ms for 45k points in SVG) but test with the Airocean projection which involves more complex math.

---

## File Structure

```
meteorite-explorer/
├── public/
│   └── data/
│       ├── meteorites.parquet        # Pre-processed meteorite data
│       └── countries-110m.json       # Natural Earth TopoJSON (or from world-atlas npm)
├── src/
│   ├── main.tsx                      # Entry point
│   ├── App.tsx                       # Root component, state management
│   ├── components/
│   │   ├── MapView.tsx               # Observable Plot map rendering
│   │   ├── FilterPanel.tsx           # All filter controls
│   │   ├── ProjectionPicker.tsx      # Projection selector
│   │   ├── DetailPanel.tsx           # Selected meteorite info
│   │   ├── SummaryStats.tsx          # Aggregate stats display
│   │   └── TimelineChart.tsx         # Year histogram with brush
│   ├── workers/
│   │   └── duckdb-worker.ts          # DuckDB-WASM Web Worker
│   ├── hooks/
│   │   ├── useDuckDB.ts              # Hook for DuckDB query interface
│   │   └── useFilters.ts             # Filter state management hook
│   ├── lib/
│   │   ├── projections.ts            # Projection config and d3 imports
│   │   ├── scales.ts                 # Shared color/size scale definitions
│   │   └── format.ts                 # Number/date formatting helpers
│   ├── types/
│   │   └── meteorite.ts              # TypeScript types for meteorite data
│   └── styles/
│       └── index.css                 # Tailwind imports + any custom CSS
├── scripts/
│   └── prepare-data.ts               # Build-time script: fetch JSON → clean → Parquet
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Data Preparation Script (`scripts/prepare-data.ts`)

This runs at build time (or manually) to produce the Parquet file:

1. Fetch from `https://data.nasa.gov/resource/gh4g-9sfh.json?$limit=50000`
2. Parse and clean:
   - Drop records where `reclat` or `reclong` is null or 0,0 (there are many 0,0 entries that are data errors)
   - Parse `year` from the datetime string (e.g., "1880-01-01T00:00:00.000" → 1880)
   - Parse `mass` as float
   - Derive `class_group` from `recclass` using a mapping table (see appendix)
3. Write to Parquet using DuckDB CLI:
   ```bash
   duckdb -c "COPY (SELECT * FROM read_json('cleaned.json')) TO 'meteorites.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)"
   ```
   Or use `@duckdb/node` in a Node script.

---

## Classification Grouping

The `recclass` field has hundreds of unique values. Group into ~10-15 meaningful categories:

| class_group | recclass patterns |
|---|---|
| H-chondrite | H, H3, H4, H5, H6, H3-6, etc. |
| L-chondrite | L, L3, L4, L5, L6, L3-6, etc. |
| LL-chondrite | LL, LL3, LL4, LL5, LL6, etc. |
| Carbonaceous | CI, CM, CO, CV, CK, CR, CH, CB |
| Enstatite | EH, EL, EH3, EL6, etc. |
| Achondrite | Eucrite, Diogenite, Howardite, Ureilite, Aubrite, etc. |
| Iron | Iron, IAB, IIIAB, IVA, etc. |
| Stony-iron | Pallasite, Mesosiderite |
| Martian | Shergottite, Nakhlite, Chassignite, SNC |
| Lunar | Lunar |
| Other/Unclassified | Everything else |

Use a regex-based classifier or a lookup table. The exact grouping can be refined iteratively.

---

## Stretch Goals (Not MVP)

- **Hexbin density mode**: toggle between individual dots and hexagonal binning for density visualization
- **Antarctic detail view**: zoom into Antarctica (huge cluster of finds) with a polar projection
- **Mass comparison**: "this meteorite weighs as much as X" with fun comparisons
- **Animated timeline**: play button that animates meteorite appearances over time
- **Data enrichment**: join Meteoritical Bulletin data for richer classification tooltips
- **URL state**: encode all filters + projection in URL search params for shareable views
- **Dark mode**: especially good for space-themed visualization
- **Mobile responsive**: collapsible filter panel, touch-friendly interactions

---

## Open Questions

1. **Observable Plot + Airocean**: does Plot handle the icosahedral projection correctly, or does it need special clipping? Can defer icosahedral projection
2. **Tooltip performance**: Plot's built-in `tip: true` uses SVG title elements. For richer tooltips (styled, multi-field), may need a custom Voronoi-based overlay or a React portal.
3. **DuckDB-WASM bundle size**: the full WASM binary is ~4MB. Evaluate whether `@duckdb/duckdb-wasm`'s tree-shaking is sufficient or if a CDN-hosted binary is better.
4. **World-atlas vs custom TopoJSON**: the `world-atlas` npm package is convenient but may not include all the features needed (e.g., disputed borders, Antarctic detail). Evaluate early.
5. **Parquet loading strategy**: `registerFileURL` (streaming) vs `registerFileBuffer` (preloaded). For a 2-5MB file, preloading into an ArrayBuffer is probably fine and avoids streaming complexity.