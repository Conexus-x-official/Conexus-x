"use client";

import { useMemo, useState } from "react";
import { HiOutlineSquares2X2 } from "react-icons/hi2";
import { MdOutlineTipsAndUpdates } from "react-icons/md";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useModuleRecords } from "@/store/useModuleData";
import { useGetMembersQuery } from "@/store/api/members.api";
import { useGetModuleReferencesQuery } from "@/store/api/references.api";
import { DEFAULT_STATUS_OPTIONS, COLLECTION_COLOR_PALETTE } from "@/data/data";
import { PersonAvatar, memberUserId, parsePeopleValue } from "@/components/ui/helpers/personCell";
import { StarRow, parseRating } from "@/components/ui/helpers/ratingCell";
import { parseTimelineValue } from "@/lib/timelineScale";
import { byUserOrder } from "@/lib/sortCollections";
import RecordAmendmentsPanel from "@/components/RecordAmendmentsPanel";
import type { Column, Member, RecordItem, RecordValue } from "@/store/types";

/**
 * The Grid view: every record, every column, one flat spreadsheet-shaped
 * table — no collection grouping (that is Collection view's own shape), no
 * drag-and-drop, no inline editing. READ-ONLY, like every other projection
 * view in this set (List, Kanban's cards, Timeline/Gantt's bars) — the one
 * place a cell value actually changes is Collection view, and duplicating
 * its ~650-line interactive Cell renderer here (status popover, file
 * upload, the timeline picker...) to make this one editable too would be a
 * second editor for the same data rather than a second way to LOOK at it,
 * which is what every view past Collection has deliberately stayed.
 *
 * Row order matches every other flattened view — collections in board order
 * (byUserOrder), records by position within — so this reads as "the board,
 * every column wide" rather than a view with its own sort a user has to
 * re-learn.
 */

const columnValueFor = (recordValues: RecordValue[], recordId: string, columnId: string) =>
    recordValues.find(
        (v) => v.record === recordId && (typeof v.column === "string" ? v.column : v.column._id) === columnId
    )?.value;

