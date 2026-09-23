"use client";

import { useEffect, useRef, useState } from "react";
import {
    HiOutlineXMark,
    HiOutlineChevronDown,
    HiOutlineCheck,
    HiOutlineEnvelope,
    HiOutlineIdentification,
} from "react-icons/hi2";

/**
 * How the person being invited is named.
 *
 * The server accepts either and does the lookup itself, so the client's only
 * job is to say WHICH one it is sending. Keeping that explicit — rather than
 * posting whatever was typed as `userId` and letting the backend's
 * "maybe it is an email" fallback sort it out — is what lets the form reject a
 * malformed address before the request, instead of the round trip coming back
 * with a flat "User not found" that names no cause.
 */
export type InviteIdentifier = { email: string } | { userId: string };

type InviteMode = "email" | "id";

interface ModeSpec {
    value: InviteMode;
    tab: string;
    label: string;
    placeholder: string;
    /** Shown under the field — says where to GET this, not what it is. */
    hint: string;
    invalid: string;
    icon: typeof HiOutlineEnvelope;
}

/**
 * Email leads because it is the only one of the two a colleague already knows.
 * A user id has to be fetched from somewhere first (a profile card, the row
 * menu on a module), which makes it the fallback, not the default.
 */
const MODES: ModeSpec[] = [
    {
        value: "email",
        tab: "By email",
        label: "Email address",
        placeholder: "name@company.com",
        hint: "They must already have an account with this address.",
        invalid: "Enter a complete email address.",
        icon: HiOutlineEnvelope,
    },
    {
        value: "id",
        tab: "By user ID",
        label: "User ID",
        placeholder: "24-character user ID",
        hint: "Copy it from a person's profile card.",
        invalid: "A user ID is 24 characters, letters a-f and digits only.",
        icon: HiOutlineIdentification,
    },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors the server's ObjectId check — see addWorkspaceMember.
const USER_ID_PATTERN = /^[0-9a-f]{24}$/i;

const isComplete = (mode: InviteMode, value: string) =>
    mode === "email"
        ? EMAIL_PATTERN.test(value.trim())
        : USER_ID_PATTERN.test(value.trim());

const roles = [
    {
        value: "member",
        label: "Member",
        description: "Can work inside the workspace",
    },
    {
        value: "admin",
        label: "Admin",
        description: "Can manage workspace members",
    },
    {
        value: "guest",
        label: "Guest",
        description: "Has limited workspace access",
    },
];

interface MemberInviteProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    /** Whatever was typed — an email or an id, depending on the active tab. */
    identifier: string;
    setIdentifier: (value: string) => void;
    role: string;
    setRole: (value: string) => void;
    adding: boolean;
    inviteMember: (identifier: InviteIdentifier) => void;
}

export default function MemberInvite(props: MemberInviteProps) {
    /**
     * The dialog owns the active tab, and that tab has to be back on Email
     * every time the modal opens. Unmounting it is what resets it: an effect
     * watching `open` to set state is the reset effect this codebase does not
     * write, and a `key` would have to be invented by all three call sites.
     */
    if (!props.open) return null;

    return <InviteDialog {...props} />;
}

