import { COLUMN_TYPE_OPTIONS } from "@/data/data";
import MockFrame from "./MockFrame";

/**
 * A picture of the Add Column screen.
 *
 * It reads COLUMN_TYPE_OPTIONS — the SAME array the real modal renders — so
 * the marketing page cannot end up advertising a column type the product does
 * not have, or miss one it gained. That is the whole reason this is a mock
 * built from live data rather than a hand-typed list: a hard-coded copy is
 * correct exactly once.
 *
 * The count in the copy beside it comes from the same array for the same
 * reason. Nothing here claims a number a component had to be trusted to keep.
 */
export const COLUMN_TYPE_COUNT = COLUMN_TYPE_OPTIONS.length;

interface Option {
    value: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

export default function ColumnTypesMock() {
    const options = COLUMN_TYPE_OPTIONS as Option[];

    return (
        <MockFrame label="Add column · Deals">
            <div className="p-5">
                <p className="text-xs font-semibold text-slate-800">Column name</p>
                <p className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] text-muted">
                    Renewal owner
                </p>

                <p className="mt-5 text-xs font-semibold text-slate-800">Column type</p>

                <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {options.map((option) => {
                        // "Status" is drawn selected, so the panel shows both
                        // resting and chosen states rather than a flat grid.
                        const selected = option.value === "status";

                        return (
                            <span
                                key={option.value}
                                className={
                                    selected
                                        ? "flex items-center gap-2 rounded-lg border border-accent bg-accent/10 px-2.5 py-2 text-[11px] font-semibold text-accent"
                                        : "flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-medium text-slate-700"
                                }
                            >
                                <option.icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{option.label}</span>
                            </span>
                        );
                    })}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <span className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-600">Cancel</span>
                    <span className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white">
                        Add column
                    </span>
                </div>
            </div>
        </MockFrame>
    );
}
