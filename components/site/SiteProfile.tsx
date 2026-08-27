"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Settings, ChevronDown } from "lucide-react";
import { logout, type AuthUser } from "@/lib/auth";

/**
 * The signed-in user, on the PUBLIC site.
 *
 * Deliberately NOT components/Profile.tsx. That one is the application's
 * profile menu and carries presence, the copy-user-id control and the theme
 * picker — an app surface, opened by someone already at work. On the marketing
 * site the same menu would offer settings for a product the visitor may not
 * have opened yet.
 *
 * NO THEME CONTROL HERE, on purpose: the theme lives on its own toggle in the
 * navbar (components/site/ThemeToggle.tsx) where it is one visible press
 * instead of two clicks inside a menu. Two ways to change one setting is how
 * they drift into disagreeing about what is selected.
 */
export default function SiteProfile({ user }: { user: AuthUser }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const initials = (user.firstName?.[0] ?? user.email[0] ?? "?").toUpperCase();

    useEffect(() => {
        if (!open) return;

        const onDown = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        // mousedown, not click: a click listener fires after the target's own
        // handler, so opening the menu would immediately close it again.
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const signOut = () => {
        // Clears localStorage AND the routing cookie, then raises
        // crm:user-updated so this component and the navbar re-read at once.
        logout();
        setOpen(false);

        // refresh() as well as push(): the proxy decides on the COOKIE, and a
        // client-side navigation would otherwise reuse a cached RSC payload
        // rendered while the session still existed.
        router.push("/");
        router.refresh();
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-card py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-control"
            >
                {user.avatar ? (
                    // A plain <img>: avatars are remote Cloudinary URLs and this
                    // matches how Profile.tsx and ActivityFeed already render them.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={user.avatar}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                        {initials}
                    </span>
                )}

                <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-slate-700 sm:block">
                    {user.firstName || user.email}
                </span>

                <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden
                />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-lg"
                >
                    <div className="border-b border-slate-100 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>

                    <div className="p-1.5">
                        <Link
                            href="/Home"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-control"
                        >
                            <LayoutDashboard className="h-4 w-4 text-muted" aria-hidden />
                            Dashboard
                        </Link>

                        <Link
                            href="/user/menage-profile"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-control"
                        >
                            <Settings className="h-4 w-4 text-muted" aria-hidden />
                            Manage profile
                        </Link>
                    </div>

                    <div className="border-t border-slate-100 p-1.5">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={signOut}
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                            <LogOut className="h-4 w-4" aria-hidden />
                            Log out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
