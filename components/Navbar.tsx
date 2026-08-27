"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logo from "@/app/assets/Logo.png";
import Image from "next/image";
import { ArrowRight, LayoutDashboard, Menu, X } from "lucide-react";
import { NAV_ROUTES } from "@/lib/site";
import { readUser, readUserServer, subscribeUser } from "@/lib/auth";
import Button from "@/components/site/Button";
import ThemeToggle from "@/components/site/ThemeToggle";
import SiteProfile from "@/components/site/SiteProfile";

// The nav, the footer and the sitemap all read ONE list (lib/site.ts), so a
// public page cannot be added to one of the three and forgotten in the others.
const navLinks = NAV_ROUTES;

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const pathname = usePathname();

    /**
     * Who is signed in, read straight from the store lib/auth.ts already
     * publishes. The SERVER snapshot is null and so is the first client render,
     * which is what keeps hydration honest: the signed-out navbar is what gets
     * sent, and the profile swaps in a beat later once localStorage is
     * readable. Anything else would need the user on the server, and there is
     * no server session to read them from.
     *
     * subscribeUser listens to crm:user-updated AND storage, so logging out —
     * here or in another tab — puts this back to Sign in / Register with no
     * reload.
     */
    const user = useSyncExternalStore(subscribeUser, readUser, readUserServer);

    // Prefix match, so /blog/<slug> keeps the Blog link marked. An exact match
    // would light nothing up on a post page, which reads as "you are nowhere".
    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    return (
        <nav className="relative z-50 flex w-full items-center justify-between gap-4 border-b border-slate-200 bg-card px-6 py-4 sm:px-10">
            <Link href="/" className="flex shrink-0 cursor-pointer items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <Image src={logo} alt="Conexus X Logo" priority />
                </div>

                <span className="flex items-center gap-0.5 font-google-sans font-bold text-foreground">
                    Conexus
                    <span className="brand-gradient-warm-text text-lg font-extrabold">X</span>
                </span>
            </Link>

            <div className="hidden items-center gap-8 md:flex">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        aria-current={isActive(link.href) ? "page" : undefined}
                        className={
                            isActive(link.href)
                                ? "cursor-pointer text-sm font-semibold text-foreground"
                                : "cursor-pointer text-sm font-medium text-slate-600 transition-colors hover:text-foreground"
                        }
                    >
                        {link.label}
                    </Link>
                ))}
            </div>

            <div className="hidden shrink-0 items-center gap-3 md:flex">
                <ThemeToggle />

                {user ? (
                    <>
                        {/*
                            Dashboard as the primary action once there IS an
                            account: "Register" to someone already registered is
                            an invitation to make a second one.
                        */}
                        <Button href="/Home">
                            <LayoutDashboard className="h-4 w-4" aria-hidden />
                            Dashboard
                        </Button>

                        <SiteProfile user={user} />
                    </>
                ) : (
                    <>
                        <Button href="/login" variant="ghost">
                            Sign in
                        </Button>
                        <Button href="/register">
                            Get started
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </Button>
                    </>
                )}
            </div>

            {/* ------------------------------------------------ mobile trigger */}
            <div className="flex shrink-0 items-center gap-2 md:hidden">
                <ThemeToggle />

                <button
                    type="button"
                    aria-label="Toggle menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-control hover:text-foreground"
                >
                    {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {menuOpen && (
                <div className="absolute left-0 right-0 top-full flex flex-col gap-4 border-b border-slate-200 bg-card px-6 py-5 shadow-lg md:hidden">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            aria-current={isActive(link.href) ? "page" : undefined}
                            className={
                                isActive(link.href)
                                    ? "cursor-pointer font-google-sans font-semibold text-foreground"
                                    : "cursor-pointer font-google-sans font-medium text-slate-600 transition-colors hover:text-foreground"
                            }
                        >
                            {link.label}
                        </Link>
                    ))}

                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                        {user ? (
                            <>
                                <div className="flex min-w-0 items-center gap-2.5">
                                    {user.avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={user.avatar}
                                            alt=""
                                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                                            {(user.firstName?.[0] ?? user.email[0] ?? "?").toUpperCase()}
                                        </span>
                                    )}
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-foreground">
                                            {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}
                                        </span>
                                        <span className="block truncate text-xs text-muted">{user.email}</span>
                                    </span>
                                </div>

                                <Button href="/Home" className="w-full" onNavigate={() => setMenuOpen(false)}>
                                    <LayoutDashboard className="h-4 w-4" aria-hidden />
                                    Dashboard
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    href="/register"
                                    className="w-full"
                                    onNavigate={() => setMenuOpen(false)}
                                >
                                    Get started
                                    <ArrowRight className="h-4 w-4" aria-hidden />
                                </Button>
                                <Button
                                    href="/login"
                                    variant="secondary"
                                    className="w-full"
                                    onNavigate={() => setMenuOpen(false)}
                                >
                                    Sign in
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}
