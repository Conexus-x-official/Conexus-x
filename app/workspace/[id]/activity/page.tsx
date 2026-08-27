"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRealtimeRoom } from "@/store/useRealtimeRoom";
import { TbHistory } from "react-icons/tb";
import { HiOutlineArrowLeft, HiOutlineBolt, HiOutlineUser } from "react-icons/hi2";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

import { ActivityRow, ACTIVITY_REVERTED_EVENT } from "@/components/ActivityFeed";

import { useGetWorkspaceQuery } from "@/store/api/workspaces.api";
import {
    useLazyGetActivityQuery,
    type ActivityEntry
} from "@/store/api/activity.api";

/** One request per "Load more" press. */
const PAGE_SIZE = 40;

type SourceFilter = "all" | "automation" | "person";

/**
 * Automation runs are rows in THIS log — the engine writes an ordinary activity
 * row stamped with the recipe that wrote it. So "what have my automations
 * done?" is this feed with one filter on, not a second screen somewhere else.
 */
const SOURCES: {
    value: SourceFilter;
    label: string;
    icon?: typeof HiOutlineBolt;
}[] = [
        { value: "all", label: "Everything" },
        { value: "automation", label: "By automation", icon: HiOutlineBolt },
        { value: "person", label: "By people", icon: HiOutlineUser }
    ];


function ActivityPageBody() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const workspaceId = params.id as string;

    useRealtimeRoom({ workspaceId });

    // The drawer passes the path it was opened over, so "back" returns to the
    // exact board rather than guessing. Only same-origin paths are honoured.
    const rawFrom = searchParams.get("from");
    const backHref =
        rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
            ? rawFrom
            : `/workspace/${workspaceId}`;

    const backLabel = backHref.includes("/module/")
        ? "Back to board"
        : backHref.includes("/automation")
            ? "Back to automations"
            : "Back to workspace";

    const { data: workspace } = useGetWorkspaceQuery(workspaceId, { skip: !workspaceId });

    /**
     * Who did it: everyone, the engine, or people only.
     *
     * Seeded from ?source= so the automation page can link straight to its own
     * runs — that link is the whole reason automations do not need a feed of
     * their own. A value we do not recognise falls back to "all" rather than
     * showing an empty list nobody asked for.
     */
    const sourceParam = searchParams.get("source");
    const [source, setSource] = useState<SourceFilter>(
        sourceParam === "automation" || sourceParam === "person" ? sourceParam : "all"
    );

    // Keyset pagination: the list accumulates locally because each page is a
    // distinct cache entry keyed by its cursor, not one growing entry.
    const [fetchActivity, { isFetching }] = useLazyGetActivityQuery();
    const [entries, setEntries] = useState<ActivityEntry[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [retentionDays, setRetentionDays] = useState(0);
    const [failed, setFailed] = useState(false);
    const [loadedOnce, setLoadedOnce] = useState(false);

    const load = useCallback(
        async (before?: string) => {
            if (!workspaceId) return;
            setFailed(false);

            try {
                // forceRefetch: this page is the source of truth for the audit
                // trail, so it always re-reads rather than serving a cached page.
                const page = await fetchActivity(
                    {
                        workspaceId,
                        limit: PAGE_SIZE,
                        before,
                        source: source === "all" ? undefined : source
                    },
                    false
                ).unwrap();

                setEntries((prev) =>
                    before ? [...prev, ...page.activities] : page.activities
                );
                setCursor(page.nextCursor);
                setHasMore(page.hasMore);
                setRetentionDays(page.retentionDays);
            } catch {
                setFailed(true);
            } finally {
                setLoadedOnce(true);
            }
        },
        // `source` is a dependency, so changing the filter reloads from the top
        // — paging into a cursor taken under a different filter would interleave
        // two different lists.
        [workspaceId, fetchActivity, source]
    );

    useEffect(() => {
        void load();
    }, [load]);

    // A revert rewrites history; this list is local state, so reload it from
    // the top rather than trying to patch the row in place.
    useEffect(() => {
        const onReverted = () => void load();
        window.addEventListener(ACTIVITY_REVERTED_EVENT, onReverted);
        return () => window.removeEventListener(ACTIVITY_REVERTED_EVENT, onReverted);
    }, [load]);

    return (
        <section className="min-h-screen bg-canvas font-dmsans">
            <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">

                {/* Back — the only navigation on this page */}
                <button
                    onClick={() => router.push(backHref)}
                    className="mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-sm font-medium text-slate-600 transition hover:bg-control/60 hover:text-slate-900 cursor-pointer"
                >
                    <HiOutlineArrowLeft className="h-4 w-4" />
                    {backLabel}
                </button>

                {/* Title */}
                <div className="mb-6 flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <TbHistory className="h-5 w-5" />
                    </span>

                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-slate-900">
                            Activity log
                        </h1>
                        <p className="mt-0.5 text-xs text-muted">
                            {workspace?.name ? `${workspace.name} · ` : ""}
                            {entries.length === 0
                                ? "nothing recorded yet"
                                : `${entries.length} change${entries.length === 1 ? "" : "s"}${hasMore ? " so far" : ""}`}
                            {retentionDays ? ` · kept for ${retentionDays} days` : ""}
                        </p>
                    </div>
                </div>

                {/* Who did it. Three states, because "only what I did by hand"
                    is as real a question as "only what ran on its own". */}
                <div className="mb-4 inline-flex gap-1 rounded-xl border border-hairline bg-card p-1">
                    {SOURCES.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setSource(option.value)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${source === option.value
                                ? "bg-accent text-white"
                                : "text-muted hover:bg-control hover:text-slate-900"
                                }`}
                        >
                            {option.icon && <option.icon className="h-3.5 w-3.5" />}
                            {option.label}
                        </button>
                    ))}
                </div>

                {!loadedOnce ? (
                    <div className="space-y-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="h-14 rounded-xl bg-control animate-pulse"
                                style={{ animationDelay: `${i * 90}ms` }}
                            />
                        ))}
                    </div>
                ) : failed ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center">
                        <p className="text-sm text-muted">
                            Could not load the activity log.
                        </p>
                        <button
                            onClick={() => void load()}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover cursor-pointer"
                        >
                            Try again
                        </button>
                    </div>
                ) : entries.length === 0 ? (
                    /* Empty state (LAYOUT.md §7) */
                    <div className="rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-20 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <TbHistory className="h-6 w-6" />
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900">
                            No activity yet
                        </h3>

                        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                            Every change to a board, collection or record is recorded here —
                            who made it, where, and what it was before.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-card divide-y divide-hairline">
                            {entries.map((entry) => (
                                <ActivityRow key={entry._id} entry={entry} workspaceId={workspaceId} />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="mt-4 flex justify-center">
                                <button
                                    onClick={() => void load(cursor ?? undefined)}
                                    disabled={isFetching}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-card px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-control disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                >
                                    {isFetching && (
                                        <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    {isFetching ? "Loading…" : "Load more"}
                                </button>
                            </div>
                        )}

                        {!hasMore && retentionDays > 0 && (
                            <p className="mt-4 text-center text-[11px] text-muted">
                                That is everything from the last {retentionDays} days.
                            </p>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

export default function ActivityPage() {
    // useSearchParams needs a Suspense boundary to prerender.
    return (
        <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
            <ActivityPageBody />
        </Suspense>
    );
}
