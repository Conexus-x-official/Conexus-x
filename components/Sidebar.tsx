"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveWorkspaceId } from "@/store/slices/ui.slice";
import { selectActiveWorkspaceId } from "@/store/selectors/workspace.selectors";
import {
    useGetWorkspacesQuery,
    useCreateWorkspaceMutation
} from "@/store/api/workspaces.api";
import { useGetModulesQuery } from "@/store/api/modules.api";
import {
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
    HiOutlineMagnifyingGlass,
    HiOutlineChevronRight
} from "react-icons/hi2";
import {
    TbCards,
    TbMessages,
    TbPlug,
    TbRoute,
    TbLayoutSidebarLeftCollapse,
    TbLayoutSidebarLeftExpand
} from "react-icons/tb";
import logo from "@/app/assets/Logo.png";
import {
    DEFAULT_WORKSPACE_ICON,
    WorkspaceIcon,
    searchWorkspaceIcons
} from "@/lib/workspaceIcons";
import NavTile from "./ui/helpers/navTile";
import WorkspaceSwitcher from "./ui/menu/workspaceSwitcher";
import { useUpdatePreferencesMutation } from "@/store/api/preferences.api";
import { readUser, readUserServer, subscribeUser, updateUser } from "@/lib/auth";
import { toast } from "./ui/toast";
import type { Workspace } from "@/store/types";

/**
 * NO INITIALS, NO PER-ENTITY COLOUR IN HERE.
 *
 * Workspace and module rows used to draw a hashed PALETTE square with the first
 * letter of the name in it. Both halves were wrong for a navigation list: a
 * letter is not an icon — "F" tells you nothing that the name beside it does
 * not already say, and two workspaces starting with F are indistinguishable —
 * and a random hue per row turned a list you scan into a row of stickers, each
 * shouting a colour that means nothing.
 *
 * Rows now use one icon per KIND (a workspace always looks like a workspace)
 * and take their colour from the state they are in: muted at rest, accent when
 * active. That is the same treatment every other nav row in this sidebar
 * already had.
 *
 * TRADE-OFF, deliberately accepted: in the collapsed rail every workspace now
 * shows the same glyph, so they are told apart by tooltip and by the active
 * highlight rather than at a glance. Colour was doing that job, badly — it was
 * carrying identity nowhere else in the app repeated it.
 */

/**
 * The two widths, in pixels rather than as `w-72` / `w-[68px]`.
 *
 * Animating a Tailwind class is not a thing: the transition needs a number to
 * interpolate toward, and the same number has to pin the CONTENT so it does
 * not re-wrap on every frame while the box moves — see AiSidebar, which
 * animates the same way for the same reason.
 */
const FULL_WIDTH = 288;
const RAIL_WIDTH = 68;

/**
 * One row of the collapsed rail: a square target that still navigates. The name
 * survives as a native tooltip, which is the only label a 68px rail has room for.
 *
 * The button IS the tile here — it is already a 36px square, so wrapping a
 * second bordered square inside it would draw the same outline twice. Active
 * swaps the fill for `nav-glass` and keeps a transparent border, so the row
 * does not resize by 2px when you land on it.
 */
