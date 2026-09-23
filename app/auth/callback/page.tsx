"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, Loader2 } from "lucide-react";
import logo from "@/app/assets/Logo.png";
import env from "@/config/env";
import { saveToken, saveUser } from "@/lib/auth";
import OnboardingSetup from "@/components/onboarding/OnboardingSetup";
import type { OnboardingAnswers } from "@/lib/onboarding";
import {
    buildAccount,
    hasAnyWorkspace,
    saveOnboardingProfile,
} from "@/lib/applyOnboarding";

const ERROR_MESSAGES: Record<string, string> = {
    access_denied: "You cancelled Google sign-in.",
    not_configured: "Google sign-in isn't configured on the server yet.",
    invalid_state: "That sign-in link expired. Please try again.",
    missing_code: "Google didn't return a sign-in code. Please try again.",
    no_email: "Your Google account didn't share an email address.",
    exchange_failed: "We couldn't verify your Google account. Please try again."
};

export default function GoogleCallbackPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    /**
     * Google is the one path that cannot ask anything BEFORE the account
     * exists — the button leaves the page for Google's servers and comes back
     * with a session already issued, so the register screen is long gone. This
     * is therefore where a first-time Google user gets the same setup step the
     * email signup gets, and it is the better half of the deal: there is a
     * token here, so Finish creates the workspace outright with nothing to
     * stash and replay.
     */
    const [setupFor, setSetupFor] = useState<{
        token: string;
        firstName: string;
    } | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const finishSignIn = async () => {
            const params = new URLSearchParams(window.location.hash.slice(1));
            const token = params.get("token");
            const failure = params.get("error");

            // Strip the token from the address bar before anything else can read it
            window.history.replaceState(null, "", window.location.pathname);

            if (failure || !token) {
                setError(
                    ERROR_MESSAGES[failure ?? ""] ??
                    "We couldn't complete Google sign-in. Please try again."
                );
                return;
            }

            try {
                const baseUrl = (env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

                const response = await fetch(`${baseUrl}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error("Profile lookup failed");
                }

                const data = await response.json();

                saveToken(token);
                saveUser(data.user);

                if (await hasAnyWorkspace(token)) {
                    router.replace("/Home");
                    return;
                }

                setSetupFor({ token, firstName: data.user?.firstName ?? "" });
            } catch {
                setError("We signed you in, but couldn't load your profile. Please try again.");
            }
        };

        void finishSignIn();
    }, [router]);

    const finishSetup = async (answers: OnboardingAnswers) => {
        if (!setupFor) return;

        setCreating(true);

        // Reporting, not blocking — never awaited into the build.
        void saveOnboardingProfile(setupFor.token, answers);

        const built = await buildAccount(setupFor.token, answers);

        // A failed create must not strand someone who is already signed in —
        // /Home works, it is just empty, and they can make a workspace by hand.
        router.replace(built ? `/workspace/${built.workspaceId}` : "/Home");
    };

    if (setupFor) {
        return (
            <section className="h-screen w-full bg-canvas p-3">
                <div className="h-full w-full overflow-hidden rounded-2xl bg-card">
                    <OnboardingSetup
                        firstName={setupFor.firstName}
                        submitting={creating}
                        onFinish={finishSetup}
                        onSkip={() => router.replace("/Home")}
                    />
                </div>
            </section>
        );
    }

    return (
        <section className="flex h-full w-full items-center justify-center bg-canvas p-3 font-google-sans">
            <div className="w-full max-w-sm rounded-2xl bg-card px-8 py-10 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-300 bg-card shadow-sm">
                    <Image src={logo} alt="Logo" priority />
                </div>

                {error ? (
                    <>
                        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>

                        <Link
                            href="/login"
                            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-semibold transition hover:bg-accent-hover"
                        >
                            Back to sign in
                        </Link>
                    </>
                ) : (
                    <>
                        <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-accent" />
                        <h1 className="mt-4 text-lg font-semibold text-slate-900">
                            Signing you in
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Finishing up with Google…
                        </p>
                    </>
                )}
            </div>
        </section>
    );
}
