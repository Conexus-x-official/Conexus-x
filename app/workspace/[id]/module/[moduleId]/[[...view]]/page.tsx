"use client";
import { useState, type ComponentType } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRealtimeRoom } from "@/store/useRealtimeRoom";
import { useHydrated } from "@/lib/useHydrated";
import { useGetModulesQuery } from "@/store/api/modules.api";
import ProfileDropdown from "@/components/Profile";
import { logout } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import AiSidebar from "@/components/AiSidebar";
import BackButton from "@/components/ui/buttons/backButton";
import ViewTabs, { DEFAULT_PINNED_VIEWS, type BoardViewType } from "@/components/workspace/ViewTabs";
import CollectionView from "@/components/views/CollectionView";
import KanbanView from "@/components/views/KanbanView";
import CalendarView from "@/components/views/CalendarView";
import ListView from "@/components/views/ListView";
import TimelineView from "@/components/views/TimelineView";
import GanttView from "@/components/views/GanttView";
import GridView from "@/components/views/GridView";
import FormView from "@/components/views/FormView";
import ChartView from "@/components/views/ChartView";
import DashboardView from "@/components/views/DashboardView";

/** Every view shares this exact prop shape, so which one renders is a plain lookup rather than a growing ternary chain. */
const VIEW_COMPONENTS: Record<BoardViewType, ComponentType<{ workspaceId: string; moduleId: string }>> = {
    collection: CollectionView,
    kanban: KanbanView,
    calendar: CalendarView,
    list: ListView,
    timeline: TimelineView,
    gantt: GanttView,
    grid: GridView,
    form: FormView,
    chart: ChartView,
    dashboard: DashboardView,
};

/**
 * The board page's SHELL — everything a view has in common: the sidebar, the
 * header (module name/description, the view switcher, the profile menu) and
 * the right-hand AI rail. Which VIEW renders below the header is a lookup
 * into VIEW_COMPONENTS above, keyed by `activeView` — see components/views/
 * for CollectionView (the grouped table), KanbanView (lanes by a status
 * column), CalendarView (a month grid by a date column), ListView (one flat
 * vertical list grouped under collection headings), TimelineView (bars on a
 * day-axis, packed into shared rows), GanttView (the same axis, one row per
 * record grouped by collection like a task list), GridView (every record,
 * every column, one flat read-only spreadsheet), FormView (one record at
 * a time, fields laid out vertically), ChartView (one insight, shown large)
 * and DashboardView (every insight, small, in a grid). ViewTabs.tsx has the
 * note on why the switcher is a pinnable tab strip rather than a header
 * dropdown, and on why Map is left off entirely rather than merely deferred
 * (no location column type exists anywhere in this codebase to plot).
 *
 * This page used to BE the collection view, all ~3000 lines of it. Extracted
 * 2026-09-05 so a second view has somewhere to live beside it rather than
 * inside one page component that mixed page-shell concerns (header, logout)
 * with collection-table concerns (drag-and-drop, cell editing, every modal).
 *
 * The `[[...view]]` catch-all is unrelated to view TYPES — it exists so
 * /workspace/w/module/m and /workspace/w/module/m/Record/<id> are the SAME
 * page component for the amendments deep link, which CollectionView owns
 * entirely (see its own RECORD_SEGMENT/recordIdFromPath comment) — none of
 * the other views participate in that deep link yet.
 *
 * The active view AND the pinned tab set are both remembered per module in
 * localStorage, read the same effect-free way KanbanView remembers its
 * group-by column: an explicit pick this session wins, otherwise the
 * remembered value, otherwise the default ("collection" / the three default
 * tabs). Picking a view from "+ View" also pins it as a tab; unpinning the
 * active view falls back to the first tab left.
 */
const viewStorageKey = (moduleId: string) => `board_view_${moduleId}`;
const tabsStorageKey = (moduleId: string) => `board_view_tabs_${moduleId}`;

const readRememberedView = (moduleId: string): BoardViewType | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(viewStorageKey(moduleId));
        return raw && raw in VIEW_COMPONENTS ? (raw as BoardViewType) : null;
    } catch {
        return null;
    }
};

