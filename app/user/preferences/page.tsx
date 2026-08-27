"use client";

import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { createElement } from "react";
import {
    HiOutlineComputerDesktop,
    HiOutlineSun,
    HiOutlineMoon,
    HiOutlineSwatch,
    HiCheck,
    HiOutlineArrowPath
} from "react-icons/hi2";
import { TbKeyboard } from "react-icons/tb";

import UserSidebar from "@/components/userSidebar";
import Tooltip from "@/components/ui/helpers/tooltip";
import { toast } from "@/components/ui/toast";
import { themes } from "@/data/data";
import { readUser, readUserServer, subscribeUser, updateUser } from "@/lib/auth";
import {
    SHORTCUTS,
    DEFAULT_SHORTCUTS,
    comboFromEvent,
    formatCombo,
    isModifierOnly,
    type Combo,
    type ShortcutId
} from "@/lib/shortcuts";
import { useUpdatePreferencesMutation } from "@/store/api/preferences.api";

/**
 * Preferences — how the app behaves for this person, as opposed to what is in
 * it. Reached from the account nav beside Profile, Security and Notifications.
 *
 * NAMED FOR WHERE IT IS STORED. "Settings" is the word every section of an app
 * reaches for, and this one is specifically `user.preferences` — the same bag
 * the sidebar's rail mode lives in. Calling it Preferences means the page, the
 * nav row, the API field and the database column all say the same word, which
 * is the difference between a name and a label.
 *
 * Two sections today: the theme, and the keyboard. Both are ACCOUNT-level, not
 * browser-level, so they follow the person to another machine.
 *
 * The shortcut list is rendered from lib/shortcuts.ts, never hand-written here.
 * A shortcut that exists but is not listed is a shortcut nobody can discover or
 * change, which is how the two we already had ended up hardcoded in the files
 * that used them.
 */

const THEME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    system: HiOutlineComputerDesktop,
    light: HiOutlineSun,
    dark: HiOutlineMoon
};

/** Same rule as themebutton.tsx: resolve inside a component, never bind a
 *  looked-up component to a local name (the React Compiler rejects that). */
function ThemeIcon({ value, className }: { value?: string; className?: string }) {
    return createElement(
        (value && THEME_ICONS[value]) || HiOutlineSwatch,
        { className }
    );
}

const subscribeNoop = () => () => { };

