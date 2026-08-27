import DeveloperSidebar from "@/components/developerSidebar";

export default function DeveloperLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        /*
            bg-card, not bg-canvas. Canvas is the recessed grey the app sits ON;
            this section is the page itself, and with the nav beside it now
            being bg-card too, the old canvas left a grey field butted against a
            white column with nothing between them to explain the seam. Same
            surface the account section uses.
        */
        /*
            THE PAGE DOES NOT SCROLL — the content column does.

            This was `min-h-screen` with the scroll on the body, so the nav
            scrolled away with the content and a long response left you with no
            way to reach the other section without scrolling back to the top.
            Pinning the shell to h-screen and giving the right column its own
            overflow keeps the nav on screen at all times, which is the whole
            point of having one.
        */
        <div className="flex h-screen overflow-hidden bg-card">
            <DeveloperSidebar />

            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden  [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover">
                {children}
            </div>
        </div>
    );
}
