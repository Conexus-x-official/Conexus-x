"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image, { type StaticImageData } from "next/image";
import { TbRoute } from "react-icons/tb";
import { HiOutlineXMark } from "react-icons/hi2";
import AgentChat from "./ai/AgentChat";
import WorkflowAgent from "./ai/WorkflowAgent";
import AgentStatusDot from "./ai/AgentStatusDot";
import {
    agentStatusSpec,
    readAgentStatus,
    readAgentStatusServer,
    subscribeAgentStatus,
} from "@/lib/agentStatus";
import {
    readAgentPanelOpen,
    readAgentPanelOpenServer,
    setAgentPanelOpen,
    subscribeAgentPanelOpen,
} from "@/lib/agentPanel";
import aquilineLogo from "@/app/assets/Aquiline.png";

/**
 * The right rail. Pure chrome: it opens, closes, and renders whichever agent
 * the current page asked for.
 *
 * There is deliberately no agent switcher — the page decides. Automations get
 * Relay; everything else (workspace, board) gets Aquiline. A user picking the
 * wrong agent for the page they are on could only ever produce a dead end.
 */

/**
 * The open width, in pixels rather than as `w-96`.
 *
 * Animating a Tailwind class is not a thing — the transition needs a number to
 * interpolate toward, and the same number has to pin the CONTENT so it does not
 * reflow mid-animation (see the inner wrapper below).
 */
const PANEL_WIDTH = 384;

/** A page can ask the rail to open — see the automation page's empty state. */
export const OPEN_AGENT_EVENT = "crm:open-agent";

export type AgentKind = "aquiline" | "relay";

/**
 * `image` wins over `icon` where both could apply: Aquiline has a mark of its
 * own, and a glyph standing in for a brand that HAS a logo is a placeholder
 * nobody got round to replacing. Relay has no mark yet and keeps its glyph.
 */
const AGENT_META: Record<
    AgentKind,
    { name: string; role: string; icon: typeof TbRoute; image?: StaticImageData }
> = {
    aquiline: {
        name: "Aquiline",
        role: "CRM Agent",
        icon: TbRoute,
        image: aquilineLogo
    },
    relay: { name: "Relay", role: "Workflow Agent", icon: TbRoute }
};

interface AiSidebarProps {
    /** Which agent this page runs. */
    agent: AgentKind;
    /** Workspace or board name the agent is pointed at. */
    context?: string;
    /** Ids Aquiline resolves "here" and "this board" against. */
    workspaceId?: string;
    moduleId?: string;
}

