import Link from "next/link";
import Image from "next/image";
import logo from "@/app/assets/Logo.png";
import { ArrowRight } from "lucide-react";
import Button from "@/components/site/Button";
import { CONTACT, NAV_ROUTES, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * The public footer.
 *
 * It carries the same route list the navbar does (NAV_ROUTES) rather than a
 * second hand-written copy — a footer link that outlives the page it points at
 * is the classic way a marketing site starts serving 404s to crawlers.
 */

const productLinks = NAV_ROUTES.filter((r) => r.href !== "/contact");

const accountLinks = [
    { label: "Sign in", href: "/login" },
    { label: "Create an account", href: "/register" },
];

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-slate-200 bg-card">
            <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-10">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="lg:col-span-2">
                        <Link href="/" className="flex w-fit items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                <Image src={logo} alt="" aria-hidden />
                            </div>
                            <span className="flex items-center gap-0.5 font-google-sans font-bold text-foreground">
                                Conexus
                                <span className="brand-gradient-warm-text text-lg font-extrabold">X</span>
                            </span>
                        </Link>

                        <p className="mt-4 max-w-sm text-sm text-muted">{SITE_TAGLINE}. Workspaces, modules and records you shape yourself — with everyone seeing the same thing at the same time.</p>

                        <Button href="/register" className="mt-6">
                            Get started free
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </Button>
                    </div>

                    <nav aria-labelledby="footer-product">
                        <h2 id="footer-product" className="text-sm font-semibold text-foreground">
                            Product
                        </h2>
                        <ul className="mt-4 space-y-3">
                            {productLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-slate-600 transition-colors hover:text-foreground"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <nav aria-labelledby="footer-company">
                        <h2 id="footer-company" className="text-sm font-semibold text-foreground">
                            Company
                        </h2>
                        <ul className="mt-4 space-y-3">
                            <li>
                                <Link
                                    href="/contact"
                                    className="text-sm text-slate-600 transition-colors hover:text-foreground"
                                >
                                    Contact Us
                                </Link>
                            </li>
                            {accountLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-slate-600 transition-colors hover:text-foreground"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                            <li>
                                <a
                                    href={`mailto:${CONTACT.support}`}
                                    className="text-sm text-slate-600 transition-colors hover:text-foreground"
                                >
                                    {CONTACT.support}
                                </a>
                            </li>
                        </ul>
                    </nav>
                </div>

                <div className="mt-12 flex flex-col gap-2 border-t border-slate-100 pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        © {year} {SITE_NAME}. All rights reserved.
                    </p>
                    <p>Built for teams who would rather define their own structure.</p>
                </div>
            </div>
        </footer>
    );
}
