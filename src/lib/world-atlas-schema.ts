import { z } from "zod";

// TopoJSON schema for world-atlas countries-110m.json
// See: https://github.com/topojson/topojson-specification

const transformSchema = z.object({
  scale: z.tuple([z.number(), z.number()]),
  translate: z.tuple([z.number(), z.number()]),
});

const polygonSchema = z.object({
  type: z.literal("Polygon"),
  arcs: z.array(z.array(z.number())),
  id: z.union([z.string(), z.number()]).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  arcs: z.array(z.array(z.array(z.number()))),
  id: z.union([z.string(), z.number()]).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

interface GeometryCollectionShape {
  type: "GeometryCollection";
  geometries: GeometryObjectShape[];
}
type GeometryObjectShape =
  | z.infer<typeof polygonSchema>
  | z.infer<typeof multiPolygonSchema>
  | GeometryCollectionShape;

const geometryCollectionSchema: z.ZodType<GeometryCollectionShape> = z.object({
  type: z.literal("GeometryCollection"),
  geometries: z.array(z.lazy(() => geometryObjectSchema)),
});

const geometryObjectSchema: z.ZodType<GeometryObjectShape> = z.lazy(() =>
  z.union([polygonSchema, multiPolygonSchema, geometryCollectionSchema]),
);

/** Parsed world-atlas TopoJSON (Topology with countries + land) */
export const worldAtlasTopologySchema = z.object({
  type: z.literal("Topology"),
  objects: z.object({
    countries: geometryCollectionSchema,
    land: geometryCollectionSchema,
  }),
  arcs: z.array(z.array(z.array(z.number()))),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  transform: transformSchema.optional(),
});

export type WorldAtlasTopology = z.infer<typeof worldAtlasTopologySchema>;

/** Parse and validate world-atlas JSON. Use for type-safe TopoJSON. */
export function parseWorldAtlas(data: unknown): WorldAtlasTopology {
  return worldAtlasTopologySchema.parse(data);
}
