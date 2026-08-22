# BACKLOG — small, self-contained things to pick up in downtime

**What this file is:** the SHORT LIST of known, scoped, nobody-is-blocked-on-it work. Created 2026-08-19 at
the human's request — *"it needs to be a list for stuff to do in the downtime"* — because backlog items were
being appended to `NEXT-SESSION.md`, a 6,600-line running handoff where a to-do list is unfindable.

**What goes here:** something noticed in passing, already diagnosed, and small enough to finish in one sitting.
**What does NOT:** an arc, a decision the human owes, or anything needing hardware. Those stay in
[`NEXT-SESSION.md`](NEXT-SESSION.md) (the live handoff) and [`ROADMAP.md`](ROADMAP.md) (the canonical backlog
of features).

**The rule that keeps this honest:** an item is DONE when it leaves this file, not when a commit mentions it.
Each entry names where the evidence is, so nobody re-derives it.

---

## FREDERIC'S ITEMS — classified 2026-08-22

**How these were classified** against this file's own rule at the top: BACKLOG takes what is *noticed in
passing, already diagnosed, and finishable in one sitting*. An ARC, a decision the human owes, or anything
needing hardware belongs in [`ROADMAP.md`](ROADMAP.md) / [`NEXT-SESSION.md`](NEXT-SESSION.md) instead.
**Three of the five stay here; two do not.**

---

### F1. Gateway tabs still don't gate by role; Status should differ client vs gateway
⇒ **NOT BACKLOG — this is the ROLES ARC.** Belongs in `ROLES-PLAN.md`. It is S1, it is blocked, and the
blocker is diagnosed here so nobody re-derives it.

⭐ **THE SUB-QUESTION IS ANSWERED, so it is not a task.** *"on a gateway pc, is there a difference between the
browser and the exe, are the roles still gateway for both?"* — **No difference. Both are `gateway`.**
`effective_role()` at `bridge/bridge-app/fairy/config.py:273-280` derives the role from the DAEMON's config
(a controller disk configured ⇒ gateway, else client), with an explicit `role_override` winning. Both shells
on that PC ask the same local daemon. **The role belongs to the machine, not to the shell you view it through.**

⚠ **AND THAT IS EXACTLY WHY NOTHING GATES.** `ui/gateway/views/admin.js:97` reads the role from
`ctx.client.descriptor()` — which needs a RUNNING DAEMON. On a phone there is none, `descriptor()` throws,
`render()` bails to "gateway unreachable", and no gating code ever runs. **The client role is only knowable
from a machine that is not a client.** Until the role is derived CLIENT-SIDE, no amount of tab work will gate,
and the Status tab cannot know which variant to draw. That derivation is the whole of S1.

### F2. A rename button for workspaces
> ## ✅ RULED — THERE IS NO "NAME". DISPLAY THE FILE NAME.
> *(human, 2026-08-22: "we dont need a name just display the file name")*
>
> ⛔ **DELETE the separate workspace-name concept.** Do not sync two fields — there is only the `.ddcs` file.
> The UI shows its filename. Rename = rename the file. Nothing else stores a name.
>
> ### Blast radius — THREE readers, verified
> ```
>   ui/headerPost.js:151      ap.name || 'Untitled workspace'   -> show the filename instead
>   ui/settingsPanel.js:505   getMachine().name || 'unnamed'    -> WARNING, see below
>   data/profileStore.js:33   name: machine.name || ''          -> the dying profile library (already backlogged)
> ```
> ⚠ **CHECK `settingsPanel.js:505` BEFORE DELETING ANYTHING.** If it uses the name to BUILD a default export
> filename, the dependency is circular once the filename becomes the name — the fix is to read the saved
> filename directly (`fileSavedName()`), not to keep the field alive for it.
>
> ### The only real consequence, and it is a GOOD one
> A workspace never saved to a file **has no name**. Show that honestly ("Not saved", not a fake title).
> ⭐ That makes the standing principle visible rather than implied: localStorage is a TEMPORARY buffer, and
> only a file is saved. An untitled-but-named workspace was quietly claiming otherwise.
>
> ### Build
> 1. Locate where the workspace list is RENDERED. ⚠ `workspaceFiles` appears only DECLARED
>    (`settingsPanel.js:193`) and PERSISTED (`:430`) — the renderer has NOT been found yet. Start here.
> 2. Display the filename wherever the name was shown; "Not saved" when there is no file.
> 3. Rename button: prompt -> rename the `.ddcs` -> refresh. No internal field to update.
> 4. Remove the `name` field and its three readers.

### F3. Remove the clicking sounds; propose sounds for invisible states
⇒ **SPLIT — half is backlog, half is a proposal the advisor owes.**

⭐ **The ruling generalises, so record it as a rule and not just a deletion:** *a sound is only justified when
the state it reports is NOT already visible on screen.* (human, 2026-08-22)

**F3a — BACKLOG (one sitting, fully diagnosed).** In `ui/sound.js`'s `ACTION` table (`:202-223`):
- DELETE the visible-state chirps — `ui.click`, `ui.toggle`, `wizard.opened`, `wizard.closed`, `keyboard.opened`.
- KEEP/ADD **block snapping** — the human's own exception: *"ambiguous enough to be kept audible"*. It has no
  sound today; adding one is the same one-line-per-action shape.
- ⚠ Do NOT delete the EVENT/voice machinery, only the ACTION rows. The table is inert data; the synthesis is not.

**F3b — NOT BACKLOG.** *"propose new sounds for invisible states"* is a design proposal, and it is the
advisor's to write, not a task to pick up in downtime. → `NEXT-SESSION.md`.

⭐ **It also settles the iOS audio-session trade.** The objection to `navigator.audioSession.type = 'playback'`
was that it is non-mixing — a UI click would pause the phone's music. Delete the clicks and the objection
evaporates: interrupting music for a *job-failed alert* is correct; for a chirp it never was.

