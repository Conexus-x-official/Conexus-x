"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
    HiOutlineArrowPath,
    HiOutlineArrowTopRightOnSquare,
    HiOutlineArrowsPointingIn,
    HiOutlineArrowsPointingOut,
    HiOutlinePlay,
} from "react-icons/hi2";
import type { ViewContext } from "@conexus-x/sdk";

import ExtensionFrame from "@/components/developer/ExtensionFrame";
import Tooltip from "@/components/ui/helpers/tooltip";
import { readUser, readUserServer, subscribeUser } from "@/lib/auth";
import {
    checkPreviewUrl,
    readPreviewUrl,
    readPreviewUrlServer,
    savePreviewUrl,
    subscribePreviewUrl,
} from "@/lib/previewUrl";
import { useGetMembersQuery } from "@/store/api/members.api";
import { useGetWorkspacesQuery } from "@/store/api/workspaces.api";
import { useAppSelector } from "@/store/hooks";
import type { MemberRole } from "@/lib/roles";

/**
 * Run somebody's extension inside the CRM before it is published.
 *
 * The developer serves their view (`npm run dev`, then `npm run tunnel` for a
 * public URL), pastes the address here, and the app frames it exactly as a
 * module would — same bridge, same scope gate, same credentials. It is the step
 * between "it renders on my laptop" and "it is approved and installed", and
 * without it the first time an extension meets the real host is in front of a
 * customer.
 *
 * Deliberately WORKSPACE-SCOPED: the preview mounts against a workspace, not a
 * module. Module, collection and record context come later, with the surfaces
 * that actually provide them; guessing a module here would teach extension
 * authors a context shape the real host does not hand out at this level.
 *
 * WHICH WORKSPACE is decided the same way the rest of the app decides it —
 * whichever one is ACTIVE (the sidebar's own selection), never a picker of its
 * own. A second workspace switcher living only on this page would answer "which
 * workspace am I in" differently depending which screen asked, and an extension
 * previewed against the wrong one is a wasted test.
 */

/** Reload the frame by remounting it — a new key, not a reload() we cannot reach across origins. */
const useReloadKey = () => useState(0);

