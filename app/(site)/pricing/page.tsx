import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Check, Minus, Rocket, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Button from "@/components/site/Button";
import PageHeader from "@/components/site/PageHeader";
import CtaBand from "@/components/site/CtaBand";
import JsonLd from "@/components/site/JsonLd";
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "Pricing",
    description:
        "Simple per-member pricing for Conexus X. Start free for up to 3 members, then $12 per member each month — every plan includes automations, real-time updates and built-in chat.",
    path: "/pricing",
});

interface Plan {
    name: string;
    /** A glyph per tier, so the cards are told apart before the prices are read. */
    icon: LucideIcon;
    price: string;
    cadence: string;
    /** Machine-readable, for the Offer node. Free plans price "0". */
    amount: string;
    blurb: string;
    cta: { label: string; href: string };
    featured: boolean;
    includes: string[];
}

const PLANS: Plan[] = [
    {
        name: "Free",
        icon: Sparkles,
        price: "$0",
        cadence: "forever",
        amount: "0",
        blurb: "For one person or a small team getting its structure straight.",
        cta: { label: "Start free", href: "/register" },
        featured: false,
        includes: [
            "Up to 3 members",
            "2 workspaces",
            "Unlimited modules and records",
            "All 14 column types",
            "Real-time updates and presence",
            "Direct messages",
        ],
    },
    {
        name: "Team",
        icon: Rocket,
        price: "$12",
        cadence: "per member / month",
        amount: "12",
        blurb: "For teams running their real work in Conexus X every day.",
        cta: { label: "Start free trial", href: "/register" },
        featured: true,
        includes: [
            "Unlimited members and workspaces",
            "Automations, workspace-wide and per module",
            "Relation and mirror columns",
            "Private modules with per-person access",
            "Team threads, voice and video calls",
            "Full activity log with revert",
            "API keys and the data console",
        ],
    },
    {
        name: "Enterprise",
        icon: Building2,
        price: "Custom",
        cadence: "billed annually",
        amount: "",
        blurb: "For organisations with procurement, compliance and a security review.",
        cta: { label: "Talk to sales", href: "/contact" },
        featured: false,
        includes: [
            "Everything in Team",
            "SSO and provisioning",
            "Audit export and data residency options",
            "Priority support with a named contact",
            "Onboarding and migration help",
        ],
    },
];

/** One row per capability. `true` = included, `false` = not on that plan, string = a limit. */
const COMPARISON: { label: string; free: boolean | string; team: boolean | string; enterprise: boolean | string }[] = [
    { label: "Members", free: "Up to 3", team: "Unlimited", enterprise: "Unlimited" },
    { label: "Workspaces", free: "2", team: "Unlimited", enterprise: "Unlimited" },
    { label: "Records per module", free: "Unlimited", team: "Unlimited", enterprise: "Unlimited" },
    { label: "Sub-records", free: true, team: true, enterprise: true },
    { label: "Relation and mirror columns", free: false, team: true, enterprise: true },
    { label: "Automations", free: false, team: true, enterprise: true },
    { label: "Private modules and per-person access", free: false, team: true, enterprise: true },
    { label: "Voice and video calls", free: false, team: true, enterprise: true },
    { label: "Activity log", free: "30 days", team: "Unlimited", enterprise: "Unlimited" },
    { label: "API keys and data console", free: false, team: true, enterprise: true },
    { label: "SSO and provisioning", free: false, team: false, enterprise: true },
    { label: "Support", free: "Community", team: "Email, 1 business day", enterprise: "Named contact" },
];

const FAQ = [
    {
        q: "Who counts as a member?",
        a: "Anyone with a seat in one of your workspaces. Guests you invite to a single module are not billed, and a member in five workspaces is billed once.",
    },
    {
        q: "What happens when the trial ends?",
        a: "The workspace drops to the Free plan. Nothing is deleted — the modules and records stay exactly as they are, and paid features simply stop being offered.",
    },
    {
        q: "Can I change plans later?",
        a: "Yes, in either direction. Upgrades take effect immediately and are prorated; downgrades apply at the end of the current period.",
    },
];

const offersJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${SITE_NAME} — plans`,
    description:
        "Per-member pricing for Conexus X, a collaborative CRM with workspaces, modules and records you define yourself.",
    url: absoluteUrl("/pricing"),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: PLANS.filter((p) => p.amount !== "").map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: plan.amount,
        priceCurrency: "USD",
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
        description: plan.blurb,
    })),
    isRelatedTo: { "@id": `${SITE_URL}/#organization` },
};

/** A cell in the comparison table: a tick, a dash, or the limit spelled out. */
function ComparisonCell({ value }: { value: boolean | string }) {
    if (value === true) {
        return (
            <>
                <Check className="mx-auto h-4 w-4 text-emerald-600" aria-hidden />
                <span className="sr-only">Included</span>
            </>
        );
    }

    if (value === false) {
        return (
            <>
                <Minus className="mx-auto h-4 w-4 text-slate-400" aria-hidden />
                <span className="sr-only">Not included</span>
            </>
        );
    }

    return <span className="text-sm text-slate-700">{value}</span>;
}

