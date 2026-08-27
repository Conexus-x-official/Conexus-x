/**
 * The window chrome every product preview sits in.
 *
 * The frame is doing real work, not decoration: it is what tells a visitor
 * that the block below is a picture OF the product rather than more of the
 * marketing page. Without it, a mock built from the same tokens as the page
 * around it dissolves into that page and reads as an odd layout.
 *
 * These are MOCKS, drawn in HTML from the product's own visual grammar — the
 * real screens are behind auth and wired to eight query caches, so they cannot
 * render here. That is the same trade components/onboarding/BoardPreview.tsx
 * makes, and the same rule applies: copy the grammar exactly, invent nothing
 * the product cannot actually do.
 */
export default function MockFrame({
    label,
    contentMinWidth,
    children,
    className = ""
}: {
    /** What the fake title bar says — the screen this is a picture of. */
    label: string;
    /**
     * The narrowest this screenshot stays legible, in px.
     *
     * Set it and the body scrolls SIDEWAYS INSIDE THE FRAME below that width,
     * instead of the mock pushing the whole page wider than the phone. That
     * distinction is the entire fix: a board with fixed columns cannot reflow
     * into 320px, and letting it try made the page itself scroll — which sized
     * every paragraph beside it to the overflowing width, so the headings and
     * body text ran off the right edge instead of wrapping.
     *
     * The frame, its title bar and its border stay put; only the picture moves,
     * which is what a screenshot should do. Leave it unset for a mock that is
     * genuinely responsive.
     */
    contentMinWidth?: number;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-lg ${className}`}
            // A decorative picture of the UI: it repeats what the prose beside
            // it already says, so a screen reader should walk past it rather
            // than read out forty fragments of fake table.
            role="presentation"
            aria-hidden
        >
            <div className="flex items-center gap-2 border-b border-slate-200 bg-panel px-4 py-2.5">
                <span className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </span>

                <span className="mx-auto truncate rounded-md bg-card px-3 py-1 text-[11px] font-medium text-muted">
                    {label}
                </span>
            </div>

            {contentMinWidth ? (
                // `relative` for the same reason the pricing table needs it:
                // overflow-x-auto is not a containing block, so any absolutely
                // positioned descendant (an sr-only label, a popover) would
                // escape this scroller and widen the page instead.
                <div className="relative overflow-x-auto">
                    <div style={{ minWidth: `${contentMinWidth}px` }}>{children}</div>
                </div>
            ) : (
                children
            )}
        </div>
    );
}
