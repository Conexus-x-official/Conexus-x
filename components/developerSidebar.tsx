"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    HiOutlineKey,
    HiOutlineCircleStack,
} from "react-icons/hi2";
import BackButton from "@/components/ui/buttons/backButton";

const menu = [
    {
        title: "API Key",
        description: "Your global access key",
        icon: HiOutlineKey,
        href: "/developer/api-key",
    },
    {
        title: "Data Console",
        description: "Query your CRM data",
        icon: HiOutlineCircleStack,
        href: "/developer/data-console",
    },
];

export default function DeveloperSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-72 min-h-screen shrink-0 border-r border-slate-200 bg-card px-5 py-7 sticky top-0">
            {/* The way out. This section renders no app sidebar, so without
                it the browser's own arrow was the only exit. History-first:
                whichever page sent the user here is where they want to land,
                and /Home only covers the pasted-link case. */}
            <div className="mb-6 -ml-2">
                <BackButton fallbackHref="/Home" label="Back" showLabel />
            </div>

            <div className="mb-8">
                <h1 className="font-dmsans text-xl font-semibold text-slate-900">
                    Developer
                </h1>

                <p className="mt-1 font-dmsans text-xs text-slate-500">
                    Keys and tools for building on your CRM
                </p>
            </div>

            <nav className="space-y-1">
                {menu.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group flex items-center gap-2.5 rounded-lg px-2 py-2 transition cursor-pointer ${active ? "bg-accent/10" : "hover:bg-gray-200/40"
                                }`}
                        >
                            <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${active
                                    ? "bg-accent text-white"
                                    : "bg-slate-100 text-slate-500 group-hover:text-slate-700"
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                            </span>

                            <span className="min-w-0">
                                <span
                                    className={`block font-dmsans text-sm font-semibold ${active ? "text-accent" : "text-slate-800"
                                        }`}
                                >
                                    {item.title}
                                </span>

                                <span className="block truncate font-dmsans text-[11px] text-slate-400">
                                    {item.description}
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
