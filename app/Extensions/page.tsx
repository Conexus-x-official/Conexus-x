"use client";

import { TbPlug, TbPlugX } from "react-icons/tb";

import ProfileDropdown from "@/components/Profile";
import BackButton from "@/components/ui/buttons/backButton";
import NavTile from "@/components/ui/helpers/navTile";

/**
 * Extensions — where a team will build and deploy its own apps onto the CRM.
 *
 * The sidebar has linked here since before the route existed, so until recently
 * the entry point 404'd. This page is deliberately an honest placeholder: it
 * says what the section is for and that it is not built yet, and it lists
 * NOTHING. A grid of plausible-looking extensions would be a lie the moment
 * anyone clicked one, and an empty grid with a working "New extension" button
 * would be worse — it promises a flow that does not exist.
 *
 * The panel that used to hold that promise is gone: the card, the disabled
 * button and its "Coming soon" pill were all removed, because a button you
 * cannot press is not information — it is a control that looks broken. What is
 * left is the shape of the page and one line saying why it is empty.
 *
 * THE HEADER IS THE AUTOMATION PAGE'S HEADER, to the pixel: same shell card,
 * same sticky h-16 bar, same 40px tile with a 20px glyph, same 14px title over
 * an 11px subtitle. Both are sidebar-less pages reached from the same nav, and
 * two headers that are nearly the same read as a mistake in whichever one you
 * see second.
 */

export default function ExtensionsPage() {
    return (
        <section className="flex bg-canvas">

            {/* Shell card — the frame every page sits in (LAYOUT.md §7) */}
            <div className="min-h-screen w-full flex flex-col bg-panel overflow-hidden shadow-sm">

                {/* Top navbar */}
                <header className="sticky top-0 z-20 bg-panel border-b border-slate-200">
                    <div className="w-full mx-auto px-6 h-16 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* No sidebar on this page, so the header carries the
                                way out. Home is the fallback for a pasted link. */}
                            <BackButton fallbackHref="/Home" />

                            <NavTile className="h-10 w-10 rounded-xl text-slate-600">
                                <TbPlug className="h-5 w-5" />
                            </NavTile>

                            <div className="min-w-0">
                                <h1 className="text-sm font-semibold text-slate-900 truncate font-dmsans">
                                    Extensions
                                </h1>
                                <p className="text-[11px] text-muted truncate font-dmsans">
                                    Custom apps built on your own data
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <ProfileDropdown />
                        </div>
                    </div>
                </header>

                {/*
                    Body — the unplugged glyph doing the work the panel used to.
                    TbPlugX is the same plug as the header and the sidebar row,
                    with the cross that says "nothing connected", so the empty
                    state is the page's OWN icon rather than a stock drawing of
                    nothing in particular.
                */}
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center font-dmsans">
                    <TbPlugX className="h-20 w-20 text-slate-300" strokeWidth={1.25} />

                    <h2 className="mt-5 text-lg font-semibold text-slate-900">
                        No extensions yet
                    </h2>

                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted">
                        This is where your team will build its own apps on top of the CRM
                        and deploy them into a workspace. The builder itself is still to
                        come.
                    </p>
                </div>
            </div>
        </section>
    );
}
