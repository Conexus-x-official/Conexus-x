"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useRealtimeRoom } from "@/store/useRealtimeRoom";
import Link from "next/link";
import { TbBuildingCommunity, TbLayoutGrid } from "react-icons/tb";
import { HiOutlineClock, HiOutlinePlus } from "react-icons/hi2";

import ProfileDropdown from "@/components/Profile";
import AiSidebar from "@/components/AiSidebar";
import AutomationBuilder from "@/components/ui/modals/automationBuilder";
import BackButton from "@/components/ui/buttons/backButton";
import AutomationCard from "@/components/automation/AutomationCard";
import ModulePicker from "@/components/automation/ModulePicker";
import type { Vocabulary } from "@/components/automation/shared";
import NavTile from "@/components/ui/helpers/navTile";
import { WorkspaceIcon } from "@/lib/workspaceIcons";

import { useGetWorkspaceQuery } from "@/store/api/workspaces.api";
import { useGetModulesQuery } from "@/store/api/modules.api";
import { useGetColumnsQuery, useGetSubColumnsQuery } from "@/store/api/columns.api";
import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useAutomationRuns } from "@/store/useAutomationRuns";
import { buildLexicon } from "@/lib/automation/describe";
import {
    useGetAutomationsQuery,
    useGetWorkspaceAutomationsQuery,
    useUpdateAutomationMutation,
    useDeleteAutomationMutation,
    type Automation,
    type AutomationScope
} from "@/store/api/automations.api";

/**
 * Which modules a recipe is allowed to touch.
 *
 * Two words each, no explanatory paragraph underneath — the difference is
 * legible from the labels, and a blurb under a two-option toggle is noise on
 * every visit after the first.
 */
const SCOPES: { value: AutomationScope; label: string; icon: typeof TbLayoutGrid }[] = [
    { value: "module", label: "This module", icon: TbLayoutGrid },
    { value: "workspace", label: "Every module", icon: TbBuildingCommunity }
];

interface BuilderSession {
    scope: AutomationScope;
    editing: Automation | null;
}

