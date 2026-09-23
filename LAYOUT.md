# Frontend Layout & Design Tokens

Reference implementation: [components/homesection.tsx](components/homesection.tsx). When a value here disagrees with another component, this doc wins — the differences are listed in §11.

Everything is Tailwind v4 utilities. Fonts and theme variables live in [app/globals.css](app/globals.css).

---

## 1. Borders

Borders are hairline and low-contrast. They separate, they never decorate.

| Purpose | Class | Where |
|---|---|---|
| Table header underline | `border-b border-gray-200/40` | thead row |
| Row separators | `divide-y divide-gray-200/30` on `<tbody>` | never per-row borders |
| Popover / card outline | `border border-gray-200` | date popovers, dropdowns |
| Input outline (rest) | `border border-zinc-400` | login, register, modals |
| Input outline (focus) | `focus:border-black` (auth) · `focus:border-[#6C5CE7]` (app modals) | — |
| Modal outline | `border border-slate-200` | create/edit modals |
| Badge outline | `border border-blue-100` / `border-emerald-100` | Created / Updated pills |
| Section divider | `border-b border-slate-100` | page headers |

Rules:
- Opacity suffixes (`/40`, `/30`) are deliberate — a solid `border-gray-200` reads too heavy on `#f4f4f6`.
- Never mix a border and a shadow on the same element unless it is a floating layer (popover, modal).
- Table cells get **no** vertical borders. Column separation comes from padding alone.

Most-used in the codebase: `border-slate-300` (60), `border-slate-200` (51), `border-zinc-400` (10), `border-gray-200` (8).

## 2. Shadows

Four levels, mapped to elevation. Nothing else.

| Level | Class | Use |
|---|---|---|
| 0 | *(none)* | table rows, cells, tab strip, **icon tiles** (§7 — they are outlined, not lifted) |
| 1 | `shadow-sm` | the page shell card, sidebar surfaces |
| 2 | `shadow-lg` | inline popovers (date detail, context menus) |
| 3 | `shadow-2xl` | portal modals over the dim layer |

Also in use: `shadow-xl` (8×) — treat as an alias of level 2/3 and prefer `shadow-lg` or `shadow-2xl`.