### F4. The V4.1 "Advanced machining" tab
⇒ **MOVED OUT — ROADMAP arc, DEFERRED.** *(human, 2026-08-22: "the advanced machining is another arc,
not doing it now.")* Five firmware-native features incl. **Array machining** and **Sequence machining**
(a `template.txt` origin list with per-cell rotation). Full evidence + the three reasons it matters now live
in [`ROADMAP.md`](ROADMAP.md) under "V4.1 ADVANCED MACHINING". Photos: `images/4.1 advance machining1 (1)/`.

### F5. The DDCS wordmark in ORGANIC: rounder, probably sans
> ⏸ **MOCK-UP FIRST, AND NOT URGENT** *(human, 2026-08-22: "make a mock up, in time")* — the advisor owes a
> visual comparison of 2-3 humanist-rounded candidates ON the green canopy band, before any code is written.
> ⛔ Do not pick a typeface from prose. The colour fix (`#A89000` is stale) and the outline-to-paths decision
> ride with the mock-up, not ahead of it.
⇒ **BACKLOG.** *(human, 2026-08-22: "the logo needs to be rounded more, maybe sans serif")*

Current mark — `index.html`, `<symbol id="mark-organic">`:
`font-family="Georgia,'Times New Roman',serif"`, **bold ITALIC**, `fill="#A89000"`.

- **Rounded: agreed, and it is the theme's own word.** Organic is `--tab-radius: 16px` and its source describes
  its motion as *"humanist soft — a slow UNFOLD"*. The wordmark is the only sharp, angular, high-contrast
  element in a theme built entirely on soft curves — it fights its own chrome.
- **Sans: yes, but HUMANIST rounded, not geometric.** Geometric-rounded reads tech-toy; humanist-rounded reads
  warm and botanical. "Humanist" is the theme's own declared adjective — match it rather than picking a taste.
- ⚠ **THE COLOUR IS STALE, AND MAY MATTER MORE THAN THE LETTERFORMS.** `#A89000` is a dull olive-gold from
  BEFORE the tree retheme. The mark now sits on the green canopy band `--band-bg: #25301a` — two desaturated
  yellow-greens fighting each other. Use the sap amber `--accent: #d9a03c` or the sapwood `--text: #ece0c6`.
  The subtitle's `#7d7d6f` grey-olive is stale for the same reason.
- ⚠ **CONSTRAINT — decide before drawing:** a rounded humanist sans is NOT a system font on Windows. For a
  LOGO the right answer is to convert the wordmark to OUTLINED PATHS: a logo whose shape depends on the
  viewer's installed fonts is not a logo. ⚠ Paths also change how `textLength` behaves — see F5b.

#### F5a — CHECKED ACROSS ALL FIVE MARKS: the stale colour is ORGANIC ONLY
*(human, 2026-08-22: "verify those 2 against the other themes too, if they also are to be fixed")*

| mark | wordmark fill | verdict |
|---|---|---|
| `mark-normal` | `#C7A900` brand gold | ✅ fine — sits on a light `--band-bg: var(--panel)` that never moved |
| `mark-studio` | `#f0eee8` over `#55514a`, two-layer engraved | ✅ fine — deliberately tuned to `--hdr-bg: var(--bg)` |
| `mark-futuristic` | `#FFF100` + `filter="url(#neon)"` | ✅ fine — the neon IS the theme |
| **`mark-organic`** | **`#A89000`** | ⛔ **STALE — the only one** |
| `mark-steampunk` | `url(#brass)` gradient | ✅ fine — brass is thematically correct |

⭐ **AND IT IS A SECOND INSTANCE OF A HAZARD THE RETHEME ALREADY DOCUMENTED.**
`ORGANIC-TREE-PLAN.md` warned: *"⛔ `--edit-glow-rgb` is the one that gets forgotten. It is the same coral in
RGB … change the accent alone and the pink survives in the animation."* The retheme moved `--band-bg` from
coral `#bf6850` to moss `#25301a` and caught the glow — **but the logo holds its own hardcoded colour and was
missed by exactly the same mechanism.** The other four marks are fine only because their bands never changed.

⭐ **THE STRUCTURAL FIX, if anyone wants it:** all five marks HARDCODE their palette, with nothing reconciling
them to the theme tokens — five two-homes instances waiting to go stale the next time a theme moves.
`fill="currentColor"` plus one CSS rule per theme would make this class of drift impossible.
⚠ It does NOT cover all five: studio needs two colours (engraved), futuristic a filter, steampunk a gradient.
It cleanly fixes **organic and normal**. Worth doing for those two; do not force the other three.

#### F5b — CHECKED: `textLength` is SHARED BY ALL FIVE, and I was wrong to call it a bug
`textLength="146" lengthAdjust="spacingAndGlyphs"` is on **every text element of every mark** — both the
wordmark and the "CNC MACRO STUDIO" line, all five themes.

⇒ **That makes it an INTENTIONAL DEVICE, not a defect.** Forcing both lines to exactly 146 units is what makes
the wordmark and its tagline align into one tidy block. ⛔ **Do not "fix" it, and do not strip it from the
other four.** I called it a deformation earlier; that was wrong — it is a justification device used
consistently.

⚠ **BUT IT IS STILL LIVE FOR THIS TASK, for a narrower reason (INFERRED, not measured):** the amount of
distortion depends on how far a face's natural width sits from 146. The three Arial Black marks are already
wide and take it well. **Organic and steampunk are Georgia — a narrower face, stretched further.** A rounded
humanist sans is narrower still, so whatever is chosen will be stretched MORE than Georgia is now.
⇒ **Whoever draws this must judge the new face AT 146 units**, not at its natural width, or it will look
right in the type specimen and wrong in the header. If outlining to paths, bake the 146 width into the paths.

---
## OPEN

### 1. Move the theme selector out of the quick menu into Settings
> ⭐ **MERGE THIS WITH ITEM 7 — ONE TURN, NOT TWO.** *(human, 2026-08-22: "yes")* Both restructure the SAME
> quick-menu popover (`ui/headerPost.js`): this item REMOVES the theme chips, item 7 moves the version INTO
> the menu footer and the workspace name OUT to the header. Done separately, that file gets opened twice and
> the layout gets re-decided twice. ⛔ Do not start either alone.
*(human, 2026-08-19)* — `headerPost.js` `themeSection` renders a heading + five `.hq-theme-chip`s in a menu the
t851 "menu diet" cut to ~9 rows. A theme is chosen once; Settings is where appearance preferences live. ⚠ Leave
NOTHING behind (a "Theme…" row that opens Settings keeps the row it was meant to free). ⚠ Reuse
`setQuickTheme()` — do not re-implement switching — and keep the active-theme ring reflecting live `data-theme`.

### 2. The exe only checks for updates at boot
*(human, 2026-08-19)* — `initUpdateCheck()` is called once from `index.html` ("one check per launch"); a release
cut while Studio is open is invisible until restart. The WEB build already re-checks on `visibilitychange`
(`initWebVersionNudge`) — the exe, which cannot reload itself and most needs telling, has no equivalent. Reuse
that pattern, throttled (`_lastWebCheck` is the precedent). ⚠ Must not re-nag a version already dismissed —
`update-check.spec.js` asserts that.

### 3. The welcome / "What's new" panel: shorter, and link to the thing it describes
*(human, 2026-08-19: "the panel on boot can be a little bit less lines and perhaps a link on each panel to go to
the function associated with the note whenever possible… maybe it's nice to have a screenshot of the function or
the menu for each note.")*

Three separable asks, in increasing cost — the first is worth doing alone:
1. **Fewer lines.** `RELEASE_NOTES[v][].full` is currently a paragraph per entry (the t2075 schema deliberately
   allowed the modal to say the HOW). It has drifted long — the t2078 notes run 4-5 lines each. Tighten the
   authored copy; no code change.
2. **A link per panel to the feature.** ⚠ OPTIONAL BY THE HUMAN'S OWN WORDS — *"not an obligation… if it's
   convenient or easy"*. Cheap version: an optional `go` field on a note (`{ short, full, go }`) whose value is
   an existing global the app already exposes (`window.openSettings`, `showApp('gateway')`, the quick menu).
   ⛔ Do NOT invent a navigation layer for this; if a note's target has no existing door, it simply gets no link.
3. **A screenshot per note.** ⚠ **MY FIRST OBJECTION HERE WAS WRONG AND IS CORRECTED, so it does not get
   re-raised:** I argued images would go stale against a weekly-changing UI. The human's answer —
   *"of course they go stale, but that's why we release new updates"* — is right, and it dissolves the problem:
   **release notes are VERSIONED AND IMMUTABLE.** A picture in the V2026.08.19.4 notes documents what
   V2026.08.19.4 introduced; it is a historical record, not a live document, and it is CORRECT for it to keep
   showing that release's layout forever.

   That reframing also makes it cheap, via a fact about the surface: **the welcome modal only ever fires for the
   version just installed** (`checkWelcomeNotice` compares stored-vs-current at boot). So only the CURRENT
   release's images can ever render — historical ones are never displayed and must NOT be accumulated in the
   bundle. ⇒ **Ship images for the newest release only; drop the previous release's when cutting a new one.**
   The note TEXT stays for history (the banner still reads older entries); the images do not.

   Remaining real costs, neither fatal: (a) someone must capture + crop at release time — a per-release chore
   the ritual has to name, or it silently stops happening; (b) they must be BUNDLED, not fetched — the gateway is
   offline-first, so a CDN URL would break exactly the shop-with-no-internet user this is for. Budget a few tens
   of KB for ~3 cropped PNGs and keep them out of `--onefile` growth by replacing rather than appending.

Files: `web/data/releaseNotes.js` (the authored source), `web/ui/updateCheck.js` (`checkWelcomeNotice` renders
one panel per entry). ⚠ `update-check.spec.js` asserts the modal's panel-per-entry structure and the
no-notes fallback — read it before changing the schema.

---

### 4. The lathe icon doesn't read as a lathe setup
> ## ✅ RULED 2026-08-22 — the last blocker is gone, this is now DISPATCHABLE
> *(human: "item 4, yes remove centerline, and draw the 2 missing")*
>
> **1. THE CENTRELINE IS REMOVED.** The entry below called this *"a deliberate break, not yet ruled on"* —
> it is ruled now. The lathe family stops sharing `rotary_center`'s red-dash "this rotates" convention; the
> chuck carries that meaning instead. ⭐ **And it buys the thing the entry already identified: red now means
> ONLY the probe ruby**, instead of meaning both the rotary axis and the probe. That is a net simplification
> of the colour language, not just a pixel budget win.
> ⚠ `rotary_center` itself KEEPS its dash — the break is lathe-only. Do not sweep the convention app-wide.
>
> **2. DRAW THE TWO MISSING: `polygon` and `face-probe`.** Follow the approved second draft exactly — solid
> headstock left, jaws stepping out of it, bed slab underneath, the per-op cut on the right. ⛔ Do not
> redesign the five that are already approved.
>
> ### ⚠ THE APPROVED DRAFT WAS JUDGED AT THE WRONG SIZE — resolve this BEFORE drawing
> This entry records the second draft as *"judged at 14px, the column that ships."* But the human later ruled
> **16px, all of them, with the UI adapted** (see the icon-size item). ⇒ the approved silhouette was assessed
> at a size it will not ship at.
> ⭐ 16px is 30% more pixels, which usually HELPS a detailed silhouette — but the headstock/jaws/bed stack was
> tuned to survive 14px, and a mark tuned for a smaller box can read empty or loose when scaled up.
> **Re-judge the five approved marks at 16px FIRST**, then draw the two new ones directly at 16px.
> ⛔ If any of the five now reads wrong at 16px, REPORT it — do not silently retune an approved mark.
>
> **VERIFY:** all seven rendered together at the shipping size, in the real app, as a screenshot. The human
> judges these visually, not from a description — that is the standing rule for icon work here.
> ## ⭐ SETTLED 2026-08-22 — decided across a long session, recorded here so it is dispatchable
>
> **WHICH ICONS: both families** *(human: "all lathe icon are wrong")* — the question this entry opened with
> is answered.
>
> **THE DIAGNOSIS.** The shipped set is a steel bar on a red dashed centreline: **no chuck, no bed, no tool
> post**. Every reference lathe mark the human supplied carries a headstock left, a bed underneath, a
> tailstock right and a tool post mid-bed. Ours draws the STOCK, not the MACHINE.
>
> **⛔ A FIRST REDESIGN WAS REJECTED.** Three stacked rectangles (bed slab + headstock + bar) — human:
> *"still just a slot shape not a machine shape."* Uniform silhouette reads as a slot; the references get
> their machine-ness from an IRREGULAR profile.
>
> **✅ THE SECOND DRAFT IS APPROVED — judged at 14px, the column that ships.** Solid headstock left, jaws
> stepping out of it, bed slab underneath, per-op cut on the right. Drafted in the icon sheet artifact.
>
> ### The trade that bought it
> ⛔ **The red dashed centreline is DROPPED.** Its pixels pay for the headstock and bed. ⚠ t1911 deliberately
> tied that dash to `rotary_center`'s "this rotates" convention app-wide, so the lathe family stops sharing
> that mark with the rotary ops. A chuck says *rotates* better than a dash — but it is a deliberate break,
> **not yet ruled on**. ⭐ It does buy one thing free: red then means only the probe ruby, instead of meaning
> both the axis and the probe.
>
> ### What is NOT done
> - **Only 5 of 7 drafted** — facing, parting, OD-turn, centre-drill, OD-probe. ⛔ **polygon and face-probe
>   were never drawn** and must match the same frame.
> - The approved drawings live only in the artifact; nothing is in `ui/wizIcons.js`.
>
> ### ⭐ SIZE — 16px for EVERY icon, and it is not a resolution question
> *(human, 2026-08-22: "if we can try 16px that can work" … "all of them though")*
>
> ⛔ **This is a GLOBAL change, not part of the lathe redesign** — every entry in `ui/wizIcons.js` (15 with a
> hardcoded size, mill + probe + lathe + ATC alike) goes from 14px to **16px**. Do it as its own commit,
> separate from any redesign, so a size regression and a drawing regression can never be confused.
>
> The icons are **pure SVG, zero raster** — all `viewBox="0 0 24 24"` with a hardcoded
> `width="14" height="14"`. Nothing to re-save; the render size is an attribute.
> ⭐ **Better than editing 15 literals: DROP the hardcoded width/height and size from CSS.** The menu and the
> new icon-only reopen chips have different needs, and one source beats fifteen — the same declare-once shape
> as everything else in this backlog.
>
> ### ⭐ ADAPT THE UI TO THE ICONS — do not shrink the icons to fit the UI
> *(human, 2026-08-22: "yes adapt the ui for it")*
>
> 16px is the DECIDED size; the surrounding layout gives way, not the icon. Row height, line-height,
> baseline alignment and padding all adjust to accommodate it.
> ⛔ **If a row gets tight, do NOT reduce the icon back toward 14px** — that is the reflex to resist, and it
> would silently undo the decision while looking like a fix.
> ⚠ Surfaces to check and adapt, not just one: the wizard menu (deliberately cut to ~9 rows by the t851
> "menu diet" — +2px per row is real vertical cost there), the Blocks palette, the Blocks tab, the quick
> menu, and the new icon-only reopen chips.
> ⚠ Where an icon sits inline with text, the fix is usually `vertical-align` / `line-height` rather than a
> wrapper — several of these carry a hardcoded `vertical-align:-2px` tuned for 14px that will be wrong at 16.
> ⚠ Bigger is not automatically better: t1918 deliberately COARSENED the lathe family for 14px (the polygon's
> facets, the old probe ball). Those marks scale cleanly but look SPARSE — detail cut for a small size does
> not return by enlarging. ⭐ The machine frame has the opposite property: drawn to survive 14px, it has
> headroom at 16px for detail it does not currently use.

> ### ⚠ COUPLED TO THE REOPEN CHIPS
> Those are **icon-only** and inherit this set — so a lathe machine silhouette is a far better tell beside
> lathe G-code than a rod. ⛔ But do NOT gate the chips on this: the human ruled ship-first, redesign only
> what proves illegible in use.

*(human, 2026-08-19: "the lathe icon is not really looking like a lathe setup")*

⚠ **Establish WHICH icon before touching anything — there are two distinct families and they have different
histories:**
- **The lathe OP icons** (`ui/wizIcons.js`, `user_lathe_facing` / `odturn` / `parting` / `centerdrill` /
  `polygon`) — a deliberately-designed set (t1911) sharing one constant: a steel bar on a red dashed
  centreline, each op differing by what the CUT removes. ⚠ These were ALREADY revised once (t1918) after the
  human found the first pass too small at the real 14px render — the fix was heavier, fewer marks, re-derived
  from `rotary_center`'s proven weight. Do not quietly undo that.
- **The lathe MACHINE-KIND mark** — whatever represents "this workspace is a lathe" (the identity line renders
  `· Lathe` as TEXT today; `settingsPanel.js` has `latheEnvelopeSvg`). If the complaint is about the machine
  rather than the ops, this is the one, and it may not exist as an icon at all.

**Ask the human which, and get the specific "doesn't look like":** a lathe setup reads as chuck + bar +
tool-on-a-cross-slide; the current op family draws bar + centreline + cut only, with no chuck and no tool
post — which is a plausible reason it reads as "a rod" rather than "a lathe". ⚠ Whatever changes, it must
survive **14px** — that constraint is what t1918 was entirely about, and it is where the first attempt died.

### 5. ⛔ A raw NUL byte makes `macrosApp.js` INVISIBLE TO GREP
*(found 2026-08-22 while re-running the t2139 orphan sweep)*

`web/ui/macrosApp.js:658`, inside `autostartGenSig()`, contains an actual **0x00 byte** in a string literal
(used as a separator), not the two-character escape `\0`. `file(1)` reports the module as `data`; grep and
ripgrep classify all 172,647 bytes as BINARY and skip it silently.

⭐ **THIS IS A REVIEW HAZARD, NOT A COSMETIC ONE.** Every grep-based sweep of `web/` has been blind to a
live 2,000-line module. It is why the duplicate `homingPostIsExpert` survived a full sweep, and it produced a
FALSE NEGATIVE that made me wrongly call a true finding "invented".
⚠ **Three other files carry NUL bytes** — `DDCS-Studio/WORK-LOG.md`, `docs/archive/WORK-LOG-early-eras.md`,
`analytics/test/worker.test.mjs`. **So grep over WORK-LOG.md is unreliable too**, which matters because the
handoff protocol greps it.

**Fix:** replace the literal NUL with `\0` (or a normal separator such as `␟`). ⚠ If the byte is load-bearing
for the signature's value, changing it INVALIDATES every stored `autostartGenSig` — check whether a
mismatch merely shows a staleness note or triggers a regeneration before changing it.

### 6. Hand-authored T.nc / error.nc G-code is DISCARDED on reload
*(found 2026-08-22, same sweep — and only findable because of the item above)*

`ui/macrosApp.js:607-626` writes `getSettings().systemHooks.T` and `.error` — the user's **hand-written**
tool-change and error macros. `loadSettings()` (`ui/settingsPanel.js:391+`) is a WHITELIST and does **not**
list `systemHooks`. ⇒ written → persisted → **silently dropped on the next load**. `macrosSynced` (`:798`)
goes the same way; a sweep counted **four** persisted-then-dropped keys total.

⛔ This violates the standing principle that a saved file is USER-OWNED. ⚠ **Reproduce the loss first** —
confirm the save path serializes the live object before assuming the chain; do not fix on this trace alone.
⚠ The real fix is probably not "add four keys": a whitelist that silently drops anything unlisted will do
this again on the NEXT setting somebody adds. Decide whether unknown keys should be PRESERVED rather than dropped.

### 7. The header shows the VERSION where it should show the WORKSPACE
> ⭐ **DO THIS TOGETHER WITH ITEM 1** *(human, 2026-08-22)* — same popover, same file. The menu gets its
> final shape once: theme chips OUT (to Settings), version IN (footer), workspace name OUT (to the header).
*(human, 2026-08-22: "i think the workspace should be visible instead of the version number, and version
number should be in the bottom of quickmenu, we can repeat the workspace name with more info in the
quickmenu still, maybe with 1-2 more datapoints.")*

**The principle:** the version is a **lookup** fact — consulted when reporting a bug or verifying a release.
The workspace is an **identity** fact — needed continuously. Header space belongs to identity.

```
  HEADER                                     • = unsaved to file
  ┌──────────────────────────────────────────────────────────────┐
  │  DDCS                MILLING-DDDD4.1 •   [∨] [💾]   <> STUDIO│
  │  CNC MACRO STUDIO    └── OUTSIDE the brand <a> ──┘           │
  └──────────────────────────────────────────────────────────────┘

  QUICK MENU
  ┌────────────────────────────────────────────┐
  │ Workspace: MILLING-DDDD4.1 · DDCS        ↧ │   (unchanged)
  │ V4.1 · X 860  Y -855  Z -80                │   (unchanged)
  │ Saved 14:22 · this PC             ← NEW    │
  ├────────────────────────────────────────────┤
  │ [💾 Save]                    [📂 Open]     │
  │ ✨ Wizards…      📂 Load…                  │
  ├────────────────────────────────────────────┤
  │ V2026.08.22.2                     ← MOVED  │
  └────────────────────────────────────────────┘
```

#### ⛔ THE TRAP — read this before touching index.html
`index.html:129` puts `<span class="ver">` **INSIDE** `<a class="brand" href="https://ddcs-studio.pages.dev">`.
Drop the workspace name into that slot as-is and **clicking your own workspace name navigates to the website.**
The name must live OUTSIDE the anchor. The version, moving to the menu, leaves the anchor entirely.

#### The one added datapoint, and why only one
`Saved 14:22  ☁` — both halves already exist in `data/backup.js` (`fileSavedAt()`, `fileSavedPlace()`).
No new state, only surfacing.

⭐ **WHERE matters more than it looks** in a two-PC shop: *saved locally* and *saved to Drive* are completely
different answers to **"will the mill PC see this?"** — and nothing in the UI answers that today.
*When* without *where* is half a fact.

#### ⭐ WHERE IS AN ICON, NOT WORDS *(human, 2026-08-22: "the where its saved can be a icon")*
And the data makes this easy: **`fileSavedPlace()` (`data/backup.js:355`) returns exactly TWO values** —
`'cloud'` or `'local'`, nothing else. A binary is precisely the case where an icon beats a word: the text form
spends ~9 characters (`· this PC`) on one bit.

```
  Saved 14:22  [disk]     local  — this PC only
  Saved 14:22  [cloud]    cloud  — travels to the other PC
```

⚠ **DO NOT put these in `ui/wizIcons.js`.** That file holds OPERATION icons (drill, bore, pocket, the lathe
family) and has no chrome icon in it — a save-location glyph is UI CHROME, a different category. Find where
the quick menu's existing chrome glyphs come from (the save/folder/chevron marks) and add it there. Putting a
chrome icon in the op-icon registry is a miscategorisation that the next reader inherits.

⚠ **Give it a `title`.** Two states are legible, but the first encounter is still a "what does that mean"
moment; the tooltip costs nothing and removes it. ⛔ Emoji are NOT acceptable here — the app's icons are pure
SVG with zero raster, and emoji render differently per platform.

⚠ **THE TIMESTAMP NEEDS A HONESTY RULE**, or it lies by omission:
```
  today      ->  Saved 14:22
  yesterday  ->  Saved yesterday 14:22
  older      ->  Saved Aug 19 · 14:22
```
A workspace last saved three days ago must not read as if it were saved this afternoon — that is precisely
the wrong impression before an overwrite.

#### ⛔ CUT by the human — do not reinstate
- **"Not saved to a file" as its own line.** *("not usefull")* The header dot already carries it.
- **The filename row** (`MILLING-DDDD4.1.ddcs`). *("only keep the timedate stamp")* It is the workspace name
  from the line above plus an extension — pure redundancy.

#### ⭐ The dirty dot is the real win
Once the name is in the header, the unsaved marker rides with it, the way an editor marks a modified tab.
`isWorkspaceDirtyToFile()` (`data/backup.js:397`) already exists — this is an invisible state made visible
where the eye already is. ⚠ It pairs with the standing rule that localStorage is a TEMPORARY buffer and only
a file is "saved".

#### ⚠ Two build cares
- **Names are variable-length; the version was not.** `V2026.08.22.2` is a fixed 13 chars. A workspace can be
  `Aluminum bracket - Jones run 3`. Needs `max-width` + ellipsis + a `title` tooltip. ⚠ The narrow header is
  real and already exercised — see `verification/t2099-header-390.png`.
- **Keep the version SELECTABLE** in the menu footer. It is read to confirm a release actually landed; a
  decorative footer label that cannot be copied is a regression for that use.

#### Also worth doing in the same pass
Make the header name itself open the quick menu on click, not only the chevron. Clicking your workspace name
to get workspace actions is the obvious gesture; the chevron then becomes a second door rather than the only one.

**Files:** `web/index.html` (move the span out of the anchor), `web/ui/headerPost.js` (menu head + version
footer, `Workspace:` line is at :151), `web/styles.css` (truncation).

### 8. ⛔ `M6.rc` is offered as an EDITABLE G-code file — it is a compiled GUI resource
*(human, 2026-08-22: "is m6.rc the right filename? not .nc?" — the name is right; the classification is not)*

`data/controllerFiles.js:50` declares, in the V4.1 tree:
`{ path: 'M6.rc', title: 'M6.rc', sub: 'Tool-change dialog', editable: true, seed: true }`

**But `M6.rc` is not G-code.** Its first lines, from the real firmware dump
(`bridge/controllers/v4.1/assets/firmware/ddcs v4.1/ddcsv4(2025-04-04)/.../M6.rc`):
```
/*  SEGGER Microcontroller GmbH & Co. KG
 *  C-file generated by:
 *     GUI_Builder for emWin version 5.12
 *     Compiled Jun 29 2011 ...
```
It is a **compiled dialog resource for the controller's embedded GUI toolkit**. Studio currently presents an
embedded-GUI C file inside a G-code editor, with G-code highlighting, and offers a LAN push button for it.

⭐ **AND THE EDITABLE LOGIC IS SOMEWHERE ELSE.** `slib-m.nc:11-13` shows what `M6.rc` actually is —
just the popup:
```gcode
G0G53X#1300Y#1301        <- the move
MarcoDialog "M6.rc"      <- ONLY pops the dialog
G43H#17                  <- the offset apply
```
The tool-change SEQUENCE is in `slib-m.nc`, which Studio already declares. So the "Tool-change dialog" entry
points at the one part of the pair a user cannot usefully edit.

⭐ **THE `.rc` FAMILY ALSO EXPLAINS THE ADVANCED-MACHINING SUBMENU** (see ROADMAP "V4.1 ADVANCED MACHINING"):
`array.rc`, `advstart.rc`, `advstart-array.rc`, `advstart-sr.rc`, `break.rc`, `break-array.rc`, `break-sr.rc`,
`center.rc`, `adjush.rc`. Those features are FIRMWARE DIALOGS, not user macros — which sharpens that arc:
Studio can surface the DATA those dialogs read (e.g. `template.txt`), never the dialogs themselves.

#### ⚠ VERIFY BEFORE CHANGING — this decides what a user may touch on their machine
1. Does the controller load `M6.rc` from disk at RUNTIME, or is the dump copy merely source baked into
   firmware? That decides whether "push" is meaningless or actively DANGEROUS.
2. Is `advstart.nc` real, or did the tree conflate it with `advstart.rc`? The Macros tab shows
   `advstart.nc — Advanced start (boot)`, which sounds right, but the `.rc` twin exists.
3. Did any OTHER `.rc` entry leak into a declared tree the same way? Audit `controllerFiles.js` for
   non-`.nc` paths carrying `editable: true`.

#### ✅ RULED — REMOVE THE ENTRY
*(human, 2026-08-22: "id remove it if no one should edit it")*

**The condition is met, and it needed no hardware to answer.** `M6.rc` is a GUI_Builder-generated C file for
an embedded graphics toolkit — editing it meaningfully requires that tool and a compile step. It is a
firmware asset, not something an operator authors. The unverified runtime question only decides whether a
push would be DANGEROUS or merely USELESS; it does not change whether anyone should be editing it.

⭐ **THE DECIDING ARGUMENT, and it is a consistency one:** the declared tree ALREADY OMITS every other `.rc`
file on the controller — `array.rc`, `advstart.rc`, `break.rc`, `center.rc`, `adjush.rc` and the rest are all
absent. `M6.rc` is the ONLY non-`.nc` path in ANY declared tree (verified: one hit across the whole file).
Its presence was the anomaly. Removing it makes the tree what it evidently meant to be — G-code files only.

**THE CHANGE:** delete the `M6.rc` line from `CONTROLLER_FILES['ddcs-v41'].tree` (`data/controllerFiles.js:50`).

⛔ **A TEST DEPENDS ON IT AND WILL GO RED — that is EXPECTED, not a regression.**
`tests/controller-file-tree.spec.js:38` asserts the V4.1 tree contains `'M6.rc'`:
```js
expect(v41, 'V4.1 shows its firmware files (not the Expert builders)')
  .toEqual(expect.arrayContaining(['advstart.nc', 'M6.rc', 'selcoord.nc', ...]));
```
Remove `'M6.rc'` from that array. ⚠ Do NOT weaken the assertion — the OTHER names in it are load-bearing, and
the sibling `not.toContain('camN.nc')` guard two lines below must stay exactly as it is (it went vacuous once
already on a rename, at t2117, and was repaired at t2118).

⚠ **Consider in the same pass, do not assume:** `slib-m.nc`'s subtitle is "M-macro library". Since the actual
tool-change SEQUENCE lives there (`slib-m.nc:11-13`), a user who came looking for tool change now has nothing
pointing them at it. Whether the subtitle should say so is a judgement call — raise it, do not silently reword.

#### ✅ THE "RUNTIME OR BAKED-IN?" QUESTION IS NOW SETTLED — no machine needed
*(human, 2026-08-22: "is it editable" — the file answers it)*

`M6.rc` is **465 lines of real C source**, not a declarative resource table:
```c
#include "DIALOG.h"
#define ID_FRAMEWIN_0   (GUI_ID_USER + 0x4A)
#define ID_BUTTON_0     (GUI_ID_USER + 0x53)
```
C source must be COMPILED before it can draw anything. A controller cannot interpret it. ⇒ the `.rc` on the
controller's disk is **vendor BUILD MATERIAL shipped inside the firmware package** — the source the dialog was
compiled FROM — and `MarcoDialog "M6.rc"` names a dialog already baked into the firmware binary.

⇒ **Editing it in Studio changes NOTHING on the machine.** Best case a push is inert; worst case it overwrites
a file the firmware package expects intact. There is no version of this entry that does something useful,
which is why the removal is not a risk-appetite judgement — it removes something that could never have worked.

⚠ **STILL UNVERIFIED (needs the machine, does NOT block this removal):** whether `advstart.nc` in the tab is
real or got conflated with its `advstart.rc` twin. ⭐ Given the finding above, treat EVERY `.rc` in that
firmware directory as build material — so if any other declared entry ever resolves to a `.rc`, it is the
same defect.


### 9. SPLIT THE ONE MENU IN TWO — the logo owns the APP, the filename owns the FILE
*(human, 2026-08-22: "should we split the menu items in 2, using the ddcs logo as a entry point" — agreed, and sequenced AFTER t2147 lands)*

**The diagnosis: the quick menu is two menus wearing one hat.** Its rows do not share a scope —

```
  Workspace identity · Saved <when> · Save · Open · Load…      FILE scope
  Wizards… · Settings… · theme chips · the version             APP  scope
```

⛔ **And t2147 makes the mismatch WORSE, which is why this follows it.** Once that menu hangs off the
workspace filename, *"Settings…"* under your filename reads as **this file's** settings. Filename-as-menu-door
is a normal, well-established pattern (Figma's `[file name ∨]` is exactly it) — **but only when the menu holds
file-scoped actions.** Ours does not yet.

### ✅ THE SPLIT, WORKED OUT WITH THE HUMAN 2026-08-22

**The test that resolves every row:** *does going through this door bring something INTO your work, or come
out of it?* Save/Open/Load/Insert/Export obviously do. Wizards inserts an op into THIS program. Setup sheet and
checklist are documents ABOUT this job. Everything else is about the product itself.

```
  ┌─ DDCS ∨ ─────────────┐   ┌─ <filename> ∨ ─────────────────┐
  │  ⚙  Settings…            │   │  Workspace: … · role · envelope     │
  │  ────────────────────  │   │  ──────────────────────────────  │
  │  ❓ Help — FAQ & About   │   │  💾 Save          📂 Open        │
  │  ↓  Get Studio for desk… │   │  ──────────────────────────────  │
  │  ⭐ Rate / Feedback      │   │  📘 Library…   ✨ Wizards…        │
  │  ────────────────────  │   │  📁 Load…  ➕ Insert…  ↧ Export…  │
  │  V2026.08.22.2           │   │  ──────────────────────────────  │
  └────────────────────────┘   │  📄 Setup sheet…  ✅ Setup checklist │
     THE PRODUCT — small,       └──────────────────────────────────┘
     rarely visited                THIS JOB — the working menu
```
⭐ **THE LOPSIDEDNESS IS CORRECT, not a flaw.** The product menu SHOULD be small and rarely opened. The file
menu carries the weight because that is where the work happens. A 50/50 split would mean the line was drawn
in the wrong place.

⭐ **LIBRARY GOES IN THE FILE MENU** *(human: "shouldnt library be in the file menu?")*. Its NAME sounds
app-ish — a library is where you look things up — but its FUNCTION is a **loading dock**: you go in to bring
something back. `libraryModal.js:2` — "ONE tabbed modal for the user's stuff: **Projects · Wizards**".
**Projects** is your saved work browsable in folders (`projects/projectStore.js`); **Wizards** is the
catalogue, built-in plus your own. Both are unambiguously "bring something into the current job".

⚠ **A STALE COMMENT FOUND WHILE DECIDING THIS — fix it in the same turn.** `headerPost.js:206` reads
*"the Library: one door to Profiles · Projects · Wizards"*, but the **Profiles tab was RETIRED at t1217**
(`libraryModal.js:3`: "the Profiles tab retired with the profile library; the workspace's ONE machine lives
in Settings"). The tab went; the comment advertising it stayed — the removal-chain pattern again.

⭐ **DOES "PROJECTS" NAME ITSELF? A NEAR-MISS WORTH RECORDING** *(2026-08-22)*. The human proposed RETIRING
projects on the premise that *"a project is a wizard in a specific config — most of the time we dont need to
repeat it exactly and the wizard alone is fine."* ⛔ **The premise is wrong**: a `.mjson` holds a MULTI-OP
PROGRAM (`projectModal.js:194` imports via `openMacroText`; the failure reads "Not a valid .mjson macro"), and
it is not browser-trapped either — there is a Drive volume (`:283`, `:440`) and file Import/Export (`:90`,
`:387`). Retiring it would have deleted the JOB LIBRARY.

⚠ **BUT THE MISREAD IS THE FINDING, not the error.** The person who BUILT this app modelled a project as one
wizard's parameters. If it does not read as a job library to him, it reads that way to nobody. The label is not
carrying its meaning — "Projects" gives no hint these are whole programs, where **"Jobs"** or **"Programs"**
would. ⭐ The menu split is exactly when labels get looked at, so weigh a rename then; ⛔ but do NOT rename
on this note alone — it is a naming call for the human, and `.mjson`/`projectStore`/the drawer all carry the
word.

⭐ **THE SHAPE THAT CAME OUT OF IT, and it is coherent — no redundancy to resolve:**
```
  .ddcs workspace  =  THE MACHINE   config, settings, user files + whatever program is loaded
  .mjson project   =  A JOB         the program itself, in folders, local + Drive
```
ONE workspace, MANY projects — one mill, many parts. The only surviving overlap is that the workspace ALSO
carries a program, so "save what I am working on" has two answers; the disk chip already says
"Workspace: …", which probably settles which one the Save button means.

⚠ **THREE DOORS TO "OPEN A SAVED THING", within four rows of each other:** `Open`, `Load…`, and
`Library → Projects`. They may be genuinely distinct (open a WORKSPACE vs load a PROGRAM into the editor) —
**CHECK BEFORE BUILDING.** If two are the same act, this split is the natural moment to collapse them; if
they differ, the LABELS must say how, because right now they do not.

### The shape
```
  ┌─ DDCS ∨ ────────────┐              ┌─ MILLING-DDDD4.1 ∨ ─┐
  │  Settings…          │              │  Saved 14:22  ☁     │
  │  Wizards…           │              │  Save    Open       │
  │  Theme  ▸           │              │  Load…              │
  │  ─────────────      │              └─────────────────────┘
  │  Open the website   │
  │  V2026.08.22.2      │                 FILE scope — what t2147 built,
  └─────────────────────┘                 minus the three app rows
     APP scope — new
```
The split runs along the one line people actually navigate by: **am I acting on the APP, or on this FILE?**

### ⭐ THE SECOND PAYOFF — it dissolves the hazard that drove t2147's whole layout argument
The brand logo is currently an `<a href="https://ddcs-studio.pages.dev">` that **navigates AWAY from the app**.
That is the mis-click risk that forced the workspace chip across the header in the first place. **Make the
logo a MENU BUTTON and the hazard is gone** — and "open the website" becomes one ROW inside it, which is where
it always belonged. ⇒ this is not just tidying; it removes a live footgun.

### ⛔ UN-LINKING THE LOGO IS A REMOVAL — sweep the chain
The `<a class="brand">` stops being a link. Account for every survivor: the `href`, `target`, `rel`, its
`title` tooltip, any `:hover`/`:visited` styling that only made sense on a link, and any test asserting the
brand navigates. ⚠ A test that checks the logo links out must be **INVERTED** to assert it opens the menu —
not deleted. ⚠ Keep it a real `<button>` with the accessible name the anchor had, so the tab order and screen
readers do not regress.

### What moves, exactly
- **OUT of the file menu, INTO the app menu:** `Settings…`, `Wizards…`, the theme control, and the version.
- ⚠ **The version is moved TWICE across the two turns** — t2147 puts it in the quick-menu footer, this turn
  moves it to the app menu. That is one row and it is cheap; do not "optimise" by skipping t2147's placement,
  which is correct for the menu as it exists at that moment.
- ⚠ **Theme:** t2147 already relocates the chips to Settings. So the app menu's `Theme ▸` is a POINTER to that
  Settings section, not a second copy of the chips. ⛔ Do NOT reinstate chips in the menu — BACKLOG item 1's
  own warning applies: a row that merely opens Settings must EARN its place, or it keeps the row it freed.
  ⇒ if `Settings…` already reaches the theme in one step, **drop `Theme ▸` entirely** and say so.
- **STAYS in the file menu:** the identity line, `Saved <when> + place icon`, `Save`, `Open`, `Load…`.

### ⚠ Cares
- **Two menus, one dismissal contract.** `ui/opContextMenu.js`'s `openMenu()` already exists precisely so
  there is not a second floating-menu implementation to dismiss, clamp to the viewport and forget on
  `ddcs:stop-previews`. ⛔ Reuse the existing menu machinery; do not write a second popover.
- **Opening one must CLOSE the other.** Two menus that can be open simultaneously is a bug, not a feature.
- ⚠ **The narrow header.** Two entry points instead of one, at opposite ends. Verify at 390px
  (`verification/t2099-header-390.png`) that both survive alongside the tabs.
- ⭐ **Recent ▸ is NOT in scope** — it is drawn in the sketch above as where it would go, not as work. Do not
  build it.

**Verify:** screenshots of BOTH menus open (separately), desktop and 390px, so the human can judge the split
visually — the standing rule for anything that changes what a surface looks like.


### 10. MULTI-OP APPROACHABILITY: the wizard preview shows ONE op, with no idea where it sits
*(design conversation with the human, 2026-08-22)*

**The complaint:** *"without [a cad editor] multiop is lacking approachability."* Open a wizard on op 3 of a
12-op program and you cannot see where your pocket sits relative to anything else.

⛔ **IT IS NOT A CAD PROBLEM — that was ruled out in the conversation and must not be reopened.** The human's
own reframe settles it: *"we are sortof modeling using the gcode toolpath themselves."* There is no part to
model — the ops ARE the model. `viz/featureCanvas.js:5` already states the commitment defensively: handles
drive PARAMETERS, never freeform geometry, *"so we never reopen the CAM trap"*.

### What actually exists (measured, not assumed)
```
  createPreviewPanel   ONE component, THREE hosts (Studio editor · Blocks · wizard).
                       The ONLY difference is opts.getGcode.
    Studio / Blocks    fed the WHOLE program   -> the multi-op view ALREADY EXISTS
    wizard             fed host.__gcode        -> just THIS op   (wizardManager.js:591)
```
⭐ So no new surface is needed. The whole-program view is already there in two hosts; the wizard simply is
not given it, and neither host can say WHICH op a line belongs to.

### ⭐ THE FIX: FEED THE WIZARD'S PREVIEW THE WHOLE PROGRAM
*(human: "would it make sense to add whole program to wizard previews?" — yes, and it is better than the
backdrop the advisor first proposed; that earlier answer is superseded, see the note at the end.)*

`wizardManager.js:591` is `getGcode: () => host.__gcode || ''` — that op's code alone. Give it the program.

⭐ **THE ARGUMENT THAT DECIDES IT: the per-op sim inputs exist BECAUSE the op is previewed in isolation.**
```
  getStart · getStartHints · getPinnedStarts
     ↳ they HINT where the op begins, because nothing before it is traced
```
Trace the whole program and the start position is **COMPUTED, not hinted** — it falls out of the preceding ops.
So this does not fight that machinery, it removes the reason some of it exists. And it is ONE code path: the
same `getGcode` the Studio and Blocks hosts already use, proven at whole-program scale.

### ⚠ Two things it must answer — neither argues for a backdrop
- **PLAY SCOPE.** Press Play while editing op 3 and you would sit through ops 1-2. ⇒ Play starts at THIS op's
  first line, not the program's. That is a start OFFSET, not a different renderer.
- **RE-TRACE COST**, the one real risk. ⭐ Mitigation: ops BEFORE yours do not change while you type — trace
  them once and re-trace only from your op onward. The trace is already segmented by `emitMapped`'s `map`.
  ⚠ MEASURE this before assuming it is fine; a 12-op program re-tracing per keystroke is the failure mode.

⚠ **FALLBACK IF THE TRACE COST PROVES PROHIBITIVE** (and only then): draw the rest of the program as a STATIC
BACKDROP, re-traced only when the program changes, with Play left scoped to this op. ⛔ It is the fallback, not
the plan — it keeps the isolation AND adds a second render path, which is why it lost.

### Then, if that is not enough
- ⭐ **Emphasis, not hue, to distinguish ops** — selected op bright, the rest dimmed. ⛔ Do NOT colour per-op:
  that channel is TAKEN (`gcodeViz3d`: *"Feed moves: bright, tinted by Z depth. Rapid moves: dim red"*), and
  twelve op-colours would destroy the legend that says what is a rapid and how deep you are.
- An **op selector** — already specced as the reopen-chip item; put it on `createPreviewPanel` so all THREE
  hosts gain it at once, rather than inside the wizard modal where only one host benefits.
- **Handles composed into the preview** — the overlay seam exists (`featureCanvas.js:71`, an overlaid
  `toolpath2d` re-pins from the host `_tf`, pixel-exact under the handles). ⚠ This is the REAL engineering:
  joining two components that each own a view transform. Do not start here.

⚠ **Order matters.** Backdrop first; it is cheap and it TESTS whether the rest is warranted. Two more ambitious
designs were argued and dropped in the same conversation — a program-scoped canvas (would add a fourth surface
beside a component already doing the job) and an op selector inside the wizard modal (helps one host of three).
⛔ Do not resurrect either without new evidence.

## THE JOBS FOLDER IS SETTABLE — FOLD THE "SYNC FOLDER" ROUTE INTO **LOCAL**, NOT A THIRD OPTION
*(human, 2026-08-20: "i dont like that it would look like a 3rd option can we fold this in the local folder
option". Correct, and the reason is structural: **a synced folder IS a local folder.**)*

⭐ **THE GATEWAY DOES NOT KNOW OR CARE THAT A FOLDER SYNCS.** `LocalFolderBackend` polls whatever directory
it is handed. Pointing `local_root` at `C:\Users\you\Google Drive\DDCS Bridge` gives PC-to-PC transport with
**no adapter, no OAuth, no quota, no new code** — the sync client does the moving, and that arrangement is
between the user and Dropbox/Google, invisible to the app. ⛔ So it must NOT appear as a third transport
beside Local and Drive; that would invent a mode where there is only a path.

### THE ONLY THING MISSING: `local_root` HAS NO SETTER
⛔ Not in `Config._PERSIST_KEYS`. ⛔ Not in `Ops.set_config`. ⛔ Not in the Setup UI. ✅ Only the CLI
`--root`, which the exe never passes. ⇒ The capability exists and is unreachable from the app.

⚠ **THIS IS THE SECOND FIELD WITH EXACTLY THIS SHAPE** — `drive_folder` was the same (declared, no setter,
resets every restart; corrected during S4 by using `machine_name` instead). **Two is a pattern, not a
coincidence:** a `Config` field is cheap to add and easy to leave unwired, and nothing fails loudly when it
is. ⭐ Worth a check that every `_PERSIST_KEYS`-eligible field is either wired to `set_config` or explicitly
marked CLI-only — the same family as the connectivity check already on this list.

### THE BUILD
1. `local_root` into `_PERSIST_KEYS` + `Ops.set_config`, validated as a writable directory.
   ⚠ `dest` validates as a network share; this is the opposite — a LOCAL path, and a UNC would be a
   different (untested) story. Say which you accept.
2. One field in `admin.js` **under the existing Local radio**, showing the current root, with a one-line
   hint that a synced folder reaches other PCs. ⛔ No new radio. ⛔ No "sync" mode anywhere in the code.
3. ⚠ **Changing the root ORPHANS whatever sits in the old inbox** — same class as S4's migration question.
   Detect and report; ⛔ never move files on the user's behalf.

### ⚠ THREE SYNC-SPECIFIC HAZARDS, only once this is a SUPPORTED path
- **Write ORDER is load-bearing and sync does not preserve it.** `put_job` writes `.map.json` BEFORE `.nc`
  because `list_inbox` keys off the `.nc` — the moment it appears the job is claimable. A sync client gives
  no ordering guarantee between two files, so a job can be claimed before its sidecar lands.
- **Conflict copies become jobs.** `job (1).nc` matches the `.nc` suffix and would be claimed as real.
- **Both PCs must sync the same folder** — the part users genuinely do work out themselves.
⇒ ⭐ **None of these block a user doing it manually today.** They are the cost of making it discoverable,
and they are the honest reason it is a documented path rather than a promoted feature.

---

## WIZARD PREVIEW PANES: A SENSIBLE DEFAULT FOR SOMEONE WHO HAS NEVER DRAGGED
*(the residue of t2113. The reported defect — "both panes open at ~40px" — is FIXED; this is what is left.)*

**FIXED, do not re-report:** the app's fit-to-screen clamp was being WRITTEN BACK over the user's dragged
height (`applyVisualHeight` persisted the heal), so a drag survived until the next tight layout and then
vanished — reopening at the 160px floor, which after ~92px of pane headers leaves **~40px per pane**. That
number was reproduced exactly (51 then 34 across opens) and matches the human's report. The heal now
APPLIES without being SAVED. ⭐ **Last-used size wins** (human: *"the last used size is great"*).

⬜ **WHAT REMAINS — the first-time case: 140px PER PANE** (human: *"can new user panel be 140"*).
⚠ **ATTEMPTED AND REVERTED 2026-08-20 — read this before trying again, it fails in a specific way.**
A default of `panes x 140 + chrome` when nothing is stored WORKS (measured: 140/140 at 390x780, form still
fully reachable — `.wiz-body` scrolls, 201 fields, the last one and INSERT both reachable). ⛔ But it
**breaks t1468's collapse contract** and `collapsible-panes-752` catches it in two places:

- Counting only the OPEN panes makes the visual TOTAL shrink when one is folded. t1468's contract is the
  opposite: **the total stays put and the SURVIVOR grows into the freed height.**
- Counting ALL panes fixes that, but then the survivor lands at 146px against a spec demanding >150.
  ⇒ the freed height is not reaching the survivor; something downstream still caps it. **That is the
  actual open question — find what caps the survivor before touching the default again.**

⚠ AND THE FLOOR MUST APPLY TO A STORED DRAG TOO, or a drag is WORSE than no drag: measured at 390x780,
nothing stored gave 140px panes while a deliberate drag to 500 was clamped to 51px by `visualMaxHeight`'s
leftover-space cap. Whoever builds this must make both paths share one floor.

⭐ Safe to push the form down: the phone layout puts previews on TOP of a scrolling body, verified — ⛔
unlike the command-deck bug, where content was clipped with no scroll path.

---

*(original note follows)*
⬜ **the first-time case.** `getVisualHeight()` returns null when the user has never dragged,
and the code then falls through to *"the layout's own flex sizing holds"*. On a phone that is whatever is
left after the form, so **someone opening a wizard on a phone for the first time can still get strips** —
with no reason to suspect the panes are draggable at all.
⇒ Give the never-dragged case a **sensible minimum** rather than the leftover. ⛔ NOT a new setting: a
stored drag already overrides it, and the human explicitly wanted no third knob.
⚠ Safe to do because the phone layout already puts the previews ON TOP of a scrollable body
(`.two-pane .wiz-body { overflow-y: auto }`, `.wiz-visual { order: 1 }`), so a taller minimum pushes the
form down rather than clipping anything — ⛔ unlike the command-deck bug, where content was cut off with no
scroll path at all. **Verify that property still holds before changing the number.**
⚠ Check whether the previews are STICKY on a phone (the CSS comment says they "stay sticky"): a tall
minimum plus sticky could pin most of the screen while the form scrolls under it. Deliberate either way.

---

## AUDIT: WHICH GATEWAY TABS A V4.1 (AND A V3) CAN ACTUALLY USE
*(human, 2026-08-20: "backlog audit which gateway tab the 4.1 actually can use" — after finding beacons
costing 1-2s each on a V4.1, and the Tracking tab showing a job at 63% from a status record two months old.)*

⭐ **THE CAPABILITY THAT DECIDES MOST OF IT: Modbus RTU is EXPERT-ONLY.** The V4.1 has none, and
`bridge/controllers/dm500/FINDINGS.md` records that grepping the whole 311-param DM500 eng for
`modbus|master|slave|serial.*mode|comm.*mode` gives **ZERO hits**. ⛔ So never write this as a v4.1
blacklist — name what HAS the capability, or the next controller inherits a permission by default.

| tab | Expert | V4.1 / V3 | status |
|---|---|---|---|
| **Send** | ✅ | ✅ deliver-only | works. Beacons now gated off without Modbus (t2113) |
| **Status** | ✅ | ✅ | works |
| **Jobs** | ✅ | ✅ | queue + history are backend state, controller-agnostic |
| **Files (CNCDISK)** | ✅ | ✅ | a file share, no Modbus involved |
| **Console / Setup** | ✅ | ✅ | works |
| **Tracking** | ✅ | ⛔ **GATED (t2113)** | needs Modbus; dimmed + explains itself |
| **Merge** | ? | ? | ⚠ **UNAUDITED — the one genuine unknown** |

⬜ **THE REMAINING WORK IS MERGE.** ROLES-PLAN.md flags it *"VERIFY, do not assume"* because an earlier
claim about it ("operates on controller-side files") was made without reading the code and was never
checked. It is the last tab whose controller-dependence nobody has established.
⚠ `state.js:45` declares it `keeps:''/clears:true`, which pre-bakes wiping the operator's own staged list —
worth understanding before touching it.

⚠ **ALSO SPOTTED, NOT YET RULED: BEACON COUNT DEFAULTS TO 255**, the maximum. On an Expert that is 255
Modbus round-trips inserted into one program; on anything else it was 255 timeouts. Even where beacons DO
work, 255 checkpoints is far more progress resolution than anyone reads. ⇒ **pick a sane default** (a dozen
or so) and let the field go to 255 for someone who wants it.

---

## VENDOR PACK — CAPABILITIES WORTH BUILDING (not started; captured 2026-08-21 so they are not lost)
*(t2117 amendment: the foinnc dev-pack sweep's own "Worth building" section — full detail in
[`bridge/controllers/expert-m350/VENDOR-PACK-SWEEP.md`](bridge/controllers/expert-m350/VENDOR-PACK-SWEEP.md)
§4 — lives ONLY there today and would be lost without a pointer here. These four, each with its exact
mechanism; the sweep names several more not repeated below.)*

### A. A Studio-owned G-code library
`G100`–`G199` map to `O9100`–`O9199` in a firmware file named **`slibuser.nc`**, installed by dropping it in
`install/` or `psys/`. Argument words: `#0=X #1=Y #2=Z #3=A #4=B #5=C #6=I #7=J #8=K #9=R #10=L #11=H #12=P
#13=Q #14=D #15=F #16=S #17=T`. Eight more empty hooks exist: `G12`(`O9012`), `G13`(`O9013`), `G76`,
`G85`–`G89`.
⚠ **THE STICKY-ARGUMENT CAVEAT (the actual cost of this feature):** an OMITTED axis word yields the
CURRENT work coordinate, and a non-axis letter inherits the PREVIOUS line's value — so a caller must always
pass every word, every time, or a stale value silently rides along. ⚠ The G/M list contradicts the vendor's
own docx on `T` ("The letter 'T' is reserved for tool changes", and only `#0`–`#16` documented) — resolve
which is true before authoring against it. Benefit: a declarable post capability, compact parameterised
emit instead of inlined macro bodies. ⛔ The whole file must be Studio-owned — the vendor pack states two
slib-prefixed files cannot declare the same subprogram number, so this can't be split or shared.

### B. Barcode job dispatch straight from the gateway share
`Pr279` (mirrored at macro `#779` — confirmed the SAME parameter, not two: the macro-table neighbourhood
proves it, see VENDOR-PACK-SWEEP.md §5) `= 2` selects **NetDisk** as the barcode file's source (`0 Local, 1
Udisk, 2 NetDisk`), `Pr278 = 2` selects Scanner input, `Pr210 = 1396` binds K1 to the barcode input box (both
`-p1`, need a restart). Operator presses K1, scans a barcode naming a file, confirms; the controller opens
`<barcode>.nc` — straight out of the gateway's own share, no browsing.
⚠ **NO auto-run, no acknowledgement, no error path is documented anywhere in the vendor pack** (checked all
four barcode docs, EN+CN, PDF+docx — same five steps, nothing added). The scan only fills a filename text
box; the operator must still press confirm, and nothing tells the PC what was scanned or whether the named
file existed. `Pr283 "Barcode scanning processing"` (`0 No / 1 Yes / 2 Test`) might be an auto-run variant,
but the vendor's own text says "contact the supplier to determine the model before opening" — undocumented.
Benefit: keyboard-free, browse-free job selection for a shop floor operator, using ONLY parameters + a
printable label — no new gateway code.

### C. `RECORD[]` → file-based progress — the strongest remaining progress candidate
> ⏸ **DEPRIORITISED 2026-08-22** *(human: "dont worry about that")* — left in place, NOT killed.
> ⚠ Context for whoever picks it up: this item's own premise is *"no line-number register exists anywhere in
> the documented Modbus map"*, and the vendor has said one is coming (~2026-08-27). If it ships, this becomes
> a workaround for a solved problem. ⭐ **Item D does NOT fall with it** — run-state (`is it running / paused
> / idle`) is a question a line-number register cannot answer. Re-read that premise before spending a turn here.
`RECORD[0,1,<n>,0,0,0,0]` (cache) + `RECORD[-2,1,0,0,0,0,0]` (flush) at the same Z-up points
`instrument.js` already picks for beacons, writing to `/local/RecordData<n>.txt` — a plain file the gateway
ALREADY reaches over the SMB share, no Modbus/serial wiring, no listener, no RS232 port contention with
anything else. Directly relevant to [[t2115's own finding]] (this WORK-LOG, turn 2115): no line-number
register exists anywhere in the documented Modbus map, so this file-based channel is now the most credible
non-Modbus progress source on the table.
⚠ Costs: the SAME weaving-into-emit machinery beacons already need (still per-op instrumentation, not free);
uncosted flash-write time per write; the `-2` flush form needs firmware ≥2022-05-25-00; the Chinese-language
twin of the same vendor doc describes an OLDER, SMALLER spec (`-1`/`0` only, `X3`–`X6` not `X3`–`X7`) — the
cache-then-flush pattern itself may be firmware-gated, unconfirmed on this user's own controller.

### D. Run-state variables `#1630`–`#1636` — the run-state half of progress
"Analyze the state of channel 1..7: −1 idle, 0 running, 1 pause" — R/W, per-channel. Directly answers the
"is it running, paused, or done" question a beacon-only or RECORD[]-only tracker cannot on its own — the
missing half of stall-vs-finished detection named in JOB-PROGRESS-PLAN.md and investigated in t2115.
⛔⛔ **SAFETY, CARRY THIS INTO ANY IMPLEMENTATION: `#1620`–`#1626` sit RIGHT BESIDE these (execution
strategy: `0` request start/restart, `1` internal suspend, `2` external suspend) — writing `0` to `#1620`
REQUESTS A START ON AN UNATTENDED MACHINE. Never write `#1620`–`#1626` from the gateway.** `#1630`–`#1636`
themselves are documented R/W, but this feature only ever needs to READ them — there is no read-only
sub-range declared, so any code touching this block must be reviewed for which direction it writes, not
just which addresses it names.

---

### E. Modbus Register 3000 — real-time G-code injection (Studio as an ACTIVE controller)
*(rescued 2026-08-22 from an untracked root file `brainstorm_injection.md`, dated 2026-08-03, before deleting it)*

⚠ **STATUS: SOURCE-DERIVED, NOT BENCH-VERIFIED.** Everything below was read out of the OEM's own
`m350_liveg.py` (see `scratch_repos/M350-LiveG`), not observed on hardware. Same evidential tier as the
register map in `bridge/controllers/expert-m350/FINDINGS.md` — treat as a lead, not a fact.
Related, already tracked: `SLAVE-CHANNEL-TESTS.md`.

**The claim:** firmware `2026-08-03-00` adds **G-code injection via Modbus Register 3000, 246 bytes max**.
That would change Studio's relationship to the machine — from a passive observer (polling coordinates) plus a
file server (dropping `.nc` on the share) into something that can actually command the controller.

**The four mechanical details worth keeping** (these are the part that would take a day to re-derive):
- **Write path:** Modbus **Function Code 16** → register **3000**.
- **Payload encoding:** ASCII over 16-bit Modbus registers takes character PAIRS and **swaps their byte
  order** — `"G0"` goes on the wire as `"0G"`.
- **Buffer guard:** injecting while the controller is still executing the previous command returns exception
  code **`0x90` (busy)**. ⭐ That is a real backpressure signal — streaming cannot silently overflow.
- **Motion state:** register **10002** read as a 32-bit float. `> 0` = moving, `0` = stopped. Two consecutive
  zeros ⇒ motion complete. ⭐ This is what would let a probe wizard know the probe has touched.
- Bonus for the separate keycode hunt: the OEM block is `0x0140`–`0x0190`, so probing blank slots there beats
  scanning 65,000 values.

**What it would unlock, in the author's order:**
1. **A true MDI** in the gateway Console tab — type `G0 X10 Y10` or `#100 = 5` and it executes. Today that
   requires walking to the pendant.
2. **On-screen jogging** in the Status tab — inject `G91 G1 X10 F500` instead of reverse-engineering the
   controller's proprietary virtual keycodes. Variable-speed, diagonal and exact-step jogging become ordinary
   UI rather than keycode hacks.
3. **Remote execution** — Send already drops the file over SMB; injection could then fire `M98 P"job.nc"` so
   the operator never touches the file menu.

⛔ **THE SAFETY GATE, and it is not optional.** This is the first WRITE capability that commands MOTION.
The standing ruling is that Studio stays **read-only on a powered controller when the user is away**
(see the `live-cnc-readonly-when-away` rule). Any of the three uses above must be gated on the operator
being present and having explicitly armed it — a jog button that works from a phone in another building is
exactly what that ruling exists to prevent. ⚠ Decide the gate BEFORE building the MDI, not after.

⚠ **VERIFY FIRST, IN THIS ORDER:** (1) does register 3000 exist on the user's actual firmware; (2) does a
motion-free command (a variable set) round-trip; (3) does `0x90` actually appear under load. Only then
consider motion.


## ANALYTICS BOT DETECTION — an unmerged branch that was deliberately NOT pruned
> ⏸ **CAN WAIT** *(human, 2026-08-22: "analytic can wait")* — no action queued. ⛔ The branch still must NOT
> be pruned: it holds work not in this trunk and belongs to the concurrent analytics agent.
*(logged 2026-08-21 during the advisor branch sweep — human: "backlog the analytic bot detection")*

**The sweep took 28 refs down to 10.** Every deleted branch was verified content-present in the trunk first.
**Two were held back**, and this is why:

| ref | holds |
|---|---|
| `analytics-bot-detection` | `086e6428` (2026-07-20) |
| `worktree-agent-a02253c19308a22ae` | the same commit — an agent worktree twin |

`086e6428` — *"bot detection — Layer B ingest classifier (blob10) + dashboard split"*:
`classifyBot(request, cf, app)` plus `CRAWLER_UA` / `AUTOMATION_UA` / `DATACENTER_ORG` regexes, written as
`blob10` in the fetch `writeDataPoint`. ⭐ It short-circuits `app === 'exe'` → `'clean'` **before any UA
check**, because the exe beacon is Python-relayed and its user-agent is meaningless — a real insight worth
not losing.

### ⛔ WHY IT WAS NOT DELETED
1. **The code is not in this repo's trunk at all.** `grep -rl classifyBot DDCS-Studio/web cloud bridge`
   returns nothing. Unlike every branch that *was* pruned, this one is not duplicate history — deleting it
   would have destroyed the only copy here.
2. **A concurrent agent is working on it right now.** `ANALYTICS-BOT-DETECTION.md` was sitting UNTRACKED in
   the working tree during the sweep. A second analytics agent shares this repo, and deleting its branch is
   the same cross-seat damage this repo has already suffered twice.

### THE OPEN QUESTION — where does this belong?
The usage-analytics Worker is a **standalone Cloudflare Worker**, deployed separately from Studio. So:

- **If analytics lives in its own repo**, this branch is a stray in the wrong repository and should be moved
  there and then deleted here — not merged into the Studio trunk.
- **If it is meant to live here**, it needs a home directory and a merge, and the branch stops being an
  orphan.

⚠ **Either way it should not stay as an unmerged branch indefinitely** — that is exactly the state that made
the whole sweep necessary. ⛔ Do not resolve it by merging into the Studio trunk without deciding the first
question; "merge it so the branch is gone" would put Worker code in an app repo permanently.

⚠ **Coordinate with the analytics agent before touching either ref.** The untracked `.md` in the tree means
the work is live, not abandoned.

---

## GATE CONSOLIDATION — eight mechanisms answering one question
*(inventoried 2026-08-22; human: "we may need more specific gates for other departments of the code")*

Every one of these answers **"is this available right now, and if not, why?"** — and each was invented
locally, with its own shape, its own evaluator, and its own answer to the *why*.

| mechanism | department | gates | files |
|---|---|---|---|
| `gate:` | wizards/ops + dataOps | a block or field, greyed | 27 |
| `when:` | dataOps | field visibility | 16 |
| `postGating` | ui | post caps → `.disabled` | 17 |
| `optionGate` | dataOps | one `<option>` in a select | 4 |
| `clearWhenOff` | tapData | clears a checkbox when gated off | 2 |
| `requiresModbus` | gateway/views | a whole TAB | 2 |
| `noFlow()` | wizards/ops | dialect cannot run it | 1 |
| `liveTapCapable()` | wizards/ops | attestation, at emit time | 1 |

**Rule-of-three says build the registry when a third case forces it. We are at eight.**

### What consolidation means
One declared shape all eight collapse into — `{ requireAll, onFail: hide|grey|clear|fallback, fallback,
reason }` — with ONE evaluator reading it. `requiresModbus`, `noFlow()`, `liveTapCapable()` and `postGating`
stop being bespoke code and become data.

### Why it is worth doing
1. ⭐ **Every gate carries its reason.** Three already do (`tokenRefusal` in 19 files, `optionGate.tip`);
   five do not — so a greyed control just sits there and the user guesses.
2. ⭐ **One place to audit the SAFETY gates.** `postGating`, `liveTapCapable` and `requiresModbus` decide
   whether the app offers something the machine cannot do. Auditing that today means reading four mechanisms.
3. ⭐⭐ **It makes wizards-as-data EASIER.** With one shape, the `formfield` block carries ONE `gate` field.
   Under the current spread it would need a separate block field per gate kind — the exact vocabulary
   explosion that made the 2026-08-04 Corner port fail.

### ⛔ NOT FIRST
~70 files, and **three are safety gates** where a refactor bug means offering an operation the machine
cannot perform — the tap-into-steel class. The wizards-as-data port needs only four attributes on one block
and touches no safety gate; do that first, shaped as DATA so this has less to clean up later.

---

## THE UNSAVED GATE — reword it, and delete the dead third caller
*(human, 2026-08-22, live from the app)*

`confirmDiscardBuffer` (`ui/workspaceManager.js:37`) fires a three-way prompt whose copy describes STATE,
not the CHOICE:

> *"Opening these controller parameters replaces everything in this workspace, and you have changes that
> are not in a file yet."*

Human: *"anytime this modal comes up I'm not sure which to press, I'm just doing a pull, why would it
matter."* ⭐ The buttons (Cancel / Discard changes / Save and continue) answer a question the sentence never
asks. Reword to ask it:

| call site | reads as |
|---|---|
| `workspaceManager.js:191` — open a workspace | **"Save before opening a workspace?"** |
| `settingsPanel.js:2653` — apply a pull | **"Save before applying these controller values?"** |
| ~~`profileStore.js:131`~~ | ⛔ **DEAD — delete, see below** |

⚠ **The pull wording is wrong twice over.** You are not *opening* — you are APPLYING, at the Apply step
*after* the import-review dialog. And it does not replace *everything*: `settingsPanel.js:2655` says it
rewrites **envelope / WCS / homing / spindle**. Both halves of the sentence describe something else, which
is exactly why the buttons read as unanswerable.

⭐ **KEEP the prompt on both live paths.** An earlier reading of mine — "the review dialog already asked, so
drop it" — was WRONG: the review asks *which values to take*, this asks *what about your unsaved work*.
Different questions. (The mismatch branch above it correctly skips the prompt, because duplicating into a
new workspace IS a save.)

### ⛔ DEAD CODE — the profile library left its machinery behind
`ui/profileModal.js` has **ZERO references** anywhere in the app — no import, no button, no entry point.
`git log`: *"2026-07-26 feat(workspace): retire the profile library — a workspace IS one machine"*. The
ruling took the door and left the room.

⇒ Delete `profileModal.js`, and `profileStore.js`'s import path with its now-unreachable
`confirmDiscardBuffer('this machine configuration')` call. ⚠ Check what else in `profileStore.js` is still
reachable before deleting wholesale — Export/Import of settings may still be wired elsewhere.
This is the exact pattern the *"no legacy burden — delete rather than maintain"* ruling exists to prevent.

### ⚠ SEPARATE, NOT FIXED BY ANY REWORDING
The gate fires on a workspace the human calls clean. `isWorkspaceDirtyToFile()` (`data/backup.js:397`)
compares a whole-workspace **signature** against a watermark — it answers *"is anything different from the
last save"*, not *"did the USER change anything"*. Any normalising read, boot backfill or same-content
rewrite moves the signature. ⭐ And because it is one opaque hash it can only ever say "something differs",
never WHAT — so the prompt cannot show what to review even if it wanted to. **A confirmation that fires
when there is nothing to confirm teaches you to click through confirmations.**

---

## COMMENT TOGGLE — a caret-follows button, not a toolbar item
*(human, 2026-08-22: "comment should be a different kind of ui button… id want a button to appear only when
the caret is in the editor, and button should appear at the end of the line")*

Comment/uncomment stays (it survives the indent removal above), but it stops being a toolbar button and
becomes contextual:

- **Appears only when the caret is IN the editor** — not present otherwise.
- **Positioned at the END OF THE CURRENT LINE**, following the caret's line as it moves.

⚠ Worth thinking through before building: what it does with a multi-line selection (follow the last line?
the first?), how it behaves on a very long line that is already scrolled off to the right, and whether it
should hide while typing and reappear on idle. ⭐ The appeal is that it puts the action where the user is
already looking instead of making them travel to a toolbar — same instinct as the sound-preview ▶ button.

---

## THE PROFILE TAB BECOMES "DIALECT" — and loses two of its three sections
*(human, 2026-08-22, decided live)*

`settingsPanel.js:1234-1269` — the tab is **35 lines** holding three sections. Two of them go with the
indentation removal above, and one belongs elsewhere:

| section | fate |
|---|---|
| **CONTROLLER** — the dialect dropdown + Pull from controller | ⭐ **STAYS. It becomes the whole tab.** |
| **G-CODE OUTPUT** — Indentation | ⛔ deleted (see "NO INDENTATION, EVER") |
| **EDITOR** — *"Select lines and press Shift+Tab"* | ⛔ deleted — it documents a keybinding being removed |
| **EDITOR** — *"Smart suggestion bar (predictive keys above the keyboard)"* `:1262` | → **move to Appearance** |

### The rename
**`Profile` → `Dialect`.** Once the other sections are gone the tab IS the controller dropdown, so the label
matches the content exactly.

⛔ **NOT "Machine"** — an earlier suggestion of mine, and wrong. The tab's intro prose (*"THIS WORKSPACE'S
MACHINE… controller, envelope, WCS, boot macro, variables"*) describes the whole **Controller group**, not
this tab; the envelope, WCS and variables live on the SIBLING tabs (`WCS`, `Variables`, `Program`). Naming
it "Machine" would promise all of that and deliver one dropdown.

⭐ **And it retires an overloaded word.** "Profile" currently means three things in this codebase: this tab,
`CONTROLLER_PROFILES` (the dialect — alive), and `profileStore`/`profileModal` (the machine-profile library —
RETIRED July, see the dead-code entry above). That collision misread me twice in one session.

### Why the suggestion bar moves
`settingsPanel.js:3342` notes it is *"not part of the settings model — just localStorage + an event the bar
listens for."* It is an on-screen-keyboard DISPLAY preference persisted like other view state — same family
as the theme and panel layout — sitting on a machine-identity tab purely because both were once filed under
"editor". Appearance is its real home.

⚠ **Check the Appearance tab's own grouping before dropping it in**, and check whether the setup checklist,
help text or tour reference "Profile" by name — a renamed tab still called Profile in three explanations is
worse than either name alone.

---

## THE "REOPEN WIZARD" CHIP IS A HOVER TRAP — and it hides the other ops
*(human, 2026-08-22, live from the editor)*

The `✎ Corner (data) · ≈ 28 s` chip above the G-code only appears **while hovering the code**, and
**disappears as soon as the pointer leaves the code to reach it.** Human: *"it's hard to select and press
since it only appears when hovering the code and disappears when we want to move the cursor over it."*

⭐ **This is the classic hover-trap:** a control revealed by hovering region A, rendered outside region A.
The path to the target destroys the target. It is not a sizing or a timing problem — no hover delay fixes
it, because the pointer must cross a gap where the trigger is false.

### The fix
⛔ **Make it always visible** — not hover-revealed at all. It names which op owns the code you are looking
at, which is useful *before* you decide to interact, and it is the only route back into the wizard from the
editor.

⚠ If always-on is too heavy visually, the acceptable version is *"visible always, emphasised on hover"* —
but the control must never be **absent** when the pointer is travelling toward it. Alternatively the chip's
own hover zone must include the corridor between the code and the chip, so the trigger stays true en route.

### ⭐ MULTI-OP: show them ALL, always
*(human, 2026-08-22: "the reopen buttons can all be always visible, even multi ops")*

The editor is a view of an op STACK, and reopening is per-op. **Every op gets its own chip, and every chip
is always visible** — no hover reveal, no caret-scoping, no "the one under the cursor plus a way to reach
the rest."

⛔ **An earlier draft of this entry proposed CARET-SCOPED chips. The human rejected it** — surfacing only the
op under the caret makes the program's structure discoverable only by scrolling through it. All of them
visible at once IS the map: you can see what the program is made of without reading the G-code.

⭐ **ICON ONLY, no label** *(human, 2026-08-22: "they can use only the icon no label")* — which resolves the
layout question outright. `✎ Corner (data) · ≈ 28 s` becomes just the op's icon. Fifteen icons fit where
three labelled chips do not, so a row above the code stays viable at any program length, and the wizard
icons are already a designed per-op set (`ui/wizIcons.js`).

The icons are the SAME per-op marks the wizard menu already uses (`ui/wizIcons.js`) — so the mark beside
`Corner` in the menu is the mark on the chip above the corner probe's G-code. One vocabulary, two places.

⚠ Note the bar is higher on a chip than in the menu: there the icon sits BESIDE its label and only has to
support recognition; alone it has to carry it. ⭐ **Human ruling: ship it anyway** — *"its fine, we would
redesign the icon if its hard to discern."* Do NOT gate the chips on an icon audit; let real use name which
marks fail, then redesign only those. (Contrast the lathe set, which got a full review before anyone had a
complaint.) Keep a tooltip / `aria-label` so the name is always recoverable.

⚠ Also check whether the `≈ 28 s` estimate belongs on this chip at all — it is a different fact (cycle time)
riding on a navigation control.


---

   reader cannot be protected from.

⇒ Delete the dead override branches, de-duplicate `homingPostIsExpert`, and route both through the workspace
profile the way t2137 did for the `settingsPanel` copy.
