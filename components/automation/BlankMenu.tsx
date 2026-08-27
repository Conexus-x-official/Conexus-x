"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiCheck, HiChevronDown, HiOutlineMagnifyingGlass } from "react-icons/hi2";

import { tokenClass } from "./tokenStyles";

/**
 * THE dropdown behind every blank in the sentence.
 *
 * A native <select> cannot be styled past its box: the popup itself is drawn by
 * the OS, so it ignores the theme, ignores the radius, and in the middle of a
 * themed card it reads as a stray form control someone forgot to finish. That
 * was tolerable when the blanks were a supporting detail; now that the rule IS
 * the form, the list is the thing being read, so it has to be ours.
 *
 * Same mechanics as ModulePicker and BoardAccessMenu, which is the point —
 * every menu in this app should behave identically: portalled and positioned
 * from the trigger's own rect (so a card's overflow cannot clip it), dismissed
 * on outside mousedown or Escape, and FLIPPED above the trigger when there is
 * no room below, which matters here because the THEN column's blanks sit near
 * the bottom of a tall modal.
 *
 * The hydration rule is unchanged: the `typeof document` guard is only safe
 * because the render is also gated on `open`, which starts false — the server
 * and the first client render both produce nothing and therefore agree.
 *
 * KEYBOARD IS RE-EARNED, not lost. A native select gives arrow keys, type-ahead
 * and Enter for free; replacing it means implementing them, so ↑/↓ move the
 * highlight, Enter commits it, Escape closes, and the search box is the
 * type-ahead. Anything less would be a downgrade dressed as a redesign.
 */

export interface BlankOption {
    value: string;
    label: string;
    /** Small grey text under the label — what the option actually holds. */
    hint?: string;
}

export interface BlankGroup {
    label: string;
    options: BlankOption[];
}

/** Past this many options, scanning a list beats reading it. */
const SEARCH_FROM = 8;

const MIN_WIDTH = 240;
const MAX_HEIGHT = 288;

export default function BlankMenu({
    value,
    placeholder,
    options,
    groups,
    onChange,
    title,
    allowCustom = false,
    customHint = "Use what I typed"
}: {
    value?: string;
    placeholder: string;
    options?: BlankOption[];
    groups?: BlankGroup[];
    onChange: (value: string) => void;
    title?: string;
    /**
     * Lets the query itself be committed as the value. This is the workspace-
     * scope column case: a column is addressed by NAME there and may exist on
     * some modules and not others, so the list is a suggestion, not the set of
     * legal answers.
     */
    allowCustom?: boolean;
    customHint?: string;
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

    // One flat list of everything offered, so a grouped menu and a flat one
    // share the same search, the same keyboard walk and the same lookup.
    const all: BlankOption[] = groups
        ? groups.flatMap((group) => group.options)
        : options ?? [];

    const needle = query.trim().toLowerCase();

    const matches = (option: BlankOption) =>
        !needle ||
        option.label.toLowerCase().includes(needle) ||
        (option.hint?.toLowerCase().includes(needle) ?? false);

    const visibleGroups: BlankGroup[] = groups
        ? groups
            .map((group) => ({ ...group, options: group.options.filter(matches) }))
            .filter((group) => group.options.length > 0)
        : [{ label: "", options: all.filter(matches) }];

    const walkable = visibleGroups.flatMap((group) => group.options);

    const selected = all.find((option) => option.value === value);
    /** A custom value survives here: it is a real answer with no row of its own. */
    const shownLabel = selected?.label ?? (value ? value : "");

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

    const toggle = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const width = Math.max(MIN_WIDTH, rect.width);

            // Flip above when the space below cannot hold the panel. A menu
            // that opens off the bottom of the screen is a menu you cannot use.
            const roomBelow = window.innerHeight - rect.bottom;
            const openUp = roomBelow < MAX_HEIGHT && rect.top > roomBelow;

            setPosition({
                top: openUp ? rect.top - 6 - MAX_HEIGHT : rect.bottom + 6,
                left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
                width
            });
        }

        // Per-opening, never per-session: a list still narrowed by last time
        // reads as a list that has lost rows.
        setQuery("");
        setCursor(0);
        setOpen((v) => !v);
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
            setCursor((c) => {
                const next = event.key === "ArrowDown" ? c + 1 : c - 1;
                if (walkable.length === 0) return 0;
                return (next + walkable.length) % walkable.length;
            });
            return;
        }

        if (event.key === "Enter" && open) {
            event.preventDefault();
            const target = walkable[cursor];
            if (target) pick(target.value);
            else if (allowCustom && query.trim()) pick(query.trim());
        }
    };

    const filled = Boolean(shownLabel);

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                title={title}
                onClick={toggle}
                onKeyDown={onKey}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`${tokenClass(filled)} gap-1`}
            >
                <span className="truncate">{shownLabel || placeholder}</span>
                <HiChevronDown
                    className={`h-3 w-3 shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`}
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
                            maxHeight: MAX_HEIGHT
                        }}
                        className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-hairline bg-card shadow-xl font-dmsans"
                    >
                        {(all.length > SEARCH_FROM || allowCustom) && (
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
                                    placeholder={allowCustom ? "Type or pick a name…" : "Search…"}
                                    className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-muted"
                                />
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                            {/* Typed text is offered as its own row rather than
                                committed silently — the user should see what is
                                about to be saved before it is. */}
                            {allowCustom && query.trim() &&
                                !walkable.some(
                                    (o) => o.label.toLowerCase() === query.trim().toLowerCase()
                                ) && (
                                    <button
                                        type="button"
                                        onClick={() => pick(query.trim())}
                                        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition hover:bg-control/60 cursor-pointer"
                                    >
                                        <span className="min-w-0 truncate text-xs font-semibold text-slate-900">
                                            &ldquo;{query.trim()}&rdquo;
                                        </span>
                                        <span className="shrink-0 text-[10px] font-medium text-muted">
                                            {customHint}
                                        </span>
                                    </button>
                                )}

                            {walkable.length === 0 && !allowCustom && (
                                <p className="px-2.5 py-3 text-center text-[11px] text-muted">
                                    Nothing to pick here yet.
                                </p>
                            )}

                            {visibleGroups.map((group) => (
                                <div key={group.label || "flat"}>
                                    {group.label && (
                                        <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                                            {group.label}
                                        </p>
                                    )}

                                    {group.options.map((option) => {
                                        const isSelected = option.value === value;
                                        const isCursor = walkable[cursor]?.value === option.value;

                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onMouseEnter={() =>
                                                    setCursor(
                                                        walkable.findIndex(
                                                            (o) => o.value === option.value
                                                        )
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
                                                        <span className="mt-0.5 block truncate text-[10px] font-medium text-muted">
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
                            ))}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
