"use client";

import { useEffect, useRef, useState } from "react";
import { HiOutlinePaperAirplane } from "react-icons/hi2";
import { TbRoute } from "react-icons/tb";

/**
 * Relay — the workflow agent.
 *
 * Owns automation only: the trigger / conditions / actions recipes that run
 * without anyone opening a board. It never edits records directly — that is
 * Aquiline's job (components/ai/AgentChat.tsx).
 *
 * UI shell only. There is no model behind it yet, so sending appends the user's
 * message plus a standing notice rather than inventing an answer. When the
 * endpoint lands, the agent reply slot is where the drafted recipe gets rendered
 * for review before it is saved.
 */

interface Message {
    id: string;
    author: "user" | "agent";
    text: string;
}

const SUGGESTIONS = [
    "When status changes to Done, notify the record owner",
    "Every Monday, create a weekly review record",
    "Archive records that have been Won for 30 days",
    "Assign new leads to whoever has the fewest open records"
];

interface WorkflowAgentProps {
    /** Workspace the workflow would run in. */
    context?: string;
}

export default function WorkflowAgent({ context }: WorkflowAgentProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState("");

    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length]);

    const handleSend = () => {
        const text = draft.trim();
        if (!text) return;

        const now = Date.now();
        setMessages((prev) => [
            ...prev,
            { id: `u-${now}`, author: "user", text },
            {
                id: `a-${now}`,
                author: "agent",
                text:
                    "Relay is not connected to a model yet — this panel is the interface only. " +
                    "Once the agent endpoint is live, the workflow it drafts will appear here as a " +
                    "trigger, its conditions and its actions, for you to edit before saving."
            }
        ]);
        setDraft("");
    };

    const isEmpty = messages.length === 0;

    return (
        <div className="flex min-h-0 flex-1 flex-col font-google-sans">

            {/* ── Thread ────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">

                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <TbRoute className="h-6 w-6" />
                        </span>

                        <h3 className="text-sm font-bold text-slate-900">Relay</h3>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                            Workflow Agent
                        </p>

                        <p className="mx-auto mt-2 max-w-[16rem] text-xs leading-relaxed text-muted">
                            Builds the rules that run without you — describe what should happen and
                            when, and Relay turns it into a workflow.
                        </p>

                        <div className="mt-5 w-full space-y-1.5">
                            {SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => {
                                        setDraft(suggestion);
                                        inputRef.current?.focus();
                                    }}
                                    className="w-full rounded-lg border border-hairline bg-control/30 px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-accent/40 hover:bg-control/60 hover:text-slate-900 cursor-pointer"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {messages.map((message) =>
                            message.author === "user" ? (
                                <div key={message.id} className="flex justify-end">
                                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-xs leading-relaxed text-white">
                                        {message.text}
                                    </p>
                                </div>
                            ) : (
                                <div key={message.id} className="flex items-start gap-2">
                                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                                        <TbRoute className="h-3.5 w-3.5" />
                                    </span>
                                    <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-control/60 px-3 py-2 text-xs leading-relaxed text-slate-700">
                                        {message.text}
                                    </p>
                                </div>
                            )
                        )}
                        <div ref={endRef} />
                    </div>
                )}
            </div>

            {/* ── Composer ──────────────────────────────────────────── */}
            <div className="border-t border-hairline p-3">
                {context && (
                    <div className="mb-2 flex items-center gap-1.5 px-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span className="truncate text-[10px] font-medium text-muted">
                            Runs in <span className="text-slate-700">{context}</span>
                        </span>
                    </div>
                )}

                <div className="rounded-xl border border-hairline bg-control/40 transition focus-within:border-accent focus-within:bg-card">
                    <textarea
                        ref={inputRef}
                        rows={2}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Describe a workflow for Relay to build…"
                        className="w-full resize-none bg-transparent px-3 pt-2.5 text-xs leading-relaxed text-slate-800 outline-none placeholder:text-muted"
                    />

                    <div className="flex items-center justify-between px-2 pb-2">
                        <span className="pl-1 text-[10px] font-medium text-muted">
                            Enter to send · Shift+Enter for a new line
                        </span>

                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={!draft.trim()}
                            aria-label="Send"
                            title="Send"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                            <HiOutlinePaperAirplane className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
