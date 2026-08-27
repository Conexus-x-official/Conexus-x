"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiCheck, HiChevronDown, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { TbLayoutGrid } from "react-icons/tb";

import type { ModuleRef } from "./shared";

/**
 * The module this page is written against.
 *
 * A hand-built dropdown rather than a native <select> because a native one
 * cannot be styled to match anything around it — its popup is drawn by the OS,
 * so it ignores the theme entirely and looks like a stray form control on a
 * page made of cards. Everywhere else in this app that needs a menu is already
 * a portalled panel (BoardAccessMenu, relationCell), and this now matches them.
 *
 * PORTALLED, and positioned from the trigger's own rect, so it escapes the
 * toolbar's overflow instead of being clipped by it.
 *
 * The hydration rule from BoardAccessMenu applies unchanged: the `typeof
 * document` guard is only safe because the render is ALSO gated on `open`,
 * which starts false — server and first client render therefore both produce
 * nothing and agree.
 */

const MENU_WIDTH = 260;

/** Past this many modules, scanning a list beats reading it. */
const SEARCH_FROM = 8;

export default function ModulePicker({
    modules,
    value,
    onChange,
    label = "Module"
}: {
    modules: ModuleRef[];
    value: string;
    onChange: (moduleId: string) => void;
    /** What the picker is choosing, said above the name. */
    label?: string;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
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

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const selected = modules.find((m) => m._id === value);

    const visible = query.trim()
        ? modules.filter((m) =>
            m.name.toLowerCase().includes(query.trim().toLowerCase())
        )
        : modules;

    const toggle = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 6,
                // Clamped so a trigger near the right edge does not open a panel
                // that runs off the screen.
                left: Math.max(
                    12,
                    Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12)
                )
            });
        }

        // The filter is per-opening, not per-session: a list still narrowed by
        // last time's search reads as a list that has lost rows.
        setQuery("");
        setOpen((v) => !v);
    };

    const pick = (moduleId: string) => {
        onChange(moduleId);
        setOpen(false);
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                /* CONTROL_HEIGHT, not padding: this sits beside the scope
                   toggle, and two controls whose heights come from unrelated
                   padding sums only line up by luck. Both are pinned instead. */
                className="flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-card px-3 text-left transition hover:border-slate-400 cursor-pointer font-dmsans"
            >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600">
                    <TbLayoutGrid className="h-3.5 w-3.5" />
                </span>

                {/* leading-none on both lines — default line-height would push
                    the stack past the height above. */}
                <span className="min-w-0">
                    <span className="block text-[9px] font-medium uppercase leading-none tracking-wide text-muted">
                        {label}
                    </span>
                    <span className="mt-1 block max-w-[180px] truncate text-xs font-semibold leading-none text-slate-900">
                        {selected?.name ?? "Choose…"}
                    </span>
                </span>

                <HiChevronDown
                    className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
                        className="fixed z-50 overflow-hidden rounded-xl border border-hairline bg-panel shadow-xl font-dmsans"
                    >
                        {modules.length >= SEARCH_FROM && (
                            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
                                <HiOutlineMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search modules"
                                    autoFocus
                                    className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-muted"
                                />
                            </div>
                        )}

                        <div className="max-h-72 overflow-y-auto py-1">
                            {visible.length === 0 ? (
                                <p className="px-3 py-4 text-center text-[11px] text-muted">
                                    No module matches that.
                                </p>
                            ) : (
                                visible.map((module) => {
                                    const active = module._id === value;

                                    return (
                                        <button
                                            key={module._id}
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            onClick={() => pick(module._id)}
                                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition cursor-pointer ${active
                                                ? "nav-glass text-slate-900"
                                                : "text-slate-700 hover:bg-control"
                                                }`}
                                        >
                                            <span className="min-w-0 flex-1 truncate">
                                                {module.name}
                                            </span>

                                            {active && <HiCheck className="h-3.5 w-3.5 shrink-0" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
