"use client";

import { useMemo, useState } from "react";
import { HiOutlineListBullet } from "react-icons/hi2";
import { MdOutlineTipsAndUpdates } from "react-icons/md";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useModuleRecords } from "@/store/useModuleData";
import { useGetMembersQuery } from "@/store/api/members.api";
import { DEFAULT_STATUS_OPTIONS, COLLECTION_COLOR_PALETTE } from "@/data/data";
import { PersonAvatar, memberUserId, parsePeopleValue } from "@/components/ui/helpers/personCell";
import { timeAgo } from "@/lib/relativeTime";
import { byUserOrder } from "@/lib/sortCollections";
import RecordAmendmentsPanel from "@/components/RecordAmendmentsPanel";
import type { Collection, Column, Member, RecordItem, RecordValue } from "@/store/types";

/**
 * The List view: every record in the module, grouped under its collection,
 * each group a plain vertical list — no drag-and-drop, just names down the
 * left with a fixed set of read-only columns squared up on the right (status,
 * assignees, amendment count, last updated). Cell values live in Collection
 * view; the columns here are for scanning, not editing.
 *
 * GROUPED BY COLLECTION, same headings Collection view uses (name, colour
 * dot, count) — the owner asked for this explicitly after an earlier pass
 * flattened everything into one list with a per-row collection badge instead.
 *
 * ORDER matches the board's own order — collections sorted by byUserOrder
 * (shared with CollectionView, extracted to lib/sortCollections.ts once a
 * second file needed it), then each record's position within its collection.
 * An empty collection still gets its heading, with a quiet "No records"
 * line, so the count in the header is never a promise the list under it
 * breaks.
 *
 * The right columns are fixed-width cells divided by a hairline `border-l`,
 * every value centred, so the eye scans one column down the page rather than
 * chasing a ragged right edge. An empty cell still renders (a muted dash) so
 * the dividers line up row to row.
 */

const COL = {
    status: "w-32",
    people: "w-20",
    amendments: "w-16",
    updated: "w-24",
};

/** Every right-hand cell: fixed width, centred, divided from its neighbour. */
const CELL = "flex shrink-0 items-center justify-center border-l border-hairline px-2 py-2.5";

const statusValueFor = (recordValues: RecordValue[], recordId: string, column?: Column) => {
    if (!column) return undefined;
    const rv = recordValues.find(
        (v) => v.record === recordId && (typeof v.column === "string" ? v.column : v.column._id) === column._id
    );
    if (!rv) return undefined;
    return typeof rv.value === "string" ? rv.value : (rv.value as { label?: string } | undefined)?.label;
};

const assignedTo = (recordValues: RecordValue[], recordId: string, column: Column | undefined, members: Member[]) => {
    if (!column) return [];
    const rv = recordValues.find(
        (v) => v.record === recordId && (typeof v.column === "string" ? v.column : v.column._id) === column._id
    );
    return parsePeopleValue(rv?.value)
        .map((id) => members.find((m) => memberUserId(m) === id))
        .filter((m): m is Member => Boolean(m));
};

