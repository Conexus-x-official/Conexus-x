"use client";

import { useMemo, useState } from "react";
import { HiOutlineChartBarSquare } from "react-icons/hi2";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useGetMembersQuery } from "@/store/api/members.api";
import { useModuleRecords } from "@/store/useModuleData";
import { byUserOrder } from "@/lib/sortCollections";
import { COLLECTION_COLOR_PALETTE } from "@/data/data";
import { PersonAvatar, memberUserId, parsePeopleValue } from "@/components/ui/helpers/personCell";
import {
    parseTimelineValue,
    computeRange,
    xFor,
    widthFor,
    totalWidth,
    monthMarkers,
} from "@/lib/timelineScale";
import ItemPicker from "@/components/views/ItemPicker";
import RecordAmendmentsPanel from "@/components/RecordAmendmentsPanel";
import type { Collection, RecordItem } from "@/store/types";

/**
 * The Gantt view: every record, grouped under its collection like a
 * project's task list, one row per record with a duration bar sized from a
 * "timeline" column's {startDate,endDate} — the project-management shape
 * ("projects/tasks with duration"), as opposed to TimelineView's ungrouped,
 * packed-row bird's-eye scan of the same kind of data. Shares its date-axis
 * math with TimelineView via lib/timelineScale.ts rather than duplicating it.
 *
 * DEPENDENCIES ARE DELIBERATELY NOT DRAWN. monday's own "dependency" column
 * type is one this codebase does not implement (see backend reference.md's
 * column type catalog — "dependency|-"), and there is no other field that
 * unambiguously means "blocks/blocked by": a relation column could point
 * anywhere for any reason, and drawing an arrow from one would assert a
 * relationship the data does not actually claim. Every other view in this
 * set only offers what a real column backs (Kanban: status only, Calendar:
 * date only) — this is the same rule applied to Gantt's second half. If a
 * real dependency model is ever added, the connector lines belong here.
 *
 * Records with no value for the picked column still get a row (so the task
 * list is never missing anything), just no bar.
 */

const LABEL_WIDTH = 264;
/** Chart width when nothing is scheduled yet — enough to look like a chart, not a sliver. */
const EMPTY_CHART_WIDTH = 900;
const columnStorageKey = (moduleId: string) => `gantt_column_${moduleId}`;

const readRemembered = (moduleId: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(columnStorageKey(moduleId));
    } catch {
        return null;
    }
};

