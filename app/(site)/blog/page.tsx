import Link from "next/link";
import type { Metadata } from "next";
import PageHeader from "@/components/site/PageHeader";
import CtaBand from "@/components/site/CtaBand";
import JsonLd from "@/components/site/JsonLd";
import { formatPostDate, getPosts } from "@/lib/blog";
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "Blog",
    description:
        "Notes from the team building Conexus X — how the product is shaped, what we removed and why, and the engineering behind real-time collaboration and automations.",
    path: "/blog",
});

export default function BlogPage() {
    const posts = getPosts();
    const [lead, ...rest] = posts;

    const blogJsonLd = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": `${absoluteUrl("/blog")}#blog`,
        name: `${SITE_NAME} blog`,
        url: absoluteUrl("/blog"),
        description: "Notes from the team building Conexus X.",
        publisher: { "@id": `${SITE_URL}/#organization` },
        blogPost: posts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            url: absoluteUrl(`/blog/${post.slug}`),
            datePublished: post.date,
            author: { "@type": "Organization", name: post.author },
        })),
    };

    return (
        <>
            <PageHeader
                eyebrow="Blog"
                title="How we build Conexus X"
                lead="Product decisions, engineering write-ups, and the features we removed after shipping them. No launch announcements dressed up as insight."
            />

            <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10">
                {/* ------------------------------------------------ lead post */}
                {lead ? (
                    <article className="rounded-2xl border border-slate-200 bg-card p-8 sm:p-10">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                                {lead.tag}
                            </span>
                            <time dateTime={lead.date} className="text-xs text-muted">
                                {formatPostDate(lead.date)}
                            </time>
                            <span className="text-xs text-muted">· {lead.readingMinutes} min read</span>
                        </div>

                        <h2 className="mt-4 font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            <Link href={`/blog/${lead.slug}`} className="transition-colors hover:text-accent">
                                {lead.title}
                            </Link>
                        </h2>

                        <p className="mt-4 max-w-2xl text-sm text-muted sm:text-base">{lead.description}</p>

                        <Link
                            href={`/blog/${lead.slug}`}
                            className="mt-6 inline-block text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
                        >
                            Read the post →
                        </Link>
                    </article>
                ) : null}

                {/* --------------------------------------------------- others */}
                {rest.length > 0 ? (
                    <section aria-labelledby="more-posts" className="mt-10">
                        <h2 id="more-posts" className="sr-only">
                            More posts
                        </h2>

                        <ul className="grid gap-4 sm:grid-cols-2">
                            {rest.map((post) => (
                                <li key={post.slug}>
                                    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-card p-6 transition-colors hover:border-slate-300">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                                                {post.tag}
                                            </span>
                                            <time dateTime={post.date} className="text-xs text-muted">
                                                {formatPostDate(post.date)}
                                            </time>
                                        </div>

                                        <h3 className="mt-4 font-google-sans text-lg font-semibold text-foreground">
                                            <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-accent">
                                                {post.title}
                                            </Link>
                                        </h3>

                                        <p className="mt-2 flex-1 text-sm text-muted">{post.description}</p>

                                        <p className="mt-4 text-xs text-muted">{post.readingMinutes} min read</p>
                                    </article>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}
            </div>

            <CtaBand
                heading="Reading about it is the slow way"
                body="Create a workspace and see whether the structure fits your work. It takes about an hour, and the Free plan does not expire."
            />

            <JsonLd data={blogJsonLd} />
        </>
    );
}
