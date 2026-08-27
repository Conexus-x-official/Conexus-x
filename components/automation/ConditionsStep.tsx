"use client";

import { HiOutlineTrash } from "react-icons/hi2";

import type {
    AutomationCondition,
    ConditionOp,
    MatchMode,
    RecordField,
    TriggerType
} from "@/store/api/automations.api";
import {
    OPS,
    RECORD_FIELDS,
    opSpec,
    recordFieldSpec,
    triggerSpec
} from "@/lib/automation/catalog";
import {
    AddLineButton,
    ChoiceBlank,
    CollectionBlank,
    ColumnBlank,
    ColumnValueBlank,
    SelectBlank,
    SentenceLine,
    TextBlank,
    Word,
    type Vocabulary
} from "./shared";

/**
 * The "Only if …" lines — the optional filter between a trigger and its actions.
 *
 * Two things here are worth more than they look:
 *
 *  - a condition can read the RECORD itself (its collection, whether it is
 *    complete, how many sub-records it has), not only its columns. That is what
 *    lets "when a record is moved" become "when a record is moved INTO Done"
 *    without a second trigger that means almost the same thing;
 *  - all/any is a flat choice, deliberately. Nested groups are a query builder,
 *    and every recipe people actually write is one or the other.
 *
 * The whole section is hidden behind a single "+ Only if" until it is needed —
 * an empty conditions box on every new recipe implies the recipe is unfinished
 * when the trigger alone is a perfectly complete rule.
 */
