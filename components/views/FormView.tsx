"use client";

import { useMemo, useState } from "react";
import {
    HiOutlineDocumentPlus,
    HiOutlineLink,
    HiOutlineArrowTopRightOnSquare,
    HiOutlineArrowPath,
    HiCheck,
    HiOutlineCodeBracket,
} from "react-icons/hi2";
import { CgMenuGridO } from "react-icons/cg";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useGetMembersQuery } from "@/store/api/members.api";
import {
    useGetFormQuery,
    useUpdateFormMutation,
    useResetFormLinkMutation,
    PUBLIC_FORM_FIELD_TYPES,
    type FormTheme,
} from "@/store/api/forms.api";
import { byUserOrder } from "@/lib/sortCollections";
import { canManageRoles } from "@/lib/roles";
import { getUser } from "@/lib/auth";
import { toast } from "@/components/ui/toast";
import ItemPicker from "@/components/views/ItemPicker";
import FormFields, { THEMES, type PublicFormField, type FormValues } from "@/components/publicForm/FormFields";
import { memberUserId } from "@/components/ui/helpers/personCell";
import type { Column } from "@/store/types";

/**
 * The Form view — a BUILDER for a public, shareable form (see backend/models/
 * Form.ts). Pick which of the module's columns appear, reorder them, mark some
 * required, choose where submissions land and a theme, write the thank-you
 * screen, then Publish → a `/form/<id>` link anyone can fill in with no account.
 *
 * The form config is server-side (one per module) because a public URL and a
 * running submission count cannot live in localStorage like the other views'
 * remembered picks. Config writes are owner/admin only; the server re-checks.
 *
 * Only the eleven public-safe column types are offered — person/people/file/
 * relation/reference make no sense for a stranger and are filtered out.
 */

const SUPPORTED = new Set<string>(PUBLIC_FORM_FIELD_TYPES);
const THEME_KEYS: FormTheme[] = ["minimal", "classic", "bold"];

interface FieldRow {
    column: string;
    label: string;
    required: boolean;
    enabled: boolean;
}

interface Draft {
    title?: string;
    description?: string;
    submitLabel?: string;
    theme?: FormTheme;
    successTitle?: string;
    successBody?: string;
    showSignupCta?: boolean;
    isPublished?: boolean;
    targetCollection?: string;
    fields?: FieldRow[];
}

function deriveFields(
    formFields: { column: string; label: string; required: boolean }[] | undefined,
    supportedColumns: Column[]
): FieldRow[] {
    const byId = new Map(supportedColumns.map((c) => [c._id, c]));

    if (!formFields) {
        // No form yet — start with every supported column on, in column order.
        return supportedColumns.map((c) => ({ column: c._id, label: "", required: false, enabled: true }));
    }

    const configured = new Set(formFields.map((f) => f.column));
    const inForm: FieldRow[] = formFields
        .filter((f) => byId.has(f.column))
        .map((f) => ({ column: f.column, label: f.label, required: f.required, enabled: true }));
    const rest: FieldRow[] = supportedColumns
        .filter((c) => !configured.has(c._id))
        .map((c) => ({ column: c._id, label: "", required: false, enabled: false }));

    return [...inForm, ...rest];
}

