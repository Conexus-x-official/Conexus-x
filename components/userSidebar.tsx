"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
    HiOutlineUserCircle,
    HiOutlineShieldCheck,
    HiOutlineBell,
    HiOutlineCog6Tooth,
} from "react-icons/hi2";
import {
    TbLayoutSidebarLeftCollapse,
    TbLayoutSidebarLeftExpand,
} from "react-icons/tb";

import logo from "@/app/assets/Logo.png";
import NavTile from "@/components/ui/helpers/navTile";
import Tooltip from "@/components/ui/helpers/tooltip";
import { toast } from "@/components/ui/toast";
import { readUser, readUserServer, subscribeUser, updateUser } from "@/lib/auth";
import { useUpdatePreferencesMutation } from "@/store/api/preferences.api";

/**
 * The account section's own nav — now the SAME sidebar as the app's, wearing a
 * different list.
 *
 * It was a 288px column of `#0B1120` with `px-5 py-7` and `py-3` rows, so four
 * links filled a full-height panel and the account section looked like a
 * different product from the one you had just navigated out of. Everything
 * structural here is lifted from components/Sidebar.tsx on purpose: the same
 * two widths, the same brand block at the same offsets, the same collapse
 * toggle in the same corner, the same spring, the same cross-fade, the same
 * icon tiles and `nav-glass` selection.
 *
 * THE BRAND BLOCK IS THE WAY OUT. There is no separate Back button any more:
 * the logo and the name were already the biggest target in the panel and
 * already went somewhere, so a chevron under them was a second exit competing
 * with the obvious one. It always goes to `/Home` rather than router.back():
 * the account section is reached from all over the app, so "back" landed on
 * whatever page happened to be open before, not a place the user would call
 * "back to where I was" — /Home is the one exit that is always right.
 *
 * COLLAPSE SHARES ONE PREFERENCE with the main sidebar (`sidebarCollapsed`).
 * "I want the nav out of my way" is one habit, not two — a person who runs the
 * app collapsed and then finds the account section expanded has been given a
 * setting they never asked for. It also means no new field: the toggle here is
 * the toggle there, optimistic through updateUser() and durable through the
 * same PATCH.
 */

const FULL_WIDTH = 288;
const RAIL_WIDTH = 68;

const menu = [
    { title: "Profile", icon: HiOutlineUserCircle, href: "/user/menage-profile" },
    { title: "Security", icon: HiOutlineShieldCheck, href: "/user/security" },
    { title: "Notifications", icon: HiOutlineBell, href: "/user/notifications" },
    { title: "Preferences", icon: HiOutlineCog6Tooth, href: "/user/preferences" },
];

