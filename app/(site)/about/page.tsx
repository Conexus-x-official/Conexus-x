import type { Metadata } from "next";
import { ArrowRight, Compass, Gauge, Layers, Users } from "lucide-react";
import Button from "@/components/site/Button";
import PageHeader from "@/components/site/PageHeader";
import CtaBand from "@/components/site/CtaBand";
import JsonLd from "@/components/site/JsonLd";
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "About Us",
    description:
        "Conexus X is built by a small team who think a CRM should take the shape of your business, not the other way round. Here is what we believe and how we build.",
    path: "/about",
});

const principles = [
    {
        icon: Layers,
        title: "Structure before features",
        body: "The first question is not what a tool can do, it is what it thinks your work is made of. We got the nouns right — workspace, module, collection, record, column — and everything else follows from them.",
    },
    {
        icon: Compass,
        title: "Say what actually happened",
        body: "A failed save raises a message with the server's own words in it, not a spinner that stops. An automated change is attributed to the automation, not to the person whose edit set it off.",
    },
    {
        icon: Gauge,
        title: "Fast is a feature, not a metric",
        body: "Edits apply instantly and reconcile with the server behind them. Changes are pushed rather than polled, so what you see is what your colleague sees.",
    },
    {
        icon: Users,
        title: "Small enough to answer you",
        body: "Support is the people who wrote the code. That is a real constraint on how much we build, and it is why we remove things as readily as we add them.",
    },
];

const timeline = [
    {
        period: "The problem",
        body: "Every team we spoke to had bent a general-purpose CRM into a shape it resisted — custom fields with names nobody remembered, reports that quietly counted the wrong thing, and a pipeline inherited from a demo.",
    },
    {
        period: "The bet",
        body: "That teams do not need more features; they need the freedom to describe their own work and then have the tool hold that description firmly. Typed columns instead of free text, one clear hierarchy instead of infinite nesting.",
    },
    {
        period: "Today",
        body: "Conexus X runs modules, automations, real-time collaboration, chat and calls in one place — with the structure still defined entirely by the people using it.",
    },
];

const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${SITE_NAME}`,
    url: absoluteUrl("/about"),
    description:
        "Conexus X is built by a small team who think a CRM should take the shape of your business, not the other way round.",
    mainEntity: { "@id": `${SITE_URL}/#organization` },
};

export default function AboutPage() {
    return (
        <>
            <PageHeader
                eyebrow="About Us"
                title="We build the CRM we wanted to use"
                lead="Conexus X came out of watching capable teams spend their first month translating how they work into someone else's vocabulary. We thought the vocabulary should be theirs."
            />

            {/* ---------------------------------------------------------- story */}
            <section aria-labelledby="story-heading" className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10">
                <h2
                    id="story-heading"
                    className="font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                >
                    How we got here
                </h2>

                <ol className="mt-10 space-y-8">
                    {timeline.map((entry) => (
                        <li key={entry.period} className="border-l-2 border-accent/30 pl-6">
                            <h3 className="font-google-sans text-sm font-semibold uppercase tracking-wider text-accent">
                                {entry.period}
                            </h3>
                            <p className="mt-2 text-sm text-body sm:text-base">{entry.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* ----------------------------------------------------- principles */}
            <section aria-labelledby="principles-heading" className="border-y border-slate-200 bg-card">
                <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10">
                    <h2
                        id="principles-heading"
                        className="text-center font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                    >
                        What we hold to
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted sm:text-base">
                        These are not values on a wall — each one has cost us a feature we had already built.
                    </p>

                    <ul className="mt-12 grid gap-4 sm:grid-cols-2">
                        {principles.map((principle) => (
                            <li key={principle.title} className="rounded-xl border border-slate-200 bg-card p-6">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                    <principle.icon className="h-5 w-5" aria-hidden />
                                </div>
                                <h3 className="mt-4 font-google-sans text-base font-semibold text-foreground">
                                    {principle.title}
                                </h3>
                                <p className="mt-2 text-sm text-muted">{principle.body}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* --------------------------------------------------------- invite */}
            <section aria-labelledby="work-heading" className="mx-auto w-full max-w-3xl px-6 py-16 text-center sm:px-10">
                <h2
                    id="work-heading"
                    className="font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                >
                    Come and tell us we are wrong
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm text-muted sm:text-base">
                    A good deal of what Conexus X does today started as someone telling us a screen did not work for them.
                    We would rather hear it early.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button href="/contact" size="lg">
                        Get in touch
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button href="/blog" variant="secondary" size="lg">
                        Read how we build
                    </Button>
                </div>
            </section>

            <CtaBand />

            <JsonLd data={aboutJsonLd} />
        </>
    );
}
