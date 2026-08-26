"use client";

import { agentStatusSpec, type AgentState } from "@/lib/agentStatus";

/**
 * The agent's own status badge — the counterpart to presenceDot for a person.
 *
 * Deliberately the SAME visual grammar as presence: a small dot on the avatar,
 * fixed status hexes rather than theme tokens, and shape doing as much work as
 * colour. Reusing PresenceDot itself was the alternative, but its states are
 * the human ones (available / dnd / offline) and overloading them so "busy"
 * secretly meant "the API rejected our key" would make both harder to read.
 *
 *   working  — a pulsing halo, because it is the only state that is temporary
 *   issue    — barred, the same bar dnd uses for "do not proceed"
 *   offline  — hollow, exactly as an offline person is drawn
 *   ready    — filled
 */
export default function AgentStatusDot({
    status,
    size = 10,
    ring = 2,
    ringColor = "var(--card)",
    className = "",
}: {
    status: AgentState;
    size?: number;
    /** Halo separating the dot from whatever it sits on; 0 removes it. */
    ring?: number;
    ringColor?: string;
    className?: string;
}) {
    const spec = agentStatusSpec(status);
    const isOffline = spec.value === "offline";

    return (
        <span
            title={`${spec.label} — ${spec.hint}`}
            aria-label={`Agent status: ${spec.label}`}
            role="status"
            className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
            style={{
                width: size,
                height: size,
                backgroundColor: isOffline ? ringColor : spec.color,
                border: isOffline
                    ? `${Math.max(1.5, size * 0.18)}px solid ${spec.color}`
                    : "none",
                boxShadow: ring ? `0 0 0 ${ring}px ${ringColor}` : undefined,
            }}
        >
            {/* The bar reads as "stopped" — the same mark dnd uses. */}
            {spec.value === "issue" && (
                <span
                    className="block rounded-full bg-white"
                    style={{ width: size * 0.5, height: Math.max(1.5, size * 0.16) }}
                />
            )}

            {/* Motion only while something is genuinely in flight, so a moving
                dot always means work is happening. */}
            {spec.value === "working" && (
                <span
                    className="absolute inset-0 animate-ping rounded-full opacity-60"
                    style={{ backgroundColor: spec.color }}
                />
            )}
        </span>
    );
}
