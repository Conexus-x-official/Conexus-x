"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import {
    useGetPublicFormQuery,
    useSubmitPublicFormMutation,
    type FormTheme,
} from "@/store/api/forms.api";
import FormFields, {
    THEMES,
    validateField,
    serialiseValue,
    type FormValues,
} from "@/components/publicForm/FormFields";
import { SITE_NAME } from "@/lib/site";

/**
 * The standalone public form — no sidebar, no session, no app chrome. Anyone
 * with the `/form/<publicId>` link can open and submit it.
 *
 * proxy.ts does not guard `/form` (it is not in PROTECTED_PREFIXES), so this loads
 * for a logged-out visitor. It talks to the public API endpoints, which carry
 * no `protect` — the Bearer header baseApi attaches is simply ignored there.
 *
 * Data flows through RTK Query (StoreProvider is in the root layout), so no
 * fetch-in-effect: loading / 404 / loaded fall out of the query state.
 */

function FormShell({
    theme,
    children,
}: {
    theme: FormTheme;
    children: React.ReactNode;
}) {
    const t = THEMES[theme] ?? THEMES.minimal;
    return (
        <div
            className={`flex min-h-screen flex-col items-center justify-center px-4 py-10 font-google-sans ${t.page}`}
        >
            <div className="w-full max-w-lg">{children}</div>
            <Link
                href="/"
                className="mt-6 flex items-center gap-1.5 text-[11px] opacity-40 transition hover:opacity-70"
            >
                <Image src="/logo.png" alt="" width={14} height={14} className="rounded" />
                Powered by <span className="font-semibold">{SITE_NAME}</span>
            </Link>
        </div>
    );
}

export default function PublicFormPage() {
    const params = useParams();
    const publicId = String(params.publicId ?? "");

    const { data, isLoading, isError, error } = useGetPublicFormQuery(publicId, {
        skip: !publicId,
    });
    const [submitForm, { isLoading: submitting }] = useSubmitPublicFormMutation();

    const [name, setName] = useState("");
    const [values, setValues] = useState<FormValues>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [nameError, setNameError] = useState("");
    const [formError, setFormError] = useState("");
    const [honeypot, setHoneypot] = useState("");
    const [done, setDone] = useState(false);

    const form = data?.form;
    const theme: FormTheme = form?.theme ?? "minimal";
    const t = THEMES[theme] ?? THEMES.minimal;
    const notFound = isError && (error as { status?: number })?.status === 404;

    if (isLoading) {
        return (
            <FormShell theme={theme}>
                <div className={`${t.card} p-10 text-center`}>
                    <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
                </div>
            </FormShell>
        );
    }

    if (notFound || !form) {
        return (
            <FormShell theme={theme}>
                <div className={`${t.card} p-8 text-center`}>
                    <h1 className={`text-xl ${t.heading}`}>Form not available</h1>
                    <p className="mt-2 text-sm opacity-70">
                        This form has been unpublished or the link is no longer valid.
                    </p>
                </div>
            </FormShell>
        );
    }

    if (done) {
        return (
            <FormShell theme={theme}>
                <div className={`${t.card} p-8 text-center`}>
                    <div
                        className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${t.accentText}`}
                    >
                        ✓
                    </div>
                    <h1 className={`text-xl ${t.heading}`}>{form.successTitle}</h1>
                    {form.successBody && (
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed opacity-70">
                            {form.successBody}
                        </p>
                    )}

                    {form.showSignupCta && (
                        <div className="mt-6 border-t border-current/10 pt-6">
                            <Image
                                src="/logo.png"
                                alt={SITE_NAME}
                                width={36}
                                height={36}
                                className="mx-auto mb-2 rounded-lg"
                            />
                            <p className="text-xs opacity-60">
                                This form runs on {SITE_NAME} — workspaces, modules,
                                automations and shareable forms like this one.
                            </p>
                            <Link
                                href="/register"
                                className={`mt-3 inline-block rounded-lg px-4 py-2 text-sm font-bold ${t.button}`}
                            >
                                Create your own — it&apos;s free
                            </Link>
                        </div>
                    )}
                </div>
            </FormShell>
        );
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");

        const nErr = name.trim() ? "" : "Please enter your name.";
        const fieldErrors: Record<string, string> = {};
        form.fields.forEach((field) => {
            const err = validateField(field, values[field.id]);
            if (err) fieldErrors[field.id] = err;
        });

        setNameError(nErr);
        setErrors(fieldErrors);
        if (nErr || Object.keys(fieldErrors).length) return;

        try {
            await submitForm({
                publicId,
                body: {
                    name: name.trim(),
                    website_url: honeypot,
                    values: Object.fromEntries(
                        form.fields.map((field) => [field.id, serialiseValue(field, values[field.id])])
                    ),
                },
            }).unwrap();
            setDone(true);
        } catch (err) {
            setFormError(
                (err as { data?: { message?: string } })?.data?.message ??
                    "Something went wrong. Please try again."
            );
        }
    };

    const inputCls = `w-full px-3 py-2 text-sm outline-none transition ${t.input}`;

    return (
        <FormShell theme={theme}>
            <form onSubmit={onSubmit} className={`${t.card} p-6`}>
                <h1 className={`text-xl ${t.heading}`}>{form.title}</h1>
                {form.description && (
                    <p className="mt-1.5 text-sm leading-relaxed opacity-70">{form.description}</p>
                )}

                <div className="mt-5 space-y-4">
                    <div>
                        <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold opacity-80">
                            Your name <span className={t.accentText}>*</span>
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputCls}
                            autoComplete="name"
                        />
                        {nameError && (
                            <p className="mt-1 text-[11px] font-semibold text-red-500">{nameError}</p>
                        )}
                    </div>

                    <FormFields
                        fields={form.fields}
                        values={values}
                        onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))}
                        theme={theme}
                        errors={errors}
                    />

                    {/* Honeypot — off-screen, hidden from real users and a11y tools. */}
                    <input
                        type="text"
                        name="website_url"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="absolute left-[-9999px] h-0 w-0 opacity-0"
                    />

                    {formError && (
                        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">
                            {formError}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${t.button}`}
                    >
                        {submitting ? "Sending…" : form.submitLabel || "Submit"}
                    </button>
                </div>
            </form>
        </FormShell>
    );
}
