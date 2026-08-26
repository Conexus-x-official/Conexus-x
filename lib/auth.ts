// lib/auth.ts

import type { UserStatus } from "./presence";

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
  };
}

const TOKEN_KEY = "crm_auth_token";
const USER_KEY = "crm_auth_user";

export function saveToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
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
