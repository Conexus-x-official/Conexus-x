"use client";

import { createPortal } from "react-dom";
import {
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
} from "react-icons/hi2";

interface CreateWorkspaceProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    workspaceName: string;
    setWorkspaceName: (name: string) => void;
    error: string;
    creating: boolean;
    createWorkspace: () => void | Promise<void>;
}

export default function CreateWorkspace({
    open,
    setOpen,
    workspaceName,
    setWorkspaceName,
    error,
    creating,
    createWorkspace,
}: CreateWorkspaceProps) {
    if (!open) return null;

    const handleClose = () => {
        setOpen(false);
        setWorkspaceName("");
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-md rounded-2xl border border-hairline bg-card p-6 shadow-2xl font-google-sans"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">
                        Create Workspace
                    </h2>

                    <button
                        onClick={handleClose}
                        className="rounded-md p-1 text-muted transition hover:bg-control hover:text-foreground cursor-pointer"
                        aria-label="Close"
                    >
                        <HiOutlineXMark className="h-5 w-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                        <HiOutlineExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <label className="mb-1.5 block text-xs font-semibold text-muted">
                    Workspace name
                </label>

                <input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. Sales Pipeline"
                    autoFocus
                    disabled={creating}
                    className="mb-4 w-full rounded-lg border border-hairline bg-control/40 px-3 py-2.5 text-sm text-body outline-none transition placeholder:text-muted focus:border-foreground focus:bg-card focus:ring-4 focus:ring-foreground/10 disabled:opacity-60"
                />

                <button
                    onClick={createWorkspace}
                    disabled={creating || !workspaceName.trim()}
                    className="w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-card transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                    {creating ? "Creating..." : "Create Workspace"}
                </button>
            </div>
        </div>,
        document.body
    );
}
