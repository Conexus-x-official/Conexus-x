"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { readUser, readUserServer, subscribeUser } from "./auth";

/**
 * EVERY KEYBOARD SHORTCUT IN THE APP, IN ONE TABLE.
 *
 * Before this, two shortcuts existed and each was hardcoded where it happened
 * to be used: Ctrl/Cmd+K lived inside useSearchHotkey, and Shift+scroll lived
 * in a useEffect halfway down the board page. Nothing listed them, so nothing
 * could show them to a user, let alone let one change them — and the second
 * page to want a shortcut had no way to find out what was already taken.
 *
 * The catalog is the contract, the way lib/automation/catalog.ts is for the
 * builder: adding a shortcut is a ROW here plus a `useShortcut` call at the
 * place it acts. The settings page renders whatever is in this table, so a new
 * row is editable and documented the moment it exists.
 *
 * WHERE THE CHOICE LIVES. On the signed-in ACCOUNT (user.preferences.shortcuts),
 * mirrored into localStorage by lib/auth.ts and read here through the same
 * external store the sidebar uses for its rail mode. So a rebind follows the
 * person to another browser, and every mounted listener re-binds on the same
 * frame the setting is saved — no reload, no provider, no prop drilling.
 */

/** How a combo is stored: lower-case, modifiers first, "+"-joined. */
export type Combo = string;

export type ShortcutId = "search" | "horizontalScroll";

export interface ShortcutSpec {
    id: ShortcutId;
    /** What it does, in the user's words. */
    label: string;
    /** Where it works, so the list is honest about scope. */
    scope: string;
    hint: string;
    /** Ships as this until someone changes it. */
    default: Combo;
    /**
     * A WHEEL shortcut is modifiers-only — it qualifies a scroll rather than
     * being pressed on its own, so the editor must not wait for a letter and
     * the validator must not demand one.
     */
    kind: "key" | "modifier";
}

export const SHORTCUTS: ShortcutSpec[] = [
    {
        id: "search",
        label: "Focus search",
        scope: "Dashboard, workspace",
        hint: "Jumps to the search box and selects whatever is in it.",
        default: "mod+k",
        kind: "key"
    },
    {
        id: "horizontalScroll",
        label: "Scroll a board sideways",
        scope: "Module board",
        hint: "Hold this while scrolling to move the board left and right.",
        default: "shift",
        kind: "modifier"
    }
];

export const shortcutSpec = (id: ShortcutId) =>
    SHORTCUTS.find((s) => s.id === id);

export const DEFAULT_SHORTCUTS: Record<ShortcutId, Combo> = SHORTCUTS.reduce(
    (all, spec) => ({ ...all, [spec.id]: spec.default }),
    {} as Record<ShortcutId, Combo>
);

/**
 * "mod" is Ctrl on Windows/Linux and Cmd on a Mac.
 *
 * Stored as one token rather than resolved at save time, because the account
 * follows the person across machines — a combo saved as "ctrl+k" on a desktop
 * would be the wrong key on their laptop.
 */
const isMac = () =>
    typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

const MODIFIERS = ["mod", "ctrl", "meta", "alt", "shift"] as const;

const PRETTY: Record<string, string> = {
    mod: "Ctrl",
    ctrl: "Ctrl",
    meta: "Win",
    alt: "Alt",
    shift: "Shift",
    " ": "Space",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    escape: "Esc"
};

const PRETTY_MAC: Record<string, string> = {
    mod: "⌘",
    ctrl: "⌃",
    meta: "⌘",
    alt: "⌥",
    shift: "⇧"
};

/** "mod+k" → "Ctrl + K" (or "⌘ + K" on a Mac). */
export function formatCombo(combo: Combo): string {
    if (!combo) return "Not set";

    const mac = isMac();

    return combo
        .split("+")
        .map((part) => {
            const key = part.trim().toLowerCase();
            if (mac && PRETTY_MAC[key]) return PRETTY_MAC[key];
            if (PRETTY[key]) return PRETTY[key];
            return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
        })
        .join(" + ");
}