export default function UserSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const me = useSyncExternalStore(subscribeUser, readUser, readUserServer);
    const collapsed = me?.preferences?.sidebarCollapsed === true;

    const [updatePreferences] = useUpdatePreferencesMutation();

    /** Always /Home — see the note at the top. */
    const leaveAccount = () => {
        router.push("/Home");
    };

    /** Optimistic, then durable — the main sidebar's toggle, verbatim. */
    const toggleCollapsed = async () => {
        const next = !collapsed;

        updateUser({ preferences: { ...me?.preferences, sidebarCollapsed: next } });

        try {
            await updatePreferences({ sidebarCollapsed: next }).unwrap();
        } catch (error) {
            updateUser({ preferences: { ...me?.preferences, sidebarCollapsed: collapsed } });
            toast.error(
                "Could not save your sidebar preference",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? RAIL_WIDTH : FULL_WIDTH }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="relative sticky top-0 h-screen shrink-0 overflow-hidden border-r border-hairline bg-card font-google-sans"
        >
            <AnimatePresence initial={false}>
                <motion.div
                    key={collapsed ? "rail" : "full"}
                    style={{ width: collapsed ? RAIL_WIDTH : FULL_WIDTH }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 flex flex-col"
                >
                    {/* ── Brand + collapse toggle ─────────────────────────
                         Identical geometry to the main sidebar, so the tile does
                         not move by a pixel when you navigate in or out of the
                         account section. */}
                    <div className="px-3 pb-3 pt-4">
                        <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
                            {/* NOT wrapped in <Tooltip>: that helper wraps its
                                child in an inline-flex span, which would become
                                the flex child here and swallow the button's
                                flex-1 — the collapse toggle would slide in from
                                the right edge to sit against the wordmark. The
                                subtitle already says what the click does. */}
                                <button
                                    type="button"
                                    onClick={leaveAccount}
                                    title="Back to where you were"
                                    aria-label="Back"
                                    className={`group flex h-11 items-center rounded-xl text-left transition cursor-pointer ${collapsed ? "w-11 justify-center" : "flex-1 gap-2.5 pr-2"
                                        }`}
                                >
                                    <NavTile className="h-11 w-11 rounded-xl">
                                        <Image
                                            src={logo}
                                            alt="Logo"
                                            priority
                                            className="h-8 w-8 object-contain"
                                        />
                                    </NavTile>

                                    {!collapsed && (
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-0.5 text-[15px] font-bold leading-none tracking-tight text-slate-900">
                                                Conexus
                                                <span className="brand-gradient-warm-text text-lg font-extrabold">
                                                    X
                                                </span>
                                            </span>
                                            {/* The tagline, identical to the
                                                main sidebar's. It was briefly
                                                "Back to the app" with a chevron,
                                                which turned the brand block into
                                                a labelled button — the one place
                                                in the app whose wordmark said
                                                something different. What the
                                                click does is carried by the
                                                tooltip; the block itself should
                                                read the same everywhere. */}
                                            <span className="mt-0.5 block truncate text-[11px] font-medium text-muted">
                                                Modern CRM for agile teams
                                            </span>
                                        </span>
                                    )}
                                </button>

                            <button
                                type="button"
                                onClick={toggleCollapsed}
                                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                                aria-expanded={!collapsed}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                            >
                                {collapsed ? (
                                    <TbLayoutSidebarLeftExpand className="h-[18px] w-[18px]" />
                                ) : (
                                    <TbLayoutSidebarLeftCollapse className="h-[18px] w-[18px]" />
                                )}
                            </button>
                        </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">

                        {/* One quiet label, not a 20px page heading with a
                            sentence under it. The section has four rows; a
                            masthead over them was most of the panel. */}
                        {!collapsed && (
                            <p className="px-2 pb-1 pt-1 text-sm font-medium text-slate-600">
                                Account
                            </p>
                        )}

                        <div className={collapsed ? "flex flex-col items-center gap-1" : "space-y-px"}>
                            {menu.map((item) => {
                                const Icon = item.icon;
                                const active = pathname === item.href;

                                if (collapsed) {
                                    return (
                                        <Tooltip key={item.href} label={item.title} side="bottom">
                                            <button
                                                type="button"
                                                onClick={() => router.push(item.href)}
                                                aria-label={item.title}
                                                aria-current={active ? "page" : undefined}
                                                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${active
                                                    ? "nav-glass border-transparent text-foreground"
                                                    : "border-slate-300 bg-card text-slate-600 hover:bg-control/60 hover:text-slate-900"
                                                    }`}
                                            >
                                                <Icon className="h-[18px] w-[18px]" />
                                            </button>
                                        </Tooltip>
                                    );
                                }

                                return (
                                    <button
                                        key={item.href}
                                        type="button"
                                        onClick={() => router.push(item.href)}
                                        aria-current={active ? "page" : undefined}
                                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition cursor-pointer ${active
                                            ? "nav-glass font-semibold text-foreground"
                                            : "font-medium text-slate-600 hover:bg-control/60 hover:text-slate-900"
                                            }`}
                                    >
                                        <NavTile>
                                            <Icon className="h-4 w-4" />
                                        </NavTile>
                                        {item.title}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>
                </motion.div>
            </AnimatePresence>
        </motion.aside>
    );
}
