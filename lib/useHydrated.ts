"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` on the server and for the FIRST client render (the one that hydrates),
 * then `true`.
 *
 * useSyncExternalStore hands the hydrating render its SERVER snapshot, so both
 * passes agree — the same mechanism the Toaster uses. Gate any read of
 * `localStorage` / `window` that feeds render output behind this, or the first
 * client render can diverge from the server's and React throws the tree away
 * with "Hydration failed".
 */
export const useHydrated = () =>
    useSyncExternalStore(
        subscribe,
        () => true,
        () => false
    );
