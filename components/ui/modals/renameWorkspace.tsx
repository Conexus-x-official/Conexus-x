"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { PenSquare, X, Loader2 } from "lucide-react";

import type { Workspace } from "@/store/types";

interface RenameWorkspaceProps {
    workspace: Workspace | null;
    saving: boolean;
    onClose: () => void;
    onSave: (name: string) => void | Promise<void>;
}

/**
 * Rename a workspace.
 *
 * Seeded from the workspace it was opened for, so the field starts as an edit
 * rather than a blank — and Save stays disabled until the name actually
 * changes, which makes an accidental no-op write impossible.
 */
export default function RenameWorkspace({
    workspace,
    saving,
    onClose,
    onSave,
}: RenameWorkspaceProps) {
    const [name, setName] = useState(workspace?.name ?? "");

    if (!workspace || typeof document === "undefined") return null;

    const trimmed = name.trim();
    const unchanged = trimmed === workspace.name;
    const canSave = trimmed.length > 0 && !unchanged && !saving;

    const submit = () => {
        if (!canSave) return;
        onSave(trimmed);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-card p-6 shadow-2xl font-dmsans">
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <PenSquare className="h-5 w-5" />
                        </span>

                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Rename workspace
                            </h2>
                            <p className="mt-0.5 text-xs text-muted">
                                Everything inside it stays exactly where it is.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Workspace name
                </label>

                <input
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") submit();
                        if (event.key === "Escape") onClose();
                    }}
                    placeholder={workspace.name}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-card px-3 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none placeholder:text-slate-400"
                />

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={submit}
                        disabled={!canSave}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-slate-400 cursor-pointer"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save name
                    </button>

                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 rounded-xl border border-slate-300 bg-card py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
