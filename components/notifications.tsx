"use client";

import { useEffect, useRef } from "react";

interface Notification {
    id: number;
    title: string;
    message: string;
    time: string;
}

interface NotificationDropdownProps {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    notifications: Notification[];
    onViewAll?: () => void;
}

export default function NotificationDropdown({
    open,
    setOpen,
    notifications,
    onViewAll,
}: NotificationDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(!open)}
                className="relative bg-card w-9.5 h-9.5 flex items-center justify-center rounded-xl cursor-pointer hover:bg-gray-100 transition"
            >
                {/* Bell icon */}
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M13 42C16.5 37.5 18 33 18 27V23C18 15.3 24.3 9 32 9C39.7 9 46 15.3 46 23V27C46 33 47.5 37.5 51 42C52.5 44 51 47 48.5 47H15.5C13 47 11.5 44 13 42Z"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    <path
                        d="M25 52C26.3 55.5 28.7 57 32 57C35.3 57 37.7 55.5 39 52"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                </svg>

                {/* Notification count */}
                {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#8B0E0E] text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                        {notifications.length > 99 ? "99+" : notifications.length}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-1 w-80 bg-card rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.10)] border border-gray-200 overflow-hidden z-10">

                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-sm text-gray-800 font-google-sans">
                            Notifications
                        </h2>

                        {notifications.length > 0 && (
                            <span className="text-[11px] text-gray-400">
                                {notifications.length} new
                            </span>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-10 flex flex-col items-center justify-center">
                                <svg
                                    width="32"
                                    height="32"
                                    viewBox="0 0 64 64"
                                    fill="none"
                                    className="text-gray-400 mb-3"
                                >
                                    <path
                                        d="M13 42C16.5 37.5 18 33 18 27V23C18 15.3 24.3 9 32 9C39.7 9 46 15.3 46 23V27C46 33 47.5 37.5 51 42C52.5 44 51 47 48.5 47H15.5C13 47 11.5 44 13 42Z"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />

                                    <path
                                        d="M25 52C26.3 55.5 28.7 57 32 57C35.3 57 37.7 55.5 39 52"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                </svg>

                                <p className="text-sm text-gray-500">
                                    No notifications
                                </p>
                            </div>
                        ) : (
                            notifications.map((item) => (
                                <button
                                    key={item.id}
                                    className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                                >
                                    <div className="flex gap-3">
                                        <div className="pt-1.5">
                                            <span className="block w-2 h-2 rounded-full bg-[#00CFFF]" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-medium text-sm text-gray-900 truncate">
                                                    {item.title}
                                                </p>

                                                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                    {item.time}
                                                </span>
                                            </div>

                                            <p className="text-xs text-gray-500 mt-1 leading-5 line-clamp-2">
                                                {item.message}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                        <button
                            onClick={onViewAll}
                            className="w-full py-2 rounded-xl bg-[#0D1B2A] text-white text-xs font-medium hover:bg-[#16283d] transition cursor-pointer"
                        >
                            View All
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}