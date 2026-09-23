import { baseApi } from "../baseApi";

export type NotificationType =
    | "mention"
    | "assignment"
    | "invite"
    | "comment"
    | "status_change"
    | "deadline"
    | "system";

export interface NotificationItem {
    _id: string;
    user: string;
    workspace?: string | null;
    module?: string | null;
    record?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    readAt?: string | null;
    /** Type-specific extras — an invite's role/inviter/workspace name+icon. */
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface GetNotificationsArgs {
    limit?: number;
    isRead?: boolean;
    type?: NotificationType;
}

const LIST_TAG = { type: "Notification" as const, id: "LIST" };

const toQueryString = (args?: GetNotificationsArgs) => {
    if (!args) return "";

    const params = new URLSearchParams();
    if (args.limit) params.set("limit", String(args.limit));
    if (args.isRead !== undefined) params.set("isRead", String(args.isRead));
    if (args.type) params.set("type", args.type);

    const qs = params.toString();
    return qs ? `?${qs}` : "";
};

export const notificationsApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getNotifications: build.query<NotificationItem[], GetNotificationsArgs | void>({
            query: (args) => `/notifications${toQueryString(args ?? undefined)}`,
            transformResponse: (response: { notifications?: NotificationItem[] }) =>
                response.notifications ?? [],
            providesTags: (result) => [
                LIST_TAG,
                ...(result ?? []).map((n) => ({ type: "Notification" as const, id: n._id }))
            ]
        }),

        getUnreadCount: build.query<number, void>({
            query: () => "/notifications/unread-count",
            transformResponse: (response: { count?: number }) => response.count ?? 0,
            providesTags: [LIST_TAG]
        }),

        markNotificationRead: build.mutation<NotificationItem, string>({
            query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
            transformResponse: (response: { notification: NotificationItem }) =>
                response.notification,
            invalidatesTags: [LIST_TAG]
        }),

        markAllNotificationsRead: build.mutation<{ message: string }, void>({
            query: () => ({ url: "/notifications/read-all", method: "POST" }),
            invalidatesTags: [LIST_TAG]
        }),

        deleteNotification: build.mutation<{ message: string }, string>({
            query: (id) => ({ url: `/notifications/${id}`, method: "DELETE" }),
            invalidatesTags: [LIST_TAG]
        }),

        /**
         * Triggered FROM a notification but mutates the WorkspaceMember row —
         * see backend/controllers/workspaceMember.controller.ts
         * accept/declineWorkspaceInvite. The server deletes the resolved
         * invite notification itself, so Notification is invalidated here
         * too rather than left to a manual dismiss.
         */
        acceptWorkspaceInvite: build.mutation<{ message: string }, string>({
            query: (workspaceId) => ({
                url: `/workspace-members/${workspaceId}/accept`,
                method: "POST"
            }),
            invalidatesTags: [
                LIST_TAG,
                { type: "Workspace", id: "LIST" },
                { type: "Member", id: "LIST" }
            ]
        }),

        declineWorkspaceInvite: build.mutation<{ message: string }, string>({
            query: (workspaceId) => ({
                url: `/workspace-members/${workspaceId}/decline`,
                method: "POST"
            }),
            invalidatesTags: [LIST_TAG]
        })
    })
});

export const {
    useGetNotificationsQuery,
    useGetUnreadCountQuery,
    useMarkNotificationReadMutation,
    useMarkAllNotificationsReadMutation,
    useDeleteNotificationMutation,
    useAcceptWorkspaceInviteMutation,
    useDeclineWorkspaceInviteMutation
} = notificationsApi;
