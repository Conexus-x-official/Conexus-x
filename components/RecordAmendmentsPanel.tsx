"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    HiOutlineXMark,
    HiOutlinePaperAirplane,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineArrowUturnLeft,
    HiOutlineLink,
    HiOutlineChevronDown,
    HiCheck
} from "react-icons/hi2";
import { MdOutlineTipsAndUpdates } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

import {
    useGetRecordAmendmentsQuery,
    useCreateAmendmentMutation,
    useUpdateAmendmentMutation,
    useDeleteAmendmentMutation
} from "@/store/api/amendments.api";
import { useGetMembersQuery } from "@/store/api/members.api";
import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { PersonAvatar, memberName, memberUserId, type MemberLike } from "@/components/ui/helpers/personCell";
import ImportantToggle from "@/components/ui/helpers/importantToggle";
import { UserMention } from "@/components/ui/modals/userProfileCard";
import { canManageRoles } from "@/lib/roles";
import { getUser } from "@/lib/auth";
import { timeAgo } from "@/lib/relativeTime";
import { toast } from "@/components/ui/toast";
import type { RecordAmendment, RecordItem } from "@/store/types";

/**
 * The amendments panel: what people have SAID about one record.
 *
 * Deliberately separate from the activity drawer, which is what the server
 * recorded about what changed. Both are per-record histories and they are read
 * for different reasons — "why is this stuck" is answered here, "who moved it"
 * is answered there.
 *
 * Nothing is fetched until a record is actually passed in: the panel is gated
 * on `record`, which starts null, so a board draws its bubbles from the count
 * already on each row and pays for nothing else.
 *
 * VISUALS: a recessed thread on bg-panel with each root amendment a raised
 * bg-card note, replies nested under a hairline inside it. Text only — no rich
 * formatting — with @-mentions the one piece of markup.
 */

interface RecordAmendmentsPanelProps {
    /**
     * The record whose amendments to show — null keeps the panel closed. The
     * caller keys this component on the record id, so every draft below is
     * re-seeded by the remount rather than by an effect.
     */
    record: RecordItem | null;
    workspaceId: string;
    /** The row's collection, so posting can patch its count without a refetch. */
    collectionId?: string;
    onClose: () => void;
}

/**
 * RTK Query rejects with the server's body under `data`. Every failure here is
 * REPORTED with the server's own wording rather than a guess, because "you can
 * only edit your own amendments" and "the module is gone" need different reactions.
 */
function serverMessage(error: unknown, fallback: string): string {
    const data = (error as { data?: { message?: string } } | null)?.data;
    return typeof data?.message === "string" ? data.message : fallback;
}

