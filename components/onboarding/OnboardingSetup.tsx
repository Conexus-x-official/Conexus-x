"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { HiCheck, HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";

import {
    ACCOUNT_TYPES,
    PURPOSES,
    REFERRAL_SOURCES,
    TEAM_SIZES,
    accountTypeByKey,
    purposeByKey,
    type AccountType,
    type BoardPreset,
    type OnboardingAnswers,
} from "@/lib/onboarding";
import { DEFAULT_WORKSPACE_ICON, WORKSPACE_ICONS } from "@/lib/workspaceIcons";
import BoardPreview from "./BoardPreview";

/**
 * The signup funnel.
 *
 * LEFT is what the user answers, RIGHT is what those answers build. Nobody has
 * to imagine the result — every choice redraws the preview.
 *
 * COLOUR: there is none, on purpose. Selection is `.nav-glass` and the primary
 * button is `bg-foreground` — the same neutral-surface language the sidebar
 * uses. A setup flow painted in brand purple, status blue and error red reads
 * as a consumer sign-up; a CRM someone is about to run their pipeline in should
 * read as an instrument. The only colour on screen is whatever the user's own
 * board collections bring.
 *
 * One question per step, and the step is skippable. A funnel that demands nine
 * answers before showing anything is a funnel people abandon; every answer here
 * has a defensible default, and Skip jumps straight to the build.
 */

const ICON_CHOICES = WORKSPACE_ICONS.slice(0, 10);

