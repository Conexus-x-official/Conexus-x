"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { fetchTransport, useViewHost } from "@conexus-x/sdk/react-host";
import type { Scope, ViewContext } from "@conexus-x/sdk";

import { toast } from "@/components/ui/toast";
import env from "@/config/env";
import { getToken } from "@/lib/auth";

/**
 * The CRM acting as the HOST for somebody's extension.
 *
 * This is the same bridge a real module mount uses — @conexus-x/sdk/react-host,
 * not a preview-only imitation — so what a developer sees here is what their
 * view will do in place. A mock host would agree with the real one right up
 * until the moment it mattered.
 *
 * MOUNTED ONLY WITH A VALID URL, and that is structural rather than tidiness:
 * useViewHost builds the frame src with `new URL(entry)`, which throws on an
 * empty string. Keeping the hook inside a component the parent mounts
 * conditionally is what lets the parent hold an empty input without crashing.
 */

/**
 * What a preview grants by default.
 *
 * READ-ONLY, because this runs against real workspace data with the signed-in
 * person's own credentials. An extension being tried out for the first time is
 * exactly the code least entitled to delete a record, and "I was only
 * previewing it" is not a state anybody expects to have changed their module.
 */
const READ_SCOPES: Scope[] = [
    "modules:read",
    "records:read",
    "collections:read",
    "columns:read",
    "values:read",
    "amendments:read",
    "members:read",
    "activity:read",
    "storage",
];

const WRITE_SCOPES: Scope[] = [
    "records:write",
    "collections:write",
    "columns:write",
    "values:write",
    "amendments:write",
];

export interface ExtensionFrameProps {
    url: string;
    context: ViewContext;
    /** Off by default — see READ_SCOPES. */
    allowWrites: boolean;
    /** Set by the parent so the frame can fill an overlay or sit in the page. */
    className?: string;
}

