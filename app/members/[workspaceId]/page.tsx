"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRealtimeRoom } from "@/store/useRealtimeRoom";
import {
    ArrowLeft,
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Lock,
    Globe,
    LayoutGrid,
    Loader2,
} from "lucide-react";

import { PALETTE } from "@/data/data";
import { getUser } from "@/lib/auth";
import {
    MemberRole,
    ROLE_OPTIONS,
    canAssignRole,
    canManageRoles,
    isLastOwner,
    roleColor,
    roleLabel,
} from "@/lib/roles";
import { useGetWorkspaceQuery } from "@/store/api/workspaces.api";
import {
    useGetMembersQuery,
    useAddMemberMutation,
    useUpdateMemberRoleMutation,
} from "@/store/api/members.api";
import { useGetModulesQuery, useUpdateModuleMutation } from "@/store/api/modules.api";
import { PersonAvatar, memberName, memberUserId } from "@/components/ui/helpers/personCell";
import BoardAccessMenu from "@/components/BoardAccessMenu";
import MemberInvite, { type InviteIdentifier } from "@/components/ui/modals/memberInvite";
import { toast } from "@/components/ui/toast";
import type { Member } from "@/store/types";

/** Long rosters get pages rather than one endless table. */
const PAGE_SIZE = 10;

function colorFor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
}

const STATUS_STYLES: Record<string, string> = {
    active: "border-emerald-100 bg-emerald-50 text-emerald-600",
    pending: "border-blue-100 bg-blue-50 text-blue-600",
    inactive: "border-slate-200 bg-slate-50 text-slate-500",
};

const messageFrom = (error: unknown, fallback: string): string => {
    const data = (error as { data?: { message?: string } })?.data;
    return data?.message || fallback;
};

const formatDate = (value?: string) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
        })
        : "-";

