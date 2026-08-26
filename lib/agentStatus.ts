"use client";

/**
 * Whether the agent is working, and whether it is working AT ALL.
 *
 * The panel's header sits in AiSidebar while the request that decides the
 * status happens inside AgentChat, two components down. Rather than lift the
 * chat's state or thread a prop through the rail, the status is published the
 * way this codebase already publishes cross-component signals (crm:toast,
 * crm:user-updated, crm:workspace-visited): a window event plus a snapshot read
 * through useSyncExternalStore.
 *
 * SHAPE CARRIES THE MEANING as well as colour, following presenceDot — a
 * pulsing ring for working, a hollow dot for idle-but-untested, a barred dot
 * for a fault. Someone who cannot separate amber from green still gets it.
 */

export type AgentState = "ready" | "working" | "issue" | "offline";

export interface AgentStatusSpec {
    value: AgentState;
    label: string;
    hint: string;
    /** Fixed hex, matching PRESENCE_OPTIONS — a status colour is not a theme token. */
    color: string;
}

export const AGENT_STATUSES: AgentStatusSpec[] = [
    {
        value: "ready",
        label: "Ready",
        hint: "Connected and waiting for a request",
        color: "#22C55E",
    },
    {
        value: "working",
        label: "Working",
        hint: "Reading your workspace and making changes",
        color: "#F59E0B",
    },
    {
        value: "issue",
        label: "Issue",
        hint: "The last request did not go through",
        color: "#EF4444",
    },
    {
        value: "offline",
        label: "Unavailable",
        hint: "The agent service is not reachable",
        color: "#94A3B8",
    },
];

export const agentStatusSpec = (state?: AgentState | null) =>
    AGENT_STATUSES.find((status) => status.value === state) ?? AGENT_STATUSES[0];

const EVENT = "crm:agent-status";

/**
 * Module-level, not localStorage.
 *
 * This describes the CURRENT session's connection to the agent. Persisting it
 * would mean a page opening with a red dot because something failed yesterday,
 * which is a claim about right now that nothing has checked.
 */
let current: AgentState = "ready";

export const setAgentStatus = (next: AgentState) => {
    if (next === current) return;

    current = next;

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(EVENT));
    }
};

export const readAgentStatus = (): AgentState => current;

/** The server always renders the neutral state, so hydration agrees. */
export const readAgentStatusServer = (): AgentState => "ready";

export const subscribeAgentStatus = (onChange: () => void) => {
    if (typeof window === "undefined") return () => { };

    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
};
