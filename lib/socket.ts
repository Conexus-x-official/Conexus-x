// lib/socket.ts

import { io, type Socket } from "socket.io-client";
import env from "@/config/env";
import { getToken } from "./auth";

/**
 * The one socket this tab owns.
 *
 * A module-level singleton rather than a React context value, for the same
 * reason baseApi is one createApi: several places need to reach it (the store
 * bridge, the room hooks, baseApi's own header) and a second connection would
 * mean a second identity in the server's presence registry — closing one tab
 * would then look like going offline while the other is still open.
 */

let socket: Socket | null = null;

/**
 * The server strips this tab out of its own broadcasts, so an edit is never
 * echoed back to the client that already applied it optimistically. Read by
 * store/baseApi.ts and sent as `x-socket-id` on every request.
 */
export const getSocketId = (): string | undefined => socket?.id;

export const getSocket = (): Socket | null => socket;

/**
 * The API base carries an `/api` suffix; socket.io is mounted at the ORIGIN.
 * Deriving one from the other keeps a single URL in .env — pointing the app at
 * a deployed API must not need a second variable that can be forgotten.
 */
const socketOrigin = (): string => {
    const raw = env.NEXT_PUBLIC_API_URL ?? "";

    try {
        return new URL(raw).origin;
    } catch {
        return raw.replace(/\/api\/?$/, "");
    }
};

export const connectSocket = (): Socket | null => {
    if (typeof window === "undefined") return null;

    const token = getToken();

    // No token, no socket. The handshake would be rejected anyway, and
    // retrying it forever on the login screen is just noise.
    if (!token) return null;

    if (socket?.connected) return socket;

    if (socket) {
        // Same tab, new token (a fresh login). Replace the credential rather
        // than opening a second connection alongside the stale one.
        socket.auth = { token };
        socket.connect();
        return socket;
    }

    socket = io(socketOrigin(), {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
        // Long-poll fallback stays enabled: a proxy that will not upgrade should
        // degrade to slower push, not to no push at all.
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 10_000,
        timeout: 10_000
    });

    return socket;
};

export const disconnectSocket = (): void => {
    if (!socket) return;

    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
};

/**
 * Ask the server for a room. It re-checks access before joining, so this is a
 * request and not an instruction — see attachRealtime() in the backend.
 *
 * Rooms are re-sent on every `connect`, including reconnects: socket.io gives
 * a reconnected client a NEW server-side socket with no rooms, so a page that
 * subscribed once would silently stop receiving after the first blip.
 */
export interface RoomRequest {
    workspaceId?: string;
    moduleId?: string;
    /**
     * A Conexus Meet thread. Gated on CONVERSATION membership server-side, not
     * workspace membership — being in the workspace lets you start a thread, it
     * does not let you listen to one you were never added to.
     */
    conversationId?: string;
}

export const subscribeRooms = (rooms: RoomRequest): void => {
    socket?.emit("subscribe", rooms);
};

export const unsubscribeRooms = (rooms: RoomRequest): void => {
    socket?.emit("unsubscribe", rooms);
};
