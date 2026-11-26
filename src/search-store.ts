// The extension's own state: the live search query. Created through the app's
// zustand factory (api.stores.create) so the SearchBar and any panel re-render
// reactively, and the central grid-filter subscription (index.ts) can read it.

import type { SafelightAPI, StoreApi } from "./safelight";

export interface SearchState {
  query: string;
  setQuery(q: string): void;
  /** Whether the search bar is shown. */
  visible: boolean;
  setVisible(v: boolean): void;
  /** Opens the bar, or closes it and clears the query: the shortcut and both toggles. */
  toggle(): void;
}

/** The bar after a toggle: opening keeps the box, closing empties it. */
export function toggled(s: { visible: boolean; query: string }): { visible: boolean; query: string } {
  return s.visible ? { visible: false, query: "" } : { visible: true, query: s.query };
}

let store: StoreApi<SearchState> | null = null;

export function initSearchStore(api: SafelightAPI): StoreApi<SearchState> {
  store = api.stores.create<SearchState>((set) => ({
    // Hidden until invoked (Lightroom-style), so it never steals focus on
    // startup or occupies space when unused.
    query: "",
    setQuery: (q) => set({ query: q }),
    visible: false,
    setVisible: (v) => set({ visible: v }),
    toggle: () => set(toggled),
  }));
  return store;
}

export function searchStore(): StoreApi<SearchState> {
  if (!store) throw new Error("[library-search] search store used before activate()");
  return store;
}
