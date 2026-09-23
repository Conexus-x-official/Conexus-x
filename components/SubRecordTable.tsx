"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CornerDownRight, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { MdOutlineTipsAndUpdates } from "react-icons/md";
import ResizeHandle from "@/components/ui/helpers/resizeHandle";
import { MIRROR_TINT, mirrorHeaderStyle } from "@/lib/mirror";
import { useGetSubRecordsQuery } from "@/store/api/records.api";
import { useRecordValuesFor } from "@/store/useModuleData";
import type { Column, RecordItem, RecordValue } from "@/store/types";

/**
 * The sub-record grid that opens underneath one board row.
 *
 * A sub-record is an ordinary record with a `parentRecord`, but it is shown
 * against the module's SUB-RECORD columns — a separate set from the board's, so
 * a "Deal" row can be tracked by Stage and Value while the work underneath it is
 * tracked by Owner and Due date. That is the whole reason the block draws its
 * own header instead of reusing the one above it.
 *
 * The cells themselves are rendered by the board through `renderCell`: the Cell
 * component lives with the rest of the grid, and a sub-record cell must behave
 * identically to a record cell — same editors, same status pickers, same
 * optimistic write path.
 */

/** The board's cell reader, which understands both the object and id shapes. */
const valueColumnId = (value: RecordValue) =>
    typeof value.column === "string" ? value.column : value.column?._id;

interface SubRecordTableProps {
    /** The board row this block hangs under. */
    record: RecordItem;
    /** The parent collection's colour — the nesting rail is drawn in it. */
    color: string;
    /** Width of the board's sticky Record column, so the tree lines up with it. */
    nameWidth: number;
    /** The module's sub-record columns, already sorted. */
    columns: Column[];
    getColWidth: (id: string, fallback?: number) => number;
    /** Resizes a sub-column, so its header drags exactly like a board one. */
    onResizeColumn: (columnId: string, delta: number) => void;
    /** Opens the amendments panel — a sub-record carries them like any record. */
    onOpenAmendments: (subRecord: RecordItem) => void;

    onAddColumn: () => void;
    onColumnMenu: (event: React.MouseEvent, column: Column) => void;
    onRename: (subRecord: RecordItem, name: string) => void;
    onDelete: (subRecord: RecordItem) => void;
    /** Opens the board's Add Sub-record modal for this row. */
    onRequestAdd: () => void;
    renderCell: (args: {
        subRecord: RecordItem;
        column: Column;
        recordValue?: RecordValue;
        width: number;
    }) => ReactNode;
}

/** Inline-edit name cell — the same click-to-edit contract as the board's. */
function SubRecordNameCell({
    subRecord,
    width,
    color,
    onRename,
    onDelete,
    onOpenAmendments,
}: {
    subRecord: RecordItem;
    width: number;
    color: string;
    onRename: (subRecord: RecordItem, name: string) => void;
    onDelete: (subRecord: RecordItem) => void;
    onOpenAmendments: (subRecord: RecordItem) => void;
}) {
    /**
     * The edit buffer is null unless the cell is being typed in, so the name on
     * screen is the server's until the moment it is not. Holding a copy in state
     * and re-syncing it from a prop is the same thing with an extra render and
     * an effect that lint rightly objects to.
     */
    const [draft, setDraft] = useState<string | null>(null);
    const editing = draft !== null;
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const commit = () => {
        const trimmed = (draft ?? "").trim();
        setDraft(null);
        if (trimmed && trimmed !== subRecord.name) {
            onRename(subRecord, trimmed);
        }
    };

    return (
        <div
            className="group/sub-name sticky left-10 z-20 flex shrink-0 items-center gap-1.5 border-r border-slate-300 bg-control px-2 py-1 font-google-sans text-[13px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)]"
            style={{ width, borderLeft: `3px solid ${color}` }}
        >
            {/* Indent only. The nesting arrow used to be repeated on every row;
                it now sits once in the column title, where it labels the whole
                block instead of restating the same thing N times. The padding
                stays INSIDE the cell so the coloured rail keeps its place. */}
            <span className="ml-4 shrink-0" aria-hidden />

            {editing ? (
                <input
                    ref={inputRef}
                    value={draft ?? ""}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") setDraft(null);
                    }}
                    className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-slate-800 outline-none ring-0"
                />
            ) : (
                <span
                    onClick={() => setDraft(subRecord.name)}
                    className="min-w-0 flex-1 cursor-text truncate text-slate-700"
                >
                    {subRecord.name}
                </span>
            )}

            {/* Amendments — the same control the board row carries, in the same
                place (trailing edge), because a sub-record is a record and the
                conversation on one is read the same way. */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenAmendments(subRecord);
                }}
                title={
                    subRecord.amendmentCount
                        ? `${subRecord.amendmentCount} amendment${subRecord.amendmentCount === 1 ? "" : "s"}`
                        : "Write an amendment"
                }
                className={`ml-1 flex shrink-0 cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 transition hover:bg-slate-200/70 ${subRecord.amendmentCount ? "text-accent" : "text-slate-400 opacity-0 group-hover/sub-name:opacity-100 focus-visible:opacity-100"}`}
            >
                <MdOutlineTipsAndUpdates className="h-3.5 w-3.5" />
                {(subRecord.amendmentCount ?? 0) > 0 && (
                    <span className="font-google-sans text-[10px] font-bold tabular-nums">
                        {subRecord.amendmentCount}
                    </span>
                )}
            </button>

            <button
                onClick={() => onDelete(subRecord)}
                title="Delete sub-record"
                className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover/sub-name:opacity-100 cursor-pointer"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

