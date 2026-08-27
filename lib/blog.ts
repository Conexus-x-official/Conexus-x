/**
 * The blog's content, as data.
 *
 * PLACEHOLDER CONTENT — these three posts exist so the index links somewhere
 * real and the /blog/<slug> route has something to render. Replace the array
 * (or swap this module for a CMS/MDX loader) without touching either page:
 * both read only the helpers at the bottom.
 *
 * Bodies are structured blocks rather than a markdown string on purpose — no
 * parser dependency, and the renderer emits real <h2>/<p>/<ul>, which is what
 * a crawler reads a page's outline from.
 */

export type PostBlock =
    | { kind: "paragraph"; text: string }
    | { kind: "heading"; text: string }
    | { kind: "list"; items: string[] }
    | { kind: "quote"; text: string };

export interface Post {
    slug: string;
    title: string;
    /** Also the meta description and the card blurb — one sentence, under 160 chars. */
    description: string;
    /** ISO date. Drives <time>, the sitemap's lastModified and the article JSON-LD. */
    date: string;
    author: string;
    tag: string;
    readingMinutes: number;
    body: PostBlock[];
}

export const POSTS: Post[] = [
    {
        slug: "why-your-crm-should-not-ship-with-your-pipeline",
        title: "Why your CRM should not ship with your pipeline",
        description:
            "Every team's pipeline is different, and a CRM that guesses yours costs more to unpick than it ever saved. The case for building the shape yourself.",
        date: "2026-08-18",
        author: "The Conexus X team",
        tag: "Product",
        readingMinutes: 6,
        body: [
            {
                kind: "paragraph",
                text: "Most CRMs open on a pipeline someone else drew. Six stages, a set of fields, and a quiet assumption that your business closes deals the way the vendor's demo does. It is a good first five minutes and an expensive first six months.",
            },
            {
                kind: "paragraph",
                text: "The trouble is not that the default is wrong. It is that the default is load-bearing. Reports read those stages, automations fire on them, and the integrations added in month two are keyed to field names nobody chose. By the time the shape is clearly wrong, changing it means changing everything downstream of it.",
            },
            { kind: "heading", text: "Structure is the product" },
            {
                kind: "paragraph",
                text: "Conexus X starts from the opposite end. A workspace holds modules, a module holds collections, a collection holds records, and a record holds whatever columns you say it does. None of those arrive pre-filled with an opinion about selling.",
            },
            {
                kind: "list",
                items: [
                    "Columns are typed — status, date, timeline, person, rating, relation — so the data stays queryable instead of becoming a wall of free text.",
                    "A relation column mirrors a value from another module, so a deal can read a project's hours without either module having to own both.",
                    "Sub-records nest exactly one level, which covers checklists and line items without inviting a tree nobody can navigate.",
                ],
            },
            {
                kind: "paragraph",
                text: "The result is that the first hour goes on describing your work rather than translating it. Slower to start, and considerably cheaper to live with.",
            },
            { kind: "heading", text: "What we deliberately did not build" },
            {
                kind: "paragraph",
                text: "Flexibility has a failure mode: a product that can express anything and helps with nothing. So the structure stops in specific places. Sub-records go one level, not five. Automations are a flat list of conditions, not a branching canvas. Both limits exist because the alternative is a tool that needs a specialist before anyone can use it.",
            },
            {
                kind: "quote",
                text: "A default you can change is a starting point. A default the rest of the system depends on is a decision made for you.",
            },
        ],
    },
    {
        slug: "automations-you-can-read-out-loud",
        title: "Automations you can read out loud",
        description:
            "We built the automation editor as a sentence with fill-in blanks. Why that beats a node canvas for a rule that is one line long.",
        date: "2026-08-11",
        author: "The Conexus X team",
        tag: "Engineering",
        readingMinutes: 5,
        body: [
            {
                kind: "paragraph",
                text: "There are three ways the industry builds automation editors. A node canvas, where steps are boxes you wire together. A linear step list, where you pick an app, then an event, then map the fields. Or a sentence, where the rule reads as English with the variable parts underlined.",
            },
            {
                kind: "paragraph",
                text: "We chose the sentence, and the reason is narrow: we automate one product's own nouns. There is no app-picking step to make linear, and no arbitrary branching to lay out. A canvas would be ceremony around a rule that is one line long.",
            },
            { kind: "heading", text: "When, only if, then" },
            {
                kind: "paragraph",
                text: "A recipe reads in three lines. When a status column changes to Done, only if the record sits in a collection you name, then move it and tell someone. The blanks are inline and sized to their content — dashed while empty, solid once chosen — so an unfinished rule looks unfinished rather than looking broken.",
            },
            {
                kind: "paragraph",
                text: "We built a plain-English preview underneath the form early on, then deleted it. If the form itself reads correctly, a second block restating it says the same words twice — and wanting one at all was the proof the form was not yet readable.",
            },
            { kind: "heading", text: "Offering only what can run" },
            {
                kind: "list",
                items: [
                    "A trigger that fires on a sub-record never offers actions that only make sense on a parent — the engine would refuse them, so the list does not show them.",
                    "A workspace-wide rule hides the collection picker, because naming a collection would quietly narrow the rule back to a single module.",
                    "Impossible options are filtered out, never greyed out. A disabled option still leaves people wondering what they did wrong.",
                ],
            },
            {
                kind: "paragraph",
                text: "Every run lands in the activity log, stamped with the recipe that caused it and the person whose edit set it off. There is no separate run feed to go stale — an automated change is an activity row, so that is where it lives.",
            },
        ],
    },
    {
        slug: "what-real-time-actually-has-to-mean",
        title: "What real time actually has to mean",
        description:
            "Polling every ten seconds is not real time, it is a slower refresh button. What it took to push every change over one socket — and to survive the gaps.",
        date: "2026-08-04",
        author: "The Conexus X team",
        tag: "Engineering",
        readingMinutes: 7,
        body: [
            {
                kind: "paragraph",
                text: "Collaborative tools like to claim real time when what they mean is a timer. A poll every ten seconds is a refresh button someone else is pressing for you: cheaper to build, and it still shows a colleague's edit ten seconds after they made it — long enough to type over it.",
            },
            { kind: "heading", text: "One socket, one identity" },
            {
                kind: "paragraph",
                text: "Every browser tab holds exactly one connection. That sounds like an implementation detail and is really a product rule: the connection is how presence is decided, so a second socket would be a second identity, and closing one tab would report you offline while the other sat open.",
            },
            {
                kind: "paragraph",
                text: "Connecting is also the heartbeat. There is no separate timer beating every sixty seconds to say you are still here — being connected says it.",
            },
            { kind: "heading", text: "Patch one row, refetch anything structural" },
            {
                kind: "paragraph",
                text: "When a change arrives there are two honest responses. If the message is the whole truth about one row — a cell's new value, a rename, a comment count — it is patched straight into the cache and nothing is requested. If the change is structural — a row appearing, moving or disappearing, a column added — that data is marked stale and refetched.",
            },
            {
                kind: "paragraph",
                text: "The split matters because structural changes touch ordering, server-computed counts, and values derived from other people's records. Hand-patching those means reproducing the server's arithmetic in the browser and keeping the two identical forever, which is a bet nobody wins.",
            },
            { kind: "heading", text: "The part everyone forgets: the gap" },
            {
                kind: "paragraph",
                text: "Connections drop — a tunnel, a sleeping laptop, a flaky cafe. A client that reconnects has missed everything in between, and there is no replay. So on every reconnect, not only the first, the app treats what is on screen as stale once and refills it.",
            },
            {
                kind: "quote",
                text: "Pushes are what make it feel instant. Resyncing on reconnect is what makes a missed push survivable.",
            },
        ],
    },
];

/** Newest first. The index, the sitemap and the related list all want this order. */
export function getPosts(): Post[] {
    return [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
    return POSTS.find((p) => p.slug === slug);
}

/**
 * Formatted for display. The locale and time zone are PINNED: left to the
 * runtime's own defaults the server renders one string and the browser another,
 * which is a hydration mismatch on every post card.
 */
export function formatPostDate(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
}
