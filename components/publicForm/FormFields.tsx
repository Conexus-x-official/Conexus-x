"use client";

import type { FormTheme } from "@/store/api/forms.api";

/**
 * The public form, rendered. Shared by the in-app builder's live preview and
 * the standalone /f/<publicId> page, so the two can never drift.
 *
 * Only the eleven public-safe column types are handled — person/people/file/
 * relation/reference never reach here (the builder does not offer them and the
 * public GET does not list them).
 */

export interface PublicFormField {
    id: string;
    name: string;
    type: string;
    required: boolean;
    options?: { label: string; color?: string }[];
}

export type FieldValue = string | { startDate: string; endDate: string } | undefined;
export type FormValues = Record<string, FieldValue>;

// ── themes ───────────────────────────────────────────────────────────────────
export const THEMES: Record<
    FormTheme,
    {
        label: string;
        page: string;
        card: string;
        heading: string;
        input: string;
        button: string;
        accentText: string;
    }
> = {
    minimal: {
        label: "Minimal",
        page: "bg-[#f6f7f9] text-[#0f172a]",
        card: "bg-white border border-[#e6e8ec] rounded-2xl shadow-sm",
        heading: "font-semibold tracking-tight",
        input:
            "rounded-lg border border-[#d4d8dd] bg-white focus:border-[#0f172a] focus:ring-4 focus:ring-[#0f172a]/10",
        button: "bg-[#0f172a] text-white hover:opacity-90",
        accentText: "text-[#0f172a]",
    },
    classic: {
        label: "Classic",
        page: "bg-[#f4f1ea] text-[#2b2620]",
        card: "bg-[#fffdf8] border border-[#e4ddcf] rounded-xl shadow-[0_1px_0_#e4ddcf]",
        heading: "font-serif font-bold",
        input:
            "rounded-md border border-[#d8cfbc] bg-[#fffdf8] focus:border-[#3f6b57] focus:ring-4 focus:ring-[#3f6b57]/15",
        button: "bg-[#3f6b57] text-white hover:bg-[#345a49]",
        accentText: "text-[#3f6b57]",
    },
    bold: {
        label: "Bold",
        page: "bg-[#0b1120] text-[#e7ecf5]",
        card: "bg-[#141c2e] border border-[#28324a] rounded-2xl shadow-2xl",
        heading: "font-extrabold tracking-tight",
        input:
            "rounded-lg border border-[#33405c] bg-[#0e1626] text-[#e7ecf5] placeholder:text-[#7c8aa6] focus:border-[#5b8cff] focus:ring-4 focus:ring-[#5b8cff]/25",
        button: "bg-[#5b8cff] text-white hover:bg-[#4a7bf0]",
        accentText: "text-[#8fb0ff]",
    },
};

// ── client-side validation — mirrors backend/services/formValidation.ts ──────
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateField(field: PublicFormField, value: FieldValue): string | null {
    const empty =
        value === undefined ||
        value === "" ||
        (typeof value === "object" && !value.startDate && !value.endDate);

    if (empty) return field.required ? `${field.name} is required.` : null;

    if (field.type === "email" && !EMAIL.test(String(value)))
        return `${field.name} must be a valid email address.`;

    if (field.type === "link" && !/^https?:\/\/\S+$/i.test(String(value)))
        return `${field.name} must be a URL starting with http.`;

    if (field.type === "number" && !Number.isFinite(Number(String(value))))
        return `${field.name} must be a number.`;

    if (field.type === "rating") {
        const n = Number(String(value));
        if (!Number.isFinite(n) || n < 0 || n > 5 || (n * 2) % 1 !== 0)
            return `${field.name} must be 0–5 in half steps.`;
    }

    if (field.type === "timeline" && typeof value === "object") {
        if (value.startDate && value.endDate && value.endDate < value.startDate)
            return `${field.name}: the end date is before the start date.`;
    }

    return null;
}

