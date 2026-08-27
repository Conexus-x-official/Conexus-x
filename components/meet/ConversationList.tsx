"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    HiOutlineMagnifyingGlass,
    HiOutlinePlus,
    HiOutlineXMark,
    HiOutlineChevronLeft
} from "react-icons/hi2";
import { TbUsersGroup, TbMessages, TbMessageCircle } from "react-icons/tb";
import PresenceDot from "@/components/ui/helpers/presenceDot";
import ProfileDropdown from "@/components/Profile";
import { WorkspaceIcon } from "@/lib/workspaceIcons";
import { timeAgo } from "@/lib/relativeTime";
import { shortRole } from "@/lib/meetRoles";
import type { Conversation, MeetUser } from "@/store/api/meet.api";

import userAsset from "@/app/assets/user.png";

/**
 * The left rail: who you are talking to, and who you are signed in as.
 *
 * It carries the whole page's chrome now — the top header bar was removed, so
 * the way back to the app, the identity, the search and the profile all live
 * here. That is the right home for them: a chat client is a sidebar and a
 * transcript, and a third horizontal band above both was spending 64px to
 * repeat what the rail already says.
 *
 * ROWS ARE GROUPED BY WORKSPACE. Meet spans every workspace you belong to, so
 * "which one is this?" has to be answerable without clicking — but it is a
 * heading, not a filter, because filtering by workspace is exactly the
 * switching this change exists to remove.
 */

export type MeetTab = "chats" | "teams";

export const displayName = (user?: MeetUser | null) =>
    user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "Unknown";

/** A direct thread is titled after the other person, resolved server-side. */
export const conversationTitle = (conversation: Conversation) =>
    conversation.kind === "direct"
        ? displayName(conversation.counterpart)
        : conversation.name || "Untitled team";

function Avatar({
    conversation,
    size = 40
}: {
    conversation: Conversation;
    size?: number;
}) {
    if (conversation.kind === "group") {
        return (
            <span
                className="flex shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
                style={{ width: size, height: size }}
            >
                <TbUsersGroup style={{ width: size * 0.5, height: size * 0.5 }} />
            </span>
        );
    }

    const person = conversation.counterpart;

    return (
        <span className="relative shrink-0" style={{ width: size, height: size }}>
            {/* A plain <img>, matching Profile.tsx and ActivityFeed: remote
                Cloudinary avatars would need next.config remotePatterns before
                next/image is usable here. */}
            <img
                src={person?.avatar || userAsset.src}
                alt={displayName(person)}
                className="h-full w-full rounded-xl object-cover"
            />

            {/* The same presence the profile menu draws — one source, one
                meaning. `presence` is the server-derived value, never the
                person's raw pick. */}
            <span className="absolute -bottom-0.5 -right-0.5">
                <PresenceDot status={person?.presence} size={12} ringColor="var(--card)" />
            </span>
        </span>
    );
}

