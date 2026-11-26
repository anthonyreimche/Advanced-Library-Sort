// The Library toolbar's Search button: opens or closes the search bar, lit
// while it is open. Styled as the toolbar's own action buttons, and named with
// the live shortcut so a rebound key reads correctly.

import { h, api } from "./runtime";
import { searchStore } from "./search-store";
import { TOGGLE_SEARCH_ACTION, withShortcut } from "./shortcut";

export function SearchToggle() {
  const ui = api().ui;
  if (!ui) return null;
  const store = searchStore();
  const visible: boolean = store((s) => s.visible);
  const toggle: () => void = store((s) => s.toggle);
  const combo = api().keybindings.getBinding(TOGGLE_SEARCH_ACTION);
  return h(
    "button",
    {
      type: "button",
      onClick: toggle,
      title: withShortcut(visible ? "Close the library search" : "Search the library", combo),
      "aria-label": "Toggle library search",
      "aria-pressed": visible,
      className: "sl-library-toolbar-action",
      style: visible ? { background: ui.tokens.surface4, color: ui.tokens.textPrimary } : undefined,
    },
    "Search",
  );
}
