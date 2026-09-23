"use client";

import { useMemo } from "react";
import { HiOutlinePresentationChartBar } from "react-icons/hi2";

import { useGetCollectionsQuery } from "@/store/api/collections.api";
import { useGetColumnsQuery } from "@/store/api/columns.api";
import { useModuleRecords } from "@/store/useModuleData";
import { useGetMembersQuery } from "@/store/api/members.api";
import { byUserOrder } from "@/lib/sortCollections";
import { computeModuleInsights } from "@/lib/moduleInsights";
import InsightWidget from "@/components/views/InsightWidget";

/**
 * The Dashboard view: every insight computeModuleInsights finds, all at
 * once, small — the "whole board at a glance" counterpart to Chart view's
 * "one insight, large". Same InsightWidget renderer as Chart view, just more
 * of them in a responsive grid; a stat tile (field completion count, a
 * number column's total) sits naturally beside a bar chart because
 * InsightWidget's outer card is the same shape for both kinds.
 */

export default function DashboardView({
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

    if (!records.length || !insights.length) {
        return (
            <div className="pl-8 pt-2 pr-8 flex-1 flex flex-col overflow-hidden">
                <div className="mr-8 mt-2 flex-1 rounded-md border border-dashed border-hairline bg-card/50 px-6 py-16 text-center font-google-sans">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-control text-muted">
                        <HiOutlinePresentationChartBar size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">No widgets yet</h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        The dashboard fills in as records pick up status, person or number
                        values in Collection view — each column that gets used becomes a
                        widget here.
                    </p>
                </div>
            </div>
        );
    }

    // The growth line leads and spans the full width — the headline metric —
    // then the smaller breakdowns fill the grid below it.
    const [lead, ...rest] = insights;

    return (
        <div className="pl-8 pt-2 pb-4 flex-1 flex flex-col overflow-hidden font-google-sans">
            <div className="mb-3 flex shrink-0 items-center gap-2 pr-8">
                <h3 className="text-base font-bold text-foreground">Dashboard</h3>
                <span className="text-[11px] text-muted">
                    {insights.length} widget{insights.length === 1 ? "" : "s"}
                </span>
            </div>

            <div className="mr-8 flex-1 space-y-4 overflow-auto">
                {lead?.kind === "line" ? (
                    <>
                        <div className="h-[240px]">
                            <InsightWidget insight={lead} height={240} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {rest.map((insight) => (
                                <InsightWidget key={insight.id} insight={insight} height={200} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {insights.map((insight) => (
                            <InsightWidget key={insight.id} insight={insight} height={200} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
