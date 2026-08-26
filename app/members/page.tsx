"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Users,
    Search,
    Plus,
    ChevronRight,
} from "lucide-react";

import { PALETTE } from "@/data/data";
import { getUser } from "@/lib/auth";
import { MemberRole, canManageRoles, roleColor, roleLabel } from "@/lib/roles";
import { useGetWorkspacesQuery } from "@/store/api/workspaces.api";
import { useAddMemberMutation } from "@/store/api/members.api";
import { useAllMembers, memberUserId, type MembershipRow } from "@/store/useAllMembers";
import { PersonAvatar, memberName } from "@/components/ui/helpers/personCell";
import MemberInvite, { type InviteIdentifier } from "@/components/ui/modals/memberInvite";
import { toast } from "@/components/ui/toast";

function colorFor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
}

const messageFrom = (error: unknown): string => {
    const data = (error as { data?: { message?: string } })?.data;
    return data?.message || "Could not add that member. Please try again.";
};

/**
 * The index: one row per workspace, showing who runs it and how big it is.
 *
 * The full roster lives at /members/[workspaceId] — with a person in several
 * workspaces, one flat table repeated them once per workspace and got unreadable
 * fast. Here you pick the workspace, then work inside it.
 */
export default function MembersPage() {
    const router = useRouter();
    const currentUserId = getUser()?.id ?? "";

    const { data: workspaces = [], isLoading: workspacesLoading } =
        useGetWorkspacesQuery();

    const { memberships, isLoading: membersLoading } = useAllMembers(
        workspaces.map((workspace) => workspace._id)
    );

    const [addMember, { isLoading: adding }] = useAddMemberMutation();

    const [search, setSearch] = useState("");
    const [inviteFor, setInviteFor] = useState<string | null>(null);
    // Holds an email or a user id depending on the invite modal's tab.
    const [inviteIdentifier, setInviteIdentifier] = useState("");
    const [inviteRole, setInviteRole] = useState("member");

    const query = search.trim().toLowerCase();

    const rowsFor = (workspaceId: string) =>
        memberships.filter((row) => row.workspaceId === workspaceId);

    const ownerOf = (workspaceId: string): MembershipRow | undefined =>
        rowsFor(workspaceId).find((row) => row.member.role === "owner");

    const myRoleIn = (workspaceId: string): MemberRole | undefined =>
        rowsFor(workspaceId).find(
            (row) => memberUserId(row.member) === currentUserId
        )?.member.role;

    const visible = workspaces.filter(
        (workspace) => !query || workspace.name.toLowerCase().includes(query)
    );

    const handleInvite = async (identifier: InviteIdentifier) => {
        if (!inviteFor) return;

        const workspaceName =
            workspaces.find((workspace) => workspace._id === inviteFor)?.name ??
            "the workspace";

        try {
            const member = await addMember({
                workspaceId: inviteFor,
                role: inviteRole,
                ...identifier,
            }).unwrap();

            toast.success(
                `${memberName(member) || "That person"} is now ${roleLabel(inviteRole).toLowerCase()}`,
                workspaceName
            );

            setInviteIdentifier("");
            setInviteRole("member");
            setInviteFor(null);
        } catch (inviteError) {
            toast.error(messageFrom(inviteError), workspaceName);
        }
    };

    const loading = workspacesLoading || membersLoading;

    return (
        <section className="min-h-screen bg-canvas font-dmsans">
            <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">

                <Link
                    href="/Home"
                    className="mb-6 -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-control/60 hover:text-slate-900 cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to home
                </Link>

                <div className="mb-6 flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <Users className="h-5 w-5" />
                    </span>

                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-slate-900">Members</h1>
                        <p className="mt-0.5 text-xs text-muted">
                            Pick a workspace to manage its people, their roles and which
                            modules each of them can open.
                        </p>
                    </div>
                </div>

                {workspaces.length > 3 && (
                    <div className="relative mb-4">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search workspaces"
                            className="h-11 w-full rounded-lg border border-slate-200 bg-card pl-9 pr-3 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none placeholder:text-slate-400"
                        />
                    </div>
                )}

                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((index) => (
                            <div
                                key={index}
                                className="h-20 rounded-xl bg-control animate-pulse"
                                style={{ animationDelay: `${index * 90}ms` }}
                            />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    /* Empty state (LAYOUT.md §7) */
                    <div className="rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-20 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <Users className="h-6 w-6" />
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900">
                            {workspaces.length === 0
                                ? "No workspaces yet"
                                : "No workspace matches that search"}
                        </h3>

                        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                            {workspaces.length === 0
                                ? "Create a workspace first — people are invited into a workspace, and their module access is set inside it."
                                : "Try a different name."}
                        </p>

                        {workspaces.length === 0 && (
                            <Link
                                href="/Home"
                                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover cursor-pointer"
                            >
                                Go to workspaces
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {visible.map((workspace) => {
                            const rows = rowsFor(workspace._id);
                            const owner = ownerOf(workspace._id);
                            const myRole = myRoleIn(workspace._id);
                            const accent = colorFor(workspace._id).accent;
                            const canInvite = canManageRoles(myRole);

                            return (
                                <div
                                    key={workspace._id}
                                    onClick={() => router.push(`/members/${workspace._id}`)}
                                    className="group flex cursor-pointer items-center gap-4 rounded-xl border border-slate-200 bg-card px-5 py-4 transition hover:bg-gray-200/40"
                                >
                                    <span
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                                        style={{ backgroundColor: accent }}
                                    >
                                        {workspace.name.charAt(0).toUpperCase()}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900">
                                            {workspace.name}
                                        </p>

                                        <p className="mt-0.5 truncate text-xs text-muted">
                                            {rows.length} member{rows.length === 1 ? "" : "s"}
                                            {typeof workspace.totalModules === "number"
                                                ? ` · ${workspace.totalModules} module${workspace.totalModules === 1 ? "" : "s"}`
                                                : ""}
                                            {myRole ? ` · you are ${roleLabel(myRole).toLowerCase()}` : ""}
                                        </p>
                                    </div>

                                    {/* Who runs this workspace. */}
                                    {owner && (
                                        <div className="hidden min-w-0 items-center gap-2 sm:flex">
                                            <PersonAvatar
                                                member={owner.member}
                                                size={28}
                                                ring={false}
                                                showPresence
                                            />

                                            <span className="min-w-0">
                                                <span className="block truncate text-xs font-medium text-slate-800">
                                                    {memberName(owner.member)}
                                                </span>
                                                <span
                                                    className="block text-[10px] font-semibold"
                                                    style={{ color: roleColor("owner") }}
                                                >
                                                    Owner
                                                </span>
                                            </span>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            // The card navigates; the button must not.
                                            event.stopPropagation();
                                            setInviteFor(workspace._id);
                                        }}
                                        disabled={!canInvite}
                                        title={
                                            canInvite
                                                ? `Invite someone to ${workspace.name}`
                                                : "Only an owner or admin can invite people"
                                        }
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-600 transition hover:bg-slate-100 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                                    </button>

                                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <MemberInvite
                open={Boolean(inviteFor)}
                setOpen={(open) => setInviteFor(open ? inviteFor : null)}
                identifier={inviteIdentifier}
                setIdentifier={setInviteIdentifier}
                role={inviteRole}
                setRole={setInviteRole}
                adding={adding}
                inviteMember={handleInvite}
            />
        </section>
    );
}
