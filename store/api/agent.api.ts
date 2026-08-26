import { ACTIVITY_TAG, baseApi } from "../baseApi";

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
        sendAgentMessage: build.mutation<
            AgentReply,
            { messages: AgentTurn[]; workspaceId?: string; moduleId?: string }
        >({
            query: (body) => ({ url: "/agent/chat", method: "POST", body }),
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

export const { useSendAgentMessageMutation, useConfirmAgentActionMutation } =
    agentApi;
