export interface Meteorite {
  name: string;
  id: number;
  nametype: string;
  recclass: string;
  class_group: string;
  mass: number | null;
  fall: string;
  year: number | null;
  reclat: number | null;
  reclong: number | null;
}

export interface FilterState {
  yearRange: [number, number];
  massRange: [number, number];
  classGroups: MeteoriteClass[];
  fall: "All" | "Fell" | "Found";
  search: string;
}

export const DEFAULT_FILTERS: FilterState = {
  yearRange: [860, 2025],
  massRange: [0, 60_000_000],
  classGroups: [],
  fall: "All",
  search: "",
};

export type MeteoriteClass =
| "H-chondrite"
| "L-chondrite"
| "LL-chondrite"
| "Carbonaceous"
| "Iron"
| "Achondrite"
| "Enstatite"
| "Stony-iron"
| "Martian"
| "Lunar"
| "Other";