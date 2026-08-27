"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineXMark, HiOutlineMagnifyingGlass, HiCheck } from "react-icons/hi2";
import { TbUsersGroup, TbUser, TbLock } from "react-icons/tb";
import PresenceDot from "@/components/ui/helpers/presenceDot";
import { WorkspaceIcon } from "@/lib/workspaceIcons";
import { toast } from "@/components/ui/toast";
import { shortRole } from "@/lib/meetRoles";
import {
    useCreateGroupMutation,
    useGetContactsQuery,
    useOpenDirectMutation,
    type Conversation
} from "@/store/api/meet.api";

import userAsset from "@/app/assets/user.png";

/**
 * Start a conversation — with one person, or as a team.
 *
 * ONE MODAL, two modes, because the choice is genuinely the same act with a
 * different arity: pick people, then talk to them. Two separate entry points
 * would mean deciding "is this a chat or a team?" before knowing who is in it.
 *
 * PEOPLE COME FROM /conversations/contacts, grouped by workspace and ALREADY
 * FILTERED by the server's rules — so a guest simply never sees the colleagues
 * they are not allowed to message, rather than seeing them and being refused.
 * The client does not re-derive that; it renders what it is given, and the
 * server re-checks on the write anyway.
 *
 * A TEAM BELONGS TO ONE WORKSPACE. Its members are workspace members and its
 * admins are workspace-scoped, so picking across two would produce a team the
 * server would have to reject half of. The picker therefore locks to the
 * workspace of the first person chosen, and says so.
 */

type Mode = "direct" | "group";

