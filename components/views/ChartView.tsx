"use client";

import { useMemo, useState } from "react";
import { HiOutlineChartBar } from "react-icons/hi2";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useModuleRecords } from "@/store/useModuleData";
import { useGetMembersQuery } from "@/store/api/members.api";
import { byUserOrder } from "@/lib/sortCollections";
import { computeModuleInsights } from "@/lib/moduleInsights";
import InsightWidget from "@/components/views/InsightWidget";
import ItemPicker from "@/components/views/ItemPicker";

/**
 * The Chart view: ONE insight, shown large. computeModuleInsights (lib/) does
 * all the aggregation — this component only picks which one to show and
 * renders it big via InsightWidget, the same rendering piece DashboardView
 * uses small. When more than one insight exists a "Showing" picker switches
 * between them, remembered per module like Kanban's group-by column;
 * otherwise the one insight there is just renders, no picker needed.
 */

const chartStorageKey = (moduleId: string) => `chart_insight_${moduleId}`;

const readRemembered = (moduleId: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(chartStorageKey(moduleId));
    } catch {
        return null;
    }
};

export default function ChartView({
    workspaceId,
    moduleId,
}: {
    workspaceId: string;
    moduleId: string;
}) {
    const { data: collectionsData = [] } = useGetCollectionsQuery(moduleId, { skip: !moduleId });
    const collections = useMemo(() => [...collectionsData].sort(byUserOrder), [collectionsData]);
    const collectionIds = useMemo(() => collections.map((c) => c._id), [collections]);

    const { records, recordValues } = useModuleRecords(collectionIds);
    const { data: columns = [] } = useGetColumnsQuery(moduleId, { skip: !moduleId });
    const { data: workspaceMembers = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });

    const insights = useMemo(
        () => computeModuleInsights({ records, recordValues, columns, collections, workspaceMembers }),
        [records, recordValues, columns, collections, workspaceMembers]
    );

    const [pickedId, setPickedId] = useState<string | null>(null);
    const remembered = readRemembered(moduleId);

    const active =
        (pickedId ? insights.find((i) => i.id === pickedId) : undefined) ??
        (remembered ? insights.find((i) => i.id === remembered) : undefined) ??
        insights[0] ??
        null;

    const selectInsight = (id: string) => {
        setPickedId(id);
        try {
            localStorage.setItem(chartStorageKey(moduleId), id);
        } catch {
            // Private browsing / storage disabled — the pick still applies for
            // this session, it just will not be remembered.
        }
    };

    if (!records.length || !active) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-md border border-dashed border-hairline bg-card/50 px-6 py-16 text-center font-google-sans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlineChartBar size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">Nothing to chart yet</h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Charts build themselves from the columns your records already use — a
                        status column, a person column, a number column. Add some data in
                        Collection view, then come back.
                    </p>
                </div>
            </div>
        );
    }

    const pickerItems = insights.map((i) => ({ _id: i.id, name: i.title }));

    return (
        <div className="pl-8 pt-2 pb-4 flex-1 flex flex-col overflow-hidden font-google-sans">
            <div className="mb-3 flex shrink-0 items-center gap-3 pr-8">
                <h3 className="text-base font-bold text-foreground">Chart</h3>
                {insights.length > 1 && (
                    <ItemPicker
                        label="Showing"
                        heading="Chart"
                        items={pickerItems}
                        active={{ _id: active.id, name: active.title }}
                        onChange={selectInsight}
                    />
                )}
            </div>

            <div className="mr-8 flex-1 overflow-auto">
                <div className="mx-auto h-full max-w-3xl">
                    <InsightWidget insight={active} height={420} />
                </div>
            </div>
        </div>
    );
}
