"use client";

import { useEffect, useRef, useState } from "react";
import {
    HiOutlinePaperClip,
    HiOutlinePaperAirplane,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineArrowUturnLeft,
    HiOutlineXMark
} from "react-icons/hi2";
import { TbPhone, TbVideo, TbUsersGroup, TbUserPlus } from "react-icons/tb";
import PresenceDot from "@/components/ui/helpers/presenceDot";
import { toast } from "@/components/ui/toast";
import { exactTime, timeAgo } from "@/lib/relativeTime";
import { formatDuration } from "@/lib/webrtc";
import { getSocket } from "@/lib/socket";
import { displayName, conversationTitle } from "./ConversationList";
import {
    useDeleteMessageMutation,
    useEditMessageMutation,
    useGetMessagesQuery,
    useSendAttachmentsMutation,
    useSendMessageMutation,
    type Conversation,
    type Message
} from "@/store/api/meet.api";

import userAsset from "@/app/assets/user.png";

/**
 * The right-hand side: one conversation, read and written.
 *
 * Messages arrive through the SOCKET, never a poll — including your own, which
 * is what replaces the optimistic bubble with the stored row. See the `message`
 * case in store/realtime.ts.
 */

/** Typing stops being true this long after the last keystroke arrives. */
const TYPING_TIMEOUT_MS = 3000;
/** How often a keystroke re-announces typing, so it is not one event per key. */
const TYPING_PING_MS = 2000;

const isImage = (kind: string) => kind === "image";

function Attachment({ url, kind, name, bytes }: {
    url: string; kind: string; name: string; bytes: number;
}) {
    if (isImage(kind)) {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                {/* Bounded so one tall screenshot cannot push the whole
                    transcript off screen. */}
                <img
                    src={url}
                    alt={name}
                    className="max-h-64 max-w-full rounded-lg object-cover"
                />
            </a>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-hairline bg-card/60 px-3 py-2 text-xs transition hover:bg-control/60"
        >
            <HiOutlinePaperClip className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{name}</span>
            <span className="shrink-0 text-[10px] text-muted tabular-nums">
                {Math.max(1, Math.round(bytes / 1024))} KB
            </span>
        </a>
    );
}

/** A call is a centred notice, not a bubble — nobody said it. */
function SystemRow({ message }: { message: Message }) {
    const kind = message.system?.callKind === "video" ? "Video" : "Audio";

    const label =
        message.system?.type === "call_started"
            ? `${displayName(message.sender)} started a ${kind.toLowerCase()} call`
            : message.system?.type === "call_missed"
                ? "Missed call"
                : `${kind} call ended${message.system?.durationMs
                    ? ` · ${formatDuration(message.system.durationMs)}`
                    : ""
                }`;

    return (
        <div className="my-2 flex justify-center">
            <span className="rounded-full border border-hairline bg-card px-3 py-1 text-[11px] font-medium text-muted">
                {label}
            </span>
        </div>
    );
}

