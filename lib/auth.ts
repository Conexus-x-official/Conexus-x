// lib/auth.ts

import type { UserStatus } from "./presence";
import { TOKEN_COOKIE } from "./authRoutes";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  avatar?: string;
  /** The presence the user picked — kept here so the dot paints before any fetch. */
  status?: UserStatus;
  /**
   * UI settings stored on the ACCOUNT, mirrored here so the first paint needs
   * no round trip. The server is the truth (see PATCH /auth/preferences); this
   * copy is what /auth/me and login refresh on arrival.
   */
  preferences?: {
    /** Rail mode for the main navigation sidebar. */
    sidebarCollapsed?: boolean;
    /**
     * Keyboard bindings, keyed by the ids in lib/shortcuts.ts. Anything unset
     * falls back to that table's default, so this only ever holds what the
     * user actually changed.
     */
    shortcuts?: Record<string, string>;
  };
}

const TOKEN_KEY = "crm_auth_token";
const USER_KEY = "crm_auth_user";

/** Matches the backend's 7-day JWT (services/jwt.service.ts). */
const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/* ------------------------------------------------------------------ *
 *  The cookie mirror
 * ------------------------------------------------------------------ */

/**
 * The token is ALSO written to a cookie, purely so the server can see it.
 *
 * localStorage is invisible to proxy.ts — it runs before the browser has
 * executed any of our JavaScript — so without a cookie there is no way to
 * redirect an unauthenticated visitor before a protected page renders. The
 * Bearer header still reads localStorage; this copy exists for routing.
 *
 * IT IS NOT httpOnly AND CANNOT BE. A cookie set from JavaScript is readable
 * by JavaScript by definition, so this adds no protection against XSS — but it
 * also adds no NEW exposure, because the same token already sat in
 * localStorage, which is equally readable. What it must not be mistaken for is
 * a security boundary: see the note at the top of proxy.ts.
 */
function writeTokenCookie(token: string): void {
  if (typeof document === "undefined") return;

  // Secure only on https — a Secure cookie is dropped outright on a plain http
  // origin, which would silently disable the guard in local development.
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function clearTokenCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function readTokenCookie(): string | null {
  if (typeof document === "undefined") return null;

  const hit = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${TOKEN_COOKIE}=`));

  return hit ? decodeURIComponent(hit.slice(TOKEN_COOKIE.length + 1)) : null;
}

/**
 * Brings the cookie back in step with localStorage.
 *
 * Two cases need it and neither goes through saveToken(): a session that
 * predates this cookie existing, and a cookie that expired while the tab sat
 * open. Mounted once from the root layout (components/SessionBridge.tsx).
 *
 * Returns whether anything changed, so the caller can decide to re-route.
 */
export function syncTokenCookie(): boolean {
  if (typeof window === "undefined") return false;

  const token = getToken();
  const cookie = readTokenCookie();

  if (token && token !== cookie) {
    writeTokenCookie(token);
    return true;
  }

  if (!token && cookie) {
    clearTokenCookie();
    return true;
  }

  return false;
}

export function saveToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
    writeTokenCookie(token);
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    clearTokenCookie();
  }
}

export function saveUser(user: AuthUser): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getUser(): AuthUser | null {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr) as AuthUser;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // The cookie is what the proxy reads, so leaving it behind would let a
    // signed-out person keep walking into protected pages until it expired.
    clearTokenCookie();

    // Same event the rest of the app already listens to, so every mounted
    // avatar and the navbar drop back to the signed-out state at once.
    window.dispatchEvent(new CustomEvent("crm:user-updated", { detail: null }));
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Merges fields into the cached user without a round-trip — used after an avatar
 * upload so every mounted avatar picks the new URL up.
 */
export function updateUser(patch: Partial<AuthUser>): AuthUser | null {
  const current = getUser();
  if (!current) return null;

  const next = { ...current, ...patch };
  saveUser(next);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("crm:user-updated", { detail: next }));
  }

  return next;
}

/* ------------------------------------------------------------------ *
 *  Reading the signed-in user from React
 * ------------------------------------------------------------------ */

/**
 * getUser() parses fresh on every call, so it hands back a NEW object each
 * time. useSyncExternalStore compares snapshots by identity and would spin
 * forever on that, so the parse is cached against the raw stored string and
 * only re-runs when that string actually changes.
 */
let cachedUserRaw: string | null = null;
let cachedUser: AuthUser | null = null;

/** Client snapshot — stable between real changes. */
export function readUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }

  if (raw !== cachedUserRaw) {
    cachedUserRaw = raw;
    cachedUser = raw ? getUser() : null;
  }

  return cachedUser;
}

/** Server snapshot — always null, so the first client render agrees with it. */
export function readUserServer(): AuthUser | null {
  return null;
}

export function subscribeUser(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => { };

  // The same event updateUser() already raises after an avatar upload, plus
  // `storage` for a sign-in that happened in another tab.
  window.addEventListener("crm:user-updated", onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener("crm:user-updated", onChange);
    window.removeEventListener("storage", onChange);
  };
}
