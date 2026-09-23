"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    HiOutlineViewColumns,
    HiOutlineCalendarDays,
    HiOutlineXMark,
    HiOutlineRectangleStack,
    HiOutlineClock,
} from "react-icons/hi2";
import { MdOutlineTipsAndUpdates } from "react-icons/md";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useCreateRecordValueMutation, useUpdateRecordValueMutation } from "@/store/api/recordValues.api";
import { useModuleRecords } from "@/store/useModuleData";
import { useGetMembersQuery } from "@/store/api/members.api";
import { DEFAULT_STATUS_OPTIONS } from "@/data/data";
import { PersonAvatar, memberName, memberUserId, parsePeopleValue } from "@/components/ui/helpers/personCell";
import { toast } from "@/components/ui/toast";
import RecordAmendmentsPanel from "@/components/RecordAmendmentsPanel";
import ItemPicker from "@/components/views/ItemPicker";
import { exactTime, timeAgo } from "@/lib/relativeTime";
import type { Column, RecordItem, RecordValue, StatusOption } from "@/store/types";

/**
 * The Kanban view: every record in the module, laned by the value of ONE
 * status column, dragged between lanes to change it.
 *
 * WHY A STATUS COLUMN: it is the only column type with a fixed, colour-coded
 * set of options (Column.statusOptions) — a dropdown is multi-select
 * (multipleSelects), so a record could belong to several lanes at once,
 * which is not what "one card, one lane" means. If the module has more than
 * one status column, a "Grouped by" picker lets the user choose which one
 * drives the board; the picked column is remembered per module (localStorage
 * — no Views model exists yet, matching ViewPicker.tsx's own scope note).
 *
 * SPANS THE WHOLE MODULE, not one collection: this is the alternative lens
 * to Collection view (which groups by collection), so it groups the SAME
 * records a different way, same as monday's own "Pipeline view = kanban on
 * Deals.stage" crosses every group on the board.
 *
 * THE CARD is a compact monday-style tile: title, an inline meta row, the
 * assignee stack, a date pill from a timeline/date column and pills for the
 * record's OTHER status columns. Clicking the card opens a details popover;
 * the "updates" button is its own control (stopPropagation) so opening the
 * amendments panel and reading the card are two separate gestures.
 *
 * DRAG: plain native HTML5 drag/drop (draggable, onDragStart/onDrop). The
 * dragged card just dims while it is held and the drop is applied instantly —
 * the earlier framer-motion flying-card transition between lanes was removed
 * at the owner's request ("direct add it"), so a moved card simply appears in
 * its new lane with no slide.
 */

const NO_STATUS_LANE = "__no_status__";
const groupStorageKey = (moduleId: string) => `kanban_group_column_${moduleId}`;

const readRemembered = (moduleId: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(groupStorageKey(moduleId));
    } catch {
        return null;
    }
};

/** timeline cells store JSON {startDate,endDate}; a legacy plain date reads as both. */
function parseDateRange(raw: unknown): { start: string; end: string } | null {
    if (!raw || typeof raw !== "string") return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.startDate || parsed.endDate)) {
            return { start: parsed.startDate || "", end: parsed.endDate || "" };
        }
        return null;
    } catch {
        return raw.trim() ? { start: raw.trim(), end: raw.trim() } : null;
    }
}

/** "Today, 9:00 am" / "Sep 16, 6:00 pm" / "Sep 16" — locale-formatted, never ISO. */
function formatDatePart(iso: string): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const day = sameDay
        ? "Today"
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return hasTime ? `${day}, ${time}` : day;
}

function formatDateRange(raw: unknown): string {
    const range = parseDateRange(raw);
    if (!range) return "";
    const start = formatDatePart(range.start);
    const end = range.end && range.end !== range.start ? formatDatePart(range.end) : "";
    return end ? `${start} - ${end}` : start;
}

type DetailRow = { label: string; value: string; color?: string };

/** One label / value line in the details popover. */
function DetailLine({ label, value, color }: DetailRow) {
    return (
        <div className="flex items-start justify-between gap-2 py-0.5">
            <span className="shrink-0 text-muted">{label}</span>
            {color ? (
                <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold"
                    style={{ color, backgroundColor: `${color}1A` }}
                >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {value}
                </span>
            ) : (
                <span className="text-right font-medium text-body">{value}</span>
            )}
        </div>
    );
}

