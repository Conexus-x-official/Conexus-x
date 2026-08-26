"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
    HiOutlineEllipsisVertical,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
} from "react-icons/hi2";
import { TbLayoutGrid, TbHistory, TbCards } from "react-icons/tb";
import WorkspaceMenu from "./ui/modals/workspaceMenu";
import RenameWorkspace from "./ui/modals/renameWorkspace";
import DeleteWorkspace from "./ui/modals/deleteWorkspace";
import CollectionLoader from "./CollectionLoader";
import { toast } from "./ui/toast";
import {
    useGetWorkspacesQuery,
    useUpdateWorkspaceMutation,
    useDeleteWorkspaceMutation
} from "@/store/api/workspaces.api";
import { useAllModules } from "@/store/useAllModules";
import { filterWorkspaces } from "@/store/selectors/workspace.selectors";
import { WorkspaceIcon } from "@/lib/workspaceIcons";
import {
    readVisits,
    readVisitsServer,
    subscribeVisits,
    visitedAt,
} from "@/lib/recentWorkspaces";
import type { Workspace as WorkspaceData } from "@/store/types";

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
/** Average month/year lengths — good enough for a "5 months ago" label. */
const MONTH = DAY * 30.44;
const YEAR = DAY * 365.25;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;

/**
 * Relative age for the table cell — days, weeks, months, years. The exact
 * timestamp stays one click away in the popover (and on hover via `title`),
 * because "3 weeks ago" is what you scan for and the date is what you verify.
 */
function formatRelative(dateStr: string): string {
    if (!dateStr) return "-";

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    // A clock skew between server and browser can push this negative.
    if (seconds < 0) return "Just now";

    if (seconds < MINUTE) return "Just now";
    if (seconds < HOUR) return plural(Math.floor(seconds / MINUTE), "minute");
    if (seconds < DAY) return plural(Math.floor(seconds / HOUR), "hour");

    const days = Math.floor(seconds / DAY);
    if (days === 1) return "Yesterday";
    if (seconds < WEEK) return plural(days, "day");

    if (seconds < MONTH) return plural(Math.floor(seconds / WEEK), "week");
    if (seconds < YEAR) return plural(Math.floor(seconds / MONTH), "month");

    return plural(Math.floor(seconds / YEAR), "year");
}

function formatExactDate(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    } catch {
        return dateStr;
    }
}

/**
 * The tabs, as a table rather than three strings.
 *
 * Each carries its own icon, so adding a tab is a row here instead of a label in
 * one place and an `=== "Recently Visited"` test somewhere else. The glyphs are
 * ones this codebase already uses for these nouns — TbCards is the module glyph
 * in the Sidebar, TbHistory is Activity in the profile menu — so a reader who
 * has met them elsewhere does not have to learn a second vocabulary.
 */
const TABS = [
    { value: "Workspace", label: "Workspace", icon: TbLayoutGrid },
    { value: "Recently Visited", label: "Recently Visited", icon: TbHistory },
    { value: "New Modules", label: "New Modules", icon: TbCards },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const ITEMS_PER_PAGE = 10;

/**
 * A date, relative in the row and exact in a popover.
 *
 * Extracted because the Created and Updated cells were two near-identical
 * thirty-line blocks, which is how the two drift: a fix applied to one and not
 * the other. The open popover is keyed by the PARENT so only one is ever open
 * across the whole table, and so the shell's click-away can close it.
 */
function DateCell({
    id,
    heading,
    tone,
    value,
    openKey,
    onOpen,
}: {
    id: string;
    heading: string;
    tone: "blue" | "emerald";
    value: string;
    openKey: string | null;
    onOpen: (key: string | null) => void;
}) {
    const isOpen = openKey === id;

    const pill =
        tone === "blue"
            ? "bg-blue-50 text-blue-600"
            : "bg-emerald-50 text-emerald-600";

    return (
        <td className="relative z-1 px-6 py-3 text-sm font-google-sans text-body">
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onOpen(isOpen ? null : id);
                }}
                title={formatExactDate(value)}
                className="cursor-pointer text-body transition hover:text-foreground hover:underline"
            >
                {formatRelative(value)}
            </button>

            {isOpen && (
                <div
                    onClick={(event) => event.stopPropagation()}
                    className="absolute left-6 top-12 z-20 w-64 rounded-xl border border-hairline bg-card p-3 text-xs font-google-sans shadow-lg animate-in fade-in zoom-in-95 duration-100"
                >
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-semibold text-foreground">{heading}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${pill}`}>
                            {tone === "blue" ? "Created" : "Updated"}
                        </span>
                    </div>

                    <p className="pt-1 font-medium text-body">{formatExactDate(value)}</p>
                    <p className="pb-1 text-[11px] text-muted">{formatRelative(value)}</p>
                </div>
            )}
        </td>
    );
}