function authorName(amendment: RecordAmendment): string {
    const user = amendment.user;
    if (!user) return "Deleted amendment";
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

/** Mirrors the backend's MENTION_PATTERN in services/mention.service.ts. */
const MENTION_TOKEN = /@([A-Za-z][\w'-]{1,29})/g;

/**
 * Turns "@John" inside amendment text into a coloured, clickable/hoverable
 * <UserMention> — matched the same way the server matches one: first name
 * only, case-insensitive, against the workspace roster. A token that matches
 * nobody (a typo, someone who has since left) renders as plain "@text"
 * rather than a dead-looking link.
 */
function renderMessageWithMentions(text: string, members: MemberLike[]): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    for (const match of text.matchAll(MENTION_TOKEN)) {
        const [full, name] = match;
        const start = match.index ?? 0;

        if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

        const found = members.find(
            (m) => memberName(m).split(" ")[0].toLowerCase() === name.toLowerCase()
        );

        nodes.push(
            found ? (
                <UserMention key={`mention-${key++}`} member={found}>
                    {full}
                </UserMention>
            ) : (
                full
            )
        );

        lastIndex = start + full.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

    return nodes;
}

const MAX_MENTION_RESULTS = 6;

/**
 * A textarea that grows with its content — an amendment is not a single line.
 *
 * Optionally an @-mention autocomplete: pass `mentionMembers` (the workspace
 * roster, already in cache — see the panel's own useGetMembersQuery) and it
 * activates. Typing "@" opens a filtered, keyboard-navigable list; picking a
 * name inserts `@FirstName ` (plain text — the server's fallback matcher
 * reads exactly that shape for anyone who types a mention without using this
 * picker) and reports the picked member up via `onMention`, which the panel
 * uses to send an EXACT user id alongside the text — see
 * services/mention.service.ts / amendment.controller.ts on the backend for
 * why both paths are kept.
 *
 * `bare` drops the textarea's own border so it can sit inside a wrapper box
 * that owns the focus ring (the main composer); the inline edit/reply
 * textareas keep their own border.
 */
function GrowingTextarea({
    value,
    onChange,
    onSubmit,
    placeholder,
    autoFocus = false,
    rows = 2,
    bare = false,
    mentionMembers,
    excludeUserId,
    onMention,
    dropUp = false
}: {
    value: string;
    onChange: (next: string) => void;
    onSubmit: () => void;
    placeholder: string;
    autoFocus?: boolean;
    rows?: number;
    bare?: boolean;
    mentionMembers?: MemberLike[];
    excludeUserId?: string;
    onMention?: (member: MemberLike) => void;
    /** Opens the list upward — for a composer pinned to the panel's bottom. */
    dropUp?: boolean;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    /** Where to put the caret once `value` re-renders with an inserted mention. */
    const pendingCaretRef = useRef<number | null>(null);

    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionStart, setMentionStart] = useState(0);
    const [mentionIndex, setMentionIndex] = useState(0);

    useEffect(() => {
        if (autoFocus) ref.current?.focus();
    }, [autoFocus]);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        node.style.height = "auto";
        node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
    }, [value]);

    // The textarea only reflects the inserted mention on the render AFTER
    // onChange commits — a controlled input's DOM value lags the state that
    // drives it by one tick, so the caret can only be restored here.
    useEffect(() => {
        if (pendingCaretRef.current === null) return;
        const pos = pendingCaretRef.current;
        pendingCaretRef.current = null;
        ref.current?.setSelectionRange(pos, pos);
    }, [value]);

    const closeMention = () => {
        setMentionQuery(null);
        setMentionStart(0);
        setMentionIndex(0);
    };

    const matches = (mentionQuery !== null && mentionMembers
        ? mentionMembers
            .filter((m) => memberUserId(m) !== excludeUserId)
            .filter((m) => memberName(m).toLowerCase().includes(mentionQuery.toLowerCase()))
        : []
    ).slice(0, MAX_MENTION_RESULTS);

    /** Looks backward from the caret for an unfinished "@token" to autocomplete. */
    const detectMention = (text: string, caret: number) => {
        if (!mentionMembers) return;

        const upToCaret = text.slice(0, caret);
        const at = upToCaret.lastIndexOf("@");

        // No "@", or one not starting a fresh token (must be at the very start
        // of the text or preceded by whitespace — "email@host" is not a mention).
        if (at === -1 || (at > 0 && !/\s/.test(upToCaret[at - 1]))) {
            closeMention();
            return;
        }

        const query = upToCaret.slice(at + 1);

        // A space ends the token: "@john smith" is two words, not one query.
        if (/\s/.test(query)) {
            closeMention();
            return;
        }

        setMentionQuery(query);
        setMentionStart(at);
        setMentionIndex(0);
    };

    const pickMention = (member: MemberLike) => {
        const name = memberName(member).split(" ")[0];
        const caret = ref.current?.selectionStart ?? value.length;
        const inserted = `@${name} `;
        const next = value.slice(0, mentionStart) + inserted + value.slice(caret);

        pendingCaretRef.current = mentionStart + inserted.length;
        onChange(next);
        onMention?.(member);
        closeMention();
    };

    return (
        <div className="relative">
            <textarea
                ref={ref}
                rows={rows}
                value={value}
                placeholder={placeholder}
                onChange={(e) => {
                    onChange(e.target.value);
                    detectMention(e.target.value, e.target.selectionStart);
                }}
                onClick={(e) =>
                    detectMention(value, (e.target as HTMLTextAreaElement).selectionStart)
                }
                onKeyDown={(e) => {
                    if (mentionQuery !== null) {
                        if (e.key === "Escape") {
                            // Close the list without also closing the panel —
                            // the document-level Escape listener would do both.
                            e.preventDefault();
                            e.stopPropagation();
                            closeMention();
                            return;
                        }

                        if (matches.length > 0) {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setMentionIndex((i) => (i + 1) % matches.length);
                                return;
                            }
                            if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setMentionIndex((i) => (i - 1 + matches.length) % matches.length);
                                return;
                            }
                            if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                pickMention(matches[mentionIndex]);
                                return;
                            }
                        }
                    }

                    // Enter alone inserts a newline: an amendment is prose, and losing
                    // a half-written paragraph to a stray keypress is unforgivable.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
                onBlur={() => {
                    // Give a mousedown on the list a moment to register before
                    // it vanishes — see the picker buttons' own onMouseDown.
                    window.setTimeout(closeMention, 120);
                }}
                className={
                    bare
                        ? "w-full resize-none bg-transparent px-3 pt-2.5 text-sm leading-relaxed text-body outline-none placeholder:text-muted"
                        : "w-full resize-none rounded-lg border border-hairline bg-control/40 px-3 py-2 text-sm leading-relaxed text-body outline-none transition placeholder:text-muted focus:border-foreground focus:bg-card focus:ring-4 focus:ring-foreground/10"
                }
            />

            {matches.length > 0 && (
                <div
                    className={`absolute left-0 z-20 w-64 overflow-hidden rounded-lg border border-hairline bg-card py-1 shadow-lg ${dropUp ? "bottom-full mb-1" : "top-full mt-1"
                        }`}
                >
                    {matches.map((member, index) => (
                        <button
                            key={memberUserId(member)}
                            type="button"
                            // Mousedown fires before the textarea's blur — a
                            // click would arrive after the onBlur timeout above
                            // may have already closed this list.
                            onMouseDown={(e) => {
                                e.preventDefault();
                                pickMention(member);
                            }}
                            className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-xs transition ${index === mentionIndex ? "bg-control" : "hover:bg-control/50"
                                }`}
                        >
                            <PersonAvatar member={member} size={20} ring={false} />
                            <span className="truncate font-medium text-body">
                                {memberName(member)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function RecordAmendmentsPanel({
    record,
    workspaceId,
    collectionId,
    onClose
}: RecordAmendmentsPanelProps) {
    const recordId = record?._id;

    /**
     * Set when this row is a sub-record. Its count lives in
     * getSubRecords(parent), not in the collection list, so every write below
     * has to say which cache entry to patch — see patchCount in the api file.
     */
    const parentRecordId = record?.parentRecord ?? null;

    const { data: amendments = [], isLoading, isFetching } = useGetRecordAmendmentsQuery(
        recordId as string,
        { skip: !recordId }
    );

    // Already in cache on every board page — this costs no extra request and is
    // only read to decide whether to OFFER moderation. The server re-checks.
    const { data: members = [] } = useGetMembersQuery(workspaceId, { skip: !recordId });

    // The record's collection colour, cache-shared with the board — used for
    // the reply rail so a thread reads as belonging to its collection.
    const { data: collections = [] } = useGetCollectionsQuery(record?.module ?? "", {
        skip: !record?.module
    });
    const railColor =
        collections.find((c) => c._id === record?.collectionName)?.color || "var(--hairline)";

    const [createAmendment, { isLoading: posting }] = useCreateAmendmentMutation();
    const [updateAmendment] = useUpdateAmendmentMutation();
    const [deleteAmendment] = useDeleteAmendmentMutation();

    const [draft, setDraft] = useState("");
    // Exact user ids picked via @-autocomplete — sent alongside the draft's
    // text so the mentioned people are notified precisely, not by name match.
    const [draftMentions, setDraftMentions] = useState<string[]>([]);
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [replyDraft, setReplyDraft] = useState("");
    const [replyMentions, setReplyMentions] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState("");
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    /** Which root threads have their replies expanded — all collapsed by default
     *  (the panel is keyed on the record id, so this re-seeds per record). */
    const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());

    const toggleThread = (rootId: string) =>
        setOpenThreads((current) => {
            const next = new Set(current);
            if (next.has(rootId)) next.delete(rootId);
            else next.add(rootId);
            return next;
        });

    const openThread = (rootId: string) =>
        setOpenThreads((current) => new Set(current).add(rootId));

    const addMention =
        (setter: React.Dispatch<React.SetStateAction<string[]>>) => (member: MemberLike) => {
            const id = memberUserId(member);
            if (!id) return;
            setter((ids) => (ids.includes(id) ? ids : [...ids, id]));
        };

    const currentUserId = getUser()?.id;

    const canModerate = canManageRoles(
        members.find((m) => memberUserId(m) === currentUserId)?.role
    );

    useEffect(() => {
        if (!recordId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [recordId, onClose]);

    /**
     * Top-level amendments, each carrying its own replies in order. Written as a
     * plain derivation on purpose: the React Compiler handles the memoisation,
     * and hand-rolled useMemo over values it cannot prove stable is what the
     * board's other helpers were rewritten to avoid.
     */
    const repliesByParent = new Map<string, RecordAmendment[]>();

    for (const amendment of amendments) {
        if (!amendment.parentComment) continue;
        const key = String(amendment.parentComment);
        repliesByParent.set(key, [...(repliesByParent.get(key) ?? []), amendment]);
    }

    const threads = amendments
        .filter((c) => !c.parentComment)
        .map((root) => ({ root, replies: repliesByParent.get(root._id) ?? [] }));

    const post = async (message: string, parentComment?: string, mentions?: string[]) => {
        const text = message.trim();
        if (!text || !recordId) return false;

        try {
            await createAmendment({
                recordId,
                message: text,
                parentComment,
                collectionId,
                parentRecordId,
                mentions
            }).unwrap();
            return true;
        } catch (error) {
            toast.error(
                "Could not post that amendment",
                serverMessage(error, "The server rejected the write.")
            );
            return false;
        }
    };

    const submitDraft = async () => {
        if (await post(draft, undefined, draftMentions)) {
            setDraft("");
            setDraftMentions([]);
        }
    };

    const submitReply = async (parentId: string) => {
        if (await post(replyDraft, parentId, replyMentions)) {
            setReplyDraft("");
            setReplyMentions([]);
            setReplyTo(null);
        }
    };

    const saveEdit = async (amendment: RecordAmendment) => {
        const text = editDraft.trim();

        if (!text || !recordId) return;

        if (text === amendment.message) {
            setEditingId(null);
            return;
        }

        try {
            await updateAmendment({
                amendmentId: amendment._id,
                recordId,
                message: text
            }).unwrap();
            setEditingId(null);
        } catch (error) {
            toast.error(
                "Could not save that edit",
                serverMessage(error, "The server rejected the write.")
            );
        }
    };

    const remove = async (amendment: RecordAmendment) => {
        if (!recordId) return;

        try {
            await deleteAmendment({
                amendmentId: amendment._id,
                recordId,
                collectionId,
                parentRecordId
            }).unwrap();

            setConfirmingId(null);

            // Replies are left standing — they are someone else's words, and a
            // thread with its opening line removed still reads.
            toast.success("Amendment deleted");
        } catch (error) {
            setConfirmingId(null);
            toast.error(
                "Could not delete that amendment",
                serverMessage(error, "The server rejected the write.")
            );
        }
    };

    /**
     * The panel's own URL. The board puts /Record/<id> in the address bar when
     * it opens one, so this is simply wherever we already are — no id has to be
     * threaded down here, and what gets copied is exactly what the user sees.
     */
    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Denied clipboard permission, or an insecure origin. Say so rather
            // than leaving a button that silently does nothing.
            toast.error(
                "Could not copy the link",
                "Copy it from the address bar instead."
            );
        }
    };

    if (!record || typeof document === "undefined") return null;

    const total = amendments.filter((c) => !c.isDeleted).length;

    const renderAmendment = (amendment: RecordAmendment, replyCount: number, isReply: boolean) => {
        const mine = amendment.user?._id === currentUserId;
        const editing = editingId === amendment._id;

        if (amendment.isDeleted) {
            return (
                <div
                    key={amendment._id}
                    className="rounded-lg border border-dashed border-hairline px-3 py-2 text-xs italic text-muted"
                >
                    This amendment was deleted.
                </div>
            );
        }

        return (
            <div key={amendment._id} className="group/amendment flex items-start gap-2">
                <PersonAvatar
                    member={{ user: amendment.user ?? undefined }}
                    size={isReply ? 18 : 22}
                    ring={false}
                />

                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-xs font-bold text-foreground">
                            {authorName(amendment)}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted">
                            {timeAgo(amendment.createdAt)}
                            {amendment.edited ? " · edited" : ""}
                        </span>
                    </div>

                    {editing ? (
                        <div className="mt-1.5 space-y-2">
                            <GrowingTextarea
                                value={editDraft}
                                onChange={setEditDraft}
                                onSubmit={() => saveEdit(amendment)}
                                placeholder="Edit your amendment"
                                autoFocus
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => saveEdit(amendment)}
                                    className="cursor-pointer rounded-md bg-foreground px-2.5 py-1 text-xs font-bold text-card transition hover:opacity-90"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="cursor-pointer text-xs font-semibold text-muted transition hover:text-foreground"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-body">
                            {renderMessageWithMentions(amendment.message, members)}
                        </p>
                    )}

                    {!editing && (
                        <div className="mt-1 flex items-center gap-3 opacity-0 transition group-hover/amendment:opacity-100 focus-within:opacity-100">
                            {!isReply && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReplyTo(replyTo === amendment._id ? null : amendment._id);
                                        setReplyDraft("");
                                        setReplyMentions([]);
                                        openThread(amendment._id);
                                    }}
                                    className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-muted transition hover:text-foreground"
                                >
                                    <HiOutlineArrowUturnLeft className="h-3 w-3" />
                                    Reply
                                </button>
                            )}

                            {mine && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingId(amendment._id);
                                        setEditDraft(amendment.message);
                                    }}
                                    className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-muted transition hover:text-foreground"
                                >
                                    <HiOutlinePencil className="h-3 w-3" />
                                    Edit
                                </button>
                            )}

                            {(mine || canModerate) && (
                                confirmingId === amendment._id ? (
                                    <span className="flex items-center gap-2 text-[10px] font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => remove(amendment)}
                                            className="cursor-pointer text-red-600 transition hover:text-red-700"
                                        >
                                            {replyCount
                                                ? "Delete, keep replies"
                                                : "Confirm delete"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmingId(null)}
                                            className="cursor-pointer text-muted transition hover:text-foreground"
                                        >
                                            Cancel
                                        </button>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingId(amendment._id)}
                                        className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-muted transition hover:text-red-600"
                                    >
                                        <HiOutlineTrash className="h-3 w-3" />
                                        Delete
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end font-google-sans">

            {/* Scrim — clicking outside closes, matching the activity drawer */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />

            <aside
                className="relative flex h-full w-[440px] max-w-[94vw] flex-col border-l border-hairline bg-card shadow-2xl"
                role="dialog"
                aria-label={`Amendments on ${record.name}`}
            >
                {/* Header */}
                <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-hairline px-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-control text-muted">
                            <MdOutlineTipsAndUpdates className="h-4 w-4" />
                        </span>

                        <span className="min-w-0">
                            <span className="block truncate text-sm font-bold leading-tight text-foreground">
                                {record.name}
                            </span>
                            <span className="block truncate text-[11px] font-medium text-muted">
                                {total === 0
                                    ? "No amendments yet"
                                    : `${total} amendment${total === 1 ? "" : "s"}`}
                            </span>
                        </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                        <span className="flex h-8 w-8 items-center justify-center">
                            <ImportantToggle record={record} size={17} />
                        </span>

                        <button
                            type="button"
                            onClick={copyLink}
                            aria-label="Copy link to this record"
                            title={copied ? "Link copied" : "Copy link to this record"}
                            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-control ${copied ? "text-emerald-600" : "text-muted hover:text-foreground"}`}
                        >
                            {copied ? (
                                <HiCheck className="h-4 w-4" />
                            ) : (
                                <HiOutlineLink className="h-4 w-4" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close amendments"
                            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition hover:bg-control hover:text-foreground"
                        >
                            <HiOutlineXMark className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Thread — a flat run of amendments on the panel surface, one
                    divided from the next by a hairline. No card behind the
                    message text. */}
                <div className="flex-1 divide-y divide-hairline overflow-y-auto bg-card px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control-hover">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted">
                            <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                            Loading amendments
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="flex flex-col items-center gap-1.5 py-14 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-control text-muted">
                                <MdOutlineTipsAndUpdates className="h-5 w-5" />
                            </span>
                            <p className="mt-1 text-sm font-bold text-foreground">No amendments yet</p>
                            <p className="max-w-[26ch] text-xs leading-relaxed text-muted">
                                Write the first one — what changed, what is blocked, what comes next.
                            </p>
                        </div>
                    ) : (
                        threads.map(({ root, replies }) => {
                            const open = openThreads.has(root._id);
                            return (
                            <div
                                key={root._id}
                                className={`py-3 ${replies.length ? "cursor-pointer" : ""}`}
                                onClick={(e) => {
                                    // The whole amendment toggles its replies —
                                    // except a click that landed on a real control.
                                    if (!replies.length) return;
                                    if ((e.target as HTMLElement).closest("button, textarea, a, input")) return;
                                    toggleThread(root._id);
                                }}
                            >
                                {renderAmendment(root, replies.length, false)}

                                {replies.length > 0 && !open && (
                                    <button
                                        type="button"
                                        onClick={() => toggleThread(root._id)}
                                        className="ml-[30px] mt-1.5 flex items-center gap-1 text-[11px] font-bold transition hover:opacity-80"
                                        style={{ color: railColor }}
                                    >
                                        <HiOutlineChevronDown className="h-3 w-3" />
                                        {replies.length} {replies.length === 1 ? "reply" : "replies"}
                                    </button>
                                )}

                                {replies.length > 0 && open && (
                                    <div
                                        className="ml-[15px] mt-3 space-y-3 border-l-2 pl-3.5"
                                        style={{ borderColor: railColor }}
                                    >
                                        {replies.map((reply) => renderAmendment(reply, 0, true))}
                                    </div>
                                )}

                                {replyTo === root._id && (
                                    <div
                                        className="ml-[15px] mt-3 space-y-2 border-l-2 pl-3.5"
                                        style={{ borderColor: railColor }}
                                    >
                                        <GrowingTextarea
                                            value={replyDraft}
                                            onChange={setReplyDraft}
                                            onSubmit={() => submitReply(root._id)}
                                            placeholder={`Reply to ${authorName(root)}`}
                                            autoFocus
                                            rows={1}
                                            mentionMembers={members}
                                            excludeUserId={currentUserId}
                                            onMention={addMention(setReplyMentions)}
                                        />
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={!replyDraft.trim() || posting}
                                                onClick={() => submitReply(root._id)}
                                                className="cursor-pointer rounded-md bg-foreground px-2.5 py-1 text-xs font-bold text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Reply
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReplyTo(null);
                                                    setReplyMentions([]);
                                                }}
                                                className="cursor-pointer text-xs font-semibold text-muted transition hover:text-foreground"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            );
                        })
                    )}
                </div>

                {/* Composer — one box owns the focus ring, send sits inside it */}
                <div className="shrink-0 border-t border-hairline bg-card px-3 py-3">
                    <div className="rounded-xl border border-hairline bg-control/40 transition focus-within:border-foreground focus-within:bg-card focus-within:ring-4 focus-within:ring-foreground/10">
                        <GrowingTextarea
                            value={draft}
                            onChange={setDraft}
                            onSubmit={submitDraft}
                            placeholder="Write an amendment… @ to mention someone"
                            bare
                            mentionMembers={members}
                            excludeUserId={currentUserId}
                            onMention={addMention(setDraftMentions)}
                            dropUp
                        />

                        <div className="flex items-center justify-between gap-2 px-2 pb-2">
                            <span className="pl-1 text-[10px] font-medium text-muted">
                                {isFetching && !isLoading ? "Refreshing…" : "Ctrl + Enter to post"}
                            </span>

                            <button
                                type="button"
                                disabled={!draft.trim() || posting}
                                onClick={submitDraft}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-bold text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {posting ? (
                                    <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <HiOutlinePaperAirplane className="h-3.5 w-3.5" />
                                )}
                                Post
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </div>,
        document.body
    );
}
