"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineChevronDown, HiCheck } from "react-icons/hi2";

const WIDTH = 220;

/**
 * A compact anchored dropdown for picking one named item out of a short
 * list — Kanban's "Grouped by <status column>", Calendar's "Scheduled by
 * <date column>", Form's "Add to <collection>". Same portal+anchor shape as
 * ViewPicker/BoardAccessMenu, extracted once two views needed the identical
 * control (originally as ColumnPicker, renamed ItemPicker once a third and
 * fourth caller wanted the same thing for something that is not a column —
 * the component itself was always this generic, only the name lagged).
 */
export default function ItemPicker({
    label,
    heading,
    items,
    active,
    onChange,
}: {
    /** e.g. "Grouped by" — read before the active item's name on the trigger. */
    label: string;
    /** e.g. "Group by" — the menu's own section heading. */
    heading: string;
    items: { _id: string; name: string }[];
    active: { _id: string; name: string };
    onChange: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const anchorRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const toggle = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 6, left: rect.left });
        }
        setOpen((v) => !v);
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onClick={toggle}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
                {label} <span className="text-slate-900">{active.name}</span>
                <HiOutlineChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                        <div
                            ref={menuRef}
                            style={{ top: position.top, left: position.left, width: WIDTH }}
                            className="fixed z-50 overflow-hidden rounded-xl border border-gray-200 bg-card shadow-lg font-dmsans animate-in fade-in zoom-in-95 duration-100"
                        >
                            <div className="border-b border-slate-100 px-3 py-2">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                    {heading}
                                </p>
                            </div>
                            {items.map((item) => (
                                <button
                                    key={item._id}
                                    type="button"
                                    onClick={() => {
                                        onChange(item._id);
                                        setOpen(false);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                                >
                                    <span className="flex-1 truncate">{item.name}</span>
                                    {item._id === active._id && (
                                        <HiCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </>,
                    document.body
                )}
        </>
    );
}
