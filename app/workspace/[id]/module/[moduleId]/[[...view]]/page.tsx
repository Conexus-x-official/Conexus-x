"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import {
    useGetCollectionsQuery,
    useCreateCollectionMutation,
    useUpdateCollectionMutation,
    useDeleteCollectionMutation,
    collectionsApi
} from "@/store/api/collections.api";
import {
    useGetColumnsQuery,
    useGetSubColumnsQuery,
    useCreateColumnMutation,
    useUpdateColumnMutation,
    useDeleteColumnMutation,
    columnsApi
} from "@/store/api/columns.api";
import {
    useCreateRecordMutation,
    useCreateSubRecordMutation,
    useUpdateRecordMutation,
    useDeleteRecordMutation
} from "@/store/api/records.api";
import {
    useCreateRecordValueMutation,
    useUpdateRecordValueMutation,
    recordValuesApi
} from "@/store/api/recordValues.api";
import { useGetMembersQuery } from "@/store/api/members.api";
import { useModuleRecords, useSubRecordsFor, refetchRecords } from "@/store/useModuleData";
import { useAutomationRuns } from "@/store/useAutomationRuns";
import { RiCheckLine, RiDeleteBin5Line } from "react-icons/ri";
import { RxDragHandleDots2 } from "react-icons/rx";
import { RiDeleteBin7Fill } from "react-icons/ri";
import { CgMenuGridO, CgRename } from "react-icons/cg";
import { IoAddOutline, IoCopyOutline } from "react-icons/io5";
import { HiOutlinePencil } from "react-icons/hi2";
import { DEFAULT_STATUS_OPTIONS, STATUS_SWATCHES, COLUMN_TYPE_OPTIONS, COLLECTION_COLOR_PALETTE, COUNTRY_DIALING_CODES } from "@/data/data";
import { Button } from "@heroui/react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaChevronDown } from "react-icons/fa";
import { VscFileSubmodule } from "react-icons/vsc";
import { HiOutlinePaperClip, HiOutlineEye, HiOutlineDocumentText, HiOutlineArrowDownTray, HiOutlineXMark, HiCheck, HiOutlineChatBubbleLeftEllipsis } from "react-icons/hi2";
import PersonCell, { PersonAvatar, parsePeopleValue, memberUserId } from "@/components/ui/helpers/personCell";
import RatingCell, { StarRow, parseRating, formatRating } from "@/components/ui/helpers/ratingCell";
import FileUploadModal from "@/components/ui/modals/fileUploadModal";
import ProfileDropdown from "@/components/Profile";
import { logout } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import AiSidebar from "@/components/AiSidebar";
import CreateCollectionModal from "@/components/ui/modals/createCollectionModal";
import RenameColumnModal from "@/components/ui/modals/renameColumnModal";
import AddColumnModal, { type ColumnSettings } from "@/components/ui/modals/addColumnModal";
import RelationCell from "@/components/ui/helpers/relationCell";
import SubRecordTable from "@/components/SubRecordTable";
import AddSubRecordModal from "@/components/ui/modals/addSubRecordModal";
import { ChevronRight, Link2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { MIRROR_TINT, mirrorCellStyle, mirrorHeaderStyle } from "@/lib/mirror";
import { useGetModuleReferencesQuery } from "@/store/api/references.api";
import { useGetModulesQuery } from "@/store/api/modules.api";
import BackButton from "@/components/ui/buttons/backButton";
import SelectedRecordsModal from "@/components/ui/modals/selectedRecordsModal";
import RecordAmendmentsPanel from "@/components/RecordAmendmentsPanel";
import DeleteCollectionModal from "@/components/ui/modals/deleteCollectionModal";
import EditCollectionModal from "@/components/ui/modals/editCollectionModal";
import CollectionMenu from "@/components/ui/menu/collectionMenu";

import type { Collection, RecordItem } from "@/store/types";

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
    const startX = useRef(0);
    const dragging = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragging.current = true;
        startX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const onMouseMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            const delta = ev.clientX - startX.current;
            startX.current = ev.clientX;
            onResize(delta);
        };
        const onMouseUp = () => {
            dragging.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-[#415A77]/40 active:bg-[#415A77]/60 z-20"
            style={{ transform: "translateX(50%)" }}
            title="Drag to resize"
        />
    );
}

