import Link from "next/link";
import type { Metadata } from "next";
import {
    ArrowRight,
    Bolt,
    Columns3,
    Database,
    KeyRound,
    LayoutGrid,
    MessagesSquare,
    Plug,
    Radio,
    ShieldCheck,
    Sparkles,
    UserPlus,
    Wand2,
} from "lucide-react";
import Button from "@/components/site/Button";
import CtaBand from "@/components/site/CtaBand";
import FeatureSplit from "@/components/site/FeatureSplit";
import JsonLd from "@/components/site/JsonLd";
import BoardMock from "@/components/site/previews/BoardMock";
import ColumnTypesMock, { COLUMN_TYPE_COUNT } from "@/components/site/previews/ColumnTypesMock";
import AutomationMock from "@/components/site/previews/AutomationMock";
import MeetMock from "@/components/site/previews/MeetMock";
import ExtensionsMock from "@/components/site/previews/ExtensionsMock";
import { formatPostDate, getPosts } from "@/lib/blog";
import { absoluteUrl, pageMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_URL, SITE_TAGLINE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
    path: "/",
});

/** The trust strip under the hero — four facts, each with its own glyph. */
const GUARANTEES = [
    { icon: Radio, label: "Live updates", detail: "Pushed, never polled" },
    { icon: ShieldCheck, label: "Access control", detail: "Per workspace and module" },
    { icon: KeyRound, label: "Open API", detail: "Your keys, your data" },
    { icon: Database, label: "No lock-in", detail: "Export any time, free" },
];

/** The workflow, as icons rather than a paragraph. */
const STEPS = [
    {
        icon: LayoutGrid,
        title: "Shape your board",
        body: `Create a module and name your own collections and columns. ${COLUMN_TYPE_COUNT} typed column kinds, no imposed pipeline.`,
    },
    {
        icon: UserPlus,
        title: "Bring the team in",
        body: "Invite people, set a role per workspace, and open the boards each of them needs. Everyone sees the same row change at the same moment.",
    },
    {
        icon: Wand2,
        title: "Automate the repetition",
        body: "Fill in a sentence — when this, only if that, then do this — and read every run back in the activity log.",
    },
];

const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    image: absoluteUrl("/logo.png"),
    publisher: { "@id": `${SITE_URL}/#organization` },
    featureList: [
        "Custom workspaces, modules, collections and records",
        `${COLUMN_TYPE_COUNT} typed column kinds including relation and mirror columns`,
        "Sub-records one level deep",
        "Real-time collaboration over a live connection",
        "Automations built as a sentence",
        "Built-in chat, voice and video (Conexus Meet)",
        "Per-workspace roles and per-module access",
        "REST API with workspace API keys",
    ],
    offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free plan for up to 3 members",
        url: absoluteUrl("/pricing"),
    },
};

