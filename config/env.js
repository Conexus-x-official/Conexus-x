const env = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID_DEV: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID_DEV,
    // The site's OWN public origin, not the API's. Canonical URLs, sitemap
    // entries and og:image paths are all absolute by spec, so this is the one
    // value that cannot be derived from a relative path at build time.
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

export default env;