/**
 * A KeyboardEvent turned into the same shape a stored combo has, so matching is
 * a string comparison rather than a pile of boolean tests per call site.
 */
export function comboFromEvent(event: KeyboardEvent): Combo {
    const parts: string[] = [];

    // Ctrl and Cmd both write "mod" — see isMac above for why.
    if (event.ctrlKey || event.metaKey) parts.push("mod");
    if (event.altKey) parts.push("alt");
    if (event.shiftKey) parts.push("shift");

    const key = event.key.toLowerCase();

    if (!MODIFIERS.includes(key as (typeof MODIFIERS)[number]) &&
        !["control", "meta", "alt", "shift"].includes(key)) {
        parts.push(key);
    }

    return parts.join("+");
}

/** True when a combo carries no actual key — "shift" on its own. */
export const isModifierOnly = (combo: Combo) =>
    combo.split("+").every((part) => MODIFIERS.includes(part.trim().toLowerCase() as (typeof MODIFIERS)[number]));

export function matchesEvent(combo: Combo, event: KeyboardEvent): boolean {
    if (!combo) return false;
    return comboFromEvent(event) === combo;
}

/**
 * Whether a WHEEL event carries the modifiers a combo names. Wheel events have
 * the same modifier flags as key events but no `key`, which is why a
 * modifier-only combo is its own kind in the table above.
 */
export function wheelMatches(combo: Combo, event: WheelEvent): boolean {
    if (!combo) return false;

    const wanted = new Set(combo.split("+").map((p) => p.trim().toLowerCase()));

    const held = {
        mod: event.ctrlKey || event.metaKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey
    };

    return MODIFIERS.every((name) => wanted.has(name) === held[name]) && wanted.size > 0;
}

/**
 * The user's bindings, defaults filled in for anything unset.
 *
 * Read through the SAME external store the sidebar uses for its rail, so a
 * rebind reaches every mounted listener on the frame it is saved. The server
 * snapshot is the defaults, which is what the first render must agree on.
 */
export function useShortcuts(): Record<ShortcutId, Combo> {
    const user = useSyncExternalStore(subscribeUser, readUser, readUserServer);
    const saved = (user?.preferences?.shortcuts ?? {}) as Partial<Record<ShortcutId, Combo>>;

    return SHORTCUTS.reduce(
        (all, spec) => ({ ...all, [spec.id]: saved[spec.id] || spec.default }),
        {} as Record<ShortcutId, Combo>
    );
}

export function useShortcut(id: ShortcutId, handler: (event: KeyboardEvent) => void) {
    const combo = useShortcuts()[id];

    /**
     * The handler is held in a ref so the LISTENER only depends on the combo.
     * Every call site writes its handler inline, so it is a new function on
     * every render — depending on it directly would add and remove a document
     * listener on each one, and the effect would then be the most expensive
     * thing about pressing nothing at all.
     */
    const latest = useRef(handler);
    latest.current = handler;

    useEffect(() => {
        if (!combo) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (!matchesEvent(combo, event)) return;
            latest.current(event);
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [combo]);
}

/**
 * Ctrl/Cmd+K (or whatever it was rebound to) focuses a search box.
 *
 * Kept as its own hook because three pages use it and none of them should have
 * to know what the binding is. The ref may point at nothing — a search box that
 * only renders once there is something to search — in which case the key is a
 * no-op rather than an error.
 */
export function useSearchHotkey(ref: RefObject<HTMLInputElement | null>) {
    const combo = useShortcuts().search;

    useEffect(() => {
        if (!combo) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (!matchesEvent(combo, event)) return;

            // Chrome binds Ctrl+K to the address bar, so this has to win.
            event.preventDefault();
            ref.current?.focus();
            ref.current?.select();
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [combo, ref]);
}
