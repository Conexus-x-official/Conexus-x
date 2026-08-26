"use client";

import {
    TbBriefcase,
    TbBuildingSkyscraper,
    TbChecklist,
    TbHeadset,
    TbUser,
    TbUsers,
    TbTargetArrow,
} from "react-icons/tb";
import type { IconType } from "react-icons";

/**
 * Everything the signup funnel asks, as data.
 *
 * SPEC TABLES, not branches. Each step's options live in one array, and the
 * wizard, the preview and the code that finally builds the account all read
 * from here — so adding an option is a row, and none of the three can drift
 * from the other two.
 */

/* ------------------------------------------------------------------ *
 *  Step 1 — what kind of account is this
 * ------------------------------------------------------------------ */

export type AccountType = "personal" | "team" | "organization" | "other";

export interface AccountTypeSpec {
    key: AccountType;
    label: string;
    blurb: string;
    icon: IconType;
    /** Personal accounts are not asked to invite anyone. */
    invites: boolean;
    /** What the naming step should call the thing being named. */
    nameLabel: string;
    namePlaceholder: string;
}

export const ACCOUNT_TYPES: AccountTypeSpec[] = [
    {
        key: "personal",
        label: "Just me",
        blurb: "A private space for your own work.",
        icon: TbUser,
        invites: false,
        nameLabel: "What should we call your workspace?",
        namePlaceholder: "My workspace",
    },
    {
        key: "team",
        label: "My team",
        blurb: "A shared space for a handful of people.",
        icon: TbUsers,
        invites: true,
        nameLabel: "What is your team called?",
        namePlaceholder: "Growth team",
    },
    {
        key: "organization",
        label: "My organisation",
        blurb: "Several teams working across departments.",
        icon: TbBuildingSkyscraper,
        invites: true,
        nameLabel: "What is your organisation called?",
        namePlaceholder: "Acme Inc.",
    },
    {
        key: "other",
        label: "Something else",
        blurb: "A club, a course, a side project.",
        icon: TbBriefcase,
        invites: true,
        nameLabel: "What should we call your workspace?",
        namePlaceholder: "My workspace",
    },
];

export const accountTypeByKey = (key: string) =>
    ACCOUNT_TYPES.find((type) => type.key === key) ?? ACCOUNT_TYPES[0];

/* ------------------------------------------------------------------ *
 *  Step 2 — team size (only asked when there is a team)
 * ------------------------------------------------------------------ */

export const TEAM_SIZES = ["2-5", "6-15", "16-50", "51-200", "200+"];

/* ------------------------------------------------------------------ *
 *  Step 3 — attribution
 * ------------------------------------------------------------------ */

/**
 * A FIXED list, not a free-text box.
 *
 * This is the column an acquisition dashboard groups by, and an unbounded
 * field cannot be counted — "a friend", "friend", "word of mouth" and "collegue"
 * are one answer to a person and four bars on a chart. "Somewhere else" is the
 * escape hatch and is itself a countable bucket.
 */
export const REFERRAL_SOURCES = [
    "Search engine",
    "A friend or colleague",
    "Social media",
    "YouTube or a podcast",
    "A blog or article",
    "At work",
    "Somewhere else",
];

/* ------------------------------------------------------------------ *
 *  Step 5 — what the workspace is for, and the boards that answer it
 * ------------------------------------------------------------------ */

export interface PresetColumn {
    name: string;
    /** A value from COLUMN_TYPE_OPTIONS in data/data.js. */
    type: string;
}

export interface BoardPreset {
    key: string;
    name: string;
    blurb: string;
    columns: PresetColumn[];
    /**
     * The first collection inside the board.
     *
     * Every module gets one. A module with no collection renders as an empty
     * frame with nowhere to put a record — the board's whole grid hangs off a
     * collection — so shipping one without is shipping a dead end.
     */
    collection: string;
}

export interface Purpose {
    key: string;
    label: string;
    blurb: string;
    icon: IconType;
    boards: BoardPreset[];
}

const OWNER: PresetColumn = { name: "Owner", type: "person" };
const STATUS: PresetColumn = { name: "Status", type: "status" };