export default function GanttView({
    workspaceId,
    moduleId,
}: {
    workspaceId: string;
    moduleId: string;
}) {
    const { data: collectionsData = [] } = useGetCollectionsQuery(moduleId, { skip: !moduleId });
    const collections = useMemo(() => [...collectionsData].sort(byUserOrder), [collectionsData]);
    const collectionIds = useMemo(() => collections.map((c) => c._id), [collections]);

    const { records, recordValues } = useModuleRecords(collectionIds);

    const { data: columns = [] } = useGetColumnsQuery(moduleId, { skip: !moduleId });
    const timelineColumns = useMemo(
        () => columns.filter((c) => c.type === "timeline" && c.scope !== "subrecord"),
        [columns]
    );
    const personColumn = useMemo(
        () => columns.find((c) => (c.type === "person" || c.type === "people") && c.scope !== "subrecord"),
        [columns]
    );

    const { data: workspaceMembers = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });

    const assigneesOf = (record: RecordItem) => {
        if (!personColumn) return [];
        const rv = recordValues.find(
            (v) =>
                v.record === record._id &&
                (typeof v.column === "string" ? v.column : v.column._id) === personColumn._id
        );
        return parsePeopleValue(rv?.value)
            .map((id) => workspaceMembers.find((m) => memberUserId(m) === id))
            .filter((m): m is (typeof workspaceMembers)[number] => Boolean(m));
    };

    const [pickedColumnId, setPickedColumnId] = useState<string | null>(null);
    const remembered = readRemembered(moduleId);

    const timelineColumn =
        (pickedColumnId ? timelineColumns.find((c) => c._id === pickedColumnId) : undefined) ??
        (remembered ? timelineColumns.find((c) => c._id === remembered) : undefined) ??
        timelineColumns[0] ??
        null;

    const selectColumn = (id: string) => {
        setPickedColumnId(id);
        try {
            localStorage.setItem(columnStorageKey(moduleId), id);
        } catch {
            // Private browsing / storage disabled — the pick still applies for
            // this session, it just will not be remembered.
        }
    };

    const [amendmentsRecord, setAmendmentsRecord] = useState<RecordItem | null>(null);

    const spanOf = useMemo(() => {
        const map = new Map<string, { start: Date; end: Date }>();
        if (!timelineColumn) return map;

        for (const record of records) {
            const rv = recordValues.find(
                (v) =>
                    v.record === record._id &&
                    (typeof v.column === "string" ? v.column : v.column._id) === timelineColumn._id
            );
            const parsed = parseTimelineValue(rv?.value);
            if (!parsed) continue;

            const a = new Date(parsed.startDate);
            const b = new Date(parsed.endDate);
            if (isNaN(a.getTime()) || isNaN(b.getTime())) continue;

            map.set(record._id, { start: a <= b ? a : b, end: a <= b ? b : a });
        }
        return map;
    }, [records, recordValues, timelineColumn]);

    const range = useMemo(() => computeRange([...spanOf.values()]), [spanOf]);

    const recordsByCollection = useMemo(() => {
        const map = new Map<string, RecordItem[]>();
        for (const record of records) {
            const list = map.get(record.collectionName) ?? [];
            list.push(record);
            map.set(record.collectionName, list);
        }
        for (const list of map.values()) list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return map;
    }, [records]);

    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const dayCount = (a: Date, b: Date) =>
        Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);

    if (!timelineColumn) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-md border border-dashed border-hairline bg-card/50 px-6 py-16 text-center font-google-sans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlineChartBarSquare size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Gantt needs a timeline column
                    </h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Add a timeline column from Collection view, then come back here — its
                        start/end dates size each task&apos;s bar.
                    </p>
                </div>
            </div>
        );
    }

    const markers = range ? monthMarkers(range) : [];
    const chartWidth = range ? totalWidth(range) : EMPTY_CHART_WIDTH;
    const now = new Date();
    const todayX = range && now >= range.start && now <= range.end ? xFor(now, range) : null;
    const scheduledCount = spanOf.size;

    const collectionColor = (collection: Collection, index: number) =>
        collection.color || COLLECTION_COLOR_PALETTE[index % COLLECTION_COLOR_PALETTE.length];

    return (
        <div className="pl-8 pt-2 pb-4 flex-1 flex flex-col overflow-hidden font-google-sans">
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 pr-8">
                <h3 className="text-base font-bold text-foreground">Gantt</h3>
                {timelineColumns.length > 1 ? (
                    <ItemPicker
                        label="Sized by"
                        heading="Timeline column"
                        items={timelineColumns}
                        active={timelineColumn}
                        onChange={selectColumn}
                    />
                ) : (
                    <span className="text-xs text-muted">
                        By <span className="font-semibold text-body">{timelineColumn.name}</span>
                    </span>
                )}
                <span className="text-[11px] text-muted">
                    <span className="font-bold text-body">{scheduledCount}</span> of {records.length} scheduled
                </span>
                {range && (
                    <span className="text-[11px] text-muted">
                        {fmt(range.start)} – {fmt(range.end)}
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto rounded-md border border-hairline [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                <div className="relative" style={{ width: LABEL_WIDTH + chartWidth }}>
                    {/* Frozen header: sticky to the top of the scroll container, its
                        own left cell ALSO sticky-left within that row — the classic
                        nested-sticky recipe for a frozen corner. */}
                    <div className="sticky top-0 z-20 flex h-8 border-b border-hairline bg-card">
                        <div
                            className="sticky left-0 z-10 flex shrink-0 items-center border-r border-hairline bg-card px-2 text-[10px] font-bold uppercase tracking-wider text-muted"
                            style={{ width: LABEL_WIDTH }}
                        >
                            Task
                        </div>
                        <div className="relative shrink-0" style={{ width: chartWidth }}>
                            {markers.map((m) => (
                                <div
                                    key={m.label}
                                    className="absolute top-0 flex h-full items-center border-l border-hairline pl-2 text-[10px] font-bold uppercase tracking-wider text-muted"
                                    style={{ left: m.x }}
                                >
                                    {m.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {collections.map((collection, index) => {
                        const collectionRecords = recordsByCollection.get(collection._id) ?? [];
                        const color = collectionColor(collection, index);

                        return (
                            <div key={collection._id}>
                                {/* Section heading — spans the full row, not split
                                    into label/chart, so it reads as one banner. */}
                                <div
                                    className="flex items-center border-b border-hairline bg-control/60 py-1.5"
                                    style={{ width: LABEL_WIDTH + chartWidth }}
                                >
                                    <span className="sticky left-0 z-20 flex items-center gap-2 bg-control/60 pl-2 pr-3">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="truncate text-xs font-bold uppercase tracking-wide" style={{ color }}>
                                            {collection.name}
                                        </span>
                                        <span className="rounded-full bg-card px-1.5 text-[10px] font-bold text-muted tabular-nums">
                                            {collectionRecords.length}
                                        </span>
                                    </span>
                                </div>

                                {collectionRecords.map((record) => {
                                    const span = spanOf.get(record._id);
                                    const days = span ? dayCount(span.start, span.end) : 0;
                                    const barW = span && range ? widthFor(span.start, span.end) : 0;
                                    const assignees = assigneesOf(record);

                                    return (
                                        <div
                                            key={record._id}
                                            className="group flex border-b border-hairline transition-colors hover:bg-control/25"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setAmendmentsRecord(record)}
                                                title={record.name}
                                                className="sticky left-0 z-20 flex h-11 shrink-0 items-center gap-2 border-r border-hairline bg-card px-2 text-left transition group-hover:bg-control/25 cursor-pointer"
                                                style={{ width: LABEL_WIDTH }}
                                            >
                                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                    <span className="truncate text-xs font-semibold text-body">
                                                        {record.name}
                                                    </span>
                                                    <span className="truncate text-[10px] text-muted">
                                                        {span ? `${fmt(span.start)} – ${fmt(span.end)} · ${days}d` : "Not scheduled"}
                                                    </span>
                                                </span>

                                                {assignees.length > 0 && (
                                                    <span className="flex shrink-0 items-center -space-x-1.5">
                                                        {assignees.slice(0, 3).map((m) => (
                                                            <PersonAvatar
                                                                key={memberUserId(m)}
                                                                member={m}
                                                                size={18}
                                                                showPresence
                                                            />
                                                        ))}
                                                        {assignees.length > 3 && (
                                                            <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-control text-[8px] font-semibold text-muted ring-2 ring-card">
                                                                +{assignees.length - 3}
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                            </button>

                                            <div className="relative h-11 shrink-0" style={{ width: chartWidth }}>
                                                {markers.map((m) => (
                                                    <div
                                                        key={m.label}
                                                        className="absolute top-0 bottom-0 w-px bg-hairline"
                                                        style={{ left: m.x }}
                                                    />
                                                ))}

                                                {span && range && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAmendmentsRecord(record)}
                                                        title={`${record.name}\n${fmt(span.start)} – ${fmt(span.end)} · ${days} day${days === 1 ? "" : "s"}`}
                                                        className="absolute top-2 flex h-7 items-center overflow-hidden rounded px-2 text-[10px] font-semibold text-white shadow-sm transition hover:brightness-95 cursor-pointer"
                                                        style={{
                                                            left: xFor(span.start, range),
                                                            width: barW,
                                                            backgroundColor: color,
                                                        }}
                                                    >
                                                        {barW > 90 && (
                                                            <span className="truncate">{days}d</span>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* ONE continuous "now" line over every row, section band and
                        bar — drawn once here (a child of the relative wrapper),
                        not per-row, so it never breaks at a section heading.
                        z-[15] sits above the content but below the frozen header
                        (z-20) and the sticky Task column (z-20). Starts at 32px,
                        just under the h-8 header. */}
                    {todayX !== null && (
                        <>
                            <div
                                className="pointer-events-none absolute z-[15] w-0.5 bg-red-500"
                                style={{ left: LABEL_WIDTH + todayX, top: 32, bottom: 0 }}
                            />
                            <div
                                className="pointer-events-none absolute z-[15] -translate-x-1/2 whitespace-nowrap rounded bg-red-500 px-1 py-px text-[9px] font-bold text-white shadow"
                                style={{ left: LABEL_WIDTH + todayX, top: 33 }}
                            >
                                TODAY
                            </div>
                        </>
                    )}
                </div>
            </div>

            <RecordAmendmentsPanel
                key={amendmentsRecord?._id ?? "closed"}
                record={amendmentsRecord}
                workspaceId={workspaceId}
                collectionId={amendmentsRecord?.collectionName ?? ""}
                onClose={() => setAmendmentsRecord(null)}
            />
        </div>
    );
}
