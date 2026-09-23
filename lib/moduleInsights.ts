import { DEFAULT_STATUS_OPTIONS, COLLECTION_COLOR_PALETTE } from "@/data/data";
import { memberUserId, parsePeopleValue } from "@/components/ui/helpers/personCell";
import type { Collection, Column, Member, RecordItem, RecordValue } from "@/store/types";

/**
 * Pure aggregation over a module's own records/columns — no chart library,
 * no React — shared by ChartView (shows one, picked) and DashboardView
 * (shows all, small). Each insight only appears when a real column backs it
 * (a status breakdown needs a status column, a workload needs a person
 * column), the same "offer only what is real" rule every other view in this
 * set follows — an empty dashboard is honest; a dashboard with an invented
 * metric is not.
 */

export interface BarDatum {
    key: string;
    label: string;
    value: number;
    /**
     * Where the colour comes from matters: status/collection bars use the
     * SAME colour that option/collection already has everywhere else in the
     * app (Kanban's lanes, the status pill, the collection dot) — reusing an
     * established identity colour rather than assigning a fresh categorical
     * one, so the same status is never a different colour in two views.
     * Workload/completion bars have no such pre-existing identity — each bar
     * is already named by its own axis label, so they share one flat accent
     * hue (the "sequential = one hue" case) rather than needing a
     * multi-colour categorical assignment.
     */
    color: string;
}

export interface BarInsight {
    kind: "bar";
    id: string;
    title: string;
    subtitle?: string;
    data: BarDatum[];
}

export interface StatInsight {
    kind: "stat";
    id: string;
    title: string;
    value: string;
    subtitle?: string;
}

/** One point on a time-series line — cumulative `value`, `added` in that bucket. */
export interface LinePoint {
    t: number;
    label: string;
    value: number;
    added: number;
}

export interface LineInsight {
    kind: "line";
    id: string;
    title: string;
    subtitle?: string;
    /** Single series → one hue, no legend (the title names it). */
    color: string;
    /** The final cumulative total, shown as the widget's hero number. */
    total: number;
    data: LinePoint[];
}

/** One person's share of the assigned work — carries the whole Member so the
 *  widget can draw the avatar + presence dot, not just a name. */
export interface WorkloadRow {
    member: Member;
    count: number;
}

export interface WorkloadInsight {
    kind: "workload";
    id: string;
    title: string;
    subtitle?: string;
    /** The busiest person's count — the bar scale. */
    max: number;
    /** Total assignments across everyone. */
    total: number;
    data: WorkloadRow[];
}

export type ModuleInsight = BarInsight | StatInsight | LineInsight | WorkloadInsight;

/** The one flat hue every bar with no pre-existing identity colour shares. */
export const NEUTRAL_BAR_COLOR = "var(--brand-blue)";

const columnIdOf = (v: RecordValue) => (typeof v.column === "string" ? v.column : v.column._id);

const valueFor = (recordValues: RecordValue[], recordId: string, columnId: string) =>
    recordValues.find((v) => v.record === recordId && columnIdOf(v) === columnId)?.value;

