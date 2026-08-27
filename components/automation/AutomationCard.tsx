"use client";

import {
    HiOutlineExclamationTriangle,
    HiOutlinePencil,
    HiOutlineTrash
} from "react-icons/hi2";
import { TbBuildingCommunity, TbLayoutGrid } from "react-icons/tb";

import type { Automation } from "@/store/api/automations.api";
import { describeRecipe, type Lexicon } from "@/lib/automation/describe";

/**
 * One recipe, as a sentence.
 *
 * The card leads with what the rule DOES rather than what it is called, because
 * a name is whatever someone typed and the sentence is the truth — it is built
 * from the module's own column and collection names, so a card cannot describe
 * a rule that no longer exists.
 */
export default function AutomationCard({
    automation,
    lexicon,
    onToggle,
    onEdit,
    onDelete
}: {
    automation: Automation;
    lexicon: Lexicon;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { when, onlyIf, then } = describeRecipe(automation, lexicon);
    const isWorkspace = automation.scope === "workspace";

    return (
        <div
            className={`rounded-xl border border-slate-200 bg-card p-4 font-dmsans transition ${automation.isActive ? "" : "opacity-60"
                }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                            {automation.name}
                        </h3>

                        {/* Scope is the first thing to know about a recipe: it
                            decides which modules it can touch. */}
                        <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isWorkspace
                                ? "nav-glass text-slate-800"
                                : "bg-control text-muted"
                                }`}
                        >
                            {isWorkspace ? (
                                <TbBuildingCommunity className="h-3 w-3" />
                            ) : (
                                <TbLayoutGrid className="h-3 w-3" />
                            )}
                            {isWorkspace ? "Every module" : "This module"}
                        </span>

                        {!automation.isActive && (
                            <span className="shrink-0 rounded bg-control px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                Paused
                            </span>
                        )}
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        <span className="font-medium text-slate-800">{when}</span>
                        {onlyIf && <span className="text-muted"> and {onlyIf}</span>}
                        {", "}
                        {then}.
                    </p>

                    <p className="mt-1.5 text-[11px] text-muted">
                        Ran {automation.runCount}{" "}
                        {automation.runCount === 1 ? "time" : "times"}
                        {automation.lastRunAt
                            ? ` · last ${new Date(automation.lastRunAt).toLocaleDateString()}`
                            : ""}
                    </p>

                    {automation.lastError && (
                        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-red-100 bg-red-50/80 p-2 text-[11px] font-medium text-red-600">
                            <HiOutlineExclamationTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                            <span>Last run failed: {automation.lastError}</span>
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        onClick={onToggle}
                        title={automation.isActive ? "Pause" : "Resume"}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${automation.isActive
                            ? "text-muted hover:bg-control hover:text-slate-900"
                            : "text-slate-900 hover:bg-control"
                            }`}
                    >
                        {automation.isActive ? "Pause" : "Resume"}
                    </button>

                    <button
                        onClick={onEdit}
                        title="Edit"
                        aria-label="Edit automation"
                        className="rounded-lg p-1.5 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                    >
                        <HiOutlinePencil className="h-4 w-4" />
                    </button>

                    <button
                        onClick={onDelete}
                        title="Delete"
                        aria-label="Delete automation"
                        className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                        <HiOutlineTrash className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
