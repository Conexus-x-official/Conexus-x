// lib/presence.ts

/**
 * The presence contract, mirrored from backend/models/User.ts USER_STATUSES —
 * change both together. `status` is what the user picked; `presence` is what the
 * server derives from it plus a fresh heartbeat, so it is the one to render for
 * other people.
 */
export const USER_STATUSES = ["online", "busy", "dnd", "away", "offline"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export interface PresenceOption {
    value: UserStatus;
    label: string;
    /** Shown under the label in the picker, the way Teams explains each pick. */
    hint: string;
    color: string;
}

// Fixed hexes rather than theme tokens: a presence dot has to mean the same
// thing in every theme, so it never re-tints with the palette.
export const PRESENCE_OPTIONS: PresenceOption[] = [
    { value: "online", label: "Available", hint: "Active and reachable", color: "#22C55E" },
    { value: "busy", label: "Busy", hint: "Working, may be slow to reply", color: "#EF4444" },
    { value: "dnd", label: "Do not disturb", hint: "Only urgent pings", color: "#B91C1C" },
    { value: "away", label: "Be right back", hint: "Stepping away for a moment", color: "#F59E0B" },
    { value: "offline", label: "Appear offline", hint: "Shown offline to everyone", color: "#94A3B8" },
];

const OFFLINE: PresenceOption = PRESENCE_OPTIONS[PRESENCE_OPTIONS.length - 1];

export const presenceOption = (status?: string | null): PresenceOption =>
    PRESENCE_OPTIONS.find((option) => option.value === status) ?? OFFLINE;

export const presenceLabel = (status?: string | null): string =>
    presenceOption(status).label;

export const presenceColor = (status?: string | null): string =>
    presenceOption(status).color;

/*
 * There is no client heartbeat any more. Being CONNECTED is what marks a user
 * live now, so the cadence constant that used to sit here described a timer
 * that no longer exists — see store/usePresence.ts and the backend's
 * attachRealtime(). PRESENCE_TIMEOUT_MS still lives server-side as the fallback
 * for reads that never see a socket.
 */
