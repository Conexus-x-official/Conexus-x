import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/blog";
import { absoluteUrl, SITE_ROUTES } from "@/lib/site";

/**
 * Only PUBLIC pages belong here. The signed-in app (/Home, /workspace, …) is
 * behind auth and returns a login redirect to a crawler, so listing it would
 * point search engines at pages they can never index — see app/robots.ts, which
 * disallows the same set from the other direction.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const posts = getPosts();

    const pages = SITE_ROUTES.map((route) => ({
        url: absoluteUrl(route.href),
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
    }));

    const postPages = posts.map((post) => ({
        url: absoluteUrl(`/blog/${post.slug}`),
        // The post's own date, not now(): claiming every article changed today
        // is how a sitemap's lastModified stops being believed.
        lastModified: new Date(`${post.date}T00:00:00Z`),
        changeFrequency: "yearly" as const,
        priority: 0.6,
    }));

    return [...pages, ...postPages];
}