export default function PricingPage() {
    return (
        <>
            <PageHeader
                eyebrow="Pricing"
                title="One price per member. Everything else included."
                lead="No feature held back to sell you a tier you do not need, and no per-record billing that punishes you for using the product. Start free and pay only when your team grows past three."
            />

            {/* --------------------------------------------------------- plans */}
            <section aria-labelledby="plans-heading" className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10">
                <h2 id="plans-heading" className="sr-only">
                    Plans
                </h2>

                <ul className="grid gap-4 lg:grid-cols-3">
                    {PLANS.map((plan) => (
                        <li
                            key={plan.name}
                            className={
                                plan.featured
                                    ? "relative flex flex-col rounded-2xl border-2 border-accent bg-card p-8 shadow-sm"
                                    : "flex flex-col rounded-2xl border border-slate-200 bg-card p-8"
                            }
                        >
                            {plan.featured ? (
                                <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white">
                                    Most popular
                                </span>
                            ) : null}

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                <plan.icon className="h-5 w-5" aria-hidden />
                            </div>

                            <h3 className="mt-4 font-google-sans text-lg font-bold text-foreground">{plan.name}</h3>
                            <p className="mt-2 text-sm text-muted">{plan.blurb}</p>

                            <p className="mt-6 flex items-baseline gap-2">
                                <span className="font-google-sans text-4xl font-bold tracking-tight text-foreground">
                                    {plan.price}
                                </span>
                                <span className="text-xs text-muted">{plan.cadence}</span>
                            </p>

                            <Button
                                href={plan.cta.href}
                                variant={plan.featured ? "primary" : "secondary"}
                                size="lg"
                                className="mt-6 w-full"
                            >
                                {plan.cta.label}
                            </Button>

                            <ul className="mt-8 space-y-3 border-t border-slate-100 pt-6">
                                {plan.includes.map((item) => (
                                    <li key={item} className="flex gap-3 text-sm text-slate-700">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            </section>

            {/* ---------------------------------------------------- comparison */}
            <section aria-labelledby="compare-heading" className="border-y border-slate-200 bg-card">
                <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10">
                    <h2
                        id="compare-heading"
                        className="text-center font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                    >
                        Compare the plans
                    </h2>

                    {/*
                        A table is wider than a phone; it scrolls in its own box
                        rather than making the page scroll sideways.

                        `relative` IS LOAD-BEARING. overflow-x-auto does NOT
                        create a containing block for absolutely-positioned
                        descendants, and Tailwind's .sr-only is position:
                        absolute — so the 23 screen-reader labels inside this
                        560px table were positioning against the PAGE, escaping
                        the scroller entirely, and dragging the document 150px
                        wide on a 375px phone. The table itself was innocent and
                        clipped correctly the whole time.

                        Rule: any overflow-*-auto box that can contain sr-only
                        (or any absolute) descendant needs a containing block.
                    */}
                    <div className="relative mt-10 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse">
                            <caption className="sr-only">Feature comparison across the Free, Team and Enterprise plans</caption>
                            <thead>
                                <tr className="border-b border-gray-200/40 text-left text-sm font-bold text-[#7c7c80]">
                                    <th scope="col" className="px-4 py-3 font-bold">
                                        Feature
                                    </th>
                                    {PLANS.map((plan) => (
                                        <th key={plan.name} scope="col" className="px-4 py-3 text-center font-bold">
                                            {plan.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/30">
                                {COMPARISON.map((row) => (
                                    <tr key={row.label} className="text-slate-800">
                                        <th scope="row" className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                                            {row.label}
                                        </th>
                                        <td className="px-4 py-3 text-center">
                                            <ComparisonCell value={row.free} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <ComparisonCell value={row.team} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <ComparisonCell value={row.enterprise} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ----------------------------------------------- billing questions */}
            <section aria-labelledby="billing-heading" className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10">
                <h2
                    id="billing-heading"
                    className="font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                >
                    Billing questions
                </h2>

                <dl className="mt-8 space-y-6">
                    {FAQ.map((item) => (
                        <div key={item.q} className="rounded-xl border border-slate-200 bg-card p-6">
                            <dt className="font-google-sans text-base font-semibold text-foreground">{item.q}</dt>
                            <dd className="mt-2 text-sm text-muted">{item.a}</dd>
                        </div>
                    ))}
                </dl>

                <p className="mt-8 text-sm text-muted">
                    Something not covered here?{" "}
                    <Link href="/faq" className="font-semibold text-accent hover:text-accent-hover">
                        Read the full FAQ
                    </Link>{" "}
                    or{" "}
                    <Link href="/contact" className="font-semibold text-accent hover:text-accent-hover">
                        ask us directly
                    </Link>
                    .
                </p>
            </section>

            <CtaBand
                heading="Try the Team plan for 14 days"
                body="No card up front. If it is not the right shape for your work, the workspace simply drops back to Free and nothing is lost."
            />

            <JsonLd data={offersJsonLd} />
        </>
    );
}
