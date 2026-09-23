import { ACTIVITY_TAG, baseApi } from "../baseApi";
import { recordsApi } from "./records.api";
import type { RecordAmendment } from "../types";

/**
 * Amendments — the conversation on one record.
 *
 * The count shown on each row rides along on the record list as
 * `amendmentCount`, exactly as `subRecordCount` does, so a board of thirty rows
 * costs no requests until someone actually opens a panel. That is also why the
 * writes below patch that number in place instead of invalidating the record
 * list: refetching a whole collection to change one digit is the expensive way
 * to be correct.
 */

/**
 * Nudges the count on the row the panel was opened from.
 *
 * A SUB-record lives in getSubRecords(parent), never in the collection list, so
 * the parent has to be carried here — patching the collection list for one
 * would silently find nothing and leave its bubble stale. Same rule the record
 * mutations follow.
 */
const patchCount = (
    args: { collectionId?: string; parentRecordId?: string | null },
    recordId: string,
    delta: number
) => {
    const bump = (row: { amendmentCount?: number } | undefined) => {
        if (row) row.amendmentCount = Math.max(0, (row.amendmentCount ?? 0) + delta);
    };

    if (args.parentRecordId) {
        return recordsApi.util.updateQueryData(
            "getSubRecords",
            args.parentRecordId,
            (draft) => bump(draft.find((r) => r._id === recordId))
        );
    }

    if (!args.collectionId) return null;

    return recordsApi.util.updateQueryData(
        "getRecords",
        args.collectionId,
        (draft) => bump(draft.find((r) => r._id === recordId))
    );
};

export const amendmentsApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getRecordAmendments: build.query<RecordAmendment[], string>({
            query: (recordId) => `/amendments/${recordId}`,
            transformResponse: (response: { amendments?: RecordAmendment[] }) =>
                (response.amendments ?? []).filter(Boolean),
            providesTags: (_result, _error, recordId) => [
                { type: "Amendment" as const, id: recordId }
            ]
        }),

        createAmendment: build.mutation<
            RecordAmendment,
            {
                recordId: string;
                message: string;
                /** Set on a reply — the amendment being answered. */
                parentComment?: string;
                /** The row's collection, so its count can be patched in place. */
                collectionId?: string;
                /** Set when the row is a sub-record — see patchCount. */
                parentRecordId?: string | null;
                /** User ids picked via @-autocomplete — see GrowingTextarea. */
                mentions?: string[];
            }
        >({
            query: ({ recordId, message, parentComment, mentions }) => ({
                url: `/amendments/${recordId}`,
                method: "POST",
                body: { message, parentComment, mentions }
            }),
            transformResponse: (response: { amendment: RecordAmendment }) =>
                response.amendment,
            async onQueryStarted(
                { recordId, collectionId, parentRecordId },
                { dispatch, queryFulfilled }
            ) {
                // Applied only once the write lands: unlike a cell edit there is
                // no local id to render against, so an optimistic bump would
                // just have to be undone a moment later.
                try {
                    await queryFulfilled;
                    const patch = patchCount({ collectionId, parentRecordId }, recordId, 1);
                    if (patch) dispatch(patch);
                } catch {
                    /* the toast raised by the caller is the report */
                }
            },
            invalidatesTags: (_result, _error, { recordId }) => [
                { type: "Amendment", id: recordId },
                ACTIVITY_TAG
            ]
        }),

        updateAmendment: build.mutation<
            RecordAmendment,
            { amendmentId: string; recordId: string; message: string }
        >({
            query: ({ amendmentId, message }) => ({
                url: `/amendments/${amendmentId}`,
                method: "PUT",
                body: { message }
            }),
            transformResponse: (response: { amendment: RecordAmendment }) =>
                response.amendment,
            async onQueryStarted(
                { amendmentId, recordId, message },
                { dispatch, queryFulfilled }
            ) {
                const patchResult = dispatch(
                    amendmentsApi.util.updateQueryData(
                        "getRecordAmendments",
                        recordId,
                        (draft) => {
                            const target = draft.find((a) => a._id === amendmentId);
                            if (target) {
                                target.message = message;
                                target.edited = true;
                            }
                        }
                    )
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            }
            // No invalidatesTags at all: the patch above IS the whole change,
            // an edit never moves the count, and the server writes no activity
            // row for one — so there is nothing anywhere else to refresh.
        }),

        deleteAmendment: build.mutation<
            { message: string },
            {
                amendmentId: string;
                recordId: string;
                collectionId?: string;
                /** Set when the row is a sub-record — see patchCount. */
                parentRecordId?: string | null;
            }
        >({
            query: ({ amendmentId }) => ({
                url: `/amendments/${amendmentId}`,
                method: "DELETE"
            }),
            async onQueryStarted(
                { recordId, collectionId, parentRecordId },
                { dispatch, queryFulfilled }
            ) {
                try {
                    await queryFulfilled;
                    // Always exactly one: replies outlive their parent, so a
                    // delete can never take more than the row it was fired on.
                    const patch = patchCount({ collectionId, parentRecordId }, recordId, -1);
                    if (patch) dispatch(patch);
                } catch {
                    /* the toast raised by the caller is the report */
                }
            },
            invalidatesTags: (_result, _error, { recordId }) => [
                { type: "Amendment", id: recordId },
                ACTIVITY_TAG
            ]
        })
    })
});

export const {
    useGetRecordAmendmentsQuery,
    useCreateAmendmentMutation,
    useUpdateAmendmentMutation,
    useDeleteAmendmentMutation
} = amendmentsApi;
