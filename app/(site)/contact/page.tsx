import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Headset, LifeBuoy, Newspaper } from "lucide-react";
import PageHeader from "@/components/site/PageHeader";
import ContactForm from "@/components/site/ContactForm";
import JsonLd from "@/components/site/JsonLd";
import { absoluteUrl, CONTACT, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "Contact Us",
    description:
        "Get in touch with the Conexus X team — product help, plans and billing, or press. We answer within one business day.",
    path: "/contact",
});

const channels = [
    {
        icon: LifeBuoy,
        title: "Product help",
        body: "Something not behaving the way you expected, or a question about how a feature works.",
        email: CONTACT.support,
        response: "Within 1 business day",
    },
    {
        icon: Headset,
        title: "Plans and billing",
        body: "Pricing for a larger team, an invoice question, or a security review before you buy.",
        email: CONTACT.sales,
        response: "Within 1 business day",
    },
    {
        icon: Newspaper,
        title: "Press and partnerships",
        body: "Writing about us, or building something you would like to connect to Conexus X.",
        email: CONTACT.press,
        response: "Within 3 business days",
    },
];

const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${SITE_NAME}`,
    url: absoluteUrl("/contact"),
    description: "Get in touch with the Conexus X team — product help, plans and billing, or press.",
    mainEntity: { "@id": `${SITE_URL}/#organization` },
};

export default function ContactPage() {
    return (
        <>
            <PageHeader
                eyebrow="Contact Us"
                title="Talk to the people who built it"
                lead="Support here is the same small team that writes the code, so an answer usually comes with the reasoning behind it. Pick the inbox that fits and we will come back within a business day."
            />

            <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10">
                <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,1.25fr)]">
                    {/* -------------------------------------------- channels */}
                    <section aria-labelledby="channels-heading">
                        <h2
                            id="channels-heading"
                            className="font-google-sans text-xl font-bold tracking-tight text-foreground"
                        >
                            Where to reach us
                        </h2>

                        <ul className="mt-6 space-y-4">
                            {channels.map((channel) => (
                                <li key={channel.title} className="rounded-xl border border-slate-200 bg-card p-6">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                                        <channel.icon className="h-5 w-5" aria-hidden />
                                    </div>
                                    <h3 className="mt-4 font-google-sans text-base font-semibold text-foreground">
                                        {channel.title}
                                    </h3>
                                    <p className="mt-2 text-sm text-muted">{channel.body}</p>
                                    <a
                                        href={`mailto:${channel.email}`}
                                        className="mt-3 inline-block break-words text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
                                    >
                                        {channel.email}
                                    </a>
                                    <p className="mt-1 text-xs text-muted">{channel.response}</p>
                                </li>
                            ))}

                            <li className="rounded-xl border border-dashed border-slate-300 bg-card/50 p-6">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                                    <BookOpen className="h-5 w-5" aria-hidden />
                                </div>
                                <h3 className="mt-4 font-google-sans text-base font-semibold text-foreground">
                                    Answer it yourself, faster
                                </h3>
                                <p className="mt-2 text-sm text-muted">
                                    Most first questions are already covered.
                                </p>
                                <Link
                                    href="/faq"
                                    className="mt-3 inline-block text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
                                >
                                    Read the FAQ →
                                </Link>
                            </li>
                        </ul>
                    </section>

                    {/* ------------------------------------------------- form */}
                    <section aria-labelledby="form-heading">
                        <h2 id="form-heading" className="font-google-sans text-xl font-bold tracking-tight text-foreground">
                            Send us a message
                        </h2>
                        <p className="mt-2 text-sm text-muted">
                            Fill this in and it opens a pre-addressed draft in your own email app — so you keep a copy of
                            what you sent.
                        </p>

                        <div className="mt-6">
                            <ContactForm />
                        </div>
                    </section>
                </div>
            </div>

            <JsonLd data={contactJsonLd} />
        </>
    );
}
