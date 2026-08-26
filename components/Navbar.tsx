"use client";

import { useState } from "react";
import Link from "next/link";
import logo from "@/app/assets/Logo.png";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const navLinks = [
    { label: "Pricing", href: "/pricing" },
    { label: "About Us", href: "/about" },
    { label: "Contact Us", href: "/contact" },
    { label: "FAQ", href: "/faq" },
];

const actionLinks = [
    { label: "Sign In", href: "/login", type: "secondary" },
    { label: "Register", href: "/register", type: "primary" },
];

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav className="relative z-50 flex w-full items-center justify-between border-b border-slate-200 bg-card px-6 py-4 sm:px-10">
            <Link
                href="/"
                className="flex cursor-pointer items-center gap-3"
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <Image
                        src={logo}
                        alt="Conexus X Logo"
                        priority
                    />
                </div>

                <span className="flex items-center gap-0.5 font-google-sans font-bold text-foreground">
                    Conexus
                    <span className="brand-gradient-warm-text text-lg font-extrabold">
                        X
                    </span>
                </span>
            </Link>

            <div className="hidden items-center gap-8 md:flex">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="cursor-pointer text-sm font-medium text-slate-600 transition-colors hover:text-foreground"
                    >
                        {link.label}
                    </Link>
                ))}
            </div>

            <div className="hidden items-center gap-3 md:flex">
                {actionLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={
                            link.type === "primary"
                                ? "cursor-pointer rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff5252]"
                                : "cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:text-foreground"
                        }
                    >
                        {link.label}
                    </Link>
                ))}
            </div>

            <button
                type="button"
                aria-label="Toggle menu"
                onClick={() => setMenuOpen(!menuOpen)}
                className="cursor-pointer text-slate-700 transition-colors hover:text-foreground md:hidden"
            >
                {menuOpen ? (
                    <X className="h-6 w-6" />
                ) : (
                    <Menu className="h-6 w-6" />
                )}
            </button>

            {menuOpen && (
                <div className="absolute left-0 right-0 top-full flex flex-col gap-4 border-b border-slate-200 bg-card px-6 py-5 shadow-lg md:hidden">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            className="cursor-pointer font-google-sans font-medium text-slate-600 transition-colors hover:text-foreground"
                        >
                            {link.label}
                        </Link>
                    ))}

                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                        {actionLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMenuOpen(false)}
                                className={
                                    link.type === "primary"
                                        ? "w-fit cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white font-google-sans transition-colors hover:bg-[#ff5252]"
                                        : "cursor-pointer text-sm font-semibold text-slate-700 font-google-sans transition-colors hover:text-foreground"
                                }
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
}