function ListRow({
    record,
    recordValues,
    statusColumn,
    personColumn,
    workspaceMembers,
    onOpen,
}: {
    record: RecordItem;
    recordValues: RecordValue[];
    statusColumn?: Column;
    personColumn?: Column;
    workspaceMembers: Member[];
    onOpen: (record: RecordItem) => void;
}) {
    const statusLabel = statusValueFor(recordValues, record._id, statusColumn);
    const statusOption = statusLabel
        ? (statusColumn?.statusOptions?.length ? statusColumn.statusOptions : DEFAULT_STATUS_OPTIONS).find(
            (o) => o.label === statusLabel
        )
        : undefined;

    const assigned = assignedTo(recordValues, record._id, personColumn, workspaceMembers);
    const amendmentCount = record.amendmentCount ?? 0;

    return (
        <button
            type="button"
            onClick={() => onOpen(record)}
            className="flex w-full items-stretch text-left transition hover:bg-control/40 cursor-pointer"
        >
            <span className="flex min-w-0 flex-1 items-center px-4 py-2.5">
                <span className="truncate text-sm font-semibold text-foreground font-google-sans">
                    {record.name}
                </span>
            </span>

            {/* Status */}
            <span className={`${CELL} ${COL.status}`}>
                {statusOption ? (
                    <span
                        className="max-w-full truncate rounded px-2 py-0.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: statusOption.color }}
                    >
                        {statusOption.label}
                    </span>
                ) : (
                    <span className="text-xs text-muted">–</span>
                )}
            </span>

            {/* Assignees */}
            <span className={`${CELL} ${COL.people}`}>
                {assigned.length > 0 ? (
                    <span className="flex items-center -space-x-1.5">
                        {assigned.slice(0, 3).map((m) => (
                            <PersonAvatar key={memberUserId(m)} member={m} size={20} showPresence />
                        ))}
                        {assigned.length > 3 && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-control text-[8px] font-semibold text-muted ring-2 ring-card">
                                +{assigned.length - 3}
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="text-xs text-muted">–</span>
                )}
            </span>

            {/* Amendments */}
            <span className={`${CELL} ${COL.amendments} gap-1 text-[11px] font-semibold ${amendmentCount > 0 ? "text-body" : "text-muted"}`}>
                <MdOutlineTipsAndUpdates className="h-3.5 w-3.5" />
                {amendmentCount}
            </span>

            {/* Updated */}
            <span className={`${CELL} ${COL.updated} text-[11px] text-muted`}>
                {timeAgo(record.updatedAt ?? record.createdAt)}
            </span>
        </button>
    );
}

export default function ListView({
    workspaceId,
    moduleId,
}: {
    workspaceId: string;
    moduleId: string;
}) {
    const { data: collectionsData = [] } = useGetCollectionsQuery(moduleId, { skip: !moduleId });
    const collections = useMemo(() => [...collectionsData].sort(byUserOrder), [collectionsData]);
    const collectionIds = useMemo(() => collections.map((c) => c._id), [collections]);

    const { records, recordValues } = useModuleRecords(collectionIds);

    const { data: columns = [] } = useGetColumnsQuery(moduleId, { skip: !moduleId });

    const statusColumn = useMemo(
        () => columns.find((c) => c.type === "status" && c.scope !== "subrecord"),
        [columns]
    );
    const personColumn = useMemo(
        () => columns.find((c) => (c.type === "person" || c.type === "people") && c.scope !== "subrecord"),
        [columns]
    );

    const { data: workspaceMembers = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });

    const [amendmentsRecord, setAmendmentsRecord] = useState<RecordItem | null>(null);

    const recordsByCollection = useMemo(() => {
        const map = new Map<string, RecordItem[]>();
        for (const record of records) {
            const list = map.get(record.collectionName) ?? [];
            list.push(record);
            map.set(record.collectionName, list);
        }
        for (const list of map.values()) list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return map;
    }, [records]);

    const colorFor = (collection: Collection, index: number) =>
        collection.color || COLLECTION_COLOR_PALETTE[index % COLLECTION_COLOR_PALETTE.length];

    if (!collections.length) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center font-dmsans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlineListBullet size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">No records yet</h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Add a collection from Collection view — its records show up here as a
                        plain list.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="pl-8 pt-2 flex-1 flex flex-col overflow-hidden">
            <div className="mb-2 flex shrink-0 items-baseline gap-2 pr-8">
                <h3 className="text-sm font-semibold text-body font-dmsans">List</h3>
                <span className="text-xs text-muted font-dmsans">{records.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-8 pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                <div className="space-y-5">
                    {collections.map((collection, index) => {
                        const collectionRecords = recordsByCollection.get(collection._id) ?? [];
                        const color = colorFor(collection, index);

                        return (
                            <div key={collection._id}>
                                <div className="mb-1.5 flex items-baseline gap-2 px-1">
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                    <h4
                                        className="text-xs font-bold uppercase tracking-wide font-google-sans"
                                        style={{ color }}
                                    >
                                        {collection.name}
                                    </h4>
                                    <span className="text-[11px] text-muted font-dmsans">
                                        {collectionRecords.length}
                                    </span>
                                </div>

                                <div
                                    className="divide-y divide-hairline overflow-hidden rounded-xl border bg-card"
                                    style={{ borderColor: "var(--hairline)", borderLeft: `3px solid ${color}` }}
                                >
                                    {collectionRecords.length === 0 ? (
                                        <p className="px-4 py-3 text-xs text-muted font-dmsans">No records</p>
                                    ) : (
                                        collectionRecords.map((record) => (
                                            <ListRow
                                                key={record._id}
                                                record={record}
                                                recordValues={recordValues}
                                                statusColumn={statusColumn}
                                                personColumn={personColumn}
                                                workspaceMembers={workspaceMembers}
                                                onOpen={setAmendmentsRecord}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <RecordAmendmentsPanel
                key={amendmentsRecord?._id ?? "closed"}
                record={amendmentsRecord}
                workspaceId={workspaceId}
                collectionId={amendmentsRecord?.collectionName ?? ""}
                onClose={() => setAmendmentsRecord(null)}
            />
        </div>
    );
}
