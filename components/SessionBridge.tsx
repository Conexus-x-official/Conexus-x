"use client";

import { useEffect } from "react";
import { syncTokenCookie } from "@/lib/auth";

/**
 * Keeps the routing cookie in step with the real session in localStorage.
 *
 * Two cases need this and neither passes through saveToken():
 *
 *  1. A session that PREDATES the cookie existing. Everyone already signed in
 *     when this shipped has a token in localStorage and no cookie, and without
 *     this they would be bounced to /login on their next navigation — signed
 *     in, holding a valid token, and locked out by the guard meant to help.
 *
 *  2. A cookie that lapsed while the tab sat open. The cookie carries the same
 *     7 days as the JWT, so the two expire together, but a tab left open over
 *     a weekend outlives both; re-writing it on mount keeps navigation working
 *     for as long as the token itself is good.
 *
 * Runs in an effect rather than during render because it touches document
 * .cookie — a side effect, and one the server has no business attempting.
 *
 * Renders nothing. Mounted once, in the root layout.
 */
export default function SessionBridge() {
    useEffect(() => {
        syncTokenCookie();

        // A sign-in or sign-out in ANOTHER TAB writes localStorage and fires
        // this; without it, that tab is signed out and this one still carries a
        // cookie saying otherwise.
        const onStorage = () => syncTokenCookie();

        window.addEventListener("storage", onStorage);
        window.addEventListener("crm:user-updated", onStorage);

        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("crm:user-updated", onStorage);
        };
    }, []);

    return null;
}
