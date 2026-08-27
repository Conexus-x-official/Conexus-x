import { baseApi } from "../baseApi";

/**
 * Conexus Meet — conversations and messages.
 *
 * Two tag types: `Conversation` (the list on the left) and `Message` (one
 * thread, keyed by conversation id). They are invalidated separately because a
 * new message changes BOTH — the transcript and the list row's preview — and
 * refetching a thread to reorder a sidebar row would be the expensive half of
 * that. The socket bridge patches both instead; see store/realtime.ts.
 */

export interface MeetUser {
    _id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    /** Derived server-side. Never the raw picked status — see the backend. */
    presence?: string;
}

export interface ConversationMember {
    user: MeetUser;
    isAdmin: boolean;
    joinedAt: string;
    lastReadAt: string | null;
}

/** The workspace a thread lives in, named so the list can group by it. */
export interface MeetWorkspaceRef {
    _id: string;
    name: string;
    icon?: string;
}

export interface MeetCapabilities {
    role: string;
    canStartDirect: boolean;
    canCreateTeam: boolean;
    canManageAnyTeam: boolean;
}

/** One workspace worth of people you may start a conversation with. */
export interface ContactGroup {
    _id: string;
    name: string;
    icon?: string;
    myRole: string | null;
    capabilities: MeetCapabilities;
    people: (MeetUser & { role: string })[];
}

export interface Conversation {
    _id: string;
    workspace: MeetWorkspaceRef;
    /** The caller's role in that workspace — controls are greyed from this. */
    myRole: string | null;
    kind: "direct" | "group";
    name: string;
    icon?: string;
    members: ConversationMember[];
    createdBy: string;
    lastMessage?: {
        text: string;
        sender: string | null;
        at: string | null;
        kind?: string;
    };
    /** Direct threads only — the other person, resolved by the server. */
    counterpart?: MeetUser | null;
    unread: number;
    createdAt: string;
    updatedAt: string;
}

export interface MessageAttachment {
    url: string;
    publicId: string;
    kind: "image" | "video" | "document" | "other";
    name: string;
    bytes: number;
    width?: number;
    height?: number;
}

export interface Message {
    _id: string;
    conversation: string;
    sender: MeetUser;
    text: string;
    attachments: MessageAttachment[];
    replyTo?: {
        _id: string;
        text: string;
        sender?: MeetUser;
        isDeleted?: boolean;
    } | null;
    editedAt?: string | null;
    isDeleted?: boolean;
    /** A call that happened in this thread, rendered as a centred notice. */
    system?: {
        type: string;
        callKind: string;
        durationMs: number;
    } | null;
    createdAt: string;
    /** Client-only: an optimistic bubble that has not been acknowledged yet. */
    pending?: boolean;
}

export interface MessagePage {
    messages: Message[];
    hasMore: boolean;
    nextCursor: string | null;
}

