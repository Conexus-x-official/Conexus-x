import { ACTIVITY_TAG, baseApi } from "../baseApi";
import type { RecordItem } from "../types";

export const recordsApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getRecords: build.query<RecordItem[], string>({
            query: (collectionId) => `/records/${collectionId}`,
            transformResponse: (response: { records?: RecordItem[] }) =>
                (response.records ?? []).filter(Boolean),
            providesTags: (result, _error, collectionId) => [
                { type: "Record" as const, id: `LIST-${collectionId}` },
                ...(result ?? []).map((r) => ({ type: "Record" as const, id: r._id }))
            ]
        }),

        createRecord: build.mutation<
            RecordItem,
            { collectionId: string; name: string }
        >({
            query: ({ collectionId, ...body }) => ({
                url: `/records/${collectionId}`,
                method: "POST",
                body
            }),
            transformResponse: (response: { record: RecordItem }) => response.record,
            // The bare Module tag marks the workspace card stats stale. Nothing is
            // subscribed to that list from here, so it costs no request now — it
            // just stops the cards showing a stale count on the way back.
            invalidatesTags: (_result, _error, { collectionId }) => [
                { type: "Record", id: `LIST-${collectionId}` },
                { type: "Module", id: "LIST" },
                ACTIVITY_TAG
            ]
        }),

        /**
         * One record's sub-records. Their own list, keyed by the parent, because
         * the board's record list deliberately never contains them.
         */
        getSubRecords: build.query<RecordItem[], string>({
            query: (parentRecordId) => `/records/${parentRecordId}/sub-records`,
            transformResponse: (response: { records?: RecordItem[] }) =>
                (response.records ?? []).filter(Boolean),
            providesTags: (result, _error, parentRecordId) => [
                { type: "Record" as const, id: `SUB-${parentRecordId}` },
                ...(result ?? []).map((r) => ({ type: "Record" as const, id: r._id }))
            ]
        }),

        createSubRecord: build.mutation<
            RecordItem,
            {
                parentRecordId: string;
                name: string;
                /** The parent's collection — its row carries the count that just changed. */
                collectionId: string;
                /** The first sub-record on a module seeds its sub-record columns. */
                moduleId: string;
            }
        >({
            query: ({ parentRecordId, name }) => ({
                url: `/records/${parentRecordId}/sub-records`,
                method: "POST",
                body: { name }
            }),
            transformResponse: (response: { record: RecordItem }) => response.record,
            invalidatesTags: (_result, _error, { parentRecordId, collectionId, moduleId }) => [
                { type: "Record", id: `SUB-${parentRecordId}` },
                // The parent row carries subRecordCount, so its list is now stale.
                { type: "Record", id: `LIST-${collectionId}` },
                // Seeding only happens once, but the client cannot know which
                // time that was — and the sub-column list is one small request.
                { type: "Column", id: `LIST-SUB-${moduleId}` },
                ACTIVITY_TAG
            ]
        }),

        updateRecord: build.mutation<
            RecordItem,
            {
                recordId: string;
                collectionId: string;
                name?: string;
                position?: number;
                /** "Starred", email style — toggled from any view. */
                isImportant?: boolean;
                /** Target collection id when the record is moved between groups. */
                collectionName?: string;
                /**
                 * Set when the row being edited is a sub-record: it lives in
                 * getSubRecords(parent), never in the collection list, so that
                 * is the cache entry to patch.
                 */
                parentRecordId?: string;
            }
        >({
            query: ({ recordId, collectionId: _collectionId, ...body }) => ({
                url: `/records/${recordId}`,
                method: "PUT",
                body
            }),
            async onQueryStarted(
                { recordId, collectionId, collectionName, parentRecordId, ...patch },
                { dispatch, queryFulfilled }
            ) {
                // Only patch in place for same-collection edits; a move changes two lists.
                if (collectionName && collectionName !== collectionId) {
                    return;
                }
                const patchResult = parentRecordId
                    ? dispatch(
                        recordsApi.util.updateQueryData(
                            "getSubRecords",
                            parentRecordId,
                            (draft) => {
                                const target = draft.find((r) => r._id === recordId);
                                if (target) Object.assign(target, patch);
                            }
                        )
                    )
                    : dispatch(
                        recordsApi.util.updateQueryData("getRecords", collectionId, (draft) => {
                            const target = draft.find((r) => r._id === recordId);
                            if (target) Object.assign(target, patch);
                        })
                    );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
            invalidatesTags: (_result, _error, { collectionId, collectionName }) =>
                collectionName && collectionName !== collectionId
                    ? [
                        { type: "Record" as const, id: `LIST-${collectionId}` },
                        { type: "Record" as const, id: `LIST-${collectionName}` },
                        ACTIVITY_TAG
                    ]
                    // A rename still writes an audit row even with no list to move.
                    : [ACTIVITY_TAG]
        }),

        deleteRecord: build.mutation<
            { message: string; archivedSubRecords?: number },
            {
                recordId: string;
                collectionId: string;
                /** Set when archiving a sub-record, so its parent's list refreshes. */
                parentRecordId?: string;
            }
        >({
            query: ({ recordId }) => ({ url: `/records/${recordId}`, method: "DELETE" }),
            // The collection list is invalidated either way: archiving a parent
            // takes its children with it, and archiving a child changes the
            // subRecordCount the parent row is drawn with.
            invalidatesTags: (_result, _error, { recordId, collectionId, parentRecordId }) => [
                { type: "Record", id: recordId },
                { type: "Record", id: `LIST-${collectionId}` },
                { type: "Record", id: `SUB-${parentRecordId ?? recordId}` },
                { type: "Module", id: "LIST" },
                ACTIVITY_TAG
            ]
        })
    })
});

export const {
    useGetRecordsQuery,
    useGetSubRecordsQuery,
    useCreateRecordMutation,
    useCreateSubRecordMutation,
    useUpdateRecordMutation,
    useDeleteRecordMutation
} = recordsApi;
