/**
 * Pure date-axis math shared by TimelineView and GanttView — both place
 * records along a horizontal day-scale axis built from a "timeline"-type
 * column's {startDate,endDate} value, they just lay the results out
 * differently (Timeline packs overlapping bars into shared rows for a
 * bird's-eye scan; Gantt gives every record its own row grouped under its
 * collection, like a task list). Extracted here rather than duplicated
 * between the two, the same "two real call sites is the bar for extracting"
 * rule ColumnPicker and byUserOrder followed earlier.
 */

export interface DateRange {
    start: Date;
    end: Date;
}

export interface TimelineValue {
    startDate: string;
    endDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Matches the timeline column: 32px reads as a comfortable day-width without needing a zoom control for a first pass. */
export const PIXELS_PER_DAY = 32;

/**
 * A timeline column stores JSON `{startDate,endDate}` (see CollectionView's
 * Cell "timeline" branch) — but its OWN fallback also treats a bare,
 * non-JSON date string as both start and end (a value written before the
 * JSON shape existed, or edited by hand). Mirrored here so a legacy value
 * still places on the axis instead of being silently dropped.
 */
export function parseTimelineValue(raw: unknown): TimelineValue | null {
    if (typeof raw !== "string" || !raw) return null;

    try {
        const parsed = JSON.parse(raw);
        const startDate = parsed?.startDate || parsed?.endDate;
        const endDate = parsed?.endDate || parsed?.startDate;
        if (!startDate && !endDate) return null;
        return { startDate: startDate || endDate, endDate: endDate || startDate };
    } catch {
        return { startDate: raw, endDate: raw };
    }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysBetween = (a: Date, b: Date) =>
    Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

/** The date span to draw, padded a couple of days either side so a bar at either edge isn't flush against the axis. */
export function computeRange(dates: { start: Date; end: Date }[], paddingDays = 2): DateRange | null {
    if (!dates.length) return null;

    let min = Infinity;
    let max = -Infinity;

    for (const { start, end } of dates) {
        min = Math.min(min, start.getTime());
        max = Math.max(max, end.getTime());
    }

    if (!isFinite(min) || !isFinite(max)) return null;

    const start = new Date(min);
    start.setDate(start.getDate() - paddingDays);
    const end = new Date(max);
    end.setDate(end.getDate() + paddingDays);

    return { start, end };
}

export const xFor = (date: Date, range: DateRange): number =>
    daysBetween(range.start, date) * PIXELS_PER_DAY;

/** Inclusive of both days — a bar spanning one day is still a visible bar, not a sliver. */
export const widthFor = (start: Date, end: Date): number =>
    Math.max(PIXELS_PER_DAY, (daysBetween(start, end) + 1) * PIXELS_PER_DAY);

export const totalWidth = (range: DateRange): number => xFor(range.end, range) + PIXELS_PER_DAY;

export interface MonthMarker {
    x: number;
    label: string;
}

const monthLabel = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", year: "numeric" });

/**
 * One marker per calendar-month boundary, for gridlines + labels.
 *
 * The FIRST marker is pinned to x=0 with the starting month's name — the 1st
 * of that month sits at a NEGATIVE x (the range is padded a couple of days
 * before it) and would otherwise be drawn off the left edge, leaving the first
 * label to appear well inside the chart and read as an empty leading column.
 * Subsequent markers are the real month boundaries at x>0.
 */
export function monthMarkers(range: DateRange): MonthMarker[] {
    const markers: MonthMarker[] = [{ x: 0, label: monthLabel(range.start) }];

    const cursor = new Date(range.start.getFullYear(), range.start.getMonth() + 1, 1);
    while (cursor <= range.end) {
        markers.push({ x: xFor(cursor, range), label: monthLabel(cursor) });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return markers;
}

/**
 * Greedy interval-packing: overlapping items stack into new rows, items that
 * do not overlap anything already in a row share it — the same algorithm
 * every calendar/timeline UI uses to avoid one bar per row when most bars
 * do not actually collide.
 */
export function packRows<T>(items: T[], getStart: (t: T) => Date, getEnd: (t: T) => Date): T[][] {
    const sorted = [...items].sort((a, b) => getStart(a).getTime() - getStart(b).getTime());
    const rows: T[][] = [];

    for (const item of sorted) {
        const row = rows.find((r) => getEnd(r[r.length - 1]).getTime() <= getStart(item).getTime());
        if (row) {
            row.push(item);
        } else {
            rows.push([item]);
        }
    }

    return rows;
}
