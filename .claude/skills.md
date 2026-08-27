# skills
Framework: verify Next 16 API in node_modules/next/dist/docs/ before use. Never assume pre-15 conventions.
Server/client: default Server Component; add "use client" only for state/effect/browser API/handlers.
Data: call backend via apiRequest from lib/api.ts. Do not add a second HTTP client; fix lib/api.ts base URL rather than bypassing it.
URLs: read base from config/env.js. No hardcoded hosts/ports in components.
Auth: token/user via lib/auth.ts only. Never touch localStorage directly.
Styling: Tailwind v4 utilities + HeroUI primitives. No new CSS files; globals.css only for tokens.
Structure: page = composition only; logic to components/, shared logic to lib/.
Components: reuse components/ui/{modals,menu,buttons,cards,helpers} before creating new ones.
Realtime: a change reaches other people through the socket, never a poll. Server-side, emit from the seam every write already passes through (logActivity covers the whole audit trail); client-side, PATCH from the payload only when it is one row of one list, INVALIDATE anything structural, and resync on every reconnect. Never add a pollingInterval — if data looks stale, the missing piece is an emit site or a room join.
One store, one read path: never add a second endpoint/feed over rows another endpoint already returns. Automation runs ARE activity rows (source=automation) — a bespoke run log was deleted for exactly this reason. Two read paths over one store is how the two drift.
Spec tables over conditionals: when a form's controls depend on a choice (trigger -> which pickers), put the requirements in a table (lib/automation/catalog.ts) and drive the UI from it. Adding a case must be a row, never a new `x === "y"` test spread across components.
Offer only what can run: filter impossible options OUT of a list rather than rendering them disabled. A disabled option still makes the user wonder what they did wrong.
Rule-building UI = a sentence with inline fill-in blanks (WHEN / ONLY IF / THEN), not stacked labelled selects; see reference.md "automation builder UI". If the form reads correctly, do NOT also render a preview restating it.
Naming a created thing is optional and defaulted from what was built; in the automation builder it sits FIRST, with the live auto-name as its placeholder.
No native <select>/<datalist> in themed UI — its popup is OS-drawn and ignores the theme. Use a portalled menu (BlankMenu, ModulePicker, BoardAccessMenu all share the pattern) and re-earn what the native control gave for free: arrow keys, Enter, Escape, type-ahead, listbox roles.
Every non-submitting <button> inside a <form> needs type="button". HTML defaults a form button to type="submit", so it fires the submit handler AND that handler reads the pre-click state from its closure — one missing attribute produced two bugs that looked unrelated (a colour swatch created the tag on click, with the previous colour).
No reset effects: re-seed a form by giving it a changing `key` and lazy useState initialisers. setState-in-effect and impure render calls (Date.now() as a key) both fail lint.
Types: no `any` in new code; type API payloads at the boundary.
Mock data: data/*.data.js is placeholder — replace with API calls, do not extend.
Verify: npm run lint + npm run build after edits. Lint has 61 PRE-EXISTING errors in untouched files — compare the count and check none name your files, do not chase the total to zero.
Schema: request -> minimal diff -> lint/build -> report file:line.
