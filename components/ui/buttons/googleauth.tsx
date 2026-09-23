"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import env from "@/config/env";

type GoogleButtonProps = {
    /** Which page the user started from — echoed back through the OAuth state. */
    mode?: "login" | "register";
    label?: string;
    disabled?: boolean;
    className?: string;
    onError?: (message: string) => void;
};

export default function GoogleButton({
    mode = "login",
    label = "Continue with Google",
    disabled = false,
    className = "",
    onError
}: GoogleButtonProps) {
    const [redirecting, setRedirecting] = useState(false);

    const handleClick = () => {
        const baseUrl = env.NEXT_PUBLIC_API_URL;

        if (!baseUrl) {
            onError?.("Google sign-in is unavailable. NEXT_PUBLIC_API_URL is not set.");
            return;
        }

        setRedirecting(true);

        // Full page navigation: the backend owns the Google handshake and the client secret.
        window.location.href = `${baseUrl.replace(/\/$/, "")}/auth/google?mode=${mode}`;
    };

    const isBusy = disabled || redirecting;

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isBusy}
            aria-busy={redirecting}
            className={`w-full h-11 flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-card text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${className}`}
        >
            {redirecting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M21.805 12.23c0-.79-.065-1.55-.207-2.28H12v4.32h5.5a4.7 4.7 0 0 1-2.04 3.09v2.57h3.3c1.93-1.78 3.045-4.4 3.045-7.7Z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.3-2.57c-.91.61-2.07.97-3.47.97-2.67 0-4.93-1.8-5.74-4.22H2.85v2.65A10.23 10.23 0 0 0 12 22Z"
                        fill="#34A853"
                    />
                    <path
                        d="M6.26 13.71A6.15 6.15 0 0 1 5.94 12c0-.59.11-1.17.32-1.71V7.64H2.85A10.23 10.23 0 0 0 1.77 12c0 1.65.4 3.2 1.08 4.36l3.41-2.65Z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 6.07c1.5 0 2.85.52 3.91 1.54l2.93-2.93C17.08 2.99 14.76 2 12 2a10.23 10.23 0 0 0-9.15 5.64l3.41 2.65C7.07 7.87 9.33 6.07 12 6.07Z"
                        fill="#EA4335"
                    />
                </svg>
            )}

            {redirecting ? "Redirecting to Google…" : label}
        </button>
    );
}