function Bubble({
    message,
    mine,
    showAuthor,
    onReply,
    onEdit,
    onDelete
}: {
    message: Message;
    mine: boolean;
    showAuthor: boolean;
    onReply: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    if (message.system?.type) return <SystemRow message={message} />;

    return (
        <div className={`group flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>

            {/* The avatar column keeps its width even when the picture is
                hidden, so consecutive messages from one person stay aligned
                instead of stepping sideways. */}
            <div className="w-8 shrink-0">
                {showAuthor && (
                    <img
                        src={message.sender?.avatar || userAsset.src}
                        alt={displayName(message.sender)}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                )}
            </div>

            <div className={`min-w-0 max-w-[min(560px,72%)] ${mine ? "items-end" : ""} flex flex-col`}>
                {showAuthor && (
                    <span className={`mb-1 flex items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                        <span className="text-xs font-semibold text-slate-900">
                            {mine ? "You" : displayName(message.sender)}
                        </span>
                        <span
                            className="text-[10px] text-muted tabular-nums"
                            title={exactTime(message.createdAt)}
                        >
                            {timeAgo(message.createdAt)}
                        </span>
                    </span>
                )}

                <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                    <div
                        className={`min-w-0 rounded-2xl px-3.5 py-2 text-sm ${message.isDeleted
                            ? "border border-dashed border-hairline text-muted italic"
                            : mine
                                ? "bg-accent text-white"
                                : "bg-control text-slate-800"
                            } ${message.pending ? "opacity-60" : ""}`}
                    >
                        {message.isDeleted ? (
                            "This message was deleted"
                        ) : (
                            <>
                                {/* A quoted reply, so an answer still makes
                                    sense once the thread has moved on. */}
                                {message.replyTo && (
                                    <span
                                        className={`mb-1.5 block truncate rounded-lg border-l-2 px-2 py-1 text-xs ${mine
                                            ? "border-white/50 bg-white/15 text-white/80"
                                            : "border-accent/50 bg-card/70 text-muted"
                                            }`}
                                    >
                                        {message.replyTo.isDeleted
                                            ? "Deleted message"
                                            : message.replyTo.text || "Attachment"}
                                    </span>
                                )}

                                {message.attachments?.length > 0 && (
                                    <span className="mb-1.5 flex flex-col gap-1.5">
                                        {message.attachments.map((a) => (
                                            <Attachment key={a.url} {...a} />
                                        ))}
                                    </span>
                                )}

                                {message.text && (
                                    <span className="whitespace-pre-wrap break-words">
                                        {message.text}
                                    </span>
                                )}

                                {message.editedAt && (
                                    <span
                                        className={`ml-1.5 text-[10px] ${mine ? "text-white/60" : "text-muted"}`}
                                    >
                                        (edited)
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    {/* Row actions appear on hover, so a calm transcript stays
                        calm. Hidden entirely on a tombstone — there is nothing
                        left to reply to or edit. */}
                    {!message.isDeleted && !message.pending && (
                        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button
                                type="button"
                                onClick={onReply}
                                title="Reply"
                                aria-label="Reply"
                                className="rounded-lg p-1 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                            >
                                <HiOutlineArrowUturnLeft className="h-3.5 w-3.5" />
                            </button>

                            {mine && (
                                <>
                                    <button
                                        type="button"
                                        onClick={onEdit}
                                        title="Edit"
                                        aria-label="Edit"
                                        className="rounded-lg p-1 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                                    >
                                        <HiOutlinePencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        title="Delete"
                                        aria-label="Delete"
                                        className="rounded-lg p-1 text-muted transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                    >
                                        <HiOutlineTrash className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ChatPane({
    conversation,
    meId,
    onCall,
    onManage
}: {
    conversation: Conversation;
    meId: string;
    onCall: (kind: "audio" | "video") => void;
    onManage: () => void;
}) {
    const { data, isLoading } = useGetMessagesQuery(
        { conversationId: conversation._id },
        { skip: !conversation._id }
    );

    const [sendMessage] = useSendMessageMutation();
    const [sendAttachments, { isLoading: uploading }] = useSendAttachmentsMutation();
    const [editMessage] = useEditMessageMutation();
    const [deleteMessage] = useDeleteMessageMutation();

    const [draft, setDraft] = useState("");
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [editing, setEditing] = useState<Message | null>(null);
    const [typers, setTypers] = useState<string[]>([]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const lastPing = useRef(0);

    const messages = data?.messages ?? [];

    /**
     * Follow the bottom as messages land. Keyed on the newest id rather than
     * the array, so a re-render that changes nothing does not fight a user who
     * has scrolled up to read.
     */
    const newestId = messages[messages.length - 1]?._id;

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [newestId, conversation._id]);

    /**
     * Typing indicators arrive as a WINDOW EVENT, not through the store —
     * caching something worthless a second later would mean writing and
     * expiring redux state on every keystroke of every participant.
     */
    useEffect(() => {
        const timers = new Map<string, ReturnType<typeof setTimeout>>();

        const onTyping = (event: Event) => {
            const detail = (event as CustomEvent).detail as {
                conversationId: string;
                userId: string;
                typing: boolean;
            };

            if (detail.conversationId !== conversation._id) return;
            if (detail.userId === meId) return;

            clearTimeout(timers.get(detail.userId));

            if (!detail.typing) {
                setTypers((t) => t.filter((id) => id !== detail.userId));
                return;
            }

            setTypers((t) => (t.includes(detail.userId) ? t : [...t, detail.userId]));

            // Nobody sends a "stopped typing" when they close the tab, so the
            // indicator expires on its own rather than sticking forever.
            timers.set(
                detail.userId,
                setTimeout(
                    () => setTypers((t) => t.filter((id) => id !== detail.userId)),
                    TYPING_TIMEOUT_MS
                )
            );
        };

        window.addEventListener("crm:typing", onTyping);

        return () => {
            window.removeEventListener("crm:typing", onTyping);
            timers.forEach(clearTimeout);
        };
    }, [conversation._id, meId]);

    /**
     * NO RESET EFFECT for switching threads. The page gives this component a
     * `key` of the conversation id, so changing thread REMOUNTS it and every
     * useState initialiser runs again — the draft, the reply and the typing
     * list re-seed for free. Copying props into state in an effect is the
     * set-state-in-effect rule the whole codebase avoids, and it would also
     * paint the previous thread's draft for one frame before clearing it.
     */

    const announceTyping = () => {
        const now = Date.now();
        if (now - lastPing.current < TYPING_PING_MS) return;
        lastPing.current = now;

        getSocket()?.emit("meet:typing", {
            conversationId: conversation._id,
            typing: true
        });
    };

    const submit = async () => {
        const text = draft.trim();
        if (!text) return;

        if (editing) {
            setDraft("");
            const target = editing;
            setEditing(null);

            try {
                await editMessage({
                    messageId: target._id,
                    conversationId: conversation._id,
                    text
                }).unwrap();
            } catch (error) {
                toast.error(
                    "Could not save that edit",
                    (error as { data?: { message?: string } })?.data?.message
                );
            }
            return;
        }

        setDraft("");
        const quoted = replyTo;
        setReplyTo(null);

        try {
            await sendMessage({
                conversationId: conversation._id,
                text,
                replyTo: quoted?._id
            }).unwrap();
        } catch (error) {
            // Put the words back rather than losing them to a failed send.
            setDraft(text);
            setReplyTo(quoted);
            toast.error(
                "Message not sent",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const onFiles = async (files: FileList | null) => {
        if (!files?.length) return;

        try {
            await sendAttachments({
                conversationId: conversation._id,
                files: Array.from(files),
                text: draft.trim() || undefined
            }).unwrap();
            setDraft("");
        } catch (error) {
            toast.error(
                "Could not share those files",
                (error as { data?: { message?: string } })?.data?.message
            );
        } finally {
            // Clearing lets the SAME file be picked again after a failure.
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const remove = async (message: Message) => {
        try {
            await deleteMessage({
                messageId: message._id,
                conversationId: conversation._id
            }).unwrap();
        } catch (error) {
            toast.error(
                "Could not delete that message",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const counterpart = conversation.counterpart;

    const typingLabel = (() => {
        if (!typers.length) return "";

        const names = typers
            .map((id) =>
                displayName(
                    conversation.members.find((m) => m.user._id === id)?.user
                )
            )
            .filter(Boolean);

        if (!names.length) return "";
        if (names.length === 1) return `${names[0]} is typing…`;
        if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
        return "Several people are typing…";
    })();

    return (
        <section className="flex h-full min-w-0 flex-1 flex-col bg-panel font-dmsans">

            {/* ── Thread header ───────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline bg-card px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    {conversation.kind === "group" ? (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <TbUsersGroup className="h-5 w-5" />
                        </span>
                    ) : (
                        <span className="relative shrink-0">
                            <img
                                src={counterpart?.avatar || userAsset.src}
                                alt={displayName(counterpart)}
                                className="h-10 w-10 rounded-xl object-cover"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5">
                                <PresenceDot
                                    status={counterpart?.presence}
                                    size={12}
                                    ringColor="var(--card)"
                                />
                            </span>
                        </span>
                    )}

                    <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-slate-900">
                            {conversationTitle(conversation)}
                        </h2>
                        <p className="truncate text-[11px] text-muted">
                            {/* Typing wins over the standing subtitle: it is
                                the only part of this line that is news. */}
                            {typingLabel ||
                                (conversation.kind === "group"
                                    ? `${conversation.members.length} member${conversation.members.length === 1 ? "" : "s"}`
                                    : counterpart?.presence === "online"
                                        ? "Available"
                                        : counterpart?.email || "")}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onCall("audio")}
                        title="Start an audio call"
                        aria-label="Start an audio call"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600 transition hover:bg-control hover:text-slate-900 cursor-pointer"
                    >
                        <TbPhone className="h-[18px] w-[18px]" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onCall("video")}
                        title="Start a video call"
                        aria-label="Start a video call"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600 transition hover:bg-control hover:text-slate-900 cursor-pointer"
                    >
                        <TbVideo className="h-[18px] w-[18px]" />
                    </button>

                    {conversation.kind === "group" && (
                        <button
                            type="button"
                            onClick={onManage}
                            title="Manage this team"
                            aria-label="Manage this team"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600 transition hover:bg-control hover:text-slate-900 cursor-pointer"
                        >
                            <TbUserPlus className="h-[18px] w-[18px]" />
                        </button>
                    )}
                </div>
            </header>

            {/* ── Transcript ──────────────────────────────────────── */}
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                {isLoading ? (
                    <div className="space-y-3">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-12 rounded-2xl bg-control animate-pulse"
                                style={{
                                    width: `${45 + ((i * 17) % 30)}%`,
                                    marginLeft: i % 2 ? "auto" : undefined,
                                    animationDelay: `${i * 90}ms`
                                }}
                            />
                        ))}
                    </div>
                ) : messages.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted">
                        No messages yet — say something.
                    </p>
                ) : (
                    messages.map((message, i) => {
                        const previous = messages[i - 1];

                        /**
                         * The avatar and name are drawn only when the SPEAKER
                         * changes (or after a gap), so a burst of messages from
                         * one person reads as one turn instead of five stamped
                         * cards.
                         */
                        const gap =
                            previous &&
                            new Date(message.createdAt).getTime() -
                            new Date(previous.createdAt).getTime() >
                            5 * 60 * 1000;

                        const showAuthor =
                            !previous ||
                            previous.sender?._id !== message.sender?._id ||
                            Boolean(gap) ||
                            Boolean(previous.system?.type);

                        return (
                            <Bubble
                                key={message._id}
                                message={message}
                                mine={String(message.sender?._id) === String(meId)}
                                showAuthor={showAuthor}
                                onReply={() => setReplyTo(message)}
                                onEdit={() => {
                                    setEditing(message);
                                    setDraft(message.text);
                                }}
                                onDelete={() => remove(message)}
                            />
                        );
                    })
                )}

                <div ref={bottomRef} />
            </div>

            {/* ── Composer ────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-hairline bg-card px-4 py-3">

                {(replyTo || editing) && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-accent bg-control/50 px-3 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs text-muted">
                            <span className="font-semibold text-slate-700">
                                {editing ? "Editing" : `Replying to ${displayName(replyTo?.sender)}`}
                            </span>
                            {" · "}
                            {(editing ?? replyTo)?.text || "Attachment"}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setReplyTo(null);
                                if (editing) setDraft("");
                                setEditing(null);
                            }}
                            aria-label="Cancel"
                            className="shrink-0 rounded p-1 text-muted transition hover:text-slate-900 cursor-pointer"
                        >
                            <HiOutlineXMark className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="flex items-end gap-2"
                >
                    <input
                        ref={fileRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => onFiles(e.target.files)}
                    />

                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        title="Attach a file"
                        aria-label="Attach a file"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-card text-slate-600 transition hover:bg-control hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                    >
                        <HiOutlinePaperClip className="h-[18px] w-[18px]" />
                    </button>

                    <textarea
                        value={draft}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            announceTyping();
                        }}
                        onKeyDown={(e) => {
                            // Enter sends, Shift+Enter breaks the line — the
                            // convention every chat app has trained people on.
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        rows={1}
                        placeholder={
                            uploading ? "Uploading…" : "Write a message…  (Enter to send)"
                        }
                        className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-hairline bg-control/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-muted focus:border-accent focus:bg-card"
                    />

                    <button
                        type="submit"
                        disabled={!draft.trim() || uploading}
                        aria-label="Send"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                        <HiOutlinePaperAirplane className="h-[18px] w-[18px]" />
                    </button>
                </form>
            </div>
        </section>
    );
}