function GridCell({
    column,
    value,
    references,
    workspaceMembers,
}: {
    column: Column;
    value: unknown;
    references?: { display?: string };
    workspaceMembers: Member[];
}) {
    if (column.type === "status") {
        const label = typeof value === "string" ? value : (value as { label?: string } | undefined)?.label;
        const option = label
            ? (column.statusOptions?.length ? column.statusOptions : DEFAULT_STATUS_OPTIONS).find(
                (o) => o.label === label
            )
            : undefined;

        if (!option) return <span className="text-muted/40">—</span>;

        return (
            <span
                className="inline-block rounded px-2 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: option.color }}
            >
                {option.label}
            </span>
        );
    }

    if (column.type === "checkbox") {
        const checked = value === "true" || value === true;
        return checked ? (
            <span className="text-emerald-500">✓</span>
        ) : (
            <span className="text-muted/40">—</span>
        );
    }

    if (column.type === "person" || column.type === "people") {
        const assigned = parsePeopleValue(value)
            .map((id) => workspaceMembers.find((m) => memberUserId(m) === id))
            .filter((m): m is Member => Boolean(m));

        if (!assigned.length) return <span className="text-muted/40">—</span>;

        return (
            <div className="flex items-center -space-x-1.5">
                {assigned.slice(0, 4).map((m) => (
                    <PersonAvatar key={memberUserId(m)} member={m} size={18} />
                ))}
                {assigned.length > 4 && (
                    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-control text-[8px] font-semibold text-muted ring-2 ring-card">
                        +{assigned.length - 4}
                    </span>
                )}
            </div>
        );
    }

    if (column.type === "rating") {
        const rating = parseRating(value);
        if (!rating) return <span className="text-muted/40">—</span>;
        return <StarRow value={rating} size={12} />;
    }

    if (column.type === "timeline") {
        const parsed = parseTimelineValue(typeof value === "string" ? value : null);
        if (!parsed) return <span className="text-muted/40">—</span>;
        const fmt = (d: string) => {
            const date = new Date(d);
            return isNaN(date.getTime()) ? d : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        };
        return (
            <span className="text-body">
                {fmt(parsed.startDate)} – {fmt(parsed.endDate)}
            </span>
        );
    }

    if (column.type === "date") {
        if (typeof value !== "string" || !value) return <span className="text-muted/40">—</span>;
        const date = new Date(value);
        return (
            <span className="text-body">
                {isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
        );
    }

    if (column.type === "file") {
        if (typeof value !== "string" || !value) return <span className="text-muted/40">—</span>;

        let count = 1;
        try {
            const parsed = JSON.parse(value);
            count = Array.isArray(parsed) ? parsed.length : 1;
        } catch {
            count = 1;
        }

        return (
            <span className="text-body">
                {count} file{count === 1 ? "" : "s"}
            </span>
        );
    }

    if (column.type === "relation" || column.type === "reference") {
        return <span className="text-body truncate">{references?.display || "—"}</span>;
    }

    if (value === null || value === undefined || value === "") {
        return <span className="text-muted/40">—</span>;
    }

    return <span className="truncate text-body">{String(value)}</span>;
}

const COLUMN_WIDTH = 160;
const NAME_WIDTH = 220;

export default function GridView({
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
    const gridColumns = useMemo(() => columns.filter((c) => c.scope !== "subrecord"), [columns]);

    const { data: workspaceMembers = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });
    const { data: moduleReferences = {} } = useGetModuleReferencesQuery(moduleId, {
        skip: !moduleId,
        refetchOnMountOrArgChange: true,
    });

    const [amendmentsRecord, setAmendmentsRecord] = useState<RecordItem | null>(null);

    const collectionColor = useMemo(() => {
        const map = new Map<string, string>();
        collections.forEach((c, i) =>
            map.set(c._id, c.color || COLLECTION_COLOR_PALETTE[i % COLLECTION_COLOR_PALETTE.length])
        );
        return map;
    }, [collections]);

    const orderedRecords = useMemo(() => {
        const order = new Map(collections.map((c, i) => [c._id, i]));
        return [...records].sort((a, b) => {
            const diff = (order.get(a.collectionName) ?? 0) - (order.get(b.collectionName) ?? 0);
            return diff !== 0 ? diff : (a.position ?? 0) - (b.position ?? 0);
        });
    }, [records, collections]);

    if (!records.length) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-md border border-dashed border-hairline bg-card/50 px-6 py-16 text-center font-google-sans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlineSquares2X2 size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">No records yet</h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Add records from Collection view — every column shows up here as one
                        flat grid.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="pl-8 pt-2 pb-4 flex-1 flex flex-col overflow-hidden font-google-sans">
            <div className="mb-3 flex shrink-0 items-center gap-2 pr-8">
                <h3 className="text-base font-bold text-foreground">Grid</h3>
                <span className="text-[11px] text-muted">
                    <span className="font-bold text-body">{records.length}</span> records ·{" "}
                    {gridColumns.length} columns
                </span>
            </div>

            <div className="flex-1 overflow-auto rounded-md border border-hairline [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                <div style={{ width: NAME_WIDTH + gridColumns.length * COLUMN_WIDTH }}>
                    {/* Frozen header, its own left cell also frozen — the same
                        nested-sticky corner Gantt uses. Each column head shows
                        its type under the name. */}
                    <div className="sticky top-0 z-20 flex h-10 border-b border-hairline bg-card">
                        <div
                            className="sticky left-0 z-10 flex shrink-0 items-center border-r border-hairline bg-card px-3 text-[11px] font-bold uppercase tracking-wider text-muted shadow-[3px_0_6px_-3px_rgba(0,0,0,0.12)]"
                            style={{ width: NAME_WIDTH }}
                        >
                            Record
                        </div>
                        {gridColumns.map((column) => (
                            <div
                                key={column._id}
                                className="flex shrink-0 flex-col justify-center gap-0.5 overflow-hidden border-r border-hairline px-3"
                                style={{ width: COLUMN_WIDTH }}
                            >
                                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
                                    {column.name}
                                </span>
                                <span className="truncate text-[9px] font-medium lowercase text-muted/60">
                                    {column.type}
                                </span>
                            </div>
                        ))}
                    </div>

                    {orderedRecords.map((record, idx) => (
                        <div
                            key={record._id}
                            className={`group flex border-b border-hairline transition-colors hover:bg-control/30 ${idx % 2 ? "bg-panel/40" : ""}`}
                        >
                            <button
                                type="button"
                                onClick={() => setAmendmentsRecord(record)}
                                title={record.name}
                                className={`sticky left-0 z-10 flex h-10 shrink-0 items-center gap-1.5 border-r border-hairline px-3 text-left text-xs font-semibold text-body transition group-hover:bg-control/30 hover:text-foreground cursor-pointer shadow-[3px_0_6px_-3px_rgba(0,0,0,0.12)] ${idx % 2 ? "bg-panel" : "bg-card"}`}
                                style={{
                                    width: NAME_WIDTH,
                                    borderLeft: `3px solid ${collectionColor.get(record.collectionName) || "#94A3B8"}`,
                                }}
                            >
                                <span className="truncate">{record.name}</span>
                                {(record.amendmentCount ?? 0) > 0 && (
                                    <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-normal text-muted">
                                        <MdOutlineTipsAndUpdates className="h-3 w-3" />
                                        {record.amendmentCount}
                                    </span>
                                )}
                            </button>

                            {gridColumns.map((column) => (
                                <div
                                    key={column._id}
                                    className="flex h-10 shrink-0 items-center truncate border-r border-hairline px-3 text-xs"
                                    style={{ width: COLUMN_WIDTH }}
                                >
                                    <GridCell
                                        column={column}
                                        value={columnValueFor(recordValues, record._id, column._id)}
                                        references={moduleReferences[record._id]?.[column._id]}
                                        workspaceMembers={workspaceMembers}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
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
