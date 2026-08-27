// lib/webrtc.ts

import { getSocket } from "./socket";

/**
 * Audio and video calls, peer to peer.
 *
 * A MESH, not an SFU: every participant holds one RTCPeerConnection per other
 * participant and sends their camera to each of them directly. That costs
 * nothing to run — no media server, no bandwidth bill — which is the whole
 * reason it is the right shape for a CRM. The price is upload: with N people
 * each browser sends N-1 copies of its own stream, so this is honest up to
 * about five and degrades past that. Going bigger means an SFU (LiveKit,
 * mediasoup), which is real infrastructure and a real invoice.
 *
 * The server never touches media. It relays a few hundred bytes of
 * negotiation — see the meet:signal handler in the backend — and holds no call
 * state at all, which is also why a refresh ends a call rather than rejoining
 * one.
 */

/**
 * STUN lets two browsers discover their public address and connect through
 * ordinary NAT. It is free and Google's servers are the usual default.
 *
 * NO TURN, deliberately, and this is the one real limitation of calling here:
 * roughly one connection in ten sits behind symmetric NAT or a strict
 * corporate firewall where a direct path cannot be built at all, and those
 * calls will ring, negotiate, and then simply never produce audio. Fixing that
 * requires a TURN relay, which by definition carries the media and therefore
 * costs money (coturn on a VPS, or a paid provider). Add the credentials here
 * when that matters; nothing else in this file changes.
 */
const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
];

export type CallKind = "audio" | "video";

export type SignalKind = "offer" | "answer" | "ice" | "ready" | "leave";

/** One negotiation frame off the wire. `from` is stamped by the server. */
export interface SignalFrame {
    kind: SignalKind | string;
    from: string;
    conversationId: string;
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

export interface RemotePeer {
    userId: string;
    stream: MediaStream | null;
    /** Drives the "Connecting…" label on that person's tile. */
    state: RTCPeerConnectionState;
}

interface CallHandlers {
    onRemote: (peers: RemotePeer[]) => void;
    onLocal: (stream: MediaStream | null) => void;
    onEnded: () => void;
}

/**
 * One live call. Constructed by the UI when a call starts and thrown away when
 * it ends — there is deliberately no singleton, so a stale connection can never
 * outlive the screen that owned it.
 */
export class CallSession {
    readonly conversationId: string;
    readonly kind: CallKind;

    /**
     * When this call was placed. Set at CONSTRUCTION, which happens inside an
     * event handler — a Date.now() read anywhere React might re-run during
     * render is an impure call the React Compiler rejects.
     */
    readonly startedAt = Date.now();
    /** Who we are, so we never try to dial ourselves out of a member list. */
    private readonly meId: string;

    private local: MediaStream | null = null;
    private readonly peers = new Map<string, RTCPeerConnection>();
    private readonly streams = new Map<string, MediaStream>();
    private readonly states = new Map<string, RTCPeerConnectionState>();

    /**
     * Candidates that arrived before the remote description was set.
     *
     * WebRTC has no ordering guarantee between an offer and the candidates that
     * follow it, and addIceCandidate throws if the description is not in place
     * yet. Dropping them is the classic cause of a call that connects on a LAN
     * and never connects across the internet, where the useful candidates are
     * exactly the late ones.
     */
    private readonly pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

    private handlers: CallHandlers;
    private ended = false;

    /** Removes this session's own socket listener. See attach(). */
    private detach: (() => void) | null = null;

    constructor(opts: {
        conversationId: string;
        kind: CallKind;
        meId: string;
        handlers: CallHandlers;
    }) {
        this.conversationId = opts.conversationId;
        this.kind = opts.kind;
        this.meId = opts.meId;
        this.handlers = opts.handlers;
    }

    /* ------------------------------------------------------------- media */

    /**
     * Asks for the microphone (and camera on a video call).
     *
     * Throws a NAMED error the UI can explain: "not allowed" is a permission
     * the user can grant, "not found" is missing hardware, and telling someone
     * to check their browser settings when they have no webcam is useless.
     */
    async start(): Promise<MediaStream> {
        this.local = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: this.kind === "video" ? { width: 1280, height: 720 } : false
        });

