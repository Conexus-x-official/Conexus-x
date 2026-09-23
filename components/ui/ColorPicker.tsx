"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IoColorPaletteSharp } from "react-icons/io5";
import { HiCheck } from "react-icons/hi2";

import { STATUS_SWATCHES } from "@/data/data";

/**
 * A reusable colour picker — preset swatches plus a palette button that opens a
 * full custom picker (saturation/value area + hue slider + hex field).
 *
 * The custom picker is PORTALLED and viewport-aware: it opens anchored to the
 * palette button and flips above / shifts left so it is never clipped by the
 * edge of the screen or by the scrolling menu it usually sits inside. Gated on
 * `customOpen` (starts false), so the `typeof document` guard is hydration-safe.
 *
 * Theme-aware by construction — every surface uses semantic tokens and the
 * picker gradients are intrinsic colours that read the same in light and dark.
 *
 *   <ColorPicker value={hex} onChange={setHex} />
 */

// ── hex ⇄ hsv ─────────────────────────────────────────────────────────────────
function normaliseHex(hex: string): string {
    let clean = (hex || "").trim().replace(/^#/, "");
    if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "";
    return `#${clean.toUpperCase()}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
    const clean = normaliseHex(hex).replace("#", "") || "000000";
    const n = parseInt(clean, 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    if (d !== 0) {
        if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (val: number) =>
        Math.round((val + m) * 255)
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ── the custom picker (sat/val square + hue rail + hex field) ─────────────────
function CustomPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (hex: string) => void;
}) {
    const { h, s, v } = hexToHsv(value);
    // Local buffer so a half-typed hex ("#3b") is not rejected mid-keystroke;
    // null means "show the committed value" — no effect needed to sync.
    const [draft, setDraft] = useState<string | null>(null);
    const shownHex = draft ?? (normaliseHex(value).replace("#", "") || "");

    const emit = (nh: number, ns: number, nv: number) =>
        onChange(hsvToHex((nh + 360) % 360, clamp(ns, 0, 1), clamp(nv, 0, 1)));

    const pointFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        return {
            x: clamp((e.clientX - r.left) / r.width, 0, 1),
            y: clamp((e.clientY - r.top) / r.height, 0, 1),
        };
    };

    const hueColor = hsvToHex(h, 1, 1);

    return (
        <div className="space-y-2">
            {/* Saturation / value */}
            <div
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const p = pointFromEvent(e);
                    emit(h, p.x, 1 - p.y);
                }}
                onPointerMove={(e) => {
                    if (e.buttons !== 1) return;
                    const p = pointFromEvent(e);
                    emit(h, p.x, 1 - p.y);
                }}
                className="relative h-28 w-full cursor-crosshair rounded-lg border border-slate-200 touch-none"
                style={{
                    backgroundColor: hueColor,
                    backgroundImage:
                        "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))",
                }}
            >
                <span
                    className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                    style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, backgroundColor: normaliseHex(value) || "#000" }}
                />
            </div>

            {/* Hue */}
            <div
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    emit(pointFromEvent(e).x * 360, s, v);
                }}
                onPointerMove={(e) => {
                    if (e.buttons !== 1) return;
                    emit(pointFromEvent(e).x * 360, s, v);
                }}
                className="relative h-3 w-full cursor-ew-resize rounded-full border border-slate-200 touch-none"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                }}
            >
                <span
                    className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                    style={{ left: `${(h / 360) * 100}%`, backgroundColor: hueColor }}
                />
            </div>

            {/* Hex field */}
            <div className="flex items-center gap-2">
                <span
                    className="h-7 w-7 shrink-0 rounded-md border border-slate-200"
                    style={{ backgroundColor: normaliseHex(value) || "transparent" }}
                />
                <div className="flex flex-1 items-center rounded-md border border-hairline bg-control px-2 focus-within:border-foreground">
                    <span className="text-xs font-semibold text-muted">#</span>
                    <input
                        value={shownHex}
                        onChange={(e) => {
                            const next = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                            setDraft(next);
                            const valid = normaliseHex(next);
                            if (valid) onChange(valid);
                        }}
                        onBlur={() => setDraft(null)}
                        placeholder="000000"
                        spellCheck={false}
                        className="w-full bg-transparent px-1 py-1.5 text-xs font-mono uppercase text-foreground outline-none"
                    />
                </div>
            </div>
        </div>
    );
}

// ── the control ──────────────────────────────────────────────────────────────
const PANEL_W = 232;
const PANEL_H = 214;
const GAP = 8;
const EDGE = 12;

export default function ColorPicker({
    value,
    onChange,
    swatches = STATUS_SWATCHES,
    className = "",
}: {
    value: string;
    onChange: (hex: string) => void;
    swatches?: string[];
    className?: string;
}) {
    const [customOpen, setCustomOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    const toggleRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const active = normaliseHex(value);
    const isPreset = swatches.some((sw) => normaliseHex(sw) === active);

    /**
     * Anchor the panel to the palette button, then keep it on screen: shift it
     * left when it would run off the right edge, flip it above when there is no
     * room below (and vice-versa), and clamp both axes to a small margin.
     */
    const placePanel = () => {
        const btn = toggleRef.current;
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = r.left;
        if (left + PANEL_W > vw - EDGE) left = r.right - PANEL_W;
        left = clamp(left, EDGE, Math.max(EDGE, vw - PANEL_W - EDGE));

        let top = r.bottom + GAP;
        if (top + PANEL_H > vh - EDGE) {
            const above = r.top - GAP - PANEL_H;
            top = above >= EDGE ? above : clamp(top, EDGE, Math.max(EDGE, vh - PANEL_H - EDGE));
        }

        setPos({ top, left });
    };

    const openCustom = () => {
        placePanel();
        setCustomOpen(true);
    };

    useEffect(() => {
        if (!customOpen) return;

        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (toggleRef.current?.contains(t)) return;
            if (panelRef.current?.contains(t)) return;
            setCustomOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setCustomOpen(false);
        };
        // The picker often lives inside a scrolling menu — re-anchor as it moves.
        const reflow = () => placePanel();

        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", reflow);
        window.addEventListener("scroll", reflow, true);

        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", reflow);
            window.removeEventListener("scroll", reflow, true);
        };
    }, [customOpen]);

    return (
        <div className={className}>
            <div className="flex flex-wrap items-center gap-1.5">
                {swatches.map((swatch) => {
                    const on = normaliseHex(swatch) === active;
                    return (
                        <button
                            key={swatch}
                            type="button"
                            onClick={() => {
                                onChange(swatch);
                                setCustomOpen(false);
                            }}
                            aria-label={`Use ${swatch}`}
                            className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition ${
                                on ? "ring-2 ring-offset-1 ring-offset-card ring-foreground" : "hover:scale-110"
                            }`}
                            style={{ backgroundColor: swatch }}
                        >
                            {on && <HiCheck className="h-3 w-3 text-white drop-shadow" />}
                        </button>
                    );
                })}

                {/* Custom colour toggle */}
                <button
                    ref={toggleRef}
                    type="button"
                    onClick={() => (customOpen ? setCustomOpen(false) : openCustom())}
                    aria-label="Custom colour"
                    aria-pressed={customOpen}
                    className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border transition ${
                        customOpen || !isPreset
                            ? "border-foreground text-foreground"
                            : "border-slate-300 text-muted hover:border-slate-400 hover:text-foreground"
                    }`}
                    style={
                        !isPreset && active
                            ? { backgroundColor: active, borderColor: active, color: "#fff" }
                            : undefined
                    }
                >
                    <IoColorPaletteSharp className="h-3 w-3" />
                </button>
            </div>

            {customOpen && pos && typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={panelRef}
                        style={{ top: pos.top, left: pos.left, width: PANEL_W }}
                        className="fixed z-[100] rounded-xl border border-hairline bg-card p-2.5 shadow-2xl font-google-sans animate-in fade-in zoom-in-95 duration-100"
                    >
                        <CustomPicker value={active || "#000000"} onChange={onChange} />
                    </div>,
                    document.body
                )}
        </div>
    );
}
