import { TbPlugX } from "react-icons/tb";
import MockFrame from "./MockFrame";

/**
 * A picture of the Extensions section — AS IT ACTUALLY IS.
 *
 * The route exists and is deliberately empty: app/Extensions/page.tsx lists
 * nothing and says why, because a grid of plausible extensions would be a lie
 * the moment anyone clicked one. Marketing it as a shipped feature would be
 * the same lie one step earlier, so this draws the real empty state and the
 * section that carries it is headed "what we are building next".
 *
 * That costs a feature bullet and buys the only thing that matters on a page
 * asking for a signup: the first click after signing up matches the promise.
 */
export default function ExtensionsMock() {
    return (
        <MockFrame label="Extensions">
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <TbPlugX className="h-16 w-16 text-slate-300" strokeWidth={1.25} />

                <p className="mt-4 text-sm font-semibold text-slate-900">No extensions yet</p>

                <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-muted">
                    This is where your team will build and deploy its own apps on top of your CRM data.
                </p>

                <span className="mt-5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-semibold text-amber-600">
                    In development
                </span>
            </div>
        </MockFrame>
    );
}
