"use client";

import type { ReactNode } from "react";
import type { Collection, Column } from "@/store/types";
import type { AutomationScope } from "@/store/api/automations.api";
import type { ColumnScope } from "@/lib/automation/catalog";
import BlankMenu, { type BlankGroup, type BlankOption } from "./BlankMenu";
import { tokenClass } from "./tokenStyles";

export { tokenClass };

/**
 * The sentence builder's vocabulary and its blanks.
 *
 * A recipe is written as a SENTENCE with fill-in blanks — "When Status becomes
 * Done, move it to Completed" — rather than as a stack of labelled dropdowns.
 * That is monday's pattern and it is the right one here: the thing being built
 * is a sentence, so the form should be the sentence, and a user who can read
 * the result can also read the form. Three stacked selects labelled Trigger /
 * Conditions / Actions require you to already know what those words mean.
 *
 * Every control below is therefore an INLINE token sized to its own content,
 * never a full-width field. An unfilled blank is dashed and muted so it reads
 * as "something goes here"; a filled one carries the glass panel so it reads as a word
 * in the sentence.
 *
 * They were native <select>/<input> elements at first, because keyboard
 * behaviour, mobile pickers and screen-reader labelling come free that way.
 * The picking ones are now BlankMenu instead: a native popup is drawn by the
 * OS, so it ignored the theme completely in the middle of a themed card, and
 * once the rule IS the form the list is the thing being read. BlankMenu re-earns
 * what was given up — ↑/↓, Enter, Escape, type-ahead search and listbox roles.
 * TextBlank stays a real <input>, because free text is not a menu.
 */

/** Plain words between the blanks. */
export function Word({ children }: { children: ReactNode }) {
    return <span className="text-xs text-slate-600">{children}</span>;
}

/**
 * One line of the recipe, led by the keyword that says what it is.
 *
 * The keyword is the only vocabulary a user has to learn, and it is a word they
 * already know — When / Only if / Then — not Trigger / Condition / Action.
 */
export function SentenceLine({
    keyword,
    tone = "default",
    children,
    trailing
}: {
    keyword: string;
    tone?: "default" | "muted";
    children: ReactNode;
    trailing?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            <span
                className={`mr-0.5 shrink-0 text-xs font-bold uppercase tracking-wide ${tone === "muted" ? "text-muted" : "text-slate-900"
                    }`}
            >
                {keyword}
            </span>
            {children}
            {trailing}
        </div>
    );
}

export interface ModuleRef {
    _id: string;
    name: string;
}

export interface Vocabulary {
    scope: AutomationScope;
    /** The module a module-scoped recipe is pinned to; "" at workspace scope. */
    moduleId: string;
    columns: Column[];
    subColumns: Column[];
    collections: Collection[];
    modules: ModuleRef[];
}

/** The column set a control should list, honouring the requested scope. */
export const columnsIn = (vocab: Vocabulary, scope: ColumnScope): Column[] =>
    scope === "subrecord" ? vocab.subColumns : vocab.columns;

/**
 * The labels a status or dropdown column is limited to.
 *
 * Offering these instead of a free-text box is the difference between a rule
 * that fires and one that silently never matches because "done" was typed
 * where the picker writes "Done".
 */
export function optionsFor(
    vocab: Vocabulary,
    scope: ColumnScope,
    columnId?: string
): string[] {
    const column = columnsIn(vocab, scope).find((c) => c._id === columnId);
    if (!column) return [];
    if (column.type === "status") return (column.statusOptions ?? []).map((o) => o.label);
    if (column.type === "dropdown") return column.options ?? [];
    return [];
}

/**
 * A blank the user picks from a list.
 *
 * The list itself is BlankMenu — a portalled panel, not a native <select>, so
 * the popup is themed like everything around it. This wrapper stays because
 * every other blank below delegates to it: swapping the menu was one change
 * here, not five.
 */
export function SelectBlank({
    value,
    placeholder,
    options,
    groups,
    onChange,
    title,
    allowCustom,
    customHint
}: {
    value?: string;
    placeholder: string;
    /** Flat options, or use `groups` for a grouped list. */
    options?: BlankOption[];
    groups?: BlankGroup[];
    onChange: (value: string) => void;
    title?: string;
    allowCustom?: boolean;
    customHint?: string;
}) {
    return (
        <BlankMenu
            value={value}
            placeholder={placeholder}
            options={options}
            groups={groups}
            onChange={onChange}
            title={title}
            allowCustom={allowCustom}
            customHint={customHint}
        />
    );
}

