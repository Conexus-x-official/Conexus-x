import { HiOutlineUserAdd } from "react-icons/hi";
import {
  HiOutlineDocumentText, HiOutlineHashtag, HiOutlineFlag, HiOutlineCalendarDays,
  HiOutlineUser, HiOutlineEnvelope, HiOutlinePhone, HiOutlineCheckCircle,
  HiOutlineChevronUpDown, HiOutlineLink, HiOutlinePaperClip, HiOutlineStar,
  HiOutlineBell, HiOutlineUsers, HiOutlineArrowsRightLeft, HiOutlineCog6Tooth,
} from "react-icons/hi2";
import { RiUserSharedLine } from "react-icons/ri";
import { VscDeveloperTools } from "react-icons/vsc";

export const COLLECTION_COLOR_PALETTE = [
  "#6366F1",
  "#F97362",
  "#0EA5A4",
  "#EAB308",
  "#EC4899",
  "#22C55E",
  "#8B5CF6",
  "#F59E0B",
  "#3B82F6",
  "#14B8A6",
];

export const DEFAULT_STATUS_OPTIONS = [
  { label: "Not Started", color: "#94A3B8" },
  { label: "Working on it", color: "#F59E0B" },
  { label: "Stuck", color: "#EF4444" },
  { label: "Done", color: "#22C55E" },
];

export const STATUS_SWATCHES = [
  "#94A3B8", "#F59E0B", "#EF4444", "#22C55E", "#6366F1", "#EC4899", "#0EA5A4", "#8B5CF6", "#3B82F6", "#14B8A6",
];


