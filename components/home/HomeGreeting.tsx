"use client";

import { useState, useSyncExternalStore } from "react";
import { HiOutlinePlus } from "react-icons/hi2";
import { TbLayoutGrid, TbCards } from "react-icons/tb";

import { useGetWorkspacesQuery } from "@/store/api/workspaces.api";
import { readUser, readUserServer, subscribeUser } from "@/lib/auth";
import type { Workspace } from "@/store/types";

/** Pure function of the hour — kept out of the render body (lazy useState below)
 *  so the React Compiler's purity rule is not tripped. */
function greetingFor(date: Date): { text: string; emoji: string } {
    const hour = date.getHours();
    if (hour < 12) return { text: "Good morning", emoji: "☀️" };
    if (hour < 18) return { text: "Good afternoon", emoji: "👋" };
    return { text: "Good evening", emoji: "🌙" };
}

/**
 * The dashboard's opening line: who you are, what you have, and the one action
 * this page is missing everywhere else — creating a workspace, which until now
 * lived only in the sidebar switcher.
 *
 * Counts come off the SHARED workspaces cache (the sidebar and the table below
 * subscribe to the same entry), so this costs no request. The page gates on
 * that query's isLoading before it mounts this, so the numbers are never zero
 * while data is still in flight.
 */
export default function HomeGreeting({
    onNewWorkspace,
}: {
    onNewWorkspace: () => void;
}) {
    const { data: workspaces = [] } = useGetWorkspacesQuery();
    const me = useSyncExternalStore(subscribeUser, readUser, readUserServer);

    // Evaluated once at mount — a greeting that flips at noon mid-session is not
    // worth a re-render, and `new Date()` in the render body is a lint error.
    const [greeting] = useState(() => greetingFor(new Date()));

    const name = me?.firstName?.trim();
    const workspaceCount = workspaces.length;
    const moduleCount = workspaces.reduce(
        (sum: number, workspace: Workspace) => sum + (workspace.totalModules ?? 0),
        0
    );

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 font-google-sans">
            <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-lg font-bold font-google-sans text-foreground">
                    <span className="truncate">
                        {greeting.text}
                        {name ? `, ${name}` : ""}
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-base leading-none">
                        {greeting.emoji}
                    </span>
                </h1>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-2.5 py-1 font-medium text-body">
                        <TbLayoutGrid className="h-3.5 w-3.5 text-muted" strokeWidth={2.5} />
                        <span className="tabular-nums font-semibold text-foreground">
                            {workspaceCount}
                        </span>
                        {workspaceCount === 1 ? "workspace" : "workspaces"}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-2.5 py-1 font-medium text-body">
                        <TbCards className="h-3.5 w-3.5 text-muted" strokeWidth={2.5} />
                        <span className="tabular-nums font-semibold text-foreground">
                            {moduleCount}
                        </span>
                        {moduleCount === 1 ? "module" : "modules"}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={onNewWorkspace}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-sm font-semibold text-card transition hover:opacity-90 cursor-pointer"
            >
                <HiOutlinePlus className="h-4 w-4" strokeWidth={2.5} />
                New workspace
            </button>
        </div>
    );
}
