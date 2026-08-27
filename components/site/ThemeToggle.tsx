"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { HiOutlineSun, HiOutlineMoon } from "react-icons/hi2";

/**
 * Light / dark, in one press.
 *
 * The app's own picker (components/ui/buttons/themebutton.tsx) offers System /
 * Light / Dark as a list inside the profile menu, which is right for a settings
 * surface someone opens on purpose. This is the public site, where the control
 * has to be visible and cost one click — so it is a TOGGLE, and the icon shows
 * what pressing it will DO rather than what is currently on. A sun on a dark
 * page means "go light"; that reading is the whole affordance.
 *
 * It resolves rather than reads: someone on "system" has no explicit theme, so
 * `theme` is the string "system" and only `resolvedTheme` says which of the two
 * is actually painted. Toggling from resolved is what makes the first press do
 * the obvious thing instead of appearing to do nothing.
 */

const subscribeNoop = () => () => { };

export default function ThemeToggle({ className = "" }: { className?: string }) {
    const { resolvedTheme, setTheme } = useTheme();

    /**
     * The theme is only knowable on the client, so the server renders the
     * neutral state and the real one swaps in after hydration. Same
     * useSyncExternalStore shape ThemeButton uses — React takes the SERVER
     * snapshot for the hydrating render too, so both passes agree and there is
     * no mismatch to throw the tree away over.
     */
    const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

    const isDark = mounted && resolvedTheme === "dark";
    const next = isDark ? "light" : "dark";

    return (
        <button
            type="button"
            onClick={() => setTheme(next)}
            // Before hydration nothing is known, so the label stays generic
            // rather than claiming a direction that may be wrong.
            aria-label={mounted ? `Switch to ${next} theme` : "Switch theme"}
            title={mounted ? `Switch to ${next} theme` : "Switch theme"}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600 transition-colors hover:bg-control hover:text-foreground ${className}`}
        >
            {/*
                Both glyphs are always mounted and cross-faded, so the button
                never changes size mid-press and there is no icon swap to flash
                on hydration. `hidden` would reflow; opacity + rotate does not.
            */}
            <span className="relative flex h-4 w-4 items-center justify-center">
                <HiOutlineSun
                    className={`absolute h-4 w-4 transition-all duration-300 ${
                        isDark ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
                    }`}
                />
                <HiOutlineMoon
                    className={`absolute h-4 w-4 transition-all duration-300 ${
                        isDark ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
                    }`}
                />
            </span>
        </button>
    );
}
