import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { NOINDEX_PREFIXES } from "@/lib/authRoutes";

/**
 * The application routes are behind auth: a crawler reaching them gets a login
 * redirect, so every one of them would be indexed as the same empty page under
 * a different URL. Disallowing them keeps the public pages the only thing the
 * site is judged on.
 *
 * The list is NOT restated here. lib/authRoutes.ts owns it and proxy.ts guards
 * the same entries, so a new signed-in section cannot end up crawled by one
 * file and unguarded by the other.
 */

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [...NOINDEX_PREFIXES],
        },
        sitemap: absoluteUrl("/sitemap.xml"),
    };
}
