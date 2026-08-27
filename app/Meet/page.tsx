"use client";

import { useCallback, useEffect, useState } from "react";
import { TbMessages } from "react-icons/tb";

import { toast } from "@/components/ui/toast";

import ConversationList, {
    conversationTitle,
    type MeetTab
} from "@/components/meet/ConversationList";
import ChatPane from "@/components/meet/ChatPane";
import NewChatModal from "@/components/meet/NewChatModal";
import CallOverlay, { IncomingCall } from "@/components/meet/CallOverlay";
import ManageTeamModal from "@/components/meet/ManageTeamModal";

import { useRealtimeRoom } from "@/store/useRealtimeRoom";
import { getSocket, subscribeRooms, unsubscribeRooms } from "@/lib/socket";
import { getUser } from "@/lib/auth";
import {
    CallSession,
    describeMediaError,
    type RemotePeer,
    type SignalFrame
} from "@/lib/webrtc";
import {
    useGetConversationsQuery,
    useLogCallMutation,
    useMarkConversationReadMutation,
    type Conversation,
    type MeetUser
} from "@/store/api/meet.api";

/**
 * Conexus Meet — chat and calls, inside the CRM.
 *
 * TWO PANES AND NOTHING ELSE — no header bar. The page is a sidebar and a
 * transcript, which is the shape every chat client has settled on because it
 * answers "where am I" and "what was said" at the same time. The header that
 * used to sit above both was spending 64px to repeat the workspace name, and
 * the workspace is now a heading INSIDE the list, where it labels the rows it
 * actually applies to. Identity, search and the way back all moved into the
 * rail; the profile menu lives in its foot.
 *
 * SPANS EVERY WORKSPACE. It was scoped to the active one, which meant an owner
 * of three had to leave Meet and switch workspace merely to answer somebody,
 * and a message waiting elsewhere stayed invisible until they happened to look.
 * Access is unchanged and was never workspace membership: it is membership of
 * the CONVERSATION, which is strictly narrower.
 */

/**
 * A call ringing on this tab.
 *
 * The OFFER IS CARRIED HERE rather than in a ref beside it. It has to survive
 * until the prompt is answered — an offer is sent once, so a callee that
 * discarded it would sit waiting for a second one that never comes — and it
 * belongs to the same moment as the ring, so it lives in the same value.
 */
interface IncomingRing {
    conversationId: string;
    from: string;
    kind: "audio" | "video";
    offer: SignalFrame;
}