/** Rough validation only — the server is the authority on whether it exists. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StepKey = "type" | "invite" | "referral" | "name" | "boards";

export default function OnboardingSetup({
    firstName,
    submitting,
    onFinish,
    onSkip,
}: {
    firstName: string;
    submitting: boolean;
    onFinish: (answers: OnboardingAnswers) => void;
    onSkip: () => void;
}) {
    const [accountType, setAccountType] = useState<AccountType>("team");
    const [teamSize, setTeamSize] = useState("");
    const [referralSource, setReferralSource] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [workspaceIcon, setWorkspaceIcon] = useState(DEFAULT_WORKSPACE_ICON.key);
    const [purposeKey, setPurposeKey] = useState(PURPOSES[0].key);

    const [invites, setInvites] = useState<string[]>([]);
    const [inviteDraft, setInviteDraft] = useState("");

    const [disabled, setDisabled] = useState<Record<string, string[]>>({});
    const [extras, setExtras] = useState<string[]>([]);
    const [boardDraft, setBoardDraft] = useState("");

    const [index, setIndex] = useState(0);

    const spec = accountTypeByKey(accountType);
    const purpose = purposeByKey(purposeKey);

    /**
     * The invite step is dropped for a personal account rather than shown
     * empty — asking someone who just said "just me" who else to add is a
     * question that answers itself.
     */
    const steps: StepKey[] = useMemo(
        () =>
            (["type", "invite", "referral", "name", "boards"] as StepKey[]).filter(
                (step) => step !== "invite" || spec.invites
            ),
        [spec.invites]
    );

    const step = steps[Math.min(index, steps.length - 1)];
    const isLast = index >= steps.length - 1;

    const chosen: BoardPreset[] = useMemo(() => {
        const off = disabled[purposeKey] ?? [];

        const fromPurpose = purpose.boards.filter(
            (board) => !off.includes(board.key)
        );

        // A board the user typed gets the purpose's own first column set and a
        // starting collection. Guessing columns from a name would be wrong more
        // often than not, and an empty board is a worse start than a plain one.
        const custom: BoardPreset[] = extras.map((name) => ({
            key: `custom-${name}`,
            name,
            blurb: "Yours",
            collection: "Getting started",
            columns: purpose.boards[0].columns,
        }));

        return [...fromPurpose, ...custom];
    }, [purpose, purposeKey, disabled, extras]);

    const workspaceName =
        organizationName.trim() ||
        (firstName ? `${firstName}'s workspace` : "My workspace");

    const answers = (): OnboardingAnswers => ({
        accountType,
        teamSize,
        referralSource,
        organizationName: workspaceName,
        workspaceIcon,
        purposeKey,
        invites,
        boards: chosen,
    });

    const addInvite = () => {
        const email = inviteDraft.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(email) || invites.includes(email)) return;
        setInvites((current) => [...current, email]);
        setInviteDraft("");
    };

    const addBoard = () => {
        const name = boardDraft.trim();
        if (!name) return;

        const taken = chosen.some(
            (board) => board.name.toLowerCase() === name.toLowerCase()
        );

        if (!taken) setExtras((current) => [...current, name]);
        setBoardDraft("");
    };

    const toggleBoard = (key: string) => {
        setDisabled((current) => {
            const list = current[purposeKey] ?? [];
            return {
                ...current,
                [purposeKey]: list.includes(key)
                    ? list.filter((item) => item !== key)
                    : [...list, key],
            };
        });
    };

    const next = () => {
        if (isLast) onFinish(answers());
        else setIndex((value) => value + 1);
    };

    /** Only the last step can be blocked — everything else has a default. */
    const blocked = isLast && chosen.length === 0;

    return (
        <div className="flex h-full w-full flex-col lg:flex-row">
            {/* ── Left: the questions ─────────────────────────────── */}
            <div className="flex w-full flex-col overflow-y-auto px-6 py-8 sm:px-10 lg:w-[52%] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control">
                <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
                    {/* Progress — segments, not a percentage. A bar at 40%
                        invites the question "40% of what"; four ticks answer it. */}
                    <div className="mb-8 flex items-center gap-1.5">
                        {steps.map((key, position) => (
                            <span
                                key={key}
                                className={`h-1 flex-1 rounded-full transition ${position <= index ? "bg-foreground/70" : "bg-control"
                                    }`}
                            />
                        ))}
                    </div>

                    {step === "type" && (
                        <Step
                            title={
                                firstName ? `Welcome, ${firstName}.` : "Welcome."
                            }
                            hint="Who are you setting this up for? It shapes what we build."
                        >
                            <div className="grid gap-2 sm:grid-cols-2">
                                {ACCOUNT_TYPES.map(({ key, label, blurb, icon: Icon }) => (
                                    <Choice
                                        key={key}
                                        selected={key === accountType}
                                        onClick={() => setAccountType(key)}
                                        disabled={submitting}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span className="min-w-0">
                                            <span className="block text-[13px] font-semibold">
                                                {label}
                                            </span>
                                            <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                                                {blurb}
                                            </span>
                                        </span>
                                    </Choice>
                                ))}
                            </div>

                            {spec.invites && (
                                <div className="mt-6">
                                    <Label>How many people, roughly?</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TEAM_SIZES.map((size) => (
                                            <Pill
                                                key={size}
                                                selected={size === teamSize}
                                                onClick={() =>
                                                    setTeamSize(size === teamSize ? "" : size)
                                                }
                                                disabled={submitting}
                                            >
                                                {size}
                                            </Pill>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Step>
                    )}

                    {step === "invite" && (
                        <Step
                            title="Bring your team in"
                            hint="They will be added as members as soon as your workspace is ready. You can do this later instead."
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    value={inviteDraft}
                                    onChange={(event) => setInviteDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            addInvite();
                                        }
                                    }}
                                    type="email"
                                    placeholder="colleague@company.com"
                                    disabled={submitting}
                                    className="flex-1 rounded-lg border border-hairline bg-card px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:opacity-60"
                                />

                                <button
                                    type="button"
                                    onClick={addInvite}
                                    disabled={submitting || !EMAIL_PATTERN.test(inviteDraft.trim())}
                                    aria-label="Add invite"
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-control text-body transition hover:bg-control-hover disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <HiOutlinePlus className="h-4 w-4" />
                                </button>
                            </div>

                            <p className="mt-2 text-[11px] text-muted">
                                They need a Conexus X account already — anything we
                                can&apos;t find is reported back to you, never dropped.
                            </p>

                            {invites.length > 0 && (
                                <div className="mt-4 space-y-1.5">
                                    {invites.map((email) => (
                                        <div
                                            key={email}
                                            className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2"
                                        >
                                            <span className="min-w-0 flex-1 truncate text-[13px] text-body">
                                                {email}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setInvites((current) =>
                                                        current.filter((item) => item !== email)
                                                    )
                                                }
                                                aria-label={`Remove ${email}`}
                                                className="shrink-0 rounded p-0.5 text-muted transition hover:text-foreground cursor-pointer"
                                            >
                                                <HiOutlineXMark className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Step>
                    )}

                    {step === "referral" && (
                        <Step
                            title="How did you hear about Conexus X?"
                            hint="It genuinely helps us know where to spend our time."
                        >
                            <div className="flex flex-wrap gap-1.5">
                                {REFERRAL_SOURCES.map((source) => (
                                    <Pill
                                        key={source}
                                        selected={source === referralSource}
                                        onClick={() =>
                                            setReferralSource(
                                                source === referralSource ? "" : source
                                            )
                                        }
                                        disabled={submitting}
                                    >
                                        {source}
                                    </Pill>
                                ))}
                            </div>
                        </Step>
                    )}

                    {step === "name" && (
                        <Step title={spec.nameLabel} hint="You can rename it any time.">
                            <input
                                value={organizationName}
                                onChange={(event) => setOrganizationName(event.target.value)}
                                placeholder={spec.namePlaceholder}
                                autoFocus
                                disabled={submitting}
                                className="w-full rounded-lg border border-hairline bg-card px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:opacity-60"
                            />

                            <Label className="mt-6">Pick an icon</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {ICON_CHOICES.map(({ key, label, Icon }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setWorkspaceIcon(key)}
                                        title={label}
                                        aria-label={label}
                                        aria-pressed={key === workspaceIcon}
                                        disabled={submitting}
                                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition cursor-pointer ${key === workspaceIcon
                                            ? "nav-glass text-foreground"
                                            : "border border-hairline text-muted hover:bg-control/50 hover:text-foreground"
                                            }`}
                                    >
                                        <Icon className="h-[18px] w-[18px]" />
                                    </button>
                                ))}
                            </div>
                        </Step>
                    )}

                    {step === "boards" && (
                        <Step
                            title="What will you track here?"
                            hint="We'll create these boards, each with a collection ready for your first records."
                        >
                            <div className="grid gap-2 sm:grid-cols-2">
                                {PURPOSES.map(({ key, label, icon: Icon }) => (
                                    <Choice
                                        key={key}
                                        selected={key === purposeKey}
                                        onClick={() => setPurposeKey(key)}
                                        disabled={submitting}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span className="text-[13px] font-semibold">{label}</span>
                                    </Choice>
                                ))}
                            </div>

                            <Label className="mt-6">Boards to create</Label>

                            <div className="space-y-1.5">
                                {purpose.boards.map((board) => {
                                    const on = !(disabled[purposeKey] ?? []).includes(board.key);

                                    return (
                                        <button
                                            key={board.key}
                                            type="button"
                                            onClick={() => toggleBoard(board.key)}
                                            disabled={submitting}
                                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition cursor-pointer ${on
                                                ? "nav-glass"
                                                : "border border-hairline hover:bg-control/50"
                                                }`}
                                        >
                                            <Tick on={on} />

                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-semibold text-foreground">
                                                    {board.name}
                                                </span>
                                                <span className="block text-[11px] text-muted">
                                                    {board.blurb} · collection &ldquo;{board.collection}&rdquo;
                                                </span>
                                            </span>

                                            <span className="shrink-0 text-[11px] text-muted">
                                                {board.columns.length} cols
                                            </span>
                                        </button>
                                    );
                                })}

                                {extras.map((name) => (
                                    <div
                                        key={name}
                                        className="nav-glass flex w-full items-center gap-3 rounded-lg px-3 py-2.5"
                                    >
                                        <Tick on />
                                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                                            {name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExtras((current) =>
                                                    current.filter((item) => item !== name)
                                                )
                                            }
                                            aria-label={`Remove ${name}`}
                                            className="shrink-0 rounded p-0.5 text-muted transition hover:text-foreground cursor-pointer"
                                        >
                                            <HiOutlineXMark className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    value={boardDraft}
                                    onChange={(event) => setBoardDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            addBoard();
                                        }
                                    }}
                                    placeholder="Add your own board…"
                                    disabled={submitting}
                                    className="flex-1 rounded-lg border border-hairline bg-card px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:opacity-60"
                                />

                                <button
                                    type="button"
                                    onClick={addBoard}
                                    disabled={submitting || !boardDraft.trim()}
                                    aria-label="Add board"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-control text-body transition hover:bg-control-hover disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <HiOutlinePlus className="h-4 w-4" />
                                </button>
                            </div>
                        </Step>
                    )}

                    {/* ── Controls ───────────────────────────────── */}
                    <div className="mt-10 flex items-center gap-2">
                        {index > 0 && (
                            <button
                                type="button"
                                onClick={() => setIndex((value) => value - 1)}
                                disabled={submitting}
                                aria-label="Back"
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline text-muted transition hover:bg-control/50 hover:text-foreground cursor-pointer disabled:opacity-60"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={next}
                            disabled={submitting || blocked}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-foreground py-3 text-sm font-semibold text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                            {submitting ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    {isLast ? "Create my workspace" : "Continue"}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onSkip}
                        disabled={submitting}
                        className="mt-3 w-full text-center text-sm text-muted transition hover:text-foreground cursor-pointer disabled:opacity-60"
                    >
                        Skip setup
                    </button>
                </div>
            </div>

            {/* ── Right: what those answers build ─────────────────── */}
            <div className="hidden min-w-0 flex-1 border-l border-hairline bg-panel/40 lg:block">
                <BoardPreview boards={chosen} workspaceName={workspaceName} />
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ *
 *  Small shared pieces — one definition each, so every step matches
 * ------------------------------------------------------------------ */

function Step({
    title,
    hint,
    children,
}: {
    title: string;
    hint: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-2 text-sm text-muted">{hint}</p>
            <div className="mt-8">{children}</div>
        </div>
    );
}

function Label({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span className={`mb-2 block text-xs font-semibold text-body ${className}`}>
            {children}
        </span>
    );
}

function Choice({
    selected,
    onClick,
    disabled,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
            className={`flex items-start gap-2.5 rounded-xl p-3 text-left text-foreground transition cursor-pointer disabled:opacity-60 ${selected
                ? "nav-glass"
                : "border border-hairline hover:bg-control/50"
                }`}
        >
            {children}
        </button>
    );
}

function Pill({
    selected,
    onClick,
    disabled,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition cursor-pointer disabled:opacity-60 ${selected
                ? "nav-glass text-foreground"
                : "border border-hairline text-muted hover:bg-control/50 hover:text-foreground"
                }`}
        >
            {children}
        </button>
    );
}

function Tick({ on }: { on: boolean }) {
    return (
        <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${on
                ? "border-foreground bg-foreground text-card"
                : "border-hairline"
                }`}
        >
            {on && <HiCheck className="h-3 w-3" strokeWidth={3} />}
        </span>
    );
}
