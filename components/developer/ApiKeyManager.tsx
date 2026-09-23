"use client";

import { useEffect, useRef, useState } from "react";
import {
    HiOutlineKey,
    HiOutlineClipboardDocument,
    HiOutlineArrowPath,
    HiOutlineCheck,
    HiOutlineClock,
} from "react-icons/hi2";
import { useGetApiKeyQuery, useGenerateApiKeyMutation } from "@/store/api/apiKey.api";

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const formatCountdown = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default function ApiKeyManager() {
    const [copied, setCopied] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
    const startedAtRef = useRef<number | null>(null);

    // Epoch ms the user is next allowed to regenerate their key, or null when
    // no cooldown is in effect. Seeded from the server on load and updated on
    // every generate attempt (success AND the 429 rejection), so a page
    // refresh mid-cooldown still shows the correct remaining time.
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());

    const { data: keyInfo, isLoading } = useGetApiKeyQuery();
    const apiKey = keyInfo?.apiKey ?? null;
    const [generateApiKey, { isLoading: apiKeyLoading }] = useGenerateApiKeyMutation();

    useEffect(() => {
        if (!keyInfo?.nextAllowedAt) return;
        const until = new Date(keyInfo.nextAllowedAt).getTime();
        setCooldownUntil(until > Date.now() ? until : null);
    }, [keyInfo?.nextAllowedAt]);

    // Ticks the elapsed-time counter for as long as the regenerate request is
    // in flight, so the UI shows how long the database update is taking
    // rather than a plain, unmeasured spinner.
    useEffect(() => {
        if (!apiKeyLoading) return;

        startedAtRef.current = Date.now();
        setElapsedMs(0);

        const interval = setInterval(() => {
            if (startedAtRef.current) {
                setElapsedMs(Date.now() - startedAtRef.current);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [apiKeyLoading]);

    // Ticks the cooldown countdown once a second and clears itself the moment
    // it elapses, so the Change button re-enables with no manual refresh.
    useEffect(() => {
        if (!cooldownUntil) return;

        const interval = setInterval(() => {
            const current = Date.now();
            setNow(current);
            if (current >= cooldownUntil) {
                setCooldownUntil(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [cooldownUntil]);

    const remainingMs = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0;
    const onCooldown = remainingMs > 0;

    const handleChangeKey = async () => {
        const startedAt = Date.now();

        try {
            const result = await generateApiKey().unwrap();
            setLastDurationMs(Date.now() - startedAt);
            setTimeout(() => setLastDurationMs(null), 3000);

            if (result.nextAllowedAt) {
                setCooldownUntil(new Date(result.nextAllowedAt).getTime());
            }
        } catch (err) {
            const data = (err as { data?: { message?: string; nextAllowedAt?: string } })?.data;

            if (data?.nextAllowedAt) {
                setCooldownUntil(new Date(data.nextAllowedAt).getTime());
            }

            console.error("Failed to change PIT key", data?.message);
        }
    };

    const handleCopy = async () => {
        if (!apiKey) return;
        try {
            await navigator.clipboard.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            console.error("Failed to copy");
        }
    };

    return (
        <div className="max-w-4xl p-5">
            <div className="mb-8 ">
                <div className="flex items-center gap-2">
                    <HiOutlineKey className="w-5 h-5 text-slate-700" />

                    <h1 className="text-2xl font-semibold text-slate-900 font-dmsans">
                        PIT Key
                    </h1>
                </div>

                <p className="mt-1 text-sm text-slate-500 font-dmsans">
                    Use this permanent global PIT key to access your CRM data via external
                    applications. Keep it secret — treat it like a password.
                </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">

                {/* Key display */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            readOnly
                            value={apiKey || (isLoading ? "Loading PIT key..." : "No PIT key yet")}
                            className="w-full px-3 py-2.5 pr-10 rounded-md border border-slate-200 bg-card text-sm text-slate-800 font-mono tracking-tight focus:outline-none cursor-default select-all"
                        />
                    </div>

                    {/* Copy button */}
                    {apiKey && (
                        <button
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md border border-slate-200 bg-card text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors font-dmsans shrink-0 cursor-pointer"
                            title="Copy to clipboard"
                        >
                            {copied ? (
                                <>
                                    <HiOutlineCheck className="w-4 h-4 text-emerald-500" />
                                    <span className="text-emerald-600">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <HiOutlineClipboardDocument className="w-4 h-4" />
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Action button */}
                <div className="flex items-center gap-3 mt-4">
                    <button
                        type="button"
                        onClick={handleChangeKey}
                        disabled={apiKeyLoading || onCooldown}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-dmsans cursor-pointer"
                    >
                        <HiOutlineArrowPath
                            className={`w-4 h-4 ${apiKeyLoading ? "animate-spin" : ""}`}
                        />
                        Change
                    </button>

                    {apiKeyLoading && (
                        <span className="text-xs text-slate-500 font-dmsans tabular-nums">
                            Updating key in the database… {formatSeconds(elapsedMs)}
                        </span>
                    )}

                    {!apiKeyLoading && lastDurationMs !== null && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-dmsans">
                            <HiOutlineCheck className="w-3.5 h-3.5" />
                            Key updated in {formatSeconds(lastDurationMs)}
                        </span>
                    )}

                    {!apiKeyLoading && onCooldown && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-dmsans tabular-nums">
                            <HiOutlineClock className="w-3.5 h-3.5" />
                            You can change it again in {formatCountdown(remainingMs)}
                        </span>
                    )}
                </div>

                <p className="text-xs text-slate-400 font-dmsans mt-3">
                    Changing your PIT key immediately invalidates the previous one. For
                    security, you can only change it once every 20 minutes.
                </p>
            </div>
        </div>
    );
}
