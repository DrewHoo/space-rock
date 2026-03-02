import { useCallback, useState } from "react";
import type { FilterState } from "../types/meteorite";
import { DEFAULT_FILTERS } from "../types/meteorite";

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const buildWhereClause = useCallback((): string => {
    const clauses: string[] = ["1=1"];

    if (
      filters.yearRange[0] !== DEFAULT_FILTERS.yearRange[0] ||
      filters.yearRange[1] !== DEFAULT_FILTERS.yearRange[1]
    ) {
      clauses.push(`year BETWEEN ${filters.yearRange[0]} AND ${filters.yearRange[1]}`);
    }

    if (
      filters.massRange[0] !== DEFAULT_FILTERS.massRange[0] ||
      filters.massRange[1] !== DEFAULT_FILTERS.massRange[1]
    ) {
      clauses.push(`mass BETWEEN ${filters.massRange[0]} AND ${filters.massRange[1]}`);
    }

    if (filters.classGroups.length > 0) {
      const groups = filters.classGroups.map((g) => `'${g}'`).join(", ");
      clauses.push(`class_group IN (${groups})`);
    }

    if (filters.fall !== "All") {
      clauses.push(`fall = '${filters.fall}'`);
    }

    if (filters.search.trim()) {
      const escaped = filters.search.replace(/'/g, "''");
      clauses.push(`name ILIKE '%${escaped}%'`);
    }

    return clauses.join(" AND ");
  }, [filters]);

  return { filters, updateFilter, resetFilters, buildWhereClause };
}