function RailButton({
    label,
    active,
    onClick,
    children
}: {
    label: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${active
                ? "nav-glass border-transparent text-foreground"
                : "border-slate-300 bg-card text-slate-600 hover:bg-control/60 hover:text-slate-900"
                }`}
        >
            {children}
        </button>
    );
}

/**
 * Section header — deliberately styled as a PEER of Extensions and Automations,
 * not as a caption above them.
 *
 * It used to be a 10px uppercase tracked-out label in muted grey, which is the
 * typography of a subtitle: it read as an annotation on the list rather than as
 * the list's own name. Workspaces and Modules are the two things this whole app
 * is about, so they get the same size, weight and colour as every other primary
 * nav row. The chevron still appears on hover so the resting sidebar stays calm.
 */
function SectionHeader({
    icon,
    label,
    count,
    open,
    onToggle,
    action
}: {
    icon: React.ReactNode;
    label: string;
    count?: number;
    open: boolean;
    onToggle: () => void;
    action?: React.ReactNode;
}) {
    return (
        <div className="group/section flex items-center gap-1 px-2">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex flex-1 items-center gap-2.5 rounded-lg py-1.5 text-left cursor-pointer"
            >
                <NavTile className="h-7 w-7 rounded-lg text-slate-600">{icon}</NavTile>

                <span className="text-sm font-medium text-slate-600">{label}</span>

                {typeof count === "number" && count > 0 && (
                    <span className="text-[11px] font-semibold text-muted/70 tabular-nums">
                        {count}
                    </span>
                )}

                <HiOutlineChevronRight
                    className={`h-3 w-3 text-muted opacity-0 transition-all duration-200 group-hover/section:opacity-100 ${open ? "rotate-90" : ""}`}
                />
            </button>

            {action}
        </div>
    );
}

function RowSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className="space-y-1 px-2 py-1">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="h-8 rounded-lg bg-control animate-pulse"
                    style={{ width: `${72 + ((i * 13) % 28)}%`, animationDelay: `${i * 80}ms` }}
                />
            ))}
        </div>
    );
}

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();

    const dispatch = useAppDispatch();
    const workspaceId = useAppSelector(selectActiveWorkspaceId);

    // Cached and shared: navigating between routes no longer refetches either list.
    const { data: workspaces = [], isLoading: loadingWorkspaces } = useGetWorkspacesQuery();
    const { data: modules = [], isLoading: loadingModules } = useGetModulesQuery(
        workspaceId,
        { skip: !workspaceId }
    );

    const [createWorkspaceMutation, { isLoading: creating }] = useCreateWorkspaceMutation();

    // New UI state for create workspace modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    /** Catalog key, not a component — see lib/workspaceIcons.tsx. */
    const [newWorkspaceIcon, setNewWorkspaceIcon] = useState(DEFAULT_WORKSPACE_ICON.key);
    /** Filters the icon grid. Cleared with the modal, never kept per session. */
    const [iconQuery, setIconQuery] = useState("");
    const [createError, setCreateError] = useState("");

    const [openModule, setOpenModule] = useState(true);

    /**
     * Rail mode, read from the SIGNED-IN ACCOUNT rather than from this
     * component's own state.
     *
     * This is what fixes the flicker. Every page renders its own <Sidebar />,
     * so a route change unmounts one and mounts another — and the old version
     * started expanded and corrected itself from localStorage in an effect,
     * which meant a collapsed sidebar visibly swung open and shut on every
     * single navigation. Read through the external store, a soft navigation
     * has no hydration to wait for: the first render of the new instance
     * already calls readUser() and gets the right answer, so there is nothing
     * to correct and nothing to see.
     *
     * The value lives on the user (mirrored into localStorage by lib/auth.ts,
     * refreshed from the server by /auth/me and login), so it also follows the
     * person to another browser instead of being a fact about this one.
     *
     * readUserServer() returns null, so the server and the hydrating render
     * agree on "expanded" — the hydration rule the Toaster documents.
     */
    const me = useSyncExternalStore(subscribeUser, readUser, readUserServer);
    const collapsed = me?.preferences?.sidebarCollapsed === true;

    const [updatePreferences] = useUpdatePreferencesMutation();

    /**
     * Optimistic, then durable. updateUser() writes the local copy and raises
     * the event every mounted Sidebar is subscribed to, so the rail moves on
     * the same frame as the click; the request only decides whether it STAYS
     * moved. A failure puts it back rather than leaving the screen disagreeing
     * with the account.
     */
    const toggleCollapsed = async () => {
        const next = !collapsed;

        updateUser({ preferences: { ...me?.preferences, sidebarCollapsed: next } });

        try {
            await updatePreferences({ sidebarCollapsed: next }).unwrap();
        } catch (error) {
            updateUser({ preferences: { ...me?.preferences, sidebarCollapsed: collapsed } });
            toast.error(
                "Could not save your sidebar preference",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    // Pick a default workspace once the list arrives (or when the saved one disappears).
    useEffect(() => {
        if (workspaces.length === 0) return;
        const stillExists = workspaces.some((w: Workspace) => w._id === workspaceId);
        if (!workspaceId || !stillExists) {
            dispatch(setActiveWorkspaceId(workspaces[0]._id));
        }
    }, [workspaces, workspaceId, dispatch]);

    const handleWorkspaceChange = (newId: string) => {
        dispatch(setActiveWorkspaceId(newId));
        if (newId) {
            router.push(`/workspace/${newId}`);
        }
    };

    // Create new workspace
    async function handleCreateWorkspace() {
        if (!newWorkspaceName.trim()) {
            setCreateError("Workspace name cannot be empty");
            return;
        }
        try {
            setCreateError("");
            // Invalidating Workspace:LIST refreshes this list and the dashboard at once.
            await createWorkspaceMutation({
                name: newWorkspaceName,
                icon: newWorkspaceIcon
            }).unwrap();
            setShowCreateModal(false);
            setNewWorkspaceName("");
            setNewWorkspaceIcon(DEFAULT_WORKSPACE_ICON.key);
            setIconQuery("");
        } catch {
            setCreateError("Failed to create workspace");
        }
    }

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreateError("");
        setNewWorkspaceName("");
        setNewWorkspaceIcon(DEFAULT_WORKSPACE_ICON.key);
        setIconQuery("");
    };

    // Derived, not state: a pure function of the query.
    const iconResults = searchWorkspaceIcons(iconQuery);

    const isExtensionsActive = pathname.startsWith("/Extensions");
    const isMeetActive = pathname.startsWith("/Meet");
    const isAutomationActive = pathname.includes("/automation");
    const automationHref = workspaceId ? `/workspace/${workspaceId}/automation` : "";

    /**
     * WIDTH IS ANIMATED, CONTENT IS CROSS-FADED.
     *
     * The sidebar is a flex sibling that pushes the page, so the thing being
     * animated is its width — a transform would slide it over the content and
     * leave the gap it occupied snapping shut behind it.
     *
     * The inner body is pinned to whichever width it was rendered for and sits
     * absolutely inside the clipping shell, which is what stops it re-wrapping
     * 60 times a second as the box moves. Its `key` flips with the mode, so
     * AnimatePresence keeps the OUTGOING body mounted — still at its own width,
     * with its own props — and fades the two past each other while the shell
     * springs between the widths. Without that overlap the rail appeared
     * instantly at its final size inside a box still 288px wide, which is the
     * snap this replaces.
     *
     * `initial={false}`: arriving on a page with the sidebar already collapsed
     * must not play an entrance. The spring matches AiSidebar and the toasts,
     * so motion in this app reads as one system rather than per-component
     * taste.
     */
    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? RAIL_WIDTH : FULL_WIDTH }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="relative h-screen shrink-0 overflow-hidden sticky top-0 bg-card border-r border-hairline font-google-sans"
        >
            <AnimatePresence initial={false}>
                <motion.div
                    key={collapsed ? "rail" : "full"}
                    style={{ width: collapsed ? RAIL_WIDTH : FULL_WIDTH }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 flex flex-col"
                >

            {/* ── Brand + collapse toggle ─────────────────────────────

                 The logo TILE keeps the same box in both states: 12px in from the
                 shell edge, 22px down, 44px square — only what sits BESIDE it
                 changes. It used to carry px-2 py-1.5 when expanded and p-1 when
                 collapsed, so mid cross-fade the tile stepped 8px left and 2px up:
                 the one element that should be the anchor was the one thing
                 visibly jumping. 12px is also what centres it in the 68px rail,
                 on the same centre line the RailButtons below sit on. */}
            <div className="px-3 pt-4 pb-3">
                <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
                    <button
                        type="button"
                        onClick={() => router.push("/Home")}
                        title="Home"
                        className={`group flex h-11 items-center rounded-xl text-left transition  cursor-pointer ${collapsed ? "w-11 justify-center" : "flex-1 gap-2.5 pr-2"
                            }`}
                    >
                        <NavTile className="h-11 w-11 rounded-xl">
                            <Image src={logo} alt="Logo" priority className="h-8 w-8 object-contain" />
                        </NavTile>

                        {!collapsed && (
                            <span className="min-w-0">
                                <span className="flex items-center gap-0.5 text-[15px] font-bold text-slate-900 leading-none tracking-tight">
                                    Conexus
                                    <span className="brand-gradient-warm-text text-lg font-extrabold">
                                        X
                                    </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] font-medium text-muted">
                                    Modern CRM for agile teams
                                </span>
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-expanded={!collapsed}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                    >
                        {collapsed ? (
                            <TbLayoutSidebarLeftExpand className="h-[18px] w-[18px]" />
                        ) : (
                            <TbLayoutSidebarLeftCollapse className="h-[18px] w-[18px]" />
                        )}
                    </button>
                </div>
            </div>

            {/* ── Workspace switcher ─────────────────────────────────
                 Outside the scrolling <nav> ON PURPOSE: which workspace you are
                 in is the frame for everything below it, so it must not scroll
                 away with the modules it scopes. */}
            <div className={`pb-3 ${collapsed ? "flex justify-center px-3" : "px-3"}`}>
                <WorkspaceSwitcher
                    workspaces={workspaces}
                    activeId={workspaceId}
                    loading={loadingWorkspaces}
                    collapsed={collapsed}
                    onSelect={handleWorkspaceChange}
                    onCreate={() => setShowCreateModal(true)}
                />
            </div>

            {/* ── Navigation ────────────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">

                {collapsed ? (
                    /* ── Rail ──────────────────────────────────────────
                       Everything stays reachable: the same targets, reduced to
                       their icon or initial, each still navigating on click. */
                    <div className="flex flex-col items-center gap-1">
                        <RailButton
                            label="Extensions"
                            active={isExtensionsActive}
                            onClick={() => router.push("/Extensions")}
                        >
                            <TbPlug className="h-[18px] w-[18px]" />
                        </RailButton>

                        <RailButton
                            label="Conexus Meet"
                            active={isMeetActive}
                            onClick={() => router.push("/Meet")}
                        >
                            <TbMessages className="h-[18px] w-[18px]" />
                        </RailButton>

                        {automationHref && (
                            <RailButton
                                label="Automations"
                                active={isAutomationActive}
                                onClick={() => router.push(automationHref)}
                            >
                                <TbRoute className="h-[18px] w-[18px]" />
                            </RailButton>
                        )}

                        {modules.length > 0 && <span className="my-1 h-px w-6 bg-hairline" />}

                        {modules.map((moduleItem) => {
                            const active = pathname.includes(`/module/${moduleItem._id}`);

                            return (
                                <RailButton
                                    key={moduleItem._id}
                                    label={moduleItem.name}
                                    active={active}
                                    onClick={() =>
                                        router.push(
                                            `/workspace/${workspaceId}/module/${moduleItem._id}`
                                        )
                                    }
                                >
                                    <TbCards className="h-[18px] w-[18px]" />
                                </RailButton>
                            );
                        })}
                    </div>
                ) : (
                    <>

                {/* Extensions — where a workspace's own apps will be built and
                    deployed. Named for what it is FOR, not for what it contains:
                    "Apps" reads as a launcher of things that already exist. */}
                <Link
                    href="/Extensions"
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition cursor-pointer ${isExtensionsActive
                        ? "nav-glass font-semibold text-foreground"
                        : "font-medium text-slate-600 hover:bg-control/60 hover:text-slate-900"
                        }`}
                >
                    <NavTile>
                        <TbPlug className="h-4 w-4" />
                    </NavTile>
                    Extensions
                </Link>

                {/* Conexus Meet — chat and calls with the people in this
                    workspace. Sits directly under Extensions because both are
                    app-level: they belong to the account, not to whichever
                    module happens to be open. */}
                <Link
                    href="/Meet"
                    className={`mt-px flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition cursor-pointer ${isMeetActive
                        ? "nav-glass font-semibold text-foreground"
                        : "font-medium text-slate-600 hover:bg-control/60 hover:text-slate-900"
                        }`}
                >
                    <NavTile>
                        <TbMessages className="h-4 w-4" />
                    </NavTile>
                    Conexus Meet
                </Link>

                {automationHref && (
                    <Link
                        href={automationHref}
                        className={`mt-px flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition cursor-pointer ${isAutomationActive
                            ? "nav-glass font-semibold text-foreground"
                            : "font-medium text-slate-600 hover:bg-control/60 hover:text-slate-900"
                            }`}
                    >
                        <NavTile>
                            <TbRoute className="h-4 w-4" />
                        </NavTile>
                        Automations
                    </Link>
                )}

                {/* Extensions and Automations are app-level; everything below is
                    this account's content. One rule says that once, so the two
                    section headers can sit as close to each other as the two
                    links above them do. */}
                <div className="my-2 h-px bg-hairline" />

                {/* Modules — of the workspace named in the switcher above. */}
                <div>
                    <SectionHeader
                        icon={<TbCards className="h-4 w-4" />}
                        label="Modules"
                        count={modules.length}
                        open={openModule}
                        onToggle={() => setOpenModule(!openModule)}
                    />

                    {/* Indented under the section caption — the offset carries the
                        hierarchy, so each row no longer repeats the section icon. */}
                    {openModule && (
                        <div className="mt-0.5 space-y-px pl-6">
                            {loadingModules ? (
                                <RowSkeleton rows={4} />
                            ) : modules.length === 0 ? (
                                <p className="px-2 py-2 text-xs font-medium text-muted">
                                    No modules in this workspace yet
                                </p>
                            ) : (
                                modules.map((moduleItem) => {
                                    const active = pathname.includes(`/module/${moduleItem._id}`);

                                    return (
                                        <button
                                            key={moduleItem._id}
                                            onClick={() =>
                                                router.push(
                                                    `/workspace/${workspaceId}/module/${moduleItem._id}`
                                                )
                                            }
                                            title={moduleItem.name}
                                            className={`group flex w-full items-center rounded-lg px-2 py-1.5 text-sm transition cursor-pointer ${active
                                                ? "nav-glass font-semibold text-foreground"
                                                : "font-medium text-slate-600 hover:bg-control/60 hover:text-slate-900"
                                                }`}
                                        >
                                            <span className="truncate">{moduleItem.name}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                    </>
                )}
            </nav>

                </motion.div>
            </AnimatePresence>

            {/* ── Create workspace modal ──────────────────────────────
                 Portalled to <body>, so the shell's overflow-hidden — which is
                 what clips the body mid-animation — cannot clip it. */}
            {showCreateModal && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
                    onClick={closeCreateModal}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-hairline bg-card p-6 shadow-2xl font-google-sans"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                    <WorkspaceIcon
                                        iconKey={newWorkspaceIcon}
                                        className="h-5 w-5"
                                    />
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold leading-snug text-slate-900">
                                        Create Workspace
                                    </h2>
                                    <p className="mt-0.5 text-xs font-medium text-muted">
                                        Set up a new space to organize modules and team projects.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={closeCreateModal}
                                className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                                aria-label="Close"
                            >
                                <HiOutlineXMark className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Error Banner */}
                        {createError && (
                            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/80 p-3 text-xs font-medium text-red-600">
                                <HiOutlineExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                                <span>{createError}</span>
                            </div>
                        )}

                        {/* Input Field */}
                        <div className="mb-6">
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                Workspace Name
                            </label>
                            <input
                                type="text"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreateWorkspace();
                                    if (e.key === "Escape") closeCreateModal();
                                }}
                                placeholder="e.g. Sales & Marketing"
                                autoFocus
                                className="w-full rounded-xl border border-hairline bg-control/40 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-muted focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/10"
                            />
                        </div>

                        {/* Icon — a searchable grid.

                            A grid because the point is seeing them side by side;
                            searchable because ~70 will not fit in a glance. The
                            search reads each icon's TERMS as well as its label,
                            so "sales" finds Storefront, Revenue, Forecast and
                            Calls — matching labels alone is why icon pickers
                            usually feel broken. */}
                        <div className="mb-6">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-slate-700">
                                    Icon
                                </label>

                                <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-control/40 px-2 py-1">
                                    <HiOutlineMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted" />
                                    <input
                                        value={iconQuery}
                                        onChange={(e) => setIconQuery(e.target.value)}
                                        placeholder="sales, home, team…"
                                        className="w-40 bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-muted"
                                    />
                                </div>
                            </div>

                            {iconResults.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-hairline px-3 py-6 text-center text-xs text-muted">
                                    No icon matches &ldquo;{iconQuery}&rdquo;.
                                </p>
                            ) : (
                                <div className="max-h-44 overflow-y-auto rounded-lg border border-hairline p-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                                    <div className="grid grid-cols-8 gap-1.5">
                                        {iconResults.map(({ key, label, Icon }) => {
                                            const picked = key === newWorkspaceIcon;

                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setNewWorkspaceIcon(key)}
                                                    title={label}
                                                    aria-label={label}
                                                    aria-pressed={picked}
                                                    className={`flex h-9 w-full items-center justify-center rounded-lg border transition cursor-pointer ${picked
                                                        ? "border-accent bg-accent/10 text-accent"
                                                        : "border-hairline text-muted hover:border-accent/40 hover:text-slate-900"
                                                        }`}
                                                >
                                                    <Icon className="h-[18px] w-[18px]" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2.5">
                            <button
                                onClick={closeCreateModal}
                                className="rounded-xl bg-control px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-control-hover hover:text-slate-900 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateWorkspace}
                                disabled={creating || !newWorkspaceName.trim()}
                                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                            >
                                {creating ? "Creating..." : "Create Workspace"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </motion.aside>
    );
}
