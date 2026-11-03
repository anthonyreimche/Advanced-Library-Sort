// Tests for the saved-search list edits.
// Run with: node --experimental-strip-types src/saved-searches.test.ts

import assert from "node:assert/strict";
import { newSearchId, withSavedSearch, withoutSavedSearch, type SavedSearch } from "./saved-searches.ts";
import type { LibraryFilter } from "./safelight";

const filter: LibraryFilter = { rating: 0, ratingOp: "gte", flag: "any", label: "any", keywords: [] };
const fields = (name: string) => ({ name, query: name.toLowerCase(), filter });

// Save A, B; delete A; save B again; delete one B: the other B remains.
{
  let list: SavedSearch[] = [];
  list = withSavedSearch(list, fields("A"));
  list = withSavedSearch(list, fields("B"));
  list = withoutSavedSearch(list, list[0].id);
  list = withSavedSearch(list, fields("B"));
  assert.equal(new Set(list.map((s) => s.id)).size, 2, "every saved search has its own id");
  list = withoutSavedSearch(list, list[0].id);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "B");
}

// Without randomUUID the fallback still avoids every id in the list.
{
  const randomUUID = crypto.randomUUID;
  Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    const list = [
      { id: "s_0", ...fields("A") },
      { id: "s_2", ...fields("B") },
    ];
    const id = newSearchId(list);
    assert.ok(!list.some((s) => s.id === id), `fallback id ${id} is unused`);
  } finally {
    Object.defineProperty(crypto, "randomUUID", { value: randomUUID, configurable: true });
  }
}

console.log("saved-searches.test.ts: all passed");
