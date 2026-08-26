// Shared server-entity shapes. One definition per resource, imported by the
// endpoint files and the components that render them.

import type { UserStatus } from "@/lib/presence";
import type { MemberRole } from "@/lib/roles";

export interface Workspace {
    /** Catalog key from lib/workspaceIcons.tsx — never a URL or a class name. */
    icon?: string;
    /** Cover art: a key from lib/banners.ts, or an absolute URL. */
    banner?: string;
    _id: string;
    name: string;
    slug?: string;
    description?: string;
    logo?: string;
    createdAt: string;
    updatedAt: string;
    totalModules: number;
}

export interface MemberUser {
    _id: string;
    firstName: string;
    lastName?: string;
    email: string;
    avatar?: string;

    /**
     * The presence to render for this person. Derived server-side from their
     * pick plus a fresh heartbeat, so it reads "offline" once they leave.
     * Deliberately NOT called `status` — Member.status is the membership state.
     */
    presence?: UserStatus;
}

export interface Member {
    _id: string;
    role: MemberRole;
    /** Membership state — NOT presence. See MemberUser.presence for that. */
    status: "active" | "pending" | "inactive";
    joinedAt?: string;
    user: MemberUser;
}

export interface ModuleTag {
    label: string;
    /** Hex from STATUS_SWATCHES — stored as the value, not a palette index, so
     *  re-ordering that palette cannot recolour existing tags. */
    color: string;
}

export interface Module {
    _id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    visibility?: "private" | "workspace" | "public";
    /** Free-form labels the team chose, each with its own colour. */
    tags?: ModuleTag[];
    createdAt?: string;
    updatedAt?: string;
    createdBy?: MemberUser;

    // Derived server-side by one aggregation across the whole workspace —
    // see buildModuleStats in backend/controllers/module.controller.ts.
    totalRecords?: number;
    completedRecords?: number;
    /** Share of records marked complete, 0-100. */
    performance?: number;
    /** One point per day for the last 16 days. */
    graphData?: { day: string; value: number }[];
}

export interface Collection {
    _id: string;
    name: string;
    color?: string;
    position: number;
    isCollapsed?: boolean;
}

export interface StatusOption {
    label: string;
    color: string;
}

export interface Column {
    _id: string;
    name: string;
    label?: string;
    type?: string;
    color?: string;
    width?: number;
    position: number;
    isRequired?: boolean;
    isHidden?: boolean;
    options?: string[];
    statusOptions?: StatusOption[];

    /**
     * Which grid this column belongs to — the board ("record") or the
     * sub-record table ("subrecord"). Absent on every column created before
     * sub-records existed, which the server reads as "record".
     */
    scope?: "record" | "subrecord";

    /**
     * Relation columns only: which module to mirror, which of its columns, and
     * how several picks collapse into one cell. `via`/`field` belong to the
     * retired standalone reference type and are kept so old ones still render.
     */
    settings?: {
        targetModule?: string;
        /**
         * Which of the target module's two column sets `displayField` names.
         * "record" mirrors the linked record's own cell; "subrecord" mirrors
         * the cells of that record's CHILDREN — so one link can contribute
         * many values and the aggregate does real work. Absent means "record".
         */
        targetScope?: "record" | "subrecord";
        displayField?: string;
        aggregate?: string;
        via?: string;
        field?: string;
    };
}

export interface RecordItem {
    _id: string;
    name: string;
    position: number;
    collectionName: string;

    /**
     * Set on a sub-record, null on a board row. A sub-record keeps its parent's
     * module and collection, so `parentRecord` is the only thing separating the
     * two — the board's record list filters on it server-side.
     */
    parentRecord?: string | null;

    /** Live children, counted server-side with the list so the toggle can show it. */
    subRecordCount?: number;

    /** Live amendments, counted with the list for the same reason — see RecordAmendment. */
    amendmentCount?: number;
    module?: string;
    workspace?: string;
    isCompleted?: boolean;
    isArchived?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface RecordValue {
    _id: string;
    record: string;
    column: Column | string;
    value: unknown;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * One amendment on a record — a person's note, not an audit row. The author is
 * populated server-side and comes back null on a tombstone, which is a deleted
 * parent still holding a live reply underneath it.
 *
 * `parentComment` keeps the server's field name: the model backing amendments
 * is still Comment on disk (see backend/controllers/amendment.controller.ts),
 * and renaming it on the wire would buy a mapping layer and nothing else.
 */
export interface RecordAmendment {
    _id: string;
    record: string;
    module?: string;
    workspace?: string;
    user: MemberUser | null;
    message: string;
    /** Set on a reply; null on a top-level update. One level only. */
    parentComment?: string | null;
    edited?: boolean;
    isDeleted?: boolean;
    createdAt: string;
    updatedAt?: string;
}
