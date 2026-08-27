import Link from "next/link";

/**
 * The public site's buttons, in one place.
 *
 * Every marketing page had been repeating the same class string, which is how
 * the primary and secondary treatments drift apart one page at a time — and
 * how a colour change turns into an edit in eleven files. The variants below
 * are the only ones the site uses; a page that wants a twelfth treatment
 * should get a variant here instead of an inline override.
 *
 * `primary` is the .cta-gradient from globals.css (see the note beside
 * --gradient-cta for why it is a sweep and not a flat --accent fill).
 */

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
    // text-white, not a token: this is on-accent ink and stays constant across
    // themes by design (LAYOUT.md 10.2).
    primary:
        "cta-gradient text-white shadow-sm hover:shadow-md active:translate-y-px",
    secondary:
        "border border-slate-300 bg-card text-slate-700 hover:bg-control hover:text-foreground",
    ghost: "text-slate-700 hover:bg-control hover:text-foreground",
};

const SIZES = {
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-sm sm:text-base",
} as const;

const BASE =
    "inline-flex items-center justify-center gap-2 rounded-xl font-google-sans font-semibold transition-all duration-200 cursor-pointer";

export default function Button({
    href,
    variant = "primary",
    size = "md",
    className = "",
    onNavigate,
    children,
}: {
    href: string;
    variant?: Variant;
    size?: keyof typeof SIZES;
    className?: string;
    /**
     * Fired on click, for a caller that has to clean up as well as navigate —
     * the mobile menu closing behind itself, for instance. Optional, and only
     * ever passed from a client component; a server page passing a function
     * here would be a build error, which is the correct outcome.
     */
    onNavigate?: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
        >
            {children}
        </Link>
    );
}

/** The same treatments for a real <button> — the contact form's submit. */
export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md") {
    return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`;
}
