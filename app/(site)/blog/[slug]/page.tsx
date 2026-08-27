import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CtaBand from "@/components/site/CtaBand";
import JsonLd from "@/components/site/JsonLd";
import { formatPostDate, getPost, getPosts, type PostBlock } from "@/lib/blog";
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

/**
 * Every post is known at build time, so they are all prerendered as static
 * HTML. Without this the route is rendered on demand and a crawler waits on the
 * server for a page whose content never changes.
 */
export function generateStaticParams() {
    return getPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = getPost(slug);

    // A missing post 404s below; its metadata must say so too, or an unindexed
    // URL still ships a <title> claiming a page exists.
    if (!post) {
        return { title: "Post not found", robots: { index: false, follow: false } };
    }

    return {
        ...pageMetadata({
            title: post.title,
            description: post.description,
            path: `/blog/${post.slug}`,
            type: "article",
            publishedTime: post.date,
        }),
        authors: [{ name: post.author }],
    };
}

/** One block of a post body. The renderer emits real headings, lists and quotes. */
function Block({ block }: { block: PostBlock }) {
    switch (block.kind) {
        case "heading":
            return (
                <h2 className="mt-12 font-google-sans text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {block.text}
                </h2>
            );

        case "list":
            return (
                <ul className="mt-6 space-y-3">
                    {block.items.map((item) => (
                        <li key={item} className="flex gap-3 text-base leading-relaxed text-body">
                            <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            {item}
                        </li>
                    ))}
                </ul>
            );

        case "quote":
            return (
                <blockquote className="mt-8 border-l-2 border-accent bg-card px-6 py-5 font-google-sans text-lg italic text-foreground">
                    {block.text}
                </blockquote>
            );

        default:
            return <p className="mt-6 text-base leading-relaxed text-body">{block.text}</p>;
    }
}

export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params;
    const post = getPost(slug);

    if (!post) notFound();

    const url = absoluteUrl(`/blog/${post.slug}`);
    const more = getPosts().filter((p) => p.slug !== post.slug).slice(0, 2);

    const articleJsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        datePublished: post.date,
        dateModified: post.date,
        author: { "@type": "Organization", name: post.author, url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#organization` },
        image: absoluteUrl("/logo.png"),
        articleSection: post.tag,
        inLanguage: "en",
    };

    // Breadcrumbs are declared rather than only drawn: they are what puts the
    // Home › Blog › Post trail under the result instead of a bare URL.
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
            { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
    };

    return (
        <>
            <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10">
                <nav aria-label="Breadcrumb" className="mb-8">
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                        All posts
                    </Link>
                </nav>

                <header>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                            {post.tag}
                        </span>
                        <time dateTime={post.date} className="text-xs text-muted">
                            {formatPostDate(post.date)}
                        </time>
                        <span className="text-xs text-muted">· {post.readingMinutes} min read</span>
                    </div>

                    <h1 className="mt-5 font-google-sans text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                        {post.title}
                    </h1>

                    <p className="mt-5 text-lg text-muted">{post.description}</p>

                    <p className="mt-6 border-t border-slate-200 pt-6 text-sm text-muted">By {post.author}</p>
                </header>

                <div className="mt-4">
                    {post.body.map((block, i) => (
                        <Block key={i} block={block} />
                    ))}
                </div>
            </article>

            {more.length > 0 ? (
                <section aria-labelledby="more-heading" className="border-t border-slate-200">
                    <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10">
                        <h2
                            id="more-heading"
                            className="font-google-sans text-xl font-bold tracking-tight text-foreground"
                        >
                            Keep reading
                        </h2>

                        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                            {more.map((other) => (
                                <li key={other.slug}>
                                    <Link
                                        href={`/blog/${other.slug}`}
                                        className="flex h-full flex-col rounded-xl border border-slate-200 bg-card p-6 transition-colors hover:border-slate-300"
                                    >
                                        <span className="w-fit rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                                            {other.tag}
                                        </span>
                                        <h3 className="mt-4 font-google-sans text-base font-semibold text-foreground">
                                            {other.title}
                                        </h3>
                                        <p className="mt-2 text-sm text-muted">{other.description}</p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}

            <CtaBand
                heading={`See it working instead of reading about it`}
                body={`${SITE_NAME} is free for up to three people, and your first workspace takes about an hour to shape.`}
            />

            <JsonLd data={articleJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
        </>
    );
}
