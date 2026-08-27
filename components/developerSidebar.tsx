"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { HiOutlineKey, HiOutlineCircleStack } from "react-icons/hi2";
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
 * The developer section's nav — the same sidebar as the app's and the account
 * section's, wearing a third list.
 *
 * Three panels doing one job had drifted into three designs: this one was a
 * fixed 288px column with `px-5 py-7`, its own `bg-accent` selection, its own
 * 28px `rounded-md` icon chips, and a chevron Back button above a `text-xl`
 * masthead. None of that was wrong on its own; it was just a different answer
 * to a question the app had already answered twice.
 *
 * What is shared now: the two widths, the brand block at identical offsets, the
 * collapse toggle in the same corner, the same spring and cross-fade, the
 * `NavTile` icon tiles, and `nav-glass` for the row you are on.
 *
 * THE BRAND BLOCK IS THE WAY OUT, exactly as in userSidebar.tsx — the logo was
 * already the biggest target here and already went somewhere, so a separate
 * chevron was a second exit competing with the obvious one. History first, so
 * you land on the page and scroll you left; `/Home` only when there is nothing
 * to go back to, where router.back() would do nothing or leave the app.
 *
 * DELIBERATELY NOT ADDED: a Preferences row. Those live in the ACCOUNT section
 * (/user/preferences) and are about the person; this section is about keys and
 * tools. Repeating the row here would make the same setting reachable from two
 * navs, which is how two navs start disagreeing about what they own.
 *
 * COLLAPSE SHARES `sidebarCollapsed` with the other two, for the reason written
 * out in userSidebar.tsx: "keep the nav out of my way" is one habit, not three.
 */

const FULL_WIDTH = 288;
const RAIL_WIDTH = 68;

const menu = [
    {
        title: "API Key",
        description: "Your global access key",
        icon: HiOutlineKey,
        href: "/developer/api-key",
    },
    {
        title: "Data Console",
        description: "Query your CRM data",
        icon: HiOutlineCircleStack,
        href: "/developer/data-console",
    },
];

export default function DeveloperSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const me = useSyncExternalStore(subscribeUser, readUser, readUserServer);
    const collapsed = me?.preferences?.sidebarCollapsed === true;

    const [updatePreferences] = useUpdatePreferencesMutation();

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

    /** History first, /Home as the fallback — see the note at the top. */
    const leaveSection = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }

        router.push("/Home");
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
                    {/* ── Brand + collapse toggle ───────────────────────── */}
                    <div className="px-3 pb-3 pt-4">
                        <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
                            {/* NOT wrapped in <Tooltip>: that helper wraps its
                                child in an inline-flex span, which would become
                                the flex child here and swallow the button's
                                flex-1 — the collapse toggle would slide in from
                                the right edge to sit against the wordmark. */}
                            <button
                                type="button"
                                onClick={leaveSection}
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

                        {/* One quiet label where a text-xl heading and a
                            sentence used to be. Two rows do not need a
                            masthead — it was most of the panel. */}
                        {!collapsed && (
                            <p className="px-2 pb-1 pt-1 text-sm font-medium text-slate-600">
                                Developer
                            </p>
                        )}

                        <div className={collapsed ? "flex flex-col items-center gap-1" : "space-y-px"}>
                            {menu.map((item) => {
                                const Icon = item.icon;
                                const active = pathname === item.href;

                                if (collapsed) {
                                    return (
                                        <Tooltip key={item.href} label={item.title} side="bottom">
                                            <Link
                                                href={item.href}
                                                aria-label={item.title}
                                                aria-current={active ? "page" : undefined}
                                                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${active
                                                    ? "nav-glass border-transparent text-foreground"
                                                    : "border-slate-300 bg-card text-slate-600 hover:bg-control/60 hover:text-slate-900"
                                                    }`}
                                            >
                                                <Icon className="h-[18px] w-[18px]" />
                                            </Link>
                                        </Tooltip>
                                    );
                                }

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={active ? "page" : undefined}
                                        className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition cursor-pointer ${active
                                            ? "nav-glass font-semibold text-foreground"
                                            : "font-medium text-slate-600 hover:bg-control/60 hover:text-slate-900"
                                            }`}
                                    >
                                        <NavTile>
                                            <Icon className="h-4 w-4" />
                                        </NavTile>

                                        {/* The description survives because these
                                            two rows are genuinely unfamiliar — an
                                            API key and a query console are not
                                            self-explanatory the way "Profile" is.
                                            It is muted and one line, so the names
                                            still read as one column. */}
                                        <span className="min-w-0">
                                            <span className="block truncate">{item.title}</span>
                                            <span className="block truncate text-[11px] font-normal text-muted">
                                                {item.description}
                                            </span>
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                </motion.div>
            </AnimatePresence>
        </motion.aside>
    );
}
