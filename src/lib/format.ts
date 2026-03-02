export function formatMass(grams: number | null): string {
  if (grams == null) return "Unknown";
  if (grams >= 1_000_000) return `${(grams / 1_000_000).toFixed(1)} t`;
  if (grams >= 1_000) return `${(grams / 1_000).toFixed(1)} kg`;
  return `${grams.toFixed(1)} g`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}
