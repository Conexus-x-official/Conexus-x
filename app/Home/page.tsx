"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import NotificationDropdown from "@/components/notifications";
import WorkspaceSections from "@/components/homesection";
import ProfileDropdown from "@/components/Profile";
import CreateWorkspace from "@/components/ui/modals/createWorkspace";
import SearchBar from "@/components/searchBar";
import WorkspaceLoader from "@/components/WorkspaceLoader";
import AiSidebar from "@/components/AiSidebar";
import HomeGreeting from "@/components/home/HomeGreeting";
import {
    useGetWorkspacesQuery,
    useCreateWorkspaceMutation
} from "@/store/api/workspaces.api";

export default function DashboardPage() {
    const [profileOpen, setProfileOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [workspaceName, setWorkspaceName] = useState("");
    const [error, setError] = useState("");
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
                bg-panel is the recessed surface the content card sits ON — a
                step below bg-card in every theme, which is what lets the table
                card and the header read as raised rather than as the page
                itself. The header keeps its own bg-card so the search bar and
                avatars sit on white.
            */}
            <div className="flex h-screen w-full min-w-0 flex-col bg-panel">
                {/* One hairline separates the bar from the content; the bar is
                    its own bg-card surface running edge to edge. */}
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-card px-4 py-2">
                    <SearchBar value={search} onChange={setSearch} />

                    <div className="flex items-center gap-2">
                        <NotificationDropdown />

                        <ProfileDropdown
                            open={profileOpen}
                            setOpen={setProfileOpen}
                        />
                    </div>
                </header>

                {/* min-h-0 is what lets the table card below own the scroll
                    instead of stretching this column past the viewport. The
                    greeting strip is a fixed band above it. */}
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="shrink-0 px-4 pb-3 pt-4">
                        <HomeGreeting onNewWorkspace={() => setShowModal(true)} />
                    </div>

                    <div className="min-h-0 flex-1 px-4 pb-4">
                        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-card">
                            <WorkspaceSections searchQuery={search} />
                        </div>
                    </div>
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