"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    HiOutlineBellAlert,
    HiOutlineCheck,
    HiOutlineXMark,
    HiOutlineTrash,
    HiOutlineCheckCircle,
    HiOutlineAtSymbol,
    HiOutlineUserPlus,
} from "react-icons/hi2";

import UserSidebar from "@/components/userSidebar";
import { toast } from "@/components/ui/toast";
import { timeAgo, exactTime } from "@/lib/relativeTime";
import {
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useMarkAllNotificationsReadMutation,
    useDeleteNotificationMutation,
    useAcceptWorkspaceInviteMutation,
    useDeclineWorkspaceInviteMutation,
    type NotificationItem,
    type NotificationType,
} from "@/store/api/notifications.api";

/**
 * The account section's full notification center — reached from the account
 * nav (userSidebar.tsx "Notifications") and from the bell's "View All".
 *
 * Conexus Meet stays out of here on purpose: a new message or an incoming
 * call already has its own unread badge and its own screen (/Meet). This
 * page is everything ELSE that happens to you across workspaces — mentions
 * in amendments, and workspace invites you can accept or decline right from
 * the row. See backend/services/notification.service.ts for why the two are
 * kept apart rather than merged into one feed.
 */

type FilterTab = "all" | "unread" | "invite" | "mention";

const TABS: { value: FilterTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "invite", label: "Invites" },
    { value: "mention", label: "Mentions" },
];

const TYPE_ICON: Partial<Record<NotificationType, typeof HiOutlineBellAlert>> = {
    invite: HiOutlineUserPlus,
    mention: HiOutlineAtSymbol,
};

const PAGE_SIZE = 25;

export default function NotificationsManager() {
    const router = useRouter();
    const [tab, setTab] = useState<FilterTab>("all");
    const [limit, setLimit] = useState(PAGE_SIZE);

    const args =
        tab === "unread"
            ? { limit, isRead: false as const }
            : tab === "all"
                ? { limit }
                : { limit, type: tab };

    const { data: notifications = [], isFetching } = useGetNotificationsQuery(args);

    const [markRead] = useMarkNotificationReadMutation();
    const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
    const [deleteNotification] = useDeleteNotificationMutation();
    const [acceptInvite, { isLoading: accepting }] = useAcceptWorkspaceInviteMutation();
    const [declineInvite, { isLoading: declining }] = useDeclineWorkspaceInviteMutation();

    const busy = accepting || declining;

    const switchTab = (next: FilterTab) => {
        setTab(next);
        setLimit(PAGE_SIZE);
    };

    const handleAccept = async (item: NotificationItem) => {
        if (!item.workspace) return;
        try {
            await acceptInvite(item.workspace).unwrap();
            const workspaceName = String(item.metadata?.workspaceName ?? "the workspace");
            toast.success(`Joined ${workspaceName}`);
            router.push(`/workspace/${item.workspace}`);
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
            toast.info("Invitation declined");
        } catch (error) {
            toast.error(
                "Could not decline that invitation",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteNotification(id).unwrap();
        } catch (error) {
            toast.error(
                "Could not dismiss that notification",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    const anyUnread = notifications.some((n) => !n.isRead);

    return (
        <div className="min-h-screen bg-card">
            <div className="flex">
                <UserSidebar />

                <div className="min-w-0 flex-1 px-8 py-8 font-dmsans">
                    <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900">
                                Notifications
                            </h1>
                            <p className="mt-1 text-sm text-muted">
                                Mentions and workspace invites. Calls and messages live in{" "}
                                <button
                                    type="button"
                                    onClick={() => router.push("/Meet")}
                                    className="underline hover:text-slate-700 cursor-pointer"
                                >
                                    Conexus Meet
                                </button>
                                .
                            </p>
                        </div>

                        {anyUnread && (
                            <button
                                type="button"
                                onClick={() => markAllRead()}
                                disabled={markingAll}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-card px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-control disabled:opacity-50 cursor-pointer"
                            >
                                <HiOutlineCheckCircle className="h-3.5 w-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="w-full max-w-3xl">
                        <div
                            role="tablist"
                            className="mb-4 flex gap-1 rounded-xl bg-control p-1 w-fit"
                        >
                            {TABS.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === item.value}
                                    onClick={() => switchTab(item.value)}
                                    className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${tab === item.value
                                        ? "bg-card text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-hairline bg-card overflow-hidden">
                            {isFetching && notifications.length === 0 ? (
                                <div className="py-16 flex items-center justify-center text-sm text-muted">
                                    Loading…
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center">
                                    <HiOutlineBellAlert className="w-8 h-8 text-slate-300 mb-3" />
                                    <p className="text-sm text-muted">
                                        {tab === "all" ? "No notifications" : "Nothing here"}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-hairline">
                                    {notifications.map((item) => {
                                        const Icon = TYPE_ICON[item.type] ?? HiOutlineBellAlert;

                                        return (
                                            <div
                                                key={item._id}
                                                onClick={() => !item.isRead && markRead(item._id)}
                                                className={`flex gap-3 px-5 py-4 transition cursor-pointer hover:bg-control/40 ${item.isRead ? "" : "bg-blue-50/40"
                                                    }`}
                                            >
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-500">
                                                    <Icon className="h-4 w-4" />
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-slate-900">
                                                                {item.title}
                                                                {!item.isRead && (
                                                                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[#00CFFF] align-middle" />
                                                                )}
                                                            </p>
                                                            <p className="mt-1 text-sm text-slate-600">
                                                                {item.message}
                                                            </p>
                                                        </div>

                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <span
                                                                className="text-[11px] text-muted whitespace-nowrap"
                                                                title={exactTime(item.createdAt)}
                                                            >
                                                                {timeAgo(item.createdAt)}
                                                            </span>

                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleDelete(item._id);
                                                                }}
                                                                aria-label="Dismiss"
                                                                className="rounded-lg p-1.5 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                                                            >
                                                                <HiOutlineTrash className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {item.type === "invite" && item.workspace && (
                                                        <div className="flex items-center gap-2 mt-3">
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleAccept(item);
                                                                }}
                                                                disabled={busy}
                                                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
                                                            >
                                                                <HiOutlineCheck className="w-3.5 h-3.5" />
                                                                Accept &amp; join
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleDecline(item);
                                                                }}
                                                                disabled={busy}
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                                                            >
                                                                <HiOutlineXMark className="w-3.5 h-3.5" />
                                                                Decline
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {notifications.length >= limit && (
                            <div className="mt-4 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setLimit((n) => n + PAGE_SIZE)}
                                    disabled={isFetching}
                                    className="rounded-xl border border-slate-300 bg-card px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-control disabled:opacity-50 cursor-pointer"
                                >
                                    {isFetching ? "Loading…" : "Load more"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
