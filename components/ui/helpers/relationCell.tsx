"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, Search, Check, X, Loader2 } from "lucide-react";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useModuleRecords } from "@/store/useModuleData";
import type { Column, RecordItem, RecordValue } from "@/store/types";
import {
    mirrorCellStyle,
    summariseMirror,
    type MirrorAggregate,
} from "@/lib/mirror";

/**
 * A relation cell: pick a value from another module and it shows against this
 * record.
 *
 * The list offers the MIRRORED values, not record names — the column was set up
 * to mirror one specific column, so that is what you choose from. Only the
 * linked record's id is stored (a JSON array, the same encoding person cells use
 * for users); the value is resolved server-side on every read, which is why
 * editing the source updates every row pointing at it.
 */
export function parseRelationValue(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw !== "string") return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        return parsed ? [String(parsed)] : [];
    } catch {
        return raw.trim() ? [raw.trim()] : [];
    }
}

interface RelationCellProps {
    record: RecordItem;
    column: Column;
    recordValue?: RecordValue;
    /** Resolved server-side; present once the column mirrors a field. */
    resolved?: { display: string; numeric?: number };
    width: number | string;
    /** Returns a promise when the caller writes asynchronously — awaited so the
     *  chip can show the write finishing rather than guessing. */
    onSave: (
        record: RecordItem,
        column: Column,
        value: string,
        recordValue?: RecordValue
    ) => void | Promise<boolean | void>;
}

const PANEL_WIDTH = 280;