/**
 * The card's own facts, in a popover anchored to the card. Portalled and
 * fixed-positioned so the horizontally-scrolling board never clips it; a
 * full-screen catcher behind it closes on an outside click (safe here — the
 * board is not being dragged while this is open).
 */
function CardDetails({
    record,
    rect,
    collectionName,
    rows,
    assignedNames,
    onClose,
    onOpenUpdates,
}: {
    record: RecordItem;
    rect: DOMRect;
    collectionName: string;
    rows: DetailRow[];
    assignedNames: string;
    onClose: () => void;
    onOpenUpdates: () => void;
}) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const WIDTH = 288;
    const GAP = 8;

    let left = rect.right + GAP;
    if (left + WIDTH > window.innerWidth - 12) {
        left = Math.max(12, rect.left - WIDTH - GAP);
    }
    const top = Math.max(12, Math.min(rect.top, window.innerHeight - 340));

    const amendmentCount = record.amendmentCount ?? 0;

    return createPortal(
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div
                className="fixed z-50 rounded-xl border border-hairline bg-card p-3 shadow-xl font-google-sans animate-in fade-in zoom-in-95 duration-100"
                style={{ top, left, width: WIDTH }}
            >
                <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold leading-snug text-foreground">
                        {record.name}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded p-0.5 text-muted transition hover:bg-control hover:text-foreground cursor-pointer"
                    >
                        <HiOutlineXMark className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-1.5 text-[11px]">
                    <DetailLine label="Collection" value={collectionName || "—"} />
                    {rows.map((row) => (
                        <DetailLine key={row.label} {...row} />
                    ))}
                    {assignedNames && <DetailLine label="Assignees" value={assignedNames} />}
                    <DetailLine label="Created" value={exactTime(record.createdAt)} />
                    <DetailLine label="Updated" value={exactTime(record.updatedAt)} />
                </div>

                <button
                    type="button"
                    onClick={onOpenUpdates}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-semibold text-card transition hover:opacity-90 cursor-pointer"
                >
                    <MdOutlineTipsAndUpdates className="h-3.5 w-3.5" />
                    Open updates{amendmentCount > 0 ? ` (${amendmentCount})` : ""}
                </button>
            </div>
        </>,
        document.body
    );
}

