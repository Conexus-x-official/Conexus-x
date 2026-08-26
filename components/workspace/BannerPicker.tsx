"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { HiCheck, HiOutlineXMark } from "react-icons/hi2";

import { BANNERS, bannerKeyOf } from "@/lib/banners";

/**
 * Choosing this workspace's cover.
 *
 * A GRID, because the point is seeing them side by side — a dropdown of names
 * ("Ridge", "Default") tells you nothing about what you are picking. Same
 * reasoning as the workspace icon picker.
 *
 * Portalled and positioned from the trigger's own rect, following ModulePicker
 * and BoardAccessMenu: the banner sits inside an `overflow-hidden` card, which
 * would otherwise clip the panel. The hydration rule comes with the pattern —
 * the `typeof document` guard is safe ONLY because the render is also gated on
 * `open`, which starts false, so server and first client render both produce
 * nothing and agree.
 */

const PANEL_WIDTH = 320;

export default function BannerPicker({
    value,
    saving,
    onPick,
}: {
    /** The stored value — a catalog key or a URL. */
    value?: string;
    saving: boolean;
    onPick: (key: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(
        null
    );

    const anchorRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setOpen(false);
        };

        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        // Capture phase — the page scrolls, and a fixed panel detaches from its
        // trigger the moment it does.
        const onScroll = () => setOpen(false);

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);
        document.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [open]);

    const activeKey = bannerKeyOf(value);

    const toggle = () => {
        if (!open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();

            setPosition({
                top: rect.bottom + 8,
                // Right-aligned to the trigger, then clamped so a button near
                // the edge cannot open a panel that runs off screen.
                left: Math.max(
                    12,
                    Math.min(
                        rect.right - PANEL_WIDTH,
                        window.innerWidth - PANEL_WIDTH - 12
                    )
                ),
            });
        }

        setOpen((current) => !current);
    };

    const pick = (key: string) => {
        setOpen(false);
        if (key !== activeKey) onPick(key);
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onClick={toggle}
                disabled={saving}
                aria-haspopup="dialog"
                aria-expanded={open}
                title="Change cover"
                aria-label="Change cover"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/40 bg-black/35 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/50 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
                {/* A pencil, drawn inline: lucide is not imported here and one
                    glyph does not justify pulling the package into this file. */}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 shrink-0"
                >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {saving ? "Saving…" : "Cover"}
            </button>

            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={panelRef}
                        role="dialog"
                        aria-label="Choose a cover"
                        style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
                        className="fixed z-50 overflow-hidden rounded-xl border border-hairline bg-card shadow-xl font-dmsans"
                    >
                        <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
                            <span className="text-xs font-semibold text-foreground">
                                Choose a cover
                            </span>

                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close"
                                className="rounded p-0.5 text-muted transition hover:text-foreground cursor-pointer"
                            >
                                <HiOutlineXMark className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="max-h-80 space-y-2 overflow-y-auto p-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                            {BANNERS.map((banner) => {
                                const selected = banner.key === activeKey;

                                return (
                                    <button
                                        key={banner.key}
                                        type="button"
                                        onClick={() => pick(banner.key)}
                                        aria-pressed={selected}
                                        className={`relative block h-20 w-full overflow-hidden rounded-lg transition cursor-pointer ${selected
                                            ? "nav-glass"
                                            : "border border-hairline hover:opacity-90"
                                            }`}
                                    >
                                        <Image
                                            src={banner.url}
                                            alt={banner.label}
                                            fill
                                            sizes="320px"
                                            className="object-cover"
                                        />

                                        {/* The label needs to survive whatever
                                            the art is doing underneath it. */}
                                        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/45 px-2 py-1 text-[11px] font-semibold text-white">
                                            {banner.label}
                                            {selected && <HiCheck className="h-3.5 w-3.5" />}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
