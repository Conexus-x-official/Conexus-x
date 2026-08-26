import { ACTIVITY_TAG, baseApi } from "../baseApi";
import type { MemberRole } from "@/lib/roles";
import type { Member } from "../types";

export const membersApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getMembers: build.query<Member[], string>({
            query: (workspaceId) => `/workspace-members/${workspaceId}`,
            transformResponse: (response: { members?: Member[] }) =>
                (response.members ?? []).filter(Boolean),
            providesTags: (result, _error, workspaceId) => [
                // The bare LIST tag lets a change that affects every workspace at
                // once (an avatar upload) invalidate all member lists in one go.
                { type: "Member" as const, id: "LIST" },
                { type: "Member" as const, id: `LIST-${workspaceId}` },
                ...(result ?? []).map((m) => ({ type: "Member" as const, id: m._id }))
            ]
        }),

        // The identifier is a UNION, not two optional fields: the server needs
        // exactly one of them, and `{ email?, userId? }` would type an empty
        // object — the one shape it rejects — as valid.
        addMember: build.mutation<
            Member,
            { workspaceId: string; role: string } & (
                | { email: string }
                | { userId: string }
            )
        >({
            query: ({ workspaceId, ...body }) => ({
                url: `/workspace-members/${workspaceId}`,
                method: "POST",
                body
            }),
            // The API answers with an envelope; without this the hook handed back
            // `{ message, member }` while claiming to be a Member.
            transformResponse: (response: { member: Member }) => response.member,
            invalidatesTags: (_result, _error, { workspaceId }) => [
                { type: "Member", id: `LIST-${workspaceId}` },
                ACTIVITY_TAG
            ]
        }),

        updateMemberRole: build.mutation<
            Member,
            { workspaceId: string; memberUserId: string; role: MemberRole }
        >({
            query: ({ workspaceId, memberUserId, role }) => ({
                url: `/workspace-members/${workspaceId}/${memberUserId}`,
                method: "PUT",
                body: { role }
            }),
            transformResponse: (response: { member: Member }) => response.member,

            // The dropdown shows the new role straight away; a rejected change
            // (last owner, admin reaching for ownership) rolls it back and the
            // caller surfaces the server's own message.
            async onQueryStarted(
                { workspaceId, memberUserId, role },
                { dispatch, queryFulfilled }
            ) {
                const patch = dispatch(
                    membersApi.util.updateQueryData("getMembers", workspaceId, (draft) => {
                        const row = draft.find(
                            (member) => String(member.user?._id ?? member._id) === memberUserId
                        );
                        if (row) row.role = role;
                    })
                );

                try {
                    await queryFulfilled;
                } catch {
                    patch.undo();
                }
            },

            invalidatesTags: (_result, _error, { workspaceId }) => [
                { type: "Member", id: `LIST-${workspaceId}` },
                ACTIVITY_TAG
            ]
        }),

        removeMember: build.mutation<
            { message: string },
            { workspaceId: string; memberUserId: string }
        >({
            query: ({ workspaceId, memberUserId }) => ({
                url: `/workspace-members/${workspaceId}/${memberUserId}`,
                method: "DELETE"
            }),
            invalidatesTags: (_result, _error, { workspaceId }) => [
                { type: "Member", id: `LIST-${workspaceId}` },
                ACTIVITY_TAG
            ]
        })
    })
});

export const {
    useGetMembersQuery,
    useAddMemberMutation,
    useUpdateMemberRoleMutation,
    useRemoveMemberMutation
} = membersApi;