/** Shared column head styling — one declaration, both tables. */
const HEAD_ROW =
    "text-left [&>th]:px-6 [&>th]:py-3 [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-muted [&>th]:font-google-sans";

const ROW =
    "group cursor-pointer text-body transition hover:bg-control/50";

/**
 * The leading cell of every row: a tile plus a name.
 *
 * The table used to open with the raw workspace id, which is the least useful
 * thing about a row and the first thing the eye landed on. The name leads now,
 * with the icon giving each row something to recognise at a glance rather than
 * a column of identical text. The id has not been lost — it is on the row menu,
 * behind Copy ID, which is the only way anyone actually used it.
 */
function NameCell({
    icon,
    name,
    hint,
}: {
    icon: React.ReactNode;
    name: string;
    hint?: string;
}) {
    return (
        <td className="px-6 py-2.5">
            <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-control text-body transition group-hover:bg-control-hover">
                    {icon}
                </span>

                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold font-google-sans text-foreground">
                        {name}
                    </span>
                    {hint && (
                        <span className="mt-0.5 block truncate text-[11px] text-muted">
                            {hint}
                        </span>
                    )}
                </span>
            </div>
        </td>
    );
}

function CountCell({ value }: { value: number }) {
    return (
        <td className="px-6 py-2.5 text-center">
            <span
                className={`inline-flex min-w-7 justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${value > 0
                    ? "bg-control text-foreground"
                    : "text-muted"
                    }`}
            >
                {value}
            </span>
        </td>
    );
}

function EmptyRow({ span, children }: { span: number; children: React.ReactNode }) {
    return (
        <tr>
            <td colSpan={span} className="py-20 text-center text-sm text-muted font-google-sans">
                {children}
            </td>
        </tr>
    );
}

interface WorkspaceTableProps {
    searchQuery?: string;
}