Special case — the **notched tab** in [homesection.tsx:124-125](components/homesection.tsx#L124-L125) uses `box-shadow` as a drawing tool, not elevation:

```
before:[box-shadow:3px_3px_0_0_#f4f4f6]   /* left notch  */
after:[box-shadow:-3px_3px_0_0_#f4f4f6]   /* right notch */
```

Two 14px pseudo-elements with an inverted corner radius, filled by a hard-edged shadow in the surface colour. Keep that colour in sync with the panel background or the notch shows a seam.

## 3. Radius

| Class | px | Use |
|---|---|---|
| `rounded` | 4 | tiny inline pills, swatches |
| `rounded-md` | 6 | sidebar icon chips |
| `rounded-lg` | 8 | inputs, icon buttons, list rows |
| `rounded-xl` | 12 | popovers, cards, the brand icon tile (§7), primary buttons |
| `rounded-2xl` | 16 | modals, pagination buttons |
| `rounded-l-2xl` | 16 left only | the main content shell — right edge stays flush |
| `rounded-t-[18px]` | 18 top | active tab only |
| `rounded-full` | — | avatars, dots, status indicators |

Frequency: `rounded-xl` (73), `rounded-lg` (71), `rounded-full` (36), `rounded-2xl` (20), `rounded-md` (13).

The shell is `rounded-l-2xl` because it butts against the viewport edge — do not "fix" it to `rounded-2xl`.

## 4. Colors

### 4.1 Surfaces

| Token | Hex | Use |
|---|---|---|
| App canvas | `#D9D9D9` | page background behind the shell |
| Panel | `#f4f4f6` | main content shell, active tab fill |
| Card | `#FFFFFF` | sidebar, modals, popovers, inputs |
| Control | `#e3e3e5` | pagination buttons at rest |
| Control hover | `gray-300` | pagination + icon button hover |
| Row hover | `gray-200/40` | table row hover |
| Icon-button hover | `gray-300/50` | the `⋮` action button |

### 4.2 Brand

| Token | Hex | Use |
|---|---|---|
| **Coral** (primary) | `#FF7675` | tab strip, primary buttons, active accents, auth panel |
| Coral hover | `#FF5F5E` | primary button hover |
| Violet | `#6C5CE7` | Apps nav chip, modal focus ring, links |
| Teal | `#00B894` | Modules nav chip |
| Cyan | `#00CEC9` | wordmark gradient, unread dot |
| Ink | `#000000` | active pagination page, strong headings |

`#FF7F77` (tab strip) and `#FF6B6B` are near-duplicates of coral — see §11.

### 4.3 Text

| Role | Class | Notes |
|---|---|---|
| Primary | `text-slate-900` | workspace names, headings |
| Body | `text-slate-800` / `text-slate-700` | cells, IDs, dates |
| Muted | `text-gray-500` | pagination summary |
| Column header | `text-[#7c7c80]` | thead only |
| Placeholder / empty | `text-gray-400`, `text-zinc-400` | "No data available", zero counts |
| On coral | `text-white/90` → `hover:text-white` | inactive tab labels |
| On black | `text-white` | active pagination page |

### 4.4 Status accents

| State | Fill | Text | Border |
|---|---|---|---|
| Info / Created | `bg-blue-50` | `text-blue-600` | `border-blue-100` |
| Success / Updated | `bg-emerald-50` | `text-emerald-600` | `border-emerald-100` |
| Error (inline text) | — | `text-red-400` | — |
| Error (banner) | `bg-[#FF7675]/10` | `text-[#FF7675]` | `border-[#FF7675]/30` |
| Destructive banner | `bg-red-50/80` | `text-red-600` | `border-red-100` |

The 50/600/100 triple is the pattern for any new status pill.

### 4.5 Data palettes

Not UI chrome — these live in [data/data.js](data/data.js) and are assigned to entities:

- `PALETTE` — workspace/module avatar colours, picked by hashing the id (`colorFor()`)
- `COLLECTION_COLOR_PALETTE` — collection accent bars
- `STATUS_SWATCHES` — status-column label colours

Never hand-pick from these in a component; go through the hash helper or the user's stored choice.

## 5. Typography

Fonts are loaded in [app/layout.tsx](app/layout.tsx) and exposed as classes in `globals.css`.

| Class | Family | Use |
|---|---|---|
| `font-google-sans` | Google Sans | **the UI font** — tables, tabs, buttons, labels |
| `font-dmsans` | DM Sans | workspace/module detail pages |
| `font-jost` | Jost | the "X" in the wordmark |
| `font-oswald`, `font-istokweb` | — | one-off decorative use |

Two families are competing (`font-dmsans` 119 uses vs `font-google-sans` 66) — see §11.

| Size | Use |
|---|---|
| `text-3xl` / `text-2xl` | auth headlines |
| `text-lg` | panel titles |
| `text-sm` | **the default** — cells, buttons, labels (162 uses) |
| `text-xs` | popover bodies, helper text (100 uses) |
| `text-[11px]` / `text-[10px]` | metadata lines, badges |

Weights: `font-bold` for names, active tabs and pagination digits; `font-semibold` for headers and labels; `font-medium` for dates and secondary cells; `font-normal` only to *undo* boldness (e.g. a zero count).

## 6. Spacing

| Context | Padding |
|---|---|
| Table cell | `px-6 py-2` |
| Table header cell | `px-6 py-3` |
| Tab button | `px-6 py-2.5` |
| Content area | `px-4 pt-2 pb-2` |
| Pagination footer | `px-8 py-5` |
| Popover | `p-3` |
| Modal | `p-6` |
| Sidebar block | `px-5 pt-5` |

Gaps: `gap-2` (button rows, tabs), `gap-3` (header clusters), `gap-4` (logo + text). Vertical rhythm inside stacks: `space-y-3` / `space-y-4`.

Fixed dimensions worth knowing: sidebar `w-82`, tab strip `min-h-[52px]`, pagination button `w-10 h-10`, input height `h-11`, popover width `w-64`.

## 7. Component recipes

> Modals, drawers, dropdowns and their buttons/inputs are **§13** now. The `bg-accent` button and `bg-accent/10` icon-tile below are stale (§11.8) — use `bg-foreground` / `bg-control` on new work.

**Shell card** — the frame every page content sits in:
```
bg-[#f4f4f6] rounded-l-2xl overflow-hidden h-full flex flex-col shadow-sm
```

**Tab strip**:
```
bg-[#FF7F77] pt-2.5 px-6 flex items-end min-h-[52px] gap-2 select-none relative
```
Active tab is a `motion.div` with `layoutId="activeTabBackground"` and a spring (`stiffness: 450, damping: 35`) so the fill slides between tabs. Label sits at `relative z-10` above it.

**Table**:
```
table:  w-full border-collapse
thead:  text-left text-sm text-[#7c7c80] font-bold border-b border-gray-200/40
tbody:  divide-y divide-gray-200/30
row:    hover:bg-gray-200/40 transition cursor-pointer text-slate-800
```

**Popover** (anchored, inside a `relative` cell):
```
absolute left-6 top-12 z-20 w-64 bg-white rounded-xl shadow-lg border border-gray-200 p-3
text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-100
```

**Icon tile** — an icon in this app is never loose in a row; it sits in an outlined square. [components/ui/helpers/navTile.tsx](components/ui/helpers/navTile.tsx):

```
bg-card border border-slate-300 flex shrink-0 items-center justify-center
```

Size and radius are the caller's — same recipe, three scales:

| Scale | Class | Icon | Where |
|---|---|---|---|
| Brand | `h-11 w-11 rounded-xl` | 32px | the sidebar logo |
| Nav row | `h-7 w-7 rounded-lg` | `h-4 w-4` | Extensions, Automations, Modules, the workspace switcher (`h-8 w-8`) |
| Rail | `h-9 w-9 rounded-lg` | `h-[18px]` | the collapsed rail — see the rule below |

Rules:
- The tile started as the logo's own treatment. It is now the sidebar's one repeatable idea: **every** primary nav glyph wears it, so the icon column reads as one column instead of four differently-sized marks.
- `bg-card`, never `bg-white`. The sidebar is itself `bg-card`, so in the light family the tile is invisible apart from its outline — which is the whole effect. A literal white stays white in `.dark` while the border inverts around it (§10.1).
- `border-slate-300` is left as a palette utility on purpose — every theme already re-points that scale (§10.1, row 2).
- **When the target is already a square of tile size, the target IS the tile** — do not nest one inside it, or the outline is drawn twice. `RailButton` and the collapsed workspace switcher take `border` + `bg-card` directly, and their active state swaps the fill for `nav-glass` with `border-transparent` so the row does not resize by 2px on selection.

**Icon button**:
```
p-1.5 rounded-lg hover:bg-gray-300/50 transition cursor-pointer text-slate-600
```
Icon sized `w-5 h-5`.

**Pagination button**:
```
rest:     w-10 h-10 rounded-2xl bg-[#e3e3e5] text-slate-800 hover:bg-gray-300
active:   bg-black text-white
disabled: disabled:opacity-40
```

**Primary button**:
```
w-full rounded-lg bg-[#FF7675] py-3 text-sm font-semibold hover:bg-[#ff5f5e]
disabled:bg-slate-400 disabled:cursor-not-allowed
```

**Secondary button**: `bg-slate-100 hover:bg-slate-200/70 text-zinc-600 rounded-xl px-4 py-2`

**Empty state (in a table)**: `text-center py-20 text-muted` — full `colSpan` inside a table.

**Empty state (panel)** — the standard "nothing here yet" block. Used by the workspace modules grid and the module collections area:

```
container:  rounded-xl border border-dashed border-slate-300 bg-card/50 px-6 py-16 text-center
icon tile:  mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent
heading:    text-lg font-semibold text-slate-900
body:       mx-auto mt-1 max-w-sm text-sm text-muted
action:     mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5
            text-sm font-semibold text-white transition hover:bg-accent-hover cursor-pointer
```

Rules:
- **Every empty state carries its primary action.** An empty state with nothing to click is a dead end — that was the bug in both the workspace and module empty states.
- The container is `bg-card/50`, not a solid fill: it must read as an *absence* against `bg-panel`, not as another card.
- The icon tile uses the `bg-accent/10` + `text-accent` tint pair (§4.4), so it re-tints with the theme.
- Never hardcode a dark surface here. See §11.4.

**Error state**: `text-center py-20 text-red-400 text-sm font-medium`

**Loading**: [CollectionLoader](components/CollectionLoader.tsx) inside a panel, [WorkspaceLoader](components/WorkspaceLoader.tsx) for a whole page. Skeleton bars are `bg-control` + `animate-pulse`, staggered with inline `animationDelay`:

```
<div className="h-32 rounded-xl bg-control animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
```

`bg-control` is a token, so the bar stays one step off the surface in every theme. The legacy `.shimmer` class in `globals.css` is a **white** gradient — it is invisible on any light theme and must not be used for new skeletons (§11.6).

## 8. Interaction

- Always pair a colour change with `transition` (or `transition-colors duration-200` for tabs).
- Every clickable non-button element needs `cursor-pointer`.
- Disabled = `disabled:opacity-40` (controls) or `disabled:bg-slate-400 disabled:cursor-not-allowed` (primary buttons). Never only remove the handler.
- Popovers close on a container-level `onClick` that nulls the open-id state; the popover itself calls `e.stopPropagation()`, and its trigger does too.
- Only one popover open at a time — opening a date popover nulls the row menu, and vice versa.
- Row click navigates; anything interactive inside a row must `e.stopPropagation()`.

## 9. Z-index

| Layer | Value |
|---|---|
| Tab fill behind label | `z-0` |
| Tab label | `z-10` |
| Cell containing an open popover | `relative z-1` |
| Popover / dropdown | `z-20` |
| Sticky page header | `z-20` |
| Portal modal + backdrop | `z-50` |
| Anchored panel over another portalled menu (§14) | `z-[100]` |
| Drag ghost (inline style) | `999999` |

Backdrop: `fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4`, rendered through `createPortal(..., document.body)` (§13.1 — was `bg-black/60`).

## 10. Theming

`globals.css` defines a full token contract on `:root`/`.light`, `.dark`, `.blue`, `.green`, `.purple`. The class lands on `<html>` through `next-themes` ([theme.provider.tsx](app/providers/theme.provider.tsx)), which is given the theme list from `themes` in [data/data.js](data/data.js), so **a theme change applies to every route**, not just the one that rendered the picker.

Two layers do the work:

1. **Semantic tokens** — `--canvas`, `--panel`, `--card`, `--control`, `--control-hover`, `--foreground`, `--body`, `--muted`, `--hairline`, `--accent`, `--accent-hover`, `--primary`, plus two effect tokens `--drag-shadow` and `--avatar-ring`. Exposed to Tailwind via `@theme inline`, so they are real utilities: `bg-canvas`, `bg-panel`, `bg-card`, `bg-control`, `bg-control-hover`, `text-foreground`, `text-body`, `text-muted`, `border-hairline`, `bg-accent`, `hover:bg-accent-hover`, `border-avatar-ring`. Opacity suffixes work (`bg-accent/10`, `bg-card/50`).
2. **Palette overrides** — Tailwind v4 compiles `text-slate-800` to `color: var(--color-slate-800)`, so each theme class redefines the neutral scales (`slate` / `gray` / `zinc`) and the status tints. Every pre-existing utility retargets itself; no per-component `dark:` variants are needed. In `.dark` the neutral scale is **inverted** — `slate-800` is a light pixel — which keeps existing pairs like `bg-slate-800 text-slate-200` legible.

`<body>` carries `bg-canvas text-body` ([layout.tsx](app/layout.tsx)), so a route that sets no background inherits the theme.

### 10.1 Which layer to reach for

Both layers are live, and picking the wrong one is the most common mistake:

| You are writing | Use | Because |
|---|---|---|
| A new surface, border or accent | **Semantic token** (`bg-card`, `border-hairline`, `bg-accent`) | Explicit, and it is the layer every theme is guaranteed to define. |
| Editing existing `slate`/`gray`/`zinc` utilities | **Leave them** | The palette override already re-themes them; rewriting is churn. |
| Ink that must invert with the theme | `text-slate-900` / `text-slate-700` **or** `text-foreground` / `text-body` | Both work. Prefer the token in new code. |
| Muted / secondary text | `text-muted` | `text-gray-400` and `text-zinc-400` also invert, but `--muted` is tuned per theme. |
| A one-off effect (drag lift, avatar ring) | `var(--drag-shadow)`, `border-avatar-ring` | These flip *kind*, not just value — see below. |

Two tokens exist because a value change is not enough:

- `--drag-shadow` — a black drop shadow is invisible on a dark board, so `.dark` lifts with a **white** shadow instead.
- `--avatar-ring` — a translucent dark ring on light themes, **solid white** in `.dark`, where the avatar sits on a near-black bar.

If a new effect needs to change kind (not just shade) between themes, add a token rather than a `dark:` variant.

### 10.2 Status tints in dark

`.dark` also overrides `--color-blue-50/100`, `--color-emerald-50/100`, `--color-red-50/100`, `--color-amber-50/100`. The `50`-level fills from §4.4 are near-white and glare on a dark surface, so they are re-pointed at deep, desaturated versions. The `600`-level text stays as Tailwind ships it — it is already legible on both. **A new status colour needs its `50`/`100` pair added to `.dark`, or it will burn a hole in the dark UI.**

Rules:
- New surfaces use the token utility, never a hex. `bg-[#f4f4f6]` is now `bg-panel`.
- `text-white` / `bg-black` are deliberately **not** themed — they are on-accent ink and modal scrim, constant across themes.
- Adding a theme = one class in `globals.css` + one entry in `themes` in `data/data.js`. Nothing else. The class must define **every** semantic token; a missing one falls back to `:root` (the light value) and will look wrong.
- `.blue` / `.green` / `.purple` are light-family themes: they override only the `50`–`200` neutral steps, because their ink is already dark. Only `.dark` inverts the full `400`–`900` range. **They are not currently offered in the picker** — their entries were removed from `themes` in `data/data.js` on 2026-08-26, leaving System / Light / Dark. The CSS is intact, so restoring one is putting its entry back.

## 11. Known inconsistencies

Audited across `app/` and `components/`; fix these before adding new surfaces.

1. ~~**Four coral variants**~~ — fixed. All four collapsed into `bg-accent` / `hover:bg-accent-hover` (§10). The tab strip and the primary button are now the same token, and it follows the selected theme.
2. **Two UI fonts**: `font-dmsans` (119) on workspace/module pages, `font-google-sans` (66) on the dashboard. Pick one for chrome.
3. **Three neutral scales**: `slate`, `zinc` and `gray` all appear in borders and text. `slate` dominates (111 border uses) — standardise on it.
4. ~~**Dark colours on a light UI**~~ — fixed. The `#111727` block in [workspace/[id]/page.tsx](app/workspace/[id]/page.tsx) and the `border-slate-500` block in the module page both use the §7 **Empty state (panel)** recipe now, so they follow the theme. Both also gained the create button they were missing.
5. ~~**Theme variables unused**~~ — fixed; see §10. Still hardcoded and outside the token layer: the teal wordmark gradient ([Sidebar.tsx:116](components/Sidebar.tsx#L116)), the unread dot ([notifications.tsx:135](components/notifications.tsx#L135)), and the violet/teal nav chips — decide whether those follow `--primary` or stay brand-constant.
6. **`.shimmer` vs `animate-pulse`** — two skeleton systems; `.shimmer` is a hardcoded white gradient and only works on dark backgrounds. `animate-pulse` on `bg-control` is the themed replacement (§7). The module page has been converted; `.shimmer` still lingers elsewhere in `globals.css` and its remaining call sites.
7. **`shadow-xl` vs `shadow-2xl`** used interchangeably for modals.
8. **`bg-accent` on buttons** — §7's Primary/Empty-state recipes and older modals still show `bg-accent … text-white`. As of 2026-09 the accent is purple and **out** of the action layer (§13.2): new/redesigned surfaces use `bg-foreground text-card`. The old recipes below are stale; follow §13.
9. **`--accent` labelled "Coral" in §4.2** — it is `var(--brand-purple)` now. §4.2's brand table predates the token layer.

## 12. Token layer (implemented)

`globals.css` ships the tokens below; §10 explains the two layers. Reference them instead of retyping hexes:

```css
:root, .light {
  /* surfaces */
  --canvas:  #d9d9d9;        /* page background behind the shell */
  --panel:   #f4f4f6;        /* content shell, active tab fill   */
  --card:    #ffffff;        /* sidebar, modals, popovers        */
  --control: #e3e3e5;        /* pagination buttons at rest       */
  --control-hover: #d4d4d8;

  /* ink */
  --foreground: #0f172a;  --body: #1e293b;  --muted: #7c7c80;  --hairline: #e2e8f0;

  /* brand */
  --accent: #ff7675;      --accent-hover: #ff5f5e;             --primary: #00cec9;

  /* effects — these flip kind, not just value (§10.1) */
  --drag-shadow: 0 18px 35px -10px rgb(0 0 0 / 0.45);
  --avatar-ring: rgb(15 23 42 / 0.20);

  --background: var(--canvas);   /* legacy alias */
}
```

Themes shipped: `.light` (= `:root`), `.dark`, `.blue`, `.green`, `.purple`. Only `.dark` inverts the neutral scale and overrides the status tints (§10.2).

So `bg-[#f4f4f6]` is `bg-panel`, `bg-[#FF7F77]` is `bg-accent`, `text-[#7c7c80]` is `text-muted`, and the notch shadow reads `[box-shadow:3px_3px_0_0_var(--panel)]`.

**Full utility map** — the `@theme inline` block turns each token into these:

| Token | Utilities |
|---|---|
| `--canvas` | `bg-canvas` |
| `--panel` | `bg-panel` |
| `--card` | `bg-card`, `ring-card`, `text-card` |
| `--control` / `--control-hover` | `bg-control`, `hover:bg-control-hover` |
| `--foreground` / `--body` / `--muted` | `text-foreground`, `text-body`, `text-muted` |
| `--hairline` | `border-hairline` |
| `--accent` / `--accent-hover` | `bg-accent`, `text-accent`, `border-accent`, `hover:bg-accent-hover` |
| `--primary` | `bg-primary`, `text-primary` |
| `--avatar-ring` | `border-avatar-ring` |
| `--drag-shadow` | not a utility — use `var(--drag-shadow)` in an inline style |

`--accent` is now `var(--brand-purple)` (§4.2 still says "Coral" — stale). **It is no longer used for buttons, focus rings, or any in-app action** — see §13. It survives only where a colour genuinely carries meaning (a live/working dot, a data-viz series is `var(--brand-blue)` instead, status pills carry their own hue). New chrome is neutral: `bg-foreground` / `text-card` / `border-hairline` / `focus:*-foreground`.

---

## 13. Modals & floating panels (2026-09)

Every modal, drawer, dropdown and popover the app has gained this year uses **one neutral treatment**. The `--accent` (purple) is not part of it — it read as a brand shout on every "Cancel" button and every focused input. Reference: [components/ui/modals/createWorkspace.tsx](components/ui/modals/createWorkspace.tsx).

### 13.1 Chrome

| Piece | Class |
|---|---|
| Backdrop | `fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4` (`backdrop-blur-sm` optional), `createPortal(…, document.body)` |
| Panel | `w-full max-w-md rounded-2xl border border-hairline bg-card p-6 shadow-2xl font-google-sans` |
| Drawer (right) | `relative flex h-full w-[440px] max-w-[94vw] flex-col border-l border-hairline bg-card shadow-2xl` |
| Header | `mb-4 flex items-center justify-between` — `h2` is `text-lg font-bold text-foreground`; close button `rounded-md p-1 text-muted hover:bg-control hover:text-foreground` |
| Section divider inside a panel | `border-t border-hairline` (footers, reply rails) |
| Recessed sub-surface | `rounded-lg border border-hairline bg-panel p-3` (a form block inside a panel) |

### 13.2 Buttons — NEUTRAL, never `bg-accent`

| Role | Class |
|---|---|
| Primary | `rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-card transition hover:opacity-90 disabled:opacity-50 cursor-pointer` |
| Secondary | `rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-body transition hover:bg-control cursor-pointer` |
| Tertiary / Cancel | `text-xs font-semibold text-muted transition hover:text-foreground cursor-pointer` |
| Destructive confirm | `text-red-600 hover:text-red-700` (text only — the §4.4 red pair for a filled one) |

`bg-foreground` / `text-card` is the inverted-chip pair (like the tooltip, §nowhere-yet): near-black on white in the light family, near-white on dark in `.dark`. It replaces every `bg-accent … text-white` on a modal/panel button.

### 13.3 Inputs in a modal

```
rounded-lg border border-hairline bg-control/40 px-3 py-2.5 text-sm text-body outline-none transition
placeholder:text-muted focus:border-foreground focus:bg-card focus:ring-4 focus:ring-foreground/10 disabled:opacity-60
```

Kills the old `focus:border-[#6C5CE7]` / `focus:ring-accent/20`. The search bar and the Aquiline composer use the `focus-within:` form of the same.

### 13.4 Global focus outline

`globals.css` sets, for `a / button / input / select / textarea / summary / [tabindex] / [role="button"|"tab"|"menuitem"|"option"]`:

```css
:focus, :focus-visible { outline: none; }
```

No focus rectangle anywhere — click *or* Tab (owner's call). Controls that carry their own `focus:ring-*` / `focus-within:ring-*` keep it; only the browser default is suppressed. Trade-off accepted deliberately — do not "restore accessibility" by re-adding a global `:focus-visible` ring.

---

## 14. Anchored-panel positioning — the "physics"

Any panel that opens **from a trigger and must not be clipped** — a colour picker inside a scrolling menu, a dropdown near the viewport edge, a hover card inside an `overflow` container — is `position: fixed`, portalled to `document.body`, and positioned from the trigger's own rect with flip + clamp. Reference: [components/ui/ColorPicker.tsx](components/ui/ColorPicker.tsx) `placePanel()`.

This is proven across: `ColorPicker` (custom picker), `ModulePicker`, `ItemPicker`, `BoardAccessMenu`, `ViewTabs` (+ View menu), `notifications.tsx` (bell dropdown), `homesection.tsx` `DateCell`, `userProfileCard.tsx` `UserMention`, the Kanban card details popover.

### 14.1 The recipe

```
const PANEL_W = 232, PANEL_H = 214;   // estimates the flip math needs
const GAP = 8;                        // trigger → panel
const EDGE = 12;                      // viewport margin

placePanel():
  r  = triggerRef.current.getBoundingClientRect()
  vw = innerWidth, vh = innerHeight

  left = r.left
  if (left + PANEL_W > vw - EDGE)  left = r.right - PANEL_W      // right-align to trigger
  left = clamp(left, EDGE, max(EDGE, vw - PANEL_W - EDGE))       // then clamp

  top = r.bottom + GAP
  if (top + PANEL_H > vh - EDGE) {                               // no room below
    above = r.top - GAP - PANEL_H
    top = above >= EDGE ? above : clamp(top, EDGE, vh - PANEL_H - EDGE)   // flip, else clamp
  }

  setPos({ top, left })
```

### 14.2 Rules

- **Compute on open, then keep it live.** Call `placePanel()` in the open handler, and while open re-run it on `resize` and on `scroll` **in the capture phase** (`window.addEventListener("scroll", reflow, true)`) — the trigger often sits inside a scrolling menu, and a `fixed` panel detaches from it the moment anything moves.
- **Dismiss:** `mousedown` outside (checks both `triggerRef` and `panelRef` — portals bubble the React tree, not the DOM, so a listener on `document` is the reliable catch) **and** `Escape`.
- **Hydration:** the `typeof document === "undefined"` portal guard is safe **only** because the render is also gated on `open`/`pos`, which start `false`/`null` — server and first client render both produce nothing, so they agree (§ see also the `useHydrated` hook for localStorage-driven render state).
- **z-index:** `z-50` (portal layer, §9). A picker that opens over another portalled menu (ColorPicker inside the status dropdown) goes `z-[100]`.
- **Never** a bare `position: absolute` popover that can extend across sibling cells/rows or sit near a `sticky` element — that is a stacking-*context* bug a bigger z-index cannot fix. Proven three times (notification dropdown over the sticky `<thead>`, `DateCell` inside a `relative z-1` `<td>`, `UserMention` inside the amendments drawer). Anchor + portal instead.
