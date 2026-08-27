import { Mic, Phone, Search, Send, Video } from "lucide-react";
import MockFrame from "./MockFrame";

/**
 * A picture of Conexus Meet.
 *
 * Two panes, as the real page is: one conversation list spanning every
 * workspace, and the thread beside it. The presence dots copy
 * components/ui/helpers/presenceDot.tsx, where the SHAPE carries the meaning
 * as well as the colour — filled for online, barred for do-not-disturb, hollow
 * for offline — so the state survives being read by someone who cannot
 * separate the hues.
 */

const THREADS = [
    { name: "Aisha Malik", last: "Sent the renewal terms over", presence: "online", unread: 2, active: true },
    { name: "Sales pod", last: "Rahul: pipeline review at 3", presence: "online", unread: 0, active: false },
    { name: "Jonas Lind", last: "Thanks — looking now", presence: "dnd", unread: 0, active: false },
    { name: "Support rota", last: "Sam: ticket 4102 closed", presence: "offline", unread: 0, active: false },
];

const MESSAGES = [
    { from: "them", text: "Northwind want the renewal a month early. Can we move it?" },
    { from: "me", text: "Already moved the record to In progress — legal review is the long pole." },
    { from: "them", text: "Perfect. Jumping on a call?" },
];

function PresenceDot({ state }: { state: string }) {
    if (state === "offline") {
        return <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-transparent ring-1 ring-slate-400" />;
    }

    if (state === "dnd") {
        return (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-card bg-red-500">
                <span className="h-px w-1.5 bg-white" />
            </span>
        );
    }

    return <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />;
}

export default function MeetMock() {
    return (
        <MockFrame label="Conexus Meet" contentMinWidth={520}>
            <div className="flex h-[340px]">
                {/* ------------------------------------------- conversations */}
                <div className="flex w-[42%] shrink-0 flex-col border-r border-slate-200">
                    <div className="border-b border-slate-200 px-3 py-2.5">
                        <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-muted">
                            <Search className="h-3 w-3" />
                            Search people and teams
                        </span>
                    </div>

                    <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                        Sales workspace
                    </p>

                    {THREADS.map((thread) => (
                        <div
                            key={thread.name}
                            className={`flex items-center gap-2.5 px-3 py-2 ${thread.active ? "nav-glass" : ""}`}
                        >
                            <span className="relative shrink-0">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                                    {thread.name.slice(0, 2).toUpperCase()}
                                </span>
                                <PresenceDot state={thread.presence} />
                            </span>

                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11px] font-semibold text-slate-800">
                                    {thread.name}
                                </span>
                                <span className="block truncate text-[10px] text-muted">{thread.last}</span>
                            </span>

                            {thread.unread > 0 ? (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                                    {thread.unread}
                                </span>
                            ) : null}
                        </div>
                    ))}
                </div>

                {/* -------------------------------------------------- thread */}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                        <span className="relative shrink-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                                AI
                            </span>
                            <PresenceDot state="online" />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-[11px] font-semibold text-slate-800">Aisha Malik</span>
                            <span className="block text-[10px] text-emerald-600">Online</span>
                        </span>

                        <span className="ml-auto flex gap-1.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600">
                                <Phone className="h-3.5 w-3.5" />
                            </span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600">
                                <Video className="h-3.5 w-3.5" />
                            </span>
                        </span>
                    </div>

                    <div className="flex-1 space-y-2.5 p-4">
                        {MESSAGES.map((message) => (
                            <div
                                key={message.text}
                                className={message.from === "me" ? "flex justify-end" : "flex justify-start"}
                            >
                                <span
                                    className={
                                        message.from === "me"
                                            ? "max-w-[80%] rounded-xl rounded-br-sm bg-accent px-3 py-2 text-[11px] leading-relaxed text-white"
                                            : "max-w-[80%] rounded-xl rounded-bl-sm bg-control px-3 py-2 text-[11px] leading-relaxed text-slate-800"
                                    }
                                >
                                    {message.text}
                                </span>
                            </div>
                        ))}

                        <div className="flex items-center gap-1.5 pl-1">
                            <span className="flex gap-0.5">
                                <span className="h-1 w-1 rounded-full bg-slate-400" />
                                <span className="h-1 w-1 rounded-full bg-slate-400" />
                                <span className="h-1 w-1 rounded-full bg-slate-400" />
                            </span>
                            <span className="text-[10px] italic text-muted">Aisha is typing…</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-2.5">
                        <span className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] text-muted">
                            Message Aisha
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500">
                            <Mic className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
                            <Send className="h-3.5 w-3.5" />
                        </span>
                    </div>
                </div>
            </div>
        </MockFrame>
    );
}