        this.handlers.onLocal(this.local);
        this.attach();
        return this.local;
    }

    /**
     * THE SESSION OWNS ITS OWN SIGNALLING.
     *
     * This used to be routed by the page, through a ref holding the live
     * session — which broke three React rules at once (a ref written during
     * render, a ref mutated after an effect read it) and had a real bug behind
     * the lint: between setSession() and the effect re-subscribing, inbound ICE
     * candidates were addressed to a listener that still believed there was no
     * call, and were dropped. Those late candidates are exactly the ones that
     * make a connection work across the internet rather than only on a LAN.
     *
     * Subscribing here removes the window entirely: the listener exists from
     * the moment media is acquired until end() tears it down, and it filters on
     * this call's own conversation so a second thread's frames cannot reach it.
     */
    private attach() {
        const socket = getSocket();
        if (!socket || this.detach) return;

        const handler = (frame: SignalFrame) => {
            if (frame.conversationId !== this.conversationId) return;
            void this.handleSignal(frame);
        };

        socket.on("meet:signal", handler);
        this.detach = () => socket.off("meet:signal", handler);
    }

    get localStream() {
        return this.local;
    }

    /** Returns the new state so the button can render from one source. */
    toggleMute(): boolean {
        const track = this.local?.getAudioTracks()[0];
        if (!track) return false;
        track.enabled = !track.enabled;
        return !track.enabled;
    }

    toggleCamera(): boolean {
        const track = this.local?.getVideoTracks()[0];
        if (!track) return false;
        track.enabled = !track.enabled;
        return !track.enabled;
    }

    /* ------------------------------------------------------------- peers */

    private emitPeers() {
        this.handlers.onRemote(
            [...this.peers.keys()].map((userId) => ({
                userId,
                stream: this.streams.get(userId) ?? null,
                state: this.states.get(userId) ?? "new"
            }))
        );
    }

    private signal(to: string, kind: string, payload: unknown) {
        getSocket()?.emit("meet:signal", {
            to,
            conversationId: this.conversationId,
            kind,
            payload
        });
    }

    private connectionFor(userId: string): RTCPeerConnection {
        const existing = this.peers.get(userId);
        if (existing) return existing;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Our own tracks go out on this connection.
        this.local?.getTracks().forEach((track) => {
            pc.addTrack(track, this.local!);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signal(userId, "ice", event.candidate.toJSON());
            }
        };

        pc.ontrack = (event) => {
            // One stream per peer; the same MediaStream is reused as tracks
            // arrive, so the <video> element is never re-attached mid-call.
            const stream = this.streams.get(userId) ?? new MediaStream();

            event.streams[0]?.getTracks().forEach((t) => {
                if (!stream.getTracks().some((existing) => existing.id === t.id)) {
                    stream.addTrack(t);
                }
            });

            this.streams.set(userId, stream);
            this.emitPeers();
        };

        pc.onconnectionstatechange = () => {
            this.states.set(userId, pc.connectionState);

            // A dropped peer is removed rather than left as a frozen tile.
            if (
                pc.connectionState === "failed" ||
                pc.connectionState === "closed"
            ) {
                this.dropPeer(userId);
            }

            this.emitPeers();
        };

        this.peers.set(userId, pc);
        this.states.set(userId, "new");

        return pc;
    }

    /**
     * GLARE CONTROL. If both sides call each other at the same instant, both
     * send an offer and both reject the other's — the call then hangs with two
     * half-negotiated connections. The rule is arbitrary but must be the same
     * on both machines: the LOWER user id makes the offer, the other waits.
     */
    private shouldOffer(otherId: string) {
        return this.meId < otherId;
    }

    /** Dial everyone already in the call. */
    async invite(userIds: string[]) {
        for (const userId of userIds) {
            if (userId === this.meId) continue;

            if (!this.shouldOffer(userId)) {
                // They will offer to us; announce we are here and wait.
                this.signal(userId, "ready", null);
                continue;
            }

            await this.offerTo(userId);
        }
        this.emitPeers();
    }

    private async offerTo(userId: string) {
        const pc = this.connectionFor(userId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.signal(userId, "offer", offer);
    }

    /* --------------------------------------------------------- signalling */

    /** Every inbound meet:signal frame for this call lands here. */
    async handleSignal(frame: SignalFrame): Promise<void> {
        if (this.ended) return;

        const { kind, from, payload } = frame;

        try {
            if (kind === "ready") {
                // The other side is waiting for our offer (see shouldOffer).
                if (this.shouldOffer(from)) await this.offerTo(from);
                return;
            }

            if (kind === "offer") {
                const pc = this.connectionFor(from);

                await pc.setRemoteDescription(
                    new RTCSessionDescription(payload as RTCSessionDescriptionInit)
                );
                await this.flushCandidates(from, pc);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                this.signal(from, "answer", answer);
                this.emitPeers();
                return;
            }

            if (kind === "answer") {
                const pc = this.peers.get(from);
                if (!pc) return;

                await pc.setRemoteDescription(
                    new RTCSessionDescription(payload as RTCSessionDescriptionInit)
                );
                await this.flushCandidates(from, pc);
                return;
            }

            if (kind === "ice") {
                const pc = this.peers.get(from);

                // Buffer until there is a description to attach it to.
                if (!pc || !pc.remoteDescription) {
                    const queued = this.pendingCandidates.get(from) ?? [];
                    queued.push(payload as RTCIceCandidateInit);
                    this.pendingCandidates.set(from, queued);
                    return;
                }

                await pc.addIceCandidate(
                    new RTCIceCandidate(payload as RTCIceCandidateInit)
                );
                return;
            }

            if (kind === "leave") {
                this.dropPeer(from);
                this.emitPeers();

                // The last peer leaving ends the call rather than leaving
                // someone sitting alone in an empty room.
                if (this.peers.size === 0) this.end();
            }
        } catch (error) {
            console.error(`WebRTC ${kind} failed:`, (error as Error).message);
        }
    }

    private async flushCandidates(userId: string, pc: RTCPeerConnection) {
        const queued = this.pendingCandidates.get(userId);
        if (!queued?.length) return;

        for (const candidate of queued) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
                // A candidate can legitimately be stale by now; one bad one
                // must not abort the rest.
            }
        }

        this.pendingCandidates.delete(userId);
    }

    private dropPeer(userId: string) {
        const pc = this.peers.get(userId);

        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            pc.close();
        }

        this.peers.delete(userId);
        this.streams.delete(userId);
        this.states.delete(userId);
        this.pendingCandidates.delete(userId);
    }

    /* ----------------------------------------------------------------- end */

    /**
     * Tears everything down. Idempotent, because it is called from the hang-up
     * button, from the last peer leaving, and from React cleanup — and stopping
     * a track twice is fine but firing onEnded twice is not.
     */
    end(notify = true) {
        if (this.ended) return;
        this.ended = true;

        // Stop listening before tearing down, so a frame arriving mid-teardown
        // cannot re-open a peer connection on a call that is over.
        this.detach?.();
        this.detach = null;

        if (notify) {
            [...this.peers.keys()].forEach((userId) =>
                this.signal(userId, "leave", null)
            );
        }

        [...this.peers.keys()].forEach((userId) => this.dropPeer(userId));

        /**
         * STOP EVERY TRACK. Without this the camera light stays on after the
         * call — the stream outlives the component that rendered it, and the
         * browser has no reason to release the device until it is stopped.
         */
        this.local?.getTracks().forEach((track) => track.stop());
        this.local = null;

        this.handlers.onLocal(null);
        this.handlers.onRemote([]);
        this.handlers.onEnded();
    }
}

/** Human-readable reason a call could not start, for the toast. */
export const describeMediaError = (error: unknown): string => {
    const name = (error as { name?: string })?.name ?? "";

    if (name === "NotAllowedError" || name === "SecurityError") {
        return "Your browser blocked access to the microphone or camera. Allow it in the address bar and try again.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
        return "No microphone or camera was found on this device.";
    }
    if (name === "NotReadableError") {
        return "Another app is already using your camera or microphone.";
    }

    return "Could not start the call.";
};

/** "4m 12s" — a duration a person reads, not milliseconds. */
export const formatDuration = (ms: number): string => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
};
