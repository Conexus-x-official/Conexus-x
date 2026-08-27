"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiCheck, HiChevronDown, HiOutlineMagnifyingGlass } from "react-icons/hi2";

/**
 * A themed <select> replacement shaped like a FORM FIELD.
 *
 * The app already had this menu twice — EndpointPicker for the console's
 * endpoint list, BlankMenu for the automation builder's sentence blanks — and
 * the rule those two were written under is the one that brings it here: a
 * native select's popup is drawn by the OS, so it ignores the theme, the radius
 * and the dark family entirely, and reads as a stray form control dropped into
 * a themed card. The console's Path and Query pickers were the last native
 * selects on that screen, sitting directly under a header whose own picker is
 * ours.
 *
 * WHY A THIRD COMPONENT AND NOT A PROP ON BlankMenu: that one's trigger is an
 * inline sentence token, sized to its content and styled to be read
 * mid-sentence, and it lives in components/automation/. This trigger is a
 * full-width labelled field. Same menu, different control — bolting a `variant`
 * onto BlankMenu would put an automation import in the developer section and
 * leave one component answering to two layouts.
 *
 * KEYBOARD IS RE-EARNED, not lost: up/down move the highlight, Enter commits,
 * Escape closes, and the search box is the type-ahead. Anything less would be a
 * downgrade dressed as a redesign.
 *
 * The hydration rule holds because the portal is gated on `open`, which starts
 * false — the server and the first client render both produce nothing.
 */

export interface SelectOption {
    value: string;
    label: string;
    /** Small grey text under the label — what the option actually holds. */
    hint?: string;
}

/** Past this many options, scanning a list beats reading it. */
const SEARCH_FROM = 8;

const MIN_WIDTH = 220;
const MAX_HEIGHT = 288;

export default function SelectMenu({
    value,
    options,
    onChange,
    placeholder,
    disabled = false,
    ariaLabel,
    className = "",
}: {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    /** Shown when nothing is picked — and as the row that clears the choice. */
    placeholder: string;
    disabled?: boolean;
    ariaLabel?: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);
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

    const needle = query.trim().toLowerCase();

    const visible = options.filter(
        (option) =>
            !needle ||
            option.label.toLowerCase().includes(needle) ||
            (option.hint?.toLowerCase().includes(needle) ?? false)
    );

    const selected = options.find((option) => option.value === value);

    const toggle = () => {
        if (disabled) return;

        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const width = Math.max(MIN_WIDTH, rect.width);

            // Flip above when the space below cannot hold the panel. These
            // fields sit low in a scrolling column, so "below" is often gone.
            const roomBelow = window.innerHeight - rect.bottom;
            const openUp = roomBelow < MAX_HEIGHT && rect.top > roomBelow;

            setPosition({
                top: openUp ? rect.top - 6 - MAX_HEIGHT : rect.bottom + 6,
                left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
                width,
            });
        }

        // Per-opening, never per-session: a list still narrowed by last time
        // reads as a list that has lost rows.
        setQuery("");
        setCursor(Math.max(0, options.findIndex((option) => option.value === value)));
        setOpen((previous) => !previous);
    };

    const pick = (next: string) => {
        onChange(next);
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
            setCursor((current) => {
                if (visible.length === 0) return 0;
                const next = event.key === "ArrowDown" ? current + 1 : current - 1;
                return (next + visible.length) % visible.length;
            });
            return;
        }

        if (event.key === "Enter" && open) {
            event.preventDefault();
            const target = visible[cursor];
            if (target) pick(target.value);
        }
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                disabled={disabled}
                onClick={toggle}
                onKeyDown={onKey}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                className={`flex h-11 w-full items-center gap-2 rounded-lg border bg-card px-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${open ? "border-slate-400" : "border-slate-200 hover:border-slate-300"
                    } ${className}`}
            >
                <span
                    className={`min-w-0 flex-1 truncate ${selected ? "text-slate-800" : "text-slate-400"
                        }`}
                >
                    {selected?.label ?? placeholder}
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
                            width: position.width,
                            maxHeight: MAX_HEIGHT,
                        }}
                        className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-hairline bg-card shadow-xl font-dmsans"
                    >
                        {options.length > SEARCH_FROM && (
                            <div className="flex shrink-0 items-center gap-1.5 border-b border-hairline px-2.5 py-2">
                                <HiOutlineMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setCursor(0);
                                    }}
                                    onKeyDown={onKey}
                                    placeholder="Search…"
                                    className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-muted"
                                />
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">
                            {/* The placeholder is a real row: a native select's
                                empty <option> was how a choice got undone, and
                                dropping it would make picking one irreversible. */}
                            {!needle && (
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={!value}
                                    onClick={() => pick("")}
                                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-control/60 cursor-pointer"
                                >
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">
                                        {placeholder}
                                    </span>

                                    {!value && (
                                        <HiCheck className="h-3.5 w-3.5 shrink-0 text-slate-900" />
                                    )}
                                </button>
                            )}

                            {visible.length === 0 && (
                                <p className="px-2.5 py-3 text-center text-[11px] text-muted">
                                    {options.length === 0
                                        ? "Nothing here yet."
                                        : "Nothing matches that."}
                                </p>
                            )}

                            {visible.map((option) => {
                                const isSelected = option.value === value;
                                const isCursor = visible[cursor]?.value === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onMouseEnter={() =>
                                            setCursor(
                                                visible.findIndex((o) => o.value === option.value)
                                            )
                                        }
                                        onClick={() => pick(option.value)}
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
                                                {option.label}
                                            </span>

                                            {option.hint && (
                                                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted">
                                                    {option.hint}
                                                </span>
                                            )}
                                        </span>

                                        {isSelected && (
                                            <HiCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-900" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
