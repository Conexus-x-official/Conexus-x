"use client";

import { useEffect } from "react";
import { getSocket, subscribeRooms, unsubscribeRooms } from "@/lib/socket";

/**
 * Subscribes the current page to the rooms it is actually reading.
 *
 * Rooms are the reason a cell edit on one board does not cost anything to
 * somebody reading another. A page asks for what it draws; the SERVER re-checks
 * access before joining, so this is a request and never a grant — see
 * attachRealtime() in the backend.
 *
 * Re-sent on every `connect`. A reconnected client gets a NEW server-side
 * socket with no rooms at all, so a page that subscribed once at mount would go
 * quiet after the first network blip and look exactly like the staleness this
 * whole layer exists to remove.
 */
export function useRealtimeRoom(rooms: {
    workspaceId?: string;
    moduleId?: string;
}) {
    const { workspaceId, moduleId } = rooms;

    useEffect(() => {
        if (!workspaceId && !moduleId) return;

        const request = { workspaceId, moduleId };

        subscribeRooms(request);

        const socket = getSocket();
        const onConnect = () => subscribeRooms(request);

        socket?.on("connect", onConnect);

        return () => {
            socket?.off("connect", onConnect);
            unsubscribeRooms(request);
        };
    }, [workspaceId, moduleId]);
}
