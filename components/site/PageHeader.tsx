/**
 * The opening block of a public page: eyebrow, the page's single <h1>, and a
 * lead paragraph.
 *
 * Shared so every marketing page has exactly ONE h1 and they all sit at the
 * same size — a page with two h1s (or none) leaves a crawler guessing what the
 * page is about, and it is the easiest heading mistake to make one page at a
 * time.
 */
export default function PageHeader({
    eyebrow,
    title,
    lead,
    children,
}: {
    eyebrow: string;
    title: string;
    lead: string;
    children?: React.ReactNode;
}) {
    return (
        <header className="border-b border-slate-200 bg-card">
            <div className="mx-auto w-full max-w-4xl px-6 py-12 text-center sm:px-10 sm:py-20">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>

                <h1 className="mt-4 font-google-sans text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                    {title}
                </h1>

                <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">{lead}</p>

                {children ? <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div> : null}
            </div>
        </header>
    );
}