/** Serialise a field value for the wire (RecordValue string encodings). */
export function serialiseValue(field: PublicFormField, value: FieldValue): unknown {
    if (field.type === "timeline" && typeof value === "object") return value;
    return value ?? "";
}

// ── the fields ───────────────────────────────────────────────────────────────
export default function FormFields({
    fields,
    values,
    onChange,
    theme,
    errors = {},
    disabled = false,
}: {
    fields: PublicFormField[];
    values: FormValues;
    onChange: (id: string, value: FieldValue) => void;
    theme: FormTheme;
    errors?: Record<string, string>;
    disabled?: boolean;
}) {
    const t = THEMES[theme] ?? THEMES.minimal;
    const inputCls = `w-full px-3 py-2 text-sm outline-none transition disabled:opacity-60 ${t.input}`;

    return (
        <div className="space-y-4">
            {fields.map((field) => {
                const value = values[field.id];
                const err = errors[field.id];

                const label = (
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold opacity-80">
                        {field.name}
                        {field.required && <span className={t.accentText}>*</span>}
                    </label>
                );

                let control: React.ReactNode;

                if (field.type === "status" || field.type === "dropdown") {
                    const current = value as string | undefined;
                    control = (
                        <div className="flex flex-wrap gap-1.5">
                            {(field.options ?? []).map((opt) => {
                                const on = current === opt.label;
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onChange(field.id, on ? undefined : opt.label)}
                                        className="rounded-full px-3 py-1 text-xs font-bold text-white transition disabled:opacity-60"
                                        style={{
                                            backgroundColor: opt.color || "#64748b",
                                            opacity: !current || on ? 1 : 0.4,
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    );
                } else if (field.type === "checkbox") {
                    const checked = value === "true";
                    control = (
                        <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            disabled={disabled}
                            onClick={() => onChange(field.id, checked ? "false" : "true")}
                            className={`h-5 w-9 shrink-0 rounded-full transition disabled:opacity-60 ${checked ? "bg-current" : "bg-black/15"} ${t.accentText}`}
                        >
                            <span
                                className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
                            />
                        </button>
                    );
                } else if (field.type === "timeline") {
                    const span = (value as { startDate: string; endDate: string }) ?? {
                        startDate: "",
                        endDate: "",
                    };
                    control = (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                disabled={disabled}
                                value={span.startDate}
                                onChange={(e) => onChange(field.id, { ...span, startDate: e.target.value })}
                                className={inputCls}
                            />
                            <span className="shrink-0 text-xs opacity-60">to</span>
                            <input
                                type="date"
                                disabled={disabled}
                                value={span.endDate}
                                onChange={(e) => onChange(field.id, { ...span, endDate: e.target.value })}
                                className={inputCls}
                            />
                        </div>
                    );
                } else if (field.type === "date") {
                    control = (
                        <input
                            type="date"
                            disabled={disabled}
                            value={(value as string) ?? ""}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={inputCls}
                        />
                    );
                } else {
                    const inputType =
                        field.type === "number" || field.type === "rating"
                            ? "number"
                            : field.type === "email"
                              ? "email"
                              : field.type === "link"
                                ? "url"
                                : "text";
                    control = (
                        <input
                            type={inputType}
                            disabled={disabled}
                            {...(field.type === "rating" ? { min: 0, max: 5, step: 0.5 } : {})}
                            value={(value as string) ?? ""}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            placeholder={
                                field.type === "link"
                                    ? "https://…"
                                    : field.type === "rating"
                                      ? "0–5"
                                      : undefined
                            }
                            className={inputCls}
                        />
                    );
                }

                return (
                    <div key={field.id}>
                        {field.type === "checkbox" ? (
                            <div className="flex items-center justify-between">
                                {label}
                                {control}
                            </div>
                        ) : (
                            <>
                                {label}
                                {control}
                            </>
                        )}
                        {err && <p className="mt-1 text-[11px] font-semibold text-red-500">{err}</p>}
                    </div>
                );
            })}
        </div>
    );
}
