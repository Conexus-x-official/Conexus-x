"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineXMark } from "react-icons/hi2";
import { TbRoute } from "react-icons/tb";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

import {
    useCreateAutomationMutation,
    useCreateWorkspaceAutomationMutation,
    useUpdateAutomationMutation,
    type Automation,
    type AutomationDraft,
    type AutomationScope
} from "@/store/api/automations.api";
import { describeRecipe, type Lexicon } from "@/lib/automation/describe";
import { actionsFor } from "@/lib/automation/catalog";
import TriggerStep from "@/components/automation/TriggerStep";
import ConditionsStep from "@/components/automation/ConditionsStep";
import ActionsStep from "@/components/automation/ActionsStep";
import type { Vocabulary } from "@/components/automation/shared";
import NavTile from "@/components/ui/helpers/navTile";

/**
 * The recipe builder: name → Trigger → Conditions → Actions, with a live
 * sentence at the bottom saying what the whole thing will do.
 *
 * The three steps live in components/automation/ and are driven by
 * lib/automation/catalog.ts, so this file only owns the frame, the draft, and
 * the save. Adding a trigger or an action needs no change here.
 *
 * STATE IS SEEDED IN LAZY INITIALISERS, never in an effect. The caller gives
 * this component a `key` that changes per open, so a fresh mount re-seeds it —
 * which is the same pattern the board uses for its amendments panel, and it
 * keeps the set-state-in-effect lint rule satisfied.
 */

/**
 * The default action is asked for rather than hardcoded.
 *
 * "Move it to a collection" is the obvious first action on a module recipe and
 * is NOT offered at workspace scope (a collection belongs to one module). A
 * fixed default would leave the select showing nothing while the draft still
 * held the hidden value, and the save would then fail validation on a choice
 * the user was never shown.
 */
const blankDraft = (scope: AutomationScope): AutomationDraft => {
    const trigger: AutomationDraft["trigger"] = { type: "column_changed_to", value: "" };

    return {
        name: "",
        trigger,
        conditions: [],
        match: "all",
        actions: [{ type: actionsFor(trigger.type, scope)[0]?.value ?? "set_completed" }],
        isActive: true
    };
};

const draftFrom = (automation: Automation): AutomationDraft => ({
    name: automation.name,
    trigger: automation.trigger,
    conditions: automation.conditions ?? [],
    match: automation.match ?? "all",
    actions: automation.actions?.length ? automation.actions : [{ type: "set_completed" }],
    isActive: automation.isActive
});

interface AutomationBuilderProps {
    /** Closes the modal. The caller unmounts, which is what resets the form. */
    onClose: () => void;
    scope: AutomationScope;
    /** Where a module-scoped recipe is saved. Empty at workspace scope. */
    moduleId: string;
    workspaceId: string;
    vocab: Vocabulary;
    lexicon: Lexicon;
    /** An existing recipe to edit; omit to start a blank one. */
    editing?: Automation | null;
}