export default function ConversationList({
    conversations,
    activeId,
    loading,
    tab,
    onTab,
    onSelect,
    onNew
}: {
    conversations: Conversation[];
    activeId: string;
    loading: boolean;
    tab: MeetTab;
    onTab: (tab: MeetTab) => void;
    onSelect: (conversation: Conversation) => void;
    onNew: () => void;
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");

    const term = query.trim().toLowerCase();

    /**
     * Tab first, then search. Both are derived — a pure function of the props
     * and the query, never mirrored into state.
     *
     * SEARCH IGNORES THE TAB on purpose: someone typing a name wants that
     * person, and silently hiding the match because they are in a team and you
     * are on the Chats tab is the kind of thing that makes people believe the
     * search is broken.
     */
    const matches = (c: Conversation) =>
        conversationTitle(c).toLowerCase().includes(term) ||
        c.workspace?.name?.toLowerCase().includes(term) ||
        c.members.some((m) => displayName(m.user).toLowerCase().includes(term));

    const visible = term
        ? conversations.filter(matches)
        : conversations.filter((c) =>
            tab === "teams" ? c.kind === "group" : c.kind === "direct"
        );

    /**
     * Grouped by workspace, preserving the server's recency order — the first
     * time a workspace appears decides where its heading goes, so the most
     * recently active workspace is at the top without a second sort.
     */
    const groups: { id: string; name: string; icon?: string; role: string | null; rows: Conversation[] }[] = [];

    visible.forEach((c) => {
        const id = c.workspace?._id ?? "";
        let group = groups.find((g) => g.id === id);

        if (!group) {
            group = {
                id,
                name: c.workspace?.name || "Workspace",
                icon: c.workspace?.icon,
                role: c.myRole ?? null,
                rows: []
            };
            groups.push(group);
        }

        group.rows.push(c);
    });

    // A single workspace needs no heading — it would label every row with the
    // one fact they all share.
    const showHeadings = groups.length > 1;

    const counts = {
        chats: conversations.filter((c) => c.kind === "direct").length,
        teams: conversations.filter((c) => c.kind === "group").length
    };

    return (
        <aside className="flex h-full w-full flex-col border-r border-hairline bg-card font-dmsans">

            {/* ── Identity + the way out ─────────────────────────────
                 This page renders no app sidebar and no longer has a header
                 bar, so the back control lives here. Without it the only exit
                 would be the browser's own Back. */}
            <div className="flex items-center gap-2 px-3 pt-4 pb-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    title="Back"
                    aria-label="Back"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                >
                    <HiOutlineChevronLeft className="h-4 w-4" />
                </button>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <TbMessages className="h-[18px] w-[18px]" />
                </span>

                <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                    Conexus Meet
                </h1>

                <button
                    type="button"
                    onClick={onNew}
                    title="Start a chat or team"
                    aria-label="Start a chat or team"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600 transition hover:bg-control hover:text-slate-900 cursor-pointer"
                >
                    <HiOutlinePlus className="h-4 w-4" />
                </button>
            </div>

            {/* ── Search ─────────────────────────────────────────────
                 Always present, not past a threshold: this list spans every
                 workspace now, so it is long by default rather than by
                 exception. */}
            <div className="px-3 pb-3">
                <div className="flex items-center gap-2 rounded-lg border border-hairline bg-control/40 px-2.5 py-2 transition focus-within:border-accent focus-within:bg-card">
                    <HiOutlineMagnifyingGlass className="h-4 w-4 shrink-0 text-muted" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search people, teams, workspaces"
                        className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-muted"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            aria-label="Clear search"
                            className="shrink-0 rounded p-0.5 text-muted transition hover:text-slate-900 cursor-pointer"
                        >
                            <HiOutlineXMark className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Chats / Teams ──────────────────────────────────────
                 Hidden while searching, because search deliberately looks in
                 both — leaving the toggle lit would claim to be narrowing
                 something it is not. */}
            {!term && (
                <div className="px-3 pb-2">
                    <div className="inline-flex h-9 w-full items-center gap-1 rounded-xl border border-hairline bg-control/40 p-1">
                        {([
                            ["chats", "Chats", TbMessageCircle, counts.chats],
                            ["teams", "Teams", TbUsersGroup, counts.teams]
                        ] as const).map(([value, label, Icon, n]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onTab(value)}
                                className={`flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${tab === value
                                    ? "nav-glass text-slate-900"
                                    : "text-muted hover:text-slate-900"
                                    }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                                {n > 0 && (
                                    <span className="text-[10px] font-bold tabular-nums opacity-60">
                                        {n}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── The list ───────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                {loading ? (
                    <div className="space-y-1 px-2">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-14 rounded-xl bg-control animate-pulse"
                                style={{ animationDelay: `${i * 90}ms` }}
                            />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <p className="px-4 py-10 text-center text-xs text-muted">
                        {term
                            ? `Nothing matches "${query}".`
                            : tab === "teams"
                                ? "No teams yet. Create one with the + above."
                                : "No chats yet. Start one with the + above."}
                    </p>
                ) : (
                    groups.map((group) => (
                        <div key={group.id} className="mb-1">
                            {showHeadings && (
                                <div className="flex items-center gap-1.5 px-2 pb-1 pt-2">
                                    <WorkspaceIcon
                                        iconKey={group.icon}
                                        className="h-3.5 w-3.5 shrink-0 text-muted"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-muted">
                                        {group.name}
                                    </span>
                                    {/* Your standing in that workspace, which is
                                        what decides the controls you get in its
                                        threads. */}
                                    {group.role && (
                                        <span className="shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                                            {shortRole(group.role)}
                                        </span>
                                    )}
                                </div>
                            )}

                            {group.rows.map((conversation) => {
                                const active = conversation._id === activeId;
                                const unread = conversation.unread > 0;

                                return (
                                    <button
                                        key={conversation._id}
                                        type="button"
                                        onClick={() => onSelect(conversation)}
                                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition cursor-pointer ${active ? "nav-glass" : "hover:bg-control/60"
                                            }`}
                                    >
                                        <Avatar conversation={conversation} />

                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className={`min-w-0 flex-1 truncate text-sm ${unread
                                                        ? "font-bold text-slate-900"
                                                        : "font-medium text-slate-800"
                                                        }`}
                                                >
                                                    {conversationTitle(conversation)}
                                                </span>

                                                {conversation.lastMessage?.at && (
                                                    <span className="shrink-0 text-[10px] font-medium text-muted tabular-nums">
                                                        {timeAgo(conversation.lastMessage.at)}
                                                    </span>
                                                )}
                                            </span>

                                            <span className="mt-0.5 flex items-center gap-2">
                                                <span
                                                    className={`min-w-0 flex-1 truncate text-xs ${unread
                                                        ? "font-semibold text-slate-700"
                                                        : "text-muted"
                                                        }`}
                                                >
                                                    {conversation.lastMessage?.text ||
                                                        "No messages yet"}
                                                </span>

                                                {/* The count, not just a dot:
                                                    "how much did I miss" is the
                                                    question this row is asked. */}
                                                {unread && (
                                                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white tabular-nums">
                                                        {conversation.unread > 99
                                                            ? "99+"
                                                            : conversation.unread}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>

            {/* ── Signed in as ────────────────────────────────────────
                 The divider is what makes this read as the foot of the rail
                 rather than the last row of the list. The menu opens UPWARD —
                 see the `placement` prop, which exists for exactly this. */}
            <div className="shrink-0 border-t border-hairline px-2 py-2">
                <ProfileDropdown placement="top" variant="bar" />
            </div>
        </aside>
    );
}
