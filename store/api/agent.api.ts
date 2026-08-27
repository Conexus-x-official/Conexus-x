import { ACTIVITY_TAG, AI_CREDITS_TAG, baseApi } from "../baseApi";

/** Anything the panel can render as its own badge. */
export interface EntityRef {
    kind: "workspace" | "module" | "collection" | "column" | "record" | "value" | "amendment";
    id: string;
    name: string;
    /** The entity's own colour, when it has one. */
    color?: string;
}

/** One thing Aquiline actually wrote, used to refresh the right caches. */
export interface AppliedAction extends EntityRef {
    tool: string;
    workspaceId?: string;
    moduleId?: string;
}

/** Something waiting on the user to authorise it. */
/** A whole structure Aquiline proposes to build, shown before it is authorised. */
export interface BlueprintPlan {
    workspace?: string;
    workspaceId?: string;
    /** Name of the existing workspace being built into. */
    existingWorkspaceName?: string;
    modules: {
        name: string;
        collections?: string[];
        columns?: { name: string; type: string; labels?: string[] }[];
        records?: { collection: string; names: string[] }[];
    }[];
    totals: {
        workspaces: number;
        modules: number;
        collections: number;
        columns: number;
        records: number;
    };
}

export interface PendingAction {
    tool: string;
    /** One line describing what will happen. */
    intent: string;
    kind: string;
    name: string;
    /** Every target of a batch — chipped in the authorise prompt. */
    targets?: string[];
    /** Set for a blueprint: the tree drawn above the authorise button. */
    plan?: BlueprintPlan;
    input: Record<string, unknown>;
}

/**
 * What the account has left, as the server decided it.
 *
 * Rendered verbatim — the client never re-derives an allowance or a remaining
 * balance from a plan name. The plan rules live in one place on the server
 * (services/aiCredits.service.ts) and a second copy here would be a second
 * answer to "can I send this", which is the kind that goes wrong quietly.
 */
export interface CreditBalance {
    plan: "free" | "paid" | "enterprise";
    planLabel: string;
    allowance: number;
    used: number;
    remaining: number;
    /** ISO — the balance returns to `allowance` then. */
    resetAt: string;
    remainingUsd: number;
    exhausted: boolean;
}

export interface AgentReply {
    text: string;
    actions: AppliedAction[];
    pending?: PendingAction;
    /** Everything the turn touched OR read — what the reply's names refer to. */
    mentions?: EntityRef[];
    /** Returned so the panel can show what the turn cost. */
    usage: {
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        steps: number;
    };
    /** The balance AFTER this turn was charged. */
    credits?: CreditBalance;
}

export interface AgentTurn {
    role: "user" | "assistant";
    content: string;
}

export const agentApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        /**
         * One chat turn. A mutation rather than a query: it is never cached and
         * never replayed — each call costs real money.
         *
         * Invalidation is broad on purpose. Aquiline can create a module, a collection
         * and five records in a single turn, and the panel has no way to know
         * which lists that touched; RTK refetches only what is subscribed.
         */
        /**
         * The balance, for the panel's first paint.
         *
         * A query and not folded into /auth/me because the period can roll
         * while a tab sits open, and because every chat turn invalidates it —
         * which is what keeps the number on screen the one the server would
         * enforce, rather than whatever it was when the app loaded.
         */
        getAgentCredits: build.query<CreditBalance, void>({
            query: () => "/agent/credits",
            transformResponse: (response: { credits: CreditBalance }) =>
                response.credits,
            providesTags: [AI_CREDITS_TAG]
        }),

        sendAgentMessage: build.mutation<
            AgentReply,
            { messages: AgentTurn[]; workspaceId?: string; moduleId?: string }
        >({
            query: (body) => ({ url: "/agent/chat", method: "POST", body }),
            // The balance is invalidated on EVERY turn, including one that
            // applied nothing: a question with no actions still costs money,
            // and a balance that only moved when something was created would
            // be wrong in exactly the case people notice.
            invalidatesTags: (result) =>
                result && result.actions.length > 0
                    ? [
                        "Workspace",
                        "Module",
                        "Collection",
                        "Column",
                        "Record",
                        "RecordValue",
                        "Amendment",
                        ACTIVITY_TAG,
                        AI_CREDITS_TAG
                    ]
                    : [AI_CREDITS_TAG]
        }),

        /**
         * Runs an action the user authorised. No model call happens server-side,
         * so this turn is free — and it cannot drift into doing something else.
         */
        confirmAgentAction: build.mutation<
            AgentReply,
            { pending: PendingAction; workspaceId?: string; moduleId?: string }
        >({
            query: (body) => ({ url: "/agent/confirm", method: "POST", body }),
            invalidatesTags: (result) =>
                result && result.actions.length > 0
                    ? [
                        "Workspace",
                        "Module",
                        "Collection",
                        "Column",
                        "Record",
                        "RecordValue",
                        "Amendment",
                        ACTIVITY_TAG
                    ]
                    : []
        })
    })
});

export const {
    useSendAgentMessageMutation,
    useConfirmAgentActionMutation,
    useGetAgentCreditsQuery
} = agentApi;
