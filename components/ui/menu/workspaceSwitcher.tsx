"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiCheck, HiChevronUpDown, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { RiAddLine } from "react-icons/ri";

import { WorkspaceIcon } from "@/lib/workspaceIcons";
import NavTile from "../helpers/navTile";
import type { Workspace } from "@/store/types";

/**
 * The active workspace, and the way to change it.
 *
 * REPLACES the flat "Workspaces" section that used to list every workspace as
 * its own sidebar row. That list answered the wrong question: the sidebar is
 * scanned to find a MODULE, and the workspace rows sat above the module rows
 * looking exactly like them, so the one fact a person actually needs from that
 * corner — which workspace am I in — was the hardest thing on it to see. Worse,
 * it grew without limit: ten workspaces pushed the modules of the one you were
 * using off the bottom of the panel.
 *
 * A switcher inverts that. The current workspace is stated once, in full, at
 * the top; the rest are one click away and never take vertical space until
 * asked for. It is the shape Slack, Linear and Notion all settled on for the
 * same reason.
 *
 * Portalled and positioned from the trigger's own rect, following
 * ModulePicker / BoardAccessMenu — it has to escape the sidebar's
 * `overflow-y-auto`, which would otherwise clip it. The hydration rule comes
 * with the pattern: the `typeof document` guard is safe ONLY because the render
 * is also gated on `open`, which starts false, so the server and the first
 * client render both produce nothing and agree.
 */

/** Width used when the trigger is too narrow to measure against (the rail). */
const RAIL_MENU_WIDTH = 264;

/** Past this many workspaces, scanning a list beats reading it. */
const SEARCH_FROM = 8;

interface MenuPosition {
    top: number;
    left: number;
    width: number;
}

export default function WorkspaceSwitcher({
    workspaces,
    activeId,
    loading,
    collapsed,
    onSelect,
    onCreate,
}: {
    workspaces: Workspace[];
    activeId: string;
    loading: boolean;
    collapsed: boolean;
    onSelect: (workspaceId: string) => void;
    onCreate: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<MenuPosition | null>(null);
    const [query, setQuery] = useState("");

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

        // Capture phase: the sidebar is itself a scroll container, so a scroll
        // that detaches the menu from its trigger may never reach document.
        const onScroll = () => setOpen(false);

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);
        document.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [open]);

    const active = workspaces.find((workspace) => workspace._id === activeId);

    const needle = query.trim().toLowerCase();
    const visible = needle
        ? workspaces.filter((workspace) =>
            workspace.name.toLowerCase().includes(needle)
        )
        : workspaces;

    const toggle = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            // Expanded: match the trigger so the panel reads as an extension of
            // it. Collapsed: the trigger is a 36px square, so use a real width.
            const width = collapsed ? RAIL_MENU_WIDTH : rect.width;

            setPosition({
                top: rect.bottom + 6,
                // Clamped so a rail near the screen edge cannot open a panel
                // that runs off it.
                left: Math.max(
                    12,
                    Math.min(rect.left, window.innerWidth - width - 12)
                ),
                width,
            });
        }

        // Per-opening, not per-session: a list still narrowed by last time's
        // search reads as a list that has lost rows.
        setQuery("");
        setOpen((value) => !value);
    };

    const pick = (workspaceId: string) => {
        onSelect(workspaceId);
        setOpen(false);
    };

    const create = () => {
        setOpen(false);
        onCreate();
    };

    const label = loading
        ? "Loading…"
        : active?.name ?? (workspaces.length === 0 ? "No workspace yet" : "Choose a workspace");

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                title={collapsed ? label : undefined}
                aria-label={collapsed ? `Workspace: ${label}` : undefined}
                className={
                    collapsed
                        ? "nav-glass flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition cursor-pointer"
                        : `flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition cursor-pointer ${open
                            ? "nav-glass border-transparent"
                            : "border-hairline hover:bg-control/50"
                        }`
                }
            >
                {/* Same outlined tile as the brand mark and the nav rows — see
                    LAYOUT.md §7 "Icon tile". It used to be a filled bg-control
                    square, which made the workspace the one icon in the sidebar
                    drawn a different way from every icon above and below it. */}
                {collapsed ? (
                    /* In the rail the BUTTON is already the 36px square (and it
                       is always "active", so it wears nav-glass like an active
                       RailButton) — a second bordered square inside it would
                       draw the same outline twice. */
                    <WorkspaceIcon iconKey={active?.icon} className="h-[18px] w-[18px]" />
                ) : (
                    <NavTile className="h-8 w-8 rounded-lg text-body">
                        <WorkspaceIcon iconKey={active?.icon} className="h-4 w-4" />
                    </NavTile>
                )}

                {!collapsed && (
                    <>
                        {/* leading-none on both lines: the default line-height
                            would push this stack past the trigger's height. */}
                        <span className="min-w-0 flex-1">
                            <span className="block text-[9px] font-semibold uppercase leading-none tracking-wide text-muted">
                                Workspace
                            </span>
                            <span className="mt-1 block truncate text-[13px] font-semibold leading-none text-slate-900">
                                {label}
                            </span>
                        </span>

                        {/* Up-down, not a caret: this SWITCHES between peers
                            rather than revealing something underneath. */}
                        <HiChevronUpDown className="h-4 w-4 shrink-0 text-muted" />
                    </>
                )}
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        style={{
                            top: position.top,
                            left: position.left,
                            width: position.width,
                        }}
                        className="fixed z-50 overflow-hidden rounded-xl border border-hairline bg-card shadow-xl font-google-sans"
                    >
                        {workspaces.length >= SEARCH_FROM && (
                            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
                                <HiOutlineMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search workspaces"
                                    autoFocus
                                    className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-muted"
                                />
                            </div>
                        )}

                        <div className="max-h-72 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                            {workspaces.length === 0 ? (
                                <p className="px-3 py-4 text-center text-[11px] text-muted">
                                    No workspaces yet.
                                </p>
                            ) : visible.length === 0 ? (
                                <p className="px-3 py-4 text-center text-[11px] text-muted">
                                    No workspace matches that.
                                </p>
                            ) : (
                                visible.map((workspace) => {
                                    const selected = workspace._id === activeId;

                                    return (
                                        <button
                                            key={workspace._id}
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            onClick={() => pick(workspace._id)}
                                            className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition cursor-pointer ${selected
                                                ? "nav-glass text-foreground"
                                                : "text-slate-700 hover:bg-control/60"
                                                }`}
                                        >
                                            <span
                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected
                                                    ? "bg-control-hover text-foreground"
                                                    : "bg-control text-muted"
                                                    }`}
                                            >
                                                <WorkspaceIcon
                                                    iconKey={workspace.icon}
                                                    className="h-3.5 w-3.5"
                                                />
                                            </span>

                                            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                                                {workspace.name}
                                            </span>

                                            {/* The count is what distinguishes
                                                two similarly named workspaces
                                                at a glance. */}
                                            <span
                                                className={`shrink-0 text-[11px] font-medium tabular-nums ${selected ? "text-body" : "text-muted"
                                                    }`}
                                            >
                                                {workspace.totalModules ?? 0}
                                            </span>

                                            {selected && (
                                                <HiCheck className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={create}
                            className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-control/60 hover:text-accent cursor-pointer"
                        >
                            <RiAddLine className="h-4 w-4 shrink-0" />
                            Create workspace
                        </button>
                    </div>,
                    document.body
                )}
        </>
    );
}