export default function Home() {
    const latest = getPosts().slice(0, 3);

    return (
        <>
            {/* ---------------------------------------------------------- hero */}
            <section className="border-b border-slate-200 bg-card">
                <div className="mx-auto w-full max-w-6xl px-6 pt-14 sm:px-10 sm:pt-24">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-panel px-4 py-1.5 text-xs font-semibold text-slate-600">
                            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
                            Automations, mirrored columns and built-in calls
                        </p>

                        <h1 className="mt-6 font-google-sans text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                            The CRM your team
                            <span className="brand-gradient-text"> shapes itself</span>
                        </h1>

                        <p className="mx-auto mt-6 max-w-2xl text-base text-muted sm:text-lg">{SITE_DESCRIPTION}</p>

                        <div className="mt-10 flex flex-wrap justify-center gap-3">
                            <Button href="/register" size="lg">
                                Get started free
                                <ArrowRight className="h-4 w-4" aria-hidden />
                            </Button>
                            <Button href="/pricing" variant="secondary" size="lg">
                                See pricing
                            </Button>
                        </div>

                        <p className="mt-5 text-xs text-muted">Free for up to 3 members. No credit card.</p>
                    </div>

                    {/* The product, immediately. A landing page that describes a
                        board without showing one asks to be taken on faith. */}
                    <div className="mx-auto mt-10 max-w-4xl sm:mt-14">
                        <BoardMock />
                    </div>
                </div>

                {/* -------------------------------------------- trust strip */}
                <div className="mx-auto mt-12 w-full max-w-6xl border-t border-slate-100 px-6 py-8 sm:mt-16 sm:px-10">
                    <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                        {GUARANTEES.map((item) => (
                            <li key={item.label} className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600">
                                    <item.icon className="h-4 w-4" aria-hidden />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-foreground">
                                        {item.label}
                                    </span>
                                    <span className="block truncate text-xs text-muted">{item.detail}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* ------------------------------------------------------ features */}
            <FeatureSplit
                icon={Columns3}
                eyebrow="Boards"
                title="Structure you define, held firmly"
                body="Workspaces hold modules, modules hold collections, collections hold records. You name every one of them, and the columns underneath."
                points={[
                    `${COLUMN_TYPE_COUNT} typed columns — status, timeline, person, rating, relation and more`,
                    "Sub-records one level deep for checklists and line items",
                    "Mirror a value from another module without duplicating it",
                ]}
                href="/faq"
                linkLabel="How the pieces fit together"
                mock={<ColumnTypesMock />}
            />

            <div className="border-y border-slate-200 bg-card">
                <FeatureSplit
                    icon={Bolt}
                    eyebrow="Automations"
                    title="Rules you can read out loud"
                    body="No node canvas and no scripting. Fill in the blanks of a sentence, and the rule you read while building it is the rule that runs."
                    points={[
                        "When / only if / then — words rather than trigger, condition, action",
                        "Options that cannot run are never offered, not greyed out",
                        "Every run lands in the activity log, attributed to the recipe",
                    ]}
                    href="/blog/automations-you-can-read-out-loud"
                    linkLabel="Why we built it as a sentence"
                    reverse
                    mock={<AutomationMock />}
                />
            </div>

            <FeatureSplit
                icon={MessagesSquare}
                eyebrow="Conexus Meet"
                title="The conversation, next to the work"
                body="Direct messages, team threads and calls in the same product as the records you are talking about — not in a second tab someone forgets to open."
                points={[
                    "One list across every workspace, ordered by what happened last",
                    "Presence you can trust, shown by shape as well as colour",
                    "Voice and video straight from a thread, no scheduling step",
                ]}
                mock={<MeetMock />}
            />

            {/* -------------------------------------------------- what's next */}
            <div className="border-y border-slate-200 bg-card">
                <FeatureSplit
                    icon={Plug}
                    eyebrow="Extensions"
                    title="Your own apps on your own data"
                    body="The section where a team will build and deploy apps on top of its CRM. It is in the product today and it is deliberately empty — we would rather show you that than a grid of things that do not open."
                    points={[
                        "Planned: build, deploy and share an app inside your workspace",
                        "Available today: the REST API and workspace keys it will be built on",
                        "Not counted in any plan below until it ships",
                    ]}
                    href="/contact"
                    linkLabel="Tell us what you would build"
                    badge="In development"
                    reverse
                    mock={<ExtensionsMock />}
                />
            </div>

            {/* --------------------------------------------------- the workflow */}
            <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-10 sm:py-20">
                <h2
                    id="how-heading"
                    className="text-center font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                >
                    Up and running in an afternoon
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted sm:text-base">
                    Three steps, in this order. Nothing here needs an implementation partner.
                </p>

                <ol className="mt-10 grid gap-8 sm:mt-14 sm:grid-cols-3">
                    {STEPS.map((step, i) => (
                        <li key={step.title} className="relative">
                            {/* The connector between steps — the workflow read as
                                one line rather than three unrelated cards. It is
                                decorative, so it never reaches the accessibility
                                tree; the <ol> already carries the order. */}
                            {i < STEPS.length - 1 ? (
                                <span
                                    aria-hidden
                                    className="absolute left-[calc(50%+2.5rem)] right-[-1.5rem] top-7 hidden h-px bg-slate-200 sm:block"
                                />
                            ) : null}

                            <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-slate-300 bg-card text-accent">
                                <step.icon className="h-6 w-6" aria-hidden />
                                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                                    {i + 1}
                                </span>
                            </span>

                            <h3 className="mt-5 text-center font-google-sans text-base font-semibold text-foreground">
                                {step.title}
                            </h3>
                            <p className="mt-2 text-center text-sm text-muted">{step.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* -------------------------------------------------- latest posts */}
            <section
                aria-labelledby="latest-heading"
                className="border-t border-slate-200 bg-card"
            >
                <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-10 sm:py-20">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2
                                id="latest-heading"
                                className="font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                            >
                                From the blog
                            </h2>
                            <p className="mt-2 text-sm text-muted">
                                How we build Conexus X, and why it is shaped this way.
                            </p>
                        </div>

                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
                        >
                            Read all posts
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                    </div>

                    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {latest.map((post) => (
                            <li key={post.slug}>
                                <Link
                                    href={`/blog/${post.slug}`}
                                    className="flex h-full flex-col rounded-xl border border-slate-200 bg-card p-6 transition-colors hover:border-slate-300"
                                >
                                    <span className="w-fit rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                                        {post.tag}
                                    </span>
                                    <h3 className="mt-4 font-google-sans text-base font-semibold text-foreground">
                                        {post.title}
                                    </h3>
                                    <p className="mt-2 flex-1 text-sm text-muted">{post.description}</p>
                                    <time dateTime={post.date} className="mt-4 text-xs text-muted">
                                        {formatPostDate(post.date)}
                                    </time>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <CtaBand />

            <JsonLd data={softwareJsonLd} />
        </>
    );
}