export default function WorkspaceTable({ searchQuery = "" }: WorkspaceTableProps) {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabValue>("Workspace");
    const [currentPage, setCurrentPage] = useState(1);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [openDatePopover, setOpenDatePopover] = useState<string | null>(null);
    const [copyingId, setCopyingId] = useState<string | null>(null);
    const [workspaceToRename, setWorkspaceToRename] = useState<WorkspaceData | null>(null);
    const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceData | null>(null);

    const [updateWorkspace, { isLoading: renaming }] = useUpdateWorkspaceMutation();
    const [deleteWorkspace, { isLoading: deleting }] = useDeleteWorkspaceMutation();

    // Shared cache: the Sidebar and the dashboard read the same entry, one request total.
    const { data: workspaces = [], isLoading: loadingWorkspaces, isError } = useGetWorkspacesQuery();
    const error = isError ? "Failed to load workspaces" : "";

    const isModuleTab = activeTab === "New Modules";

    /**
     * Visit history is a browser store, not React state, so it is read through
     * useSyncExternalStore — which also fixes the hydration problem for free by
     * giving the server an always-empty snapshot that the first client render
     * matches.
     */
    const visits = useSyncExternalStore(subscribeVisits, readVisits, readVisitsServer);

    // Only the New Modules tab needs every workspace's modules, and each one is
    // a request — so nothing is fetched until that tab is actually open.
    const workspaceIds = useMemo(
        () => workspaces.map((workspace: WorkspaceData) => workspace._id),
        [workspaces]
    );
    const { modules: moduleRows, isLoading: loadingModules } = useAllModules(
        workspaceIds,
        !isModuleTab
    );

    const workspaceNameById = useMemo(() => {
        const map: Record<string, string> = {};
        workspaces.forEach((workspace: WorkspaceData) => {
            map[workspace._id] = workspace.name;
        });
        return map;
    }, [workspaces]);

    /** Client-side filtering over cached data — never hits the backend. */
    const matchingWorkspaces = useMemo(
        () => filterWorkspaces(workspaces, searchQuery),
        [workspaces, searchQuery]
    );

    /**
     * Recently Visited is the SAME workspaces, ordered by this browser's own
     * history and cut to what was actually opened — a workspace you have never
     * visited has no place on a list of what you visited, so it is filtered out
     * rather than sorted to the bottom.
     */
    const visibleWorkspaces = useMemo(() => {
        if (activeTab !== "Recently Visited") return matchingWorkspaces;

        return matchingWorkspaces
            .filter((workspace) => visitedAt(visits, workspace._id) !== undefined)
            .sort(
                (a, b) =>
                    (visitedAt(visits, b._id) ?? 0) - (visitedAt(visits, a._id) ?? 0)
            );
    }, [activeTab, matchingWorkspaces, visits]);

    /** Newest first — "New Modules" is a recency list, not an alphabetical one. */
    const visibleModules = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();

        return moduleRows
            .filter(({ module }) =>
                needle ? module.name.toLowerCase().includes(needle) : true
            )
            .sort(
                (a, b) =>
                    new Date(b.module.createdAt ?? 0).getTime() -
                    new Date(a.module.createdAt ?? 0).getTime()
            );
    }, [moduleRows, searchQuery]);

    const total = isModuleTab ? visibleModules.length : visibleWorkspaces.length;
    const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

    // Clamp instead of resetting from an effect: a shrinking result set can leave
    // currentPage past the end, and this derives the fix during render.
    const safePage = Math.min(currentPage, totalPages);
    const sliceStart = (safePage - 1) * ITEMS_PER_PAGE;

    const pagedWorkspaces = visibleWorkspaces.slice(sliceStart, sliceStart + ITEMS_PER_PAGE);
    const pagedModules = visibleModules.slice(sliceStart, sliceStart + ITEMS_PER_PAGE);

    const startItem = total === 0 ? 0 : sliceStart + 1;
    const endItem = Math.min(safePage * ITEMS_PER_PAGE, total);

    const loading = isModuleTab ? loadingWorkspaces || loadingModules : loadingWorkspaces;

    /** The server owns validation; its message is shown verbatim. */
    const messageFrom = (error: unknown, fallback: string) => {
        const data = (error as { data?: { message?: string } })?.data;
        return data?.message || fallback;
    };

    const renameWorkspace = async (name: string) => {
        if (!workspaceToRename) return;

        const previous = workspaceToRename.name;

        try {
            await updateWorkspace({ id: workspaceToRename._id, name }).unwrap();
            setWorkspaceToRename(null);
            toast.success(`Renamed to ${name}`, `Was "${previous}"`);
        } catch (error) {
            toast.error(messageFrom(error, "Could not rename that workspace."));
        }
    };

    const removeWorkspace = async () => {
        if (!workspaceToDelete) return;

        const { name } = workspaceToDelete;

        try {
            await deleteWorkspace(workspaceToDelete._id).unwrap();
            setWorkspaceToDelete(null);
            toast.success(`Deleted ${name}`, "Everything inside it went with it");
        } catch (error) {
            toast.error(messageFrom(error, "Could not delete that workspace."));
        }
    };

    return (
        <div
            className="bg-card overflow-hidden h-full flex flex-col"
            onClick={() => {
                setOpenDatePopover(null);
                setOpenMenu(null);
            }}
        >
            {/*
                Pills, not an underline.

                Selection and hover are the SAME treatment the sidebar uses —
                .nav-glass for the selected row, a light neutral wash on hover —
                so "you are here" looks identical wherever it appears. The glass
                is deliberately the stronger of the two: hover is a flat wash,
                selected adds the inset ring and top highlight on top of a
                heavier fill, so the two can never be mistaken for each other.
            */}
            <div className="flex shrink-0 items-center gap-1 px-6 py-2 select-none">
                {TABS.map(({ value, label, icon: Icon }) => {
                    const isActive = activeTab === value;

                    return (
                        <button
                            key={value}
                            onClick={() => {
                                setActiveTab(value);
                                setCurrentPage(1);
                            }}
                            aria-pressed={isActive}
                            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium font-google-sans transition cursor-pointer ${isActive
                                ? "nav-glass text-foreground"
                                : "text-muted hover:bg-control/50 hover:text-foreground"
                                }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 overflow-auto">
                {loading ? (
                    <CollectionLoader rows={ITEMS_PER_PAGE} columns={isModuleTab ? 4 : 5} />
                ) : error ? (
                    <div className="py-20 text-center text-sm font-medium text-red-400">
                        {error}
                    </div>
                ) : isModuleTab ? (
                    <table className="w-full border-collapse">
                        {/* Sticky, and opaque BECAUSE it is sticky — a
                            see-through header lets rows scroll up through it. */}
                        <thead className="sticky top-0 z-10 bg-card">
                            <tr className={HEAD_ROW}>
                                <th>Module</th>
                                <th>Workspace</th>
                                <th>Created</th>
                                <th className="text-center">Records</th>
                            </tr>
                        </thead>

                        <tbody>
                            {pagedModules.length === 0 ? (
                                <EmptyRow span={4}>
                                    {searchQuery.trim()
                                        ? "No module matches that search"
                                        : "No modules yet — create one inside a workspace"}
                                </EmptyRow>
                            ) : (
                                pagedModules.map(({ id, workspaceId, module }) => (
                                    <tr
                                        key={id}
                                        onClick={() =>
                                            router.push(`/workspace/${workspaceId}/module/${module._id}`)
                                        }
                                        className={ROW}
                                    >
                                        <NameCell
                                            icon={<TbCards className="h-4 w-4" />}
                                            name={module.name}
                                        />

                                        <td className="px-6 py-2.5">
                                            <span className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-md bg-control px-2 py-1 text-[11px] font-medium text-body">
                                                <WorkspaceIcon
                                                    iconKey={
                                                        workspaces.find(
                                                            (w: WorkspaceData) => w._id === workspaceId
                                                        )?.icon
                                                    }
                                                    className="h-3 w-3 shrink-0"
                                                />
                                                <span className="truncate">
                                                    {workspaceNameById[workspaceId] ?? "Workspace"}
                                                </span>
                                            </span>
                                        </td>

                                        <DateCell
                                            id={`module-created-${module._id}`}
                                            heading="Exact created date"
                                            tone="blue"
                                            value={module.createdAt ?? ""}
                                            openKey={openDatePopover}
                                            onOpen={(key) => {
                                                setOpenDatePopover(key);
                                                setOpenMenu(null);
                                            }}
                                        />

                                        <CountCell value={module.totalRecords ?? 0} />
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-card">
                            <tr className={HEAD_ROW}>
                                <th>Workspace</th>
                                <th>
                                    {activeTab === "Recently Visited" ? "Last visited" : "Created"}
                                </th>
                                <th>Updated</th>
                                <th className="text-center">Modules</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {pagedWorkspaces.length === 0 ? (
                                <EmptyRow span={5}>
                                    {activeTab === "Recently Visited"
                                        ? "Nothing visited yet — open a workspace and it will appear here"
                                        : searchQuery.trim()
                                            ? "No workspace matches that search"
                                            : "No workspaces yet"}
                                </EmptyRow>
                            ) : (
                                pagedWorkspaces.map((workspace) => {
                                    const visited = visitedAt(visits, workspace._id);

                                    return (
                                        <tr
                                            key={workspace._id}
                                            onClick={() => router.push(`/workspace/${workspace._id}`)}
                                            className={ROW}
                                        >
                                            <NameCell
                                                icon={
                                                    <WorkspaceIcon
                                                        iconKey={workspace.icon}
                                                        className="h-4 w-4"
                                                    />
                                                }
                                                name={workspace.name}
                                            />

                                            {activeTab === "Recently Visited" ? (
                                                <td
                                                    className="px-6 py-2.5 text-sm font-google-sans text-body"
                                                    title={
                                                        visited
                                                            ? formatExactDate(new Date(visited).toISOString())
                                                            : undefined
                                                    }
                                                >
                                                    {visited
                                                        ? formatRelative(new Date(visited).toISOString())
                                                        : "-"}
                                                </td>
                                            ) : (
                                                <DateCell
                                                    id={`created-${workspace._id}`}
                                                    heading="Exact created date"
                                                    tone="blue"
                                                    value={workspace.createdAt}
                                                    openKey={openDatePopover}
                                                    onOpen={(key) => {
                                                        setOpenDatePopover(key);
                                                        setOpenMenu(null);
                                                    }}
                                                />
                                            )}

                                            <DateCell
                                                id={`updated-${workspace._id}`}
                                                heading="Exact updated date"
                                                tone="emerald"
                                                value={workspace.updatedAt}
                                                openKey={openDatePopover}
                                                onOpen={(key) => {
                                                    setOpenDatePopover(key);
                                                    setOpenMenu(null);
                                                }}
                                            />

                                            <CountCell value={workspace.totalModules ?? 0} />

                                            <td className="px-6 py-2.5 text-center">
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setOpenMenu(
                                                                openMenu === workspace._id ? null : workspace._id
                                                            );
                                                        }}
                                                        aria-label={`Actions for ${workspace.name}`}
                                                        className="rounded-md p-1.5 text-muted transition hover:bg-control hover:text-foreground cursor-pointer"
                                                    >
                                                        <HiOutlineEllipsisVertical className="h-5 w-5" />
                                                    </button>

                                                    {openMenu === workspace._id && (
                                                        <WorkspaceMenu
                                                            workspace={workspace}
                                                            copyingId={copyingId}
                                                            setCopyingId={setCopyingId}
                                                            setOpenMenu={setOpenMenu}
                                                            onRename={setWorkspaceToRename}
                                                            onDelete={setWorkspaceToDelete}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Footer */}
            <div className="shrink-0 border-t border-hairline px-6 py-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted font-google-sans">
                        Showing{" "}
                        <span className="font-medium text-foreground">
                            {startItem}-{endItem}
                        </span>{" "}
                        of <span className="font-medium text-foreground">{total}</span>
                    </p>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(Math.max(safePage - 1, 1))}
                            disabled={safePage === 1}
                            aria-label="Previous page"
                            className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition hover:bg-control hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                        >
                            <HiOutlineChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                        </button>

                        {Array.from({ length: totalPages }, (_, index) => index + 1)
                            // A long run collapses around the current page rather
                            // than printing forty buttons.
                            .filter(
                                (page) =>
                                    totalPages <= 7 ||
                                    page === 1 ||
                                    page === totalPages ||
                                    Math.abs(page - safePage) <= 1
                            )
                            .map((page, index, shown) => (
                                <span key={page} className="flex items-center gap-1">
                                    {index > 0 && page - shown[index - 1] > 1 && (
                                        <span className="w-5 text-center text-muted">…</span>
                                    )}

                                    <button
                                        onClick={() => setCurrentPage(page)}
                                        aria-current={safePage === page ? "page" : undefined}
                                        className={`h-9 min-w-9 rounded-md px-2 text-sm font-medium font-google-sans transition cursor-pointer ${safePage === page
                                            ? "nav-glass text-foreground"
                                            : "text-body hover:bg-control"
                                            }`}
                                    >
                                        {page}
                                    </button>
                                </span>
                            ))}

                        <button
                            onClick={() => setCurrentPage(Math.min(safePage + 1, totalPages))}
                            disabled={safePage === totalPages}
                            aria-label="Next page"
                            className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition hover:bg-control hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                        >
                            <HiOutlineChevronRight className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Keyed on the workspace so the rename field re-seeds each time
                it is opened for a different row. */}
            <RenameWorkspace
                key={workspaceToRename?._id ?? "rename"}
                workspace={workspaceToRename}
                saving={renaming}
                onClose={() => setWorkspaceToRename(null)}
                onSave={renameWorkspace}
            />

            <DeleteWorkspace
                workspace={workspaceToDelete}
                deleting={deleting}
                onClose={() => setWorkspaceToDelete(null)}
                onConfirm={removeWorkspace}
            />
        </div>
    );
}