const readPinnedViews = (moduleId: string): BoardViewType[] | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(tabsStorageKey(moduleId));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        const valid = parsed.filter(
            (v): v is BoardViewType => typeof v === "string" && v in VIEW_COMPONENTS
        );
        return valid.length ? valid : null;
    } catch {
        return null;
    }
};
export default function ModulePage() {
    const params = useParams();
    const router = useRouter();
    const moduleId = params.moduleId as string;
    const workspaceId = params.id as string;

    /**
     * Everything on this board is announced to the board's own room, so another
     * person's cell edit, moved row or posted amendment lands here without a
     * poll. Joining is a request — the server re-checks module access before it
     * puts this socket in the room. Joined at the SHELL level (not inside a
     * view) so switching views never re-joins it.
     */
    useRealtimeRoom({ workspaceId, moduleId });

    /**
     * The board's own name and description, for the header.
     *
     * There is no get-one-module endpoint, and adding one would be the wrong
     * trade here: the Sidebar on this very page already subscribes to
     * getModules(workspaceId), so reading that entry costs no request. Found by
     * id rather than held in state, so a rename made anywhere repaints this
     * header the moment the Module tag invalidates.
     */
    const { data: workspaceModules = [] } = useGetModulesQuery(workspaceId, { skip: !workspaceId });
    const currentModule = workspaceModules.find((m) => m._id === moduleId);

    // The remembered view/tab set live in localStorage — read only AFTER
    // hydration, so the first client render (which reconciles against the
    // server's HTML) still sees the defaults the server produced. Without this
    // gate a non-default remembered view changes the tab count between passes
    // and React throws the tree away with "Hydration failed".
    const hydrated = useHydrated();

    const [pickedView, setPickedView] = useState<BoardViewType | null>(null);
    const activeView: BoardViewType =
        pickedView ?? (hydrated ? readRememberedView(moduleId) : null) ?? "collection";

    const [pinnedOverride, setPinnedOverride] = useState<BoardViewType[] | null>(null);
    const basePinned =
        pinnedOverride ?? (hydrated ? readPinnedViews(moduleId) : null) ?? DEFAULT_PINNED_VIEWS;
    // The active view is always shown as a tab, even before it is pinned — a
    // remembered view from before this feature (or one just switched to) must
    // not render with no tab highlighted.
    const pinnedViews: BoardViewType[] = basePinned.includes(activeView)
        ? basePinned
        : [...basePinned, activeView];

    const rememberPinned = (next: BoardViewType[]) => {
        setPinnedOverride(next);
        try {
            localStorage.setItem(tabsStorageKey(moduleId), JSON.stringify(next));
        } catch {
            // Private browsing / storage disabled — still applies this session.
        }
    };

    const selectView = (view: BoardViewType) => {
        setPickedView(view);
        try {
            localStorage.setItem(viewStorageKey(moduleId), view);
        } catch {
            // Private browsing / storage disabled — the pick still applies for
            // this session via pickedView, it just will not be remembered.
        }
        if (!pinnedViews.includes(view)) rememberPinned([...pinnedViews, view]);
    };

    const unpinView = (view: BoardViewType) => {
        const next = pinnedViews.filter((v) => v !== view);
        if (next.length === 0) return; // never leave the strip empty
        rememberPinned(next);
        if (activeView === view) selectView(next[0]);
    };

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    return (
        <section className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="h-screen w-full bg-canvas flex flex-col overflow-hidden">
                <div className="bg-card flex-1 flex flex-col overflow-hidden">
                    {/* Page header — the BOARD, not its contents. It used to
                        read "Collections", which named the list below it and
                        left the one thing the header should answer ("which
                        module am I in?") to the sidebar highlight. The list
                        gets its own label further down instead. */}
                    <div className="pl-4 pr-2 flex gap-2 items-center justify-between border-b border-slate-100 shrink-0 bg-card py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                            {/* Up to the workspace, deliberately NOT into
                                history: this page pushes its own entries
                                when an amendments panel opens, so back()
                                would spend the click closing a panel. */}
                            <BackButton
                                fallbackHref={`/workspace/${workspaceId}`}
                                label="Back to workspace"
                                preferHistory={false}
                            />

                            <div className="min-w-0">
                                {/* No skeleton: the name arrives from a cache
                                    entry the sidebar has usually filled
                                    already, and a flashing placeholder in a
                                    header is worse than a plain fallback. */}
                                <h2 className="truncate text-lg font-bold font-google-sans text-slate-800">
                                    {currentModule?.name || "Module"}
                                </h2>

                                {currentModule?.description && (
                                    <p className="truncate text-xs text-muted font-dmsans">
                                        {currentModule.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <ProfileDropdown onLogout={handleLogout} />
                        </div>
                    </div>

                    {/* View tab strip — sits under the module name, ClickUp
                        style. Only pinned views are tabs; "+ View" pins more.
                        See ViewTabs.tsx for why this replaced the header
                        dropdown. */}
                    <div className="flex items-stretch bg-card px-3 shrink-0">
                        <ViewTabs
                            active={activeView}
                            pinned={pinnedViews}
                            onChange={selectView}
                            onUnpin={unpinView}
                        />
                    </div>

                    {(() => {
                        const ActiveView = VIEW_COMPONENTS[activeView];
                        return <ActiveView workspaceId={workspaceId} moduleId={moduleId} />;
                    })()}
                </div>
            </div>

            {/* Right rail — Aquiline (CRM) and Relay (workflows) */}
            <AiSidebar
                agent="aquiline"
                context={"this module"}
                workspaceId={workspaceId}
                moduleId={moduleId}
            />
        </section>
    );
}
