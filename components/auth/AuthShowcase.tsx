"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/app/assets/Logo.png";
import BoardMock from "@/components/site/previews/BoardMock";
import AutomationMock from "@/components/site/previews/AutomationMock";
import MeetMock from "@/components/site/previews/MeetMock";

/**
 * The panel beside the sign-in and sign-up forms.
 *
 * ONE component for both pages. They had a copy each, and the copies had
 * already drifted: login rotated its slides on a timer, register rendered the
 * same markup with no timer at all, so the dots there looked like a control
 * that did nothing. Whichever page you saw second was the one that looked
 * broken.
 *
 * It shows the PRODUCT, not a slogan on a coloured rectangle. The mocks are
 * the same ones the marketing pages use (components/site/previews/), so there
 * is one set of screenshots for the whole public surface and no second set to
 * fall out of date. They are already role="presentation" + aria-hidden, so the
 * carousel contributes its heading and description to the accessibility tree
 * and not forty fragments of fake table.
 */

const SLIDES = [
    {
        heading: "Shape your own boards",
        desc: "Name your modules, collections and columns. Fourteen typed column kinds, and no pipeline imposed on you.",
        mock: <BoardMock />,
    },
    {
        heading: "Automate the repetition",
        desc: "Build a rule by filling in a sentence, then read every run back in the activity log.",
        mock: <AutomationMock />,
    },
    {
        heading: "Talk where the work is",
        desc: "Messages, team threads and calls in the same place as the records you are discussing.",
        mock: <MeetMock />,
    },
];

const ROTATE_MS = 7000;

export default function AuthShowcase() {
    const [slide, setSlide] = useState(0);

    useEffect(() => {
        // Someone who has asked for reduced motion gets a static panel and the
        // dots to move it themselves — an auto-advancing carousel is exactly
        // the motion that setting is about.
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) return;

        const interval = setInterval(() => {
            setSlide((prev) => (prev + 1) % SLIDES.length);
        }, ROTATE_MS);

        return () => clearInterval(interval);
    }, []);

    const current = SLIDES[slide];

    return (
        <div className="auth-panel relative hidden overflow-hidden rounded-2xl lg:flex lg:w-[45%] lg:flex-col">
            {/* ------------------------------------------------------ brand */}
            <div className="shrink-0 p-8">
                <Link href="/" aria-label="Conexus X home" className="inline-block cursor-pointer">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur-sm">
                        <Image src={logo} alt="" aria-hidden />
                    </div>
                </Link>
            </div>

            {/* ------------------------------------------------ the product */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6">
                {/*
                    The mock is pinned to a real screenshot width and does not
                    reflow: the board's columns are fixed, so letting it get
                    narrow crushes them into each other and it stops looking
                    like the product. Below its min-width it scrolls inside its
                    own frame instead.

                    Which is why the pane above is px-6 and not px-10 — at this
                    panel's 45%, those 32px are what keeps the widest mock
                    (520px) whole on a 1280px screen rather than starting out
                    already scrolled.
                */}
                <div
                    key={slide}
                    className="w-[560px] max-w-full animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                    <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                        {current.mock}
                    </div>
                </div>
            </div>

            {/* -------------------------------------------------- the caption */}
            <div className="shrink-0 px-10 pb-10 pt-8">
                {/* aria-live: the text changes under the reader without any
                    interaction, so it has to be announced rather than silently
                    replaced. Polite — it must never interrupt someone typing
                    their password in the form beside it. */}
                <div aria-live="polite" className="min-h-[76px]">
                    <h2 className="font-google-sans text-xl font-bold text-white">{current.heading}</h2>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">{current.desc}</p>
                </div>

                <div className="mt-6 flex gap-2">
                    {SLIDES.map((item, i) => (
                        <button
                            key={item.heading}
                            type="button"
                            onClick={() => setSlide(i)}
                            aria-label={`Show: ${item.heading}`}
                            aria-current={i === slide}
                            // A 6px dot is not a touch target. The button keeps a
                            // 20px hit area and only the inner span is the dot.
                            className="group cursor-pointer p-1.5"
                        >
                            <span
                                className={`block h-1.5 rounded-full transition-all duration-300 ${
                                    i === slide ? "w-6 bg-white" : "w-1.5 bg-white/40 group-hover:bg-white/70"
                                }`}
                            />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
