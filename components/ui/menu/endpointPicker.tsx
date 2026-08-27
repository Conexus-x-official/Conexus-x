"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiCheck, HiChevronDown, HiOutlineMagnifyingGlass } from "react-icons/hi2";

/**
 * The Data Console's endpoint list, as a dropdown.
 *
 * It used to be a 260px column pinned down the left of the page, which cost a
 * fifth of the screen permanently to answer a question asked once per request.
 * With it gone, the builder and the response sit side by side and you can watch
 * what a parameter does without scrolling between the two.
 *
 * Same mechanics as ModulePicker and BlankMenu — portalled, positioned from the
 * trigger's rect, dismissed on outside mousedown or Escape, search past a
 * handful of rows, query reset on every opening. The keyboard walk is the same
 * too: ↑/↓ move, Enter commits, Escape closes.
 *
 * The hydration rule holds because the render is gated on `open`, which starts
 * false, so the server and the first client render both produce nothing.
 */

export interface EndpointOption {
    id: string;
    name: string;
    path: string;
    group: string;
}

const MENU_WIDTH = 320;
const MAX_HEIGHT = 380;

/** Past this many, scanning a list beats reading it. */
const SEARCH_FROM = 6;

export default function EndpointPicker({
    endpoints,
    groups,
    value,
    onChange
}: {
    endpoints: EndpointOption[];
    /** Group order, so the menu reads in the same order the docs do. */
    groups: readonly string[];
    value: string;
    onChange: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [query, setQuery] = useState("");
    const [cursor, setCursor] = useState(0);

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

        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    const selected = endpoints.find((e) => e.id === value);

    const needle = query.trim().toLowerCase();

    // The PATH is searched as well as the name: someone who knows the API is
    // looking for "/sub-records", not for "List sub-records".
    const visible = endpoints.filter(
        (e) =>
            !needle ||
            e.name.toLowerCase().includes(needle) ||
            e.path.toLowerCase().includes(needle)
    );

    const toggle = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 6,
                left: Math.max(
                    12,
                    Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12)
                )
            });
        }

        setQuery("");
        setCursor(Math.max(0, endpoints.findIndex((e) => e.id === value)));
        setOpen((v) => !v);
    };

    const pick = (id: string) => {
        onChange(id);
        setOpen(false);
    };

    const onKey = (event: React.KeyboardEvent) => {
        if (event.key === "Escape") {
            setOpen(false);
            return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
                toggle();
                return;
            }
            setCursor((c) => {
                if (visible.length === 0) return 0;
                const next = event.key === "ArrowDown" ? c + 1 : c - 1;
                return (next + visible.length) % visible.length;
            });
            return;
        }

        if (event.key === "Enter" && open) {
            event.preventDefault();
            const target = visible[cursor];
            if (target) pick(target.id);
        }
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onClick={toggle}
                onKeyDown={onKey}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-10 min-w-0 max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-card px-3 text-left transition hover:bg-control/50 cursor-pointer"
            >
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                        {selected?.name ?? "Pick an endpoint"}
                    </span>
                </span>

                <span className="hidden shrink-0 truncate font-mono text-[11px] text-muted sm:block">
                    {selected?.path}
                </span>

                <HiChevronDown
                    className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && typeof document !== "undefined" && position &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        onKeyDown={onKey}
                        style={{
                            top: position.top,
                            left: position.left,
                            width: MENU_WIDTH,
                            maxHeight: MAX_HEIGHT
                        }}
                        className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-hairline bg-card shadow-xl font-dmsans"
                    >
                        {endpoints.length > SEARCH_FROM && (
                            <div className="flex shrink-0 items-center gap-1.5 border-b border-hairline px-2.5 py-2">
                                <HiOutlineMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setCursor(0);
                                    }}
                                    onKeyDown={onKey}
                                    placeholder="Search name or path…"
                                    className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-muted"
                                />
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                            {visible.length === 0 && (
                                <p className="px-2.5 py-3 text-center text-[11px] text-muted">
                                    No endpoint matches that.
                                </p>
                            )}

                            {groups.map((group) => {
                                const rows = visible.filter((e) => e.group === group);
                                if (rows.length === 0) return null;

                                return (
                                    <div key={group}>
                                        <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                                            {group}
                                        </p>

                                        {rows.map((item) => {
                                            const isSelected = item.id === value;
                                            const isCursor = visible[cursor]?.id === item.id;

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isSelected}
                                                    onMouseEnter={() =>
                                                        setCursor(
                                                            visible.findIndex((e) => e.id === item.id)
                                                        )
                                                    }
                                                    onClick={() => pick(item.id)}
                                                    className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition cursor-pointer ${isCursor ? "bg-control/60" : ""
                                                        }`}
                                                >
                                                    <span className="min-w-0 flex-1">
                                                        <span
                                                            className={`block truncate text-xs ${isSelected
                                                                ? "font-bold text-slate-900"
                                                                : "font-semibold text-slate-700"
                                                                }`}
                                                        >
                                                            {item.name}
                                                        </span>
                                                        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted">
                                                            {item.path}
                                                        </span>
                                                    </span>

                                                    {isSelected && (
                                                        <HiCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-900" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
