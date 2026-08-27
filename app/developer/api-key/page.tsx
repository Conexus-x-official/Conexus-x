"use client";

import { useState } from "react";
import {
    HiOutlineKey,
    HiOutlineClipboardDocument,
    HiOutlineArrowPath,
    HiOutlineCheck,
} from "react-icons/hi2";
import { useGetApiKeyQuery, useGenerateApiKeyMutation } from "@/store/api/apiKey.api";

export default function DeveloperApiKeyPage() {
    const [copied, setCopied] = useState(false);

    const { data: apiKey = null, isLoading } = useGetApiKeyQuery();
    const [generateApiKey, { isLoading: apiKeyLoading }] = useGenerateApiKeyMutation();

    const handleChangeKey = async () => {
        try {
            await generateApiKey().unwrap();
        } catch {
            console.error("Failed to change API key");
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
                        API Key
                    </h1>
                </div>

                <p className="mt-1 text-sm text-slate-500 font-dmsans">
                    Use this permanent global key to access your CRM data via external
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
                            value={apiKey || (isLoading ? "Loading API Key..." : "No API key yet")}
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
                <div className="flex items-center gap-2 mt-4">
                    <button
                        onClick={handleChangeKey}
                        disabled={apiKeyLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-dmsans cursor-pointer"
                    >
                        <HiOutlineArrowPath
                            className={`w-4 h-4 ${apiKeyLoading ? "animate-spin" : ""}`}
                        />
                        Change
                    </button>
                </div>

                <p className="text-xs text-slate-400 font-dmsans mt-3">
                    Changing your key will immediately invalidate the previous key.
                </p>
            </div>
        </div>
    );
}