export default function RelationCell({
    record,
    column,
    recordValue,
    resolved,
    width,
    onSave,
}: RelationCellProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    /**
     * Which chip is mid-write, and which just finished. Keyed by record id so
     * two quick picks each show their own progress instead of one shared
     * spinner that says nothing about which value is landing.
     */
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    const anchorRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const targetModuleId = column.settings?.targetModule ?? "";

    // The far module's records come through the same cache the board uses, so
    // opening a picker on a module already on screen costs nothing.
    const { data: collections = [] } = useGetCollectionsQuery(targetModuleId, {
        skip: !targetModuleId || !open,
    });

    const collectionIds = open
        ? collections.map((collection) => collection._id)
        : [];

    // Values as well as records: the picker lists what will be mirrored.
    const { records: targetRecords, recordValues: targetValues } =
        useModuleRecords(collectionIds);

    const displayField = column.settings?.displayField ?? "";

    /**
     * What this row would show for a given target record.
     *
     * `column` arrives POPULATED from the API, so it is an object here and an
     * id string elsewhere — comparing it with String() produced
     * "[object Object]", which matched nothing and made every value read Empty.
     */
    const valueByRecord = new Map<string, string>();

    if (displayField) {
        targetValues.forEach((value) => {
            const columnId =
                typeof value.column === "string"
                    ? value.column
                    : String(value.column?._id ?? "");

            if (columnId === displayField) {
                valueByRecord.set(String(value.record), String(value.value ?? ""));
            }
        });
    }

    const mirroredValue = (item: RecordItem) =>
        displayField ? valueByRecord.get(item._id) ?? "" : item.name ?? "";

    const aggregate = (column.settings?.aggregate ?? "list") as MirrorAggregate;

    const selectedIds = parseRelationValue(recordValue?.value);

    const selected = selectedIds
        .map((id) => targetRecords.find((item) => item._id === id))
        .filter(Boolean) as RecordItem[];

    const filtered = (() => {
        const term = query.trim().toLowerCase();

        const list = term
            ? targetRecords.filter(
                (item) =>
                    (item.name ?? "").toLowerCase().includes(term) ||
                    mirroredValue(item).toLowerCase().includes(term)
            )
            : targetRecords;

        // Linked records first, so what is already chosen stays visible.
        return [...list].sort(
            (a, b) =>
                Number(selectedIds.includes(b._id)) - Number(selectedIds.includes(a._id))
        );
    })();

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
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

    const commit = async (ids: string[], marker?: string) => {
        if (marker) {
            setSavingId(marker);
            setSavedId(null);
        }

        try {
            const saved = await onSave(
                record,
                column,
                ids.length ? JSON.stringify(ids) : "",
                recordValue
            );

            // A rejected write already raised a toast; the ring must not then
            // complete as though it had landed.
            if (marker && saved !== false) {
                // Held long enough to read as "done", not as a flicker.
                setSavedId(marker);
                window.setTimeout(
                    () => setSavedId((current) => (current === marker ? null : current)),
                    1200
                );
            }
        } finally {
            if (marker) setSavingId((current) => (current === marker ? null : current));
        }
    };

    const toggle = (id: string) =>
        commit(
            selectedIds.includes(id)
                ? selectedIds.filter((existing) => existing !== id)
                : [...selectedIds, id],
            id
        );

    const openPanel = () => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 6,
                left: Math.max(
                    12,
                    Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 12)
                ),
            });
        }

        setQuery("");
        setOpen((value) => !value);
    };

    /**
     * The server re-resolves the whole board after a pick, which takes a round
     * trip — long enough that the cell looked like it had not changed. Once the
     * picker has loaded the far module we can work the same answer out locally,
     * so the new value lands immediately and the refetch merely confirms it.
     */
    /**
     * A SUB-RECORD mirror can never be worked out here: its value lives on the
     * linked record's children, which this picker does not load, so the local
     * answer would be an empty string and would hide the one the server already sent.
     * That case waits for the round trip instead.
     */
    const mirrorsSubRecords = column?.settings?.targetScope === "subrecord";

    const localSummary =
        targetRecords.length > 0 && !mirrorsSubRecords
            ? summariseMirror(selected.map(mirroredValue), aggregate)
            : null;

    /**
     * Local only once the far module is actually loaded — which happens when the
     * picker opens. On a fresh page load nothing is loaded and `selected` cannot
     * resolve, so an empty local summary would hide the value the server already
     * worked out.
     */
    const shown = localSummary ?? resolved;

    const MAX_VISIBLE = 2;
    const visible = selected.slice(0, MAX_VISIBLE);
    const overflow = selected.length - visible.length;

    return (
        <div
            ref={anchorRef}
            className="flex h-8 shrink-0 items-center justify-center border-r border-slate-300 px-2 font-dmsans"
            style={{ width, ...(displayField ? mirrorCellStyle : {}) }}
        >
            <button
                type="button"
                onClick={openPanel}
                title={
                    !targetModuleId
                        ? "This column has no module to mirror"
                        : selected.length === 0
                            ? "Pick a value to mirror"
                            : displayField
                                ? `Mirrored from ${selected
                                    .map((item) => item.name)
                                    .join(", ")} — edit it there`
                                : selected.map((item) => item.name).join(", ")
                }
                className="group/rel flex h-full w-full items-center justify-center gap-1 border-none bg-transparent outline-none cursor-pointer"
            >
                {displayField && shown?.display ? (
                    /* Mirrored: show the value, not the record it came from. */
                    <span
                        className={`w-full truncate text-xs ${typeof shown.numeric === "number"
                            ? "text-right font-semibold tabular-nums text-slate-800"
                            : "text-slate-700"
                            }`}
                    >
                        {shown.display}
                    </span>
                ) : selected.length > 0 ? (
                    <span className="flex min-w-0 items-center gap-1">
                        {visible.map((item) => (
                            <span
                                key={item._id}
                                className="max-w-[90px] truncate rounded-md border border-slate-200 bg-control px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                            >
                                {mirroredValue(item) || item.name}
                            </span>
                        ))}

                        {overflow > 0 && (
                            <span className="rounded-md bg-control px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                +{overflow}
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted transition group-hover/rel:text-accent">
                        <Link2 className="h-3.5 w-3.5" />
                        Link
                    </span>
                )}
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={panelRef}
                        style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
                        className="fixed z-50 overflow-hidden rounded-xl border border-slate-300 bg-card shadow-2xl font-dmsans"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {!targetModuleId ? (
                            <p className="px-3 py-6 text-center text-xs text-muted">
                                This relation has no module to link to. Recreate the column
                                and pick one.
                            </p>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 border-b border-slate-200 px-2.5 py-2">
                                    <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                                    <input
                                        autoFocus
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Search values"
                                        className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
                                    />
                                </div>

                                {selected.length > 0 && (
                                    <div className="flex flex-wrap gap-1 border-b border-slate-200 px-2.5 py-2">
                                        {selected.map((item) => {
                                            const saving = savingId === item._id;
                                            const saved = savedId === item._id;

                                            return (
                                                <span
                                                    key={item._id}
                                                    className={`inline-flex mirror-ring ${saving ? "mirror-ring--saving" : ""} ${saved ? "mirror-ring--saved" : ""}`}
                                                    title={
                                                        saving
                                                            ? "Saving…"
                                                            : saved
                                                                ? "Saved"
                                                                : mirroredValue(item) || item.name
                                                    }
                                                >
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-control py-0.5 pl-2 pr-1 text-[11px] text-foreground">
                                                        <span className="max-w-[110px] truncate">
                                                            {mirroredValue(item) || item.name}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            onClick={() => toggle(item._id)}
                                                            disabled={saving}
                                                            title="Unlink"
                                                            className="text-muted transition hover:text-accent disabled:opacity-40 cursor-pointer"
                                                        >
                                                            {saving ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : saved ? (
                                                                <Check className="h-3 w-3 text-accent" />
                                                            ) : (
                                                                <X className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="max-h-56 overflow-y-auto py-1">
                                    {filtered.length === 0 && (
                                        <p className="px-3 py-4 text-center text-[11px] text-muted">
                                            Nothing to link here yet.
                                        </p>
                                    )}

                                    {filtered.map((item) => {
                                        const isLinked = selectedIds.includes(item._id);

                                        return (
                                            <button
                                                key={item._id}
                                                type="button"
                                                onClick={() => toggle(item._id)}
                                                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition cursor-pointer ${isLinked ? "bg-control/60" : "hover:bg-control/40"
                                                    }`}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs text-foreground">
                                                        {mirroredValue(item) || (
                                                            <span className="italic text-muted">
                                                                No value yet
                                                            </span>
                                                        )}
                                                    </span>

                                                    {/* The record it belongs to, so an
                                                        empty or repeated value is still
                                                        identifiable. */}
                                                    {displayField && (
                                                        <span className="block truncate text-[10px] text-muted">
                                                            {item.name}
                                                        </span>
                                                    )}
                                                </span>

                                                {savingId === item._id ? (
                                                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
                                                ) : isLinked ? (
                                                    <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>

                                {selected.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => commit([])}
                                        className="w-full border-t border-slate-200 py-1.5 text-[11px] font-medium text-muted transition hover:text-accent cursor-pointer"
                                    >
                                        Unlink all
                                    </button>
                                )}
                            </>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
}
