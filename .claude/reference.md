# reference: crm ui patterns
Sources cached offline — do not re-search. See backend/.claude/reference.md for schema/permissions/automation.
Term map ours->monday: Workspace=Workspace, Module=Board, Collection=Group, Record=Item, SubRecord=Subitem, Column=Column, RecordValue=Cell. Missing on our side: Folder, View, Dashboard, Update feed.
## board anatomy (top->bottom)
Board header: name(inline-edit), description, star/fav, board menu(...), Integrate, Automate, Invite/avatars stack, Search, Person filter, Filter, Sort, Hide columns, Group by.
View tabs row: Main Table + added views + "+" add view.
Group block: colored collapse caret, group name(inline-edit), item count, group menu(...), "+ Add item" row at bottom.
Row: checkbox(bulk select) | color bar | item name + open-item chevron + updates-count bubble | cells | "+" add column.
Group footer: per-column aggregate (sum/avg/count/median/min/max, "Show summary on collapse").
Item panel (right drawer/modal): tabs Updates | Files | Activity Log | Info Boxes. Update composer with @mention, like, reply.
Batch action bar (appears on multi-select): "N items selected" + Duplicate, Export, Archive, Delete, Move to, Convert.
## views to support
Table(default grid) | Kanban(group by status col, drag between lanes) | Calendar(date col) | Timeline/Gantt(timeline col + dependencies) | Chart(bar/pie/line/stacked over any col) | Form(public submit -> creates record) | Files(gallery of file cells) | Map(location col) | Workload(capacity per person) | Cards.
View state persists per view: filters, sort, hidden cols, group-by, col order/width.
## ui copy (reuse verbatim-style)
Empty board: "This board is empty" / "Add your first item".
Add: "+ Add item", "+ Add group", "+ Add column", "+ New board", "+ New workspace".
Menus: Rename, Duplicate, Move to, Change color, Archive, Delete, Collapse all, Export to Excel, Copy link.
Column menu: Rename, Column settings, Filter by this column, Sort ascending/descending, Collapse, Duplicate, Move left/right, Change type, Delete.
Filter: "Filter this board", "Show items where", + And/Or, "Clear all".
Confirm delete: "Delete <name>? This can't be undone." Buttons: Cancel / Delete.
Toast: "Item deleted" + "Undo".
Search: "Search this board", "Search everything".
Invite: "Invite members", "Invite by email", role select, "Send invitation".
## interaction rules
Inline edit everywhere: single click cell -> editor popover, Esc cancel, Enter commit, Tab next cell.
Optimistic UI on cell write; revert + toast on API error.
Drag: reorder rows within/between groups, reorder groups, reorder+resize columns (resizeHandle.tsx exists).
Keyboard: Enter=open item, Space=select row, Cmd/Ctrl+K=command palette, Esc=close panel.
Colors: group color + status label colors drive row/cell tint (getCollectionColor.tsx, tint.tsx exist).
Density: row height compact/medium/tall toggle.
## automation builder UI (researched 2026-08-26: monday, zapier, n8n)
Sources cached below — do not re-search.
### the three industry shapes, and which one fits us
monday = SENTENCE BUILDER. A recipe is a natural-language sentence with underlined fill-in blanks: "When a status changes to something, notify someone". Blocks are typed (trigger block + action blocks) and a recipe is a sequence of them; trigger sentences always begin "When", actions are imperative verbs. Templates are pre-written sentences you pick and then fill. Their 2025/26 "New Automation Builder" keeps the sentence structure and only speeds up authoring.
zapier = LINEAR STEP LIST. No canvas: pick trigger app+event, pick action app+event, map fields, activate. Optimised for breadth (thousands of integrations) and for users who never see the whole graph at once.
n8n = NODE CANVAS. Free-form graph, each node a step with its own settings panel; built for branching, code and arbitrary APIs.
OUR CHOICE = monday's sentence builder. We automate ONE product's own nouns, not thousands of third-party apps, so there is no app-picking step to make linear (zapier) and no arbitrary branching to lay out (n8n). A canvas would be ceremony around a rule that is one sentence long. Reach for zapier's linear list only if we ever add external integrations; reach for a canvas only if recipes ever need real branching, which flat all/any deliberately avoids.
### the sentence rules we follow
Line keywords are WHEN / ONLY IF / THEN — words a user already knows. Never label the sections Trigger / Condition / Action in the UI; those are our words for the model, not theirs (they survive only in orientation copy and in code).
Every blank is an INLINE token sized to its content, never a full-width field: dashed + muted when empty ("something goes here"), the zinc GLASS panel when filled ("a word in the sentence"). Accent-violet fills were tried and removed — five or six per line turned the rule into a row of highlighter marks and buried the plain words between them, which are what make it a sentence.
Blanks that PICK are components/automation/BlankMenu.tsx, not native select/datalist (superseded 2026-08-27). The native ones were kept at first because keyboard, mobile pickers and screen-reader labelling come free — but their popup is drawn by the OS, so it ignores the theme entirely, and once the rule IS the form the list is the thing being read. The rule that replaced it: a hand-rolled menu must RE-EARN what it took away — ↑/↓, Enter, Escape, type-ahead search, listbox roles — or it is a downgrade dressed as a redesign. Blanks that take FREE TEXT stay a real <input>.
The form IS the preview. Once the sentence reads correctly there must be no second "in plain English" block restating it — rendering the same words twice is the clearest sign the form was not readable on its own.
Empty states here are ONE LINE, not an illustrated hero: when the toolbar already carries the only action, a hero panel repeating it is a second button pretending to be guidance. Same for explainer cards describing trigger/condition/action — they teach nothing on the second visit and never go away.
Prefer a hand-built portalled dropdown to a native <select> wherever the surrounding UI is themed: a native popup is drawn by the OS, ignores the theme, and reads as a stray form control (components/automation/ModulePicker.tsx, same pattern as BoardAccessMenu).
Conditions are hidden behind a single "+ Only if…" until wanted: an empty conditions box implies the recipe is unfinished when the trigger alone is a complete rule.
Naming comes FIRST in this builder (owner's call, 2026-08-27) and stays optional: the field's PLACEHOLDER is the live auto-name, so it rewrites itself as the rule below is built and a blank field never saves a blank name. The industry argument for naming last — being asked to name a thing before describing it is the wrong order — is answered by the placeholder rather than by the position.
Offer only what can actually run: filter impossible choices out of the list rather than showing them disabled (see actionsFor()). A disabled option still makes the user wonder what they did wrong.
Templates/recipe galleries were BUILT AND THEN REMOVED 2026-08-26 at the owner's request ("too annoying"): on a builder this small the gallery is another screen to dismiss before reaching the two dropdowns that actually do the work. If one is ever wanted again, the rule that made it survivable was: fill only the SHAPE (trigger + action types), leave every picker blank — a template that guessed your Status column is wrong or silently inert, and the gallery stops being trustworthy the first time either happens.
### automation runs live in the ACTIVITY LOG
Do not build a run feed with its own store. The engine writes an ordinary Activity row stamped metadata.automation, so "what did my automations do" is the activity feed with source=automation, and the automation page links to that filtered feed from its header rather than carrying a runs panel of its own (the panel was removed 2026-08-26 — nothing is lost, because the activity log is where an automated change already lives). An automated row carries an `automation {_id,name}` badge (bolt icon + recipe name) because it is attributed to the person whose edit set it off, which is truthful but otherwise reads as though they did it by hand; the server strips the recipe name off the front of `message` so the badge and sentence do not say it twice. Audit-trail convention this follows (ABP, HighLevel, shadcn timeline): filter chips by actor/type, a coloured dot per row, compact who/what/when line, detail in a drawer.
src: developer.monday.com/apps/docs/sentences; developer.monday.com/apps/docs/how-to-create-a-recipe-sentence; developer.monday.com/apps/docs/automation-templates; support.monday.com/hc/en-us/articles/31585338491922-New-Automation-Builder; support.monday.com/hc/en-us/articles/360001222900; uibakery.io/blog/n8n-vs-zapier; activepieces.com/blog/n8n-vs-zapier; abp.io/modules/audit-logging-ui; shadcn.io/blocks/timeline-audit-trail.
## index / listing pages
A workspace index is a FINDING screen, not a dashboard. Cards that each spend a grid cell on a chart work at four items and fail at thirty — the names stop lining up, so the eye has nothing to scan. Default to a bordered ROW LIST with one aligned name column, a compact metric (thin bar + fraction, not a headline percentage), and a search box that appears past ~8 items. Put trend charts on a dashboard someone opened on purpose, never on the index they pass through.
Identity belongs in a PROFILE BANNER at the top (LinkedIn shape: gradient cover from the entity's hashed colour, avatar straddling its lower edge, name + counts under it, entity-level actions on the right), not in an 11px navbar line. When the banner names the thing, the navbar says the generic noun ("Workspace") — saying it twice makes neither one land. components/workspace/WorkspaceBanner.tsx.
## our gaps (build order)
1 views layer (Table exists implicitly; add Kanban+Calendar) 2 item detail panel + updates 3 filters/sort/hide/group-by toolbar 4 ~~activity log~~ done 5 notifications feed 6 ~~automations UI~~ done (sentence builder; runs read from the activity log, never a second store) 7 dashboards/widgets 8 form view 9 ~~subitems~~ done (sub-records; own column scope, one level deep — see memory.md).
src: developer.monday.com/api-reference/reference/column-types-reference; support.monday.com (hierarchy, board basics, kanban, permissions); airtable.com/developers/web/api/field-model; monday.com/crm/marketplace/template/*; simonsezit.com types-of-views-on-monday-com.
