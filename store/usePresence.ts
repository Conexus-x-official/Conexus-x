"use client";

import { useCallback } from "react";
import { getUser, updateUser } from "@/lib/auth";
import { UserStatus } from "@/lib/presence";
import { useUpdateStatusMutation } from "./api/presence.api";

/**
 * The status picker's action. Presence itself is no longer this hook's job.
 *
 * IT USED TO BEAT every 60s (POST /auth/heartbeat) and pause while the tab was
 * hidden, so "online" decayed to offline within the server's 150s window. The
 * socket says the same thing better and for free: connecting marks the user
 * live, disconnecting backdates lastSeen past the timeout so they read offline
 * at once rather than up to two and a half minutes later, and closing the tab
 * is a disconnect. See attachRealtime() in the backend.
 *
 * What no socket lifecycle can observe is a PICKED status — busy, dnd, appear
 * offline — so that still goes through the REST endpoint, which announces it to
 * everyone in the user's workspaces on the way out.
 */
export function usePresence() {
    const [updateStatus, { isLoading: isSaving }] = useUpdateStatusMutation();

    const setStatus = useCallback(
        async (status: UserStatus) => {
            // Cached first so every mounted avatar repaints without waiting on
            // the round-trip; a failure rolls the cache back to the old pick.
            const previous = getUser()?.status;
            updateUser({ status });

            try {
                await updateStatus(status).unwrap();
            } catch {
                updateUser({ status: previous });
            }
        },
        [updateStatus]
    );

    return { setStatus, isSaving };
}
