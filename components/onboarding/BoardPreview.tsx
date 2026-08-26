"use client";

import { CgMenuGridO } from "react-icons/cg";
import { ChevronRight } from "lucide-react";
import { HiOutlinePlus } from "react-icons/hi2";

import { COLUMN_TYPE_OPTIONS, PALETTE } from "@/data/data";
import type { BoardPreset } from "@/lib/onboarding";

/**
 * A miniature of the real board, drawn from the presets the user just picked.
 *
 * Deliberately a MOCK and not the live board component. The board at
 * workspace/[id]/module/[moduleId] is a few thousand lines wired to eight RTK
 * Query caches; it cannot render for a workspace that does not exist yet, and
 * making it able to would mean teaching every one of those hooks about a
 * pretend mode. What matters here is that the user recognises the thing they
 * are about to get, so this copies the board's VISUAL GRAMMAR — the coloured
 * collection rail, the grid of column headers with their type glyphs, the row
 * of cells — at a size that fits beside the form.
 *
 * The column names and types are the real ones from lib/onboarding.ts, so the
 * preview is not decorative: what is drawn here is what gets created.
 */

const typeIcon = (type: string) =>
    COLUMN_TYPE_OPTIONS.find(
        (option: { value: string }) => option.value === type
    )?.icon;

/** Enough placeholder rows to read as a table, few enough to stay a preview. */
const GHOST_ROWS = 3;

export default function BoardPreview({
    boards,
    workspaceName,
}: {
    boards: BoardPreset[];
    workspaceName: string;
}) {
    if (boards.length === 0) {
        return (
            <div className="flex h-full items-center justify-center px-8 text-center">
                <p className="max-w-xs text-sm text-muted">
                    Pick at least one board and it will appear here, exactly as it
                    will look once your account is ready.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <CgMenuGridO className="h-4 w-4" />
                <span className="truncate">
                    {workspaceName.trim() || "Your workspace"}
                </span>
                <ChevronRight className="h-3 w-3" />
                <span>{boards.length} board{boards.length === 1 ? "" : "s"}</span>
            </div>

            {boards.map((board, index) => {
                // Same hashed palette the real collections use, so the rail
                // colour a user sees here is the one they will see inside.
                const swatch = PALETTE[index % PALETTE.length];

                return (
                    <div
                        key={board.key}
                        className="overflow-hidden rounded-xl border border-hairline bg-card shadow-sm"
                    >
                        {/* Collection bar — the coloured rail plus a name, as on
                            the board itself. */}
                        <div className="flex items-center gap-2 px-3 py-2">
                            <span
                                className="h-4 w-1 shrink-0 rounded-full"
                                style={{ backgroundColor: swatch.accent }}
                            />
                            <span
                                className="text-[13px] font-bold"
                                style={{ color: swatch.accent }}
                            >
                                {board.name}
                            </span>
                            <span className="text-[11px] text-muted">
                                {GHOST_ROWS} records
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {/* Header row */}
                                <div className="flex border-y border-hairline bg-panel/60">
                                    <div className="w-40 shrink-0 border-r border-hairline px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                        Record
                                    </div>

                                    {board.columns.map((column) => {
                                        const Icon = typeIcon(column.type);

                                        return (
                                            <div
                                                key={column.name}
                                                className="flex w-28 shrink-0 items-center gap-1 border-r border-hairline px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted"
                                            >
                                                {Icon && <Icon className="h-3 w-3 shrink-0" />}
                                                <span className="truncate">{column.name}</span>
                                            </div>
                                        );
                                    })}

                                    <div className="flex w-10 shrink-0 items-center justify-center py-2 text-muted">
                                        <HiOutlinePlus className="h-3 w-3" />
                                    </div>
                                </div>

                                {/* Ghost rows — bars, not lorem ipsum. Fake data
                                    reads as real data and would have the user
                                    wondering where "Acme Corp" came from. */}
                                {Array.from({ length: GHOST_ROWS }).map((_, row) => (
                                    <div
                                        key={row}
                                        className="flex border-b border-hairline last:border-b-0"
                                    >
                                        <div className="w-40 shrink-0 border-r border-hairline px-3 py-2.5">
                                            <span
                                                className="block h-2 rounded-full bg-control"
                                                style={{ width: `${64 - row * 9}%` }}
                                            />
                                        </div>

                                        {board.columns.map((column, cell) => (
                                            <div
                                                key={column.name}
                                                className="w-28 shrink-0 border-r border-hairline px-2 py-2.5"
                                            >
                                                {column.type === "status" ? (
                                                    <span
                                                        className="block h-3.5 w-14 rounded"
                                                        style={{
                                                            backgroundColor: swatch.bg,
                                                            border: `1px solid ${swatch.accent}40`,
                                                        }}
                                                    />
                                                ) : column.type === "person" ? (
                                                    <span className="block h-4 w-4 rounded-full bg-control" />
                                                ) : (
                                                    <span
                                                        className="block h-2 rounded-full bg-control"
                                                        style={{
                                                            width: `${70 - ((row + cell) % 3) * 14}%`,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        ))}

                                        <div className="w-10 shrink-0" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
