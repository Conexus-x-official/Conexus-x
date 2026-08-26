import { baseApi } from "../baseApi";
import type { Workspace } from "../types";

interface MembershipRow {
    workspace?: Workspace | null;
}

export const workspacesApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getWorkspaces: build.query<Workspace[], void>({
            query: () => "/workspaces",
            // The API nests each workspace inside its membership row.
            transformResponse: (response: { workspaces?: MembershipRow[] }) =>
                (response.workspaces ?? [])
                    .map((row) => row.workspace)
                    .filter((ws): ws is Workspace => Boolean(ws))
                    .map((ws) => ({ ...ws, totalModules: ws.totalModules ?? 0 })),
            providesTags: (result) => [
                { type: "Workspace" as const, id: "LIST" },
                ...(result ?? []).map((ws) => ({ type: "Workspace" as const, id: ws._id }))
            ]
        }),

        getWorkspace: build.query<Workspace, string>({
            query: (id) => `/workspaces/${id}`,
            transformResponse: (response: { workspace: Workspace }) => response.workspace,
            providesTags: (_result, _error, id) => [{ type: "Workspace", id }]
        }),

        createWorkspace: build.mutation<Workspace, { name: string; icon?: string }>({
            query: (body) => ({ url: "/workspaces", method: "POST", body }),
            transformResponse: (response: { workspace: Workspace }) => response.workspace,
            invalidatesTags: [{ type: "Workspace", id: "LIST" }]
        }),

        updateWorkspace: build.mutation<Workspace, { id: string; name?: string; description?: string; icon?: string; banner?: string }>({
            query: ({ id, ...body }) => ({ url: `/workspaces/${id}`, method: "PUT", body }),
            transformResponse: (response: { workspace: Workspace }) => response.workspace,
            invalidatesTags: (_result, _error, { id }) => [
                { type: "Workspace", id },
                { type: "Workspace", id: "LIST" }
            ]
        }),

        deleteWorkspace: build.mutation<{ message: string }, string>({
            query: (id) => ({ url: `/workspaces/${id}`, method: "DELETE" }),
            invalidatesTags: (_result, _error, id) => [
                { type: "Workspace", id },
                { type: "Workspace", id: "LIST" }
            ]
        })
    })
});

export const {
    useGetWorkspacesQuery,
    useGetWorkspaceQuery,
    useCreateWorkspaceMutation,
    useUpdateWorkspaceMutation,
    useDeleteWorkspaceMutation
} = workspacesApi;
