"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
    LayoutGrid,
    SendHorizontal,
    Loader2,
    Check,
    AlertTriangle,
    Trash2,
    Columns3,
    Rows3,
    FolderPlus,
    SquarePen,
    ShieldAlert,
    ShieldCheck,
    MessageSquareText,
    Zap,
} from "lucide-react";

import {
    useSendAgentMessageMutation,
    useConfirmAgentActionMutation,
    useGetAgentCreditsQuery,
    type AgentTurn,
    type AppliedAction,
    type BlueprintPlan,
    type EntityRef,
    type PendingAction,
} from "@/store/api/agent.api";
import { PALETTE } from "@/data/data";
import { useAppSelector } from "@/store/hooks";
import { selectActiveWorkspaceId } from "@/store/selectors/workspace.selectors";
import { useGetWorkspacesQuery } from "@/store/api/workspaces.api";
import { setAgentStatus } from "@/lib/agentStatus";
import { readUser, readUserServer, subscribeUser } from "@/lib/auth";
import aquilineLogo from "@/app/assets/Aquiline.png";
import userAsset from "@/app/assets/user.png";

/**
 * Aquiline — the CRM agent's panel.
 *
 * The model is a doer, not a talker (see backend/services/agent.service.ts), so
 * this reads as a worklog rather than a conversation: a short line from Aquiline
 * plus chips for what it actually changed. Every turn costs real money, so the
 * panel shows the running spend instead of hiding it.
 */

interface ChatMessage {
    id: string;
    author: "user" | "agent" | "error";
    text: string;
    actions?: AppliedAction[];
    /** Entities this reply named — chipped inside the sentence. */
    mentions?: EntityRef[];
    /** Rendered as an authorise prompt until it is acted on. */
    pending?: PendingAction;
    /** Set once the user has answered, so the buttons stop offering a choice. */
    settled?: "done" | "cancelled";
}

/** An entity named in a message, so the sentence can show it as it looks. */
type Mention = Pick<EntityRef, "kind" | "name"> & {
    id?: string;
    color?: string;
};

/**
 * The agent's own name, emphasised wherever a reply says it.
 *
 * It travels through the same pass that draws entity chips rather than a
 * second replace over the output: withChips returns React nodes, so anything
 * running afterwards would have to walk them, and two passes over the same
 * string is how one of them ends up matching inside the other's output.
 */
const AGENT_NAME = "Aquiline";

/** One tile size and shape for every avatar in the thread. */
const AVATAR = "h-6 w-6 shrink-0 overflow-hidden rounded-lg bg-control";

const SUGGESTIONS = [
    "Set up a sales CRM for me",
    "Add a module named Q3 Pipeline here",
    "Add a status column: New, Working, Won",
    "Add records Acme, Globex and Initech",
];

/**
 * What the panel says while it waits.
 *
 * The request is a single non-streaming call, so these are TIMED, not measured
 * — the panel cannot see which round the loop is on. They are worded to stay
 * true of whatever is happening: Aquiline reads, then acts, then writes its line.
 */
const STAGES = [
    { after: 0, label: "Reading your request" },
    { after: 1200, label: "Checking your workspace" },
    { after: 3000, label: "Making the change" },
    { after: 6500, label: "Almost there" },
];

const ACTION_ICON: Record<AppliedAction["kind"], typeof LayoutGrid> = {
    workspace: FolderPlus,
    module: LayoutGrid,
    collection: Rows3,
    column: Columns3,
    record: SquarePen,
    value: Check,
    amendment: MessageSquareText,
};

/** Same hash the boards and sidebar use, so an entity keeps one colour. */
function colorFor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length].accent;
}

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function EntityChip({
    mention,
    onAccent,
}: {
    mention: Mention;
    /** On the user's own bubble the background is the accent colour, where a
     *  tinted badge would be unreadable — so it goes white instead. */
    onAccent?: boolean;
}) {
    const tint = mention.color || colorFor(mention.id || mention.name);
    const Icon = ACTION_ICON[mention.kind as AppliedAction["kind"]] ?? LayoutGrid;

    return (
        <span
            title={`${mention.kind}: ${mention.name}`}
            className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-px align-middle text-[11px] font-semibold uppercase tracking-wide"
            style={
                onAccent
                    ? {
                        color: "#ffffff",
                        borderColor: "rgb(255 255 255 / 0.55)",
                        backgroundColor: "rgb(255 255 255 / 0.18)",
                    }
                    : {
                        color: tint,
                        borderColor: `${tint}66`,
                        backgroundColor: `${tint}14`,
                    }
            }
        >
            <Icon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{mention.name}</span>
        </span>
    );
}

