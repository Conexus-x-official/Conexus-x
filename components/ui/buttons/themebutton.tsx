"use client";

import { createElement, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
    HiOutlineComputerDesktop,
    HiOutlineSun,
    HiOutlineMoon,
    HiOutlineSwatch,
    HiChevronRight,
    HiCheck
} from "react-icons/hi2";
import { themes } from "@/data/data";

const subscribeNoop = () => () => { };

/**
 * ICONS, NOT COLOUR CIRCLES.
 *
 * Each theme used to be a filled circle of its own background colour, which is
 * the one thing about a theme you cannot read at 16px: System was mid-grey,
 * Light was a white circle that disappeared into the white menu behind it, and
 * the only one you could actually identify was Dark. A swatch answers "what
 * colour is this?" when the question is "which mode is this?" — sun, moon and
 * screen answer that at a glance, and they survive being rendered on any of the
 * themes they switch between.
 *
 * The list is keyed off `themes` in data/data.js exactly as before, so removing
 * a theme there still removes it from here. Icons are looked up by value with a
 * fallback, because that array is plain data and must not start importing React
 * components.
 */

const THEME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    system: HiOutlineComputerDesktop,
    light: HiOutlineSun,
    dark: HiOutlineMoon
};

/** A theme added to the array without an icon still renders something. */
const themeIcon = (value?: string) =>
    (value && THEME_ICONS[value]) || HiOutlineSwatch;

/**
 * Rendered as <ThemeIcon value={…} />, never as `const Icon = themeIcon(v)`
 * followed by <Icon />.
 *
 * The React Compiler rejects the second form with "Cannot create components
 * during render" — it cannot tell a lookup in a fixed table from a component
 * built fresh each render, and a component built fresh each render loses its
 * state. createElement inside a real component resolves the same table without
 * ever binding a component to a local name. Same rule, same fix, as
 * WorkspaceIcon in lib/workspaceIcons.tsx; it will bite any future
 * icon-by-key lookup.
 */
function ThemeIcon({ value, className }: { value?: string; className?: string }) {
    return createElement(themeIcon(value), { className });
}

export default function ThemeButton() {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    // The active theme is only known on the client, so render the neutral
    // state on the server and swap in the real selection after hydration.
    const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

    const activeTheme = mounted ? theme : undefined;

    /**
     * A theme that is no longer offered can still be sitting in localStorage
     * from before it was removed - next-themes reads storage without checking
     * it against the list. Falling back to the first entry keeps the trigger
     * from rendering as an empty slot; picking any row overwrites the stale
     * value for good.
     */
    const selectedTheme =
        themes.find((item) => item.value === activeTheme) ?? themes[0];

    return (
        <div className="w-full font-google-sans">
            {/*
                Opens IN PLACE rather than as a portalled menu, deliberately.
                This lives inside the profile dropdown, which closes on any
                mousedown outside its own ref — a portalled panel is outside
                that ref by definition, so picking a theme would dismiss the
                menu it was opened from. Same reason the status picker above it
                expands in place.
            */}
            <button
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-control/60 cursor-pointer"
            >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-600">
                    <ThemeIcon value={selectedTheme?.value} className="h-4 w-4" />
                </span>

                <span className="flex-1 text-left text-slate-800">Theme</span>

                <span className="text-xs font-medium text-muted">
                    {selectedTheme?.name}
                </span>

                <HiChevronRight
                    className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-90" : ""}`}
                />
            </button>

            <div
                className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
            >
                <div className="overflow-hidden">
                    <div className="space-y-0.5 pb-1 pl-3 pr-1">
                        {themes.map((item) => {
                            const active = activeTheme === item.value;

                            return (
                                <button
                                    key={item.value}
                                    onClick={() => {
                                        setTheme(item.value);
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition cursor-pointer ${active
                                        ? "nav-glass font-semibold text-slate-900"
                                        : "text-slate-700 hover:bg-control/60"
                                        }`}
                                >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                        <ThemeIcon value={item.value} className="h-4 w-4" />
                                    </span>

                                    <span className="flex-1">{item.name}</span>

                                    {active && (
                                        <HiCheck className="h-4 w-4 shrink-0 text-slate-900" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