export default function ExtensionPreview() {
    const me = useSyncExternalStore(subscribeUser, readUser, readUserServer);
    const { resolvedTheme } = useTheme();

    const savedUrl = useSyncExternalStore(
        subscribePreviewUrl,
        readPreviewUrl,
        readPreviewUrlServer
    );

    const [draft, setDraft] = useState(savedUrl);
    const [error, setError] = useState<string | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [allowWrites, setAllowWrites] = useState(false);
    const [reloadKey, setReloadKey] = useReloadKey();

    const activeWorkspaceId = useAppSelector((state) => state.ui.activeWorkspaceId);
    const { data: workspaces = [] } = useGetWorkspacesQuery();

    // The same fallback the rest of the app uses when nothing is active yet
    // (a fresh sign-in with no sidebar selection made) — never a picker here.
    const workspaceId = activeWorkspaceId || workspaces[0]?._id || "";
    const workspace = workspaces.find((item) => item._id === workspaceId);

    // The role the extension is told it has. Read from the real membership
    // rather than assumed: a view hides what it cannot do, and telling it
    // "member" while previewing as an owner hides half the thing being tested.
    const { data: members = [] } = useGetMembersQuery(workspaceId, {
        skip: !workspaceId,
    });

    const myRole: MemberRole =
        members.find((member) => member.user?._id === me?.id)?.role ?? "member";

    /** Escape leaves fullscreen — the only way out when the app chrome is covered. */
    useEffect(() => {
        if (!fullscreen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setFullscreen(false);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [fullscreen]);

    const load = (event: React.FormEvent) => {
        event.preventDefault();

        const checked = checkPreviewUrl(draft);

        if (checked.error) {
            setError(checked.error);
            return;
        }

        setError(null);
        savePreviewUrl(checked.url);
        setReloadKey((value) => value + 1);
    };

    /**
     * The context handed to the extension.
     *
     * Built fresh each render on purpose — the host diffs it by value and only
     * pushes when something actually changed, so this costs nothing and can
     * never go stale behind a memo.
     */
    const context: ViewContext | null = me
        ? {
            instanceId: `preview-${workspaceId || "none"}`,
            viewId: "preview",
            appId: "preview",
            workspaceId,
            selectedRecordIds: [],
            user: {
                id: me.id,
                firstName: me.firstName,
                lastName: me.lastName,
                email: me.email,
                avatar: me.avatar,
            },
            role: myRole,
            // ViewContext carries light or dark only. The app's blue/green/purple
            // families are light-based, so anything that is not dark is light —
            // an extension theming itself from this must not have to know our
            // palette names.
            theme: resolvedTheme === "dark" ? "dark" : "light",
            locale: "en",
            environment: "test",
        }
        : null;

    const ready = Boolean(savedUrl && context && workspaceId);

    return (
        <div className="max-w-5xl p-5">
            <div className="mb-6">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold text-foreground">Preview</h1>
                </div>
                <p className="mt-1 text-sm text-muted">
                    Run an extension inside Conexus X before you publish it. Serve your
                    view, paste its address, and it is framed here the way a module frames
                    it — same bridge, same permissions, your own account.
                </p>
            </div>

            <form onSubmit={load} className="mb-3 flex flex-wrap items-center gap-2">
                <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="https://your-view.trycloudflare.com"
                    spellCheck={false}
                    aria-label="Extension URL"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-card px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
                />

                <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover cursor-pointer"
                >
                    {savedUrl && savedUrl === checkPreviewUrl(draft).url ? (
                        <>
                            <HiOutlineArrowPath className="h-4 w-4" /> Reload
                        </>
                    ) : (
                        <>
                            <HiOutlinePlay className="h-4 w-4" /> Load
                        </>
                    )}
                </button>

                <Tooltip label="Open this preview in a new tab" side="bottom">
                    {/* No id in the href — the URL lives in localStorage now,
                        so the new tab reads the same saved value on its own. */}
                    <a
                        href="/developer/preview"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open this preview in a new tab"
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600 transition hover:bg-control hover:text-slate-900 cursor-pointer"
                    >
                        <HiOutlineArrowTopRightOnSquare className="h-4 w-4" />
                    </a>
                </Tooltip>

                <Tooltip label={fullscreen ? "Leave fullscreen" : "Fullscreen"} side="bottom">
                    <button
                        type="button"
                        onClick={() => setFullscreen((value) => !value)}
                        aria-label={fullscreen ? "Leave fullscreen" : "Fullscreen"}
                        disabled={!ready}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600 transition hover:bg-control hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        {fullscreen ? (
                            <HiOutlineArrowsPointingIn className="h-4 w-4" />
                        ) : (
                            <HiOutlineArrowsPointingOut className="h-4 w-4" />
                        )}
                    </button>
                </Tooltip>
            </form>

            {error ? (
                <p className="mb-3 text-[13px] text-rose-600">{error}</p>
            ) : null}

            {/* Read-only — WHICH workspace is decided by the app's own active
                selection (see the file header), not by a picker living here. */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                    Previewing as workspace
                </span>

                {workspace ? (
                    <span className="nav-glass rounded-lg border border-transparent px-2.5 py-1 text-[12px] font-semibold text-foreground">
                        {workspace.name}
                    </span>
                ) : (
                    <span className="text-[12px] text-muted">none selected</span>
                )}

                <label className="ml-auto flex select-none items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={allowWrites}
                        onChange={(event) => setAllowWrites(event.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
                    />
                    Allow writes
                </label>
            </div>

            {/* ONE tree in both modes — only the wrapper's classes change.
                Rendering a different structure for fullscreen would remount the
                iframe, which reloads the extension and drops whatever state the
                developer was in the middle of testing. */}
            <div
                className={
                    fullscreen
                        ? "fixed inset-0 z-50 flex flex-col bg-card"
                        : "flex h-[620px] flex-col overflow-hidden rounded-xl border border-hairline bg-card"
                }
            >
                <button
                    type="button"
                    onClick={() => setFullscreen(false)}
                    className={`absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-card px-2.5 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition hover:bg-control hover:text-slate-900 cursor-pointer ${fullscreen ? "" : "hidden"
                        }`}
                >
                    <HiOutlineArrowsPointingIn className="h-4 w-4" />
                    Exit fullscreen
                    <span className="text-muted">Esc</span>
                </button>

                {ready && context ? (
                    <ExtensionFrame
                        key={`${savedUrl}-${workspaceId}-${allowWrites}-${reloadKey}`}
                        url={savedUrl}
                        context={context}
                        allowWrites={allowWrites}
                        className="min-h-0 flex-1"
                    />
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                        <p className="text-sm font-medium text-slate-600">
                            {workspaces.length === 0
                                ? "Create a workspace first — a preview mounts against one."
                                : "Nothing loaded yet"}
                        </p>
                        <p className="max-w-md text-[13px] text-muted">
                            Start your extension with <code>npm run dev</code>, then
                            <code className="mx-1">npm run tunnel</code> for a public
                            address, and paste it above. A localhost URL works too while
                            you are on this machine.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
