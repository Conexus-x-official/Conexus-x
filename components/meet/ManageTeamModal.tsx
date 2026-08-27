"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineXMark, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { TbUsersGroup, TbLogout } from "react-icons/tb";
import PresenceDot from "@/components/ui/helpers/presenceDot";
import { toast } from "@/components/ui/toast";
import { canAdministerTeam } from "@/lib/meetRoles";
import {
    useAddConversationMembersMutation,
    useGetContactsQuery,
    useRemoveConversationMemberMutation,
    useUpdateConversationMutation,
    type Conversation
} from "@/store/api/meet.api";
import { displayName } from "./ConversationList";

import userAsset from "@/app/assets/user.png";

/**
 * Who is in a team, and what it is called.
 *
 * The controls here are only OFFERED from the client's view of the rules — the
 * server re-decides every one of them and its message is shown verbatim on a
 * refusal, the same contract BoardAccessMenu and the members pages follow.
 */
export default function ManageTeamModal({
    conversation,
    meId,
    onClose,
    onLeft
}: {
    conversation: Conversation;
    meId: string;
    onClose: () => void;
    onLeft: () => void;
}) {
    /**
     * The workspace comes off the CONVERSATION, not from a prop. Meet spans
     * workspaces now, so the page has no single "current" one to hand down —
     * and the team already knows where it lives.
     */
    const workspaceId = conversation.workspace?._id ?? "";

    // The same cross-workspace contact list the new-chat modal reads, filtered
    // to this team's workspace. One endpoint, so who is invitable cannot differ
    // between the two screens.
    const { data: contactGroups = [] } = useGetContactsQuery();

    const workspaceMembers =
        contactGroups.find((g) => g._id === workspaceId)?.people ?? [];

    const [updateConversation, { isLoading: saving }] = useUpdateConversationMutation();
    const [addMembers, { isLoading: adding }] = useAddConversationMembersMutation();
    const [removeMember] = useRemoveConversationMemberMutation();

    const [name, setName] = useState(conversation.name);
    const [picking, setPicking] = useState(false);

    /**
     * Two ways to qualify: an admin OF THIS TEAM, or an owner/admin of the
     * workspace it lives in. Workspace managers already run boards, members and
     * roles — a team they can see but cannot moderate would be the one object
     * that escapes them. Mirrors meetAccess.service; the server re-checks.
     */
    const amTeamAdmin = conversation.members.some(
        (m) => m.user._id === meId && m.isAdmin
    );

    const amAdmin = canAdministerTeam(conversation.myRole, amTeamAdmin);

    const inTeam = new Set(conversation.members.map((m) => m.user._id));

    // Only people who are in the workspace AND not already in the team — the
    // server enforces both, so offering either would be a dead click.
    const addable = workspaceMembers.filter((p) => p?._id && !inTeam.has(p._id));

    const renamed = name.trim() && name.trim() !== conversation.name;

    const save = async () => {
        if (!renamed) return;

        try {
            await updateConversation({
                conversationId: conversation._id,
                name: name.trim()
            }).unwrap();
            toast.success("Team renamed");
        } catch (error) {
            toast.error(
                "Could not rename the team",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const add = async (userId: string) => {
        try {
            await addMembers({
                conversationId: conversation._id,
                memberIds: [userId]
            }).unwrap();
        } catch (error) {
            toast.error(
                "Could not add that person",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const remove = async (userId: string) => {
        const leaving = userId === meId;

        try {
            await removeMember({
                conversationId: conversation._id,
                userId
            }).unwrap();

            if (leaving) {
                toast.success("You left the team");
                onLeft();
            }
        } catch (error) {
            toast.error(
                leaving ? "Could not leave the team" : "Could not remove that person",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={onClose}
        >
            <div
                className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-hairline bg-card shadow-2xl font-dmsans"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 p-6 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <TbUsersGroup className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold leading-snug text-slate-900">
                                Team settings
                            </h2>
                            <p className="mt-0.5 text-xs font-medium text-muted">
                                {conversation.members.length} member
                                {conversation.members.length === 1 ? "" : "s"}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                    >
                        <HiOutlineXMark className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 pb-4">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Team name
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!amAdmin}
                            className="w-full rounded-xl border border-hairline bg-control/40 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-muted focus:border-accent focus:bg-card disabled:opacity-60"
                        />
                        {/* Disabled until the name actually changes — no no-op writes. */}
                        <button
                            onClick={save}
                            disabled={!amAdmin || !renamed || saving}
                            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                    {!amAdmin && (
                        <p className="mt-1.5 text-[11px] text-muted">
                            Only a team admin, or an owner or admin of{" "}
                            {conversation.workspace?.name || "this workspace"}, can
                            rename this team.
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 px-6 pb-2">
                    <h3 className="text-xs font-semibold text-slate-700">Members</h3>

                    {amAdmin && addable.length > 0 && (
                        <button
                            onClick={() => setPicking((p) => !p)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent transition hover:bg-accent/10 cursor-pointer"
                        >
                            <HiOutlinePlus className="h-3.5 w-3.5" />
                            Add people
                        </button>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">

                    {picking && (
                        <div className="mb-2 rounded-xl border border-dashed border-hairline p-2">
                            <p className="px-2 pb-1.5 text-[11px] font-semibold text-muted">
                                In this workspace
                            </p>
                            {addable.map((person) => (
                                <button
                                    key={person._id}
                                    onClick={() => add(person._id)}
                                    disabled={adding}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-control/60 disabled:opacity-50 cursor-pointer"
                                >
                                    <img
                                        src={person.avatar || userAsset.src}
                                        alt={person.firstName}
                                        className="h-7 w-7 rounded-full object-cover"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
                                        {person.firstName} {person.lastName}
                                    </span>
                                    <HiOutlinePlus className="h-3.5 w-3.5 shrink-0 text-accent" />
                                </button>
                            ))}
                        </div>
                    )}

                    {conversation.members.map((member) => {
                        const isMe = member.user._id === meId;

                        return (
                            <div
                                key={member.user._id}
                                className="group flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-control/60"
                            >
                                <span className="relative shrink-0">
                                    <img
                                        src={member.user.avatar || userAsset.src}
                                        alt={displayName(member.user)}
                                        className="h-9 w-9 rounded-full object-cover"
                                    />
                                    <span className="absolute -bottom-0.5 -right-0.5">
                                        <PresenceDot
                                            status={member.user.presence}
                                            size={11}
                                            ringColor="var(--card)"
                                        />
                                    </span>
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                        <span className="truncate text-sm font-medium text-slate-800">
                                            {displayName(member.user)}
                                            {isMe && " (you)"}
                                        </span>
                                        {member.isAdmin && (
                                            <span className="shrink-0 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                                                Admin
                                            </span>
                                        )}
                                    </span>
                                    <span className="block truncate text-[11px] text-muted">
                                        {member.user.email}
                                    </span>
                                </span>

                                {/* You may ALWAYS remove yourself — that is
                                    leaving, and it needs no permission. */}
                                {(isMe || amAdmin) && (
                                    <button
                                        onClick={() => remove(member.user._id)}
                                        title={isMe ? "Leave the team" : "Remove from team"}
                                        aria-label={isMe ? "Leave the team" : "Remove from team"}
                                        className="shrink-0 rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 cursor-pointer"
                                    >
                                        {isMe ? (
                                            <TbLogout className="h-4 w-4" />
                                        ) : (
                                            <HiOutlineTrash className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body
    );
}