export default function PreferencesPage() {
    const { theme, setTheme } = useTheme();

    // The active theme is only known on the client; render neutral on the
    // server and swap in the real selection after hydration.
    const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
    const activeTheme = mounted ? theme : undefined;

    const user = useSyncExternalStore(subscribeUser, readUser, readUserServer);
    const saved = (user?.preferences?.shortcuts ?? {}) as Partial<Record<ShortcutId, Combo>>;

    const [updatePreferences] = useUpdatePreferencesMutation();

    /** Which row is listening for keys. Only ever one. */
    const [recording, setRecording] = useState<ShortcutId | null>(null);

    const bindingOf = (id: ShortcutId): Combo => saved[id] || DEFAULT_SHORTCUTS[id];

    /**
     * Optimistic, then durable — the same shape as the sidebar's rail toggle.
     *
     * updateUser() raises the event every mounted listener is subscribed to, so
     * the new key works on the frame it is set; the request only decides
     * whether it STAYS set, and a failure puts the old one back rather than
     * leaving the app disagreeing with the account.
     */
    const save = async (next: Partial<Record<ShortcutId, Combo>>, note: string) => {
        const previous = saved;
        const merged = { ...saved, ...next };

        // An entry equal to its default is REMOVED rather than stored: absence
        // is how "still the default" is written, so a later change to a default
        // reaches everyone who never overrode it.
        const cleaned: Record<string, Combo> = {};
        for (const [id, combo] of Object.entries(merged)) {
            if (combo && combo !== DEFAULT_SHORTCUTS[id as ShortcutId]) cleaned[id] = combo;
        }

        updateUser({ preferences: { ...user?.preferences, shortcuts: cleaned } });

        try {
            await updatePreferences({ shortcuts: cleaned }).unwrap();
            toast.success(note);
        } catch (error) {
            updateUser({ preferences: { ...user?.preferences, shortcuts: previous as Record<string, string> } });
            toast.error(
                "Could not save that shortcut",
                (error as { data?: { message?: string } })?.data?.message
            );
        }
    };

    /**
     * A row records the NEXT key pressed.
     *
     * Escape cancels rather than binding — a shortcut you cannot get out of
     * setting is a trap, and Escape is what every other layer in this app
     * already answers. A modifier-only shortcut commits on key-UP, because
     * while Shift is still down there is no way to tell "the binding is Shift"
     * from "Shift is the start of Shift+K".
     */
    const onRecord = (spec: (typeof SHORTCUTS)[number]) => (event: React.KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const native = event.nativeEvent as KeyboardEvent;

        if (native.key === "Escape") {
            setRecording(null);
            return;
        }

        const combo = comboFromEvent(native);
        if (!combo) return;

        if (spec.kind === "key" && isModifierOnly(combo)) return;
        if (spec.kind === "modifier" && !isModifierOnly(combo)) return;

        // Two rows answering the same keys is a conflict the user cannot see,
        // so it is refused with the name of the row already holding it.
        const clash = SHORTCUTS.find(
            (other) => other.id !== spec.id && bindingOf(other.id) === combo
        );

        if (clash) {
            toast.error(
                `${formatCombo(combo)} is already used`,
                `It is bound to "${clash.label}". Change that one first.`
            );
            setRecording(null);
            return;
        }

        setRecording(null);
        save({ [spec.id]: combo }, `${spec.label} is now ${formatCombo(combo)}`);
    };

    const resetAll = () => save(
        Object.fromEntries(SHORTCUTS.map((s) => [s.id, s.default])) as Record<ShortcutId, Combo>,
        "Shortcuts reset to defaults"
    );

    const anyCustom = SHORTCUTS.some((s) => bindingOf(s.id) !== s.default);

    return (
        /*
            The account section's shell, identical to /user/menage-profile: the
            nav owns the left column and the way out, the page owns the right.
            This had its own sticky navbar with a back button and an avatar in
            it, which beside the account nav would have been two exits and two
            headings for one screen.
        */
        <div className="min-h-screen bg-card">
            <div className="flex">
                <UserSidebar />

                <div className="min-w-0 flex-1 px-8 py-8 font-dmsans">
                    <div className="mb-8">
                        <h1 className="text-2xl font-semibold text-slate-900">
                            Preferences
                        </h1>

                        <p className="mt-1 text-sm text-muted">
                            How the app looks and behaves for you, on every device you sign in from
                        </p>
                    </div>

                    <div className="flex w-full max-w-3xl flex-col gap-6">

                        {/* ── Appearance ───────────────────────────────── */}
                        <section className="rounded-2xl border border-hairline bg-card p-6">
                            <h2 className="text-lg font-semibold text-slate-900">Appearance</h2>
                            <p className="mt-0.5 text-xs text-muted">
                                Applies to every page, on this account.
                            </p>

                            {/* Three cards rather than a dropdown: there are
                                three options and they are the kind you compare,
                                not search. */}
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                {themes.map((item) => {
                                    const active = activeTheme === item.value;

                                    return (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => setTheme(item.value)}
                                            aria-pressed={active}
                                            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${active
                                                ? "border-slate-400 nav-glass"
                                                : "border-hairline hover:bg-control/50"
                                                }`}
                                        >
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-card text-slate-600">
                                                <ThemeIcon value={item.value} className="h-4 w-4" />
                                            </span>

                                            <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                                                {item.name}
                                            </span>

                                            {active && (
                                                <HiCheck className="h-4 w-4 shrink-0 text-slate-900" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* ── Keyboard ─────────────────────────────────── */}
                        <section className="rounded-2xl border border-hairline bg-card p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                                        <TbKeyboard className="h-5 w-5 text-slate-600" />
                                        Keyboard
                                    </h2>
                                    <p className="mt-0.5 text-xs text-muted">
                                        Click a shortcut, then press the keys you want. Escape cancels.
                                    </p>
                                </div>

                                {anyCustom && (
                                    <button
                                        type="button"
                                        onClick={resetAll}
                                        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-card px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-control cursor-pointer"
                                    >
                                        <HiOutlineArrowPath className="h-3.5 w-3.5" />
                                        Reset all
                                    </button>
                                )}
                            </div>

                            <div className="mt-4 divide-y divide-hairline">
                                {SHORTCUTS.map((spec) => {
                                    const combo = bindingOf(spec.id);
                                    const isRecording = recording === spec.id;
                                    const custom = combo !== spec.default;

                                    return (
                                        <div
                                            key={spec.id}
                                            className="flex flex-wrap items-center justify-between gap-3 py-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {spec.label}
                                                </p>
                                                <p className="mt-0.5 text-xs text-muted">
                                                    {spec.hint}
                                                </p>
                                                <p className="mt-1 text-[11px] font-medium text-muted/80">
                                                    Works in: {spec.scope}
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-2">
                                                {/*
                                                    The recorder is a real button
                                                    so it is focusable and reachable
                                                    by keyboard — which matters more
                                                    here than anywhere else in the
                                                    app, since the whole control is
                                                    operated by pressing keys.
                                                */}
                                                <button
                                                    type="button"
                                                    onClick={() => setRecording(isRecording ? null : spec.id)}
                                                    onKeyDown={isRecording ? onRecord(spec) : undefined}
                                                    onKeyUp={
                                                        isRecording && spec.kind === "modifier"
                                                            ? onRecord(spec)
                                                            : undefined
                                                    }
                                                    onBlur={() => isRecording && setRecording(null)}
                                                    aria-label={`Change the shortcut for ${spec.label}`}
                                                    className={`min-w-[132px] rounded-lg border px-3 py-2 text-xs font-semibold transition cursor-pointer ${isRecording
                                                        ? "border-dashed border-slate-500 bg-control text-slate-900"
                                                        : "border-slate-300 bg-card text-slate-800 hover:bg-control"
                                                        }`}
                                                >
                                                    {isRecording
                                                        ? spec.kind === "modifier"
                                                            ? "Hold a modifier…"
                                                            : "Press keys…"
                                                        : formatCombo(combo)}
                                                </button>

                                                {custom && !isRecording && (
                                                    <Tooltip label={`Back to ${formatCombo(spec.default)}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                save(
                                                                    { [spec.id]: spec.default },
                                                                    `${spec.label} is back to ${formatCombo(spec.default)}`
                                                                )
                                                            }
                                                            aria-label={`Reset ${spec.label} to its default`}
                                                            className="rounded-lg p-2 text-muted transition hover:bg-control hover:text-slate-900 cursor-pointer"
                                                        >
                                                            <HiOutlineArrowPath className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