export const PURPOSES: Purpose[] = [
    {
        key: "sales",
        label: "Sales & CRM",
        blurb: "Track leads, deals and the people behind them.",
        icon: TbTargetArrow,
        boards: [
            {
                key: "leads",
                name: "Leads",
                blurb: "Everyone who has shown interest",
                collection: "New leads",
                columns: [
                    STATUS,
                    OWNER,
                    { name: "Company", type: "text" },
                    { name: "Email", type: "email" },
                    { name: "Phone", type: "phone" },
                ],
            },
            {
                key: "deals",
                name: "Deals",
                blurb: "Open opportunities and their value",
                collection: "Open deals",
                columns: [
                    STATUS,
                    OWNER,
                    { name: "Value", type: "number" },
                    { name: "Close date", type: "date" },
                ],
            },
            {
                key: "accounts",
                name: "Accounts",
                blurb: "The companies you sell to",
                collection: "Active accounts",
                columns: [
                    OWNER,
                    { name: "Website", type: "link" },
                    { name: "Health", type: "rating" },
                ],
            },
        ],
    },
    {
        key: "projects",
        label: "Projects",
        blurb: "Plan work, assign it and watch it land.",
        icon: TbChecklist,
        boards: [
            {
                key: "tasks",
                name: "Tasks",
                blurb: "The day-to-day work",
                collection: "This week",
                columns: [
                    STATUS,
                    OWNER,
                    { name: "Due date", type: "date" },
                    { name: "Done", type: "checkbox" },
                ],
            },
            {
                key: "roadmap",
                name: "Roadmap",
                blurb: "What ships, and when",
                collection: "Next quarter",
                columns: [
                    STATUS,
                    OWNER,
                    { name: "Timeline", type: "timeline" },
                    { name: "Priority", type: "dropdown" },
                ],
            },
            {
                key: "bugs",
                name: "Bugs",
                blurb: "Things to fix",
                collection: "Reported",
                columns: [
                    STATUS,
                    OWNER,
                    { name: "Severity", type: "dropdown" },
                    { name: "Reported", type: "date" },
                ],
            },
        ],
    },
    {
        key: "support",
        label: "Customer support",
        blurb: "Keep every request answered and nothing dropped.",
        icon: TbHeadset,
        boards: [
            {
                key: "tickets",
                name: "Tickets",
                blurb: "Incoming requests",
                collection: "Open tickets",
                columns: [
                    STATUS,
                    OWNER,
                    { name: "Customer", type: "text" },
                    { name: "Opened", type: "date" },
                ],
            },
            {
                key: "customers",
                name: "Customers",
                blurb: "Who you are supporting",
                collection: "All customers",
                columns: [
                    OWNER,
                    { name: "Email", type: "email" },
                    { name: "Plan", type: "dropdown" },
                ],
            },
        ],
    },
    {
        key: "recruiting",
        label: "Recruiting",
        blurb: "Move candidates through your hiring pipeline.",
        icon: TbUsers,
        boards: [
            {
                key: "candidates",
                name: "Candidates",
                blurb: "People in the pipeline",
                collection: "Applied",
                columns: [
                    STATUS,
                    OWNER,
                    { name: "Role", type: "text" },
                    { name: "Email", type: "email" },
                    { name: "Rating", type: "rating" },
                ],
            },
            {
                key: "roles",
                name: "Open roles",
                blurb: "What you are hiring for",
                collection: "Hiring now",
                columns: [STATUS, OWNER, { name: "Headcount", type: "number" }],
            },
        ],
    },
    {
        key: "other",
        label: "Something else",
        blurb: "Start from one plain board and shape it yourself.",
        icon: TbBriefcase,
        boards: [
            {
                key: "general",
                name: "My first board",
                blurb: "A blank slate with the basics",
                collection: "Getting started",
                columns: [STATUS, OWNER, { name: "Notes", type: "text" }],
            },
        ],
    },
];

export const purposeByKey = (key: string) =>
    PURPOSES.find((purpose) => purpose.key === key) ?? PURPOSES[0];

/* ------------------------------------------------------------------ *
 *  What the funnel produces
 * ------------------------------------------------------------------ */

export interface OnboardingAnswers {
    accountType: AccountType;
    teamSize: string;
    referralSource: string;
    organizationName: string;
    workspaceIcon: string;
    purposeKey: string;
    /** Emails to invite once the workspace exists. */
    invites: string[];
    /** The boards to build, resolved from the presets plus anything typed. */
    boards: BoardPreset[];
}
