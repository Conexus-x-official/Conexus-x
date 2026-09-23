"use client";

import { useMemo, useState } from "react";
import { HiOutlineClock } from "react-icons/hi2";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useModuleRecords } from "@/store/useModuleData";
import { byUserOrder } from "@/lib/sortCollections";
import { COLLECTION_COLOR_PALETTE } from "@/data/data";
import {
    parseTimelineValue,
    computeRange,
    xFor,
    widthFor,
    totalWidth,
    monthMarkers,
    packRows,
} from "@/lib/timelineScale";
import ItemPicker from "@/components/views/ItemPicker";
import RecordAmendmentsPanel from "@/components/RecordAmendmentsPanel";
import type { RecordItem } from "@/store/types";

/**
 * The Timeline view: every SCHEDULED record as a bar on one continuous
 * horizontal day-axis, overlapping bars stacked into shared rows so it
 * reads as a bird's-eye scan of "what's happening when" rather than a tall
 * one-row-per-record list — for that shape, see GanttView, which trades the
 * packed rows for one row per record grouped under its collection.
 *
 * WHY A TIMELINE COLUMN: it is the one column type that already stores a
 * start AND end ({startDate,endDate} — see CollectionView's Cell "timeline"
 * branch), which is what "arranged along a time axis" needs; a plain "date"
 * column (Calendar view's column) names a single day, not a span.
 *
 * Records with no value for the picked column are counted but not drawn —
 * there is nowhere honest to place an unscheduled item on an axis — the
 * count is shown so nothing looks silently dropped.
 */

const columnStorageKey = (moduleId: string) => `timeline_column_${moduleId}`;

const readRemembered = (moduleId: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(columnStorageKey(moduleId));
    } catch {
        return null;
    }
};

interface ScheduledRecord {
    record: RecordItem;
    start: Date;
    end: Date;
}

export default function TimelineView({
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

    // Same effect-free remembered-pick shape as Kanban's group column /
    // Calendar's date column.
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

    const collectionColor = useMemo(() => {
        const map = new Map<string, string>();
        collections.forEach((c, i) => map.set(c._id, c.color || COLLECTION_COLOR_PALETTE[i % COLLECTION_COLOR_PALETTE.length]));
        return map;
    }, [collections]);

    const scheduled: ScheduledRecord[] = useMemo(() => {
        if (!timelineColumn) return [];

        const out: ScheduledRecord[] = [];
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

            out.push({ record, start: a <= b ? a : b, end: a <= b ? b : a });
        }
        return out;
    }, [records, recordValues, timelineColumn]);

    const range = useMemo(
        () => computeRange(scheduled.map((s) => ({ start: s.start, end: s.end }))),
        [scheduled]
    );

    const emptyState = (title: string, body: string) => (
        <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
            <div className="mr-8 mt-2 flex-1 rounded-md border border-dashed border-hairline bg-card/50 px-6 py-16 text-center font-google-sans">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                    <HiOutlineClock size={24} />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
            </div>
        </div>
    );

    if (!timelineColumn) {
        return emptyState(
            "Timeline needs a timeline column",
            "Add a timeline column from Collection view, then come back here — its start/end dates place records on the axis."
        );
    }

    const unscheduledCount = records.length - scheduled.length;

    if (!range) {
        return emptyState(
            "Nothing scheduled yet",
            `Set ${timelineColumn.name} on a record in Collection view to place it here.`
        );
    }

    const rows = packRows(scheduled, (s) => s.start, (s) => s.end);
    const markers = monthMarkers(range);
    const width = totalWidth(range);

    const now = new Date();
    const todayX = now >= range.start && now <= range.end ? xFor(now, range) : null;

    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const dayCount = (a: Date, b: Date) =>
        Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);

    // Collections that actually have a bar on screen — the colour legend.
    const legend = collections.filter((c) =>
        scheduled.some((s) => s.record.collectionName === c._id)
    );

    return (
        <div className="pl-8 pt-2 pb-4 flex-1 flex flex-col overflow-hidden font-google-sans">
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 pr-8">
                <h3 className="text-base font-bold text-foreground">Timeline</h3>
                {timelineColumns.length > 1 ? (
                    <ItemPicker
                        label="Scheduled by"
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
                    <span className="font-bold text-body">{scheduled.length}</span> scheduled
                    {unscheduledCount > 0 && <> · {unscheduledCount} not scheduled</>}
                </span>
                <span className="text-[11px] text-muted">
                    {fmt(range.start)} – {fmt(range.end)}
                </span>

                {legend.length > 1 && (
                    <span className="ml-auto flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {legend.map((c) => (
                            <span key={c._id} className="flex items-center gap-1 text-[10px] font-medium text-muted">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: collectionColor.get(c._id) }}
                                />
                                {c.name}
                            </span>
                        ))}
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto rounded-md border border-hairline [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                <div style={{ width }}>
                    {/* Month header — sticky the same way homesection.tsx's table headers are. */}
                    <div className="sticky top-0 z-10 h-8 border-b border-hairline bg-card">
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

                    <div className="relative py-2">
                        {markers.map((m) => (
                            <div
                                key={m.label}
                                className="absolute top-0 bottom-0 w-px bg-hairline"
                                style={{ left: m.x }}
                            />
                        ))}
                        {todayX !== null && (
                            <>
                                <div
                                    className="absolute top-0 bottom-0 z-[1] w-0.5 bg-red-500"
                                    style={{ left: todayX }}
                                />
                                <div
                                    className="absolute top-0 z-[2] -translate-x-1/2 rounded bg-red-500 px-1 py-px text-[9px] font-bold text-white"
                                    style={{ left: todayX }}
                                >
                                    TODAY
                                </div>
                            </>
                        )}

                        {rows.map((row, ri) => (
                            <div key={ri} className="relative h-10">
                                {row.map((item) => {
                                    const bar = widthFor(item.start, item.end);
                                    const days = dayCount(item.start, item.end);
                                    const collName = collections.find(
                                        (c) => c._id === item.record.collectionName
                                    )?.name;
                                    return (
                                        <button
                                            key={item.record._id}
                                            type="button"
                                            onClick={() => setAmendmentsRecord(item.record)}
                                            title={`${item.record.name}${collName ? ` · ${collName}` : ""}\n${fmt(item.start)} – ${fmt(item.end)} · ${days} day${days === 1 ? "" : "s"}`}
                                            className="group absolute top-1.5 flex h-7 items-center gap-2 overflow-hidden rounded px-2 text-left text-[11px] font-semibold text-white shadow-sm transition hover:brightness-95 cursor-pointer"
                                            style={{
                                                left: xFor(item.start, range),
                                                width: bar,
                                                backgroundColor:
                                                    collectionColor.get(item.record.collectionName) || "#94A3B8",
                                            }}
                                        >
                                            <span className="min-w-0 flex-1 truncate">{item.record.name}</span>
                                            {bar > 130 && (
                                                <span className="shrink-0 text-[10px] font-medium text-white/85">
                                                    {fmt(item.start)} – {fmt(item.end)}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
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