/**
 * The box is closed by four different owners, which is worth knowing before
 * adding a border to any of them: the TOP is the parent row's own border-b
 * (a border-t here would double it into a 2px seam), the LEFT is the gutter's
 * border-l plus the collection's coloured rail, the RIGHT is the border-r on
 * whichever element ends each row, and only the BOTTOM belongs to this
 * container. The surface is bg-control so the block reads as inset against the
 * board's bg-card without any translucency — the sticky cells have to stay
 * opaque, so a tint on the container alone would leave them a shade off.
 */
export default function SubRecordTable({
    record,
    color,
    nameWidth,
    columns,
    getColWidth,
    onAddColumn,
    onColumnMenu,
    onRename,
    onDelete,
    onRequestAdd,
    renderCell,
    onResizeColumn,
    onOpenAmendments,
}: SubRecordTableProps) {
    // Only mounted while the row is expanded, so this subscribes on open and
    // releases on close — nothing is fetched for a collapsed row.
    const { data: subRecords = [], isLoading } = useGetSubRecordsQuery(record._id);

    const recordValues = useRecordValuesFor(subRecords.map((r) => r._id));

    /**
     * Everything right of the sticky name column: the sub-columns plus the
     * "+ Sub-column" spacer each row ends with.
     *
     * This is a MINIMUM, never a fixed width. The board and this grid have
     * independent column sets, so either can be the wider one — 5 sub-columns
     * under a 4-column board is as ordinary as the reverse. Every row here and
     * on the board ends in a `grow` element, so the widest row in the
     * collection sets the width and all the others stretch to meet it. Doing it
     * with flex rather than arithmetic means neither grid has to know the
     * other's total, and resizing a column on either side stays correct.
     */
    const tailWidth =
        columns.reduce((total, column) => total + getColWidth(column._id), 0) + 120;

    /**
     * Each row is: sticky gutter, sticky name, cells, trailing spacer — the same
     * four parts a board row has, at the same widths, so every vertical line in
     * the block continues the one above it. The gutter is the board's checkbox
     * column with nothing in it; the coloured rail belongs to the name cell.
     */
    const gutter = (
        <div className="sticky left-0 z-20 flex w-10 shrink-0 items-stretch justify-center bg-control">
            <div className="h-full w-full border-l border-slate-300" />
        </div>
    );

    return (
        <div className="subrecord-grid flex min-w-max flex-col border-b border-slate-300 bg-control">
            {/* ── Sub-record column headers ──────────────────────────────── */}
            <div className="flex min-w-max items-stretch border-b border-slate-300">
                {gutter}

                {/* Named like the board's "Record" header, and the one place
                    the nesting arrow appears — the rows below it are indented
                    but carry no arrow of their own. */}
                <div
                    className="sticky left-10 z-20 flex shrink-0 items-center gap-1.5 border-r border-slate-300 bg-control px-3 py-1.5 font-google-sans text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                    style={{ width: nameWidth, borderLeft: `3px solid ${color}` }}
                >
                    <CornerDownRight className="ml-4 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Sub-record</span>
                </div>

                {columns.map((column) => (
                    <div
                        key={column._id}
                        onContextMenu={(e) => onColumnMenu(e, column)}
                        className="relative flex shrink-0 items-center justify-center gap-1.5 border-r border-slate-300 px-3 py-1.5 font-google-sans text-[11px] font-semibold uppercase tracking-wider text-slate-600 select-none"
                        style={{
                            width: getColWidth(column._id),
                            // A mirrored sub-column is tinted like a mirrored
                            // board column — the cells below it already are, and
                            // an untinted header left the wash unexplained.
                            ...(column.settings?.displayField ? mirrorHeaderStyle : {}),
                        }}
                        title={
                            column.settings?.displayField
                                ? "Mirrored from another module — read-only"
                                : "Right-click to rename / delete"
                        }
                    >
                        {column.settings?.displayField && (
                            <Link2 className="h-3 w-3 shrink-0" style={{ color: MIRROR_TINT }} />
                        )}
                        <span className="truncate">{column.name}</span>

                        {/* Sub-columns were the only grid on the board that
                            could not be resized, so a long value had nowhere to
                            go once there were more than a few of them. */}
                        <ResizeHandle onResize={(d) => onResizeColumn(column._id, d)} />
                    </div>
                ))}

                <div className="flex w-[120px] shrink-0 items-center justify-center px-3 py-1.5">
                    <button
                        onClick={onAddColumn}
                        className="cursor-pointer whitespace-nowrap font-google-sans text-[11px] font-bold text-zinc-500 transition hover:text-foreground"
                    >
                        + Sub-column
                    </button>
                </div>

                {/* Slack, so the button stays its own size — see tailWidth. */}
                <div className="grow border-r border-slate-300" />

            </div>

            {/* ── Sub-record rows ────────────────────────────────────────── */}
            {isLoading ? (
                <div className="flex min-w-max items-stretch">
                    {gutter}
                    <div
                        className="sticky left-10 z-20 flex shrink-0 items-center gap-2 border-r border-slate-300 bg-control px-3 py-2 text-xs text-muted"
                        style={{ width: nameWidth, borderLeft: `3px solid ${color}` }}
                    >
                        <Loader2 className="ml-4 h-3.5 w-3.5 animate-spin" />
                        Loading sub-records…
                    </div>
                    <div className="grow border-r border-slate-300" style={{ minWidth: tailWidth }} />
                </div>
            ) : (
                subRecords.map((subRecord) => (
                    <div
                        key={subRecord._id}
                        className="flex min-w-max items-stretch border-b border-slate-300 transition-colors hover:bg-zinc-600/5"
                    >
                        {gutter}

                        <SubRecordNameCell
                            subRecord={subRecord}
                            width={nameWidth}
                            color={color}
                            onRename={onRename}
                            onDelete={onDelete}
                            onOpenAmendments={onOpenAmendments}
                        />

                        {columns.map((column) => (
                            <div key={column._id} className="flex shrink-0 items-stretch">
                                {renderCell({
                                    subRecord,
                                    column,
                                    recordValue: recordValues.find(
                                        (v) =>
                                            v.record === subRecord._id &&
                                            valueColumnId(v) === column._id
                                    ),
                                    width: getColWidth(column._id),
                                })}
                            </div>
                        ))}

                        <div className="min-w-[120px] grow border-r border-slate-300" />
                    </div>
                ))
            )}

            {/* ── Add sub-record ─────────────────────────────────────────────
                A real button opening the board's modal. It was an inline input
                whose placeholder read "Add sub-record", which looks exactly like
                a button and does nothing when clicked — the row said "type here"
                while every other add control on this board says "press me". */}
            <div className="flex min-w-max items-stretch">
                {gutter}

                <div
                    className="sticky left-10 z-20 flex shrink-0 items-center border-r border-slate-300 bg-control px-3 py-1.5"
                    style={{ width: nameWidth, borderLeft: `3px solid ${color}` }}
                >
                    <button
                        type="button"
                        onClick={onRequestAdd}
                        className="group/add ml-4 flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 transition"
                    >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-colors group-hover/add:text-foreground" />
                        <span className="font-google-sans text-xs font-semibold text-zinc-600 transition-colors group-hover/add:text-foreground">
                            Add Sub-record
                        </span>
                    </button>
                </div>

                <div className="grow border-r border-slate-300" style={{ minWidth: tailWidth }} />
            </div>
        </div>
    );
}
