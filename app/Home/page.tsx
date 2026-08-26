"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@/data/data";
import Sidebar from "@/components/Sidebar";
import NotificationDropdown from "@/components/notifications";
import WorkspaceSections from "@/components/homesection";
import ProfileDropdown from "@/components/Profile";
import CreateWorkspace from "@/components/ui/modals/createWorkspace";
import SearchBar from "@/components/searchBar";
import WorkspaceLoader from "@/components/WorkspaceLoader";
import AiSidebar from "@/components/AiSidebar";
import {
    useGetWorkspacesQuery,
    useCreateWorkspaceMutation
} from "@/store/api/workspaces.api";

export default function DashboardPage() {
    const router = useRouter();
    const [profileOpen, setProfileOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [workspaceName, setWorkspaceName] = useState("");
    const [error, setError] = useState("");
    const [notification, setNotification] = useState(false);
    const [search, setSearch] = useState("");

    // Same cache entry the Sidebar and the workspace table subscribe to.
    const { isLoading } = useGetWorkspacesQuery();
    const [createWorkspaceMutation, { isLoading: creating }] = useCreateWorkspaceMutation();

    const createWorkspace = async () => {
        if (!workspaceName.trim()) {
            setError("Workspace name is required");
            return;
        }

        try {
            setError("");
            // The Workspace:LIST tag refreshes every subscriber — no manual refetch.
            await createWorkspaceMutation({ name: workspaceName }).unwrap();
            setWorkspaceName("");
            setShowModal(false);
        } catch {
            setError("Workspace creation failed");
        }
    };

    if (isLoading) {
        return <WorkspaceLoader />;
    }

    return (
        <section className="flex h-full w-full">
            <Sidebar />

            {/*
                bg-card, not bg-canvas: canvas is the recessed grey the app sits
                ON, and this surface is the page itself. The token is what keeps
                "white" honest — it is #ffffff across the light family and the
                right dark surface under .dark, where a literal white would burn.
            */}
            <div className="flex h-screen w-full min-w-0 flex-col bg-card">
                {/* One hairline separates the bar from the content; no card,
                    no shadow, no inset — the surface runs edge to edge. */}
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline px-6 py-3">
                    <SearchBar value={search} onChange={setSearch} />

                    <div className="flex items-center gap-2">
                        <NotificationDropdown
                            open={notification}
                            setOpen={setNotification}
                            notifications={notifications}
                            onViewAll={() => router.push("/notifications")}
                        />

                        <ProfileDropdown
                            open={profileOpen}
                            setOpen={setProfileOpen}
                        />
                    </div>
                </header>

                {/* min-h-0 is what lets the table below own the scroll instead
                    of stretching this column past the viewport. */}
                <div className="min-h-0 flex-1">
                    <WorkspaceSections searchQuery={search} />
                </div>

                {/* Create workspace modal */}
                {showModal && (
                    <CreateWorkspace
                        open={showModal}
                        setOpen={setShowModal}
                        workspaceName={workspaceName}
                        setWorkspaceName={setWorkspaceName}
                        error={error}
                        creating={creating}
                        createWorkspace={createWorkspace}
                    />
                )}
            </div>

            {/* Right rail — Aquiline, scoped to every workspace from here */}
            <AiSidebar agent="aquiline" context="all workspaces" />
        </section>
    );
}