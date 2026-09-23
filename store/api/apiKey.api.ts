import { baseApi } from "../baseApi";

export interface PitKeyInfo {
    apiKey: string | null;
    /** ISO timestamp — when the key may next be regenerated. Can be in the past. */
    nextAllowedAt: string | null;
}

const toPitKeyInfo = (response: { apiKey?: string | null; nextAllowedAt?: string | null }): PitKeyInfo => ({
    apiKey: response.apiKey ?? null,
    nextAllowedAt: response.nextAllowedAt ?? null
});

export const apiKeyApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getApiKey: build.query<PitKeyInfo, void>({
            query: () => "/api-key",
            transformResponse: toPitKeyInfo
        }),

        generateApiKey: build.mutation<PitKeyInfo, void>({
            query: () => ({ url: "/api-key/generate", method: "POST" }),
            transformResponse: toPitKeyInfo,
            // Write the new key straight into the cache — no follow-up GET.
            async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    dispatch(
                        apiKeyApi.util.updateQueryData("getApiKey", undefined, () => data)
                    );
                } catch {
                    // the mutation hook surfaces the error to the caller
                }
            }
        })
    })
});

export const { useGetApiKeyQuery, useGenerateApiKeyMutation } = apiKeyApi;
