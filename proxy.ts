import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
    isAuthPath,
    isProtectedPath,
    NEXT_PARAM,
    TOKEN_COOKIE,
} from "@/lib/authRoutes";

/**
 * Route protection.
 *
 * `proxy.ts` is what Next 16 calls this file; it was `middleware.ts` up to 15
 * and the behaviour is unchanged (docs 01-app/01-getting-started/16-proxy.md).
 *
 * WHAT THIS IS AND IS NOT
 *
 * It is a ROUTING guard: it stops an unauthenticated visitor from loading a
 * protected page's shell, so nobody watches an app skeleton paint and then
 * bounce. Next's own guidance is explicit that proxy is for optimistic checks
 * and "should not be used as a full session management or authorization
 * solution", and that is the right reading here for a second reason: the token
 * lives in a cookie set by client JavaScript, so it cannot be httpOnly and
 * anyone can hand-write one.
 *
 * THE REAL BOUNDARY IS THE API. Every backend route runs `protect`, which
 * verifies the signature against JWT_SECRET, and every query the app makes is
 * authorised there. A forged cookie gets you a page that immediately fails to
 * load any data — not access to anything.
 *
 * The signature is deliberately NOT checked here. Doing so would mean shipping
 * JWT_SECRET to the frontend, which would be a genuine downgrade in exchange
 * for a guarantee we already get from the API. What IS checked is `exp`, which
 * needs no secret and catches the case that actually happens to real people: a
 * token that quietly expired while a tab was open.
 */

/** Reads `exp` out of a JWT without verifying it. Never trusted for access. */
function isUnexpired(token: string): boolean {
    const payload = token.split(".")[1];
    if (!payload) return false;

    try {
        // base64url -> base64. atob is available in this runtime; Buffer is not.
        const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        const claims = JSON.parse(json) as { exp?: number };

        // No exp at all: let it through rather than locking someone out over a
        // claim the server may simply not set. The API still decides.
        if (typeof claims.exp !== "number") return true;

        return claims.exp * 1000 > Date.now();
    } catch {
        // Unparseable is not a session.
        return false;
    }
}

export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    const signedIn = !!token && isUnexpired(token);

    /* ---------------------------------------------------------------- *
     *  A protected page without a session
     * ---------------------------------------------------------------- */
    if (isProtectedPath(pathname) && !signedIn) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";

        // Remember where they were going, so signing in resumes the journey
        // instead of dumping everyone on /Home. Path + query only — never an
        // absolute URL, which is how a redirect parameter becomes an open
        // redirect to someone else's site.
        url.searchParams.set(NEXT_PARAM, `${pathname}${search}`);

        const response = NextResponse.redirect(url);

        // An expired cookie must not survive the bounce, or every navigation
        // pays to re-decode a token that is already known to be dead.
        if (token) response.cookies.delete(TOKEN_COOKIE);

        return response;
    }

    /* ---------------------------------------------------------------- *
     *  A signed-in user at the door
     * ---------------------------------------------------------------- */
    if (isAuthPath(pathname) && signedIn) {
        const url = request.nextUrl.clone();
        url.pathname = "/Home";
        url.search = "";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    /**
     * Everything except assets and the metadata routes.
     *
     * Without a matcher this runs on EVERY request including /_next/static, so
     * the negative lookahead is not an optimisation — it is what stops the
     * redirect above from being applied to the CSS and JS of the login page it
     * redirects to.
     */
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};

export default proxy;
