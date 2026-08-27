import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown, CreditCard, Rocket, ShieldCheck, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageHeader from "@/components/site/PageHeader";
import CtaBand from "@/components/site/CtaBand";
import JsonLd from "@/components/site/JsonLd";
import { absoluteUrl, CONTACT, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "FAQ",
    description:
        "Answers about how Conexus X works: workspaces and modules, pricing and members, real-time collaboration, automations, access control, data and support.",
    path: "/faq",
});

/**
 * One source for both the page and its FAQPage structured data.
 *
 * Google requires that every question and answer in the markup is visible on
 * the page itself, so the rendered accordion and the JSON-LD below are
 * generated from THIS array rather than written twice — the moment they are two
 * lists, one of them is a lie.
 *
 * The accordion is native <details>/<summary>: it needs no JavaScript, ships
 * open to a crawler, and gets keyboard support and screen-reader semantics for
 * free. A hand-rolled one would have to re-earn all three.
 */
interface FaqGroup {
    heading: string;
    /** Marks the section in the margin, so a long page can be scanned. */
    icon: LucideIcon;
    items: { q: string; a: string }[];
}

const FAQ_GROUPS: FaqGroup[] = [
    {
        heading: "Getting started",
        icon: Rocket,
        items: [
            {
                q: "What is Conexus X?",
                a: "A collaborative CRM you structure yourself. A workspace holds modules, a module holds collections of records, and each record holds the columns you define. Nothing arrives with a pipeline already drawn for you.",
            },
            {
                q: "How long does it take to set up?",
                a: "Most teams have their first module running within an hour. Signing up asks a handful of questions about how you work and builds a starting workspace from the answers, which you can then rename, reshape or delete entirely.",
            },
            {
                q: "Can I import data from another CRM?",
                a: "You can create records and columns through the API with a workspace API key, which is how most migrations are done today. A guided importer is on the roadmap; until it ships, contact support and we will help you map your export.",
            },
            {
                q: "Do I need a credit card to try it?",
                a: "No. The Free plan covers up to 3 members permanently, and the Team trial runs for 14 days without payment details.",
            },
        ],
    },
    {
        heading: "How it works",
        icon: Workflow,
        items: [
            {
                q: "What is the difference between a module and a collection?",
                a: "A module is a board — Deals, Projects, Support tickets. A collection is a group of records inside it, such as a stage or a status band. Records live in collections and carry the module's columns.",
            },
            {
                q: "What column types are available?",
                a: "Text, number, status, date, timeline, person, people, email, phone, checkbox, dropdown, link, file and rating — plus relation columns, which mirror a value from a record in another module.",
            },
            {
                q: "Can records have sub-items?",
                a: "Yes. Every record can hold sub-records with their own columns, one level deep. That covers checklists, line items and tasks without turning your data into a tree nobody can navigate.",
            },
            {
                q: "Is it really real time?",
                a: "Yes. Changes are pushed over a live connection rather than polled on a timer, so a colleague's edit, comment or status change appears as it happens. If your connection drops, the app refills what it missed on reconnect.",
            },
            {
                q: "How do automations work?",
                a: "You build a rule by filling in a sentence: when something happens, only if a condition holds, then do this. Rules can run on a single module or across a whole workspace, and every run is recorded in the activity log with the recipe that caused it.",
            },
        ],
    },
    {
        heading: "Plans and billing",
        icon: CreditCard,
        items: [
            {
                q: "Who counts as a billable member?",
                a: "Anyone holding a seat in one of your workspaces. Someone who belongs to five of your workspaces is billed once, and people invited to view a single module are not billed at all.",
            },
            {
                q: "What happens to my data if I downgrade?",
                a: "Nothing is deleted. Your modules, records and history stay exactly as they are; the features the paid plan added simply stop being offered until you upgrade again.",
            },
            {
                q: "Can I change plans at any time?",
                a: "Yes, in either direction. Upgrades apply immediately and are prorated, and downgrades take effect at the end of the current billing period.",
            },
        ],
    },
    {
        heading: "Access and data",
        icon: ShieldCheck,
        items: [
            {
                q: "Who can see what?",
                a: "Roles are set per workspace, and each module has its own visibility. A private module is visible only to people granted access to it individually, and every screen shows what the server actually decided rather than a guess made in the browser.",
            },
            {
                q: "Is there an API?",
                a: "Yes. Generate a workspace API key in the developer section and read your data over a documented REST API. The built-in data console lets you build and run a request against your live data and copy it out as cURL or JavaScript.",
            },
            {
                q: "Can I get my data out?",
                a: "Always. Everything is readable through the API, and there is no export fee or lock-in period. Your structure is yours.",
            },
            {
                q: "Where is my data stored?",
                a: "In our managed cloud, encrypted in transit and at rest. Enterprise customers can discuss data residency options with sales.",
            },
        ],
    },
];

const allItems = FAQ_GROUPS.flatMap((group) => group.items);

const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: absoluteUrl("/faq"),
    mainEntity: allItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
};

export default function FaqPage() {
    return (
        <>
            <PageHeader
                eyebrow="FAQ"
                title="Questions, answered plainly"
                lead={`Everything people ask before they start — and the things they wish they had asked. If yours is not here, ${CONTACT.support} reaches a person.`}
            />

            <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10">
                {FAQ_GROUPS.map((group) => (
                    <section key={group.heading} aria-labelledby={`faq-${group.heading.replace(/\s+/g, "-").toLowerCase()}`} className="mb-12 last:mb-0">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                                <group.icon className="h-4 w-4" aria-hidden />
                            </span>
                            <h2
                                id={`faq-${group.heading.replace(/\s+/g, "-").toLowerCase()}`}
                                className="font-google-sans text-lg font-bold tracking-tight text-foreground"
                            >
                                {group.heading}
                            </h2>
                        </div>

                        <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-card">
                            {group.items.map((item) => (
                                <details key={item.q} className="group">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left font-google-sans text-sm font-semibold text-foreground transition-colors hover:bg-control/50">
                                        {item.q}
                                        <ChevronDown
                                            className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                                            aria-hidden
                                        />
                                    </summary>
                                    <p className="px-6 pb-5 text-sm text-muted">{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                ))}

                <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-8 text-center text-sm text-muted">
                    Still stuck? Email{" "}
                    <a href={`mailto:${CONTACT.support}`} className="font-semibold text-accent hover:text-accent-hover">
                        {CONTACT.support}
                    </a>{" "}
                    or{" "}
                    <Link href="/contact" className="font-semibold text-accent hover:text-accent-hover">
                        use the contact page
                    </Link>
                    . We answer within one business day.
                </p>
            </div>

            <CtaBand />

            <JsonLd data={faqJsonLd} />
        </>
    );
}