/**
 * Renders the reply with every entity it names shown as that entity's own
 * badge — the same shape the board uses — rather than as bare text in quotes.
 */
function withChips(text: string, mentions: Mention[], onAccent = false) {
    const named = mentions.filter((mention) => mention.name.trim().length > 1);

    // The agent's name is always a term, even when the turn named no entities —
    // it is what makes "I'm Aquiline" read as an introduction rather than a
    // sentence that happens to contain a word.
    const terms = [
        ...named.map((mention) => escapeRegExp(mention.name)),
        escapeRegExp(AGENT_NAME),
    ];

    // Longest first, so "New Tasks" wins over a stray "New".
    const ordered = [...named].sort((a, b) => b.name.length - a.name.length);

    const pattern = new RegExp(
        `"?(${terms.sort((a, b) => b.length - a.length).join("|")})"?`,
        "gi"
    );

    return text.split(pattern).map((part, index) => {
        if (part?.toLowerCase() === AGENT_NAME.toLowerCase()) {
            return (
                <strong key={`n-${index}`} className="font-bold">
                    {part}
                </strong>
            );
        }

        const hit = ordered.find(
            (mention) => mention.name.toLowerCase() === part.toLowerCase()
        );

        return hit ? (
            <EntityChip key={`${part}-${index}`} mention={hit} onAccent={onAccent} />
        ) : (
            <span key={index}>{part}</span>
        );
    });
}

/**
 * The structure Aquiline proposes, drawn before anything is built.
 *
 * Shown in full rather than summarised: "12 collections" is not something a
 * person can meaningfully agree to, but a list of names is.
 */
