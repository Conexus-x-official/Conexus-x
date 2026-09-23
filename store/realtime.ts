// store/realtime.ts

import type { TagDescription } from "@reduxjs/toolkit/query";
import { ACTIVITY_TAG, baseApi } from "./baseApi";
import { recordsApi } from "./api/records.api";
import { recordValuesApi } from "./api/recordValues.api";
import { meetApi, type Conversation, type Message } from "./api/meet.api";
import type { AppDispatch } from "./index";
import type { RecordItem, RecordValue } from "./types";

/**
 * Server push -> cache. The one place a `crm:change` event becomes a visible
 * change on this screen.
 *
 * TWO WAYS TO APPLY ONE EVENT, and the choice is per entity, not per taste:
 *
 *   PATCH  when the payload IS the new truth and the shape it lands in is one
 *          row of one list — a cell value, a rename. Costs no request, so the
 *          hot path stays as cheap as a local edit.
 *
 *   INVALIDATE when the change is STRUCTURAL — a row appearing, moving between
 *          collections, or disappearing; a column added. These touch ordering,
 *          server-computed counts (subRecordCount, amendmentCount) and derived
 *          values (mirrors), and a hand-written patch would have to reproduce
 *          the server's arithmetic to stay right. One refetch is cheaper than
 *          a second implementation of the board's rules that can drift.
 *
 * Invalidating a tag nothing is subscribed to is free — RTK refetches only what
 * a mounted component is actually reading. That is what lets this file be
 * generous with tags without making the app chatty.
 */

export type ChangeEntity =
    | "record"
    | "recordValue"
    | "collection"
    | "column"
    | "module"
    | "amendment"
    | "workspace"
    | "member"
    | "moduleAccess"
    | "automation"
    | "activity"
    | "presence"
    | "conversation"
    | "message"
    | "typing"
    | "notification";

export type ChangeAction = "created" | "updated" | "deleted" | "moved";

export interface ChangeEvent {
    entity: ChangeEntity;
    action: ChangeAction;
    id?: string;
    workspaceId?: string;
    moduleId?: string;
    collectionId?: string;
    fromCollectionId?: string;
    recordId?: string;
    parentRecordId?: string;
    columnId?: string;
    scope?: string;
    conversationId?: string;
    data?: unknown;
    actorId?: string;
    at: string;
}

type Tags = TagDescription<
    | "Workspace" | "Member" | "Module" | "Collection" | "Column" | "Record"
    | "RecordValue" | "Amendment" | "Activity" | "Automation" | "ModuleAccess"
    | "Conversation" | "Message" | "Notification"
>[];

/**
 * Mirrors are resolved server-side from other people's cells, so ANY cell write
 * anywhere can change one. This is the bare LIST tag that only
 * getModuleReferences provides — the same tag updateRecordValue invalidates,
 * and for the same reason. See store/api/recordValues.api.ts.
 */
const MIRROR_TAG = { type: "RecordValue" as const, id: "LIST" };

/** Which record list a row belongs to — a sub-record is never in the board's. */
const recordListPatch = (
    event: ChangeEvent,
    apply: (draft: RecordItem[]) => void
) =>
    event.parentRecordId
        ? recordsApi.util.updateQueryData(
            "getSubRecords",
            event.parentRecordId,
            apply
        )
        : event.collectionId
            ? recordsApi.util.updateQueryData(
                "getRecords",
                event.collectionId,
                apply
            )
            : null;

/** Both list tags for a row, so a create/delete refreshes the right one. */
const recordListTags = (event: ChangeEvent): Tags => {
    const tags: Tags = [];

    if (event.parentRecordId) {
        tags.push({ type: "Record", id: `SUB-${event.parentRecordId}` });
    }
    if (event.collectionId) {
        tags.push({ type: "Record", id: `LIST-${event.collectionId}` });
    }
    if (event.fromCollectionId) {
        tags.push({ type: "Record", id: `LIST-${event.fromCollectionId}` });
    }

    return tags;
};

