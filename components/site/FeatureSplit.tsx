import Link from "next/link";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * One feature: what it is on one side, a picture of it on the other.
 *
 * The alternating split is the shape every product site of this kind settles
 * on, and the reason is not fashion — a claim and the evidence for it read as
 * one unit when they sit side by side, and as two unrelated blocks when the
 * copy is stacked above a strip of screenshots.
 *
 * `reverse` flips which side the mock lands on. It only applies from `lg`: on a
 * phone both columns stack, and the copy must always come first there or the
 * visitor meets a picture with nothing yet telling them what it is.
 */
export default function FeatureSplit({
    icon: Icon,
    eyebrow,
    title,
    body,
    points,
    href,
    linkLabel,
    badge,
    reverse = false,
    mock,
}: {
    icon: LucideIcon;
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
    href?: string;
    linkLabel?: string;
    /** e.g. "In development" — set when the feature is not shipped yet. */
    badge?: string;
    reverse?: boolean;
    mock: React.ReactNode;
}) {
    const headingId = `feature-${eyebrow.replace(/\s+/g, "-").toLowerCase()}`;

    return (
        <section aria-labelledby={headingId} className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 sm:py-20">
            {/*
                min-w-0 ON BOTH CELLS, and it is load-bearing rather than tidy.

                A grid item defaults to `min-width: auto`, so a `1fr` track
                refuses to shrink below its content's MIN-CONTENT width. The
                mock carries an explicit min-width (it is a screenshot and
                cannot reflow), so without this the track grew to 560px, burst
                out of the section, and took the TEXT cell with it — which is
                why the headings and paragraphs were cut off at the screen edge
                instead of wrapping.

                The overflow-x-auto inside MockFrame cannot help on its own: a
                scroll container only scrolls once something above it says how
                wide it is allowed to be. This is what says so.
            */}
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={`min-w-0 ${reverse ? "lg:order-2" : ""}`}>
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</span>

                        {badge ? (
                            <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
                                {badge}
                            </span>
                        ) : null}
                    </div>

                    <h2
                        id={headingId}
                        className="mt-5 font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                    >
                        {title}
                    </h2>

                    <p className="mt-4 text-sm text-muted sm:text-base">{body}</p>

                    <ul className="mt-6 space-y-3">
                        {points.map((point) => (
                            <li key={point} className="flex gap-3 text-sm text-body">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                    <Check className="h-3 w-3 text-emerald-600" aria-hidden />
                                </span>
                                {point}
                            </li>
                        ))}
                    </ul>

                    {href && linkLabel ? (
                        <Link
                            href={href}
                            className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
                        >
                            {linkLabel} →
                        </Link>
                    ) : null}
                </div>

                <div className={`min-w-0 ${reverse ? "lg:order-1" : ""}`}>{mock}</div>
            </div>
        </section>
    );
}