function PlanTree({ plan }: { plan: BlueprintPlan }) {
    return (
        <div className="mb-2 space-y-2 rounded-lg border border-slate-200 bg-panel p-2.5">
            {plan.workspace ? (
                <div className="flex items-center gap-1.5">
                    <FolderPlus className="h-3 w-3 shrink-0 text-accent" />
                    <EntityChip mention={{ kind: "workspace", name: plan.workspace }} />
                    <span className="text-[10px] text-muted">new workspace</span>
                </div>
            ) : (
                /* Building into somewhere that already exists — say where. */
                <p className="flex items-center gap-1.5 text-[10px] text-muted">
                    Building into
                    {plan.existingWorkspaceName ? (
                        <EntityChip
                            mention={{
                                kind: "workspace",
                                name: plan.existingWorkspaceName,
                                id: plan.workspaceId,
                            }}
                        />
                    ) : (
                        <span className="font-medium text-slate-700">this workspace</span>
                    )}
                </p>
            )}

            {plan.modules.map((moduleItem) => (
                <div
                    key={moduleItem.name}
                    className={plan.workspace ? "ml-3 border-l border-slate-200 pl-2.5" : ""}
                >
                    <div className="flex items-center gap-1.5">
                        <LayoutGrid className="h-3 w-3 shrink-0 text-slate-400" />
                        <EntityChip mention={{ kind: "module", name: moduleItem.name }} />
                    </div>

                    {(moduleItem.collections?.length ?? 0) > 0 && (
                        <div className="ml-4 mt-1 flex flex-wrap gap-1">
                            {moduleItem.collections?.map((collection) => (
                                <EntityChip
                                    key={collection}
                                    mention={{ kind: "collection", name: collection }}
                                />
                            ))}
                        </div>
                    )}

                    {(moduleItem.columns?.length ?? 0) > 0 && (
                        <p className="ml-4 mt-1 text-[10px] leading-relaxed text-muted">
                            {moduleItem.columns
                                ?.map((column) => `${column.name} (${column.type})`)
                                .join(" · ")}
                        </p>
                    )}

                    {(moduleItem.records?.length ?? 0) > 0 && (
                        <p className="ml-4 mt-0.5 text-[10px] text-muted">
                            {moduleItem.records?.reduce(
                                (sum, group) => sum + group.names.length,
                                0
                            )}{" "}
                            starter records
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

interface AgentChatProps {
    /** What the agent is pointed at — workspace or board name. */
    context?: string;
    /** Ids the agent should treat as "here". */
    workspaceId?: string;
    moduleId?: string;
}

const messageFrom = (error: unknown): string => {
    const data = (error as { data?: { message?: string } })?.data;
    return data?.message || "Aquiline could not answer that. Try again.";
};

export default function AgentChat({
    context,
    workspaceId,
    moduleId,
}: AgentChatProps) {
    const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId);

    /**
     * The remembered workspace outlives the workspace itself — it sits in
     * localStorage and survives a delete. Sending a dead id told Aquiline it had
     * somewhere to build, so only an id that is still in the list is passed.
     */
    const { data: workspaces = [] } = useGetWorkspacesQuery();

    const liveWorkspaceId =
        workspaceId ||
        (workspaces.some((workspace) => workspace._id === activeWorkspaceId)
            ? activeWorkspaceId
            : undefined);

    /**
     * Whose messages these are. Read through the external store rather than an
     * effect so it needs no setState-in-effect, and so an avatar uploaded from
     * the profile menu updates the thread without a reload — updateUser()
     * already raises the event this subscribes to.
     */
    const me = useSyncExternalStore(subscribeUser, readUser, readUserServer);

    const myAvatar = me?.avatar || userAsset.src;
    const myName =
        [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "You";

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [spentUsd, setSpentUsd] = useState(0);

    /**
     * Everything Aquiline has named this session. Kept at panel level so an earlier
     * message — including the user's own — can still be chipped once we learn
     * what those names were.
     */
    const [known, setKnown] = useState<EntityRef[]>([]);
    const [stage, setStage] = useState(STAGES[0].label);

    const [sendAgentMessage, { isLoading }] = useSendAgentMessageMutation();

    /**
     * The balance, read from the server and never computed here.
     *
     * Every chat turn invalidates AI_CREDITS_TAG, so this refetches itself
     * after each message — which is what keeps the number on screen the one
     * the server would actually enforce on the next send.
     */
    const { data: credits } = useGetAgentCreditsQuery();

    const outOfCredits = credits?.exhausted ?? false;

    // A fifth left is the point at which "you are running low" is still
    // actionable rather than an alarm about something already over.
    const lowCredits =
        !!credits && !credits.exhausted && credits.remaining <= credits.allowance * 0.2;

    /**
     * The panel header shows this, so it has to be published rather than kept
     * local. Derived from what is actually true right now — a request in
     * flight, or the last turn having failed — never stored, so a fault can
     * never outlive the session that saw it.
     */
    const [faulted, setFaulted] = useState(false);
    const [confirmAgentAction, { isLoading: authorising }] =
        useConfirmAgentActionMutation();

    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length, isLoading]);

    // Walk the stage labels while a turn is in flight, and reset when it lands.
    useEffect(() => {
        if (!isLoading) return;

        const timers = STAGES.slice(1).map((step) =>
            window.setTimeout(() => setStage(step.label), step.after)
        );

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
            setStage(STAGES[0].label);
        };
    }, [isLoading]);

    const rememberEntities = (entities?: EntityRef[]) => {
        if (!entities?.length) return;

        setKnown((previous) => {
            const byId = new Map(previous.map((entity) => [entity.id, entity]));
            entities.forEach((entity) => byId.set(entity.id, entity));
            return Array.from(byId.values()).slice(-80);
        });
    };

    const send = async (raw?: string) => {
        const text = (raw ?? draft).trim();
        if (!text || isLoading) return;

        // Guarded HERE and not only on the button: send() is also called from
        // the Enter key and from the suggestion chips, and a disabled button is
        // not a guard — it is a hint. The server refuses this anyway with a
        // 402; the point of the client check is to not waste the round trip.
        if (outOfCredits) return;

        const now = Date.now();
        setDraft("");

        // Only real exchanges travel back — errors are local noise and would
        // just cost tokens on the next turn.
        const history: AgentTurn[] = [
            ...messages
                .filter((message) => message.author !== "error")
                .map((message) => ({
                    role: message.author === "user" ? ("user" as const) : ("assistant" as const),
                    content: message.text,
                })),
            { role: "user", content: text },
        ];

        setMessages((previous) => [
            ...previous,
            { id: `u-${now}`, author: "user", text },
        ]);

        try {
            setFaulted(false);

            const reply = await sendAgentMessage({
                messages: history,
                workspaceId: liveWorkspaceId,
                moduleId: moduleId || undefined,
            }).unwrap();

            setSpentUsd((previous) => previous + (reply.usage?.costUsd ?? 0));
            rememberEntities(reply.mentions);

            setMessages((previous) => [
                ...previous,
                {
                    id: `a-${now}`,
                    author: "agent",
                    text: reply.text,
                    actions: reply.actions,
                    mentions: reply.mentions,
                    pending: reply.pending,
                },
            ]);
        } catch (error) {
            setFaulted(true);
            setMessages((previous) => [
                ...previous,
                { id: `e-${now}`, author: "error", text: messageFrom(error) },
            ]);
        }
    };

    /** The user pressed Authorise — replayed server-side, no model call. */
    const authorise = async (message: ChatMessage) => {
        if (!message.pending || authorising) return;

        const now = Date.now();

        try {
            const reply = await confirmAgentAction({
                pending: message.pending,
                workspaceId: liveWorkspaceId,
                moduleId: moduleId || undefined,
            }).unwrap();

            setMessages((previous) => [
                ...previous.map((item) =>
                    item.id === message.id ? { ...item, settled: "done" as const } : item
                ),
                {
                    id: `a-${now}`,
                    author: "agent",
                    text: reply.text,
                    actions: reply.actions,
                    mentions: reply.mentions,
                },
            ]);
        } catch (error) {
            setFaulted(true);
            setMessages((previous) => [
                ...previous.map((item) =>
                    item.id === message.id ? { ...item, settled: "done" as const } : item
                ),
                { id: `e-${now}`, author: "error", text: messageFrom(error) },
            ]);
        }
    };

    const dismiss = (message: ChatMessage) =>
        setMessages((previous) =>
            previous.map((item) =>
                item.id === message.id ? { ...item, settled: "cancelled" as const } : item
            )
        );

    /**
     * Working beats faulted: while a retry is in flight the honest answer is
     * "working", and showing the previous failure at the same time would say
     * two things at once.
     */
    useEffect(() => {
        const busy = isLoading || authorising;
        setAgentStatus(busy ? "working" : faulted ? "issue" : "ready");
    }, [isLoading, authorising, faulted]);

    const isEmpty = messages.length === 0;

    return (
        <div className="flex min-h-0 flex-1 flex-col font-google-sans">

            {/* Thread */}
            <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">

                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                        {/* p-2.5: the mark is a full-bleed square, so without
                            inset it touches the tile edge and reads as a
                            cropped image rather than a logo. */}
                        <span className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-control p-2.5">
                            <Image
                                src={aquilineLogo}
                                alt=""
                                className="h-full w-full object-contain"
                                priority
                            />
                        </span>

                        <h3 className="text-sm font-bold text-slate-900">Aquiline</h3>
                        <p className="mx-auto mt-2 max-w-[16rem] text-xs leading-relaxed text-muted">
                            Say what you want to built Aquiline help to builds it. It asks before deleting anything.
                        </p>

                        <div className="mt-5 w-full space-y-1.5">
                            {SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => send(suggestion)}
                                    className="w-full rounded-lg border border-hairline bg-control/30 px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-accent/40 hover:bg-control/60 hover:text-slate-900 cursor-pointer"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {messages.map((message) => {
                            if (message.author === "user") {
                                return (
                                    <div
                                        key={message.id}
                                        className="flex items-start justify-end gap-2"
                                    >
                                        {/* The SAME surface as the agent's
                                            bubble. Side, avatar and the flat
                                            corner still tell the two apart, so
                                            the accent fill was doing no work
                                            that the layout was not already
                                            doing — and it spent the one colour
                                            in the panel on saying "you typed
                                            this", which nobody needed telling.

                                            `onAccent` goes with it: entity
                                            chips can go back to their own
                                            colours now there is no coloured
                                            fill for them to fight. */}
                                        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-control/60 px-3 py-2 text-xs leading-relaxed text-slate-700">
                                            {withChips(message.text, known)}
                                        </p>

                                        {/* Same tile as the agent's — size,
                                            radius and surface — so the two
                                            sides of the thread read as a pair
                                            rather than two designs. */}
                                        <span className={`mt-0.5 ${AVATAR}`} title={myName}>
                                            <img
                                                src={myAvatar}
                                                alt={myName}
                                                className="h-full w-full object-cover"
                                            />
                                        </span>
                                    </div>
                                );
                            }

                            if (message.author === "error") {
                                return (
                                    <div key={message.id} className="flex items-start gap-2">
                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-50/80 text-red-600">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                        </span>
                                        <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-red-100 bg-red-50/80 px-3 py-2 text-xs leading-relaxed text-red-600">
                                            {message.text}
                                        </p>
                                    </div>
                                );
                            }

                            return (
                                <div key={message.id} className="flex items-start gap-2">
                                    {/* The agent signs its own replies with its
                                        mark, not a generic glyph - the same one
                                        the header and empty state carry. */}
                                    <span
                                        className={`mt-0.5 flex items-center justify-center p-1 ${AVATAR}`}
                                        title={AGENT_NAME}
                                    >
                                        <Image
                                            src={aquilineLogo}
                                            alt=""
                                            className="h-full w-full object-contain"
                                        />
                                    </span>

                                    <div className="min-w-0 max-w-[85%]">
                                        <p className="rounded-2xl rounded-bl-md bg-control/60 px-3 py-2 text-xs leading-relaxed text-slate-700">
                                            {withChips(message.text, [
                                                ...(message.mentions ?? []),
                                                ...(message.actions ?? []),
                                                ...known,
                                                ...(message.pending
                                                    ? [
                                                        {
                                                            kind: message.pending
                                                                .kind as EntityRef["kind"],
                                                            name: message.pending.name,
                                                        },
                                                    ]
                                                    : []),
                                            ])}
                                        </p>

                                        {/* Nothing destructive happens on a typed
                                            "yes" — it takes a deliberate press. */}
                                        {message.pending && !message.settled && (
                                            <div className="mt-2 rounded-xl border border-slate-200 bg-card p-2.5">
                                                <p className="mb-1.5 flex items-start gap-1.5 text-[11px] font-medium text-slate-700">
                                                    <ShieldAlert className="mt-px h-3 w-3 shrink-0 text-accent" />
                                                    <span>{message.pending.intent}</span>
                                                </p>

                                                {message.pending.plan && (
                                                    <PlanTree plan={message.pending.plan} />
                                                )}

                                                {/* Name every row it will touch,
                                                    so "6 collections" is never
                                                    the only thing you can see. */}
                                                {(message.pending.targets?.length ?? 0) > 1 && (
                                                    <div className="mb-2 flex flex-wrap gap-1">
                                                        {message.pending.targets?.map((target) => {
                                                            const hit = known.find(
                                                                (entity) =>
                                                                    entity.id === target ||
                                                                    entity.name.toLowerCase() ===
                                                                    target.toLowerCase()
                                                            );

                                                            return (
                                                                <EntityChip
                                                                    key={target}
                                                                    mention={
                                                                        hit ?? {
                                                                            kind: message.pending!
                                                                                .kind as EntityRef["kind"],
                                                                            name: target,
                                                                        }
                                                                    }
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => authorise(message)}
                                                        disabled={authorising}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {authorising ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <ShieldCheck className="h-3 w-3" />
                                                        )}
                                                        Authorise
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => dismiss(message)}
                                                        disabled={authorising}
                                                        className="rounded-lg border border-slate-200 bg-card px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {message.settled === "cancelled" && (
                                            <p className="mt-1.5 text-[10px] font-medium text-muted">
                                                Cancelled — nothing was changed.
                                            </p>
                                        )}

                                        {/* What actually changed — the worklog. */}
                                        {message.actions && message.actions.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {message.actions
                                                    .filter(
                                                        (action) =>
                                                            !message.text
                                                                .toLowerCase()
                                                                .includes(action.name.toLowerCase())
                                                    )
                                                    .map((action, index) => {
                                                    const Icon = ACTION_ICON[action.kind] ?? Check;
                                                    const removed = action.tool === "delete_entity";

                                                    return (
                                                        <span
                                                            key={`${action.id}-${index}`}
                                                            title={`${action.kind}: ${action.name}`}
                                                            className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-medium ${removed
                                                                ? "border-red-100 bg-red-50/80 text-red-600"
                                                                : "border-emerald-100 bg-emerald-50 text-emerald-600"
                                                                }`}
                                                        >
                                                            {removed ? (
                                                                <Trash2 className="h-2.5 w-2.5 shrink-0" />
                                                            ) : (
                                                                <Icon className="h-2.5 w-2.5 shrink-0" />
                                                            )}
                                                            <span className="truncate">{action.name}</span>
                                                        </span>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {isLoading && (
                            <div className="flex items-start gap-2">
                                <span
                                    className={`mt-0.5 flex items-center justify-center text-body ${AVATAR}`}
                                >
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                </span>
                                <p className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-control/60 px-3 py-2 text-xs text-muted">
                                    <span>{stage}</span>
                                    <span className="inline-flex gap-0.5">
                                        {[0, 1, 2].map((dot) => (
                                            <span
                                                key={dot}
                                                className="h-1 w-1 rounded-full bg-muted animate-pulse"
                                                style={{ animationDelay: `${dot * 160}ms` }}
                                            />
                                        ))}
                                    </span>
                                </p>
                            </div>
                        )}

                        <div ref={endRef} />
                    </div>
                )}
            </div>

            {/* Composer */}
            <div className="border-t border-hairline p-3">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    {context ? (
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span className="truncate text-[10px] font-medium text-muted">
                                Working on <span className="text-slate-700">{context}</span>
                            </span>
                        </span>
                    ) : (
                        <span />
                    )}

                    {/*
                        Spend is on screen, not in a bill at the end of the
                        month — and it is the REMAINING BALANCE that leads,
                        because that is the number that decides whether the next
                        message will be accepted. Session spend stays as the
                        smaller second line only once there is any.
                    */}
                    {credits && (
                        <span
                            title={`${credits.used} of ${credits.allowance} credits used on the ${credits.planLabel} plan${spentUsd > 0 ? ` · $${spentUsd.toFixed(4)} this session` : ""}`}
                            className="flex shrink-0 items-center gap-1.5"
                        >
                            <Zap
                                className={`h-3 w-3 ${
                                    outOfCredits
                                        ? "text-red-600"
                                        : lowCredits
                                          ? "text-amber-600"
                                          : "text-muted"
                                }`}
                            />
                            <span
                                className={`text-[10px] font-semibold tabular-nums ${
                                    outOfCredits
                                        ? "text-red-600"
                                        : lowCredits
                                          ? "text-amber-600"
                                          : "text-muted"
                                }`}
                            >
                                {credits.remaining.toLocaleString()}
                            </span>
                            {/*
                                A bar, not just a digit: "312 credits" means
                                nothing without the ceiling it is measured
                                against, and the proportion is the part people
                                actually read.
                            */}
                            <span className="h-1 w-10 overflow-hidden rounded-full bg-control">
                                <span
                                    className={`block h-full rounded-full transition-all duration-500 ${
                                        outOfCredits
                                            ? "bg-red-600"
                                            : lowCredits
                                              ? "bg-amber-500"
                                              : "bg-accent"
                                    }`}
                                    style={{
                                        width: `${Math.min(100, Math.max(0, (credits.remaining / Math.max(1, credits.allowance)) * 100))}%`
                                    }}
                                />
                            </span>
                        </span>
                    )}
                </div>

                {/*
                    The wall. Shown INSTEAD of letting someone type a message
                    that the server has already decided it will refuse — a
                    composer that accepts input and then rejects it is the
                    version of this that wastes the user's time and teaches
                    them the app is broken.
                */}
                {outOfCredits && credits && (
                    <div className="mb-2 rounded-xl border border-amber-100 bg-amber-50 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
                            <Zap className="h-3 w-3" />
                            You have used all {credits.allowance.toLocaleString()} credits
                        </p>
                        <p className="mt-1 text-[10px] leading-relaxed text-amber-600/90">
                            On the {credits.planLabel} plan. They reset on{" "}
                            {new Date(credits.resetAt).toLocaleDateString(undefined, {
                                month: "long",
                                day: "numeric"
                            })}
                            {credits.plan === "free" ? " — or upgrade for more." : "."}
                        </p>

                        {credits.plan === "free" && (
                            <a
                                href="/pricing"
                                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-accent-hover"
                            >
                                See plans
                            </a>
                        )}
                    </div>
                )}

                <div className="rounded-xl border border-hairline bg-control/40 transition focus-within:border-accent focus-within:bg-card">
                    <textarea
                        ref={inputRef}
                        rows={2}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                send();
                            }
                        }}
                        disabled={outOfCredits}
                        placeholder={
                            outOfCredits
                                ? "Out of AI credits"
                                : "Tell Aquiline what to build…"
                        }
                        className="w-full resize-none bg-transparent px-3 pt-2.5 text-xs leading-relaxed text-slate-800 outline-none placeholder:text-muted"
                    />

                    <div className="flex items-center justify-between px-2 pb-2">
                        <span className="pl-1 text-[10px] font-medium text-muted">
                            Enter to send · Shift+Enter for a new line
                        </span>

                        <button
                            type="button"
                            onClick={() => send()}
                            disabled={!draft.trim() || isLoading || outOfCredits}
                            aria-label="Send"
                            title="Send"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                            {isLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <SendHorizontal className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
