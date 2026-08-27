import env from "@/config/env";

/**
 * The public site's own facts, in one place.
 *
 * Every marketing page's <title>, canonical URL, sitemap entry and JSON-LD
 * block reads from here rather than restating the product name and the origin
 * per file — the failure mode of per-page SEO copy is that six pages end up
 * describing five different products.
 */

/** Absolute origin, no trailing slash. */
export const SITE_URL = (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "Conexus X";

export const SITE_TAGLINE = "The CRM your team shapes itself";

export const SITE_DESCRIPTION =
    "Conexus X is a collaborative CRM built from workspaces, modules and records you define yourself — with live updates, automations you can read as a sentence, and built-in chat and calls.";

/** Support and sales inboxes. Rendered as mailto: links, so they must be real. */
export const CONTACT = {
    support: "support@conexusx.com",
    sales: "sales@conexusx.com",
    press: "press@conexusx.com",
} as const;

/**
 * The public routes, in navigation order. Navbar, footer and sitemap all read
 * this list, so a page cannot be added to one and forgotten in the other two.
 */
export interface SiteRoute {
    label: string;
    href: string;
    /** Sitemap weighting — the home page is 1, everything else ranks under it. */
    priority: number;
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
}

export const SITE_ROUTES: SiteRoute[] = [
    { label: "Home", href: "/", priority: 1, changeFrequency: "weekly" },
    { label: "Pricing", href: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { label: "About Us", href: "/about", priority: 0.7, changeFrequency: "monthly" },
    { label: "Blog", href: "/blog", priority: 0.8, changeFrequency: "weekly" },
    { label: "Contact Us", href: "/contact", priority: 0.6, changeFrequency: "yearly" },
    { label: "FAQ", href: "/faq", priority: 0.7, changeFrequency: "monthly" },
];

/** The routes the navbar shows — the home link is the logo, not a nav item. */
export const NAV_ROUTES = SITE_ROUTES.filter((r) => r.href !== "/");

/**
 * Absolute URL for a path. Canonical links, og:url and JSON-LD @id are all
 * required to be absolute; a relative one is silently ignored by crawlers.
 */
export function absoluteUrl(path: string): string {
    return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The per-page metadata every public page exports. Canonical is always set:
 * without it, a page reachable at more than one URL (a trailing slash, a
 * tracking parameter) is indexed more than once and splits its own ranking.
 */
export function pageMetadata({
    title,
    description,
    path,
    type = "website",
    publishedTime,
}: {
    title: string;
    description: string;
    path: string;
    type?: "website" | "article";
    publishedTime?: string;
}) {
    const url = absoluteUrl(path);

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            title: `${title} · ${SITE_NAME}`,
            description,
            url,
            siteName: SITE_NAME,
            type,
            ...(publishedTime ? { publishedTime } : {}),
        },
        twitter: {
            card: "summary_large_image" as const,
            title: `${title} · ${SITE_NAME}`,
            description,
        },
    };
}
