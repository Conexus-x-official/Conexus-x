"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { HiOutlineXMark } from "react-icons/hi2";
import { LayoutGrid } from "lucide-react";

/**
 * This modal was LAYOUT.md 11.4's remaining offender: it painted its own
 * #111727 panel with #0D1B2A inputs and white ink, so on every light theme a
 * near-black card dropped out of nowhere over a light page — and in .dark it
 * was a DIFFERENT black from the one the rest of the app uses. Nothing about
 * it followed the token contract.
 *
 * It is now built from tokens only (10.1: a new surface takes a token utility,
 * never a hex) and shaped like the create-workspace modal in Sidebar.tsx, so
 * the two creation flows in this app read as one thing.
 *
 * The prop contract is unchanged — the workspace page still owns the draft and
 * the mutation; this owns nothing but the frame.
 */
interface CreateModuleProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    moduleName: string;
    setModuleName: (value: string) => void;
    moduleDescription: string;
    setModuleDescription: (value: string) => void;
    creatingModule: boolean;
    createModule: () => void;
}

export default function CreateModule({
    open,
    setOpen,
    moduleName,
    setModuleName,
    moduleDescription,
    setModuleDescription,
    creatingModule,
    createModule,
}: CreateModuleProps) {
    /**
     * Escape closes. The listener is attached only while the modal is open,
     * since the component returns null below that. A dialog whose only exit is
     * a 20px x is the one thing every other dialog here already gets right.
     */
    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, setOpen]);

    // Gated on `open`, which starts false — the server and the first client
    // render both produce nothing, so the portal is hydration-safe.
    if (!open) return null;

    const canCreate = moduleName.trim().length > 0 && !creatingModule;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={() => setOpen(false)}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Create module"
                className="w-full max-w-md rounded-2xl border border-hairline bg-card p-6 shadow-2xl font-google-sans"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — icon tile + what this is FOR. The tile uses the
                    bg-accent/10 + text-accent tint pair, so it re-tints with
                    the theme instead of carrying a brand hex. */}
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <LayoutGrid className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold leading-snug text-slate-900">
                                Create Module
                            </h2>
                            <p className="mt-0.5 text-xs font-medium text-muted">
                                A board for one stream of work, with its own collections, columns and records.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                        aria-label="Close"
                    >
                        <HiOutlineXMark className="h-5 w-5" />
                    </button>
                </div>

                <div className="mb-4">
                    <label
                        htmlFor="module-name"
                        className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                        Module Name
                    </label>
                    <input
                        id="module-name"
                        type="text"
                        value={moduleName}
                        onChange={(e) => setModuleName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && canCreate) createModule();
                        }}
                        placeholder="e.g. Product Launch"
                        autoFocus
                        className="w-full rounded-xl border border-hairline bg-control/40 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-muted focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/10"
                    />
                </div>

                {/* The description takes NO Enter shortcut on purpose: in a
                    textarea Enter is a new line, and stealing it to submit
                    loses the sentence someone was halfway through. */}
                <div className="mb-6">
                    <label
                        htmlFor="module-description"
                        className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                        Description
                        <span className="ml-1.5 font-medium text-muted">Optional</span>
                    </label>
                    <textarea
                        id="module-description"
                        value={moduleDescription}
                        onChange={(e) => setModuleDescription(e.target.value)}
                        placeholder="What is this module for?"
                        rows={4}
                        className="w-full resize-none rounded-xl border border-hairline bg-control/40 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-muted focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/10"
                    />
                </div>

                {/* Cancel then Create, right-aligned — the same order and the
                    same two recipes as the create-workspace modal. The old pair
                    put the primary action FIRST and dressed it as the quiet
                    one, which inverted both. */}
                <div className="flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-xl bg-control px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-control-hover hover:text-slate-900 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={createModule}
                        disabled={!canCreate}
                        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        {creatingModule ? "Creating..." : "Create Module"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
