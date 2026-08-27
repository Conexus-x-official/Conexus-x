"use client";

import type { AutomationTrigger, TriggerType } from "@/store/api/automations.api";
import { TRIGGERS, TRIGGER_GROUPS, triggerSpec } from "@/lib/automation/catalog";
import {
    ColumnBlank,
    ColumnValueBlank,
    SelectBlank,
    SentenceLine,
    Word,
    type Vocabulary
} from "./shared";

/**
 * The "When …" line.
 *
 * The trigger itself is a blank like any other, so the line reads as a sentence
 * from the first word rather than starting with a labelled dropdown. Its
 * options are grouped, because fourteen flat choices is a wall.
 *
 * Everything after it is driven by the chosen trigger's spec — a new trigger
 * needs no change in this file at all.
 */
export default function TriggerStep({
    trigger,
    vocab,
    onChange
}: {
    trigger: AutomationTrigger;
    vocab: Vocabulary;
    onChange: (trigger: AutomationTrigger) => void;
}) {
    const spec = triggerSpec(trigger.type);

    /**
     * Changing the trigger clears the column and value with it. They are
     * addressed against a specific column set — a sub-record column id means
     * nothing to a record trigger — so carrying them across would leave a
     * recipe that looks filled in and matches nothing.
     */
    const pickType = (type: string) =>
        onChange({
            type: type as TriggerType,
            column: undefined,
            columnName: undefined,
            value: ""
        });

    return (
        <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-card p-4">
            <SentenceLine keyword="When">
                <SelectBlank
                    value={trigger.type}
                    placeholder="something happens"
                    groups={TRIGGER_GROUPS.map((group) => ({
                        label: group,
                        options: TRIGGERS.filter((t) => t.group === group).map((t) => ({
                            value: t.value,
                            label: t.sentence
                        }))
                    }))}
                    onChange={pickType}
                />

                {spec?.column && (
                    <>
                        <Word>on</Word>
                        <ColumnBlank
                            vocab={vocab}
                            scope={spec.column}
                            value={trigger.column}
                            columnName={trigger.columnName}
                            onPick={(patch) => onChange({ ...trigger, ...patch, value: "" })}
                        />
                    </>
                )}

                {spec?.needsValue && (trigger.column || trigger.columnName) && (
                    <>
                        <Word>becomes</Word>
                        <ColumnValueBlank
                            vocab={vocab}
                            scope={spec.column ?? "record"}
                            columnId={trigger.column}
                            value={trigger.value}
                            onChange={(value) => onChange({ ...trigger, value })}
                        />
                    </>
                )}
            </SentenceLine>

            {spec?.hint && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">{spec.hint}</p>
            )}
        </div>
    );
}