function statusBreakdown(column: Column, records: RecordItem[], recordValues: RecordValue[]): BarInsight {
    const options = column.statusOptions?.length ? column.statusOptions : DEFAULT_STATUS_OPTIONS;
    const counts = new Map<string, number>();

    for (const record of records) {
        const raw = valueFor(recordValues, record._id, column._id);
        const label = typeof raw === "string" ? raw : (raw as { label?: string } | undefined)?.label;
        if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    const data: BarDatum[] = options
        .map((opt) => ({ key: opt.label, label: opt.label, value: counts.get(opt.label) ?? 0, color: opt.color }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

    return { kind: "bar", id: `status-${column._id}`, title: column.name, data };
}

function collectionBreakdown(collections: Collection[], records: RecordItem[]): BarInsight {
    const counts = new Map<string, number>();
    for (const record of records) {
        counts.set(record.collectionName, (counts.get(record.collectionName) ?? 0) + 1);
    }

    const data: BarDatum[] = collections
        .map((c, i) => ({
            key: c._id,
            label: c.name,
            value: counts.get(c._id) ?? 0,
            color: c.color || COLLECTION_COLOR_PALETTE[i % COLLECTION_COLOR_PALETTE.length],
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

    return { kind: "bar", id: "collections", title: "Records per collection", data };
}

function workload(
    column: Column,
    records: RecordItem[],
    recordValues: RecordValue[],
    members: Member[]
): WorkloadInsight {
    const counts = new Map<string, number>();

    for (const record of records) {
        const raw = valueFor(recordValues, record._id, column._id);
        for (const id of parsePeopleValue(raw)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const data: WorkloadRow[] = [...counts.entries()]
        .map(([id, count]) => {
            const member = members.find((m) => memberUserId(m) === id);
            return member ? { member, count } : null;
        })
        .filter((row): row is WorkloadRow => row !== null)
        .sort((a, b) => b.count - a.count);

    return {
        kind: "workload",
        id: `workload-${column._id}`,
        title: `Workload — ${column.name}`,
        subtitle: "who is carrying the assigned records",
        max: data.reduce((m, r) => Math.max(m, r.count), 0),
        total: data.reduce((s, r) => s + r.count, 0),
        data,
    };
}

function completion(trackedColumns: Column[], records: RecordItem[], recordValues: RecordValue[]): BarInsight {
    const data: BarDatum[] = trackedColumns
        .map((column) => {
            const filled = records.filter((r) => {
                const v = valueFor(recordValues, r._id, column._id);
                return v !== undefined && v !== null && v !== "";
            }).length;

            return {
                key: column._id,
                label: column.name,
                value: records.length ? Math.round((filled / records.length) * 100) : 0,
                color: NEUTRAL_BAR_COLOR,
            };
        })
        .sort((a, b) => b.value - a.value);

    return {
        kind: "bar",
        id: "completion",
        title: "Field completion",
        subtitle: "% of records with a value set",
        data,
    };
}

/**
 * The module's growth curve — records created over time, cumulative. Every
 * module has record.createdAt, so this is the one insight that is always
 * available; it leads the list and is Chart view's default. The bucket widens
 * (day → week → month) with the span so a long-lived board stays legible.
 */
function recordsOverTime(records: RecordItem[]): LineInsight | null {
    const stamps = records
        .map((r) => (r.createdAt ? new Date(r.createdAt).getTime() : NaN))
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);

    if (stamps.length < 2) return null;

    const spanDays = (stamps[stamps.length - 1] - stamps[0]) / 86_400_000;
    const bucketDays = spanDays <= 45 ? 1 : spanDays <= 210 ? 7 : 30;
    const bucketMs = bucketDays * 86_400_000;
    const floor = (t: number) => Math.floor(t / bucketMs) * bucketMs;

    const perBucket = new Map<number, number>();
    for (const t of stamps) {
        const k = floor(t);
        perBucket.set(k, (perBucket.get(k) ?? 0) + 1);
    }

    const fmt = (t: number) =>
        new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    let cumulative = 0;
    const data: LinePoint[] = [...perBucket.keys()]
        .sort((a, b) => a - b)
        .map((k) => {
            const added = perBucket.get(k) ?? 0;
            cumulative += added;
            return { t: k, label: fmt(k), value: cumulative, added };
        });

    return {
        kind: "line",
        id: "records-over-time",
        title: "Records over time",
        subtitle:
            bucketDays === 1 ? "cumulative, by day" : bucketDays === 7 ? "cumulative, by week" : "cumulative, by month",
        color: "var(--brand-blue)",
        total: cumulative,
        data,
    };
}

function numberTotal(column: Column, records: RecordItem[], recordValues: RecordValue[]): StatInsight {
    let sum = 0;
    let count = 0;

    for (const record of records) {
        const raw = valueFor(recordValues, record._id, column._id);
        const n = typeof raw === "string" ? parseFloat(raw) : typeof raw === "number" ? raw : NaN;
        if (!isNaN(n)) {
            sum += n;
            count += 1;
        }
    }

    return {
        kind: "stat",
        id: `total-${column._id}`,
        title: `Total ${column.name}`,
        value: sum.toLocaleString(),
        subtitle: count ? `avg ${(sum / count).toFixed(1)} across ${count} record${count === 1 ? "" : "s"}` : "No values yet",
    };
}

export function computeModuleInsights({
    records,
    recordValues,
    columns,
    collections,
    workspaceMembers,
}: {
    records: RecordItem[];
    recordValues: RecordValue[];
    columns: Column[];
    collections: Collection[];
    workspaceMembers: Member[];
}): ModuleInsight[] {
    if (!records.length) return [];

    const insights: ModuleInsight[] = [];
    const trackedColumns = columns.filter((c) => c.scope !== "subrecord");

    const growth = recordsOverTime(records);
    if (growth) insights.push(growth);

    const collections1 = collectionBreakdown(collections, records);
    if (collections1.data.length > 1) insights.push(collections1);

    for (const col of trackedColumns.filter((c) => c.type === "status")) {
        const insight = statusBreakdown(col, records, recordValues);
        if (insight.data.length) insights.push(insight);
    }

    for (const col of trackedColumns.filter((c) => c.type === "person" || c.type === "people")) {
        const insight = workload(col, records, recordValues, workspaceMembers);
        if (insight.data.length) insights.push(insight);
    }

    for (const col of trackedColumns.filter((c) => c.type === "number")) {
        insights.push(numberTotal(col, records, recordValues));
    }

    if (trackedColumns.length) insights.push(completion(trackedColumns, records, recordValues));

    return insights;
}
