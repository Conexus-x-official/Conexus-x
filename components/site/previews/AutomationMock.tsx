import { Bolt, Check } from "lucide-react";
import MockFrame from "./MockFrame";

/**
 * A picture of the automation builder.
 *
 * The product's rule editor IS a sentence with fill-in blanks — WHEN / ONLY IF
 * / THEN, each blank an inline token sized to its content. This copies that
 * exactly, including the two token states from components/automation/
 * tokenStyles.ts: a filled blank carries the glass panel, an empty one is
 * dashed and muted so it reads as "something goes here".
 *
 * One blank is deliberately left EMPTY. A mock in which every slot is already
 * filled shows a finished rule but not how you get one, and the dashed state is
 * the single detail that explains the interaction at a glance.
 */

/** Mirrors tokenClass() — the same two states, without importing a client module. */
const FILLED = "inline-flex items-center rounded-md nav-glass border border-transparent px-2 py-1 text-xs font-semibold text-slate-900";
const EMPTY = "inline-flex items-center rounded-md border border-dashed border-slate-400 px-2 py-1 text-xs font-semibold text-muted";

function Word({ children }: { children: React.ReactNode }) {
    return <span className="text-xs text-slate-600">{children}</span>;
}

function Line({ keyword, children }: { keyword: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            <span className="mr-0.5 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-900">
                {keyword}
            </span>
            {children}
        </div>
    );
}

export default function AutomationMock() {
    return (
        <MockFrame label="New automation · Deals" contentMinWidth={420}>
            <div className="space-y-5 p-6">
                <Line keyword="When">
                    <Word>a</Word>
                    <span className={FILLED}>Status</span>
                    <Word>column changes to</Word>
                    <span className={FILLED}>Done</span>
                </Line>

                <Line keyword="Only if">
                    <Word>the record is in</Word>
                    <span className={FILLED}>In progress</span>
                    <Word>and</Word>
                    <span className={FILLED}>Owner</span>
                    <Word>is not empty</Word>
                </Line>

                <Line keyword="Then">
                    <Word>move it to</Word>
                    <span className={FILLED}>Closed</span>
                    <Word>and notify</Word>
                    {/* the unfilled blank — this is what the interaction looks like */}
                    <span className={EMPTY}>someone</span>
                </Line>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
                    <span className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white">
                        <Check className="h-3 w-3" />
                        Save automation
                    </span>
                    <span className="text-[11px] text-muted">Runs on every record in this module</span>
                </div>
            </div>

            {/* what the rule produced — runs live in the activity log, not a run feed */}
            <div className="border-t border-slate-200 bg-panel px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Recent activity</p>

                <div className="mt-3 space-y-2.5">
                    {[
                        { record: "Tailspin expansion", when: "2 min ago" },
                        { record: "Adventure Works", when: "1 hr ago" },
                    ].map((run) => (
                        <div key={run.record} className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10">
                                <Bolt className="h-3 w-3 text-accent" />
                            </span>
                            <span className="text-[11px] text-slate-700">
                                Moved <span className="font-semibold">{run.record}</span> to Closed
                            </span>
                            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                                Automation
                            </span>
                            <span className="ml-auto text-[10px] text-muted">{run.when}</span>
                        </div>
                    ))}
                </div>
            </div>
        </MockFrame>
    );
}
