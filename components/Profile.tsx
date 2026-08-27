"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout as clearSession, AuthUser } from "@/lib/auth";
import ThemeButton from "./ui/buttons/themebutton";
import Link from "next/link";
import { profileLinks } from "@/data/data";
import { HiOutlineArrowRightOnRectangle, HiOutlineClipboard, HiCheck, HiChevronRight } from "react-icons/hi2";
import { TbHistory } from "react-icons/tb";
import ActivitySidebar, { openActivityDrawer } from "./ActivitySidebar";
import PresenceDot from "./ui/helpers/presenceDot";
import { PRESENCE_OPTIONS, presenceOption, UserStatus } from "@/lib/presence";
import { usePresence } from "@/store/usePresence";
import { useAppSelector } from "@/store/hooks";
import { selectActiveWorkspaceId } from "@/store/selectors/workspace.selectors";

import userAsset from "@/app/assets/user.png";

interface ProfileDropdownProps {
    open?: boolean;
    setOpen?: (open: boolean) => void;
    onLogout?: () => void;
    profileImage?: string;
    userName?: string;
    /**
     * Which way the menu opens. "top" is for a trigger that sits at the BOTTOM
     * of its container — Conexus Meet parks this in the foot of its sidebar,
     * where the default downward menu would render off the bottom of the
     * viewport. Parameterised rather than forked: there must stay exactly one
     * profile menu, or the log-out button starts differing between pages.
     */
    placement?: "top" | "bottom";
    /**
     * Draws the trigger as a full-width row with the name and email beside the
     * avatar, instead of a bare 32px circle. A sidebar foot has room to say who
     * you are signed in as, and a lone avatar there reads as decoration.
     */
    variant?: "avatar" | "bar";
}