export default function ExtensionFrame({
    url,
    context,
    allowWrites,
    className = "",
}: ExtensionFrameProps) {
    const router = useRouter();
    const [lastError, setLastError] = useState<string | null>(null);
    const [stalled, setStalled] = useState(false);

    /**
     * Our own origin, for the "add this to CONEXUS_ORIGINS" line below.
     *
     * Reading window during render is only safe because the panel that uses it
     * is gated on `stalled`, which starts false — server and first client pass
     * both render nothing, so there is nothing to mismatch. Same rule the
     * portals in this codebase follow.
     */
    const hostOrigin = typeof window === "undefined" ? "this app" : window.location.origin;

    /**
     * The signed-in person's own token, read fresh on every call.
     *
     * The extension never sees it. It asks the bridge, the bridge asks the API
     * as this user, and the server re-checks their membership and module access
     * exactly as it would for any other request — so a preview can never reach
     * data the person previewing it could not already open.
     */
    const transport = useMemo(
        () =>
            fetchTransport({
                baseUrl: env.NEXT_PUBLIC_API_URL ?? "",
                token: () => getToken(),
            }),
        []
    );

    const grantedScopes = allowWrites ? [...READ_SCOPES, ...WRITE_SCOPES] : READ_SCOPES;

    const { iframeProps, connected } = useViewHost({
        entry: url,
        appId: "preview",
        viewId: "preview",
        grantedScopes,
        context,
        title: "Extension preview",
        transport,
        commands: {
            notice: ({ message, type }) => {
                if (type === "error") toast.error(message);
                else if (type === "success") toast.success(message);
                else toast.info(message);
            },
            confirm: ({ message }) => window.confirm(message),
            copyToClipboard: async ({ text }) => {
                await navigator.clipboard.writeText(text);
                toast.success("Copied");
            },
            navigate: ({ path }) => {
                // Paths only. An extension must not be able to send the person
                // to another origin from inside the app's own chrome, which is
                // the shape every embedded-app phishing attempt takes.
                if (path.startsWith("/") && !path.startsWith("//")) router.push(path);
            },
            // openRecord is deliberately absent: this preview mounts at
            // workspace level with no module behind it, so there is no record
            // panel to open. The SDK answers `command_unsupported`, which an
            // extension can feature-detect — better than a button that appears
            // to work and does nothing.
        },
        onError: (error) => {
            /**
             * `command_unsupported` is not a fault — it is the negotiation
             * working.
             *
             * A host implements the commands its surface can honour, and the
             * SDK answers `command_unsupported` for the rest precisely so an
             * extension can feature-detect instead of assuming. This preview
             * gives the frame a fixed slot, as a module does, so it does not
             * implement `resize`; every view calling useAutoResize() therefore
             * gets one of these on mount, and showing it in an amber warning
             * band made correct behaviour look like a broken preview.
             *
             * Real failures — a denied scope, a forbidden route, an API error —
             * still surface, because those are things the developer has to act
             * on.
             */
            if (error.code === "command_unsupported") return;

            setLastError(`${error.code}: ${error.message}`);
        },
    });

    /**
     * Say WHY the frame is empty, instead of leaving a grey rectangle.
     *
     * A cross-origin frame cannot be inspected: if the far page refuses to be
     * embedded, the browser writes "Refused to display … X-Frame-Options" to
     * the console and this side sees nothing at all — no error event, no
     * readable document. Silence is the only signal there is, so silence is
     * what has to be turned into a diagnosis.
     *
     * Time-based rather than event-based for that reason. It is a HINT shown
     * beside a frame that is still trying, never an error that replaces it: a
     * slow cold start on a tunnel can legitimately take a few seconds.
     */
    useEffect(() => {
        if (connected) return;

        const timer = setTimeout(() => setStalled(true), 6000);
        return () => clearTimeout(timer);
        // No `setStalled(false)` on connect, and none when the URL changes:
        // the render below is already gated on `!connected`, and the parent
        // keys this component on the URL, so a new address remounts it and the
        // flag resets on its own. Clearing it here would be a synchronous
        // setState in an effect body, which this codebase rejects — see the
        // no-reset-effects rule.
    }, [connected]);

    return (
        <div className={`flex min-h-0 flex-col ${className}`}>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-1.5 text-[11px]">
                <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                    aria-hidden
                />
                <span className="font-medium text-slate-600">
                    {connected ? "Connected" : "Waiting for the extension to connect…"}
                </span>

                <span className="ml-auto truncate font-normal text-muted" title={url}>
                    {url}
                </span>
            </div>

            {lastError ? (
                <div className="flex items-start gap-2 border-b border-hairline bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                    <HiOutlineExclamationTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 break-words">
                        {lastError}
                        {lastError.startsWith("scope_denied") ? (
                            <span className="block text-amber-600">
                                The preview grants read access only. Turn on “Allow writes”
                                to test this call.
                            </span>
                        ) : null}
                    </span>
                </div>
            ) : null}

            {stalled && !connected ? (
                <div className="border-b border-hairline bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
                    <p className="font-semibold">
                        Nothing has connected from that address yet.
                    </p>
                    <p className="mt-1 text-amber-700">
                        The browser will not tell this page why a frame stayed empty, so
                        check these in order — the reason is in your browser console:
                    </p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-amber-700">
                        <li>
                            <strong>Is this your view?</strong> It must be the address your
                            own app is serving — normally
                            <code className="mx-1">http://localhost:5173</code> or a
                            tunnel URL. Ordinary websites refuse to be framed at all.
                        </li>
                        <li>
                            <strong>Refused to display … X-Frame-Options</strong> in the
                            console means that site forbids framing. Your view allows it
                            through <code>frame-ancestors</code>.
                        </li>
                        <li>
                            <strong>Blocked by frame-ancestors</strong> means your view is
                            framable but not by this origin — add
                            <code className="mx-1">{hostOrigin}</code> to
                            <code className="mx-1">CONEXUS_ORIGINS</code> in its
                            <code className="mx-1">.env</code> and restart it.
                        </li>
                        <li>
                            <strong>The page renders but never connects?</strong> It is not
                            calling the SDK. A view connects by using
                            <code className="mx-1">@conexus-x/sdk</code>.
                        </li>
                    </ul>
                </div>
            ) : null}

            <iframe {...iframeProps} className="min-h-0 flex-1 w-full border-0 bg-card" />
        </div>
    );
}
