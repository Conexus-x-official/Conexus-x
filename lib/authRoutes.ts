/**
 * Which routes need a session, in one place.
 *
 * proxy.ts guards them and app/robots.ts hides them from crawlers. Those two
 * were always going to be the same list, and a new signed-in section added to
 * one but not the other is either crawled or unguarded — both silent.
 *
 * Kept free of any import so proxy.ts can use it: proxy runs in a restricted
 * runtime and must not drag the app's module graph in behind it.
 */

/**
 * Needs a signed-in user. Prefix match, so "/workspace" covers
 * "/workspace/<id>/module/<id>" without listing every leaf.
 */
export const PROTECTED_PREFIXES = [
    "/Home",
    "/workspace",
    "/members",
    "/developer",
    "/Extensions",
    "/Meet",
    "/user",
] as const;

/**
 * The way IN. Someone who already has a session has no business here — landing
 * on a login form while signed in reads as "my session was lost".
 *
 * /auth/callback is deliberately NOT in this list: it is where the OAuth
 * redirect lands to READ the token out of the URL fragment, so bouncing a
 * signed-in user away from it would break re-authenticating with a second
 * Google account.
 */
export const AUTH_PREFIXES = ["/login", "/register"] as const;

/** Nothing here should ever reach an index — the app plus the doors into it. */
export const NOINDEX_PREFIXES = [
    ...PROTECTED_PREFIXES,
    ...AUTH_PREFIXES,
    "/auth",
] as const;

/** True when `pathname` is the prefix itself or a path underneath it. */
export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
    return prefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

export const isProtectedPath = (pathname: string) =>
    matchesPrefix(pathname, PROTECTED_PREFIXES);

export const isAuthPath = (pathname: string) =>
    matchesPrefix(pathname, AUTH_PREFIXES);

/** The cookie the proxy reads. Mirrors the localStorage token — see lib/auth.ts. */
export const TOKEN_COOKIE = "crm_auth_token";

/** Where an interrupted visit is remembered, so signing in resumes it. */
export const NEXT_PARAM = "next";
