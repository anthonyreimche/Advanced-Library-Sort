// Saved-search list edits for the Smart Searches panel, kept free of React and
// the runtime so they can be tested directly.

import type { EditedFilter, LibraryFilter } from "./safelight";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  /** Searches saved before Safelight 3.2.6 have no `edited`. */
  filter: Omit<LibraryFilter, "edited"> & { edited?: EditedFilter };
}

const RATING_OP_SYMBOL: Record<string, string> = {
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  eq: "=",
  neq: "≠",
};

/** Short human summary of a filter, e.g. "≥3★ · red · edited"; "" while it
 *  narrows nothing. */
export function filterSummary(f: SavedSearch["filter"]): string {
  const parts: string[] = [];
  if (f.rating > 0 || f.ratingOp !== "gte") parts.push(`${RATING_OP_SYMBOL[f.ratingOp] ?? "≥"}${f.rating}★`);
  if (f.flag !== "any") parts.push(f.flag);
  if (f.label !== "any") parts.push(f.label);
  if (f.keywords.length) parts.push(f.keywords.join(", "));
  if (f.edited && f.edited !== "any") parts.push(f.edited);
  return parts.join(" · ");
}

/** The whole Library filter a saved search puts back: one saved before the
 *  Edits filter existed sets Edits to All. */
export function restoredFilter(s: SavedSearch): LibraryFilter {
  return { ...s.filter, edited: s.filter.edited ?? "any" };
}

/** An id no entry in `list` uses. The fallback is for a runtime without
 *  crypto.randomUUID (an insecure context). */
export function newSearchId(list: readonly SavedSearch[]): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const used = new Set(list.map((s) => s.id));
  let n = list.length;
  while (used.has(`s_${n}`)) n += 1;
  return `s_${n}`;
}

export function withSavedSearch(list: readonly SavedSearch[], fields: Omit<SavedSearch, "id">): SavedSearch[] {
  return [...list, { id: newSearchId(list), ...fields }];
}

export function withoutSavedSearch(list: readonly SavedSearch[], id: string): SavedSearch[] {
  return list.filter((s) => s.id !== id);
}
