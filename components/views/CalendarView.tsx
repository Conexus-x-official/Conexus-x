"use client";

import { useMemo, useState } from "react";
import { HiOutlineCalendarDays, HiOutlineChevronLeft, HiOutlineChevronRight } from "react-icons/hi2";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useModuleRecords } from "@/store/useModuleData";
import { COLLECTION_COLOR_PALETTE } from "@/data/data";
import RecordAmendmentsPanel from "@/components/RecordAmendmentsPanel";
import ItemPicker from "@/components/views/ItemPicker";
import type { RecordItem } from "@/store/types";

/**
 * The Calendar view: every record placed on the day named by ONE date
 * column, in a classic month grid.
 *
 * WHY A DATE COLUMN: it is the one column type whose value is a single,
 * unambiguous day (reference.md "Calendar(date col)") — timeline's
 * start/end range is a different question (a span, not a day) and is
 * deliberately left out of the picker for this first pass rather than
 * guessed at via its start date. If the module has more than one date
 * column, ItemPicker (shared with Kanban's grouping picker) lets the user
 * choose which one places records; the pick is remembered per module the
 * same effect-free way KanbanView remembers its status column.
 *
 * SPANS THE WHOLE MODULE, same as Kanban and List — a record's collection
 * has nothing to do with which day it falls on.
 *
 * A day cell scrolls internally rather than hiding records behind a "+N
 * more" that does nothing when clicked — see Extensions/page.tsx's "a
 * control that looks broken" lesson, the same reasoning ViewPicker's empty
 * rows follow.
 */

const dateStorageKey = (moduleId: string) => `calendar_date_column_${moduleId}`;

const readRemembered = (moduleId: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(dateStorageKey(moduleId));
    } catch {
        return null;
    }
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local YYYY-MM-DD — never toISOString(), which shifts by the viewer's UTC offset and can land a record on the wrong day. */
function dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function parseDateValue(raw: unknown): string | null {
    if (typeof raw !== "string" || !raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : dateKey(d);
}

export default function CalendarView({
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
    const dateColumns = useMemo(
        () => columns.filter((c) => c.type === "date" && c.scope !== "subrecord"),
        [columns]
    );

    // Same effect-free remembered-pick shape as KanbanView's group column.
    const [pickedColumnId, setPickedColumnId] = useState<string | null>(null);
    const remembered = readRemembered(moduleId);

    const dateColumn =
        (pickedColumnId ? dateColumns.find((c) => c._id === pickedColumnId) : undefined) ??
        (remembered ? dateColumns.find((c) => c._id === remembered) : undefined) ??
        dateColumns[0] ??
        null;

    const selectDateColumn = (id: string) => {
        setPickedColumnId(id);
        try {
            localStorage.setItem(dateStorageKey(moduleId), id);
        } catch {
            // Private browsing / storage disabled — the pick still applies for
            // this session, it just will not be remembered.
        }
    };

    const [viewedMonth, setViewedMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });
    const [amendmentsRecord, setAmendmentsRecord] = useState<RecordItem | null>(null);

    const recordsByDate = useMemo(() => {
        const map = new Map<string, RecordItem[]>();
        if (!dateColumn) return map;

        for (const record of records) {
            const rv = recordValues.find(
                (v) =>
                    v.record === record._id &&
                    (typeof v.column === "string" ? v.column : v.column._id) === dateColumn._id
            );
            const key = parseDateValue(rv?.value);
            if (!key) continue;

            const list = map.get(key) ?? [];
            list.push(record);
            map.set(key, list);
        }

        return map;
    }, [records, recordValues, dateColumn]);

    const collectionColor = (id: string) => {
        const idx = collections.findIndex((c) => c._id === id);
        return (
            collections[idx]?.color ||
            COLLECTION_COLOR_PALETTE[(idx < 0 ? 0 : idx) % COLLECTION_COLOR_PALETTE.length]
        );
    };

    if (!dateColumn) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-xl border border-dashed border-hairline bg-card/50 px-6 py-16 text-center font-google-sans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlineCalendarDays size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Calendar needs a date column
                    </h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Add a date column from Collection view, then come back here — its
                        values place records on the calendar.
                    </p>
                </div>
            </div>
        );
    }

    const firstWeekday = viewedMonth.getDay();
    const gridStart = new Date(viewedMonth);
    gridStart.setDate(gridStart.getDate() - firstWeekday);

    const days: Date[] = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
    });

    const todayKey = dateKey(new Date());
    const monthLabel = viewedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const shiftMonth = (delta: number) =>
        setViewedMonth((d) => {
            const next = new Date(d);
            next.setMonth(next.getMonth() + delta);
            return next;
        });

    const goToday = () =>
        setViewedMonth(() => {
            const d = new Date();
            d.setDate(1);
            return d;
        });

    return (
        <div className="pl-8 pr-8 pt-2 pb-4 flex-1 flex flex-col overflow-hidden font-google-sans">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-foreground">{monthLabel}</h3>
                    {dateColumns.length > 1 && (
                        <ItemPicker
                            label="Scheduled by"
                            heading="Date column"
                            items={dateColumns}
                            active={dateColumn}
                            onChange={selectDateColumn}
                        />
                    )}
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-hairline p-0.5">
                    <button
                        type="button"
                        onClick={() => shiftMonth(-1)}
                        aria-label="Previous month"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-control hover:text-foreground cursor-pointer"
                    >
                        <HiOutlineChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={goToday}
                        className="rounded-md px-2.5 py-1 text-xs font-bold text-body transition hover:bg-control hover:text-foreground cursor-pointer"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => shiftMonth(1)}
                        aria-label="Next month"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-control hover:text-foreground cursor-pointer"
                    >
                        <HiOutlineChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* One full-height grid — a header row plus six equal week rows —
                so it reads as a calendar filling the page, not a scrolling
                list. A day that overflows scrolls inside its own cell. */}
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-px overflow-hidden rounded-xl border border-hairline bg-hairline">
                {WEEKDAYS.map((w) => (
                    <div
                        key={w}
                        className="bg-panel py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted"
                    >
                        {w}
                    </div>
                ))}

                {days.map((d) => {
                    const key = dateKey(d);
                    const inMonth = d.getMonth() === viewedMonth.getMonth();
                    const isToday = key === todayKey;
                    const dayRecords = recordsByDate.get(key) ?? [];

                    return (
                        <div
                            key={key}
                            className={`flex min-h-0 flex-col gap-1 p-1.5 transition-colors ${inMonth ? "bg-card" : "bg-panel"} ${isToday ? "bg-control/40" : ""}`}
                        >
                            <span
                                className={`self-start text-[11px] font-bold tabular-nums ${isToday
                                    ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-card"
                                    : inMonth
                                        ? "text-body"
                                        : "text-muted"
                                    }`}
                            >
                                {d.getDate()}
                            </span>

                            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300">
                                {dayRecords.map((record) => {
                                    const color = collectionColor(record.collectionName);
                                    return (
                                        <button
                                            key={record._id}
                                            type="button"
                                            onClick={() => setAmendmentsRecord(record)}
                                            title={record.name}
                                            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-semibold text-white transition hover:brightness-105 cursor-pointer"
                                            style={{ backgroundColor: color }}
                                        >
                                            <span className="min-w-0 truncate">{record.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
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
