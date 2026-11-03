// Saved-search list edits for the Smart Searches panel, kept free of React and
// the runtime so they can be tested directly.

import type { LibraryFilter } from "./safelight";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filter: LibraryFilter;
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
