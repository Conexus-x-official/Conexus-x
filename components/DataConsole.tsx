"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    HiOutlineCircleStack,
    HiOutlinePlay,
    HiOutlineKey,
    HiOutlineEye,
    HiOutlineEyeSlash,
    HiChevronLeft,
    HiChevronRight,
    HiOutlineArrowPath,
    HiOutlineExclamationTriangle,
} from "react-icons/hi2";

import env from "@/config/env";
import { useGetApiKeyQuery } from "@/store/api/apiKey.api";
import { useGetWorkspacesQuery } from "@/store/api/workspaces.api";
import { useGetModulesQuery } from "@/store/api/modules.api";
import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetRecordsQuery } from "@/store/api/records.api";
import { CodeBlock, CopyButton, JsonView } from "./ui/helpers/jsonView";
import {
    ENDPOINTS,
    ENDPOINT_GROUPS,
    EndpointDef,
    PARAM_CHAIN,
    ParamKind,
    apiBaseUrl,
    buildRequestUrl,
    chainUpTo,
    formatBytes,
    formatCell,
    inferColumns,
    maskKey,
    toCurl,
    toFetchSnippet,
} from "@/lib/dataConsole";

type Ids = Partial<Record<ParamKind, string>>;

interface RunResult {
    /** Which endpoint produced this — the response outlives the selection. */
    endpointId: string;
    url: string;
    status: number;
    statusText: string;
    ms: number;
    size: number;
    body: unknown;
}

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    nextPage: number | null;
}

/** Resolved once at import: the console always talks to the configured API. */
const BASE_URL = apiBaseUrl(env.NEXT_PUBLIC_API_URL);

const PICKER_LABELS: Record<ParamKind, string> = {
    workspace: "Workspace",
    module: "Module",
    collection: "Collection",
    record: "Record",
};

const initialParams = (endpoint: EndpointDef): Record<string, string> =>
    endpoint.query.some((param) => param.name === "limit") ? { limit: "25" } : {};

