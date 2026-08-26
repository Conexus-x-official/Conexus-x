"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ImUngroup } from "react-icons/im";
import { FaPlus } from "react-icons/fa";

import {
    HiBarsArrowDown,
    HiBarsArrowUp,
    HiOutlineMagnifyingGlass
} from "react-icons/hi2";

import Sidebar from "@/components/Sidebar";
import { toast } from "@/components/ui/toast";
import MemberInvite, { type InviteIdentifier } from "@/components/ui/modals/memberInvite";
import CreateModule from "@/components/ui/modals/createModule";
import DeleteModuleModal from "@/components/ui/modals/deleteModuleConfermation";
import ProfileDropdown from "@/components/Profile";
import AiSidebar from "@/components/AiSidebar";

import Tooltip from "@/components/ui/helpers/tooltip";
import { useSearchHotkey } from "@/lib/useSearchHotkey";
import { recordVisit } from "@/lib/recentWorkspaces";
import type { ModuleTag } from "@/store/types";
import WorkspaceBanner from "@/components/workspace/WorkspaceBanner";
import ModuleRow, { ModuleRowHeader } from "@/components/workspace/ModuleRow";
import {
    useGetWorkspaceQuery,
    useUpdateWorkspaceMutation
} from "@/store/api/workspaces.api";
import { useGetMembersQuery, useAddMemberMutation, useRemoveMemberMutation } from "@/store/api/members.api";
import {
    useGetModulesQuery,
    useCreateModuleMutation,
    useUpdateModuleMutation,
    useDeleteModuleMutation
} from "@/store/api/modules.api";


/** How far back a module must have been created to still count as "recent". */
const DATE_FILTERS = [
    { value: "any", label: "Any time", days: 0 },
    { value: "7", label: "Last 7 days", days: 7 },
    { value: "30", label: "Last 30 days", days: 30 },
    { value: "90", label: "Last 90 days", days: 90 }
] as const;

type DateFilter = (typeof DATE_FILTERS)[number]["value"];