export default function AutomationPage() {
    const params = useParams();
    const workspaceId = params.id as string;

    useRealtimeRoom({ workspaceId });

    const { data: workspace } = useGetWorkspaceQuery(workspaceId, { skip: !workspaceId });
    const { data: modules = [] } = useGetModulesQuery(workspaceId, { skip: !workspaceId });

    /**
     * Module-scoped recipes are written against one module's columns, so one is
     * always picked. Derived rather than seeded in an effect, so the first
     * module is selected on the very first render instead of one paint later.
     */
    const [pickedModuleId, setPickedModuleId] = useState("");
    const moduleId = pickedModuleId || modules[0]?._id || "";

    const [scope, setScope] = useState<AutomationScope>("module");

    const { data: moduleAutomations = [], isLoading: loadingModule } =
        useGetAutomationsQuery(moduleId, { skip: !moduleId });

    const { data: workspaceAutomations = [], isLoading: loadingWorkspace } =
        useGetWorkspaceAutomationsQuery(workspaceId, { skip: !workspaceId });

    /**
     * The module's vocabulary. Loaded here rather than inside the builder
     * because the CARDS need it too — a recipe's sentence is built from the
     * same column and collection names the builder offers.
     */
    const { data: columns = [] } = useGetColumnsQuery(moduleId, { skip: !moduleId });
    const { data: subColumns = [] } = useGetSubColumnsQuery(moduleId, { skip: !moduleId });
    const { data: collections = [] } = useGetCollectionsQuery(moduleId, { skip: !moduleId });

    // Announces runs as they happen and refreshes runCount / lastRunAt with them.
    useAutomationRuns(workspaceId, moduleId);

    const [updateAutomation] = useUpdateAutomationMutation();
    const [deleteAutomation] = useDeleteAutomationMutation();

    const [builder, setBuilder] = useState<BuilderSession | null>(null);

    /**
     * Bumped on every open, and used as the builder's `key`.
     *
     * That is what re-seeds the form: a new key remounts it, so its lazy
     * useState initialisers run again against the new session. The alternative
     * — an effect that copies props into state — is the set-state-in-effect
     * rule, and the same reason the board keys its amendments panel per record.
     */
    const [sessionCount, setSessionCount] = useState(0);

    const automations = scope === "workspace" ? workspaceAutomations : moduleAutomations;
    const isLoading = scope === "workspace" ? loadingWorkspace : loadingModule;

    const vocab: Vocabulary = {
        scope,
        moduleId,
        columns,
        subColumns,
        collections,
        modules
    };

    const lexicon = buildLexicon({ columns, subColumns, collections, modules });

    /** Both lists are invalidated on a write — see listTags in the API slice. */
    const listScope = { moduleId, workspaceId };

    const openBuilder = (session: BuilderSession) => {
        setSessionCount((n) => n + 1);
        setBuilder(session);
    };

    const openNew = () => openBuilder({ scope, editing: null });

    const openEdit = (automation: Automation) =>
        openBuilder({
            scope: automation.scope ?? "module",
            editing: automation
        });

    const toggle = (automation: Automation) =>
        updateAutomation({
            automationId: automation._id,
            ...listScope,
            body: { isActive: !automation.isActive } as never
        });

    const remove = (automation: Automation) => {
        if (!confirm(`Delete "${automation.name}"? This can't be undone.`)) return;
        deleteAutomation({ automationId: automation._id, ...listScope });
    };

    return (
        <section className="flex bg-canvas">

            {/* Shell card — the frame every page sits in (LAYOUT.md §7) */}
            <div className="min-h-screen w-full flex flex-col bg-panel overflow-hidden shadow-sm">

                {/* Top navbar */}
                <header className="sticky top-0 z-20 bg-panel border-b border-slate-200">
                    <div className="w-full mx-auto px-6 h-16 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* This page renders no sidebar, so the header is the
                                only way out of it. Falls back to the workspace
                                the automations belong to. */}
                            <BackButton
                                fallbackHref={workspaceId ? `/workspace/${workspaceId}` : "/Home"}
                            />

                            {/* NO INITIAL, NO HASHED COLOUR. "S" in a random
                                square says nothing the word "Sales" beside it
                                does not already say, and the hue was picked by
                                hashing an id, so it carried no meaning at all —
                                it was just a loud sticker in the corner of the
                                navbar. This is the workspace's OWN icon in the
                                shared tile (LAYOUT.md §7), the same one the
                                sidebar and the banner draw. */}
                            <NavTile className="h-10 w-10 rounded-xl text-slate-600">
                                <WorkspaceIcon iconKey={workspace?.icon} className="h-5 w-5" />
                            </NavTile>

                            <div className="min-w-0">
                                <h1 className="text-sm font-semibold text-slate-900 truncate font-dmsans">
                                    {workspace?.name || "Workspace"}
                                </h1>
                                <p className="text-[11px] text-muted truncate font-dmsans">
                                    Automations
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            {/* What the engine has done lately lives in the
                                activity log — an automated change is an activity
                                row, so this is a link rather than a panel here. */}
                            {workspaceId && (
                                <Link
                                    href={`/workspace/${workspaceId}/activity?source=automation`}
                                    className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-control hover:text-slate-900 sm:flex font-dmsans"
                                >
                                    <HiOutlineClock className="h-3.5 w-3.5" />
                                    Recent runs
                                </Link>
                            )}

                            <ProfileDropdown />
                        </div>
                    </div>
                </header>

                {/*
                    Content — FULL WIDTH, like every other page in the app.

                    This was briefly centred at max-w-4xl and it was wrong twice
                    over: it stranded the page in a narrow column on a wide
                    screen, and it squeezed the header row enough that the
                    controls wrapped under the heading instead of sitting
                    opposite it. A list of full-width cards has no reason to be
                    column-constrained.
                */}
                <div className="w-full flex-1 px-6 py-6">

                    {modules.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-10 text-center text-sm text-muted font-dmsans">
                            Automations run on a module&apos;s columns and records, so create a
                            module first.
                        </p>
                    ) : (
                        <>
                            {/*
                                Heading, then what it means, then the two
                                controls that narrow the list — a column, read
                                top to bottom. "New Automation" is the only
                                thing on the right because it is the only
                                control that does not describe the list below
                                it; the other two do, so they belong with the
                                text that introduces it.
                            */}
                            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-semibold text-slate-900 font-dmsans">
                                        Automations
                                    </h2>
                                    <p className="mt-0.5 text-xs text-muted font-dmsans">
                                        {scope === "workspace"
                                            ? "Rules that run on their own across every module in this workspace."
                                            : "Rules that run on their own when something happens on this module."}
                                    </p>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {/* h-10 matches ModulePicker beside it. */}
                                        <div className="inline-flex h-10 items-center gap-1 rounded-xl border border-hairline bg-card p-1">
                                            {SCOPES.map(({ value, label, icon: Icon }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setScope(value)}
                                                    className={`flex h-full items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition cursor-pointer font-dmsans ${scope === value
                                                        ? "nav-glass text-slate-900"
                                                        : "text-muted hover:bg-control hover:text-slate-900"
                                                        }`}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {label}
                                                </button>
                                            ))}
                                        </div>

                                        <ModulePicker
                                            modules={modules}
                                            value={moduleId}
                                            onChange={setPickedModuleId}
                                            label={scope === "workspace" ? "Suggest names from" : "Module"}
                                        />
                                    </div>
                                </div>

                                {/* The page's one primary action, but NOT a
                                    saturated fill: a list of quiet cards under a
                                    coral block made the button the loudest thing
                                    on a screen you visit to read. Weight and the
                                    glass panel carry it instead — same treatment
                                    the sidebar uses for the row you are on. */}
                                <button
                                    onClick={openNew}
                                    className="nav-glass flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 transition cursor-pointer font-dmsans"
                                >
                                    <HiOutlinePlus className="h-4 w-4" />
                                    New Automation
                                </button>
                            </div>

                            {isLoading ? (
                                <div className="space-y-3">
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="h-24 rounded-xl bg-control animate-pulse"
                                            style={{ animationDelay: `${i * 90}ms` }}
                                        />
                                    ))}
                                </div>
                            ) : automations.length === 0 ? (
                                /**
                                 * One quiet line, not an illustrated empty state.
                                 * The toolbar above already carries the only
                                 * thing to do here, so a hero panel repeating it
                                 * is a second button pretending to be guidance.
                                 */
                                <p className="py-16 text-center text-sm text-muted font-dmsans">
                                    {scope === "workspace"
                                        ? "No workspace-wide automations yet."
                                        : "No automations on this module yet."}
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {automations.map((automation) => (
                                        <AutomationCard
                                            key={automation._id}
                                            automation={automation}
                                            lexicon={lexicon}
                                            onToggle={() => toggle(automation)}
                                            onEdit={() => openEdit(automation)}
                                            onDelete={() => remove(automation)}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right rail — this page always runs Relay */}
            <AiSidebar agent="relay" context={workspace?.name || "this workspace"} />

            {builder && (
                <AutomationBuilder
                    key={sessionCount}
                    onClose={() => setBuilder(null)}
                    scope={builder.scope}
                    moduleId={moduleId}
                    workspaceId={workspaceId}
                    vocab={{ ...vocab, scope: builder.scope }}
                    lexicon={lexicon}
                    editing={builder.editing}
                />
            )}
        </section>
    );
}
