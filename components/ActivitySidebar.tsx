"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiOutlineXMark, HiOutlineArrowRight } from "react-icons/hi2";
import { TbHistory } from "react-icons/tb";
import ActivityFeed from "./ActivityFeed";

/**
 * The activity drawer: a right-hand overlay rather than a docked column, so it
 * can open on any route without competing with the AI rail for layout width.
 *
 * It shows the most recent DRAWER_LIMIT entries. Anything older lives on the
 * full page, which paginates.
 */

/** How many entries the drawer holds before pointing at the full page. */
const DRAWER_LIMIT = 40;

/** Any component can ask the drawer to open — the profile dropdown does. */
export const OPEN_ACTIVITY_EVENT = "crm:open-activity";

export function openActivityDrawer() {
    window.dispatchEvent(new CustomEvent(OPEN_ACTIVITY_EVENT));
}

interface ActivitySidebarProps {
    workspaceId: string;
}

export default function ActivitySidebar({ workspaceId }: ActivitySidebarProps) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onOpen = () => setOpen(true);
        window.addEventListener(OPEN_ACTIVITY_EVENT, onOpen);
        return () => window.removeEventListener(OPEN_ACTIVITY_EVENT, onOpen);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    /**
     * No mounted flag: `open` starts false, so the server and the first client
     * render both produce nothing and agree — which is the whole job the flag
     * was doing, minus the setState-in-effect the lint rule rejects.
     */
    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">

            {/* Scrim — clicking anywhere outside the drawer closes it */}
            <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setOpen(false)}
                aria-hidden
            />

            <aside
                className="relative flex h-full w-[420px] max-w-[92vw] flex-col border-l border-slate-200 bg-card shadow-2xl font-google-sans"
                role="dialog"
                aria-label="Activity log"
            >
                {/* Header — h-16 matches the page headers it sits beside */}
                <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600">
                            <TbHistory className="h-4 w-4" />
                        </span>

                        <span className="min-w-0">
                            <span className="block truncate text-sm font-bold leading-tight text-slate-900">
                                Activity
                            </span>
                            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                                Last {DRAWER_LIMIT} changes
                            </span>
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        title="Close"
                        aria-label="Close activity log"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                    >
                        <HiOutlineXMark className="h-4 w-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">
                    <ActivityFeed workspaceId={workspaceId} limit={DRAWER_LIMIT} />
                </div>

                {/* Everything older than the drawer's window lives on the page */}
                {workspaceId && (
                    <Link
                        // `from` lets the page offer a back button that returns to
                        // the exact board this was opened over.
                        href={`/workspace/${workspaceId}/activity?from=${encodeURIComponent(pathname)}`}
                        onClick={() => setOpen(false)}
                        className="flex shrink-0 items-center justify-center gap-1.5 border-t border-slate-200 py-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 cursor-pointer"
                    >
                        View all activity
                        <HiOutlineArrowRight className="h-3.5 w-3.5" />
                    </Link>
                )}
            </aside>
        </div>,
        document.body
    );
}