export const meetApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        /**
         * EVERY thread, across EVERY workspace — no argument.
         *
         * It used to take a workspace id, which meant an owner in three
         * workspaces had to leave Meet and switch workspace to answer someone,
         * and a message waiting elsewhere was invisible until they happened to
         * look. A chat list is a list of people, not a facet of whichever board
         * is open. Nothing is loosened: access was always membership of the
         * CONVERSATION, which is narrower than membership of the workspace.
         */
        getConversations: build.query<Conversation[], void>({
            query: () => `/conversations`,
            transformResponse: (r: { conversations?: Conversation[] }) =>
                (r.conversations ?? []).filter(Boolean),
            providesTags: (result) => [
                { type: "Conversation" as const, id: "LIST" },
                ...(result ?? []).map((c) => ({
                    type: "Conversation" as const,
                    id: c._id
                }))
            ]
        }),

        /**
         * Who you may talk to, grouped by workspace and already filtered by the
         * server's rules. One request instead of a getMembers per workspace,
         * and the client never has to decide what a guest may do.
         */
        getContacts: build.query<ContactGroup[], void>({
            query: () => `/conversations/contacts`,
            transformResponse: (r: { workspaces?: ContactGroup[] }) =>
                (r.workspaces ?? []).filter(Boolean),
            providesTags: [{ type: "Conversation" as const, id: "CONTACTS" }]
        }),

        /**
         * "Open", not "create" — the server returns the existing pair if there
         * is one, so clicking a person twice can never split the history.
         */
        openDirect: build.mutation<
            Conversation,
            { workspaceId: string; userId: string }
        >({
            query: ({ workspaceId, userId }) => ({
                url: `/conversations/${workspaceId}/direct`,
                method: "POST",
                body: { userId }
            }),
            transformResponse: (r: { conversation: Conversation }) => r.conversation,
            invalidatesTags: [{ type: "Conversation", id: "LIST" }]
        }),

        createGroup: build.mutation<
            Conversation,
            { workspaceId: string; name: string; icon?: string; memberIds: string[] }
        >({
            query: ({ workspaceId, ...body }) => ({
                url: `/conversations/${workspaceId}/group`,
                method: "POST",
                body
            }),
            transformResponse: (r: { conversation: Conversation }) => r.conversation,
            invalidatesTags: [{ type: "Conversation", id: "LIST" }]
        }),

        updateConversation: build.mutation<
            Conversation,
            { conversationId: string; name?: string; icon?: string }
        >({
            query: ({ conversationId, name, icon }) => ({
                url: `/conversations/${conversationId}`,
                method: "PUT",
                body: { name, icon }
            }),
            transformResponse: (r: { conversation: Conversation }) => r.conversation,
            invalidatesTags: (_r, _e, { conversationId }) => [
                { type: "Conversation", id: "LIST" },
                { type: "Conversation", id: conversationId }
            ]
        }),

        addConversationMembers: build.mutation<
            { added: string[]; conversation: Conversation },
            { conversationId: string; memberIds: string[] }
        >({
            query: ({ conversationId, memberIds }) => ({
                url: `/conversations/${conversationId}/members`,
                method: "POST",
                body: { memberIds }
            }),
            invalidatesTags: (_r, _e, { conversationId }) => [
                { type: "Conversation", id: "LIST" },
                { type: "Conversation", id: conversationId }
            ]
        }),

        /** One endpoint for "remove them" and "leave" — the same write. */
        removeConversationMember: build.mutation<
            { message: string },
            { conversationId: string; userId: string }
        >({
            query: ({ conversationId, userId }) => ({
                url: `/conversations/${conversationId}/members/${userId}`,
                method: "DELETE"
            }),
            invalidatesTags: (_r, _e, { conversationId }) => [
                { type: "Conversation", id: "LIST" },
                { type: "Conversation", id: conversationId }
            ]
        }),

        /**
         * Optimistic: the badge clears the instant you open a thread, because
         * waiting for a round trip to un-bold a row you are already reading
         * looks broken.
         */
        markConversationRead: build.mutation<
            { lastReadAt: string },
            { conversationId: string }
        >({
            query: ({ conversationId }) => ({
                url: `/conversations/${conversationId}/read`,
                method: "POST"
            }),
            async onQueryStarted(
                { conversationId },
                { dispatch, queryFulfilled }
            ) {
                const patch = dispatch(
                    meetApi.util.updateQueryData(
                        "getConversations",
                        undefined,
                        (draft) => {
                            const row = draft.find((c) => c._id === conversationId);
                            if (row) row.unread = 0;
                        }
                    )
                );
                try {
                    await queryFulfilled;
                } catch {
                    patch.undo();
                }
            }
        }),

        /**
         * One page of a thread, newest last. Older pages are fetched with
         * `before` and merged by merge() below rather than replacing the entry,
         * so scrolling up never drops what is already on screen.
         */
        getMessages: build.query<
            MessagePage,
            { conversationId: string; before?: string }
        >({
            query: ({ conversationId, before }) =>
                `/messages/${conversationId}${before ? `?before=${encodeURIComponent(before)}` : ""}`,
            /**
             * Paging keyed by conversation ALONE, so page 2 lands in the same
             * cache entry as page 1 instead of creating a second one the UI
             * would have to stitch together itself.
             */
            serializeQueryArgs: ({ queryArgs }) => queryArgs.conversationId,
            merge: (current, incoming, { arg }) => {
                if (!arg.before) {
                    // A fresh load of the thread replaces whatever was there.
                    return incoming;
                }

                // Older page: it belongs ABOVE what is already held.
                const known = new Set(current.messages.map((m) => m._id));

                current.messages.unshift(
                    ...incoming.messages.filter((m) => !known.has(m._id))
                );
                current.hasMore = incoming.hasMore;
                current.nextCursor = incoming.nextCursor;
            },
            forceRefetch: ({ currentArg, previousArg }) =>
                currentArg?.before !== previousArg?.before,
            providesTags: (_r, _e, { conversationId }) => [
                { type: "Message" as const, id: conversationId }
            ]
        }),

        sendMessage: build.mutation<
            Message,
            { conversationId: string; text: string; replyTo?: string }
        >({
            query: ({ conversationId, text, replyTo }) => ({
                url: `/messages/${conversationId}`,
                method: "POST",
                body: { text, replyTo }
            }),
            transformResponse: (r: { data: Message }) => r.data
            /**
             * NO invalidation and NO optimistic patch here. The server echoes
             * this message back to the sender over the socket (the only emit
             * that deliberately keeps no originId), and the bridge appends it —
             * so patching here as well would put the same bubble in twice.
             * The composer draws its own pending bubble until that lands.
             */
        }),

        sendAttachments: build.mutation<
            Message,
            { conversationId: string; files: File[]; text?: string }
        >({
            query: ({ conversationId, files, text }) => {
                const body = new FormData();
                files.forEach((file) => body.append("files", file));
                if (text) body.append("text", text);

                return {
                    url: `/messages/${conversationId}/attachments`,
                    method: "POST",
                    body
                    // No Content-Type: the browser must set the multipart
                    // boundary itself, and naming it here breaks the parse.
                };
            },
            transformResponse: (r: { data: Message }) => r.data
        }),

        editMessage: build.mutation<
            Message,
            { messageId: string; conversationId: string; text: string }
        >({
            query: ({ messageId, text }) => ({
                url: `/messages/${messageId}`,
                method: "PUT",
                body: { text }
            }),
            transformResponse: (r: { data: Message }) => r.data
        }),

        deleteMessage: build.mutation<
            { message: string },
            { messageId: string; conversationId: string }
        >({
            query: ({ messageId }) => ({
                url: `/messages/${messageId}`,
                method: "DELETE"
            })
        }),

        /** Writes the "call ended · 4m" row into the transcript. */
        logCall: build.mutation<
            { data: Message },
            {
                conversationId: string;
                event: "started" | "ended" | "missed";
                callKind: "audio" | "video";
                durationMs?: number;
            }
        >({
            query: ({ conversationId, ...body }) => ({
                url: `/messages/${conversationId}/call`,
                method: "POST",
                body
            })
        })
    })
});

export const {
    useGetConversationsQuery,
    useGetContactsQuery,
    useOpenDirectMutation,
    useCreateGroupMutation,
    useUpdateConversationMutation,
    useAddConversationMembersMutation,
    useRemoveConversationMemberMutation,
    useMarkConversationReadMutation,
    useGetMessagesQuery,
    useSendMessageMutation,
    useSendAttachmentsMutation,
    useEditMessageMutation,
    useDeleteMessageMutation,
    useLogCallMutation
} = meetApi;
