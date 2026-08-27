/**
 * THE LOGO TILE, made reusable.
 *
 * The sidebar's brand mark sits in an outlined square — `bg-card` with a
 * `border-slate-300` hairline — and that shape turned out to be the sidebar's
 * one repeatable idea: an icon is never loose in a row, it is always in a tile
 * of the same shape. Extensions, Automations, Modules and the workspace
 * switcher all draw their glyph the same way, so the icon column reads as one
 * column instead of four differently-sized marks.
 *
 * `bg-card`, NOT `bg-white`: the sidebar is itself `bg-card`, so in the light
 * family the tile is invisible except for its outline — which is the whole
 * effect. Hardcoding white would keep it white in `.dark` while the border
 * inverted around it (LAYOUT.md §10.1). `border-slate-300` is left as a
 * palette utility on purpose: every theme already re-points that scale.
 *
 * Size and radius are the caller's, because the brand mark is a 44px
 * `rounded-xl` and a nav row is a 28px `rounded-lg` — same recipe, two scales.
 * See LAYOUT.md §7 "Icon tile".
 */
export const NAV_TILE =
    "flex shrink-0 items-center justify-center bg-card border border-slate-300";

export default function NavTile({
    className = "h-7 w-7 rounded-lg",
    children
}: {
    /** Size + radius. Defaults to the nav-row scale. */
    className?: string;
    children: React.ReactNode;
}) {
    return <span className={`${NAV_TILE} ${className}`}>{children}</span>;
}
