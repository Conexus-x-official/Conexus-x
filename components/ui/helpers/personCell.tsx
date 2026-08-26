"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineUserPlus, HiOutlineMagnifyingGlass, HiCheck, HiOutlineXMark } from "react-icons/hi2";
import { useGetMembersQuery } from "@/store/api/members.api";
import PresenceDot from "./presenceDot";
import type { Column, Member, MemberUser, RecordItem, RecordValue } from "@/store/types";

/** A member row, a raw user, or either shape wrapped in `{ user }`. */
type PersonLike = Partial<MemberUser> & { avatar?: string; profileImage?: string };
export type MemberLike = PersonLike & { user?: PersonLike };

// Avatar tints come from the id so a person keeps the same colour everywhere on
// the board without the server having to store one.
const AVATAR_TINTS = [
    "#6A00FF", "#00B894", "#FF6B6B", "#4D96FF",
    "#F368C4", "#FF9F43", "#20BF6B", "#E8590C",
];

function tintFor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export function memberName(member: MemberLike) {
    const user = member?.user ?? member;
    const full = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    return full || user?.email || "Member";
}

export function memberUserId(member: MemberLike) {
    const user = member?.user ?? member;
    return String(user?._id ?? member?._id ?? "");
}

function initialsOf(name: string) {
    return (
        name
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "M"
    );
}

/** Cells store the assignment as a JSON id array; older plain strings still read. */
export function parsePeopleValue(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw !== "string") return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        return parsed ? [String(parsed)] : [];
    } catch {
        return raw.trim() ? [raw.trim()] : [];
    }
}

