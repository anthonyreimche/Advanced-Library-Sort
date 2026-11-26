// Tests for opening and closing the search bar, and the shortcut in its tooltips.
// Run with: node --experimental-strip-types src/search-toggle.test.ts

import assert from "node:assert/strict";
import { toggled } from "./search-store.ts";
import { withShortcut } from "./shortcut.ts";

// Opening shows the bar and keeps whatever is in the box.
assert.deepEqual(toggled({ visible: false, query: "" }), { visible: true, query: "" });

// Closing hides the bar and empties the box, so the grid shows every photo again.
assert.deepEqual(toggled({ visible: true, query: "heron" }), { visible: false, query: "" });

// The live combo follows the label; an unbound action shows the label alone.
assert.equal(withShortcut("Search the library", "Ctrl+F"), "Search the library (Ctrl+F)");
assert.equal(withShortcut("Search the library", "Ctrl+Shift+K"), "Search the library (Ctrl+Shift+K)");
assert.equal(withShortcut("Search the library", ""), "Search the library");

console.log("search-toggle tests passed");
