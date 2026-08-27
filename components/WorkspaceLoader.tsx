"use client";

import { useSyncExternalStore } from "react";

import CollectionLoader from "./CollectionLoader";
import { readUser, readUserServer, subscribeUser } from "@/lib/auth";

/**
 * Full-page skeleton for the dashboard, redrawn 2026-08-27 because it was
 * mirroring a layout that no longer exists.
 *
 * It still described the OLD Home page: a 328px sidebar, a recessed `bg-canvas`
 * gutter, and a `rounded-l-2xl` panel card topped with a coral tab strip. Home
 * is now edge-to-edge `bg-card` with a hairline header and pill tabs, and the
 * sidebar is 288px — so the skeleton was promising a shape the real page then
 * refused to take, which is worse than no skeleton at all: every element moved
 * the moment data landed.
 *
 * A loading state is a PROMISE ABOUT LAYOUT. Its only job is that nothing jumps
 * when it is replaced, so it is worth keeping honest whenever the page changes.
 */

/** The sidebar's two widths, matching Sidebar.tsx. */
const FULL_WIDTH = 288;
const RAIL_WIDTH = 68;

/** One pulsing block. `bg-control` is a token, so it stays one step off the
 *  surface in every theme — LAYOUT.md §7 (the loading recipe). */
function Bar({ className, delay = 0 }: { className: string; delay?: number }) {
    return (
        <div
            className={`animate-pulse rounded-full bg-control ${className}`}
            style={{ animationDelay: `${delay}ms` }}
        />
    );
}

function Tile({ className, delay = 0 }: { className: string; delay?: number }) {
    return (
        <div
            className={`shrink-0 animate-pulse bg-control ${className}`}
            style={{ animationDelay: `${delay}ms` }}
        />
    );
}

export default function WorkspaceLoader() {
    /**
     * The rail preference is read the same way Sidebar.tsx reads it, so a
     * collapsed sidebar loads as a 68px rail instead of springing shut the
     * instant the real one mounts. readUserServer() returns null, so the server
     * and the hydrating render agree on "expanded".
     */
    const me = useSyncExternalStore(subscribeUser, readUser, readUserServer);
    const collapsed = me?.preferences?.sidebarCollapsed === true;

    const width = collapsed ? RAIL_WIDTH : FULL_WIDTH;

    return (
        <section
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="flex h-full w-full font-google-sans"
        >
            <span className="sr-only">Loading your workspaces…</span>

            {/* Sidebar — same widths, same paddings, same tile sizes */}
            <aside
                style={{ width }}
                className="flex h-screen shrink-0 flex-col border-r border-hairline bg-card"
            >
                {/* Brand: the 44px tile sits 12px in and 16px down in BOTH
                    states, exactly as the real one does. */}
                <div className="px-3 pb-3 pt-4">
                    <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
                        <Tile className="h-11 w-11 rounded-xl" />

                        {!collapsed && (
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Bar className="h-3 w-24" />
                                <Bar className="h-2 w-32" delay={60} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Workspace switcher */}
                <div className="px-3 pb-3">
                    <Tile
                        className={collapsed ? "mx-auto h-9 w-9 rounded-lg" : "h-[52px] w-full rounded-xl"}
                        delay={90}
                    />
                </div>

                {/* Nav rows */}
                <div className={`space-y-1.5 px-3 ${collapsed ? "flex flex-col items-center" : ""}`}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        collapsed ? (
                            <Tile key={i} className="h-9 w-9 rounded-lg" delay={i * 80} />
                        ) : (
                            <div key={i} className="flex items-center gap-2.5 py-0.5">
                                <Tile className="h-7 w-7 rounded-lg" delay={i * 80} />
                                {/* Ragged widths: a column of identical bars
                                    reads as a loading GRAPHIC, a ragged one
                                    reads as a list of names. */}
                                <div
                                    className="h-3 animate-pulse rounded-full bg-control"
                                    style={{
                                        width: `${44 + ((i * 17) % 38)}%`,
                                        animationDelay: `${i * 80}ms`
                                    }}
                                />
                            </div>
                        )
                    ))}
                </div>
            </aside>

            {/* Main column — bg-card and edge to edge, like the real page */}
            <div className="flex h-screen w-full min-w-0 flex-col bg-card">

                {/* Header: the search box is drawn as an OUTLINE rather than a
                    pulsing block. It is an input, and a filled bar where a field
                    will be reads as content still loading when nothing about it
                    is. */}
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline px-6 py-3">
                    <div className="h-11 w-full max-w-xl rounded-xl border border-hairline" />

                    <div className="flex shrink-0 items-center gap-2">
                        <Tile className="h-8 w-8 rounded-full" />
                        <Tile className="h-8 w-8 rounded-full" delay={80} />
                    </div>
                </header>

                {/* Tab pills */}
                <div className="flex shrink-0 items-center gap-1 px-6 py-2">
                    {[0, 1, 2].map((i) => (
                        <Tile
                            key={i}
                            className="h-8 w-28 rounded-lg"
                            delay={i * 90}
                        />
                    ))}
                </div>

                {/* The table itself */}
                <div className="min-h-0 flex-1 overflow-hidden">
                    <CollectionLoader rows={10} columns={5} />
                </div>
            </div>
        </section>
    );
}
