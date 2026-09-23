"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineEnvelope, HiOutlineShieldCheck, HiOutlineCalendar } from "react-icons/hi2";

import { PersonAvatar, memberName, type MemberLike } from "@/components/ui/helpers/personCell";
import PresenceDot from "@/components/ui/helpers/presenceDot";
import { presenceLabel } from "@/lib/presence";
import { roleColor, roleLabel, type MemberRole } from "@/lib/roles";
import { exactTime } from "@/lib/relativeTime";

/**
 * A person's profile — the card, and a trigger that opens it as a popover.
 *
 * Built for @mentions in RecordAmendmentsPanel but deliberately generic: the
 * card only reads what MemberLike + a few OPTIONAL workspace-membership
 * fields provide, so anywhere else that already has a Member/MemberUser in
 * hand (a member row, an assignee chip, a person cell) can reuse either half
 * — <UserProfileCard> alone to render the info inline, or <UserMention> to
 * get the same hover/click popover for free.
 */

/** Fixed across every theme, like PRESENCE_OPTIONS and MIRROR_TINT — a mention
 *  has to read the same way regardless of which accent colour is active. */
export const MENTION_COLOR = "#2563EB";

export interface ProfileCardMember extends MemberLike {
    role?: MemberRole;
    status?: "active" | "pending" | "inactive";
    joinedAt?: string;
}

/** The card's content alone — no positioning, no portal. */
export function UserProfileCard({ member }: { member: ProfileCardMember }) {
    const user = member.user ?? member;
    const name = memberName(member);
    const email = user?.email;
    const presence = user?.presence;

    return (
        <div className="w-64 p-4 font-dmsans">
            <div className="flex items-center gap-3">
                <PersonAvatar member={member} size={44} ring={false} />

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{name}</p>

                    {presence && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                            <PresenceDot status={presence} size={8} ring={0} />
                            <span className="text-[11px] text-muted">
                                {presenceLabel(presence)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {(email || member.role || member.joinedAt) && (
                <div className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                    {email && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <HiOutlineEnvelope className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <span className="truncate">{email}</span>
                        </div>
                    )}

                    {member.role && (
                        <div className="flex items-center gap-2 text-xs">
                            <HiOutlineShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <span
                                className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                                style={{
                                    color: roleColor(member.role),
                                    backgroundColor: `${roleColor(member.role)}1A`
                                }}
                            >
                                {roleLabel(member.role)}
                            </span>
                        </div>
                    )}

                    {member.joinedAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <HiOutlineCalendar className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <span>Joined {exactTime(member.joinedAt)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const CARD_WIDTH = 260;
/** Matches components/ui/helpers/tooltip.tsx's own hover delay. */
const HOVER_OPEN_DELAY_MS = 350;

/**
 * Wraps a piece of inline text (an "@Name" mention, a person's name anywhere
 * else) so hovering previews the profile card and clicking pins it open.
 * Portalled + anchor-rect positioned, the same pattern as BoardAccessMenu —
 * `fixed`, clamped to the viewport, escapes any clipped/scrolling ancestor.
 */
export function UserMention({
    member,
    children,
    className = ""
}: {
    member: ProfileCardMember;
    children: React.ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    const anchorRef = useRef<HTMLButtonElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const hoverTimer = useRef<number | null>(null);

    const clearHoverTimer = () => {
        if (hoverTimer.current !== null) {
            window.clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
    };

    const computePosition = () => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) return;

        setPosition({
            top: rect.bottom + 6,
            left: Math.max(12, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 12))
        });
    };

    const closeCard = () => {
        setOpen(false);
        setPinned(false);
    };

    const onMouseEnter = () => {
        clearHoverTimer();
        hoverTimer.current = window.setTimeout(() => {
            computePosition();
            setOpen(true);
        }, HOVER_OPEN_DELAY_MS);
    };

    const onMouseLeave = () => {
        clearHoverTimer();
        if (!pinned) closeCard();
    };

    const onClick = () => {
        clearHoverTimer();

        if (open && pinned) {
            closeCard();
            return;
        }

        computePosition();
        setPinned(true);
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target)) return;
            if (cardRef.current?.contains(target)) return;
            closeCard();
        };

        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeCard();
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useEffect(() => clearHoverTimer, []);

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
                className={`inline border-0 bg-transparent p-0 align-baseline font-semibold cursor-pointer hover:underline ${className}`}
                style={{ color: MENTION_COLOR }}
            >
                {children}
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={cardRef}
                        style={{ top: position.top, left: position.left, width: CARD_WIDTH }}
                        className="fixed z-50 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-xl animate-in fade-in zoom-in-95 duration-100"
                        onMouseEnter={clearHoverTimer}
                        onMouseLeave={() => {
                            if (!pinned) closeCard();
                        }}
                    >
                        <UserProfileCard member={member} />
                    </div>,
                    document.body
                )}
        </>
    );
}
