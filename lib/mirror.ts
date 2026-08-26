// lib/mirror.ts

/**
 * How a mirror cell looks, and how several picked values collapse into one.
 *
 * The summariser mirrors summariseReference() in
 * backend/services/reference.service.ts — change both together. The SERVER is
 * authoritative; this copy exists only so a cell can show the new value the
 * instant it is picked, instead of waiting for the round trip that re-resolves
 * the board.
 */

export type MirrorAggregate = "list" | "count" | "sum" | "avg" | "min" | "max";

/** A mirrored value is derived from elsewhere, so it is tinted, not plain. */
export const MIRROR_TINT = "#6A00FF";

export const mirrorCellStyle = {
    backgroundColor: `${MIRROR_TINT}0F`,
    boxShadow: `inset 2px 0 0 0 ${MIRROR_TINT}59`,
};

export const mirrorHeaderStyle = {
    backgroundColor: `${MIRROR_TINT}14`,
};

const toNumber = (value: string): number | null => {
    if (!value?.trim()) return null;

    const cleaned = value.replace(/[^0-9.\-]/g, "");

    if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;

    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : null;
};

export const summariseMirror = (
    values: string[],
    aggregate: MirrorAggregate = "list"
): { display: string; numeric?: number } => {

    if (aggregate === "count") {
        return { display: String(values.length), numeric: values.length };
    }

    if (aggregate === "list") {
        return { display: values.filter(Boolean).join(", ") };
    }

    const numbers = values
        .map(toNumber)
        .filter((value): value is number => value !== null);

    if (numbers.length === 0) return { display: "" };

    const total = numbers.reduce((sum, value) => sum + value, 0);

    const result =
        aggregate === "sum"
            ? total
            : aggregate === "avg"
                ? total / numbers.length
                : aggregate === "min"
                    ? Math.min(...numbers)
                    : Math.max(...numbers);

    const rounded = Math.round(result * 100) / 100;

    return { display: String(rounded), numeric: rounded };
};