export default function AutomationBuilder({
    onClose,
    scope,
    moduleId,
    workspaceId,
    vocab,
    lexicon,
    editing
}: AutomationBuilderProps) {
    const [createAutomation, { isLoading: creating }] = useCreateAutomationMutation();
    const [createWorkspaceAutomation, { isLoading: creatingWorkspace }] =
        useCreateWorkspaceAutomationMutation();
    const [updateAutomation, { isLoading: updating }] = useUpdateAutomationMutation();

    const [draft, setDraft] = useState<AutomationDraft>(() =>
        editing ? draftFrom(editing) : blankDraft(scope)
    );
    const [error, setError] = useState<string | null>(null);

    const saving = creating || creatingWorkspace || updating;

    const patch = (next: Partial<AutomationDraft>) =>
        setDraft((prev) => ({ ...prev, ...next }));

    const sentence = describeRecipe(draft, lexicon);

    /**
     * The recipe described in one line, used as the name when none is typed.
     * Capped because it becomes a card heading, and a heading that wraps three
     * times is worse than one that stops.
     */
    const autoName = (() => {
        /**
         * The describers QUOTE every value ("Done"), which is right in a
         * sentence and wrong in a name: the quotes end up nested inside the
         * `automation "<name>"` prefix the engine writes, and a hard slice can
         * cut one in half. Stripped, then trimmed back to a word boundary.
         */
        const plain = `${sentence.when}, ${sentence.then}`.replace(/["']/g, "");
        if (plain.length <= 90) return plain;

        const cut = plain.slice(0, 90);
        return cut.slice(0, cut.lastIndexOf(" ")).trim() || cut.trim();
    })();

    const submit = async () => {
        setError(null);

        const body: AutomationDraft = {
            ...draft,
            name: draft.name.trim() || autoName
        };

        try {
            if (editing) {
                await updateAutomation({
                    automationId: editing._id,
                    // Both, so whichever list this recipe is in refreshes —
                    // the modal does not need to know which.
                    moduleId: editing.module ?? undefined,
                    workspaceId,
                    body
                }).unwrap();
            } else if (scope === "workspace") {
                await createWorkspaceAutomation({ workspaceId, body }).unwrap();
            } else {
                await createAutomation({ moduleId, body }).unwrap();
            }
            onClose();
        } catch (err: unknown) {
            // The server owns validation; show exactly what it objected to.
            setError(
                (err as { data?: { message?: string } })?.data?.message ??
                "Could not save this automation"
            );
        }
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
            onClick={() => !saving && onClose()}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                /*
                    WIDE AND TALL ON PURPOSE. At max-w-2xl the three lines were
                    stacked in a column barely wider than one of them, so every
                    sentence wrapped after two blanks and the whole rule never
                    fit on screen at once. h-[86vh] also pins the height, so the
                    box does not resize under the pointer as lines are added.
                */
                className="flex h-[86vh] max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-hairline bg-panel shadow-2xl font-dmsans"
            >
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-card px-6 py-4">
                    <div className="flex items-center gap-3">
                        {/* TbRoute — the same glyph the sidebar's Automations
                            row uses. A bolt was a third icon for one idea. */}
                        <NavTile className="h-10 w-10 rounded-xl text-slate-600">
                            <TbRoute className="h-5 w-5" />
                        </NavTile>
                        <div>
                            <h2 className="text-lg font-bold leading-snug text-slate-900">
                                {editing ? "Edit automation" : "New automation"}
                            </h2>
                            <p className="mt-0.5 text-xs font-medium text-muted">
                                {scope === "workspace"
                                    ? "Runs on every module in this workspace."
                                    : "Runs on this module only."}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close"
                        className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-control hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                    >
                        <HiOutlineXMark className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">

                    {/*
                        Name FIRST, at the owner's request.

                        It stays OPTIONAL and still defaults to the sentence:
                        the placeholder is the live autoName, so it rewrites
                        itself as the rule below is built and a blank field is
                        never a blank name. Leading with the label also gives
                        the row of steps a heading to sit under instead of the
                        modal opening straight into three dropdowns.
                    */}
                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold text-muted">
                            Name <span className="font-normal">(optional)</span>
                        </label>
                        <input
                            value={draft.name}
                            onChange={(e) => patch({ name: e.target.value })}
                            placeholder={autoName}
                            className="w-full rounded-lg border border-hairline bg-card px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-400 placeholder:text-xs placeholder:font-normal placeholder:text-muted"
                        />
                    </div>

                    {/*
                        The recipe reads LEFT TO RIGHT as one sentence:
                        When … / Only if … / Then … , three columns on a wide
                        screen and a stack on a narrow one. There is no
                        separate "preview" of it any more — the form IS the
                        sentence, and rendering the same words twice was the
                        clearest sign the form was not readable on its own.
                    */}
                    <div className="grid items-stretch gap-3 lg:grid-cols-3">
                        <TriggerStep
                            trigger={draft.trigger}
                            vocab={vocab}
                            onChange={(trigger) =>
                                /**
                                 * Actions are reset with the trigger. Which actions
                                 * are even offered depends on the trigger's subject
                                 * — a parent action under a record trigger would be
                                 * kept on screen and then silently do nothing.
                                 */
                                patch({ trigger, actions: [{ type: "set_completed" }] })
                            }
                        />

                        <ConditionsStep
                            conditions={draft.conditions}
                            match={draft.match}
                            triggerType={draft.trigger.type}
                            vocab={vocab}
                            onChange={(conditions) => patch({ conditions })}
                            onMatchChange={(match) => patch({ match })}
                        />

                        <ActionsStep
                            actions={draft.actions}
                            triggerType={draft.trigger.type}
                            vocab={vocab}
                            onChange={(actions) => patch({ actions })}
                    />
                    </div>

                    {error && (
                        <p className="rounded-lg border border-red-100 bg-red-50/80 p-2.5 text-xs font-medium text-red-600">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-card px-6 py-4">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-control hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={submit}
                        disabled={saving}
                        className="nav-glass flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-900 transition disabled:opacity-60 cursor-pointer"
                    >
                        {saving && <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />}
                        {editing ? "Save changes" : "Create automation"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