/**
 * A blank the user types into, sized to what is in it.
 *
 * `size` is what keeps it inline: a fixed-width input in the middle of a
 * sentence looks like a form field that wandered in, and a full-width one
 * breaks the line entirely.
 */
export function TextBlank({
    value,
    placeholder,
    onChange,
    list
}: {
    value?: string;
    placeholder: string;
    onChange: (value: string) => void;
    list?: string;
}) {
    const text = value ?? "";

    return (
        <input
            value={text}
            list={list}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            size={Math.max(text.length || placeholder.length, 6)}
            className={`${tokenClass(Boolean(text))} placeholder:font-medium placeholder:text-muted`}
        />
    );
}

/**
 * Picks a column — by id on a module recipe, by NAME on a workspace one.
 *
 * The two are genuinely different controls, not one control with a flag: an id
 * is chosen from a list that exists, a name is typed and may match a column on
 * some modules and not others. The datalist offers the picked module's names as
 * a starting point, since they are already loaded and are usually what the user
 * has in mind — but anything can be typed, which is the point.
 */
export function ColumnBlank({
    vocab,
    scope,
    value,
    columnName,
    onPick,
    placeholder = "a column"
}: {
    vocab: Vocabulary;
    scope: ColumnScope;
    value?: string;
    columnName?: string;
    onPick: (patch: { column?: string; columnName?: string }) => void;
    placeholder?: string;
}) {
    const list = columnsIn(vocab, scope);

    if (vocab.scope === "workspace") {
        /**
         * Still a NAME, not an id — but no longer a <datalist>, which is the
         * same OS-drawn popup problem as a native select and, worse, gives no
         * hint that suggestions exist at all until you start typing. The menu
         * offers the picked module's column names AND accepts anything typed,
         * which is the whole point of workspace scope: the name may match a
         * column on some modules and not others.
         */
        return (
            <SelectBlank
                value={columnName}
                placeholder={placeholder}
                options={list.map((c) => ({ value: c.name, label: c.name, hint: c.type }))}
                allowCustom
                customHint="Use this name"
                onChange={(name) => onPick({ columnName: name, column: undefined })}
            />
        );
    }

    return (
        <SelectBlank
            value={value}
            placeholder={placeholder}
            options={list.map((c) => ({ value: c._id, label: c.name, hint: c.type }))}
            onChange={(id) => onPick({ column: id, columnName: undefined })}
        />
    );
}

/**
 * The value that goes with a column — its own labels where it has them, a
 * free-text blank where it does not.
 *
 * At workspace scope a column is only a name, so its labels are unknowable and
 * this is always free text.
 */
export function ColumnValueBlank({
    vocab,
    scope,
    columnId,
    value,
    onChange,
    placeholder = "a value"
}: {
    vocab: Vocabulary;
    scope: ColumnScope;
    columnId?: string;
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const options = optionsFor(vocab, scope, columnId);

    if (options.length === 0) {
        return <TextBlank value={value} placeholder={placeholder} onChange={onChange} />;
    }

    return (
        <SelectBlank
            value={value}
            placeholder={placeholder}
            options={options.map((label) => ({ value: label, label }))}
            onChange={onChange}
        />
    );
}

export function CollectionBlank({
    vocab,
    value,
    onChange,
    placeholder = "a collection"
}: {
    vocab: Vocabulary;
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <SelectBlank
            value={value}
            placeholder={placeholder}
            options={vocab.collections.map((c) => ({ value: c._id, label: c.name }))}
            onChange={onChange}
        />
    );
}

/**
 * A two-way choice rendered as one word in the sentence.
 *
 * Absent reads as true — the engine's rule is "anything but the string false" —
 * so this never has a blank third state.
 */
export function ChoiceBlank({
    value,
    trueLabel,
    falseLabel,
    onChange
}: {
    value?: string;
    trueLabel: string;
    falseLabel: string;
    onChange: (value: string) => void;
}) {
    const raw = String(value).toLowerCase() === "false" ? "false" : "true";

    return (
        <SelectBlank
            value={raw}
            placeholder={trueLabel}
            options={[
                { value: "true", label: trueLabel },
                { value: "false", label: falseLabel }
            ]}
            onChange={onChange}
        />
    );
}

/** A small round "+" that adds another line to the sentence. */
export function AddLineButton({
    label,
    onClick
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-400 px-2 py-1 text-[11px] font-semibold text-muted transition hover:border-slate-600 hover:bg-control hover:text-slate-900 cursor-pointer"
        >
            + {label}
        </button>
    );
}
