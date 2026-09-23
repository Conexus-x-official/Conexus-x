"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiStar, HiOutlineStar } from "react-icons/hi2";
import type { Column, RecordItem, RecordValue } from "@/store/types";

const MAX_STARS = 5;
const STEP = 0.5;

/** Ratings are stored as a plain number string; half steps are allowed. */
export function parseRating(raw: unknown): number {
    const n = parseFloat(String(raw ?? ""));
    if (isNaN(n)) return 0;
    return Math.min(MAX_STARS, Math.max(0, Math.round(n / STEP) * STEP));
}

export function formatRating(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * One star that can render empty, half or full. The half state is a full star
 * clipped to 50% width laid over an outline, so it reads at any size.
 */
function Star({ fill, size }: { fill: 0 | 0.5 | 1; size: number }) {
    return (
        <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
            <HiOutlineStar size={size} className="absolute inset-0 text-slate-400" />
            {fill > 0 && (
                <span
                    className="absolute inset-0 overflow-hidden text-amber-400"
                    style={{ width: fill === 0.5 ? size / 2 : size }}
                >
                    <HiStar size={size} />
                </span>
            )}
        </span>
    );
}

export function StarRow({
    value,
    size,
    onPick,
    onHover,
}: {
    value: number;
    size: number;
    onPick?: (v: number) => void;
    onHover?: (v: number | null) => void;
}) {
    return (
        <span className="inline-flex items-center gap-0.5" onMouseLeave={() => onHover?.(null)}>
            {Array.from({ length: MAX_STARS }).map((_, i) => {
                const starIndex = i + 1;
                const diff = value - i;
                const fill: 0 | 0.5 | 1 = diff >= 1 ? 1 : diff >= 0.5 ? 0.5 : 0;

                if (!onPick) return <Star key={i} fill={fill} size={size} />;

                // Left half of a star picks x.5, right half picks x.0.
                return (
                    <span key={i} className="relative inline-flex" style={{ width: size, height: size }}>
                        <Star fill={fill} size={size} />
                        <button
                            type="button"
                            aria-label={`Rate ${starIndex - 0.5}`}
                            onMouseEnter={() => onHover?.(starIndex - 0.5)}
                            onClick={() => onPick(starIndex - 0.5)}
                            className="absolute inset-y-0 left-0 w-1/2 cursor-pointer bg-transparent"
                        />
                        <button
                            type="button"
                            aria-label={`Rate ${starIndex}`}
                            onMouseEnter={() => onHover?.(starIndex)}
                            onClick={() => onPick(starIndex)}
                            className="absolute inset-y-0 right-0 w-1/2 cursor-pointer bg-transparent"
                        />
                    </span>
                );
            })}
        </span>
    );
}

interface RatingCellProps {
    record: RecordItem;
    column: Column;
    recordValue?: RecordValue;
    width: number | string;
    onSave: (record: RecordItem, column: Column, value: string, recordValue?: RecordValue) => void;
}

export default function RatingCell({
    record,
    column,
    recordValue,
    width,
    onSave,
}: RatingCellProps) {
    const value = parseRating(recordValue?.value);

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const [hover, setHover] = useState<number | null>(null);

    const anchorRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (anchorRef.current?.contains(t)) return;
            if (panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const commit = (next: number) => {
        setHover(null);
        onSave(record, column, next > 0 ? formatRating(next) : "", recordValue);
    };

    const togglePanel = () => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const PANEL_W = 240;
            const left = Math.min(rect.left, window.innerWidth - PANEL_W - 12);
            setPos({ top: rect.bottom + 6, left: Math.max(12, left) });
        }
        setHover(null);
        setOpen((v) => !v);
    };

    const preview = hover ?? value;

    return (
        <div
            ref={anchorRef}
            className="shrink-0 h-8 border-r border-slate-300 flex items-center justify-center px-2 font-dmsans"
            style={{ width }}
        >
            {/* Collapsed state — click anywhere on the stars to open the large picker. */}
            <button
                type="button"
                onClick={togglePanel}
                className="flex h-full w-full items-center justify-center gap-1.5 cursor-pointer bg-transparent border-none outline-none"
                title={value ? `Rated ${formatRating(value)} of ${MAX_STARS}` : "Add rating"}
            >
                <StarRow value={value} size={15} />
                {value > 0 && (
                    <span className="text-[11px] font-semibold text-amber-500 tabular-nums">
                        {formatRating(value)}
                    </span>
                )}
            </button>

            {open && pos && createPortal(
                <div
                    ref={panelRef}
                    className="fixed z-50 rounded-xl border border-slate-300 bg-card p-3 shadow-2xl font-dmsans"
                    style={{ top: pos.top, left: pos.left, width: 240 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Rating
                        </span>
                        <span className="text-sm font-bold text-amber-500 tabular-nums">
                            {formatRating(preview)}
                        </span>
                    </div>

                    {/* Large targets: each star is 40px, split into two half-step halves. */}
                    <div className="flex justify-center py-1">
                        <StarRow value={preview} size={40} onPick={commit} onHover={setHover} />
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                        <span className="text-[10px] text-muted">Half stars &middot; 0.5 steps</span>
                        <button
                            type="button"
                            onClick={() => commit(0)}
                            className="text-[11px] font-medium text-muted transition hover:text-accent cursor-pointer"
                        >
                            Clear
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
