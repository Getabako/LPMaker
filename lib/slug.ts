/** Convert a brand name to a GitHub repo-safe slug. */
export function slugifyBrand(brand: string, fallback: string): string {
  const latin = brand
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "") // drop non-ASCII (incl. Japanese)
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const base = latin && latin.length >= 2
    ? latin
    : fallback.replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 24);
  return `lp-${base}`;
}
