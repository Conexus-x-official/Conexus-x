"use client";

import env from "@/config/env";
import type { OnboardingAnswers } from "./onboarding";

/**
 * Turns the funnel's answers into a real account.
 *
 * Runs with a live token — verify-otp issues one, and Google's callback already
 * has one — so everything happens here and now. There is no stash-and-replay
 * step any more; that only existed while signup ended without a session.
 *
 * Plain `fetch` rather than the RTK Query endpoints: this runs on the register
 * and callback screens, which sit outside the authenticated tree and have no
 * store provider above them. The caches it would write to do not exist yet, and
 * every one of them is fetched fresh on the next page.
 */

const base = (env.NEXT_PUBLIC_API_URL ?? "http://localhost:4040/api").replace(
    /\/$/,
    ""
);

const authHeaders = (token: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
});

export interface BuildResult {
    workspaceId: string;
    boards: number;
    collections: number;
    invited: number;
    /** Emails the server refused — shown so nobody is silently dropped. */
    failedInvites: string[];
}

/**
 * Does this account already have somewhere to work?
 *
 * The test for "first time here", used by the Google landing page — an OAuth
 * callback cannot tell a new account from a returning one, because Google's
 * response is identical either way and the server issues the same token for
 * both. Having no workspace is the honest signal, and it also covers someone
 * who signed up, skipped the funnel, and came back.
 *
 * Answers `true` on any failure: showing a returning user a setup funnel is a
 * far worse outcome than skipping it for a new one, so the uncertain case
 * resolves toward leaving them alone.
 */
export const hasAnyWorkspace = async (token: string): Promise<boolean> => {
    try {
        const response = await fetch(`${base}/workspaces`, {
            headers: authHeaders(token),
        });

        if (!response.ok) return true;

        const data = await response.json();
        const list = data?.workspaces ?? data;

        return Array.isArray(list) ? list.length > 0 : true;
    } catch {
        return true;
    }
};

/**
 * Records the funnel answers against the user.
 *
 * Fired separately from the build and never awaited by it: these answers are
 * for an analytics dashboard, and a reporting write must not be able to stop
 * someone getting into the product.
 */
export const saveOnboardingProfile = async (
    token: string,
    answers: OnboardingAnswers
) => {
    try {
        await fetch(`${base}/auth/onboarding`, {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({
                accountType: answers.accountType,
                teamSize: answers.teamSize,
                referralSource: answers.referralSource,
                organizationName: answers.organizationName,
            }),
        });
    } catch {
        /* reporting only — never block the funnel on it */
    }
};

/**
 * Builds the workspace, its boards, and one collection inside each.
 *
 * THE COLLECTION IS NOT OPTIONAL. A module with no collection renders as an
 * empty frame with nowhere to put a record — the whole grid hangs off a
 * collection — so a board created without one is a dead end the user has to
 * diagnose on their first minute in the product.
 */
export const buildAccount = async (
    token: string,
    answers: OnboardingAnswers
): Promise<BuildResult | null> => {
    const headers = authHeaders(token);

    try {
        const workspaceResponse = await fetch(`${base}/workspaces`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                name: answers.organizationName,
                icon: answers.workspaceIcon,
            }),
        });

        if (!workspaceResponse.ok) return null;

        const workspaceData = await workspaceResponse.json();
        const workspaceId: string | undefined =
            workspaceData?.workspace?._id ?? workspaceData?._id;

        if (!workspaceId) return null;

        let boards = 0;
        let collections = 0;

        /**
         * Sequential, not Promise.all — twice over.
         *
         * Modules and collections both carry a `position` the server derives
         * from how many already exist, so firing them together races that count
         * and scrambles the order the user chose.
         */
        for (const board of answers.boards) {
            const moduleResponse = await fetch(`${base}/modules/${workspaceId}`, {
                method: "POST",
                headers,
                body: JSON.stringify({ name: board.name }),
            });

            if (!moduleResponse.ok) continue;

            boards += 1;

            const moduleData = await moduleResponse.json();
            const moduleId: string | undefined =
                moduleData?.module?._id ?? moduleData?._id;

            if (!moduleId) continue;

            const collectionResponse = await fetch(
                `${base}/collections/${moduleId}`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ name: board.collection, position: 0 }),
                }
            );

            if (collectionResponse.ok) collections += 1;
        }

        /**
         * Invites last, and each one reported rather than thrown.
         *
         * The server only adds people who ALREADY have an account, so a typo or
         * a colleague who has not signed up yet comes back 404. That must not
         * take the rest of the setup down, and it must not vanish either — the
         * caller shows exactly which addresses did not land.
         */
        let invited = 0;
        const failedInvites: string[] = [];

        for (const email of answers.invites) {
            try {
                const response = await fetch(
                    `${base}/workspace-members/${workspaceId}`,
                    {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ email, role: "member" }),
                    }
                );

                if (response.ok) invited += 1;
                else failedInvites.push(email);
            } catch {
                failedInvites.push(email);
            }
        }

        return { workspaceId, boards, collections, invited, failedInvites };
    } catch {
        return null;
    }
};
