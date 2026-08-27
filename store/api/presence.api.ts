import { baseApi } from "../baseApi";
import type { UserStatus } from "@/lib/presence";

export interface PresenceResponse {
    message?: string;
    /** What the user picked. */
    status: UserStatus;
    /** What everyone else sees — the pick, only while the user is connected. */
    presence: UserStatus;
    lastSeen?: string;
}

export const presenceApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        updateStatus: build.mutation<PresenceResponse, UserStatus>({
            query: (status) => ({
                url: "/auth/status",
                method: "PATCH",
                body: { status }
            }),
            // The roster renders everyone's dot, so a pick has to reach it.
            invalidatesTags: [{ type: "Member", id: "LIST" }]
        }),

        /**
         * UNUSED BY THIS APP since presence moved onto the socket — connecting
         * is the heartbeat now. Kept because POST /auth/heartbeat is still a
         * public route an API-key integrator may be calling, and deleting the
         * client binding for a live endpoint buys nothing.
         */
        sendHeartbeat: build.mutation<PresenceResponse, void>({
            query: () => ({ url: "/auth/heartbeat", method: "POST" }),
            invalidatesTags: [{ type: "Member", id: "LIST" }]
        })
    })
});

export const { useUpdateStatusMutation, useSendHeartbeatMutation } = presenceApi;
