import { debounce } from "es-toolkit";
import { useEffect, useRef, useState } from "react";
import type { FilterState, Meteorite } from "../types/meteorite";
import { useDuckDB } from "./useDuckDB";
import { useFilters } from "./useFilters";

export function useDuckDbFilteredData() {
  const { query, ready, error } = useDuckDB();
  const { filters, updateFilter, resetFilters, buildWhereClause } =
    useFilters();

  const [data, setData] = useState<Meteorite[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch total count once on init
  useEffect(() => {
    if (!ready) return;
    query("SELECT COUNT(*)::INT as count FROM meteorites").then((rows) => {
      setTotalCount(Number(rows[0].count));
    });
  }, [ready, query]);

  // Stable refs so the debounced function always sees current values
  const queryRef = useRef(query);
  const readyRef = useRef(ready);
  const buildWhereClauseRef = useRef(buildWhereClause);
  queryRef.current = query;
  readyRef.current = ready;
  buildWhereClauseRef.current = buildWhereClause;

  const runFilteredQueryRef = useRef<ReturnType<
    typeof debounce<() => void>
  > | null>(null);
  if (!runFilteredQueryRef.current) {
    runFilteredQueryRef.current = debounce(
      () => {
        const q = queryRef.current;
        if (!readyRef.current || !q) return;
        const where = buildWhereClauseRef.current();
        setLoading(true);
        q(
          `SELECT name, id, nametype, recclass, class_group, mass, fall, year, reclat, reclong
         FROM meteorites
         WHERE ${where}
         ORDER BY year`,
        )
          .then((rows) => {
            setData(rows as unknown as Meteorite[]);
            setLoading(false);
          })
          .catch((err) => {
            console.error("Query error:", err);
            setLoading(false);
          });
      },
      300,
      { edges: ["leading", "trailing"] },
    );
  }
  const runFilteredQuery = runFilteredQueryRef.current;

  // Re-run debounced query whenever filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: filters intentionally in deps to trigger debounced query on filter change
  useEffect(() => {
    if (!ready) return;
    runFilteredQuery();
    return () => runFilteredQuery.cancel();
  }, [ready, filters, runFilteredQuery]);

  return {
    data,
    totalCount,
    loading,
    filters,
    updateFilter,
    resetFilters,
    ready,
    error,
    query,
  } as const;
}

export type { FilterState };