export default function KanbanView({
    workspaceId,
    moduleId,
}: {
    workspaceId: string;
    moduleId: string;
}) {
    const { data: collections = [] } = useGetCollectionsQuery(moduleId, { skip: !moduleId });
    const collectionIds = useMemo(() => collections.map((c) => c._id), [collections]);

    const { records, recordValues } = useModuleRecords(collectionIds);

    const { data: columns = [] } = useGetColumnsQuery(moduleId, { skip: !moduleId });

    const statusColumns = useMemo(
        () => columns.filter((c) => c.type === "status" && c.scope !== "subrecord"),
        [columns]
    );

    const personColumn = useMemo(
        () => columns.find((c) => (c.type === "person" || c.type === "people") && c.scope !== "subrecord"),
        [columns]
    );

    const timelineColumn = useMemo(
        () => columns.find((c) => (c.type === "timeline" || c.type === "date") && c.scope !== "subrecord"),
        [columns]
    );

    const { data: workspaceMembers = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });

    // An explicit in-session pick wins; otherwise the remembered one (if it
    // still exists on this module); otherwise the first status column. Pure
    // derivation, no effect — the same "no reset effect" rule the rest of the
    // board follows (see CollectionView's collapsedLocal for the same shape).
    const [pickedColumnId, setPickedColumnId] = useState<string | null>(null);
    const remembered = readRemembered(moduleId);

    const groupColumn: Column | null =
        (pickedColumnId ? statusColumns.find((c) => c._id === pickedColumnId) : undefined) ??
        (remembered ? statusColumns.find((c) => c._id === remembered) : undefined) ??
        statusColumns[0] ??
        null;

    const selectGroupColumn = (id: string) => {
        setPickedColumnId(id);
        try {
            localStorage.setItem(groupStorageKey(moduleId), id);
        } catch {
            // Private browsing / storage disabled — the pick still works for
            // this session via pickedColumnId, it just will not be remembered.
        }
    };

    const [createRecordValueMutation] = useCreateRecordValueMutation();
    const [updateRecordValueMutation] = useUpdateRecordValueMutation();

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverLane, setDragOverLane] = useState<string | null>(null);
    const [amendmentsRecord, setAmendmentsRecord] = useState<RecordItem | null>(null);
    const [details, setDetails] = useState<{ record: RecordItem; rect: DOMRect } | null>(null);

    const valueOf = (rv: RecordValue): string =>
        typeof rv.value === "string" ? rv.value : (rv.value as StatusOption | undefined)?.label ?? "";

    const columnIdOf = (rv: RecordValue): string =>
        typeof rv.column === "string" ? rv.column : rv.column._id;

    const rawValueForRecord = (recordId: string, columnId: string): unknown =>
        recordValues.find((v) => v.record === recordId && columnIdOf(v) === columnId)?.value;

    const valueForRecord = (record: RecordItem, columnId: string): string => {
        const rv = recordValues.find((v) => v.record === record._id && columnIdOf(v) === columnId);
        return rv ? valueOf(rv) : "";
    };

    const assignedFor = (record: RecordItem) => {
        if (!personColumn) return [];
        const ids = parsePeopleValue(rawValueForRecord(record._id, personColumn._id));
        return ids
            .map((id) => workspaceMembers.find((m) => memberUserId(m) === id))
            .filter((m): m is (typeof workspaceMembers)[number] => Boolean(m));
    };

    const moveToLane = async (record: RecordItem, targetLabel: string) => {
        if (!groupColumn) return;

        const existing = recordValues.find(
            (v) => v.record === record._id && columnIdOf(v) === groupColumn._id
        );

        try {
            if (existing) {
                await updateRecordValueMutation({
                    recordValueId: existing._id,
                    recordId: record._id,
                    value: targetLabel,
                }).unwrap();
            } else {
                await createRecordValueMutation({
                    recordId: record._id,
                    columnId: groupColumn._id,
                    collectionId: record.collectionName,
                    moduleId: record.module || moduleId,
                    workspaceId,
                    value: targetLabel,
                }).unwrap();
            }
        } catch (error) {
            toast.error(
                "Could not move that card",
                (error as { data?: { message?: string } })?.data?.message ??
                "The server rejected the write."
            );
        }
    };

    const handleDrop = (laneLabel: string) => {
        setDragOverLane(null);
        const recordId = draggingId;
        setDraggingId(null);
        if (!recordId || !groupColumn) return;

        const record = records.find((r) => r._id === recordId);
        if (!record) return;

        const currentValue = valueForRecord(record, groupColumn._id);
        const targetValue = laneLabel === NO_STATUS_LANE ? "" : laneLabel;
        if (currentValue === targetValue) return;

        moveToLane(record, targetValue);
    };

    if (!groupColumn) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center font-dmsans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlineViewColumns size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Kanban needs a status column
                    </h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Add a status column from Collection view, then come back here — its
                        options become the lanes.
                    </p>
                </div>
            </div>
        );
    }

    const options: StatusOption[] = groupColumn.statusOptions?.length
        ? groupColumn.statusOptions
        : DEFAULT_STATUS_OPTIONS;

    const otherStatusColumns = statusColumns.filter((c) => c._id !== groupColumn._id);

    const lanes = [
        ...options.map((opt) => ({
            key: opt.label,
            label: opt.label,
            color: opt.color,
            records: records.filter((r) => valueForRecord(r, groupColumn._id) === opt.label),
        })),
        {
            key: NO_STATUS_LANE,
            label: "No status",
            color: "#94A3B8",
            records: records.filter((r) => {
                const v = valueForRecord(r, groupColumn._id);
                return !v || !options.some((o) => o.label === v);
            }),
        },
    ];

    /** Status pills for a card — every status column except the one driving the lanes. */
    const statusChipsFor = (record: RecordItem): DetailRow[] => {
        const rows: DetailRow[] = [];
        otherStatusColumns.forEach((col) => {
            const value = valueForRecord(record, col._id);
            if (!value) return;
            const color = col.statusOptions?.find((o) => o.label === value)?.color || "#94A3B8";
            rows.push({ label: col.name, value, color });
        });
        return rows;
    };

    const detailRowsFor = (record: RecordItem): DetailRow[] => {
        const rows: DetailRow[] = [];
        if (timelineColumn) {
            const text = formatDateRange(rawValueForRecord(record._id, timelineColumn._id));
            if (text) rows.push({ label: timelineColumn.name, value: text });
        }
        // Every status column, including the one driving the lanes.
        statusColumns.forEach((col) => {
            const value = valueForRecord(record, col._id);
            if (!value) return;
            const color = col.statusOptions?.find((o) => o.label === value)?.color || "#94A3B8";
            rows.push({ label: col.name, value, color });
        });
        return rows;
    };

    return (
        <div className="pl-8 pt-2 flex-1 flex flex-col overflow-hidden">
            <div className="mb-2 flex shrink-0 items-baseline gap-3 pr-8">
                <h3 className="text-sm font-semibold text-body font-dmsans">Board</h3>
                {statusColumns.length > 1 ? (
                    <ItemPicker
                        label="Grouped by"
                        heading="Group by"
                        items={statusColumns}
                        active={groupColumn}
                        onChange={selectGroupColumn}
                    />
                ) : (
                    <span className="text-xs text-muted font-dmsans">
                        Grouped by <span className="text-body font-semibold">{groupColumn.name}</span>
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden pr-2 pb-4 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                    <div className="flex min-w-max items-start gap-4">
                        {lanes.map((lane) => (
                            <div
                                key={lane.key}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOverLane(lane.key);
                                }}
                                onDragLeave={() => setDragOverLane((cur) => (cur === lane.key ? null : cur))}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    handleDrop(lane.label);
                                }}
                                className="flex w-72 shrink-0 flex-col rounded-xl border transition-colors"
                                style={{
                                    backgroundColor: `${lane.color}${dragOverLane === lane.key ? "24" : "14"}`,
                                    borderColor: dragOverLane === lane.key ? lane.color : `${lane.color}33`,
                                }}
                            >
                                {/* Lane header — the status name IS the pill:
                                    white on the status colour, the same badge
                                    the card and List view show. */}
                                <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
                                    <span
                                        className="truncate rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white font-google-sans"
                                        style={{ backgroundColor: lane.color }}
                                    >
                                        {lane.label}
                                    </span>
                                    <span
                                        className="shrink-0 text-[12px] font-bold tabular-nums"
                                        style={{ color: lane.color }}
                                    >
                                        {lane.records.length}
                                    </span>
                                </div>

                                {/* Cards — the lane grows with them but never past
                                    the viewport: once the stack is taller than the
                                    board area (roughly five cards) it scrolls inside
                                    the lane instead of pushing the page. An empty
                                    lane is just its header plus a thin drop zone. */}
                                <div className="max-h-[calc(100dvh-13rem)] space-y-2 overflow-y-auto px-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
                                    {lane.records.length === 0 && (
                                        <div
                                            className={`rounded-lg border border-dashed py-2 text-center text-[11px] transition ${dragOverLane === lane.key
                                                ? "border-accent text-accent"
                                                : "border-transparent text-transparent"
                                                }`}
                                        >
                                            Drop here
                                        </div>
                                    )}

                                        {lane.records.map((record) => {
                                            const assigned = assignedFor(record);
                                            const collection = collections.find((c) => c._id === record.collectionName);
                                            const updatedText = timeAgo(record.updatedAt ?? record.createdAt);
                                            const dateText = timelineColumn
                                                ? formatDateRange(rawValueForRecord(record._id, timelineColumn._id))
                                                : "";
                                            const chips = statusChipsFor(record);
                                            const amendmentCount = record.amendmentCount ?? 0;
                                            const subCount = record.subRecordCount ?? 0;

                                            return (
                                                <div
                                                    key={record._id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        setDraggingId(record._id);
                                                        e.dataTransfer.effectAllowed = "move";
                                                        e.dataTransfer.setData("text/plain", record._id);
                                                    }}
                                                    onDragEnd={() => setDraggingId(null)}
                                                >
                                                    <div
                                                        onClick={(e) =>
                                                            setDetails({
                                                                record,
                                                                rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                                                            })
                                                        }
                                                        className={`group relative cursor-pointer rounded-xl border border-slate-200 bg-card p-2.5 shadow-sm transition hover:border-slate-300 hover:shadow-md ${draggingId === record._id ? "opacity-40" : ""
                                                            }`}
                                                    >
                                                        {/* Updates — its own control, so reading the card
                                                            and opening the thread are separate gestures. */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAmendmentsRecord(record);
                                                            }}
                                                            title="Open updates"
                                                            className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md border border-slate-200 bg-card px-1.5 py-1 text-[10px] font-semibold text-muted opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100 cursor-pointer"
                                                        >
                                                            <MdOutlineTipsAndUpdates className="h-3.5 w-3.5" />
                                                            {amendmentCount > 0 && amendmentCount}
                                                        </button>

                                                        {collection && (
                                                            <div className="mb-1 flex items-center gap-1 pr-6">
                                                                <span
                                                                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                                                                    style={{ backgroundColor: collection.color || "#94A3B8" }}
                                                                />
                                                                <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
                                                                    {collection.name}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <p className="line-clamp-2 pr-6 text-[13px] font-semibold leading-snug text-foreground font-google-sans">
                                                            {record.name}
                                                        </p>

                                                        {(amendmentCount > 0 || subCount > 0) && (
                                                            <div className="mt-1.5 flex items-center gap-2.5 text-[10px] font-medium text-muted">
                                                                {amendmentCount > 0 && (
                                                                    <span className="flex items-center gap-0.5">
                                                                        <MdOutlineTipsAndUpdates className="h-3 w-3" />
                                                                        {amendmentCount}
                                                                    </span>
                                                                )}
                                                                {subCount > 0 && (
                                                                    <span className="flex items-center gap-0.5">
                                                                        <HiOutlineRectangleStack className="h-3 w-3" />
                                                                        {subCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {dateText && (
                                                            <div className="mt-2 flex w-fit max-w-full items-center gap-1 rounded-md bg-control/60 px-1.5 py-0.5 text-[11px] font-medium text-body">
                                                                <HiOutlineCalendarDays className="h-3 w-3 shrink-0" />
                                                                <span className="truncate">{dateText}</span>
                                                            </div>
                                                        )}

                                                        {chips.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                                                {chips.map((chip) => (
                                                                    <span
                                                                        key={chip.label}
                                                                        title={`${chip.label}: ${chip.value}`}
                                                                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                                                                        style={{
                                                                            color: chip.color,
                                                                            backgroundColor: `${chip.color}1A`,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            className="h-1.5 w-1.5 rounded-full"
                                                                            style={{ backgroundColor: chip.color }}
                                                                        />
                                                                        {chip.value}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Footer — a consistent baseline on every card:
                                                            who it sits with and how fresh it is. */}
                                                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                                                            {assigned.length > 0 ? (
                                                                <div className="flex items-center -space-x-1.5">
                                                                    {assigned.slice(0, 3).map((m) => (
                                                                        <PersonAvatar
                                                                            key={memberUserId(m)}
                                                                            member={m}
                                                                            size={20}
                                                                            showPresence
                                                                        />
                                                                    ))}
                                                                    {assigned.length > 3 && (
                                                                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-control text-[8px] font-semibold text-muted ring-2 ring-card">
                                                                            +{assigned.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-medium text-muted">
                                                                    Unassigned
                                                                </span>
                                                            )}

                                                            {updatedText && (
                                                                <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted">
                                                                    <HiOutlineClock className="h-3 w-3" />
                                                                    {updatedText}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        ))}
                    </div>
            </div>

            {details && (
                <CardDetails
                    record={details.record}
                    rect={details.rect}
                    collectionName={
                        collections.find((c) => c._id === details.record.collectionName)?.name ?? ""
                    }
                    rows={detailRowsFor(details.record)}
                    assignedNames={assignedFor(details.record).map(memberName).join(", ")}
                    onClose={() => setDetails(null)}
                    onOpenUpdates={() => {
                        setAmendmentsRecord(details.record);
                        setDetails(null);
                    }}
                />
            )}

            {/* Amendments — same panel Collection view uses, kept local (no
                URL deep-link here — see the module comment at the top). */}
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
