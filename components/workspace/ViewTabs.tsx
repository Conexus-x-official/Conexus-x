"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    HiOutlineTableCells,
    HiOutlineViewColumns,
    HiOutlineCalendarDays,
    HiOutlineListBullet,
    HiOutlineClock,
    HiOutlineChartBarSquare,
    HiOutlineSquares2X2,
    HiOutlineDocumentPlus,
    HiOutlineChartBar,
    HiOutlinePresentationChartBar,
    HiOutlinePlus,
    HiOutlineXMark,
    HiCheck,
} from "react-icons/hi2";
import { MdOutlineCollectionsBookmark } from "react-icons/md";

const MENU_WIDTH = 220;

export type BoardViewType =
    | "collection"
    | "kanban"
    | "calendar"
    | "list"
    | "timeline"
    | "gantt"
    | "grid"
    | "form"
    | "chart"
    | "dashboard";

/**
 * Each view carries its own brand colour, ClickUp-style — a white glyph in a
 * solid `chip` (Tailwind-500) so the strip reads as a row of distinct things,
 * not ten grey glyphs. Fixed hexes (never color-mix — Lightning CSS has
 * collapsed color-mix on this codebase before) so a view looks the same in
 * every theme.
 */
const VIEW_META: Record<
    BoardViewType,
    { label: string; icon: typeof HiOutlineTableCells; chip: string }
> = {
    collection: { label: "Collection", icon: MdOutlineCollectionsBookmark, chip: "#6B7280" },
    kanban: { label: "Kanban", icon: HiOutlineViewColumns, chip: "#8B5CF6" },
    calendar: { label: "Calendar", icon: HiOutlineCalendarDays, chip: "#F97316" },
    list: { label: "List", icon: HiOutlineListBullet, chip: "#3B82F6" },
    timeline: { label: "Timeline", icon: HiOutlineClock, chip: "#14B8A6" },
    gantt: { label: "Gantt", icon: HiOutlineChartBarSquare, chip: "#22C55E" },
    grid: { label: "Grid", icon: HiOutlineSquares2X2, chip: "#6366F1" },
    form: { label: "Form", icon: HiOutlineDocumentPlus, chip: "#EC4899" },
    chart: { label: "Chart", icon: HiOutlineChartBar, chip: "#F59E0B" },
    dashboard: { label: "Dashboard", icon: HiOutlinePresentationChartBar, chip: "#0EA5E9" },
};

const VIEW_ORDER: BoardViewType[] = [
    "collection",
    "kanban",
    "calendar",
    "list",
    "timeline",
    "gantt",
    "grid",
    "form",
    "chart",
    "dashboard",
];

/** The tabs a module shows until the user pins others — the three the owner's mock names. */
export const DEFAULT_PINNED_VIEWS: BoardViewType[] = ["collection", "kanban", "calendar"];

/**
 * The module's view switcher, as a ClickUp-style TAB STRIP under the header
 * (the earlier header dropdown was removed — a switcher that hides which views
 * exist behind a closed menu made every view past Collection easy to miss).
 *
 * Only the PINNED views are tabs; "+ View" opens the full list (the same
 * portalled anchor+menu shape as ModulePicker/BoardAccessMenu) and picking
 * one switches to it AND pins it as a new tab. A tab hovers an x to unpin —
 * never the last one, and unpinning the active view falls back to the first
 * tab left (page.tsx owns that). The pinned set and the active view are both
 * remembered per module in localStorage, read effect-free in page.tsx.
 *
 * MAP IS NOT HERE, and not as a "coming soon" line either: this codebase has
 * no location/geo column type at all (see backend/models/Column.ts's `type`
 * enum — monday's own "location" type is one none of ours implement), so
 * there is no real data anywhere to plot. Every other view in this set only
 * exists because a real column type already backs it (Kanban needs status,
 * Calendar needs date, Timeline/Gantt need timeline) — Map fails that test
 * completely, and a placeholder map with nothing real on it would be exactly
 * the "control that looks broken" this whole set has avoided.
 */
export default function ViewTabs({
    active,
    pinned,
    onChange,
    onUnpin,
}: {
    active: BoardViewType;
    pinned: BoardViewType[];
    onChange: (view: BoardViewType) => void;
    onUnpin: (view: BoardViewType) => void;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    const anchorRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };

        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const toggle = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 6,
                left: Math.max(12, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12)),
            });
        }

        setOpen((value) => !value);
    };

    const tabs = pinned.length ? pinned : [active];

    return (
        <div className="flex flex-1 items-end gap-1 border-b border-hairline overflow-x-auto [&::-webkit-scrollbar]:h-0">
            {tabs.map((view) => {
                const meta = VIEW_META[view];
                const Icon = meta.icon;
                const isActive = view === active;

                return (
                    <div
                        key={view}
                        className={`group -mb-px flex shrink-0 items-center gap-0.5 border-b-2 pr-1 text-[13px] font-bold text-foreground transition ${
                            isActive ? "border-foreground" : "border-transparent hover:border-slate-300"
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => onChange(view)}
                            className="flex cursor-pointer items-center gap-1.5 py-2 pl-1.5"
                        >
                            <span
                                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md"
                                style={{ backgroundColor: meta.chip }}
                            >
                                <Icon className="h-3 w-3 text-white" strokeWidth={2} />
                            </span>
                            {meta.label}
                        </button>

                        {tabs.length > 1 && (
                            <button
                                type="button"
                                aria-label={`Unpin ${meta.label} view`}
                                onClick={() => onUnpin(view)}
                                className="shrink-0 cursor-pointer rounded p-0.5 text-muted opacity-0 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100"
                            >
                                <HiOutlineXMark className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                );
            })}

            {/* Separates the "add a view" action from the view tabs themselves. */}
            <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 self-center bg-hairline" />

            <button
                ref={anchorRef}
                type="button"
                onClick={toggle}
                aria-haspopup="true"
                aria-expanded={open}
                title="Add a view"
                className="-mb-px flex shrink-0 cursor-pointer items-center gap-1 border-b-2 border-transparent px-1.5 py-2 text-[13px] font-bold text-foreground transition hover:border-slate-300"
            >
                <HiOutlinePlus className="h-4 w-4" strokeWidth={2} />
                View
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
                        className="fixed z-50 overflow-hidden rounded-xl border border-gray-200 bg-card shadow-lg font-dmsans animate-in fade-in zoom-in-95 duration-100"
                    >
                        <div className="border-b border-slate-100 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                Views
                            </p>
                        </div>

                        {VIEW_ORDER.map((view) => {
                            const meta = VIEW_META[view];
                            const Icon = meta.icon;
                            const isPinned = pinned.includes(view);

                            return (
                                <button
                                    key={view}
                                    type="button"
                                    onClick={() => {
                                        onChange(view);
                                        setOpen(false);
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                                >
                                    <span
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                                        style={{ backgroundColor: meta.chip }}
                                    >
                                        <Icon className="h-3 w-3 text-white" />
                                    </span>
                                    <span className="flex-1">{meta.label}</span>
                                    {isPinned && <HiCheck className="h-3.5 w-3.5 shrink-0 text-accent" />}
                                </button>
                            );
                        })}
                    </div>,
                    document.body
                )}
        </div>
    );
}
