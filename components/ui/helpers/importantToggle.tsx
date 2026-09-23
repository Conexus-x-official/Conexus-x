"use client";

import { TbLabelImportant, TbLabelImportantFilled } from "react-icons/tb";

import { useUpdateRecordMutation } from "@/store/api/records.api";
import { toast } from "@/components/ui/toast";
import type { RecordItem } from "@/store/types";

/**
 * "Star" a record, email style — Record.isImportant, a plain boolean toggled
 * through the normal updateRecord PUT (optimistic patch, no activity row, no
 * automation trigger). Anyone with board access can flip it.
 *
 * Derives the cache entry to patch from the record itself: a board row lives
 * in getRecords(collectionName), a sub-record in getSubRecords(parentRecord).
 * Always visible — faint when off, amber when on — the way Gmail shows its
 * importance marker, so a starred record reads at a glance without a hover.
 */
export default function ImportantToggle({
    record,
    size = 16,
    className = "",
}: {
    record: RecordItem;
    size?: number;
    className?: string;
}) {
    const [updateRecord, { isLoading }] = useUpdateRecordMutation();
    const important = Boolean(record.isImportant);

    const toggle = async (event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();

        try {
            await updateRecord({
                recordId: record._id,
                collectionId: record.collectionName,
                parentRecordId: record.parentRecord ?? undefined,
                isImportant: !important,
            }).unwrap();
        } catch (error) {
            toast.error(
                "Could not update that record",
                (error as { data?: { message?: string } })?.data?.message ??
                "The server rejected the write."
            );
        }
    };

    const Icon = important ? TbLabelImportantFilled : TbLabelImportant;

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={isLoading}
            aria-pressed={important}
            aria-label={important ? "Unmark important" : "Mark important"}
            title={important ? "Marked important" : "Mark important"}
            className={`shrink-0 cursor-pointer rounded transition disabled:cursor-wait ${important
                ? "text-amber-500 hover:text-amber-600"
                : "text-muted opacity-40 hover:opacity-100 hover:text-amber-500"
                } ${className}`}
        >
            <Icon size={size} strokeWidth={2} />
        </button>
    );
}
