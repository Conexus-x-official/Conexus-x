"use client";

/**
 * Whether the AI rail is open.
 *
 * Read through useSyncExternalStore rather than corrected from localStorage in
 * an effect, for the same two reasons the main Sidebar was moved off that
 * pattern:
 *
 * 1. Every page renders its own <AiSidebar />, so a route change unmounts one
 *    and mounts another. An effect-corrected panel starts closed and springs
 *    open a frame later — on every single navigation.
 * 2. setState-in-effect fails this project's lint rule outright.
 *
 * On a soft navigation there is no hydration to wait for: the new instance's
 * first render calls readAgentPanelOpen() and already has the answer.
 *
 * localStorage, not the account (unlike the sidebar's rail mode): whether a
 * chat panel is open is a fact about this screen right now, not a setting the
 * person would expect to follow them to another machine.
 */

const KEY = "crm_ai_panel_open";
const EVENT = "crm:agent-panel";

/**
 * Cached so the snapshot is stable between renders — useSyncExternalStore
 * compares by identity and re-reading storage on every call would be both
 * wasteful and, for anything but a primitive, an infinite loop.
 *
 * `undefined` means "not read yet", which is distinct from a stored false.
 */
let current: boolean | undefined;

const read = (): boolean => {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        /* private mode — treat as closed */
        return false;
    }
};

export const readAgentPanelOpen = (): boolean => {
    if (current === undefined) current = read();
    return current;
};

/** Closed on the server, so the hydrating render agrees with the markup. */
export const readAgentPanelOpenServer = (): boolean => false;

export const setAgentPanelOpen = (next: boolean) => {
    if (next === current) return;

    current = next;

    try {
        localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
        /* not persisting is survivable */
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(EVENT));
    }
};

export const subscribeAgentPanelOpen = (onChange: () => void) => {
    if (typeof window === "undefined") return () => { };

    // `storage` covers the same account open in another tab, where the write
    // happened in a different document and raised no event of ours.
    const onStorage = (event: StorageEvent) => {
        if (event.key && event.key !== KEY) return;
        current = read();
        onChange();
    };

    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);

    return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onStorage);
    };
};