export const COUNTRY_DIALING_CODES = [
  { code: "+1", iso: "US", flag: "🇺🇸", country: "United States / Canada" },
  { code: "+7", iso: "RU", flag: "🇷🇺", country: "Russia / Kazakhstan" },
  { code: "+20", iso: "EG", flag: "🇪🇬", country: "Egypt" },
  { code: "+27", iso: "ZA", flag: "🇿🇦", country: "South Africa" },
  { code: "+30", iso: "GR", flag: "🇬🇷", country: "Greece" },
  { code: "+31", iso: "NL", flag: "🇳🇱", country: "Netherlands" },
  { code: "+32", iso: "BE", flag: "🇧🇪", country: "Belgium" },
  { code: "+33", iso: "FR", flag: "🇫🇷", country: "France" },
  { code: "+34", iso: "ES", flag: "🇪🇸", country: "Spain" },
  { code: "+36", iso: "HU", flag: "🇭🇺", country: "Hungary" },
  { code: "+39", iso: "IT", flag: "🇮🇹", country: "Italy" },
  { code: "+40", iso: "RO", flag: "🇷🇴", country: "Romania" },
  { code: "+41", iso: "CH", flag: "🇨🇭", country: "Switzerland" },
  { code: "+43", iso: "AT", flag: "🇦🇹", country: "Austria" },
  { code: "+44", iso: "GB", flag: "🇬🇧", country: "United Kingdom" },
  { code: "+45", iso: "DK", flag: "🇩🇰", country: "Denmark" },
  { code: "+46", iso: "SE", flag: "🇸🇪", country: "Sweden" },
  { code: "+47", iso: "NO", flag: "🇳🇴", country: "Norway" },
  { code: "+48", iso: "PL", flag: "🇵🇱", country: "Poland" },
  { code: "+49", iso: "DE", flag: "🇩🇪", country: "Germany" },
  { code: "+51", iso: "PE", flag: "🇵🇪", country: "Peru" },
  { code: "+52", iso: "MX", flag: "🇲🇽", country: "Mexico" },
  { code: "+53", iso: "CU", flag: "🇨🇺", country: "Cuba" },
  { code: "+54", iso: "AR", flag: "🇦🇷", country: "Argentina" },
  { code: "+55", iso: "BR", flag: "🇧🇷", country: "Brazil" },
  { code: "+56", iso: "CL", flag: "🇨🇱", country: "Chile" },
  { code: "+57", iso: "CO", flag: "🇨🇴", country: "Colombia" },
  { code: "+58", iso: "VE", flag: "🇻🇪", country: "Venezuela" },
  { code: "+60", iso: "MY", flag: "🇲🇾", country: "Malaysia" },
  { code: "+61", iso: "AU", flag: "🇦🇺", country: "Australia" },
  { code: "+62", iso: "ID", flag: "🇮🇩", country: "Indonesia" },
  { code: "+63", iso: "PH", flag: "🇵🇭", country: "Philippines" },
  { code: "+64", iso: "NZ", flag: "🇳🇿", country: "New Zealand" },
  { code: "+65", iso: "SG", flag: "🇸🇬", country: "Singapore" },
  { code: "+66", iso: "TH", flag: "🇹🇭", country: "Thailand" },
  { code: "+81", iso: "JP", flag: "🇯🇵", country: "Japan" },
  { code: "+82", iso: "KR", flag: "🇰🇷", country: "South Korea" },
  { code: "+84", iso: "VN", flag: "🇻🇳", country: "Vietnam" },
  { code: "+86", iso: "CN", flag: "🇨🇳", country: "China" },
  { code: "+90", iso: "TR", flag: "🇹🇷", country: "Turkey" },
  { code: "+91", iso: "IN", flag: "🇮🇳", country: "India" },
  { code: "+92", iso: "PK", flag: "🇵🇰", country: "Pakistan" },
  { code: "+93", iso: "AF", flag: "🇦🇫", country: "Afghanistan" },
  { code: "+94", iso: "LK", flag: "🇱🇰", country: "Sri Lanka" },
  { code: "+95", iso: "MM", flag: "🇲🇲", country: "Myanmar" },
  { code: "+98", iso: "IR", flag: "🇮🇷", country: "Iran" },
  { code: "+212", iso: "MA", flag: "🇲🇦", country: "Morocco" },
  { code: "+213", iso: "DZ", flag: "🇩🇿", country: "Algeria" },
  { code: "+216", iso: "TN", flag: "🇹🇳", country: "Tunisia" },
  { code: "+218", iso: "LY", flag: "🇱🇾", country: "Libya" },
  { code: "+234", iso: "NG", flag: "🇳🇬", country: "Nigeria" },
  { code: "+254", iso: "KE", flag: "🇰🇪", country: "Kenya" },
  { code: "+351", iso: "PT", flag: "🇵🇹", country: "Portugal" },
  { code: "+353", iso: "IE", flag: "🇮🇪", country: "Ireland" },
  { code: "+358", iso: "FI", flag: "🇫🇮", country: "Finland" },
  { code: "+380", iso: "UA", flag: "🇺🇦", country: "Ukraine" },
  { code: "+852", iso: "HK", flag: "🇭🇰", country: "Hong Kong" },
  { code: "+880", iso: "BD", flag: "🇧🇩", country: "Bangladesh" },
  { code: "+886", iso: "TW", flag: "🇹🇼", country: "Taiwan" },
  { code: "+961", iso: "LB", flag: "🇱🇧", country: "Lebanon" },
  { code: "+962", iso: "JO", flag: "🇯🇴", country: "Jordan" },
  { code: "+963", iso: "SY", flag: "🇸🇾", country: "Syria" },
  { code: "+964", iso: "IQ", flag: "🇮🇶", country: "Iraq" },
  { code: "+965", iso: "KW", flag: "🇰🇼", country: "Kuwait" },
  { code: "+966", iso: "SA", flag: "🇸🇦", country: "Saudi Arabia" },
  { code: "+967", iso: "YE", flag: "🇾🇪", country: "Yemen" },
  { code: "+968", iso: "OM", flag: "🇴🇲", country: "Oman" },
  { code: "+971", iso: "AE", flag: "🇦🇪", country: "United Arab Emirates" },
  { code: "+972", iso: "IL", flag: "🇮🇱", country: "Israel" },
  { code: "+973", iso: "BH", flag: "🇧🇭", country: "Bahrain" },
  { code: "+974", iso: "QA", flag: "🇶🇦", country: "Qatar" },
  { code: "+977", iso: "NP", flag: "🇳🇵", country: "Nepal" },
  { code: "+994", iso: "AZ", flag: "🇦🇿", country: "Azerbaijan" },
  { code: "+995", iso: "GE", flag: "🇬🇪", country: "Georgia" },
  { code: "+998", iso: "UZ", flag: "🇺🇿", country: "Uzbekistan" },
];

