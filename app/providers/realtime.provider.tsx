"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { applyChange, resyncAfterReconnect, type ChangeEvent } from "@/store/realtime";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { isAuthenticated } from "@/lib/auth";
import { selectActiveWorkspaceId } from "@/store/selectors/workspace.selectors";
import { useRealtimeRoom } from "@/store/useRealtimeRoom";

/**
 * Owns the tab's one socket, for the app's whole lifetime.
 *
 * Mounted inside StoreProvider (it dispatches) and above everything else, so a
 * route change never tears the connection down — reconnecting on every
 * navigation would re-run the handshake, re-join every room, and make presence
 * flicker offline each time someone opened a board.
 */
export default function RealtimeProvider({
    children
}: {
    children: React.ReactNode;
}) {
    const dispatch = useAppDispatch();

    /**
     * The workspace room every signed-in page belongs in, joined once here
     * rather than repeated in each of them. It carries the lists drawn OUTSIDE
     * a board — the module index, the member table, presence dots — which is
     * most of what the sidebar and /Home are made of. Board rooms are joined by
     * the board itself, because only it knows which module is open.
     */
    const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId);

    useRealtimeRoom({ workspaceId: activeWorkspaceId || undefined });

    useEffect(() => {
        if (!isAuthenticated()) return;

        const socket = connectSocket();
        if (!socket) return;

        const onChange = (event: ChangeEvent) => applyChange(event, dispatch);

        /**
         * Not just the first connect — every one. A reconnect gives this client
         * a NEW server-side socket, so it has missed everything that happened
         * while it was away and holds no rooms. The room hooks re-subscribe
         * themselves off this same event; this half throws away what went
         * stale in the gap.
         */
        const onConnect = () => resyncAfterReconnect(dispatch);

        socket.on("crm:change", onChange);
        socket.on("connect", onConnect);

        /**
         * A token can change under a live socket (logging in as someone else in
         * the same tab). The handshake carries the OLD token until it is
         * replaced, so the connection is rebuilt rather than left authenticated
         * as the previous user.
         */
        const onAuthChanged = () => {
            disconnectSocket();
            const next = connectSocket();
            if (next) {
                next.on("crm:change", onChange);
                next.on("connect", onConnect);
            }
        };

        window.addEventListener("crm:user-updated", onAuthChanged);

        return () => {
            socket.off("crm:change", onChange);
            socket.off("connect", onConnect);
            window.removeEventListener("crm:user-updated", onAuthChanged);
        };
    }, [dispatch]);

    /**
     * Deliberately NOT disconnecting on unmount. This provider unmounts only
     * when the tab goes away, and socket.io closes the transport itself then;
     * tearing down here would also fire in React's development double-mount and
     * drop the connection a moment after opening it.
     */

    return <>{children}</>;
}