export function PersonAvatar({
    member,
    size = 26,
    ring = true,
    showPresence = false,
}: {
    member: MemberLike;
    size?: number;
    ring?: boolean;
    /** Off by default — only the rosters that need it pay for the extra badge. */
    showPresence?: boolean;
}) {
    const user = member?.user ?? member;
    const name = memberName(member);
    const src = user?.avatar || user?.profileImage;
    const presence = showPresence ? user?.presence : undefined;

    const avatar = (
        <span
            title={name}
            className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${ring ? "ring-2 ring-card" : ""}`}
            style={{
                width: size,
                height: size,
                backgroundColor: src ? "transparent" : tintFor(memberUserId(member) || name),
            }}
        >
            {src ? (
                <img src={src} alt={name} className="h-full w-full object-cover" />
            ) : (
                <span
                    className="font-dmsans font-semibold text-white leading-none"
                    style={{ fontSize: Math.max(9, Math.round(size * 0.38)) }}
                >
                    {initialsOf(name)}
                </span>
            )}
        </span>
    );

    if (!presence) return avatar;

    // The badge sits outside the avatar span, which clips its children.
    return (
        <span className="relative inline-flex shrink-0">
            {avatar}
            <span className="pointer-events-none absolute -bottom-px -right-px">
                <PresenceDot
                    status={presence}
                    size={Math.max(8, Math.round(size * 0.34))}
                    ring={size >= 24 ? 2 : 1.5}
                />
            </span>
        </span>
    );
}

interface PersonCellProps {
    record: RecordItem;
    column: Column;
    recordValue?: RecordValue;
    width: number | string;
    workspaceId: string;
    onSave: (record: RecordItem, column: Column, value: string, recordValue?: RecordValue) => void;
}

export default function PersonCell({
    record,
    column,
    recordValue,
    width,
    workspaceId,
    onSave,
}: PersonCellProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    const anchorRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // One shared cache entry per workspace — every person cell reads the same one.
    const { data: members = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });
    const roster = members as Member[];

    const selectedIds = useMemo(() => parsePeopleValue(recordValue?.value), [recordValue?.value]);

    const selectedMembers = useMemo(
        () =>
            selectedIds
                .map((id) => roster.find((m) => memberUserId(m) === id))
                .filter(Boolean) as Member[],
        [selectedIds, roster]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = q
            ? roster.filter((m) => {
                const email = (m.user ?? m).email ?? "";
                return (
                    memberName(m).toLowerCase().includes(q) ||
                    email.toLowerCase().includes(q)
                );
            })
            : roster;
        // Assigned people are pinned to the top of the list.
        return [...list].sort(
            (a, b) =>
                Number(selectedIds.includes(memberUserId(b))) -
                Number(selectedIds.includes(memberUserId(a)))
        );
    }, [roster, query, selectedIds]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (anchorRef.current?.contains(t)) return;
            if (panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const commit = (ids: string[]) => {
        onSave(record, column, ids.length ? JSON.stringify(ids) : "", recordValue);
    };

    const togglePerson = (id: string) => {
        commit(
            selectedIds.includes(id)
                ? selectedIds.filter((x) => x !== id)
                : [...selectedIds, id]
        );
    };

    const openPanel = () => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const PANEL_W = 264;
            const left = Math.min(rect.left, window.innerWidth - PANEL_W - 12);
            setPos({ top: rect.bottom + 6, left: Math.max(12, left) });
        }
        setQuery("");
        setOpen((v) => !v);
    };

    const MAX_VISIBLE = 3;
    const visible = selectedMembers.slice(0, MAX_VISIBLE);
    const overflow = selectedMembers.length - visible.length;

    return (
        <div
            ref={anchorRef}
            className="shrink-0 h-10 border-r border-slate-300 flex items-center justify-center px-2 font-dmsans"
            style={{ width }}
        >
            <button
                type="button"
                onClick={openPanel}
                className="group/people flex h-full w-full items-center justify-center gap-1 cursor-pointer bg-transparent border-none outline-none"
                title={selectedMembers.length ? selectedMembers.map(memberName).join(", ") : "Assign people"}
            >
                {selectedMembers.length > 0 && (
                    <span className="flex items-center -space-x-2">
                        {visible.map((m) => (
                            <PersonAvatar key={memberUserId(m)} member={m} showPresence />
                        ))}
                        {overflow > 0 && (
                            <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-control text-[10px] font-semibold text-muted ring-2 ring-card">
                                +{overflow}
                            </span>
                        )}
                    </span>
                )}

                <span
                    className={`inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-dashed border-slate-400 text-muted transition group-hover/people:border-accent group-hover/people:text-accent ${selectedMembers.length ? "opacity-0 group-hover/people:opacity-100 ml-1" : "opacity-100"}`}
                >
                    <HiOutlineUserPlus size={14} />
                </span>
            </button>

            {open && pos && createPortal(
                <div
                    ref={panelRef}
                    className="fixed z-50 rounded-xl border border-slate-300 bg-card shadow-2xl font-dmsans overflow-hidden"
                    style={{ top: pos.top, left: pos.left, width: 264 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-2 border-b border-slate-200 px-2.5 py-2">
                        <HiOutlineMagnifyingGlass size={14} className="shrink-0 text-muted" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search workspace people"
                            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
                        />
                    </div>

                    {selectedMembers.length > 0 && (
                        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-2.5 py-2">
                            {selectedMembers.map((m) => (
                                <span
                                    key={memberUserId(m)}
                                    className="inline-flex items-center gap-1 rounded-full bg-control py-0.5 pl-0.5 pr-1.5 text-[11px] text-foreground"
                                >
                                    <PersonAvatar member={m} size={18} ring={false} />
                                    <span className="max-w-[90px] truncate">{memberName(m)}</span>
                                    <button
                                        type="button"
                                        onClick={() => togglePerson(memberUserId(m))}
                                        className="text-muted hover:text-accent cursor-pointer"
                                        title="Remove"
                                    >
                                        <HiOutlineXMark size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="max-h-56 overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <p className="px-3 py-4 text-center text-[11px] text-muted">
                                No people in this workspace yet.
                            </p>
                        )}
                        {filtered.map((m) => {
                            const id = memberUserId(m);
                            const user = m.user ?? m;
                            const isSelected = selectedIds.includes(id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => togglePerson(id)}
                                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition cursor-pointer ${isSelected ? "bg-control/60" : "hover:bg-control/40"}`}
                                >
                                    <PersonAvatar member={m} size={26} ring={false} showPresence />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-medium text-foreground">
                                            {memberName(m)}
                                        </span>
                                        <span className="block truncate text-[10px] text-muted">
                                            {user?.email}
                                        </span>
                                    </span>
                                    {isSelected && <HiCheck size={15} className="shrink-0 text-accent" />}
                                </button>
                            );
                        })}
                    </div>

                    {selectedMembers.length > 0 && (
                        <button
                            type="button"
                            onClick={() => commit([])}
                            className="w-full border-t border-slate-200 py-1.5 text-[11px] font-medium text-muted transition hover:text-accent cursor-pointer"
                        >
                            Clear all
                        </button>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