export default function ProfileDropdown({
    open: externalOpen,
    setOpen: externalSetOpen,
    onLogout,
    profileImage,
    userName,
    placement = "bottom",
    variant = "avatar",
}: ProfileDropdownProps) {
    const router = useRouter();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // The feed is workspace-scoped; the Sidebar keeps this in sync.
    const workspaceId = useAppSelector(selectActiveWorkspaceId);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [internalOpen, setInternalOpen] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);

    // Also runs the heartbeat that keeps this user marked live — the dropdown is
    // mounted on every signed-in page, so presence needs no separate provider.
    const { setStatus, isSaving } = usePresence();

    const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = externalSetOpen || setInternalOpen;

    /**
     * The status picker is a sub-panel of the menu, never a state that outlives
     * it — so closing the menu folds it back, whichever path closed it.
     */
    const setMenuOpen = useCallback(
        (open: boolean) => {
            if (!open) setStatusOpen(false);
            setOpen(open);
        },
        [setOpen]
    );

    useEffect(() => {
        setUser(getUser());

        // updateUser() fires this after an avatar upload, so the trigger picture
        // changes without a reload.
        const onUserUpdated = (e: Event) =>
            setUser((e as CustomEvent<AuthUser>).detail);

        window.addEventListener("crm:user-updated", onUserUpdated);
        return () => window.removeEventListener("crm:user-updated", onUserUpdated);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [setMenuOpen]);

    /**
     * This dropdown is the only way out of the app, so it must work even when a
     * caller forgets to pass onLogout. The prop stays as an override.
     */
    const handleLogout = () => {
        setMenuOpen(false);

        if (onLogout) {
            onLogout();
            return;
        }

        clearSession();
        router.push("/login");
    };

    const handleCopyUid = async () => {
        const uid = user?.id;
        if (!uid) return;
        setCopying(true);
        try {
            await navigator.clipboard.writeText(uid);
            setCopying(false);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopying(false);
        }
    };

    // An explicit prop wins, then the user's uploaded picture; the bundled asset
    // stays as the fallback for anyone who has not uploaded one.
    const displayImage = profileImage || user?.avatar || userAsset.src;
    const displayName = userName || user?.firstName || "User";

    // Your own badge shows what you picked. Everyone else sees `presence`, which
    // the server downgrades to offline once your heartbeat goes stale.
    const myStatus: UserStatus = user?.status ?? "online";
    const myStatusOption = presenceOption(myStatus);

    const pickStatus = (status: UserStatus) => {
        setStatusOpen(false);
        setStatus(status);
    };

    return (
        <div className={`relative ${variant === "bar" ? "w-full" : ""}`} ref={dropdownRef}>
            {variant === "bar" ? (
                <button
                    onClick={() => setMenuOpen(!isOpen)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-control/60 cursor-pointer"
                >
                    <span className="relative shrink-0">
                        <img
                            src={displayImage}
                            alt={displayName}
                            className="h-9 w-9 rounded-full object-cover border-2 border-avatar-ring"
                        />
                        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5">
                            <PresenceDot status={myStatus} size={11} ringColor="var(--card)" />
                        </span>
                    </span>

                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                            {displayName}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                            {myStatusOption.label}
                        </span>
                    </span>

                    <HiChevronRight
                        className={`h-4 w-4 shrink-0 text-muted transition ${isOpen ? "-rotate-90" : "rotate-0"}`}
                    />
                </button>
            ) : (
                <>
                    <button
                        onClick={() => setMenuOpen(!isOpen)}
                        className="rounded-full overflow-hidden cursor-pointer w-8 h-8 mt-1 border-2 border-avatar-ring transition"
                    >
                        <img
                            src={displayImage}
                            alt={displayName}
                            className="w-full h-full rounded-full object-cover"
                        />
                    </button>

                    {/* Outside the button so the ring is not clipped by its overflow. */}
                    <span className="pointer-events-none absolute bottom-0 right-0 mb-0.5">
                        <PresenceDot status={myStatus} size={11} ringColor="var(--panel)" />
                    </span>
                </>
            )}

            {isOpen && (
                <div
                    className={`absolute w-96 max-w-[90vw] bg-card rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 ${placement === "top"
                        ? "bottom-full mb-3 left-0"
                        : "right-0 mt-3"
                        }`}
                >

                    <div className="py-2 border-b pl-5 flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 w-full">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold font-google-sans truncate text-slate-800">
                                    {displayName}
                                </h3>

                                <p className="text-xs text-gray-500 font-google-sans truncate">
                                    {user?.email}
                                </p>

                                {user?.id && (
                                    <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 font-google-sans">
                                        <span className="truncate max-w-[140px]" title={user.id}>
                                            ID: {user.id}
                                        </span>
                                        <button
                                            onClick={handleCopyUid}
                                            disabled={copying}
                                            title="Copy UID"
                                            className="p-1 rounded hover:bg-gray-100 text-gray-600 transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                                        >
                                            {copying ? (
                                                <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                            ) : copied ? (
                                                <HiCheck className="w-3.5 h-3.5 text-green-600" />
                                            ) : (
                                                <HiOutlineClipboard className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* Status. The list opens in place instead of as a nested
                        popover, so it can never land off-screen next to the
                        already right-aligned menu. */}
                    <div className="border-b border-gray-200 px-3 py-2 font-google-sans">
                        <button
                            onClick={() => setStatusOpen((value) => !value)}
                            disabled={isSaving}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 cursor-pointer disabled:opacity-60"
                        >
                            <PresenceDot status={myStatus} size={10} ring={0} />
                            <span className="flex-1 text-left text-sm text-slate-800">
                                {myStatusOption.label}
                            </span>
                            <HiChevronRight
                                className={`h-4 w-4 text-gray-400 transition ${statusOpen ? "rotate-90" : ""}`}
                            />
                        </button>

                        {statusOpen && (
                            <div className="mt-1 space-y-0.5">
                                {PRESENCE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => pickStatus(option.value)}
                                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition cursor-pointer ${option.value === myStatus ? "bg-gray-100" : "hover:bg-gray-50"}`}
                                    >
                                        <PresenceDot status={option.value} size={10} ring={0} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm text-slate-800">
                                                {option.label}
                                            </span>
                                            <span className="block text-xs text-gray-500">
                                                {option.hint}
                                            </span>
                                        </span>
                                        {option.value === myStatus && (
                                            <HiCheck className="h-4 w-4 shrink-0 text-green-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <main className="grid grid-cols-2">

                        <div className="flex flex-col px-3 py-2 font-google-sans text-sm ">
                            {profileLinks.map((link) => (
                                <Link
                                    href={link.url}
                                    key={link.id}
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition"
                                >
                                    {link.icon}
                                    <span>{link.name}</span>
                                </Link>
                            ))}
                        </div>

                        <div className="px-2 py-2">
                            <ThemeButton />
                        </div>

                    </main>

                    {/* Activity lives in its own drawer — the dropdown only
                        offers the way in, so opening the avatar menu never
                        fires a feed request. */}
                    <button
                        onClick={() => {
                            setMenuOpen(false);
                            openActivityDrawer();
                        }}
                        className="flex w-full items-center gap-2 border-t border-gray-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-gray-50 cursor-pointer font-google-sans"
                    >
                        <TbHistory size={17} className="text-slate-500" />
                        Activity log
                    </button>

                    {/* Log out — the app's only exit since the sidebar button was
                        removed, so it gets a labelled row rather than a bare icon. */}
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 border-t border-gray-200 px-5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 cursor-pointer font-google-sans"
                    >
                        <HiOutlineArrowRightOnRectangle size={17} />
                        Log out
                    </button>
                </div>
            )}

            {/* Rendered through a portal, so it stays mounted after the
                dropdown closes and is available wherever the avatar is. */}
            <ActivitySidebar workspaceId={workspaceId} />
        </div>
    );
}