export default function DataConsole() {
    const { data: apiKey = null, isLoading: keyLoading } = useGetApiKeyQuery();

    const [endpointId, setEndpointId] = useState(ENDPOINTS[0].id);
    const [ids, setIds] = useState<Ids>({});
    const [params, setParams] = useState<Record<string, string>>(() =>
        initialParams(ENDPOINTS[0])
    );
    const [result, setResult] = useState<RunResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [tab, setTab] = useState<"json" | "table" | "code">("json");
    const [revealKey, setRevealKey] = useState(false);

    const endpoint =
        ENDPOINTS.find((item) => item.id === endpointId) ?? ENDPOINTS[0];

    const chain = chainUpTo(endpoint.requires);

    /**
     * The pickers read app data through the normal cached RTK Query hooks (Bearer
     * token). Only the request under test goes out with the API key, so what you
     * run here is byte-for-byte what an outside integrator would send.
     */
    const { data: workspaces = [] } = useGetWorkspacesQuery();

    const { data: modules = [] } = useGetModulesQuery(ids.workspace ?? "", {
        skip: !ids.workspace || !chain.includes("module"),
    });

    const { data: collections = [] } = useGetCollectionsQuery(ids.module ?? "", {
        skip: !ids.module || !chain.includes("collection"),
    });

    const { data: records = [] } = useGetRecordsQuery(ids.collection ?? "", {
        skip: !ids.collection || !chain.includes("record"),
    });

    const optionsFor = (kind: ParamKind) => {
        if (kind === "workspace") return workspaces;
        if (kind === "module") return modules;
        if (kind === "collection") return collections;
        return records;
    };

    // Picking a parent invalidates every id below it — a collection from the old
    // module would otherwise stay selected and quietly return someone else's rows.
    const pickId = (kind: ParamKind, value: string) => {
        setIds((previous) => {
            const next: Ids = { ...previous, [kind]: value };

            PARAM_CHAIN.slice(PARAM_CHAIN.indexOf(kind) + 1).forEach((child) => {
                delete next[child];
            });

            return next;
        });
    };

    const missing = chain.find((kind) => !ids[kind]);

    const url = buildRequestUrl(BASE_URL, endpoint, ids, params);

    const canRun = Boolean(apiKey) && !missing && !running;

    // Everything the request needs is re-derived from the ids, so the callback
    // depends on primitives the compiler can prove stable.
    const run = useCallback(
        async (override?: Record<string, string>) => {
            const active =
                ENDPOINTS.find((item) => item.id === endpointId) ?? ENDPOINTS[0];

            const incomplete = chainUpTo(active.requires).some((kind) => !ids[kind]);

            if (!apiKey || incomplete) return;

            const nextParams = override ?? params;
            const target = buildRequestUrl(BASE_URL, active, ids, nextParams);

            setRunning(true);
            setError(null);

            const started = performance.now();

            try {
                const response = await fetch(target, {
                    headers: { "x-api-key": apiKey },
                });

                const text = await response.text();

                let body: unknown = text;
                try {
                    body = JSON.parse(text);
                } catch {
                    // A non-JSON body is still worth showing verbatim.
                }

                setResult({
                    endpointId: active.id,
                    url: target,
                    status: response.status,
                    statusText: response.statusText,
                    ms: Math.round(performance.now() - started),
                    size: new TextEncoder().encode(text).length,
                    body,
                });
            } catch (requestError) {
                setResult(null);
                setError(
                    requestError instanceof Error
                        ? `${requestError.message} — check that the API is running at ${BASE_URL}`
                        : "Request failed"
                );
            } finally {
                setRunning(false);
            }
        },
        [apiKey, endpointId, ids, params]
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                run();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [run]);

    const selectEndpoint = (next: EndpointDef) => {
        setEndpointId(next.id);
        setParams(initialParams(next));
        setError(null);
    };

    const setParam = (name: string, value: string) =>
        setParams((previous) => ({ ...previous, [name]: value }));

    // Paging re-runs immediately: state updates are async, so the new page has to
    // travel with the request rather than being read back from state.
    const goToPage = (page: number) => {
        const next = { ...params, page: String(page) };
        setParams(next);
        run(next);
    };

    const followCursor = (cursor: string) => {
        const next = { ...params, before: cursor };
        setParams(next);
        run(next);
    };

    const payload =
        result && typeof result.body === "object" && result.body !== null
            ? (result.body as Record<string, unknown>)
            : undefined;

    // The response belongs to whichever endpoint produced it.
    const resultEndpoint =
        ENDPOINTS.find((item) => item.id === result?.endpointId) ?? endpoint;

    // Left unmemoized on purpose: the React Compiler handles it, and a manual
    // useMemo here cannot keep its dependency list stable.
    const resultValue = payload?.[resultEndpoint.resultKey];

    const rows = Array.isArray(resultValue)
        ? (resultValue as Record<string, unknown>[])
        : [];

    const columns = inferColumns(rows);

    const pagination = payload?.pagination as PaginationMeta | undefined;
    const nextCursor = payload?.nextCursor as string | null | undefined;

    const ok = result ? result.status >= 200 && result.status < 300 : false;

    const keyForSnippet = revealKey ? apiKey ?? "" : maskKey(apiKey);

    return (
        <div className="max-w-[1400px] font-dmsans">

            <header className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <HiOutlineCircleStack className="h-5 w-5 text-slate-700" />
                            <h1 className="text-2xl font-semibold text-slate-900">
                                Data Console
                            </h1>
                        </div>

                        <p className="mt-1 max-w-2xl text-sm text-slate-500">
                            Build a request against your own CRM, run it with your API key,
                            and copy the exact call into your code. Read-only — every
                            endpoint here is a GET.
                        </p>
                    </div>

                    <Link
                        href="/developer/api-key"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-card px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                    >
                        <HiOutlineKey className="h-4 w-4" />
                        {keyLoading
                            ? "Loading key..."
                            : apiKey
                                ? maskKey(apiKey)
                                : "No API key yet"}
                    </Link>
                </div>

                {!keyLoading && !apiKey && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FF7675]/30 bg-[#FF7675]/10 px-4 py-3 text-sm text-[#FF7675]">
                        <HiOutlineExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            You need an API key before the console can call anything.{" "}
                            <Link href="/developer/api-key" className="underline">
                                Generate one
                            </Link>
                            .
                        </span>
                    </div>
                )}
            </header>

            <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">

                {/* Catalog */}
                <aside className="rounded-xl border border-slate-200 bg-card p-3">
                    {ENDPOINT_GROUPS.map((group) => (
                        <section key={group} className="mb-4 last:mb-0">
                            <h2 className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                {group}
                            </h2>

                            <div className="space-y-0.5">
                                {ENDPOINTS.filter((item) => item.group === group).map(
                                    (item) => {
                                        const active = item.id === endpoint.id;

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => selectEndpoint(item)}
                                                className={`w-full rounded-lg px-2.5 py-2 text-left transition cursor-pointer ${active
                                                    ? "bg-accent/10"
                                                    : "hover:bg-gray-200/40"
                                                    }`}
                                            >
                                                <span
                                                    className={`block text-sm font-semibold ${active ? "text-accent" : "text-slate-800"
                                                        }`}
                                                >
                                                    {item.name}
                                                </span>

                                                <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-400">
                                                    {item.path}
                                                </span>
                                            </button>
                                        );
                                    }
                                )}
                            </div>
                        </section>
                    ))}
                </aside>

                <div className="min-w-0 space-y-6">

                    {/* Builder */}
                    <section className="rounded-xl border border-slate-200 bg-card p-5">
                        <h3 className="text-base font-semibold text-slate-900">
                            {endpoint.name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">{endpoint.summary}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-panel px-3 py-2.5">
                            <span className="rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                                GET
                            </span>

                            <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-slate-700">
                                {url}
                            </span>

                            <CopyButton value={url} label="URL" />

                            <button
                                type="button"
                                onClick={() => run()}
                                disabled={!canRun}
                                title="Ctrl/Cmd + Enter"
                                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-slate-400 cursor-pointer"
                            >
                                {running ? (
                                    <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                                ) : (
                                    <HiOutlinePlay className="h-4 w-4" />
                                )}
                                Run
                            </button>
                        </div>

                        {missing && (
                            <p className="mt-2 text-xs text-slate-400">
                                Pick a {PICKER_LABELS[missing].toLowerCase()} to complete the
                                path.
                            </p>
                        )}

                        {chain.length > 0 && (
                            <div className="mt-5">
                                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Path
                                </h4>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {chain.map((kind) => {
                                        const options = optionsFor(kind);
                                        const parentIndex = PARAM_CHAIN.indexOf(kind) - 1;
                                        const parent = PARAM_CHAIN[parentIndex];
                                        const blocked =
                                            parentIndex >= 0 && chain.includes(parent) && !ids[parent];

                                        return (
                                            <label key={kind} className="block">
                                                <span className="mb-1 block text-xs font-medium text-slate-600">
                                                    {PICKER_LABELS[kind]}
                                                </span>

                                                <select
                                                    value={ids[kind] ?? ""}
                                                    disabled={blocked}
                                                    onChange={(event) => pickId(kind, event.target.value)}
                                                    className="h-11 w-full rounded-lg border border-slate-200 bg-card px-3 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none disabled:opacity-40 cursor-pointer"
                                                >
                                                    <option value="">
                                                        {blocked
                                                            ? `Pick a ${parent} first`
                                                            : options.length
                                                                ? "Select..."
                                                                : "Nothing here yet"}
                                                    </option>

                                                    {options.map((option) => (
                                                        <option key={option._id} value={option._id}>
                                                            {option.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {endpoint.query.length > 0 && (
                            <div className="mt-5">
                                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Query parameters
                                </h4>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {endpoint.query.map((param) => (
                                        <label key={param.name} className="block">
                                            <span className="mb-1 block font-mono text-xs font-medium text-slate-600">
                                                {param.label}
                                            </span>

                                            {param.type === "select" ? (
                                                <select
                                                    value={params[param.name] ?? ""}
                                                    onChange={(event) =>
                                                        setParam(param.name, event.target.value)
                                                    }
                                                    className="h-11 w-full rounded-lg border border-slate-200 bg-card px-3 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">default</option>
                                                    {param.options?.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type={param.type === "number" ? "number" : "text"}
                                                    value={params[param.name] ?? ""}
                                                    placeholder={param.placeholder}
                                                    onChange={(event) =>
                                                        setParam(param.name, event.target.value)
                                                    }
                                                    className="h-11 w-full rounded-lg border border-slate-200 bg-card px-3 text-sm text-slate-800 transition focus:border-[#6A00FF] focus:outline-none placeholder:text-slate-300"
                                                />
                                            )}

                                            {param.help && (
                                                <span className="mt-1 block text-[11px] text-slate-400">
                                                    {param.help}
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Response */}
                    <section className="rounded-xl border border-slate-200 bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                {result ? (
                                    <>
                                        <span
                                            className={`rounded border px-2 py-0.5 font-bold ${ok
                                                ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                                                : "border-red-100 bg-red-50/80 text-red-600"
                                                }`}
                                        >
                                            {result.status} {result.statusText}
                                        </span>

                                        <span className="text-slate-400">{result.ms} ms</span>
                                        <span className="text-slate-400">
                                            {formatBytes(result.size)}
                                        </span>

                                        {rows.length > 0 && (
                                            <span className="text-slate-400">
                                                {rows.length} row{rows.length === 1 ? "" : "s"}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-slate-400">No response yet</span>
                                )}
                            </div>

                            <div className="flex items-center gap-1 rounded-lg bg-panel p-1">
                                {(["json", "table", "code"] as const).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setTab(value)}
                                        className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition cursor-pointer ${tab === value
                                            ? "bg-card text-slate-900 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                            }`}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-5">
                            {error && (
                                <p className="py-16 text-center text-sm font-medium text-red-400">
                                    {error}
                                </p>
                            )}

                            {!error && !result && tab !== "code" && (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                        <HiOutlineCircleStack className="h-6 w-6" />
                                    </div>

                                    <h4 className="text-lg font-semibold text-slate-900">
                                        Nothing has been run yet
                                    </h4>

                                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                                        Pick an endpoint, fill in the path and hit Run. The
                                        response, a table view and copyable code all land here.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => run()}
                                        disabled={!canRun}
                                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-slate-400 cursor-pointer"
                                    >
                                        <HiOutlinePlay className="h-4 w-4" />
                                        Run request
                                    </button>
                                </div>
                            )}

                            {!error && result && tab === "json" && (
                                <JsonView value={result.body} className="max-h-[520px]" />
                            )}

                            {!error && result && tab === "table" && (
                                rows.length === 0 ? (
                                    <p className="py-20 text-center text-muted">
                                        This response has no array to tabulate — the JSON tab has
                                        the full body.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="border-b border-gray-200/40 text-left text-sm font-bold text-muted">
                                                    {columns.map((column) => (
                                                        <th
                                                            key={column}
                                                            className="whitespace-nowrap px-6 py-3 font-mono text-xs"
                                                        >
                                                            {column}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-gray-200/30">
                                                {rows.map((row, index) => (
                                                    <tr
                                                        key={String(row._id ?? index)}
                                                        className="text-slate-800 transition hover:bg-gray-200/40"
                                                    >
                                                        {columns.map((column) => (
                                                            <td
                                                                key={column}
                                                                className="max-w-[240px] truncate px-6 py-2 text-sm"
                                                                title={formatCell(row[column])}
                                                            >
                                                                {formatCell(row[column])}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            )}

                            {tab === "code" && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-slate-500">
                                            Same key, same headers — this is the call the console
                                            just made.
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => setRevealKey((value) => !value)}
                                            disabled={!apiKey}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                        >
                                            {revealKey ? (
                                                <>
                                                    <HiOutlineEyeSlash className="h-3.5 w-3.5" />
                                                    Hide key
                                                </>
                                            ) : (
                                                <>
                                                    <HiOutlineEye className="h-3.5 w-3.5" />
                                                    Reveal key
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <CodeBlock
                                        title="cURL"
                                        code={toCurl(url, keyForSnippet)}
                                        copyValue={toCurl(url, apiKey ?? "")}
                                    />

                                    <CodeBlock
                                        title="JavaScript"
                                        code={toFetchSnippet(url, keyForSnippet)}
                                        copyValue={toFetchSnippet(url, apiKey ?? "")}
                                    />

                                    <p className="text-[11px] text-slate-400">
                                        Copy always puts the real key on the clipboard, whether or
                                        not it is shown here.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Offset paging, straight from the server's own meta. */}
                        {!error && result && pagination && tab !== "code" && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-8 py-5">
                                <p className="text-sm text-gray-500">
                                    Page {pagination.page} of {pagination.totalPages || 1} ·{" "}
                                    {pagination.total} total
                                </p>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => goToPage(pagination.page - 1)}
                                        disabled={pagination.page <= 1 || running}
                                        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-control text-slate-800 transition hover:bg-gray-300 disabled:opacity-40 cursor-pointer"
                                    >
                                        <HiChevronLeft className="h-4 w-4" />
                                    </button>

                                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-sm font-bold text-white">
                                        {pagination.page}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => goToPage(pagination.page + 1)}
                                        disabled={!pagination.hasMore || running}
                                        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-control text-slate-800 transition hover:bg-gray-300 disabled:opacity-40 cursor-pointer"
                                    >
                                        <HiChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* The activity feed pages by cursor instead. */}
                        {!error && result && !pagination && nextCursor && tab !== "code" && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-8 py-5">
                                <p className="font-mono text-xs text-gray-500">
                                    nextCursor: {String(nextCursor)}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => followCursor(String(nextCursor))}
                                    disabled={running}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-slate-200/70 disabled:opacity-40 cursor-pointer"
                                >
                                    Next page
                                    <HiChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
