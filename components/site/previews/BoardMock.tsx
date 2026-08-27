import { ChevronDown, ChevronRight, Link2, Plus, Search, SlidersHorizontal } from "lucide-react";
import MockFrame from "./MockFrame";

/**
 * A picture of a module board.
 *
 * Copies the real board's grammar: the coloured collection rail, a header row
 * of typed columns, status pills from STATUS_SWATCHES, person avatars, the
 * sub-record chevron, and a mirrored column carrying the violet tint and Link2
 * icon the product uses to mark "read-only, resolved from another module".
 */

const AVATAR = ["#6366F1", "#0EA5A4", "#F59E0B", "#EC4899"];

interface Row {
    name: string;
    status: { label: string; color: string };
    owner: number;
    due: string;
    hours: string;
    /** Draws the expand chevron open, with a sub-record beneath. */
    expanded?: boolean;
    sub?: { name: string; hours: string }[];
}

const COLLECTIONS: { name: string; color: string; rows: Row[] }[] = [
    {
        name: "In progress",
        color: "#6366F1",
        rows: [
            {
                name: "Northwind renewal",
                status: { label: "Working on it", color: "#F59E0B" },
                owner: 0,
                due: "Sep 4",
                hours: "18",
                expanded: true,
                sub: [
                    { name: "Draft the new terms", hours: "6" },
                    { name: "Legal review", hours: "12" },
                ],
            },
            {
                name: "Contoso onboarding",
                status: { label: "Stuck", color: "#EF4444" },
                owner: 1,
                due: "Sep 9",
                hours: "7",
            },
            {
                name: "Fabrikam pilot",
                status: { label: "Working on it", color: "#F59E0B" },
                owner: 2,
                due: "Sep 12",
                hours: "24",
            },
        ],
    },
    {
        name: "Closed",
        color: "#22C55E",
        rows: [
            {
                name: "Tailspin expansion",
                status: { label: "Done", color: "#22C55E" },
                owner: 3,
                due: "Aug 22",
                hours: "31",
            },
            {
                name: "Adventure Works",
                status: { label: "Done", color: "#22C55E" },
                owner: 0,
                due: "Aug 14",
                hours: "9",
            },
        ],
    },
];

/** Column widths, declared once so the header and every row agree. */
const COL = {
    name: "flex-1 min-w-0",
    status: "w-28 shrink-0",
    owner: "w-14 shrink-0",
    due: "w-16 shrink-0",
    hours: "w-16 shrink-0",
};

function Avatar({ i }: { i: number }) {
    return (
        <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: AVATAR[i % AVATAR.length] }}
        >
            {["AM", "JL", "RK", "SP"][i % 4]}
        </span>
    );
}

export default function BoardMock() {
    return (
        <MockFrame label="Deals · Sales workspace" contentMinWidth={560}>
            {/* toolbar */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-muted">
                    <Search className="h-3 w-3" />
                    Search this board
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-muted">
                    <SlidersHorizontal className="h-3 w-3" />
                    Filter
                </span>
                <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
                    <Plus className="h-3 w-3" />
                    New record
                </span>
            </div>

            {/* header */}
            <div className="flex items-center gap-3 border-b border-gray-200/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                <span className="w-4 shrink-0" />
                <span className={COL.name}>Record</span>
                <span className={COL.status}>Status</span>
                <span className={COL.owner}>Owner</span>
                <span className={COL.due}>Due</span>
                {/* The mirrored column wears the product's violet tint + Link2 */}
                <span
                    className={`${COL.hours} flex items-center gap-1 rounded-t px-1`}
                    style={{ backgroundColor: "#6C5CE71A", color: "#6C5CE7" }}
                >
                    <Link2 className="h-2.5 w-2.5" />
                    Hours
                </span>
            </div>

            {COLLECTIONS.map((collection) => (
                <div key={collection.name}>
                    {/* collection heading */}
                    <div className="flex items-center gap-2 px-4 py-2">
                        <ChevronDown className="h-3 w-3" style={{ color: collection.color }} />
                        <span className="text-[11px] font-bold" style={{ color: collection.color }}>
                            {collection.name}
                        </span>
                        <span className="text-[10px] text-muted">{collection.rows.length}</span>
                    </div>

                    {collection.rows.map((row) => (
                        <div key={row.name}>
                            <div className="flex items-center gap-3 border-b border-gray-200/30 px-4 py-2">
                                {/* the collection's coloured rail, as on the real board */}
                                <span
                                    className="h-6 w-1 shrink-0 rounded-full"
                                    style={{ backgroundColor: collection.color }}
                                />

                                <span className={`${COL.name} flex items-center gap-1.5`}>
                                    {row.expanded ? (
                                        <ChevronDown className="h-3 w-3 shrink-0 text-muted" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 shrink-0 text-muted" />
                                    )}
                                    <span className="truncate text-xs font-medium text-slate-800">{row.name}</span>
                                </span>

                                <span className={COL.status}>
                                    <span
                                        className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-white"
                                        style={{ backgroundColor: row.status.color }}
                                    >
                                        {row.status.label}
                                    </span>
                                </span>

                                <span className={COL.owner}>
                                    <Avatar i={row.owner} />
                                </span>

                                <span className={`${COL.due} text-[11px] text-slate-600`}>{row.due}</span>

                                <span
                                    className={`${COL.hours} px-1 text-[11px] font-semibold`}
                                    style={{ backgroundColor: "#6C5CE70D", color: "#6C5CE7" }}
                                >
                                    {row.hours}
                                </span>
                            </div>

                            {/* sub-records — one level deep, as the product allows */}
                            {row.sub?.map((sub) => (
                                <div
                                    key={sub.name}
                                    className="flex items-center gap-3 border-b border-gray-200/30 bg-control/60 px-4 py-1.5"
                                >
                                    <span className="h-4 w-1 shrink-0" />
                                    <span className={`${COL.name} pl-5 truncate text-[11px] text-slate-600`}>
                                        {sub.name}
                                    </span>
                                    <span className={COL.status} />
                                    <span className={COL.owner} />
                                    <span className={COL.due} />
                                    <span className={`${COL.hours} px-1 text-[11px] text-slate-600`}>{sub.hours}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}

            <div className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] text-muted">
                <Plus className="h-3 w-3" />
                Add record
            </div>
        </MockFrame>
    );
}
