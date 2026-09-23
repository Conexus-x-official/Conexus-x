"use client";

import { useRef } from "react";

import { useSearchHotkey } from "@/lib/useSearchHotkey";
import { IoIosSearch } from "react-icons/io";

interface SearchBarProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
}

export default function SearchBar({
    value = "",
    onChange,
    placeholder = "Search anything...",
}: SearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Shared, so every search box in the app answers the same key.
    useSearchHotkey(inputRef);

    return (
        <div className="flex w-full max-w-xl items-center font-google-sans">
            <div className="flex h-9 w-full items-center rounded-lg border border-hairline bg-control/40 px-3 transition focus-within:border-foreground focus-within:bg-card focus-within:ring-4 focus-within:ring-foreground/10">
                <IoIosSearch
                    size={16}
                    className="shrink-0 text-muted"
                />

                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    className="ml-2 flex-1 bg-transparent px-1 text-sm text-body outline-none placeholder:text-muted"
                />

                <div className="hidden items-center gap-1 rounded-md border border-hairline bg-card px-2 py-1 sm:flex">
                    <span className="text-[10px] font-medium text-muted">
                        Ctrl
                    </span>

                    <span className="text-[10px] text-muted/50">
                        +
                    </span>

                    <span className="text-[10px] font-medium text-muted">
                        K
                    </span>
                </div>
            </div>
        </div>
    );
}