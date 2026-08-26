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
            className="fixed inset-0 bg-transparent flex items-center justify-center px-5 z-50"
            onClick={handleClose}
        >
            <div
                className="bg-card w-full max-w-md rounded p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[#172B4D]">
                        Create Workspace
                    </h2>

                    <button
                        onClick={handleClose}
                        className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                        aria-label="Close"
                    >
                        <HiOutlineXMark className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm p-3 rounded mb-4">
                        <HiOutlineExclamationTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                    Workspace name
                </label>

                <input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. Sales Pipeline"
                    autoFocus
                    disabled={creating}
                    className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-800 mb-4 outline-none focus:border-[#6A00FF] focus:ring-2 focus:ring-[#6A00FF]/15 transition disabled:bg-slate-50"
                />

                <button
                    onClick={createWorkspace}
                    disabled={creating || !workspaceName.trim()}
                    className="w-full bg-[#6A00FF] text-white py-2.5 rounded text-sm font-medium hover:bg-[#5800D6] disabled:opacity-60 transition cursor-pointer"
                >
                    {creating ? "Creating..." : "Create Workspace"}
                </button>
            </div>
        </div>,
        document.body
    );
}