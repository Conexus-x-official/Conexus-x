import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import env from "@/config/env";
import { getToken } from "@/lib/auth";
import { getSocketId } from "@/lib/socket";

/**
 * Every mutation that the server audits must carry this tag, otherwise the
 * activity feed keeps serving a cached page and only a hard refresh shows the
 * new entries. It is a bare LIST id so one tag covers every workspace.
 */
export const ACTIVITY_TAG = { type: "Activity" as const, id: "LIST" };

/**
 * The signed-in account's AI credit balance.
 *
 * One tag with no id — there is exactly one balance per session, and every
 * agent turn spends from it. Anything that costs money invalidates this.
 */
export const AI_CREDITS_TAG = { type: "AiCredits" as const, id: "SELF" };

/**
 * The single shared cache instance. Every resource file injects its endpoints
 * here, so two components asking for the same data share one request.
 */
export const baseApi = createApi({
    reducerPath: "api",

    baseQuery: fetchBaseQuery({
        baseUrl: (env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, ""),
        prepareHeaders: (headers) => {
            const token = getToken();
            if (token) {
                headers.set("Authorization", `Bearer ${token}`);
            }

            /**
             * WHO IS ASKING, so the push layer can leave them out of the
             * broadcast their own request causes. This client already applied
             * the change optimistically; echoing it back would at best be a
             * wasted patch and at worst fight a still-pending one. The server
             * excludes this socket at the emit, so the bytes are never sent —
             * see emitChange() / originOf() in the backend.
             */
            const socketId = getSocketId();
            if (socketId) {
                headers.set("x-socket-id", socketId);
            }

            return headers;
        }
    }),

    tagTypes: [
        "Workspace",
        "Member",
        "Module",
        "Collection",
        "Column",
        "Record",
        "RecordValue",
        "Amendment",
        "Activity",
        "Automation",
        "ModuleAccess",
        // Conexus Meet: the thread list, and one thread's transcript.
        "Conversation",
        "Message",
        // The signed-in account's AI spending balance.
        "AiCredits",
        // The signed-in account's notification center.
        "Notification",
        // A module's public, shareable form config.
        "Form"
    ],

    keepUnusedDataFor: 120,        // seconds a cache entry survives with no subscriber
    refetchOnMountOrArgChange: 60, // only refetch when data is older than 60s
    refetchOnReconnect: true,

    endpoints: () => ({})
});
