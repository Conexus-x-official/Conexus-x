"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { useAppDispatch } from "./hooks";
import { ACTIVITY_TAG, baseApi } from "./baseApi";
import { useGetActivityQuery, type ActivityEntry } from "./api/activity.api";

/**
 * Announces automation runs and refreshes what they touched.
 *
 * The engine runs detached from the write that triggered it — deliberately, so
 * a recipe can never delay or fail a user's edit — which means nothing comes
 * back in the response to say a record was moved or a cell rewritten. Without
 * this the board simply looked stale until a reload.
 *
 * READS THE ACTIVITY LOG, not a run log of its own. A run IS an activity row
 * (the engine stamps metadata.automation on it), so `source=automation` is the
 * whole difference between this and the feed the activity page draws. There was
 * briefly a second endpoint returning the same rows in a different shape; it
 * was deleted, because two read paths over one store is how the two drift.
 *
 * NO LONGER POLLS. Every activity row is pushed the moment it is written (the
 * emit lives in logActivity itself, so it covers the engine as well as every
 * controller), and this query's ACTIVITY tag is invalidated by the socket
 * bridge — so the same cache entry refills on the same trigger it always did,
 * just on a push instead of a 10s timer. The announce-once logic below is
 * unchanged and still needed: an invalidated refetch returns the same rows
 * repeatedly, exactly as a poll did.
 */

/** Enough to catch a bulk edit's worth of runs between two polls. */
const PAGE = 15;

export function useAutomationRuns(workspaceId: string, moduleId: string) {
    const dispatch = useAppDispatch();

    /** Row ids already announced — a poll returns the same rows repeatedly. */
    const announced = useRef<Set<string>>(new Set());

    /** Which module `announced` belongs to, so switching modules starts clean. */
    const primedFor = useRef<string | null>(null);

    const { data } = useGetActivityQuery(
        { workspaceId, moduleId, source: "automation", limit: PAGE },
        { skip: !workspaceId || !moduleId }
    );

    useEffect(() => {
        if (!moduleId || !data) return;

        const runs: ActivityEntry[] = data.activities ?? [];

        // The first payload is history, not news: remember it silently, or every
        // visit would open with a burst of toasts for runs from last week.
        if (primedFor.current !== moduleId) {
            announced.current = new Set(runs.map((run) => run._id));
            primedFor.current = moduleId;
            return;
        }

        const fresh = runs.filter((run) => !announced.current.has(run._id));

        if (fresh.length === 0) return;

        fresh.forEach((run) => announced.current.add(run._id));

        if (fresh.length <= 2) {
            fresh.forEach((run) =>
                toast.success(
                    `${run.automation?.name ?? "An automation"} ran`,
                    // The server already stripped the recipe's name off the
                    // front of this, so the toast title and body do not repeat.
                    run.message || undefined
                )
            );
        } else {
            // A bulk edit can trigger a dozen at once; one line beats twelve.
            toast.success(
                `${fresh.length} automations ran`,
                "This module has been updated"
            );
        }

        /**
         * An action can move a record, rewrite a cell, archive or complete one —
         * so the safe move is to mark those resource types stale wholesale and
         * let RTK Query refetch only what something is actually subscribed to.
         */
        dispatch(
            baseApi.util.invalidateTags([
                "Record",
                "RecordValue",
                "Collection",
                "Automation",
                ACTIVITY_TAG
            ])
        );
    }, [data, moduleId, dispatch]);
}
