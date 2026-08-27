/**
 * The app's thin scrollbar, spelled once.
 *
 * The OS bars are ~15px of grey furniture — half the height of a 12px mono line
 * and, worse, drawn by the platform, so they ignore the theme completely: in
 * the dark family a native bar arrives as a light grey slab across the bottom
 * of a dark panel. Anywhere a payload, a snippet, a URL or a wide table gets
 * its own scroll region, it gets this instead.
 *
 * Both axes in one constant on purpose — a region that scrolls sideways today
 * usually gains a vertical bar the moment its content grows, and a half-styled
 * pair is more obviously wrong than an unstyled one.
 */
export const SCROLLBAR =
    "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-control hover:[&::-webkit-scrollbar-thumb]:bg-control-hover";
