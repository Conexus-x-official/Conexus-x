import type { Collection } from "@/store/types";

/**
 * Board order is the user's arrangement, not the order the API replied in.
 * Every collection is created with an explicit position, so ties only happen
 * on legacy rows; `_id` breaks them by creation time and keeps the order
 * stable across refetches.
 *
 * Shared by every view that lists collections in board order — CollectionView
 * (where this originated) and ListView (grouping rows under the same
 * headers) — extracted once a second view needed the identical comparator.
 */
export const byUserOrder = (a: Collection, b: Collection) =>
    (a.position ?? 0) - (b.position ?? 0) || a._id.localeCompare(b._id);