export default function WorkspacePage() {
    const params = useParams();
    const workspaceId = params.id as string;

    /**
     * Opening this page IS the visit, so it is recorded here rather than in
     * each control that navigates here — the sidebar switcher, a Home row and a
     * pasted deep link all land on this component, and only one of them would
     * have been covered by hooking up the click handlers.
     *
     * Writing to localStorage is exactly what an effect is for (syncing an
     * external system); it sets no React state, so the set-state-in-effect rule
     * does not apply.
     */
    useEffect(() => {
        recordVisit(workspaceId);
    }, [workspaceId]);

    const [showInvite, setShowInvite] = useState(false);
    // Holds an email or a user id depending on the invite modal's tab.
    const [inviteIdentifier, setInviteIdentifier] = useState("");
    const [role, setRole] = useState("member");

    const [deleteModuleModal, setDeleteModuleModal] = useState<string | null>(null);
    const [showModuleModal, setShowModuleModal] = useState(false);
    const [moduleName, setModuleName] = useState("");
    const [moduleDescription, setModuleDescription] = useState("");

    // Three cached queries. `modules` is the same cache entry the Sidebar reads,
    // so this route no longer double-fetches it.
    const { data: workspace } = useGetWorkspaceQuery(workspaceId, { skip: !workspaceId });
    const { data: members = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });
    const { data: modules = [] } = useGetModulesQuery(workspaceId, { skip: !workspaceId });

    const [updateWorkspaceMutation] = useUpdateWorkspaceMutation();
    const [addMember, { isLoading: adding }] = useAddMemberMutation();
    const [removeMemberMutation] = useRemoveMemberMutation();
    const [createModuleMutation, { isLoading: creatingModule }] = useCreateModuleMutation();
    const [updateModuleMutation] = useUpdateModuleMutation();
    const [deleteModuleMutation] = useDeleteModuleMutation();

    const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
    const [savingBanner, setSavingBanner] = useState(false);

    /**
     * Finding controls. All three are plain state and the list below is derived
     * from them — nothing is stored, so a refresh returns you to the full list
     * rather than to a filter you had forgotten about.
     */
    const [query, setQuery] = useState("");
    const [sortAsc, setSortAsc] = useState(true);

    // Same key as the dashboard's search — see lib/useSearchHotkey.ts.
    const searchRef = useRef<HTMLInputElement>(null);
    useSearchHotkey(searchRef);

    /**
     * The date window is stored as a resolved CUTOFF, computed when the filter
     * is chosen rather than on every render.
     *
     * Two reasons. Date.now() in a render body is an impure call and the React
     * Compiler rejects it. And pinning the boundary at the moment of choosing is
     * the better behaviour anyway: a cutoff recomputed each render would let
     * rows quietly fall out of "Last 7 days" while someone was reading the list.
     */
    const [dateFilter, setDateFilter] = useState<DateFilter>("any");
    const [cutoff, setCutoff] = useState<number | null>(null);

    const pickDateFilter = (value: DateFilter) => {
        const days = DATE_FILTERS.find((f) => f.value === value)?.days ?? 0;
        setDateFilter(value);
        setCutoff(days ? Date.now() - days * 24 * 60 * 60 * 1000 : null);
    };

    const clearFilters = () => {
        setQuery("");
        setDateFilter("any");
        setCutoff(null);
    };

    const handleInviteMember = async (identifier: InviteIdentifier) => {
        try {
            await addMember({ workspaceId, role, ...identifier }).unwrap();
            setInviteIdentifier("");
            setRole("member");
            setShowInvite(false);
        } catch (error) {
            console.error("Invite member failed:", error);
        }
    };

    const handleRemoveMember = async (memberUserId: string) => {
        try {
            await removeMemberMutation({ workspaceId, memberUserId }).unwrap();
        } catch (error) {
            console.error("Remove member failed:", error);
        }
    };

    /**
     * The cover is per workspace, so it is saved on the workspace itself. The
     * Workspace tag invalidation is what repaints the banner — no local copy of
     * the value is kept, so the picker can never disagree with what was stored.
     */
    const handleChangeBanner = async (key: string) => {
        setSavingBanner(true);

        try {
            await updateWorkspaceMutation({ id: workspaceId, banner: key }).unwrap();
            toast.success("Cover updated");
        } catch (error) {
            toast.error(
                "Could not change the cover",
                (error as { data?: { message?: string } })?.data?.message
            );
        } finally {
            setSavingBanner(false);
        }
    };

    const handleCreateModule = async () => {
        if (!moduleName.trim()) return;
        try {
            await createModuleMutation({
                workspaceId,
                name: moduleName,
                description: moduleDescription
            }).unwrap();
            setModuleName("");
            setModuleDescription("");
            setShowModuleModal(false);
        } catch (error) {
            console.error("Create module failed:", error);
        }
    };

    /**
     * Tags replace as a whole set — the row owns the add/remove arithmetic and
     * names the change; this owns whether it actually landed. A failed write
     * used to disappear into console.error, so the tag simply never appeared
     * and nothing said why.
     */
    const handleSaveTags = async (
        moduleId: string,
        tags: ModuleTag[],
        note: string
    ) => {
        try {
            await updateModuleMutation({ moduleId, workspaceId, tags }).unwrap();
            toast.success(note);
        } catch (error) {
            toast.error(
                "Could not save tags",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const handleDeleteModule = async (moduleId: string) => {
        setDeletingModuleId(moduleId);
        try {
            await deleteModuleMutation({ moduleId, workspaceId }).unwrap();
            setDeleteModuleModal(null);
        } catch (error) {
            console.error("Delete module failed:", error);
        } finally {
            setDeletingModuleId(null);
        }
    };

    const moduleCount = modules.length;
    const memberCount = members.length;

    const needle = query.trim().toLowerCase();

    /**
     * Search, then date, then sort — in that order, and always from `modules`
     * rather than from a previous result, so the three controls stay
     * independent of each other.
     *
     * localeCompare, not `<`: a plain comparison orders by code point, which
     * puts every capitalised name above every lower-case one and mis-sorts
     * accents.
     */
    const visibleModules = modules
        .filter((m) => (needle ? m.name.toLowerCase().includes(needle) : true))
        .filter((m) => {
            if (cutoff === null) return true;
            // A module with no timestamp cannot be shown to be recent, so a
            // date filter excludes it rather than guessing.
            const created = m.createdAt ? new Date(m.createdAt).getTime() : NaN;
            return !isNaN(created) && created >= cutoff;
        })
        .slice()
        .sort((a, b) =>
            sortAsc
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name)
        );

    /**
     * Every tag in use across this workspace, first spelling and colour wins.
     *
     * Derived from the modules already loaded, so offering reuse costs no
     * request — and a tag typed on one module is immediately offered on the
     * rest, which is the only way they stay ONE tag rather than four
     * near-identical ones.
     */
    const knownTags = (() => {
        const seen = new Map<string, ModuleTag>();
        for (const m of modules) {
            for (const tag of m.tags ?? []) {
                const key = tag.label.toLowerCase();
                if (!seen.has(key)) seen.set(key, tag);
            }
        }
        return Array.from(seen.values());
    })();

    /** Distinguishes "nothing here" from "nothing matches what you asked". */
    const filtering = Boolean(needle) || dateFilter !== "any";

    // Render
    return (
        <>
            <section className="flex bg-canvas">
                <Sidebar />

                {/* Shell card — the frame every page sits in (LAYOUT.md §7) */}
                <div className="min-h-screen w-full flex flex-col bg-panel overflow-hidden shadow-sm">

                    {/* Top navbar */}
                    <header className="sticky top-0 z-20 bg-panel border-b border-slate-200">
                        <div className="w-full mx-auto px-6 h-16 flex items-center justify-between gap-4">
                            {/* Just the label — no tile. The banner below carries
                                the workspace's colour AND its name at a size worth
                                reading; repeating both up here said everything
                                twice and still left the name easy to miss. */}
                            <div className="flex items-center gap-3 min-w-0">
                                <h1 className="truncate text-lg font-semibold text-slate-900 font-dmsans">
                                    Workspace
                                </h1>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <ProfileDropdown />
                            </div>
                        </div>
                    </header>

                    {/* Content */}
                    <div className="flex-1 space-y-6 px-6 py-6">

                        <WorkspaceBanner
                            name={workspace?.name || "Workspace"}
                            icon={workspace?.icon}
                            moduleCount={moduleCount}
                            memberCount={memberCount}
                            members={members}
                            workspaceId={workspaceId}
                            onInvite={() => setShowInvite(true)}
                            banner={workspace?.banner}
                            onChangeBanner={handleChangeBanner}
                            savingBanner={savingBanner}
                        />

                        <section>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-semibold text-slate-900 font-dmsans">
                                        Modules
                                    </h2>
                                    <p className="mt-0.5 text-xs text-muted font-dmsans">
                                        {moduleCount === 0
                                            ? "Nothing here yet"
                                            : "Open a module to work on its records"}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Only worth showing once there is a list to
                                        narrow — on an empty workspace these are
                                        three controls over nothing. */}
                                    {moduleCount > 0 && (
                                        <>
                                            <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-card px-3">
                                                <HiOutlineMagnifyingGlass className="h-4 w-4 shrink-0 text-muted" />
                                                <input
                                                    ref={searchRef}
                                                    value={query}
                                                    onChange={(e) => setQuery(e.target.value)}
                                                    placeholder="Find a module"
                                                    className="w-32 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-muted font-dmsans"
                                                />

                                                {/* The shortcut is only worth
                                                    advertising where it works. */}
                                                <span className="hidden shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-control/60 px-1.5 py-0.5 sm:flex">
                                                    <span className="text-[10px] text-muted">Ctrl</span>
                                                    <span className="text-[10px] text-muted/60">+</span>
                                                    <span className="text-[10px] text-muted">K</span>
                                                </span>
                                            </div>

                                            <Tooltip
                                                label="Filter by when the module was created"
                                                side="bottom"
                                            >
                                            <select
                                                value={dateFilter}
                                                onChange={(e) => pickDateFilter(e.target.value as DateFilter)}
                                                aria-label="Filter by when the module was created"
                                                className="h-10 rounded-xl border border-slate-200 bg-card px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-accent cursor-pointer font-dmsans"
                                            >
                                                {DATE_FILTERS.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            </Tooltip>

                                            {/* One button, not two: sorting by
                                                name has exactly two directions,
                                                and a pair of radio buttons for a
                                                binary is a control too many. */}
                                            <Tooltip
                                                label={
                                                    sortAsc
                                                        ? "Sorted A to Z — click for Z to A"
                                                        : "Sorted Z to A — click for A to Z"
                                                }
                                                side="bottom"
                                            >
                                            <button
                                                onClick={() => setSortAsc((v) => !v)}
                                                aria-label="Toggle sort direction"
                                                className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-card px-3 text-sm font-medium text-slate-800 transition hover:border-accent/50 cursor-pointer font-dmsans"
                                            >
                                                {sortAsc ? (
                                                    <HiBarsArrowUp className="h-4 w-4 text-muted" />
                                                ) : (
                                                    <HiBarsArrowDown className="h-4 w-4 text-muted" />
                                                )}
                                                {sortAsc ? "A–Z" : "Z–A"}
                                            </button>
                                            </Tooltip>
                                        </>
                                    )}

                                    <Tooltip
                                        label="Create a module in this workspace"
                                        side="bottom"
                                    >
                                        <button
                                            onClick={() => setShowModuleModal(true)}
                                            className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover cursor-pointer font-dmsans"
                                        >
                                            <FaPlus size={11} />
                                            New Module
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            {moduleCount === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-card/60 px-6 py-16 text-center">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                        <ImUngroup size={24} />
                                    </div>

                                    <h3 className="text-base font-semibold text-slate-900 font-dmsans">
                                        No modules yet
                                    </h3>

                                    <p className="mt-1 text-sm text-muted font-dmsans">
                                        Create your first module to start organizing work
                                    </p>
                                </div>
                            ) : visibleModules.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-card/60 px-6 py-12 text-center font-dmsans">
                                    <p className="text-sm text-muted">
                                        No module matches {needle ? `"${query.trim()}"` : "that filter"}.
                                    </p>

                                    {filtering && (
                                        <button
                                            onClick={clearFilters}
                                            className="mt-3 text-xs font-semibold text-accent transition hover:underline cursor-pointer"
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* One bordered list, not a grid of cards: the
                                   names line up in a single column, which is
                                   what the eye actually scans. */
                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-card">
                                    <ModuleRowHeader />

                                    {visibleModules.map((module) => (
                                        <ModuleRow
                                            key={module._id}
                                            module={module}
                                            workspaceId={workspaceId}
                                            onDelete={(moduleId) => setDeleteModuleModal(moduleId)}
                                            onSaveTags={handleSaveTags}
                                            knownTags={knownTags}
                                            deleting={deletingModuleId === module._id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Invite Member Modal */}
                    <MemberInvite
                        open={showInvite}
                        setOpen={setShowInvite}
                        identifier={inviteIdentifier}
                        setIdentifier={setInviteIdentifier}
                        role={role}
                        setRole={setRole}
                        adding={adding}
                        inviteMember={handleInviteMember}
                    />

                    {/* Create Module Modal */}
                    <CreateModule
                        open={showModuleModal}
                        setOpen={setShowModuleModal}
                        moduleName={moduleName}
                        setModuleName={setModuleName}
                        moduleDescription={moduleDescription}
                        setModuleDescription={setModuleDescription}
                        creatingModule={creatingModule}
                        createModule={handleCreateModule}
                    />

                    {/* Delete Module Confirmation Modal */}
                    <DeleteModuleModal
                        deleteModuleModal={deleteModuleModal}
                        modules={modules}
                        deleteModule={handleDeleteModule}
                        deletingModuleId={deletingModuleId}
                        setDeleteModuleModal={setDeleteModuleModal}
                    />
                </div>

                {/* Right rail — Aquiline (CRM) and Relay (workflows) */}
                <AiSidebar
                    agent="aquiline"
                    context={workspace?.name || "this workspace"}
                    workspaceId={workspaceId}
                />
            </section>
        </>
    );
}
