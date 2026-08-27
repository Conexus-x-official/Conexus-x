import Navbar from "@/components/Navbar";
import Footer from "@/components/site/Footer";
import JsonLd from "@/components/site/JsonLd";
import { absoluteUrl, CONTACT, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * The PUBLIC shell — navbar, page, footer.
 *
 * A route group, so the URLs are unchanged: /pricing stays /pricing. It exists
 * because the signed-in app has completely different chrome (sidebar, no
 * navbar), and a marketing page reached from the app must not inherit it.
 *
 * The Organization + WebSite graph is declared HERE rather than per page: it
 * describes the site, not the route, and repeating it on six pages is six
 * chances for the descriptions to drift apart. The SearchAction is deliberately
 * omitted — there is no public search endpoint, and claiming one in structured
 * data that returns nothing is worse than claiming nothing.
 */

const organizationJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            logo: {
                "@type": "ImageObject",
                url: absoluteUrl("/logo.png"),
                width: 1254,
                height: 1254,
            },
            contactPoint: [
                {
                    "@type": "ContactPoint",
                    contactType: "customer support",
                    email: CONTACT.support,
                    availableLanguage: ["English"],
                },
                {
                    "@type": "ContactPoint",
                    contactType: "sales",
                    email: CONTACT.sales,
                    availableLanguage: ["English"],
                },
            ],
        },
        {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            url: SITE_URL,
            name: SITE_NAME,
            description: SITE_DESCRIPTION,
            publisher: { "@id": `${SITE_URL}/#organization` },
            inLanguage: "en",
        },
    ],
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-full flex-col bg-panel">
            <Navbar />

            {/* The root layout already owns the <main> landmark, so this is a
                plain wrapper — two mains on one page is one too many. */}
            <div className="flex-1">{children}</div>

            <Footer />

            <JsonLd data={organizationJsonLd} />
        </div>
    );
}
