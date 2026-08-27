"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { buttonClass } from "@/components/site/Button";
import { CONTACT } from "@/lib/site";

/**
 * The contact form.
 *
 * IT COMPOSES A MESSAGE IN THE VISITOR'S OWN MAIL CLIENT — it does not POST
 * anywhere. There is no contact endpoint on the API, and a form that accepts a
 * message, shows a tick and drops it is the worst possible version of this
 * page: the visitor believes they have been in touch and nobody has heard from
 * them. The button says exactly what pressing it does.
 *
 * When a /contact endpoint exists, swap `handleSubmit` for the request and
 * leave everything else — the fields are already the ones a ticket needs.
 */

const TOPICS = [
    { key: "support", label: "Product help", inbox: CONTACT.support },
    { key: "sales", label: "Plans and billing", inbox: CONTACT.sales },
    { key: "press", label: "Press", inbox: CONTACT.press },
    { key: "other", label: "Something else", inbox: CONTACT.support },
] as const;

type TopicKey = (typeof TOPICS)[number]["key"];

const fieldClass =
    "w-full rounded-lg border border-zinc-400 bg-card px-4 py-3 text-sm text-body outline-none transition-colors placeholder:text-zinc-400 focus:border-accent";

const labelClass = "block text-sm font-semibold text-foreground";

export default function ContactForm() {
    const [topic, setTopic] = useState<TopicKey>("support");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [company, setCompany] = useState("");
    const [message, setMessage] = useState("");

    const selected = TOPICS.find((t) => t.key === topic) ?? TOPICS[0];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const subject = `${selected.label} — ${name || "Website enquiry"}`;
        const body = [
            `Name: ${name}`,
            `Email: ${email}`,
            company ? `Company: ${company}` : null,
            "",
            message,
        ]
            .filter((line) => line !== null)
            .join("\n");

        // encodeURIComponent, not the raw strings: a newline or an ampersand in
        // the message would otherwise terminate the mailto parameter early and
        // truncate what the visitor wrote.
        window.location.href = `mailto:${selected.inbox}?subject=${encodeURIComponent(
            subject,
        )}&body=${encodeURIComponent(body)}`;
    };

    return (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-card p-6 sm:p-8">
            <fieldset>
                <legend className={labelClass}>What is this about?</legend>

                <div className="mt-3 flex flex-wrap gap-2">
                    {TOPICS.map((option) => (
                        <label
                            key={option.key}
                            className={
                                option.key === topic
                                    ? "cursor-pointer rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors"
                                    : "cursor-pointer rounded-lg border border-slate-300 bg-card px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-control"
                            }
                        >
                            {/* A real radio, visually hidden: keyboard, arrow keys
                                and screen-reader grouping come free, and a
                                hand-rolled toggle would have to re-earn them. */}
                            <input
                                type="radio"
                                name="topic"
                                value={option.key}
                                checked={option.key === topic}
                                onChange={() => setTopic(option.key)}
                                className="sr-only"
                            />
                            {option.label}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="contact-name" className={labelClass}>
                        Your name
                    </label>
                    <input
                        id="contact-name"
                        name="name"
                        required
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Morgan"
                        className={`mt-2 ${fieldClass}`}
                    />
                </div>

                <div>
                    <label htmlFor="contact-email" className={labelClass}>
                        Email
                    </label>
                    <input
                        id="contact-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@company.com"
                        className={`mt-2 ${fieldClass}`}
                    />
                </div>
            </div>

            <div className="mt-4">
                <label htmlFor="contact-company" className={labelClass}>
                    Company <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                    id="contact-company"
                    name="company"
                    autoComplete="organization"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Northwind Ltd"
                    className={`mt-2 ${fieldClass}`}
                />
            </div>

            <div className="mt-4">
                <label htmlFor="contact-message" className={labelClass}>
                    How can we help?
                </label>
                <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you are trying to do and where you got stuck."
                    className={`mt-2 resize-y ${fieldClass}`}
                />
            </div>

            <button
                type="submit"
                className={`mt-6 w-full sm:w-auto ${buttonClass("primary", "lg")}`}
            >
                <Send className="h-4 w-4" aria-hidden />
                Compose this in your email app
            </button>

            {/*
                The prose lives in ONE span, and that is not tidiness.

                This <p> is display:flex so the icon sits beside the text. In a
                flex container every bare text node becomes its own anonymous
                flex item, and flex items do not wrap or shrink below their
                min-content — so the sentence was three items on one line, one
                of which was the unbreakable "support@conexusx.com". That set a
                354px floor on the whole page and clipped every heading on a
                narrow phone.

                Wrapping the sentence makes it a single shrinkable item;
                break-words lets the address itself break if the address ever
                gets longer or the screen narrower.
            */}
            <p className="mt-4 flex items-start gap-2 text-xs text-muted">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0">
                    This opens a pre-filled draft addressed to{" "}
                    <a
                        href={`mailto:${selected.inbox}`}
                        className="font-semibold break-words text-accent hover:text-accent-hover"
                    >
                        {selected.inbox}
                    </a>
                    . Nothing is sent until you send it yourself.
                </span>
            </p>
        </form>
    );
}
