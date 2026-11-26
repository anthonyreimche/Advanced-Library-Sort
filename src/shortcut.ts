// Ids shared by the keybinding and the controls that name it, and the label
// helper that shows the live combo, so a rebound key reads correctly.

export const ID = "com.safelight.advanced-library-sort";
export const TOGGLE_SEARCH_ACTION = `${ID}.focus`;

/** "Label (Combo)", or the label alone when the action is unbound. */
export function withShortcut(label: string, combo: string): string {
  return combo ? `${label} (${combo})` : label;
}
