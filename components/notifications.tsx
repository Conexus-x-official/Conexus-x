"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { HiOutlineBellAlert, HiOutlineCheck, HiOutlineXMark } from "react-icons/hi2";
import { timeAgo } from "@/lib/relativeTime";
import {
    useGetNotificationsQuery,
    useGetUnreadCountQuery,
    useMarkNotificationReadMutation,
    useAcceptWorkspaceInviteMutation,
    useDeclineWorkspaceInviteMutation,
    type NotificationItem
} from "@/store/api/notifications.api";
import { toast } from "@/components/ui/toast";

const DROPDOWN_LIMIT = 8;
const PANEL_WIDTH = 320;

/**
 * The bell. Self-contained on purpose — it used to take `notifications` and
 * `onViewAll` as props and every caller had to wire mock data and a route by
 * hand; now it owns its own fetch, its own open state, and always sends
 * "View all" to /user/notifications, the one real notification center.
 *
 * PORTALLED to document.body, same pattern as BoardAccessMenu — an anchored
 * `fixed` panel rather than an `absolute` one sitting inside the header's own
 * stacking context. It used to be the latter, and a sticky table header
 * elsewhere on the page (also z-10, but its OWN stacking context via
 * `position: sticky`) painted on top of it — the panel looked fine until a
 * scrollable table sat behind it, at which point that table's column headers
 * showed straight through. Portalling to <body> and living at a high z-index
 * makes "what else is on this page" irrelevant.
 *
 * Conexus Meet unread counts are NOT part of this — see
 * backend/services/notification.service.ts for why the two stay separate.
 */
export default function NotificationDropdown() {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    const anchorRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const { data: notifications = [], isLoading } = useGetNotificationsQuery(
        { limit: DROPDOWN_LIMIT },
        { skip: !open, refetchOnMountOrArgChange: true }
    );
    const { data: unreadCount = 0 } = useGetUnreadCountQuery();

    const [markRead] = useMarkNotificationReadMutation();
    const [acceptInvite, { isLoading: accepting }] = useAcceptWorkspaceInviteMutation();
    const [declineInvite, { isLoading: declining }] = useDeclineWorkspaceInviteMutation();

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setOpen(false);
        };

        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const toggleOpen = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: Math.max(
                    12,
                    Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 12)
                )
            });
        }

        setOpen((value) => !value);
    };

    const handleOpenItem = (item: NotificationItem) => {
        if (!item.isRead) markRead(item._id);
    };

    const handleAccept = async (item: NotificationItem) => {
        if (!item.workspace) return;
        try {
            await acceptInvite(item.workspace).unwrap();
            toast.success("Joined the workspace");
            router.push(`/workspace/${item.workspace}`);
            setOpen(false);
        } catch (error) {
            toast.error(
                "Could not accept that invitation",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const handleDecline = async (item: NotificationItem) => {
        if (!item.workspace) return;
        try {
            await declineInvite(item.workspace).unwrap();
        } catch (error) {
            toast.error(
                "Could not decline that invitation",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onClick={toggleOpen}
                aria-haspopup="true"
                aria-expanded={open}
                className="relative bg-card w-9.5 h-9.5 flex items-center justify-center rounded-xl cursor-pointer hover:bg-gray-100 transition"
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M13 42C16.5 37.5 18 33 18 27V23C18 15.3 24.3 9 32 9C39.7 9 46 15.3 46 23V27C46 33 47.5 37.5 51 42C52.5 44 51 47 48.5 47H15.5C13 47 11.5 44 13 42Z"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    <path
                        d="M25 52C26.3 55.5 28.7 57 32 57C35.3 57 37.7 55.5 39 52"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                </svg>

                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#8B0E0E] text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={panelRef}
                        style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
                        className="fixed z-50 bg-card rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.10)] border border-gray-200 overflow-hidden font-dmsans"
                        role="dialog"
                        aria-label="Notifications"
                    >
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-sm text-gray-800 font-google-sans">
                                Notifications
                            </h2>

                            {unreadCount > 0 && (
                                <span className="text-[11px] text-gray-400">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {isLoading ? (
                                <div className="py-10 flex items-center justify-center text-sm text-gray-400">
                                    Loading…
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="py-10 flex flex-col items-center justify-center">
                                    <HiOutlineBellAlert className="w-8 h-8 text-gray-300 mb-3" />
                                    <p className="text-sm text-gray-500">No notifications</p>
                                </div>
                            ) : (
                                notifications.map((item) => (
                                    <div
                                        key={item._id}
                                        onClick={() => handleOpenItem(item)}
                                        className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                                    >
                                        <div className="flex gap-3">
                                            <div className="pt-1.5">
                                                <span
                                                    className={`block w-2 h-2 rounded-full ${item.isRead ? "bg-gray-200" : "bg-[#00CFFF]"
                                                        }`}
                                                />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-medium text-sm text-gray-900 truncate">
                                                        {item.title}
                                                    </p>

                                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                        {timeAgo(item.createdAt)}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-gray-500 mt-1 leading-5 line-clamp-2">
                                                    {item.message}
                                                </p>

                                                {item.type === "invite" && item.workspace && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleAccept(item);
                                                            }}
                                                            disabled={accepting || declining}
                                                            className="inline-flex items-center gap-1 rounded-lg bg-[#0D1B2A] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#16283d] disabled:opacity-50 transition cursor-pointer"
                                                        >
                                                            <HiOutlineCheck className="w-3 h-3" />
                                                            Accept
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleDecline(item);
                                                            }}
                                                            disabled={accepting || declining}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition cursor-pointer"
                                                        >
                                                            <HiOutlineXMark className="w-3 h-3" />
                                                            Decline
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                            <button
                                onClick={() => {
                                    setOpen(false);
                                    router.push("/user/notifications");
                                }}
                                className="w-full py-2 rounded-xl bg-[#0D1B2A] text-white text-xs font-medium hover:bg-[#16283d] transition cursor-pointer"
                            >
                                View All
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
