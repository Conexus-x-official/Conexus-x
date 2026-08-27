"use client";

import { HiOutlineTrash } from "react-icons/hi2";

import type {
    ActionType,
    AutomationAction,
    TriggerType
} from "@/store/api/automations.api";
import { useGetCollectionsQuery } from "@/store/api/collections.api";
import {
    ACTION_GROUPS,
    actionSpec,
    actionsFor,
    columnScopeFor
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
 * The "Then …" lines — what the recipe actually does.
 *
 * The action list is filtered by the TRIGGER, not merely grouped by it. A
 * sub-record trigger offers "set a column on the parent" and does not offer
 * "add a sub-record under it", because one level of nesting is the contract and
 * the engine would refuse the second one anyway. Offering a choice that quietly
 * does nothing is worse than not offering it.
 */
export default function ActionsStep({
    actions,
    triggerType,
    vocab,
    onChange
}: {
    actions: AutomationAction[];
    triggerType: TriggerType;
    vocab: Vocabulary;
    onChange: (actions: AutomationAction[]) => void;
}) {
    const available = actionsFor(triggerType, vocab.scope);

    const patch = (index: number, next: Partial<AutomationAction>) =>
        onChange(actions.map((a, i) => (i === index ? { ...a, ...next } : a)));

    const add = () =>
        onChange([...actions, { type: available[0]?.value ?? "set_completed" }]);

    const remove = (index: number) => onChange(actions.filter((_, i) => i !== index));

    return (
        <div className="flex h-full flex-col space-y-2 rounded-xl border border-slate-200 bg-card p-4">
            {actions.map((action, index) => (
                <ActionLine
                    key={index}
                    // "Then" once, "and then" after — the list is ordered and
                    // reads as steps, not as a set.
                    keyword={index === 0 ? "Then" : "and then"}
                    action={action}
                    available={available}
                    triggerType={triggerType}
                    vocab={vocab}
                    removable={actions.length > 1}
                    onPatch={(next) => patch(index, next)}
                    onRemove={() => remove(index)}
                />
            ))}

            <div className="pt-1">
                <AddLineButton label="another action" onClick={add} />
            </div>
        </div>
    );
}

function ActionLine({
    keyword,
    action,
    available,
    triggerType,
    vocab,
    removable,
    onPatch,
    onRemove
}: {
    keyword: string;
    action: AutomationAction;
    available: ReturnType<typeof actionsFor>;
    triggerType: TriggerType;
    vocab: Vocabulary;
    removable: boolean;
    onPatch: (patch: Partial<AutomationAction>) => void;
    onRemove: () => void;
}) {
    const spec = actionSpec(action.type);
    const scope = spec ? columnScopeFor(spec, triggerType) : "record";

    /**
     * create_record can point at another module, so its collections are not the
     * ones already loaded. Skipped until a module is chosen — an action nobody
     * expanded costs nothing.
     */
    const targetModuleId = action.targetModule || "";
    const { data: targetCollections = [] } = useGetCollectionsQuery(targetModuleId, {
        skip: !spec?.target || !targetModuleId
    });

    /**
     * Changing the action type clears every target it had. A collection id, a
     * column id and a message have nothing in common between two actions, and
     * leaving them behind produces a line that looks configured and is not.
     */
    const pickType = (type: string) =>
        onPatch({
            type: type as ActionType,
            column: undefined,
            columnName: undefined,
            collectionName: undefined,
            targetModule: undefined,
            targetCollection: undefined,
            value: ""
        });

    return (
        <div className="group/act flex items-start gap-2">
            <div className="min-w-0 flex-1">
                <SentenceLine keyword={keyword} tone={keyword === "Then" ? "default" : "muted"}>
                    <SelectBlank
                        value={action.type}
                        placeholder="do something"
                        groups={ACTION_GROUPS.filter((group) =>
                            available.some((a) => a.group === group)
                        ).map((group) => ({
                            label: group,
                            options: available
                                .filter((a) => a.group === group)
                                .map((a) => ({ value: a.value, label: a.sentence }))
                        }))}
                        onChange={pickType}
                    />

                    {spec?.columnScope && (
                        <ColumnBlank
                            vocab={vocab}
                            scope={scope}
                            value={action.column}
                            columnName={action.columnName}
                            onPick={(next) => onPatch({ ...next, value: "" })}
                        />
                    )}

                    {spec?.collection && (
                        <CollectionBlank
                            vocab={vocab}
                            value={action.collectionName}
                            onChange={(collectionName) => onPatch({ collectionName })}
                        />
                    )}

                    {spec?.target && (
                        <>
                            <Word>in</Word>
                            <SelectBlank
                                value={action.targetModule}
                                placeholder="a module"
                                options={vocab.modules.map((m) => ({
                                    value: m._id,
                                    label: m.name
                                }))}
                                onChange={(targetModule) =>
                                    onPatch({
                                        targetModule,
                                        // The old collection belongs to the old module.
                                        targetCollection: undefined
                                    })
                                }
                            />

                            {targetModuleId && (
                                <>
                                    <Word>/</Word>
                                    <SelectBlank
                                        value={action.targetCollection}
                                        placeholder="a collection"
                                        options={targetCollections.map((c) => ({
                                            value: c._id,
                                            label: c.name
                                        }))}
                                        onChange={(targetCollection) =>
                                            onPatch({ targetCollection })
                                        }
                                    />
                                </>
                            )}
                        </>
                    )}

                    {spec?.valueKind === "column-value" && (
                        <>
                            <Word>to</Word>
                            <ColumnValueBlank
                                vocab={vocab}
                                scope={scope}
                                columnId={action.column}
                                value={action.value}
                                onChange={(value) => onPatch({ value })}
                            />
                        </>
                    )}

                    {spec?.valueKind === "boolean" && (
                        <ChoiceBlank
                            value={action.value}
                            trueLabel="complete"
                            falseLabel="incomplete"
                            onChange={(value) => onPatch({ value })}
                        />
                    )}

                    {spec?.valueKind === "text" && (
                        <TextBlank
                            value={action.value}
                            placeholder={spec.valuePlaceholder ?? "some text"}
                            onChange={(value) => onPatch({ value })}
                        />
                    )}
                </SentenceLine>

                {spec?.hint && (
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{spec.hint}</p>
                )}
            </div>

            {removable && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove action"
                    className="mt-0.5 shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/act:opacity-100 cursor-pointer"
                >
                    <HiOutlineTrash className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
