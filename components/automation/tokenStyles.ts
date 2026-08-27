/**
 * How a blank in the sentence looks, filled or empty.
 *
 * Its own module because shared.tsx and BlankMenu.tsx BOTH need it and import
 * each other otherwise — a cycle that happens to work today only because the
 * class string is read during render rather than at module init. One file with
 * no imports of its own cannot get that wrong.
 */
/** Shared by every blank, filled or not. */
const TOKEN_BASE =
    "inline-flex max-w-[220px] items-center rounded-md border px-2 py-1 text-xs font-semibold outline-none transition align-middle";

/**
 * A FILLED blank is the zinc glass panel, not a saturated brand fill.
 *
 * These tokens sit five and six to a line; in accent violet the sentence
 * turned into a row of highlighter marks and the words BETWEEN them — which
 * are what make it a sentence — disappeared underneath. Glass gives the blank
 * a body you can see and click without shouting, and it is the same treatment
 * the sidebar uses for the row you are on.
 */
const TOKEN_FILLED =
    "nav-glass border-transparent text-slate-900 cursor-pointer";

const TOKEN_EMPTY =
    "border-dashed border-slate-400 bg-transparent text-muted hover:border-slate-600 hover:text-slate-900 cursor-pointer";

export const tokenClass = (filled: boolean) =>
    `${TOKEN_BASE} ${filled ? TOKEN_FILLED : TOKEN_EMPTY}`;
