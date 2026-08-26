"use client";

import Image from "next/image";
import Link from "next/link";
import { HiOutlineClock, HiOutlineCog6Tooth } from "react-icons/hi2";
import { BsRobot } from "react-icons/bs";

import MembersButton from "@/components/ui/buttons/Membersbutton";
import Tooltip from "@/components/ui/helpers/tooltip";
import { resolveBannerUrl } from "@/lib/banners";
import BannerPicker from "./BannerPicker";
import { WorkspaceIcon } from "@/lib/workspaceIcons";
import type { Member } from "@/store/types";

/**
 * The workspace's identity, as a profile header.
 *
 * Modelled on a LinkedIn profile: a coloured banner, the avatar breaking its
 * lower edge, and the name and figures sitting under it. The point is that the
 * page announces WHICH workspace you are in once, prominently, instead of
 * whispering it in a 11px line in the navbar — which is what it did before, and
 * why the navbar now just says "Workspace".
 *
 * The cover is the workspace's OWN art when it has chosen some, and a plain
 * themed surface when it has not — never a stock picture standing in. A shared
 * placeholder photograph reads as this workspace's cover rather than as the
 * absence of one, so every workspace looked like it had already been decorated,
 * identically. The empty state is built from --control and --panel, so it is
 * near-white in the light family, near-black in .dark, and carries the blue /
 * green / purple tint in those, with no per-theme variant to keep in sync.
 *
 * It also used to be a gradient built from a hue hashed off the workspace id;
 * that hue appeared nowhere else in the app, so it was decoration presenting
 * itself as information, and it fought whatever the icon and buttons in front
 * of it were doing.
 *
 * The avatar shows the workspace's CHOSEN ICON, not the first letter of its
 * name. A letter is not identity — two workspaces beginning with "N" drew the
 * same square — whereas the icon is picked deliberately when the workspace is
 * created. See lib/workspaceIcons.tsx.
 */

export default function WorkspaceBanner({
    name,
    icon,
    moduleCount,
    memberCount,
    members,
    workspaceId,
    onInvite,
    banner,
    onChangeBanner,
    savingBanner = false
}: {
    name: string;
    /** Catalog key from lib/workspaceIcons.tsx. */
    icon?: string;
    moduleCount: number;
    memberCount: number;
    members: Member[];
    workspaceId: string;
    onInvite: () => void;
    /**
     * The workspace's stored cover — a catalog key or a URL. Resolved here
     * rather than by the caller so every mount renders the same fallback for
     * an empty or unrecognised value.
     */
    banner?: string;
    /**
     * Omit to make the cover read-only. The pencil only appears when there is
     * somewhere for the choice to be saved, so it can never offer an edit that
     * silently does nothing.
     */
    onChangeBanner?: (key: string) => void;
    savingBanner?: boolean;
}) {
    const cover = resolveBannerUrl(banner);
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-card font-dmsans">

            {/* Cover. The gradient is the FLOOR, painted whether or not there
                is art: with a picture it is never seen, and without one it is
                the cover. That is also why no <Image> is rendered at all in the
                empty case — a hidden or transparent one would still be a
                request for a file nobody is going to look at.

                `fill` + object-cover so the art crops rather than stretches at
                any width. `sizes` matters here: with `fill` and no hint,
                next/image asks for a full-viewport-width source, which on a
                1376px original is a much bigger download than a 128px-tall
                strip needs. */}
            <div className="relative h-28 w-full bg-gradient-to-br from-control via-panel to-control sm:h-32">
                {cover && (
                    <Image
                        src={cover}
                        alt=""
                        fill
                        priority
                        sizes="100vw"
                        className="object-cover"
                    />
                )}

                {onChangeBanner && (
                    /* Over the art, top-right: the control belongs ON the thing
                       it changes, and that corner is the one the avatar and
                       title never occupy. z-10 clears the filled <Image>, which
                       is absolutely positioned and would otherwise paint over
                       a static sibling. */
                    <div className="absolute right-3 top-3 z-10">
                        <BannerPicker
                            value={banner}
                            saving={savingBanner}
                            onPick={onChangeBanner}
                        />
                    </div>
                )}
            </div>

            <div className="px-5 pb-5 sm:px-6 border-t border-slate-200">

                {/*
                    Avatar on its own line, name STACKED beneath it — the real
                    LinkedIn arrangement.

                    It was side-by-side and bottom-aligned with the avatar, which
                    left the title jammed a few pixels under the cover with no
                    way to push it down: in a bottom-aligned row, padding-top on
                    the text grows the box upward and the text does not move.
                    Stacking is what makes the title's spacing an actual margin.
                */}
                {/*
                    relative z-10 is LOAD-BEARING. The cover uses <Image fill>,
                    which is position:absolute — so it paints above any static
                    sibling that follows it, and the negative margin below pulls
                    this row up into exactly that overlap. Without a stacking
                    context of its own the avatar's top half (and most of its
                    icon) rendered behind the cover art.
                */}
                <div className="relative z-10  -mt-10 flex flex-wrap items-end justify-between gap-4 sm:-mt-12">
                    {/* The tile keeps the card fill and is closed with a
                        BORDER instead — a filled square read as a second
                        surface sitting on the page, while an outline says
                        "this is one object" without introducing another
                        colour. Two edges, in order: the slate border draws
                        the tile, and the white ring-4 outside it is the gap
                        that lifts it off the cover art. */}
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-card text-accent sm:h-24 sm:w-24">
                        <WorkspaceIcon iconKey={icon} className="h-9 w-9 sm:h-11 sm:w-11" />
                    </div>

                    {/* Everything you can do TO the workspace, as opposed to
                        inside it. The module list below owns its own actions. */}
                    <div className="flex shrink-0 items-center gap-2 pb-1 ">
                        <MembersButton members={members} onInvite={onInvite} />

                        <Tooltip label="Automations" side="bottom">
                            <Link
                                href={`/workspace/${workspaceId}/automation`}
                                aria-label="Automations"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-card text-muted transition hover:border-accent/50 hover:text-accent"
                            >
                                {/* Only this one changed for now — the bolt is
                                    still the automation glyph in the activity
                                    feed, the activity filter and the builder. */}
                                <BsRobot className="h-4 w-4" />
                            </Link>
                        </Tooltip>

                        <Tooltip label="Activity log" side="bottom">
                            <Link
                                href={`/workspace/${workspaceId}/activity`}
                                aria-label="Activity log"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-card text-muted transition hover:border-accent/50 hover:text-accent"
                            >
                                <HiOutlineClock className="h-4 w-4" />
                            </Link>
                        </Tooltip>

                        <Tooltip label="People and module access" side="bottom">
                            <Link
                                href={`/members/${workspaceId}`}
                                aria-label="People and module access"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-card text-muted transition hover:border-accent/50 hover:text-accent"
                            >
                                <HiOutlineCog6Tooth className="h-4 w-4" />
                            </Link>
                        </Tooltip>
                    </div>
                </div>

                {/* mt-4 is the title's breathing room, and it works here because
                    nothing is bottom-aligning it any more. */}
                <div className="mt-4 min-w-0 ">
                    <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                        {name}
                    </h1>
                    <p className="mt-1 text-xs text-muted">
                        {moduleCount} {moduleCount === 1 ? "module" : "modules"}
                        {" · "}
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                    </p>
                </div>
            </div>
        </section>
    );
}