export const COLUMN_TYPE_OPTIONS = [
  { value: "text", label: "Text", icon: HiOutlineDocumentText },
  { value: "number", label: "Number", icon: HiOutlineHashtag },
  { value: "status", label: "Status", icon: HiOutlineFlag },
  { value: "date", label: "Date", icon: HiOutlineCalendarDays },
  { value: "timeline", label: "Timeline", icon: HiOutlineCalendarDays },
  { value: "person", label: "People", icon: HiOutlineUser },
  { value: "email", label: "Email", icon: HiOutlineEnvelope },
  { value: "phone", label: "Phone", icon: HiOutlinePhone },
  { value: "checkbox", label: "Checkbox", icon: HiOutlineCheckCircle },
  { value: "dropdown", label: "Dropdown", icon: HiOutlineChevronUpDown },
  { value: "link", label: "Link", icon: HiOutlineLink },
  { value: "file", label: "File", icon: HiOutlinePaperClip },
  { value: "rating", label: "Rating", icon: HiOutlineStar },
  // Mirrors a column from another module: pick the module, pick the column,
  // then pick a value from the list and it shows against the record.
  { value: "relation", label: "Relation", icon: HiOutlineArrowsRightLeft },
];

export const PALETTE = [
  { bg: "#FFEEEB", accent: "#FF6B6B" },
  { bg: "#E9FBF6", accent: "#00B894" },
  { bg: "#FFF4E5", accent: "#FF9F43" },
  { bg: "#EFEBFF", accent: "#6C5CE7" },
  { bg: "#E8F8ED", accent: "#20BF6B" },
  { bg: "#FFEBF7", accent: "#F368C4" },
  { bg: "#E8F1FF", accent: "#4D96FF" },
  { bg: "#FDF0E8", accent: "#E8590C" },
];

export const notifications = [
  {
    id: 1,
    title: "New module created",
    message: "Marketing Campaign was created successfully.",
    time: "2 min ago",
  },
  {
    id: 2,
    title: "Workspace invited",
    message: "John invited you to Product Team.",
    time: "10 min ago",
  },
  {
    id: 3,
    title: "Link clicked",
    message: "Your short link received 25 new clicks.",
    time: "1 hour ago",
  },
];


export const themeColors = [
  {
    name: "Electric Purple",
    hex: "#6C5CE7",
    logoElement: "Main Loop Anchor",
    uiMapping: "Workspaces & Navigation",
    usage: "Active menu items, Primary Action Buttons",
  },
  {
    name: "Vibrant Cyan",
    hex: "#00CEC9",
    logoElement: "Top-Right Wing",
    uiMapping: "Modules & Project Management",
    usage: "Status tags (In Progress), Module Headers",
  },
  {
    name: "Coral Orange",
    hex: "#FF7675",
    logoElement: "Bottom-Right Wing",
    uiMapping: "Collections",
    usage: "Priority badges, Urgent tasks, High-tier Clients",
  },
  {
    name: "Bright Emerald",
    hex: "#00B894",
    logoElement: "Bottom-Left Wing",
    uiMapping: "Analytics & Statuses",
    usage: "Status tags (Completed), Growth charts, Metrics",
  },
];



export const profileLinks = [
  {
    id: 1,
    name: "Manage Profile",
    url: "/user/menage-profile",
    icon: <RiUserSharedLine />
  },
  {
    id: 2,
    name: "Members",
    url: "/members",
    icon: <HiOutlineUsers />
  },
  {
    id: 3,
    name: "Developer",
    url: "/developer",
    icon: <VscDeveloperTools />
  },
  {
    id: 4,
    name: "Notification",
    url: "/notification",
    icon: <HiOutlineBell />
  },
  {
    id: 5,
    name: "Preferences",
    url: "/user/preferences",
    icon: <HiOutlineCog6Tooth />
  },
]


/**
 * The themes offered in the picker.
 *
 * This ONE array drives both the menu (ui/buttons/themebutton.tsx) and the list
 * handed to next-themes (providers/theme.provider.tsx), so an entry removed
 * here is removed from both at once.
 *
 * Blue / Green / Purple were dropped 2026-08-26: colour was being offered as a
 * theme when the only choice that matters is light vs dark. Their token blocks
 * are STILL in globals.css, untouched - putting an entry back here is the whole
 * job of restoring one (see LAYOUT.md 12).
 */
export const themes = [
  {
    name: "System",
    value: "system",
    bg_hex: "#808080",
    text_hex: "#ffffff",
  },
  {
    name: "Light",
    value: "light",
    bg_hex: "#ffffff",
    text_hex: "#171717",
  },
  {
    name: "Dark",
    value: "dark",
    bg_hex: "#171717",
    text_hex: "#ffffff",
  },
];



export const ROLE_COLORS = {
  owner: "#A78BFA",
  admin: "#60A5FA",
  member: "#94A3B8",
  guest: "#FB923C",
};