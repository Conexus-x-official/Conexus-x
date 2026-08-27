"use client";

import { Fragment, ReactNode, useState } from "react";
import { HiOutlineCheck, HiOutlineClipboardDocument } from "react-icons/hi2";

import { SCROLLBAR } from "./scrollbar";

/**
 * JSON tokens, coloured with the brand palette (LAYOUT.md §4.2).
 *
 * The highlighter returns React nodes rather than an HTML string — the payload
 * is server data rendered verbatim, and building markup out of it would be an
 * injection waiting to happen.
 */
const TOKEN = /("(?:\\.|[^"\\])*"\s*:?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function classForToken(token: string) {
    if (token.startsWith("\"")) {
        // A trailing colon means this string is a key, not a value.
        return token.trimEnd().endsWith(":")
            ? "text-[#6A00FF]"
            : "text-emerald-600";
    }

    if (token === "true" || token === "false" || token === "null") {
        return "text-accent";
    }

    return "text-blue-600";
}

function highlight(json: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    TOKEN.lastIndex = 0;

    while ((match = TOKEN.exec(json)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(
                <Fragment key={`t${lastIndex}`}>{json.slice(lastIndex, match.index)}</Fragment>
            );
        }

        nodes.push(
            <span key={`m${match.index}`} className={classForToken(match[0])}>
                {match[0]}
            </span>
        );

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < json.length) {
        nodes.push(<Fragment key="tail">{json.slice(lastIndex)}</Fragment>);
    }

    return nodes;
}

export function CopyButton({
    value,
    label = "Copy",
    className = "",
}: {
    value: string;
    label?: string;
    className?: string;
}) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access can be refused; the code stays selectable either way.
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-card px-2.5 py-1.5 font-dmsans text-xs font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer ${className}`}
        >
            {copied ? (
                <>
                    <HiOutlineCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600">Copied</span>
                </>
            ) : (
                <>
                    <HiOutlineClipboardDocument className="h-3.5 w-3.5" />
                    <span>{label}</span>
                </>
            )}
        </button>
    );
}

export function JsonView({
    value,
    className = "",
}: {
    value: unknown;
    className?: string;
}) {
    const json =
        typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "null";

    return (
        <pre
            className={`overflow-auto rounded-xl bg-panel p-4 font-mono text-xs leading-relaxed text-slate-700 ${SCROLLBAR} ${className}`}
        >
            {highlight(json)}
        </pre>
    );
}

/** A snippet with its own copy control — used for the cURL / JS examples. */
export function CodeBlock({
    title,
    code,
    copyValue,
}: {
    title: string;
    code: string;
    /** What lands on the clipboard when it differs from what is shown (a masked key). */
    copyValue?: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-panel">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                <span className="font-dmsans text-xs font-semibold text-slate-600">
                    {title}
                </span>

                <CopyButton value={copyValue ?? code} />
            </div>

            <pre className={`overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-slate-700 ${SCROLLBAR}`}>
                {code}
            </pre>
        </div>
    );
}
