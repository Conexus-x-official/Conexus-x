"use client";

import { useRouter } from "next/navigation";
import { MdOutlineGroupAdd } from "react-icons/md";
import { getUser } from "@/lib/auth";
import { presenceLabel } from "@/lib/presence";
import PresenceDot from "../helpers/presenceDot";
import Tooltip from "../helpers/tooltip";

import userAsset from "@/app/assets/user.png";

export interface MemberUser {
    _id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    avatar?: string;
    profileImage?: string;
    /** Server-derived presence — see backend getWorkspaceMembers. */
    presence?: string;
}

export interface Member {
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    avatar?: string;
    profileImage?: string;
    user?: MemberUser;
}

interface MembersButtonProps {
    members: Member[] | any[];
    onInvite?: () => void;
}

export default function MembersButton({
    members,
    onInvite,
}: MembersButtonProps) {
    const router = useRouter();
    const currentUser = getUser();

    // Filter out the current logged in user from members list
    const otherMembers = (members || []).filter((member: any) => {
        const rawUser = member.user || member;
        const memberId = rawUser?._id || rawUser?.id || member._id || member.id;
        const memberEmail = rawUser?.email || member.email;

        if (currentUser?.id && memberId && String(memberId) === String(currentUser.id)) {
            return false;
        }
        if (currentUser?.email && memberEmail && memberEmail.toLowerCase() === currentUser.email.toLowerCase()) {
            return false;
        }
        return true;
    });

    const visibleMembers = otherMembers.slice(0, 4);
    const hasMembers = visibleMembers.length > 0;

    return (
        <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-slate-300 bg-card shadow-sm">
            {hasMembers && (
                <Tooltip
                    label={`View all ${otherMembers.length + 1} members`}
                    side="bottom"
                >
                <button
                    type="button"
                    onClick={() => router.push("/members")}
                    aria-label="View all members"
                    className="flex h-full items-center gap-1.5 border-r border-slate-300 px-2.5 transition hover:bg-slate-50 cursor-pointer"
                >
                    <div className="flex items-center -space-x-2">
                        {visibleMembers.map((member: any, index: number) => {
                            const rawUser = member.user || member;

                            const memberName =
                                member.name ||
                                rawUser?.name ||
                                `${rawUser?.firstName || ""} ${
                                    rawUser?.lastName || ""
                                }`.trim() ||
                                "Member";

                            // The API nests the picture under `user`, so read the
                            // populated user first; the bundled asset stands in for
                            // anyone who has not uploaded one.
                            const avatar =
                                rawUser?.avatar ||
                                rawUser?.profileImage ||
                                member.avatar ||
                                member.profileImage ||
                                userAsset.src;

                            const presence = rawUser?.presence;

                            return (
                                <Tooltip
                                    key={member._id || index}
                                    label={
                                        presence
                                            ? `${memberName} — ${presenceLabel(presence)}`
                                            : memberName
                                    }
                                >
                                <div className="relative shrink-0">
                                    <div className="h-7 w-7 overflow-hidden rounded-full border border-white bg-slate-200 shadow-sm">
                                        <img
                                            src={avatar}
                                            alt={memberName}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    {presence && (
                                        <span className="pointer-events-none absolute -bottom-px -right-px">
                                            <PresenceDot status={presence} size={9} ring={1.5} />
                                        </span>
                                    )}
                                </div>
                                </Tooltip>
                            );
                        })}

                        {otherMembers.length > 4 && (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white bg-slate-800 text-[10px] font-medium text-slate-300">
                                +{otherMembers.length - 4}
                            </div>
                        )}
                    </div>
                </button>
                </Tooltip>
            )}

            {/* `title` replaced by <Tooltip>: it themes, it opens faster, and
                it appears on keyboard focus, which the native one never does. */}
            <Tooltip label="Invite member" side="bottom">
                <button
                    type="button"
                    onClick={onInvite}
                    aria-label="Invite member"
                    className="flex h-full w-9 items-center justify-center text-muted transition hover:text-accent cursor-pointer"
                >
                    <MdOutlineGroupAdd className="h-[18px] w-[18px]" />
                </button>
            </Tooltip>
        </div>
    );
}