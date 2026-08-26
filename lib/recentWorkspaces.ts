"use client";

/**
 * Which workspaces this person actually opened, and when.
 *
 * "Recently visited" is NOT `updatedAt`. That field moves when anyone on the
 * team edits anything inside the workspace, so sorting by it answers "what has
 * the team touched", which is a different question and would put a workspace
 * you have never opened at the top of a list labelled with your own history.
 * Nothing server-side records a visit, so the browser records it here.
 *
 * Per-browser and per-device on purpose: it is a convenience, not data. A
 * private window or cleared storage simply means the tab starts empty, which
 * the UI has to render anyway for a new account.
 */

const KEY = "crm_recent_workspaces";

/** Enough to fill the tab twice over; beyond this it is not "recent". */
const LIMIT = 12;

/** Raised on write so an open Home tab re-reads without a navigation. */
export const VISITED_EVENT = "crm:workspace-visited";

export interface Visit {
    id: string;
    /** Epoch ms. */
    at: number;
}

/** Same array identity every time, so useSyncExternalStore cannot loop on it. */
const EMPTY: Visit[] = [];

/**
 * useSyncExternalStore compares snapshots by identity, so parsing on every call
 * would hand it a new array each render and spin forever. The raw string is the
 * cheap thing to compare; the parse only re-runs when it actually changed.
 */
let cachedRaw: string | null = null;
let cachedVisits: Visit[] = EMPTY;

const parse = (raw: string): Visit[] => {
    try {
        const value = JSON.parse(raw);
        if (!Array.isArray(value)) return EMPTY;

        return value
            .filter(
                (entry): entry is Visit =>
                    Boolean(entry) &&
                    typeof entry.id === "string" &&
                    typeof entry.at === "number"
            )
            .slice(0, LIMIT);
    } catch {
        // Corrupt or hand-edited storage reads as no history rather than
        // taking the page down.
        return EMPTY;
    }
};

export const readVisits = (): Visit[] => {
    if (typeof window === "undefined") return EMPTY;

    let raw: string;
    try {
        raw = localStorage.getItem(KEY) ?? "";
    } catch {
        return EMPTY;
    }

    if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedVisits = raw ? parse(raw) : EMPTY;
    }

    return cachedVisits;
};

/** The snapshot the server renders — always empty, so hydration agrees. */
export const readVisitsServer = (): Visit[] => EMPTY;

export const subscribeVisits = (onChange: () => void) => {
    if (typeof window === "undefined") return () => { };

    window.addEventListener(VISITED_EVENT, onChange);
    // `storage` fires in OTHER tabs, which is exactly when this list goes stale
    // without anything in this tab having happened.
    window.addEventListener("storage", onChange);

    return () => {
        window.removeEventListener(VISITED_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
};

/** Moves `workspaceId` to the front, stamped now. Safe to call on every mount. */
export const recordVisit = (workspaceId: string) => {
    if (typeof window === "undefined" || !workspaceId) return;

    const next: Visit[] = [
        { id: workspaceId, at: Date.now() },
        ...readVisits().filter((visit) => visit.id !== workspaceId),
    ].slice(0, LIMIT);

    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* storage full or blocked — losing the history is survivable */
    }

    window.dispatchEvent(new Event(VISITED_EVENT));
};

/** When this workspace was last opened, or undefined if never. */
export const visitedAt = (visits: Visit[], workspaceId: string) =>
    visits.find((visit) => visit.id === workspaceId)?.at;
