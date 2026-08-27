"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    TbMicrophone,
    TbMicrophoneOff,
    TbVideo,
    TbVideoOff,
    TbPhoneOff,
    TbPhoneCall
} from "react-icons/tb";
import { formatDuration } from "@/lib/webrtc";
import { displayName } from "./ConversationList";
import type { MeetUser } from "@/store/api/meet.api";
import type { RemotePeer } from "@/lib/webrtc";

import userAsset from "@/app/assets/user.png";

/**
 * The call surface — a full-screen layer over the app.
 *
 * FULL SCREEN rather than a floating window, because a call is modal in
 * practice: you are not reading a board while looking at someone. It renders
 * MediaStreams that live in the CallSession, so it holds no media state of its
 * own and unmounting it can never orphan a camera.
 */

/** Attaches a MediaStream to a <video> imperatively — srcObject is not an attr. */
function Video({
    stream,
    muted,
    className
}: {
    stream: MediaStream | null;
    muted?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Re-assigning the same stream restarts playback, so only set it when
        // it actually changed.
        if (el.srcObject !== stream) {
            el.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            // YOUR OWN tile is always muted. Playing your own microphone back
            // is instant, deafening feedback.
            muted={muted}
            className={className}
        />
    );
}

function Tile({
    user,
    stream,
    label,
    state,
    mirrored
}: {
    user?: MeetUser | null;
    stream: MediaStream | null;
    label: string;
    state?: string;
    mirrored?: boolean;
}) {
    const hasVideo = Boolean(
        stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
    );

    return (
        <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
            {hasVideo ? (
                <Video
                    stream={stream}
                    muted={mirrored}
                    className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
                />
            ) : (
                <>
                    {/* Audio still has to play even with no picture — the
                        element is what carries the sound. */}
                    {stream && !mirrored && (
                        <Video stream={stream} className="hidden" />
                    )}

                    <div className="flex flex-col items-center gap-3">
                        <img
                            src={user?.avatar || userAsset.src}
                            alt={label}
                            className="h-20 w-20 rounded-full object-cover ring-4 ring-white/10"
                        />
                        <span className="text-sm font-medium text-white/90">{label}</span>
                    </div>
                </>
            )}

            {/* The name rides over the video, so the tile is identifiable
                whichever branch drew it. */}
            {hasVideo && (
                <span className="absolute bottom-2 left-2 rounded-lg bg-black/50 px-2 py-1 text-xs font-medium text-white">
                    {label}
                </span>
            )}

            {state && state !== "connected" && (
                <span className="absolute top-2 left-2 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-medium text-white/80">
                    {state === "failed"
                        ? "Could not connect"
                        : state === "disconnected"
                            ? "Reconnecting…"
                            : "Connecting…"}
                </span>
            )}
        </div>
    );
}

export default function CallOverlay({
    kind,
    title,
    localStream,
    peers,
    participants,
    me,
    ringing,
    onToggleMute,
    onToggleCamera,
    onEnd
}: {
    kind: "audio" | "video";
    title: string;
    localStream: MediaStream | null;
    peers: RemotePeer[];
    /** Everyone who could be on the call, so a tile can be named. */
    participants: MeetUser[];
    me: MeetUser | null;
    /** True until at least one peer is connected. */
    ringing: boolean;
    onToggleMute: () => boolean;
    onToggleCamera: () => boolean;
    onEnd: () => void;
}) {
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(kind === "audio");
    const [elapsed, setElapsed] = useState(0);

    const connected = peers.some((p) => p.state === "connected");

    /**
     * The timer starts when somebody actually ANSWERS, not when the call was
     * placed — thirty seconds of ringing is not thirty seconds of call, and the
     * duration written into the transcript has to be the honest one.
     */
    const startedAt = useRef<number | null>(null);

    useEffect(() => {
        if (!connected) return;

        if (startedAt.current === null) startedAt.current = Date.now();

        const timer = setInterval(() => {
            setElapsed(Date.now() - (startedAt.current ?? Date.now()));
        }, 1000);

        return () => clearInterval(timer);
    }, [connected]);

    // Escape hangs up — the same key that closes every other layer in the app.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onEnd();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onEnd]);

    if (typeof document === "undefined") return null;

    const nameFor = (userId: string) =>
        displayName(participants.find((p) => p._id === userId)) || "Guest";

    // One column for a 1:1, a grid past that. Mesh calls are small by design —
    // see the note in lib/webrtc.ts about why.
    const columns = peers.length <= 1 ? 1 : peers.length <= 4 ? 2 : 3;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 font-dmsans">

            <header className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
                    <p className="text-[11px] text-white/60 tabular-nums">
                        {connected
                            ? formatDuration(elapsed)
                            : ringing
                                ? "Ringing…"
                                : "Connecting…"}
                    </p>
                </div>

                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
                    <TbPhoneCall className="h-3.5 w-3.5" />
                    {kind === "video" ? "Video call" : "Audio call"}
                </span>
            </header>

            <div
                className="grid min-h-0 flex-1 gap-3 px-6"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
                {peers.length === 0 ? (
                    <div className="flex items-center justify-center rounded-2xl bg-slate-900">
                        <p className="text-sm text-white/60">
                            Waiting for someone to join…
                        </p>
                    </div>
                ) : (
                    peers.map((peer) => (
                        <Tile
                            key={peer.userId}
                            user={participants.find((p) => p._id === peer.userId)}
                            stream={peer.stream}
                            label={nameFor(peer.userId)}
                            state={peer.state}
                        />
                    ))
                )}
            </div>

            {/* Your own picture, small and in the corner — the convention every
                call app uses, because your face is the least useful thing on
                your own screen. Mirrored, so raising your left hand looks left. */}
            {kind === "video" && (
                <div className="pointer-events-none absolute bottom-24 right-6 h-32 w-48 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20">
                    <Tile
                        user={me}
                        stream={localStream}
                        label="You"
                        mirrored
                    />
                </div>
            )}

            <footer className="flex shrink-0 items-center justify-center gap-3 px-6 py-6">
                <button
                    type="button"
                    onClick={() => setMuted(onToggleMute())}
                    title={muted ? "Unmute" : "Mute"}
                    aria-label={muted ? "Unmute" : "Mute"}
                    aria-pressed={muted}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition cursor-pointer ${muted
                        ? "bg-white text-slate-900"
                        : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                >
                    {muted ? (
                        <TbMicrophoneOff className="h-5 w-5" />
                    ) : (
                        <TbMicrophone className="h-5 w-5" />
                    )}
                </button>

                {kind === "video" && (
                    <button
                        type="button"
                        onClick={() => setCameraOff(onToggleCamera())}
                        title={cameraOff ? "Turn camera on" : "Turn camera off"}
                        aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                        aria-pressed={cameraOff}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition cursor-pointer ${cameraOff
                            ? "bg-white text-slate-900"
                            : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                    >
                        {cameraOff ? (
                            <TbVideoOff className="h-5 w-5" />
                        ) : (
                            <TbVideo className="h-5 w-5" />
                        )}
                    </button>
                )}

                <button
                    type="button"
                    onClick={onEnd}
                    title="Leave the call"
                    aria-label="Leave the call"
                    className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700 cursor-pointer"
                >
                    <TbPhoneOff className="h-5 w-5" />
                </button>
            </footer>
        </div>,
        document.body
    );
}

/**
 * The incoming-call prompt. Deliberately NOT the full overlay: until you accept
 * there is no media, no peer connection and nothing to render — and asking for
 * the camera before someone has agreed to answer is exactly the permission
 * prompt people learn to refuse.
 */
export function IncomingCall({
    from,
    kind,
    onAccept,
    onDecline
}: {
    from: MeetUser | null;
    kind: "audio" | "video";
    onAccept: () => void;
    onDecline: () => void;
}) {
    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed bottom-6 right-6 z-[60] w-80 rounded-2xl border border-hairline bg-card p-4 shadow-2xl font-dmsans animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-3">
                <img
                    src={from?.avatar || userAsset.src}
                    alt={displayName(from)}
                    className="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                        {displayName(from)}
                    </p>
                    <p className="text-xs text-muted">
                        Incoming {kind === "video" ? "video" : "audio"} call
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onDecline}
                    className="flex-1 rounded-xl bg-control px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-control-hover cursor-pointer"
                >
                    Decline
                </button>
                <button
                    type="button"
                    onClick={onAccept}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 cursor-pointer"
                >
                    <TbPhoneCall className="h-4 w-4" />
                    Answer
                </button>
            </div>
        </div>,
        document.body
    );
}
