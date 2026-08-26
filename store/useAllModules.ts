"use client";

import { useEffect, useMemo } from "react";
import { shallowEqual } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import { useAppDispatch, useAppSelector } from "./hooks";
import type { RootState } from "./index";
import { modulesApi } from "./api/modules.api";
import type { Module } from "./types";

/**
 * Every module the user can see, across every workspace.
 *
 * Same shape as useAllMembers (and useModuleData before it): the rules of hooks
 * forbid a useGetModulesQuery per workspace, so this selector reads the RTK
 * Query cache directly and the effect drives the fetches. The data still goes
 * through the shared cache — dedupe, tag invalidation, keepUnusedDataFor — so a
 * workspace already loaded by the Sidebar costs nothing here.
 */

export interface ModuleRow {
    /** `${workspaceId}:${moduleId}` — stable across refetches. */
    id: string;
    workspaceId: string;
    module: Module;
}

type CacheEntry = {
    endpointName?: string;
    originalArgs?: unknown;
    data?: unknown;
};

const selectQueries = (state: RootState) =>
    state.api.queries as Record<string, CacheEntry | undefined>;

const selectModulesFor = createSelector(
    [selectQueries, (_state: RootState, workspaceIds: string[]) => workspaceIds],
    (queries, workspaceIds) => {
        const wanted = new Set(workspaceIds);
        const rows: ModuleRow[] = [];
        let loadedCount = 0;

        for (const key of Object.keys(queries)) {
            const entry = queries[key];

            if (
                entry?.endpointName === "getModules" &&
                typeof entry.originalArgs === "string" &&
                wanted.has(entry.originalArgs) &&
                Array.isArray(entry.data)
            ) {
                const workspaceId = entry.originalArgs;
                loadedCount += 1;

                (entry.data as Module[]).forEach((module) => {
                    rows.push({
                        id: `${workspaceId}:${module._id}`,
                        workspaceId,
                        module,
                    });
                });
            }
        }

        return { rows, loadedCount };
    }
);

export function useAllModules(workspaceIds: string[], skip = false) {
    const dispatch = useAppDispatch();

    const idsKey = skip ? "" : workspaceIds.join(",");

    useEffect(() => {
        if (!idsKey) return;

        const subscriptions = idsKey
            .split(",")
            .filter(Boolean)
            .map((workspaceId) =>
                dispatch(modulesApi.endpoints.getModules.initiate(workspaceId))
            );

        return () =>
            subscriptions.forEach((subscription) => subscription.unsubscribe());
    }, [idsKey, dispatch]);

    const stableIds = useMemo(() => idsKey.split(",").filter(Boolean), [idsKey]);

    const { rows, loadedCount } = useAppSelector(
        (state) => selectModulesFor(state, stableIds),
        shallowEqual
    );

    return {
        modules: rows,
        isLoading: stableIds.length > 0 && loadedCount < stableIds.length,
    };
}
