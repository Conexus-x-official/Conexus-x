"use client";

import { useRouter } from "next/navigation";
import { TbChevronLeft } from "react-icons/tb";

/**
 * Back to wherever the user came from.
 *
 * Prefers real history, so it returns them to the exact page and scroll
 * position they left rather than to a guessed route. `fallbackHref` covers the
 * case where there is nothing to go back to — a pasted link, a new tab, or a
 * refresh — because router.back() there either does nothing at all or walks the
 * user straight out of the app, and a dead-looking button is the worse of the
 * two failures.
 *
 * `window.history.length` is the signal because Next's App Router exposes no
 * "can I go back" of its own, and document.referrer is useless here: it is not
 * updated by client-side navigation, so every soft route change inside the app
 * leaves it reading whatever loaded the tab. The length check is only wrong for
 * someone who arrived from another site in a fresh tab, which in an
 * authenticated app means they passed through /login first and so have history
 * anyway.
 */
export default function BackButton({
    fallbackHref,
    label = "Back",
    showLabel = false,
    preferHistory = true,
    className,
}: {
    /** Where to go when there is no history to return to. */
    fallbackHref: string;
    label?: string;
    /** Off by default — most headers only have room for the arrow. */
    showLabel?: boolean;
    /**
     * Set false to always go to `fallbackHref`, ignoring history.
     *
     * For a page that pushes history entries of its own — the board, whose
     * amendments panel pushes a /Record/<id> URL — history-first would spend
     * the click closing a panel instead of leaving the page, so a control that
     * says "back to the workspace" would have to be pressed twice to do it.
     */
    preferHistory?: boolean;
    /**
     * Replaces the colour classes only (the box, size and layout are fixed).
     * Needed for the surfaces that still hardcode their own palette instead of
     * using the theme tokens — see LAYOUT.md §11.4.
     */
    className?: string;
}) {
    const router = useRouter();

    const goBack = () => {
        if (preferHistory && typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }

        router.push(fallbackHref);
    };

    return (
        <button
            type="button"
            onClick={goBack}
            title={label}
            aria-label={label}
            className={`flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg transition ${
                showLabel ? "px-2.5" : "w-9"
            } ${className || "text-muted hover:bg-control hover:text-slate-900"}`}
        >
            <TbChevronLeft className="h-[18px] w-[18px] shrink-0" />

            {showLabel && (
                <span className="font-google-sans text-sm font-medium">{label}</span>
            )}
        </button>
    );
}
