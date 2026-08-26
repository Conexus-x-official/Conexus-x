"use client";

import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { themes } from "@/data/data";

const subscribeNoop = () => () => { };

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
     * swatch from rendering as an empty circle; picking any row overwrites the
     * stale value for good.
     */
    const selectedTheme =
        themes.find((item) => item.value === activeTheme) ?? themes[0];

    return (
        <div className="w-full">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between rounded-lg px-5 py-1 text-sm font-medium hover:bg-gray-50 transition cursor-pointer mb-1"
            > 
                <span>Theme</span>

                <div className="flex items-center gap-2">
                    <span
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{
                            backgroundColor: selectedTheme?.bg_hex,
                        }}
                    />
                </div>
            </button>

            <div
                className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
            >
                <div className="overflow-hidden">
                    <div className="px-5 pb-1 space-y-0.5 ">
                        {themes.map((item) => (
                            <button
                                key={item.value}
                                onClick={() => {
                                    setTheme(item.value);
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition cursor-pointer ${activeTheme === item.value
                                    ? "bg-gray-100 font-medium"
                                    : "hover:bg-gray-50"
                                    }`}
                            >
                                <span>{item.name}</span>

                                <span
                                    className="w-5 h-5 rounded-full border border-gray-300"
                                    style={{
                                        backgroundColor: item.bg_hex,
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}