export default function WorkspaceMembersPage() {
    const params = useParams();
    const workspaceId = String(params.workspaceId ?? "");

    useRealtimeRoom({ workspaceId });

    const currentUserId = getUser()?.id ?? "";

    const { data: workspace } = useGetWorkspaceQuery(workspaceId, {
        skip: !workspaceId,
    });

    const { data: members = [], isLoading: membersLoading } = useGetMembersQuery(
        workspaceId,
        { skip: !workspaceId }
    );

    const { data: modules = [], isLoading: modulesLoading } = useGetModulesQuery(
        workspaceId,
        { skip: !workspaceId }
    );

    const [updateMemberRole] = useUpdateMemberRoleMutation();
    const [updateModule] = useUpdateModuleMutation();
    const [addMember, { isLoading: adding }] = useAddMemberMutation();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [savingUserId, setSavingUserId] = useState<string | null>(null);
    const [savingModuleId, setSavingModuleId] = useState<string | null>(null);
    const [showInvite, setShowInvite] = useState(false);
    // Holds an email or a user id depending on the invite modal's tab.
    const [inviteIdentifier, setInviteIdentifier] = useState("");
    const [inviteRole, setInviteRole] = useState("member");

    const myRole = members.find(
        (member) => memberUserId(member) === currentUserId
    )?.role as MemberRole | undefined;

    const manages = canManageRoles(myRole);

    const ownerCount = members.filter(
        (member) => member.role === "owner" && member.status === "active"
    ).length;

    const query = search.trim().toLowerCase();

    const filtered = members
        .filter(
            (member) =>
                !query ||
                memberName(member).toLowerCase().includes(query) ||
                (member.user?.email ?? "").toLowerCase().includes(query)
        )
        .sort((a, b) => {
            const rank = (role: MemberRole) =>
                ROLE_OPTIONS.findIndex((option) => option.value === role);
            const byRole = rank(a.role) - rank(b.role);
            return byRole !== 0 ? byRole : memberName(a).localeCompare(memberName(b));
        });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filtered.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    /** Why this row's role dropdown is locked, or null when it is editable. */
    const lockReason = (member: Member): string | null => {
        if (!manages) return "Only an owner or admin can change roles";

        if (member.role === "owner" && myRole !== "owner") {
            return "Only an owner can change an owner's role";
        }

        if (isLastOwner(member.role, ownerCount)) {
            return "This is the last owner — promote someone else first";
        }

        return null;
    };

    const changeRole = async (member: Member, nextRole: MemberRole) => {
        const userId = memberUserId(member);
        setSavingUserId(userId);

        try {
            await updateMemberRole({
                workspaceId,
                memberUserId: userId,
                role: nextRole,
            }).unwrap();

            toast.success(
                `${memberName(member)} is now ${roleLabel(nextRole).toLowerCase()}`,
                workspace?.name
            );
        } catch (error) {
            toast.error(messageFrom(error, "Could not update the role."));
        } finally {
            setSavingUserId(null);
        }
    };

    const changeVisibility = async (
        moduleId: string,
        moduleName: string,
        visibility: "private" | "workspace" | "public"
    ) => {
        setSavingModuleId(moduleId);

        try {
            await updateModule({ moduleId, workspaceId, visibility }).unwrap();

            toast.success(
                visibility === "private"
                    ? `${moduleName} is now private`
                    : `${moduleName} is now open to the workspace`,
                visibility === "private"
                    ? "Only the people you pick can open it"
                    : "Every member can open it"
            );
        } catch (error) {
            toast.error(
                messageFrom(error, "Could not change who can see that module.")
            );
        } finally {
            setSavingModuleId(null);
        }
    };

    const handleInvite = async (identifier: InviteIdentifier) => {
        try {
            const member = await addMember({
                workspaceId,
                role: inviteRole,
                ...identifier,
            }).unwrap();

            toast.success(
                `${memberName(member) || "That person"} is now ${roleLabel(inviteRole).toLowerCase()}`,
                workspace?.name
            );

            setInviteIdentifier("");
            setInviteRole("member");
            setShowInvite(false);
        } catch (error) {
            toast.error(messageFrom(error, "Could not add that member."));
        }
    };

    const accent = colorFor(workspaceId).accent;

    return (
        <section className="min-h-screen bg-canvas font-dmsans">
            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">

                <Link
                    href="/members"
                    className="mb-6 -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-control/60 hover:text-slate-900 cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4" />
                    All workspaces
                </Link>

                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                            style={{ backgroundColor: accent }}
                        >
                            {(workspace?.name ?? "W").charAt(0).toUpperCase()}
                        </span>

                        <div className="min-w-0">
                            <h1 className="truncate text-xl font-semibold text-slate-900">
                                {workspace?.name ?? "Workspace"}
                            </h1>

                            <p className="mt-0.5 text-xs text-muted">
                                {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
                                {modules.length} module{modules.length === 1 ? "" : "s"}
                                {myRole ? ` · you are ${roleLabel(myRole).toLowerCase()}` : ""}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowInvite(true)}
                        disabled={!manages}
                        title={manages ? undefined : "Only an owner or admin can invite people"}
                        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-slate-400 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        Invite member
                    </button>
                </div>

                {/* ---------------------------------------------------------- People */}
                <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
                        <h2 className="text-sm font-bold text-slate-900">People</h2>

                        {members.length > 5 && (
                            <div className="relative w-56">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search people"
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-card pl-9 pr-3 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none placeholder:text-slate-400"
                                />
                            </div>
                        )}
                    </div>

                    {membersLoading ? (
                        <div className="space-y-2 p-5">
                            {[0, 1, 2].map((index) => (
                                <div
                                    key={index}
                                    className="h-12 rounded-xl bg-control animate-pulse"
                                    style={{ animationDelay: `${index * 90}ms` }}
                                />
                            ))}
                        </div>
                    ) : pageRows.length === 0 ? (
                        <p className="py-16 text-center text-sm text-muted">
                            {members.length === 0
                                ? "Nobody here yet — invite someone to get started."
                                : "No one matches that search."}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200/40 text-left text-sm font-bold text-muted">
                                        <th className="px-5 py-3">Member</th>
                                        <th className="px-5 py-3">Role</th>
                                        <th className="px-5 py-3">Module access</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">Joined</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200/30">
                                    {pageRows.map((member) => {
                                        const userId = memberUserId(member);
                                        const locked = lockReason(member);
                                        const saving = savingUserId === userId;
                                        const isMe = userId === currentUserId;

                                        return (
                                            <tr
                                                key={member._id}
                                                className="text-slate-800 transition hover:bg-gray-200/40"
                                            >
                                                <td className="px-5 py-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <PersonAvatar
                                                            member={member}
                                                            size={30}
                                                            ring={false}
                                                            showPresence
                                                        />

                                                        <div className="min-w-0">
                                                            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                                                                {memberName(member)}
                                                                {isMe && (
                                                                    <span className="rounded bg-control px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                                                        You
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="truncate text-xs text-muted">
                                                                {member.user?.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-2">
                                                    <div
                                                        className="flex items-center gap-2"
                                                        title={locked ?? undefined}
                                                    >
                                                        <span
                                                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                            style={{ backgroundColor: roleColor(member.role) }}
                                                        />

                                                        <select
                                                            value={member.role}
                                                            disabled={Boolean(locked) || saving}
                                                            onChange={(event) =>
                                                                changeRole(
                                                                    member,
                                                                    event.target.value as MemberRole
                                                                )
                                                            }
                                                            className="h-9 rounded-lg border border-slate-200 bg-card px-2 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                                        >
                                                            {ROLE_OPTIONS.map((option) => (
                                                                <option
                                                                    key={option.value}
                                                                    value={option.value}
                                                                    disabled={
                                                                        option.value !== member.role &&
                                                                        !canAssignRole(
                                                                            myRole,
                                                                            member.role,
                                                                            option.value
                                                                        )
                                                                    }
                                                                >
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {saving && (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-2">
                                                    <BoardAccessMenu
                                                        workspaceId={workspaceId}
                                                        userId={userId}
                                                        disabled={!manages}
                                                        disabledReason="Only an owner or admin can change module access"
                                                        onError={toast.error}
                                                    />
                                                </td>

                                                <td className="px-5 py-2">
                                                    <span
                                                        className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[member.status] ?? STATUS_STYLES.inactive
                                                            }`}
                                                    >
                                                        {member.status}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-2 text-sm font-medium text-slate-700">
                                                    {formatDate(member.joinedAt)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                            <p className="text-sm text-gray-500">
                                {(currentPage - 1) * PAGE_SIZE + 1}–
                                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                                {filtered.length}
                            </p>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage(currentPage - 1)}
                                    disabled={currentPage <= 1}
                                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-control text-slate-800 transition hover:bg-gray-300 disabled:opacity-40 cursor-pointer"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>

                                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-sm font-bold text-white">
                                    {currentPage}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setPage(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-control text-slate-800 transition hover:bg-gray-300 disabled:opacity-40 cursor-pointer"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ---------------------------------------------------------- Boards */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-card">
                    <div className="border-b border-slate-200 px-5 py-3">
                        <h2 className="text-sm font-bold text-slate-900">Modules</h2>
                        <p className="mt-0.5 text-xs text-muted">
                            A module shared with the workspace is open to every member. Make
                            it private and only the people ticked under Module access can open
                            it — owners and admins always can.
                        </p>
                    </div>

                    {modulesLoading ? (
                        <div className="space-y-2 p-5">
                            {[0, 1].map((index) => (
                                <div
                                    key={index}
                                    className="h-12 rounded-xl bg-control animate-pulse"
                                    style={{ animationDelay: `${index * 90}ms` }}
                                />
                            ))}
                        </div>
                    ) : modules.length === 0 ? (
                        <p className="py-16 text-center text-sm text-muted">
                            This workspace has no modules yet.
                        </p>
                    ) : (
                        <div className="divide-y divide-gray-200/30">
                            {modules.map((moduleItem) => {
                                const visibility = moduleItem.visibility ?? "workspace";
                                const isPrivate = visibility === "private";
                                const saving = savingModuleId === moduleItem._id;

                                return (
                                    <div
                                        key={moduleItem._id}
                                        className="flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-gray-200/40"
                                    >
                                        <span
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-control text-slate-600"
                                            aria-hidden
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-slate-900">
                                                {moduleItem.name}
                                            </p>

                                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                                                {isPrivate ? (
                                                    <>
                                                        <Lock className="h-3 w-3" />
                                                        Only the people you pick
                                                    </>
                                                ) : (
                                                    <>
                                                        <Globe className="h-3 w-3" />
                                                        Everyone in the workspace
                                                    </>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                value={visibility}
                                                disabled={!manages || saving}
                                                onChange={(event) =>
                                                    changeVisibility(
                                                        moduleItem._id,
                                                        moduleItem.name,
                                                        event.target.value as
                                                        | "private"
                                                        | "workspace"
                                                        | "public"
                                                    )
                                                }
                                                title={
                                                    manages
                                                        ? "Who can open this module"
                                                        : "Only an owner or admin can change this"
                                                }
                                                className="h-9 rounded-lg border border-slate-200 bg-card px-2 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                            >
                                                <option value="workspace">
                                                    Shared with workspace
                                                </option>
                                                <option value="private">Private</option>

                                                {/* Only offered when already set — it behaves
                                                    exactly like "workspace" under today's rules. */}
                                                {visibility === "public" && (
                                                    <option value="public">Public</option>
                                                )}
                                            </select>

                                            {saving && (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <MemberInvite
                open={showInvite}
                setOpen={setShowInvite}
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