export default function ConditionsStep({
    conditions,
    match,
    triggerType,
    vocab,
    onChange,
    onMatchChange
}: {
    conditions: AutomationCondition[];
    match: MatchMode;
    triggerType: TriggerType;
    vocab: Vocabulary;
    onChange: (conditions: AutomationCondition[]) => void;
    onMatchChange: (match: MatchMode) => void;
}) {
    // Conditions read the same column set the trigger fires on.
    const scope = triggerSpec(triggerType)?.column ?? "record";

    const patch = (index: number, next: Partial<AutomationCondition>) =>
        onChange(conditions.map((c, i) => (i === index ? { ...c, ...next } : c)));

    const add = () =>
        onChange([...conditions, { source: "column", op: "is", value: "" }]);

    const remove = (index: number) =>
        onChange(conditions.filter((_, i) => i !== index));

    /**
     * Collapsed, but still a CARD — the three lines sit side by side now, so a
     * bare button here would leave a hole between When and Then instead of the
     * middle step of a rule. Dashed, so it still reads as "nothing here yet".
     */
    if (conditions.length === 0) {
        return (
            <div className="flex h-full flex-col items-start justify-center rounded-xl border border-dashed border-slate-300 bg-card/50 p-4">
                <span className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Only if
                </span>
                <AddLineButton label="Only if…" onClick={add} />
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Optional — without one, the trigger alone is the whole rule.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col space-y-2 rounded-xl border border-slate-200 bg-card p-4">
            {conditions.map((condition, index) => (
                <ConditionLine
                    key={index}
                    keyword={
                        index === 0
                            ? "Only if"
                            : match === "any"
                                ? "or"
                                : "and"
                    }
                    /* The joiner is editable on the SECOND line only: it applies
                       to the whole list, so offering it on every row would imply
                       each pair could differ. */
                    editableJoiner={index === 1}
                    match={match}
                    onMatchChange={onMatchChange}
                    condition={condition}
                    scope={scope}
                    vocab={vocab}
                    onPatch={(next) => patch(index, next)}
                    onRemove={() => remove(index)}
                />
            ))}

            <div className="pt-1">
                <AddLineButton label="another condition" onClick={add} />
            </div>
        </div>
    );
}

function ConditionLine({
    keyword,
    editableJoiner,
    match,
    onMatchChange,
    condition,
    scope,
    vocab,
    onPatch,
    onRemove
}: {
    keyword: string;
    editableJoiner: boolean;
    match: MatchMode;
    onMatchChange: (match: MatchMode) => void;
    condition: AutomationCondition;
    scope: "record" | "subrecord";
    vocab: Vocabulary;
    onPatch: (patch: Partial<AutomationCondition>) => void;
    onRemove: () => void;
}) {
    const field = recordFieldSpec(condition.field);
    const op = opSpec(condition.op);
    const isRecordSource = condition.source === "record";

    /**
     * A boolean or collection field has exactly two useful comparisons, and a
     * "contains" on "is completed" is nonsense that would read as a bug. The
     * numeric ones only appear where a number is what is being compared.
     */
    const availableOps = OPS.filter((o) => {
        if (!isRecordSource) return true;
        if (field?.editor === "boolean" || field?.editor === "collection") {
            return o.value === "is" || o.value === "is_not";
        }
        if (field?.editor === "number") {
            return ["is", "is_not", "greater_than", "less_than"].includes(o.value);
        }
        return true;
    });

    return (
        <div className="group/cond flex items-start gap-2">
            <div className="min-w-0 flex-1">
                <SentenceLine
                    keyword={editableJoiner ? "" : keyword}
                    tone="muted"
                >
                    {editableJoiner && (
                        <SelectBlank
                            value={match}
                            placeholder="and"
                            options={[
                                { value: "all", label: "and" },
                                { value: "any", label: "or" }
                            ]}
                            onChange={(next) => onMatchChange(next as MatchMode)}
                            title="Applies to every condition in this recipe"
                        />
                    )}

                    {/* What is being tested: a column, or the record itself. */}
                    {isRecordSource ? (
                        <SelectBlank
                            value={condition.field ?? ""}
                            placeholder="a field"
                            options={RECORD_FIELDS
                                /**
                                 * A collection belongs to one module, so
                                 * comparing against one on a workspace recipe
                                 * would quietly narrow it back to that module —
                                 * the exact thing workspace scope avoids.
                                 */
                                .filter(
                                    (f) =>
                                        !(vocab.scope === "workspace" && f.value === "collection")
                                )
                                .map((f) => ({ value: f.value, label: f.label }))}
                            onChange={(value) =>
                                onPatch({ field: value as RecordField, op: "is", value: "" })
                            }
                        />
                    ) : (
                        <ColumnBlank
                            vocab={vocab}
                            scope={scope}
                            value={condition.column}
                            columnName={condition.columnName}
                            onPick={(patch) => onPatch({ ...patch, value: "" })}
                        />
                    )}

                    <SelectBlank
                        value={condition.op}
                        placeholder="is"
                        options={availableOps.map((o) => ({
                            value: o.value,
                            label: o.label
                        }))}
                        onChange={(value) => onPatch({ op: value as ConditionOp })}
                    />

                    {op?.needsValue && (
                        <ConditionValue
                            condition={condition}
                            scope={scope}
                            vocab={vocab}
                            onChange={(value) => onPatch({ value })}
                        />
                    )}

                    {/* Switching what a condition reads is rare enough to belong
                        at the end of the line rather than in front of it. */}
                    <button
                        type="button"
                        onClick={() =>
                            onPatch({
                                source: isRecordSource ? "column" : "record",
                                column: undefined,
                                columnName: undefined,
                                field: isRecordSource
                                    ? undefined
                                    : vocab.scope === "workspace"
                                        ? "name"
                                        : "collection",
                                op: "is",
                                value: ""
                            })
                        }
                        className="text-[10px] font-medium text-muted underline decoration-dotted underline-offset-2 transition hover:text-slate-900 cursor-pointer"
                    >
                        {isRecordSource ? "use a column" : "use a record field"}
                    </button>
                </SentenceLine>
            </div>

            <button
                type="button"
                onClick={onRemove}
                aria-label="Remove condition"
                className="mt-0.5 shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/cond:opacity-100 cursor-pointer"
            >
                <HiOutlineTrash className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

/** The right blank for whatever this condition is comparing. */
function ConditionValue({
    condition,
    scope,
    vocab,
    onChange
}: {
    condition: AutomationCondition;
    scope: "record" | "subrecord";
    vocab: Vocabulary;
    onChange: (value: string) => void;
}) {
    if (condition.source === "record") {
        const field = recordFieldSpec(condition.field);

        if (field?.editor === "collection") {
            return (
                <CollectionBlank vocab={vocab} value={condition.value} onChange={onChange} />
            );
        }

        if (field?.editor === "boolean") {
            return (
                <ChoiceBlank
                    value={condition.value}
                    trueLabel="yes"
                    falseLabel="no"
                    onChange={onChange}
                />
            );
        }

        return (
            <TextBlank
                value={condition.value}
                placeholder={field?.editor === "number" ? "0" : "a value"}
                onChange={onChange}
            />
        );
    }

    return (
        <>
            <Word> </Word>
            <ColumnValueBlank
                vocab={vocab}
                scope={scope}
                columnId={condition.column}
                value={condition.value}
                onChange={onChange}
            />
        </>
    );
}
