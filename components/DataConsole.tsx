"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    HiOutlineCircleStack,
    HiOutlinePlay,
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
import { SCROLLBAR } from "./ui/helpers/scrollbar";
import EndpointPicker from "./ui/menu/endpointPicker";
import SelectMenu from "./ui/menu/selectMenu";
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
        /*
            NO MAX WIDTH. It was capped at 1400px, so collapsing the sidebar
            gave the extra 220px to the right-hand gutter rather than to the
            two panels — the rail moved and nothing else did. The console is a
            pair of columns that both benefit from every pixel: a JSON body and
            a table are exactly the things a wide screen is for.

            THE PAGE OWNS ITS OWN GUTTER. The developer layout used to add
            px-8 py-8 and this file spent three rules cancelling it — a bleed
            on the header, a magic `h-[calc(100vh-8.5rem)]` on the grid to
            guess back what the header and that padding had taken, and
            compensating margins downstream. Every one of them was a second
            copy of a number owned somewhere else, and they drifted the moment
            either end moved. The layout is bare now, so there is nothing to
            cancel: h-full is the box, and px-8 is applied by the two things
            that actually want a gutter.
        */
        <div className="flex flex-col font-dmsans lg:h-full">

            {/*
                STICKY HEADER, and it owns the endpoint choice.

                The catalog used to be a 260px column pinned down the left —
                a fifth of the screen held permanently for a question asked once
                per request. It is a dropdown up here now, beside the API key,
                which is the other thing every request needs; the space it freed
                is what lets the builder and the response sit side by side.

                px-8 restores the gutter the root cancelled, so the bar's
                background and its bottom rule run the full width of the scroll
                container rather than floating inside it. shrink-0 is what
                makes it the fixed half of the height contract below.
            */}
            <header className="sticky top-0 z-20 shrink-0 border-b border-hairline bg-card px-8 pb-2 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0 ">
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-lg font-semibold text-slate-900">
                                Data Console
                            </h1>
                        </div>

                        <span className="hidden text-xs text-muted xl:block">
                            Read-only — every endpoint here is a GET.
                        </span>
                    </div>

                    {/*
                        THE PICKER SITS WHERE THE KEY CHIP WAS.

                        That chip showed a masked key beside a link to the page
                        that manages it — a status readout for something that
                        either works or produces the red banner below, which
                        says the same thing louder and only when it matters. The
                        endpoint is the one choice this screen is actually built
                        around, so it gets the corner instead, and the header
                        drops from two rows to one.
                    */}
                    <EndpointPicker
                        endpoints={ENDPOINTS}
                        groups={ENDPOINT_GROUPS}
                        value={endpoint.id}
                        onChange={(id) => {
                            const next = ENDPOINTS.find((item) => item.id === id);
                            if (next) selectEndpoint(next);
                        }}
                    />
                </div>

                {!keyLoading && !apiKey && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-600">
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

            {/*
                TWO COLUMNS, half and half: the request on the left, the
                response on the right. Configuring a parameter and reading what
                it did are one task, and stacked they were two screens apart —
                every change meant scrolling down to look and back up to edit.

                Each column scrolls on its own so a long JSON body cannot drag
                the builder off the top. Below `lg` they stack, because two
                240px columns are worse than one of either — and there every
                height rule drops away, so the section scrolls as one page.

                lg:flex-1 lg:min-h-0 IS the height contract: the header is
                shrink-0, so this is the remainder, whatever the header turned
                out to be. lg:items-stretch is what makes both columns as tall
                as the row — which is what their own min-h-0 + overflow needs
                in order to have something to be shorter than.
            */}
            <div className="grid items-start gap-6 px-8 pb-8 pt-5 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:items-stretch">

                <div className="flex min-w-0 flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">

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

                            {/* The one place on this screen a native scrollbar
                                still showed: a 15px OS bar under a 12px mono
                                line, half the height of the strip it sat in. */}
                            <span className={`min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-0.5 font-mono text-xs text-slate-700 ${SCROLLBAR}`}>
                                {url}
                            </span>

                            <CopyButton value={url} label="URL" />

                            <button
                                type="button"
                                onClick={() => run()}
                                disabled={!canRun}
                                title="Ctrl/Cmd + Enter"
                                /* SAME BOX AS THE COPY BUTTON BESIDE IT — same
                                   radius, padding, gap and type scale. They are
                                   two controls in one strip and Run was a size
                                   larger, which made the strip lumpy rather
                                   than making Run look important. It keeps
                                   nav-glass and the semibold weight, so it is
                                   still visibly the primary of the pair. */
                                className="nav-glass inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                            >
                                {running ? (
                                    <HiOutlineArrowPath className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <HiOutlinePlay className="h-3.5 w-3.5" />
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

                                                {/* The id rides along as the hint:
                                                    what you pick by is the name,
                                                    but what lands in the URL above
                                                    is the id, and seeing the two
                                                    together is how you check the
                                                    request is the one you meant. */}
                                                <SelectMenu
                                                    value={ids[kind] ?? ""}
                                                    disabled={blocked}
                                                    ariaLabel={PICKER_LABELS[kind]}
                                                    placeholder={
                                                        blocked
                                                            ? `Pick a ${parent} first`
                                                            : options.length
                                                                ? "Select..."
                                                                : "Nothing here yet"
                                                    }
                                                    options={options.map((option) => ({
                                                        value: option._id,
                                                        label: option.name,
                                                        hint: option._id,
                                                    }))}
                                                    onChange={(next) => pickId(kind, next)}
                                                />
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
                                                <SelectMenu
                                                    value={params[param.name] ?? ""}
                                                    ariaLabel={param.label}
                                                    placeholder="default"
                                                    options={(param.options ?? []).map((option) => ({
                                                        value: option.value,
                                                        label: option.label,
                                                    }))}
                                                    onChange={(next) => setParam(param.name, next)}
                                                />
                                            ) : (
                                                <input
                                                    type={param.type === "number" ? "number" : "text"}
                                                    value={params[param.name] ?? ""}
                                                    placeholder={param.placeholder}
                                                    onChange={(event) =>
                                                        setParam(param.name, event.target.value)
                                                    }
                                                    className="h-11 w-full rounded-lg border border-slate-200 bg-card px-3 text-sm text-slate-800 transition focus:border-slate-400 focus:outline-none placeholder:text-slate-300"
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
                </div>

                {/*
                    Response — the RIGHT half.

                    THE SCROLL IS ON THE CARD'S BODY, NOT THE COLUMN. Scrolling
                    the column moved the whole card: it left the card sized to
                    its content — floating short of the bottom of a screen it
                    was given the full height of — and it carried the status
                    line, the json/table/code tabs and the pager away with the
                    payload, so reading to the end of a body meant scrolling
                    back up to change how you were looking at it.

                    The card CAPS at the row rather than filling it. Fixing the
                    float by giving it flex-1 traded one wrong height for the
                    other: the Code tab is two short snippets, and a card
                    stretched to the full column under them is a metre of empty
                    bordered box. Default flex (grow 0, shrink 1) says the only
                    thing that is true of both — as tall as its content, never
                    taller than the row. min-h-0 is what lets the shrink land on
                    the body instead of overflowing the card.

                    Chrome pinned top and bottom, body scrolls between them.
                    overflow-auto, not -y: a wide row in the table view has to
                    go somewhere too.
                */}
                <div className="flex min-w-0 flex-col lg:min-h-0">
                    <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-card">
                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
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

                        <div className="min-h-0 flex-1 overflow-auto p-5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">
                            {error && (
                                <p className="py-16 text-center text-sm font-medium text-red-400">
                                    {error}
                                </p>
                            )}

                            {!error && !result && tab !== "code" && (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-300 bg-card text-slate-600">
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
                                        className="nav-glass mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-900 transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                    >
                                        <HiOutlinePlay className="h-4 w-4" />
                                        Run request
                                    </button>
                                </div>
                            )}

                            {!error && result && tab === "json" && (
                                <JsonView value={result.body} />
                            )}

                            {!error && result && tab === "table" && (
                                rows.length === 0 ? (
                                    <p className="py-20 text-center text-muted">
                                        This response has no array to tabulate — the JSON tab has
                                        the full body.
                                    </p>
                                ) : (
                                    <div className={`overflow-x-auto ${SCROLLBAR}`}>
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
                            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
                                {/* CARD CHROME, not a page control. Three 40px
                                    pills under a 28px tab strip made the footer
                                    the heaviest thing in the panel, and it is
                                    the least important: the payload is what you
                                    came for. 28px squares on the card's own
                                    rounded-lg, matched to the status line's
                                    text-xs at the other end of the card. */}
                                <p className="text-xs text-slate-400">
                                    Page {pagination.page} of {pagination.totalPages || 1} ·{" "}
                                    {pagination.total} total
                                </p>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => goToPage(pagination.page - 1)}
                                        disabled={pagination.page <= 1 || running}
                                        aria-label="Previous page"
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-control text-slate-800 transition hover:bg-gray-300 disabled:opacity-40 cursor-pointer"
                                    >
                                        <HiChevronLeft className="h-3.5 w-3.5" />
                                    </button>

                                    <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-black px-1.5 text-xs font-bold text-white">
                                        {pagination.page}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => goToPage(pagination.page + 1)}
                                        disabled={!pagination.hasMore || running}
                                        aria-label="Next page"
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-control text-slate-800 transition hover:bg-gray-300 disabled:opacity-40 cursor-pointer"
                                    >
                                        <HiChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* The activity feed pages by cursor instead. */}
                        {!error && result && !pagination && nextCursor && tab !== "code" && (
                            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
                                <p className="min-w-0 truncate font-mono text-xs text-slate-400">
                                    nextCursor: {String(nextCursor)}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => followCursor(String(nextCursor))}
                                    disabled={running}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-control px-2.5 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-gray-300 disabled:opacity-40 cursor-pointer"
                                >
                                    Next page
                                    <HiChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