// Helper: blend hex with white for subtle row backgrounds
function tint(hex: string, opacity: number) {
    let clean = hex.replace("#", "");
    if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getCollectionColor(collection: Collection, index: number) {
    if (collection.color) return collection.color;
    return COLLECTION_COLOR_PALETTE[index % COLLECTION_COLOR_PALETTE.length];
}

/**
 * Drag image = a tilted snapshot of the row/column the user actually grabbed, so
 * the thing being moved is recognisable while it is in flight. The clone sits in
 * a wrapper because a transform applied to the drag image itself gets clipped out
 * of the browser's snapshot, and it inherits the page classes (and therefore the
 * active theme) because it is appended to <body>.
 */
const setTiltedDragImage = (e: React.DragEvent, source: HTMLElement, accent: string) => {
    if (!e.dataTransfer) return;

    const rect = source.getBoundingClientRect();
    // A full board row can be several thousand px wide; past ~560 the ghost stops
    // being readable and the browser scales it down anyway.
    const width = Math.min(rect.width, 560);

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.top = "-10000px";
    wrapper.style.left = "-10000px";
    wrapper.style.padding = "16px";
    wrapper.style.pointerEvents = "none";
    wrapper.style.zIndex = "999999";

    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.width = `${width}px`;
    clone.style.maxWidth = `${width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.overflow = "hidden";
    clone.style.transform = "rotate(2.5deg)";      // right edge dips, as if lifted
    clone.style.borderRadius = "8px";
    clone.style.border = `2px solid ${accent}`;
    // Fully opaque: the snapshot sits on the card surface of the active theme, so
    // it reads as solid dark on a dark board instead of letting the page bleed
    // through. The lift shadow is a token because black is invisible on dark.
    clone.style.backgroundColor = "var(--card)";
    clone.style.boxShadow = "var(--drag-shadow)";

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setDragImage(wrapper, 28, rect.height / 2);

    setTimeout(() => wrapper.remove(), 0);
};

/**
 * Board order is the user's arrangement, not the order the API replied in.
 * Every collection is created with an explicit position, so ties only happen on
 * legacy rows; `_id` breaks them by creation time and keeps the order stable
 * across refetches.
 */
const byUserOrder = (a: Collection, b: Collection) =>
    (a.position ?? 0) - (b.position ?? 0) || a._id.localeCompare(b._id);

/**
 * Deep links to an open amendments panel.
 *
 * The board lives at an OPTIONAL CATCH-ALL (`[[...view]]/page.tsx`), so
 * /workspace/w/module/m and /workspace/w/module/m/Record/<id> are the SAME page
 * component — opening a panel is a URL change, not a navigation, and the board
 * is never torn down and refetched to show one. A pasted or refreshed deep link
 * still lands on a real route, which is the whole point of being able to copy it.
 */
const RECORD_SEGMENT = "Record";

const moduleBasePath = (workspaceId: string, moduleId: string) =>
    `/workspace/${workspaceId}/module/${moduleId}`;

const recordPath = (workspaceId: string, moduleId: string, recordId: string) =>
    `${moduleBasePath(workspaceId, moduleId)}/${RECORD_SEGMENT}/${recordId}`;

/**
 * The record id in a path, or null.
 *
 * A catch-all matches ANY tail, so the shape is validated rather than trusted:
 * anything that is not `/Record/<24-hex>` is ignored and the board simply opens
 * with no panel. A link to a record that has since been deleted degrades the
 * same way — friendlier than a 404 for something a colleague pasted.
 */
const recordIdFromPath = (pathname: string): string | null => {
    const parts = pathname.split("/").filter(Boolean);
    const at = parts.indexOf(RECORD_SEGMENT);

    if (at === -1) return null;

    const id = parts[at + 1];
    return id && /^[0-9a-f]{24}$/i.test(id) ? id : null;
};

const getRecordCollectionId = (record: any) => {
    if (!record) return "";
    const val = record.collectionName || record.collection || record.group;
    if (typeof val === "object" && val !== null) return val._id || String(val);
    return String(val || "");
};

// 95% Screen File Preview Modal 
interface FilePreviewModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    file: { name: string; url: string; size?: string; type?: string } | null;
    onChangeFile: () => void;
    onRemoveFile: () => void;
}

function FilePreviewModal({ open, setOpen, file, onChangeFile, onRemoveFile }: FilePreviewModalProps) {
    if (!open || !file) return null;

    const isImage = file.url?.startsWith("data:image/") || file.type?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
    const isPdf = file.url?.startsWith("data:application/pdf") || file.type === "application/pdf" || file.name.endsWith(".pdf");

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(false);
    };

    return createPortal(
        <div
            onClick={handleClose}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-[95vw] h-[95vh] bg-card rounded-2xl flex flex-col shadow-2xl overflow-hidden font-dmsans border border-slate-200"
            >
                {/* Header */}
                
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                        {isImage ? (
                            <img src={file.url} alt={file.name} className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0">
                                <HiOutlineDocumentText size={22} />
                            </div>
                        )}
                        <div className="min-w-0">
                            <h3 className="font-semibold text-base truncate text-white">{file.name}</h3>
                            {file.size && <p className="text-xs text-slate-400">{file.size}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={(e) => { e.stopPropagation(); setOpen(false); onChangeFile(); }}
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer border border-slate-700"
                        >
                            <HiOutlinePencil size={14} /> Change File
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemoveFile(); setOpen(false); }}
                            className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer border border-red-500/30"
                        >
                            <RiDeleteBin5Line size={14} /> Remove
                        </button>
                        {file.url && (
                            <a
                                href={file.url}
                                download={file.name}
                                onClick={(e) => e.stopPropagation()}
                                className="px-4 py-1.5 bg-[#FB923C] hover:bg-[#F97316] text-white text-xs rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                <HiOutlineArrowDownTray size={14} /> Download
                            </a>
                        )}
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-2"
                        >
                            <HiOutlineXMark size={22} />
                        </button>
                    </div>
                </div>

                {/* Main preview content */}
                <div className="flex-1 bg-slate-950 flex items-center justify-center p-6 overflow-auto relative">
                    {isImage ? (
                        <img
                            src={file.url}
                            alt={file.name}
                            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-800"
                        />
                    ) : isPdf ? (
                        <iframe
                            src={file.url}
                            className="w-full h-full rounded-xl border border-slate-800 bg-card"
                            title={file.name}
                        />
                    ) : (
                        <div className="text-center p-12 bg-slate-900 rounded-2xl border border-slate-800 max-w-lg">
                            <HiOutlineDocumentText size={64} className="mx-auto text-slate-400 mb-4" />
                            <h4 className="text-lg font-semibold text-white mb-1">{file.name}</h4>
                            <p className="text-xs text-slate-400 mb-6">{file.size || "File attached"}</p>
                            <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FB923C] hover:bg-[#F97316] text-white rounded-xl text-sm font-medium transition cursor-pointer"
                            >
                                <HiOutlineArrowDownTray size={18} /> Download Document
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Record Name Cell (frozen first column) ─────────────────────────────────
const RecordNameCell = ({ record, color, width, selected, onSave, expanded, onToggleExpand, onOpenAmendments }: any) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(record.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setValue(record.name);
    }, [record.name]);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const commit = () => {
        setEditing(false);
        const trimmed = value.trim();
        if (trimmed && trimmed !== record.name) {
            onSave(record, trimmed);
        } else {
            setValue(record.name);
        }
    };

    return (
        <div
            className={`shrink-0 px-3 py-2.5 text-sm font-google-sans flex items-center border-r border-slate-300 gap-2 sticky left-10 z-20 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)] ${selected ? "bg-slate-100" : "bg-card"}`}
            style={{ width, borderLeft: `3px solid ${color}` }}
        >
            <span className="text-xs cursor-grab active:cursor-grabbing shrink-0 text-slate-500"><CgMenuGridO /></span>

            {/* Expand toggle. Always present, never conditional on the count —
                a row with no sub-records is where you add the first one, and a
                control that appears only once it is needed cannot be found. */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(record._id);
                }}
                title={expanded ? "Hide sub-records" : "Show sub-records"}
                className={`shrink-0 flex items-center gap-0.5 rounded px-0.5 py-0.5 transition cursor-pointer hover:bg-slate-200/70 ${expanded ? "text-slate-700" : "text-slate-400"}`}
            >
                <ChevronRight
                    className="h-3.5 w-3.5 transition-transform duration-200"
                    style={{ transform: expanded ? "rotate(90deg)" : "none" }}
                />
                {record.subRecordCount > 0 && (
                    <span className="font-google-sans text-[10px] font-bold tabular-nums">
                        {record.subRecordCount}
                    </span>
                )}
            </button>

            {/* Amendments bubble. Shown on every row for the same reason as the
                expand toggle — an empty record is where the first amendment gets
                written, and a control that only appears once it has content
                cannot be found. The count rides along on the record list. */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenAmendments(record);
                }}
                title={record.amendmentCount ? `${record.amendmentCount} amendment${record.amendmentCount === 1 ? "" : "s"}` : "Write an amendment"}
                className={`shrink-0 flex items-center gap-0.5 rounded px-1 py-0.5 transition cursor-pointer hover:bg-slate-200/70 ${record.amendmentCount ? "text-accent" : "text-slate-400"}`}
            >
                <HiOutlineChatBubbleLeftEllipsis className="h-3.5 w-3.5" />
                {record.amendmentCount > 0 && (
                    <span className="font-google-sans text-[10px] font-bold tabular-nums">
                        {record.amendmentCount}
                    </span>
                )}
            </button>
            {editing ? (
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") { setValue(record.name); setEditing(false); }
                    }}
                    className="w-full bg-transparent border-none outline-none ring-0 text-sm text-slate-800"
                />
            ) : (
                <span onClick={() => setEditing(true)} className="truncate cursor-text w-full text-slate-800 font-medium">
                    {record.name}
                </span>
            )}
        </div>
    );
};

// ── Country Dialing Codes & Flag helper ────────────────────────────────────
function parsePhoneWithFlag(phone: string): { flag: string | null; formattedNumber: string } {
    if (!phone) return { flag: null, formattedNumber: "" };
    const raw = String(phone).trim();
    if (!raw) return { flag: null, formattedNumber: "" };

    const upper = raw.toUpperCase();

    // Sort by longest matching dialing code or iso alias first
    const sorted = COUNTRY_DIALING_CODES.slice().sort((a, b) => {
        const lenA = Math.max(a.code.length, (a.iso || "").length);
        const lenB = Math.max(b.code.length, (b.iso || "").length);
        return lenB - lenA;
    });

    for (const item of sorted) {
        // Match dialing code e.g. "+92"
        if (upper.startsWith(item.code)) {
            const rest = raw.slice(item.code.length).trim();
            return {
                flag: item.flag,
                formattedNumber: rest || raw,
            };
        }

        // Match ISO code alias e.g. "PK" or "US" or "IN"
        if (item.iso) {
            const isoPrefixMatch = new RegExp(`^${item.iso}[\\s\\-:]*(.*)$`, "i").exec(raw);
            if (isoPrefixMatch) {
                const rest = isoPrefixMatch[1]?.trim() || "";
                return {
                    flag: item.flag,
                    formattedNumber: rest || raw,
                };
            }
        }
    }

    return { flag: null, formattedNumber: raw };
}

function TimelinePickerPopover({ open, setOpen, startDate, endDate, onSave }: any) {
    const [start, setStart] = useState(startDate);
    const [end, setEnd] = useState(endDate);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setStart(startDate);
        setEnd(endDate);
    }, [startDate, endDate]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [setOpen]);

    if (!open) return null;

    const handleApply = () => {
        onSave(start, end);
        setOpen(false);
    };

    const handleClear = () => {
        setStart("");
        setEnd("");
        onSave("", "");
        setOpen(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <div ref={ref} className="bg-card border border-slate-200 rounded-xl shadow-2xl p-4 w-72 font-dmsans space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Set Timeline Range</span>
                    <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer">✕</button>
                </div>
                <div className="space-y-2.5">
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-[#415A77] text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">End Date</label>
                        <input
                            type="date"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-[#415A77] text-slate-800"
                        />
                    </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                        onClick={handleApply}
                        className="flex-1 bg-slate-600 hover:bg-slate-700 text-card text-xs py-1.5 rounded font-medium transition cursor-pointer"
                    >
                        Apply Range
                    </button>
                    <button
                        onClick={handleClear}
                        className="flex-1 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs py-1.5 rounded font-medium transition cursor-pointer"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Cell component ─────────────────────────────────────────────────────────
const Cell = ({ record, column, recordValue, onSave, onAddStatusOption, onUpdateStatusOptions, width, workspaceId, references }: any) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(recordValue?.value ?? "");
    const inputRef = useRef<HTMLInputElement>(null);

    const [statusOpen, setStatusOpen] = useState(false);
    const [addingStatus, setAddingStatus] = useState(false);
    const [newStatusLabel, setNewStatusLabel] = useState("");
    const [newStatusColor, setNewStatusColor] = useState(STATUS_SWATCHES[0]);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [editColor, setEditColor] = useState(STATUS_SWATCHES[0]);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedPreviewFile, setSelectedPreviewFile] = useState<any>(null);
    const [showTimelinePicker, setShowTimelinePicker] = useState(false);

    useEffect(() => {
        setValue(recordValue?.value ?? "");
    }, [recordValue?.value]);

    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus();
    }, [editing]);

    useEffect(() => {
        if (!statusOpen) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t)) return;
            if (panelRef.current?.contains(t)) return;
            setStatusOpen(false);
            setAddingStatus(false);
            setEditingIdx(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [statusOpen]);

    const commit = useCallback(() => {
        setEditing(false);
        const trimmed = typeof value === "string" ? value : String(value);
        if (trimmed !== (recordValue?.value ?? "")) {
            onSave(record, column, trimmed, recordValue);
        }
    }, [value, recordValue, record, column, onSave]);

    const selectStatus = (label: string) => {
        setValue(label);
        setStatusOpen(false);
        onSave(record, column, label, recordValue);
    };

    const handleCreateStatus = () => {
        if (!newStatusLabel.trim()) return;
        const opt = { label: newStatusLabel.trim(), color: newStatusColor };
        onAddStatusOption(column, opt);
        selectStatus(opt.label);
        setNewStatusLabel("");
        setAddingStatus(false);
    };

    const handleStartEdit = (idx: number, opt: { label: string; color: string }, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingIdx(idx);
        setEditLabel(opt.label);
        setEditColor(opt.color);
    };

    const handleSaveEdit = (idx: number) => {
        if (!editLabel.trim()) return;
        const existing = column.statusOptions?.length ? column.statusOptions : DEFAULT_STATUS_OPTIONS;
        const updated = existing.map((o: any, i: number) => (i === idx ? { label: editLabel.trim(), color: editColor } : o));
        onUpdateStatusOptions(column, updated);
        if (value === existing[idx]?.label) {
            setValue(editLabel.trim());
            onSave(record, column, editLabel.trim(), recordValue);
        }
        setEditingIdx(null);
    };

    const handleDeleteOption = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const existing = column.statusOptions?.length ? column.statusOptions : DEFAULT_STATUS_OPTIONS;
        const targetLabel = existing[idx]?.label;
        const updated = existing.filter((_: any, i: number) => i !== idx);
        onUpdateStatusOptions(column, updated);
        if (value === targetLabel) {
            setValue("");
            onSave(record, column, "", recordValue);
        }
    };

    if (column.type === "status") {
        const options: { label: string; color: string }[] =
            column.statusOptions?.length ? column.statusOptions : DEFAULT_STATUS_OPTIONS;
        const currentOpt = options.find((o) => o.label === value);

        const openStatusPopover = () => {
            if (btnRef.current) {
                const rect = btnRef.current.getBoundingClientRect();
                setMenuPos({ top: rect.bottom + 6, left: rect.left });
            }
            setStatusOpen((v) => !v);
        };

        return (
            <div
                className="shrink-0 h-10 border-r border-slate-300 flex items-center justify-center p-0 select-none"
                style={{ width, backgroundColor: currentOpt ? currentOpt.color : "#C4C4C4" }}
            >
                <button
                    ref={btnRef}
                    type="button"
                    onClick={openStatusPopover}
                    className="w-full h-full text-xs font-bold text-white flex items-center justify-center px-2 transition cursor-pointer font-dmsans rounded-none border-none outline-none focus:outline-none"
                    style={{
                        color: currentOpt ? "#FFF" : "#4A5568",
                    }}
                >
                    <span className="truncate">{currentOpt ? currentOpt.label : ""}</span>
                </button>

                {statusOpen && menuPos && createPortal(
                    <div
                        ref={panelRef}
                        className="fixed z-50 bg-card border border-slate-200 rounded-lg shadow-2xl p-2 w-56 font-dmsans"
                        style={{ top: menuPos.top, left: menuPos.left }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2 px-1">
                            Select Status
                        </p>

                        <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                            {options.map((opt, idx) => {
                                const isEditingThis = editingIdx === idx;
                                if (isEditingThis) {
                                    return (
                                        <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-200 space-y-2">
                                            <input
                                                value={editLabel}
                                                onChange={(e) => setEditLabel(e.target.value)}
                                                placeholder="Label"
                                                className="w-full text-xs border border-slate-300 rounded px-2 py-1 outline-none text-slate-800"
                                            />
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {STATUS_SWATCHES.map((swatch) => (
                                                    <button
                                                        key={swatch}
                                                        type="button"
                                                        onClick={() => setEditColor(swatch)}
                                                        className="w-4 h-4 rounded-full transition"
                                                        style={{
                                                            backgroundColor: swatch,
                                                            outline: editColor === swatch ? "2px solid #3B82F6" : "none",
                                                            outlineOffset: "1px",
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveEdit(idx)}
                                                    className="flex-1 bg-[#415A77] text-white text-[10px] py-1 rounded hover:bg-[#324760] font-medium"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingIdx(null)}
                                                    className="flex-1 border border-slate-200 text-[10px] py-1 rounded hover:bg-slate-100 text-slate-600 font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                const isSelected = opt.label === value;
                                return (
                                    <div
                                        key={opt.label + idx}
                                        onClick={() => selectStatus(opt.label)}
                                        className={`group/opt flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition text-xs text-white ${isSelected ? "ring-2 ring-[#415A77]" : ""}`}
                                        style={{ backgroundColor: opt.color }}
                                    >
                                        <span className="font-medium truncate flex-1">{opt.label}</span>
                                        {isSelected && <RiCheckLine className="w-3.5 h-3.5 shrink-0 ml-1 text-white" />}

                                        <div className="hidden group-hover/opt:flex items-center gap-1 ml-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => handleStartEdit(idx, opt, e)}
                                                className="p-0.5 rounded hover:bg-black/20 text-white/90"
                                                title="Edit option"
                                            >
                                                <HiOutlinePencil className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteOption(idx, e)}
                                                className="p-0.5 rounded hover:bg-black/20 text-white/90"
                                                title="Delete option"
                                            >
                                                <RiDeleteBin5Line className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!addingStatus ? (
                            <button
                                type="button"
                                onClick={() => setAddingStatus(true)}
                                className="w-full mt-2 border border-dashed border-slate-300 hover:border-[#415A77] rounded text-slate-600 hover:text-[#415A77] text-xs py-1.5 font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                                + Add Status Option
                            </button>
                        ) : (
                            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded space-y-2">
                                <input
                                    value={newStatusLabel}
                                    onChange={(e) => setNewStatusLabel(e.target.value)}
                                    placeholder="New status name"
                                    className="w-full text-xs border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
                                    autoFocus
                                />
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {STATUS_SWATCHES.map((swatch) => (
                                        <button
                                            key={swatch}
                                            type="button"
                                            onClick={() => setNewStatusColor(swatch)}
                                            className="w-4 h-4 rounded-full transition"
                                            style={{
                                                backgroundColor: swatch,
                                                outline: newStatusColor === swatch ? "2px solid #3B82F6" : "none",
                                                outlineOffset: "1px",
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        onClick={handleCreateStatus}
                                        className="flex-1 bg-[#415A77] text-white text-[10px] py-1 rounded hover:bg-[#324760] font-medium"
                                    >
                                        Add
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAddingStatus(false)}
                                        className="flex-1 border border-slate-200 text-[10px] py-1 rounded hover:bg-slate-100 text-slate-600 font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>,
                    document.body
                )}
            </div>
        );
    }

    // File column type
    if (column.type === "file") {
        let fileList: any[] = [];
        if (value) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    fileList = parsed;
                } else if (parsed && typeof parsed === "object") {
                    fileList = [parsed];
                }
            } catch {
                fileList = [{ name: value, url: value }];
            }
        }

        const handleSaveUploadedFiles = (uploadedFiles: any[]) => {
            const valStr = uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : "";
            setValue(valStr);
            onSave(record, column, valStr, recordValue);
        };

        const handleSelectPreviewFile = (e: React.MouseEvent, file: any) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedPreviewFile(file);
            setShowPreviewModal(true);
        };

        return (
            <div
                className="shrink-0 h-10 border-r border-slate-300 flex items-center justify-center px-1.5 font-dmsans relative"
                style={{ width }}
            >
                {fileList.length > 0 ? (
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden py-0.5 px-0.5">
                        {fileList.map((fileObj, idx) => {
                            const isImg = fileObj?.url && (
                                fileObj.url.startsWith("data:image/") ||
                                fileObj.type?.startsWith("image/") ||
                                /\.(jpg|jpeg|png|gif|webp|svg|jfif|bmp|ico)($|\?)/i.test(fileObj.url) ||
                                /\.(jpg|jpeg|png|gif|webp|svg|jfif|bmp|ico)($|\?)/i.test(fileObj.name || "")
                            );

                            return isImg ? (
                                <img
                                    key={idx}
                                    src={fileObj.url}
                                    alt={fileObj.name || `Image ${idx + 1}`}
                                    onClick={(e) => handleSelectPreviewFile(e, fileObj)}
                                    className="h-6 w-6 object-cover rounded-md shadow-sm hover:opacity-85 hover:border-[#415A77] hover:ring-2 hover:ring-[#415A77]/30 transition-all cursor-pointer shrink-0 border border-slate-300"
                                    title={`Click image to preview ${fileObj.name || ""}`}
                                />
                            ) : (
                                <div
                                    key={idx}
                                    onClick={(e) => handleSelectPreviewFile(e, fileObj)}
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-800 font-medium hover:bg-slate-200 transition cursor-pointer shrink-0 max-w-[90px]"
                                    title={`Click file to preview ${fileObj.name}`}
                                >
                                    <HiOutlineDocumentText size={12} className="text-slate-500 shrink-0" />
                                    <span className="truncate max-w-[60px] text-[10px]">{fileObj.name}</span>
                                </div>
                            );
                        })}

                        {/* Explicit + button to manage/add files */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowUploadModal(true);
                            }}
                            className="w-4.5 h-4.5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] transition cursor-pointer shrink-0 ml-0.5 border border-slate-200"
                            title="Add / manage files"
                        >
                            +
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowUploadModal(true);
                        }}
                        className="w-full h-full text-slate-500 hover:text-slate-800 text-xs font-medium transition flex items-center justify-center gap-0.5 cursor-pointer bg-transparent border-none outline-none"
                    >
                        <span className="text-sm font-semibold">+</span> File
                    </button>
                )}

                {showUploadModal && (
                    <FileUploadModal
                        open={showUploadModal}
                        setOpen={setShowUploadModal}
                        currentFiles={fileList}
                        onSaveFiles={handleSaveUploadedFiles}
                        workspaceId={workspaceId || record.workspace}
                        recordId={record._id}
                    />
                )}

                {showPreviewModal && (
                    <FilePreviewModal
                        open={showPreviewModal}
                        setOpen={setShowPreviewModal}
                        file={selectedPreviewFile || fileList[0]}
                        onChangeFile={() => setShowUploadModal(true)}
                        onRemoveFile={() => {
                            const target = selectedPreviewFile || fileList[0];
                            const updated = fileList.filter((f) => f !== target);
                            handleSaveUploadedFiles(updated);
                        }}
                    />
                )}
            </div>
        );
    }

    // People column type — avatar stack + workspace-member picker
    if (column.type === "person" || column.type === "people") {
        return (
            <PersonCell
                record={record}
                column={column}
                recordValue={recordValue}
                width={width}
                workspaceId={workspaceId}
                onSave={onSave}
            />
        );
    }

    // Relation — which records on another module this row points at
    if (column.type === "relation") {
        return (
            <RelationCell
                record={record}
                column={column}
                recordValue={recordValue}
                resolved={references?.[column._id]}
                width={width}
                onSave={onSave}
            />
        );
    }

    /**
     * A column left over from when mirroring was its own type. Still resolved
     * server-side, so it keeps showing its value; new ones are relations.
     */
    if (column.type === "reference") {
        return (
            <div
                className="flex h-10 shrink-0 items-center border-r border-slate-300 px-3 font-dmsans"
                style={{ width, ...mirrorCellStyle }}
                title={references?.[column._id]?.items
                    ?.map((item: { name: string; value: string }) =>
                        `${item.name}: ${item.value || "-"}`)
                    .join(String.fromCharCode(10))}
            >
                <span className="w-full truncate text-xs text-slate-600">
                    {references?.[column._id]?.display ?? ""}
                </span>
            </div>
        );
    }

    // Rating column type — collapsed stars in the cell, large half-star picker on click
    if (column.type === "rating") {
        return (
            <RatingCell
                record={record}
                column={column}
                recordValue={recordValue}
                width={width}
                onSave={onSave}
            />
        );
    }

    // Checkbox column type — a bare green tick, no box chrome
    if (column.type === "checkbox") {
        const isChecked = value === "true" || value === true;
        return (
            <div className="shrink-0 h-10 border-r border-slate-300 flex items-center justify-center px-2" style={{ width }}>
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => {
                        const nVal = isChecked ? "false" : "true";
                        setValue(nVal);
                        onSave(record, column, nVal, recordValue);
                    }}
                    title={isChecked ? "Checked" : "Not checked"}
                    className="group/check flex h-6 w-6 items-center justify-center rounded-md bg-transparent border-none outline-none cursor-pointer transition"
                >
                    <HiCheck
                        size={18}
                        strokeWidth={1}
                        className={`transition ${isChecked
                            ? "text-emerald-500 opacity-100"
                            : "text-slate-400 opacity-0 group-hover/check:opacity-40"
                            }`}
                    />
                </button>
            </div>
        );
    }

    // ── Timeline Column Type (Start Date - End Date timeline bar) ─────────────
    if (column.type === "timeline") {
        let startDate = "";
        let endDate = "";

        if (value) {
            try {
                const parsed = JSON.parse(value);
                startDate = parsed.startDate || "";
                endDate = parsed.endDate || "";
            } catch {
                startDate = value;
                endDate = value;
            }
        }

        const handleSaveTimeline = (sDate: string, eDate: string) => {
            const jsonStr = (sDate || eDate) ? JSON.stringify({ startDate: sDate, endDate: eDate }) : "";
            setValue(jsonStr);
            onSave(record, column, jsonStr, recordValue);
        };

        const formatShortDate = (dStr: string) => {
            if (!dStr) return "";
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return dStr;
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        };

        let progressPercent = 0;
        let dateText = "+ Timeline";

        if (startDate && endDate) {
            const startMs = new Date(startDate).getTime();
            const endMs = new Date(endDate).getTime();
            const todayMs = new Date().getTime();

            if (startMs === endMs) {
                progressPercent = 100;
                dateText = formatShortDate(startDate);
            } else if (endMs > startMs) {
                if (todayMs <= startMs) {
                    progressPercent = 0;
                } else if (todayMs >= endMs) {
                    progressPercent = 100;
                } else {
                    progressPercent = Math.round(((todayMs - startMs) / (endMs - startMs)) * 100);
                }
                dateText = `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
            } else {
                dateText = `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
                progressPercent = 50;
            }
        } else if (startDate || endDate) {
            dateText = formatShortDate(startDate || endDate);
            progressPercent = 100;
        }

        const TOTAL_TICKS = 16;
        const filledTicksCount = Math.round((progressPercent / 100) * TOTAL_TICKS);

        return (
            <div className="shrink-0 h-10 border-r border-slate-300 flex items-center justify-center px-2 font-dmsans relative" style={{ width }}>
                {startDate || endDate ? (
                    <button
                        type="button"
                        onClick={() => setShowTimelinePicker(true)}
                        className="w-full h-7 rounded-lg bg-control hover:bg-control-hover transition flex items-center justify-between px-2 cursor-pointer border border-slate-300 shadow-2xs gap-0.5"
                        title={`${startDate} to ${endDate} (${progressPercent}% elapsed)`}
                    >
                        {/* slate-600 is re-themed per theme, so the filled ticks stay
                            readable in dark instead of going near-black on a dark track. */}
                        {Array.from({ length: TOTAL_TICKS }).map((_, idx) => (
                            <span
                                key={idx}
                                className={`flex-1 h-3.5 rounded-full transition-all duration-300 ${idx < filledTicksCount
                                    ? "bg-slate-600 shadow-2xs"
                                    : "bg-slate-300/70"
                                    }`}
                            />
                        ))}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowTimelinePicker(true)}
                        className="w-full h-full text-slate-500 hover:text-slate-800 text-xs font-medium transition flex items-center justify-center gap-0.5 cursor-pointer bg-transparent border-none outline-none"
                    >
                        <span className="text-sm font-semibold">+</span> Timeline
                    </button>
                )}

                {showTimelinePicker && (
                    <TimelinePickerPopover
                        open={showTimelinePicker}
                        setOpen={setShowTimelinePicker}
                        startDate={startDate}
                        endDate={endDate}
                        onSave={handleSaveTimeline}
                    />
                )}
            </div>
        );
    }

    const { flag, formattedNumber } = parsePhoneWithFlag(value);

    if (editing) {
        return (
            <div
                className="shrink-0 h-10 border-r border-slate-300 flex items-center justify-center bg-slate-50 px-3 gap-1.5"
                style={{ width }}
            >
                {flag && <span className="text-base shrink-0 leading-none select-none" title="Detected country">{flag}</span>}
                <input
                    ref={inputRef}
                    type={
                        column.type === "number"
                            ? "text"
                            : column.type === "date"
                                ? "date"
                                : column.type === "email"
                                    ? "email"
                                    : "text"
                    }
                    value={value}
                    onChange={(e) => {
                        let val = e.target.value;
                        if (column.type === "phone") {
                            val = val.replace(/[^0-9a-zA-Z+\-\s()]/g, "");
                        } else if (column.type === "number") {
                            val = val.replace(/[^0-9.-]/g, "");
                        }
                        setValue(val);
                    }}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") {
                            setValue(recordValue?.value ?? "");
                            setEditing(false);
                        }
                    }}
                    placeholder={column.type === "phone" ? "PK 300 1234567 or +92 300..." : ""}
                    className="w-full h-full text-sm text-slate-800 bg-transparent border-none outline-none ring-0 focus:outline-none font-dmsans text-center"
                />
            </div>
        );
    }

    return (
        <div
            onClick={() => setEditing(true)}
            className="shrink-0 h-10 border-r border-slate-300 flex items-center justify-center px-3 cursor-text text-sm text-slate-800 truncate transition-colors select-none font-dmsans gap-1.5 text-center"
            style={{ width }}
        >
            {flag && <span className="text-base shrink-0 leading-none select-none" title="Detected country">{flag}</span>}
            {recordValue?.value ? (
                <span className="truncate w-full text-center font-dmsans">{flag ? formattedNumber : recordValue.value}</span>
            ) : (
                <span className="text-slate-300 truncate w-full text-center font-dmsans"></span>
            )}
        </div>
    );
};

// ── Column context menu ────────────────────────────────────────────────────
interface ColMenuState {
    columnId: string;
    columnName: string;
    /** Which grid the column belongs to — rename/delete patch different lists. */
    scope: "record" | "subrecord";
    x: number;
    y: number;
}

export default function ModulePage() {
    const params = useParams();
    const router = useRouter();
    const moduleId = params.moduleId as string;
    const workspaceId = params.id as string;

    const dispatch = useAppDispatch();

    // Collection state — served from the shared cache
    const { data: collectionsData = [], isLoading: loading } = useGetCollectionsQuery(moduleId, {
        skip: !moduleId
    });

    // Sorting here (not in the cache) means a record move, a refetch or a
    // partially-applied reorder can never reshuffle the board behind the user.
    const collections = useMemo(
        () => [...collectionsData].sort(byUserOrder),
        [collectionsData]
    );
    const [createCollectionMutation, { isLoading: creating }] = useCreateCollectionMutation();
    const [updateCollectionMutation] = useUpdateCollectionMutation();
    const [deleteCollectionMutation] = useDeleteCollectionMutation();

    const [showCollectionModal, setShowCollectionModal] = useState(false);
    const [collectionName, setCollectionName] = useState("");
    const [selectedCollectionColor, setSelectedCollectionColor] = useState(COLLECTION_COLOR_PALETTE[0]);
    const [collapsedLocal, setCollapsed] = useState<Record<string, boolean>>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem(`collapsed_collections_${moduleId}`);
                return saved ? JSON.parse(saved) : {};
            } catch {
                return {};
            }
        }
        return {};
    });
    const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);

    // Which row / column is currently in flight — only used to fade the original.
    const [draggingRecordId, setDraggingRecordId] = useState<string | null>(null);
    const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);

    // Workspace roster — shared with every person cell through the same cache entry
    const { data: workspaceMembers = [] } = useGetMembersQuery(workspaceId, { skip: !workspaceId });

    /**
     * The board's own name and description, for the header.
     *
     * There is no get-one-module endpoint, and adding one would be the wrong
     * trade here: the Sidebar on this very page already subscribes to
     * getModules(workspaceId), so reading that entry costs no request. Found by
     * id rather than held in state, so a rename made anywhere repaints this
     * header the moment the Module tag invalidates.
     */
    const { data: workspaceModules = [] } = useGetModulesQuery(workspaceId, { skip: !workspaceId });
    const currentModule = workspaceModules.find((m) => m._id === moduleId);

    /**
     * Reference columns hold no value of their own — the server resolves them
     * for the whole board in one request, and a cell write anywhere marks this
     * stale through the RecordValue tag.
     */
    const { data: moduleReferences = {} } = useGetModuleReferencesQuery(moduleId, {
        skip: !moduleId,
        // A mirror is derived from another module's values, which may have been
        // edited on that board since this one was last open. The shared 60s
        // freshness window is wrong for that: always re-resolve on arrival.
        refetchOnMountOrArgChange: true,
    });

    // Column state — served from the shared cache
    const { data: columnsData = [] } = useGetColumnsQuery(moduleId, { skip: !moduleId });
    const columns = columnsData as any[];

    /**
     * Sub-records are shown against their OWN columns, not the board's. One list
     * per module, shared by every expanded row — which is why it is fetched here
     * rather than inside each SubRecordTable.
     */
    const { data: subColumnsData = [] } = useGetSubColumnsQuery(moduleId, { skip: !moduleId });
    const subColumns = subColumnsData as any[];
    const [createColumnMutation, { isLoading: creatingColumn }] = useCreateColumnMutation();
    const [updateColumnMutation] = useUpdateColumnMutation();
    const [deleteColumnMutation] = useDeleteColumnMutation();

    const [showColumnModal, setShowColumnModal] = useState(false);
    const [columnName, setColumnName] = useState("");
    const [columnType, setColumnType] = useState("text");
    // Which grid the Add Column modal is currently filling in.
    const [columnScope, setColumnScope] = useState<"record" | "subrecord">("record");

    // Relation and reference columns need more than a name and a type.
    const [columnSettings, setColumnSettings] = useState<ColumnSettings>({});

    // Column widths (resizable)
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ recordName: 280 });
    const MIN_COL_WIDTH = 90;
    const getColWidth = (id: string, fallback = 160) => columnWidths[id] ?? fallback;
    // Total width of everything right of the sticky Record column: every data
    // column plus the 120px "+ Column" spacer each row ends with.
    const tableTailWidth =
        columns.reduce((total: number, c: { _id: string }) => total + getColWidth(c._id), 0) + 120;

    const resizeColumn = (id: string, delta: number, fallback = 160) => {
        setColumnWidths((prev) => {
            const current = prev[id] ?? fallback;
            return { ...prev, [id]: Math.max(MIN_COL_WIDTH, current + delta) };
        });
    };

    // Column rename/context menu
    const [colMenu, setColMenu] = useState<ColMenuState | null>(null);
    const [renameModal, setRenameModal] = useState<
        { id: string; name: string; scope: "record" | "subrecord" } | null
    >(null);
    const [renameValue, setRenameValue] = useState("");
    const [copied, setCopied] = useState(false);
    const [renamingColumn, setRenamingColumn] = useState(false);
    const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);

    // Record state — records and their cells come from the same cache the
    // collections above use, aggregated across every collection on the board.
    const collectionIds = useMemo(
        () => collections.map((c: Collection) => c._id),
        [collections]
    );
    // The grid reads legacy alias fields (item/group/collection) on these rows;
    // tightening them is the component-extraction pass, not this one.
    const { records, recordValues } = useModuleRecords(collectionIds) as {
        records: any[];
        recordValues: any[];
    };

    // An automation can move a row or rewrite a cell after the write that
    // triggered it has already returned — this announces that and refreshes the
    // board, so nobody has to reload to see what the engine did.
    useAutomationRuns(workspaceId, moduleId);

    const [createRecordMutation, { isLoading: creatingRecord }] = useCreateRecordMutation();
    const [updateRecordMutation] = useUpdateRecordMutation();
    const [deleteRecordMutation] = useDeleteRecordMutation();
    const [createRecordValueMutation] = useCreateRecordValueMutation();
    const [updateRecordValueMutation] = useUpdateRecordValueMutation();

    const [createSubRecordMutation, { isLoading: creatingSubRecord }] =
        useCreateSubRecordMutation();

    // Which record the Add Sub-record modal is adding under, and the name typed
    // into it. Null closes the modal.
    const [subRecordModal, setSubRecordModal] = useState<RecordItem | null>(null);
    const [subRecordName, setSubRecordName] = useState("");

    // Which rows have their sub-records open. Session state on purpose: an
    // expanded row is where you are working right now, not a board setting.
    const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());

    const toggleExpanded = useCallback((recordId: string) => {
        setExpandedRecordIds((prev) => {
            const next = new Set(prev);
            if (next.has(recordId)) next.delete(recordId);
            else next.add(recordId);
            return next;
        });
    }, []);

    /**
     * Which record's amendments panel is open. The ID is held rather than the
     * row itself so a rename or a new amendment re-reads from the live list —
     * a captured object would leave the header showing the old name.
     *
     * Seeded from the URL in a lazy initialiser, not an effect, so a pasted
     * /Record/<id> link opens the panel on the first render with no flash and
     * no setState-in-effect.
     */
    const [amendmentsRecordId, setAmendmentsRecordId] = useState<string | null>(() =>
        typeof window === "undefined" ? null : recordIdFromPath(window.location.pathname)
    );

    /**
     * Sub-records already loaded for the expanded rows. Read-only — each open
     * SubRecordTable owns the subscription — and only so the panel below can
     * resolve a row that lives in one of those blocks rather than in the grid.
     */
    const openSubRecords = useSubRecordsFor(Array.from(expandedRecordIds));

    /**
     * Null until the row arrives, so a cold deep link simply opens the panel
     * once the record it names has loaded. A sub-record resolves the same way,
     * which is what lets one carry amendments at all.
     */
    const amendmentsRecord = amendmentsRecordId
        ? records.find((r) => r._id === amendmentsRecordId) ??
          openSubRecords.find((r) => r._id === amendmentsRecordId) ??
          null
        : null;

    /**
     * Back and Forward have to move the panel with them, since opening one
     * pushed a history entry. Reading location here rather than trusting the
     * event keeps this correct however the entry was reached.
     */
    useEffect(() => {
        const onPopState = () => {
            setAmendmentsRecordId(recordIdFromPath(window.location.pathname));
        };

        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    const openAmendments = useCallback(
        (record: { _id: string }) => {
            setAmendmentsRecordId(record._id);

            // pushState, so Back closes the panel — opening one is a step the
            // user should be able to undo. Next 16 supports the native History
            // API and keeps usePathname in sync with it.
            window.history.pushState(
                null,
                "",
                recordPath(workspaceId, moduleId, record._id)
            );
        },
        [workspaceId, moduleId]
    );

    const closeAmendments = useCallback(() => {
        setAmendmentsRecordId(null);

        // replaceState on the way out, NOT push: stacking a second entry would
        // make Back re-open the panel the user just dismissed.
        window.history.replaceState(null, "", moduleBasePath(workspaceId, moduleId));
    }, [workspaceId, moduleId]);

    const [showRecordModal, setShowRecordModal] = useState(false);
    const [recordName, setRecordName] = useState("");
    const [selectedCollection, setSelectedCollection] = useState("");
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
    const [deletingRecords, setDeletingRecords] = useState(false);

    const [copyingId, setCopyingId] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const [deleteCollectionModal, setDeleteCollectionModal] = useState<string | null>(null);

    // Drag & drop state / refs
    const dragCollectionId = useRef<string | null>(null);
    const dragColumnId = useRef<string | null>(null);
    const dragRecord = useRef<{ id: string; collection: string } | null>(null);
    const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);

    // Scroll container ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // ── Shift + Scroll for horizontal scrolling ─────────────────────────
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.shiftKey) {
                e.preventDefault();
                el.scrollLeft += e.deltaY || e.deltaX;
            }
        };
        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, []);

    // Collection menu & edit states
    const [collectionMenu, setCollectionMenu] = useState<{ collection: Collection; x: number; y: number } | null>(null);
    const [editCollectionModal, setEditCollectionModal] = useState<Collection | null>(null);
    const [updatingCollection, setUpdatingCollection] = useState(false);

    const handleCopyCollectionId = async (collectionId: string): Promise<void> => {
        try {
            setCopyingId(collectionId as any);
            await navigator.clipboard.writeText(collectionId);
            setCopyingId(null);
            setCopiedId(collectionId as any);

            setTimeout(() => {
                setCopiedId(null);
            }, 2000);
        } catch (error) {
            console.error("Failed to copy collection ID:", error);
            setCopyingId(null);
        }
    };

    const updateCollection = async (collectionId: string, name: string, color: string) => {
        try {
            setUpdatingCollection(true);
            await updateCollectionMutation({ collectionId, moduleId, name, color }).unwrap();
            setEditCollectionModal(null);
        } catch (e) {
            console.log(e);
        } finally {
            setUpdatingCollection(false);
        }
    };

    // ── Close context menu on click outside ──────────────────────────────
    useEffect(() => {
        const handler = () => {
            setColMenu(null);
            setCollectionMenu(null);
        };
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, []);

    // Server-persisted collapse flags, overridden by whatever this browser toggled.
    const collapsed = useMemo(() => {
        const fromServer: Record<string, boolean> = {};
        collections.forEach((col: Collection) => {
            if (col.isCollapsed !== undefined) fromServer[col._id] = col.isCollapsed;
        });
        return { ...fromServer, ...collapsedLocal };
    }, [collections, collapsedLocal]);

    const handleCopyColumnId = async (columnId: string): Promise<void> => {
        try {
            setCopyingId(columnId as any);
            await navigator.clipboard.writeText(columnId);
            setCopyingId(null);
            setCopiedId(columnId as any);

            setTimeout(() => {
                setCopiedId(null);
            }, 2000);
        } catch (error) {
            console.error("Failed to copy:", error);
            setCopyingId(null);
        }
    };

    // ── Create Collection ─────────────────────────────────────────────────
    const openCollectionModal = () => {
        setSelectedCollectionColor(COLLECTION_COLOR_PALETTE[collections.length % COLLECTION_COLOR_PALETTE.length]);
        setShowCollectionModal(true);
    };

    const createCollection = async () => {
        if (!collectionName.trim()) return;
        try {
            await createCollectionMutation({
                moduleId,
                name: collectionName,
                color: selectedCollectionColor,
                // Without this the server stores position 0 for every collection,
                // so the board order becomes whatever Mongo returns for the tie.
                position: collections.length,
            }).unwrap();
            setCollectionName("");
            setShowCollectionModal(false);
        } catch (e) { console.log(e); }
    };

    // ── Delete Collection ─────────────────────────────────────────────────
    const deleteCollection = async (collectionId: string) => {
        try {
            setDeletingCollectionId(collectionId);
            // Invalidates Collection:LIST plus the Record:LIST for this collection.
            await deleteCollectionMutation({ collectionId, moduleId }).unwrap();
        } catch (e) {
            console.log(e);
        } finally {
            setDeletingCollectionId(null);
            setDeleteCollectionModal(null);
        }
    };

    // ── Create Column ─────────────────────────────────────────────────────
    const createColumn = async () => {
        if (!columnName.trim()) return;
        try {
            await createColumnMutation({
                moduleId,
                name: columnName,
                type: columnType,
                // Only relation and reference carry configuration; sending an
                // empty object on a text column would just be noise.
                settings: Object.keys(columnSettings).length ? columnSettings : undefined,
                scope: columnScope,
            }).unwrap();
            setColumnName("");
            setColumnType("text");
            setColumnSettings({});
            setColumnScope("record");
            setShowColumnModal(false);
        } catch (e) { console.log(e); }
    };

    // ── Status options: add / edit / delete ────────────────────────────────
    const updateColumnStatusOptions = async (column: any, updated: { label: string; color: string }[]) => {
        // The mutation patches the cache optimistically and rolls back on failure.
        try {
            await updateColumnMutation({
                columnId: column._id,
                moduleId,
                statusOptions: updated,
                // The optimistic patch has to land in the list this column is
                // actually served from.
                scope: column.scope === "subrecord" ? "subrecord" : "record",
            }).unwrap();
        } catch (e) { console.log(e); }
    };

    const addStatusOption = (column: any, option: { label: string; color: string }) => {
        const existing = column.statusOptions?.length ? column.statusOptions : DEFAULT_STATUS_OPTIONS;
        if (existing.some((o: any) => o.label === option.label)) return;
        updateColumnStatusOptions(column, [...existing, option]);
    };

    // ── Rename Column ─────────────────────────────────────────────────────
    const openRenameModal = (col: any) => {
        setColMenu(null);
        setRenameModal({ id: col._id, name: col.name, scope: col.scope ?? "record" });
        setRenameValue(col.name);
        setCopied(false);
    };

    const renameColumn = async () => {
        if (!renameModal || !renameValue.trim()) return;
        try {
            setRenamingColumn(true);
            await updateColumnMutation({
                columnId: renameModal.id,
                moduleId,
                name: renameValue,
                scope: renameModal.scope,
            }).unwrap();
            setRenameModal(null);
        } catch (e) { console.log(e); } finally { setRenamingColumn(false); }
    };

    // ── Delete Column ─────────────────────────────────────────────────────
    const deleteColumn = async (columnId: string, scope: "record" | "subrecord" = "record") => {
        setColMenu(null);
        if (!confirm("Delete this column?")) return;
        try {
            setDeletingColumnId(columnId);
            await deleteColumnMutation({ columnId, moduleId, scope }).unwrap();
            /**
             * The removed cells are gone server-side, so every cached row is now
             * carrying a value for a column that no longer exists. Invalidating
             * the tag TYPE refreshes exactly the rows something is subscribed to
             * — which is the board's rows plus any open sub-record table, and
             * the page cannot name the latter.
             */
            dispatch(recordValuesApi.util.invalidateTags(["RecordValue"]));
        } catch (e) { console.log(e); } finally { setDeletingColumnId(null); }
    };

    /** Resolves true when the value reached the server, false when it did not. */
    const saveRecordValue = async (record: any, column: any, value: any, existingRecordValue: any) => {
        try {
            if (existingRecordValue) {
                // Optimistic: the cache is patched before the request leaves.
                await updateRecordValueMutation({
                    recordValueId: existingRecordValue._id,
                    recordId: record._id,
                    value,
                }).unwrap();
            } else {
                await createRecordValueMutation({
                    recordId: record._id,
                    columnId: column._id,
                    collectionId: record.group || record.collectionName,
                    moduleId: record.module || moduleId,
                    workspaceId: record.workspace,
                    value,
                }).unwrap();
            }

            return true;
        } catch (error) {
            /**
             * This used to be a console.log. A failed write then looked
             * successful — the optimistic patch kept showing the new value until
             * a refresh threw it away, which is exactly how a broken cell hides.
             */
            const message =
                (error as { data?: { message?: string } })?.data?.message ??
                "That change could not be saved.";

            toast.error(message, `${column?.name ?? "Cell"} on ${record?.name ?? "this record"}`);

            // Reported rather than thrown: a cell that does not await this must
            // not produce an unhandled rejection.
            return false;
        }
    };

    // ── Rename Record (inline edit, auto-save) ──────────────────────────────
    const renameRecord = async (record: any, name: string) => {
        try {
            await updateRecordMutation({
                recordId: record._id,
                collectionId: getRecordCollectionId(record),
                name,
            }).unwrap();
        } catch (e) { console.log(e); }
    };

    // ── Sub-records ────────────────────────────────────────────────────────
    /**
     * The three writes a sub-record needs. Each one carries the parent, because
     * a sub-record lives in getSubRecords(parent) rather than in the collection
     * list every other row is patched through.
     */
    const createSubRecord = async () => {
        const parent = subRecordModal;
        const name = subRecordName.trim();
        if (!parent || !name) return;

        try {
            await createSubRecordMutation({
                parentRecordId: parent._id,
                name,
                collectionId: getRecordCollectionId(parent),
                moduleId,
            }).unwrap();
            setSubRecordName("");
            setSubRecordModal(null);
        } catch (error) {
            toast.error(
                (error as { data?: { message?: string } })?.data?.message ??
                "That sub-record could not be created.",
                `Under ${parent?.name ?? "this record"}`
            );
        }
    };

    const renameSubRecord = async (subRecord: any, name: string) => {
        try {
            await updateRecordMutation({
                recordId: subRecord._id,
                collectionId: getRecordCollectionId(subRecord),
                parentRecordId: String(subRecord.parentRecord ?? ""),
                name,
            }).unwrap();
        } catch (e) { console.log(e); }
    };

    const deleteSubRecord = async (subRecord: any) => {
        try {
            await deleteRecordMutation({
                recordId: subRecord._id,
                collectionId: getRecordCollectionId(subRecord),
                parentRecordId: String(subRecord.parentRecord ?? ""),
            }).unwrap();
        } catch (error) {
            toast.error(
                (error as { data?: { message?: string } })?.data?.message ??
                "That sub-record could not be deleted.",
                subRecord?.name
            );
        }
    };

    // ── Create Record ──────────────────────────────────────────────────────
    const createRecord = async () => {
        if (!recordName.trim()) return;
        try {
            await createRecordMutation({
                collectionId: selectedCollection,
                name: recordName,
            }).unwrap();
            setShowRecordModal(false);
            setRecordName("");
        } catch (e) { console.log(e); }
    };

    // ── Delete Records ─────────────────────────────────────────────────────
    const toggleRecordSelected = (recordId: string) => {
        setSelectedRecordIds((prev) => {
            const n = new Set(prev);
            n.has(recordId) ? n.delete(recordId) : n.add(recordId);
            return n;
        });
    };

    const toggleSelectAllInCollection = (collectionId: string) => {
        const ids = records.filter((i) => getRecordCollectionId(i) === collectionId).map((i) => i._id);
        const allSelected = ids.every((id) => selectedRecordIds.has(id));
        setSelectedRecordIds((prev) => {
            const n = new Set(prev);
            ids.forEach((id) => (allSelected ? n.delete(id) : n.add(id)));
            return n;
        });
    };

    const deleteSelectedRecords = async () => {
        if (selectedRecordIds.size === 0) return;
        try {
            setDeletingRecords(true);
            const targets = records.filter((r) => selectedRecordIds.has(r._id));
            await Promise.all(
                targets.map((record) =>
                    deleteRecordMutation({
                        recordId: record._id,
                        collectionId: getRecordCollectionId(record),
                    }).unwrap().catch(console.log)
                )
            );
            setSelectedRecordIds(new Set());
        } catch (e) { console.log(e); } finally { setDeletingRecords(false); }
    };

    // ── Collapse / expand ─────────────────────────────────────────────────
    const toggleCollapsed = (collectionId: string) => {
        setCollapsed((prev) => {
            const isNowCollapsed = !prev[collectionId];
            const next = { ...prev, [collectionId]: isNowCollapsed };
            if (typeof window !== "undefined") {
                try {
                    localStorage.setItem(`collapsed_collections_${moduleId}`, JSON.stringify(next));
                } catch (e) {
                    console.log(e);
                }
            }
            updateCollectionMutation({
                collectionId,
                moduleId,
                isCollapsed: isNowCollapsed,
            }).unwrap().catch(console.log);
            return next;
        });
    };

    // ── Drag & drop: collections ──────────────────────────────────────────
    const handleCollectionDragStart = (e: React.DragEvent, collectionId: string, name: string, color: string) => {
        dragCollectionId.current = collectionId;

        const ghost = document.createElement("div");
        ghost.style.position = "fixed";
        ghost.style.top = "-9999px";
        ghost.style.left = "-9999px";
        ghost.style.display = "inline-flex";
        ghost.style.alignItems = "center";
        ghost.style.gap = "8px";
        ghost.style.padding = "6px 14px";
        ghost.style.backgroundColor = "var(--card)";
        ghost.style.border = `2px solid ${color || "var(--accent)"}`;
        ghost.style.borderRadius = "8px";
        ghost.style.boxShadow = "var(--drag-shadow)";
        ghost.style.fontWeight = "900";
        ghost.style.fontSize = "13px";
        ghost.style.color = color || "var(--foreground)";
        ghost.style.textTransform = "uppercase";
        ghost.style.letterSpacing = "0.05em";
        ghost.style.fontFamily = "system-ui, sans-serif";
        ghost.style.zIndex = "999999";
        ghost.innerHTML = `<span style="color: var(--muted); font-size: 14px;">⋮⋮</span> <span style="color: ${color || "var(--foreground)"}; font-weight: 900;">› ${name}</span>`;

        document.body.appendChild(ghost);

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setDragImage(ghost, 30, 16);
        }

        setTimeout(() => {
            if (document.body.contains(ghost)) {
                document.body.removeChild(ghost);
            }
        }, 0);
    };

    const persistCollectionOrder = async (ordered: Collection[]) => {
        try {
            await Promise.all(
                ordered.flatMap((g, idx) =>
                    g.position === idx
                        ? []
                        : [
                            updateCollectionMutation({
                                collectionId: g._id,
                                moduleId,
                                position: idx,
                            }).unwrap(),
                        ]
                )
            );
        } catch (e) {
            console.log(e);
            // A half-written order would resurface on the next refetch, so pull the
            // list back to what the server actually stored.
            dispatch(
                collectionsApi.endpoints.getCollections.initiate(moduleId, {
                    subscribe: false,
                    forceRefetch: true,
                })
            );
        }
    };

    const handleCollectionDrop = (targetCollectionId: string) => {
        const sourceId = dragCollectionId.current;
        dragCollectionId.current = null;
        if (!sourceId || sourceId === targetCollectionId) return;

        const next = [...collections];
        const from = next.findIndex((g: Collection) => g._id === sourceId);
        const to = next.findIndex((g: Collection) => g._id === targetCollectionId);
        if (from === -1 || to === -1) return;
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);

        // Write the new positions into the cache immediately — the render sorts on
        // position, so patching the array order alone would not move anything.
        const repositioned = next.map((g, idx) => ({ ...g, position: idx }));
        dispatch(
            collectionsApi.util.updateQueryData("getCollections", moduleId, () => repositioned)
        );
        persistCollectionOrder(next);
    };

    // ── Drag & drop: columns ──────────────────────────────────────────────
    const persistColumnOrder = async (ordered: any[]) => {
        await Promise.all(ordered.map((c, idx) =>
            updateColumnMutation({ columnId: c._id, moduleId, position: idx })
                .unwrap()
                .catch(console.log)
        ));
    };

    const handleColumnDrop = (targetColumnId: string) => {
        const sourceId = dragColumnId.current;
        dragColumnId.current = null;
        if (!sourceId || sourceId === targetColumnId) return;

        const next = [...columns];
        const from = next.findIndex((c) => c._id === sourceId);
        const to = next.findIndex((c) => c._id === targetColumnId);
        if (from === -1 || to === -1) return;
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);

        dispatch(columnsApi.util.updateQueryData("getColumns", moduleId, () => next));
        persistColumnOrder(next);
    };

    // ── Drag & drop: records ──────────────────────────────────────────────
    const persistRecordMove = async (
        recordId: string,
        sourceCollectionId: string,
        targetCollectionId: string,
        position: number
    ) => {
        const moved = records.find((r) => r._id === recordId);
        if (!moved) return;

        // Rebuild the target order client-side: dropping onto a row would
        // otherwise hand two records the same position, and the server sorts on it.
        const ordered = records
            .filter(
                (r) => getRecordCollectionId(r) === targetCollectionId && r._id !== recordId
            )
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        ordered.splice(Math.min(Math.max(position, 0), ordered.length), 0, moved);

        try {
            // Siblings first — same-collection writes, so they patch the cache in
            // place without invalidating anything.
            await Promise.all(
                ordered.flatMap((r, index) =>
                    r._id === recordId || r.position === index
                        ? []
                        : [
                            updateRecordMutation({
                                recordId: r._id,
                                collectionId: targetCollectionId,
                                position: index,
                            }).unwrap(),
                        ]
                )
            );

            // The move itself goes last: it writes `collectionName` (the record's
            // collection ref) and invalidates both Record:LIST tags, so the source
            // and target lists refetch once everything is persisted.
            await updateRecordMutation({
                recordId,
                collectionId: sourceCollectionId,
                collectionName: targetCollectionId,
                position: ordered.findIndex((r) => r._id === recordId),
            }).unwrap();
        } catch (e) {
            console.log(e);
            // Nothing persisted reliably — pull both lists back to server truth
            // so the row cannot linger in two collections at once.
            refetchRecords(sourceCollectionId);
            if (targetCollectionId !== sourceCollectionId) refetchRecords(targetCollectionId);
        }
    };

    const handleRecordDropOnRecord = (targetRecord: any) => {
        const source = dragRecord.current;
        dragRecord.current = null;
        setDragOverCollectionId(null);
        if (!source || source.id === targetRecord._id) return;

        const targetCollectionId = getRecordCollectionId(targetRecord);
        const targetSiblings = records
            .filter(
                (i) => getRecordCollectionId(i) === targetCollectionId && i._id !== source.id
            )
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const position = Math.max(
            0,
            targetSiblings.findIndex((i) => i._id === targetRecord._id)
        );

        persistRecordMove(source.id, source.collection, targetCollectionId, position);
    };

    const handleRecordDropOnCollection = (targetCollectionId: string) => {
        const source = dragRecord.current;
        dragRecord.current = null;
        setDragOverCollectionId(null);
        if (!source || source.collection === targetCollectionId) return;

        const position = records.filter(
            (i) => getRecordCollectionId(i) === targetCollectionId
        ).length;

        persistRecordMove(source.id, source.collection, targetCollectionId, position);
    };

    // ── Effects ───────────────────────────────────────────────────────────
    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    return (
        <>
            <section className="flex h-screen overflow-hidden">
                <Sidebar />
                <div className="h-screen w-full bg-canvas flex flex-col overflow-hidden">
                    <div className="bg-card flex-1 flex flex-col overflow-hidden">
                        {/* Page header — the BOARD, not its contents. It used to
                            read "Collections", which named the list below it and
                            left the one thing the header should answer ("which
                            module am I in?") to the sidebar highlight. The list
                            gets its own label further down instead. */}
                        <div className="pl-4 pr-2 flex gap-2 items-center justify-between border-b border-slate-100 shrink-0 bg-card py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                                {/* Up to the workspace, deliberately NOT into
                                    history: this page pushes its own entries
                                    when an amendments panel opens, so back()
                                    would spend the click closing a panel. */}
                                <BackButton
                                    fallbackHref={`/workspace/${workspaceId}`}
                                    label="Back to workspace"
                                    preferHistory={false}
                                />

                                <div className="min-w-0">
                                    {/* No skeleton: the name arrives from a cache
                                        entry the sidebar has usually filled
                                        already, and a flashing placeholder in a
                                        header is worse than a plain fallback. */}
                                    <h2 className="truncate text-lg font-bold font-google-sans text-slate-800">
                                        {currentModule?.name || "Module"}
                                    </h2>

                                    {currentModule?.description && (
                                        <p className="truncate text-xs text-muted font-dmsans">
                                            {currentModule.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <ProfileDropdown onLogout={handleLogout} />
                        </div>

                        {/* Module content */}
                        <div className="pl-8 pt-2 flex-1 flex flex-col overflow-hidden">
                            {/* What the list below IS, now that the header names
                                the module. It sits OUTSIDE the scroll container
                                on purpose — inside, a horizontal scroll would
                                carry the label off to the left away from the
                                collections it labels. Hidden while there is
                                nothing to head: the empty state already says
                                what a collection is, and the skeletons are not
                                a list yet. */}
                            {!loading && collections.length > 0 && (
                                <div className="mb-2 flex shrink-0 items-baseline gap-2 pr-8">
                                    <h3 className="text-sm font-semibold text-slate-700 font-dmsans">
                                        Collections
                                    </h3>
                                    <span className="text-xs text-muted font-dmsans">
                                        {collections.length}
                                    </span>
                                </div>
                            )}

                            {/* Main collections scroll section with single global scrollbar */}
                            <div
                                ref={scrollContainerRef}
                                className="flex-1 overflow-x-auto overflow-y-auto w-full [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-400 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-100 pr-2"
                            >
                                {loading ? (
                                    /* animate-pulse, not .shimmer — .shimmer is a white
                                       gradient and is invisible on light themes (§11.6). */
                                    <div className="mr-8 mt-2 space-y-4">
                                        {[0, 1, 2].map((i) => (
                                            <div
                                                key={i}
                                                className="h-32 rounded-xl bg-control animate-pulse"
                                                style={{ animationDelay: `${i * 120}ms` }}
                                            />
                                        ))}
                                    </div>
                                ) : collections.length === 0 ? (
                                    /* Empty state — all tokens, so it follows the theme
                                       picker instead of assuming a dark board. */
                                    <div className="mr-8 mt-2 rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center font-dmsans">
                                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                            <VscFileSubmodule size={24} />
                                        </div>

                                        <h2 className="text-lg font-semibold text-slate-900">
                                            This module is empty
                                        </h2>

                                        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                                            Collections group your records. Create the first one to
                                            start organizing work.
                                        </p>

                                        <button
                                            onClick={openCollectionModal}
                                            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover cursor-pointer"
                                        >
                                            <IoAddOutline size={17} />
                                            New Collection
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 min-w-max">
                                        {collections.map((collection, collectionIndex) => {
                                            const color = getCollectionColor(collection, collectionIndex);
                                            const collectionRecords = records
                                                .filter(
                                                    (record) => getRecordCollectionId(record) === collection._id
                                                )
                                                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                                            const isCollapsed = !!collapsed[collection._id];
                                            const allSelected =
                                                collectionRecords.length > 0 &&
                                                collectionRecords.every((i) => selectedRecordIds.has(i._id));
                                            const selectedInCollection = collectionRecords.filter((i) =>
                                                selectedRecordIds.has(i._id)
                                            ).length;

                                            return (
                                                <div
                                                    key={collection._id}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={() => handleCollectionDrop(collection._id)}
                                                    className="w-full min-w-max my-4 flex flex-col"
                                                >
                                                    {/* ── Collection header ───────────────────────────────────────
                                                        Outer rail spans the table and pins to the top of the scrollport
                                                        while this collection is in view; the pill inside pins to the left
                                                        edge on horizontal scroll, the same way the Record column does. */}
                                                    <div className="sticky top-0 z-40 mb-2 bg-card py-1">
                                                        <div
                                                            draggable
                                                            onDragStart={(e) => {
                                                                e.stopPropagation();
                                                                handleCollectionDragStart(e, collection._id, collection.name, color);
                                                            }}
                                                            className="sticky left-0 z-10 inline-flex w-fit items-center gap-1.5 select-none rounded-md border bg-card px-2.5 py-1 cursor-grab active:cursor-grabbing"
                                                            style={{ borderColor: color }}
                                                            title="Drag the title to reorder collections"
                                                        >
                                                        {/* Drag handle */}
                                                        <span className="cursor-grab active:cursor-grabbing text-slate-400 text-sm" title="Drag collection">
                                                            <RxDragHandleDots2 />
                                                        </span>

                                                        {/* Collapse toggle */}
                                                        <button
                                                            onClick={() => toggleCollapsed(collection._id)}
                                                            className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 cursor-pointer rounded transition flex-shrink-0"
                                                        >
                                                            <FaChevronDown
                                                                className="text-xs transition-transform duration-200"
                                                                style={{
                                                                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                                                                    color
                                                                }}
                                                            />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setCollectionMenu({
                                                                    collection,
                                                                    x: rect.left,
                                                                    y: rect.bottom + 6,
                                                                });
                                                            }}
                                                            className="text-sm font-bold font-google-sans uppercase tracking-wide cursor-pointer hover:opacity-80 transition flex items-center gap-1.5"
                                                            style={{ color }}
                                                            title="Click for collection options"
                                                        >
                                                            <span>{collection.name}</span>
                                                        </button>
                                                        </div>
                                                    </div>

                                                    {/* ── Collection table ─────────────────────────── */}
                                                    {!isCollapsed && (
                                                        <div
                                                            className="w-fit min-w-max rounded-lg flex flex-col"
                                                            onDragOver={(e) => {
                                                                e.preventDefault();
                                                                setDragOverCollectionId(collection._id);
                                                            }}
                                                            onDragLeave={() => setDragOverCollectionId(null)}
                                                            onDrop={(e) => {
                                                                e.stopPropagation();
                                                                handleRecordDropOnCollection(collection._id);
                                                            }}
                                                            style={{
                                                                outline: dragOverCollectionId === collection._id ? `2px solid ${color}33` : "none",
                                                            }}
                                                        >
                                                            {/* Header row */}
                                                            <div className="flex items-stretch min-w-max border-b border-slate-300 bg-card rounded-t-lg">
                                                                {/* Checkbox */}
                                                                <div className="flex items-center justify-center  w-10 sticky  left-0 z-30 bg-card ">
                                                                    <div className=" shrink-0 w-full h-full cursor-pointer border-l border-t border-slate-300  rounded-tl-lg flex items-center justify-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={allSelected}
                                                                            onChange={() => toggleSelectAllInCollection(collection._id)}
                                                                            className="w-3.5 h-3.5 accent-[#415A77] cursor-pointer"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Record label — sticky, resizable */}
                                                                <div
                                                                    className="relative shrink-0 px-3 py-3 text-xs font-semibold text-slate-500 tracking-wider flex items-center sticky left-10 z-30 font-google-sans bg-card shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)] border-t border-r border-slate-300"
                                                                    style={{ width: getColWidth("recordName", 280), borderLeft: `3px solid ${color}`, }}
                                                                >
                                                                    Record
                                                                    <ResizeHandle onResize={(d) => resizeColumn("recordName", d, 280)} />
                                                                </div>

                                                                {/* Column headers */}
                                                                {columns.map((column) => (
                                                                    <div
                                                                        key={column._id}
                                                                        draggable
                                                                        onDragStart={(e) => {
                                                                            // Without this the collection header's own dragstart also
                                                                            // fires and the board reorders collections instead.
                                                                            e.stopPropagation();
                                                                            dragColumnId.current = column._id;
                                                                            setDraggingColumnId(column._id);
                                                                            setTiltedDragImage(e, e.currentTarget, "var(--accent)");
                                                                        }}
                                                                        onDragEnd={() => setDraggingColumnId(null)}
                                                                        onDragOver={(e) => e.preventDefault()}
                                                                        onDrop={(e) => {
                                                                            e.stopPropagation();
                                                                            handleColumnDrop(column._id);
                                                                        }}
                                                                        onContextMenu={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setColMenu({ columnId: column._id, columnName: column.name, scope: "record", x: e.clientX, y: e.clientY });
                                                                        }}
                                                                        className={`relative shrink-0 px-3 py-2.5 border-t border-r border-slate-300 tracking-wider font-google-sans flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing bg-card transition select-none text-[13px] ${draggingColumnId === column._id ? "opacity-40 ring-2 ring-accent ring-inset" : ""}`}
                                                                        style={{
                                                                            width: getColWidth(column._id),
                                                                            // A mirrored column is tinted end to end, so the
                                                                            // header explains the tint on every row below it.
                                                                            ...(column.settings?.displayField ? mirrorHeaderStyle : {}),
                                                                        }}
                                                                        title={
                                                                            column.settings?.displayField
                                                                                ? "Mirrored from another module — read-only"
                                                                                : "Right-click to rename / delete"
                                                                        }
                                                                    >
                                                                        {deletingColumnId === column._id ? (
                                                                            <span className="text-red-300">…</span>
                                                                        ) : (
                                                                            <>
                                                                                {column.settings?.displayField && (
                                                                                    <Link2
                                                                                        className="h-3 w-3 shrink-0"
                                                                                        style={{ color: MIRROR_TINT }}
                                                                                    />
                                                                                )}
                                                                                <span className="truncate">{column.name}</span>
                                                                            </>
                                                                        )}
                                                                        <ResizeHandle onResize={(d) => resizeColumn(column._id, d)} />
                                                                    </div>
                                                                ))}

                                                                {/* Add column button at end */}
                                                                <div className="w-[120px] shrink-0 px-3 py-2.5 flex items-center justify-center border-t border-slate-300 bg-card">
                                                                    <button
                                                                        onClick={() => {
                                                                            setColumnScope("record");
                                                                            setShowColumnModal(true);
                                                                        }}
                                                                        className="text-xs text-zinc-500 font-google-sans font-bold transition whitespace-nowrap cursor-pointer"
                                                                    >
                                                                        + Column
                                                                    </button>
                                                                </div>

                                                                {/* Takes up whatever the widest row in this collection leaves
                                                                    over, so the button keeps its own size instead of being
                                                                    stretched across the slack. */}
                                                                <div className="grow border-t border-r border-slate-300 rounded-tr-lg bg-card" />
                                                            </div>

                                                            {/* Record rows */}
                                                            {collectionRecords.map((record) => (
                                                                <div key={record._id} className="flex flex-col">
                                                                <div
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        // Stops the collection header's dragstart from also arming a
                                                                        // collection reorder — that is what made the collections jump.
                                                                        e.stopPropagation();
                                                                        dragRecord.current = {
                                                                            id: record._id,
                                                                            collection: getRecordCollectionId(record),
                                                                        };
                                                                        setDraggingRecordId(record._id);
                                                                        setTiltedDragImage(e, e.currentTarget, color);
                                                                    }}
                                                                    onDragEnd={() => setDraggingRecordId(null)}
                                                                    onDragOver={(e) => e.preventDefault()}
                                                                    onDrop={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRecordDropOnRecord(record);
                                                                    }}
                                                                    className={`flex items-stretch min-w-max border-b border-slate-300 group transition-colors ${selectedRecordIds.has(record._id) ? "bg-slate-100/60" : "hover:bg-zinc-600/5"} ${draggingRecordId === record._id ? "opacity-40" : ""}`}
                                                                >
                                                                    {/* Checkbox */}
                                                                    <div className={`flex items-center justify-center w-10 sticky left-0 z-20  ${selectedRecordIds.has(record._id) ? "bg-slate-100" : "bg-card"}`}>
                                                                        <div className="shrink-0 w-full h-full flex items-center justify-center p-2 border-l border-slate-300">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedRecordIds.has(record._id)}
                                                                                onChange={() => toggleRecordSelected(record._id)}
                                                                                className="w-3.5 h-3.5 accent-[#415A77] cursor-pointer font-dmsans"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Record name — sticky, click-to-edit, auto-saves on blur */}
                                                                    <RecordNameCell
                                                                        record={record}
                                                                        color={color}
                                                                        width={getColWidth("recordName", 280)}
                                                                        selected={selectedRecordIds.has(record._id)}
                                                                        onSave={renameRecord}
                                                                        expanded={expandedRecordIds.has(record._id)}
                                                                        onToggleExpand={toggleExpanded}
                                                                        onOpenAmendments={openAmendments}
                                                                    />

                                                                    {/* Cells */}
                                                                    {columns.map((column) => {
                                                                        const rv = recordValues.find(
                                                                            (v) => (v.record || v.item) === record._id && (v.column?._id || v.column) === column._id
                                                                        );
                                                                        return (
                                                                            <Cell
                                                                                key={column._id}
                                                                                record={record}
                                                                                column={column}
                                                                                recordValue={rv}
                                                                                width={getColWidth(column._id)}
                                                                                workspaceId={workspaceId}
                                                                                references={moduleReferences[record._id]}
                                                                                onSave={saveRecordValue}
                                                                                onAddStatusOption={addStatusOption}
                                                                                onUpdateStatusOptions={updateColumnStatusOptions}
                                                                            />
                                                                        );
                                                                    })}

                                                                    {/* Trailing spacer. Grows rather than sitting at a fixed
                                                                        120px: a sub-record grid with MORE columns than the
                                                                        board makes the collection wider than this row, and a
                                                                        fixed tail left the row ending in mid-air. */}
                                                                    <div className="min-w-[120px] grow border-r border-slate-300" />
                                                                </div>

                                                                {/* Sub-records — its own grid, its own columns, mounted
                                                                    only while the row is open so nothing is fetched for
                                                                    a collapsed one. */}
                                                                {expandedRecordIds.has(record._id) && (
                                                                    <SubRecordTable
                                                                        record={record}
                                                                        color={color}
                                                                        nameWidth={getColWidth("recordName", 280)}
                                                                        columns={subColumns}
                                                                        getColWidth={getColWidth}
                                                                        onAddColumn={() => {
                                                                            setColumnScope("subrecord");
                                                                            setShowColumnModal(true);
                                                                        }}
                                                                        onColumnMenu={(e, column) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setColMenu({
                                                                                columnId: column._id,
                                                                                columnName: column.name,
                                                                                scope: "subrecord",
                                                                                x: e.clientX,
                                                                                y: e.clientY,
                                                                            });
                                                                        }}
                                                                        onRename={renameSubRecord}
                                                                        onDelete={deleteSubRecord}
                                                                        onRequestAdd={() => {
                                                                            setSubRecordName("");
                                                                            setSubRecordModal(record);
                                                                        }}
                                                                        onResizeColumn={resizeColumn}
                                                                        onOpenAmendments={openAmendments}
                                                                        renderCell={({ subRecord, column, recordValue, width }) => (
                                                                            <Cell
                                                                                record={subRecord}
                                                                                column={column}
                                                                                recordValue={recordValue}
                                                                                width={width}
                                                                                workspaceId={workspaceId}
                                                                                references={moduleReferences[subRecord._id]}
                                                                                onSave={saveRecordValue}
                                                                                onAddStatusOption={addStatusOption}
                                                                                onUpdateStatusOptions={updateColumnStatusOptions}
                                                                            />
                                                                        )}
                                                                    />
                                                                )}
                                                            </div>
                                                            ))}

                                                            {/* Add record row */}
                                                            <div className="flex items-stretch min-w-max bg-card">
                                                                {/* Checkbox spacer */}
                                                                <div className="flex items-center justify-center w-10 sticky left-0 z-10 bg-card">
                                                                    <div className="shrink-0 w-full h-full rounded-bl-xl border-l border-b border-slate-300 flex items-center justify-center p-2 bg-card" />
                                                                </div>

                                                                {/* Sticky Record cell matching Record column width */}
                                                                <div
                                                                    className="shrink-0 px-2 py-1.5  border-b border-slate-300 text-sm font-google-sans flex items-center sticky left-10 z-10 bg-card "
                                                                    style={{ width: getColWidth("recordName", 280), borderLeft: `3px solid ${color}` }}
                                                                >
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedCollection(collection._id);
                                                                            setShowRecordModal(true);
                                                                        }}
                                                                        className="text-sm flex items-center gap-1.5 transition py-1 px-2 cursor-pointer group"
                                                                    >
                                                                        <IoAddOutline size={18} className="text-zinc-500 group-hover:text-foreground transition-colors duration-200" />
                                                                        <span className="font-google-sans text-zinc-600 font-semibold text-xs group-hover:text-foreground transition-colors duration-200">Add Record</span>
                                                                    </button>
                                                                </div>

                                                                {/* Filler sized to the real columns + the trailing spacer, so this row
                                                                    ends exactly where every other row does instead of stretching
                                                                    across the whole scroll container. */}
                                                                <div
                                                                    className="grow bg-card border-b border-r border-slate-300"
                                                                    style={{ minWidth: tableTailWidth }}
                                                                />
                                                            </div>

                                                            {/* ── Collection Column Summary / Calculations Footer Row ── */}
                                                            <div className="flex items-stretch min-w-max bg-card rounded-b-lg text-xs text-slate-500 font-google-sans h-9">
                                                                {/* Checkbox spacer */}
                                                                <div className="flex items-center justify-center w-10 sticky left-0 z-10 bg-card">
                                                                    <div className="shrink-0 w-full h-full  border-slate-300 flex items-center justify-center bg-card" />
                                                                </div>

                                                                {/* Record column count summary */}
                                                                <div
                                                                    className="sticky left-10 z-10 bg-card border-r border-slate-300 "
                                                                >
                                                                    <div
                                                                        className="shrink-0 px-3 h-full flex items-center border-b rounded-bl-xl  border-slate-300 justify-end text-right font-medium text-[11px] text-slate-400"
                                                                        style={{
                                                                            width: getColWidth("recordName", 280),
                                                                            borderLeft: `3px solid ${color}`
                                                                        }}
                                                                    >
                                                                        <span style={{ color }}>
                                                                            {collectionRecords.length}{" "}
                                                                            {collectionRecords.length === 1 ? "record" : "records"}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Dynamic Column Summaries */}
                                                                {columns.map((column) => {
                                                                    // Find all record values for this column in this collection
                                                                    const colRecordIds = new Set(collectionRecords.map((r) => r._id));
                                                                    const colValues = recordValues.filter(
                                                                        (v) => colRecordIds.has(v.record || v.item) && (v.column?._id || v.column) === column._id
                                                                    );

                                                                    if (column.type === "status") {
                                                                        // Calculate status breakdown counts & proportions
                                                                        const statusCounts: { [label: string]: { count: number; color: string } } = {};
                                                                        let totalStatusCount = 0;

                                                                        colValues.forEach((v) => {
                                                                            const label = typeof v.value === "string" ? v.value : v.value?.label;
                                                                            if (label && typeof label === "string") {
                                                                                const matchedOption = column.options?.find((opt: any) => opt.label === label);
                                                                                const optColor = matchedOption?.color || "#94A3B8";
                                                                                if (!statusCounts[label]) {
                                                                                    statusCounts[label] = { count: 0, color: optColor };
                                                                                }
                                                                                statusCounts[label].count += 1;
                                                                                totalStatusCount += 1;
                                                                            }
                                                                        });

                                                                        const statusEntries = Object.entries(statusCounts);

                                                                        return (
                                                                            <div
                                                                                key={column._id}
                                                                                className="shrink-0 px-2 flex flex-col justify-center items-center border-b border-r border-slate-300 bg-card h-full"
                                                                                style={{ width: getColWidth(column._id) }}
                                                                            >
                                                                                {totalStatusCount > 0 ? (
                                                                                    <div className="w-full flex flex-col items-center gap-0.5 px-1">
                                                                                        <div
                                                                                            className="w-full h-3 rounded-sm overflow-hidden flex bg-slate-100 shadow-inner cursor-pointer"
                                                                                            title={statusEntries.map(([l, data]) => `${l}: ${data.count}`).join(", ")}
                                                                                        >
                                                                                            {statusEntries.map(([label, data]) => {
                                                                                                const pct = (data.count / totalStatusCount) * 100;
                                                                                                return (
                                                                                                    <div
                                                                                                        key={label}
                                                                                                        style={{ width: `${pct}%`, backgroundColor: data.color }}
                                                                                                        className="h-full transition-all"
                                                                                                        title={`${label}: ${data.count} (${Math.round(pct)}%)`}
                                                                                                    />
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                                                            {totalStatusCount} / {collectionRecords.length}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-slate-300 font-medium">-</span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    if (column.type === "number") {
                                                                        let numericSum = 0;
                                                                        let hasNumber = false;
                                                                        colValues.forEach((v) => {
                                                                            const num = parseFloat(v.value);
                                                                            if (!isNaN(num)) {
                                                                                numericSum += num;
                                                                                hasNumber = true;
                                                                            }
                                                                        });

                                                                        return (
                                                                            <div
                                                                                key={column._id}
                                                                                className="shrink-0 px-2 flex flex-col justify-center items-center border-b border-r border-slate-300 bg-card h-full"
                                                                                style={{ width: getColWidth(column._id) }}
                                                                            >
                                                                                {hasNumber ? (
                                                                                    <div className="text-center leading-tight">
                                                                                        <span className="font-semibold text-[11px] text-slate-700">{numericSum}</span>
                                                                                        <span className="text-[9px] text-slate-400 block font-normal -mt-0.5">sum</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-slate-300 font-medium">-</span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    if (column.type === "rating") {
                                                                        let totalRating = 0;
                                                                        let ratingCount = 0;
                                                                        colValues.forEach((v) => {
                                                                            const num = parseRating(v.value);
                                                                            if (num > 0) {
                                                                                totalRating += num;
                                                                                ratingCount += 1;
                                                                            }
                                                                        });
                                                                        const avg = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null;

                                                                        return (
                                                                            <div
                                                                                key={column._id}
                                                                                className="shrink-0 px-2 flex flex-col justify-center items-center border-b border-r border-slate-300 bg-card h-full"
                                                                                style={{ width: getColWidth(column._id) }}
                                                                            >
                                                                                {avg ? (
                                                                                    <div className="text-center leading-tight">
                                                                                        <span className="flex items-center justify-center gap-1">
                                                                                            <StarRow value={parseFloat(avg)} size={11} />
                                                                                            <span className="font-semibold text-[11px] text-amber-500 tabular-nums">{formatRating(parseFloat(avg))}</span>
                                                                                        </span>
                                                                                        <span className="text-[9px] text-slate-400 block font-normal -mt-0.5">avg</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-slate-300 font-medium">-</span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    if (column.type === "person" || column.type === "people") {
                                                                        const assignedIds = new Set<string>();
                                                                        colValues.forEach((v) => {
                                                                            parsePeopleValue(v.value).forEach((id) => assignedIds.add(id));
                                                                        });
                                                                        const assigned = [...assignedIds]
                                                                            .map((id) => workspaceMembers.find((m) => memberUserId(m) === id))
                                                                            .filter((m): m is (typeof workspaceMembers)[number] => Boolean(m));

                                                                        return (
                                                                            <div
                                                                                key={column._id}
                                                                                className="shrink-0 px-2 flex flex-col justify-center items-center border-b border-r border-slate-300 bg-card h-full"
                                                                                style={{ width: getColWidth(column._id) }}
                                                                            >
                                                                                {assigned.length > 0 ? (
                                                                                    <div className="flex items-center -space-x-1.5">
                                                                                        {assigned.slice(0, 4).map((m) => (
                                                                                            <PersonAvatar key={memberUserId(m)} member={m} size={18} />
                                                                                        ))}
                                                                                        {assigned.length > 4 && (
                                                                                            <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-control text-[8px] font-semibold text-muted ring-2 ring-card">
                                                                                                +{assigned.length - 4}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-slate-300 font-medium">-</span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Default for text / file / date / etc.
                                                                    const filledCount = colValues.filter((v) => v.value !== null && v.value !== undefined && v.value !== "").length;

                                                                    return (
                                                                        <div
                                                                            key={column._id}
                                                                            className="shrink-0 px-2 flex flex-col justify-center items-center border-b border-r border-slate-300 bg-card h-full"
                                                                            style={{ width: getColWidth(column._id) }}
                                                                        >
                                                                            {filledCount > 0 ? (
                                                                                <div className="text-center leading-tight">
                                                                                    <span className="font-medium text-[10px] text-slate-500">{filledCount} filled</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-[10px] text-slate-300 font-medium">-</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}

                                                                {/* Trailing column spacer */}
                                                                <div className="min-w-[120px] grow border-b border-r border-slate-300 rounded-br-lg bg-card" />
                                                            </div>


                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* New Collection button (sticky left pill at bottom of collections) */}
                                        <div className="pt-2 pb-6 sticky left-0 z-30 w-fit">
                                            <button
                                                onClick={openCollectionModal}
                                                className="bg-card text-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition cursor-pointer font-dmsans flex items-center gap-2 border border-slate-300 shadow-sm"
                                            >
                                                <IoAddOutline size={18} className="text-slate-600" />
                                                <span className="font-semibold text-slate-700">New Collection</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Column context menu */}
                    {colMenu && (
                        <div
                            className="fixed border border-slate-300 rounded bg-card shadow-xl z-50 min-w-[180px]"
                            style={{ top: colMenu.y, left: colMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-4 py-2 text-xs font-google-sans text-zinc-600 border-b border-slate-300 cursor-pointer">
                                {colMenu.scope === "subrecord" ? "Sub-record column" : "Column"}:{" "}
                                <span className="font-bold">{colMenu.columnName}</span>
                            </div>
                            <button
                                onClick={() => handleCopyColumnId(colMenu.columnId)}
                                disabled={copyingId === colMenu.columnId}
                                className="w-full text-left px-4 py-2 text-sm font-google-sans text-zinc-600 hover:bg-zinc-200 transition flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {copyingId === colMenu.columnId ? (
                                    <AiOutlineLoading3Quarters className="w-4 h-4 animate-spin" />
                                ) : copiedId === colMenu.columnId ? (
                                    <RiCheckLine className="w-4 h-4 text-green-600" />
                                ) : (
                                    <IoCopyOutline className="w-4 h-4" />
                                )}

                                {copyingId === colMenu.columnId
                                    ? "Copying..."
                                    : copiedId === colMenu.columnId
                                        ? "Copied"
                                        : "Copy Column ID"}
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-sm font-google-sans text-zinc-600 hover:bg-zinc-200 transition flex items-center gap-2 cursor-pointer"
                                onClick={() => openRenameModal({ _id: colMenu.columnId, name: colMenu.columnName, scope: colMenu.scope })}
                            >
                                <CgRename className="w-4 h-4" /> Rename column
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 text-sm font-google-sans text-zinc-600 hover:bg-zinc-200 transition flex items-center gap-2 cursor-pointer"
                                onClick={() => deleteColumn(colMenu.columnId, colMenu.scope)}
                            >
                                <RiDeleteBin5Line className="w-4 h-4" /> Delete column
                            </button>
                        </div>
                    )}

                    {/* Rename Column Modal */}
                    {renameModal && (
                        <RenameColumnModal
                            renameModal={renameModal}
                            setRenameModal={setRenameModal}
                            renameValue={renameValue}
                            setRenameValue={setRenameValue}
                            renamingColumn={renamingColumn}
                            renameColumn={renameColumn}
                            copied={copied}
                            setCopied={setCopied}
                        />
                    )}

                    {/* Create Collection Modal */}
                    {showCollectionModal && (
                        <CreateCollectionModal
                            open={showCollectionModal}
                            setOpen={setShowCollectionModal}
                            groupName={collectionName}
                            setGroupName={setCollectionName}
                            selectedGroupColor={selectedCollectionColor}
                            setSelectedGroupColor={setSelectedCollectionColor}
                            collectionColorPalette={COLLECTION_COLOR_PALETTE}
                            creating={creating}
                            createGroup={createCollection}
                        />
                    )}

                    {/* Create Column Modal */}
                    {showColumnModal && (
                        <AddColumnModal
                            open={showColumnModal}
                            setOpen={(open: boolean) => {
                                setShowColumnModal(open);
                                if (!open) setColumnScope("record");
                            }}
                            scope={columnScope}
                            workspaceId={workspaceId}
                            moduleId={moduleId}
                            settings={columnSettings}
                            setSettings={setColumnSettings}
                            columnName={columnName}
                            setColumnName={setColumnName}
                            columnType={columnType}
                            setColumnType={setColumnType}
                            creatingColumn={creatingColumn}
                            createColumn={createColumn}
                            defaultStatusOptions={DEFAULT_STATUS_OPTIONS}
                        />
                    )}

                    {/* Create Record Modal */}
                    {showRecordModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-5">
                            <div className="bg-[#0D1B2A] rounded-xl p-6 w-full max-w-md shadow-2xl">
                                <h2 className="text-lg font-bold text-white mb-4 font-dmsans">Add Record</h2>

                                <label className="text-xs font-medium text-white mb-1.5 block font-dmsans">
                                    Record name
                                </label>
                                <input
                                    value={recordName}
                                    onChange={(e) => setRecordName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && createRecord()}
                                    placeholder="Record Name"
                                    autoFocus
                                    className="w-full text-white border font-dmsans border-slate-700 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-[#415A77] transition"
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={createRecord}
                                        disabled={creatingRecord}
                                        className="flex-1 bg-card text-foreground py-2.5 rounded text-sm font-medium hover:bg-gray-100 transition cursor-pointer disabled:opacity-60 font-dmsans"
                                    >
                                        {creatingRecord ? "Creating…" : "Add Record"}
                                    </button>
                                    <button
                                        onClick={() => setShowRecordModal(false)}
                                        className="flex-1 bg-slate-700 border border-slate-700 py-2.5 rounded text-sm text-white hover:bg-slate-700 transition cursor-pointer font-dmsans"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add Sub-record Modal */}
                    {subRecordModal && (
                        <AddSubRecordModal
                            open={!!subRecordModal}
                            setOpen={(open) => !open && setSubRecordModal(null)}
                            parentName={subRecordModal.name}
                            subRecordName={subRecordName}
                            setSubRecordName={setSubRecordName}
                            creating={creatingSubRecord}
                            createSubRecord={createSubRecord}
                        />
                    )}

                    {/* Collection Menu Dropdown */}
                    {collectionMenu && (
                        <CollectionMenu
                            x={collectionMenu.x}
                            y={collectionMenu.y}
                            collection={collectionMenu.collection}
                            copyingId={copyingId}
                            copiedId={copiedId}
                            handleCopyCollectionId={handleCopyCollectionId}
                            openEditModal={(col) => {
                                setCollectionMenu(null);
                                setEditCollectionModal(col);
                            }}
                            openDeleteModal={(id) => {
                                setCollectionMenu(null);
                                setDeleteCollectionModal(id);
                            }}
                        />
                    )}

                    {/* Edit Collection Modal */}
                    {editCollectionModal && (
                        <EditCollectionModal
                            open={!!editCollectionModal}
                            setOpen={(open) => !open && setEditCollectionModal(null)}
                            collection={editCollectionModal}
                            collectionColorPalette={COLLECTION_COLOR_PALETTE}
                            updating={updatingCollection}
                            updateCollection={updateCollection}
                        />
                    )}

                    {/* Delete Collection Modal */}
                    {deleteCollectionModal && (
                        <DeleteCollectionModal
                            open={!!deleteCollectionModal}
                            setOpen={(open) => !open && setDeleteCollectionModal(null)}
                            collectionId={deleteCollectionModal}
                            deletingCollectionId={deletingCollectionId}
                            deleteCollection={deleteCollection}
                        />
                    )}

                    {/* Floating Selected Records Modal */}
                    <SelectedRecordsModal
                        open={selectedRecordIds.size > 0}
                        selectedCount={selectedRecordIds.size}
                        onDelete={deleteSelectedRecords}
                        onCancel={() => setSelectedRecordIds(new Set())}
                        deleting={deletingRecords}
                    />

                    {/* Amendments — the conversation on one record. Portalled and
                        gated on a state that starts null, so the server and the
                        first client render both produce nothing (see the
                        hydration rule in memory.md). Keyed on the record id so
                        its drafts re-seed per row without a reset effect. */}
                    <RecordAmendmentsPanel
                        key={amendmentsRecordId ?? "closed"}
                        record={amendmentsRecord}
                        workspaceId={workspaceId}
                        collectionId={getRecordCollectionId(amendmentsRecord)}
                        onClose={closeAmendments}
                    />
                </div>

                {/* Right rail — Aquiline (CRM) and Relay (workflows) */}
                <AiSidebar
                    agent="aquiline"
                    context={"this module"}
                    workspaceId={workspaceId}
                    moduleId={moduleId}
                />
            </section>
        </>
    );
}