export function applyChange(event: ChangeEvent, dispatch: AppDispatch): void {
    const tags: Tags = [];

    switch (event.entity) {

        /* ------------------------------------------------ cells (hot path) */
        case "recordValue": {
            const value = event.data as RecordValue | undefined;

            if (event.recordId && value) {
                dispatch(
                    recordValuesApi.util.updateQueryData(
                        "getRecordValues",
                        event.recordId,
                        (draft) => {
                            const at = draft.findIndex((v) => v._id === value._id);

                            if (event.action === "deleted") {
                                if (at !== -1) draft.splice(at, 1);
                                return;
                            }

                            // Create and update are the same operation here: a
                            // cell row either exists or it does not, and the
                            // server's idempotent write means a "create" can
                            // legitimately arrive for a cell already on screen.
                            if (at === -1) {
                                draft.push(value);
                                return;
                            }

                            /**
                             * `column` COMES BACK POPULATED on GET
                             * /record-values/:recordId but is a bare id in the
                             * document this event carries, so a blind spread
                             * would quietly downgrade an object already in the
                             * cache to a string. Readers tolerate both
                             * (`v.column?._id || v.column`), which is exactly
                             * why the damage would go unnoticed until something
                             * reached for column.type. Keep the richer one.
                             */
                            const existing = draft[at];
                            const merged = { ...existing, ...value };

                            if (
                                typeof value.column === "string" &&
                                existing.column &&
                                typeof existing.column !== "string"
                            ) {
                                merged.column = existing.column;
                            }

                            draft[at] = merged;
                        }
                    )
                );
            } else if (event.recordId) {
                // A delete carries no payload; drop the row by its own id.
                dispatch(
                    recordValuesApi.util.updateQueryData(
                        "getRecordValues",
                        event.recordId,
                        (draft) => {
                            const at = draft.findIndex((v) => v._id === event.id);
                            if (at !== -1) draft.splice(at, 1);
                        }
                    )
                );
            }

            tags.push(MIRROR_TAG);
            break;
        }

        /* ----------------------------------------------------------- rows */
        case "record": {
            if (event.action === "updated") {
                // A rename, a reorder, a completion tick: one row, payload is
                // the truth, and this is what a drag emits on every drop.
                const row = event.data as RecordItem | undefined;

                const patch = row
                    ? recordListPatch(event, (draft) => {
                        const target = draft.find((r) => r._id === row._id);
                        if (target) Object.assign(target, row);
                    })
                    : null;

                if (patch) dispatch(patch);

                // A completion tick changes the module's done/total fraction.
                tags.push({ type: "Module", id: "LIST" });
                break;
            }

            // created / moved / deleted are structural.
            tags.push(...recordListTags(event));
            tags.push({ type: "Module", id: "LIST" }, MIRROR_TAG);
            break;
        }

        /* --------------------------------------------------- board layout */
        case "collection": {
            if (event.moduleId) {
                tags.push({ type: "Collection", id: `LIST-${event.moduleId}` });
            }
            if (event.action === "deleted" && event.collectionId) {
                tags.push({ type: "Record", id: `LIST-${event.collectionId}` });
            }
            break;
        }

        case "column": {
            if (event.moduleId) {
                // scope decides WHICH grid's column list moved — the board and
                // the sub-record grid are two separate cache entries.
                tags.push({
                    type: "Column",
                    id: event.scope === "subrecord"
                        ? `LIST-SUB-${event.moduleId}`
                        : `LIST-${event.moduleId}`
                });
            }
            // A deleted column takes its cells with it, and a new relation
            // column adds mirrors that were not resolved before.
            tags.push(MIRROR_TAG);
            break;
        }

        /* ----------------------------------------------------- amendments */
        case "amendment": {
            if (event.recordId) {
                tags.push({ type: "Amendment", id: event.recordId });
            }

            // The bubble on the row shows a count that rides along on the
            // record list. Patched rather than refetched for the same reason
            // the mutation patches it: one digit is not worth a collection.
            const delta =
                event.action === "created" ? 1 :
                    event.action === "deleted" ? -1 : 0;

            if (delta !== 0 && event.recordId) {
                const patch = recordListPatch(event, (draft) => {
                    const row = draft.find((r) => r._id === event.recordId);
                    if (row) {
                        row.amendmentCount = Math.max(
                            0,
                            (row.amendmentCount ?? 0) + delta
                        );
                    }
                });

                if (patch) dispatch(patch);
            }
            break;
        }

        /* ------------------------------------------------ workspace scope */
        case "module": {
            tags.push({ type: "Module", id: "LIST" });
            if (event.workspaceId) {
                tags.push({ type: "Module", id: `LIST-${event.workspaceId}` });
            }
            break;
        }

        case "workspace": {
            tags.push({ type: "Workspace", id: "LIST" });
            break;
        }

        case "member": {
            tags.push({ type: "Member", id: "LIST" });
            if (event.workspaceId) {
                tags.push({ type: "Member", id: `LIST-${event.workspaceId}` });
            }
            break;
        }

        case "moduleAccess": {
            tags.push({ type: "ModuleAccess", id: "LIST" });
            // Being granted a board changes the grantee's own module list.
            tags.push({ type: "Module", id: "LIST" });
            if (event.workspaceId) {
                tags.push({ type: "Module", id: `LIST-${event.workspaceId}` });
            }
            break;
        }

        case "automation": {
            if (event.moduleId) {
                tags.push({ type: "Automation", id: `LIST-${event.moduleId}` });
            }
            if (event.workspaceId) {
                tags.push({ type: "Automation", id: `WS-${event.workspaceId}` });
            }
            break;
        }

        case "activity": {
            tags.push(ACTIVITY_TAG);
            break;
        }

        /**
         * Presence rides the Member list because that is already where another
         * person's dot is read from (MemberUser.presence, derived server-side).
         * Inventing a second read path for it is exactly the drift the
         * one-store rule exists to prevent.
         */
        case "presence": {
            tags.push({ type: "Member", id: "LIST" });
            if (event.workspaceId) {
                tags.push({ type: "Member", id: `LIST-${event.workspaceId}` });
            }
            // Meet draws the same dots, from its own conversation payloads.
            tags.push({ type: "Conversation", id: "LIST" });
            break;
        }

        /* ------------------------------------------------ Conexus Meet */

        /**
         * A message is PATCHED, never refetched. It is the highest-frequency
         * event in the product after a cell edit, the payload is the whole
         * truth (sender populated, id and timestamp final), and refetching a
         * transcript to append one bubble would re-download the conversation
         * every time somebody typed.
         */
        case "message": {
            const message = event.data as Message | undefined;
            const conversationId = event.conversationId;

            if (!conversationId) break;

            if (message) {
                dispatch(
                    meetApi.util.updateQueryData(
                        "getMessages",
                        { conversationId },
                        (draft) => {
                            const at = draft.messages.findIndex(
                                (m) => m._id === message._id
                            );

                            if (at !== -1) {
                                // An edit or a delete tombstone.
                                draft.messages[at] = message;
                                return;
                            }

                            if (event.action !== "created") return;

                            /**
                             * The SENDER receives this event too — it is the
                             * one emit that deliberately keeps no originId,
                             * because this is what turns their optimistic
                             * bubble into the stored row. Drop the pending
                             * placeholder rather than showing both.
                             */
                            const pendingAt = draft.messages.findIndex(
                                (m) =>
                                    m.pending &&
                                    m.text === message.text &&
                                    String(m.sender?._id) ===
                                    String(message.sender?._id)
                            );

                            if (pendingAt !== -1) {
                                draft.messages[pendingAt] = message;
                                return;
                            }

                            draft.messages.push(message);
                        }
                    )
                );
            }
            break;
        }

        /**
         * The conversation LIST row: preview text, ordering and unread.
         *
         * Patched from a PARTIAL payload — the send path emits only
         * {_id, lastMessage} because that is all that changed, so this merges
         * rather than replacing. A create carries the whole row instead, and
         * has nothing to merge into, so it invalidates and lets the list refill.
         */
        case "conversation": {
            const data = event.data as Partial<Conversation> | undefined;

            // ONE cache entry now: the list spans every workspace, so the
            // patch no longer needs to know which one the thread belongs to.
            if (event.action === "updated" && data?._id) {
                dispatch(
                    meetApi.util.updateQueryData(
                        "getConversations",
                        undefined,
                        (draft) => {
                            const at = draft.findIndex((c) => c._id === data._id);
                            if (at === -1) return;

                            Object.assign(draft[at], data);

                            /**
                             * A new message in a thread you are NOT reading is
                             * unread by definition. The server does not count
                             * it per recipient on send — that would be a write
                             * per member per message — so the row is nudged
                             * here and reconciled by the next list fetch.
                             */
                            if (data.lastMessage && !("unread" in data)) {
                                draft[at].unread = (draft[at].unread ?? 0) + 1;
                            }

                            // Newest thread first, same order the server sends.
                            draft.sort((a, b) => {
                                const at1 = a.lastMessage?.at ?? a.updatedAt;
                                const bt = b.lastMessage?.at ?? b.updatedAt;
                                return new Date(bt).getTime() - new Date(at1).getTime();
                            });
                        }
                    )
                );
                break;
            }

            tags.push({ type: "Conversation", id: "LIST" });
            break;
        }

        /**
         * Always delivered by `audience`, never a room (see the backend's
         * SCOPE comment) — one person's own notification center. Invalidate
         * rather than patch: the list is small and read rarely enough that a
         * refetch is not worth a hand-written insert-and-resort.
         */
        case "notification": {
            tags.push({ type: "Notification", id: "LIST" });
            break;
        }

        /**
         * TYPING IS NEVER CACHED. It is worthless a second after it arrives, so
         * putting it in the store would mean writing and expiring redux state
         * on every keystroke of every participant. It is re-broadcast as a
         * window event instead and read by whichever thread is on screen.
         */
        case "typing": {
            if (typeof window !== "undefined" && event.conversationId) {
                window.dispatchEvent(
                    new CustomEvent("crm:typing", {
                        detail: {
                            conversationId: event.conversationId,
                            userId: event.id,
                            typing:
                                (event.data as { typing?: boolean })?.typing !== false
                        }
                    })
                );
            }
            break;
        }
    }

    if (tags.length) dispatch(baseApi.util.invalidateTags(tags));
}

/**
 * Called on every (re)connect. A socket that was offline missed whatever
 * happened while it was gone and no replay exists, so the honest recovery is to
 * treat everything on screen as stale once — RTK then refetches only what is
 * actually mounted, which is a handful of requests, not the whole store.
 *
 * This is the self-healing half of the design: patches make it feel instant,
 * and this makes a missed patch survivable.
 */
export function resyncAfterReconnect(dispatch: AppDispatch): void {
    dispatch(
        baseApi.util.invalidateTags([
            "Workspace", "Member", "Module", "Collection", "Column",
            "Record", "RecordValue", "Amendment", "Activity",
            "Automation", "ModuleAccess", "Conversation", "Message",
            "Notification"
        ])
    );
}