export default function NewChatModal({
    initialMode = "direct",
    onClose,
    onOpened
}: {
    // No `meId`: /conversations/contacts already excludes the caller, so there
    // is nothing here that needs to know who you are.
    initialMode?: Mode;
    onClose: () => void;
    onOpened: (conversation: Conversation) => void;
}) {
    const { data: groups = [], isLoading } = useGetContactsQuery();

    const [openDirect, { isLoading: opening }] = useOpenDirectMutation();
    const [createGroup, { isLoading: creating }] = useCreateGroupMutation();

    const [mode, setMode] = useState<Mode>(initialMode);
    const [query, setQuery] = useState("");
    /** Selections are (workspaceId, userId) pairs — a person can be in several. */
    const [picked, setPicked] = useState<{ workspaceId: string; userId: string }[]>([]);
    const [teamName, setTeamName] = useState("");

    const term = query.trim().toLowerCase();

    const visible = groups
        .map((group) => ({
            ...group,
            people: group.people.filter((p) => {
                if (!term) return true;
                const name = `${p.firstName} ${p.lastName ?? ""} ${p.email ?? ""}`;
                return (
                    name.toLowerCase().includes(term) ||
                    group.name.toLowerCase().includes(term)
                );
            })
        }))
        .filter((group) => group.people.length > 0);

    /** The workspace a team is being built in, decided by the first pick. */
    const lockedWorkspace = mode === "group" ? picked[0]?.workspaceId ?? "" : "";

    const isPicked = (workspaceId: string, userId: string) =>
        picked.some((p) => p.workspaceId === workspaceId && p.userId === userId);

    const toggle = (workspaceId: string, userId: string) => {
        if (mode === "direct") {
            setPicked([{ workspaceId, userId }]);
            return;
        }

        setPicked((current) =>
            current.some((p) => p.workspaceId === workspaceId && p.userId === userId)
                ? current.filter(
                    (p) => !(p.workspaceId === workspaceId && p.userId === userId)
                )
                : [...current, { workspaceId, userId }]
        );
    };

    const busy = opening || creating;

    const canSubmit =
        mode === "direct"
            ? picked.length === 1
            : Boolean(teamName.trim()) && picked.length > 0;

    const submit = async () => {
        if (!canSubmit || busy) return;

        try {
            const conversation =
                mode === "direct"
                    ? await openDirect({
                        workspaceId: picked[0].workspaceId,
                        userId: picked[0].userId
                    }).unwrap()
                    : await createGroup({
                        workspaceId: lockedWorkspace,
                        name: teamName.trim(),
                        memberIds: picked.map((p) => p.userId)
                    }).unwrap();

            onOpened(conversation);
            onClose();
        } catch (error) {
            // The server's own message, verbatim — it knows why it refused, and
            // for a guest that reason is a rule worth reading.
            toast.error(
                mode === "direct" ? "Could not open that chat" : "Could not create the team",
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
                            {mode === "group" ? (
                                <TbUsersGroup className="h-5 w-5" />
                            ) : (
                                <TbUser className="h-5 w-5" />
                            )}
                        </span>
                        <div>
                            <h2 className="text-lg font-bold leading-snug text-slate-900">
                                {mode === "group" ? "Create a team" : "Start a chat"}
                            </h2>
                            <p className="mt-0.5 text-xs font-medium text-muted">
                                {mode === "group"
                                    ? "A shared thread for several people in one workspace."
                                    : "A private thread with one person."}
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

                {/* Mode switch. Changing it CLEARS the picks — a direct thread
                    takes one person and a team takes many, so carrying a
                    five-person selection into "chat" would silently drop four. */}
                <div className="px-6 pb-4">
                    <div className="inline-flex h-9 w-full items-center gap-1 rounded-xl border border-hairline bg-control/40 p-1">
                        {([
                            ["direct", "One person", TbUser],
                            ["group", "A team", TbUsersGroup]
                        ] as const).map(([value, label, Icon]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => {
                                    setMode(value);
                                    setPicked([]);
                                }}
                                className={`flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${mode === value
                                    ? "nav-glass text-slate-900"
                                    : "text-muted hover:text-slate-900"
                                    }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {mode === "group" && (
                    <div className="px-6 pb-4">
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                            Team name
                        </label>
                        <input
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="e.g. Sales pod"
                            autoFocus
                            className="w-full rounded-xl border border-hairline bg-control/40 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-muted focus:border-accent focus:bg-card"
                        />
                    </div>
                )}

                <div className="px-6 pb-3">
                    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-control/40 px-2.5 py-1.5">
                        <HiOutlineMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search people across your workspaces"
                            className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-muted"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                    {isLoading ? (
                        <div className="space-y-1 px-3">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-12 rounded-xl bg-control animate-pulse"
                                    style={{ animationDelay: `${i * 90}ms` }}
                                />
                            ))}
                        </div>
                    ) : visible.length === 0 ? (
                        <p className="px-4 py-10 text-center text-xs text-muted">
                            {term
                                ? `Nobody matches "${query}".`
                                : "There is nobody else in your workspaces yet. Invite someone from the members page first."}
                        </p>
                    ) : (
                        visible.map((group) => {
                            /**
                             * A team lives in ONE workspace, so once a pick is
                             * made every other workspace is locked out — shown
                             * greyed WITH the reason rather than disappearing,
                             * because a list that silently shrinks looks broken.
                             */
                            const locked =
                                mode === "group" &&
                                Boolean(lockedWorkspace) &&
                                group._id !== lockedWorkspace;

                            const cannotTeam =
                                mode === "group" && !group.capabilities?.canCreateTeam;

                            const blocked = locked || cannotTeam;

                            return (
                                <div key={group._id} className="mb-2">
                                    <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
                                        <WorkspaceIcon
                                            iconKey={group.icon}
                                            className="h-3.5 w-3.5 shrink-0 text-muted"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-muted">
                                            {group.name}
                                        </span>
                                        {group.myRole && (
                                            <span className="shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                                                {shortRole(group.myRole)}
                                            </span>
                                        )}
                                    </div>

                                    {blocked && (
                                        <p className="flex items-center gap-1.5 px-3 pb-1 text-[10px] text-muted">
                                            <TbLock className="h-3 w-3 shrink-0" />
                                            {cannotTeam
                                                ? "Guests cannot create teams here"
                                                : "A team belongs to one workspace"}
                                        </p>
                                    )}

                                    {group.people.map((person) => {
                                        const chosen = isPicked(group._id, person._id);

                                        return (
                                            <button
                                                key={`${group._id}:${person._id}`}
                                                type="button"
                                                disabled={blocked}
                                                onClick={() => toggle(group._id, person._id)}
                                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${blocked
                                                    ? "cursor-not-allowed opacity-40"
                                                    : chosen
                                                        ? "nav-glass cursor-pointer"
                                                        : "hover:bg-control/60 cursor-pointer"
                                                    }`}
                                            >
                                                <span className="relative shrink-0">
                                                    <img
                                                        src={person.avatar || userAsset.src}
                                                        alt={person.firstName}
                                                        className="h-9 w-9 rounded-full object-cover"
                                                    />
                                                    <span className="absolute -bottom-0.5 -right-0.5">
                                                        <PresenceDot
                                                            status={person.presence}
                                                            size={11}
                                                            ringColor="var(--card)"
                                                        />
                                                    </span>
                                                </span>

                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium text-slate-800">
                                                        {person.firstName} {person.lastName}
                                                    </span>
                                                    <span className="block truncate text-[11px] text-muted">
                                                        {person.email}
                                                    </span>
                                                </span>

                                                {chosen && (
                                                    <HiCheck className="h-4 w-4 shrink-0 text-accent" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-hairline p-4">
                    <span className="text-xs text-muted">
                        {mode === "group" && picked.length > 0
                            ? `${picked.length} selected`
                            : ""}
                    </span>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={onClose}
                            className="rounded-xl bg-control px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-control-hover hover:text-slate-900 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={!canSubmit || busy}
                            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                            {busy
                                ? "Working…"
                                : mode === "group"
                                    ? "Create team"
                                    : "Start chat"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
