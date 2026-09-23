/**
 * The extension URL being previewed, remembered in localStorage.
 *
 * ONE value, not a list: submitting a new URL overwrites whatever was saved
 * before, so the developer never re-enters the same address twice but also
 * never accumulates a history to pick through — there is only ever the one
 * thing being previewed right now.
 *
 * Read through useSyncExternalStore for the same reason the rest of this app
 * does: the server render has no `localStorage`, so reading it during render
 * would make the two passes disagree and React would throw the tree away with
 * a hydration error. The server snapshot is "", the client swaps in the real
 * value immediately after.
 *
 * `cached` must be a stable value between reads — returning a fresh string on
 * every call would spin React in a re-render loop — so it is filled once and
 * only changed by savePreviewUrl.
 */

const STORAGE_KEY = "crm_extension_preview_url";

let cached: string | null = null;

const listeners = new Set<() => void>();

export function readPreviewUrl(): string {
    if (cached === null) {
        try {
            cached = window.localStorage.getItem(STORAGE_KEY) ?? "";
        } catch {
            // Private mode, or storage disabled. An empty box is a fine
            // fallback; refusing to render the page is not.
            cached = "";
        }
    }

    return cached;
}

/** Nothing is remembered on the server, and pretending otherwise breaks hydration. */
export function readPreviewUrlServer(): string {
    return "";
}

export function subscribePreviewUrl(onChange: () => void): () => void {
    listeners.add(onChange);

    return () => {
        listeners.delete(onChange);
    };
}

/** Overwrites whatever was saved before — see the file header. */
export function savePreviewUrl(url: string): void {
    cached = url;

    try {
        if (url) {
            window.localStorage.setItem(STORAGE_KEY, url);
        } else {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Not worth failing the action over — the URL still works this session.
    }

    for (const listener of listeners) listener();
}

export interface UrlCheck {
    /** Normalised, or "" when the input cannot be used. */
    url: string;
    error: string | null;
    /** Shown as a caution rather than a refusal. */
    warning: string | null;
}

/**
 * Validate what was typed before it becomes an iframe src.
 *
 * The origin here is a SECURITY value, not just a location: the bridge pins it
 * and refuses messages from anywhere else, so a typo does not merely fail to
 * load — it produces a view that renders and then silently never connects,
 * which is a much harder thing to diagnose.
 */
export function checkPreviewUrl(raw: string): UrlCheck {
    const trimmed = raw.trim();

    if (!trimmed) {
        return { url: "", error: null, warning: null };
    }

    let parsed: URL;

    try {
        parsed = new URL(trimmed);
    } catch {
        return {
            url: "",
            error: "That is not a full URL. Include the scheme, e.g. https://your-app.trycloudflare.com",
            warning: null,
        };
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { url: "", error: "Only http and https URLs can be previewed.", warning: null };
    }

    const isLocal =
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    if (parsed.protocol === "http:" && !isLocal) {
        return {
            url: "",
            error: "Use https for anything that is not localhost — a browser will not frame plain http here.",
            warning: null,
        };
    }

    return {
        url: parsed.toString(),
        error: null,
        warning: parsed.hash
            ? "The fragment in that URL is ignored — the host appends its own parameters."
            : null,
    };
}