export default function FormView({
    workspaceId,
    moduleId,
}: {
    workspaceId: string;
    moduleId: string;
}) {
    const { data: collectionsData = [] } = useGetCollectionsQuery(moduleId, { skip: !moduleId });
    const collections = useMemo(() => [...collectionsData].sort(byUserOrder), [collectionsData]);

    const { data: columns = [] } = useGetColumnsQuery(moduleId, { skip: !moduleId });
    const supportedColumns = useMemo(
        () => columns.filter((c) => c.scope !== "subrecord" && SUPPORTED.has(c.type ?? "text")),
        [columns]
    );
    const columnById = useMemo(() => new Map(columns.map((c) => [c._id, c])), [columns]);

    const { data: members = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });
    const myId = getUser()?.id;
    // A hint only — the SERVER is the gate. upsertForm re-checks owner|admin and
    // returns 403 with its own message, surfaced as a toast on Save. So the
    // builder is never disabled: a non-manager can fill it in and simply cannot
    // save. This matches how the rest of the app offers moderation controls.
    const canManage = canManageRoles(members.find((m) => memberUserId(m) === myId)?.role);
    const rosterKnown = members.length > 0 && !!myId;

    const { data: formResp } = useGetFormQuery(moduleId, { skip: !moduleId });
    const form = formResp?.form ?? null;

    const [updateForm, { isLoading: saving }] = useUpdateFormMutation();
    const [resetLink, { isLoading: resetting }] = useResetFormLinkMutation();

    // One draft object; null means "the server values are current".
    const [draft, setDraft] = useState<Draft | null>(null);
    const [copied, setCopied] = useState<"link" | "embed" | null>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    // Effective builder state — server value, overridden by any local edit.
    const targetCollectionId =
        draft?.targetCollection ?? form?.targetCollection ?? collections[0]?._id ?? "";
    const targetCollection =
        collections.find((c) => c._id === targetCollectionId) ?? collections[0] ?? null;

    const b = {
        title: draft?.title ?? form?.title ?? "Untitled form",
        description: draft?.description ?? form?.description ?? "",
        submitLabel: draft?.submitLabel ?? form?.submitLabel ?? "Submit",
        theme: draft?.theme ?? form?.theme ?? "minimal",
        successTitle: draft?.successTitle ?? form?.successTitle ?? "Thank you!",
        successBody:
            draft?.successBody ??
            form?.successBody ??
            "Your response has been recorded. We appreciate you taking the time.",
        showSignupCta: draft?.showSignupCta ?? form?.showSignupCta ?? true,
        isPublished: draft?.isPublished ?? form?.isPublished ?? false,
        fields: draft?.fields ?? deriveFields(form?.fields, supportedColumns),
    };

    const dirty = draft !== null;
    const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...(d ?? {}), ...p }));

    const patchField = (idx: number, p: Partial<FieldRow>) =>
        patch({ fields: b.fields.map((f, i) => (i === idx ? { ...f, ...p } : f)) });

    const reorderField = (from: number, to: number) => {
        if (from === to) return;
        const next = [...b.fields];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        patch({ fields: next });
    };

    const save = async (overrides: Partial<Draft> = {}) => {
        const state = { ...b, ...overrides };
        try {
            await updateForm({
                moduleId,
                body: {
                    targetCollection: targetCollectionId || undefined,
                    title: state.title,
                    description: state.description,
                    submitLabel: state.submitLabel,
                    theme: state.theme,
                    successTitle: state.successTitle,
                    successBody: state.successBody,
                    showSignupCta: state.showSignupCta,
                    isPublished: state.isPublished,
                    fields: (state.fields as FieldRow[])
                        .filter((f) => f.enabled)
                        .map((f) => ({ column: f.column, label: f.label, required: f.required })),
                },
            }).unwrap();
            setDraft(null);
            toast.success(
                overrides.isPublished === true
                    ? "Form published"
                    : overrides.isPublished === false
                      ? "Form unpublished"
                      : "Form saved"
            );
        } catch (error) {
            toast.error(
                "Could not save the form",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const doResetLink = async () => {
        try {
            await resetLink(moduleId).unwrap();
            toast.success("Link reset", "The old URL no longer works.");
        } catch (error) {
            toast.error("Could not reset the link", (error as { data?: { message?: string } })?.data?.message);
        }
    };

    // Preview fields (the enabled ones, as the public GET would return them).
    const previewFields: PublicFormField[] = b.fields
        .filter((f) => f.enabled)
        .map((f) => {
            const col = columnById.get(f.column);
            return {
                id: f.column,
                name: f.label || col?.name || "Field",
                type: col?.type || "text",
                required: f.required,
                options: col?.statusOptions?.length
                    ? col.statusOptions.map((o) => ({ label: o.label, color: o.color }))
                    : (col?.options || []).map((label) => ({ label })),
            };
        });
    const [previewValues, setPreviewValues] = useState<FormValues>({});

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const publicUrl = form?.publicId ? `${origin}/form/${form.publicId}` : "";
    const embed = publicUrl
        ? `<iframe src="${publicUrl}" width="100%" height="640" style="border:0;border-radius:12px" title="${b.title}"></iframe>`
        : "";

    const copy = async (text: string, which: "link" | "embed") => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(which);
            window.setTimeout(() => setCopied(null), 2000);
        } catch {
            toast.error("Could not copy", "Copy it manually instead.");
        }
    };

    if (!collections.length) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center font-dmsans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlineDocumentPlus size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">Form needs a collection</h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Add a collection from Collection view, then come back to build a form that
                        files submissions into it.
                    </p>
                </div>
            </div>
        );
    }

    const t = THEMES[b.theme];

    return (
        <div className="flex-1 overflow-y-auto px-8 pt-2 pb-10 font-google-sans [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400">
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold text-body font-dmsans">Form</h3>
                {b.isPublished ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                    </span>
                ) : (
                    <span className="rounded-full bg-control px-2 py-0.5 text-[11px] font-semibold text-muted">
                        Draft
                    </span>
                )}
                {form && (
                    <span className="text-[11px] text-muted">
                        {form.submissionCount} submission{form.submissionCount === 1 ? "" : "s"}
                    </span>
                )}
                {dirty && (
                    <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>
                )}
            </div>

            {rosterKnown && !canManage && (
                <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                    Heads up — only an owner or admin can save changes to this form.
                    You can still set everything up here.
                </p>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                {/* ── Builder ─────────────────────────────────────────── */}
                <div className="min-w-0 space-y-5">
                    {/* Basics */}
                    <section className="space-y-3 rounded-xl border border-hairline bg-card p-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-muted">Form title</label>
                            <input
                                value={b.title}
                                onChange={(e) => patch({ title: e.target.value })}
                                className="w-full rounded-lg border border-hairline bg-control/40 px-3 py-2 text-sm text-body outline-none transition focus:border-foreground focus:bg-card"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-muted">Description</label>
                            <textarea
                                value={b.description}
                                onChange={(e) => patch({ description: e.target.value })}
                                rows={2}
                                placeholder="Shown under the title on the form."
                                className="w-full resize-none rounded-lg border border-hairline bg-control/40 px-3 py-2 text-sm text-body outline-none transition placeholder:text-muted focus:border-foreground focus:bg-card"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-muted">Submissions go to</label>
                            {collections.length > 1 ? (
                                <ItemPicker
                                    label="Collection"
                                    heading="Collection"
                                    items={collections}
                                    active={targetCollection}
                                    onChange={(id) => patch({ targetCollection: id })}
                                />
                            ) : (
                                <p className="text-xs text-muted">
                                    <span className="font-semibold text-body">{targetCollection?.name}</span>
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-muted">Theme</label>
                            <div className="flex gap-1.5">
                                {THEME_KEYS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => patch({ theme: key })}
                                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize transition ${b.theme === key ? "border-foreground text-foreground" : "border-hairline text-muted hover:text-foreground"}`}
                                    >
                                        {THEMES[key].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Fields */}
                    <section className="rounded-xl border border-hairline bg-card p-4">
                        <p className="mb-2 text-xs font-semibold text-muted">
                            Fields — tick to include, drag to reorder
                        </p>
                        {supportedColumns.length === 0 ? (
                            <p className="text-xs text-muted">
                                This module has no columns a public form can use yet.
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {b.fields.map((row, idx) => {
                                    const col = columnById.get(row.column);
                                    if (!col) return null;
                                    return (
                                        <div
                                            key={row.column}
                                            draggable
                                            onDragStart={(e) => {
                                                setDragIdx(idx);
                                                e.dataTransfer.effectAllowed = "move";
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                if (dragIdx !== null) reorderField(dragIdx, idx);
                                                setDragIdx(null);
                                            }}
                                            onDragEnd={() => setDragIdx(null)}
                                            className={`flex items-center gap-2 rounded-lg border border-hairline px-2 py-1.5 transition ${row.enabled ? "bg-control/30" : "opacity-50"} ${dragIdx === idx ? "opacity-30" : ""}`}
                                        >
                                            <CgMenuGridO className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted" />
                                            <input
                                                type="checkbox"
                                                checked={row.enabled}
                                                onChange={(e) => patchField(idx, { enabled: e.target.checked })}
                                                className="h-3.5 w-3.5 shrink-0 accent-foreground"
                                            />
                                            <input
                                                value={row.label}
                                                onChange={(e) => patchField(idx, { label: e.target.value })}
                                                placeholder={col.name}
                                                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-body outline-none placeholder:text-muted"
                                            />
                                            <span className="shrink-0 rounded bg-control px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                                {col.type}
                                            </span>
                                            <label className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted">
                                                <input
                                                    type="checkbox"
                                                    checked={row.required}
                                                    onChange={(e) => patchField(idx, { required: e.target.checked })}
                                                    disabled={!row.enabled}
                                                    className="h-3 w-3 accent-foreground"
                                                />
                                                req
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Thank-you screen */}
                    <section className="space-y-3 rounded-xl border border-hairline bg-card p-4">
                        <p className="text-xs font-semibold text-muted">After a submission</p>
                        <input
                            value={b.successTitle}
                            onChange={(e) => patch({ successTitle: e.target.value })}
                            placeholder="Thank you!"
                            className="w-full rounded-lg border border-hairline bg-control/40 px-3 py-2 text-sm text-body outline-none transition focus:border-foreground focus:bg-card"
                        />
                        <textarea
                            value={b.successBody}
                            onChange={(e) => patch({ successBody: e.target.value })}
                            rows={2}
                            placeholder="A short thank-you message."
                            className="w-full resize-none rounded-lg border border-hairline bg-control/40 px-3 py-2 text-sm text-body outline-none transition placeholder:text-muted focus:border-foreground focus:bg-card"
                        />
                        <label className="flex items-center gap-2 text-xs font-medium text-body">
                            <input
                                type="checkbox"
                                checked={b.showSignupCta}
                                onChange={(e) => patch({ showSignupCta: e.target.checked })}
                                className="h-3.5 w-3.5 accent-foreground"
                            />
                            Invite the submitter to create their own account
                        </label>
                        <input
                            value={b.submitLabel}
                            onChange={(e) => patch({ submitLabel: e.target.value })}
                            placeholder="Submit"
                            className="w-full rounded-lg border border-hairline bg-control/40 px-3 py-2 text-sm text-body outline-none transition focus:border-foreground focus:bg-card"
                        />
                    </section>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => save()}
                            disabled={saving || !dirty}
                            className="rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                            {saving ? "Saving…" : "Save changes"}
                        </button>
                        {dirty && (
                            <button
                                type="button"
                                onClick={() => setDraft(null)}
                                className="text-xs font-semibold text-muted transition hover:text-foreground cursor-pointer"
                            >
                                Discard
                            </button>
                        )}
                        <span className="flex-1" />
                        <button
                            type="button"
                            onClick={() => save({ isPublished: !b.isPublished })}
                            disabled={saving}
                            className={`rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50 cursor-pointer ${b.isPublished ? "border border-hairline text-body hover:bg-control" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                        >
                            {b.isPublished ? "Unpublish" : "Publish"}
                        </button>
                    </div>

                    {/* Share box */}
                    {form?.publicId && b.isPublished && (
                        <section className="space-y-2.5 rounded-xl border border-hairline bg-panel p-4">
                            <p className="text-xs font-semibold text-muted">Share this form</p>

                            <div className="flex items-center gap-2 rounded-lg border border-hairline bg-card px-2.5 py-2">
                                <HiOutlineLink className="h-4 w-4 shrink-0 text-muted" />
                                <span className="min-w-0 flex-1 truncate text-xs text-body">{publicUrl}</span>
                                <button
                                    type="button"
                                    onClick={() => copy(publicUrl, "link")}
                                    className="shrink-0 rounded-md bg-foreground px-2 py-1 text-[11px] font-bold text-card transition hover:opacity-90 cursor-pointer"
                                >
                                    {copied === "link" ? <HiCheck className="h-3.5 w-3.5" /> : "Copy"}
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <a
                                    href={publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1.5 text-[11px] font-semibold text-body transition hover:bg-control"
                                >
                                    <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5" /> Open
                                </a>
                                <button
                                    type="button"
                                    onClick={() => copy(embed, "embed")}
                                    className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1.5 text-[11px] font-semibold text-body transition hover:bg-control cursor-pointer"
                                >
                                    <HiOutlineCodeBracket className="h-3.5 w-3.5" />
                                    {copied === "embed" ? "Copied" : "Copy embed"}
                                </button>
                                <button
                                    type="button"
                                    onClick={doResetLink}
                                    disabled={resetting}
                                    className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1.5 text-[11px] font-semibold text-muted transition hover:text-red-600 hover:border-red-200 cursor-pointer"
                                >
                                    <HiOutlineArrowPath className="h-3.5 w-3.5" /> Reset link
                                </button>
                            </div>
                        </section>
                    )}
                </div>

                {/* ── Live preview ────────────────────────────────────── */}
                <div className="lg:sticky lg:top-2 lg:self-start">
                    <p className="mb-2 text-xs font-semibold text-muted">Preview</p>
                    <div className={`overflow-hidden rounded-2xl ${t.page}`}>
                        <div className="p-5">
                            <div className={`${t.card} p-5`}>
                                <h2 className={`text-lg ${t.heading}`}>{b.title || "Untitled form"}</h2>
                                {b.description && (
                                    <p className="mt-1 text-sm opacity-70">{b.description}</p>
                                )}

                                <div className="mt-4 space-y-4">
                                    <div>
                                        <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold opacity-80">
                                            Name <span className={t.accentText}>*</span>
                                        </label>
                                        <input
                                            disabled
                                            className={`w-full px-3 py-2 text-sm outline-none ${t.input}`}
                                        />
                                    </div>
                                    <FormFields
                                        fields={previewFields}
                                        values={previewValues}
                                        onChange={(id, v) => setPreviewValues((p) => ({ ...p, [id]: v }))}
                                        theme={b.theme}
                                        disabled
                                    />
                                    <button
                                        type="button"
                                        disabled
                                        className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold ${t.button}`}
                                    >
                                        {b.submitLabel || "Submit"}
                                    </button>
                                </div>
                            </div>
                            <p className="mt-3 text-center text-[10px] opacity-40">
                                This is a preview — share the link to collect real responses.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