export default function MeetPage() {
    /**
     * NO WORKSPACE SCOPE. Every thread the person is in, wherever it lives —
     * see the note on getConversations. The workspace a thread belongs to is
     * carried on the thread itself, so nothing here has to pick one.
     */
    const { data: conversations = [], isLoading } = useGetConversationsQuery();

    const [markRead] = useMarkConversationReadMutation();
    const [logCall] = useLogCallMutation();

    const [activeId, setActiveId] = useState("");
    const [tab, setTab] = useState<MeetTab>("chats");
    const [showNew, setShowNew] = useState(false);
    const [showManage, setShowManage] = useState(false);

    /**
     * Read from localStorage rather than a hook: this is the signed-in user's
     * own id, which the whole page compares against to decide "is this mine".
     */
    const me = getUser();
    const meId = me?.id ?? "";

    /**
     * Auto-open the newest thread ON THE CURRENT TAB, but never overrule a
     * choice already made. Scoping the fallback to the tab is what stops
     * switching to Teams from leaving a direct chat open behind an empty list.
     */
    const onTab = (c: Conversation) =>
        tab === "teams" ? c.kind === "group" : c.kind === "direct";

    const resolvedId =
        activeId && conversations.some((c) => c._id === activeId)
            ? activeId
            : conversations.find(onTab)?._id ?? "";

    const resolved = conversations.find((c) => c._id === resolvedId) ?? null;

    /**
     * The workspace rooms this page needs, derived from the threads themselves.
     *
     * Presence is announced per workspace, and the list draws a dot for every
     * counterpart — so a page spanning four workspaces has to listen to all
     * four or three-quarters of the dots would be frozen at whatever they were
     * on load.
     */
    const workspaceIds = [
        ...new Set(conversations.map((c) => c.workspace?._id).filter(Boolean))
    ] as string[];

    // Joined as one comma-separated key so the effect below re-runs when the
    // SET changes, not on every re-render that rebuilds an equal array.
    const workspaceKey = workspaceIds.join(",");

    useEffect(() => {
        if (!workspaceKey) return;

        const ids = workspaceKey.split(",");

        const join = () => ids.forEach((id) => subscribeRooms({ workspaceId: id }));

        join();

        const socket = getSocket();
        socket?.on("connect", join);

        return () => {
            socket?.off("connect", join);
            ids.forEach((id) => unsubscribeRooms({ workspaceId: id }));
        };
    }, [workspaceKey]);

    /* ------------------------------------------------------ thread rooms */

    /**
     * Join the thread being read, and leave the one before it. Scoped this
     * tightly on purpose: a workspace with fifty conversations must not deliver
     * every message in all of them to every open tab.
     */
    useEffect(() => {
        if (!resolvedId) return;

        subscribeRooms({ conversationId: resolvedId });

        const socket = getSocket();
        const onConnect = () => subscribeRooms({ conversationId: resolvedId });

        // Re-sent on reconnect: a new server-side socket holds no rooms.
        socket?.on("connect", onConnect);

        return () => {
            socket?.off("connect", onConnect);
            unsubscribeRooms({ conversationId: resolvedId });
        };
    }, [resolvedId]);

    /**
     * Opening a thread is what marks it read — but ONLY while the tab is
     * actually on screen.
     *
     * Without the visibility guard this fired for a backgrounded tab: a message
     * would arrive, the badge would clear, and the person would come back to a
     * conversation that looked read and was not. An unread count that lies is
     * worse than no unread count, because it is trusted. Caught by an API probe
     * whose assertion failed only when the account under test happened to have
     * a real browser session open in the background.
     *
     * The listener is what makes RETURNING to the tab mark it read, which is
     * the moment the thread is genuinely seen.
     *
     * Depends on the COUNT, not on the conversations array: depending on the
     * array would re-run this on every inbound message, and the mutation's
     * optimistic patch already zeroes the badge locally.
     */
    const unreadHere = resolved?.unread ?? 0;

    useEffect(() => {
        if (!resolvedId || unreadHere === 0) return;

        const markIfVisible = () => {
            if (document.visibilityState !== "visible") return;
            markRead({ conversationId: resolvedId });
        };

        markIfVisible();

        document.addEventListener("visibilitychange", markIfVisible);
        return () =>
            document.removeEventListener("visibilitychange", markIfVisible);
    }, [resolvedId, unreadHere, markRead]);

    /* ------------------------------------------------------------- calls */

    /**
     * ONE piece of call state, and no ref mirroring it.
     *
     * The session subscribes to its OWN signalling (CallSession.attach), so
     * nothing outside it needs to reach the live object between renders. The
     * earlier shape kept a ref in sync during render to route frames, which
     * broke three React rules — and hid a real bug: between setSession() and
     * the listener re-subscribing, inbound ICE candidates were handed to a
     * closure that still believed there was no call, and were dropped. Those
     * late candidates are exactly the ones that make a connection work across
     * the internet rather than only on a LAN.
     */
    const [session, setSession] = useState<CallSession | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<RemotePeer[]>([]);
    const [incoming, setIncoming] = useState<IncomingRing | null>(null);

    const endCall = useCallback(
        (call: CallSession | null, notify = true) => {
            if (!call) return;

            const duration = Date.now() - call.startedAt;

            call.end(notify);
            setSession(null);

            // The transcript keeps the record — a call is part of the
            // conversation it happened in, not a separate history.
            logCall({
                conversationId: call.conversationId,
                event: "ended",
                callKind: call.kind,
                durationMs: duration
            })
                .unwrap()
                .catch(() => {
                    // A missing transcript row must never surface as a failure:
                    // the call itself already happened.
                });
        },
        [logCall]
    );

    /**
     * Detects somebody RINGING. Frames for a call already in progress are
     * handled by that CallSession itself, so this only has to notice an offer
     * arriving when there is no call to hand it to.
     */
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onSignal = (frame: SignalFrame) => {
            if (frame.kind !== "offer") return;

            // One call at a time; a live session handles its own frames.
            if (session) return;

            const sdp = (frame.payload as RTCSessionDescriptionInit | null)?.sdp;

            setIncoming({
                conversationId: frame.conversationId,
                from: frame.from,
                // The offer says whether video was negotiated, so the prompt
                // can be honest about what is being asked for.
                kind: sdp?.includes("m=video") ? "video" : "audio",
                offer: frame
            });
        };

        socket.on("meet:signal", onSignal);
        return () => {
            socket.off("meet:signal", onSignal);
        };
    }, [session]);

    const buildSession = useCallback(
        (conversationId: string, kind: "audio" | "video") =>
            new CallSession({
                conversationId,
                kind,
                meId,
                handlers: {
                    onLocal: setLocalStream,
                    onRemote: setPeers,
                    onEnded: () => {
                        setPeers([]);
                        setLocalStream(null);
                    }
                }
            }),
        [meId]
    );

    const startCall = async (kind: "audio" | "video") => {
        if (!resolved || session) return;

        const next = buildSession(resolved._id, kind);

        try {
            await next.start();
        } catch (error) {
            // A named reason, so "allow it in the address bar" is only said
            // when that is actually the problem.
            toast.error("Could not start the call", describeMediaError(error));
            return;
        }

        setSession(next);

        await next.invite(
            resolved.members.map((m) => m.user._id).filter((id) => id !== meId)
        );

        logCall({
            conversationId: resolved._id,
            event: "started",
            callKind: kind
        })
            .unwrap()
            .catch(() => undefined);
    };

    const acceptCall = async () => {
        if (!incoming) return;

        const ring = incoming;
        setIncoming(null);

        const next = buildSession(ring.conversationId, ring.kind);

        try {
            await next.start();
        } catch (error) {
            toast.error("Could not answer", describeMediaError(error));
            return;
        }

        setSession(next);

        // The offer held while the prompt was on screen. An offer is sent once,
        // so this is the only copy there will ever be.
        await next.handleSignal(ring.offer);

        // Answering a call in another thread also moves you to it — otherwise
        // you are talking to people whose messages you cannot see.
        if (ring.conversationId !== resolvedId) setActiveId(ring.conversationId);
    };

    const declineCall = () => {
        const ring = incoming;
        setIncoming(null);

        if (!ring) return;

        getSocket()?.emit("meet:signal", {
            to: ring.from,
            conversationId: ring.conversationId,
            kind: "leave",
            payload: null
        });

        logCall({
            conversationId: ring.conversationId,
            event: "missed",
            callKind: ring.kind
        })
            .unwrap()
            .catch(() => undefined);
    };

    /**
     * Leaving the page ends the call. Without this the camera light stays on
     * and the peer connections outlive the screen that owned them.
     */
    useEffect(() => {
        if (!session) return;
        return () => {
            session.end(true);
        };
    }, [session]);

    const callConversation = session
        ? conversations.find((c) => c._id === session.conversationId) ?? null
        : resolved;

    const participants: MeetUser[] =
        callConversation?.members.map((m) => m.user) ?? [];

    const ringingFrom =
        conversations
            .find((c) => c._id === incoming?.conversationId)
            ?.members.find((m) => m.user._id === incoming?.from)?.user ?? null;

    /* ------------------------------------------------------------ render */

    return (
        <section className="flex bg-canvas">
            <div className="flex h-screen w-full overflow-hidden bg-panel shadow-sm">

                {/* Left rail — carries the identity, the search, the tabs and
                    the profile, since there is no header bar above it. */}
                <div className="w-[320px] shrink-0">
                    <ConversationList
                        conversations={conversations}
                        activeId={resolvedId}
                        loading={isLoading}
                        tab={tab}
                        onTab={setTab}
                        onSelect={(c: Conversation) => setActiveId(c._id)}
                        onNew={() => setShowNew(true)}
                    />
                </div>

                {resolved ? (
                    <ChatPane
                        // Keyed per thread so drafts, replies and the typing
                        // list re-seed instead of leaking across.
                        key={resolved._id}
                        conversation={resolved}
                        meId={meId}
                        onCall={startCall}
                        onManage={() => setShowManage(true)}
                    />
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-panel px-6 font-dmsans">
                        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <TbMessages className="h-7 w-7" />
                        </span>
                        <p className="text-sm font-semibold text-slate-900">
                            {tab === "teams" ? "No team open" : "No conversation open"}
                        </p>
                        <p className="max-w-sm text-center text-xs text-muted">
                            {tab === "teams"
                                ? "Create a team for a shared thread, or pick one on the left."
                                : "Start a chat with anyone in your workspaces, or pick one on the left."}
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowNew(true)}
                            className="mt-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover cursor-pointer"
                        >
                            {tab === "teams" ? "Create a team" : "Start a conversation"}
                        </button>
                    </div>
                )}
            </div>

            {showNew && (
                <NewChatModal
                    // Teams tab opens the modal already on "a team", so the
                    // + button means what the list under it says.
                    initialMode={tab === "teams" ? "group" : "direct"}
                    onClose={() => setShowNew(false)}
                    onOpened={(c) => {
                        setTab(c.kind === "group" ? "teams" : "chats");
                        setActiveId(c._id);
                    }}
                />
            )}

            {showManage && resolved?.kind === "group" && (
                <ManageTeamModal
                    conversation={resolved}
                    meId={meId}
                    onClose={() => setShowManage(false)}
                    onLeft={() => {
                        setShowManage(false);
                        setActiveId("");
                    }}
                />
            )}

            {session && (
                <CallOverlay
                    kind={session.kind}
                    title={callConversation ? conversationTitle(callConversation) : "Call"}
                    localStream={localStream}
                    peers={peers}
                    participants={participants}
                    me={
                        me
                            ? {
                                _id: me.id,
                                firstName: me.firstName,
                                lastName: me.lastName,
                                avatar: me.avatar
                            }
                            : null
                    }
                    ringing={!peers.some((p) => p.state === "connected")}
                    onToggleMute={() => session.toggleMute()}
                    onToggleCamera={() => session.toggleCamera()}
                    onEnd={() => endCall(session, true)}
                />
            )}

            {incoming && !session && (
                <IncomingCall
                    from={ringingFrom}
                    kind={incoming.kind}
                    onAccept={acceptCall}
                    onDecline={declineCall}
                />
            )}
        </section>
    );
}
