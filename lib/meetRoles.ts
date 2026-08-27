// lib/meetRoles.ts

import type { MemberRole } from "./roles";

/**
 * Mirrors backend/services/meetAccess.service.ts — change both together.
 *
 * These predicates only DISABLE or HIDE controls. The server re-checks every
 * one of them and its message is shown verbatim on a refusal, so a `true` here
 * is never permission — it is a guess at what the server will allow, made so
 * the UI does not offer a button that is going to fail.
 */

export interface MeetCapabilities {
    canStartDirect: boolean;
    canCreateTeam: boolean;
    /** Rename, invite and remove in ANY team in that workspace. */
    canManageAnyTeam: boolean;
}

export const meetCapabilities = (role?: string | null): MeetCapabilities => ({
    canStartDirect: true,
    // A guest may not assemble people: they see only what is shared with them.
    canCreateTeam: role !== "guest",
    canManageAnyTeam: role === "owner" || role === "admin"
});

/**
 * Who may administer one team: its own admins (whoever made it, plus anyone
 * promoted) OR an owner/admin of the workspace it lives in. Workspace managers
 * already run boards, members and roles — a team they can see but cannot
 * moderate would be the one object that escapes them.
 */
export const canAdministerTeam = (
    myRole: string | null | undefined,
    isTeamAdmin: boolean
): boolean => isTeamAdmin || meetCapabilities(myRole).canManageAnyTeam;

/** Short label for the role chip on a workspace heading. */
export const shortRole = (role?: string | null): string =>
    role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

export type { MemberRole };
