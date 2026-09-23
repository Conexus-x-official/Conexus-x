"use client";

import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    type TooltipContentProps,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

import { PersonAvatar, memberName, memberUserId } from "@/components/ui/helpers/personCell";
import type {
    BarInsight,
    LineInsight,
    ModuleInsight,
    StatInsight,
    WorkloadInsight,
} from "@/lib/moduleInsights";

/**
 * Renders one insight — shared by ChartView (one, large, picked) and
 * DashboardView (all, small, in a grid).
 *
 * Built directly on recharts (already a dependency) but styled to shadcn/ui's
 * chart standard rather than the library's bare defaults: a bordered tooltip
 * card with a colour swatch and a tabular value, a recessive dashed grid, thin
 * 2px lines with a gradient area fill, thin rounded bars. We do NOT pull in
 * shadcn's chart.tsx / its `--color-*` CSS-var indirection — this project
 * already themes through its own semantic tokens (var(--accent) etc.), so the
 * indirection would buy nothing.
 *
 * dataviz method: line = change-over-time (one hue, no legend — the title
 * names the series); bars keep each entity's OWN identity colour (a status is
 * the same colour it is on the Kanban lane); a lone number is a stat tile, not
 * a chart.
 */

const AXIS_TICK = { fontSize: 10, fill: "var(--muted)" };

/** shadcn's tooltip-card shape — a swatch, the point's label, a right-aligned tabular value. */
function ChartTooltipContent({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null;

    const entry = payload[0];
    const point = (entry.payload ?? {}) as { label?: string; color?: string; added?: number };
    const swatch = point.color ?? (entry.color as string | undefined) ?? "var(--accent)";
    const name = point.label ?? (label as string | undefined) ?? String(entry.name ?? "");

    return (
        <div className="rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs shadow-lg">
            <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />
                <span className="font-medium text-body">{name}</span>
                <span className="ml-3 font-mono font-semibold tabular-nums text-foreground">
                    {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
                </span>
            </div>
            {typeof point.added === "number" && (
                <p className="mt-0.5 pl-3.5 text-[10px] text-muted">
                    +{point.added} new
                </p>
            )}
        </div>
    );
}

function LineChartWidget({ insight }: { insight: LineInsight }) {
    if (insight.data.length < 2) {
        return (
            <div className="flex h-full items-center justify-center text-xs text-muted">
                Not enough history yet
            </div>
        );
    }

    const gradientId = `insight-grad-${insight.id}`;

    // height="100%" — the chart fills the flex-sized slot its card gives it,
    // never a hardcoded pixel count that could be taller than the slot and
    // spill the area fill out of the card (the card also clips, as a backstop).
    return (
        <ResponsiveContainer width="100%" height="100%" minHeight={120}>
            <AreaChart data={insight.data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={insight.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={insight.color} stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tick={AXIS_TICK}
                />
                <YAxis
                    width={30}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={AXIS_TICK}
                />
                <Tooltip
                    cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                    content={ChartTooltipContent}
                />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={insight.color}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function BarChartWidget({ insight, height }: { insight: BarInsight; height: number }) {
    if (!insight.data.length) {
        return (
            <div className="flex items-center justify-center text-xs text-muted" style={{ height }}>
                No data yet
            </div>
        );
    }

    // Enough vertical room per bar that a long list does not compress into a
    // smear — a fixed per-row height capped at the caller's height.
    const rowHeight = 30;
    const naturalHeight = insight.data.length * rowHeight + 16;
    const chartHeight = Math.min(height, Math.max(naturalHeight, 90));

    return (
        <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={insight.data} layout="vertical" margin={{ top: 4, right: 34, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis type="number" hide />
                <YAxis
                    type="category"
                    dataKey="label"
                    width={104}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                />
                <Tooltip cursor={{ fill: "var(--control)" }} content={ChartTooltipContent} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                    {insight.data.map((d) => (
                        <Cell key={d.key} fill={d.color} />
                    ))}
                    <LabelList
                        dataKey="value"
                        position="right"
                        style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
                    />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

/**
 * The people-load board — one row per assignee: avatar with a live presence
 * dot, name, a usage bar scaled to the busiest person, and the count. A real
 * roster component rather than a bar chart with names for tick labels.
 */
function WorkloadWidget({ insight, height }: { insight: WorkloadInsight; height: number }) {
    if (!insight.data.length) {
        return (
            <div className="flex items-center justify-center text-xs text-muted" style={{ height }}>
                Nothing assigned yet
            </div>
        );
    }

    return (
        <div
            className="space-y-1.5 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control-hover"
            style={{ maxHeight: height }}
        >
            {insight.data.map((row, i) => {
                const name = memberName(row.member);
                const pct = insight.max ? Math.round((row.count / insight.max) * 100) : 0;
                return (
                    <div
                        key={`${memberUserId(row.member)}-${i}`}
                        className="flex items-center gap-2.5"
                        title={`${name} — ${row.count} assigned`}
                    >
                        <PersonAvatar member={row.member} size={24} showPresence />
                        <span className="w-24 shrink-0 truncate text-xs font-semibold text-body">
                            {name}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-control">
                            <span
                                className="block h-full rounded-full transition-all"
                                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: "var(--brand-blue)" }}
                            />
                        </span>
                        <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
                            {row.count}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function StatWidget({ insight }: { insight: StatInsight }) {
    return (
        <div className="flex h-full flex-col items-start justify-center gap-1 px-0.5">
            <span className="font-google-sans text-3xl font-bold tabular-nums text-foreground">
                {insight.value}
            </span>
            {insight.subtitle && <span className="text-xs text-muted">{insight.subtitle}</span>}
        </div>
    );
}

export default function InsightWidget({
    insight,
    height = 220,
}: {
    insight: ModuleInsight;
    height?: number;
}) {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-hairline bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold text-foreground font-google-sans">
                        {insight.title}
                    </h4>
                    {insight.subtitle && (
                        <p className="mt-0.5 truncate text-[11px] text-muted">{insight.subtitle}</p>
                    )}
                </div>

                {insight.kind === "line" && (
                    <span className="shrink-0 font-google-sans text-xl font-bold tabular-nums text-foreground">
                        {insight.total.toLocaleString()}
                    </span>
                )}
                {insight.kind === "workload" && (
                    <span className="shrink-0 text-[11px] font-medium text-muted">
                        {insight.total} assigned
                    </span>
                )}
            </div>

            <div className="mt-2 min-h-0 flex-1">
                {insight.kind === "line" ? (
                    <LineChartWidget insight={insight} />
                ) : insight.kind === "bar" ? (
                    <BarChartWidget insight={insight} height={height} />
                ) : insight.kind === "workload" ? (
                    <WorkloadWidget insight={insight} height={height} />
                ) : (
                    <StatWidget insight={insight} />
                )}
            </div>
        </div>
    );
}
