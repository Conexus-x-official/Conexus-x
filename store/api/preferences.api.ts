import { baseApi } from "../baseApi";

/** What the account remembers about how this person has set the app up. */
export interface UserPreferences {
    sidebarCollapsed?: boolean;
}

export const preferencesApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        /**
         * A PARTIAL write: send only what changed. The server merges, so a
         * client that predates the next preference cannot blank it by omission.
         *
         * Deliberately invalidates NOTHING. Nothing in the cache is derived
         * from a preference — the UI reading it is driven by the local user
         * copy in lib/auth.ts, which the caller patches optimistically — so an
         * invalidation here would refetch lists for a change none of them can
         * see.
         */
        updatePreferences: build.mutation<
            { message: string; preferences: UserPreferences },
            UserPreferences
        >({
            query: (body) => ({
                url: "/auth/preferences",
                method: "PATCH",
                body
            })
        })
    })
});

export const { useUpdatePreferencesMutation } = preferencesApi;