function InviteDialog({
    setOpen,
    identifier,
    setIdentifier,
    role,
    setRole,
    adding,
    inviteMember,
}: MemberInviteProps) {
    const [mode, setMode] = useState<InviteMode>("email");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [touched, setTouched] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const spec = MODES.find((item) => item.value === mode) ?? MODES[0];
    const selectedRole = roles.find((item) => item.value === role) || roles[0];

    const value = identifier.trim();
    const ready = isComplete(mode, identifier);
    // Only complain about a half-typed address once they have moved on from it.
    const showError = touched && value.length > 0 && !ready;

    /**
     * Switching tabs clears the field. An email is never a valid id and an id
     * is never a valid email, so carrying the old text across would leave the
     * form holding a value it has just declared invalid.
     */
    const switchTo = (next: InviteMode) => {
        if (next === mode) return;
        setMode(next);
        setIdentifier("");
        setTouched(false);
    };

    const submit = () => {
        if (!ready || adding) return;
        inviteMember(mode === "email" ? { email: value } : { userId: value });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-5 z-50">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
                className="rounded-2xl px-6 py-5 w-full max-w-md shadow-2xl bg-card border border-slate-200"
            >
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-semibold font-google-sans text-slate-900">
                            Invite Member
                        </h2>

                        <p className="text-xs text-slate-400 mt-1 font-dmsans">
                            They&apos;ll join once they accept the invite
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition"
                        aria-label="Close"
                    >
                        <HiOutlineXMark strokeWidth={2.5} size={17} />
                    </button>
                </div>

                {/* A two-way choice that changes what the field below expects —
                    a segmented control, not a select, so both options are
                    readable without opening anything. */}
                <div
                    role="tablist"
                    aria-label="Invite by"
                    className="mb-4 flex gap-1 rounded-xl bg-control p-1"
                >
                    {MODES.map((item) => {
                        const Icon = item.icon;
                        const active = item.value === mode;

                        return (
                            <button
                                key={item.value}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => switchTo(item.value)}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer font-dmsans ${
                                    active
                                        ? "bg-card text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                <Icon size={15} />
                                {item.tab}
                            </button>
                        );
                    })}
                </div>

                <div className="mb-4">
                    <label
                        htmlFor="invite-identifier"
                        className="text-xs mb-1.5 block font-google-sans text-slate-700"
                    >
                        {spec.label}
                    </label>

                    <input
                        id="invite-identifier"
                        // Gives phones the right keyboard and the browser its own
                        // address autofill, which is most of the point of asking
                        // for an email rather than an id.
                        type={mode === "email" ? "email" : "text"}
                        inputMode={mode === "email" ? "email" : "text"}
                        autoComplete={mode === "email" ? "email" : "off"}
                        autoFocus
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder={spec.placeholder}
                        aria-invalid={showError}
                        className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition font-dmsans placeholder:text-slate-400 ${
                            showError
                                ? "border-red-400 focus:ring-2 focus:ring-red-400/15"
                                : "border-slate-300 focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/10"
                        }`}
                    />

                    <p
                        className={`mt-1.5 text-xs font-dmsans ${
                            showError ? "text-red-500" : "text-slate-400"
                        }`}
                    >
                        {showError ? spec.invalid : spec.hint}
                    </p>
                </div>

                <div className="mb-6">
                    <label className="text-xs mb-1.5 block font-google-sans text-slate-700">
                        Assign Role
                    </label>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition font-dmsans flex items-center justify-between text-left cursor-pointer ${
                                dropdownOpen
                                    ? "border-[#415A77] ring-2 ring-[#415A77]/10"
                                    : "border-slate-300 hover:border-slate-400"
                            }`}
                        >
                            <div>
                                <div className="text-slate-800 font-medium">
                                    {selectedRole.label}
                                </div>

                                <div className="text-xs text-slate-400 mt-0.5">
                                    {selectedRole.description}
                                </div>
                            </div>

                            <HiOutlineChevronDown
                                size={17}
                                className={`text-slate-400 transition-transform ${
                                    dropdownOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {dropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-card border border-slate-200 rounded-xl shadow-xl p-1.5">
                                {roles.map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => {
                                            setRole(item.value);
                                            setDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg transition cursor-pointer ${
                                            role === item.value
                                                ? "bg-slate-100"
                                                : "hover:bg-slate-50"
                                        }`}
                                    >
                                        <div>
                                            <div className="text-sm font-medium text-slate-800 font-dmsans">
                                                {item.label}
                                            </div>

                                            <div className="text-xs text-slate-400 mt-0.5 font-dmsans">
                                                {item.description}
                                            </div>
                                        </div>

                                        {role === item.value && (
                                            <HiOutlineCheck
                                                size={17}
                                                strokeWidth={2.5}
                                                className="text-[#FB923C]"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={adding || !ready}
                        className="flex-1 bg-[#FB923C] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#FB923C]/80 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer font-dmsans"
                    >
                        {adding ? "Sending…" : "Send Invite"}
                    </button>

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="flex-1 bg-card border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition cursor-pointer font-dmsans"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
