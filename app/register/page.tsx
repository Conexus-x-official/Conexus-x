"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import logo from "@/app/assets/Logo.png";
import Image from "next/image";
import {
    Eye,
    EyeOff,
    ArrowRight,
    Loader2,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import GoogleButton from "@/components/ui/buttons/googleauth";
import AuthShowcase from "@/components/auth/AuthShowcase";
import OnboardingSetup from "@/components/onboarding/OnboardingSetup";
import type { OnboardingAnswers } from "@/lib/onboarding";
import { buildAccount, saveOnboardingProfile } from "@/lib/applyOnboarding";
import { saveToken, saveUser } from "@/lib/auth";
import env from "@/config/env";

const passwordRules = [
    {
        label: "At least 8 characters",
        test: (password: string) => password.length >= 8,
    },
    {
        label: "One uppercase letter",
        test: (password: string) => /[A-Z]/.test(password),
    },
    {
        label: "One lowercase letter",
        test: (password: string) => /[a-z]/.test(password),
    },
    {
        label: "One number",
        test: (password: string) => /\d/.test(password),
    },
    {
        label: "One special character",
        test: (password: string) => /[^A-Za-z0-9]/.test(password),
    },
];

export default function RegisterPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [otp, setOtp] = useState(["", "", "", "", ""]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [verified, setVerified] = useState(false);
    /**
     * The session verify-otp hands back. Its presence IS "the funnel may run":
     * every step of the build is behind `protect`, so without it there would be
     * nothing to do but stash answers and replay them after a sign-in.
     */
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [building, setBuilding] = useState(false);

    const passwordStrength = passwordRules.filter((rule) =>
        rule.test(formData.password)
    ).length;

    const strengthPercentage =
        (passwordStrength / passwordRules.length) * 100;

    const strengthLabel =
        passwordStrength <= 1
            ? "Weak"
            : passwordStrength <= 3
              ? "Medium"
              : passwordStrength === 4
                ? "Strong"
                : "Very Strong";

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });

        setError(null);
    };

    const handleSubmit = async (
        e: React.FormEvent
    ) => {
        e.preventDefault();
        setError(null);

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (passwordStrength < 5) {
            setError("Please create a stronger password");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${env.NEXT_PUBLIC_API_URL}/auth/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(formData),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(
                    Array.isArray(data.errors)
                        ? data.errors.join(", ")
                        : data.message || "Registration failed"
                );

                setLoading(false);
                return;
            }

            setShowOtp(true);
            setLoading(false);
        } catch {
            setError(
                "Cannot connect to server. Make sure your backend is running."
            );

            setLoading(false);
        }
    };

    const handleOtpChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        index: number
    ) => {
        const value = e.target.value.replace(/\D/g, "");

        const updatedOtp = [...otp];

        if (!value) {
            updatedOtp[index] = "";
            setOtp(updatedOtp);
            return;
        }

        updatedOtp[index] = value.charAt(0);
        setOtp(updatedOtp);

        if (index < otp.length - 1) {
            document
                .getElementById(`otp-${index + 1}`)
                ?.focus();
        }
    };

    const handleOtpKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        index: number
    ) => {
        if (
            e.key === "Backspace" &&
            !otp[index] &&
            index > 0
        ) {
            document
                .getElementById(`otp-${index - 1}`)
                ?.focus();
        }
    };

    const handleOtpPaste = (
        e: React.ClipboardEvent<HTMLInputElement>
    ) => {
        e.preventDefault();

        const pastedValue = e.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 5);

        if (!pastedValue) return;

        const updatedOtp = ["", "", "", "", ""];

        pastedValue
            .split("")
            .forEach((digit, index) => {
                updatedOtp[index] = digit;
            });

        setOtp(updatedOtp);

        const nextIndex = Math.min(
            pastedValue.length,
            4
        );

        document
            .getElementById(`otp-${nextIndex}`)
            ?.focus();
    };

    const handleVerifyOtp = async () => {
        const otpValue = otp.join("");

        setError(null);

        if (otpValue.length !== 5) {
            setError("Please enter the complete 5-digit OTP");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${env.NEXT_PUBLIC_API_URL}/auth/verify-otp`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: formData.email,
                        otp: otpValue,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(
                    Array.isArray(data.errors)
                        ? data.errors.join(", ")
                        : data.message || "Invalid OTP"
                );

                setLoading(false);
                return;
            }

            setVerified(true);
            setLoading(false);

            /**
             * Verifying the inbox IS the proof a password sign-in gives, so the
             * server issues a session here and the funnel runs signed in —
             * which is what lets it create the workspace, invite people and
             * record the answers immediately instead of parking them.
             */
            if (data.token) {
                saveToken(data.token);
                saveUser(data.user);
                setTimeout(() => setSessionToken(data.token), 900);
            } else {
                // Older server without the token: fall back to the sign-in form
                // rather than showing a funnel that cannot save anything.
                setTimeout(() => router.push("/login"), 900);
            }
        } catch {
            setError(
                "Cannot connect to server. Make sure your backend is running."
            );

            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError(null);
        setResending(true);

        try {
            const response = await fetch(
                `${env.NEXT_PUBLIC_API_URL}/auth/resend-otp`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: formData.email,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(
                    data.message || "Unable to resend OTP"
                );

                setResending(false);
                return;
            }

            setOtp(["", "", "", "", ""]);

            document
                .getElementById("otp-0")
                ?.focus();

            setResending(false);
        } catch {
            setError(
                "Cannot connect to server. Make sure your backend is running."
            );

            setResending(false);
        }
    };

    const handleFinishSetup = async (answers: OnboardingAnswers) => {
        if (!sessionToken) return;

        setBuilding(true);

        // Reporting, not blocking — never awaited into the build.
        void saveOnboardingProfile(sessionToken, answers);

        const built = await buildAccount(sessionToken, answers);

        // A failed build must not strand someone already signed in: /Home works,
        // it is just empty, and a workspace can be made by hand from there.
        router.push(built ? `/workspace/${built.workspaceId}` : "/Home");
    };

    const handleSkipSetup = () => {
        router.push("/Home");
    };

    const handleOAuth = (provider: "apple") => {
        window.location.href = `${env.NEXT_PUBLIC_API_URL}/auth/${provider}`;
    };

    /**
     * Setup replaces BOTH panels.
     *
     * The marketing rail on the left is there to fill time while someone types
     * their details; once they are through it is just a slide carousel taking
     * half the screen from the thing that now needs it — the board preview.
     */
    if (sessionToken) {
        return (
            <section className="h-screen w-full bg-canvas p-3">
                <div className="h-full w-full overflow-hidden rounded-2xl bg-card">
                    <OnboardingSetup
                        firstName={formData.firstName}
                        submitting={building}
                        onFinish={handleFinishSetup}
                        onSkip={handleSkipSetup}
                    />
                </div>
            </section>
        );
    }

    return (
        <section className="w-full h-full bg-canvas p-3">
            <div className="flex gap-3 w-full h-full">

                <AuthShowcase />

                <div className="w-full lg:w-[55%] flex flex-col px-6 sm:px-16 py-8 rounded-xl bg-card flex-1">

                    <div className="flex items-center justify-between">

                        <Link
                            href="/"
                            className="cursor-pointer"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-card shadow-sm border border-zinc-300">
                                <Image
                                    src={logo}
                                    alt="Logo"
                                    priority
                                />
                            </div>
                        </Link>

                        <p className="text-sm text-slate-600">
                            Already have an account?{" "}

                            <Link
                                href="/login"
                                className="font-semibold text-accent underline cursor-pointer"
                            >
                                Login
                            </Link>
                        </p>
                    </div>

                    <div className="flex-1 flex items-center justify-center font-google-sans">
                        <div className="w-full max-w-sm">

                            {!showOtp ? (
                                <>
                                    <div className="mb-8 text-center">
                                        <h1 className="text-2xl font-bold text-slate-900 flex gap-1 items-center justify-center">
                                            Create your Conexus

                                            <span className="brand-gradient-warm-text font-extrabold text-3xl font-jost">
                                                X
                                            </span>
                                        </h1>

                                        <p className="mt-2 text-sm text-slate-500">
                                            Please enter your details to create
                                            your account
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent text-center">
                                            <AlertCircle className="h-4 w-4 shrink-0" />

                                            {error}
                                        </div>
                                    )}

                                    <div className="space-y-3">

                                        <GoogleButton
                                            mode="register"
                                            label="Sign up with Google"
                                            disabled={loading}
                                            onError={setError}
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleOAuth(
                                                    "apple"
                                                )
                                            }
                                            disabled={loading}
                                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-400 bg-card py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                                fill="black"
                                            >
                                                <path d="M16.365 1.43c0 1.14-.417 2.06-1.25 2.87-.833.79-1.833 1.25-2.998 1.16-.146-1.11.375-2.27 1.19-3.06.813-.79 2.146-1.36 3.058-1.29zm3.395 15.65c-.5 1.15-1.083 2.28-1.916 3.36-.917 1.17-1.833 2.34-3.25 2.36-1.375.03-1.833-.79-3.417-.79-1.583 0-2.083.77-3.416.82-1.375.05-2.416-1.24-3.333-2.4-1.833-2.36-3.25-6.68-1.333-9.6 0.917-1.44 2.583-2.36 4.416-2.39 1.334-.02 2.584.87 3.417.87.833 0 2.333-1.07 3.917-.91 0.666.03 2.55.26 3.75 1.99-.1.07-2.25 1.28-2.22 3.86.03 3.1 2.75 4.13 2.78 4.15z" />
                                            </svg>

                                            Continue with Apple
                                        </button>
                                    </div>

                                    <div className="my-6 flex items-center gap-4">
                                        <div className="h-px flex-1 bg-zinc-400" />

                                        <span className="text-xs text-slate-600">
                                            Or sign up with
                                        </span>

                                        <div className="h-px flex-1 bg-zinc-400" />
                                    </div>

                                    <form
                                        onSubmit={
                                            handleSubmit
                                        }
                                        className="space-y-4"
                                    >

                                        <div className="grid grid-cols-2 gap-4">

                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                                                    First Name
                                                </label>

                                                <input
                                                    name="firstName"
                                                    placeholder="John"
                                                    value={
                                                        formData.firstName
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                    required
                                                    disabled={
                                                        loading
                                                    }
                                                    className="w-full rounded-lg border border-zinc-400 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 outline-none focus:border-black disabled:opacity-60"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                                                    Last Name
                                                </label>

                                                <input
                                                    name="lastName"
                                                    placeholder="Doe"
                                                    value={
                                                        formData.lastName
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                    required
                                                    disabled={
                                                        loading
                                                    }
                                                    className="w-full rounded-lg border border-zinc-400 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 outline-none focus:border-black disabled:opacity-60"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                                                Email
                                            </label>

                                            <input
                                                name="email"
                                                type="email"
                                                placeholder="you@example.com"
                                                value={
                                                    formData.email
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                                required
                                                disabled={
                                                    loading
                                                }
                                                className="w-full rounded-lg border border-zinc-400 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 outline-none focus:border-black disabled:opacity-60"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                                                Password
                                            </label>

                                            <div className="relative">
                                                <input
                                                    name="password"
                                                    type={
                                                        showPassword
                                                            ? "text"
                                                            : "password"
                                                    }
                                                    placeholder="Enter password"
                                                    value={
                                                        formData.password
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                    required
                                                    minLength={
                                                        8
                                                    }
                                                    disabled={
                                                        loading
                                                    }
                                                    className="w-full rounded-lg border border-zinc-400 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-zinc-400 outline-none focus:border-black disabled:opacity-60"
                                                />

                                                <button
                                                    type="button"
                                                    disabled={
                                                        loading
                                                    }
                                                    onClick={() =>
                                                        setShowPassword(
                                                            !showPassword
                                                        )
                                                    }
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-600 hover:text-foreground"
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>

                                            {formData.password && (
                                                <div className="mt-2">

                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-slate-500">
                                                            Password strength
                                                        </span>

                                                        <span className="text-xs font-semibold text-slate-700">
                                                            {
                                                                strengthLabel
                                                            }
                                                        </span>
                                                    </div>

                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                        <div
                                                            className="h-full rounded-full bg-accent transition-all duration-300"
                                                            style={{
                                                                width: `${strengthPercentage}%`,
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="mt-2 grid grid-cols-2 gap-1">
                                                        {passwordRules.map(
                                                            (
                                                                rule
                                                            ) => {
                                                                const passed =
                                                                    rule.test(
                                                                        formData.password
                                                                    );

                                                                return (
                                                                    <div
                                                                        key={
                                                                            rule.label
                                                                        }
                                                                        className={`flex items-center gap-1 text-[11px] ${
                                                                            passed
                                                                                ? "text-green-600"
                                                                                : "text-slate-400"
                                                                        }`}
                                                                    >
                                                                        <CheckCircle2 className="h-3 w-3" />

                                                                        {
                                                                            rule.label
                                                                        }
                                                                    </div>
                                                                );
                                                            }
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                                                Confirm Password
                                            </label>

                                            <div className="relative">
                                                <input
                                                    name="confirmPassword"
                                                    type={
                                                        showConfirmPassword
                                                            ? "text"
                                                            : "password"
                                                    }
                                                    placeholder="Confirm password"
                                                    value={
                                                        formData.confirmPassword
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                    required
                                                    minLength={
                                                        8
                                                    }
                                                    disabled={
                                                        loading
                                                    }
                                                    className="w-full rounded-lg border border-zinc-400 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-zinc-400 outline-none focus:border-black disabled:opacity-60"
                                                />

                                                <button
                                                    type="button"
                                                    disabled={
                                                        loading
                                                    }
                                                    onClick={() =>
                                                        setShowConfirmPassword(
                                                            !showConfirmPassword
                                                        )
                                                    }
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-600 hover:text-foreground"
                                                >
                                                    {showConfirmPassword ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={
                                                loading
                                            }
                                            className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:bg-slate-400 disabled:cursor-not-allowed cursor-pointer font-google-sans"
                                        >
                                            {loading ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <>
                                                    Create Account

                                                    <ArrowRight className="h-4 w-4" />
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="text-center">

                                    {!verified ? (
                                        <>
                                            <div className="mb-8">
                                                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                                                    <CheckCircle2 className="h-7 w-7 text-accent" />
                                                </div>

                                                <h1 className="text-2xl font-bold text-slate-900">
                                                    Verify your email
                                                </h1>

                                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                                    We sent a 5-digit
                                                    verification code to
                                                </p>

                                                <p className="mt-1 text-sm font-semibold text-slate-800">
                                                    {
                                                        formData.email
                                                    }
                                                </p>
                                            </div>

                                            {error && (
                                                <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                                                    <AlertCircle className="h-4 w-4 shrink-0" />

                                                    {error}
                                                </div>
                                            )}

                                            <div className="flex justify-center gap-2">
                                                {otp.map(
                                                    (
                                                        digit,
                                                        index
                                                    ) => (
                                                        <input
                                                            key={
                                                                index
                                                            }
                                                            id={`otp-${index}`}
                                                            value={
                                                                digit
                                                            }
                                                            onChange={(
                                                                e
                                                            ) =>
                                                                handleOtpChange(
                                                                    e,
                                                                    index
                                                                )
                                                            }
                                                            onKeyDown={(
                                                                e
                                                            ) =>
                                                                handleOtpKeyDown(
                                                                    e,
                                                                    index
                                                                )
                                                            }
                                                            onPaste={
                                                                index ===
                                                                0
                                                                    ? handleOtpPaste
                                                                    : undefined
                                                            }
                                                            maxLength={
                                                                1
                                                            }
                                                            inputMode="numeric"
                                                            autoComplete="one-time-code"
                                                            className="h-14 w-12 rounded-lg border border-zinc-400 bg-card text-center text-xl font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                                                        />
                                                    )
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={
                                                    handleVerifyOtp
                                                }
                                                disabled={
                                                    loading ||
                                                    otp.join(
                                                        ""
                                                    ).length !==
                                                        5
                                                }
                                                className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-slate-300"
                                            >
                                                {loading ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        Verify Email

                                                        <ArrowRight className="h-4 w-4" />
                                                    </>
                                                )}
                                            </button>

                                            <div className="mt-5">
                                                <span className="text-sm text-slate-500">
                                                    Didn't receive
                                                    the code?{" "}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleResendOtp
                                                    }
                                                    disabled={
                                                        resending
                                                    }
                                                    className="cursor-pointer text-sm font-semibold text-accent hover:underline disabled:opacity-50"
                                                >
                                                    {resending
                                                        ? "Sending..."
                                                        : "Resend OTP"}
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowOtp(
                                                        false
                                                    );
                                                    setError(
                                                        null
                                                    );
                                                    setOtp([
                                                        "",
                                                        "",
                                                        "",
                                                        "",
                                                        "",
                                                    ]);
                                                }}
                                                className="mt-4 cursor-pointer text-sm text-slate-500 hover:text-foreground"
                                            >
                                                Change email
                                            </button>
                                        </>
                                    ) : (
                                        <div className="py-10">

                                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                                            </div>

                                            <h1 className="text-2xl font-bold text-slate-900">
                                                Email verified!
                                            </h1>

                                            <p className="mt-2 text-sm text-slate-500">
                                                Your account has been
                                                created successfully.
                                            </p>

                                            <p className="mt-4 text-sm text-slate-400">
                                                Setting up your workspace...
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                            © 2026 Conexus X
                        </span>

                        <div className="flex gap-4">
                            <Link
                                href="/privacy"
                                className="cursor-pointer hover:text-accent"
                            >
                                Privacy Policy
                            </Link>

                            <Link
                                href="/support"
                                className="cursor-pointer hover:text-accent"
                            >
                                Support
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}