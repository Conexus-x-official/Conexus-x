"use client";

/**
 * MOVED. The search key is now one row in lib/shortcuts.ts, because it is no
 * longer a fact about this hook — the user can rebind it, and the settings page
 * has to be able to list it beside every other binding.
 *
 * This file stays as the re-export so the three pages already importing it did
 * not have to change, and so the next person looking for the hotkey finds the
 * catalog rather than a second copy of the logic.
 */
export { useSearchHotkey } from "./shortcuts";