export default function AiSidebar({ agent, context, workspaceId, moduleId }: AiSidebarProps) {
    /**
     * Open state lives in lib/agentPanel.ts, not here — see the note there.
     * Short version: this component remounts on every route change, and an
     * effect-corrected flag made the panel flicker shut and open again each
     * time. Through the store the first render already knows.
     */
    const open = useSyncExternalStore(
        subscribeAgentPanelOpen,
        readAgentPanelOpen,
        readAgentPanelOpenServer
    );

    /**
     * Sticky once true — the panel's CONTENT stays mounted from the first open
     * onward, even while it is closed.
     *
     * This is what makes reopening smooth. Opening used to mount the whole
     * AgentChat tree — its thread, its RTK Query subscriptions, its effects —
     * on the same frames the width animation was running, so open stuttered
     * while close (which only tears down) did not. Now only the FIRST open pays
     * that cost; every one after animates a tree that is already there.
     *
     * It also fixes a real behaviour bug rather than just the jank: closing the
     * panel used to throw the conversation away, so reopening started from an
     * empty thread. Nobody asked for that and nothing said it would happen.
     */
    const [everOpened, setEverOpened] = useState(false);

    /**
     * Mount the content for an ALREADY-open panel too, not only for one the
     * user has opened during this visit.
     *
     * This is the reload bug: everOpened started false, so refreshing with the
     * panel open restored the 384px of width and none of the panel — a white
     * column that only closing and reopening fixed. Deriving it from `open`
     * keeps the "pay nothing until asked" rule intact (a panel that has never
     * been opened still builds nothing) while making a reload look like what
     * the user left.
     */
    const showContent = open || everOpened;

    // Published by AgentChat two levels down — see lib/agentStatus.ts for why
    // it travels as an event rather than a prop.
    const agentState = useSyncExternalStore(
        subscribeAgentStatus,
        readAgentStatus,
        readAgentStatusServer
    );

    // Subscribing to an event is what an effect is FOR; note that nothing here
    // sets state during the effect itself, only inside the handler.
    useEffect(() => {
        const onOpenRequest = () => {
            setEverOpened(true);
            setAgentPanelOpen(true);
        };

        window.addEventListener(OPEN_AGENT_EVENT, onOpenRequest);
        return () => window.removeEventListener(OPEN_AGENT_EVENT, onOpenRequest);
    }, []);

    const toggle = () => {
        setEverOpened(true);
        setAgentPanelOpen(!open);
    };

    const meta = AGENT_META[agent];
    const Icon = meta.icon;

    /**
     * OPEN AND CLOSE ARE ANIMATED, and the panel is a flex sibling that pushes
     * the page — so the thing being animated is its WIDTH, not a transform.
     * A transform would slide the panel over the content and leave the gap it
     * occupied snapping shut behind it, which is the jump this replaces.
     *
     * The inner wrapper is pinned to PANEL_WIDTH and the outer one clips it.
     * Without that the content re-wraps on every frame as the box narrows —
     * the message column reflowing 60 times a second reads as a glitch rather
     * than a transition.
     *
     * The panel element is ALWAYS rendered once it has been opened; only its
     * width changes. `initial={false}` means the very first paint jumps
     * straight to the right width instead of animating from zero, so a page
     * load with the panel already open plays no entrance.
     *
     * `inert` while closed: a zero-width box is still in the tab order, and a
     * focus landing inside something nobody can see is the classic way this
     * pattern goes wrong.
     */
    return (
        <>
            <motion.aside
                initial={false}
                animate={{ width: open ? PANEL_WIDTH : 0 }}
                transition={{
                    // Matches the tab strip and the board's drag springs, so
                    // motion feels like one system rather than per-component
                    // taste. damping high enough not to overshoot a panel edge,
                    // which reads as a wobble at this size.
                    type: "spring",
                    stiffness: 420,
                    damping: 40,
                }}
                inert={!open}
                aria-hidden={!open}
                className="h-screen shrink-0 overflow-hidden sticky top-0 bg-card font-google-sans"
            >
                {/* The border lives on the INNER box: on the outer one it would
                    still paint a 1px sliver at zero width. */}
                <div
                    style={{ width: PANEL_WIDTH }}
                    className="flex h-full flex-col border-l border-slate-200"
                >

            {/* ── Header ────────────────────────────────────────────
                 Names the agent this page runs, rather than offering a choice.
                 h-16 matches the page header next to it so the two bottom
                 borders form one continuous rule across the window. */}
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3">
                <div className="flex min-w-0 items-center gap-2">
                    {/* The badge hangs off the mark exactly as presence hangs
                        off an avatar — same place, same size, so "is it up?"
                        is read the same way as "is she around?". */}
                    <span className="relative shrink-0">
                        {/* p-1.5, matching the tiles in the thread — the mark
                            is a full-bleed square and touches the tile edge
                            without an inset, which reads as a cropped image. */}
                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-control p-1.5">
                            {meta.image ? (
                                <Image
                                    src={meta.image}
                                    alt=""
                                    className="h-full w-full object-contain"
                                    priority
                                />
                            ) : (
                                <Icon className="h-4 w-4 text-body" />
                            )}
                        </span>

                        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5">
                            <AgentStatusDot status={agentState} size={10} ring={2} />
                        </span>
                    </span>

                    <span className="min-w-0">
                        <span className="block truncate text-sm font-bold leading-tight text-slate-900">
                            {meta.name}
                        </span>
                        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                            {agentStatusSpec(agentState).label}
                        </span>
                    </span>
                </div>

                <button
                    type="button"
                    onClick={toggle}
                    title="Close panel"
                    aria-label="Close panel"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                >
                    <HiOutlineXMark className="h-4 w-4" />
                </button>
            </div>

                    {/* Nothing is built until the panel is first asked for —
                        a page where it is never opened pays nothing. */}
                    {showContent &&
                        (agent === "relay" ? (
                            <WorkflowAgent context={context} />
                        ) : (
                            <AgentChat
                                context={context}
                                workspaceId={workspaceId}
                                moduleId={moduleId}
                            />
                        ))}
                </div>
            </motion.aside>

            <AnimatePresence initial={false}>
                {!open && (
                    /* Fades in as the panel finishes closing, so the two are
                       never both drawn at full strength. */
                    <motion.button
                        key="launcher"
                        type="button"
                        onClick={toggle}
                        // The status is on the badge; it belongs in the label
                        // too, since a colour alone is not an accessible name.
                        title={`Ask ${meta.name} — ${agentStatusSpec(agentState).label}`}
                        aria-label={`Ask ${meta.name} — ${agentStatusSpec(agentState).label}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.18 }}
                        // bottom-20, not bottom-6: at 6 the launcher sat ON the
                        // page's bottom bar and covered the pagination's Next
                        // button. 5rem clears a ~60px footer with room to spare.
                        //
                        // A SQUIRCLE, not a circle: this is the agent's own
                        // tile, and it is the same rounded square its mark wears
                        // in the panel header and against every reply in the
                        // thread. One shape for one identity.
                        className="fixed right-4 bottom-20 z-40 flex h-11 w-11 items-center justify-center rounded-2xl border border-hairline bg-card p-2 shadow-lg transition hover:bg-control cursor-pointer"
                    >
                        {/* The agent's face, not a generic sparkle: what opens
                            is Aquiline, so what you press should look like it. */}
                        {meta.image ? (
                            <Image
                                src={meta.image}
                                alt=""
                                className="h-full w-full object-contain"
                            />
                        ) : (
                            <Icon className="h-5 w-5 text-body" />
                        )}

                        {/* Same badge in the same corner as the header's, so
                            "is it up?" is read the same way whether the panel is
                            open or shut. */}
                        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5">
                            <AgentStatusDot status={agentState} size={11} ring={2} />
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

        </>
    );
}
