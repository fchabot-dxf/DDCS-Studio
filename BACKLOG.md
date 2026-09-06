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

#### ✅ UPDATE (t2229) — THE NAMED BLOCKER LOOKS RESOLVED; VERIFY AGAINST ROLES-PLAN.md BEFORE ACTING ON EITHER

The STILL REAL IF check as literally written (`grep -rn "role" ui/gateway/ ui/gatewayPanel.js | grep -i
"gate|client|server"`) came back empty — but that's a broken pattern (`grep -i` without `-E` treats `|` as a
literal character, not alternation), not a real signal. Re-run with `-E`: role-gating code is extensive
throughout `ui/gateway/views/{admin,status}.js` and `ui/gatewayPanel.js`, all routed through ONE function,
`roleInfoFromDescriptor()` (`ui/gatewayStatus.js:68`, t2151 — postdates this entry).

**The specific blocker this entry names appears to be fixed.** `status.js:64` now reads
`try { d = await ctx.client.descriptor(); } catch { d = null; }` — an unreachable daemon no longer throws
past a bail-out; it degrades to `d = null`. Traced end-to-end: `roleInfoFromDescriptor(null)` → `baseRole =
'client'` (its own default) → `roleIdentity(null)` → a fully-formed `{ kind: 'client', headline: 'This PC is
a client', ... }`, no throw, no early return. A pure client with zero reachable daemon now gets a real,
rendered "client" identity — exactly the case this entry says was impossible.

**Not independently verified against `ROLES-PLAN.md`, and not edited** — that file reads as advisor-owned
planning (same convention as ROADMAP.md), so this is reported rather than reconciled. If t2151 already closed
S1 there, this backlog entry and that plan's own state have drifted apart from each other; worth a look
together rather than one at a time.

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

#### ✅ UPDATE (t2229) — STILL REAL (unbuilt, confirmed) AND STILL EXPLICITLY DEFERRED — not eligible to pick up

`grep -rn "Advanced machining" --include=*.js .` → 0 hits: genuinely unbuilt, matching the check's own
inverted framing (an ADD item with no hits means still real). But this entry's own text already carries a
direct human ruling closing it out of current scope ("not doing it now") — the check confirms it hasn't been
built, not that it's due. Not picked as this turn's smallest item for that reason, not size.

### F5. The DDCS wordmark in ORGANIC — ✅ DECIDED AND TRACED, ready to build
*(human, 2026-08-22, chosen from live specimens. Preview of the final symbol:
https://claude.ai/code/artifact/2431d2ac-9252-47ca-aa9d-b362f088b161)*

### ⭐ THE ARTEFACT ALREADY EXISTS: `MARK-ORGANIC-TRACED.svg` (repo root, 14 KB)
A complete, ready-to-paste `<symbol id="mark-organic">`. Replace the existing one in `web/index.html` with it.
⚠ Move the file out of the repo root once pasted — it is a handoff artefact, not a source file.

```
  face        Sniglet 800          BOTH LINES traced to outlines — no font at runtime
  slant       9 degrees            SHEARED (Sniglet ships no italic); matches Nunito's native angle
  fill width  146 units            68% glyph stretch / 32% added tracking
    wordmark    glyph 1.7406x   tracking 0.312em   #d9a03c    2,987 bytes
    tagline     glyph 1.3922x   tracking 0.134em   #a08d69    9,955 bytes
  precision   1 decimal            0.1 unit on a 150-unit box = 0.07%; 66% smaller than full float
  treatment   NONE — FLAT          one fill per line, same structure as mark-normal
```

### ⛔ TRACE BOTH LINES, OR NEITHER — a draft that traced only the wordmark was WRONG
An intermediate version left the tagline as `<text>`, reasoning that a fallback at 8.5px is barely visible.
**That judged the tagline against ITSELF instead of against the wordmark above it.** A traced Sniglet wordmark
over a tagline rendering as Roboto is *two unrelated typefaces in one lockup*, and that reads wrong at any size.
⚠ The saving was not worth it either: tracing the tagline costs 10 KB of the 14 KB, and 14 KB against a 145 KB
`index.html` is not a weight problem.

### ⛔ WHAT WAS CONSIDERED AND DECLINED — do not reintroduce
raised / engraved three-layer stack · halo (outside stroke) · glow (feGaussianBlur) · grain fill ·
carved gradient · plate rule. Each was built as a live specimen and rejected.
⭐ The design work did not produce an effect; it produced the confidence to have none.

### ⭐ THE POINT IS THE TRACING, NOT THE FACE
*(human: "it will be traced right? as android doesnt display correctly")*

⛔ **ALL FIVE MARKS RENDER WRONG ON ANDROID TODAY.** Neither font they request exists there:
```
  Arial Black   normal / studio / futuristic   -> absent -> Roboto bold
  Georgia       organic / steampunk            -> absent -> Noto Serif
```
They are a font REQUEST the device declines, not logos. Outlining repairs a live cross-platform defect that
predates this whole redesign — worth more than any letterform choice made here.

### ⚠ THE `textLength` ATTRIBUTE GOES — FOR THIS MARK ONLY
The fill is baked into the path geometry, so `textLength="146" lengthAdjust="spacingAndGlyphs"` must NOT be
applied on top; it would squeeze an already-correct mark a second time.
⛔ Do NOT strip it from the other four — it is an intentional device they still rely on.

⭐ **WHY THE BLEND EXISTS, measured against real font metrics:** the current attribute stretches glyphs by
about **2×** (Sniglet natural 69.9 → 146 = 2.09×). The 68/32 blend brings that to **1.74×** and lets tracking
carry the rest — 22% less distortion of the bowls, which is the entire reason Sniglet was chosen.

### ⚠ SCOPE DECISION THE HUMAN STILL OWES
This entry is ORGANIC ONLY, but the Android fallback hits every mark equally:
```
  organic only   this ships; the other four stay broken on Android      +14 KB
  all five       trace each existing mark AS-IS (no redesign) + this one  ~70 KB
```
⭐ Advisor leans ALL FIVE — tracing the other four is a pure fidelity fix with **no design decision attached**.
⚠ But the honest number is **~70 KB on a 145 KB `index.html`, a 48% increase** — not the rounding error it
looked like when only wordmarks were being counted. ⛔ Human's call with that figure in hand.
*(human, 2026-08-22, noticing the inconsistency: "wait other logo use a font")*

### ⚠ HOW TO REGENERATE — the paths are DERIVED, never hand-edited
Recipe, so nobody edits path data by hand:
1. Fetch the Google Fonts WOFF2 subset with `&text=DDCS%20CNC%20MACRO%20STUDIO` and a **modern** User-Agent.
   ⚠ An old UA gets you **EOT**, and no `&text=` gets you a Cyrillic subset with no `D` in it. Both happened.
2. Read glyph contours with `fontTools` + `brotli` (neither was installed; both are pure-python installs).
3. Per glyph: `translate(0, baseline)` · shear · `scale(size/upem * xs, -size/upem)`, then lay out with the
   blend above.
4. ⛔ **THE SHEAR SIGN IS NEGATIVE.** The y-flip in `scale(..., -s)` runs first, so a positive shear leans the
   wrong way — this shipped wrong once and the human caught it. **Assert it:** transform a point at cap height
   and check the x delta is POSITIVE.

### Verify
The header in organic at real size, **and** the boot splash — the mark renders on `--modal-face` there, a
different surface (`BOOT-SPLASH-PLAN.md` trap 3). ⚠ **And on an ANDROID device**, since that is the defect
this actually fixes.

---

### 4. [STALE - BOTH ICONS DRAWN, VERIFIED t2220] The lathe icon doesn't read as a lathe setup
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

### 5. [STALE - VERIFIED CLEAN t2220] ⛔ A raw NUL byte makes `macrosApp.js` INVISIBLE TO GREP
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

### 6. [✅ FIXED t2143 — confirmed stale t2219] Hand-authored T.nc / error.nc G-code is DISCARDED on reload
*(found 2026-08-22, same sweep — and only findable because of the item above)*

`ui/macrosApp.js:607-626` writes `getSettings().systemHooks.T` and `.error` — the user's **hand-written**
tool-change and error macros. `loadSettings()` (`ui/settingsPanel.js:391+`) is a WHITELIST and does **not**
list `systemHooks`. ⇒ written → persisted → **silently dropped on the next load**. `macrosSynced` (`:798`)
goes the same way; a sweep counted **four** persisted-then-dropped keys total.

⛔ This violates the standing principle that a saved file is USER-OWNED. ⚠ **Reproduce the loss first** —
confirm the save path serializes the live object before assuming the chain; do not fix on this trace alone.
⚠ The real fix is probably not "add four keys": a whitelist that silently drops anything unlisted will do
this again on the NEXT setting somebody adds. Decide whether unknown keys should be PRESERVED rather than dropped.

#### ✅ UPDATE (t2219) — ALREADY FIXED, at t2143 (the same turn that fixed item 8) — this entry is stale

Dispatched to investigate the mechanism before proposing anything. Read `ui/settingsPanel.js`'s `loadSettings()`
first and found a t2143 comment already describing this exact bug and its fix: a sweep found FOUR keys the
whitelist silently dropped (`systemHooks` — this item's own hand-authored T.nc/error.nc — `macrosSynced`,
`units`, `toolChange`); `units` got its own typed line, and the other three are now covered by a general
PASS-THROUGH added to the end of `loadSettings()` (`for (const k of Object.keys(p)) { if (!(k in merged) &&
!RETIRED_SETTINGS_KEYS.has(k)) merged[k] = p[k]; }`) — exactly the "PRESERVE unknown keys rather than drop
them" fix this entry itself asked for, not a four-key patch.

**Reproduced live, not just read**: typed a unique marker into T.nc, a different marker into error.nc (both
via the real unlock flow), confirmed both landed in `localStorage`'s `systemHooks.T`/`.error` before reload,
reloaded the page, and confirmed both the raw storage AND the rendered textarea still carried the exact
markers. Zero data loss, both files. Deleted the throwaway repro script after use — no code changed this
turn, since there was nothing left to fix.

**Why this reads as fixed and not "not yet regressed" fixed**: the mechanism is a general pass-through, not a
per-key patch — the retirement list (`RETIRED_SETTINGS_KEYS`) is the only remaining exclusion, and it is an
explicit opt-in list for keys that must NOT resurrect (e.g. t2139's retired `indentStyle`), not an implicit
whitelist a future key could fall through by accident. The bug class this entry described (a whitelist that
drops the next unlisted setting) cannot recur the same way.

### 7. [✅ CLOSED t2369 — already shipped across t2145/t2147/t2149/t2184, verified live, never re-built] The header shows the VERSION where it should show the WORKSPACE
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

> **#7 CLOSED (t2369) — ALREADY SHIPPED, across t2145/t2147/t2149/t2184, never marked closed here.** Dispatched
> as a build task; live-driven verification (not code-reading alone) found every requirement already met.
> Checked against the entry's own list, one by one: the brand is a `<button>` now (t2149), not an `<a href>` —
> THE TRAP this entry warns about no longer applies, the workspace navigates nowhere either way; the workspace
> name (`.hdr-ws-name-txt`) sits in the header OUTSIDE the brand, confirmed via `brandAnchor.contains()`; the
> `<span class="ver">` is `hidden` in `index.html`, exactly where bump-version.cjs/check-version-sync.cjs still
> find it by raw-text regex; theme chips are gone from both menus (t2147, `#set_theme` in Settings); the CUTS
> are honored — no standalone "not saved to a file" row, no filename row, live-checked via the menu's own HTML;
> the quick menu's `hq-saved-line` reads "Saved 03:35 PM" (locale time, the mockup's "14:22" was the author's
> own 24-hour locale, not a literal format requirement) with the full today/yesterday/older honesty rule
> (`headerPost.js:311-315`) and a `title` naming WHERE ("Saved to this PC only" / "…to your cloud…"), sourced
> from a local icon function, not `wizIcons.js`; the version footer is selectable (`user-select` override on
> that one row) and reads the live `.ver` text. **The one real divergence from the mockup, and it's
> architectural not missing:** the mockup drew ONE quick menu holding both the Saved line AND the version
> footer; t2149 later split the header into TWO menus (the workspace/file menu, `#hdrPostBtn`, vs. the
> brand/app menu, `#hdrAppBtn`) — the Saved line lives in the first, the version footer in the second. Both
> exist, both are reachable, the split is a later, deliberate, well-reasoned decision (BACKLOG #9's own
> "clicking your workspace name" vs. "the app's own identity" split), not a gap. Header-name-click-opens-menu
> is satisfied by construction: the whole chip (name + chevron) is one button
> (`header-workspace-name-2147.spec.js`'s own "it IS the chevron button, not a second click target"). Nothing
> built this turn for #7 — closed as found, not re-built, per this project's own standing "grep for the
> capability, not the file's claim" discipline.

### 8. [✅ REMOVAL SHIPPED t2143 — mostly stale, confirmed t2219] ⛔ `M6.rc` is offered as an EDITABLE G-code file — it is a compiled GUI resource
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

#### ✅ UPDATE (t2219) — THE REMOVAL ALREADY SHIPPED, at t2143 — this entry is mostly stale

Dispatched to verify the premise before changing anything, the way the tab-strip premise got checked at
t2217. `data/controllerFiles.js:50` already reads (t2143's own comment, quoting this entry's own evidence
verbatim): `M6.rc REMOVED` — the line is gone, replaced by the comment explaining why. `tests/controller-
file-tree.spec.js:38`'s expected array already omits `'M6.rc'` too, and the `not.toContain('camN.nc')` guard
two lines below is intact and unweakened. Nothing to build.

**The one loose end that's genuinely still open**: the `slib-m.nc` subtitle question above was explicitly
raised as a judgement call, not decided — and it still reads "M-macro library" in the V4.1 tree
(`data/controllerFiles.js:62`), unchanged. Not reworded here either, for the same reason the original entry
gave: it's the human's call, not a layout fix to make unasked.
*(the split is DONE and its entry is retired — it also carried a self-contradiction of the advisor's own making:
an early sketch sorted `Wizards…` as APP scope, left in place after the reasoning moved it to FILE. The worker
built to the reasoned section and FLAGGED the stale one rather than silently picking. Doc debt, now deleted.)*

#### a. ⚠ THE VERSION IS IN TWO PLACES — needs a human pick
*(worker flagged, deliberately unresolved: "app-menu version footer duplicates About's own version line")*
Predicted in the dispatch and it landed: the APP menu's footer shows the version, and the new dedicated
**About panel** conventionally shows it too. Two homes for one fact, one click apart.
⇒ **Pick ONE.** ⭐ Advisor's lean: keep the FOOTER, drop it from About — the footer answers "what am I running"
without opening anything, which is the question people actually have. About then carries credits/legal, which
is what makes it a separate panel from FAQ in the first place.
⛔ Do not "solve" it by making the footer link to About; that was raised and the human declined the notes link.

#### b. ⚠ THREE DOORS TO "OPEN A SAVED THING", still unexamined
`Open`, `Load…`, and `Library → Projects` sit within a few rows of each other in the FILE menu. They MAY be
genuinely distinct (open a WORKSPACE vs load a PROGRAM into the editor) — nobody has checked.
⇒ If two are the same act, collapse them. If they differ, the LABELS must say how, because right now they do
not. ⛔ Report before collapsing — this is a naming/behaviour call, not a tidy-up.

### 10. [✅ CORE SHIPPED t2176 — three tails open, see the update] MULTI-OP APPROACHABILITY: the wizard preview shows ONE op, with no idea where it sits
*(design conversation with the human, 2026-08-22)*

#### ✅ UPDATE (advisor, 2026-08-26) — THE FIX BELOW SHIPPED AT t2176. Verified in the code, not assumed.

`wizardManager.js:623` is no longer `getGcode: () => host.__gcode || ''`. It reads:

```js
getGcode: () => host.__contextGcode || host.__gcode || ''
host.__contextGcode = this._contextGcode(wholeProgramCtx);   // t2176
```

And `_contextGcode` (`:591`) does exactly what this entry proposed: takes the whole stack, splices the live
draft in via `replaceOpById`, and re-emits the **entire program** through the same dialect fold. Best-effort,
falling back to the single-op preview rather than breaking it.

⭐ **PLAY SCOPE was answered — differently, and deliberately.** `createPreviewPanel.js:216-226` introduces
`getPlayGcode`: the panel SHOWS the whole program but PLAYS this op's isolated code, so Play is byte-identical
to before. The start-OFFSET into a whole-program run that this entry asked for was **deferred on purpose**,
with the reason recorded: it is real `GcodeExecutionEngine` work, and that engine is also the send
safety-gate's parser (`ui/gateway/views/send.js`). ⛔ Do not treat that as an oversight.

#### ⚠ WHAT REMAINS — the three tails, none of them the headline

1. **A NEW op still previews in isolation.** `_contextGcode` opens with
   `if (!wholeProgramCtx || !this.editingOpId) return null;` ⇒ the context exists only when EDITING AN
   EXISTING op. Inserting a new one is exactly the moment you most want to see where it lands.
2. **RE-TRACE COST was never measured.** This entry called it *"the one real risk"* and asked for a
   measurement before assuming it is fine. No measurement is recorded. ⭐ The proposed mitigation (trace ops
   before yours once, re-trace only from your op onward) is also unbuilt — it may simply not be needed, but
   nobody has checked on a 12-op program.
3. **The start-offset Play**, deferred above. Its own turn, whenever the engine work is worth it.

⛔ **The BACKDROP fallback is now definitively dead** — it existed only in case the trace cost proved
prohibitive, and the whole-program trace shipped without it.

---

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

### 11. [✅ SHIPPED t2151 — confirmed by the advisor 2026-08-28, heading was never closed] NOTHING CHECKS THE WORKSPACE'S DECLARED CONTROLLER AGAINST THE ONE ACTUALLY PLUGGED IN

> **VERIFIED 2026-08-28** against `ui/gatewayStatus.js:26-46`. The ruling shipped as written: `roleInfoFromDescriptor`
> is ONE pure function demoting gateway→client when `descriptor().controller_profile_id` ≠ `getMachine().controllerId`,
> and every caller that used to read a raw `.role` (admin.js `isClient`, status.js, gatewayPanel.js tab gating) routes
> through it. ⭐ **All three named edges are handled:** unknown/absent `controller_profile_id` never demotes (edge 1);
> no-daemon was already client (edge 2); `reason` exists so the role never flips to a bare word (edge 3).
> ## ✅ RULED — ROLE IS WORKSPACE-RELATIVE: a mismatch means CLIENT, not a warning
> *(human, 2026-08-22: "if im connected to a controller the worspace should be client unless the controller
> match" — this SUPERSEDES the advisor's earlier framing of a lint/warning, and an intermediate misreading
> where the advisor recorded it as declined.)*
>
> ```
>   TODAY       gateway  ⇔  a controller disk is configured
>   THE RULE    gateway  ⇔  a disk is configured AND the CONNECTED controller MATCHES
>                          this workspace's declared controller — otherwise CLIENT
> ```
>
> ⭐ **WHY THIS BEATS A WARNING: it is TRUTHFUL, not advisory.** If the workspace targets an Expert and a V4.1
> is plugged in, this PC genuinely CANNOT deliver this program to its machine. It is a gateway — for some
> OTHER workspace. Relative to the one that is open, it is a client. Saying so is a fact, not a caution.
>
> ⭐ **AND IT TURNS A WARNING INTO AN INTERLOCK.** Instead of reporting the disagreement and letting the push
> happen anyway, the gateway-only surfaces gate off by themselves — the SAME mechanism doing the safety work,
> with no new machinery. This also means the "loud failure" argument for skipping it no longer applies: the
> point is no longer to warn earlier than the controller does, it is to not offer the action at all.
>
> ⭐ **THE MACHINERY IS FRESH.** Roles S1 (t2145) just moved role derivation CLIENT-SIDE, which is exactly
> where this comparison must live. The gateway already exposes `controller_firmware`; the workspace already
> declares its controller. This is a comparison at a seam that now exists.
>
> ### ⚠ THREE EDGES IT MUST GET RIGHT
> 1. ⛔ **`family` is `"unknown"` when the fingerprint fails** (`ops.py:374`). **UNKNOWN IS NOT A MISMATCH.**
>    A failed read must never demote a real gateway to client — that is precisely the confident-wrong-label
>    failure S1's own design avoided.
> 2. **No daemon at all** → already client by S1. No interaction, nothing to add.
> 3. ⚠ **Role now depends on the OPEN WORKSPACE**, so switching workspaces can change the role mid-session.
>    Correct under this rule, but it must be VISIBLE — the role display must not quietly flip. Say WHY it is
>    client ("workspace targets Expert; a V4.1 is connected"), never just the bare word.
>
> ⚠ **DIRECTION STILL MATTERS for how loudly to say it** — see the asymmetry below; the Expert dialect is the
> stricter one, so Expert-workspace-on-V4.1 is the benign direction and the reverse is the dangerous one.
> The ROLE demotion applies to both; the EXPLANATION can be calmer for the benign case.
>
> ### The gap this closes (both sides already know)
```
  the loaded program  vs  the workspace's DECLARED controller   ✅ LINTED  (#hdrPostWarn)
  the DECLARED controller  vs  the ACTUAL connected hardware    ⛔ NOTHING COMPARES THEM
```

**BOTH SIDES ALREADY KNOW, which is what makes this cheap:**
- The GATEWAY fingerprints the hardware: `bridge/bridge-app/fairy/ops.py:331` — *"Read-only fingerprint of the
  connected controller (V4.1 vs Expert), from its firmware `.out`"*; `:371` resolves a `family`
  (`ddcsv4.out` = V4.1); `:280` exposes `"controller_firmware"` in the descriptor; `:404`'s discovery returns
  `{ip, dest, family, firmware}` per device.
- STUDIO declares its own controller in the workspace, and `ui/headerPost.js` already renders a lint element
  (`#hdrPostWarn`) — *"a capability LINT on the loaded program against the workspace's OWN controller"*.

⇒ The comparison is two known values and an existing warning surface. It is not new machinery.

### ⚠ Direction matters — do NOT treat the two cases as symmetric
The Expert dialect is the STRICTER one (flush-left `N`-labels, no inline `IF..THEN`, per t2070/t2141).
```
  Expert workspace -> V4.1 hardware    probably HARMLESS  — a stricter subset runs on the looser control
  V4.1 workspace   -> Expert hardware  the DANGEROUS one  — the Expert REJECTS what the V4.1 accepts
```
⭐ That asymmetry is a happy accident of which way the strictness runs, **not a safeguard**. And it should
shape the warning: a mismatch in the dangerous direction deserves louder treatment than the benign one.

### ⚠ Cares
- ⛔ **STATE IT, do not auto-switch.** The standing constraint in this area (`admin.js:189`) is that a role
  contradiction *"SHOWS the fields and says what is wrong — stated, never silently resolved"*. Same here:
  never silently re-point a workspace at the hardware it happens to be plugged into. The user may be
  authoring for a machine that is not in front of them, which is legitimate.
- ⚠ **The check needs a REACHABLE gateway** — on a client with no daemon there is no hardware to compare
  against, so the warning must be ABSENT, not falsely reassuring and not falsely alarming.
- ⚠ `family` is `"unknown"` when the fingerprint fails (`ops.py:374`). Unknown must NOT read as a mismatch.

### 12. [SHIPPED t2156-t2160] A ring appears around the editor when you CLICK it — kill it for mouse, keep it for keyboard
*(human, 2026-08-22, with screenshots in futuristic AND steampunk: "can we remove this border and instead make
the editor panel a different color than the top row" → then the key clarification: **"the border appear when i
click in the editor"**.)*

⭐ **IT IS A FOCUS RING, NOT A BORDER — that clarification changes the whole fix.**

### What the advisor already checked (do not redo)
```
  styles.css:1266  .editor-container { … border: none; }            the container has NO border
  styles.css:3949  .editor-container { background: var(--screen, #000) }  it ALREADY has its own surface
  grep ':focus' near editor/gcode/code-/wrap in styles.css   → NO MATCHES
```
⇒ **The second half of the request is already true**: the editor panel is a different colour from the top row
(`--screen` vs `--band-bg`). So there is nothing to do there — what reads as a border is only the ring.
⇒ And since no `:focus` rule exists for it, the ring is most likely the **browser's DEFAULT UA outline** on the
`#editor` textarea, which is why it appears on click and looks different in each theme. ⚠ CONFIRM that before
changing anything — it could also be a `:focus-within` on an ancestor, or an `outline` inherited from a shared
input rule.

### ⛔ DO NOT JUST REMOVE IT — that is an ACCESSIBILITY REGRESSION
The outline is the keyboard-focus indicator. Delete it and a Tab user has no idea where they are.

⭐ **ONLY THE LEFT EDGE IS MISSING — top, right and bottom all draw.**
*(human, 2026-08-22, correcting the advisor: first "it only top and right side", then "wait bottom is there",
then "just left is missing". ⛔ The advisor's clipping theory — overflow:hidden cutting a full-height outline
— was WRONG and is deleted; it predicted a missing BOTTOM, which is not what happens.)*

⭐ **THE HUMAN'S OWN DIAGNOSIS IS THE RIGHT ONE: "i think its because line number colum cover it."**
One element, one edge, one cause. Supporting evidence: `styles.css:3180` sets the editor
`padding: 14px 16px 14px 52px;` with the comment *"left clears the line-number gutter"* — so `#editor-gutter`
is overlaid on the container's LEFT edge, and anything drawn at that edge is painted over by it.

### ⭐ THE FIX FOLLOWS FROM THAT: the ring needs an element that CONTAINS the gutter
An outline on `.editor-container` sits UNDER an overlaid gutter, so moving it to the container is not enough
— it must go on a box that WRAPS both the gutter and the code, so the gutter is INSIDE the ring rather than
on top of it.
⚠ **VERIFY THE DOM FIRST:** is `#editor-gutter` a child of `.editor-container` positioned absolutely over its
left edge, or a flex SIBLING? If it is already a sibling in a shared parent, the ring belongs on that parent
and this is a one-line change. If it is absolutely positioned, a wrapper may be needed — report before adding
one.
⛔ Do NOT solve it by insetting the ring to start right of the gutter: that draws a ring around the CODE, not
around the PANEL, and the left edge would still visibly disagree with the other three.
⛔ Do NOT solve it by making the gutter transparent — it needs its own background to sit over scrolling code.

⭐ **THE FIX IS `:focus-visible`**, which this stylesheet already uses in ~20 places, so it is house style:
```
  click in  ->  NO ring     the user knows where they clicked
  TAB in    ->  ring        the user needs telling
```

### ⚠ Cares
- **Check all five themes.** The human reported it in futuristic AND steampunk, so whatever draws it is
  theme-independent — the fix must be too.
- ⚠ **The editor is a DUAL-LAYER surface** (`#editor` invisible over `#editor-highlight`, see styles.css:3174).
  Make sure the ring is suppressed on the layer that actually takes focus, not a sibling that never does.
- ⚠ **Do not suppress focus rings globally.** Scope it to the editor. Other inputs still need theirs.
- ⛔ If it turns out NOT to be a UA default but a deliberate rule someone added for a reason, REPORT it rather
  than deleting — the reason may be a real one nobody wrote down.

### 13. [SHIPPED t2162] On mobile the CLEAR button dwarfs its siblings - and the siblings are the bug
*(human, 2026-08-22, from a phone screenshot: "on mobile the clear button appears larger then its sibling")*

**It looks like clear is oversized. It is not — the other five are UNDERSIZED.** `styles.css:5380`:
```css
  @media (max-width: 600px) {
    .editor-toolbar #btn-clear { min-width: 44px; min-height: 44px; justify-content: center; }
  }
```
44px is the standard minimum touch target, and ONLY the clear button gets it. Its five siblings in that row
(+, refresh, undo, redo, copy) have no floor at all, so on a phone they sit well under a comfortable tap size.

⭐ **SO THE FIX IS TO RAISE THE OTHER FIVE, NOT SHRINK CLEAR.** Shrinking clear would fix the appearance by
making every button in the row too small to hit reliably - trading a cosmetic complaint for an ergonomic one.

### ⚠ THE SECOND PROBLEM, and it is the more interesting one
**The one button with a proper tap target is the DESTRUCTIVE one.** On a touch screen the easiest thing to hit
is Delete. That is backwards, and it is worth deciding deliberately rather than inheriting it:
- equal sizing (the fix above) at least stops singling it out
- ⚠ but check whether clear CONFIRMS before wiping. If it does not, an easy-to-hit destructive control with no
  confirm is the actual hazard here, and the button size is only how it was noticed.
⛔ Do NOT solve this by making clear SMALLER than its siblings - a deliberately hard-to-hit control is a
usability smell, and it would also break the 44px accessibility floor it currently satisfies.

### ⭐ A CHEAPER WIN IN THE SAME RULE — move the toolbar to the BOTTOM on mobile
*(human, 2026-08-22, considering a vertical stack: "maybe on mobile these need to be a colomn just asking")*

⛔ **A column was considered and is worse.** `styles.css:5415` shows the toolbar is
`position: absolute; right: 8px; top: 8px` — it **floats over the code**, it does not sit in its own band.
A row obscures the first line or two; a vertical stack of six 44px buttons is **264px tall** and would cover
most of the visible code down the entire right edge, exactly where line-ends are. Bigger obstruction, not smaller.

⭐ **The arithmetic says the ROW survives at proper size:** 6 × 44px + 5 × 4px gaps = **284px**, against a
390–430px phone viewport. Tight but it fits, and `max-width: calc(100% - 16px)` already guards it.

⭐ **The real annoyance is `top: 8px`** — it parks the toolbar over the FIRST LINE, which is where the caret
usually is. On mobile, move it to the BOTTOM right: most programs do not fill a phone screen, so it would
float over blank space instead. One line in the same media query, and it solves more than reorienting does.

⚠ **What would justify revisiting a column:** a seventh control, or any of them gaining labels. At that point
the answer is still not a column — it is collapsing the rare ones into an overflow menu and keeping two or
three primaries visible. Six floating controls is already a lot for a phone.

### ⚠ THIS RULE HAS ALREADY SILENTLY BROKEN ONCE
`styles.css:5374-5376` records it: t1255 set the floor via a `.hdr-clear` class, a later move to
`.editor-toolbar #btn-clear` left the old selector matching NOTHING, and the phone floor stopped applying —
**measured at 24px, not 44px** - until someone noticed by eye. ⭐ That is the removal-chain pattern again
(the selector survived its element), and it argues for a TEST asserting the computed tap size at phone width
rather than another hand-check.

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

### 14. [✅ SHIPPED t2221 — all THREE clusters, a third found during the sweep] TWO DEAD-CODE CLUSTERS IN THE EDITOR CHROME, found during t2155 and deliberately NOT swept
*(worker, t2155 — reported rather than removed, because a refactor turn must not also be a removal turn)*

Both are pre-`t2078` leftovers: `t2078` rebuilt the editor's button row as one flex row and these two never
got cleaned up behind it.

```
  #editor-comment                                the comment/uncomment control's old id
  #align-rotate-btn / #editor-cam-btn  bottom:*  absolute offsets from when each button
                                                 positioned itself over the editor's corner
```

⚠ **Why they are worth a line rather than a silent delete.** `t2099` is the precedent that makes this a real
category and not tidying: a class rename left `.hdr-controls .hdr-clear` matching nothing, so the phone-width
44px touch floor **silently stopped applying** — measured at 24px — and nobody noticed until it was looked for.
A selector that matches nothing is indistinguishable from a rule that works, right up until you measure.

⛔ **Sweep the chain, do not just delete the rule.** The standing doctrine: a removal is a SWEEP — the id or
class, every CSS rule that names it, every JS reader, any test asserting it, and any comment that documents it.
Deleting only the CSS leaves a dangling id in markup that reads as live.

⚠ **VERIFY DEAD, DO NOT ASSUME DEAD.** `#editor-comment` in particular: `editorTextOps.js` survived the `t2139`
indentation removal and still owns comment/uncomment through **three doors** (button, keyboard, context menu).
Prove the *id* is unreferenced, not the *feature* — they are not the same question, and the feature is live.

⇒ **A tail-sized item.** Two clusters, one commit each, with the grep evidence for each deletion in the message.

#### ✅ UPDATE (t2221) — SHIPPED, all three clusters (a third turned up during the sweep, not just the two named above)

`#editor-comment`'s dead lookup (`editorTextOps.js`) and the two `bottom:` override blocks for
`#align-rotate-btn`/`#editor-cam-btn` are both deleted. The second cluster was verified BY RENDERING, not by
reading, per this entry's own standing doctrine: `getComputedStyle` at both media conditions (portrait, and
landscape+keyboard ≥700px) returned `position: static` for both real buttons in every case — a `bottom`
override on a static element computes but has zero layout effect, so both blocks were genuinely inert.

A THIRD cluster turned up mid-sweep, not named in this entry's original text: `globalFunctions.js`'s
`EDITOR_FILE_ACTIONS` + `window.ddcsEditorFileMenu` (the editor's retired corner FILE menu, t1227) — already
self-documented as dead code in its own comment, confirmed live (DOM ids absent, function unreferenced except
by its own now-updated boot-wait in `editor-file-menu-1227.spec.js`), deleted the same way. Full suite green
(2782 passed; the same 6 pre-existing failures already queued for their own turn, plus one new transient
confirmed non-blocking by isolated re-run — none related to this change).

### 15. [SHIPPED t2206 - 20 font shorthands] INVALID CSS SHORTHANDS THAT SILENTLY VOID THEIR WHOLE DECLARATION — a category, not two bugs
*(found twice in two days, both by measuring rather than by reading — t2155 tail and t2173; a relative found at
t2190, one level up: a comment that ends itself)*

A CSS shorthand is all-or-nothing: if **one** component is invalid, the browser discards the **entire**
declaration. No console error, no warning, no partial application. The rule looks correct in the file and
renders as though it were never written.

**Two confirmed instances, both shipped and unnoticed for months:**

```
  .viz3d-handle          border: 1px solid var(--dock-handle-edge)
                         └─ studio's token is a 4-VALUE per-side value; a shorthand's colour
                            slot takes ONE. Studio rendered the handle with NO BORDER AT ALL.
                            Caught by getComputedStyle reading border-width: 0px, not 1px.

  .preflight-badge-label font: … inherit
                         └─ `inherit` is not valid as a COMPONENT of the font shorthand
                            (only as the whole value). The entire font declaration is dropped.
```

⭐ **The same disease one level up (t2190): a comment that ends itself.** An explanatory comment reading
`.library-*/.lib-*` (glob-style prose, meant as "library-prefixed and lib-prefixed") contains the literal
sequence `*/` — which is CSS's own comment-close token. The comment ended three words early; everything after
it, until the parser found a recovery point, became unparsed garbage — silently dropping `.wsm-overlay` (shared
chrome for the workspace/wizard/project managers) from the loaded stylesheet. Same tell as the shorthand cases:
**the file still parses** (no error, no warning), and the rule looks completely correct at its own call site —
only `document.styleSheets`'s own parsed `cssRules` (not the source text) showed it was gone. Confirmed via
`git stash` bisection that `wizardManager.js`'s own overlay — untouched that turn — broke identically, proving
the cause was the new comment, not something pre-existing. ⇒ **The rule for future CSS comments**: never write
a glob/path-style "A-*/B-*" pattern inside a `/* */` block — spell out "A- or B-prefixed" instead.

⭐ **Why this is worth a sweep rather than two fixes.** Both were found by *measuring a computed value*, and
neither would ever be found by reading. The failure is invisible in the source, invisible in the diff, and
invisible in review — which means however many more exist, they will not surface on their own.

⇒ **Sweep the file for shorthands whose value contains a `var()`**, since that is the shape that hides it: the
token's contents are not visible at the call site, so a 4-value token in a 1-value slot reads as fine.
`border`, `font`, `background`, `margin`/`padding`, `flex`, `grid`, `transition`, `animation`.

⚠ **VERIFY BY COMPUTED VALUE, NEVER BY EYE.** The whole category is defined by looking correct. A candidate is
only confirmed by `getComputedStyle` disagreeing with the source — that is also what makes each fix testable.

⛔ **Fix by splitting, not by inlining the token.** `border-width` / `border-style` / `border-color` as separate
longhands keeps the token doing its job; replacing `var(--x)` with a literal would fix the render and lose the
theming, which is the wrong trade in a file built on tokens.

⚠ **Both known instances are already flagged in the WORK-LOG and NOT fixed** — the handle one was fixed at
t2155, the badge-label one is outstanding. Confirm which is which before starting.

⭐ **UPDATE (t2202): SWEPT AND CLOSED.** `border`/`outline`/`animation`/`transition` shorthands carrying a
`var()` were checked across all 5 themes (every token resolves to a single valid value in its slot — no
second `.viz3d-handle`-shaped bug anywhere in that family). `font` was the one that had more: t2173's own
prediction ("likely others sharing the same font: … inherit shorthand pattern elsewhere in styles.css") was
right — a file-wide grep for `font:[…]inherit` (component, not sole value) found **20 instances**, not 1: the
known `.preflight-badge-label` plus 19 more, every one a copy-paste of the same invalid shape
(`font: <weight> <size>[/<line-height>] inherit;` — `inherit` can only be the shorthand's SOLE value, never a
component beside explicit weight/size, so the whole declaration was silently dropped by the parser). Every one
split into `font-family`/`font-weight`/`font-size`/`line-height` longhands — never inlined, per this item's own
rule.

**Verified by computed value, not by eye**, exactly as this item demanded: built the minimal DOM each compound
selector needs and read `getComputedStyle` — 16 of 18 tested cases now show their declared size AND weight
(0 of either matched before the fix, on any of them). The remaining 2 (`.op-ctx-item`, `.sl-primary`, both real
`<button>` elements) show their declared font-SIZE correctly but lose the font-WEIGHT cascade battle to this
codebase's own generic `button, .btn, .op-btn, .toolbar-btn` rule — a genuine, but DIFFERENT and pre-existing,
category (cascade specificity, not parse-time shorthand validity) and out of this item's own scope; verified
via the CSSOM directly (the parsed rule DOES carry the longhand, confirming the fix landed) rather than
asserting a computed value the fix was never going to control.

New `tests/css-shorthand-inherit-2202.spec.js` — non-vacuous (`git stash` of styles.css → both tests fail
against pre-fix code; restored, both pass). Full smoke tier + every test file directly named after a touched
selector (44 candidate files found by grep; the ~15 most directly relevant run in full) — all green. One
apparent regression chased down and RULED OUT, not swept under the rug: `save-dialog-declared-1615.spec.js`
timed out waiting for Blockly's own boot signal (`window.__blkws`) in 2 of 3 tests, in a ROTATING pattern
across repeated runs — confirmed via `git stash` bisection run TWICE that the SAME flaky pattern reproduces on
the unmodified pre-t2202 tree too (a coin-flip on which 2 of 3 fail, both with and without this turn's CSS).
Pre-existing test-timing flakiness, unrelated to this fix.

### 16. [SHIPPED t2200 - 8 of 9 shells] THE DECLARED COMPONENTS EXIST AND NOBODY USES THEM — modals, and the Local/Cloud switcher
*(human, 2026-08-23, comparing the Wizards, Workspace and Projects modals side by side: "the project modal
seems different then the others, is it actually sharing assets?" then "the local cloud tab also needs to be
reused")*

Their answer, measured: **they share the paint, not the component.**

### The modal shell

```
  .modal-card          styles.css:2072      the declared shared modal shell
                                            → ZERO consumers. No JS, no HTML.

  instead: 15 separate rules each re-read the SAME four tokens by hand
    .library-modal        Projects      .wss-box            Workspace
    .setup-sheet-modal    .proj-savepanel    .cloud-modal-panel    …
```

Every modal repaints itself from `--modal-face` / `--modal-edge` / `--modal-radius` / `--modal-shadow` under
its own class name. ⭐ **That is why they nearly match and drift everywhere the tokens do not reach** — colour,
radius and shadow agree; padding, header layout, button sizing and controls do not.

⚠ Projects looks the most different for a specific reason: it still wears `.library-modal`, the shell built for
a **tabbed container**. t2180 deleted the tab strip; the body is still laid out to sit inside one.
⭐ **UPDATE (t2190): this is fixed, as a side effect of an unrelated turn, not this item.** `libraryModal.js` (the
`.library-modal` shell) is deleted outright — Projects' new manager (`ui/projects/projectManager.js`) reuses
`.wsm-modal`, the SAME shell Wizards and Workspace already wore. All three managers now share one modal shell.
`.modal-card`'s OTHER 15 call sites (setup-sheet, cloud-modal-panel, etc.) are untouched — this update narrows
the count, it does not close the item.
⭐ **UPDATE (t2196): `.modal-card` has its FIRST real consumer.** The zero-consumers claim above is no longer
true — `ui/wizardManagerPanel.js`'s new `openWizardBarManager()` panel (`#wizbarOverlay`) uses `.modal-scrim`/
`.modal-card`/`.modal-head`/`.modal-body` as-declared, no adaptation needed (a brand-new panel, nothing bespoke
to migrate away from — cheap by construction). The OTHER 15 sites are still hand-painted and still this item's
own subject; this is one more data point that the base works when a new consumer just uses it.

### The Local/Cloud switcher

```
  .proj-voltab    libraryModal.js:68          "☁ Cloud"           Projects        ⛔ GONE (t2190 — file deleted)
  .proj-voltab    projectModal.js:76          "☁ Cloud"           save modal      ⛔ GONE (t2190 — file deleted;
  .proj-starget   projectModal.js:377         "☁ Cloud"           save target        Save has no Cloud target any more)
  .wsm-place      wizardManager.js:167-168    "📁 Local folder"  ⎫ the same two lines,
  .wsm-place      workspaceManager.js:285-6   "📁 Local folder"  ⎮ verbatim, including
  .wsm-place      projectManager.js:65-66     "📁 Local folder"  ⎭ the is-active ternary — t2190's REPLACEMENT
                                                                    for the three GONE rows above already reused
                                                                    this exact class + wording, not a new one.
```

⭐ **UPDATE (t2190): three of the five original sites are deleted, and the two survivors' vocabulary problem is
ALREADY SOLVED for what remains** — projectManager.js's own Library shelf (t2190) was built by copying
wizardManager.js's `.wsm-place` markup and its EXACT wording verbatim (not independently re-derived), so all
THREE living sites now read `.wsm-place` / "📁 Local folder" / "☁ Cloud" identically. The "two different
vocabularies" ⛔ below is CLOSED for these three specifically; what remains is three copy-pasted (not shared)
implementations of the identical thing — a dedup, not a vocabulary fix.
⭐ **UPDATE (t2194): the anticipated reduction landed — one site remains, not three.** The wizard/project
managers' whole LIBRARY section (browsable shelf + this switcher) is retired outright, replaced by a plain
Import button (a native file picker, no volume concept at all — a chosen file doesn't say where it came from).
`.wsm-place` now has exactly ONE surviving site: `workspaceManager.js`'s own Cloud/Local tab. With only one
instance left, "unify the vocabulary across sites" is moot for this switcher specifically — there is nothing
left to disagree with. `.modal-card`'s other 15 call sites (unrelated to the switcher) are still open.

Five markup sites, two class families, and ⛔ **two different vocabularies for the same concept** — a user reads
`Local` in one modal and `📁 Local folder` in the next and has to work out they mean the same volume.
*(as originally written, before the t2190 update above — left intact per this file's own convention of not
rewriting history; the update note says what changed and when.)*

### ⭐ Why this is one item and not two

Both are the same failure: **a declaration exists, is correct, and every caller bypasses it.** Same shape as
`.viz3d-handle`'s dead studio override (t2155) and `wizardManagerPanel`'s claimed-but-absent Fork (t2180) —
things that are true in the source and untrue in the running app.

⇒ Adopt `.modal-card` at its remaining sites (down from 15 — three managers already share `.wsm-modal` as of
t2190). The volume-switcher half is now down to ONE call site (workspaceManager.js, as of t2194) — nothing left
to unify there; what remains of this item is `.modal-card` adoption alone.
⚠ **Fix the vocabulary while unifying** — moot for the switcher (one site, one name, by construction); still
applies wherever `.modal-card` adoption touches wording.

⛔ **Re-scope before starting**, since the item's own premise (five switcher sites, two families) is gone —
confirm what remains is really `.modal-card` adoption's own turn, not the two-concern turn originally sized here.

⚠ **Verify by screenshot matrix, not by diff**: the three modals side by side, in all five themes, before and
after. The whole point is that they currently agree by coincidence — a diff cannot show you that they stopped.

⭐ **UPDATE (t2200): ADOPTED at every LIVE site but one.** Re-scoped first, per the item's own instruction —
the actual current inventory (found by scanning every `background: var(--modal-face)` rule in styles.css, not
assumed from the old "15" count) was 10 selector-groups: the declaration itself, 8 live hand-painted consumers,
one DEAD rule, and one genuine resistor. All 8 live ones now compose `.modal-card` in markup instead of
restating its six properties under their own class name — `.wsm-modal` (wizardManager.js/workspaceManager.js/
projectManager.js — three real surfaces, one shared class), `.help-modal`, `.setup-sheet-modal`,
`.cloud-modal-panel`, `.wss-box`, `.ddcs-busy-card`, `.saved-pop-card`, and `.settings-modal` (`#settings-app`,
a STATIC class in index.html rather than JS-built — the one site with a different migration shape). Each
site's own CSS rule keeps only what `.modal-card` does not supply (width/height/padding/flex layout); the
SCRIM classes (`.wsm-overlay`, `.help-overlay`, etc.) are deliberately left alone — their z-index tokens are
per-modal-family on purpose (so one modal can stack over another), which `.modal-scrim`'s own single z-index
token cannot express without an override at every site, so composing it there would be the wrong move, not a
missed one.

Two composed sites gained a real property they never had before, not just moved words: `.cloud-modal-panel`
and `.settings-modal`/`#settings-app` never set their own `color` (`.modal-card` does — `var(--text)`); the
other six now also carry `overflow:hidden` for the first time. **Checked, not assumed**: a 5-theme × 6-site
screenshot matrix (`verification/t2200-*-after.png`, 30 images) plus a stashed BEFORE pass compared by eye —
zero visible difference anywhere, including studio (the theme most likely to expose a white-on-white miss)
and steampunk (asymmetric radii, where a stray `overflow:hidden` clip would show first).

⛔ **ONE genuine resistor, reported rather than forced**: `.wiz-box, #blk_wiz_user` (the Generator/wizard
modal AND the Blocks-tab docked Wizard View pane, sharing one rule) is NOT migrated. Three real reasons, not
caution for its own sake: (1) it is the single busiest, most test-covered surface in the app — every op wizard
opens through it; (2) the rule is genuinely DUAL-HOST — one selector paints both an actual modal (`.wiz-box`,
inside `#wizard.overlay`) and a non-modal EMBEDDED pane (`#blk_wiz_user`, no scrim, no overlay at all) —
composing `.modal-card` cleanly would mean splitting this into two rules with two different class targets, a
bigger structural change than "add a class, drop four properties" every other site got; (3) its own comment
history documents a PAST bug in exactly this area (`#blk_wiz_user` once inherited the wrong ground colour
entirely) — `.modal-card`'s `color`/`overflow` additions are the same shape of change that broke it before.
Left exactly as-is; a candidate for its own dedicated turn, not a corner cut on this one.

Also found, not touched (out of THIS item's scope — adoption at live sites, not dead-code removal, per the
global "mention it, don't delete it" convention for anything not directly asked): `.settings-box` (styles.css)
and its own un-namespaced `.settings-head`/`.settings-close`/`.settings-body`/`.settings-section` siblings have
ZERO consumers anywhere — no JS creates it, no HTML wears the class. A "SECOND, older settings dialog" per its
own comment, apparently fully superseded by `#settings-app` and never removed. Flagged for a cleanup turn.

Also fixed in passing, unrelated to modal-card itself: `tests/cloud-default-754.spec.js`'s own "EXPORT-to-
cloud failure" test drove `[data-place="cloud"]` — the manager shelf tab t2194 deleted OUTRIGHT, months (turns)
before this one. The test had been silently red since t2194, in a file that turn's own sweep never touched;
fixed to drive the real `dlgChoice` destination-ask flow instead. Confirmed pre-existing (not something this
turn's CSS change could cause) by running it against the pre-t2200 tree before touching it.

---

## THE QUEUE - 2026-08-23, human: "yes loop them all"

The human asked for the whole list to be worked through rather than picked from. This is the ORDER, and the
reasoning behind it, so the loop does not need re-deciding every turn.

**Ranked by what a defect COSTS, not by what it costs to fix.**

    1. #6   hand-authored T.nc / error.nc DISCARDED on reload      <- outright data loss
    2. #8   M6.rc offered as editable; it is a compiled GUI resource  <- invites corrupting a controller file
    3. #5   a raw NUL byte makes macrosApp.js invisible to grep     <- a landmine under every future search
    4. #14  three dead-code clusters in the editor chrome
    5. #4   lathe icons - centreline removed; polygon + face-probe still undrawn
    6. #10  wizard preview shows ONE op with no idea where it sits
    7. F1   gateway tabs do not gate by role
    8. F3   remove the clicking sounds; propose sounds for invisible states
    9. F4   the V4.1 "Advanced machining" tab

#6 and #8 go together: same surface (the macros /DISK/ shelf), and both are the app inviting a loss.

---

### 17. [NOT A BUG — RESOLVED 2026-08-25] THE DIRTY DOT IS ON AT BOOT ON THE HUMAN'S PHONE - and a fresh browser cannot reproduce it

*(human, 2026-08-23: "so the dot in filename is still there on open without changing anything". Reported once
before and "fixed"; still present on ddcs-studio.pages.dev.)*

**WHAT I MEASURED (advisor, t2214) - do not redo this, it is all negative and that is the useful part:**

    fresh browser, settled 9s      dot off, dirty false, sig == watermark, changed []
    idle a further 6s              signature did NOT drift
    reload (returning-user path)   watermark survived, signature identical, still clean
    theme via raw localStorage     no change to the signature at all

So the boot path, the settle-and-watermark loop, and the returning-user path are all CLEAN in a fresh browser.
Two obvious theories are DEAD: it is not boot-time drift, and it is not the theme.

**WHAT IS STILL UNTESTED, in the order I would test it:**
  - **the DEPLOYED build vs localhost.** Every probe above ran against 127.0.0.1:3001. The human is on
    ddcs-studio.pages.dev on Android, and asked how to hard-refresh on Android earlier the same day. ES modules
    cache per-URL. A stale bundle would explain this AND #18 with ONE cause - check this FIRST.
  - **a build-driven default change.** The watermark is a hash of the backed-up stores' CONTENT. A release that
    changes any default (a new built-in wizard, a new display pref, a re-seed) shifts that content for every
    existing user, so a watermark taken on the older build no longer matches and the dot lights with nothing the
    user did. Six releases shipped on 2026-08-23 alone. If this is it, the question is not how to silence the
    dot but whether a build-driven default change should count as unsaved USER work. It should not.
  - **the human's real controller.** Their workspace is V4.1 / Expert M350; every probe booted the default
    machine. app.js's seedDefaultPortedUserOps() is controller-dependent and backup.js:190 already records it
    genuinely diverging once.

**The code already knows something is wrong here:** blocks/saveStates.js:74 calls it "a separate, deeper bug
traced but not fixed".


#### RESOLVED 2026-08-25 — WORKING AS DESIGNED, and the reproduction attempts failed because there was nothing to reproduce

Human, after checking: *"right it checks out if i save refreshing makes dot vanish."*

**The dot means "your localStorage buffer differs from the last `.ddcs` you saved."** The workspace had never
been saved to a file, so there was no last-saved state for the buffer to match — and nothing ever could. The
dot was correct, permanently, and a refresh could not clear it because a refresh changes neither side of that
comparison.

⚠ **Four reproduction attempts failed because the app was never wrong.** Recorded because the effort was real:
fresh-browser boot, idle drift, reload/returning-user, theme switch, a clean non-caching server, and a
deployed-build comparison — all measured, all clean, all correct.

⭐ **The lesson is about the DIAGNOSIS, not the code.** Every probe asked *"is boot dirtying something?"* — the
wrong question. The right one, *"is there a baseline at all?"*, was answerable in one glance at the workspace
manager, which distinguishes **"Never saved to a file"** from **"Unsaved changes"** in its own state line. Six
measurements chased a mechanism when the first step should have been checking whether the premise held.

⇒ **See BACKLOG 25 for what IS worth improving here** — the dot itself cannot express that difference.

---

### 18. [RESOLVED 2026-08-25 — STOPPED HAPPENING, CAUSE NEVER ESTABLISHED] THE KEYBOARD DOCK IS OPEN AT BOOT ON THE HUMAN'S PHONE - mobile only, and also not reproducible

*(human, 2026-08-23: "also still always opening on the keyboad opened", then "the dock thing is on mobile only
from what ive seen", then the lead: "possibly has to do with the new button row we added earlier".)*

**PRIOR ART, AND THE WARNING IN IT:** db239642 "t2176 amendment 1 (tail): dock-closed-at-boot investigated,
NOT REPRODUCED, regression-locked". A test was added asserting the dock boots collapsed. It passes. The human
still sees a keyboard. **A green test asserting the wrong thing is exactly what that commit produced** - do not
let this one end the same way.

**WHAT I MEASURED (advisor, t2214), Pixel 7 emulation, settled 9s:**

    is-expanded class     absent
    dock height           43px = 5% of an 839px viewport
    visible inside it     the handle, and nothing else
    suggest bar           hidden      tab strip   hidden

So emulation agrees with the test and disagrees with the human's screenshot, which plainly shows the suggest
row (G0 G1 G31 IF M3 # "("), the BACK/SPACE/ENTER row AND the MOVE/G-M/MATH/LOGIC/VAR tab strip.

**THE HUMAN'S OWN LEAD, WHICH IS THE BEST ONE: the new editor button row.** It was added directly above the
dock handle this session. Worth checking, in this order:
  - does anything in the new row's mount focus the editor, or synthesise a click that reaches the dock?
  - dockManager.js has a delegated dock click handler (~:98) below the direct handle listeners - can a tap
    aimed at a toolbar button land on the 43px handle, or can one event be handled TWICE (direct + delegated)?
  - is the auto-expand at dockManager.js:83 reachable without a real drag? It sits inside pointermove behind a
    >4px threshold, so a stray pointermove during layout settling is worth ruling in or out.
  - **and check the DEPLOYED build before any of it** - see #17. One stale bundle would explain both.

**Do not close this on a passing test.** It must be confirmed on the human's actual phone against the deployed
site, or confirmed as a stale-cache artefact and closed for that reason with the evidence.


#### RESOLVED 2026-08-25 — and the distinction matters

Human, checking their own phone: *"dock is fine now."*

⚠ **It stopped happening. It was never reproduced, and the cause was never found.** Those are different
things, and this entry is retired as the first rather than the second.

**What was ruled out along the way, all measured:** a stale deployed build (`pages.dev` served the same version
as `main` when checked), a caching probe server (re-measured on a clean one, same result), and boot-time
expansion (a mobile context at 412px booted the dock at **43px, handle only, `is-expanded` absent** — three
separate times across the session).

⇒ So the app's own boot path is clean and has been throughout. Whatever produced it lived on the human's
device — most likely a cached bundle or accumulated state that has since been replaced.

⛔ **If it returns, do NOT re-run the reproduction attempts above** — they have been done three times and are
all negative. Go straight to the difference: their device's stored state and their real controller config,
neither of which any local probe reproduces. And note the prior history on this entry: an earlier turn also
failed to reproduce it and closed it by adding a regression test, which passed while the human still saw the
bug. **A green test on this one proves nothing.**

---

## STALENESS - THE FILE'S REAL DEFECT, AND THE FIX FOR IT

**2026-08-23. EIGHT of eighteen entries were stale in a single evening.** Four had shipped and never left the
file. Two (#6, #8) were fixed at t2143 and cost a worker turn to re-prove. Two more (#5, #4) were verified
stale by the advisor in under a minute each.

**The cause is not carelessness.** The file's own rule already says an item is done when it LEAVES the file,
and that entries must name where the evidence is. What went wrong is subtler: the entries name evidence as
PROSE - "the icon does not read as a lathe", "a NUL byte makes the file invisible to grep" - so deciding
whether an entry is still real requires reading it, understanding it, and then designing a check. That is
expensive enough that nobody does it, so entries accumulate instead of retiring.

**THE FIX: every entry carries a STILL REAL IF line - ONE runnable command whose output decides it.**
Not a description of the bug. A check that answers yes or no without being understood first.

Worked examples, all run at t2220, all decisive in one command:

    #5   python -c "print(open('ui/macrosApp.js','rb').read().count(b'\x00'))"
         -> 0. The NUL is gone. STALE.
         (note: grep -P is NOT usable here - this environment's grep rejects -P on a non-unibyte locale
          and exits non-zero, which reads as "no match" if the exit code is trusted. It fooled me once.)

    #4   grep -c "user_lathe_polygon\|user_lathe_faceprobe" ui/wizIcons.js
         -> 2. Both icons this entry says are undrawn are drawn. STALE.

    #14  grep -n "getElementById('editor-comment')" ui/editorTextOps.js
         -> line 133, and the element is gone from index.html. STILL REAL.

**A check that cannot be written as one command is a sign the entry is an ARC, not a backlog item** - and by
this file's own opening rule it belongs in ROADMAP.md instead. That test is worth applying when adding, not
only when retiring.

### Still-real checks for what remains

    #10  design/feature gap, no mechanical check - confirm by opening a 3-op wizard and looking
    #14  grep -n "getElementById('editor-comment')" ui/editorTextOps.js        -> STILL REAL (t2220)
    F1   [STALE - VERIFIED t2229] the entry's own named blocker is gone: status.js descriptor() now
         degrades to a real client-role render on an unreachable daemon (t2151, postdates the entry)
         MY CHECK ABOVE WAS ITSELF BROKEN - grep -i "gate|client|server" has no -E, so the pipe was
         matched LITERALLY and the check reported nothing for the wrong reason. Caught by the worker.
         This is the section's own warning landing on the section: a check that cannot fail loudly is
         worse than prose, because prose does not look like evidence. WRITE CHECKS THAT CAN ERROR.
    F3   grep -n "ui.click|ui.toggle" ui/sound.js                              -> entries still present,
         but this item asks for a JUDGEMENT (which sounds to keep), not a deletion - UNVERIFIED
    F4   grep -rn "Advanced machining" --include=*.js .                        -> 0 hits, i.e. UNBUILT,
         which for an ADD item means STILL REAL rather than stale
    17   the dirty dot - see the entry; every negative result is already recorded there
    18   the keyboard dock - same, and read its history warning before touching it

⚠ Note the F4 shape: for an entry that asks to ADD something, "no hits" means STILL REAL. A staleness check
has to know which direction it is pointing. Write the check so its PASSING output is the stale one, and say
which that is - otherwise the check is as ambiguous as the prose it replaced.

---

### 19. [✅ SHIPPED t2269 — CSS cap VERIFIED t2296 — viewport-derived cap, no item-count limit] THE WIZARD-BAR DROPDOWN HAS NO OVERFLOW PROTECTION AT ALL

✅ **CONFIRMED FIXED — advisor verified in the CSS, 2026-08-26.** `styles.css:1511` `.toolbar-dropdown-content`
carries `max-height: calc(100vh - 40px)` + `overflow-y: auto`, with its own comment citing
*"BACKLOG 19 (t2245 finding, t2269 fix)"*. **The viewport-derived cap is CSS, not JS.**

⛔ **Its STILL REAL IF check below is BROKEN — it reports the fix as missing. Do not reopen on it.**
`grep "max-height|overflow" styles.css | grep toolbar-dropdown` finds the `max-height` line and then discards
it, because that line sits **23 lines below** the selector and does not itself contain the word.

⭐⭐ **All THREE broken checks in this file share one cause: a LINE-scoped grep cannot verify a BLOCK-scoped
fact.**

```
#19  the fix is 23 lines BELOW  the selector the check greps for
#22  the fix is 8 lines ABOVE   the interpolation the check greps for
#21  the fix is on the same line but deliberately KEEPS the old string as a fallback
```

⇒ **When writing a STILL REAL IF, prefer a check that survives the fix**: a test name, a symptom in the
running app, or a grep for what the FIX looks like rather than what the BUG looked like. A check written
against the bug's shape reports "still broken" the moment the shape changes — always in the expensive
direction, because it sends someone to re-investigate finished work.

*(found at t2245 while measuring whether spaced pills made the menu too tall — the height question was the
prompt, this is what the measuring turned up. Pre-existing, NOT introduced by that change.)*

**STILL REAL IF:** `grep -n "max-height\|overflow" DDCS-Studio/web/styles.css | grep toolbar-dropdown`
→ **no output means STILL REAL** (this is an ADD item: nothing found = nothing protects it).

`.toolbar-dropdown-content` has **no `max-height`, no `overflow` rule, and no JS clamping** — confirmed by
grep at t2245. The menu is exactly as tall as its contents, wherever that lands.

**Why it has not bitten yet, and why it will:** the probing dropdown is 8 items and fits a 430px phone with
room. Nothing enforces that. A user adding wizards to a dropdown through the Wizard-bar editor — which this
app explicitly supports, *"add or delete a dropdown, show/hide or re-icon any wizard"* — can make one longer
than the viewport, and the items past the bottom edge become unreachable with no scroll to recover them.

⚠ **Do not "fix" this by capping the item count.** The layout is what fails, not the user's choice of how many
wizards they want in a group.

⚠ **A max-height must be viewport-derived, not a constant.** A fixed pixel cap is wrong on both a phone and a
1440p monitor, and this codebase has already been bitten once by a hard 400px preview height that nothing
downstream consumed (see BACKLOG #10's t1468 note).

---

### 20. [ATC HALF FIXED t2257 — the SYSTEMIC half is open, see below] THE ATC TWINS DECLARE BOTH A `panel` AND A `sim` NODE — registering them as-is ships TWO stacked boxes

*(found at t2255 while reporting why ATC's 3D preview cannot be resized. NOT the resize bug — that one is six
missing wrappers in index.html and is being fixed separately. This is a defect waiting at E2.)*

**STILL REAL IF:** `grep -n "panel\|sim" DDCS-Studio/web/blocks/dataOps/atc*Data.js`
→ **both node types present in one def means STILL REAL.**

Each ATC twin (`blocks/dataOps/atc*Data.js`) declares a `sim` node — good, that is the declared route every
other wizard takes. But it **also** declares a `panel` node ahead of it, and `formWidgets.js`'s `sim` branch
builds the 3D *and* 2D panes unconditionally. So the two overlap: register the twin as it stands and the wizard
renders two stacked preview boxes rather than one.

**OBSERVED at t2255:** `registerUserOp(atc*DataDef())` appears nowhere live, and all three existing twin tests
self-document as *"NOT registered/in-place yet (E2)"*. ⇒ Nothing is broken for a user today. It breaks the day
someone registers them.

⚠ **Fix this BEFORE E2, not during it.** Discovering it while flipping the twins live turns a one-line
declaration cleanup into a debugging session in the middle of a migration.

⚠ **And decide which node is redundant rather than deleting the one that looks easier** — `panel` and `sim` are
not synonyms, and whichever survives has to carry what the other was doing.


#### ⚠ UPDATE t2257 — it is NOT ATC-only, but "broken" is only PROVEN for ATC

**OBSERVED:** **30 of ~32** dataOps files declare a `panel` node, and **24 of those also declare `sim`.** So the
shape is nearly universal, not an ATC quirk.

⭐ **But the shape is not the defect.** `params.panel`'s own declared value (`form3d+2d` / `form3d` / `form` /
`commscreen`) is **never read** by `formWidgets.js`'s panel branch, so for the other 23 the duplication may be
inert. What made it real for ATC specifically is that `panel` and `sim` **hardcode the same `layout2d`
container ids** — an actual id collision, not a cosmetic overlap.

**Fixed for ATC at t2257:** `sim` gained an additive `layout2d: false` opt-out (byte-identical for all 23 other
callers) and `panel` was removed from the six `atc*Data.js`.

⛔ **STILL OPEN, and it is the bigger half:** whether the other 23 are inert or merely un-triggered. ⚠ Do NOT
assume inert because ATC's symptom was an id collision — establish it per file, or establish that the panel
branch genuinely cannot fire, before E2 registers anything beyond ATC.

**STILL REAL IF (systemic half):** `grep -l "panel" DDCS-Studio/web/blocks/dataOps/*Data.js | wc -l`
→ **any count above 6 means the systemic half is STILL REAL.** ⚠ Reads **24** at 2026-08-26.

#### ✅ ADVISOR, 2026-08-26 — SETTLED BY READING THE BRANCH: the other 23 are UN-TRIGGERED, not inert

The entry offered a cheaper route than checking 23 files — *"establish that the panel branch genuinely cannot
fire"*. It fires, and the reason is decisive: **both branches hardcode the SAME ids.**

```
formWidgets.js:1370  sim   →  <div data-viz-pane="layout2d">  id="userVizStatus_tree"  id="userVizContainer_tree"
formWidgets.js:1393  panel →  <div data-viz-pane="layout2d">  id="userVizStatus_tree"  id="userVizContainer_tree"
```

⭐⭐ **Those ids are CONSTANTS in the shared branch, not derived per def.** So nothing about the collision is
ATC-specific — **any** def declaring both nodes yields two stacked `layout2d` panes and a duplicate id pair.
ATC was simply the first one anyone rendered. ⇒ **The 23 are not inert; they are waiting.**

⚠ **Which also makes it the same defect class as #21** (`pathAnchorField`): two elements legally sharing an
id, and a document-order lookup silently resolving to the wrong one. Different widget, identical failure —
and #21's fix (scope the lookup to a root, prefer `[data-param]` over an id) is the precedent for what a real
fix looks like here.

⇒ **THE RULING THE ENTRY ASKED FOR — `sim` survives, `panel` goes:**
- `sim` already carries everything `panel` renders (the `layout2d` pane, same ids) **plus** the 3D pane, and
  since t2257 it can opt out of 2D via `layout2d: false`. **`panel` carries nothing `sim` lacks.**
- ⭐ The cheap, additive step is the one t2257 already proved on ATC: **drop `panel` from the remaining 23
  defs**, exactly as it was dropped from the six `atc*Data.js`. Declaration-only, no branch changes.
- ⛔ **Do NOT delete the `panel` branch from `formWidgets.js`** in the same move — establish first that no
  hand-written shell reaches it. Removing the data declarations is reversible; removing the branch is not.

⚠ **Still gated on E2 timing**, as the entry says: fix it BEFORE anything beyond ATC is registered, not while
migrating.

### 21. [✅ SHIPPED t2293] `ui/pathAnchorField.js` looks up its own mount point GLOBALLY — latent, currently dormant, found t2271

⚠ **Its STILL REAL IF check now gives FALSE POSITIVES — do not reopen on it.** The fix keeps `document`
as the DEFAULT root on purpose, so the 6 static call sites stay byte-for-byte unchanged; the string the
check greps for therefore still appears (`pathAnchorField.js:46` is
`(root !== document && root.querySelector('[data-param=…]')) || document.getElementById(…)` — scoped
first, document as fallback). Two other hits are a stylesheet-injection guard and the fix's own comment.

**OBSERVED:** `mountPathAnchor(prefix)` (`ui/pathAnchorField.js:57`) finds its host with
`document.querySelector('.pa-mount[data-prefix="${prefix}"]')` — the WHOLE document, not scoped to any
rendering root. `buildPicker`'s own `fld()` (`:31`) does the same with `document.getElementById(prefix +
field)`. Both are first-match, document-order lookups. There are already **6 existing call sites** (the
static per-op shells: `surfacingView.js`, `textView.js`, `slotView.js`, `pocketView.js`, `contourView.js`,
`drillView.js`), each relying on being the ONLY `.pa-mount[data-prefix="X"]` in the document at call time —
true historically, because nothing else ever rendered a second one.

**t2271 added a 7th call site**: `formWidgets.js`'s new `path_anchor` `uiChildren` node type (the declared
twin's own picker), reached via `renderUiTree()`. When a twin's declaration and its OLD static shell share the
same prefix (e.g. `sf_` for surfacing) and BOTH are present in the DOM at once — true today, since the old
shells are hidden via `display:none`, never removed — `mountPathAnchor`'s global lookup finds the OLD shell's
`.pa-mount` first and mounts the picker SVGs there instead of into the new declaration's own host. Confirmed via
a direct debug script: `document.querySelectorAll('.pa-mount[data-prefix="sf_"]')` returns the old
`#wiz_surfacing` shell's mount (0 SVGs after mounting into it) with the new host's own mount never even
existing in that particular check — see below.

⭐ **WHY THIS IS NOT A STOP-THE-TURN FINDING, and is not urgent:** `renderUiTree()` — the ONLY code path that
would ever invoke the new `path_anchor` branch — is gated by `hasTreeLayout()` (`userOpView.js:106`), which
requires a real `split_horizontal`/`split_vertical` node. **Zero of the 32 registered twins declare one**, so
the tree-render path is dormant app-wide (a pre-existing, already-documented fact, not new to this entry) —
confirmed live: opening the real Customize route for `user_surfacing_data` and checking
`.pa-mount[data-prefix="sf_"]` finds only the OLD shell's own mount, unbuilt, 0 SVGs; `renderUiTree` was never
called at all. The collision is real but currently inert, on the same footing as the rest of the tree path.

⚠ **IT WILL BITE the moment ANY twin gets a real tree layout AND uses `path_anchor` with a prefix that collides
with a still-present static shell.** Fix before then, not urgently now.

**Fix, once picked up:** give `mountPathAnchor`/`buildPicker` an optional scope root (default `document`,
preserving the 6 existing call sites byte-for-byte) and have `formWidgets.js`'s `path_anchor` branch pass its
own `container` as that root. `fld()`'s `getElementById` lookup needs the same treatment — likely
`root.querySelector('[data-param="${field}"]')` scoped within the container rather than an `id` match, since
two elements can legally end up sharing an `id` in this scenario (the real root cause, `id` matching is not
safely scoped-able the way `querySelector` from a root is). ⚠ Touches a shared widget with 6 existing call
sites — verify none regress before shipping.

**STILL REAL IF:** `grep -n "document.querySelector\|document.getElementById" DDCS-Studio/web/ui/pathAnchorField.js`
→ any hit means unscoped lookups are still there.

---

### 22. [✅ SHIPPED t2291 — `40149e3a`] THREE SITES INTERPOLATE TEXT STRAIGHT INTO G-CODE PARENTHESES

⚠ **Its own STILL REAL IF check now gives FALSE POSITIVES — do not reopen on it.** The grep matches the
interpolation, and the fix often sanitises on an EARLIER line: `editorManager.js:240` does
`title = stripCommentParens(title)` before interpolating at `:248`. Five sites were converted (two more than
this entry listed) to one exported `stripCommentParens`; `hmiPrompt`/`hmiInput` were deliberately left.

*(found t2274 while designing something else, which was then withdrawn. Latent, not burning. Filed rather than
fixed, because it is unrelated to the thread that surfaced it.)*

**STILL REAL IF:** search the JS for a backtick-paren-dollar-brace opening sequence under `wizards/`,
`blocks/` and `ui/` — **any hits mean STILL REAL.** Three at the time of writing:
`wizards/atcInterpreter.js:120`, `wizards/dialects/grbl.js:52` (`hmiToast`), `ui/editorManager.js`.

A G-code comment is delimited by `( … )`, so **text containing a `)` closes the comment early and everything
after it becomes G-code.** These three build a comment by interpolating a string straight between parens with
no stripping.

⭐ **`wizards/ops/comment.js` already solves this** for the comment block — it strips `(` and `)` from the text
before emitting, with its own comment saying why. **The three sites simply do not use that treatment.** So this
is not a design question; it is the same answer applied in one place and not three.

⚠ **These are APP-GENERATED strings, not the user's own words** — an HMI toast message, an ATC config header.
That distinction matters: for text the app itself produces, the app should simply be incapable of emitting a
malformed line. There is no user to warn and nothing to ask.

⚠ **Not yet a live bug** — it needs a `)` to reach one of those interpolations, and today's sources probably
never contain one. Which is exactly why it is worth filing rather than trusting: nothing enforces that, and the
failure mode is silent until a controller chokes on a line that was never meant to be G-code.

---

### 23. [✅ SHIPPED t2415 — drill's pattern is the pilot; author-declared toggles persist end-to-end, verified via the real gesture + a full export/reimport round trip] NESTED DISABLED STATE IS IN-SESSION ONLY FOR PARAMETRIC OPS

*(established at t2277 while making Disable Block real — reported as a scope boundary rather than hidden, and
NOT a regression: nested disable did nothing at all before that turn.)*

**STILL REAL IF:** disable a CHILD block inside a parametric op, export the `.nc`, reimport it, and look at
that child. **Comes back enabled = STILL REAL.**

Disabling a whole op round-trips correctly — that was verified byte-identically end to end. But a block
disabled *inside* a parametric op does not survive a reimport, because `opFromMarker` regenerates an op's
children from its params rather than restoring them individually. The child comes back as the generator makes
it: enabled.

⚠ **Why it matters, and why it is filed rather than shrugged at:** this is the same shape as the hazard that
motivated the whole turn — something the human deliberately turned OFF coming back ON without saying so. It is
narrower (a nested block, not an op) and the dangerous case is covered, but the failure mode is identical and
it is silent.

⛔ **Do NOT "fix" this by making `opFromMarker` restore children individually.** Regenerating children from
params is what makes a parametric op parametric; a marker that carried per-child state would be a second source
of truth for the same op and would drift from the params that are supposed to define it.

⇒ If it is worth solving, the disabled state of a child has to be part of the op's own PARAMS — expressible by
the generator, not stored beside it. That is a design question about what a parametric op's params include, not
a bug fix. **Worth a ruling before anyone builds it.**

#### ⭐ ADVISOR, 2026-08-26 — THE MECHANISM THIS ENTRY DESCRIBES ALREADY EXISTS AND IS SHIPPED

The entry's own prescription — *"the disabled state of a child has to be part of the op's own PARAMS"* — is
the exact definition of a **STRUCTURAL BINDING**, which shipped for corner and is live:

```
userOps.js:855   a STRUCTURAL binding (no blockIndex) drives GUARDS via the prune params, e.g. corner's probeZFirst
userOps.js:744   structural binding defaults are filled before the prune
whenGuard.js     pruneGuards collapses a template carrying BOTH arms to the chosen shape at build
userOps.js:740   bindings are re-derived against the PRUNED stack every build
```

⇒ **So this is not a new design — it is an application of a proven one.** A child that can be turned off
becomes a `guard` around that child, keyed to a plain boolean param. The param IS the source of truth, the
generator reads it, and nothing is stored beside the params. ⭐ That satisfies the entry's own ⛔ (no second
source of truth) rather than working around it.

⚠ **What is genuinely still open, and it is narrower than "a design question":**

1. **WHOSE param is it?** A structural binding is authored on the DEF. Disabling a block is an ad-hoc act on
   one INSTANCE. Turning every child into a declared toggle means the op's author decides in advance which
   children are switchable — which is a real product choice, and the part that still needs the owner.
2. ⚠ **It may not be representable for every op.** A parametric op's children are GENERATED from params, so
   "disable the third one" has no stable referent when the params change. ⭐ For drill it happens to be fine —
   `array{drill}` holds ONE child stamped at N points, so disabling it means "all of them", which a boolean
   expresses exactly. **Check the shape per op before promising it generally.**

⇒ **Recommended framing for the ruling:** not *"should nested disable persist?"* but *"should an op's author
be able to declare a child SWITCHABLE?"* — which is answerable, has a shipped mechanism, and stops short of
making every block in every op independently persistent.

#### ✅ RULED BY THE OWNER, 2026-08-26 — YES. Author-declared switchable children.

**The build, and it is an application of shipped machinery, not new design:**
- an op's author wraps a switchable child in a `guard`, keyed to a plain boolean param
- that param is a **STRUCTURAL binding** (no `blockIndex` — it drives the prune, not a socket), exactly as
  corner's `probeZFirst` does today
- it then round-trips through the marker like any other param, appears in the form, and the generator reads
  it ⇒ **one source of truth**, which is what the entry's own ⛔ demanded

⚠ **CHECK REPRESENTABILITY PER OP BEFORE PROMISING IT.** A parametric op's children are generated from
params, so a toggle needs a stable referent. ⭐ Drill is fine — `array{drill}` holds ONE child stamped at N
points, so the boolean means "all of them". ⛔ *"Disable the third hole"* has no stable referent and must not
be attempted.

#### ⚠⚠ WHAT THIS RULING DOES **NOT** CLOSE — and it is the original hazard

A child the author did **not** declare switchable still round-trips **silently back ON**. The entry's own
motivating danger — *"something the human deliberately turned OFF coming back ON without saying so"* —
survives for every undeclared child.

⇒ **So the honest companion to this ruling is to stop failing silently.** When a user disables a child that
has no declared toggle, the app should **say that the state will not persist** — refuse the gesture, or mark
it visibly as session-only. ⛔ **Silently accepting a disable it cannot keep is the worst of the three
options**, and it is what ships today.

⭐ That is a smaller, separable piece of work than the toggles themselves, and it is the one that removes the
hazard. **The toggles add a capability; the refusal removes the danger.** Do the refusal first if only one
gets built.

> ⭐⭐ **t2415 — SHIPPED. The toggles built, the refusal now yields to them, verified through a real
> export→reimport round trip, not just an in-memory assertion.**
>
> **THE PILOT — drill's own pattern, exactly the entry's own example.** `array{drill}` (a `holecycle` atom in
> today's shape) stamps the whole pattern in one child — "disable the third hole" has no stable referent
> (checked, per the ruling's own "verify representability per op" instruction), but "disable the pattern" does,
> since there is exactly ONE switchable child. `drillData.js` now wraps `holecycle` in a `guard` (the SAME
> `wizards/stacks/*.js` `GUARD` idiom every existing structural fork already uses — not a new mechanism),
> keyed to a new STRUCTURAL binding, `holesEnabled` (no `blockIndex`/`match` — drives the prune, not a value
> socket, mirroring corner's own `probeZFirst` row-for-row). Default `true` = today's exact shape (the guard
> unwraps transparently, splicing its child back in place).
>
> **GRANULARITY, decided with the code in front of me rather than guessed**: one boolean structural binding
> PER declared switchable child — the exact shape `probeZFirst` already ships, not a new encoding. A "single
> declared set" (a bitmask/array covering several children at once) would need its own new read/write
> machinery for no proven benefit; a plain per-child boolean reuses everything `guard`/`pruneGuards`/
> `withGuardDefaults` already do. It also generalises cleanly to #41 (freeze) without building it: #41's own
> entry already calls `frozen` "a declared property of the BINDING" — the exact same shape, just a different
> binding-level flag than a structural on/off.
>
> **HOW THE GESTURE ACTUALLY PERSISTS — traced, not assumed.** Right-clicking Disable Block (the SAME native
> Blockly gesture t2307's own `disableGuard.js` already listens for) is synced into the structural param by a
> NEW listener in `blocksApp.js`, on the SAME `element:'disabled'` event. ⚠ **A load-bearing correction found
> mid-build**: the guard is TRANSPARENT on a PLACED, live canvas — `pruneGuards` already unwrapped it at
> instantiate time (the default/kept case splices its child in place), so the disabled block's own LIVE PARENT
> is whatever atom the guard's children sat under (`placeonstock`, for drill), never the guard itself —
> confirmed live before assuming it (a first attempt walking the live canvas parent found nothing). The
> correct lookup is against the OP'S OWN REGISTRY DEF (`def.template`, where the guard still exists, matched
> by the disabled block's TYPE) — `findGuardWhenForBlockType`, now shared between `blocksApp.js` and
> `disableGuard.js` (`whenGuard.js`) so the two can never independently disagree about which children are
> declared switchable.
>
> **`disableGuard.js` (t2307) NOW YIELDS to a declared toggle** — its own refusal existed specifically because
> "this state was never going to persist," which is exactly false for a declared-switchable child now. One
> early-return, gated on the SAME shared lookup; every UNDECLARED child is refused exactly as t2307 shipped it
> (verified: the existing `disable-guard-2307.spec.js` suite is untouched and still green).
>
> **THE SYNC USES THE HEAVY REBUILD PATH (`mergeOpBlocks`/`replaceOp`), not a light patch — found live, not
> assumed.** A structural toggle changes the op's own SHAPE (a whole child appears/vanishes), which t2413's own
> lightweight `.data`-only patch (BACKLOG #55, scoped to VALUE sockets) can't reach — the live canvas would
> keep showing the un-pruned atom while the stored param disagreed. The same rebuild the pre-existing `sc_*`
> structural-control branch already uses. Practical effect, confirmed live: disabling `holecycle` REMOVES it
> from the canvas immediately (matching what a fresh reimport with `holesEnabled:false` would build), not
> "stays visible, greyed" — the params and the canvas never disagree, even mid-session.
>
> **A second, independent gap found and closed in the same pass, NOT #23-specific**: the checkbox this turn
> added to the form (`holesEnabled`, so the toggle is a real, visible field like `probeZFirst`) turned out not
> to write back at all — `onFieldWrite`'s own caller (`userOpView.js`) always passed a checkbox's `.value`
> (a static `'on'`, unrelated to checked state) instead of `.checked`, and `onFieldWrite` itself only ever
> accepted `Number(rawValue)` (t2413's own scope was a numeric drag handle). Both fixed: the delegated listener
> now reads `.checked` for a checkbox specifically (every other input kind unchanged), and `onFieldWrite`
> accepts a boolean and — this is the same structural-vs-value split above — routes a structural param through
> the rebuild path, a value param through t2413's own light patch, unchanged. Left broken, this would have been
> exactly the hazard the owner's own ruling names as the worst option: a control that LOOKS like it persists
> and silently doesn't.
>
> **VERIFIED, every claim live:**
> - Emit is BYTE-IDENTICAL to the legacy `drillStack` with `holesEnabled` at its default — the guard's own
>   kept/unwrapped shape matches the pre-guard baseline exactly (proven both at the node level and via the full
>   `drill-as-data`/`drill-bindings-identity-1385`/`drill-switch-shots-1385` suites, all green).
> - Disabling `holecycle` (the real gesture): `disableGuard.js` does NOT revert it; `holesEnabled` reads `false`
>   in `window.ddcsGetBlockProgram()`; the emitted G-code carries no drilling motion at all (framing only).
> - THE FULL ROUND TRIP, the entry's own acceptance bar: exported params (with `holesEnabled:false`) fed back
>   through `opFromMarker('user_drill_data', params)` regenerate the op STILL disabled — not merely "the param
>   survived in memory," the actual reconstruction path a reimport uses.
> - Re-enabling via the form checkbox restores both `holesEnabled:true` AND rebuilds `holecycle` back onto the
>   canvas.
> - Regression: an undeclared child (`wcs`) is still refused by `disableGuard.js`, byte-for-byte the pre-t2415
>   behaviour; the shell's own drill form/canvas specs, the whole `drill-*`/`lathe-part-drill` families (53
>   specs), and t2409's/t2411's/t2413's own permanent specs all stay green after this turn's edits to the same
>   shared files.
> - Committed as a permanent spec, `tests/drill-holes-enabled-persist-2415.spec.js` (5 tests).
>
> **A tail item ("mobile wizard buttons ~8-10% bigger") arrived as a mid-turn amendment.** Deferred, per the
> amendment's own stated fallback ("only if #23 lands with room; if not, hand back and say so") — #23 alone
> surfaced two independent architectural gaps (the transparent-guard lookup, the checkbox write-back) that
> needed tracing and fixing correctly rather than rushed, and the tail's own measurement requirements
> (real device floors, a collapse-ladder check at several widths) deserve the same care, not a hurried pass in
> the remainder of an already-large turn.
> ⭐ **✅ SHIPPED t2417.** Measured the real rendered `.wizard-btn` at 390px (32px — well under the 44-48px
> platform floor); owner's refined ruling was GO TO THE FLOOR, so `.dock-header .wizard-btn { min-height: 44px }`
> (a new `@media (max-width: 600px)` rule) rather than the originally-asked 8-10% comfort bump. Vertical axis
> only, horizontal padding measured byte-identical before/after; the priority-collapse ladder re-checked at
> 320px and confirmed unaffected. `tests/mobile-wizard-btn-touch-floor-2417.spec.js` (4 tests). Full details in
> t2417's own WORK-LOG entry.
>
> ⛔ **t2419 — WRONG ELEMENT, advisor's own error, corrected.** `.wizard-btn` is the TRIGGER PILL that opens a
> wizard group's dropdown tray — the owner's actual ask was for the ROWS INSIDE the tray
> (Drill/Bore/Pocket/Contour/…). Owner, unprompted: "so you changed the size of the trigger wizard in the bar
> but i didnt ask" / "i asked for the button in dropdown." REVERTED the trigger pill to its pre-t2417 32px
> (the owner explicitly did not ask for it, weighed against the same accessibility floor and chose revert
> anyway — reported plainly, not silently decided). Re-measured the ACTUAL target first: the tray's own item
> row (`.toolbar-dropdown-content button`) was 31.6px, essentially the same sub-floor number — the floor
> treatment genuinely was needed there too, not manufactured. Fixed: `.toolbar-dropdown-content button {
> min-height: 44px }`, same mobile media query, vertical axis only. Checked all 5 wizard groups (4-8 items
> each) at 390px — none overflow the tray's own pre-existing `max-height`/`overflow-y:auto` cap even at the
> largest. `tests/mobile-wizard-btn-touch-floor-2417.spec.js` rewritten in place (5 tests, non-vacuous both
> directions).

### 24. [✅ SHIPPED t2281 — `14fc7ffa`] ⛔⛔ A LOOSE, UNCONNECTED BLOCK ON THE BLOCKS CANVAS SILENTLY EMITS INTO THE REAL PROGRAM

*(found t2279, investigating the Blockly event survey's own "loose blocks" question — the dispatch's own
hypothesis was that a disconnected block is probably INVISIBLE to the program stack. The opposite is true,
and it is worse: it is fully visible, fully undoable, and fully EMITTED, with no visual distinction from a
block that is actually part of the program.)*

**STILL REAL IF:** drag any leaf atom (e.g. a plain Move block) from the Blocks-tab toolbox onto empty canvas
— NOT connecting it to anything — and check the projected G-code. **A new line for that atom appearing =
STILL REAL.**

**PRIORITY — this is a correctness/safety finding, independent of the whole undo-redesign arc it was found
inside.** `workspaceToStack()` (`blocks/blockly/stackBridge.js:203`) reads `ws.getTopBlocks(true)` — EVERY
block with no previous connection, whether or not it is part of the "real" program chain — and hands the
result straight to `emitMapped`. There is no connectivity filter anywhere between the workspace and the
emitted text. Confirmed empirically, not inferred (`scratchpad/t2279-loose-leaf-emit-check.mjs`): created a
`move` atom via the exact API path a real toolbox drag ends in (a genuine `Blockly.Events.BlockCreate` fired,
not a bypassed API call), left it fully unconnected, and the live projected G-code gained a new line —
`G1  F2000` — with the app's own `saveStates` history recording it as an ordinary "block edit", identical to
any real edit. Nothing on screen distinguishes "this block is part of your program" from "this block is
sitting nearby and will also run."

⚠ **Why this is worse than the dispatch expected:** an invisible-to-the-stack loose block would just be an
annoyance (you'd lose track of it, but it couldn't hurt anything). A block that IS in the stack and DOES emit
means exploring the palette, or a slightly-missed connection drop — an easy, ordinary mis-drag in any
block-based editor — silently changes what the machine will actually do, with no warning, no visual marker,
and (unverified this turn, worth checking before this is fixed) no guaranteed position in program order
(`getTopBlocks`'s own ordering, not necessarily creation order or canvas position).

⚠ **Interacts directly with t2277's own disabled-block work, and NOT as a fix — as a possible partial
mitigation someone could reach for and should think through first:** a loose block could in principle be
auto-treated as "disabled" (commented out) rather than live-emitted, using the exact suppression mechanism
just built. ⛔ But that changes WHAT A LOOSE BLOCK MEANS from "an accident nobody asked for" to "a legitimate
authored state" — worth a ruling, not a reflexive reach for the nearest available lever. The more honest fix
is probably a VISIBLE affordance (a warning badge on any block Blockly's own `getTopBlocks` returns that isn't
reachable from `progstart`, or refusing to emit an unconnected block at all with a loud on-screen notice) —
not silently reclassifying it as disabled, which would suppress it correctly but teach nothing.

⚠ **Scope not yet established:** does the SAME thing happen for a loose OP CONTAINER (e.g. a bare `drill_op`
dragged and left unconfigured)? Tested and found: NO immediate emitted lines, but only because a freshly
dragged op container has empty `children` until a wizard actually builds it (`opRanges`/`emit()`'s 'op'
branch is transparent — it emits only its children). A PARTIALLY built or forked op container sitting loose
could still emit real content; this turn only confirmed the leaf-atom case definitively.

---

### 25. [✅ SHIPPED t2365, 2026-08-28, commit `24135e9b` — ⚠ this doc entry was never updated to say so; re-verified
still live t2451, 2026-08-31] THE DIRTY DOT CANNOT TELL "NEVER SAVED" FROM "CHANGED SINCE SAVING"

*(surfaced 2026-08-25 by BACKLOG 17, which was NOT a bug — the dot was correct throughout. This is what the
episode actually exposed.)*

⚠ **t2451 dispatched this as still-open, "buildable-as-ruled."** It was not — this doc entry simply never got
its SHIPPED header after t2365 built it. Re-verified live at t2451: `ui/fileSaveState.js`'s `refresh()` +
`styles.css`'s `.hdr-ws-dirty-dot.is-never-saved` (hollow ring) both match the ruling below exactly, agree with
`ui/workspaceManager.js`'s own three-state panel class, pass `workspace-dirty-dot-2188.spec.js` +
`persistence-file-indicator.spec.js` (9/9), and read as a clean, legible hollow ring across three themes
(studio/organic/steampunk, screenshot-checked at 8x scale). No code changed for this entry this turn — see
WORK-LOG t2451 for the full re-verification and the doc fix.

**STILL REAL IF:** open a workspace never saved to a file, and one saved-then-edited. **If the header dot looks
identical in both, STILL REAL.**

Two very different facts render the same:

```
NEVER SAVED         your work exists only in this browser. no file exists at all.
SAVED, THEN CHANGED a file exists and is out of date.
```

The first is *"you have no backup"*; the second is *"your backup is stale"*. One is far more urgent than the
other, and the dot says the same thing for both.

⭐ **The app already knows the difference** — `workspaceManager.js:484-486` computes it and its state line says
either **"Never saved to a file"** or **"Unsaved changes"**. The information exists; the header just does not
carry it.

⚠ **Evidence it matters, and it is not hypothetical:** the human read the permanent dot as a defect and
reported it; the advisor then spent SIX measurements hunting a mechanism that did not exist. Both misread the
same indicator the same way. An indicator that its own author and its own user both misinterpret is
communicating badly, whatever its logic says.

⛔ **Do not "fix" this by hiding the dot when unsaved** — that would be worse: it would say "no problem" to the
person with no backup at all.

#### ⭐ ADVISOR, 2026-08-26 — IT IS ONE LINE, AND BOTH FACTS ARE ALREADY IN SCOPE THERE

`workspaceManager.js:498`:

```js
class="wsm-state ${dirty || !everSaved ? 'is-dirty' : 'is-saved'}"
                   ^^^^^^^^^^^^^^^^^^^  two different facts OR'd into ONE visual state
```

⇒ **`dirty` and `everSaved` are separate variables on the same line.** The information is not merely
"available elsewhere" — it is already in hand at the point of render. This is a three-state class where a
two-state one is written, not a redesign.

**PROPOSED TREATMENT** — the two problem states differ in KIND, not degree, so they should differ in SHAPE and
not only in colour:

```
  ●   SAVED             a file exists and matches
  ●   STALE             a file exists and is out of date      → "your backup is old"
  ○   NO FILE AT ALL    this exists only in this browser      → "you have NO backup"
      ↑ HOLLOW. a colour ramp reads as "worse"; a different shape reads as "different problem".
```

⭐ **Why no-file is the more urgent of the two**, and it is a standing principle here, not a judgement call:
`localStorage` is TEMPORARY and is never "Saved" — the user-owned FILE is the only persistence. A workspace
with no file is one cleared cache from gone; a stale file is merely behind.

⚠ **The tooltip/state line already says the right words** ("Never saved to a file" vs "Unsaved changes") —
`:484-486` computes both. **Only the header glyph collapses them.** ⇒ Whatever is chosen, the glyph and the
state line must agree; today they disagree, which is why both the owner AND the advisor misread the same dot.

✅ **RULED BY THE OWNER, 2026-08-26: *"i like your distinction."*** ⇒ **The SHAPE distinction is approved** —
filled dot for a stale file, HOLLOW ring for no file at all. **Ready to build; no further ruling needed.**

⚠ **Build notes, so the point is not lost in implementation:**
- ⛔ **The hollow ring is not "less severe" — it is the MORE urgent state.** Do not let a colour ramp
  (green → amber → red) carry the meaning on its own; the shape is what says *different kind of problem*.
  A viewer who cannot distinguish the colours must still see two different marks.
- **Make the glyph agree with the state line**, which already says the right words at `:484-486`. They
  disagree today, and that disagreement is the whole defect.
- ⛔ Do not hide the dot in the never-saved case, per the entry's own warning above.

⇒ Cheapest honest fix is probably the TOOLTIP, which can differ without touching the visual language. A second
dot state is a bigger design question and would need a ruling.

### 26. [✅ SHIPPED t2289 — `21aae360`] A BLOCK'S OWN COMMENT (`setCommentText` / "Add Comment") IS SILENTLY DISCARDED ON ANY ROUND-TRIP

*(found t2279, the Blockly event survey; filed t2281 per the dispatch's own instruction. NOT the same feature
as t2277's `disabled` — this is `change/comment`, a genuinely separate gap the survey turned up alongside it.)*

**STILL REAL IF:** right-click any block → "Add Comment" → type a note → do ANYTHING that reprojects the
workspace from the model (edit a param elsewhere, undo, save+reload) → the comment is gone. **Comment text
missing after any of those = STILL REAL.**

**Confirmed reachable, confirmed not covered.** "Add Comment" is a standard entry on every block's own
right-click context menu (this app never removes it) and `setCommentText`/`getCommentText` both work
correctly on the live canvas — but `workspaceToStack()`'s record shape (`blocks/blockly/stackBridge.js`) has
no `comment` field anywhere, in either `toRecord()` (op branch or the generic atom branch). The text simply
never makes it into the model at all, so `recToJson()` has nothing to write back on reload — a real block
comment is USER CONTENT lost with no warning, not merely un-undo-able.

⚠ **Distinct from the six `WorkspaceComment` events (`comment_create`/`delete`/`change`/`move`/`resize`/
`collapse`)** — those are a DIFFERENT Blockly feature (free-floating sticky notes on the canvas, unattached
to any block) and are genuinely NOT REACHABLE in this app: no UI path creates one, and `Blockly.WorkspaceComment`
isn't even defined on this build's namespace. This entry is about the block-attached comment bubble only.

⇒ **The fix shape, if picked up:** add `comment` to `KNOWN_LEAF_RECORD_FIELDS` (native Blockly property, same
family as `collapsed`/`disabled`, not a `.data` field), read it in `toRecord()` via `b.getCommentText()`,
write it back in `recToJson()` via `node.icons = { comment: { text, pinned, height, width } }` (Blockly 11's
own serialization shape for a block comment — VERIFY the exact shape empirically before writing to it, the
same discipline t2277 and t2281 both used for `disabledReasons`; do not assume from the API name alone).
⚠ Whether this should ALSO ride the `( @DDCS:1 {…} )` marker (so a comment survives a `.nc` export/reimport,
not just an in-app reload) is a separate question from whether it survives the Blockly canvas round-trip —
answer the cheaper one first and report whether the marker question is worth its own turn.

### 27. [⛔ OWNER-REFUTED 2026-08-26 — DO NOT WORK THIS AS WRITTEN] THE WORK↔MACHINE FRAME EQUATION USES 1 OF 5 TERMS — the WCS-zero write is silently wrong under a tool offset

*(carried forward from `VENDOR-PACK-FIXES-PLAN.md` (t2117-t2121, Stage D/T9) — the plan's own file is deleted,
t2295 doc cleaning, its Stages A-C shipped; this ONE item was explicitly gated behind a human go and never
built. Preserved here rather than lost with the plan.)*

⛔⛔ **THE OWNER REFUTED THIS ENTRY, 2026-08-26: *"27 is bullcrap, my 68mm offset is set
intentionally."*** And they are right on the substance:

⭐ **A non-zero tool-length offset is not an anomaly — it is the whole point of a tool-length offset.**
This entry, and the advisor's handling of it, repeatedly treated the EXISTENCE of a −68.336 offset as
if it were a lurking fault. It is a deliberately probe-set tool length on a machine that has been
**running real parts and two-sided jobs for months**. ⇒ If Studio's WCS write mishandled it, the very
first part would have been scrap or a crash. **It did not happen.**

⚠ **What is left is much smaller than the entry claims** and must not be worked from its current
wording: a question about whether the emitted form is exact under configurations we do not have
(non-zero `G52`, a populated `H` table). ⛔ **Nobody rewrites a live-WCS write on that basis.**

⭐ **The lesson, since it recurred all day:** "unverified" is not "unknown" on a machine in
production. **Months of good parts are evidence**, and they outrank a formula read out of a document.
The advisor escalated this to the owner twice — first as a go/no-go, then with the offset's size
dressed up as "45% of Z travel" — before the owner pointed out the offset was simply intentional.

*(Original text kept below, unedited, so the reasoning error stays visible.)*

**Evidence** (`Docs/最完整的M350坐标换算公式/Coordinate system offsets DDCSE.txt`, verbatim): `#852 = #882 -
#807 - #1430 - #837 - #900` (mach − G54 − T-offset − G52 − H-length). Studio uses only 1 of the 5 terms —
`viz/sceneFrame.js:66` `wcsOffsetAt()` returns only `{x,y,z}` from the WCS row; `engine/envelopeCheck.js:113`
is literally `const mach = (workPt[ax]||0) + (wo[ax]||0)`. Absent everywhere: G52 (`#835-#839`), the per-tool
T offset (`#1390`/`#1410`/`#1430` + `[#1300-1]`), and the H tool-length table (`#900-#915`).

**Propagates into emit twice:** `wizards/dialects/ddcs-expert-m350.js:119-134` `wcsZeroAtCurrent` emits what
reduces to `#807=#882` — the vendor names this EXACT form as wrong ("the command #807=#882 will set not '0'
for the Z axis in G54, but '25'" — worked with a T1 Z offset of −25). `wizards/ops/wcsIndirect.js:36-42`
`wcswrite` (shared by `cornerWizard.js`/`edgeWizard.js`/`middleWizard.js`) builds `[#1927-#6]` with no
tool-offset term either.

**Documented correct form** (still incomplete — omits G52/H, exact only when both are zero, per two
independent sources confirming G52 is silently operator-writable via the 加深/抬高 buttons):
```
Z:   #[807+[#578-1]*5] = #882 - #[1430+[#1300-1]]
```

⛔ **THE GATE, unchanged:** this changes what gets written to a live WCS on machines using fixed-probe tool
setting or ATC auto-measure (`#1305=1`) — the power-user population. Highest-value fix in the original sweep
AND the worst failure mode if wrong. Requires an explicit human go, a bench check with a known non-zero tool
offset, and its own turn — do not fold into an unrelated dispatch.

---

### ⭐⭐ 2026-08-26 — THE FIRST STEP IS **REPRODUCE OR REFUTE**, NOT BUILD. The symptom is missing.

Raised with the owner as a go/no-go. **They refused the premise, correctly**, and the argument is decisive
enough to change what this entry asks for:

> *"it would be weird it isn't like that no?"*

⭐ **A 68 mm Z error CANNOT HIDE.** Fairy measured the live tool offset on the owner's own Expert at
`setting[930] = −68.336`, applied unconditionally. If a Studio probe wizard wrote G54 Z off by that much,
the next cut would plunge into the table or cut air 68 mm high — found in minutes, not months. **The absence
of that symptom is EVIDENCE**, not merely absence of testing. This code has shipped for months.

⇒ **So the possibilities reorder, and "confirmed defect awaiting approval" is the wrong framing:**

```
①  the owner zeroes at the PENDANT → Studio's write path never runs on their machine
②  ⭐ the probe flow is SELF-CONSISTENT — if the probed position already carries the offset,
    writing #882 raw is correct FOR THIS PATH, even though the vendor's warning about a bare
    "#807=#882" command stands. Two errors that cancel.
③  the formula analysis is right and the BLAST RADIUS is wrong
```

② is the most likely: the vendor's warning is about setting a WCS from the current position *generally*; a
**probe-derived** zero may measure through the same offset, so the terms cancel.

⛔ **THEREFORE the next action on this entry is NOT the fix.** It is a read-only reproduction: take one probe
wizard's emitted WCS write, with a known non-zero tool offset, and check whether the resulting zero is off by
that offset. **Off ⇒ real, proceed to the gate above. Equal ⇒ this entry is wrong and gets corrected, not
built.** No motion, no human decision, no live-WCS write required to answer it.

### ⭐⭐ 2026-08-26, ADVISOR, BY READING — THE Z CASE WAS NEVER DUMP-GROUNDED

`ddcs-expert-m350.js`'s `wcsZeroAtCurrent` justifies itself in its own comment:

> *"Dump-grounded: `SAVE_WCS_XY_AUTO.nc` / `COPY_WCS.nc` use the INTERMEDIATE-VAR indirect form."*

**Both files were read in full. OBSERVED:**

```
SAVE_WCS_XY_AUTO.nc   reads #880/#881 only; computes address 805+ and 806+ only;
                      writes X and Y.                      ⛔ NEVER TOUCHES Z.
COPY_WCS.nc           copies offsets +0, +1, +3  (X, Y, A) ⛔ SKIPS +2, WHICH IS Z.
```

⇒ ⭐ **The cited evidence covers X, Y and A, and systematically excludes Z.** Studio extends the same
register-write pattern to Z (`#[#151+2]=#882`), and Z is the one axis carrying a tool-offset term. **The
"dump-grounded" claim is true for the axes it names and does not reach the axis in question.**

⚠ **Second observation, and it weakens the grounding further:** both files sit under **`CNCDISK`**, which
`context/../COMMENT-CHARACTERS.md` classifies explicitly as **OURS, not the vendor's** — *"sitting on the disk
proves they were transferred, not that the controller accepted them."* `SAVE_WCS_XY_AUTO.nc`'s own header
(*"Based on working park position macro pattern with variable priming"*) is hand-authored in our style. ⇒ the
justification cites **our own output as ground truth**.

⛔ **This does NOT resolve the entry — it sharpens it.** Two things are now both true and in tension:

```
the Z write is UNATTESTED, exactly where the vendor's formula says a term is missing
AND a 68 mm error would be UNMISSABLE, and nobody has seen one
```

⇒ **INFERRED, not observed:** the most likely reconciliation is still self-consistency — the probed
position already carries the offset. **The reproduction below remains the next action**, and it now has a
sharper question: *does anything in the shipped product write WCS **Z** from `#88x` at all, or only X/Y?* If
Studio's real probe flows are also XY-only in practice, the defect is latent rather than live.

⚠ **Why this correction is here at all:** the entry was escalated to the owner as a decision without anyone
checking whether the symptom exists — the same error as promoting the other seat's stale-`setting`-file claim
to a product direction hours earlier the same day. **A confidently-worded backlog entry is a CLAIM, and the
question "which moment did that number come from?" applies to it exactly as it does to a measurement.**

### 28. [✅ RULED 2026-08-28 — OWNER: LEAVE AS-IS ("enough"). No guard, no disclosure flow, nothing to build] `T.nc` OVERWRITES THE ATC DISPATCHER

> **THE RULING, and its reasoning — reached across a full owner walkthrough 2026-08-28:** the Macro tab
> already shows `T.nc`'s current content plainly to anyone who looks; a user generating an ATC macro can be
> expected to know their own tool-change file. Consistent with the house line: the machine is the user's —
> Studio doesn't babysit its configuration. Options A (detect+refuse), the amended A (detect+confirm), and
> "join the existing viewer into the generate flow" were each walked through and DECLINED in favour of D.
> ⚠ If a real magazine owner ever reports a clobbered dispatcher, reopen HERE — the analysis below and the
> 2026-08-28 evidence block stay valid, and "join it" (reuse the Macro-tab viewer at overwrite time) was the
> agreed next-cheapest shape.

*(carried forward from `VENDOR-PACK-FIXES-PLAN.md`, HELD item H1 — the plan's own file is deleted, t2295.)*

#### ⭐ ADVISOR, 2026-08-26 — measured against the vendor payloads. The two are for DIFFERENT MACHINES.

**OBSERVED, from the vendor's own install payloads (V1 and V2 model trees) and the owner's captured SYSDISK:**

```
vendor T.nc  =  T#1504          ← ONE LINE. the whole file. dispatches into the firmware's O20000
owner's machine, 2026-06-10 capture: T#1504    ✅ still the vendor one-liner — NOT overwritten
```

⭐⭐ **The key finding: these two are not competing implementations of the same thing.**

| | what it drives |
|---|---|
| **`O20000`** (firmware) | a real vendor **MAGAZINE**: `#1302` dispatch, dust cover, magazine open/close, per-tool Z, auto tool-setting, position restore |
| **`generateToolChangeNc`** | a **straight/linear changer**: move to the pocket's park XYZ, run the drawbar dance (`M154`/`M155`), dwell |

⇒ **Studio's generator targets a machine that has no `O20000` magazine at all.** Its own header says so:
*"This emits a STRAIGHT / linear changer"* and *"NOT validated on a live ATC."* **The defect is not that it is
wrong — it is that nothing distinguishes the two machine types, so it is written to both.**

⚠ **Blast radius, precisely:** a user with the vendor magazine gets their firmware state machine replaced by
a generator built for a different changer. ⭐ **NOT the owner** — their workflow is *NO ATC, manual change,
single slot T1* (`ROADMAP.md`), and their `T.nc` is still the vendor one-liner. This is a defect for the
magazine-owning part of the user base.

#### ⭐⭐ NEW EVIDENCE, 2026-08-28 — FROM OUTSIDE, UNSOLICITED. Read before ruling.

A community post (M350 **V2**, two-head machine: one ATC with 10 tools, one pneumatic spindle on T11) shows the
owner **hand-editing `slib-g.nc` at line 1007** to fire his dust collector for the second head. His screenshot
matches our own factory copy structurally line-for-line (`assets/community/modbus-slave-2025-12-11/USB-READY/
install/slib-g.nc:935-951`, including the stock `IF #1993==1 GOTO4;` / `M150`) — so he is editing the FACTORY
file, in place, with English-translated comments.

⭐ **The vendor DOES ship a user-extension seam — and it does not reach this case.** `slibuser.nc` ships nearly
empty with a single example (`O9199(G199)` → one G01), clearly meaning *"define your own G-codes here."* But it
is for **new standalone macros**. Breno's change must land **inside the existing tool-change flow**, between
`#1300 = #1` and `M150`. There is no hook for that.

```
vendor ships     T.nc / slib-g.nc     written for the vendor's assumed topology
vendor offers    slibuser.nc          NEW macros only — no hook into the ATC flow
therefore        a non-standard ATC   MUST edit the factory files directly
                 or a second head
```

⇒ ⛔ **Hand-editing the ATC macros is not a hack these users chose. It is the ONLY available path**, because
the vendor's own extension seam does not reach into the tool-change sequence. **So overwriting `T.nc` would not
clobber a file someone happened to edit — it would clobber the only place that customization can live.**

⚠ Also worth noting for scope: on DDCS even `M3.nc`/`M8.nc`/`M9.nc` are files on the controller disk (`M8.nc`
is literally one line, `M8`). **The dialect is data on a disk, not behaviour in a binary** — which is what makes
any generated overwrite higher-stakes here than on a conventional post.

#### THE OPTIONS

```
A  DETECT AND REFUSE   if the existing T.nc is the vendor dispatcher (`T#1504`), do not overwrite.
                       ⭐ the signal is ONE LINE and unambiguous — the firmware ATC is in charge.
B  WRITE ELSEWHERE     cooperate: put the generated body into slib-g.nc / O20000 instead of T.nc.
C  WARN LOUDLY         overwrite, but name what is being replaced and require a confirmation.
D  LEAVE AS-IS         accept it; the generator is for changers that have no O20000.
```

⭐ **Advisor recommendation: A**, and it is nearly free. The detection is a one-line file comparison against
a known constant, and refusing is the safe direction — a user whose magazine works keeps working, and a user
with a straight changer is unaffected because their `T.nc` is not the vendor dispatcher.

⛔ **B is the tempting one and I would not start there:** writing into the firmware's own macro means owning
the vendor's state machine across firmware revisions, and `FINDINGS.md` already shows those revisions move.
⚠ **C alone is not enough** — a warning at generation time is read once; the file it damaged stays damaged.

⚠ **Still needs the owner**, because A changes what an existing button does for magazine users, and none of
this is validated on a live ATC — by the generator's own admission.

---

`atcGenerator.generateToolChangeNc` (`controllerFiles.js:33`) replaces the one-line dispatcher `T#1504`,
bypassing `O20000`'s whole magazine state machine (`#1302` dispatch, dust cover, magazine open/close, per-tool
Z, auto tool-setting, position restore). Blast radius is a real tool change on a real magazine — the right
fix (write into `slib-g.nc`/`O20000` vs warn loudly) is a design decision the plan explicitly deferred to a
human ruling, never built.

### 29. [⭐ ANALYSED — no owner ruling needed, see 2026-08-26 (b)] CAM `baseSlot: 22` AND THE `POOL_MIN = 1100` COLLISION [⭐ (2) NOW PROVEN, (1) BOUNDED — 2026-08-26]

*(carried forward from `VENDOR-PACK-FIXES-PLAN.md`, HELD item H2 — the plan's own file is deleted, t2295.)*

Two open questions, both explicitly weakened-not-proven in the original verification: (1) the vendor PDF's CAM
tables run CAM1→cam10/m30 … CAM10→cam19/m39, but the PDF never states 10 is the maximum, the vendor's own CAM
picker screenshot has a scrollbar sized for ~22+ entries, and community packs run CAM10-CAM21 — slot 22 is
undocumented, not proven impossible. (2) `slotPack.nextParam()` starts at `POOL_MIN = 1100`, and the live
SYSDISK eng already ships `#1100`-`#1102 -m30` / `#1103`-`#1105 -m31` as placeholders, so a new user's first
slot collides — `mergeEng` DOES report `paramCollisions` against the real file at merge time (not silent), but
`usedParams()` only walks the pack's own slots, never the controller's eng. Fixing properly means feeding the
controller's eng into the allocator (an API change). Confirmed correct as-built, do NOT touch:
`POOL_MIN=1100, POOL_MAX=1499, MIRROR=1500`, `slotGroup = slot+20`, the icon format (360×180, 24bpp, BI_RGB,
54-byte header, bottom-up, no palette, xppm/yppm 3780).

---

#### ⭐ ADVISOR, 2026-08-26 — both halves measured against the repo's own captures. OBSERVED, not inferred.

**(2) THE COLLISION IS REAL. Promoted from "weakened-not-proven" to PROVEN.**

Read straight out of the captured live controller eng
(`assets/capture/20260731T181343Z/SYSDISK/eng`):

```
#1100 #1101 #1102   -m30   "Parameter name 1/2/3"     ← shipped placeholders
#1103 #1104 #1105   -m31   "Parameter name 1/2/3"
```

⇒ `slotPack.nextParam()` starts at **`POOL_MIN = 1100`**, which is **exactly** the first shipped
placeholder. **A new user's first allocated slot collides on its first parameter, every time — not a corner
case.** `mergeEng` does report it (`paramCollisions`) rather than failing silently, so the symptom is a
merge-time complaint, not corruption.

⭐ **The window is small and exact: six params, `#1100`-`#1105`, two groups.** m30/m31 are the ONLY `-m`
groups the shipped eng populates — **`-m31` is the highest `-m` tag in the entire file.** ⚠ A cheap
mitigation exists (start the pool past them) but it treats the symptom; the entry's own diagnosis stands —
`usedParams()` walks only the pack's own slots and never the controller's eng, and that is the actual defect.

**(1) SLOT 22 IS NOT REFUTED — but it is now BOUNDED, which the entry could not say before.**

```
attested in real community packs:   macro_cam … 17, 18, 19, 20, 21     ← 21 is the HIGHEST observed
baseSlot: 22                        → the FIRST unattested slot, by exactly one
```

⇒ The claim "undocumented, not proven impossible" is correct and can be sharpened: **22 is not vaguely
beyond the documentation — it is precisely one past the highest number anyone has been observed to use.**

⚠ **The live eng cannot settle the maximum**, and this is worth stating so nobody re-runs the check: it
ships only the first two groups (m30/m31), so its silence above m31 is **absence of placeholders, not
evidence of a ceiling.**

#### ✅ ADVISOR, 2026-08-26 (b) — NO OWNER RULING NEEDED. Both halves are smaller than the entry reads.

**(2) THE COLLISION IS SAFE, JUST UNHELPFUL. Traced end to end:**

```
slotPack.js:201   a colliding param goes to paramCollisions, NOT to `added`   ⇒ nothing is overwritten
macrosApp.js:2003 the user is shown, in RED: "#param collisions (already defined in the eng): #1100, …"
```

⇒ **Not corruption — a bad first-run experience.** A new user's first slot lands on the vendor's shipped
`#1100-#1105` placeholders, gets a red message naming numbers that mean nothing to them, and has to work out
that the pool simply starts in an occupied place. ⭐ **The defect is the STARTING POINT, not the merge.**

⚠ The entry's own diagnosis stands and is still the right fix — `usedParams()` walks only the pack's own
slots and never the controller's eng. ⛔ But this is a **usability** item, not a safety one, and it should be
sized as such.

**(1) `baseSlot: 22` IS A FALLBACK DEFAULT, not an assertion about the hardware.**

`macrosApp.js:1914`: `const base = (_camPack.meta && _camPack.meta.baseSlot) || 22;` ⇒ 22 applies only when a
pack declares no `baseSlot` of its own. ⭐ Combined with the measured bound — community packs attest
`macro_cam` up to **21** — the default sits exactly one past the highest number anyone has been observed to
use, which is a reasonable place for a *next free slot* default and a poor place for an *assumed valid* one.

⇒ **Neither half needs a decision from the owner.** What both need is a turn: start the pool past the
shipped placeholders (or feed the controller's eng into the allocator, which is the real fix), and let the
`baseSlot` default stay a default. ⚠ Still do NOT touch the confirmed-correct constants listed above.

---

### 30. [✅ SHIPPED t2303, 2026-08-27, commit `135c83b5` — ⚠ this doc entry was never updated to say so, causing a
wasted t2455 dispatch; re-verified far MORE thoroughly than the original ship, still zero divergences, 2026-08-31]
THE WIZARDS-AS-DATA EQUIVALENCE PROOFS ARE EXPERT-ONLY — V4.1 and V3/DM500 are never compared

⚠ **t2455 dispatched this as "turn 1" of a new arc**, unaware t2303 already shipped it — this doc entry simply
never got its SHIPPED header. All 5 `*-as-data` specs (drill/bore/slot/text/atc-warmup) already carry
cross-dialect coverage across all 7 registered dialects (t2303's own WORK-LOG: "clean everywhere, no divergence
found, one file [slot] already covered"). Re-verified at t2455, going well beyond a re-run:
- The 5 existing cross-dialect tests still pass, unchanged, 4 days later (10/10 green).
- **Skeptically verified the mechanism itself isn't a silent no-op** (the dispatch's own explicit ask): emitted
  the SAME stack under all 7 dialects directly — 6 of 7 produced genuinely DIFFERENT text (dwell syntax, M-code
  casing, comment gating), proving `{profileId}` really threads through `emitMapped` rather than silently
  falling back to one dialect for every comparison.
- **Directly confirmed the DM500 `ifgoto` ground truth** this entry itself cites (vendor: space before GOTO, no
  space around the operator) against a LIVE emit, not just the source: `IF #4LT#3 GOTO5`, exact match.
- **Went past t2303's own representative-slice checks to the FULL sweep × all 7 dialects** for every op (441
  total combos: drill 140, bore 70, slot 35, text 140, atc-warmup 56) — zero divergences found anywhere.

No divergences found, at any depth checked. See WORK-LOG t2455 for the full account.

*(raised by the owner 2026-08-26, twice; measured by the advisor the same day)*

**OBSERVED:**

```
test files exercising v41/dm500 anywhere        67
of the 24 twin / as-data / parity specs          4   (preview-dialect-parity, homing-refusal-reaches-twin,
                                                      comm-twin, io-step-twin)
⛔ every *-as-data spec                          0   drill · bore · slot · text · atc-warmup
```

⇒ **The arc's central claim — "the data twin reproduces the wizard" — is proven on the dialect with the
FEWEST users.** `v41-and-v3-outnumber-expert`: a V4.1/V3-only defect is an escalation.

⛔ **NOT in scope, and do not widen it into this:**
- **The FORM reproduction** (t2299 drill, t2301 pocket) is dialect-independent by construction. The form is a
  view of the **op model**; the dialect is applied downstream at emit. Nothing to cover there.
- **Unrolling.** The DDCS family (Expert, V4.1, V3/DM500) is **parametric-only** as of a few weeks before
  2026-08-26, per the owner. grbl is the only unroll target and was never part of the reproducibility claim.

⭐ **Why it is a real gap and not just missing checkboxes.** If the twins only had to produce the same STACK,
dialect would be irrelevant — same stack in, same dialect fold downstream, identical text for every dialect.
But `drill-as-data.spec.js:149` compares **emitted TEXT byte-for-byte on one dialect**, and the data path now
has hooks that CAN branch per dialect: `postInstantiate` (how t2293 solved clearance's fan-out) and
cap-gating, which reads dialect capabilities. **A V4.1-only divergence between builder and twin would pass
every test we have.**

**THE FIX IS CHEAP — no new machinery:** add the V4.1 and DM500 dialects to the sweep that already exists in
each `*-as-data` spec. Same harness, one more comparison per dialect.

⭐⭐ **DM500 IS ATTESTED — corrected 2026-08-26. We HAVE the vendor firmware** (`bridge/controllers/dm500/`),
and the advisor wrote "declared, not attested" without looking at it. Extracted from the vendor's own macros:

```
symbolic   IF #11>0 GOTO6     IF #12<=#493 GOTO1    IF #9==#5 GOTO8    IF #4<#3 GOTO5
word       IF #2004LT0 GOTO1  IF #450LT0 GOTO1                         IF #4LT#3 GOTO5
                                                                       ↑ the SAME comparison, BOTH ways
```

⇒ **Studio's declared DM500 form is correct** — `ifGoto` emits `IF <lhs><WORDOP><rhs> GOTO<label>`, which is
exactly `IF #4LT#3 GOTO5`. ⭐ And the vendor uses **symbolic and word operators interchangeably in its own
files**, so the controller plainly accepts both. ⚠ Note the shape precisely: a **space before `GOTO`**, and
**no space** around the operator — the opposite of the Expert, which takes no space before `GOTO`.

⭐ **This makes the fix STRONGER, not unnecessary:** there is real ground truth to compare a twin's emit
against, so adding DM500 to the sweep is checkable rather than speculative.

⛔ **NO HARDWARE IS NEEDED FOR THIS ITEM. Do not park it waiting for a DM500.** Owner, 2026-08-26:
*"we can build and test the app for the dm500 still, we will test another time."*

⇒ The fix compares **builder emit vs twin emit in the DM500 dialect** — both sides run in the app, and the
vendor firmware in `bridge/controllers/dm500/` is the ground truth for the syntax. **Pure software, runnable
today.**

⚠ What genuinely needs hardware is a separate, later question: whether the controller BEHAVES as its syntax
suggests. Syntax: evidenced. Runtime: not — and `COMMENT-CHARACTERS.md` rates the DM500's comment evidence
`[HYPOTHESIS]` on 47 comments. ⛔ **Neither blocks the sweep.**

**STILL REAL IF:** `grep -l "ddcs-v41\|dm500" DDCS-Studio/tests/*as-data*.spec.js | wc -l`
→ **0 means STILL REAL.** *(This check greps for what the FIX looks like, not what the bug looks like — see
AGENTS.md rule 8.)*

---

### 31. THE `|` SEPARATOR IN COMMENT TITLES IS UNVETTED — zero vendor occurrences

*(found at t2305 while fixing the nested-paren defect; adjacent to that turn's scope, deliberately not touched)*

⚠ **CITATIONS REFRESHED 2026-08-28**: this entry originally pointed at `wizards/ops/probe_titles.js` /
`corner_title.js` — both **deleted at t2367 as provably orphaned dead code**. ⛔ The finding is NOT closed by
that deletion: the pipe was never emitted from those files. The LIVE sources are the hand-pushed comment
titles in `wizards/stacks/*.js` — e.g. `cornerWizard.js:248` `` `Corner | ${c} OUTSIDE | …` `` and `:72-73`'s
settings lines — the probe/ATC/rotary/homing families throughout.

⚠ **`|` appears ZERO times inside a comment across the vendor corpora** measured in
[`bridge/controllers/COMMENT-CHARACTERS.md`](bridge/controllers/COMMENT-CHARACTERS.md) — 2,248 vendor comments
across three DDCS controllers, plus 4,656 LinuxCNC ones. ⇒ It is not *known bad*; it is **unattested**, which
is a weaker thing than the vetted list (`-` `.` `:` `=` `!` `,`) and a stronger thing than a guess.

⛔ **Do NOT mass-replace it on that basis alone.** Absence from a corpus is not evidence of rejection, and
these titles have been shipping. The measured, *governing* constraint is **nesting**, and that is now fixed
and guarded (`comment-nesting-guard-2305.spec.js`).

**What would actually settle it**, cheaply and with no hardware:
- ⭐ the **bench V4.1 at `10.0.0.50`** is motorless and reachable from the dev seat — a comment containing `|`
  either parses or it does not
- or ask the vendor (Q.G. Zhang, Messenger) alongside the next question, since that channel is open and answers

⇒ **Low priority.** Filed so the finding is not lost, not because it is urgent.

**STILL REAL IF:** `grep -n "Corner | " DDCS-Studio/web/wizards/stacks/cornerWizard.js` → any hit means the
pipe is still in the emitted titles. *(The original check grepped `ops/probe_titles.js`, deleted at t2367 —
it would have answered "not real" for the wrong reason.)*

---

### 32. [✅ SHIPPED t2371 — two-pointer pinch, exactly the sketched shape] NO PINCH-TO-ZOOM ON ANY FEATURE CANVAS — mobile has no zoom at all

> **Checked 2026-08-28:** `viz/featureCanvas.js` has **zero** `touchstart`/`touches`/`pinch` handlers (only
> `viz/gcodeViz3d.js` handles touch at all). Still live, unchanged.

*(reported by the owner from a phone, 2026-08-26, while reviewing drill's wizard preview)*

**OBSERVED, not inferred** — `viz/featureCanvas.js`'s `_bind()` binds exactly these:

```
:121  pointerdown   hit-test a handle, begin a drag
:145  pointermove   drag
:211  pointerup     end
:215  wheel         ⭐ ZOOM — desktop only
```

⇒ **There is no two-pointer handler anywhere.** So this is not "pinch is being swallowed" — **pinch was never
implemented.** Desktop got zoom through the wheel and mobile got nothing. The transform machinery it would
drive already exists (`_tf`, `_userAdjusted`, `scale`, double-click re-fit) — only the gesture is missing.

⚠ **It affects EVERY feature canvas**, not just drill: `featureCanvas` is the one component all the
parameter-driven 2D views use.

⚠ **The conflict that makes this non-trivial**, and why it should not be a reflex `touch-action` change: the
same surface must support **dragging a handle with one finger** and **pinching with two**. A blanket
`touch-action: none` (used elsewhere in `styles.css` for exactly the drag reason) kills pinch; a blanket
`pinch-zoom` makes handle drags fight the browser's own panning.

**Sketch of the fix, not a prescription:** track pointers in a map on `pointerdown`; **one** pointer keeps
today's drag path unchanged, **two** switches to pinch — midpoint drives pan, distance ratio drives
`scale` — and the existing wheel path already shows what to call. ⭐ Set `_userAdjusted` so the auto-fit stops
fighting the user, exactly as the wheel path does.

⛔ **Do not regress the handle drag.** It is the primary gesture on this surface, it is what the whole
parameter-driven canvas exists for, and it works today.

**STILL REAL IF:** `grep -c "pointerdown" DDCS-Studio/web/viz/featureCanvas.js` returns hits but a search for
a two-pointer/pinch path finds none → still real.

> **#32 SHIPPED (t2371) — exactly the sketch above, not reinvented.** `_pointers` (a `Map`, by pointerId)
> tracks every down pointer; ONE pointer keeps the existing drag/pan path byte-for-byte (confirmed live — a
> handle drag before and immediately after a pinch writes the same fields the same way); a SECOND pointer
> always switches to pinch, cancelling whatever single-pointer gesture was running first (a handle drag fires
> its own real `onDragEnd`, exactly like a normal release). The pinch anchors ONE reference point per gesture
> — the world point under the two-finger midpoint at the second pointerdown — and every subsequent move re-
> solves the transform to keep that point fixed under the CURRENT (moved) midpoint at a scale set by the
> CURRENT (changed) finger distance: the same "keep the point under the gesture fixed" shape `wheel`'s own
> handler already used for a stationary cursor, just anchored to a drifting midpoint instead — one formula
> covers pan-by-midpoint-drift and zoom-by-distance-ratio together. `_userAdjusted` set, matching wheel/pan, so
> the auto-fit stops fighting the user on a pinch too. `touch-action: none` was ALREADY set on `.feature-canvas`
> before this turn (`_mount()`'s own inline style) — the conflict this entry warns about was already resolved;
> the gesture handler was the only missing piece. A pinch ending never hands off to a resumed single-pointer
> drag/pan — the surviving finger needs its own fresh `pointerdown`. No native multi-touch API in Playwright, so
> `tests/feature-canvas-pinch-zoom-2371.spec.js` dispatches synthetic two-pointer `PointerEvent`s
> (`pointerType:'touch'`) directly at the SVG — proven non-vacuous (fails 2/2 pinch-direction assertions against
> the pre-fix file, the untouched single-pointer-drag test unaffected either way).

---

### 33. [✅ SHIPPED t2327 — V2026.08.26.12, visual approved by the owner] THE Ø HANDLE ROTATES THE WHOLE PATTERN — one handle drives two params, so neither is controllable

*(reported by the owner from the drill wizard, 2026-08-26: "diameter marker moves position too, and that's
not ok — it's impossible to control and keep the position")*

⭐ **THE ASYMMETRY THE OWNER IS ASKING FOR, stated plainly:**

```
drag POSITION  →  the whole array moves, and the Ø marker FOLLOWS   ✅ correct today, keep it
                  ⇒ the Ø marker's position is DERIVED. dragging the parent moves the child.
                  ⛔ but it must NOT change the diameter VALUE.
drag Ø         →  ONLY the diameter changes                          ⛔ BROKEN — it also rotates every hole
```

**ROOT CAUSE, OBSERVED.** `drillData.js:337` declares the ring as a **fused polar handle**:

```js
handles.push({ type: 'radial', id: 'dr_ring', field: 'dia', fieldA: 'startAngle', … })
```

and `viz/canvasWidgets.js:87-91` writes **both** on every drag:

```js
if (d.fieldA)  m[d.fieldA] = Math.atan2(dy, dx) * DEG;          // ← the angle, from ANY drag
if (d.rScale)  m[d.field]  = clampMin(Math.hypot(dx, dy) …);    // ← the diameter
```

⇒ **Any** movement of that handle sets `startAngle` from the cursor's bearing. Since `startAngle` rotates
every hole about the centre, changing the diameter **always** moves the holes. The centre never moves — but
every hole does, which is what "it moves the position" describes from the outside.

⚠ **The fusion is deliberate** — `canvasWidgets.js`'s own comment calls it *"the rotate gesture, fused with
radius like a drill ring"*, and it documents the escape hatch: *"omit `fieldA` for radius-only."* ⇒ This is a
**design decision that did not survive contact with the gesture**, not an oversight.

⛔ **It also violates a standing principle:** handles are independent — dragging one never moves another, and
relative positions are derived. A fused handle cannot honour that, because one gesture writes two params with
no way to isolate either.

**OPTIONS** — the owner's call, since it changes a gesture they use:

```
A ⭐ SPLIT IT — a radius-only Ø handle (omit fieldA) + a separate rotate handle for startAngle.
B    MODE-DETECT — one handle; radius when the drag is radial, angle when tangential.
C    RADIUS-ONLY — omit fieldA, drop rotate from the canvas; startAngle stays a form field.
```

#### ✅ DESIGN DECIDED WITH THE OWNER, 2026-08-26 — OPTION A, and the split is not two abstract levers

⭐⭐ **THE IDEA: `startAngle` IS the position of the first hole — so make the first hole the handle.** Do not
build a rotate lever; a lever is an abstraction you must learn and then map onto what moves. **Hole #1 is the
referent itself** — you drag the thing you want moved, to where you want it, and never ask which way it turns.

```
        ◉ ← HOLE #1        a CIRCLE, on the ring, drags AROUND      → writes startAngle ONLY
     ○     ○
   ○    ·····◆  Ø 50.0   ← the Ø GRIP    a DIAMOND, on the circumference, drags IN/OUT → writes dia ONLY
     ○     ○          └─ a dotted ARM runs centre → grip, carrying the Ø label
        ○                  the arm is what makes it READ as a radius instead of "a dot"
```

**The three rules that make them unconfusable** — different shape, different axis of motion, different meaning:

```
SHAPE     Ø grip is a DIAMOND, never a circle. Circles are holes.
MOTION    the grip slides ALONG the arm. Sideways does nothing.
BEARING   the arm sits 90° FROM hole #1 — it still rotates WITH the pattern, so it reads as attached,
          but it can never land on top of the rotation handle. ⛔ Do NOT draw it AT startAngle.
```

⭐ **And the crucial point, so nobody "fixes" this with a guard:** the arm may be drawn at ANY bearing without
reintroducing the bug. The defect was never that the marker sits at an angle — it is that **the drag WRITES
one**. Drop `fieldA` and the grip can be drawn anywhere; it will only ever write `dia`.

⭐ **WHY IT GENERALISES**, which is what makes it worth building once rather than patching drill: for the
**line** pattern the rotate handle is the **last point**; for any oriented feature, the handle is *the thing
the param positions*. Same rule as the traverse targets — the control and the controlled are one object.

⚠ **The one thing reasoning cannot settle:** whether the dotted arm reads as clutter on a phone at high hole
counts. That is a look-at-it check once it exists, not a design question — build it, then look.

⚠ **Check the other fused handles before fixing just this one** — `fieldA` also appears in
`wizards/ops/fillText.js` and `wizards/views/drillView.js`. If they share the shape, they share the defect.

**STILL REAL IF:** `grep -n "fieldA" DDCS-Studio/web/blocks/dataOps/drillData.js` → any hit means the ring
handle still writes two params.

---

### 34. [✅ SHIPPED t2359 — `fa86f828`, V2026.08.28.1] ⛔ OPENING A WIZARD TRIGGERS THE GOOGLE SIGN-IN — the flow is fine, the TRIGGER is the bug

*(reported by the owner from a phone, 2026-08-26, with a screenshot: `accounts.google.com/v3/si` — "Choose an
account to continue to ddcs-studio.pages.dev")*

⭐⭐ **FOUND, 2026-08-27 (t2343) — INSTRUMENTED, NOT READ. The caller is `wizardTemplates.js`'s `mountPresetRow`,
called from `wizardManager.js:287` on EVERY wizard open** ("the adaptive preset row at the form top," its own
t794 P3 comment says — "Idempotent per open," meaning literally every open, matching the owner's own correction
below that it recurs rather than fired once). The full, real stack trace (captured live, GIS's own token client
stubbed so no real Google network call was made, a stale-but-present token simulating the owner's own
post-expiry state):
```
GIS initTokenClient({prompt:''})
  ← silentRefresh()          googleDrive.js:79
  ← api()'s 401 retry        googleDrive.js:55
  ← ensureRoot()             googleDrive.js:96
  ← cloudFileRef()           wizardTemplates.js:29
  ← cloudRead()              wizardTemplates.js:37
  ← listTemplates()          wizardTemplates.js:51
  ← mountPresetRow()         wizardTemplates.js:81
  ← wizardManager.js:287, called on every wizard open
```
**Why three prior reading passes missed it**: `getAccount().connected` (`cloudAccount.js:18`) is `!!localStorage.
getItem(TOK)` — a token STRING existing, never checked for validity or cleared on expiry. So "connected" stays
true forever after the FIRST successful connect, even hours later once the ~1h access token has actually
expired. `mountPresetRow` asks `listTemplates`, which asks the cloud ONLY `if (cloudConnected())` — true, on a
stale token, exactly the owner's state — to see if cloud-saved presets exist for the op just opened.
`ensureRoot()`'s underlying `api()` call gets a 401 from the stale token, and `api()`'s own 401 handling ALWAYS
tries a `silentRefresh()` — by design, correct for a DELIBERATE cloud action (Save/Open to the Project Manager),
but this call didn't come from one: it came from a passive, unprompted background check that runs on every open
regardless of whether the user has ever touched cloud presets for that op. `prompt:''` usually IS silent, but
when GIS can't complete it silently (session actually gone, third-party-cookie blocking, mobile Safari/Chrome),
it falls back to the visible "Choose an account" chooser — the screenshot, confirmed by the earlier reading pass
to be GIS's own UI, not `cloudAccount.js`'s popup (ruled out below, correctly).

**Verified INDEPENDENT of t2341's drill flip**: ran the identical instrumented open on `user_corner_data`
(never flipped) and `user_drill_data` (flipped at t2341) — byte-identical trigger, same stack, both fire. The
flip changed nothing about this; do not chase it as a cause.

**A second, separate, boot-time-only trigger exists and is NOT this bug**: `cloudAccount.js`'s
`backfillIdentity()` (called from the header avatar, "renders on every load") also unconditionally calls
`getUserInfo()` when connected+missing identity fields, hitting the same 401→silentRefresh path — but it is
gated to fire ONCE per page load (`captureGoogleIdentity._tried`), not on every wizard open, so it does not
match the owner's "recurring on wizard open" report. Noted for completeness; not the answer to this entry.

⚠ **AMENDED BY THE OWNER, same turn — sharper signature, addressed honestly rather than re-asserted over:**
it is NOT per-open, it is ONCE PER PAGE LOAD — the first wizard open in a session triggers the sign-in, later
opens in the same session do not, until a reload. That is fully CONSISTENT with `mountPresetRow` as the caller
and needs no second mechanism: `mountPresetRow`'s own chain (above) would in principle re-attempt on every open,
but in the real app the FIRST attempt's `silentRefresh()` — whether it resolves silently or the user completes
the visible chooser once — writes a genuinely fresh token to `localStorage` (`googleDrive.js:81`), so every
`api()` call for the rest of that page load stops 401-ing and `silentRefresh` is never reached again. Attempted
to confirm this precisely (a second instrumented run whose GIS stub actually resolves a fake token, rather than
hanging forever like the first run's stub did, to see whether a resolved token stops the second open from
re-triggering) — **inconclusive, said plainly rather than papered over**: the synthetic mock needed to also fake
Drive's own API responses (the real googleapis.com correctly 401s ANY fake token, real or "refreshed"), and that
second mock introduced its own artifact (`ensureRoot()` caching a literal `"undefined"` folder id from the
mocked empty-file-list response, which changed which code path the second open took) — not trustworthy evidence
either way on the precise frequency. **The caller finding itself does not depend on resolving this**: it comes
from the FIRST run, which mocked ONLY GIS (no real OAuth completes) and let the REAL, unmocked Drive API return
its own genuine 401 to a genuinely invalid token — solid ground, not synthetic. Frequency (once vs. recurring)
changes SEVERITY, not WHERE the fix goes.

⚠ **A FOURTH THEORY WAS RAISED AND CHECKED, SAME TURN — CONFIRMED NOT APPLICABLE, for a structural reason, not
a guess:** the idea was that `cloudAccount.js:160` captures an OAuth **refresh token** (`localStorage`'s
`ddcs_cloud_refresh`) that nothing ever reads back (confirmed true by grep — zero readers repo-wide, only a
write at connect and a clear at disconnect), so an expired access token has no renewal path and the next Drive
touch hits a cold sign-in. **Checked before building anything, as asked**: `cloudAccount.js:65`'s own doc
comment states the branch plainly — *"Google uses GIS (its token model); Dropbox/OneDrive use the PKCE popup."*
`connect()` (`:66-83`) confirms it in code: for `provider === 'google'` it calls `connectGoogleFlow()` (GIS
token-model, `:86-97`), which stores ONLY an access token — no PKCE code exchange, no refresh token, ever.
The PKCE path that captures `REFRESH` (`openConnectModal`, `:82`) is reached only for Dropbox/OneDrive. **So for
a Google account — the owner's own case, confirmed by the screenshot's `accounts.google.com` origin — a refresh
token is never even captured in the first place; there is nothing to "use."** The theory is dead for THIS bug,
exactly as its own framing anticipated it might be. The unused-`REFRESH`-key observation stands as a real, small,
SEPARATE finding worth a line: any Dropbox/OneDrive user who connects also gets a captured refresh token that
is never used — same dead-capture shape, different provider, out of scope for this Google-specific report.

⛔ **NOT FIXED THIS TURN — reported, not patched, per the standing caution on auth-path changes (three prior
wrong diagnoses already spent on this).** The generic `api()` 401→silentRefresh retry is CORRECT and should stay
— it is what keeps a user signed in across the hourly token expiry for an intentional cloud action (Save/Open).
The actual fix belongs at the CALLER: `mountPresetRow`'s cloud-presets check should not run an unprompted
network operation (including a "silent" refresh that can visibly fail into a chooser) as a side effect of simply
opening a wizard. Genuine design choices remain open, not resolved here: defer the cloud template check to
on-demand (only query cloud when the user actually opens the presets dropdown, not eagerly on mount); or treat a
401 from THIS specific caller as "cloud unavailable right now" and fall back to local-only without ever calling
silentRefresh; or cache a short-lived "cloud check failed" flag so a stale-token session doesn't re-attempt on
every single wizard open in the same session. Any of these closes the bug; picking between them is a product
call this entry deliberately leaves to whoever fixes it next, with the caller now named precisely enough that no
further instrumentation should be needed.

**STILL REAL IF (updated)**: connect a real Google account, wait past the ~1h token expiry (or fake it — set
`localStorage.ddcs_cloud_token` to a garbage string with `ddcs_cloud_provider='google'` still set), then open
any wizard → a live GIS `initTokenClient`/chooser fires. Reproduced exactly this way above.

⚠ **CORRECTED 2026-08-26 — the sign-in itself is NORMAL and the flow is not a bug.** The advisor first
wrote this up as a rogue full-page redirect. It is not. `cloudAccount.js:164` opens the app's ordinary,
deliberately-designed sign-in as a **popup** (`window.open(… 'width=520,height=680')`) with a proper
popup-blocked fallback message. ⇒ **What the owner saw is mobile Chrome turning that popup into a
navigation**, because phones largely do not honour popups. **Platform behaviour, not a defect.**

⛔ **THE REAL DEFECT IS THE TRIGGER, and only the trigger:** signing in is a CLOUD gesture. **Opening a
wizard is not.** Something on the wizard path calls into the cloud layer unbidden.

⛔ **THIS NARROWING WAS WRONG — CORRECTED 2026-08-27 (t2343).** The owner later reported it recurring on wizard
open, not a one-off. Instrumentation (found above, top of this entry) confirms why: `mountPresetRow` genuinely
IS a systematic wizard→cloud call, on every single open, once the account is in the stale-but-"connected" state
— not a rare expiry artifact. Left below, struck rather than deleted, so the wrong turn in reasoning stays
visible: ~~**NARROWED 2026-08-26 — IT FIRED ONCE, NOT ON EVERY WIZARD OPEN.** That is the signature of a token
expiry, not a systematic wizard→cloud call. Severity drops sharply: this is not "wizards need an account", it is
"an expired session re-authorised itself on the next action that happened to need it, and the next action
happened to be a wizard."~~

⛔ **THE ADVISOR'S THREE CANDIDATES WERE ALL CHECKED AND ALL WRONG. Do not chase them:**

```
savePrefs.js      only READS getAccount().connected — never initiates       ⛔ ruled out
cloudAccount.js   its popup's ONLY caller is a header button's onclick      ⛔ ruled out
profileStore.js   an EXPORT/IMPORT feature — Drive is a destination, not a
                  dependency; wizard settings come from settingsPanel /
                  workspaceMachine, which are local                          ⛔ ruled out
```

⇒ **THE TRIGGER IS NOT FINDABLE BY READING.** Three passes failed. **Instrument it:** breakpoint or wrap
`googleDrive.js`'s token request and open a wizard with an expired session. The stack will name the caller in
one run, which is cheaper than a fourth guess.

⭐ **And note what the failed search itself establishes:** nothing on the settings path gives a wizard a
reason to touch the network. Opening one should be entirely local, so whatever reaches for Drive is reaching
for something it does not need. ⚠ **Two auth paths exist and they are different** —
`cloudAccount.js`'s popup (whose ONLY caller is a header button's onclick, so it is not this) and
`googleDrive.js`'s own GIS token client. The screenshot's "Choose an account" chooser is GIS's, which points
at the second.

⚠ The mobile consequence still matters when judging priority — because the popup becomes a navigation on a
phone, an unwanted prompt costs the user their place. But **do not go looking for a redirect bug; there is
none.**

⚠ **No wizard→cloud call path was found by grepping** (`wizardManager.js` and `wizards/` import nothing from
`ui/cloud*`), so the trigger is INDIRECT and needs tracing with the app running, not by reading. **Do not
assume a call site — instrument and catch it.**

**Candidates, none confirmed:** the wizard's own **"★ Save preset"** control (`ui/savePrefs.js` imports
`getAccount` from `cloudAccount.js`); the projects layer (`ui/projects/projectManager.js`, same import); a
token refresh that happens to fire on the next user action after expiry.

#### THE THREE QUESTIONS, answered as far as reading allows

1. **Is it normal?** ⛔ **No.** Opening a wizard is local work — it emits G-code from parameters. It has no
   business requiring a Google account, and nothing in the wizard path should reach the cloud layer at all.
2. **Why not at app open?** Because the trigger sits on a wizard code path rather than boot. ⚠ **That is
   worse, not better** — a surprise mid-task costs the user their place; the same prompt at boot would cost
   nothing.
3. **Can it detect an existing session?** ⭐ **It already should.** `cloudAccount.js` is documented as *"ONE
   source of truth for is there an account"* and `headerAccount.js` consumes it. So either the state is not
   being consulted before the redirect fires, or a token expired and the app is re-authorising **silently and
   destructively** instead of asking.

#### ✅ RULED BY THE OWNER, 2026-08-27 — REMOVE THE PRESET ROW. The feature is a duplicate concept.

The trigger (t2343) is `mountPresetRow`'s background Drive check on every wizard open. The fix is not to
defer or fail-quiet that check — it is that **the preset feature occupies a gap that does not exist**, by the
owner's own taxonomy:

```
reuse VALUES for a job     →  a PROJECT — which can be ONE op. Right weight, already exists.
reuse an IDENTITY/layout   →  a CUSTOM WIZARD fork (the arc's own mechanism, live today)
the middle ground          →  nothing. Presets were the hand-rolled July version (t794),
                              built before the arc made the declared version real.
```

Owner: *"custom wizard includes form layout though — not needed for a job. but a project can be one op."*
A fork carries the whole wizard definition — more than a job needs; a one-op project carries just the
configured op — exactly what a values-recall is.

⇒ **THE WORK: remove `mountPresetRow` and the preset feature behind it** (`ui/wizardTemplates.js` —
listTemplates/cloudRead/the ★ popover), per the standing delete-freely and no-legacy-burden rulings. Sweep
consumers before deleting; git keeps it. This kills the wizard-open Drive call entirely — the OAuth prompt
dies with the feature rather than being managed.

⚠ STILL WORTH DOING alongside: make `cloudConnected()` mean VALIDATED, not non-empty — other callers may
repeat the same silent-reauth pattern, and an expired session should say so in the header chip.

⚠ One honest follow-up to CHECK, not assume: how convenient is inserting a ONE-OP project into the CURRENT
job? If that path is clunky, it is the real replacement's gap — file it separately if so, do not keep
presets for it.

#### ⇒ WHAT THE FIX HAS TO ACHIEVE, whatever the trigger turns out to be

```
⛔ NEVER trigger auth from a path the user did not associate with the cloud.
   Opening a wizard is not a cloud gesture. THIS IS THE WHOLE BUG.
⭐ CONSULT the existing session first — and if a token has expired, SAY SO rather than silently
   restarting a sign-in the user did not ask for.
⚠ Leave the popup flow alone. It is correct, it has a blocked-popup fallback, and its
   become-a-navigation behaviour on mobile is Chrome's, not ours.
```

**STILL REAL IF:** open any wizard in a browser with no cloud session → a navigation to `accounts.google.com`
means still real.

<!-- 33 shipped -->
> **#33 CLOSED.** Shipped at t2327 in **both** `drillData.js` (twin) and `drillView.js` (the classic,
> live-shipping wizard) — they drive the same shared `canvasWidgets.js` radial gesture, so both carried the
> bug. Hole #1 is the rotate handle; the Ø grip has a locked arm and cannot write an angle by construction.
> ⭐ **The owner approved the visual** ("love it") after the worker honestly flagged that the dotted arm might
> read as similar to the ring's dashed guide at a glance. ⚠ **The LINE pattern shares the identical fused
> handle** (`drillView`'s `end`, `drillData`'s `dr_line`) — **checked, reported, deliberately NOT fixed.**
> `fillText`'s `txt_rot` was checked too and is already angle-only, so it is safe.

---

### 35. [⭐ PINNED t2367 — the DOM precondition + the one in-scope path are now a live regression test] SEVEN `.pa-mount[data-prefix="d_"]` ELEMENTS COEXIST IN THE DOCUMENT — an unscoped query would find the wrong one

*(found at t2333 while root-causing BACKLOG-adjacent Finding 3 — the "Path Datum invisible" report — never a
failure on its own; filed here rather than left in a WORK-LOG entry nobody will re-read)*

**OBSERVED, not inferred** — a live measurement inside a synthetic tree-mode op carrying a `path_anchor` node
(`ui/pathAnchorField.js`) found `document.querySelectorAll('.pa-mount').length === 7` on a fresh page, before
opening anything beyond the one synthetic op. Multiple classic wizards' own static shells (`index.html`) bake
in a hidden `.pa-mount[data-prefix="d_"]` unconditionally — t2293's own comment already named "6 static shells
(surfacing/text/slot/pocket/contour/drill), each with their OWN single hidden `<input id="d_pathDatum">`," all
sharing the same `'d_'` prefix. `document.querySelector('.pa-mount[data-prefix="d_"]')` (unscoped, document-
wide) found a **different, never-built (empty)** mount than the one `mountPathAnchor` had just correctly
populated via its own SCOPED call (`root.querySelector(...)`, `root` = the caller's own container — t2293's
own fix, still correct).

⇒ **This is the identical shape to the bug already fixed twice in this exact area** (t2293's own id-collision
root cause, t2319's own dead id-stamp follow-up) — a THIRD instance of "a document-wide DOM lookup finds
whichever the browser hits first, not necessarily the caller's own," this time on `.pa-mount` itself rather
than on the `id`/`data-param` inside it.

⚠ **Nothing currently trips it.** `mountPathAnchor` itself is already correctly scoped; the only unscoped
`.pa-mount` query found (t2333's own diagnostic) was throwaway investigation code, not shipped. Filed as a
DORMANT hazard, not a live bug — the same "declared once, proven never" pattern this whole area keeps
producing, one layer further in.

**Sketch of the fix, not a prescription:** any FUTURE code that needs to find "the currently open op's own
picker" should scope through `#wiz_user_form` (or whatever the live form host is) the same way
`stock-spill-792.spec.js`'s own t2335 fix does (`#wiz_user_form .pa-mount`, unambiguous by containment,
prefix-agnostic) — never a bare `.pa-mount[data-prefix="..."]` against `document`.

**STILL REAL IF:** `document.querySelectorAll('.pa-mount').length` measures > 1 with any wizard open → still
real (the multiple static-shell instances are baked into `index.html` and are not going away on their own).

> **#35 CLOSURE (t2367):** re-measured live rather than re-trusting this entry's own paraphrase — the 6 static
> shells (`index.html`, `grep -c 'class="pa-mount"'` = 6) each carry their OWN DISTINCT prefix (`d_`/`p_`/`ct_`/
> `sl_`/`sf_`/`tx_`), not all `'d_'` as the quoted t2293 comment above reads; the real collision is narrower and
> sharper than "seven same-prefix mounts" — exactly TWO `.pa-mount[data-prefix="d_"]` elements coexist the
> moment ANY code creates a second `'d_'`-prefixed mount alongside drill's own always-present static one, which
> is precisely what happens the instant drill's own TWIN (`user_drill_data`) is opened (`drillData.js`'s
> declared form reproduces the built-in's `path_anchor` prefix faithfully). The 6 legacy static callers
> (`drillView.js` etc., all `mountPathAnchor(prefix)` with no `root`) stay OUT OF SCOPE — shipped, working
> classic-wizard code, no live symptom, touching them is not what this closure is for. What's now PINNED, not
> just documented: `tests/pa-mount-scope-2367.spec.js` — one test measures the DOM precondition itself (6 static
> mounts at boot, exactly 1 using `'d_'`), the other opens the twin and proves BOTH halves of the guarantee live
> — the twin's own scoped mount gets built with real content (2 corner-grid pickers), AND the ever-present
> static shell sharing its prefix stays untouched (`dataset.built` never set, no children) — proven non-vacuous
> by temporarily reverting `formWidgets.js`'s scoped call to the unscoped default and confirming the second test
> fails 3/3 (the diff was restored immediately after, verified clean). This closes the ONE path wizards-as-data
> forms actually reach; the dormant hazard in the 6 legacy static callers remains dormant, by design, unfixed.

---

### 36. [⭐ MEASURED 2026-08-27 — ZERO twins affected, a footnote not a cap] FOUR WIDGETS HAVE NO BINDABLE DOM VALUE — `field_ref` cannot reference them at all

*(found at t2335 while surveying all 18 widget functions for an unrelated fix; recorded here because it is a
LIMIT ON THE ARC, not a bug, and it was about to live only in a WORK-LOG entry)*

```
cornerGrid · regionPick · coordList · the xy/rect canvas pads
⇒ they carry NO [data-param] element. their value is read from CLOSURE STATE.
```

⭐⭐ **`field_ref` works by RELOCATING an element that carries a bindable value.** These four have no such
element to relocate. ⇒ **A wizard using any of them cannot be expressed as a declared tree**, however much
machinery gets fixed.

⚠ **This is structurally different from every blocker the flip has hit so far.** Those were bugs
(`childrenOf`, the dead id, the geometry seam) or missing vocabulary (fixed-pixel panes, responsive
stacking) — all fixable, and all fixed. **This is a widget whose value has no DOM representation**, so
there is nothing for a reference to point at.

**THREE POSSIBLE ANSWERS, none obviously right:**

```
A  give them a bindable element    a hidden [data-param] input mirroring the closure state.
                                   ⚠ two sources of truth for one value — the defect class this
                                     project hits most often.
B  a different node type            not field_ref's relocation, but a node that CONSTRUCTS the
                                   widget in place from the declaration.
C  accept the limit                 those wizards keep their hand-written shells. ⚠ then "every
                                   wizard becomes a data twin" is false, and the arc needs to say
                                   which wizards it does NOT cover.
```

#### ⭐ BLAST RADIUS MEASURED, 2026-08-27 — **ZERO twins use any of them. This is a FOOTNOTE, not a cap.**

```
coord-list · corner-grid · region-pick · xy-pad
→ declared by 0 of the 32 dataOps twins
```

⇒ **The arc's reach is not limited by this today**, so ⛔ **do not spend a turn on options A/B.** The widgets
exist in `formWidgets.js` and each has a Blockly field twin installed by `bridge.js`
(`cornerGridField`/`regionPickField`/`coordListField`) — they are simply not bound by any declaration.

⚠ **Two things that keep it open rather than closing it:**
- the grep covered TWINS. A hand-written shell may still use one directly, so a wizard **becoming** a twin
  could hit this. Re-run the check per shell when porting one, not once globally.
- it remains a real limit for any FUTURE op that wants one of these widgets.

⇒ **Revisit only when a specific port actually needs it** — at which point the blast radius is one wizard and
the choice between A, B and C is concrete instead of theoretical.

⚠ **Establish the blast radius before deciding** — which of the 15 shells actually use these four? If it is
one obscure op, C is cheap. If `regionPick` or the canvas pads are in the mill family, it decides how far
the arc can reach. ⭐ **That count is the single most useful next fact about the arc's true cost**, and it is
one grep.

⛔ **Do NOT bolt on option A reflexively.** A hidden mirror input is exactly the "one thing declared twice"
shape that has produced repeated defects here.

**STILL REAL IF:** `grep -n "data-param" DDCS-Studio/web/ui/formWidgets.js` → if cornerGrid / regionPick /
coordList / the canvas pads still have no `[data-param]`, still real.

---

### 37. [✅ SHIPPED t2361 — `be0e310f`, V2026.08.28.2] INSERT OP FROM PROJECT — the preset successor, ruled with the owner 2026-08-27

*(the gap the preset removal (#34) leaves, found by the owner: "within a project, i might want to insert ops
of different presets." A one-op project covers STARTING a job from saved values; this covers COMPOSING one.)*

**THE FEATURE:** from within the current job — *Insert op from project…* → browse your saved projects → see
each project's ops → pick one → it is inserted into the current stack with its saved params.

```
⭐ PROJECTS STAY THE ONLY STORE OF VALUES. This is a READ of one project from inside another —
   one storage concept, a new gesture over it (one stack, many views). A one-op project then
   behaves exactly as a preset did — and so does ANY op in ANY past job, which is strictly more
   than presets offered: every job you have done is the library.
```

**Mechanics mostly exist:** a project's ops are readable from its stack/markers (`opFromMarker` reconstructs
an op from params), and inserting into the current stack is what every wizard already does. The imported op
re-emits under the CURRENT job's context (settings, machine, WCS) exactly like a reimported `.nc` — params
travel, the body regenerates.

⚠ **THE ONE REAL HAZARD, name-it-now:** importing an op whose TYPE is not registered in this workspace (a
`user_*` op whose custom def lives in another workspace's storage). ⛔ Do not silently drop or guess — refuse
with the reason, or establish whether the def travels in the `.mjson` and carry it. Decide at build time with
the file in hand, not now.

✅ **Entry point RULED by the owner, 2026-08-27: the QUICK MENU.** ("that would go in quick menu right?")
Insert-op-from-project joins the quick menu's actions; no other entry point unless the owner adds one later.

⚠ Sequencing: the preset REMOVAL (#34) proceeds independently — the owner has never saved a preset, so
nothing is lost in the interim. This entry exists so the gap does not fall between two turns.

---

### 38. [⛔ DIAGNOSIS REFUTED t2357 — the rule DOES reach the tree, verified live to three decimals] the narrow settling-lag observation

*(found at t2355 while fixing the container coupling; named in the hand-back, filed here so it does not live
only in a WORK-LOG entry. LOW priority — single-digit pixels, in-motion only, gone by release.)*

During a narrow-width (stacked) drag on a TREE twin, the pane bodies lag the drag by a few pixels while in
motion, settling correctly on release. The worker's diagnosis: the `--viz-stack-h` CSS rule that gives the
classic shell's pane bodies their in-motion height is **classic-only** — the tree's pane bodies have no
equivalent rule, so they settle via layout rather than tracking the variable directly.

⭐ The fix shape is declared-and-known: give the tree's pane bodies the same stylesheet rule the classic ones
have, in the tree's own selectors. ⚠ Verify with the dragProbe (in-motion rows, not just release) — this lag
is invisible to any release-state assertion.

**STILL REAL IF:** at a stacked width, mid-drag probe rows show the pane rect lagging `expH` by more than a
pixel while moving, converging only at ▲ up.

> **#38 CORRECTION (t2357):** the worker refuted its own t2355 diagnosis by checking the selector against the
> live tree via `element.matches()` — the `--viz-stack-h` pane-body rule is a pure descendant chain and DOES
> reach tree pane-bodies (confirmed 164.375px against a 0.618 ratio). Narrow consumes the ratio through its
> own already-working mechanism. The single-digit-px in-motion lag observed at t2355 is now unexplained and
> unreproduced — if it resurfaces on a real device, re-file with fresh probe rows rather than this diagnosis.

---

### 39. [✅ CLOSED t2369 — fork body sourced from the def's own unpruned template, scoped to genuinely guarded defs; both structural arms proven as real fields, params-seed proven against the registry] A GUARDED WIZARD LOSES ITS GUARD ARMS WHEN FORKED FROM A PLACED OP

*(surfaced t2365 while fixing the insert-then-save fork; the worker judged it too large to fold in and
flagged it rather than patching it — the right call, recorded here so it is not lost)*

**Two doors reach "save this as my own wizard", and they lift different things:**

```
CUSTOMIZE      ddcsEditWizardDef  -> loads the wizard's OWN template     all 32 twins, guards included
INSERT + SAVE  saveAsFork         -> lifts a PLACED op's lifted shape    guarded wizards refuse
```

t2365 fixed this door's framing mismatch — a placed op carries different `progstart`/`progend` framing than a
standalone template, so every binding past that boundary was silently dropped and the fork registered a fully
structured but **completely empty** form. `reattachFraming` (`devMode.js`) now splices the candidate's own
live framing back at the source's relative position. **Drill forks losslessly through it — 37/37 bindings.**

⚠ **A GUARDED wizard (pocket) taken through the same door still hits a separate, older refusal.** It is
**loud** — it declines with a visible reason rather than registering something quietly wrong, which was the
floor t2365 was held to — but it is not the lossless "indistinguishable" outcome the arc's plan describes.
Confirmed pre-existing via A/B against bare HEAD; **`CUSTOMIZE` forks pocket losslessly**, so no wizard is
unreachable — this is one door, not the feature.

⛔ **Do not fix by widening the refusal.** The guard-arm loss has its own root in how a placed op's guarded
arms are lifted; find that root before writing anything. The refusal is a correct symptom of it.

### STILL REAL IF

Insert a **pocket** op into a job, then Save Custom Wizard from that placed op. If it refuses with a visible
guard-arm reason, this is live. (Customize -> pocket -> save must still fork losslessly; if THAT breaks, it is
a regression in `fork-parity-1593.spec.js`'s territory, not this entry.)

### ⭐ THE CONTEXT THAT MAKES THIS SMALLER THAN IT LOOKS

⚠ **CORRECTED 2026-08-28.** This section first said *"only two wizards have a declared form"* — false, taken
from a hand-back phrase rather than the code. **Measured: 32 of 33 dataOps files declare a `param_group`, so
essentially every twin has a declared form.** Only two are pinned by a *reproduction ratchet spec* (drill
t2299, pocket t2301), which is a different thing.

⇒ **That makes this entry BIGGER than first written, not smaller.** Every twin has a form to lose, so the
guard-arm loss is not gated behind a porting run that has barely started — it applies to any guarded wizard
forked from a placed op, today. Every other wizard still reaches the fork losslessly through the pre-existing
all-32 `CUSTOMIZE` path, which is unaffected — so the blast radius is *guarded wizards, via one of two doors*.

> **#39 CLOSED (t2369).** Built exactly the approved direction: `prepareCandidate` (`devMode.js`), when the
> placed op's `opType` resolves to a registered def that is GENUINELY guarded (`armBlocks(srcDef.template) > 0`
> — extracted from `validateUserOp`'s own t1593 check into an exported `userOps.js` helper so both call sites
> share one declared arm-count, not two), sources the fork's BODY from a clone of the def's own unpruned
> `template` — the same shape CUSTOMIZE reads — instead of the placed instance's pruned `.children`, then seeds
> each inherited binding's own `.default` from the placed op's live params. **Deliberately SCOPED to guarded
> defs only, not every registered def** — an unguarded op's placed `.children` can carry a GUI param block the
> user dragged onto a value socket on the canvas after inserting, and sourcing from the def's template
> unconditionally would have silently discarded that live edit for all 31 unguarded twins to fix a problem only
> the guarded ones have; drill (and the other 31) keep the exact t2365 `reattachFraming` path, confirmed
> byte-identical (`armBlocks` on drill's own template measures 0, so it never reaches the new branch).
> Live-verified both required halves: pocket's own two structural arms (`strategy` raster/spiral) are now real,
> enabled, populated fields after an INSERT-then-SAVE fork — not just present wrappers, the `direction` field
> that exists ONLY in the raster arm was switched to and its committed value confirmed to reach the real op —
> and a value set on the placed op BEFORE forking (`depth=7.77`) seeds the fork's own default, proven against
> the DEF's own registered binding (not the DOM, which is legitimately influenced by `wizardManager.js`'s own
> unrelated t1437 "last-used values" feature — a real find made and then correctly set aside as out-of-scope
> during this turn's own verification). Regression-checked: `fork-parity-1593`'s "refused set is EMPTY" still
> holds for all 32 twins (1.3m run, unaffected), drill's own 37/37 unchanged. `tests/fork-to-custom-2365.spec.js`
> rebaselined — its own KNOWN-GAP test (asserting the now-closed refusal) replaced with a positive lossless
> verification.

---

### 40. [✅ SHIPPED t2445 — `ATC_DIALECT` entries carry `expectedType`; the engine reads `settings.outputs[]` via a new `outputs` constructor option before asserting a handshake sensor; a `group:'atc'` carve-out protects existing ATC-picker-created rows from a false "repurposed" read; `_noAutoAnswer` also exempts the sensor from the separate hands-free auto-answer safety net, or the fix would've been silently undone ~350ms later] THE SIM IGNORES THE OUTPUT TABLE THE USER ALREADY FILLED IN — "stage 3", declared and never finished

*(surfaced 2026-08-28 from a community post — an M350 V2 owner running a two-head machine who drives his DUST
COLLECTOR from `M151`. We are not solving his problem; his post made ours visible. ⭐ Third "gap" that
afternoon which turned out to already exist — same as `commscreen` and the `path_anchor` node.)*

**The user can already organise their outputs. Nothing reads the result.**

```
settings.outputs[]         USER-EDITABLE, per-machine, persisted, has a `custom` type
  { type, label, pin, onCode, offCode }      ioTable.js:23-30
  exposed by getOutputs()                    settingsPanel.js:533
                          ⇣
                  ✂  nothing connects these
                          ⇡
ATC_DIALECT + HANDSHAKES   HARDCODED, drives the simulation
  150 → OUT_GRIPPER_OPEN → asserts IN_GRIPPER_OPEN @450ms
  GcodeExecutionEngine.js:36-63 · virtualIO.js:171-199
```

⭐ **The code says this was always the plan.** `settingsPanel.js:253`: *"syncFlatFromIO() mirrors edits back to
the flat fields so the sim + wizards keep working **until they read the arrays directly (stage 3)**."*
⇒ Not a missing design — **a declared seam with an unfinished consumer.**

### WHY IT MATTERS — a FALSE GREEN, not a wrong label

Layer 1 (M-code → intent) is the VENDOR's dialect and is right to hardcode. Layer 3 (pin → physical port) is
the USER's and we correctly never touch it. ⛔ **Layer 2 is the bug**: "M151 fires an output" is a fact about
the dialect; *"…and 450ms later a gripper-closed sensor asserts"* is a claim about **that machine's wiring**,
made from the M-code alone.

```
program   M151        (his dust collector off)
          M306        (wait: gripper closed)
sim       asserts IN_GRIPPER_CLOSED @450ms  →  proceeds  ✅
machine   no gripper on that head           →  parks forever
```

⚠ The simulation is confident and the machine hangs — the wrong direction for a wrong answer to point.

### THE WORK — three parts, the last two trivial

1. **The sim reads `settings.outputs[]` before falling back to `ATC_DIALECT`.** The label follows for free, and
   the handshake stops asserting a sensor the machine never declared. ⛔ **Outputs only** — not inputs, not the
   whole stage-3 model.
2. **Add the gripper row to `OUTPUT_TYPES`** — drawbar, dust cover and carousel are all catalogued; `M150/M151`
   simply are not. One row.
3. Establish whether the OPEN-LOOP family (`M156-M161`: locating pin, vacuum, pusher) needs the same, since it
   has no handshake to get wrong — likely a no-op, but check rather than assume.

⛔ **THIS IS NOT THE BABYSITTING RULE.** We would infer nothing, correct nothing, overwrite nothing. The fix is
to **stop inventing a sensor nobody told us exists** — declining to assert, not asserting harder.
⚠ And model no opinion about WHICH output someone should repurpose: a closed-loop gripper output is an odd
choice for a dust collector, and that is entirely the machine owner's call.

### STILL REAL IF

~~`grep -n "getOutputs" DDCS-Studio/web/engine/*.js` → no hits means the engine still ignores the user's
table.~~ SUPERSEDED — the shipped fix doesn't call `getOutputs()` from inside `web/engine/` at all (it's
INJECTED as a constructor option from `web/viz/createPreviewPanel.js`, matching the existing `stock`/
`wcsOffset` pattern), so this check would now read "still broken" even though it's fixed. The CURRENT
check: `grep -n "expectedType" DDCS-Studio/web/engine/GcodeExecutionEngine.js` → no hits means the fix
regressed (ATC_DIALECT's handshake entries lost their declared-type guard).

### ⭐ TESTABLE ON THE BENCH V4.1, READ-ONLY

The bench at `10.0.0.50` has **no ATC at all**, so anything the sim claims about gripper or drawbar sensors
there is provably invented. No writes needed to observe it. ⚠ Not reachable from the worker's own environment
(no network path to `10.0.0.50`) — still open, noted rather than silently skipped.

**⭐ A real regression risk found and fixed before shipping, not after**: `ioTable.js`'s own ATC pin-picker
was the ONLY thing that ever created a gripper row before this turn, and it stored those as `type:'custom'`
(no dedicated type existed yet) — the SAME representation a repurposed row would have. Comparing raw `type`
alone would have broken every EXISTING correctly-wired gripper. Resolved via `group:'atc'` (set only by that
picker, for that specific catalogued M-code) — trusted regardless of stored type; only a GENERAL-table row
(no ATC-specific meaning attached) is actually checked. Full story + all 6 tests: WORK-LOG t2445.

Files: `web/engine/GcodeExecutionEngine.js`, `web/engine/virtualIO.js`, `web/ui/ioTable.js`,
`web/viz/createPreviewPanel.js`, `tests/declared-output-type-gates-atc-handshake-2445.spec.js` (new).

---

### 41. [✅ SHIPPED t2425 — `frozenParams` on the op's own params, `collapsed` derived from it in `instantiate()`; reachable today only via "Customize as blocks" (a normally placed op's canvas carries no formfield/param_field blocks at all)] YOU CANNOT REMOVE A FIELD FROM A WIZARD'S FORM — the app silently undoes it

*(owner-reported live 2026-08-28: **"i delete blocks and row of form field dont get removed"**. Diagnosed
across four dead theories — recorded below so nobody re-walks them.)*

**There is no way to do it today. Not awkward — absent.** Both routes fail, differently and silently:

```
delete the formfield block   →  param stays frozen ✅   the ROW COMES BACK ❌   silently
disable the formfield block  →  works this session  →   forgotten on reload    (see #23)
```

⭐ **The row is not stale — it is being PUT BACK.** `formWidgets.js:1669-1686`: after the declared tree places
its rows, a fallback net walks every bound param and appends any row not in the host. The binding lives in
`def.bindings`, not in the block, so deleting the block never removes the parameter — and the net restores its
row from the binding that is still there.

⚠ **Two derivations disagree**, which is why this is confusing to diagnose:

```
formWidgets.js:1022-1028   rows come FROM THE BLOCKS  → deleting drops the row     ✅
formWidgets.js:1669-1686   the orphan net walks BINDINGS → appends it back         ❌
```

⛔ **The net is not the bug — its SILENCE is.** It exists for a real reason, cited in its own comment: at
t1605 corner's 7 structural bindings *silently vanished from the face*, leaving params that still drove G-code
while being uneditable. `orphanCount` was added at t1561 to make that observable **to tests** — never to the
user. The owner performed a deliberate gesture, the app quietly undid it, and said nothing.

### ⭐⭐ THE RULING — three states, owner-designed 2026-08-28. The state space is CLOSED.

```
            in form?   emits?
 KNOB         yes       yes      the default
 FROZEN       no        yes      "stop asking me" — a shop's fixed value
 DISABLED     no        no       owner: "disabled is removed from emit"
 ────────────────────────────
 (yes, no) = a knob that does nothing → meaningless, cannot exist
```

⇒ **Three valid states, a ladder of progressive removal**: out of the form, then out of the program.

⛔ **DISABLE ≠ FREEZE — the owner corrected the advisor on exactly this.** Disable means *it does not happen*,
which is its meaning on every other block in the app. Freeze means *it still happens, you just stop being
asked.* Opposites on the only thing that matters. Collapsing them would give `disable` a second meaning in one
place and keep the first everywhere else.

### THE GESTURE — right-click, owner-chosen

Sits next to Disable, so the distinction is visible **at the moment of choosing**. ⭐ And because freezing does
not delete the block, **the block is its own handle** — right-click again to unfreeze. Reversibility is free
and there is no second surface to keep in sync.

### THE VISUAL — two independent channels, isomorphic to the state space

```
 KNOB       expanded, full colour                in the form, editable
 FROZEN     collapsed to `depth = 6.0`,          not in the form, still emits
            full colour, tagged "not in form"
 DISABLED   greyed + hatched                     doesn't emit at all

 "is it in the form?" → SHAPE      "does it emit?" → COLOUR
```

⛔ **NOT low opacity** (owner's first idea, talked through and dropped): greying is *desaturate + lighten
toward the canvas*; opacity is *blend toward the canvas*. **The same operation** — the eye cannot tell which
route was taken, so it collides with disabled at any zoom, on any theme. Two answers on one channel.

⭐ The form config vanishing IS the "removed from form" signal — label/widget/default exist only to build a
row. Strip them and what remains is an assignment, which is what the param now is. Words over a glyph on the
author canvas: a padlock says *locked*, a crossed-eye says *hidden where?*; **"not in form"** needs no learning.

### THE WORK — smaller than it looks

1. ⛔ **`frozen` is a declared property of the BINDING, never Blockly block state.** That is #23's whole lesson:
   `opFromMarker` regenerates children from params, so anything on the block is forgotten on reload. As a
   binding property it survives, round-trips, and becomes assertable by the form-reproduction ratchets free.
2. Suppress the orphan net for params the author **deliberately** unplaced — and only those. ⛔ Do not disable
   the net: it must still catch an accidentally-lost row, which is the failure it was built for.
3. The right-click item + the collapsed rendering.

⭐ **The parameter ALREADY survives deleting its block** — so freezing is not new behaviour, it is making that
accident *intentional and declared*.

⚠ **DEPENDS ON #23** (ruled + approved 2026-08-26, never built): persisted disable. Today a disabled child
silently comes back on after a reload. **Frozen inherits that same bug** unless stored as a binding property
from the start.

### ⚠ FOUR DEAD THEORIES — do not re-walk these

1. *"the field-change handler doesn't fire for formfields"* — it does; only `sc_*` and op-header edits take the
   early `return` into `replaceOp`. Everything else reaches `reproject()` (`blocksApp.js:1124`).
2. *"the Wizard View only renders while editing a custom op"* — a stale comment (`blocksApp.js:474`). The
   `show` predicate at `:749` includes `def.bindings.length`, true for every twin.
3. *"a label edit isn't 'structure', so only values sync"* — refuted by the owner: **deleting** a block is
   unambiguously structural and still doesn't remove the row.
4. *"deriveAuthoredDef throws and the catch keeps the last good form"* — plausible (`:568`) but not the cause.

### STILL REAL IF

Open any wizard in Blocks, delete a `formfield` block, and look at the form. **Row still there = STILL REAL.**

### ✅ SHIPPED t2425 — built exactly the ruling above, one gap left open and named

- **`frozenParams: string[]`** lives on the op's own `params` (`userOps.js`), never on a Blockly block —
  survives `opFromMarker`'s reconstruction the same way any other param does, verified via a direct round-trip
  call (freeze → `opFromMarker` → the rebuilt tree still shows the same `collapsed` leaf).
- `instantiate(def, params)` marks whichever `formfield`/`param_field`/`field_ref` leaf places a frozen param's
  row `.collapsed = true`. Never touches emit — verified byte-identical G-code frozen vs. unfrozen.
- `userOpView.js` gained a **separate** `setFrozen(list)` / `_frozenExtra`, not reused from `_seed` — the
  "Customize as blocks" canvas never calls `setForm(params)` (it renders straight off the live template), so
  routing frozen state through `_seed` would have started overriding binding defaults there too, a real
  behavior change outside freeze's own scope.
- The gesture lives in "Block options…" (t2387/t2423's own submenu) as **❄ Freeze value / ❄ Unfreeze value**,
  gated on the block's own bound `param` field — not on row-existence (freezing removes the row by design;
  gating on the row would make the item vanish the instant it's used, with no way back).
- ⚠ **Reachability, established live, not assumed:** a normally PLACED op's own canvas renders **zero**
  formfield/param_field blocks — they only materialize in "Customize as blocks"
  (`window.ddcsEditWizardDef`). So today the gesture is reachable exactly where the ruling's own hazard example
  lives ("freezing depth at 6mm and forking that wizard") — placing/authoring a wizard, not editing an
  already-placed op instance.
- ⚠ **Left open, honestly, not silently:** Blockly's native collapsed-block rendering is crowded for a
  multi-field block like `param_field` (label + value + units all fight for the one collapsed summary line). A
  `.toString()` override was tried and produced overlapping text — worse, not better — so it was backed out
  rather than shipped half-working. The state itself (collapsed = "not in form") is correct and round-trips;
  only the collapsed block's own visual polish is a known gap.
- Tests: `tests/freeze-value-2425.spec.js` — two direct unit tests (byte-identical emit + collapse-marking;
  the full `opFromMarker` round-trip), one "live" test that patches `.data.params.frozenParams` the same way
  `toggleFreeze` does and reads the live workspace back via `workspaceToStack` (NOT
  `window.ddcsGetBlockProgram()`, which is a cache a raw `.data` patch never updates — reading it back would
  silently reload the stale pre-patch value), and one menu-contents check that calls the `ddcsBlockOptions`
  `ContextMenuRegistry` entry's own `callback` directly rather than driving an actual right-click. The last one
  replaced a genuinely-unreliable full right-click→hover→click DOM chain against Corner's own 16-row chained
  param_field stack (failed 4/4 clean runs, no retries — not a rare flake); the registry-level version passed
  3/3 clean runs. All 4 tests independently proven non-vacuous: fail 4/4 against the pre-change tree.

---

### 42. [✅ SHIPPED t2385/t2387/t2389 — `5cee38d7`] THE FORM-FIELD BLOCKS ARE A WALL OF BOXES — dynamic fields, human labels, an options editor, and on-block enablers

*(owner-requested 2026-08-28 from a screenshot of a twin's Parameter Group: "options just looks like coding,
or cryptic, we should have a better gui." Design settled with the owner the same day; one ruling still open.)*

**THE DEFECT UNDER THE UGLINESS — two sibling blocks, one got the fix.** The screenshot's blocks are
`param_field` (what every built-in twin materializes into its Parameter Group, t1111 — the highest-traffic
authoring surface). `paramField.js:27` declares a STATIC field list: all 12 fields render always, so a number
row still shows `options` and a dropdown row still shows `nmin/nmax/nstep/units` — **half the boxes are
impossible to fill meaningfully for that row's widget.** Its sibling `formfield` already solved this
(`dynamic: ['bindMode','widget']` + `fieldsFor`, formField.js:71-78); `param_field` was never given it.

### THE DESIGN — four pieces, all owner-approved

1. **`param_field` goes dynamic + human labels.** Same `ddcs_dynfields` treatment as formfield. ⚠ Establish
   with the file in hand: param_field's `widget: ''` means *derive from `type`* (t1562) — `fieldsFor` must
   resolve the EFFECTIVE widget, not the raw field. Labels: the block face prints raw storage keys
   (`bridge.js:251` — `dflt`, `nmin`, `nstep`); add a declared per-def label map (the `getDesc` shape) so the
   face reads `default · min · max · step` while storage keys never change.

2. **`options` gets a real editor — a popup list, not a DSL.** Today: `Front Left=nn, Front Center=cnp, …`
   parsed by `parseParamOptions` (userOps.js:154). The codebase ALREADY ships custom clickable fields
   (`field_cornergrid`, `field_regionpick`, `field_coordlist` — bridge.js:253-255); an option-list field is
   the same species. Face shows a compact summary (`choices [9 ▸ Front Left, …]`); click opens Label|Value
   rows with add/remove. ⭐ **STORAGE STAYS THE EXISTING STRING** — only the editor changes: zero migration,
   parser untouched, round-trip identical.

3. **Sentence-shaped condition.** `whenparam □ whenis □` renders as `show when [param] is [value]`. Same two
   fields, phrased as what they mean.

4. **⭐ BLOCK OPTIONS — one "Block ▸" line in the CONTEXT MENU opening a SUBMENU; NOTHING added to the block
   face.** Owner-ruled 2026-08-28, refined across three messages: ⛔ no new UI on the block itself (*"no more
   ui on blocks .. less please"*); ⭐ inside the right-click menu, ONE line with an arrow opens the
   block-specific submenu, **kept separate from the normal entries** (Edit/Duplicate/Delete):

   ```
   right-click →   ✎ Edit Surfacing          ← the existing entries, untouched
                   Duplicate / Delete / …
                   ────────────────
                   Block            ▸ │ ❄ Freeze value (#41)
                                      │ ⊘ Disable
                                      │ ──
                                      │ + help text
                                      │ + limits (min/max/step)
                                      │ + show-when condition
                                      │ + units
   ```

   Reachable as right-click on desktop, and on touch as a SINGLE LONG-PRESS held still — ⭐ **owner-verified
   on-device 2026-08-28** (*"hold longer works"*). ⛔ Owner-ruled: **do NOT support double-tap-and-hold** —
   long-press is THE touch gesture. If double-tap-hold currently also opens the menu, remove or ignore that
   route rather than keeping two gestures for one menu; if removing it is invasive in this Blockly build,
   report the cost instead of building it. (The editor's own `attachLongPress` at opContextMenu.js:69-74
   documents the platform thresholds: 500ms, 10px slop.)
   - Registration rides the `ContextMenuRegistry` precedent (blocksApp.js:966 — per-block scope, precondition
     `hidden` where inapplicable; the "Block" line itself hides when the submenu would be empty).
   - ⚠ **Establish with the build in hand whether this vendored Blockly's context menu supports a SUBMENU.**
     If it does not, the fallback is one "Block options…" entry opening the same list as a small popup at the
     cursor — same result, custom-rendered. Say which you shipped.
   - ⭐ **"Shown" = "non-empty" — NO new stored state.** An enabler sets the field and focuses it; a field
     cleared back to empty hides again on the next render. The declaration stays the only truth; the ratchets
     never see a difference. (Worker establishes focus-after-reveal in this Blockly build.)
   - ⚠ Field visibility now has TWO drivers — the effective widget AND emptiness. They compose as ONE function
     (applicable AND set), never two mechanisms fighting.

### ⛔ DELIBERATELY LEFT ALONE

- `gate` / `optionGate` raw JSON blobs — they reuse existing gate mechanisms; GATE CONSOLIDATION is its own
  project, and prettifying the blob now hardens a shape consolidation may change.
- `matchvar` / `atomType` free text — a RECORDED decision (formField.js header: typos are caught loudly at
  save by t1636's `formfieldMatchReport`). Do not re-litigate.

### ✅ RULED — owner, 2026-08-28: "A", then sharpened twice the same day

`section` becomes **combo dropdown-with-custom-entry**: the canonical IDENTITY/GEOMETRY/TOOL & CUT plus the
def's own existing names, still accepting anything typed. ⛔ Never closed — 12 shells legitimately dictate
their own section names (the t2381 invariant's own exception list); the invariant polices names, not this
widget.

⭐⭐ **THE GENERAL PRINCIPLE — owner: "wherever we need an exact variable name don't allow typing", control
shape: "a search with dropdown option or an actual dropdown."** An input whose value must MATCH an exact name
is a **picker** — a plain dropdown where the list is short, a SEARCHABLE dropdown (typing FILTERS the
candidates, never commits a free value) where it is long. Free text remains first-class only where any string
is valid (label, help, section, custom display-only units).

Applied to this block, exact-name inputs become pickers populated from what actually exists:

```
units       the MAGIC pair 'mm' / 'mm/min' (they key inch conversion, formWidgets.js:83-88)
            are dropdown entries; other units stay typed, display-only verbatim
whenparam   picker of the def's own SIBLING params
relToRow    picker of the op's declared sim-start rows
matchvar    picker of the assign vars ACTUALLY IN THIS STACK      ┐ ⭐ SUPERSEDES the
atomType    picker of the atom types actually in this stack       ┘ t1636 free-text decision
```

⚠ **The matchvar/atomType row supersedes a recorded decision** (formField.js's own header: deliberately not a
live dropdown, typos caught at save by `formfieldMatchReport`). Owner overruled 2026-08-28 — update that
header comment when building. ⛔ **`formfieldMatchReport` STAYS** as the save-time backstop: a picker prevents
typos but not DANGLING — a var picked correctly and then deleted from the stack still needs the loud check.

Feasibility notes for the worker: Blockly `FieldDropdown` accepts an options FUNCTION (per-instance live
lists from this block's own root stack); a searchable variant likely needs a custom field — established
precedent (`field_cornergrid`/`field_regionpick`/`field_coordlist`, bridge.js:253-255). Establish which the
build supports and say which you shipped.

### VERIFY

The mill-family twins' Parameter Groups, before/after screenshots. ⭐⭐ Register-time output UNCHANGED:
`bindingsFromStack`/`paramFieldsFromStack` must produce byte-identical specs for an untouched canvas — this
turn changes the AUTHORING SURFACE, never the declaration it produces. The t2381 registry invariant and all
seven form-reproduction ratchets stay green untouched.

⛔ **Ruled OUT of the Blocks-UI sweep (owner, 2026-08-28: "1-2 no"):** on-canvas zoom controls / zoom-to-fit,
and culling/renaming Blockly's native context-menu entries. The canvas keeps its bare chrome.

---

### 47. [⚠ TIER 1 SHIPPED t2395 — goto/ifgoto/probecheck/confirm target pickers + the `assign.var` pilot with the live per-dialect traffic light. ✅ TIER 2/3 SHIPPED t2453 — tool.n/toolsel.toolNum (REFERENCE, forward-authorable) + outpin.pin/waitinput.pin/probe.port (same) + flip.setup (CLOSED, must-match — established, not assumed, see t2453's own reasoning). STILL OPEN: the other 13+ var-name fields (item 2's remainder), `tooloffset.tool/value` (miscategorized into this tier by a dispatch, corrected — see t2453 WORK-LOG, needs its OWN decision, not a reflex reuse)] EXACT-NAME REFERENCES ON THE EMIT-SIDE BLOCKS ARE FREE TEXT — extend #42's picker principle to them

*(from the 2026-08-28 block-def sweep, all 136 defs audited with file:line. The principle is ALREADY
owner-ruled in #42 — "wherever we need an exact variable name don't allow typing"; this entry is its
extension to the cutting-side blocks. Weighted by usage: these are the hottest blocks in the registry.)*

⚠ **No cross-check exists anywhere**: `lint.js:63` only inspects fields whose DEFAULT is a number; every
field below defaults to a string, so typos are invisible until the machine runs them.

1. ⭐⭐ **Jump targets** — `goto.n` / `ifgoto.goto` / `probecheck.goto` / `confirm.cancel` / `hmiconfirm.cancel`
   name a `label` block's number as a typed free number (53+ uses of the flow trio). Candidate list = the
   label blocks in the same stack. `holecycle.js:9-16` documents this exact class silently skipping every
   hole after the first. → picker of the stack's own labels.
2. ⭐ **Macro-var names** — 15+ blocks (`assign.var`, `proberead.var`, `setworkoffset.value`,
   `tooloffset.tool/value`, `wcswrite.addrVar`, `radiuscomp.*`, `safehop/clearlift.saveVar/workClear`, …)
   type `#nnn` free. The registries EXIST (`data/varMap.js` RANGES/RESERVED, `universalScratch.opBands()`,
   per-dialect vars) and never reach the canvas. A typo emits a legal write to a register nobody owns.
3. ✅ SHIPPED t2453. **Tool / pin numbers** — `tool.n`, `toolsel.toolNum`, `probe.port`, `outpin.pin`, `waitinput.pin`: bare
   number sockets while the form side already has `tool_library_picker` / `declared_io_picker`
   (`specializedPickers.js:22,36`). Same data, two affordances, split by surface. Note: this list never named
   `tooloffset.tool` (that's item 2's own `#nnn` shape, above) — a later dispatch mis-sorted it into this tier;
   corrected back, see t2453 WORK-LOG.
4. ✅ SHIPPED t2453 — `flip.setup` → picker of the stack's `setup` indices (a typo today = the flip silently never applies). Built as the CLOSED (must-match) rung, not goto's forward-authorable one — established with the file in hand, reasoning in bridge.js's own `SETUP_TARGET_FIELDS` header comment.

### ✅ SCOPE RULED — owner, 2026-08-28: *"we don't need to verify everything, but a var block should at
least use the match search result gui, go to as well."*

⇒ **Build items 1 and 2 first**: the GOTO family gets a picker of the stack's own labels, and the VAR-NAME
fields get the searchable match-result picker — `assign` is the pilot (the #1 most-used block), and the other
var fields take the SAME field type only where it drops in trivially.

⭐ **SCOPE WIDENED — owner, later the same day, after the declare/reference + traffic-light design resolved
the forbids-new-content concern: "ok i'm willing to have verification."** Items 3 and 4 (tool/pin numbers →
the already-existing tool-library/declared-IO pickers; `flip.setup` → the stack's setup indices) are LICENSED
as the follow-up tier — build them AFTER 1-2 ship and prove the field type, reusing it verbatim. ⛔ The
traffic-light rule governs everywhere: verification INFORMS, it never hard-blocks.

### ⭐⭐ DECLARE vs REFERENCE — owner-surfaced 2026-08-28 ("wouldn't verifying forbid users from making new
content") and it reshapes the build. Three field kinds, three behaviours:

```
DECLARES   assign.var, label.n        typing stays FULLY OPEN — this field is where the
                                      thing is BORN. Picker = suggestions only (known
                                      ranges, scratch bands) + ⭐ one real warning:
                                      "this squats a reserved/persistent register"

           ⭐ OWNER-REFINED ("variables are still only available in a certain range"):
           open ≠ unbounded. The typed name is checked against the DIALECT's declared
           register map (varMap.js RANGES/RESERVED — a machine fact, per-dialect) and
           answers with a TRAFFIC LIGHT, never a gate:
             · user/scratch range        → clean, nothing shown
             · reserved / persistent     → visible warning naming whose register it is
             · outside the map entirely  → error-level flag (a write to nowhere)
           ⛔ NEVER a hard block — the app's own blocks deliberately write system
           registers (hmiline → #1505, alignment → #1510-#1512), so every "forbidden"
           write has a proven legitimate use. Warn, name it, let it through.
REFERENCES goto targets               picker of what exists + typed NEW numbers allowed
(forward-authorable)                  (people place the jump before the label) — the
                                      save-time check nets the ones never made
REFERENCES formfield.matchvar etc.    closed picker (a reference to a thing that does
(must exist now)                      not exist is ALWAYS a mistake) — #42 unchanged
```

⛔ A closed picker on a DECLARATION site forbids new content — never do it. The gate lives only where
"doesn't exist" is proof of error.

⚠ Depends on t2385's searchable-picker mechanism — sequence AFTER it and REUSE what it built. Save-time loud
checks stay (dangling still needs catching).

---

### 48. [✅ SHIPPED — items 1-4 t2393 (4 commits); item 5 t2399 (progend/drillcycle) + t2401 (contourfill helix + tap.rigid→dwell) + t2403 (slot/surfaceraster/pocketfill/surfacefill entry-fields + region/pocketfill shape)] THE BLOCK FACE LIES — dead dynamic config, magic scope names, dropdowns that eat values

*(same sweep. These are places the canvas shows something false or silently destroys a value.)*

1. ⭐⭐ **`holecycle` (the #3 most-used block) declares `dynamic: 'pattern'` — and it is DEAD.** No `fieldsFor`,
   and `bridge.js:396` bails without one, so all 28 fields render always (grid+circle+rect+line at once).
   The exact `param_field` defect of #42, hotter block. `param.js:19-20` also still carries #42's options-DSL
   + always-visible pair. ⚠ Reuse t2385's inline-field-hiding mechanism; `bridge.js:408` can only hide VALUE
   SOCKETS by itself (`camField.js:32` says so).
2. ⭐⭐ **Silent value destruction — the t1520 iron rule, still violated in three dropdowns:** `layout.kind`
   offers 2 of `LAYOUT_TYPES`' 14 (`bridge.js:204` vs `panelTypes.js:51-66`) and `panel` misses `commscreen`
   — a value outside the list is REWRITTEN to option[0] on canvas round-trip: a wizard silently loses its 2D
   layout. `flip.axis` offers Z/A/B/C it cannot mean. **This item is data-loss class; do it first.**
3. ⭐ **The magic scope names `'z'`/`'by'`** on 8 fill/contour blocks (`stepover.js:84`, `fill.js:36,44`,
   `pocketfill.js:120-129`, `contourfill.js:40-41`, `surfaceFill.js:11-12`, `fillText.js:28`, `contour.js:185`):
   must exactly match what Step Down publishes into scope (`blockEmitter.js:396`); mistype `Z` →
   `evalExpr` throws → `num(p.z, 0)` → **the fill cuts at the stock top**. Decide the fix-shape with the file
   in hand (picker of scope names, or stop requiring the name at all) — do not just document it.
4. **Declared-but-undefaulted fields render as unguarded text**: `radiuscomp.rawAxis` (an axis letter,
   `radiuscomp.js:17` vs `:22`) and `clearlift.planeFellBack` (a BOOLEAN — typing "false" is truthy,
   `saferetract.js:101-102`,`:122`). Also `waitinput.var` is rendered and read by nothing (`cnc.js:98,103-115`).
5. ✅ CLOSED. The mode-gated families (`slot`/`surfaceraster`/`pocketfill`/`surfacefill` entry → ramp/helix
   fields; `region`/`pocketfill` shape → dia/sides vs w/h) — same dynamic treatment. ✅ `contourfill`'s own `helix`
   offer (its emit silently coerced it to plunge, `contourfill.js:52`) SHIPPED t2401 — `selects: {entry:
   ['plunge','ramp']}` on `contourFillBlock` (the established t1520 per-atom override), not a shared-domain
   edit. ✅ `tap.rigid` → `dwell` SHIPPED t2401 — a compound `gate` (rigid ticked AND `_rigidOk`, mirroring
   `tap.js`'s own `rigidOk` predicate) greys it, since the rigid G84 cycle never reads it. ✅ `progend`
   retract/park and `drillcycle.cycle` → q/dwell SHIPPED t2399 (`program.js`/`cnc.js`, `dynamic`+`fieldsFor`+
   `allFields`) — live-caught a second bug landing them: `fieldsFor` is fed RAW `getFieldValue()` results by
   bridge.js's `apply()`, and a Blockly checkbox reads back uppercase `'TRUE'`/`'FALSE'` — reusing the file's
   own `truthy()` (which only rejects lowercase `'false'`) silently passed `'FALSE'` as truthy, so `park`'s OFF
   state still showed retractZ / hid parkX-Y. Fixed with a dedicated raw-field check, not `truthy()`.
   ✅ SHIPPED t2403 — the last four families: `slotBlock`/`surfaceRasterBlock`/`pocketFillBlock`/
   `surfaceFillBlock` each gained the entry→rampAngle/helixDia/helixPitch gate (slot.js's own comment at
   :71-75 is the reference semantics, matching t2393/t2399's `dynamic`+`fieldsFor`+`allFields` shape exactly);
   `pocketFillBlock`/`pocketWallBlock`/`regionBlock` each gained the shape→dia+sides (circle/polygon) vs w+h
   (rect/ellipse) gate. `regionBlock`'s own `w` field genuinely means DIAMETER for circle/polygon but WIDTH
   for rect/ellipse (region.js:12-19) — a per-shape-reactive LABEL would need new machinery (`jsonDef()`'s
   `labels` map is static, not reactive to the live `shape` field); noted in a comment rather than built, per
   the dispatch's own instruction. Live-verified across 13 scenarios spanning all 5 files (slot/surfaceraster/
   pocketfill/pocketwall/surfacefill/region); 295 existing tests across every touched file rerun green.

---

### 49. [✅ SHIPPED t2431 + t2433 — top-20 blocks/~25 field descriptions drafted, all 3 flags closed (2 answered, 1 a real fieldHelp override fix), 2 more same-class collisions found + fixed by the sweep] HELP AND HUMAN LABELS ARE ABSENT FROM EVERYTHING THAT CUTS METAL

*(same sweep. ~10 of 136 defs carry a `help` string — every one is authoring metadata, not a cutting op.)*

- **Every top-15 block has NO tooltip**: `assign`, `move`, `probe`, `label/goto/ifgoto`, `progstart/progend`,
  `holecycle`, `proberead`, `setworkoffset`, `spindle`, `dwell`… (`bridge.js:269` falls back to
  "<label> (<category>)"). The declared help slot exists (1c) — this is a CONTENT pass, no machinery.
- **Faces print raw JS keys** (`bridge.js:251`): a machinist reads `lhs [#1920] op [!=] rhs`, `spinUp`,
  `stepoverPct`, `dur cyc`, `confirmEvery`. t2385's label-map slot generalizes — fill it for the top ~20.
- `bridge.js:164`'s tooltip fallback is literally "The stepoverPct parameter" — cover the ~25 uncovered
  high-traffic names in the `DESCRIPTIONS` map (`bridge.js:97-163`).
- ⚠ Write help text from the MACHINIST's side ("Skips to line N when the probe misses"), never restate the
  field name. One pass, one commit, screenshots of a few hover states.

### ✅ t2431 — WORKER'S DRAFT, all 23 hot-path blocks (the dispatch's own weighted list) + ~25 field descriptions

`def.help` (block-level tooltip) + `def.labels` (t2385's own per-def face-label map) written for `assign`,
`move`, `holecycle`, `label`/`goto`/`ifgoto`, `progstart`/`progend`, `probe`/`proberead`/`probecheck`/
`readmachine`/`setworkoffset`, `spindle`, `feed`, `dwell`, `coolant`, `tool`, `wcs`, `distmode`, `stepdown`,
`stepover`, `raw`, `mcode`. `bridge.js`'s shared `DESCRIPTIONS` map gained the ~25 field names those blocks
exposed that weren't yet covered (its own generic fallback — "The X parameter" — was the live symptom named
above).

⭐ **THREE FLAGGED per the owner's own instruction — a short honest list, not uniform false confidence:**
1. `holecycle`'s `x`/`y` vs `x0`/`y0` — read as a placement shift vs the pattern's own centre from the code
   (`originX = x + x0`), never confirmed against a live authoring session.
2. `probe`'s `level` — meaning guessed from the field name/default (probe trigger polarity), never confirmed
   against the dialect's own `probeMove` or a real macro.
3. `probecheck`'s `dir` collides with the SHARED `DESCRIPTIONS.dir` (spindle CW/CCW) — the face is relabelled
   "probe direction" but the TOOLTIP still borrows the wrong wording; a per-def label can't override a shared
   tooltip, and fixing that is a mechanism change, out of this turn's own "pure content" scope.

**Verified byte-identical, live**: `help`/`labels` are two new keys no `emit`/`fields`/`defaults`/`fieldsFor`
path reads — confirmed by inspecting every touched file's own emit function, then live-calling several blocks'
`emit()` directly before/after and diffing the G-code (identical). Full suite reported in WORK-LOG (t2431).

### ✅ t2433 — all three flags closed

1. **`probe`'s `level`** ANSWERED — the probe input's trigger polarity (0 = normally-open, contact closes the
   circuit, the common case; 1 = normally-closed), confirmed 3 independent ways (the ddcs-expert skill's own
   variable table, the vendor's own config text, the owner's own FINDINGS.md differential-toggle record).
   Tooltip written with NO register number, per the owner's own caution (settings and macro vars share digits
   on this controller).
2. **`holecycle`'s `x`/`y`/`z0` vs `x0`/`y0`** ANSWERED by checking the WIZARD's own bindings
   (`drillData.js`): `x0`/`y0` are the wizard-visible "Pattern origin X/Y"; `x`/`y`/`z0` are NEVER a wizard
   field — computed from a separate `originX`/`originY`/`offZ` binding via `absorbsPlacement`, canvas-only.
   Relabelled to say so plainly.
3. **`probecheck`'s `dir` colliding with the shared spindle tooltip** — a real code fix: `bridge.js`'s
   `getDesc` now checks a new per-def `def.fieldHelp` map before the shared `DESCRIPTIONS` fallback (mirrors
   `def.labels`'s own per-def-beats-shared shape, kept separate since one holds face words and the other full
   sentences). Storage keys and the shared map itself untouched — `spindle`'s own `dir` still reads it.
   **Swept for more of the same, found 2**: `radiuscomp`'s own `dir` (compensation sign, same fix) and
   `holecycle`'s own `cycle` (its shared tooltip named two options — Drill/Dwell — the block doesn't offer).

Verified live both ways: the ACTUAL rendered tooltip read back through Blockly's own field API on a real
canvas (not just the source object), plus emit re-checked byte-identical for every touched def. Full suite
reported in WORK-LOG (t2433).

⭐ **NEXT: the owner's own review pass** (the authoring model this entry itself rules) — correct whatever
reads wrong for a machinist. BACKLOG #41's own collapsed-block visual polish (a separate, smaller open item —
no materially different approach found this turn from the one already tried and reverted) is still open too.

---

### 46. [✅ SHIPPED t2409 (the redraw half) + t2429 (commit-on-release, size/distance handles) + ✅ t2447 (move-kind handles finished, root cause confirmed by measurement — TWO bugs found: featureCanvas.js's own auto-refit firing on a deferred commit's one render, and onDragEnd's own multi-field scan-then-write ordering bug)] THE WIZARD-VIEW CANVAS DRAG IS HALF-WIRED — value moves, GUI doesn't. RULED: complete the loop

> ## THE CAPTURE — the evidence three turns of harness testing could not produce
>
> Owner's overlay, one real drag, `hid:pk_size` on `svg:feature-canvas` (22 frames, abridged):
>
> ```
> f0    ptr:2059,516   handle:2060,512   writes:0    redraws:0
> f8    ptr:2065,509   handle:2060,512   writes:5    redraws:0
> f14   ptr:2083,491   handle:2060,512   writes:17   redraws:0
> f21   ptr:2090,485   handle:2060,512   writes:27   redraws:0
> ▲ up  ptr:2090,485   handle:2060,512   writes:27   redraws:0
> ```
>
> ⭐ **Three facts, each decisive:**
> 1. **The handle's rendered position NEVER changes** — `2060,512` for all 22 frames, through 31px of pointer
>    travel and past pointer-up. The freeze is real and total; not the "one-frame lag-then-catch-up" t2405
>    reproduced locally.
> 2. **The write path is HEALTHY** — 27 writes, ~2/frame, tracking the pointer. Nothing is broken there.
> 3. ⛔ **`redraws:0`. Not once, in any frame.** The redraw the probe watches is never called. `viewBox`
>    is also unchanged, so this is not a viewport/transform artifact.
>
> ⇒ **The loop is severed on exactly one side.** This is the owner's original report — *"the block value
> moves but not the gui"* — now OBSERVED rather than inferred, on the deployed build, with numbers.
>
> ### THE FIX TURN'S OWN LEADS
> - ⚠ **First establish what the probe counts as a "redraw"** — `redraws:0` may mean *the specific function
>   featProbe hooks* never fires, while some other render path runs. The frozen `handle:` numbers prove the
>   VISUAL never updates either way, so the bug is real — but the fix depends on which function should have
>   been called.
> - ⭐⭐ **THE CONTROL IS CONFIRMED WORKING — owner, 2026-08-29: "yes the handle works on the wizard in
>   editor."** The SAME handle on the SAME feature canvas updates live in the WIZARD's own view and is frozen
>   in the BLOCKS tab's Wizard View pane. ⇒ ⛔ **This is not a canvas bug, a handle bug, or a browser bug —
>   it is a WIRING difference between two hosts of the same component.** Diff the two mounts: what does the
>   wizard host pass/subscribe that the Blocks pane does not (the redraw callback, an onChange, a render
>   subscription, a manager instance). ⭐ `blocksApp.js`'s `blkMgr()` is the prime suspect by construction —
>   it is a STUB manager whose `update()` is deliberately a no-op with the comment "blocksApp already
>   re-renders the pane reactively on canvas change"; the capture says that reactive re-render does not
>   happen for a drag. Start there.
> - ⚠ **t2405 reproduced neither symptom locally** (it saw lag-and-catch-up, i.e. redraws DID fire) —
>   so something differs between the harness/localhost and the deployed build. That difference is a second
>   finding worth naming even after the fix.
> - ⚠ `hid:pk_size` suggests a POCKET-family handle, though the owner's screenshot showed surfacing —
>   confirm which twin/handle before assuming scope; the fix may be per-handle-kind, not global.
> - ⛔ **#50 (undo-blind rapid writes) still sequences BEFORE the commit-on-release half** of the ruled
>   design — but note the capture shows ~2 writes PER FRAME today, which is exactly the mid-drag churn
>   commit-on-release exists to stop.

> ⭐ **The reproduction gap IS the lead.** t2391 drag-tested with the harness's pointer and saw the canvas
> follow; the owner's real gesture does not. ⭐ **TOUCH ELIMINATED 2026-08-29 — owner: "drag on desktop."**
> The failing drag is a MOUSE on the PC — and ⭐ **"phone is same" (owner, same session)**: BOTH the owner's
> devices fail while the harness passes. The common factor is therefore not the device or the input kind but
> **what both devices share and the harness lacks: the owner's own WORKSPACE DATA and returning-user state.**
> The harness boots a DEFAULT machine config ([[agent-tests-use-default-config-not-users]]) — a real
> workspace's stock/feature/machine values reaching both devices was the standing suspect — ⭐ **ELIMINATED
> 2026-08-29: "incognito doesn't work either."** Fresh state, fresh storage, owner's browser: STILL fails.
> ⇒ State, data, device and input kind are ALL eliminated. What remains, in order of suspicion:
> (1) **THE REFERENT — ELIMINATED by owner screenshot 2026-08-29**: it IS the Blocks tab's Wizard View pane,
> the SURFACING twin, its 2D canvas — specifically the **`pos` square and the W×H corner handle** (both
> circled). The exact surface and twin t2391 reports driving. ⇒ Every axis is now eliminated EXCEPT:
> (2) ⭐⭐ **what t2391's "the canvas follows" actually ASSERTED** — re-examine the method: a redraw-counter
> or value assertion would pass while the HANDLE'S RENDERED POSITION stays frozen; the probe must measure the
> handle's on-screen position, not whether a redraw ran ([[assert-the-value-not-the-change]]);
> (3) **real browser vs harness Chromium** ([[ddcs-studio-playwright-verify]]'s own gotcha) and the deployed
> build vs localhost:3211. ⇒ The probe turn ships an owner-runnable overlay (`?debug=feat`, the dragProbe
> pattern: passive listeners, on-screen rows — pointerdown/move coords · writeback calls · redraw calls · the
> handle's getBoundingClientRect per frame) so the owner's ten-second drag on the DEPLOYED site produces the
> numbers no harness can. ⇒ Next turn is an INSTRUMENTED investigation, not a fix: a read-only probe on the
> feature canvas (the `?debug=drag` dragProbe pattern that cracked the splitter saga — passive listeners,
> on-screen rows, the owner reproduces in ten seconds and screenshots the overlay). ⛔ #50 (undo-blind rapid
> writes) still sequences BEFORE the commit-on-release fix, per its own entry.

> ⭐ **t2405 (THE PROBE TURN, no fix attempted) — t2391's own method, stated plainly:** it measured whether
> `FeatureCanvas.render()` FIRED and whether a handle's `cx`/`cy` ATTRIBUTE advanced — both "did a change
> happen" signals, not "where is the handle actually painted" ([[assert-the-value-not-the-change]]). Shipped
> the deliverable: `?debug=feat` (`web/debug/featProbe.js`, `dragProbe.js`'s own pattern verbatim — passive,
> capture-phase, zero weight unless flagged, a Copy-rows button) measures the handle's own
> `getBoundingClientRect()` every frame beside pointer position, writes observed, redraws observed, and the
> SVG's own `viewBox` — the one number nobody had measured. Live-verified: zero weight without the flag
> (`featProbe.js` never even loads), and a real drag correctly captured, screenshot in `verification/`.
>
> **Reproduced myself, twice, WITH the probe on** — Playwright's own Chromium (a paced synthetic drag) AND a
> separately-launched, REAL headed Google Chrome (`channel:'chrome'`, an irregular faster drag), both against
> localhost. **NEITHER shows a hard freeze.** Both show the SAME measurable pattern instead: the handle's
> rendered position consistently lags the pointer by roughly one animation frame, then catches up, every
> step, for the whole drag — a real, small round-trip latency (`onDrag`→write→dispatch→`update()`→
> `render()`), not the reported freeze. ⚠ The DEPLOYED site could not be compared this turn — `?debug=feat`
> isn't live there yet (this branch, unshipped at investigation time); a same-build deployed-vs-localhost
> check is a future turn's job once this merges.
>
> ⇒ **I could not reproduce the reported freeze even in a real, non-harness Chrome.** Per the dispatch's own
> fallback: the owner's own ten-second probe capture on their real device (desktop mouse, the surfacing pos/
> W×H handles, per their own screenshot) is now the necessary next evidence — screenshot the overlay (or copy
> its rows) and reopen with that attached. ⛔ NO FIX ATTEMPTED — the root was not observed (the dispatch's own
> rule: fix only if the root is OBSERVED and the fix is a plain redraw repair; a one-frame lag pattern,
> present in every environment I could test, does not meet that bar and is not the reported symptom).

> **t2391 (no code changed):** extensive live drag testing (surfacing + corner, both routes, paced + rapid)
> could NOT reproduce the dead-GUI symptom — the canvas followed. The worker tried the ruled fix anyway, saw
> it possibly break canvas live-redraw in one run, and REVERTED rather than ship unverified. ⚠ **Not-reproduced
> is NOT not-real**: the t2345-t2357 drag saga failed to reproduce for five turns because the bug lived in
> RETURNING-USER state the harness never has — and t2385-t2389 reworked this exact render path since the
> report, so the symptom may also have been fixed incidentally. ⇒ **Next action is the OWNER's ten-second
> check on the current build**, not more harness testing. If it still happens: reopen with the device, the
> wizard, and whether the session was fresh or returning. If it does not: close as incidentally-fixed-by-#42.
> ⭐ A real adjacent finding came out of the attempt — see #50.

> ⭐⭐ **t2409 (THE FIX TURN) — root traced end to end, not guessed.** `blkMgr()`'s stubbed `update(){}` WAS the
> prime suspect, but the header comment justifying the stub ("blocksApp already re-renders the pane reactively
> on canvas change") is HALF true, which is why it looked safe: `reproject()` (fired by `ws.addChangeListener`
> on a real field-write event, `!e.isUiEvent`) DOES call `renderViewsPrompt()`→`renderLiveForm()`→
> `blkView.view.update(blkMgr())` on every canvas-drag write — that path is real, and does redraw. But it rides
> **Blockly's own async event queue** (events fire on a deferred macrotask, not synchronously in the drag
> handler) — that's t2405's own "one-frame lag-then-catch-up," now explained rather than just observed: it was
> the ONLY working redraw path, always a beat late. The severed half is a SEPARATE, SYNCHRONOUS path:
> userOpView.js's own delegated field-write listener (wired once per `createUserOpView` instance, "any widget
> input/change... re-runs update()") calls **`_mgr.update()`** directly, in the same tick as the drag's own
> `pointermove` → write → dispatched `input` event — the exact mechanism the sim-start marker's own `onDrag`
> already leans on (`userOpView.js:800`, a sibling handle kind) to repaint mid-drag. On the WIZARD's own host
> (`createUserOpView(null)`, the real `wizardManager`) `_mgr.update()` resolves straight back to
> `view.update(this)` (`wizardManager.js:458-461`) — a real redraw, every frame, which is why the control
> worked. On the Blocks pane, `_mgr` is `blkMgr()`, and `update(){}` was a no-op — so the ONE synchronous,
> frame-exact redraw path was always dead, and the deployed build's `redraws:0` (no lag, no catch-up, nothing —
> not even past pointer-up) makes sense once the async path is understood as separate: under a real fast mouse
> drag generating many more events/sec than a paced harness drag, Blockly's own event queue very plausibly
> coalesces/never catches up inside the probe's own recording window, while a synthetic or slower real-Chrome
> drag (t2405's own local repro) gives it enough gaps to fire — **that is the second finding the dispatch asked
> for named**: localhost vs deployed didn't differ in KIND, only in event RATE, against a redraw path that was
> already down to its one fragile (async, queued) leg with the synchronous leg dead.
>
> **hid:pk_size confirmed as pocket's own size handle** (`pocketData.js`), but the fix is host-level
> (`blkMgr()` is shared by every twin shown in the pane) — this was never a per-handle-kind bug, resolving the
> earlier "confirm scope" caveat: every twin's Wizard-View-pane drag was equally broken, surfacing (the
> owner's screenshot) and pocket (the owner's `?debug=feat` capture) alike.
>
> **THE FIX** (`web/blocks/blocksApp.js`, `blkMgr()`): `update()` now calls `blkView.view.update(blkMgr())` —
> the pane's OWN redraw, self-contained — instead of staying a no-op. Deliberately NOT routed through the real
> `wizardManager`'s own `update()` (which resolves `activeView()` and would redraw whichever wizard THAT
> considers open — a different, wrong target for the pane), per the dispatch's own steer. One line changed.
>
> **VERIFIED with the probe itself** — a real placed `user_pocket_data` op (`_framed`+`makeOp`, the same shape
> a genuine insert produces), dragging `pk_size` in the Blocks pane. Before the fix (stashed and re-run to
> prove it, not assumed): the handle froze at `1295,458` for all 50 frames while `writes` climbed to 32 and
> `redraws` stayed 0 throughout — byte-for-byte the owner's own capture shape, reproduced locally for the first
> time this arc. After the fix: `handle:` tracks `ptr:` every frame (`1295,458` → `1327,474`), `writes` and
> `redraws` both climb together (`writes:32 redraws:16` at pointer-up). Regression-checked: the shell's own
> `openWiz('pocket')` canvas drag (`pocket-canvas.spec.js`, unrelated code path, untouched) still passes; the
> Blocks pane's own "Open as modal" door (`openLiveAsModal`, the REAL wizardManager, also untouched) still
> redraws correctly mid-drag. Both new checks are committed as `tests/blocks-pane-redraw-2409.spec.js` and
> `tests/blocks-pane-modal-regression-2409.spec.js`.
>
> ⛔ **SCOPE HELD**: the commit-on-release write redesign stayed out, per the dispatch's own rule — #50 still
> sequences first. The probe's own ~2-writes-per-frame count (confirmed again in this turn's own local capture)
> is exactly the churn #50's redesign exists to stop; this turn only fixed the redraw severance, not the write
> cadence.
>
> ⚠ Rule 1b, full suite: 2934 passed / 1 failed / 15 flaky / 26 skipped (2976 total). The 1 failure
> (`open-as-modal-1625.spec.js`, "A REAL OPEN AFTER A PREVIEW…") does NOT reproduce in isolation (3/3 clean,
> single worker) and does NOT reproduce under a targeted contention re-run either — a SECOND contention batch
> (the same `blocks-*`/`open-as-modal*` files at 6 workers) shows that exact test passing while a wholly
> unrelated file (`blocks-mmb-pan.spec.js`, middle-mouse canvas panning — no shared code path with `blkMgr()`
> at all) fails instead, matching this suite's own already-documented behavior (playwright.config.js's own
> comment: "the contention-starved population shifts run to run"). Classified as pre-existing contention noise,
> not a regression — named here rather than hidden, per the rule that an argued-away red still needs the
> reasoning on record.

> ⚠ **t2429 (THE COMMIT-ON-RELEASE HALF) — PARTIALLY SHIPPED, scoped down twice, both times named live rather
> than shipped broken.** #50's own fix (t2427) closed the blocker this half was waiting on; built the ruled
> mechanism itself this turn: `panelTypes.js`'s `_writeParam` gained an `opts.preview` mode (tagged via
> `CustomEvent` `detail.previewOnly`) that still paints the DOM field + redraws the canvas every drag frame
> (the redraw was ALREADY reading live DOM via `userOpView.js`'s own `_readers`, never the model — confirmed
> BEFORE touching anything, per the dispatch's own instruction, so no restructuring of the redraw path t2409
> just fixed was needed) but skips the actual model write until a NEW `onDragEnd` (wired into all 3
> `layoutSpecFromOp` spec-return points) fires ONE plain commit on release, reading whichever fields still
> disagree with a `data-ddcs-committed` baseline captured on each field's own first preview touch.
>
> **TWO EXCLUSIONS found live, kept rather than chased further** (the dispatch's own instruction: stop and
> report rather than restructure "five turns of hard-won" machinery blind):
> 1. **Corner's own `repoGroups`/`spotStore` reposition-chain** (t120-t122) — its own "freeze the OTHER
>    markers, re-derive this one's increment against it" compensation assumes every frame's write reaches the
>    model synchronously; deferred, the frozen marker's own screen position visibly drifted mid-drag. Excluded
>    via a `commitNow` flag threaded from `spotOnDrag`'s own `dragged` check — these handles commit every
>    frame, unchanged, same as before this turn.
> 2. **Every 'move'-kind handle** (`point`/`diagAim`/`translate` gesture types — the ONE kind FeatureCanvas
>    runs `_snapToAnchor` against every frame) — committed the CORRECT final field values on release (verified
>    directly against the DOM) yet the canvas rendered well short of the actual drag distance, for drags of
>    every size tried (not an extreme-drag edge case). Root not confirmed within this turn's own budget.
>    Commit-on-release now applies to non-move gestures only (length/scaleX/shear/rect/radial/projLength/
>    crossAim/probeVector) — VERIFIED working, including `pk_size`, one of the dispatch's own two named
>    handles. Move-kind handles (including `pk_pos` AND **surfacing's own `sf_pos` — the bug's own original
>    screenshot subject**) keep committing every frame, unchanged from before this turn; #50's own fix still
>    coalesces a burst into one undo entry for them either way, so they are not worse off, just not yet on
>    commit-on-release.
>
> **Verified live**: the `?debug=feat` probe (pocket's `pk_size`) shows the model frozen through every
> mid-drag frame then changing to exactly one new value at/after release, handle tracking the pointer
> throughout; exactly one undo entry results from a whole drag and correctly restores the pre-drag value; the
> wizard MODAL's own per-type views (`surfacingView.js`, structurally isolated — its own `setFields` never
> reads the new `opts` argument) are untouched; a move-kind handle (`pk_pos`) still tracks its own drag
> correctly (committing every frame, as before). Full suite: reported in WORK-LOG (t2429).
>
> **⭐ Next step, named plainly for whoever picks this up**: the move-kind root is still open. The symptom
> (correct final value, wrong final screen position) smells like a viewport/fit state that updates per-frame
> during a live drag today and never gets the intermediate frames it needs from a single deferred commit —
> but that is a hypothesis, not a confirmed root; confirm it before attempting a fix, per this whole arc's own
> standing discipline against guessing on delicate, hard-won canvas machinery.
>
> **✅ t2447 — RESOLVED, root confirmed by measurement, not the hypothesis above.** `?debug=feat` on a real
> temporarily-deferred move drag showed the handle tracking the pointer PERFECTLY through every mid-drag frame
> (not a gradual undershoot as the hypothesis above suspected), then snapping backward on the exact render
> right after release. **Root 1**: `featureCanvas.js`'s own `render()` has a pre-existing, legitimate
> auto-refit-when-idle (`!_userAdjusted && !active`). For every-frame-commit (working), `onDragEnd`'s flush
> finds nothing left to write at release, so no extra render happens, so that condition never fires — `_tf`
> stays byte-identical. For a deferred drag, `onDragEnd`'s flush is the FIRST change the model ever sees, and
> it lands exactly when `active` has just gone null — firing the refit against a geometry that jumped in one
> step, landing the transform somewhere the frozen mid-drag one never anticipated. Not `_snapToAnchor`. Fixed
> via `_suppressFitOnCommit`, set only around `end()`'s own synchronous `onDragEnd()` call. **Root 2**, found
> chasing a smaller residual AFTER root 1 shipped, on the Blocks-canvas surface specifically (the wizard-modal
> surface had zero residual): `onDragEnd`'s own multi-field loop scanned-and-wrote interleaved — a first
> field's own write can trigger a synchronous rebuild (confirmed: the Blocks-canvas host rebuilds its form's
> DOM wholesale on a model write, unlike the wizard modal) that orphans a LATER field's own value-read within
> the SAME loop, silently reverting it to its pre-drag value. Fixed by splitting scan from write. Both
> move-kind handles (`pk_pos` AND `sf_pos`, the bug's own original screenshot subject) are now on
> commit-on-release. Verified: 198 tests across the full canvas/drag blast radius, 0 failed, 0 flaky. Full
> story: WORK-LOG t2447.

---

### 50. [✅ SHIPPED t2427 — the "RAPID" framing was itself an artifact; a SINGLE typed edit was equally undo-blind, confirmed by instrumenting saveStates.js directly] RAPID INPUT-ONLY WRITES ARE INVISIBLE TO UNDO

*(found t2391 while chasing #46, isolated with a clean control: a TYPED edit undoes fine; 8 rapid input-only
writes to a field leave undo blind — 6 undo presses, zero effect. Worker-found, repro in hand, no code
changed.)*

Any burst of programmatic/rapid `input` events on a field — canvas or not — never becomes an undo state.
This is the t2287 territory (gesture batching, the `__ungrouped__` sentinel, `GESTURE_QUIET_MS`) — the same
recording path that turn already patched once for direct field writes.

⚠ **Why it matters beyond tidiness:** #46's ruled commit-on-release design lands its write as exactly this
kind of programmatic write — if built while this gap exists, the drag's one-write-one-undo contract would be
silently unkeepable. **Sequence this BEFORE #46's fix, if #46 reopens.**

⭐ Worker's own suggested next step, recorded verbatim: instrument `saveStates.js` directly against the
rapid-input repro — smaller and faster than drag testing.

**STILL REAL IF:** fire 8 rapid `input` events with value changes at any form field, press undo — if the
values survive undo, still real.

### ✅ SHIPPED t2427 — instrumented saveStates.js directly (this entry's own suggestion), followed it, and it overturned the entry's own "RAPID" framing

⭐ **Not a rapid-specific hole.** Subscribing directly to `saveStates.js`'s own exported `onChange()` and firing
the exact repro live showed **ZERO new undo entries for a SINGLE typed edit too** — not just a burst. The
"typed edit undoes fine" control in this entry's own original finding was a testing artifact: Undo happened to
land on an EARLIER checkpoint that coincidentally already held the expected value, not evidence the edit itself
was ever recorded. Confirmed by direct instrumentation, not re-derived from the inherited framing.

**ROOT:** a placed op's VALUE-binding field write (`onFieldWrite`'s light `.data`-patch branch, blocksApp.js —
t2413's own precedent, since a placed op has no live Blockly field to `setFieldValue` on) mutates `.data`
directly and calls `reproject()` explicitly. A direct `.data` mutation fires NO Blockly event at all, so
`ws.addChangeListener`'s gesture-boundary listener (the ONE thing that calls `snapshotGesture`) never sees it —
and `reproject()`'s own `setStack(...,'blockly')` call is ALSO excluded from `programModel`'s own recording
path (saveStates.js's origin filter deliberately skips 'blockly', on the assumption every 'blockly'-origin
change already reached a real Blockly event on the listener above — true for a canvas-native edit, false here).
Net: this write path never created an undo checkpoint, one write or many.

**THE FIX** — NOT a lower `GESTURE_QUIET_MS`, NOT recording every event (undo spam is its own defect, per this
entry's own instruction): the placed-op light-patch branch now feeds the SAME `__ungrouped__` gesture bucket a
bare `block.setFieldValue()` call (no Blockly Gesture open) already uses, via a small shared
`noteGestureEvent(grp, isReal)` helper both paths now call — so a burst of rapid `.data` patches gets the
identical debounce-batched recording everything else gets. Verified live: a single edit → exactly 1 undo entry
(was 0); 8 rapid writes → exactly 1 (was 0); a ~27-write drag-rate burst (matching #46's own captured count) →
exactly 1, not dozens. Regression-checked: the authored-canvas's real Blockly field edit (`writeAuthoredValue`)
is untouched, same entry count before and after.

⭐ **#46's commit-on-release is now safely buildable** — the specific blocker cited when #46 deferred it ("the
drag's one-write-one-undo contract would be silently unkeepable") is closed: a rapid burst now coalesces to
exactly one undo state regardless of write cadence. #46's own remaining "mid-drag value churn" concern (many
intermediate `.data` states landing during a drag, not an undo-recording problem) is a separate, still-open
design question this fix doesn't resolve on its own.

Tests: `tests/undo-blind-writes-2427.spec.js` — 4 tests, all 3 fix-dependent ones confirmed failing (0 entries)
against the pre-fix code before the fix was trusted.

*(owner-reported live 2026-08-28: **"in wiz preview moving the feature gui move the block value but not the
gui"** — the Blocks tab's Wizard View pane. Ruled the same day: **"complete the loop."**)*

**The half-state is the bug.** Dragging a feature handle on the pane's 2D canvas silently writes the block's
value while the canvas never follows the finger — silent mutation with dead feedback, the worst half of each.

⚠ **Root is INFERRED, not observed — observe before fixing:** the form↔block writeback deliberately mutes
re-renders while a write is in flight (the t2287 echo machinery, so typing doesn't clobber itself); a canvas
drag riding that same writeback would land the value and lose the repaint. Confirm that is the mechanism.

### ✅ THE RULING — complete the loop, commit on release

```
during the drag    the GUI follows the finger — live, canvas-only, NOTHING written
on release         ONE write lands in the block  →  one undo step
```

- The pane is ALREADY a writing surface — the form beside the canvas writes back by design. One pane, one rule.
- Same gesture means the same thing in every tab: in the wizard itself a handle drag writes the value.
- Commit-on-release is the house drag pattern (the pane-splitter saga's authoritative `onUp` write): no
  mid-drag value churn, no undo spam, no echo fighting the finger.
- ⛔ Full-inert was considered and REJECTED — it fixes the silence by killing the best input surface in the
  one tab where authors live. And ⛔ never ship the current half-state anywhere else: a control either works
  or is visibly inert.

### VERIFY (the real gesture)

In Blocks → Wizard View on a twin with a 2D canvas (drill/surfacing): drag a handle — the canvas follows
live; release — the block field updates ONCE; one undo restores both; no mid-drag jitter. ⚠ The wizard
modal's own canvas behaviour is UNTOUCHED — regression-check it.

---

### 43. [✅ SHIPPED t2397 — both directions, verified on corner (flat) + drill (tree). "Show in form" scoped to param_field/formfield: a multi-field atom has no single param to point at, a named asymmetry not a gap] FORM ↔ BLOCK REVEAL — tap a form row, see its block; a block's "Show in form"

*(owner-approved 2026-08-28, from the new-user sweep. The hardest new-user question in the Blocks tab is
"what does this canvas have to do with my form?" — answer it by POINTING, not by a tutorial.)*

- **Form → block:** activating a row in the live Wizard View pans the canvas to the block that makes it and
  glows it (the existing glow convention). The two-way binding already exists (`renderLiveForm`,
  blocksApp.js:474-478) — this adds NAVIGATION over the join that is already there.
- **Block → form:** a `Show in form` entry in #42's `Block ▸` submenu, highlighting the row.
- ⚠ Establish the gesture for form→block (a click already focuses the field for typing — maybe an affordance
  on the row, or long-press). Do not steal focus from editing.

**VERIFY:** on a big twin (corner, 23 fields), both directions land on the right target; screenshots.

---

### 44. [✅ SHIPPED t2435 — shared the editor find bar's cycling/count SHAPE via a new `ui/findBarCore.js` (proved by refactoring `editorFind.js` itself onto it), built matching fresh for blocks (`blocks/blockCanvasFind.js`, `Field.getText()` across every field kind + block `type`), reused t2397's own pan+glow verbatim via an extracted `panAndGlow` callback] CANVAS FIND — search the blocks that are THERE, not just the palette

*(owner-approved explicitly 2026-08-28 — "4 yes"; rides the editor search box shipped at t2383 so the two feel
identical. The palette search (blocksApp.js:291) filters what you can ADD; nothing searches a 98-block stack.)*

Same find bar contract as the editor's: n-of-m count, Enter/arrows cycle, Esc closes — but a match pans the
canvas and glows the block. Match against block label + field values (a param name like `depth` must hit).
⛔ Search only, no replace.

**What was actually shared vs. built fresh.** The editor's own find bar (t2383) is text-offset based —
`computeMatches` over a textarea's raw string, `setSelectionRange` to select, line-height math to scroll — none
of that transfers to a Blockly canvas. What DOES transfer, and now demonstrably IS shared (not just similarly
shaped): the index-cycling-with-wraparound math and the "n/m" count text, pulled into `ui/findBarCore.js`
(`cycleIndex`/`formatCount`) — proved genuinely shared, not just duplicated-then-declared-shared, by refactoring
`editorFind.js` itself to call the extracted functions rather than its own inline modulo/ternary, then confirming
its own existing behavior was unchanged.

**Matching, built new for the canvas.** `blockCanvasFind.js`'s `computeBlockMatches` walks `ws.getAllBlocks(false)`
and, per block, checks the block's own `type` plus every field's `Field.prototype.getText()` (Blockly's own
public method — the RENDERED text for any field kind uniformly: a caption, a typed value, a dropdown's own
displayed option) against the query, case-insensitive. This is deliberately generous per the dispatch's own
instruction — a param name like `depth`, a variable like `#100`, a literal like `18000` all hit, because a
dropdown's displayed label may differ from its stored code and a machinist searches by what they SEE.

**Reveal reuses t2397 verbatim.** `blocksApp.js`'s existing inline glow tail (previously living only inside
`revealInBlocks`, the FORM → BLOCK jump) was extracted into a standalone `panAndGlow(blk)` — `ws.centerOnBlock`
for panning, a direct `style.filter` drop-shadow + `setTimeout` clear for the glow (NOT CSS `@keyframes`, which
this Blockly build silently ignores on an SVG block root — t2397's own finding, not rediscovered). Both
`revealInBlocks` and the new find bar now call the one function.

**Edge cases, decided with the file in hand:** a match inside a COLLAPSED block (or inside a collapsed ancestor)
is expanded via `setCollapsed(false)` before panning — a glow hidden inside a collapsed summary would show
nothing. Off-canvas at high zoom: pan-only via `ws.centerOnBlock`, no zoom-to-fit added — matches what the
existing t2397 reveal already relies on, and nothing in verification showed it insufficient. Zero matches: the
count reads "0/0" plus a visible `.no-match` class on the input — never a silent no-op.

**Placement:** an overlay chip + bar in the top-right corner of the Blocks canvas itself (`.blk-bk-host`), the
same corner-overlay convention `.editor-findbar` already uses over the editor's own code area — NOT a second
input beside the always-visible `.blk-search` palette box, so the two never read as the same control doing
different things.

**Verified live** on a real placed corner op (155 blocks, via `_framed`/`makeOp` + `window.ddcsLoadBlockStack` —
NOT `ddcsEditWizardDef`, which opens a different, much larger 1787-block authoring canvas, a mistake caught and
fixed while writing the test): "radius" query hit multiple matches, cycling with Enter visibly glowed a block
(confirmed via `style.filter` inspection + a viewed screenshot, `DDCS-Studio/verification/t2435-canvas-find.png`),
the model (`ddcsGetBlockProgram()`) was byte-identical before/after typing — proving the find input never edits
a block, a zero-match query showed "0/0" + `.no-match`, Esc closed the bar. A second test collapsed a block
carrying a distinctive matched caption ("Probe stylus radius"), searched for it, and confirmed it was expanded
before being revealed — cycling through every match rather than assuming match order, after a first attempt
wrongly assumed the target would be `matches[0]`.

**Full suite (Rule 1b — `blocksApp.js` is shared)**: see WORK-LOG t2435 for the result.

**Mid-task amendment, owner-reported real device — "when the keyboard opens the code disappears" (applies to
the editor's own t2383 find bar too). Full story in WORK-LOG t2435's own amendment section**; short version:
chased an initial "keyboard shrinks the viewport" theory, which the advisor then corrected to "focusing the
input triggers the browser's own scroll-into-view, displacing the page" — shipped `input.focus({preventScroll:
true})` in both find bars for the corrected theory, NOT independently verifiable in this harness (no real OS
keyboard), owner re-check needed. The FIRST theory's own machinery was built, then fully reverted after
verifying it would have broken an EXISTING, already-shipped mobile-keyboard mechanism (`app.js`'s
`keyboard-active` detector, t2229/BACKLOG F3a) — but surfaced one real, kept fix along the way:
`ws.centerOnBlock(id)` (no 2nd arg) centers on Blockly's `getHeightWidth()`, which includes an entire trailing
block chain, not just the target block's own row — fixed via `useCoordinates=true` in the shared `panAndGlow`
(also benefits the pre-existing t2397 FORM→BLOCK reveal, not just this turn's find bar).

**t2437 — the REAL root, found on the third pass (full story in WORK-LOG t2437).** `preventScroll` changed
nothing on the owner's real device; the owner then spotted it themselves from their own screenshots — `.main`
(the editor's own parent) sits empty. `styles.css`'s `body.keyboard-active .editor-container` rule DETACHES
the editor (`position:fixed; height:60px !important`) the instant the keyboard opens — correct and deliberate
for `editorManager.js`'s own snippet-insert buttons (one centered line is enough there), wrong for a find bar
that needs to READ several lines. Fix: a new `.ddcs-find-open` class (set by both find bars' `open()`/`close()`)
steps the detach rule aside while a find bar is open (`:not(.ddcs-find-open)`), so the editor stays in normal
flow — plus `app.js`'s own existing `keyboard-active` detector (t2229/F3a, extended not duplicated) now also
publishes `--vv-height`, handed to `.app-shell` itself so the in-flow editor's own ancestor has the REAL
visible height (established directly: `100dvh` does NOT track the keyboard without an opt-in that would break
the detector's own `innerHeight` comparison — deliberately not added). `#blocks-app` already carries the
literal `.app-shell` class, so ONE rule fixes both the editor and the canvas, no second pin needed.
`preventScroll` (t2435) stays — confirmed inert for this specific bug, not harmful, not removed.

Files: `web/ui/editorFind.js`, `web/ui/findBarCore.js` (new), `web/blocks/blockCanvasFind.js` (new),
`web/blocks/blocksApp.js`, `web/styles.css`, `web/app.js`, `tests/block-canvas-find-2435.spec.js` (new),
`tests/keyboard-find-height-2437.spec.js` (new).

---

### 45. [✅ SHIPPED t2449] THE MILLING SNIPPETS HAND-ROLL WHAT THE ENGINE DECLARES — rebuild on real atoms, add surfacing

*(owner-asked 2026-08-28: "does surfacing have a block snippet" — answer: NO, and the near-misses are fakes.
⭐ Owner-approved the same day, with the principle in their own words: **"milling atom, needs to be true."**
A snippet that imitates an operation with hand-listed moves is a lie a learner will trust — build on the real
atom or not at all.)*

`learnerLibrary.js`'s own discipline (its probe snippets: built from *the same atoms the wizards use, "so the
later consolidation composes from it"*) is broken by its two milling snippets: `trace-square` and `face-pass`
are hand-listed `move` atoms — a FACSIMILE of facing, no stepover/raster/boundary, free to drift from what the
engine really does.

- Rebuild `face-pass` on the real atom (`surfaceraster` with a small fixed area) — same learning value, and it
  can never lie.
- Add ONE surfacing snippet: "this block rasters an area" without the wizard's 30-field apparatus.
- `trace-square` may legitimately stay hand-listed moves (its POINT is reading raw moves) — decide with the
  file in hand and say which.

**VERIFY:** snippets still drag in and run in the sim; the learner-library spec stays green.

**✅ SHIPPED t2449.** `face-pass` rebuilt on the real `surfaceraster` atom (minimal params `{w,h,depth,feed}` —
everything else falls back to the atom's own defaults, confirmed live). New bare `raster-area` snippet added
under a new `Snippets > Milling` sub-category — confirmed live that a bare `surfaceraster` atom (no
progstart/progend framing) still traces a real, non-degenerate toolpath on its own. `trace-square` KEPT
hand-listed, deliberately: no real atom exists for "retrace this exact outline" (pocket/contour BUILD a
boundary from a shape, they don't retrace four literal corners), so nothing there can drift the way the old
`face-pass` could — reasoning left in a file comment, scoped per-entry, not a blanket rule.

Verified two ways: (1) data-level — `traceToolpath()` on both entries' raw emit shows real segment counts and
non-zero-area bounds, plus a non-vacuous new test (fails 3/3 against pre-change HEAD, since `raster-area` didn't
exist and old `face-pass` had no `surfaceraster` block). (2) live UI — clicked `Snippets > Milling` and
`Complete Programs > Milling` in the real Blocks tab, opened both flyouts, and dragged `raster-area` onto the
workspace via real `page.mouse` events, confirming a connected block actually lands (no prior test in the repo
had automated this toolbox-row interaction against the real app; the working click target turned out to be the
row's ancestor `.blocklyToolboxCategory` div, not the `.blocklyToolboxCategoryLabel` span — the label alone
doesn't receive pointer events).

Separately flagged, not fixed (out of scope for this entry): `tests/node/preview-spec-gate-1688.test.mjs` is
currently RED on this branch independent of this change — a frozen panel-snapshot gate that never got
regenerated after t2447 legitimately added `onDragEnd` as a real panel field. Confirmed via `git stash` that the
failure is identical on clean HEAD. See WORK-LOG t2449.

Files: `web/data/learnerLibrary.js`, `tests/learner-library.spec.js`.

---

### 51. [⛔ REOPENED then RETARGETED 2026-08-29, ✅ SHIPPED t2417 (additive, Blocks canvas) — owner, unambiguous: "panning with 2 fingers doesn't work, it just zooms, it should do BOTH". ⚠ The earlier close was the ADVISOR'S ERROR: an ambiguous multiple-choice answer ("now it works well") was read as a fix confirmation and the entry was closed on it. It was never fixed — t2411 changed no code] TWO-FINGER DRAG ON THE FEATURE CANVAS SHOULD PAN

> ## ⛔⛔ WRONG SURFACE — THE ADVISOR FILED THIS AGAINST THE WRONG CANVAS
>
> Owner, 2026-08-29, clarifying: **"in blocks" / "block canvas."** This is the **BLOCKS TAB'S BLOCKLY
> WORKSPACE**, NOT the feature canvas. The advisor filed it against the feature canvas because #32's
> pinch-zoom lived there and the report arrived in that conversation — the same
> [[confirm-the-referent-before-dropping]] error made twice in one day.
>
> ⇒ ⭐ **It also explains t2411's "already works":** they traced and simulated the FEATURE canvas, where
> t2371's pinch does work. They answered the question as filed. The Blockly workspace was never examined.
>
> ⭐ **CONFIRMED BY THE OWNER, 2026-08-29: "yes feature canvas now works well."** So neither earlier answer
> was wrong — the feature canvas genuinely works, the Blocks canvas genuinely does not, and the advisor
> attached a true statement to the wrong surface. ⇒ **This entry is now Blocks-canvas-only; the feature
> canvas half is CLOSED and needs no further work.**
>
> ## THE SYMPTOM
>
> On the **Blocks canvas**, two fingers ZOOM but do not PAN. Both must happen from the one gesture — spread
> changes scale, midpoint movement translates the view, simultaneously. ⛔ NOT modes, NOT a toggle.
>
> ## THE LIKELY ROOT IS CONFIGURATION, NOT CODE
>
> `blocksApp.js:240` injects the workspace with:
>
> ```js
> zoom: { controls: false, wheel: true, startScale: 0.9 },  // no `pinch` key
> trashcan: false, move: { smoothScroll: true },            // no `drag` key
> ```
>
> ⚠ **Establish with Blockly's own docs/defaults for THIS vendored version** (do not assume — the build has
> already surprised us twice: no submenu support, no exposed DropdownDiv): `zoom.pinch` governs pinch-to-zoom
> and `move.drag` governs drag-to-pan, and a partially-specified `move`/`zoom` object may or may not inherit
> the rest of the defaults. If two-finger pan is simply an unset flag, this is a one-line fix — check that
> first, before writing any gesture handling.
>
> ⭐ Blockly may already implement simultaneous pinch-zoom + two-finger pan natively; if so the work is
> enabling it, not building it.
>
> **VERIFY:** ⚠ needs a REAL touch device — the harness has no true multi-touch (t2371's pinch tests had to
> synthesize PointerEvents), so harness agreement is WEAK evidence here. If it cannot be driven convincingly,
> say so plainly and it becomes an owner check rather than a claimed pass. ⛔ One-finger block DRAGGING must
> remain unaffected, and the canvas must still pan by one-finger drag on empty space if it does today.

*(owner, 2026-08-29, while testing the t2371 pinch-zoom: "2finger pinch should act as pan.")*

t2371 shipped pinch-to-zoom on the feature canvas (#32) but only the SPREAD half of the standard two-finger
gesture. The MIDPOINT half — moving both fingers together — should PAN the view, simultaneously with the
zoom, the way every touch map/canvas behaves. Today touch has NO pan at all: one finger is taken by the drag
handles, so a zoomed-in canvas cannot be moved.

⭐ One gesture, two continuous outputs: spread → zoom, midpoint delta → pan. Not modes, not a toggle.
⚠ Establish with the t2371 code in hand how the pinch anchor point works today — a pan that fights the zoom
anchor feels broken; the combined transform is the standard fix.

**VERIFY:** on a real touch device (the owner can), zoom in then move around with two fingers; one-finger
handle drags unaffected; desktop wheel/drag behaviour unchanged.

> ⭐⭐ **t2411 — ESTABLISHED how the anchor works, per the dispatch's own instruction, before writing anything:**
> `_pinchMove()` (`web/viz/featureCanvas.js`) solves `t.cxw`/`t.cyw` on EVERY move so that `w0` — the world
> point captured under the midpoint ONCE, at `_pinchStart()` — stays under the CURRENT (possibly drifted)
> midpoint, at a scale derived from the current/initial distance ratio. That formula does not describe
> "zoom only" — it describes a COMBINED anchor: when the midpoint moves at a roughly constant distance (a
> pure two-finger pan), the content is re-solved to keep following the SAME world point under the moving
> midpoint, which IS panning. Traced the actual `_W()` transform (`t.cxw + (sx-t.cx)/t.scale`, the same
> screen→world formula the wheel-zoom handler already uses) to confirm the algebra, not just read the
> comment.
>
> **Live-verified, not just derived**: dispatched synthetic two-pointer `PointerEvent`s (`pointerType:'touch'`,
> two distinct `pointerId`s) directly at the SVG — the exact event shape any touch device produces, and the
> exact listener this file registers — moving both points by the SAME 150px delta at a CONSTANT distance (a
> pure pan, no zoom). A handle's own `getBoundingClientRect()` moved by exactly 150,0px, matching the fingers
> 1:1. **The combined pan+zoom gesture the ticket asks for already exists in the code and already works when
> driven by the exact events a touch device sends.**
>
> ⚠ Given that, I did NOT modify `_pinchStart`/`_pinchMove` — rewriting already-correct, subtle anchor math on
> a guess would risk breaking it for a benefit I can't confirm. Checked the one other plausible explanation
> that fits "works when I drive it directly, owner says it doesn't work on their phone": `web/index.html`'s
> viewport meta has no `user-scalable=no`/`maximum-scale=1`, which COULD let the OS/browser's own native
> page-pinch-zoom compete with the canvas's `touch-action:none` on some mobile browsers — but this SVG
> already sets `touch-action:none` directly on itself (the same per-element pattern this codebase already
> uses for every other drag surface — splitters, resize handles — none of which get a page-level
> `user-scalable=no` either), and per the CSS Touch Action spec a child's more-restrictive value should win
> regardless of ancestors. Did not change this either — it's a real candidate but unconfirmed, and changing
> the page's own zoom behavior site-wide is a bigger blast radius than this ticket's own scope for an
> unconfirmed cause.
>
> ⛔ **Per the dispatch's own fallback ("if you cannot drive it convincingly, say so plainly, and it becomes
> an owner check rather than a claimed pass"): this is that.** Not claiming fixed, not claiming closed —
> the mechanism is confirmed correct by direct trace + live event simulation, so the next useful data point
> is the owner re-testing on the CURRENT deployed build (this exact code has been live since t2371, unchanged
> by this turn) and reporting exactly what they see: does it pan at all, does it only zoom, does it jitter?
> If it still fails on-device, the viewport-meta/native-gesture-interception candidate above is where to look
> next, with real hardware in hand rather than a synthetic repro.

> ⭐⭐ **t2417 — RETARGETED then SHIPPED. The owner's own clarification narrowed this correctly: "in blocks" /
> "block canvas" meant the BLOCKS TAB'S Blockly workspace, not the feature canvas above — the feature-canvas
> half stays CLOSED (t2411's own trace was correct for the question as asked).**
>
> Checked configuration FIRST, per the dispatch's own instruction, before writing gesture code: `zoom.pinch`
> defaults to `wheel || controls` in Blockly's own option parsing — already `true` here (`wheel:true`),
> matching that pinch-zoom already worked. But reading the actual gesture code (not just the option parser)
> settled the real question: `Gesture.prototype.handlePinch` (vendored `blockly_compressed.js`) computes ONLY a
> scale ratio from the two touch points' distance and calls `workspace.zoom(x,y,amount)` — no translation call
> anywhere in it. **A genuine gap in the vendored build, not a missing config flag** — "possibly one line"
> (this entry's own hope) was not the case.
>
> **Fix**: additive `twoFingerPan` (`web/blocks/blocksApp.js`), mirroring the file's own pre-existing
> `middlePan` (`ws.scroll(origin+delta)`). Tracks the two touches' own midpoint via native `touchstart`/
> `touchmove`/`touchend`, gated strictly on `touches.length===2` — the same boundary Blockly's own Gesture uses
> to route into `handlePinch`, so one-finger pan is structurally untouched. Confirmed live (reading the same
> compressed source) that Blockly's 2-touch branch calls `preventDefault()` only, never `stopPropagation()`, so
> this listener never fights Blockly's own handling for control.
>
> ⛔ **Per this entry's own stated fallback: full simultaneous-gesture proof was not achievable in this
> harness, and is flagged plainly rather than papered over.** `tests/blocks-two-finger-pan-2417.spec.js` proves
> OUR OWN mechanism correct to the pixel via synthetic `TouchEvent`s (non-vacuous — fails against the pre-fix
> tree with the exact predicted before/after numbers). What it cannot prove: Blockly's own pinch firing from
> the SAME real gesture — established live that Blockly's multi-touch recognition actually runs off POINTER
> events (`pointerdown`/`pointermove` on `document`, tracked by `pointerId`), not the legacy `TouchEvent` API
> these tests drive (confirmed: a synthetic pinch-spread via `TouchEvent` left `ws.scale` completely unchanged
> — Blockly's own listeners never saw it). A real touchscreen dispatches BOTH event families for the same
> physical touch (standard browser behavior), so the two should compose correctly on real hardware — but that
> composition is an owner device-check, not a claimed pass.

---

### 52. [⛔ REOPENED 2026-08-29, ✅ SHIPPED t2417, ⛔⛔ REOPENED AGAIN t2419, ✅ SHIPPED (for real) t2423 — root was a narrow-viewport double-clamp, not the advisor's own detached-element theory; flyout now stacks below the row when neither side fits] "BLOCK ▸" SHOULD OPEN A REAL FLYOUT SUBMENU, EXPLORER-STYLE

> ## THE DEFECT — owner-observed on the deployed site, both screenshots supplied
>
> **t2387's click-popup was never retired when t2411 added the hover cascade, so BOTH are wired to the same
> item and nothing makes them exclusive:**
>
> ```
> CLICK  →  the OLD popup — REPLACES the parent menu (t2387's cursor-anchored panel)
> HOVER  →  the NEW cascade — attached flyout, parent stays  (t2411)
> BOTH   →  can be open AT THE SAME TIME       ← the owner's "its weird"
> ```
>
> ⭐⭐ **AND IT EXPLAINS THE PHONE.** A tap IS a click and there is no hover, so mobile has been getting the
> OLD path the whole time. The "replace" behaviour the owner reported on mobile was never a deliberate
> adaptation — it is the un-retired t2387 popup. ⇒ ⛔ Do NOT "fix mobile" by keeping a second implementation;
> that is the bug.
>
> ⚠ This is the repo's own two-things-that-must-agree-forever defect, self-inflicted one turn after
> `blocksApp.js:958-960`'s comment warns against exactly it.
>
> ### THE RULING — owner, 2026-08-29: "hover"
>
> **ONE element survives: the t2411 cascade. DELETE the t2387 click-replace popup** (do not leave it dormant —
> a dormant second path is how this happened).
>
> ```
> desktop   hover opens the cascade; CLICK must open THE SAME element, never a second one
> touch     tap opens THE SAME element — no hover exists, so tap is the only trigger
> narrow    ⭐ NOTHING SPECIAL — same cascade, same size, beside its parent row, anchored
>           to the block. Owner ruled 2026-08-29: "not a problem we can always pan the
>           canvas to see the menu."
> ```
>
> ⛔ **NO narrow-screen special case.** An earlier draft of this entry proposed a full-width overlay with a
> back affordance; the owner rejected the premise — the menu hangs off a block ON A PANNABLE CANVAS, so a
> flyout that lands off-screen is reached by panning, exactly like any other off-screen block. ⇒ One
> behaviour on every device, no responsive branch, no back affordance to build. The edge-flip that already
> ships is enough.
>
> ⛔ **Impossible-by-construction, not merely fixed:** one element, one open-state — there must be no code
> path by which two panels can coexist. Prove it: open by hover, then click, and only one panel exists.
>
> **VERIFY:** desktop hover→click→hover sequences never double; touch tap opens the cascade (not the old
> popup); at 390px the overlay has a working back affordance; edge-flip and theme tokens still hold.
> ⚠ that last clause (a "back affordance") is a leftover from an earlier draft of this entry — the ruling two
> paragraphs up explicitly rejects a narrow-screen special case, so there is no back affordance to verify;
> reconciled by t2417's own actual VERIFY below.

> ⭐⭐ **t2417 — SHIPPED, impossible-by-construction as demanded, not merely patched.**
>
> **Root cause, established live, not guessed**: `wireFlyoutTrigger`'s own click-interception (a capture-phase
> `stopPropagation()` on the row) never actually suppressed Blockly's native activation of that same row —
> `stopPropagation()` only blocks an event from reaching OTHER elements, never a sibling listener already bound
> to the SAME node, and Blockly binds its own click handling on the row before this code ever gets to touch it
> (the row doesn't exist to wire until Blockly has just painted it). Proved with an isolated repro: a real
> click left `nativeMenuOpen:false` (Blockly closed its own menu, as it always does on activation) and the
> shared `.op-ctx-menu` at the ORIGINAL right-click's cursor position (`openMenu`'s `place()`), not the row-
> anchored `placeAdjacent()` position — Blockly's own callback fired and its render won the race regardless of
> the interception.
>
> **The fix is not a better interception trick.** Click, touch tap, and keyboard (arrow+Enter) already all
> funnel through ONE guaranteed path — the `ContextMenuRegistry` item's own `callback` — so THAT callback now
> opens the SAME row-anchored cascade (`openFlyoutAdjacent`) instead of the old cursor-anchored `openMenu`.
> `wireFlyoutTrigger` is HOVER-ONLY now; its former click/touchend interception is DELETED, not left dormant,
> per this entry's own instruction. One wrinkle found live: Blockly tears its own menu DOM down BEFORE
> invoking the callback, so the row's rect is cached at PAINT time (`window.__ddcsBlockOptionsRowRect`, module-
> scoped since the paint-observer is wired once ever while the callback re-registers per workspace init) rather
> than re-queried inside the callback.
>
> **VERIFIED, the entry's own "PROVE it" literally**: `tests/blocks-context-flyout-2411.spec.js` (updated in
> place, narrowed rather than rewritten — same feature evolving) — hover-then-click keeps
> `document.querySelectorAll('.op-ctx-menu').length` at exactly 1 throughout, and the SAME rect before and
> after the click (no jump to a second position); a real click opens the cascade at the row-anchored position,
> never the cursor position; a real Playwright touch-emulated tap (`page.touchscreen.tap`, the genuine
> synthesis pipeline) opens the same cascade too. Non-vacuous: reverted via `git stash`, all 3 new assertions
> fail against the pre-fix tree with the exact predicted numbers (272 vs 433 — the cursor-vs-anchored gap).
> Duplicate/hover/positioning regressions stay green.

> ## ⛔⛔ REOPENED AGAIN t2419 — real device, two screenshots: flyout at the viewport's bottom-left, parent gone
>
> Owner, V2026.08.30.1: after tapping "Block options…," the flyout renders at the bottom-left of the viewport,
> nowhere near the row — and in that same frame the parent menu is already gone (desktop hover keeps it open;
> this is "the whole point of a cascade" per the owner's own words).
>
> **Established live, not guessed**: Blockly's own vendored `onAction` (`blockly_compressed.js`) runs
> `hide()` SYNCHRONOUSLY the instant any item is activated (click, tap, keyboard — no exception), THEN
> schedules the registered `callback` via `requestAnimationFrame(() => setTimeout(callback, 0))` — a real,
> multi-frame deferral. Two consequences: the parent closing on click/tap is unconditional Blockly behavior,
> not something achievable to prevent without abandoning the registered-callback path (which is what caused
> THIS ENTRY's own original defect); and the callback runs later than "immediately," which matters for
> anything that could shift between paint and use.
>
> **Directly tested the advisor's own "stale/zero rect" theory and could NOT confirm it**: t2417's own
> `window.__ddcsBlockOptionsRowRect` (cached at PAINT time specifically to avoid needing the row after it's
> gone) reads correctly populated in every repro attempted, including one that explicitly waits past an
> animation frame + tick before tapping to approximate the real deferral more closely. The resulting flyout
> position is correctly row-anchored every time — `tests/blocks-context-flyout-2411.spec.js`'s own touch test
> now asserts POSITION (a real gap in t2417's own verification, closed regardless of this bug's outcome).
>
> ⛔ **NOT FIXED. Per this entry's own explicit prohibition (do not paper over with a fixed-corner position or
> by force-reopening the parent) and its own stated fallback (if a genuine touch gesture cannot be driven
> convincingly, say so plainly)**: the most plausible remaining candidate — a real mobile browser's own chrome
> (URL bar show/hide, visual-viewport resize) shifting the viewport DURING a long-press-then-tap sequence,
> between when the rect was cached and when the deferred callback uses it — cannot be reproduced in a headless/
> emulated-touch harness. Flagged for the owner to re-test on the current deployed build; the Blockly-timing
> finding above is the lead for whoever investigates next, not a guess to build on blind.

> ⭐⭐ **t2423 — SHIPPED, root cause was NEITHER prior theory.** The owner's device confirmed both
> discriminators: mispositions EVERY time (not a race), parent vanishes the SAME instant. That "same instant"
> turned out to be a red herring shared by both theories — it's just Blockly's own unconditional `hide()`,
> unrelated to WHERE the flyout ends up.
>
> **Re-verified the advisor's refined theory with total certainty first, not from memory**: re-read
> `placeAdjacent` and the registered `callback` character-by-character. NEITHER reads `getBoundingClientRect()`
> on the row anywhere — `anchorRect` (the value already captured at paint time) is used throughout;
> `m.getBoundingClientRect()` inside `placeAdjacent` is the FLYOUT's own rect (for sizing its own clamp), never
> the row's. The detached-element-returns-zero mechanism the advisor proposed does not exist in this code —
> confirmed by code inspection, not just by a failed repro.
>
> **The REAL cause, found by computing what the code actually does with the real measured numbers**: this row
> ("Block options…") is ~156px wide; the flyout itself is ~168px. On ANY ~390px-wide phone screen,
> `anchorRect.right + gap + flyoutWidth` (400px needed) and `anchorRect.left - gap - flyoutWidth` (-96px) BOTH
> fail — deterministically, for THIS row's own dimensions, regardless of where on the row sits horizontally.
> Before the fix, the code still ran the left-side formula anyway, landed deeply negative, and the outer clamp
> pinned the flyout to the screen's own far-left edge — matching "always" exactly, and matching "-left" in
> "bottom-left" (the "bottom" part was simply wherever the tapped row's own vertical position happened to be —
> unrelated to the X-axis bug).
>
> **Fix**: when NEITHER side fits, stack the flyout BELOW the row (touching it, left-aligned with it) instead
> of falling through to a distant screen-edge clamp — still row-anchored, matching this entry's own "beside its
> parent row" requirement, just switching axis when there's no horizontal room. Not fighting Blockly's `hide()`
> (unrelated to this bug), not hard-positioning to a fixed corner (still computed from the row's own live-at-
> paint-time rect).
>
> **VERIFIED live with the real measured numbers**: a synthesized narrow-viewport anchor (`placeAdjacent`
> called directly) now lands exactly at the row's own left edge, exactly at the row's own bottom + the gap —
> `tests/blocks-context-flyout-2411.spec.js` (2 new tests: a direct unit-level check of the new stack-below
> branch, and a real end-to-end 390px-viewport touch-emulated test using the actual Blockly row). Non-vacuous:
> both fail against the pre-fix code with the exact predicted numbers (received x=6 — the far-left screen
> clamp — vs expected ≈73.6, the row's own position). Desktop's existing right/left-flip behavior (the case
> where at least one side DOES fit) re-verified unchanged — all 8 pre-existing tests in the same file still
> pass untouched.

---

### 52-ORIGINAL. [✅ SHIPPED t2411 — hover/click/touch cascade, edge-flip, theme tokens on both the flyout and Blockly's own native menu, verified live incl. screenshots] "BLOCK ▸" SHOULD OPEN A REAL FLYOUT SUBMENU, EXPLORER-STYLE

*(owner, 2026-08-29, with a Windows Explorer screenshot: "right click submenu should be like this." Refines
#42 piece 4's shipped fallback — the vendored Blockly has no native submenus (established t2389), so t2387
built a popup at the cursor. The owner wants the popup to be an ANCHORED CASCADE instead.)*

The reference behaviour, from the screenshot:

```
│ …                    │
│ Block              ▸ │──▸ ┌────────────────────┐   flyout ADJACENT to the parent
│ ──────────────       │    │ ❄ Freeze value     │   row, top-aligned with it —
│ Duplicate            │    │ ⊘ Disable          │   visually attached, not a
│ Delete               │    │ ──                 │   detached popup at the cursor
└──────────────────────┘    │ + help text        │
                            │ + limits           │
                            │ + show-when        │
                            │ + units            │
                            └────────────────────┘
```

- **Desktop:** opens on HOVER (small open delay, generous close delay so the diagonal into the flyout does
  not close it — the classic cascade tolerance); click also works.
- **Touch:** tap the row toggles the flyout; a second tap elsewhere closes.
- The t2387 popup already owns the list and its actions — this is a POSITIONING + TRIGGER upgrade of the
  same custom element, not a rebuild. ⚠ Screen-edge flip (open leftward near the right edge) or the flyout
  is unusable on phones.
- Per-entry icons like Explorer's are OPTIONAL — only if the codebase's existing glyph conventions cover
  them for free; do not draw an icon set for this.
- ⭐ **Owner, same session: "the context menu should follow theme."** The popup/flyout (and the Blockly
  context menu it hangs off, if it does not already) styles from the app's THEME TOKENS — light/dark and the
  skin tokens — never hardcoded colours. ⚠ Remember the house rule: token defaults live at `:root`, never on
  the consumer ([[css-token-default-must-live-at-root]]); check what the t2387 popup hardcodes today.

**VERIFY:** screenshots desktop hover + touch tap; near-right-edge flip shown; the existing entries all
still fire.

> ⭐⭐ **t2411 — SHIPPED.** First dumped Blockly's own rendered context-menu DOM live (not guessed): a fresh
> `.blocklyContextMenu` under a fresh `.blocklyWidgetDiv` is painted from SCRATCH on every open (never patched
> in place), each row a plain `.blocklyMenuItem` with NO submenu chrome of its own — confirming t2389's own
> "no native submenu support" finding and, more usefully, that "Block options…" is indistinguishable in the
> DOM from Duplicate/Delete/etc. — there's nothing to hook UNTIL Blockly paints it.
>
> **THE MECHANISM** (both new, in `ui/opContextMenu.js`, alongside the existing `openMenu`/`place`):
> - `openFlyoutAdjacent(items, anchorRect)` — the SAME shared `.op-ctx-menu` element `openMenu` already uses,
>   positioned adjacent to a DOM rect instead of a cursor point: opens to the right, top-aligned; flips to the
>   LEFT when the right side would overflow the viewport (a real flip — the flyout's own right edge meets the
>   anchor's left edge — not `place()`'s existing edge-CLAMP, which only shifts a cursor-popup to fit and would
>   leave a row-anchored one overlapping the row).
> - `wireFlyoutTrigger(rowEl, getItems)` — hover-open (150ms), a 450ms close-delay that survives moving from
>   the row into the flyout (cancelled on re-entry to either), and a CAPTURE-phase click/touchend interceptor
>   that `stopPropagation()`s + `preventDefault()`s so the row's own native handler (Blockly's "activate and
>   close the menu") never fires — the parent menu stays up because it was never told anything happened.
>   `getItems()` is called fresh at every open, never cached, so the flyout always reflects the block's CURRENT
>   pending-enabler state.
>
> **`blocksApp.js`'s `registerBlockOptionsMenu()`**: kept the existing `CMR.registry.register(...)` (so
> Blockly still shows the row at all, same precondition) but its `callback` is now the FALLBACK ONLY —
> reached by keyboard activation (arrow keys + Enter), which never hovers or clicks the row, so it keeps the
> old cursor-popup-that-closes-the-parent behaviour unchanged for that one path. The PRIMARY path is a
> `MutationObserver` on `document.body` (wired ONCE, module-scope-guarded on `window` since the IIFE re-runs
> per Blockly workspace init but the observer only needs to exist once, ever) that catches every fresh
> `.blocklyContextMenu` paint, finds the row whose text is exactly "Block options…", and wires it with
> `wireFlyoutTrigger`. Which block owns the open menu is resolved via `B.getSelected()` (an existing,
> already-used API in this file) at OPEN time, not paint time — confirmed live that right-click selects the
> block first and Blockly does not change selection while its own menu is open.
>
> **THEME TOKENS** (the owner's own rider): grepped first — no rule anywhere in `styles.css` touched
> `.blocklyMenu`/`.blocklyMenuItem`/`.blocklyWidgetDiv` before this turn, confirmed by checking Blockly's own
> vendored CSS (`.blocklyMenu{background:#fff}`, `.blocklyMenuItem{color:#000}`, injected at runtime, AFTER
> this file loads) — the native menu was plain white/black regardless of the app's active theme or skin, full
> stop. Added token-driven overrides (`var(--panel)`/`var(--border)`/`var(--text-main)`/`var(--accent)`/
> `var(--text-dim)`, the SAME family `.op-ctx-menu` already uses) with `!important` — deliberate and scoped to
> exactly these selectors, the standard/accepted way to override a vendored library's own runtime-injected
> styles, verified necessary (Blockly's later-injected same-specificity rule would otherwise win). `.op-ctx-menu`
> itself was ALREADY correctly tokenized (checked, not assumed) — the theme gap was Blockly's own chrome only.
>
> **VERIFIED, every claim live, nothing assumed:**
> - `openFlyoutAdjacent`'s own edge-flip math, in isolation: an anchor with room to its right opens right; an
>   anchor near the viewport edge flips left, staying top-aligned in both cases.
> - `wireFlyoutTrigger`'s full timing contract on a synthetic row: not open at 50ms, open by 300ms (past the
>   open-delay); still open at 200ms after leaving (survives the tolerance window), closed by 600ms with no
>   re-entry; entering the flyout itself before the close-delay fires keeps it open indefinitely; a click on
>   the row never reaches a stand-in "native" handler and opens the flyout instead; a touch tap opens it, a
>   second tap closes it.
> - END TO END on a REAL Blockly-rendered row: a fresh `formfield` block (every enabler still pending) →
>   right-click → hover "Block options…" → Blockly's own native menu STAYS visible AND the flyout opens
>   beside it with the correct 4 items (`+ help text`, `+ limits (min/max/step)`, `+ units`,
>   `+ show-when condition`) → clicking a flyout item closes BOTH menus together, matching the Explorer
>   reference exactly (turns out Blockly's own outside-click dismiss already treats a click inside our
>   flyout as "outside its own menu" and closes itself — no extra code needed for that half).
> - Screenshots: `verification/t2411-cascade-dark.png` (default/dark skin — the parent menu open, "Block
>   options…" highlighted in the skin's own accent colour, the flyout cascading beside it with matching
>   panel/border colours), `verification/t2411-cascade-light.png` (the "normal" light skin — white panel,
>   same layout, confirming the tokens actually SWITCH, not just resolve once), `verification/t2411-cascade-
>   edge-flip.png` (a row placed near the viewport's right edge — the flyout opens leftward, no clipping).
> - REGRESSION: `Duplicate` (an ordinary, un-wired row) still duplicates the block on click — proven both
>   ways: passes on the new code, and — checked, not assumed — ALSO passes when the t2411 changes are
>   reverted, confirming it was never at risk (the other 4 new tests correctly FAIL when reverted, proving
>   they test the real mechanism and aren't vacuous). The shell's regression surface wasn't separately
>   re-checked here (this ticket never touches `pocket-canvas.spec.js`'s own code path); the modal-door
>   check from t2409 stands untouched by this turn's files.
> - Committed as a permanent spec, `tests/blocks-context-flyout-2411.spec.js` (5 tests) — a shared-file
>   feature (`blocksApp.js`, `opContextMenu.js`, `styles.css`) earns a pinning test.
>
> Not covered: TOUCH tap-to-toggle on a REAL touch device (only synthetic `TouchEvent`s, matching #51's own
> same honest limit — no physical hardware available this session).

---

### 53. [✅ SHIPPED t2405] THE DANGLING-CAPTION FIX MISSED A PATH — "options" renders as a bare word on number rows

*(owner screenshot, 2026-08-29, during the on-device #42 check — which otherwise PASSED: long-press opens
the popup, an enabler reveals `help` with the cursor in it. But every `param_field` row in the shot trails
the word `options` with NO box after it, on number-widget rows where options should not appear at all.)*

t2387 found and fixed exactly this class — `jsonDef` bakes literal captions as separate unnamed labels, so
hiding a field left its caption floating — but the fix evidently covers ONE hiding path and not the other.
⚠ Establish with the file in hand which path leaks: the ENABLER hide (shown = non-empty) vs the WIDGET-driven
hide (`fieldsFor` says the field does not apply). The screenshot's rows are un-revealed number rows, so the
widget path is the suspect. Same treatment as t2387's fix, applied to whichever path missed it — and a check
across the other captioned fields (nmin/nmax/nstep/units, whenparam/whenis) so this is the last of the class.

**STILL REAL IF:** open any twin's Parameter Group, look at a number-widget row — a trailing bare `options`
word means still real.

✅ **SHIPPED t2405** — confirmed: the WIDGET path (`fieldsFor` gating — `dynamic`+`fieldsFor`, the mechanism
this whole arc's holecycle/param/progend/drillcycle/slot/pocketfill/surfaceFill/region fixes all use) was the
leak, exactly as suspected — it had NO named-caption treatment at all (t2387's own fix scoped it to `enablers`
fields only). Widened `jsonDef()`'s own condition (`bridge.js`): any field on a block declaring BOTH `dynamic`
and `fieldsFor` now gets the same independently-hideable `_LBL` caption every `enablers` field already had;
`apply()`'s own value-visibility loop toggles it in the same pass. `nmin`/`nmax`/`nstep`/`units`/`whenparam`/
`whenis` were ALREADY correct (all five are `formfield`'s own declared `enablers`, covered since t2387) —
checked live, confirmed unregressed, not just assumed. Non-vacuity proven by perturbation (reverting the
widened condition reproduces the exact `NO_LBL_FIELD` gap on a previously-broken case). Screenshot:
`verification/t2405-caption-fix.png`.

---

### 54. [✅ SHIPPED t2407 — 530KB→2.8KB stdout, three surfaces live. ⏳ ONE FOLLOW-UP BELOW: compact the md] THE FULL SUITE HAS NO PROGRESS SURFACE — and its current reporter burns the worker's context

> ### ✅ FOLLOW-UP DONE (`c29e1d10`) — ⛔ WORKER: do NOT rebuild this, it is already shipped.
> **Advisor-authored directly** at the owner's ask ("sorry you cant do that yourself?") — test infrastructure,
> not product code, same exception as `debug/dragProbe.js`. `renderMd` now emits the four compact lines below;
> the table and its blank header row are gone; the bar keeps its backticks (monospace is what aligns the block
> glyphs). `node --check` clean. ⚠ `progress.html` was left ALONE — it has more room and the owner did not ask.
>
> *(original ask, owner 2026-08-29 watching it run: "compact the progress md ui to be less tall")*
>
> The six-row vertical table renders very tall (a full screen for six numbers). Collapse to **four lines**,
> and drop the table entirely — a markdown table cannot be short:
>
> ```
> ## Suite progress
> ████████████████░░░░░░  71.6%
> **2132 / 2976** · ✅ 2098 · ❌ 1 · ⚠ 10 · ⊘ 23 · 19m5s elapsed · ~7m left
> `tests/whatever-is-running.spec.js`
> ```
>
> - ⛔ **No table** — one bar line, one stats line, one current-spec line.
> - ⭐ Fix the **empty header row** (`| | |` renders as a blank strip) — it disappears with the table.
> - ⚠ Establish whether the bar should keep its backticks: they force monospace (so the blocks align) but
>   render it as inline code. If a plain bar aligns acceptably in the preview, drop them; if not, keep and
>   say why.
> - Keep the heartbeat/stale marker and every number — this is a LAYOUT change, nothing is removed.
> - `progress.html` may want the same slimming; use judgement, it has more room.

*(owner-asked 2026-08-29: "is there a way to indicate progress on full suite… like a progress bar", then
ruled the surface after two rounds — ⛔ NOT the terminal, ⛔ NOT the chat (a sent message cannot redraw), and
⛔ not anything needing a server, because their Live Preview is occupied by the app itself.)*

**Two problems, one fix.** A full suite is 25-50 minutes with no sense of how far along it is — AND
`playwright.config.js:19` uses the `list` reporter off-CI, which prints **one line per test, ~2900 lines
every run**, straight into the worker's context. At ~25-30k characters that likely exceeds the tool's own
truncation, so most of it is paid for and then discarded. The useful part — failures and final counts — is
at the end regardless.

### THE SHAPE

```
reporter writes   test-results/progress.md    (+ .html, + .json)   — files, ZERO stdout cost
worker's stdout   failures + final summary only                    — far cheaper than today
owner watches     progress.md in VS CODE'S OWN MARKDOWN PREVIEW    — no server, no browser,
                  (re-renders on disk change, docks beside code)      does not touch Live Preview
phone / browser   progress.html — numbers BAKED IN + a 2s meta-refresh, opened as a plain
                  file:// — no server, no fetch, no CORS
advisor           reads progress.json to answer "how far?" on demand
```

Content: a block-character bar, percent, N/M, elapsed, ETA, pass/fail/flaky counts, the currently-running
spec, and ⭐ a **heartbeat timestamp** so a stalled or dead run reads as "stalled 6m ago" instead of
confidently sitting at 47% forever.

### ⚠ ESTABLISH, don't guess

- Whether to keep a compact stdout fallback (`dot` — one char per test, what CI already uses) or go fully
  silent-except-failures. Fully silent is cheapest, but a 40-minute command with no output can look hung —
  a heartbeat line every few minutes may be worth its tiny cost. Decide and say which.
- That `test-all.cjs`'s `stdio: 'inherit'` still surfaces failures unchanged — ⛔ the failure output is the
  part that matters and must not get quieter.
- Playwright custom reporters are a supported API; this needs no new dependency.
- ⭐ **AUTOMATIC BY CONSTRUCTION**: declared in `playwright.config.js`, so `npm test` (via `test-all.cjs` →
  `test:e2e`) and `test:changed` pick it up with no flag and nothing to remember. ⚠ TWO GAPS to decide:
  `test:smoke` uses its OWN config (`playwright.smoke.config.js`) so it needs the same reporter line added
  there, and the NODE tier (`test:node`) is not Playwright at all — either leave it uncovered (it is fast,
  progress is moot) or have `test-all.cjs` write the two tiers' phase into the same file. Say which.
- ⭐ Follow the JSON reporter's own precedent (`playwright.config.js:16`, "runs UNCONDITIONALLY, local + CI
  alike") — the progress reporter should too, rather than branching on `process.env.CI`.

**VERIFY:** run a real suite, watch `progress.md` update in the markdown preview, confirm the worker's own
captured stdout shrank dramatically, and confirm a killed run leaves a stale-marked file rather than a lie.

---

### 55. [✅ SHIPPED t2413 + ⭐ OWNER-CONFIRMED ON THE DEPLOYED SITE 2026-08-29: "yes value stays" — root was NOT the drag, NOT release-timing: writeAuthoredValue silently no-oped for every placed op on EVERY input method, confirmed by direct call before touching any code] THE DRAG COMMITS, THEN REVERTS — the release restores the value the op had on entering the Blocks tab

*(owner, 2026-08-29, testing t2409's fix on V2026.08.29.12: "the rect now correctly drags but on release it
changes back to the value it was when entering blocks tab.")*

⭐⭐ **Almost certainly PRE-EXISTING and newly VISIBLE, not a regression from t2409.** Before that fix the
canvas never moved during a drag at all — so a snap-back on release had nothing visible to snap back *from*.
Fixing the redraw half exposed the second half of the same severed loop. Treat it as the rest of #46, not as
damage.

### THE OWNER'S OWN CAPTURE — the fix is provably correct THROUGH release

`?debug=feat`, `hid:sf_size` (surfacing), abridged:

```
f0    ptr:2135,505   handle:2132,509   writes:0    redraws:0     ← pre-move
f3    ptr:2128,513   handle:2128,513   writes:4    redraws:3
f7    ptr:2096,540   handle:2096,540   writes:12   redraws:7
▲ up  ptr:2055,560   handle:2055,560   writes:20   redraws:12
```

⭐ **`handle` equals `ptr` on every frame, including the pointer-up frame**, and redraws climb with writes.
⇒ The drag, the redraw and the release are all CORRECT. **The revert happens AFTER the probe's last frame**,
outside its window — a post-release event.

### THE LEAD

⚠ **Establish, do not assume**: 20 writes land during the drag, yet the value reverts to the ENTRY-TIME one —
so the suspicion is that the drag writes and the post-release rebuild read **two different stores**. Candidate:
`blocksApp`'s reactive `reproject()` (async, fires after the gesture — t2409's own commit message names it as
"always a beat late") rebuilds the pane from the block model / `opBlk.data` params, while the drag's writes
went to the live def or DOM and never reached those params. If so, ANY full re-render would restore the old
value; the release is just the first one that happens.

- ⭐ **Extend the probe past release** — it currently records one settle frame after `up`. Log the handle
  position and the model's own param value for ~2 seconds afterwards; the frame where they diverge names the
  culprit call.
- ⭐ **The same control still applies**: the wizard's own host does NOT revert. Diff what it commits on
  release against what the pane does.
- ⛔ Do not "fix" this by suppressing the post-release re-render — that would hide a genuine
  two-stores-disagree defect. Find which store is authoritative and make the drag write to it.
- ⚠ This is also exactly what the ruled **commit-on-release** design (#46) would formalize — one authoritative
  write at the end. It stays sequenced behind **#50** (rapid writes invisible to undo), and the ~2-writes-per-
  frame in both captures keeps arguing for it.

**STILL REAL IF:** drag a feature handle in the Blocks tab's Wizard View, release, and watch the value —
returning to what it was when you entered the tab means still real.

> ⭐⭐ **t2413 — FIXED. The root was neither "the drag" nor "release timing" — established, not assumed,
> before writing a line of code.** Extended `web/debug/featProbe.js` exactly as asked: it now keeps sampling
> for 2s past pointer-up (not one settle frame) and logs a `model:` fingerprint alongside the handle position
> (`window.ddcsGetBlockProgram()`'s own first op's `params`, JSON-stringified — a generic signal, no per-op
> field-name plumbing needed since the pane holds exactly one op at a time). Ran it on a real drag: `model:`
> stayed at the ENTRY value for every single frame, through the whole drag AND the whole 2s post-release
> window — not "changes then reverts," but **never changes at all**. The "revert" the owner sees is the FIRST
> re-render that ever reads the canonical store, exposing a write that was never there.
>
> Confirmed by calling the write function directly (`writeAuthoredValue(ws, 'w', 999)`) rather than inferring
> from the symptom: it returns `false`. Traced why: it resolves its target through `deriveAuthoredDef(ws)`'s
> own `bindings`, an AUTHORING-canvas concept — an exposed-knob checkbox (now vestigial, `collectAuthoring`'s
> own comment: "the EXPOSE_ checkbox this reads no longer exists anywhere... exposures is always []") or a
> `param_field`/`param` block on the canvas. A normally PLACED op (bar → Insert → Blocks tab) has NEITHER —
> `deriveAuthoredDef` returns `bindings: []` for it, always, confirmed live (`defBindingsLen: 0`). **This is
> not specific to canvas drags at all** — a plain TYPED edit into the SAME form field, driven the same way any
> keystroke would, showed the identical symptom (form value AND model both reverting to 80) before the fix,
> proving the severance is in the write PATH itself, not the drag gesture.
>
> **Which store is authoritative, established by reading the actual code, not guessed**: `stackBridge.js`'s
> `workspaceToStack` (what `window.ddcsGetBlockProgram()` ultimately calls) reads an `op`-type block's own
> `params` straight off its `.data` JSON — never by re-deriving from its exec atoms. `deriveLiveWizard()`'s own
> `placedOpFallback` branch already reads exactly that (`opBlock.params`) to SEED the form/canvas on every
> render. So `.data`'s own `params` IS the one store both the read side (form seed) and `ddcsGetBlockProgram()`
> agree on — the fix routes the write there directly, per the dispatch's own instruction, rather than chasing
> `writeAuthoredValue`'s own (wrong-for-this-case) nested-atom-socket target.
>
> A second, independent bug compounded the first and would have sunk even a correct write: `deriveLiveWizard()`
> computes `opBlock` (the placed op's own stack record, carrying the `.id` needed to reach the live block) but
> never included it in its own return statement — any `placedOpFallback`-gated caller destructuring `opBlock`
> got `undefined`. Found by adding a debug trace rather than assuming the new code was wrong on the first
> failed attempt — the fix worked the moment both bugs were closed together.
>
> **THE FIX** (`web/blocks/blocksApp.js`, `blkView`'s own `onFieldWrite`): for a placed (not authored) op,
> patches the op's own Blockly block `.data` JSON directly (`meta.params[param] = value`) — no `setFieldValue`,
> no target to write one to — then calls `reproject()` to refresh `programModel.js`'s own CACHED stack
> (`getStack()`/`window.ddcsGetBlockProgram()` only updates via `setStack()`, and a direct `.data` mutation
> fires no Blockly change event, so nothing else would refresh it). `deriveLiveWizard()` now returns `opBlock`
> too. Deliberately does NOT rebuild the op's own exec atoms (`mergeOpBlocks`'s heavier job — a full workspace
> reload, measured too costly to call every drag frame) — scoped to making the write reach the ONE store the
> form/canvas already reads from, not the full commit-on-release redesign #46/#50 already rule out of scope
> here (noted again: both this turn's own capture and the owner's keep showing ~2 writes/frame, still arguing
> for it, still not this turn's job).
>
> **VERIFIED, every claim live:**
> - A typed edit: `writeAuthoredValue` confirmed returning `false` pre-fix (`window.ddcsGetBlockProgram()`
>   frozen at 80 through a 600ms settle); post-fix, both the form field AND `window.ddcsGetBlockProgram()`
>   read 123, staying there through the same settle window.
> - A real drag with the extended probe: `model:` climbs WITH the handle every frame (`w:80→81.34→…→101.46`,
>   matching the pointer 1:1), and — the exact window #55 reports the revert in — stays at `w:101.463,
>   h:49.268` for the full 2s post-release sampling window, confirmed independently via
>   `window.ddcsGetBlockProgram()` after the probe stopped.
> - Reverted the fix (`git stash`) and re-ran the same two checks: both correctly FAIL against the pre-fix
>   code (the typed-edit check reads 80 instead of 123; the drag check sees `rightAfterUp === 80`, i.e. the
>   drag itself never even briefly changed it) — proving the new spec isn't vacuous, not just asserting it.
> - Regression: the shell's own `pocket-canvas.spec.js` (the confirmed-working control) still green; the
>   Blocks pane's "Open as modal" door (t2409's own spec, real wizardManager, `onFieldWrite` unset there —
>   never touched by this fix) still green; t2409's and t2411's own permanent specs all still green after this
>   turn's edit to the same shared file.
> - Committed as a permanent spec, `tests/blocks-pane-drag-persist-2413.spec.js` (2 tests).
>
> One test-tooling note, not an app bug: Playwright's own `.fill()` silently failed to commit a value on this
> specific field in this harness (verified: a manual `.value=` + a real dispatched `input` event works
> cleanly where `.fill()` left the field unchanged) — every check in this turn drives the DOM the same way a
> real keystroke would rather than relying on `.fill()` here.

---

### 56. `open-as-modal-1625.spec.js`'s "A REAL OPEN AFTER A PREVIEW…" flakes under full-suite contention — 4 turns running

*(filed t2413, per the advisor's own instruction: "if it appears a 4th time, stop and file it as its own entry
rather than re-triaging it every turn.")*

`open-as-modal-1625.spec.js › A REAL OPEN AFTER A PREVIEW gets its INSERT back — the preview chrome cannot
leak` has been the SOLE (or dominant) full-suite failure four turns running: t2407 (6 failed, this one among
them — before ANY of this arc's own `blocksApp.js` edits existed), t2409 (1 failed, this one alone), t2411 (1
failed, this one alone), t2413 (1 failed, this one alone). Each turn re-confirmed it's not that turn's own
regression (isolated single-worker runs pass 3/3 clean every time; a targeted contention rerun in t2409 showed
it pass while a DIFFERENT unrelated file flaked instead, matching this suite's own documented
"contention-starved population shifts run to run" behavior). That per-turn triage is real work repeated four
times for the same finding — this entry exists so a fifth occurrence doesn't repeat it a fifth time.

The test's own header (t1902) already names the mechanism: its preview auto-plays/loops the instant the
wizard mounts, and that ongoing repaint can destabilize `#blkOpenModal`'s own actionability check for the
NEXT click under load — `customizeCorner()`'s own `stopLiveSim()` call was added specifically to counter this,
and evidently doesn't fully close it under 6-worker contention. Not investigated further this turn (out of
scope for t2413's own dispatch) — worth a dedicated turn if it recurs, starting from: does `stopLiveSim` miss
a SECOND animation source beyond `.pp-run.on`, or does the actionability wait itself need a longer/more
tolerant window under measured contention.

**STILL REAL IF:** a full-suite run shows this test (and only unrelated others, never a repeat of THIS one
tied to a real code change) failing again on a turn that touches none of `blocksApp.js`/`opContextMenu.js`/
`userOpView.js`/the preview-panel chain.

**t2507**: appeared at `--workers=4` too (two runs in a row, same test), a config this entry hadn't previously
named — the file itself references nothing that turn touched and passes 3/3 isolated, matching the SAME shape
as every prior occurrence. The advisor's own likely explanation: their own verification commands were running
against this shared machine concurrently with the worker's suite, adding contention beyond the worker process
alone — plausible given this is a contention-sensitive flake by its own documented mechanism, not confirmed
further. Still not an investigation; still the SAME entry, not a new one.

⚠ **RULED (t2593), not merely deferred — genuinely environmental, no further code fix attempted.** A REAL
mitigation was already tried and shipped: `tests/support/simControls.js`'s own `stopLiveSim` (t2419, cited
inline in that file) was rewritten from a single one-shot `.pp-run.on` check to a POLLED check (up to 2000ms),
specifically because the one-shot version could look a beat too early under load and do nothing — the exact
"actionability wait needs to be more tolerant" angle this entry's own header left open. **It measurably
narrowed, but did not eliminate, the flake** — this test continued to appear as isolated-clean contention churn
across dozens of turns after t2419 shipped (WORK-LOG's own running "already-documented BACKLOG #56 contention
flake — 3/3 clean in isolation" refrain, repeated at t2507 and many turns since). Checked this turn whether the
OTHER open angle (`stopLiveSim` missing a second animation source) is live: read `open-as-modal-1625.spec.js`
in full — the failing test already calls `stopLiveSim` on BOTH the Blocks-pane preview (`#blk_wiz_user`, inside
`customizeCorner`) AND the modal's own separate preview (`#wiz_user`, after the door opens) — t1902's own
comment already names this as "a second, independent instance of the SAME mechanism," already handled, not a
gap. **Not attempting a further speculative fix**: the ONE remaining candidate (making `#blkOpenModal`'s own
actionability wait itself more tolerant) cannot be verified without reliably reproducing 6-worker CONTENTION on
demand, which this repo has no deterministic way to force — a change made without being able to test it against
the actual failure condition would be exactly the "forced fix that makes it rarer and less understood" the
owner's own stated preference rules out. `playwright.config.js`'s own global `retries: 2` (t1724) already
absorbs this class of flake correctly: a contention-only failure that clears on retry reports as FLAKY, not
FAILED — the suite's own failed-count already reads clean through this, today, without any further change. This
entry's own **STILL REAL IF** condition remains the correct trigger for re-opening — a HARD failure (not
retry-recovered) tied to a real code change in the named files — not "did the flaky count move."

---

### 57. [✅ FIXED t2593] `undo-reproject-echo.spec.js`'s "a real block-value edit is undoable" flakes standalone — NOT contention, confirmed by A/B revert

*(found t2417, while investigating a 3-failure full-suite run for that turn's own #52/#51/scrollbar/mobile-
button work)*

Different SHAPE of flake than #56: `open-as-modal-1625` only misbehaves under 6-worker contention (isolated
single-worker runs are clean); THIS one flakes even alone, `--workers=1`, no contention at all —
`tests/undo-reproject-echo.spec.js:46:1 › a real block-value edit is undoable (the app-wide path still works
after the sig change)` failed 2 of 4 solo runs in one sitting, and failed 4 of 6 runs on a completely reverted
tree (`git stash` of every file t2417 touched: `blocksApp.js`, `opContextMenu.js`, `styles.css`) — **the fail
rate is the same order of magnitude with or without this turn's own code, which is what rules t2417 out** (not
a guess: two separate A/B samples, both showing the test fails roughly half the time regardless of which tree
is checked out).

Not investigated further this turn (out of scope for t2417's own four dispatched items) — a first hypothesis
for whoever picks it up: the test's own fixed `page.waitForTimeout(350)` after `load()` (`await load(page, 5);
await page.waitForTimeout(350);`, twice in this test) is explicitly commented as "let the async reproject echo
fire" — a fixed sleep guessing at an async settle time is a classic source of exactly this shape of
intermittent failure (sometimes 350ms is enough, sometimes it isn't, under whatever load happens to be on the
machine at that moment even solo). Worth trying `page.waitForFunction` on the actual reprojected value instead
of a blind timeout, mirroring how the file's OWN `waitX` helper already does it correctly for the LOAD steps —
the raw `page.waitForTimeout(350)` calls are the one place in this file that doesn't.

⚠ **t2463 — STILL REAL, confirmed live (3 of 4 solo `--workers=1` runs failed/flaky) — but THE FIRST HYPOTHESIS
DOES NOT MATCH THE EVIDENCE, corrected here rather than mechanically applied.** The test's own real failure —
read from the actual Playwright error, not assumed from the theory — is `page.waitForFunction: Timeout 6000ms
exceeded` at **line 62**, `waitX(page, 5)` called AFTER `clickUndo(page)` (the "Undo reverts the value edit"
assertion). Line 62 is **already** a proper `waitX` call, not a raw `waitForTimeout` — the ONE raw
`page.waitForTimeout(350)` inside this specific test (line 48) sits BEFORE a `waitX` on the very next line
(line 49), which already makes it redundant (a `waitX` immediately after would wait however long is actually
needed regardless of the fixed sleep before it) and, more importantly, unrelated to where the timeout actually
fires. **The real race is downstream of Undo itself** — the model sometimes does not reach the pre-edit value
within 6 seconds after a real block-value edit + Undo — a genuinely deeper timing question in the undo/
reproject pipeline than "swap a sleep for a proper wait," and NOT fixed this turn (t2463's own scope was the
mutation manifest; this was picked up as its declared "small item," and swapping in a hypothesis that doesn't
match the observed failure would fix the wrong thing while leaving the test still flaky). Left open, hypothesis
corrected, for whoever picks it up next: start from line 62's own timeout, not line 48's redundant sleep.

**STILL REAL IF:** this specific test fails again — alone, `--workers=1`, no other file failing alongside it —
on a turn that touches none of `blocksApp.js`/the undo/reproject machinery (`opEdits.js`, the gesture-boundary
tracking in `blocksApp.js`'s own `ws.addChangeListener`, `programModel.js`'s `getStack`/`setStack`). ⚠ t2463's
own re-check: still fails this way (3/4 solo runs) — the check itself still holds, only the FIRST hypothesis
above needed correcting, not the entry's own open status.

**t2593 — FIXED, root cause found by TRACING what the timeout at line 62 actually observes, not by re-guessing.**
Built a diagnostic that, instead of a single `waitX` after Undo, POLLED the model's own `x` value every 200ms
for the full 6-second window and logged the trace. Result: the model did NOT arrive at the expected value LATE
— in 6 of 8 runs it went straight to **`EMPTY`** (the state TWO steps before the edit, past the `load(page,5)`
checkpoint entirely) and stayed there for the whole window. **A genuine race, not a threshold to raise**: one
Undo click was popping two history states instead of one. Traced to the test's own fixed
`page.waitForTimeout(350)` after `load()` — not a long enough quiet window under load for the muted reproject
echo to fully settle before the real edit + Undo sequence; `saveStates.js`'s own `flushPendingGesture()`
(called by every `undo()`, added to fix a related but different race — see its own header) forces whatever
gesture is STILL debouncing to flush right as Undo reads history, so a late-settling load-echo lands as an
unwanted extra entry at exactly the wrong moment.

**Fix, test-side only**: replaced every `page.waitForTimeout(350)` in this file with an event-driven quiet-
window wait (`waitQuiet`, new helper in the file) — subscribes to `saveStates.js`'s own exported `onChange`,
resolves once no new snapshot has fired for 400ms (capped at 4s), never a blind sleep. **Proven, not asserted**:
the diagnostic's own exact repro, run 16/16 times with `waitQuiet` in place of the fixed sleep — 16/16 clean,
`x` arrives at the expected value immediately every time, zero `EMPTY` occurrences (vs. the ~75% failure rate
measured with the fixed sleep, same repro, same machine). Applied to the real file and re-run 8x per test
(24 total runs): **24/24 passed, 0 failed, 0 flaky.** Zero product code changed — `saveStates.js`/`blocksApp.js`
untouched; the fix is entirely in the test's own synchronization. Full account: WORK-LOG t2593.

⚠ **t2467 (small item, characterization only, per that turn's own explicit "do not fix either" scope) — checked
against #63 for a shared root, per #63's own "worth someone eventually asking" note. NO shared code path
found; refuted, recorded rather than left open.** This test's own timeout fires at line 62, `waitX(page, 5)`
called AFTER `clickUndo(page)` — reached only once boot has ALREADY succeeded earlier in the same test. #63's
timeout fires at `page.goto('/')` → `waitForFunction(() => window.ddcsStudio && window.showApp)`, before
anything else runs. `window.ddcsStudio` is set by `app.js`'s `finishBoot()` on `DOMContentLoaded`;
`window.showApp` is set independently by `ui/gatewayStatus.js:239` — a separate module load, unrelated to the
undo/reproject pipeline this test's own timeout sits inside. Two different waits, two different subsystems, no
shared specific mechanism. The only plausible common factor is generic async-scheduling slowness under whatever
load the machine happens to be under — not a specific shared bug, and not actionable as a merge target. Cross-
linked from #63.

---

### 58. [✅ SHIPPED t2423 — container-query gate, same 860px figure, asked of the pane instead of the window] THE WIZARD VIEW PANE SIZES ITSELF FROM THE WINDOW, NOT FROM ITSELF

*(owner, 2026-08-29, with a 2535px-wide screenshot of the Blocks tab: "on very wide screen the wizard preview
should render as for desktop, it should respect the same screen size rules" — then the decisive clarification:
**"but from the panel"**. And again, 2026-08-30: "the wizard preview is not using desktop width layout still".)*

```
WAS    the pane's layout followed the WINDOW width (a plain viewport media query)
       → window 2535px, but the PANE is ~1230px
       → it stacked 3D above 2D above form — the phone layout, on a huge screen

NOW    the pane's layout follows THE PANE'S OWN width
       → a 1230px pane lays out like a 1230px screen would (the desktop wizard:
         form left, visual right)
       → drag the pane narrow and it degrades to stacked ON ITS OWN, live
```

**Two wrong theories died first** (recorded so nobody re-walks them): the advisor blamed the 860px viewport
query "never firing" at a wide window; the owner reasonably assumed the pane was being measured and had grown
big enough. Neither was happening — `styles.css`'s `#blk_wiz_user .wiz-2pane` block (and its 11 sibling rules)
was UNCONDITIONAL, no query of any kind, no measurement of anything. Its own comment explained why: written
when `#blk-formpane` genuinely never crossed ~380px (it shares the window with the Blockly canvas + palette),
so the rule "mirrors the ≤860px block's own rules verbatim, unconditionally, since the pane's available width
never crosses the threshold that layout needs" — correct for the case it was written for; the owner's own pane
is now routinely well past that, on any reasonably wide monitor, which that author never anticipated.

**Owner ruling: do not make new rules.** Reuse the 860px figure the rest of the app already uses for this
exact stacked-vs-two-pane decision — only WHAT is measured changes, never the number.

**Fix**: `#blk-formpane { container-type: inline-size; }` (styles.css:~6543) — safe because this element's own
width is externally set by the splitter (`flex:1`, `.blk-col-resize`'s own drag handler writing `--blk-pv-w`
on `#blocks-app`), never by its own content, which is the one condition size-containment needs to avoid being
circular. The 12-rule stacked-layout block moved from unconditional into `@container (max-width: 860px) { … }`
— the identical rules, byte-for-byte, just gated. `#wiz_user` (the modal) was never inside `#blk-formpane` to
begin with, so no container query here can ever reach it regardless of pane width — confirmed live, not
assumed (widened the pane splitter FIRST, the condition that would expose leakage if there were any, then
opened the modal and checked both a wide and a narrow VIEWPORT: still purely viewport-driven, unchanged).

**VERIFIED, every claim live**: a very wide window with the pane at its default (~380px) width still stacks —
byte-identical to before (confirmed via the pre-existing `screenshot-baselines-1792.spec.js`'s own baseline
comparison passing unchanged). The SAME wide window, pane dragged past 860px via the real splitter handle,
renders the desktop two-pane layout (`flex-direction: row`) — the owner's own reported case. Dragging back
narrow degrades it to stacked again LIVE, no reload. The modal stays viewport-driven at every width tested.
64 of the pane's own existing tests (visual host, splitter, screenshot baselines, param groups, render
equivalence, the modal's own gesture tests) re-run clean, 0 regressions. `tests/wizard-view-pane-container-
width-2423.spec.js` (4 new tests), non-vacuous — 2 of the 4 correctly fail against the pre-fix CSS with the
exact predicted behavior (stays "column" even when widened past 860px).

**VERIFY:** the owner's own case — very wide window, Blocks tab, pane at default width → renders as the
desktop wizard (form left, visual right); drag the splitter narrow → degrades to stacked, live, without a
reload; wizard modal unchanged at several viewport widths.

---

### 59. [✅ SHIPPED t2423 — one word, `field_ref`'s category corrected] AN "UNCATEGORISED" PALETTE GROUP WAS SHOWING

*(owner, 2026-08-30: spotted a stray "Uncategorised" group in the Blocks palette containing a lone `field_ref`
block.)*

Traced: `fieldRef.js` declared `category: 'Wizard Form'` — a name absent from `CATEGORIES`
(`wizards/ops/index.js:141`), so it fell through to `bridge.js`'s own catch-all (t1570), which exists
specifically to catch this class of mistake (its own comment: "a new block, a typo, a category added to a def
but not to the list") rather than silently dropping the block from the toolbox. **The catch-all worked exactly
as designed** — a real typo caught, not a defect in the guard.

**Category chosen deliberately, not mechanically**: `field_ref`'s own docstring is explicit that it does NOT
declare a bound field the way every `Wizard Inputs` member does (formfield/param_field/the pickers) — it
RELOCATES an already-declared row's position in the presentation tree, the same "where things sit" concern
`Wizard Layout`'s own members (grid_container/group_box/layout/split_*) exist for. Filed under `Wizard Layout`
rather than the owner's own initial lean (`Wizard Inputs`) on that concrete basis, stated in the block's own
comment. No new `Wizard Form` category added (would leave a category holding exactly one block, and legitimizes
the typo rather than fixing it).

**VERIFIED**: no "Uncategorised" group renders (`PALETTE`'s own category set now equals a subset of
`CATEGORIES`); `field_ref` reachable under Wizard Layout; the pre-existing `palette-no-block-vanishes-1570.
spec.js` (the general reachable-set invariant this exact scenario is drawn from) stays green.
tracking in `blocksApp.js`'s own `ws.addChangeListener`, `programModel.js`'s `getStack`/`setStack`).

---

### 60. [MEASURED t2457, NOT SHIPPED — reading/research only] WIZARDS-AS-DATA EMIT EQUIVALENCE: DIALECT COVERAGE
IS UNEVEN ACROSS 25 ALREADY-TESTED TWINS, AND 3 TWINS HAVE A REAL, TESTABLE GAP WITH NO TEST AT ALL

*(owner, thorough-measurement ask, 2026-08-31: "we need to be thorough" — dispatched as a check on whether
wizards-as-data actually works fully, after the advisor told the owner the arc was "essentially complete" then
found only 5 of 32 twins had an equivalence spec by one narrow naming-pattern grep. Full account: WORK-LOG
t2457.)*

⭐ **THE ADVISOR'S OWN "5 of 32" COUNT WAS WRONG BY ~5x** — 25 of the 32 wizards-as-data twins already have a
genuine, non-tautological byte-identical equivalence test; they were just named `*-data-emit.spec.js` /
`*-twin.spec.js` / `*-in-place.spec.js` / `*-cross-dialect-*.spec.js`, which a grep for `*-as-data.spec.js`
alone never finds. **This entry is NOT "the arc is broken" — it corrects a premise, then names what's actually
missing**, which is narrower and differently-shaped than "27 untested twins."

**THE CRITERION, established with the file in hand (do not skip this before touching anything here)**: a twin
is genuinely, independently testable only if its `instantiate()`/`postInstantiate` calls the hand-written
builder AT MOST ONCE (to seed a frozen template, then drives every instance through DECLARED bindings) — never
if it re-invokes the hand-written builder LIVE with the current params on every instantiate (that's
tautological: the twin cannot diverge from the thing it's calling). Full reasoning + the 32-row evidence table:
WORK-LOG t2457.

**What's actually open, in two independent parts — fix them separately, they are not the same shape of work:**

1. **14 of the 25 tested twins have partial-to-zero cross-dialect coverage** (`middle`/`edge`/`corner`/
   `alignment`/`tap`/`surfacing` = zero; `bore`/`wcs`/`contour`/`comm`/`ioStep` = partial, missing dialects;
   `atc_check`/`atc_length`/`atc_test` = thin, 1-2 reps/dialect on top of a bigger single-dialect sweep). **Cheap
   and mechanical** — the exact pattern is already proven 11 times over (drill/slot/text/atc_warmup/pocket/
   homing/atc_change/atc_table/rotaryCenter/rotaryClock/parting all do it correctly); add a `listPosts()` cross-
   dialect test (or widen an existing thin one) per op, mirroring any of those 11. No design decision needed.
2. **3 twins have NO equivalence test despite 2 of them being straightforwardly testable**: `facing` and
   `centerDrill` use the SAME frozen-template-once pattern as drill — a real `*-data-emit.spec.js` for each is a
   same-shape port of an already-proven pattern. `odTurn` is different and harder: its `postInstantiate` calls
   `odTurnStack` LIVE every time, which is tautological by construction — writing a MEANINGFUL test here needs a
   prior design decision (does odTurn's own architecture change to a frozen-template pattern, or does the claim
   being tested get reframed to "the delegation glue is correct," a genuinely weaker and differently-worded
   claim?) — do not build a test that reads like the other 11 but proves less, per this session's own standing
   rule against dressing a weaker guarantee in a stronger one's language.

**Correctly OUT of scope, not a gap**: `faceProbe`/`odProbe`/`polygon`/`pauseConfirm` — no second implementation
was ever registered for these (`SEED_BUILDERS` holds only the data def), so there is nothing to be
byte-identical WITH. An equivalence spec here would compare a thing to itself.

**Separately named, not investigated further**: the FORM-side ratchet (`twin-form-completeness-1581.spec.js`,
the same `SEED_BUILDERS`-driven sweep, genuinely 32/32) checks field PRESENCE and WIDGET-TYPE fidelity only —
zero occurrences of `label`/`help`/`default` in that file. Whether every twin's field text (not just its
existence) matches its declared metadata is unexplored.

**STILL REAL IF**: `grep -L "listPosts\|profileId" tests/{middle,edge,corner,alignment,tap,surfacing}*.spec.js`
lists all 6 (zero dialect coverage still true) OR `grep -c "postInstantiate.*Stack(" web/blocks/dataOps/
odTurnData.js` still returns ≥1 with a live-param call (odTurn still tautological) OR no test file diffs
`facingStack`/`centerDrillStack` against their own twins. Any of these returning false means that PART of this
entry shipped — re-check per-part, do not treat the whole entry as one unit (rule 8b: a partial ship with a
heading still claiming "open" for the whole thing is the same trap this entry itself was filed to stop).

### ⭐⭐ t2469 — `facing`/`centerDrill` TESTS SHIPPED, item 2 of the two-part gap — but `facing` was NOT as
straightforward as this entry's own header claimed, corrected here rather than mechanically ported

`tests/centerdrill-data-emit.spec.js` (new) — `centerDrillDataDef` is genuinely FUNCTIONALLY byte-identical to
`centerDrillStack` across a 7-entry sweep (`stripAnnotations`), plus cross-dialect (7 dialects × 3 reps, 0
diffs). ONE precisely-named cosmetic frontier: `kind:'straight'` writes a more specific `postInstantiate` note
than the reference's generic one — same `#162=0`, different comment text only; the raw (non-stripped) sweep is
asserted to diverge on EXACTLY those two entries and nowhere else, not "mostly passes."

`tests/facing-data-emit.spec.js` (new) — **found a genuine, previously-unknown functional frontier writing
this test, not assumed from this entry's own "no design call needed" framing**: `facingStack` is byte-identical
to the twin across `doc`/`feed` (7-entry sweep + cross-dialect, clean), but `allowance` and `finish` do NOT
converge, for two different reasons — `allowance` IS a bound register (`#111`) but the SAME value ALSO drives
two Z heights (`G0 X#113 Z<n>`, the final `G0 Z<n>` retract) computed via plain JS math ONCE at template-freeze
time, using `FACING_DEFAULTS.allowance` — the register updates live, those two Z literals never recompute;
`finish` is not bound at all, always the default. (`xStart` diverges too, but BY DESIGN, confirmed separately:
the twin binds it as an independent field while `facingStack` computes it live from unbound `barDiameter`/
`clearance` — not the same shape as the other two, not conflated with them.) All three are asserted as
STILL-OPEN/BY-DESIGN frontiers (mirroring drill's own solved/still-open language) — regression tripwires that
flip to passing if a future `postInstantiate` (mirroring `centerDrillData.js`'s own `applyStraightPeck` shape)
recomputes the two baked Z heights live. **Not built this turn** — a real code change (new `postInstantiate`
logic), out of scope for "write the test," and this session's own standing rule against a test claiming more
than what was proven. Full account: WORK-LOG t2469.

**STILL REAL IF**: `grep -c postInstantiate web/blocks/dataOps/facingData.js` still returns 0 (the frontier is
still unfixed) — if it returns ≥1, re-run `facing-data-emit.spec.js`'s own `allowanceFrontierPass`/
`finishFrontierPass` assertions FIRST (they're written to expect `false`; a fix would need them flipped to
`true`, not the whole entry re-litigated from scratch).

⚠ **t2471 (small item) — is `finish` a control that LIES? Is `allowance` reachable, and does editing it after
placement do anything real? Determined, not fixed, per the dispatch's own 20-minute-check scope.**

`finish` is **NOT reachable — a clean negative, not a lying control.** Confirmed two ways: (1) static — `finish`
never appears in `FACING_BINDING_SPECS`, the ONLY source `facingData.js`'s form fields are derived from
(`deriveBindingsFor`), and `facingDataDef` has no `postInstantiate` or other injection path that could add a
field outside that list; (2) live — opened the real Blocks-tab form for `user_lathe_facing` and read its
actual rendered `[data-param]` inputs: **exactly `allowance`, `doc`, `xStart`, `feed`** — the same four, no
more, no fewer. `finish` genuinely never reaches the user; it stays permanently baked at `FACING_DEFAULTS.
finish` (`0`, no finishing pass) as an internal constant. Not a control that lies — there IS no control.

`allowance` **IS reachable, confirmed live** (the real "Material to remove" form field, editing it via a real
`input`/`change` event genuinely changes the emitted program — confirmed `program changed: true`) — so this is
NOT "does nothing," which would be the worse, silent-lie shape the dispatch asked to rule out. What t2469's own
`facing-data-emit.spec.js` already proved stands: the PASS-COUNT loop (`IF #110<#111 GOTO52`) correctly reads
the LIVE, edited register, so the number of roughing passes DOES respond correctly to an edited allowance. Only
the two BAKED Z heights (the clearance-approach and final-retract lines) silently keep the DEFAULT allowance's
own computed value. **Net effect for a user, stated plainly**: editing "Material to remove" away from its
default (3mm) produces a program with the CORRECT number of passes at the CORRECT depths, but a clearance-
approach/retract height computed as if the field were still at its default — wrong for large deviations from
3mm, silently, with no error and nothing in the UI to suggest it. Worse than "does nothing" in one sense (a
"does nothing" field is merely confusing; this one is quietly wrong), better in another (the core cutting
behavior — pass depths — IS correct; only the approach/retract clearance is stale). Not fixed here, per scope.

**STILL REAL IF**: unchanged from #60's own entry above — this is a characterization of the SAME frontier, not
a new one; see that entry's own STILL REAL IF for the check that would confirm a future fix.

---

### 61. [MEASURED t2459; ⭐ GATE SHIPPED t2461 (`tests/support/dragRenderTruth.js`); ⭐⭐ GATE PROVES ITSELF t2463
(`tests/support/previewMutations.js` — the mutation manifest, L1); ⭐⭐⭐ L2 SHIPPED t2465
(`tests/support/affordancePresence.js` — the presence primitive) — declarations/ports/lathe geometry/L3 still
NOT started, deliberately] THE PREVIEW LEG: ROADMAP.md'S OWN "0/32 DECLARED" IS STALE — RE-MEASURED, PLUS A
GATE-FEASIBILITY VERDICT: BUILDABLE, RECOMMEND STARTING THE ARC

*(owner ask, via the advisor: does wizards-as-data work fully — emit AND form AND previews? Emit/form measured
t2457 (BACKLOG #60). This is the third leg. Full account + the 32-op per-fact table: WORK-LOG t2459.)*

⭐ **`ROADMAP.md:238`'s own claim — "PREVIEW 0/32 declared... hand-written renderers, each deciding
independently" — is badly stale** (measured 2026-08-09, before this session's own form-reproduction arc). Every
legacy `<name>View.js` checked (13 files) is confirmed DEAD — `wizardLibrary.js`'s own `opensAs` redirects every
live menu entry straight to a GENERIC twin renderer (`panelTypes.js`'s `_previewGeometryOf`/`buildCanvasWidgets`
dispatch), reading a DECLARED source of truth per op (`def.previewGeometry` for the mill family, `def.layout.
kind`+the shared lathe-profile spec builders for the lathe family, `simStartParams`/`simStartsProvider` for the
probe family). The ROADMAP is describing dead code as if it still runs.

**What's genuinely still hand-written, narrower than "0/32":**
1. **The LATHE family's per-shape geometry math** (facing/odTurn/parting/centerDrill/faceProbe/odProbe, 6 ops)
   — DISPATCH is declared (one generic entry point routes by `def.layout.kind`), but each shape's own geometry
   (`facingSpec`/`odProfileSpec`/`partProfileSpec`/…) is hand-written JS using FeatureCanvas's own `onDrag`/
   `onEdit`, not `canvasWidgets.js`'s declared gesture registry (point/rect/radial/translate/projLength) the
   mill family already rides.
2. **Handle AFFORDANCES** (`onEdit`/`noSnap`/`emits`) — declared on some ops (corner/middle/surfacing/drill/
   bore/the lathe family), absent with no apparent rule on others (pocket/slot/tap/text/polygon/rotaryCenter/
   rotaryClock).
3. **Found unprompted**: `layout_2d_canvas`/`sim_3d_box`/`code_preview_panel` — three DECLARED block types with
   ZERO readers anywhere (corner's own header comment names this explicitly). A 5th instance of this project's
   recurring declared-but-unread pattern (`emits`/`modalPre`/`noSnap`/`mouth`, now this).

   ⚠ **CORRECTED 2026-09-01 (advisor) — this said THREE; only ONE was still live when it was written.**
   `sim_3d_box` was deleted at **t1734** (`vizBlocks.js`'s own header records it: zero readers, confirmed
   t1724, acted on t1734). `code_preview_panel` was deleted in **`0bd8b38c`**, the same commit that introduced
   `renderUiTree`, and has a live SUCCESSOR — `code_preview`, which renders today via `formWidgets.js:1497`.
   Only **`layout_2d_canvas`** survives. The grep that produced "three" matched the two tombstone COMMENTS
   recording their own deletion — [[grep-gives-a-line-not-a-scope]] in its purest form.

   ⭐ **And `layout_2d_canvas` is not a missing capability — it is a THIRD way to say something already live.**
   `formWidgets.js:1478` renders a `panel` node as the 2D FEATURE CANVAS, placeable anywhere in the
   `uiChildren` tree, alongside `sim` (1402), `code_preview` (1497), `split_horizontal`/`split_vertical`
   (1339), `section`, `group_box`, `grid_container` and `tab_group`. Layout placement is ALREADY fully
   declarable and drill ships on exactly that shape. `layout_2d_canvas` adds only `minHeight`/`showRuler`,
   and rulers are already declared via `def.zRuler`.
   ⇒ **OWNER RULING, 2026-09-01: DELETE it**, same as its two siblings — wiring it would create a competing
   duplicate of a working mechanism, which is the exact duplication this arc exists to remove. Queued as L7.

   **✅ DONE t2507**: deleted from `vizBlocks.js`/`index.js`'s own PALETTE; the two real consuming tests
   (`palette-by-role-1623.spec.js`, `wizard-shapes-1627.spec.js`) updated rather than deleted — their own
   assertion that the block EXISTS was removed, but the shape-round-trip/spec-builder coverage they were also
   carrying was kept, re-hosted on `section` (a real, wired `mouth:'DO'` container `layoutSpecFromOp`'s own
   mouth-agnostic shape scan never actually required `layout_2d_canvas` specifically). See WORK-LOG t2507.

### THE GATE — ROADMAP.md's own stated make-or-break condition, ASSESSED: BUILDABLE, not hypothetical

`tests/commit-on-release-2429.spec.js` (this session) already reuses `web/debug/featProbe.js` DIRECTLY inside
an automated Playwright test (captures its console rows as assertion evidence) AND separately asserts real
rendered geometry (`handle.boundingBox()` / a `getBoundingClientRect()`-based helper) mid-drag and post-release.
**The generalization the ROADMAP's own condition asks about has already happened once, for one bug class, and
is green today.** A generic `previewEquivalence(op, params)` harness — mirroring `emitEquivalence`'s own shape
— is a realistic next build, not a research question: render → read real DOM geometry → diff against the op's
OWN declared/computed geometry source, which ~30/32 twins already have.

**Worked against the 5 owner-found defects this week (the dispatch's own concrete design test):**
- CAUGHT by this ONE gate shape, PROVEN: drag-not-following-the-finger, value-reverting-on-release — both
  rendered-position-vs-declaration claims, both acceptance-tested at t2461 (see below).
- Philosophically the same family but NOT acceptance-tested (no fix commit located to genuinely revert-and-
  prove against): flyout-landing-in-a-corner — mechanically a STATIC position-relative-to-trigger claim, no
  drag gesture — named as a real, un-proven edge of the gate's own scope, not silently folded into "caught."
- NOT CAUGHT — needs a DIFFERENT, smaller primitive: the missing pane sizer (an ELEMENT-ABSENCE bug — needs a
  declared affordance-manifest + presence check, not a position diff) and the pane sizing from the window
  instead of itself (a container-query-vs-viewport-query CSS bug — needs a dimension assertion under a resized-
  host harness; arguably not preview-specific at all, a general responsive-layout hazard).

### ⭐ GATE SHIPPED — t2461

`tests/support/dragRenderTruth.js` (new, reusable — `handleScreenPos`/`dragHandleRenderTruth`/
`assertDragRenderFaithful`) generalizes `commit-on-release-2429.spec.js`'s own ad-hoc measurement code into a
harness any preview spec can import, mirroring `emitEquivalence`'s own shape. Acceptance-tested per the
dispatch's own demand ("a gate that has never failed on a real defect is not proven"): t2447's own fix
(`web/viz/canvasWidgets.js`/`featureCanvas.js`/`wizards/ops/panelTypes.js`, commit `ab59b869`) was reverted
(scratch-backed), the new harness run against the broken code — **RED, deterministically** on pocket's
`pk_size` handle, the exact snap-back symptom t2447's bug report describes — then the files restored
byte-identical to HEAD before anything was committed. `sf_pos` did NOT reproduce with that specific run's drag
parameters — named honestly as this ONE acceptance run's own limit, not glossed over. Full account: WORK-LOG
t2461.

**Deliberately NOT done this turn** (per the dispatch's own explicit scope): no declarations, no ports, no
lathe-family geometry migration, no build of the other two (smaller) primitives named above. Those are the
arc's next turns, in the order t2459/t2461 both name: declare → port lathe → build the presence/manifest and
container-sizing primitives separately.

### ⭐⭐ THE GATE PROVES ITSELF — t2463 (BACKLOG #61 / L1, the mutation manifest)

t2461's own honesty (1 of 3 claimed defects actually proven) had a root cause: the acceptance method was
per-defect archaeology (locate a fix commit → revert on disk → run → restore), which can't test a defect with
no fix commit and never re-checks itself. `tests/support/previewMutations.js` declares 4 mutations as INERT
DATA (never touching disk — every mutation applies via `page.route()` rewriting the served file body,
in-flight, for exactly one test's page); `tests/preview-mutation-manifest-2463.spec.js` runs each: apply →
assert RED → remove → assert GREEN.

**All 4 entries: clean RED-then-GREEN.** Including the SYNTHETIC one (`flyout-corner-synthetic`, mutating
`dropdownPopup.js`'s own trigger-relative positioning to pin at the origin) — proving the "assert real rendered
geometry" gate family generalizes past its one proven bug class even with NO historical fix commit to revert,
exactly the design's own point. And `pane-sizes-from-window` (BACKLOG #58's own isolated hunk from the bundled
`84def5d1`) — RED under the reverted CSS (`paneWidth=978 flexDirection=column`, wrong), GREEN restored
(`paneWidth=1295 flexDirection=row`, correct).

⭐ **`sf_pos` — the turn's own real question, answered, and it validates the WHOLE premise for building this
manifest in the first place**: under the in-flight mutation, `sf_pos` reproduces the snap-back **RED,
deterministically, 3 of 3 runs, byte-identical numbers each time** (`moved 38.6px... must not snap back from
mid-drag (180.3px)`) — the OPPOSITE of what t2461's own one-shot disk-revert found. Both methods revert the
identical code (`ab59b869`); the only difference is delivery mechanism. This is not glossed over as "now it's
fixed" — it is reported as the strongest possible evidence for why t2461's own diagnosis (per-defect archaeology
is a one-shot act nothing re-checks) was correct: a single manual run gave a DIFFERENT, apparently incomplete
answer than the repeatable, declarative one. The manifest's own 3/3-consistent result is treated as the current,
trustworthy answer.

Also shipped, same turn, per its own scope: BACKLOG #57's flake re-confirmed live (still real, 3/4 solo runs)
but its OWN first hypothesis corrected against the actual error (see #57's own entry) rather than mechanically
applied; BACKLOG #62 filed for the missing-pane-sizer defect (previously living only in this entry's own prose,
per rule 8's own premise about facts buried in another entry's body).

### ⭐⭐⭐ L2 SHIPPED — t2465 (THE PRESENCE PRIMITIVE)

FIRST, closed L1's one loose end: `sf-pos-snapback`'s special-case (only logging, never asserting the mutated
phase) collapsed to the same `expect(mutated.ok).toBe(false)` every other entry uses. Re-run isolated (5/5
clean) and TWICE under real 4-worker contention (both times the ONLY failure mode was a whole-test timeout at
`page.mouse.up()`, never a different measured value — retries both completed with byte-identical numbers to
every other run). **The t2461-vs-t2463 divergence closes in t2463's favour**: the reproduction is genuinely
deterministic; contention causes timeouts, not measurement variance.

MAIN: `tests/support/affordancePresence.js` (new) — `checkAffordancesPresent(page, {containerSelector,
selectors})`, mirroring `dragRenderTruth.js`'s own shape. Structurally separate from the geometry gate: no
position math, only "does the declared DOM node exist at all." Keeps L1's own "a declaration that can't match
must throw" property, in the shape that actually fits presence checks (a container that never renders throws —
a stale declaration or boot failure — since "not found" is the EXPECTED, correct RED-phase answer and can't
itself be the throw condition the way L1's exactly-once find-string check was). Seeded into L1's OWN manifest
(not a second parallel one) as a 5th entry, `pocket-size-handle-presence`: mutates `pocketData.js`'s own
`pocketPreviewGeometry` to silently drop the `pk_size` handle push while `pk_pos` stays — a confirmed-live
affordance (per the dispatch's own explicit instruction not to declare from a guess), chosen specifically
because BACKLOG #62 could not be seeded blind. RED-then-GREEN on the first run, no debugging needed.

Also this turn: confirmed BACKLOG #62's own selector/mechanism live (`.viz-pane-sizer`,
`paneAccordion.js:340-348`) — re-confirmed correct on desktop in both pane states, and found a genuine THIRD
reproduction on mobile (390×844, corner op): the element exists with real dimensions and is technically a
descendant of the page's own scroll container, yet is NOT reachable even at that container's own maximum
scroll — a different hypothesis than either of t2423's own two ruled-out ones (selector miss, zero-size), root
cause not diagnosed (measurement only, per this turn's own scope). BACKLOG #63 filed (separate commit, per
rule 4) for `undo-blind-writes-2427.spec.js`'s own solo flake — same class as #57, distinct from #56.

### ⭐ RECOMMENDATION: START THE ARC, gate-first, exactly per ROADMAP's own ordering — do not refuse it

The evidence against refusing is concrete: the arc's hardest precondition (a cheap, buildable preview-
equivalent of emit's byte-identity) is not a hope, it is a generalization of code already shipped and green in
this repo. In order:
1. Build `previewEquivalence(op, params)` generic, prove it on 2-3 already-fully-declared ops (pocket/corner)
   before trusting it broadly.
2. Build the presence/manifest check and the container-relative-sizing check as their OWN, separate primitives
   — do not fold either into the geometry-gate's scope; they prove different claims.
3. THEN port the lathe family's geometry math onto `canvasWidgets.js`'s declared registry (the one genuine
   remaining "0" this measurement found) — step 1's gate is what proves the port didn't silently change
   anything, the exact role byte-identity played for the emit port.

**STILL REAL IF**: `grep -rL "opensAs" web/blocks/wizardLibrary.js` still shows the 25 entries (the dead-view
finding still holds) AND `grep -c "getBoundingClientRect\|boundingBox" tests/commit-on-release-2429.spec.js`
still returns ≥1 (the gate precedent is still there to generalize from). If either check no longer holds,
re-verify before acting on this entry's own conclusion — rule 8b applies to this entry too.

### ⭐⭐⭐⭐ L4 — t2471: THE GATE, RUN WIDE ACROSS ALL 32 DECLARED TWINS. THREE genuine defects found (REPORT ONLY,
not fixed per this turn's own scope) — AND this entry's own lathe-family prediction, above, is REFUTED

Per the advisor's own dispatch: point `dragHandleRenderTruth` at every declared twin with a draggable handle,
not just the four hand-picked defects L1/L2 were proven against, and publish the honest table — GREEN/RED/
CAN'T-RUN, all three useful, none padded.

⚠ **First attempt was itself a false table, caught before trusting it**: a generic sweep across all 32 ops
(fresh boot per op, no custom viewport) showed 21/32 RED, ALL at exactly `movedMid:0, movedAfter:0` — a
methodology tell, not 21 real bugs. Root cause: `preview-mutation-manifest-2463.spec.js`'s own
`test.use({viewport:{width:1400,height:1000}})` (a TALL viewport, needed because `?debug=feat` renders the
canvas far down the page) was never carried into the new sweep script — every handle sat below the fold,
every drag landed on nothing (`document.elementFromPoint` at a handle's own reported center returned `null`,
confirmed directly). Re-run with the correct viewport. **This is exactly the kind of self-caught methodology
error this session's own discipline exists to catch before it becomes a wrong table someone acts on.**

**THE HONEST TABLE, 32/32 accounted for, none silently omitted:**

- **GREEN (18)**: `tap`, `bore`, `slot`, `surfacing`, `contour`, `pocket`, `text`, `corner`, `edge`, `middle`,
  `rotaryCenter`, `homing`, `facing`, `odTurn`, `polygon`, `centerDrill`, `faceProbe`, `odProbe`. The gate
  holds — tracks the pointer, no snap-back.
- **RED (3)**: `rotaryClock`, `alignment`, `parting` — see the three new BACKLOG entries below (#64/#65/#66).
  Real, reproduced defects, none fixed this turn.
- **CAN'T-RUN (10)**: `atc_warmup`/`atc_length`/`atc_check`/`atc_test`/`atc_change`/`atc_table` (6 — no
  geometry canvas at all, expected: housekeeping ops with nothing to drag), `wcs`/`comm`/`io_step`/
  `pause_confirm` (4 — same, logic/selection ops, no drag affordance).
- **RED-VALID (1), corrected a second time this turn**: `drill` — was CAN'T-RUN (canvas never mounted, see
  below); FIXED at t2477 (BACKLOG #67), canvas mounts and renders real content. The gate then went RED on
  `dr_pos` for a real reachability reason (BACKLOG #68 — the inner `.wiz-visual` pane computing `width:0`,
  landing the handle past the viewport edge with no scroll mechanism to reach it), settled by t2479 and
  **⭐ FIXED at t2481** (the missing `@container` narrow-pane treatment, mirroring t2423's own pattern; now
  permanently guarded by BACKLOG #61's own L3 primitive). Reachable now — but a SECOND, different RED surfaced
  once it was: the handle no longer tracks the pointer during the drag itself, an unrelated defect, filed as
  BACKLOG #69, not fixed. 18+3+10+1 = 32.

⭐ **`drill`'s CAN'T-RUN is NOT "no affordance by design"** — its own rendered form copy reads *"Drag the
handles in the 2D layout (left) to set the pattern — round handle sizes it, square handle places it"* — the
op DECLARES it has draggable handles. But under this gate's own boot method (`_framed('user_drill_data', {})`
+ `ddcsLoadBlockStack`, `?debug=feat`), `hasFeatureCanvas: false` — the `svg.feature-canvas` element itself
never mounted, `fcHandleCount: 0`. Not investigated further (out of this turn's scope) — named as a genuine
gap in L4's OWN reach, not glossed into the "no handle by design" bucket it does NOT belong in. Worth a look:
whatever makes drill's canvas mount differs from every other op this sweep drove successfully.

⭐⭐ **t2475 — RESOLVED: NOT a gate-reach limitation, a REAL product defect.** `window.openWiz('drill')` (the
legacy modal) mounts the canvas correctly; the Blocks-tab pane (the surface every other one of the 31 tested
ops actually uses) does not — `#blk_wiz_user .wiz-visual` renders `display:none` for drill specifically,
confirmed via a real toolbox-drag simulation (`stackToWorkspace`), not just the synthetic boot. Filed as its
own entry, BACKLOG #67. **⭐⭐⭐ FIXED at t2477** — a namespace mismatch in `formWidgets.js`'s own tree-render
`sim`/`panel` handlers (hardcoded, un-namespaced ids vs. `userOpView.js`'s own namespace-aware lookups), NOT
the `applyPanel()`/tree-migration link this entry's own earlier text speculated about. Confirmed live
(screenshot), regression-checked (19+7 tests). Full account in #67.

⭐⭐ **This entry's OWN prediction is falsified, corrected here rather than left standing**: t2465's own passage
above reads *"the lathe family's six ops are precisely the ones the gate can't drive... if it can't, that IS
L5's whole justification."* **It CAN drive all seven** (facing/odTurn/parting/centerDrill/polygon/faceProbe/
odProbe all render real `.fc-handle` elements and respond to drags) — six of seven are GREEN; the seventh
(`parting`) is a genuine, confirmed defect, not a gate-reach failure. **L5 (porting the lathe family's hand-
written geometry onto `canvasWidgets.js`'s declared registry) is NOT justified by "the gate can't reach it" —
that premise no longer holds.** If L5 is still worth doing, the reason has to be something else (maintenance,
consistency with the mill family's own declared shape) — not testability via this gate, which this turn
proved wrong.

⭐⭐⭐ **THREE handles initially read RED were RECLASSIFIED to GREEN after closer testing — reported here
precisely so the correction is visible, not silently absorbed into a cleaner-looking table**: `centerDrill`'s
`drillDepth`, `faceProbe`'s `probeFace`, `odProbe`'s `probeOD` all failed the FIRST pass's generic diagonal
drag (`dx:40,dy:25`) at `movedMid` values landing suspiciously exactly on one of that drag's own input
numbers (40, 40, 25). Re-tested each across FIVE directions (pure +X/−X/+Y/−Y, a larger diagonal): every one
of the three is a genuinely SINGLE-AXIS-CONSTRAINED handle (moves fully and cleanly along its own one axis,
zero movement on the orthogonal one, **zero snap-back in the axis that does respond**) — a legitimate design
constraint (a depth/radial-only handle), not a defect. The generic two-axis drag this sweep used by default
was simply the wrong shape for these three. Confirmed, not assumed — the axis-sweep is the evidence.

### Scope, per the dispatch's own explicit limits

No fixes to anything the gate reds on. No lathe port. No new primitives. Full account, incl. every raw
progress line and the axis-diagnosis runs: WORK-LOG t2471.

**STILL REAL IF**: any of `tests/support/dragRenderTruth.js`'s own two exports change shape, OR the SEED_BUILDERS
registry count moves away from 32 (`grep -c "DataDef" web/app.js`'s own `SEED_BUILDERS` array literal) — either
would mean this table needs re-running, not just re-reading.

### ⭐⭐ t2481 — L3 UN-PARKED AND SHIPPED: THE REACHABILITY PRIMITIVE, proven against a live, unfixed defect

L3 (`affordanceReachability.js`) was previously closed as "partial, on purpose" — no forcing case existed to
prove it against (BACKLOG #62's own mobile drawer couldn't be reproduced in this harness; headless Chromium has
no dynamic toolbar to hide/show, t2469's own finding). BACKLOG #68 provided one: LIVE and UNFIXED at the time
L3 was built, directly measurable in this harness (no mutation needed to manufacture the RED case — the
opposite of L1/L2's own acceptance pattern, whose guarded defects were already fixed by the time their
primitives were built).

`tests/support/affordanceReachability.js` mirrors `affordancePresence.js`'s own shape exactly: checks whether a
declared affordance is present, correctly sized, AND within the current viewport or a genuinely scrollable range
that could bring it into view — the sibling claim to L2's "does it exist," not "can it be reached." Same
anti-rot property carried over unchanged: throws only if the declared CONTAINER never rendered (a stale
selector or boot failure); a per-selector "unreachable" is the expected, correct signal a real defect produces,
never the throw condition.

Seeded into the L1 mutation manifest as its own acceptance test (`drill-split-pane-unreachable`,
`tests/support/previewMutations.js`) — reverts BACKLOG #68's own fix in-flight, proven RED under the revert and
GREEN against current code, same runner/same convention as every other entry. Full account: WORK-LOG t2481.

### ⭐⭐ t2485 — L5's PILOT: `facing` ported onto `canvasWidgets.js`'s declared registry, byte-identical gate
numbers before/after — geometry fits the registry perfectly, the real cost was elsewhere

L4 (t2471) measured the lathe family at 6/7 GREEN under `dragHandleRenderTruth` — the "gate can't reach the
lathe family, so port it" premise L5 was originally scoped on no longer holds. This turn re-scoped L5 as
duplication-collapse (north star 4), not a bug fix, and shipped ONLY its pilot: `facing`, the family's simplest
op (one handle, one field), with the bar stated as strictly as it can be stated — nothing observable may change
at all.

Captured `facing`'s own `dragHandleRenderTruth` numbers live BEFORE any edit, ported the hand-written
`latheProfileSpec` handle (`web/viz/latheProfileCanvas.js`) onto `canvasWidgets.js`'s existing `length` gesture
(no registry extension — the face-line handle IS a 1D anchored distance, exactly that gesture's own shape), then
re-captured the SAME numbers after: byte-identical, no digit moved, across three drag directions. The existing
`tests/lathe-pilot-1271.spec.js` (8 tests, including a direct `spec.onDrag('faceLine', ...)` drive that reads
the emitted G-code back) passed UNEDITED.

**The real, reportable cost**: `tests/node/preview-spec-gate-1688.test.mjs`'s own snapshot caught a shape
change nothing else did — the registry's generic wrapper always forwards `color`/`manual`/`noSnap` as explicit
keys (present-but-undefined, not absent) and gives `onDrag` an extra unused arity — traced against the gate's
own FOUR protected defect classes (t1672/1686/1680/1674) and confirmed none are touched; regenerated and
reviewed the snapshot (a 4-line diff in a 900+-line fixture), which now shows `facing` looking like every other
`canvasWidgets`-built handle in the app, not less consistent. Full account, incl. what this implies for the
remaining five ops: WORK-LOG t2485.

### ⭐⭐⭐ t2487 — L5's SECOND PILOT, `odTurn`, the deliberately-hard op: GUARDRAIL TRIPPED, NOT PORTED — found
the registry's real limit, exactly the point of trying the hard one first

Dispatched deliberately ahead of the three easy-looking ops (`centerDrill`/`faceProbe`/`odProbe`, all more of
`facing`'s own 1D `length` shape) specifically to find L5's limit early, cheaply, before three turns' worth of
momentum made stopping harder.

**Almost the whole shape fits the registry exactly**: `odProfileSpec`'s "one corner, two outputs" shoulder
handle (X→depth, Y→a diameter) IS the `rect` gesture's own anchor+per-axis-divisor structure — traced
algebraically, not assumed: `ax:0, sx:-1, minw:0.001` reproduces the depth math byte-for-byte, and `ay:0,
sy:0.5, minh:0` reproduces the diameter math's LOWER bound (a radius→diameter conversion falls straight out of
the existing divisor, no new concept). The taper-only face-Ø handle and the target/end field-name switch are
ordinary declaration-time JS.

**Where it breaks**: the diameter axis is clamped on BOTH sides in the original — `Math.min(Math.max(0,
world.y), barR - 0.001)`, "a target at or outside the bar diameter is a pass that never touches metal." Grepped
`canvasWidgets.js`'s entire gesture set for any two-sided clamp: **zero matches** — every gesture's own clamp
(`clampMin`) is a lower bound only, across all eleven declared gestures. Confirmed LIVE, not just read: drove
`odProfileSpec`'s real `onDrag` 50mm past a 10mm-radius bar and it clamped to exactly `2×(barR−0.001)` —
currently active, user-facing behaviour, not vestigial. Dropping it to fit the registry would be a real,
observable behaviour change (a drag could write a diameter the machine cannot cut) — exactly what this pilot's
own bar rules out. Expressing it would need EITHER a registry extension (`maxw`/`maxh` alongside the existing
`minw`/`minh`) or contorting the drag math (inverting the axis, changing the natural drag direction every other
lathe handle shares) — the dispatch's own two named escape hatches, both explicitly declined this turn.

**Not odTurn-specific**: `parting`'s own `PART_FLOOR_HANDLE_ID` clamps its diameter axis the exact same
two-sided way — the SAME missing capability, a second op already needing it. This project's own rule-of-three:
worth adding to the registry if a third case turns up, not something to bolt on for one pilot turn.

**GUARDRAIL TRIPPED. No product code touched, no registry change, no contorted shape shipped.** Full account:
WORK-LOG t2487.

**RULED OUT (t2489, no action): the missing max clamp does NOT explain BACKLOG #66's dead `partPos` handle** —
`partPos`'s own drag writes `zFace` straight from `world.x` with no bounding at all, clamp-shaped or otherwise.
Every clamp-shaped theory for #66 is eliminated by this, not just the max-clamp one.

### ⭐⭐⭐⭐ t2489 — THE CLAMP VOCABULARY COMPLETED (authorized override of t2487's own rule-of-three deferral),
THEN `odTurn` PORTED ON IT: byte-identical gate numbers, `onEdit` deliberately kept hand-written

The advisor overruled t2487's own deferral: rule-of-three governs building ENGINES, not completing an
ASYMMETRIC declaration — `clampMin` already existed at 7 call sites across 6 gestures; a lower-only bound was
an omission, not a decision. `web/viz/canvasWidgets.js`'s `clampMin(v, lo)` → `clamp(v, lo, hi)` (both optional,
backward-compatible — confirmed via a snapshot-gate re-run showing ZERO diff immediately after the rename,
before any declaration used the new param), threaded symmetrically as `max`/`maxw`/`maxh`/`maxR` alongside the
existing `min`/`minw`/`minh`/`minR` at all 7 sites.

`odProfileSpec`'s shoulder handle ported onto `rect` exactly as t2487 derived: `sx:-1` for depth, `sy:0.5` (a
radius→diameter ×2 conversion, so the new `maxh` bound is `2×(barR−0.001)`, diameter-scaled) for the clamped
diameter. Gate numbers before/after: **byte-identical**, three seed directions, no digit moved. 41/41 existing
lathe tests (`lathe-odturn-1273`/`lathe-world-1283`/`lathe-matrix`/`census-finding2-emits-teal-1684`) passed
UNEDITED.

**`onEdit` deliberately kept hand-written** — a SECOND mismatch, found only by attempting the real port:
`buildCanvasWidgets`'s own generic `onEdit` can only route to `d.field`, never `d.fieldH`, but the shoulder's
own click-editable value (the diameter) lives on `fieldH` (`field` carries `depth`). Using the generic version
would silently misroute an edit to the wrong field. `pocket`'s own `pk_size` (the only other fused `rect`
handle) never exercises this path at all (no `value` declared, so never click-editable). Kept `onEdit` on the
ALREADY-SHARED `onEditFromMap` helper (not odTurn-specific) rather than force the generic one or extend the
registry a second time this turn — `buildCanvasWidgets` returns three separate properties; using two of them
is not a contortion.

Snapshot diff enumerated BY DIRECTION (the correction absorbed from t2487): **ADDED** `color`/`manual`/`noSnap`
(generic wrapper) + `labelDir` (new this time — `rect.place()`'s own shape, `length.place()` never had it).
**REMOVED**: `axis:"y"`, only from `faceDia` (confirmed inert, same reasoning as facing's own removal).
**ALTERED**: `onDrag` arity `<fn/2>`→`<fn/3>` (never populated in practice). Checked against all four protected
defect classes (t1672/1686/1680/1674): none touched.

Full account: WORK-LOG t2489.

### ⭐⭐⭐⭐⭐ t2491 — THREE MORE L5 PORTS: `centerDrill`, `faceProbe`, `odProbe` — every one fit the registry
using ALREADY-PROVEN techniques, none required a stop

Dispatched as "one shape, three applications" (facing's own `length` gesture); turned out to be three DIFFERENT
already-proven shapes, not one — worth recording precisely rather than flattening to the dispatch's own
prediction:

- **`faceProbe`**: facing's own `length` shape, byte-for-byte (`ax:0, axis:'x', min:0`). Fully registry-driven
  (`handles`/`onDrag`/`onEdit` all from `buildCanvasWidgets`).
- **`centerDrill`**: needed a sign flip (`x` runs negative as depth grows, the opposite sign of the field's own
  positive value) — `length` has no scale parameter, `rect`'s `sx` divisor does (`sx:-1`, the SAME technique
  `odProfileSpec`'s own depth field proved at t2489). A genuine single-field handle despite using `rect`, so
  `d.field` is set correctly and the generic `onEdit` fits — fully registry-driven too.
- **`odProbe`**: needed the radius→diameter ×2 conversion (`rect`'s `sy:0.5`, matching `odProfileSpec`'s own
  `FACE_DIA_HANDLE_ID`), with X held constant via `ex:0` (never a drag target). Since the sole field lives on
  `fieldH` (the Y axis), `onEdit` was kept hand-written via the already-shared `onEditFromMap` — the SAME
  odTurn mismatch recurring, resolved the identical already-approved way. Named explicitly as the advisor's own
  predicted "second op," and explicitly NOT treated as grounds to extend the registry — two occurrences of one
  shape, solved twice by one existing workaround, isn't yet the rule-of-three case a genuinely novel THIRD
  occurrence would be.

Gate numbers byte-identical for all three, three seeds each (nine drag captures, zero digits moved). 25 test
instances across the three ops' own existing coverage (`lathe-part-drill-1275`, `lathe-probe-1299`,
`census-finding2-emits-teal-1684`) passed UNEDITED. Snapshot diffs enumerated by direction for each op
separately (the t2489 correction, applied consistently this time, not just once).

**L5 status after this turn**: `facing`, `centerDrill`, `faceProbe`, `odProbe` fully ported. `odTurn` ported
with `onEdit` deliberately hand-written. Still open: `parting` (its floor handle needs exactly the max-clamp
capability t2489 added — unblocked, not yet attempted) and `polygon` (a two-view layout, may be genuinely
different — unassessed). Both are their own future turns.

Full account: WORK-LOG t2491a/b/c (one entry per op, three separate commits per rule 4).

### ⭐⭐⭐⭐ t2493 — L5: `parting` ported. `partWidth`/`partFloor` byte-identical; `partPos` (BACKLOG #66)
confirmed STILL DEAD, unchanged — the fieldH/onEdit mismatch's THIRD occurrence

Three handles, three already-proven registry shapes: `partPos` is `length` with no clamp at all (its own
hand-written code never bounded it either — an accurate declaration, not a gap). `partWidth` is `rect`'s
`sx:-1` sign-flip technique (odTurn's/centerDrill's own), anchored at `zFace` rather than 0 — the first case
proving that technique generalizes to a non-zero anchor. `partFloor` is `odProfileSpec`'s own diameter shape
again (`rect` Y-only, `sy:0.5` + the t2489 `maxh` clamp), its own two-sided clamp expression confirmed
byte-identical in shape to the shoulder's before porting either.

`onEdit` kept hand-written for the whole spec — `partFloor`'s sole field lives on `fieldH`. **This is the THIRD
occurrence** of the mismatch the advisor is counting toward the rule-of-three decision after `polygon` (odTurn,
odProbe, now parting) — reported as the count, not acted on, per explicit instruction either way.

`partPos` verified LIVE, both directions, before AND after the port: `movedMid:0.000, movedAfter:0.000` in
both cases, unchanged. Confirms BACKLOG #66's own diagnosis (the deadness lives in rendering, not in this
function's own declared math) — the port changes only how the math is EXPRESSED, and the symptom tracked
exactly, neither newly broken nor accidentally fixed.

Gate numbers for `partWidth`/`partFloor`: byte-identical, four seeds. 32 existing tests (`lathe-world-1283`,
`lathe-feel-1321`, `lathe-part-drill-1275`) passed unedited. Snapshot diff enumerated by direction (7 lines,
parting's own only). Full account: WORK-LOG t2493.

### ⭐⭐⭐⭐⭐ t2495 — RULE-OF-THREE CLOSED: the fieldH/onEdit gap, then odTurn/odProbe/parting retrofitted to drop
their hand-written `onEdit` entirely

The count named across t2489/t2491/t2493 (odTurn's shoulder, odProbe, parting's floor) reached three — this
project's own rule-of-three trigger, earned honestly over four separate turns rather than argued for in one.

Measured the three real cases before designing anything: `odProbe`/`partFloor` only ever declare `fieldH` (no
`field`, no `sx`) so the destination is DERIVABLE by construction; `odTurn`'s shoulder activates BOTH axes, so
it genuinely needs a new optional `valueField` ('field' or 'fieldH') naming which one the displayed value
represents. `canvasWidgets.js`'s own generic `onEdit` now resolves this — `field` wins whenever set and
`valueField` is absent, byte-identical to every one of the 11 OTHER `rect`-consumer call sites in the app
(confirmed by reading each, including a `panelTypes.js` one that declares both fields AND a value — the one
case genuinely at risk, confirmed unchanged since it doesn't opt in).

Proven inert via the snapshot gate BEFORE any declaration used it (238/238, zero diff — the SAME ordering
t2489's own clamp completion established), then retrofitted all three ops: `odTurn`'s shoulder gained the one
`valueField` declaration it needed; `odProbe`/`parting` needed NO declaration changes at all, just swapping
from `onEditFromMap` to the registry's own `onEdit`. `onEditFromMap` itself is untouched, still legitimately
used by `polygonProfileSpec` — the one op this arc hasn't reached yet.

**Proof went beyond geometry, per the dispatch's own explicit ask**: captured `spec.onEdit(id, value)`'s own
WRITTEN FIELD AND VALUE (not just the handle's rendered position) for all seven distinct edit paths across the
three ops, before and after the retrofit — byte-identical JSON, including confirmation that no edit silently
touched a sibling field. 79 existing lathe/canvas-widgets tests passed unedited.

Full account: WORK-LOG t2495a (the mechanism) / t2495b (the three retrofits), two commits.

### ⭐⭐⭐⭐⭐⭐ t2497 — L5 COMPLETE: `polygon`, the sixth and last lathe op, assessed carefully then PORTED IN
FULL — both handles, no hand-written residue, `onEditFromMap` removed as dead code this port orphaned

Assessed BEFORE porting, per the dispatch's own explicit instruction: `polyDepth` was an easy match (the same
`rect`-X-only `sx:-1` shape already proven three times). `polyFlats` looked, at first read, like it might
genuinely NOT fit — its own drag calls `polyRadiusAt` (a real trig function) and applies a CONDITIONAL rescale
("if the polygon's corner would leave the bar, shrink the whole shape") that looked nothing like the registry's
plain two-sided `clamp`.

**Read `polyRadiusAt`'s own actual implementation before concluding either way** (not assumed): confirmed
`corner = apothem / cos(π/sides)`. Worked the algebra through with that formula in hand — whenever the corner
would exceed the bar radius, the conditional rescale makes the FINAL apothem collapse to the CONSTANT
`barR·cos(π/sides)`, regardless of how far the cursor moved. That is EXACTLY what a plain upper clamp already
does. The entire three-step scale computation reduces to `clamp(world.y − cy, 0.001, barR·cos(π/sides))`,
doubled for the field — the SAME `rect`-Y-only `sy:0.5` + two-sided clamp shape `odProfileSpec`'s/`odProbeSpec`'s
own diameter handles already proved, with a per-render-computed bound instead of a literal. `polygon` fit the
registry completely; the FIRST read (assuming it needed a new gesture or a contortion) was wrong, and the
turn's own job was to find that out empirically rather than guess.

**`onEdit` needed NO hand-written piece either** — `polyDepth` is `field`-only (the default path); `polyFlats`
is `fieldH`-only (no `field`, no `sx`), deriving automatically via t2495's own mechanism, no `valueField`
declaration needed. This made `onEditFromMap` (the shared hand-written helper this whole arc used since t1680)
ORPHANED — polygon was its last consumer. Confirmed by grep (zero remaining call sites) and REMOVED, along with
the now-unused `polyRadiusAt` import — dead code this turn's own port created, not pre-existing, cleaned up per
the project's own rule.

**Gate numbers, three of four seeds, byte-identical before/after** — the fourth (`polyFlats`, pure +Y, pushing
the value to its own clamp boundary) hung the drag harness on BOTH the ported AND the pre-port code identically,
a genuine pre-existing finding surfaced by this turn's own thoroughness, not a port regression — filed
separately as BACKLOG #70, not chased further (out of scope for an assessment-then-port turn, and the other
three seeds plus the algebraic proof plus the snapshot plus 12 existing tests already settle the port's own
correctness independently of this harness-level issue).

**onEdit's own written field+value, both handles, byte-identical before/after** (direct `spec.onEdit(id,value)`
capture, matching the standard this arc's own onEdit retrofits established at t2495).

12 existing tests (`lathe-polygon-1277`, `lathe-matrix`'s own "POLYGON TURNING" case) passed unedited.

**L5 IS NOW COMPLETE — the final state, all six lathe ops**: `facing`, `centerDrill`, `faceProbe`, `odProbe`,
`polygon` — fully declared, zero hand-written geometry OR edit-routing. `odTurn` — fully declared geometry;
`onEdit` is now ALSO generic (t2495), so odTurn is fully declared too. `parting` — fully declared, all three
handles. **Every one of the six lathe ops is now fully declared through `canvasWidgets.js`, with no hand-written
place/drag/edit residue left anywhere in the family.** `onEditFromMap` (the family's own hand-written onEdit
helper since t1680) is gone — removed, not left dormant, once its last consumer was ported. The registry itself
gained one real capability across the whole arc: the two-sided `clamp` (t2489) and the `valueField`-resolved
`onEdit` (t2495), BOTH reached honestly through rule-of-three, both proven inert before use, both now serving
every other `rect`/`length`/etc. consumer in the app for free, not just the lathe family that forced the
question.

Full account: WORK-LOG t2497.

### ⭐⭐⭐ L6 — t2569: the seven ops finding 2 named, declared from what each handle ACTUALLY does — ARC A CLOSED

Finding 2's own text: "Handle AFFORDANCES (`onEdit`/`noSnap`/`emits`) — declared on some ops (corner/middle/
surfacing/drill/bore/the lathe family), absent with no apparent rule on others (pocket/slot/tap/text/polygon/
rotaryCenter/rotaryClock)."

**A correction to that premise, found while researching it**: drill/bore/middle do NOT already declare these
— read in full, none of their handles carry `noSnap`/`emits` despite several (drill/bore's `dr_pos`, middle's
own diagTravel/diagPrimary/crossX/crossY) writing real emitted params. Before this turn, exactly TWO places in
the app had a genuine, intentional declaration: corner's per-pass sim-starts (`emits` only) and the L5 lathe
family (`emits` + `value`, both). The "declared vs absent, no apparent rule" framing undersold how uneven the
starting state actually was.

**The vocabulary, precisely** (read `canvasWidgets.js` in full before declaring anything): `onEdit` needs no
per-op declaration — it's a generic function, already correctly forwarded everywhere checked, target and
reference ops alike. The real gap behind it (several handles never set a `value`, so click-to-edit is silently
inert despite correct wiring) is a DIFFERENT, deeper task, not what finding 2 asks — logged below as its own
deferred item. `noSnap` only affects `kind:'move'` handles and is now LOAD-BEARING (t2567 scoped pan-removal
to noSnap drags) — any addition needed live before/after proof. `emits` tints a SIZE-kind handle teal
(`#14b8a6`); on a MOVE-kind handle it instead only flips solid↔hollow fill via `startGlyph.js`'s
`resolveStartGlyph` (`fill: emits !== false`) — `undefined` and `true` render byte-identically, confirmed live
— and is further overridden by `panelTypes.js:915`'s own explicit simMarker colour in rotaryClock's case. This
means several of this turn's own `emits:true` additions are correct, real metadata with **zero visible
effect today** — stated plainly so nobody re-discovers it expecting a colour change.

**Declared, per op** (full per-handle reasoning in WORK-LOG t2569): pocket (`pk_pos`+`pk_size`, both
`emits:true` — no sim-only competitor exists on this op), slot (`sl_a`/`sl_b`/`sl_w`/the twin-only
`sl_anchor`, all four `emits:true`), tap (`tap_pos`, `emits:true`), text (both the classic view's four
handles AND the twin's independent two-handle set — found to be genuinely DIFFERENT decl sets, not one
shared source — all six `emits:true`), rotaryClock (marker B only — the real `span`/#6 write — `emits:true`
via `opSimStarts.js`'s `rotary_clock` provider + a one-line thread-through in `userOpView.js`'s `simMarkers`
map, mirroring the existing t1688 `mkManual` pattern; marker A stays undeclared, correctly, being genuinely
sim-only).

**Zero `noSnap` additions.** The one real candidate — slot's `sl_anchor` (a `translate`-kind handle, the
app's only user of that gesture) — was deliberately LEFT undeclared: its own existing comment analogises it
to an origin-based position handle (which snaps by design elsewhere), and no live drag showed a problem.
Adding `noSnap` there would have been an unrequested, unproven behaviour change — exactly what t2567's own
caveat warns against. This also means the caveat had no live case to actually prove this turn, which is worth
recording rather than leaving ambiguous.

**polygon**: already reference-quality from L5 (both handles `emits:true` + real `value`) — no change.
**rotaryCenter**: has NO draggable 2D-layout handles at all today (no `previewGeometry`, no `simStartParams`,
no x/y role — `panelTypes.js:861`'s own comment: "PURELY VISUAL... no handle/emit/drag"). Nothing exists to
declare an affordance ON — a different, larger gap than finding 2 asks about, left as-is and named here
rather than silently skipped.

Verified: 56/56 targeted regression tests (drag/commit/emit specs across all seven ops + the shared drag
infra) unchanged; a scratch live-visual check (run then deleted) confirmed `pk_size` genuinely renders
`#14b8a6` and rotaryClock's A/B render pixel-identical before/after B's `emits:true` — the "no visible effect
on move-kind" claim above is measured, not assumed.

**Three new findings, deferred, not fixed this turn** (out of scope — the dispatch named these seven ops
specifically):
1. **middle** has the identical undeclared-`emits` gap on its own diagAim/crossAim decls (built inline in
   `panelTypes.js`, not a data-op file) — real emitted params (#19-#22), no declaration.
2. **rotaryCenter** has no draggable 2D-layout handles at all — a bigger gap than an undeclared affordance.
3. **The onEdit-inert gap**: pocket's Ø/W×H, slot's width, drill/bore's every handle, and text-twin's
   rotation all lack a `value`, so click-to-edit never activates despite `onEdit` being correctly wired —
   deciding what number each should display is real, separate design work.

**ARC A (BACKLOG #61) is now CLOSED**: L1 (mutation manifest) → L2/L3 (presence/reachability primitives) → L4
(the 32-op sweep, 3 defects found, all now fixed: rotaryClock/#64, alignment/#65, parting/#66) → L5 (lathe
family fully ported onto the declared registry) → L6 (the seven remaining ops' affordances, declared from
evidence, not copied). Full account: WORK-LOG t2569.

### ⭐⭐⭐ t2571 — ASSESS ONLY: t2533's own STOP (diagAim/crossAim, a "category mismatch") answered further — a declarative shape EXISTS; translate's arity problem is UNRELATED and does not clear rule-of-three alone

t2533 stopped porting gestures 4-8 (`diagAim`) because its five inputs are ALL derived from Middle's own
internal geometry model, not literals/must-match-picked params. This turn traced every one of those inputs
(plus `crossAim`'s own sixth) to its actual source, not just its call site, and applied the real test: does a
declared shape exist, or does building one just relocate Middle's own business logic one layer sideways?

**Traced (OBSERVED, live code, `panelTypes.js:707-757` + `middleWizard.js:49-56`)**: `primaryX` reduces to
plain enum params (`axisOrder`/`axis`). `sign` (`dir2==='pos'?-1:1`) is an enum→number lookup — and
`canvasWidgets.js`'s own ALREADY-BUILT `probeVector` gesture bakes the identical shape in internally
(`dir==='neg'?-1:1`), proving it's a generalizable pattern, not new territory. `centreSec`/`centrePrim` read
live `stock.w`/`stock.h` — already read at this SAME layer by every other declared `anchor.kind` branch
shipped so far, just never exposed to an AUTHOR as a pickable source. `prim`'s fallback-to-centre-on-
non-numeric-sentinel is a general "field with a declared default" convention. `crossAim`'s own extra
dependency (`lineAt` riding another pass's live position) is the SAME shape the already-generic `relTo`
mechanism provides for point handles — an extension, not a new category.

**Answer: SIZE IT, both.** `diagAim` needs three new small, general primitives (a "system: stock W/H" pickable
source; a declared enum→sign table, promoting `probeVector`'s own internal pattern; a numeric-with-declared-
fallback field convention) plus one reused mechanism (`when`-gated presence, already precedented by
`USER_START_ROWS`). None of them is "ask the op for this value" — each NAMES a declared thing. INFERRED
estimate (not built): a MEDIUM lift, ~2-3× a two-picker gesture's own measured cost (t2533), smaller than "a
different-shaped, much bigger design question." `crossAim` needs the same three plus extending `relTo` to a
non-`point` gesture — real design work, but an extension of an existing mechanism, not an invented one.

**`translate`'s arity problem does NOT share a mechanism with this — answered directly, not assumed.**
`translate`'s blocker is HOW MANY field-pickers one block exposes (needs Blockly mutator/extendable-input
machinery); `diagAim`/`crossAim`'s blocker is WHERE a FIXED number of inputs come FROM. Orthogonal axes — a
mutator solves neither's root cause for the other. Per the owner's own stated bar (one mechanism serving three
gestures clears rule-of-three honestly; one serving `translate` alone does not), **mutator support is NOT
justified by this turn's evidence** — combining the two to manufacture a count would be gaming rule-of-three,
not reaching it. `translate` would need its own, separate justification.

Zero product code touched — an addendum to a closed arc, not a reopening. Full account: WORK-LOG t2571.

### ⭐⭐⭐⭐ t2573 — `diag_aim_handle` BUILT: two general primitives, four production tests green; a NEW finding, `feature_canvas`/handle picker-click instability at 4+ formfields, parked for its own turn

t2571 sized this as buildable, not "accept the limit." Built: `wizards/ops/anchorSources.js` (`resolveAnchorCoord`
— a closed stock-token vocabulary, `stockW`/`stockH`/`stockHalfW`/`stockHalfH`, not a formula language;
`resolveEnumSign` — the declared form of `probeVector`'s own internal enum-sign pattern) + `diagAimHandle.js`,
wired through the same six touch points every prior gesture port used. `resolveAnchorCoord` proven general (not
`diag_aim_handle`'s own private helper) via a SECOND, independent consumer: `point_handle`'s own ax/ay now
resolves through it too, verified live (`ax:'stockHalfW'` on a 100×80 stock renders at x=50).

**Four tests green**, exercising the exact production code paths a real UI action would call: round-trip both
directions (resolved + BOTH companions fail-visibly), gesture math in isolation, the stock-anchor primitive's
generality, and full `layoutSpecFromOp`/`emitMapped`/`builderOf` integration (hand-traced position matched
exactly; all four inputs independently confirmed to change the emitted G-code).

**The fifth test — the full manual UI-drive, the same t2517/t2525 bar every prior gesture met — PARKED, not
deleted**, after an exhaustive, evidence-based chase found and FIXED three real, generalisable pre-existing
test-harness bugs (cross-run workspace-model pollution; a keyboard-shortcut block-duplication risk in ANY
click-based field-set helper; `dragFlyoutBlockTo` failing silently) but could not isolate the final blocker: a
`diag_aim_handle` picker click opens a popup with the field's own CONFIRMED-correct `pickKind` yet shows stale
rows from an earlier interaction — reproducible only once a pilot needs a FOURTH formfield (this gesture's
own second picker pair), never hit by any of the 8 prior single-picker-pair gesture pilots. **New finding,
its own dedicated turn** — full diagnostic trail in WORK-LOG t2573, not silently buried.

Caught and fixed along the way: a real regression in `point-handle-block.spec.js`'s own pre-existing assertion
(ax/ay's new string representation); and — separately, unrelated to this build — t2569's own `emits:true`
additions had left `preview-spec-gate-1688`'s golden snapshot stale since that turn (its own `test:node` was
never run), regenerated and diffed clean this turn. `test:node`: 238/238. Full account: WORK-LOG t2573.

### ⭐⭐⭐⭐⭐ t2575 — FOUND+FIXED a real, general product bug (`dropdownPopup.js`'s own scroll-staleness); the parked test's diagnosis CORRECTED, not fully resolved — two further distinct issues remain

t2573's own "picker staleness" was misdiagnosed as a harness limitation. Pushed to test that assumption rather
than accept it — correctly: `dropdownPopup.js` (shared by every picker/options-editor field, `pickerField.js` +
`optionsEditorField.js`) is `position:fixed`, anchored to a field's own screen box only at open time, never
tracking the workspace's own scroll/pan. Proved real for an actual human (the same bar that settled BACKLOG
#70 and the search-flyout interception): a genuine `page.mouse.wheel()` scroll, no synthetic API call, leaves
a popup open at its stale coordinates, able to silently cover a different field's own next click. **Fixed**:
closes on a real `Blockly.Events.VIEWPORT_CHANGE`, armed 400ms after opening (two wrong attempts caught live
first: an unfiltered close self-closed on unrelated background churn; an unarmed-delay close self-closed on
the SAME click's own "scroll into view"). Shared regression (33 tests, all 8 gesture-block spec files):
green, no regression. `test:node`: 238/238.

**Re-testing the parked pilot with the fix in place did NOT reach green** — it failed differently, revealing
the popup bug was never the pilot's own sole blocker. Two further, DISTINCT, still-open issues found chasing
it: `feature_canvas` still fails a real flyout drag at this exact stack depth (proven separate — reproduced
again with the popup fix already shipped); and an API-created block's own field doesn't respond to a real
mouse click at all (proven via direct comparison: `elementFromPoint` resolves the correct element, yet no
popup opens, while calling `showEditor_()` directly does) — a save-dialog symptom surfaced past THAT, not yet
investigated. Re-parked with the corrected, three-part diagnosis (one fixed, two open) rather than left
standing on the original, now-known-incomplete framing. Full account: WORK-LOG t2575.

### ⭐⭐⭐⭐ t2579/t2581 — `feature_canvas` drag proven REAL for a human, then narrowed to a GENERAL gesture-creation
failure at this stack depth; guardrail triggered, stopped before fixing

t2579 settled whether the drag failure was a harness-speed artifact or real: a 4-attempt A/B (1 fast, 3 slow
with real pointer travel + 250-500ms hover pauses) ALL failed identically at the drop, while every other drag
in the same run landed on its first fast attempt. Real for a human. Side-finding, reported even though it came
from an inconclusive detour: an isolated 4-formfield stack built without the pilot's own BINDMODE/ATOMTYPE
picker history drags fine — the failure is STATE-dependent (tied to the prior interaction sequence), not
structure-dependent (raw stack depth).

t2581 attempted the fix on that lead, instrumented `dragFlyoutBlockTo` with `elementFromPoint` at three
checkpoints, `.blocklyDraggable.blocklyDragging` element counts, and `ws.currentGesture_` state around
mousedown. Reframed the bug: `ws.currentGesture_` stays `null` before AND after the `feature_canvas` mousedown
(vs a real gesture object on every one of the 10 prior successful drags in the run) — and a CONTROL drag of an
unrelated block (`length_handle`) at the identical sequence point ALSO failed to create a gesture. **So the bug
blocks ANY new drag gesture from starting at this point — it is not `feature_canvas`-specific.** Ruled out via
direct measurement: duplicate/disabled `feature_canvas` flyout entries (only one exists, `rendered:true`),
`Blockly.Events.isEnabled()` (true), `ws.options.readOnly` (false), a stray `position:fixed` overlay over the
canvas (none — enumerated all `body > div` elements), `Blockly.Touch.clearTouchIdentifier()` called directly as
a targeted fix attempt (did not unblock the control drag's own gesture creation either).

None of the checkable "leftover state" candidates explained it, and going further would need breakpoint-level
debugging of Blockly's own minified source — past what `page.evaluate`-based inspection reaches. Per the
dispatch's own explicit guardrail ("if the root is NOT leftover state ... STOP AND REPORT before fixing"),
stopped without forcing an unconfirmed fix. Zero product code changed this turn. Still open, now correctly
scoped as general (not `feature_canvas`-specific) rather than per-block. Full account: WORK-LOG t2579, t2581.

### ⭐⭐⭐⭐⭐ t2583 — `cross_aim_handle` BUILT: BACKLOG #61 CLOSED, both sized gestures now shipped — `relTo`
proven to extend beyond `point`-kind handles, three production tests green, UI-drive parked on t2581's own
still-open blocker (not fought again)

The SECOND and last gesture t2571's own assessment sized (`diagAim`'s own two primitives, REUSED unchanged,
PLUS extending `relTo` — previously wired only for `point`-kind handles — to feed a `crossAim`-shaped decl's
`lineAt`). Built: one new file (`wizards/ops/crossAimHandle.js`) + the same six touch-point edits every prior
gesture port used. `relTo` extension proven LIVE, not just designed: a real declared `simstart` row's own world
position, fed through `panelStarts` (the same source the 3D marker reads), correctly resolves `lineAt` — hand-
traced (60, distinct from the 40 stock-half default so the test can't pass by accident) — and correctly FALLS
BACK to the stock-half default when `panelStarts` isn't available yet, proving the defensive guard, not just the
happy path. Found, logged, and left alone (not this turn's to fix): `simstart`'s own block definition has no
author-facing `id` field yet, so `relTo` (in EITHER direction) has never actually been reachable by clicking
through the app — only by a literal template, which is how every non-UI-drive test on this file (including
this turn's own new relTo test) has always built its cases. Three tests green through real production code
paths (`layoutSpecFromOp`, `emitMapped`, `builderOf`), each proven non-vacuous by a live disable/re-enable of
its own covering branch. Regression: all 9 gesture-block spec files together — 37 passed, 0 failed, 2 skipped
(both known-parked UI-drive tests). `test:node`: 238/238, unchanged.

**The fourth (UI-drive) test PARKED without a fresh attempt** — the dispatch's own instruction: if it hits the
SAME blocker t2581 found, don't fight it again, prove what production code paths can prove, and park with the
same reason. It does hit the same blocker (a general, sequence-state-dependent gesture-creation failure, not
specific to any block type — t2581's own finding, unchanged by anything in this build). BACKLOG #61 is now
CLOSED as a build item: both `diagAim` and `crossAim` are shipped, block-authorable, and independently proven
correct through the same production code paths a real UI action would call — the ONE thing standing between
either and a full end-to-end UI proof is the general `feature_canvas` drag blocker t2579/t2581 already own as
its own separate, still-open item above. Full account: WORK-LOG t2583.

### ⭐⭐⭐⭐⭐ t2585 — `simstart` GAINS AN `id` FIELD: `relTo` made REACHABLE BY A PERSON, not just a template —
the fourth "declared seam, no declaring GUI" this session

`relTo` (`resolveRelToIndex`+`panelStarts`) was real, working code — consumed by `formfield`'s own pre-existing
point-handle socket AND `cross_aim_handle`'s new one (t2583) — that NO PERSON could reach: `simstart` had no
`id` FIELD, so a row's own stable identifier was only ever set-able via a literal template. Fixed: `simstart`
gains a plain, author-typed `id` field (matching `formfield`'s own `param` field's shape — the declaration site,
never itself a picker); `relToRow` (on BOTH `formfield` and `cross_aim_handle`) becomes a MUST-MATCH
`field_picker` (`pickKind:'relTo'`), mirroring `HANDLE_ANCHOR_FIELDS`' own CLOSED doctrine (t2525) — a `relTo`
naming an undeclared row is a plain authoring defect, not legitimate forward-authoring, so no `allowNew`.

**Deliberately not built, named not assumed**: no new save-time "dangling relTo" report — the picker already
closes the typo case; a row deleted later degrades to `panelTypes.js`'s own pre-existing graceful stock-half
fallback (the same path a `when`-gated absence already uses), not a new failure mode. `field` itself stays on
the pre-existing, already fail-visible HANDLE_ANCHOR_FIELDS doctrine, untouched.

Three tests (`tests/simstart-relto-reachability.spec.js`) prove REACHABILITY, not existence: bridge.js's REAL
block generation (a live `FieldPicker` with the right `pickKind`, not the raw data-model object every prior spec
tested); the picker's own LIVE candidate enumeration (empty → both declared ids, a blank one filtered); and — the
dispatch's own bar — a real save+reload plus a REAL mouse click on the picker that lists and COMMITS the
declared id, sidestepping the still-parked general gesture-creation blocker (t2581) via the reload path (t2577's
own cited proof) rather than re-hitting it. All three vacuity-checked live (reverted to HEAD, confirmed all 3
fail, restored). Regression: 8 gesture-block specs + this new one, 40/0/2skip; a 10-file simstart/formfield sweep,
22/22 (one isolated-run-confirmed environmental flake, unrelated — no formfield in that test's own stack at all);
`test:node` 238/238. Full account: WORK-LOG t2585.

---

### 62. [✅ FIXED t2469, round 4 — the ONE mechanism three Playwright rounds structurally could not reach: `vh`
resolves against the LARGE (chrome-hidden) viewport, so the sizer's last ~22px sit under a real phone's URL
bar when it's showing — invisible, exactly as reported. Fixed via the SAME `vh`→`dvh` remedy already used
elsewhere in this file (t782, t2081). Reachability (t2467) and selector/zero-size (t2423) both confirmed
sound — this is a FOURTH, orthogonal mechanism, not a re-litigation of either] THE WIZARD VIEW PANE'S BOTTOM
DRAG SIZER GOES MISSING — reported twice, four rounds of investigation, root found and fixed

*(filed t2463, per that turn's own explicit instruction: this defect has been living inside BACKLOG #61's own
prose — one of the owner's "5 real defects this week" cited when ARC A's gate was scoped — and, separately,
inside commit `84def5d1`'s own message as a "mid-turn amendment... investigated." Rule 8's whole premise is
that a fact living only in another entry's body is invisible to a scan — filing it properly, not fixing it.)*

**OBSERVED, twice, never reconciled:**
1. `84def5d1` (t2423, the SAME commit BACKLOG #58/#61's own `pane-sizes-from-window` mutation reverts) records:
   *"A mid-turn amendment (the pane's own bottom drag handle reportedly missing) was investigated — both of
   the advisor's own hypotheses (selector miss, zero-size) tested live and ruled out; a git-history sweep of
   every suspect commit found nothing touching the sizer's own mechanism or CSS at all. Not reproduced, not
   fixed — reported honestly with the negative evidence rather than guessed at."*
2. BACKLOG #61 (t2459) separately cites "the missing pane sizer" as one of five real preview defects the owner
   found on a real device THIS WEEK, worked against the gate design.

⇒ **These may be the SAME report or two separate ones — not established, and worth someone actually asking the
owner rather than assuming.** What IS established: the defect has never been reproduced by either the advisor
or a worker, no fix commit exists (t2423's own git-history sweep found nothing), and no test names or guards
against it.

⭐ **Why this is an ELEMENT-ABSENCE bug, structurally different from #61's own gate**: `dragRenderTruth.js`
(t2461)/the mutation manifest (t2463) both assert a handle's REAL rendered position is faithful to a drag —
they assume the handle EXISTS to measure. A sizer that never renders at all has no rect to read; this needs a
DIFFERENT, smaller primitive — a declared manifest of "which affordances THIS panel type should render" plus a
presence check per entry (BACKLOG #61's own L2, sized but not built).

⛔ **Not investigated further this turn** (t2463's own scope: manifest + gate only, no L2 primitives, no
product code unless a mutation exposes a live defect — this one was never mutated, since no fix commit exists
to derive a mutation FROM, and inventing a synthetic "the sizer element is removed" mutation without first
confirming the CURRENT sizer mechanism and selector would be guessing, not measuring).

**STILL REAL IF**: open the Blocks tab's Wizard View pane on a real device (per the owner's own two reports,
this may be a mobile/touch-specific reproduction, not a desktop one — neither hypothesis this was checked
against was device-specific) and look for the bottom drag-resize handle. If it's present, this entry may be
resolved incidentally by unrelated work since t2423 — re-verify against THAT hypothesis specifically (what
changed) rather than closing it on "can't find it now." If it's genuinely absent, the STILL REAL IF is exactly
that: reproduce it live, note the device/viewport/browser, and only then does a mutation for it become
buildable.

### ⭐⭐ t2465 — THE SELECTOR/MECHANISM CONFIRMED LIVE, AND A THIRD, GENUINE REPRODUCTION FOUND (not t2423's own
two ruled-out hypotheses) — measurement only, per this turn's own explicit instruction not to seed a mutation
blind

**The mechanism, confirmed by reading the source and checking live**: `web/ui/paneAccordion.js:340-348`,
`addVisualSizer(split)` — appends one `div.viz-pane-splitter.viz-pane-sizer` as the LAST child of `.viz-split`
(itself inside `.wiz-visual`), called for every `.wiz-visual .viz-split` found under the panel root
(`paneAccordion.js:745`). Selector: `.viz-pane-sizer` (scoped under `#blk_wiz_user` for the Blocks-tab Wizard
View specifically).

**DESKTOP (1800×900, corner op): renders correctly in BOTH pane states.** Default (narrow, stacked) pane:
1 sizer, real dimensions (349×6px), visible. Pane widened past 860px (the two-pane desktop layout, BACKLOG
#58's own condition): still 1 sizer, still real dimensions (574×6px), still visible. Matches t2423's own
"both hypotheses ruled out" finding — confirmed again, not just trusted.

**MOBILE (390×844, SAME corner op): the element exists with real dimensions, but is NOT REACHABLE — a genuine,
different reproduction.** `.viz-pane-sizer` is present (360×6px, non-zero — rules out t2423's own "zero-size"
hypothesis again) and IS technically a DOM descendant of `#blk-formpane` (`.wiz-body` → `.wiz-2pane` →
`.wiz-visual` → `.viz-split` → the sizer — confirmed via `Node.contains()`, not assumed from the selector
alone). But it renders at `top: 1408px` while the viewport is only 844px tall. **Scrolling `#blk-formpane`
(confirmed to genuinely have `overflow-y:auto` and a real overflow, `scrollHeight:1390` vs `clientHeight:472`)
to its own maximum scroll position (`scrollTop:918`, the true cap — `scrollHeight − clientHeight`) only moves
the sizer's `top` from 1408px to 1354px** — a 54px shift, nowhere near enough to bring a 6px-tall element into
an 844px viewport. **The sizer is not effectively reachable by scrolling on this viewport/op combination at
all**, despite technically living inside the one container that IS the page's own designated scroll surface.

⇒ **This is a THIRD hypothesis, not either of t2423's own two** (not a selector miss — the element resolves
correctly; not zero-size — it has real, drawable dimensions). The shape is closer to "the element renders
outside the effective scrollable range of its own scroll container" — root cause NOT diagnosed (out of this
turn's own explicit scope: measurement only, report don't fix) — a plausible direction for whoever picks this
up: `.wiz-visual`'s own height budget (`--viz-stack-h`, `calc()` rules in `styles.css`'s `@container` block)
interacting with a LONG form (corner's own 23 fields) under the STACKED (mobile) layout's `order` rules in a
way that doesn't compose the way the desktop two-pane layout does — a real, worthwhile lead, not a diagnosis.

⛔ **Still not seeded into the mutation manifest this turn** — a REPRODUCTION is now confirmed (unlike t2463's
own state), but building the actual FIX is a separate turn's job, and a presence-primitive mutation for THIS
specific defect would need to reproduce the LAYOUT interaction (form length × viewport × stacked mode), not
just hide an element — a materially different, larger mutation than L2's own acceptance seed. Named as the
concrete next step, not attempted here.

### ⭐⭐⭐ t2467 — CORRECTED: the "third reproduction" above was a TEST-METHODOLOGY ARTIFACT, not a real defect.
Diagnosed per the dispatch's own explicit ancestor-chain-walk instruction; the finding overturns t2465's own
conclusion, reported honestly rather than defended

**OBSERVED**: walked the ancestor chain from `.viz-pane-sizer` to `#blk-formpane`, reading computed
`position`/`overflow`/`transform`/`contain` at every level. `.wiz-visual` carries `position:sticky; top:0`
(`styles.css:2693-2697`, deliberate, t790: *"Lock the preview at the top: it stays pinned while the form
scrolls under it"*) — matching the dispatch's own first candidate lead exactly. `.right` (the ancestor wrapping
the WHOLE Wizard View pane) carries `position:fixed; transform:translateY(532px)` — and `532px` is EXACTLY
`min(62vh,520px)+12px`, the MOBILE BOTTOM-DRAWER's own CLOSED-state formula (`styles.css:6771-6778`,
`.right.open { transform:translateY(0) }`). **Every prior measurement of this defect — t2465's own included —
never clicked `#blkDrawerHandle`.** The 1408px/1354px readings were coordinates inside a CLOSED, translated-
off-screen overlay, not a broken scroll range inside visible content.

**Re-measured with the drawer properly opened** (a real click on `#blkDrawerHandle`, the only documented way a
user opens it — `blocksApp.js`'s own `wireDrawers()`): sizer reachable, at rest AND at max scroll. Stress-
tested across 4 viewport heights (844/700/600/500px) and a user-shrunk custom drawer height (`--blk-pv-h:
220px`): **reachable in every case tested, no exceptions.**

⇒ **The mechanism works correctly.** t2423's own two ruled-out hypotheses stand; t2465's own third hypothesis
is now ALSO ruled out, for a different reason (incomplete test methodology, not a wrong code theory). Per the
dispatch's own explicit instruction ("if the root turns out NOT to be reachability-shaped, say so and stop") —
stopped here: **no fix built** (nothing reproducibly broken), **no L3 primitive seeded against this defect**
(no real historical bug exists to build a guard from — a primitive guarding a defect that was never real would
be worse than no primitive at all). Screenshots: `verification/t2467-1-drawer-closed-default-state.png` (what
every prior measurement was actually looking at) / `verification/t2467-2-drawer-open-sizer-reachable.png` (the
corrected, complete reproduction). Full account: WORK-LOG t2467.

**Left for whoever revisits this entry**: since NO worker or advisor investigation across three rounds has
produced a genuine, reproducible instance of "the sizer is missing," the two original owner reports (t2423's
own "mid-turn amendment," and BACKLOG #61's own "5 real defects this week" citation) remain UNRECONCILED with
any Playwright-reproducible mechanism. Possible explanations, named without picking one: the two reports are
the same incident and the user simply hadn't opened the drawer either (a discoverability/UX question, not a
bug); a genuine device-specific quirk (a real mobile browser's own viewport/`dvh` handling diverging from
Playwright's emulation) that this testing environment cannot reproduce; or something not yet imagined. Not
established — worth asking the owner directly rather than a fourth investigation round on the same evidence.

**STILL REAL IF**: a NEW report describes the symptom AFTER confirming the mobile drawer was opened via
`#blkDrawerHandle` (or its real-device equivalent) — that is the one condition none of the three rounds so far
have actually tested against a genuine "opened, still unreachable" case. ⚠ Superseded in part by round 4
below — a NEW report after the `dvh` fix ships should be checked against round 4's own finding first.

### ⭐⭐⭐⭐ t2469, round 4 — FIXED: `vh` vs the real visible viewport, the mechanism invisible to all three prior
rounds BY CONSTRUCTION (Playwright's Chromium has no browser chrome to hide/show)

**OBSERVED** (`styles.css:6770-6774` before this turn): `#blocks-app .right { height:min(62vh,520px); … }`.
**OBSERVED** (t2467's own measurement, reused): with the drawer genuinely opened and scrolled to max, the
sizer sits at `top:822.5 / bottom:828.5` of an 844px viewport — inside the last **~22px**. `vh` resolves
against the LARGE viewport (URL bar retracted); on a real phone with the URL bar showing, that last ~22px is
exactly the zone a bottom browser chrome bar occupies. **CONFIRMED by direct measurement** (not assumed):
rendered a probe element at `min(62vh,520px)` vs `min(62dvh,520px)` vs `min(62svh,520px)` vs `min(62lvh,520px)`
at the same 390×844 viewport — all four resolved to the identical 520px in headless Chromium (no dynamic
toolbar to simulate). This is the SAME instrument limitation that hid the original bug from t2423/t2465/t2467
— now confirmed directly rather than only inferred, and it explains exactly why three rigorous rounds each
came back clean: none of them could have seen this by construction, no matter how carefully they measured.

**FIX, narrow** (`styles.css:6770-6777`): `vh` → `dvh`, declared AFTER the old `vh` line (dvh-unaware browsers
keep the old behaviour) — the IDENTICAL remedy this file already applies at t782 (§3234) and t2081 (§2024) for
the same class of bug, both with near-identical "dvh tracks what's ACTUALLY visible" comments. Not a new
pattern invented for this fix — the one spot in the mobile drawer family that had been missed.
`env(safe-area-inset-bottom)` for the home indicator was ALREADY present (line 6776, pre-existing) — nothing
to add there.

⚠ **Cannot be verified by rendered geometry, and that gap is reported plainly rather than papered over**: since
`vh`/`dvh` render identically in headless Chromium, no `page.route()` mutation can make the FIX show a
different pixel position than the bug did — the same "wrong instrument" problem that hid the bug also blocks
proving the fix by the L1/L2 rendered-truth pattern. Built instead: `tests/mobile-drawer-dvh-2469.spec.js`, a
DECLARATION guard (the served CSS uses `dvh`, not bare `vh`) — weaker than L1/L2's rendered-effect guarantee,
labeled as such, proven non-vacuous by an in-flight (never disk) revert to the original `vh`-only text, which
the same check correctly fails against. This is what an honest L3 looks like for a defect this test harness
cannot fully reach — a narrower, correctly-labeled guarantee, not a forced fit into the stronger pattern.

Desktop unregressed (re-confirmed live, not just reasoned about the media query): narrow pane sizer 349×6px,
byte-identical to t2465's own baseline; widened pane sizer still renders correctly (496×6px — a different
exact figure than t2465's 574×6px, from this turn's own cruder width-forcing technique, not a regression: the
`dvh` change sits entirely inside `@media (max-width:860px)`, which a 1400px desktop viewport never enters).
Full suite: see WORK-LOG t2469 (3012 passed, 2 failed, 14 flaky — both failures pre-existing/explained, neither
a regression, see WORK-LOG's own VERIFY section for the full account). Screenshot:
`verification/t2469-sizer-vs-visible-band.png` — the sizer visible below a marked line approximating a real
phone's visible-band edge with the URL bar showing.

**STILL REAL IF**: after this fix ships, a NEW report describes the symptom on a real device with the mobile
drawer genuinely opened — that would mean `dvh` alone isn't sufficient (a further toolbar-height/safe-area
edge case), not that this fix did nothing.

---

### 63. [✅ FIXED t2593] `undo-blind-writes-2427.spec.js` flakes SOLO (`--workers=1`, fully isolated) — a boot-timeout shape, the
SAME class as BACKLOG #57, structurally distinct from #56's contention-only shape

*(filed t2465, per that turn's own explicit instruction — t2463 declined to file this from the SAME evidence,
reasoning it "wasn't reproduced from a stable baseline first"; that reasoning was wrong, the measurement WAS
the reproduction. Corrected here, not silently.)*

**OBSERVED, t2463's own investigation (re-purposed as this entry's reproduction, not re-run from scratch)**:
while ruling out t2463's own two full-suite failures as contention rather than regressions, `undo-blind-
writes-2427.spec.js` was run **fully isolated, `--workers=1`, nothing else executing**, twice:
- At `--workers=2` (alongside nothing else, but not the strictest isolation): **3 of 4 tests flaky.**
- At `--workers=1`, truly alone: **2 of 4 tests still flaky** — `8 RAPID input-only writes... coalesce into
  exactly one undo entry` and `a DRAG-SHAPED burst (~27 writes...) still yields exactly ONE undo entry, not
  dozens`.

**The first error in both cases is a bare boot timeout**, not anything about undo/write-coalescing logic:
`TimeoutError: page.waitForFunction: Timeout 5000ms exceeded` at `page.goto('/'); await page.waitForFunction(()
=> window.ddcsStudio && window.showApp);` — the app has not finished booting within 5 seconds, even completely
alone with no other test competing for the CPU/browser.

⇒ **Same class as BACKLOG #57** (`undo-reproject-echo.spec.js` — flakes solo, not a contention artifact) —
**genuinely distinct from BACKLOG #56** (`open-as-modal-1625` — only misbehaves under 6-worker contention,
clean when isolated). Two confirmed SOLO flakes now exist, in different files, with no shared root cause
established yet and no shared entry — worth someone eventually asking whether they share a cause (a
slow-boot condition affecting ANY test that races a fixed short timeout against `window.ddcsStudio` readiness)
or are coincidentally similar in shape only.

⛔ **Not investigated further this turn** (t2465's own scope: the presence primitive + the small item, not a
new root-cause hunt) — for whoever picks it up: start from WHY the boot itself intermittently exceeds 5
seconds solo, not from the undo-coalescing logic these tests nominally exercise (which never got the chance to
run in either failing case — the boot never completed).

**STILL REAL IF**: `undo-blind-writes-2427.spec.js` fails/flakes again — alone, `--workers=1`, nothing else
running — on a turn that touches none of `programModel.js`'s save-state batching or `blocksApp.js`'s own boot
sequence. Cross-link BACKLOG #57 — if a shared root cause is ever found, merge the two rather than duplicating
the fix.

⚠ **t2467 (small item, characterization only) — the "worth someone eventually asking" question above, asked.
NO shared root found; refuted.** This test's own timeout is at `page.goto('/')` →
`waitForFunction(window.ddcsStudio && window.showApp)`, before anything else runs — `window.ddcsStudio` from
`app.js`'s `finishBoot()`, `window.showApp` from the separate `ui/gatewayStatus.js:239` module load. #57's
timeout is downstream, at a `waitX` AFTER `clickUndo`, reached only once boot already succeeded — a different
wait on a different subsystem (the undo/reproject pipeline), not the boot-readiness pipeline this entry's own
failure sits in. Different mechanisms; only a generic "async scheduling can be slow under load" factor is
common to both, which is not an actionable shared cause. See #57 for the same conclusion recorded there.

**t2593 — FIXED, a wait that was simply TOO SHORT for what it checks, not a wrong condition.** `playwright.
config.js`'s own global `actionTimeout: 5_000` governs a bare `page.waitForFunction()` call with no explicit
timeout — this file's own boot-readiness check had no explicit timeout, so it inherited the global 5000ms
default, matching this entry's own observed "Timeout 5000ms exceeded" exactly. **84 other spec files in this
same repo already pass an explicit `{timeout: 15000}` on this identical boot check** (grepped, counted, the
dominant convention by far) — this file was simply the one place that still relied on the tight global default
for a COLD APP BOOT specifically, a condition every other file already treats as deserving more slack than an
ordinary UI action. Fixed by matching the established convention: added `{timeout: 15000}` to both of this
file's own boot-wait calls, plus the two immediately-following `__blkws`/`ddcsEditWizardDef` readiness waits
(same class, same fix, found still flaking once at the SAME default after the first fix landed). **Proven, not
asserted**: 40 solo runs (`--workers=1`, `--repeat-each`) — 37 passed clean, 3 flaky (all retry-recovered, none
hard-failed), **zero of the original systemic ~50-75% solo failure rate remains.** Zero product code changed —
`programModel.js`/`blocksApp.js`'s own boot sequence untouched; the fix is entirely in the test's own timeout
values. Full account: WORK-LOG t2593.

---

### 64. [t2475 — a NARROW candidate fix was built AND TESTED, empirically REFUTED (zero effect on the repro) —
GUARDRAIL TRIPPED, stopped per the dispatch's own explicit condition, not fixed. t2561 — a SECOND hypothesis
(the pan-feedback loop) tested via a 4-condition kill-switch and ALSO REFUTED, but the kill-switch isolated the
REAL root as a byproduct. t2563 — the refit-on-drop's own scale recompute relocating the just-released handle,
FIXED at the time, but its own reconciliation turned out to be ENTANGLED with the (then still-present) pan
compounding, not independent of it. ✅ t2567 — the pan compounding ITSELF removed (owner-approved trade, see
BACKLOG #71's own arc), which is what actually makes t2563's fix reliable — the manifest guard now reverts
BOTH turns' own changes together (three files-array entries, not t2563's own one) because reverting either
alone no longer reproduces the historical bug] `rotaryClock`'s `__simstart0` marker SNAPPED BACK on release —
a real drag-render-truth defect, found by L4 (BACKLOG #61)

*(filed t2471, per L4's own explicit "report, don't fix, each becomes its own turn" scope — see BACKLOG #61's
own L4 section for the full sweep this was found in.)*

**OBSERVED, live, via `dragHandleRenderTruth`/`assertDragRenderFaithful`** (`user_rotary_clock_data`, default
params, `?debug=feat`, the manifest's own 1400×1000 viewport): dragging the `__simstart0` marker (a
`def.simStartParams`-declared handle, `rotaryClockData.js:161-165`) tracks the pointer well during the drag
(moved 44.7px) but settles at only 12.3px from start once released — **lost ~72% of its tracked movement on
release**, the exact "value reverting on release" signature `dragHandleRenderTruth` was built to catch
(t2447's own original bug class, BACKLOG #61's own header).

Not reproduced across multiple directions/repeats this turn (out of L4's own scope — the sweep tests ONE
representative handle per op, not exhaustive per-defect archaeology); the single measurement is reported as
what it is; a future turn confirming this should re-run before assuming it's stable across drag direction, the
way alignment's own entry (#65) was confirmed.

### ⭐⭐⭐ t2473 — ROOT DIAGNOSIS: reproduced across 5 vectors (deterministic, not flaky), and CONFIRMED SHARED
with #65 via a decisive, direct test. Not fixed — a confidence/risk call, explained plainly

**OBSERVED, 5 trials, fully reproduced**: `repeat-orig`/`repeat-orig2` (dx40,dy25) both IDENTICAL — 44.7→12.3
(deterministic, not a flake). `pureX` (dx60,dy0) and `pureY` (dx0,dy60): **NO snap-back at all**
(`movedMid===movedAfter` in both). `bigger` (dx90,dy60): 80→22.3, a real snap-back, same diagonal shape as the
original. ⇒ **Diagonal drags snap back; pure-axis drags don't** — unlike #65 (below), which snaps in every
direction tested.

**OBSERVED, the decisive test — does dragging A (`__simstart0`) also move B (`__simstart1`)?** It should NOT:
`writeSimStartFrac`'s own code comment (`userOpView.js:330-335`) states explicitly *"HANDLES ARE INDEPENDENT:
...dragging THIS one (A) must NOT carry the dependent (B)... B's ABSOLUTE position stays PUT."* **Measured: B
moved 24.6px when only A was dragged** — the documented invariant is violated, live, reproducibly. THE SAME
test against `alignment` (#65) shows B moving 62.7px under the identical circumstance — **the identical
contract violation, in the identical code path** (`writeSimStartFrac`'s `dj`/`writeSpan` recompute block,
`userOpView.js:330-335`, the ONLY code in the entire codebase that implements a `relSpanFrom`-dependent marker
pair). ⇒ **ONE SHARED ROOT, confirmed by direct behavioral evidence, not merely by resemblance.**

**INFERRED, not yet pinned to one line**: frame-by-frame instrumentation (reading the `span` form field + both
markers' screen positions at each mouse-move step, mid-drag) shows the `span` value jumping in ways that don't
track the raw pointer delta cleanly (20 → 36.8 → 46.0 across two modest, similar-sized steps), and A's own
final RELEASE position lands measurably different from its last LIVE mid-drag position even though the mouse
never moved between the last drag frame and release. This is consistent with — but not conclusively isolated
to — the SAME general bug class BACKLOG #46/t2447 already fixed once (a deferred-commit render landing against
a position the live drag never showed), recurring here in a SEPARATE code path (`userOpView.js`'s own
`simStartParams` marker mechanism) that t2447's own fix (`_suppressFitOnCommit`, scoped to
`featureCanvas.js`'s generic `onDragEnd`) never covered. The EXACT mechanism producing the release-time
divergence — most likely a fraction↔world round-trip through `opSimStarts` that doesn't match the live drag's
direct clamped-world display — was not isolated to a single line this turn.

⛔ **NOT FIXED — a deliberate confidence/risk judgment, stated plainly rather than glossed over.**
`userOpView.js` is the shared preview host for every wizard with a preview pane — an extremely high blast
radius. A narrow fix to a subtle release-vs-live-drag render mismatch needs the EXACT mechanism pinned first;
this turn's own evidence establishes WHERE the bug lives (confidently: `writeSimStartFrac`'s dependent-marker
recompute) and WHAT it does (confidently: violates its own documented independence contract) but not yet
PRECISELY WHY (the exact stale/round-trip step). Shipping a fix at this confidence level, to this file, risked
being exactly the kind of rushed patch this session's own standing discipline warns against. Recommended next
step, concrete: instrument `starts[dj]` and the fraction-store (`_simStartFracs`) directly across drag frames
(not just the DOM-visible `span` field, which this turn's own instrumentation already used) to catch the exact
frame where the divergence is introduced.

**RE-SWEEP, per the dispatch's own task 3 (required once one root was confirmed) — trivially COMPLETE, not
skipped**: `grep -rln "simStartParams\s*=" web/blocks/dataOps/*.js` returns EXACTLY `alignmentData.js` and
`rotaryClockData.js` — **no other op in the codebase declares a `relSpanFrom`-dependent marker pair.** The
blast radius of this SPECIFIC defect is therefore bounded to exactly these two ops; there is nothing else to
re-sweep. (Other ops use `simStartsProvider` for sim-only, non-declared markers — corner/edge/homing/etc. —
those never route through `writeSimStartFrac` at all, per the code's own comment: "Absent (corner/edge) → the
existing single sim-only Start marker, unchanged.")

### ⭐⭐⭐⭐⭐ t2475 — THE ADVISOR'S OWN LEAD TESTED AND NOT CONFIRMED; A SECOND, INDEPENDENTLY-DERIVED CANDIDATE
FIX BUILT AND EMPIRICALLY REFUTED; GUARDRAIL TRIPPED — stopped, per the dispatch's own explicit stop condition

**The advisor's own lead (INFERRED, from reading): `starts[dj]` reflects B's already-shifted world, not its
pre-drag world, so every frame recomputes the dependent span against a moving baseline.** Frame-by-frame
instrumentation (reading the `span` DOM field + both markers' screen positions at each single mouse-move step)
found the `span` value DOES climb across frames (20→36.8→46.0) — consistent with the lead on its face — but
crucially, **between the LAST live-drag frame and the release event, `span` stayed EXACTLY UNCHANGED (45.99
both times) while A's own on-screen position still shifted (507.4→496.8) with no further write of any kind in
between.** Since nothing recomputes `span`/the fraction store between the last drag frame and release, a
stale-baseline theory about the SPAN MATH cannot be what produces the RELEASE-time jump specifically — the
data feeding the render was already stable; only the RENDER of that stable data changed. The lead may still
describe a real, secondary effect during the drag itself; it is not what causes the final settle discrepancy.

**A second, independently-derived candidate, built from reading `featureCanvas.js`'s own `end()` handler
(t2447/BACKLOG #46's own fix site)**: the auto-fit recompute (`render()`'s own `if (!this._tf || (!this.
_userAdjusted && !this.active && !this._suppressFitOnCommit)) this._tf = this._fit(...)`) is frozen for the
WHOLE drag (`this.active` truthy) and unfreezes the instant `this.active` is cleared on release — but
`_suppressFitOnCommit` (which guards exactly this one eligible refit for pocket/surfacing-style handles) is
only ever set around a `spec.onDragEnd` call, and `simMarkers` (userOpView.js:828-832) declare `onDrag` only,
never `onDragEnd`. **Tested directly**: added `onDragEnd: () => mgr.update()` to `simMarkers` (a one-line,
narrow, structurally-motivated candidate, mirroring the EXISTING, proven pattern exactly) and re-ran BOTH
ops' own full 5-vector repro tables plus the B-moves-with-A test. **Result: byte-identical to before the
change, in every number, for both ops.** The fix had zero measurable effect — REFUTED, not just unconfirmed.
Reverted immediately (`git diff` confirmed byte-identical to HEAD before moving on).

⛔ **GUARDRAIL TRIPPED, stopped here — per the dispatch's own explicit condition**: *"if honouring the contract
requires restructuring the marker/drag machinery... stop, and report what you found."* Two independently-
motivated, structurally-reasonable candidates were TESTED (not merely proposed) and neither closes the gap.
The remaining plausible territory — WHY `mgr.update()` inside a hypothetical `onDragEnd` doesn't actually land
inside `_suppressFitOnCommit`'s own synchronous window (most likely: `mgr.update()`'s own call chain is
asynchronous/deferred somewhere between `userOpView.js` and `featureCanvas.js`, closing the suppress window
before the real render fires) — requires tracing `mgr.update()`'s OWN internal scheduling, which is exactly
the "restructuring... rather than correcting a value or a capture point" the guardrail was written to catch.
Not attempted further this turn. Full account, incl. the exact reverted diff and both fix-test result tables:
WORK-LOG t2475.

**STILL REAL IF**: `dragHandleRenderTruth(page, '__simstart0', {dx:44,dy:0,...})` (or similar) against
`user_rotary_clock_data`, booted per BACKLOG #61's own L4 recipe, shows `movedAfter` meaningfully less than
`movedMid` again — AND, separately, the `__simstart1`/B-moves-when-A-drags test (§ above) is the sharper,
root-confirming check: it should show `movedB` near 0, not 20+px, once/if this is ever fixed.

### ⭐⭐⭐⭐⭐⭐⭐ t2561/t2563 — THE REAL ROOT FOUND (a THIRD hypothesis, isolated by a kill-switch, not guessed)
and ✅ FIXED — see #65's own t2561/t2563 section for the full diagnosis+fix account (both ops share the
identical mechanism; #65's own five-vector table was the acceptance test)

t2561 tested a THIRD hypothesis (the pan-feedback loop this same arc had just found, `featureCanvas.js`'s
`_followHandle`) via a 4-condition kill-switch (pan on/off × refit-on-drop on/off) against `alignment`'s own
worst vector — REFUTED (disabling pan alone does not close the gap) — but the kill-switch isolated the REAL
root as a byproduct: `end()`'s own refit-on-drop recomputes a genuinely NEW `scale` (not just a re-centre),
and a scale change alone, applied to an ALREADY-CORRECT world position (the OLD "stale spec" claim was itself
checked and found FALSE this turn — measured directly, `this.spec` matches the last live drag frame exactly),
moves the marker's SCREEN position — the visible "snap." t2563 fixed it: only override the refit's own natural
`cxw`/`cyw` (restoring the pre-refit screen position) when the natural roomy fit would leave the marker CLOSER
to a viewport edge than it already was — reconciled this way (not exact-position preservation, which was tried
first and broke t732's own real purpose, see #65's own account below) so the refit still gives genuine
breathing room past the gutter for the NEXT drag. Verified against rotaryClock's own repro directly (this
entry, 0px residual) AND #65's own full five-vector table (below) — FOUR of five settle at 0px residual or
better; the fifth (the single most extreme drag) carries a real, DECLARED ~20px residual, entangled with the
separate pan-feedback arc (t2559/t2561), not silently claimed away. Permanent regression guard:
`tests/support/previewMutations.js`'s new `simstart-refit-snapback` entry (an in-flight code mutation
reverting the fix, seeded on the pure-+X vector for a clean signal both ways — proven to reproduce the
ORIGINAL numbers almost exactly, `75.4px mid → 55.1px after`, versus BACKLOG's own `75.4 → 55.3`), run by
`preview-mutation-manifest-2463.spec.js`. Full account: WORK-LOG t2561/t2563.

---

### 65. [t2475 — a SECOND hypothesis (the pan-feedback loop) tested via a 4-condition kill-switch, ALSO
REFUTED — but the kill-switch isolated the REAL root as a byproduct. t2563 fixed the refit-on-drop's own
reconciliation; ✅ t2567 removed the pan compounding it was entangled with, which is what makes it reliable —
see below. ⚠ The five-vector table's own residual did NOT close at t2567 — it MOVED (now 2 of 5 vectors carry
one, not 1 of 5), a DIFFERENT, unrelated-to-panning mechanism, declared not silently dropped, see below]
`alignment`'s `__simstart0` marker SNAPPED/CLAMPED to a near-fixed settle point regardless of drag direction or
magnitude — a real, REPRODUCED drag-render-truth defect, found by L4

*(filed t2471, same L4 sweep as #64 — see BACKLOG #61's own L4 section.)*

**OBSERVED, live, REPRODUCED across 5 independent trials** (`user_alignment_data`, default params, fresh boot
between each trial so no committed state carries over): dragging `__simstart0` (`alignmentData.js:149-154`,
another `simStartParams`-declared handle) by five DIFFERENT vectors —

```
  original (dx40,dy25):   moved 60.7 mid -> settled 54.7   (lost  6.0px)
  repeat of the same:      moved 61.3 mid -> settled 55.3   (lost  6.0px)
  pure +X (dx60,dy0):      moved 75.4 mid -> settled 55.3   (lost 20.1px)
  pure +Y (dx0,dy60):      moved 45.6 mid -> settled 54.0   (GAINED 8.4px — overshoot on release, not a loss)
  bigger diagonal (90,60): moved 100.9 mid -> settled 55.5  (lost 45.4px)
```

⇒ **The settle position clusters tightly around ~54-55px from start in FOUR of five trials, regardless of how
far or which direction the handle was dragged** — a genuine snap/clamp-to-value behavior, not a threshold
artifact of any one drag's own parameters (the "bigger" trial alone proves it: dragged 100.9px away, settled
at 55.5, losing 45px). The one outlier (`pure +Y`, which OVERSHOT slightly on release rather than losing
ground) is itself informative — the clamp target may not be a simple screen-space point but something
computed from the op's own two `simStartParams` bindings (`{x:'ax',y:'ay'}` then a `relSpanFrom` second
marker) interacting in a way this turn did not fully characterize.

### ⭐⭐⭐ t2473 — CONFIRMED SHARED ROOT with #64, see that entry's own full diagnosis (the "does dragging A also
move B" test, the `simStartParams` grep bounding the blast radius to exactly these two ops, the confidence/
risk reasoning for not fixing this turn)

The decisive test run against THIS op specifically: dragging `__simstart0` (A) moved `__simstart1` (B) by
**62.7px** — even larger than rotaryClock's own 24.6px — the identical documented-contract violation, in the
identical code path (`writeSimStartFrac`, `userOpView.js:330-335`). This is what elevates #64/#65 from "two
ops that happen to look similar" to "one root, confirmed by direct behavioral evidence": the SAME test, on the
SAME shared mechanism, produces the SAME class of violation on both, at different magnitudes consistent with
each op's own different declared parameters (`spanAxisFrom`/`signed` for alignment vs a fixed Y axis for
rotaryClock). Not fixed this turn — see #64's own entry for the full reasoning.

**t2475 — the candidate `onDragEnd: () => mgr.update()` fix was tested against THIS op too (all 5 vectors +
the B-moves-with-A check), not just rotaryClock**: byte-identical to before the change, same as #64's own
result — refuted here too, same guardrail, see #64's own t2475 section for the full account.

**STILL REAL IF**: repeating any of the five trials above against `user_alignment_data` still shows
`movedAfter` clustering near a value independent of the drag's own `dx`/`dy` — the reproducibility, not any
single number, is the claim. The sharper, root-confirming check: the B-moves-when-A-drags test should show
`movedB` near 0, not 60+px, once/if this is ever fixed.

### ⭐⭐⭐⭐⭐⭐⭐ t2561/t2563 — REFUTED a THIRD hypothesis (pan-feedback) via a proven kill-switch, found the REAL
root as a byproduct, ✅ FIXED — this entry's own five-vector table is the acceptance test, RE-RUN below

**t2561, the kill-switch (bigger-diagonal vector, dx90/dy60)**:

| condition | movedMid | movedAfter | snap-back |
|---|---|---|---|
| baseline (today's real behaviour) | 91.34 | 71.61 | −21.6% |
| pan DISABLED, refit-on-drop ON | 108.17 | 80.54 | −25.5% (still real, slightly WORSE) |
| pan ON, refit-on-drop DISABLED | 91.34 | **91.34** | **0% — exact** |
| BOTH disabled | 108.17 | **108.17** | **0% — exact** |

The advisor's own pan hypothesis (same ops, same handle, same `noSnap` path, a converging feedback loop
explaining a fixed settle point) was REFUTED by measurement, not accepted on plausibility — disabling
`_followHandle` alone does not close the gap. Disabling refit-on-drop alone, independent of pan, closes it
EXACTLY — isolating the real root to `featureCanvas.js`'s `end()` handler.

**t2563, the root, precisely (correcting the OLD "stale spec" framing this same block's own prior comment
carried)**: `end()`'s refit-on-drop computes a genuinely NEW `scale` (`_fit(..., roomy=true)`, to accommodate
the current extent generously) — MEASURED directly this turn: `this.spec` at this point is NOT stale (it
exactly matches the value the last live drag frame wrote; t2447's own adjacent comment already explains why —
an every-frame-commit handle leaves nothing for `onDragEnd` to flush, so no extra render happens in between).
The scale change ALONE, applied to that already-correct position, moves its SCREEN position — the visible
snap `dragHandleRenderTruth` measures (`getBoundingClientRect()`, never the model value). This is exactly why
#65's own cluster near ~55px was independent of drag distance: the roomy fit's own scale converges toward
roughly the SAME value regardless of where the drag actually went.

**THE FIX, two attempts, the second is what shipped**: a first attempt (capture the actively-dragged handle's
own screen position under the frozen mid-drag transform, then after the new roomy fit solve `cxw`/`cyw` to
restore it EXACTLY) gave every one of #65's own five vectors a 0px residual — but broke a REAL, PRE-EXISTING
test (`alignment-canvas-refit-732.spec.js`, t732's own canonical acceptance test): it pinned the marker at
EXACTLY the 80px drag gutter on every drop, defeating t732's own real purpose (give a gutter-pinned marker
BREATHING ROOM past the gutter so the NEXT drag has somewhere to go — `insets=[80,80,80,80]` instead of t732's
own required `>100`). Reconciled on the ONE claim genuinely in tension with t732 and not fighting it: EDGE
clearance. Compare the marker's own distance from the nearest viewport edge before refit (frozen mid-drag) and
after (the natural roomy fit); only override `cxw`/`cyw` (restoring the pre-refit position) when the natural
refit would leave the marker CLOSER to an edge than it already was; when the natural refit already gives AT
LEAST as much clearance (t732's own common case — its 104px roomy margin exceeds the 80px drag gutter), leave
the fit's own natural, generous placement alone.

**#65's own five-vector table, RE-RUN after the shipped fix** (the acceptance test named at dispatch, since it
is what refuted every prior theory):

```
  original (dx40,dy25):    moved 42.9 mid -> settled 66.6   (0px residual — settles PAST where it tracked)
  repeat of the same:      moved 42.9 mid -> settled 66.6   (0px residual — same)
  pure +X (dx60,dy0):      moved 62.0 mid -> settled 69.4   (0px residual — same)
  pure +Y (dx0,dy60):      moved 15.6 mid -> settled 63.9   (0px residual — same, incl. the ONE prior outlier)
  bigger diagonal (90,60): moved 91.3 mid -> settled 71.6   (⚠ ~20px residual — DECLARED, see below)
```

**FOUR of five settle at 0px residual or better** — several settle FURTHER from the drag start than the raw
mid-drag tracking alone (the natural roomy fit legitimately giving room, not a bug). **The fifth — "bigger
diagonal," the single MOST EXTREME drag in #65's own table — carries a real, MEASURED ~20px/22% residual**
(down from the pre-fix ~45px/50% loss, a substantial but not complete improvement). Root of the remainder,
stated plainly rather than glossed: the edge-distance reconciliation only intervenes when the natural refit
loses ground on EDGE clearance specifically; "bigger diagonal" 's own natural refit clears every edge FINE
while still drifting sideways from where the live drag tracked it — a real gap the edge-distance metric alone
does not close. A second reconciliation attempt (also gating on the marker's overall distance from where the
DRAG GESTURE began, not just the pre-refit frame) was tried and dropped: it did not improve "bigger diagonal"
at all, and it broke t732 a SECOND way (an ordinary, single large drag ALSO loses raw pixel distance-from-start
under any legitimate rescale — the metric fights any scale change, not just a bad one). Closing this residual
further looks entangled with the SEPARATE, deliberately out-of-scope pan-feedback compounding this same arc
already isolated and reported (t2559/t2561) — not something this block's own logic can finish alone.

#64's own rotaryClock repro re-run separately: 47.2 mid → 47.2 after, 0px residual. Permanent regression guard
seeded into the L1 mutation manifest (`tests/support/previewMutations.js`'s `simstart-refit-snapback` entry,
run by `preview-mutation-manifest-2463.spec.js`) — seeded on the PURE +X vector specifically (a clean, reliable
RED/GREEN signal both ways), not "bigger diagonal" (whose own declared residual would fail the runner's default
5px tolerance for a reason unrelated to whether the fix works). The mutation reproduces `75.4px mid → 55.1px
after`, matching BACKLOG's own original pure-+X number (`75.4 → 55.3`) almost exactly, proving the seed is a
faithful revert, not a synthetic guess. Full account: WORK-LOG t2561/t2563.

### ⭐⭐⭐⭐⭐⭐⭐ ✅ t2567 — THE PAN COMPOUNDING ITSELF REMOVED (owner-approved trade), the real severity fix.
Corrected an earlier "hang" claim. The five-vector residual did NOT close — it MOVED, declared honestly

**Owner-approved fix, built**: `featureCanvas.js`'s `_followHandle()` (t532) — the mid-drag auto-pan whose own
compounding was isolated at t2559/t2561/t2565 — REMOVED entirely (its one call site, its own function body,
and the `_followed` flag/trigger it fed in `end()`, all deleted; `_handleInGutter(id)` alone is now the
refit-on-drop's sufficient trigger). A `noSnap` marker dragged far enough now goes OFF-SCREEN mid-drag,
reappearing at a well-margined position once released (t2563's own refit-on-drop, unaffected). The trade the
owner took knowingly: exactness over always-visible — see WORK-LOG t2565/t2567 for the full reasoning.

**Severity table, re-measured with the fix, INCLUDING 300 steps (which previously timed out)**:
```
  steps=8:   jogY = +12.493   (exact, matches the naive mouse-px/scale expectation almost perfectly)
  steps=40:  jogY = +12.493   (identical)
  steps=100: jogY = +12.493   (identical)
  steps=300: jogY = +12.493   (identical — 139s wall-clock, same per-step rate as every other step count)
```
Stable and exact at every event count — the compounding is gone, not merely bounded.

**⚠ CORRECTION to the t2561/t2565 "hang" framing**: those turns reported "the 300-step run TIMED OUT at 60s"
and characterized it as "a hang class, same as BACKLOG #70." MEASURED THIS TURN, directly: giving the PRE-FIX
code a generous (300s) timeout, 300 steps ALSO completes — in 133.6s, the SAME per-step wall-clock rate as the
FIXED code's own 139s — producing `jogY = -2147.416` (continuing the super-linear growth, not a non-terminating
computation). The timeout was a plain, linear, per-step Playwright/CDP + re-render cost (~440ms/step in this
environment), present REGARDLESS of the bug, not the bug causing non-termination. The bug was always about the
WRONG VALUE, at every scale — severe, but never a hang. Precision matters here because the next person greps
for the symptom.

**#65's own five-vector table, RE-RUN with the fix — the residual did NOT close, it MOVED, and the mechanism
is now fully separated from panning**:
```
  original (dx40,dy25):    moved 47.2 mid -> settled 65.7    (0px residual — settles PAST where it tracked)
  repeat of the same:      moved 47.2 mid -> settled 65.7    (0px residual — same)
  pure +X (dx60,dy0):      moved 60.0 mid -> settled 80.0    (0px residual — same)
  pure +Y (dx0,dy60):      moved 60.0 mid -> settled 51.4    (⚠ NEW ~8.6px/14% residual — was 0px pre-t2567)
  bigger diagonal (90,60): moved 108.2 mid -> settled 80.5   (⚠ ~27.7px/26% residual — was ~19.7px/22px pre-t2567)
```
**Root, traced directly (not inferred)**: instrumented `end()`'s own edge-distance reconciliation (t2563) live
for both residual vectors and found `overrode: false` in BOTH cases — t2563's own override NEVER FIRES for
either. The residual is produced entirely by the NATURAL, un-overridden roomy refit's own bbox-centroid
placement, which is INDEPENDENT of panning: `_fit(..., roomy=true)` places the bbox's own extreme point at
roughly `ROOMY_MARGIN_PX`(104px) from an edge BY CONSTRUCTION, not at "wherever the live drag would show it" —
for a marker that lands deep in the gutter, that construction doesn't always coincide with "further along the
same trajectory." **Why the residual SPREAD rather than closing**: without the mid-drag auto-pan holding a
marker at a comfortable 80px margin throughout the drag, MORE drags now end with the marker landing DEEPER in
the gutter at release (nothing held it back) — exposing this same, always-present roomy-fit quirk on MORE
vectors than before (previously only the single most extreme vector, "bigger diagonal," penetrated deep enough
to show it). This is confirmed as a REAL, SEPARATE, BOUNDED mechanism — not growing with drag distance the way
the (now-fixed) pan compounding did — closer in kind to BACKLOG #73's own declared canvas-scale residual than
to #64/#65's own original severe defect. NOT fixed this turn (outside the explicit "one guarded early return"
scope) — reported plainly as a real, scoped, follow-on candidate, not silently absorbed or hidden.

**Permanent guard, RE-VERIFIED for the shipped state, with a real correction made to the guard ITSELF**: the
L1 manifest's own `simstart-refit-snapback` entry needed BOTH t2563's own reconciliation AND t2567's own
pan-removal reverted TOGETHER to reproduce the historical bug — two earlier attempts (revert t2567 alone;
revert t2567 alone but also missing the `_followed`-flag half of the trigger) each produced NO residual at
all, because the two fixes turned out NOT to be independent (t2563's reconciliation, left active, compensates
for a reintroduced pan on its own for this vector). The corrected, three-file mutation reproduces
`75.4px mid → 55.1px after`, matching BACKLOG's own original pure-+X number exactly. Full 9-entry manifest:
9/9 green with the shipped fix.

Full account, including the two failed single-mutation attempts and the live edge-distance trace that found
`overrode:false`: WORK-LOG t2565/t2567.

---

### 66. [t2479 — root PRECISELY BOUNDED; t2499 — ROOT CAUSE FOUND: a NEIGHBOURING handle's own click-to-edit
LABEL occludes `partPos`'s circle; ⭐⭐⭐⭐⭐⭐⭐ ✅ FIXED t2501 — handle shapes now paint (and hit-test) above every
label, app-wide, plus a permanent guard (`tests/lathe-handle-hit-2501.spec.js`) covering all ten ported lathe
handles] `parting`'s `partPos` handle DOES NOT RESPOND to a drag AT ALL — a real, REPRODUCED drag-render-truth
defect, found by L4, REPORT ONLY at first. Different SHAPE from #64/#65 — non-responsive, not a snap-back

*(filed t2471, same L4 sweep — see BACKLOG #61's own L4 section. Also directly refutes that entry's own
lathe-family "the gate can't drive it" prediction for the OTHER six lathe ops, which all responded correctly —
`parting` is the one genuine lathe-family defect this sweep found, not a gate-reach limitation.)*

**OBSERVED, live, REPRODUCED across FIVE drag directions, all showing IDENTICAL zero movement**
(`user_lathe_parting`, default params — `kind` defaults to `'part'` per `PART_DEFAULTS`): dragging `partPos`
(one of three declared handles on this op, alongside `partWidth`/`partFloor`) by pure +X, pure −X, pure +Y,
pure −Y, and a 60×40 diagonal — **every single trial: `movedMid: 0, movedAfter: 0`**. The handle is present in
the DOM at a real, non-zero rendered position (confirmed via the L4 sweep's own inventory pass, `x:290 y:1348`
at the un-viewport-corrected coordinates, i.e. genuinely on-canvas once the correct 1400×1000 viewport is
used), and `dragHandleRenderTruth` successfully locates and clicks it (no "handle never appears" throw) — so
this is not a selector miss or an absence bug. **The handle exists, is hit-testable, and simply never updates
its own rendered position no matter which direction or how far it's dragged.**

⇒ **A different defect SHAPE from #64/#65** (which both track the pointer during the drag and only fail on
release) — `partPos` never tracks at all, in any direction.

### ⭐⭐ t2473 (small item) — `partWidth`/`partFloor` tested across 5 directions each: BOTH RESPOND CORRECTLY,
settling the "op-wide vs handle-specific" question this entry itself named as open

**OBSERVED**: `partWidth` — tracks along X (9.1px `pureX+`, 60px `pureX-`, 60px `diag`), zero on pure Y (a
legitimate single-axis constraint, the SAME shape L4 already confirmed for `centerDrill`/`faceProbe`/`odProbe`
— not a defect). `partFloor` — tracks along Y (19.5px `pureY+`, 32.6px `pureY-`, 32.6px `diag`), zero on pure
X. **`movedMid === movedAfter` in EVERY responsive trial for both handles — no snap-back, ever.**

⇒ **The defect is `partPos`-SPECIFIC, not op-wide** — the THIRD of the three possible outcomes this entry
itself named, settled: not "all three dead" (ruled out) and not "mixed" in the sense of partial responsiveness
on the others (ruled out — both siblings are FULLY responsive on their own axis) — cleanly "only `partPos` is
dead." This is real diagnostic value for whoever fixes it next: `partWidth`/`partFloor` prove the op's own
rendering/drag INFRASTRUCTURE and the feature-canvas gesture wiring work correctly in general; whatever is
broken is specific to `partPos`'s own handle declaration or its own `onDrag` callback — a much narrower search
than "something is wrong with parting's preview." Not fixed this turn, per the dispatch's own explicit scope
(measurement to set up the next turn, not the fix).

**STILL REAL IF**: `dragHandleRenderTruth(page, 'partPos', {dx:60,dy:0,...})` (or any direction) against
`user_lathe_parting`, booted per BACKLOG #61's own L4 recipe, still shows zero movement — while
`partWidth`/`partFloor` (the diagnostic contrast) still respond normally on their own axis. If the siblings
ALSO stop responding, the shape of this entry has changed and needs re-diagnosing, not just re-confirming.

### ⭐⭐⭐⭐ t2479 — FOUR hypotheses tested against the diagnostic contrast (`partWidth`/`partFloor`), all four
REFUTED by direct measurement. Root PRECISELY BOUNDED but not fully pinned. GUARDRAIL TRIPPED, not fixed

**Hypothesis 1 — missing/malformed declaration (the dispatch's own anticipated L6 shape): REFUTED.** Read
`partProfileSpec` (`web/viz/latheProfileCanvas.js:277-326`) directly: `partPos`'s own declaration is
STRUCTURALLY IDENTICAL in shape to `partWidth`'s (`{id, x, y, kind:'size', axis, emits:true, label, value}`,
same fields, same `onDrag`/`onEdit` wiring pattern) — nothing missing, nothing malformed. Both are declared,
both are wired the same way.

**Hypothesis 2 — `partPos`'s drag silently grabs `partWidth` instead (they sit close together, ~10 screen px
apart at default `width:3`): REFUTED, directly.** Dragged at `partPos`'s own coordinates and measured BOTH
handles' screen positions before/mid/after — `partWidth` did NOT move either (`movedWidth: 0.0`). Nothing was
secretly grabbed; the gesture registered as a background pan, not a handle grab at all.

**Hypothesis 3 — the handle's own DOM bounding box is skewed by its label text, so the "center" Playwright
clicks isn't the true clickable circle: REFUTED.** Dumped the actual DOM: `.fc-handle[data-hid="partPos"]` is
a bare `<circle cx="221.02" cy="83.71" r="6">`, no children, a clean 12×12 bounding box exactly matching its
own radius — not skewed by the sibling `<text>` "face -10" (confirmed as a SEPARATE sibling element, rendered
on top visually but irrelevant to hit-testing — `featureCanvas.js`'s own `pointerdown` listener is bound to
the `<svg>` itself and hit-tests by WORLD COORDINATE math (`_hit()`), never by `e.target` — so the earlier
`elementFromPoint` "hits the text label" finding was a real but IRRELEVANT visual detail, not the cause).

**Hypothesis 4 — simple screen-proximity to `partWidth` (a hit-test tolerance overlap): REFUTED, decisively,
by a width-threshold sweep.** If proximity to `partWidth` were the cause, `partPos` should start working as
soon as the two handles are far enough apart. Measured `partPos`'s own responsiveness across `width` = 3, 5,
8, 10, 15, 20, 30mm (`_framed('user_lathe_parting', {width})`) — **fails through width=15 (49px screen
separation from `partWidth` — far beyond any plausible hit-test tolerance radius), and only starts working at
width=20 (65px separation).** A 49px gap failing while 65px succeeds is not explainable by "the two handles
are too close together" — the failure boundary sits well past where any reasonable proximity-based tolerance
argument would predict success. **This result surprised the turn's own leading hypothesis and is reported as
the refutation it is, not smoothed into a weaker version of the same theory.**

⚠ **Root NOT fully pinned — an honest gap, not glossed over.** The width-threshold sweep proves the mechanism
is real, reproducible, and tied to `width` specifically — but WHY a width-dependent boundary exists between
15mm and 20mm was not isolated to one line this turn. The most plausible remaining candidate (not tested,
named for whoever picks this up): `featureCanvas.js`'s own auto-fit (`_fit()`) may compute a DIFFERENT overall
view `scale` as the kerf rectangle's own width changes (even though the STOCK bounds it fits to come from the
bar's fixed profile, not `width` — worth checking whether `_fit()` ALSO considers handle/item extents, not
just `stock`), and since `_hit()`'s own tolerance is `13 / scale` — a smaller `scale` (more zoomed OUT) would
make the SAME 13-unit constant more forgiving in world terms, independent of on-screen handle spacing. Not
measured directly this turn (would need the live `FeatureCanvas` instance's own `_tf.scale` at each width,
not reachable from outside without new instrumentation).

⛔ **GUARDRAIL TRIPPED, stopped — no fix attempted.** Every candidate fix available without a confirmed
mechanism carries real risk: widening `PART_DEFAULTS.width` doesn't address the underlying capability (still
breaks for any REAL user who sets a realistic 2-4mm blade width, a legitimate value for actual parting
tools — this is not an edge case at the shipped default); touching `featureCanvas.js`'s own `_hit()` tolerance
or `_fit()` scale computation is a SHARED, cross-cutting change reaching every one of the 18 GREEN ops this
arc has already proven, exactly the kind of under-confident, broad change this session's own standing
discipline (and #64/#65's own precedent, same turn family) argues against. Four tested, refuted hypotheses is
real, valuable narrowing — a fifth, UNTESTED guess would not be. Full account: WORK-LOG t2479.

**STILL REAL IF**: unchanged — see the entry's own existing `STILL REAL IF` above; the width-threshold finding
adds a SECOND, sharper reproduction recipe: `partPos` fails at `width:15`, succeeds at `width:20`, using the
SAME `_framed('user_lathe_parting', {width})` boot this turn used.

**t2489, no action**: the advisor checked whether the L5 clamp-vocabulary work explains this — it does not.
`partPos`'s own drag writes `zFace` straight from `world.x` with NO bounding at all, clamp-shaped or otherwise.
Every clamp-shaped theory for this entry is eliminated, not just the max-clamp one.

**t2493, no action, reconfirmed**: `partProfileSpec` ported onto `canvasWidgets.js`'s registry (BACKLOG #61 /
L5) — `partPos`'s own place/drag math is now expressed via the `length` gesture (unclamped, matching the old
hand-written shape exactly) rather than hand-rolled. Verified LIVE, both directions, before AND after the
port: `movedMid:0.000, movedAfter:0.000` in every trial, unchanged either side. This further narrows the
search: the deadness survives a COMPLETE rewrite of the declaration's own expression, which is strong evidence
the root sits somewhere in FeatureCanvas's own render path (as this entry's own diagnosis already concluded),
not in anything specific to how `partProfileSpec` itself declares the handle.

⭐ **The framing that makes this the cleanest diagnostic contrast this entry has ever had** (t2495): `partPos`
is now a FULLY registry-driven `length` gesture — the exact same gesture, the exact same `buildCanvasWidgets`
builder, the exact same code path `facing`'s own handle uses, and `facing` WORKS (drags correctly, settles
correctly, no snap-back — proven repeatedly since t2485). One handle built by this code path works; the other,
built by the IDENTICAL code path with only its own numbers different, does not. That rules out the DECLARATION
entirely, as a class — not just this one declaration's own shape, but "something about how a lathe canvas spec
is written" as a category of explanation. Whatever is broken has to live in something `partPos` alone touches
that `facing`'s handle does not (its own id, its own field name, or something about WHERE in the DOM/render
order this particular op's handle lands) — a much narrower place to look than before this turn.

### ⭐⭐⭐⭐⭐⭐ t2499 — ROOT CAUSE FOUND AND CONFIRMED BY DIRECT OBSERVATION, four turns and roughly a dozen refuted
hypotheses later: `partFloor`'s own click-to-edit LABEL occludes `partPos`'s handle circle. STILL NOT FIXED —
diagnose-only, per this turn's own explicit scope

*(dispatched to answer a DIFFERENT question — does this share a root with BACKLOG #70's own polygon hang — and
the shared-root question is answered NO, see #70's own entry. Finding this along the way was the byproduct of
doing that comparison properly: t2495's own framing, "something about WHERE this handle lands," pointed exactly
here.)*

**OBSERVED, directly, via `document.elementFromPoint()` at `partPos`'s own handle centre**: swept `elementFromPoint`
at REST (no drag) for every currently-ported lathe handle with a value label — ten handles across seven ops
(`facing`/`centerDrill`/`faceProbe`/`odProbe`/`odTurn`/`parting`'s three/`polygon`'s two). **`partPos` is the
ONLY one where the point under the handle's own centre resolves to something OTHER than the handle itself** —
every other handle correctly resolves to its own `<circle class="fc-handle">`; `partPos` resolves to a
`<text class="fc-handle-label">` instead, with `e.target.closest('.fc-handle')` returning `null` (the label
element is not a descendant of the handle circle — a completely separate DOM node happening to sit on top of
it, confirmed via `featProbe.js`'s own passive `pointerdown` capture-phase listener never firing the
`▼ DRAG | hid:partPos` line at all when a real synthetic pointer lands there — the app's own drag machinery
never even SEES the gesture as targeting a handle).

**IDENTIFIED THE SPECIFIC OCCLUDING ELEMENT, by reading its own bounding rect against every label on the same
canvas**: `partFloor`'s own click-to-edit label ("stop Ø 12" in the default boot) — NOT `partPos`'s own label
("face -10", confirmed separately positioned, does not self-occlude) and NOT `partWidth`'s own label ("blade
3", confirmed vertically clear of `partPos`'s own centre). `partFloor`'s label right-edge/vertical-range
(`left:1288, right:1342, top:467, bottom:478`) DIRECTLY CONTAINS `partPos`'s own handle centre (`~1288,471`).

**THE MECHANISM, fully explained by the app's OWN label-placement rule** (`featureCanvas.js`, the `~c.x+10*lx,
c.y+8*ly` offset, default `lx:1, ly:-1` — "up and to the right" — declared once, per-handle, with NO awareness
of any OTHER handle that might sit in that direction): `partFloor` sits LOW on the bar (near the centreline,
small radius) while `partPos` sits HIGH (the bar's own outer surface) at a SIMILAR Z position (both near
`zBlade`/`zFace`, close together along the bar) — so `partFloor`'s own "up and to the right" label offset rides
UP far enough to land squarely on `partPos`'s own SEPARATE handle, directly above it in screen space. Neither
handle's own declaration is wrong in isolation; the collision is between TWO handles' own independently-correct
placements, on the SAME canvas, with no cross-handle label-collision avoidance anywhere in the rendering path.

**THIS EXPLAINS BOTH OF THE SYMPTOMS THIS ENTRY ALREADY DOCUMENTED, PRECISELY**:
1. **Zero movement in EVERY direction, always** (t2471/t2473's own finding) — the mousedown never reaches the
   handle's own drag-start logic at all; it lands on `partFloor`'s label instead, which the app treats as a
   click-to-edit target (a discrete action), not a drag-continuation surface. There is no drag to fail partway
   through; there is no drag AT ALL.
2. **The width-dependent threshold** (t2479's own finding — dead through `width:15`, alive at `width:20`) —
   `width` is the DISTANCE between `partPos`'s own `zFace` and `partFloor`'s own `zBlade` (`zBlade = zFace −
   width`). As `width` grows, the TWO handles' own Z (screen-X) positions separate further, and past some
   threshold `partFloor`'s label — offset a FIXED number of pixels from ITS OWN handle, not from `partPos`'s —
   no longer reaches far enough to overlap `partPos`'s own circle. This is not a coincidence needing its own
   separate explanation; it is the SAME mechanism, measured from a different angle.

**Confirmed the mechanism is genuinely NOT present for `polygon`'s own two handles** (`polyDepth`/`polyFlats`),
even pushed toward `polyFlats`' own clamp boundary (`acrossFlats:30`) — both remain cleanly hit-testable, no
label from either handle reaches the other (they sit ~92px apart on screen, well clear). This is the direct
measurement that answers BACKLOG #70's own shared-root question: **NO**, #70 is not this mechanism — see #70's
own entry for what that rules in/out for it instead.

⛔ **NOT FIXED — diagnose only, per that turn's own explicit scope.** The natural fix shape named then: label
placement needs to outrank a neighbour's handle, without teaching labels about their neighbours.

### ⭐⭐⭐⭐⭐⭐⭐ ✅ FIXED t2501 — handle shapes now paint (and hit-test) ABOVE every label, app-wide; a permanent
guard added covering all ten currently-ported lathe handles

**THE FIX, deliberately NOT cross-handle collision avoidance** (the advisor's own explicit guardrail: "do not
build it" — teaching a label about its neighbours is machinery an ordering rule makes unnecessary): 
`featureCanvas.js`'s own handle-drawing loop used to `appendChild` each handle's SHAPE, then immediately its
own LABEL, interleaved per-handle (`[h0-shape, h0-label, h1-shape, h1-label, h2-shape, h2-label, …]`). In SVG,
later-in-document-order paints (and hit-tests) on top — so a LATER handle's label could sit above an EARLIER
handle's own shape. Changed to collect every handle's own SHAPE into a `pendingHandles` array during the loop
(labels still append immediately, unchanged), then flush `pendingHandles` in a SECOND pass after the loop ends
— so every declared handle's own shape is now LAST in document order, collectively, regardless of which handle
appears earlier/later in the declaration array. One ordering rule, touching zero per-op code, zero new
declarations, zero label-to-handle awareness.

**Confirmed this does NOT break the one thing a naive fix (`labels: pointer-events:none`) would have** — an
EDITABLE label's own `pointer-events:auto` is untouched; it still wins over a `pointer-events:none` handle
sitting behind it in ITS OWN area (labels and their own handle don't overlap by construction, only a
NEIGHBOUR'S handle could ever be under a label, and that's exactly the case this fix reorders). Verified live:
clicked `partFloor`'s own "stop Ø" label after the fix, the inline editor opened, typed a new value, `Enter`,
and the model updated (`{"floorDiameter":9.5}`) — editing is completely undisturbed.

**Verified the actual bug is gone, at the SPECIFIC previously-dead configuration, not a different one**:
`partPos` dragged in all FIVE directions from this entry's own `STILL REAL IF` recipe, at `width:15` (the
CONFIRMED-dead width from t2479's own threshold sweep, not the 20mm width where it already worked) —
`pureX+`/`pureX-`/`diag` all move correctly (`movedMid:59.999/59.999/39.999`), `pureY+`/`pureY-` correctly show
zero (a legitimate single-axis constraint, `partPos` is an X-only handle, matching every other X-only handle in
the app — not a residual bug). `partWidth`/`partFloor` still drag correctly too (unaffected siblings).

**THE PERMANENT GUARD**: `tests/lathe-handle-hit-2501.spec.js` — a NEW claim this arc's own primitives (L2
presence, L3 reachability) never asked: not "does the affordance exist," not "is it inside the viewport," but
**can it be HIT** — does `document.elementFromPoint()` at a declared handle's own rendered centre resolve to
THAT handle, or does something else win the hit-test first. Ten tests, one per currently-ported lathe handle
(the `parting` family pinned to `width:15`, the exact dead configuration, not left at whatever the default
happens to be). Built with tools that already exist (`elementFromPoint`, standard Playwright locators) — no
new `tests/support/` primitive module, per the dispatch's own explicit instruction.

**Proven NON-VACUOUS, not assumed**: ran this exact guard against the code as it stood immediately before this
turn's own fix (`git checkout HEAD --` on `featureCanvas.js`, restored after, `diff`-confirmed byte-identical
restore) — `partPos` FAILED with the precise error naming `elementFromPoint` resolving to `partFloor`'s own
label, and all NINE other handles passed unchanged. Specific (doesn't cry wolf on unrelated handles) and
non-vacuous (catches exactly the bug it exists to catch) — confirmed both ways, not just one.

101 existing lathe/canvas-widgets tests (8 files) passed unedited. `test:node`: 238/238, zero snapshot diff (a
DOM append-order change touches nothing the snapshot gate captures — the declared spec shape is unchanged).
Full account: WORK-LOG t2501.

**STILL REAL IF**: `document.elementFromPoint()` at `partPos`'s own handle centre, on a live `user_lathe_parting`
boot at `width:15`, resolves to anything other than `partPos`'s own `<circle class="fc-handle">` — or
`tests/lathe-handle-hit-2501.spec.js` goes red for any of its ten cases.

---

### 67. [✅ FIXED t2477 — a namespace mismatch in formWidgets.js's own tree-render `sim`/`panel` node handlers,
confirmed live (screenshot) and via a re-run of L4's own gate] `drill`'s Blocks-tab "Wizard View" pane hides
its ENTIRE visual panel (`display:none`) — a REAL product defect, NOT a gate/boot limitation

*(filed t2475, small item — L4's own CAN'T-RUN outlier for `drill`, BACKLOG #61's own L4 section. Drilling is
among the most-used ops in the app; this is the significant-find outcome that dispatch anticipated.)*

**OBSERVED, three independent boot methods compared, a clean A/B**:
1. `window.openWiz('drill')` (the legacy standalone modal path) — **the feature canvas mounts correctly**:
   `hasFeatureCanvas:true, fcHandleCount:1`. Real, working, on-screen.
2. `stackToWorkspace([op], ws)` (a REAL toolbox-drag simulation — the same primitive a genuine drag-from-
   palette uses, not a synthetic `ddcsLoadBlockStack` shortcut) into the Blocks-tab pane — **the canvas never
   mounts**: `hasFeatureCanvas:false, fcHandleCount:0`.
3. The L4 sweep's own boot (`_framed`+`makeOp`+`ddcsLoadBlockStack`) — same failure, confirming methods 2 and
   3 agree with each other and disagree with method 1.

⇒ **Not a gate-reach limitation** — the SAME underlying twin (`user_drill_data`), the SAME `def.previewGeometry`
(`drillData.js:452`, confirmed declared, same mechanism every working op uses), renders correctly through ONE
real code path and not through the OTHER, REAL, CURRENT-generation surface (the Blocks-tab pane every other of
the 31 tested ops uses successfully).

**THE PRECISE MECHANISM, pinned by direct DOM inspection**: `#blk_wiz_user .wiz-visual` — the container
hosting the WHOLE 3D+2D preview split, not just the 2D handle canvas — renders with `style="display: none;"`
for drill specifically in the Blocks-tab pane. `#blk_userVizContainer` (where the feature-canvas SVG would
mount) exists but is completely empty — nothing ever tries to render into it, because the whole panel is
hidden before that point. `userOpView.js`'s own `applyPanel()` sets exactly this: `vis.style.display =
panelType(_def.panel).viz ? '' : 'none'` — and drill's own def DOES declare `panel:'form3d+2d'` (confirmed,
`drillData.js:444`), the SAME value every correctly-rendering op uses. So `panelType('form3d+2d').viz` should
resolve `true` for drill exactly as it does for every other op — the discrepancy is NOT in the panel value
itself.

**LIKELY ROOT, INFERRED not confirmed this turn**: drill is the ONLY op in the entire L4-tested set built on
the TREE render path (`hasTreeLayout()` → `renderUiTree`, landed t2341 — "THE FLIP," an 8-attempt, extensively
documented migration wrapping drill's own `uiChildren` in a `split_horizontal` node so its live render is
driven by its own declaration instead of the old hardcoded `#wiz_drill` shell). t2341's own referenced test
suite (`drill-form-reproduction-2299.spec.js` and 7 siblings) is thorough on FORM STRUCTURE fidelity and the
standalone-modal render — but `drill-form-reproduction-2299.spec.js`'s own header comment states the tree "has
no `split_*` node... confirmed in the header comment above `drillDataStack`" — **that comment is now STALE**:
the CURRENT `drillData.js:329` literally declares `type:'split_horizontal'`, meaning drill DID move onto the
tree path at some point after that comment was written, and the comment was never updated. Plausible that the
tree-migration's own test suite, written and passing BEFORE (or without exercising) the Blocks-tab pane's own
`applyPanel()` visibility toggle specifically, never caught this — the migration's own extensive prior work
(11 findings across 8 attempts) is real and thorough, but this ONE surface may genuinely have been outside its
own test net.

⛔ **Not fixed, not investigated further this turn** — per the dispatch's own explicit scope ("report, don't
fix"). Concrete next step for whoever picks this up: read `applyPanel()`/`panelType()`'s own resolution
against `_def` specifically when `hasTreeLayout(_def.template)` is true, and check whether the visibility
toggle runs BEFORE or reads from a DIFFERENT value than the tree-render path expects.

**STILL REAL IF**: `stackToWorkspace([op], window.__blkws)` for `user_drill_data` (booted per this entry's own
method 2 above) still shows `#blk_wiz_user .wiz-visual` computed `display:none` while `window.openWiz('drill')`
still renders `svg.feature-canvas` correctly — the A/B contrast, not either fact alone, is the claim.

### ⭐⭐⭐⭐ t2477 — FIXED, root pinned precisely, DIFFERENT from the advisor's own predicted "silent-falsy seam"

**The advisor's own theory-to-kill was correctly killed first**: `applyPanel()` never consults `hasTreeLayout`
— confirmed, matched the dispatch's own pre-emptive check. **The advisor's own "silent-falsy seam" lead
(`_def`/`panel` resolving silently to hidden) was ALSO not the mechanism** — `panelType('form3d+2d')` resolves
`{viz:true, mode:'3d2d'}` correctly for drill, measured directly, no ambiguity.

**OBSERVED, the real mechanism, found by reading `render()`'s own `isTree` branch (`userOpView.js:426-428`)**:
for tree-mode ops, `.wiz-visual`'s OUTER, always-present shell IS deliberately hidden (`vis.style.display =
'none'`, unconditional) — but this is BY DESIGN, not the bug: drill's own tree ALREADY declares its OWN nested
visual pane (a `sim` node inside its `split_horizontal`'s `RIGHT` mouth), meant to REPLACE the outer one, not
duplicate it. **Deep-DOM-dumped the inner, tree-rendered `.wiz-visual` specifically** (my first dump missed it
entirely — a depth-6 cutoff in my own diagnostic script hid it; corrected and re-dumped deeper): the inner
pane's full shell EXISTS — `#userViz3dBox_tree`, `#userViz3dContainer_tree`, `#userVizContainer_tree`, all
present, correctly structured — but EVERY ONE has **zero children**. The shell renders; nothing ever draws
into it.

**THE ROOT — a genuine namespace mismatch, confirmed precisely**: `userOpView.js`'s own `vid()`/`vel()`
resolvers (added at t2323, "BACKLOG #21's own next layer, found gating drill's flip at t2321" — a PRIOR fix
for exactly this defect class) correctly prefix every viz id with the CALLER's own namespace
(`createUserOpView(ns)` — `ns='blk'` for the Blocks-tab pane, `ns=null` for the standalone modal) before
looking anything up: `vid('userViz3dContainer')` resolves to `blk_userViz3dContainer_tree` for the Blocks-tab
context. But `formWidgets.js`'s own `sim`/`panel` tree-node handlers (the code that BUILDS these elements,
`renderUiTree`) hardcode them with **NO namespace prefix at all** — always the bare `userViz3dContainer_tree`.
For `ns=null` (the modal) both sides happen to agree (no prefix either way) — which is EXACTLY why the modal
has always worked and hid this bug. For `ns='blk'` (the Blocks-tab pane) they diverge: the LOOKUP side wants
`blk_userViz3dContainer_tree`, the BUILD side made `userViz3dContainer_tree` — nothing rendered by `mgr.
preview3D()` or the 2D feature-canvas mount could ever find its own target container, so nothing ever drew.

**THE FIX, narrow, confirmed both directions**:
- `web/ui/formWidgets.js` — `renderUiTree` gains an optional 6th parameter, `ns = null`, and a local `nsId(base)
  = ns ? \`${ns}_${base}\` : base` helper mirroring `userOpView.js`'s own `id()` EXACTLY. Every hardcoded
  `_tree`-suffixed id in the `sim`/`panel` branches (8 occurrences) now goes through `nsId(...)`. `ns=null` (the
  default, and every OTHER caller — there is exactly one call site in the whole codebase) is byte-identical to
  before this turn.
- `web/wizards/views/userOpView.js` — the ONE call site passes its own closure `ns` through:
  `renderUiTree(host, ..., null, ns)`.

**Confirmed live, both directions**: drill's Blocks-tab pane now shows a real, populated 3D scene AND a real 2D
layout view with a genuine draggable `pos` handle (`hasFeatureCanvas:true`, `fcHandleCount:1`,
`c2dChildren:2`, real SVG grid content). Regression-checked: pocket (flat mode, `ns='blk'` too — unaffected,
`nsId` is a no-op for every non-tree node type) still renders correctly (`fcHandleCount:2`, unchanged); drill
via the standalone modal (`ns=null`) still works unchanged. Screenshots: `verification/t2477-drill-visual-
pane-fixed.png` (the full Blocks-tab pane, real 3D+2D content visible on the right) and `verification/t2477-
drill-visual-pane-fixed-closeup.png` (the populated 2D canvas itself, close up).

**Regression suite, targeted before the full run**: every test t2341's own migration comment names
(`no-duplicate-ids-tree-render-2319`, `geometry-seam-tree-mode-2323` — BOTH its tree-mode AND flat-mode
control cases, `split-node-responsive-2327`, `stack-bridge-multi-mouth-2333`, `form-row-composite-widget-2335`,
`stock-spill-792`, `roundtrip-whole-program-1319`) plus `twin-form-completeness-1581` (the full 32-op form
sweep) — **19/19 passed.** The preview mutation manifest (7 tests, incl. the t2471 disk-cleanliness rewrite) —
**7/7 passed.**

### ⭐ L4 RE-SWEEP on drill — an honest, INCONCLUSIVE secondary finding, reported not chased. ⭐⭐ RESOLVED at
t2479 (BACKLOG #68) — a REAL reachability defect, not instrumentation: the inner visual pane can render with
computed `width:0`, positioning its own handle past the viewport edge with no scroll mechanism to reach it.
Filed, not fixed. Full account in #68

Per the dispatch's own VERIFY item 4: re-ran the drag-render-truth gate against drill's own primary handle
(`dr_pos`) now that the canvas mounts. **Result: RED — `movedMid:0, movedAfter:0`.** Before trusting that as a
real defect, checked WHY (this session's own established discipline, per the several false-reds L4's own first
pass produced): `document.elementFromPoint()` at the handle's own reported center returns `.blk-formpane` — an
UNRELATED, overlapping element — not the handle. **This is either a genuine interaction-blocking overlap bug
(the visible pixels render correctly per the screenshot, but something else's hit-box sits on top) or a
test-harness artifact specific to this synthetic boot's own scroll/layout state** — tried 3 viewport widths
(1400/1800/2400px) and an explicit `scrollIntoViewIfNeeded()`, all show the identical `.blk-formpane` overlap.
**Not resolved either way this turn** — out of scope per the dispatch's own explicit instruction ("it may come
back RED, that is a finding not a failure of the fix, report do not fix"). Named honestly as unresolved rather
than guessed at in either direction. Whoever picks this up: start from `.blk-formpane`'s own computed
`position`/`z-index`/bounding rect at drill's own handle coordinates, the same OBSERVED-first discipline this
whole diagnosis used.

**BACKLOG #61's own L4 table**: `drill` moves from CAN'T-RUN (11) to a genuine, if inconclusive, verdict —
correction filed in that entry directly, not left stale here.

**STILL REAL IF**: `stackToWorkspace([op], window.__blkws)` for `user_drill_data`, booted per this entry's own
method 2, now shows the OUTER `.wiz-visual` still correctly `display:none` (by design) but the INNER,
tree-rendered one populated with real children under `#blk_userViz3dContainer_tree`/`#blk_userVizContainer_
tree` — if either goes empty again, the namespace fix regressed. The `.blk-formpane` overlap finding is
separately still real if `elementFromPoint` at `dr_pos`'s own coordinates returns anything other than the
handle itself.

---

### 68. [✅ FIXED t2481 — the missing `@container` treatment for drill's tree-rendered `.ui-split-horiz` split,
mirroring t2423's own already-proven pattern; guarded permanently by BACKLOG #61's own L3 primitive] `drill`'s
Blocks-tab visual pane can render with ZERO computed width, positioning its own handles PAST the viewport edge
with no scroll mechanism to reach them — a REAL reachability defect, distinct from BACKLOG #67's own namespace
fix

*(filed t2479, small item — characterizing BACKLOG #67's own L4 gate-RED finding on `drill`. Bounded to the
narrow question the dispatch asked: instrumentation artifact, or a real overlay/reachability issue a user
would also hit? Answer: the latter — filed, not left as a characterization note.)*

**⭐ FIXED t2481.** Root: drill's own tree-rendered horizontal split (`.ui-split-horiz`, introduced at t2341) was
never given the `@container (max-width: 860px)` narrow-pane stacking treatment that `.wiz-2pane`/`.wiz-controls`/
`.wiz-visual` already received at t1760/t2423 (BACKLOG #58) — only the older `@media`-keyed (WINDOW-width) rule,
which never fires when the window is wide even though the PANE itself (`#blk-formpane`) is narrow. With the
window wide but the pane narrow (349px, the Blocks tab's own default), `.ui-split-pane1`'s fixed `flex: 0 0
360px` column overflowed its own narrow flex container, starving `.ui-split-pane2` (`flex: 1 1 0`, nothing left
to grow into) to a genuine computed `width:0` — landing `dr_pos` off-screen with no scroll mechanism to reach it
(exactly t2479's own measurement). Fix, `web/styles.css` inside the EXISTING `@container` block (mirroring
t2423's own `.wiz-2pane` rules just above, verbatim same 860px figure, now asked of the pane instead of the
window):
```css
#blk_wiz_user .ui-split-horiz { flex-direction: column; height: auto; }
#blk_wiz_user .ui-split-horiz > .ui-split-pane1 { flex: 0 0 auto; order: 2; }
#blk_wiz_user .ui-split-horiz > .ui-split-pane2 { flex: 0 0 auto; order: 1; min-height: 0; }
```
Confirmed live both directions (screenshot: `verification/t2481-drill-visualization-fixed.png`) and against 3
other scenarios (wide-pane drill, pocket, standalone modal) — all clean. **Permanently guarded**: this is BACKLOG
#61's own L3 primitive's forcing case (`tests/support/affordanceReachability.js`, new this turn) — seeded into
the L1 mutation manifest as `drill-split-pane-unreachable` (`tests/support/previewMutations.js`), proven RED
under an in-flight revert of the fix and GREEN against current code. Full account: WORK-LOG t2481.

⚠ **Fixing this surfaced a SECOND, different RED** once `dr_pos` became reachable at all — drag doesn't track
the pointer. Not the same defect; filed separately as BACKLOG #69, not fixed.

**OBSERVED, a clean single measurement** (`user_drill_data`, default params, `stackToWorkspace` boot — the
same real toolbox-drag simulation BACKLOG #67's own A/B used, 1400×1000 viewport, the SAME viewport L4's own
sweep uses throughout): `dr_pos`'s own handle renders at `x:1524.8` — **beyond the 1400px viewport itself**
(`handleOffscreen: true`). The INNER, tree-rendered `.wiz-visual` pane (the one BACKLOG #67's own namespace
fix populates) has a computed **`width: 0`** at this exact boot condition — `x:1412, right:1412`, itself
sitting just past the viewport's own right edge. **`document.documentElement.scrollWidth` and
`document.body.scrollWidth` both equal exactly `1400`** — the viewport width, with NO horizontal overflow at
all — meaning there is **no scrollbar, no scroll mechanism of any kind** that could bring this content into
view. The handle isn't merely off the CURRENT scroll position; it's rendered somewhere the document itself
never expands to reach.

⇒ **This is not a Playwright hit-test artifact — the earlier "`.blk-formpane` intercepts the click" finding
(BACKLOG #67's own report) was a downstream SYMPTOM of this, not a separate cause.** A real user opening drill
in the Blocks-tab pane, under whatever layout condition produces this zero-width inner pane, would face the
identical problem: content rendered, technically present in the DOM, genuinely un-reachable — no amount of
scrolling, on a real device either, would bring it into view, because the DOCUMENT never grows to contain it
(the content escapes its own zero-width container without expanding anything that could be scrolled).

**LIKELY MECHANISM, INFERRED not confirmed**: a flex/layout sizing failure specific to the SECOND pane
(`ui-split-pane2`, the tree's own `split_horizontal` RIGHT mouth) computing a `0` width under this boot
condition — the SVG content inside then renders using its own internal viewBox coordinates, which are NOT
clipped to a zero-width parent, escaping visually to wherever the pattern's own world-to-screen transform
places it. Plausibly related to, but not confirmed as the same root as, BACKLOG #58's own prior "the pane
sizes itself from the window, not from itself" class of bug — not chased to that precision this turn, per the
dispatch's own explicit "bound it to the narrow question" scope.

⛔ **Not fixed, not investigated further this turn** — REPORT ONLY, per the dispatch's own explicit scope.
Concrete next step for whoever picks this up: measure `.ui-split-pane2`'s own computed flex-basis/width at the
exact moment this zero-width state occurs, and whether it self-corrects on a later resize/layout pass (a
"first paint before layout settles" race) or is a genuinely stable, wrong final state.

**Consequence for L5, named plainly since the dispatch specifically asked**: this means the drag-render-truth
gate's own RED on `drill` is **NOT purely an instrumentation limitation** — it found something real. The
narrower, more precise claim for L5's own safety argument: the gate DOES still faithfully report what it
measures (a real reachability gap), it just measured a DIFFERENT layer (pane sizing) than the ORIGINAL L1/L2
gate family was built to catch (drag-render fidelity once a handle IS reachable). Not a false RED — a
genuinely different, valid RED.

**STILL REAL IF**: `stackToWorkspace([op], window.__blkws)` for `user_drill_data`, booted at 1400×1000 (BACKLOG
#61's own L4 viewport), still shows the inner `.wiz-visual`'s own computed `width:0` alongside
`document.documentElement.scrollWidth === window.innerWidth` (no scroll mechanism exists to reach the
escaped content).


---

### 69. [✅ FIXED, confirmed t2591 — as a SIDE EFFECT of BACKLOG #72's own t2547 fix, not a separate act]
`drill`'s `dr_pos` handle no longer tracks the pointer during a drag — surfaced ONLY once BACKLOG #68's
reachability fix landed; a different, unrelated defect at the time it was filed

*(filed t2481, discovered as a side effect of fixing #68 — explicitly sanctioned by that turn's own dispatch:
"It may come back RED — that is a FINDING not a failure of the fix." Fixing reachability finally let L4's own
drag-render-truth gate reach `dr_pos` for the first time; it came back RED, for a genuinely different reason
than #68.)*

**OBSERVED, live**: once `dr_pos` is on-screen (post-#68-fix), a real pointer-drag gesture (`mouse.down` at the
handle's own center → `mouse.move` in steps → `mouse.up`) does not move the handle. Hit-testing at the drag's
own start coordinate via `document.elementFromPoint(x, y)` returns `DIV.wiz-controls`, not the SVG handle —
**even though the coordinate is geometrically within the SVG's own `getBoundingClientRect()`.** Confirmed via a
direct rect check that `.ui-split-pane1` (the controls column, `x:651–1493`) and `.ui-split-pane2` (the visual
column, `x:148–635`) do NOT overlap — the two panes are cleanly separated, so this is not a simple z-order/
overlap bug in the obvious sense.

**ONE candidate tried, empirically REFUTED, reverted** — per this arc's own guardrail discipline (test a
candidate directly; if it has zero measurable effect, revert rather than leave unproven speculative code in a
shared render path): added `position: sticky; top: 0; z-index: 3; background: var(--panel);` to
`.ui-split-pane2` in `web/styles.css`, mirroring the WORKING sibling pattern already on `.wiz-2pane >
.wiz-visual`. Verified via `getComputedStyle` that the sticky/z-index rules DID apply as written
(`position:sticky, zIndex:3, top:0px`, confirmed) — the hit-test result was UNCHANGED regardless
(`elementFromPoint` still returned `.wiz-controls`). Reverted; `web/styles.css` carries only BACKLOG #68's own
minimal 3-line fix, no sticky/z-index addition.

⛔ **Root cause NOT understood.** Not chased further this turn — a genuinely open mystery, not a guessed-at
fix. Concrete next step for whoever picks this up: trace WHY `elementFromPoint` resolves to `.wiz-controls`
despite the rects not overlapping — check for a stacking-context/transform on an ancestor, or whether
`.wiz-controls` has its own invisible overflow/pointer-events reach beyond its own visible rect.

**STILL REAL IF**: dragging `dr_pos` on a live `user_drill_data` boot (Blocks tab, narrow pane, post-#68-fix)
still shows `movedMid`/`movedAfter` near zero despite the handle being on-screen and hit-testable in principle.

**t2591 — RE-RUN LIVE, CONFIRMED FIXED, root cause found (retroactively, from the OTHER side).** BACKLOG #72's
own t2547 fix — `blocksApp.js`'s `applyBlkReadOnly`, which scoped a placed op's `inert`/read-only marking to
`.ui-split-pane1` alone instead of the WHOLE host — turns out to be the SAME mechanism this entry's own mystery
was hitting: HTML's `inert` cascades to an entire subtree with no per-descendant opt-out, so the pre-t2547
host-wide marking made `.wiz-controls` (an ANCESTOR of both panes) swallow every click meant for a handle
nested in `.ui-split-pane2` — `elementFromPoint` doesn't need to literally "resolve to an overlapping rect," an
`inert` ancestor removes the whole subtree from hit-testing regardless of geometry, which is exactly why the
`.ui-split-pane1`/`.ui-split-pane2` NON-overlap this entry's own investigation confirmed never explained the
symptom (the wrong axis was checked — z-order/geometry, not the inert cascade). **Re-ran this entry's own STILL
REAL IF against a live `user_drill_data` boot**: `elementFromPoint` at `dr_pos`'s own on-screen centre now
resolves to the SVG handle itself (`rect.fc-handle.fc-handle-move`, `data-hid="dr_pos"`), and a real drag moves
it substantially (`movedMid`/`movedAfter` both ≈216px, no snap-back). **Causality confirmed, not just
correlation**: temporarily reverted t2547's own scoping (`target = host` unconditionally, matching this entry's
own original pre-fix code) and re-ran the identical check — `elementFromPoint` reproduced `DIV.wiz-controls`
exactly, `movedMid`/`movedAfter` both 0, matching this entry's own original filed symptom word for word.
Restored immediately after. Full account: WORK-LOG t2591.

---

### 70. `polygon`'s `polyFlats` handle hangs a real pointer-drag sequence when the drag pushes across-flats toward
a small value — a NEW finding, surfaced as a side effect of L5's own port, NOT caused by it (reproduces
identically on the pre-port hand-written code too). t2503 — CONFIRMED REAL, not a harness artifact (measured,
not guessed); mechanism still NOT pinned (`polygonStack`/`polygonSweeps` regeneration checked and RULED OUT as
the cause). ⭐⭐⭐⭐⭐⭐⭐ ✅ FIXED t2505 — root pinned via a live CPU profile (Blockly's own workspace-layout
internals, not this app's own render path); fixed by forwarding a `preview`/commit-on-release opt the lathe
drag-write chain was silently dropping in three places, routing polygon's own drag through the EXISTING,
already-proven mill/pattern preview mechanism (BACKLOG #46) instead of new machinery; permanent bounded-time
guard added (`tests/lathe-drag-responsive-2505.spec.js`)

*(filed t2497, discovered while gate-verifying `polygonProfileSpec`'s own port onto `canvasWidgets.js` —
BACKLOG #61 / L5's last op. Explicitly the SAME class of allowance the dispatch itself sanctioned for #68/#69:
a side-effect finding surfacing during otherwise-unrelated work, reported rather than chased or hidden.)*

**OBSERVED, reproduced on BOTH the ported and the pre-port (hand-written, `git checkout HEAD --`-reverted)
code, identically**: `dragHandleRenderTruth(page, 'polyFlats', {dx:0, dy:40, steps:8, settleMs:400})` against a
live `user_lathe_polygon` boot (default params, 1400×1000 viewport) — `page.mouse.move` inside the drag's own
step loop times out (60s), never completing. THREE OTHER seeds against the SAME op — `polyDepth` diagonal,
`polyDepth` pure-X, and `polyFlats` diagonal (`dx:20,dy:-30`) — all completed cleanly and fast (under 30s for
all three combined). Only the ONE specific seed (`polyFlats`, pure +Y, magnitude 40) reproduces the hang,
consistently, across four separate attempts (two different Playwright processes, after confirming the port
holding the mechanism, and confirmed identically on both the ported and un-ported source).

**Live console trace during the hang** (captured via `page.on('console', ...)`): the app's own `[featProbe]`
debug trace shows THREE CONSECUTIVE frames (`f21`, `f22`, `f23`) with an INCREMENTING frame counter but an
IDENTICAL, FROZEN model value (`acrossFlats: 3.972`) and an IDENTICAL, FROZEN pointer/handle screen position
(`1327,470`) — the renderer is still actively producing frames, but the value and the handle's own on-screen
position have both stopped moving, while Playwright's synthetic `page.mouse.move` never receives an
acknowledgement from the browser. This reads as a RUNAWAY RE-RENDER (the browser's own event loop kept busy
re-rendering identical frames) rather than a genuine JS deadlock, though the mechanism is not confirmed — named
as the most consistent reading of the evidence gathered, not asserted as diagnosed.

**A plausible mechanism, INFERRED not confirmed**: `polyFlats`'s own SCREEN POSITION is derived from the LIVE,
currently-committed `acrossFlats` value every render (`y: cy + apothem`, `apothem = across/2`) — unlike most
other ported handles, where the anchor stays constant through a drag. Once the drag pushes the value to its own
clamp ceiling (the polygon's corner touching the bar), every subsequent frame recomputes the SAME clamped
value, which recomputes the SAME handle position — a state that should be stable, not runaway, so if this
mechanism is right, something ELSE (a redundant write-triggers-another-write path, or a preview/commit
distinction the drag stream doesn't settle) is the actual trigger — not confirmed, flagged as the most likely
starting point for whoever investigates next.

⛔ **Not investigated further this turn** — out of scope for an assessment-then-port turn, and per this arc's
own established discipline: a side-effect finding gets reported, not chased, unless it blocks the actual work
in front of it (it did not — three of four seeds proved the port cleanly, and the algebraic/snapshot/existing-
test evidence independently confirms the port's own correctness regardless of this harness-level hang).

**STILL REAL IF**: the identical `dragHandleRenderTruth` call against a live `user_lathe_polygon` boot still
hangs on a pure +Y drag of `polyFlats` at or near its own clamp boundary, while the SAME op's other handles and
other drag directions on the same handle complete normally.

### ⭐⭐⭐⭐ t2499 — DOES THIS SHARE A ROOT WITH BACKLOG #66's own `partPos`? MEASURED DIRECTLY: NO. RULES OUT
label-occlusion for this entry specifically; #66's own root (found this same turn) is a DIFFERENT mechanism

Dispatched to compare this entry against #66's own frozen-value/render-loop symptom, using a WORKING sibling on
the identical code path for each (per the dispatch's own suggested method) — see #66's own t2499 entry for the
full account of what that comparison found FOR #66. The short version here: #66's own root turned out to be a
STATIC hit-test occlusion (a neighbouring handle's own click-to-edit label sitting on top of `partPos`'s
circle, confirmed by `document.elementFromPoint()` and by `featProbe.js`'s own passive drag-start listener
never firing for it) — a mechanism this entry does NOT share.

**Confirmed directly, not inferred**: swept `document.elementFromPoint()` at BOTH `polyDepth`'s and `polyFlats`'
own handle centres — at rest, AND with `acrossFlats` pushed to `30` (well up toward `polyFlats`' own clamp
ceiling, mirroring the conditions the hang itself occurs under) — both resolve cleanly to their OWN
`<circle class="fc-handle">`, no occlusion, no interference from each other's own labels (they sit ~92px apart
on screen, clear of each other's own label offsets in every configuration checked).

⇒ **This entry's own hang is a genuinely SEPARATE, still-unexplained mechanism** — the `featProbe` console
evidence already on record (a frozen model value alongside an incrementing frame counter) remains the best lead,
but it is NOT the same shape as #66's own static label collision. Whatever causes THIS hang has to be something
about the DRAG ITSELF (a live, in-progress gesture) rather than anything visible in the DOM at rest — narrowing
away one entire candidate family (hit-test occlusion) without narrowing toward a specific alternative yet.

**Named plainly, per the dispatch's own explicit request for either outcome**: this is a complete, useful
answer even though it is a "no" — it rules out the render-loop-via-occlusion family for this entry, which was
the most concrete hypothesis on the table, and it means whoever picks this entry up next should look at the
DRAG-TIME render/event path specifically, not at static handle geometry.

### ⭐⭐⭐⭐⭐ t2503 — REAL vs HARNESS ARTIFACT: MEASURED, not guessed. **CONFIRMED REAL.** A genuine main-thread
stall a real person would feel, not a Playwright/CDP quirk. Mechanism still NOT pinned; one strong candidate
checked directly and RULED OUT

Dispatched to answer exactly one question, deliberately bounded: does this hang reproduce with realistic pointer
timing, and in a real (not just headless-synthetic) browser, the way an actual person dragging `polyFlats` to its
clamp would experience it — or is it an artifact of the harness's own fast, densely-interpolated synthetic
`page.mouse.move` calls? The two readings have very different consequences, so this turn diagnosed only,
per its own explicit instruction — no fix attempted.

**METHOD, three diagnostics, most decisive first (OBSERVED, all three, not inferred):**

1. **The exact documented repro seed** (`dragHandleRenderTruth`, `dx:0, dy:40, steps:8`, default pacing) run
   with a CONCURRENT `page.evaluate(() => performance.now())` polled every 250ms throughout, racing each poll
   against a 1.5s timeout. Result: the drag itself took **37.2s** (under the 60s ceiling this run, so it did not
   technically time out THIS time — confirming the hang is not perfectly deterministic, consistent with the
   original report's own "reproduces, but not on literally every seed" character) — but for roughly **28 of
   those 37 seconds**, the concurrent `evaluate()` calls alternated between fast and **stuck for the full 1.5s**
   repeatedly, EIGHT separate times. A plain `1+1`-class evaluate call, with NOTHING to do with the drag
   mechanism itself, has no reason to ever take 1.5s unless the browser's own main thread is genuinely busy.
2. **Fully human-paced, headed-browser repro** (`--headed`, real Chromium window, not headless): 8 SEPARATE
   discrete `page.mouse.move` calls (no Playwright `{steps:2}` sub-interpolation at all — one real move per
   call), spaced **400ms apart** — slower and coarser than a real human drag, not faster. Result: individual
   moves took **2.3s, 4.0s, 4.1s, ≥5.0s (timed out our own 5s cap), ≥5.0s (timed out again), 4.0s**, then
   dropped back to 227ms/263ms once past the trouble region. A concurrent `evaluate()` probe fired right after
   the worst move **also stalled for the full 3s cap**. This is the test that most directly answers the
   dispatch's own question: **realistic pacing, in a real (headed) browser, still produces multi-second
   main-thread stalls** — this categorically rules out "the harness fires events too fast" as the explanation.
3. An earlier, less-paced check (dx:0, dy:40 without the documented `frameDelayMs` waits) showed the same
   character — degraded/slow but not infinite this run — and confirmed `acrossFlats` moves in the DECREASING
   direction on this exact seed (15.1 → 13.3 → 11.4 → 9.6 → 7.7 → 5.8...), correcting an assumption from the
   original t2497 filing: the trouble region is `polyFlats` heading toward its own SMALL/near-zero values, not
   (only) the "corner touches the bar" ceiling the original report's own working theory named.

**VERDICT: CONFIRMED REAL**, on the evidence, not a harness artifact. A person performing this exact drag in a
real browser would feel the tab freeze for several seconds at a time as they approach this region — visible
jank/unresponsiveness, not merely a synthetic-input measurement quirk. Per the dispatch's own explicit
instruction for this outcome: **this is a UI freeze in a shipping wizard and becomes its own fix turn** — not
attempted here.

**ONE STRONG CANDIDATE MECHANISM CHECKED DIRECTLY AND RULED OUT** (measured, not left as a guess for the next
turn to re-derive): `polygonData.js`'s own `rebuildPolygon` regenerates the ENTIRE block stack from
`polygonStack`/`polygonSweeps` on every Studio-side param change (its own doc comment: "every Studio-side
parameter changes the whole sweep... rebuilds the program"), and `polygonSweeps`'s own roughing-sweep count
grows as `acrossFlats` shrinks (more radial distance to walk off the bar in fixed `doc`-sized bites) — exactly
the direction the hang occurs in, and a highly plausible-LOOKING synchronous-cost explanation. Measured directly
in-page (`polygonSweeps`/`polygonStack` called across `acrossFlats` 15 → 0.001, default `doc:1`): sweep count
plateaus at **11**, block count at **868**, and every single call completed in **under 1ms** — this is NOT the
bottleneck, however tempting it looked from the doc comment alone. Ruled out by measurement, not by inspection.

**STILL OPEN, for whoever takes the fix turn**: the actual mechanism remains unpinned. The original `featProbe`
evidence (a frozen model value alongside an INCREMENTING frame counter, i.e. `requestAnimationFrame` keeps
firing while the displayed value stops changing) is still the best lead, now narrowed by elimination: it is NOT
static hit-test occlusion (#66's own mechanism — ruled out t2499), and it is NOT `polygonStack`/`polygonSweeps`
regeneration cost (ruled out this turn). Worth checking next: whatever `featureCanvas.js`'s own live-preview
pipeline does per drag-frame for the polygon END VIEW specifically (the two-view canvas this op alone draws),
and whether anything there re-triggers itself once a value stops changing rather than settling.

**STILL REAL IF**: the same three diagnostics above (documented seed + concurrent evaluate probe; slow
discrete human-paced moves in a headed browser + concurrent evaluate probe) still show multi-second stalls on
an UNRELATED `evaluate()` call while dragging `polyFlats` toward a small across-flats value.

### ⭐⭐⭐⭐⭐⭐⭐ ✅ FIXED t2505 — root pinned via a live CPU profile; fixed by routing polygon's own drag through
an EXISTING, already-proven preview/commit-on-release mechanism the lathe family was silently bypassing

**ROOT, pinned by measurement, not by inspection** (per the dispatch's own explicit ask): a CDP `Profiler`
capture during the slow region (`Profiler.enable`/`start`/`stop`, top self-time samples ranked) showed the
overwhelming majority of CPU time inside **Blockly's own internal functions** (`mb`, `recomputeAriaContext`,
`hasLayer`, `getRelativeToSurfaceXY`, `setConnectionTracking` — vendor/blockly/blockly.min.js), NOT in
`featureCanvas.js`'s own render path (`_draw()` call count stayed bounded at 2 per move throughout, even during
an 8-second stall — proven via a prototype-patch counter — and the canvas's own SVG node count stayed FLAT at 35
the whole time, proven via a live count — ruling OUT both a re-entrant render loop and DOM accumulation as the
advisor's own two candidate theories, in that order, by direct measurement of each).

**The actual chain**: `polygonData.js`'s own `def.postInstantiate = rebuildPolygon` regenerates the WHOLE block
stack via `polygonStack`/`polygonSweeps` on every Studio-side param write (its own doc comment says exactly
this — "every Studio-side parameter changes the whole sweep... rebuilds the program") — up to ~868 blocks as
`acrossFlats` shrinks (t2503's own measurement). That regenerated stack feeds the LIVE Blockly workspace, which
then has to lay out however many blocks that turn out to be, SYNCHRONOUSLY, on the main thread. Every OTHER
lathe op's own drag write is cheap (a single `#var`-bound scalar patch, not a whole-stack regenerate), so nobody
had ever noticed that `viz/latheProfileCanvas.js`'s own `latheLayoutSpec` → `write` wrapper, AND
`wizards/ops/panelTypes.js`'s own `latheLayoutSpec(...)` call site, were BOTH silently dropping the `opts`
argument `canvasWidgets.js`'s own `onDrag(id, world, commitNow)` already tries to pass on every frame
(`setFields(updates, commit ? undefined : { preview: true })` — this ALREADY marks every ordinary lathe drag
frame `{preview:true}` by default, since no lathe call site ever passes `commitNow`). `panelTypes.js`'s own
`_writeParam(name, val, opts)` has carried a fully-built, ALREADY-TESTED preview branch since BACKLOG #46
(t2429/t2447) — used by every mill/pattern handle in the app — that defers the actual model write (and whatever
it triggers) to a `data-ddcsCommitted`-tracked flush at drag-end, while the DOM value (and so the live-tracking
canvas, which reads params off the live FORM FIELDS, never the model) still updates every frame. The lathe
family's own three-layer wrapper chain (`polygonProfileSpec`'s inner callback → `latheLayoutSpec`'s own `write`
→ `panelTypes.js`'s own call site) was dropping that `opts` at EVERY layer, so every lathe drag — not just
polygon's — has always committed on every raw frame instead of on release. Every op except polygon is cheap
enough that this never mattered.

**THE FIX, narrowly scoped** — reuses 100% pre-existing, already-tested machinery; adds no new mechanism:
- `viz/latheProfileCanvas.js`: `latheLayoutSpec`'s own `write` wrapper now forwards `opts`; `polygonProfileSpec`'s
  own inner `buildCanvasWidgets(...)` callback now forwards `opts` too (the ONE spec function changed among the
  seven in this file — every other lathe spec's own wrapper is untouched, so `opts` stays `undefined` for them
  regardless of `write`'s own change, provably no-op for the other five).
- `wizards/ops/panelTypes.js`: the lathe branch's own callback into `latheLayoutSpec` now forwards `opts` to
  `_writeParam` too (same no-op-for-the-other-five argument). `onDragEnd` (the SAME generic, op-agnostic flush
  BACKLOG #46 already built — reads `_host`'s own live DOM for any field carrying a stale `data-ddcsCommitted`
  marker and flushes it as a real write) is now attached to the returned spec, but ONLY when `isPolygon` —
  deliberately NOT merged into the whole lathe branch (an earlier version of this fix did, and the `test:node`
  snapshot gate caught it immediately: it would have added a new `.onDragEnd` key to EVERY lathe op's own
  declared spec shape, provably behaviourally inert for the other five but a real, avoidable footprint on their
  declaration and an extra no-op DOM scan on every one of their own drag-releases — narrowed to touch only
  polygon once the gate flagged it).
- Two `architecture-map-1698.test.mjs` citations (`TRAP2`/`Q3`) that quoted the exact old source line verbatim
  updated to match — the map's own "prove it stale, fix it in the same act" duty, not a separate task.

**Do NOT build cross-handle/per-op collision machinery, do NOT touch `featureCanvas.js` or `canvasWidgets.js`'s
own gesture math** — neither was touched. `canvasWidgets.js`'s own `onDrag` already computed the right `opts`
on every call; the only defect was three call sites silently discarding it.

**VERIFIED, timings side by side, exact documented seed** (`dx:0,dy:40,steps:8`, 400ms human-paced, headed
browser — the SAME repro t2503 used to prove the freeze real):
```
pre-fix : 2327ms, 4044ms, 4120ms, 5011ms(STUCK-5s), 5011ms(STUCK-5s), 4032ms, 227ms, 263ms
post-fix:   68ms,   80ms,   82ms,   95ms,   86ms,   25ms,  23ms,  19ms
```
Final committed model value confirmed correct after release (`{"acrossFlats":0.002}`, the clamp floor reached
by this seed's own direction) — the deferred commit is not silently dropped. `polyDepth` (the OTHER polygon
handle, riding the same forwarded `opts` but carrying no expensive rebuild either way) drags and commits
correctly, 237ms. Click-to-edit on `polyFlats`'s own label (the exact path BACKLOG #66's own naive-fix trap
would have broken, if this fix had gone anywhere near labels — it does not) verified live: typed `9.5`, Enter,
model updated to `{"acrossFlats":9.5}` exactly.

**THE PERMANENT GUARD** (`tests/lathe-drag-responsive-2505.spec.js`, NEW): a genuinely new claim this arc's own
primitives never asked — not L2 "does it exist," not L3 "can it be reached," not t2501's own "can it be HIT,"
but **does dragging it stay RESPONSIVE**. Asserts every move in the documented trouble seed resolves within
1500ms (generous over the ~20-100ms a healthy move takes, far under the 2.3s-8s+ pre-fix stalls). Built with
existing tools (`page.mouse.move`, `Date.now()`), not a fifth primitive module, per the dispatch's own explicit
instruction. Four tests: the bounded-time assertion itself, `polyDepth` unaffected, the drag-end commit lands
the real value, click-to-edit still writes the model.

**Proven NON-VACUOUS, both directions, not assumed**: saved the three fixed files to scratch, `git checkout
HEAD --` to the pre-fix state (all three files were uncommitted at the time — safe), ran the guard — the
bounded-time test FAILED, three consecutive attempts (Playwright's own retry), consistent numbers each time
(`1885, 2728, 3356, 4847, 5833, 345, 336, 351ms` / `1904, 2759, 3382, 4919, 5863, 351, 301, 297ms` / `1904, 2745,
3409, 4941, 5686, 318, 292, 288ms`), specific to the `polyFlats` bounded-time test only — the other three tests
(`polyDepth`, commit-lands, click-to-edit) passed even pre-fix, correctly, since THEIR properties held before
too. Restored the fix from the scratch copies, `diff`-confirmed byte-identical, re-ran: 4/4 green.

**Regression**: `test:node` 238/238, zero diff beyond the intended, minimal `user_lathe_polygon`-only addition
(`.onDragEnd` key + entry, both twins — confirmed by `git diff` on the regenerated snapshot: exactly 4 lines
changed, zero touching any of the other five lathe ops). 101 existing lathe/canvas-widgets/census tests
(including BACKLOG #66's own t2501 guard) re-run unedited, all pass. Full suite `--workers=4` (rule 1b —
`panelTypes.js` is shared by every mill AND lathe op with a canvas): see WORK-LOG t2505 for the actual result.

---

### 71. There is NO real-UI authoring path for an INTERACTIVE preview handle (drag-to-resize / drag-to-
reposition) on a custom wizard built from scratch in the Blocks tab — confirmed by actually building one

*(filed t2509, the arc's own thesis-test turn: build a surfacing-equivalent wizard from an empty canvas, driven
entirely through the real Blocks UI — real drags, real clicks, real field typing — and compare it three ways
against the shipped built-in. See WORK-LOG t2509 for the full method, the complete comparison, and the honest
authoring-cost accounting; this entry records only the one finding with lasting product-shape consequences.)*

**OBSERVED, not guessed**: a from-scratch wizard built and saved through the real UI —
`typeof def.previewGeometry === 'function'` → `false`. The shipped `user_surfacing_data` twin —
`typeof def.previewGeometry === 'function'` → `true`, and its own Visualization pane shows a live 2D canvas
with a real drag handle (a "pos" dot + a size handle on the faced-area rectangle) — confirmed visually,
screenshots in `verification/t2509-my-wizard-open.png` (empty, black) vs `verification/t2509-builtin-wizard-
open.png` (populated, interactive).

**THE MECHANISM, traced not assumed**: `previewGeometry` is a property assigned directly onto the `def` object
in plain JavaScript, AFTER `userOpFromStack` runs (`surfacingData.js`: `def.previewGeometry =
surfacingPreviewGeometry;`) — ~30 lines of real coordinate math (anchor, w/h, the mode-dependent start-position
marker). There is no block, no field, no `formfield`-style declaration mechanism anywhere in the current palette
that lets an AUTHOR (not a developer editing JS) declare this. The four STATIC shape primitives
(`shape_rect`/`shape_circle`/`shape_line`/`shape_marker`, BACKLOG #61's own finding 3, re-confirmed alive and
independent at t2507/L7) are a REAL, LESSER capability that DOES exist today — an author could draw a
non-interactive outline of the faced area — but the DRAG-TO-RESIZE/DRAG-TO-REPOSITION affordance every built-in
wizard has (the exact mechanism BACKLOG #61's own L5 arc spent nine turns porting to `canvasWidgets.js`'s
shared, declarative registry) has no author-facing declaration path at all.

**WHY THIS MATTERS, stated plainly**: every other axis this session's own thesis-test turn measured came back
either matching exactly (EMIT, byte-identical) or matching with a real but bridgeable authoring-cost gap (FORM —
help text has to be typed by hand, same mechanism as label/default, just more typing). PREVIEW is qualitatively
different: the mechanism does not exist for an author to reach AT ALL, regardless of effort. A real wizard
author building a custom facing-style op today gets G-code and a working form, but never an interactive canvas —
their wizard will always look and feel less finished than a built-in, permanently, until this gap is closed.

**NOT ATTEMPTED, named as scope not oversight**: whether a `formfield`-style declarative handle mechanism
COULD be built (e.g. a new block type carrying the SAME shape `canvasWidgets.js`'s own gesture declarations
already use internally — `type/field/ax/ay/...` — surfaced as an authorable block rather than a JS object) is
a genuine design question, not evaluated this turn. This entry records the GAP, not a proposed fix; the dispatch
that filed it was explicit: diagnose only, do not build anything.

**STILL REAL IF**: grepping the current palette (`web/wizards/ops/index.js`'s own `PALETTE`) for any block whose
`emit`/save-time hook writes a `previewGeometry`-shaped function onto a `def` still finds none, and a fresh
from-scratch wizard built through the real UI still shows an empty Visualization pane where the built-in shows
interactive handles.

> **✅ t2517 — PARTIALLY RESOLVED, one gesture of eleven, proven end to end through the real UI (the t2509
> bar).** A NEW block, `length_handle` (`wizards/ops/lengthHandle.js`), nests inside `feature_canvas`'s own
> mouth (a new `mouth:'DO'`, owner ruling: a handle belongs to a SPECIFIC canvas, containment not a flat
> type-filter) and declares ONE socket-less binding — `handleBindingsFromStack`/`ToBlocks` (userOps.js) —
> carrying `anchor:{kind:'length', axis, ax, ay, min, max, label}`. A new branch in `layoutSpecFromOp`
> (panelTypes.js) reads it and renders the SAME `length` gesture already proven on lathe facing (t2485) via
> `canvasWidgets.js`'s existing registry. Built a wizard from an EMPTY canvas through REAL palette drags + real
> field edits (no `ddcsLoadBlockStack`), saved via the real dialog, reloaded the page for real, and DRAGGED THE
> RENDERED SVG HANDLE with a real mouse gesture — the bound field's value changed live
> (`verification/t2517-length-handle-live-drag.png` is the opposite of this entry's own black-rectangle
> screenshot). **What this does NOT close**: `previewGeometry` itself (the JS-only per-feature VECTOR GEOMETRY
> hook — text's actual letter outlines, slot/contour's own boundary shapes) is still unauthorable; `length_handle`
> is a SIMPLE anchor+axis+value handle, not an arbitrary-shape declaration. The other ten `canvasWidgets.js`
> gestures (point already had a path via `layoutwidget`; scaleX/shear/rect/radial/projLength/diagAim/crossAim/
> probeVector/translate remain) are template work now that one is proven, not yet built — scoped out this turn
> deliberately (BACKLOG #61's own corner-precedent: prove one, then let the rest inherit).
>
> **✅ t2521 — gesture 2 (POINT), proven the same way.** `wizards/ops/pointHandle.js` (`point_handle`), same
> self-contained shape, nests in `feature_canvas`'s mouth. Genuinely fit the template with a small, honest
> difference worth naming: `point`'s own render branch already existed (reached until now only by
> `layoutwidget`, always anchored at {0,0}) — rather than declare a second parallel branch, this one WIDENED
> the existing helper (`pos()`, panelTypes.js) to take an optional literal `(ax, ay, label)`, defaulting to the
> exact prior hardcoded `(0, 0, 'pos')` so every one of the OTHER 5 call sites (corner/edge/middle's own
> role-ladder fallbacks, all still calling `pos()` bare) stays byte-identical by construction. Proven the same
> t2509/t2517 bar: real palette drags, real field edits, real save, a real reload, a real mouse drag on the
> rendered SVG square moving it off its authored default (`verification/t2521-point-handle-live-drag.png`).
> One real, named, still-latent wrinkle found along the way: `layoutBindingsToBlocks` (the older, still-unwired
> layoutwidget reverse function) has no `anchor.kind` check at all, so it would also match `point_handle`'s own
> bindings if it were ever run on a mixed list — not a live bug (neither reverse function is wired into a real
> reopen-as-blocks flow yet), but real, and left as a named finding rather than silently patched in passing.
>
> **✅ t2521 — gestures 3 and 4 (RECT, RADIAL), same turn. Neither found a mismatch either — the dispatch's own
> "stop at the first one that doesn't fit" never fired.** `rect_handle` (`wizards/ops/rectHandle.js`) is the
> one the dispatch itself named as the real risk — TWO bound params from one handle, needing the t2495
> `valueField` routing (a new dropdown: which axis the handle's own displayed number reflects when both are
> active) — and it *was* real: a genuinely NEW `anchor.kind:'rect'` branch was needed (unlike point, `rect` had
> no prior declared-anchor path at all). Proven live including the `valueField` dropdown itself, dragging BOTH
> `boxw`/`boxh` together with the label correctly showing only the routed axis
> (`verification/t2521-rect-handle-live-drag.png`). `radial_handle` (`wizards/ops/radialHandle.js`) is the
> RADIUS-ONLY variant (Ø/pitch, no angle-drag) and needed one real unit translation no other gesture did — the
> gesture wants a world radius + radians, the declared field holds a diameter-scaled value in degrees — divide
> by `rScale`, convert deg→rad; proven both in isolated gesture-math and live
> (`verification/t2521-radial-handle-live-drag.png`).
>
> **Four of eleven gestures are now block-authorable** (length/point/rect/radial), each proven at the t2509
> bar, each landed as its own commit. The remaining seven (scaleX/shear/projLength/diagAim/crossAim/
> probeVector/translate) are UNBUILT — out of this turn's scope, and since none of the four hit a genuine
> template mismatch this is a reasonable bet to be the same shape of work, but that is stated as an inference
> from this turn's own pattern, not a claim measured against the other seven specifically.
>
> **t2523 — the ORIGINAL thesis-test (t2509) re-run with all four gestures available, to measure what actually
> changed.** Checked first, per the dispatch's own instruction: surfacing's own two handles (`sf_pos`/`sf_size`)
> map to `point` and `rect` — both already built, no missing gesture. Rebuilt the identical wizard via
> `feature_canvas` + `point_handle` + `rect_handle`, real UI only, through a real save + real reload. Result is
> a genuine PARTIAL close, not a full one: the Visualization pane now shows two real, draggable, labeled handles
> (`verification/t2523-my-wizard-open.png`) — dragging one moves it on screen, proven with a real mouse gesture
> after reopening — but the drag reaches neither `width`/`height` (the formfield-bound, emit-real params) nor
> the emitted G-code at all (checked both ways: changing `width`/`height` changes the program; changing the
> handle's own `w`/`h`/`px`/`py` does not, byte-identical either way). The interactive AFFORDANCE this arc set
> out to build now exists and is author-reachable; it drives a decorative overlay, not the geometry the built-in
> twin's own `previewGeometry` controls. Cost: +3 UI actions over t2509's own 27 (2 handle placements + 1
> `feature_canvas.PANEL→form2d` edit t2509 never needed), buying an axis t2509 had zero of. Closing this entry
> for real needs the handle-binding mechanism to write into an EXISTING emit-real param by lookup (the way
> `previewGeometry` does), not self-declare a new socket-less one — a design question, not evaluated this turn.
> Full account: WORK-LOG t2523.
>
> **✅ t2525 — RESOLVED for real: a handle now writes into the SAME real binding a formfield already declares,
> not a parallel socket-less one.** The design question t2523 left open, worked out from the code before
> writing any (mirroring t2511's own adjacency-merge account, per the dispatch's own instruction): each handle
> block's own field-naming field (`fx`/`fy`, `field`/`fieldH`) is now a MUST-MATCH PICKER (bridge.js
> `HANDLE_ANCHOR_FIELDS`, reusing `whenparam`'s own existing candidate set — every formfield/param_field's own
> `PARAM` in the stack — the identical mechanism `atomType` already uses, exactly the shape the dispatch itself
> predicted). `handleBindingsFromStack`'s own `attach()` (userOps.js) looks up that param among the stack's
> REAL (match/key-carrying) bindings and MERGES the handle's anchor onto it, REPLACING the plain copy rather
> than adding a second entry — `deriveBindings.js`'s own `anchor` passthrough (line 98, already existed for
> `layoutwidget`) and `layoutSpecFromOp`'s own generic `groups` construction needed ZERO changes for the
> resolved case, since both already treat `def.bindings` uniformly regardless of what produced an entry.
>
> **THE ONE THING TO GET RIGHT, done both ways**: a target that resolves to nothing (formfield renamed/deleted
> after the handle was authored, or a hand-authored stack bypassing the picker) is UNREPRESENTABLE at author
> time (the picker literally cannot select a nonexistent param) AND fails visibly at the backstop layer —
> `handleTargetReport` (userOps.js) BLOCKS save the same way `formfieldMatchReport` already does
> (devMode.js), and `layoutSpecFromOp` renders a red, valueless, unlabeled-for-editing marker
> (`verification/t2525-broken-handle-fails-visibly.png`) naming the missing param, checked BEFORE any working
> gesture branch — never silently absent, never a normal-looking handle that writes nowhere.
>
> **VERIFIED live, both directions, all four gestures**: authored a formfield FIRST (the picker needs its
> target to already exist — a real, if minor, authoring-order fact this turn found and named, not assumed),
> then a handle picking that param, through real palette drags/real field edits/a real save/a real reload, then
> a real mouse drag on the rendered SVG handle — the exact check that failed at t2523, run the same way:
> `width`/`height`-equivalent params changing the emitted G-code (true, unchanged) AND the handle's drag
> ALSO changing it now (`verification/t2525-{length,point,rect,radial}-handle-emit-wired.png` — was
> byte-identical before this turn). All 17 tests across the four gesture spec files green, plus 3 new tests for
> the fail-visibly backstop. The 32 built-in twins: unaffected by construction (this mechanism only activates
> inside a `feature_canvas`'s own handle children); `test:node` 238/238 green, one pre-existing snapshot gate
> (`preview-spec-gate-1688`) regenerated to include the new `broken` gesture entry, reviewed line-by-line —
> nothing else in the 32-twin snapshot moved. Full `--workers=4` e2e: **3052 passed, 1 failed (the
> already-documented `open-as-modal-1625` contention flake, BACKLOG #56 — re-ran alone, 3/3 clean), 9 flaky
> (2 checked directly against this turn's own diff, clean in isolation; the other 7 touch none of it)**. One
> honest, unfixed loose end (out of scope — the form render paths): an unresolved handle's own fail-visibly
> stub also shows a stray, unlabeled form row — the canvas-side signal (the marker) is the correct, primary one.
>
> Full account: WORK-LOG t2525.
>
> **✅ t2527 — the stray row FIXED**, along with the label-collision loose end t2523 itself named further up
> this entry: `renderOpForm` now skips an `anchorUnresolved` binding outright (safe specifically because nothing
> reads its `[data-param]` — the canvas already renders the 'broken' marker instead of any field-writing
> gesture), and `labelFor` now falls back to a handle's own declared `anchor.label` when neither an explicit
> label nor `SHARED_LABELS` has one — narrower than the original report's own literal reading (t2525's own
> param-merge already makes the EXACT two-row "Width" collision unreachable for a properly-matched handle;
> `SHARED_LABELS` still wins over `anchor.label` where it already gives the correct, role-distinct answer, so
> rect_handle's own w/h rows keep "Width"/"Height" rather than both showing the group-wide "W×H"). Full account:
> WORK-LOG t2527.
>
> **✅ t2533 — three more gestures (SCALE, SHEAR, PROJ-LENGTH), then STOPPED at a genuine mismatch (DIAG-AIM).**
> `scale_handle`/`shear_handle` (`wizards/ops/scaleHandle.js`/`shearHandle.js`) needed a NEW wrinkle the first
> four gestures never did: a second, READ-ONLY must-match picker (`baseField`/`hField`) naming a SEPARATE
> existing param whose CURRENT VALUE positions the handle, never itself made draggable — canvasWidgets.js's own
> `scaleX`/`shear` gestures need a live "unscaled base width"/"height" that isn't derivable from the dragged
> field alone. `proj_length_handle` (`wizards/ops/projLengthHandle.js`) came back down to the simple single-
> picker shape — its own `off` self-derives from `value/scale`. All three pass the full t2517/t2525 bar (real
> palette author, real save, real reload, real mouse drag, emit confirmed to change) — screenshots
> `verification/t2533-{scale,shear,proj-length}-handle-emit-wired.png`. Caught and fixed two of my OWN test bugs
> in the process (not product bugs): `scale_handle`'s UI-drive test needed its two fields set through the real
> form BEFORE dragging (`scaleX`'s own drag is multiplicative and canvasWidgets.js returns `null` on a
> ~zero-width span — the t2513 formfield-blank-on-first-paint gap otherwise leaves it permanently stuck);
> `proj_length_handle`'s own def-level test had a wrong expected number (assumed the atom's live default won
> over the formfield's own `dflt` — it's the reverse).
>
> **STOPPED at gesture 4, `diagAim`, per the dispatch's own instruction** ("stop at the FIRST one that does not
> fit"): traced its real usage (`panelTypes.js:658-676`) BEFORE writing any block code — its five inputs
> (`primaryX`, `centreSec`, `sign`, `travel`, `prim`) are ALL derived from Middle's OWN internal geometry model
> (`middleAxes(params)`, live stock dimensions, `dir1`/`dir2`'s Middle-specific wall-facing sign convention,
> `featureType==='boss'`), not simple literals or must-match-picked params a generic author could supply.
> `crossAim` (next in line) carries the identical character plus a dependency on `panelStarts`. This is a
> CATEGORY difference from every gesture built so far, not a harder version of the same shape — building it
> would mean embedding Middle's own business logic into a supposedly general block. `probeVector`/`translate`
> were NOT evaluated (the instruction is to stop at the first mismatch, not catalog the rest), though
> `translate`'s own `xs`/`ys` variable-length field-list arity is flagged as a likely second mismatch requiring
> Blockly mutator machinery this pilot's shape never needed. Full account: WORK-LOG t2533.
>
> **📏 t2537 — AUTHORING ERGONOMICS MEASURED: 32 real UI actions for 2 params + 1 REAL (emit-wired) handle —
> up from t2509's 27 (no handle) and t2523's 30 (2 DECORATIVE handles, neither emit-real). 72% of those 32
> are IRREDUCIBLE; 3 named mechanisms account for the reducible rest, ranked by measured saving. Assessment
> only — zero product code touched.** Re-drove the exact t2509/t2523 build (width/height, real palette drags,
> real save, real reload) but wired `rect_handle` for real this time (`FIELD`/`FIELDH` → the width/height
> formfields, t2525's own current best-practice) and dropped the DECORATIVE `point_handle` t2523 also carried
> — carrying it forward is no longer even POSSIBLE: t2525's own save-time guard (`handleTargetReport`) now
> REFUSES to save any stack with an unresolved handle target, confirmed live (a native `alert()`, no dialog
> handler registered, silently stalled the first attempt until traced). A real, freshly-discovered authoring
> fact: today there is no "decorative placeholder" middle ground for a handle — wire it to a real param or
> remove it.
>
> **The count, tagged action-by-action as it happened** (not reconstructed after): 23 IRREDUCIBLE, 6 CEREMONY,
> 3 CEREMONY-TRAP (the deferred-`ATOMTYPE` split + one Blockly drag-snap corrective nudge) = 32. Per-formfield
> unit cost is 7 actions (place + PARAM + LABEL + DFLT + BINDMODE + KEY + ATOMTYPE) — 5 of those 7 are
> genuinely irreducible authoring decisions; 2 (LABEL, BINDMODE) are not. Extrapolating this MEASURED per-unit
> rate to surfacing's own ~20 bindable params (matching t2509's own extrapolation method): **~155 actions** —
> 15 one-time (root/canvas/panel/handle+its 2 wiring clicks/param_group/group-title/the 4-block execution
> chain+its 1 dropdown/3 save steps) + 20 × 7 per-field.
>
> **TOP 3 reductions, ranked by MEASURED saving, not cleverness:**
> 1. **`formfield.BINDMODE` defaults to `'opparam'`.** Every single formfield built anywhere this session (t2509
>    through t2537, ~15 of them across multiple turns) used "Op Param" — zero counterexamples. Saves 1
>    click/field → **~20 actions at full parity**. Build cost: LOW — a literal default-value change in
>    `formFieldBlock`'s own `defaults` object, one line.
> 2. **`formfield.LABEL` auto-derives from `PARAM` (Title-Case) when left empty, still overridable.** Saves 1
>    click/field for any author who accepts the sensible default → **up to ~20 actions at full parity** (real
>    uptake depends how often an author wants a different label — a genuine upper bound, not a guaranteed one).
>    Build cost: LOW-MEDIUM — an on-`PARAM`-change handler that back-fills `LABEL` only while still empty, the
>    same "never clobber an explicit value" convention `data-op-gated` already establishes elsewhere.
> 3. **The `ATOMTYPE` ordering constraint (the split this turn tagged CEREMONY-TRAP) is a ZERO-BUILD-COST fix
>    today, not a product change — sequence execution atoms BEFORE presentation form fields.** This turn's own
>    build hit the split because it authored formfields BEFORE surfaceraster existed (a natural
>    "presentation-first" instinct); placing the EXECUTION chain first instead means every `ATOMTYPE` picker
>    resolves on its FIRST visit, no revisit ever needed — **0 actions removed from the raw count, but up to
>    ~20 avoided SECOND VISITS at full parity** (a flow/context-switch cost the action count alone
>    undercounts). Recommended: surface this as in-app guidance (the `ATOMTYPE` picker's own empty-state
>    message, or the Wizard Form palette category's help text) rather than a mechanism change — the dispatch's
>    own instinct that this was the highest-value KIND of finding was right, but its cheapest fix is words, not
>    code.
>
> **With reductions 1+2 shipped: per-field cost drops 7→5, full-parity projection drops ~155→~115 (a ~40-action,
> ~26% cut).** Reduction 3 stacks on top as avoided revisits, a different unit, not simply additive.
>
> **A fourth trap, flagged but NOT ranked (it isn't an action-count reducer, it's a SILENT-FAILURE risk)**: the
> stale-search-flyout interception this session's own test harness has hit and coded around since t2509 —
> after ANY palette search+drag, the search box must be explicitly cleared or the NEXT click can silently land
> on the flyout overlay instead of its intended target, with NO error, NO visual signal, nothing. This turn's
> own harness clears it defensively before every click; a REAL author gets no such help and no warning when it
> happens to them — their field edit "does nothing" and nothing tells them why. Worth its own look, separate
> from ergonomics-by-action-count.
>
> **Honest answer to the dispatch's own explicit ask**: most of the 32 (72%) — and, extrapolated, most of the
> ~155 at full parity — ARE irreducible; this is a real, load-bearing finding, not a hedge. The reducible slice
> is concentrated in exactly 3 named, per-field mechanisms, not spread thin across many small things — which is
> what makes them worth fixing FIRST rather than a broader ergonomics pass. Screenshot:
> `verification/t2537-ergonomics-build.png`. Full account: WORK-LOG t2537.
>
> **✅ t2539 — THE STALE FLYOUT, t2537's own 4th finding, promoted and CLOSED: measured real for a human,
> then fixed so the failure is IMPOSSIBLE.** The question first, per the dispatch's own instruction: does the
> stale search-flyout intercept a click for a human, or only instant automation? Measured directly — an A/B
> test drove the SAME post-drag scenario with an instant teleport-click AND a click preceded by realistic,
> incremental pointer travel with hover pauses; BOTH reproduced the identical interception
> (`document.elementFromPoint` resolved to `path.blocklyFlyoutBackground` either way), and the flyout's own
> `isVisible()` stayed `true` at +1500ms with no auto-close timer at all. **Real for a human, confirmed by
> direct reproduction.** Root cause: `blocksApp.js`'s own `runSearch()` opens the flyout via a raw
> `fl.show(hits)` call (not the toolbox's own category-click path, which auto-closes natively) and only ever
> hides it when the search box is explicitly cleared — nothing else in the file closes it, so it silently sat
> above the canvas after every search-driven drag, swallowing whatever click landed in its area next, with no
> error and no visual signal.
>
> **Fix: made it structurally impossible, not merely rarer**, per the dispatch's own explicit bar. The
> workspace's own existing change-listener now clears the search box (the SAME action its own ✕ button
> performs) the instant ANY block lands on the main workspace (`e.type==='create'`) — the flyout closes before
> a subsequent click can ever reach it. Verified the fix reverses the measured failure directly (re-ran the
> same A/B scenario, both now land on the real field). New permanent test
> (`tests/flyout-autoclose-2539.spec.js`, 2 tests) proven NOT vacuous: reverted the fix, re-ran, failed 3/3 at
> the exact expected assertion; restored, re-ran clean.
>
> **The free item, done**: t2537's reduction 3 (the `ATOMTYPE` ordering constraint) is now named where an
> author actually meets it, not only in a WORK-LOG — the picker's own empty-state message reads "place the
> atom block this field should bind to FIRST, then come back", covering both the truly-empty case and a typed
> filter matching none of the atoms already present (the same actionable advice either way).
>
> Targeted regression: the same 41 handle-block/canvas-widgets tests from t2533 plus `palette-search.spec.js`
> + `block-canvas-find-2435.spec.js` (the two existing specs touching `.blk-search` directly) — 44/44 green.
> Full `--workers=4` suite run (a genuinely shared file, `blocksApp.js`, per AGENTS.md rule 1b) — result in
> WORK-LOG t2539. This closes the loose end t2537 itself named but deliberately didn't rank, since it was
> never an ergonomics number to begin with — it was a correctness bug hiding behind five turns of a
> test-harness workaround that trained everyone, including this session, to stop seeing it. Full account:
> WORK-LOG t2539.
>
> **⚠✅ t2541 — the two measured reductions, checked against the REAL population before shipping either:
> ONE FAILS its own gate (not shipped), ONE ships with the distinguishability the dispatch demanded.**
> **BINDMODE default to 'opparam' — FAILS, not built.** Grepped every `match:{...}` binding spec across all
> 32 built-in twins: 106 of 306 (35%) carry a `var` key (Assign Var, not Op Param), and 16 of the 32 twin
> FILES (50%) use Assign Var for at least one binding — `cornerData`/`commData`/`centerDrillData`/`middleData`
> and eleven others. This session's own ~15 authored formfields were a biased sample (every from-scratch
> build happened to bind atom params, never a bare controller variable) — zero counterexamples there, 106 real
> ones in the population. Exactly the check the dispatch demanded; exactly why checking the real population
> mattered.
>
> **LABEL auto-derive — ALSO fails the naive check (only 51/182, 28.0%, of built-in labels match a mechanical
> camelCase/snake_case → Title Case split exactly), shipped anyway on a reframed comparison.** The dispatch's
> own numbers assumed "derived vs. the author's eventual choice"; the REAL baseline `labelFor` already falls
> back to today, for ANY unlabeled field, is the bare lowercase param name (`f_fast`, not "F Fast") — a
> Title-Cased split is a STRICT improvement over THAT in 100% of cases (only ever fires when nothing more
> reliable applies) and happens to be the exact final choice ~28% of the time even on the built-ins' own
> deliberately-crafted copy. Smaller, honestly-quantified benefit than first estimated; never a downside.
>
> **Distinguishability (the hardest part of the ask) solved structurally**: the guess computes at RENDER
> TIME only, inside `labelFor`'s own existing fallback chain — never written back into a block's own `label`
> field, so the block itself always tells the truth regardless of what the form shows. A new
> `isDerivedLabel(b)` flag drives a distinct `.ddcs-label-derived` style + an explanatory tooltip; an
> explicit label, SHARED_LABELS, or a handle's own `anchor.label` render completely unstyled, unchanged.
> Proven non-vacuous (revert/re-run/restore, both new tests failed 3/3 at the exact expected assertions
> beforehand). One pre-existing test's own assertion updated deliberately (not silently) to the new, correct
> expectation.
>
> Small item, separate commit: `bridge/controllers/expert-m350/FINDINGS.md`'s own three-firmware-dates
> question (2025-12-11 / 2026-04-10 / M350-LiveG's stated 2026-08-03 minimum) recorded as likely three
> sequential milestones, not a contradiction — NOT resolved, per the dispatch's own explicit instruction;
> needs the owner's own controller. Full account: WORK-LOG t2541.
>
> **⛔✅ t2543 — SEPARATE THE SLOT, the owner ruling on t2531's own deferred two-owner bug, shipped.**
> `param_group.children` no longer serves two masters: `materializeParamGroup` now targets a NEW, dedicated
> `param_table` node (`wizards/ops/paramTable.js`), found/injected by TYPE alone — mirroring
> `materializeCamTable`'s own `cam_table` precedent exactly — and never reads or writes a twin's own
> `param_group` declaration again. A group_box-declaring `param_group` now survives materialize
> byte-identical, proven by a new permanent test; the mechanism is landed and demonstrated, per this turn's
> own scope, but NOT used by any real twin yet (no section migration happened this turn).
>
> **Two real regressions, both caught by the mandatory full suite and fixed before commit, neither shipped
> silently.** (1) The fix's simplest form broke drill's own DELIBERATE t2299 "never materializes" contract
> (`cam-block-native-params-s52.spec.js`'s own dated `drillSame` pin) — fixed with a second, named skip: any
> twin already declaring `field_ref` rows needs no `param_field` block, decoupled from `param_group` entirely
> so a future BACKLOG #72 twin gets the same correct treatment, not a drill special case. (2) The fix's literal
> mirroring of `cam_table`'s own PREPEND placement broke `cam-substack-save-fork.spec.js`'s own pinned
> uiChildren order on surfacing (`sim`/`path_anchor`/`param_group`, tracked through three prior updates) —
> `cam_table` never existed on any twin before so no ordering test could pin its position; `param_table`
> replaces what used to be an in-place fill of an already-positioned node, so prepending was never safe.
> Fixed by switching to APPEND.
>
> **A third finding, tooling not product**, corrects rather than repeats t2537's own shelved guess: the "0
> tests, 0s" full-suite anomaly is a stale mem-server left LISTENING on port 3211 from an earlier command in
> the same session, colliding with `reuseExistingServer: false` — not a reporter quirk. Documented as
> `GIT-AND-TOOLING-HAZARDS.md` #17.
>
> Full `--workers=4` suite, run 1 (before the append-order fix): 3070 passed, 3 failed (the two regressions
> above + the session's own already-documented `preview-mutation-manifest-2463` flake). Run 2 (after): 3071
> passed, 1 failed (only the pre-existing flake), 13 flaky, 26 skipped. `probe-port-gate-1880.spec.js`'s own
> single flaky failure confirmed pre-existing via a direct 4x-vs-4x control run against a temporary revert to
> pre-t2543 code (restored from my own backup, not HEAD) — identical ~25% flake rate both sides. Full
> account: WORK-LOG t2543.

---

### 72. THE AUTHORABILITY SWEEP — what built-ins do that blocks can't say, and what gets said twice

*(owner request, 2026-09-01, direct quote: "sweep the built in wizard for these small buildable details and see
if we made them out of blocks? then see if there are more duplicates… just put this in the backlog." Full
dispatch: `DDCS-Studio/scratchpad/t2513-authorability-sweep.md`. MEASUREMENT ONLY — fix nothing, per that
dispatch's own explicit instruction; not one line of product code changed this turn. Counts below are grepped
directly against the 32 registered data-twin files in `web/blocks/dataOps/*.js`, anchored (field-name + colon,
or `def.<name> =`) not bare-word, and spot-checked — three bare-word false positives were caught and corrected
in the course of this sweep, named where relevant below.)*

**THE WORKED EXAMPLE that motivated this sweep**: `section:` on a binding groups fields by CONTIGUOUS RUN in the
array — looks like an order-independent tag, behaves like an order-dependent boundary. That gap already cost
two corrective turns (t2375 contour/slot, t2377 surfacing — surfacing's own header records that before t2377
only two of its fields carried `section:` at all, both named `'COORDINATES'`, a section the form does not have,
rendering silently). This entry is the sweep for more of that CLASS: declared details either unsayable in
blocks, or sayable two different ways.

**t2595 — PHASE 1 (steps 1+2, every op) begun: surfacing's step 2 shipped, bore fully migrated (both steps),
text ATTEMPTED and STOPPED at a genuine mismatch.** Surfacing's own RIGHT pane split from the combined `sim`
node into adjacent `preview3d`+`feature_canvas` (t2511's own mechanism) — the cheap half, ~6 lines, zero new
tests needed. Bore migrated from scratch (both steps): new `boreFieldGroups` helper, `group_box`/`field_ref`
tree, a new standalone test file. **Text was attempted and reverted**: its own `TEXT_EXEC_BINDINGS` use a
hand-counted `blockIndex` (the exact "corner defect #1" class `deriveBindings.js`'s own header names), which a
uiChildren restructuring silently desyncs — NOT one of the axes the pre-migration survey screened for (it
checked section-tag complexity, not binding-resolution mechanism). Fixing text needs converting it to
`match:{type}`-based resolution first, a separate, larger, unsized task. A second, related mechanism finding
caught live on bore BEFORE shipping: even SAFE `match:{type}`-based bindings bake a concrete `blockIndex` at
DERIVE time and must be RE-DERIVED against the final, tree-shaped stack — reusing a module-level bindings
constant computed against the old shape breaks identically to text's own failure. Also found: bore is the
first migrated op with NO classic shell page, exposing a real `.wiz-usage` selector ambiguity between a
declared `usage_text` node and the generic `#wiz_user` container's own always-present `#wiz_user_usage`
"seamless title" element — a genuine test-harness/product boundary, not fixed (out of this arc's own scope).
Full account, all four findings with citations: WORK-LOG t2595.

**t2597 — SCREENED every remaining op for hand-counted `blockIndex` BEFORE migrating further (per explicit
dispatch), THEN migrated `rotary_clock_data`.** The screen: 6 ops need `match:{type}` conversion first
(`atcWarmupData`, `contourData`, `pauseConfirmData`, `tapData`, `textData`, `wcsData`) — everything else is
`blockIndex`-safe, but that axis alone is not sufficient: `atcCheckData`/`atcLengthData` (panel `'form3d'`, no
2D pane) and `commData` (panel `'commscreen'`) use visualization mechanisms the `preview3d`+`feature_canvas`
adjacency has never been proven against — a THIRD screening axis (panel kind), on top of blockIndex and the
stale-bindings-must-re-derive finding t2595 already caught. `alignmentData`/`edgeData`/`middleData`/
`rotaryCenterData` share rotary_clock_data's own proven shape and are the next reasonable candidates;
`pocketData`/`slotData` stay HARD (structural-fork complexity, unrelated to either axis); `cornerData` stays the
deferred trap; `atcChangeData`/`atcTableData`/`atcTestData`/`homingData`/`ioStepData` are structural-only (no
value bindings at all) — genuinely the lowest-risk candidates, not yet attempted. Migrated `rotary_clock_data`
(bore's own two-phase `xFieldGroups` pattern) and found a FOURTH mechanism gap: tree-mode viz containers carry
`_tree`-suffixed ids (`formWidgets.js`'s own `nsId(...)`), never the classic shell's fixed `#userViz3dContainer`/
`#userVizContainer` — a repo-wide grep found **44 test files** hardcoding those fixed ids, several for ops
already on the safe list above; each will need the same fix `rotary-clock-handles.spec.js` got here the day its
own op migrates. Full account: WORK-LOG t2597.

> **⚠ CORRECTION (t2623) — the "`pocketData`/`slotData` stay HARD" line above is only half right, and it stayed
> unquestioned for 5 turns purely because it had a name.** Read both wizards directly and measured against the
> t2605 predictor (distinct target block types / binding-spec entries / real multi-spec params): contour
> (migrated t2621, clean) is 5/30/0; **slot is 5/29/1 — CONTOUR-SIZED, not hard**; pocket is 10/89/21 — genuinely
> the large one. Slot's one complicating fork (pattern → array-wrap) was never actually in play: `slotData.js`'s
> own header comment scopes the twin to `pattern:'single'` only ("array-slot = a future port"). Full table +
> the general lesson: `ARCHITECTURE.md`'s MIGRATED FACTS, t2623 entry. Full account: WORK-LOG t2623.

**t2599 — migrated the four proven-shape-safe ops: alignment, edge, middle, rotary_center.** Same
`xFieldGroups` two-phase pattern throughout. `edge`/`middle` needed their OWN legacy `*_BINDINGS`/`*DataStack`
exports KEPT ALIVE (real external test consumers, `edge-data-emit.spec.js`/`middle-data-emit.spec.js` import
them directly) — `alignment`/`rotary_center` had none and were removed as genuinely orphaned. `edge` is the
first op with THREE declared sections (not two); `middle` corrected a wrong first assumption before it shipped —
its own GEOMETRY section is split into two non-contiguous array runs, and `renderOpForm`'s section grouping is
NAME-KEYED (t2545's own measured finding), not contiguous-run, so both runs merge into ONE group_box, not two.
⚠ **Two mechanism findings, one recurring and materially bigger than first counted, one genuinely new:**
(1) the `_tree`-id gap (t2597) has a SECOND shape — `document.getElementById('userVizContainer')`, not just a
CSS selector — invisible to t2597's own grep. A repo-wide grep for this second shape found **39 more files**;
combined with the original 44, roughly **71 test files remain** that will need this exact fix, one migration at
a time (11 fixed this turn, across alignment/edge/middle). (2) NEW: the tree-mode canvas's own auto-fit/rescale
is transitional for ~1s after a marker first mounts — a test that reads drag-target geometry immediately after
the handle appears (rather than waiting for the canvas to settle) computes against a stale, ~12×-too-small
layout, and either misses the handle or drags too small a screen delta to register. Not a product defect —
proven via a live root-cause chase, not guessed — fixed with a `waitForTimeout(1000)` in the 6 affected files.
Full account, all findings with citations: WORK-LOG t2599.

> **⚠ CORRECTION (t2601) — the "~1s" duration above is WRONG, by roughly 10x.** Re-tested live with proper
> frame-by-frame sampling (the t2599 test only compared two points — immediate vs +1000ms — without
> characterizing the curve, exactly the "reason about it instead of testing it" the correction below caught):
> the real window is **sub-100ms** (first paint ~24×14px, corrected/rebuilt SVG subtree by ~t90ms). ROOT CAUSE
> now identified: `featureCanvas.js:121-127`'s own `ResizeObserver`, rAF-throttled, corrects an initial render
> that ran before `split_horizontal`'s own flex layout resolved the RIGHT pane's real width. Screenshot evidence
> (t≈0 vs t=1200ms) is IDENTICAL both times — the correction finishes faster than a screenshot round-trip, so
> likely imperceptible to a human eye. A drag started inside the window (tested live, 5/5) writes NOTHING (not
> a wrong value) — the stale coordinates miss the torn-down-and-rebuilt canvas entirely. **Confirmed DISTINCT
> from both #64/#65** (release-time value computation in `userOpView.js`'s `writeSimStartFrac`, a different
> file/trigger/symptom) **and #73** (a PERSISTENT ~11% cross-context scale ratio, not a self-correcting
> transient) — read both entries directly to confirm, not by resemblance. **Confirmed tree-mode-specific**: the
> same geometry sampled on `homing_data` (still classic-rendered at the time) was stable from the first read,
> no transitional state at all. Not fixed (a `featureCanvas.js` mount-sequence change, out of scope); the
> existing `waitForTimeout(1000)` fix stays (covers the real sub-100ms window with large margin). Full account:
> WORK-LOG t2601.

**t2601 — migrated `homing_data` and `io_step`; STOPPED on `atc_table_data`, root-caused a real tree-mode
mechanism gap affecting FOUR ops.** The "5 structural-only, lowest-risk" ops from t2597/t2599 were never
screened for PANEL KIND (only for blockIndex) — reading all 5 before touching any found only `homing` shares the
proven `form3d+2d` shape; `atcChangeData`/`atcTableData`/`atcTestData` share the SAME unverified `form3d`
(3D-only) shape already flagged for `atcCheckData`/`atcLengthData`; `ioStepData` is a THIRD, novel shape
(`panel:'form'` → `viz:false`, no preview at all). `homing_data` migrated clean (zero value bindings, simplest
migration in the arc) — its own `homingDataStack()` is cited BY NAME in a literal-text architecture-map canary
(TRAP6) and two structural tests; the two structural tests inspect the EXEC tree (untouched by this migration),
only the canary's own citation string needed updating. `io_step` migrated clean too — verified LIVE, before
committing, that its `viz:false` panel mounts no viz code in either render path, so its RIGHT pane is safely
empty. **`atc_table_data` attempted, then REVERTED**: declaring `preview3d` alone (no `feature_canvas` sibling)
mounted ZERO canvases anywhere — root-caused to `userOpView.js`'s own single-panel `'3d'`-mode branch expecting
a DIFFERENT container id than tree-mode's `preview3d`-alone template ever builds (the adjacency-merge mechanism
is proven only for the DUAL `'3d2d'` mode; the classic single-panel branches were never wired to tree-mode's own
container ids at all). This is the SAME root cause blocking `atcChangeData`/`atcTestData` (identical panel
shape, not re-attempted — one root-caused reproduction is sufficient) AND resolves `atcCheckData`/`atcLengthData`
from "unverified" to "confirmed blocked, same reason." Full account: WORK-LOG t2601.

**t2603 — BACKLOG #77 FIXED; all 5 blocked ATC ops migrated.** The advisor's own first-drafted diagnosis ("`vid()`
needs a declared resolver") was checked against the code before dispatch and found wrong — `vizBase`/`vid`
(t2323) already IS that resolver, on both sides. The real gap: `formWidgets.js`'s `preview3d`-alone fallback and
`userOpView.js`'s single-panel `'3d'`-mode branch each correctly ran their own id through the SAME resolver, but
picked DIFFERENT logical box names for the identical case — a naming disagreement, not a missing declaration,
invisible to the `_tree`-id census because neither side hardcoded a raw id. Fixed by making the (never-yet-
shipped) tree fallback build the name the branch already asks for — verified live first (0→2 canvases, zero
errors) before shipping — rather than changing the branch and reaching classic mode's own shared, already-
working dispatch for multiple live ops. Migrated all 5: `atc_table_data`, `atc_test_data`, `atc_change_data`,
`atc_check_data`, `atc_length_data` — each with its own row-diff test, a live canvas-mount proof, and its own
full pre-existing suite green. Full account: WORK-LOG t2603.

**t2605 — the "cheap end" of the six positional-binding ops converted + migrated: `pause_confirm` (1 binding),
`atc_warmup` (4, not 5), `wcs` (6, not 7).** `wcs` (all 6 bindings target ONE block, keyed apart) was cheaper
than `atc_warmup` (4 bindings but 2 pairs of structurally-identical sibling blocks needing a small, real
extension to `deriveBindings.js`'s own match vocabulary — `{type, params, nth}`) — direct evidence that raw
binding count does not predict conversion cost; the real driver is DISTINCT TARGET BLOCK count, and separately
whether any target has an unidentified structural sibling. Applying that measured axis (not yet a conversion,
a structural read) to the remaining three: **tap 18 bindings → 3 distinct blocks; contour 26 → 5; text 31 → 3**
— by distinct-block count text and tap TIE for cheapest, contour is the most structurally involved, flipping
the naive by-count ranking. `comm`'s own `panel:'commscreen'` resolved MIGRATABLE (BACKLOG #77's own updated
entry has the full account) in the same turn. Full account: WORK-LOG t2605.

---

## PART 2's OWN LEAD FINDING FIRST, because band 1 and band 2 both sit downstream of it

**There are TWO, ENTIRELY SEPARATE form render paths, and this turn (t2511) is itself a live incident of the
trap it creates.** `userOpView.js`'s own `hasTreeLayout()` routes an op to `formWidgets.js`'s `renderUiTree`
ONLY if a `split_horizontal`/`split_vertical` node exists anywhere in its `uiChildren` — checked directly,
`hasTreeLayout`'s own code tests exactly those two type strings, nothing else. **Measured directly against the
live app, not inferred: exactly 1 of the 32 registered twins is `isTree === true` — `user_drill_data`. All
other 31 are `false`**, including `centerDrillData.js`/`edgeData.js`/`partingData.js`, which merely MENTION
`split_horizontal` inside a COMMENT (a childrenOf-robustness note, not an actual declared node) — a grep-gives-
a-line false positive t2511's own pass-back note repeated as fact before this turn's own live measurement
caught it. **Every other op renders through a completely different, hand-written construction in
`userOpView.js`'s own `render()` (the `else` branch, `renderOpForm(host, binds)` on the flat `binds` array) that
never looks at `uiChildren`'s own layout/grouping nodes at all** — confirmed by reading the branch directly: the
ONLY `uiChildren` node the flat path special-cases is `path_anchor` (`findTopLevelPathAnchor`/
`mountFlatPathAnchor`, a bespoke lookup independent of the tree renderer).

⭐ **The precise answer to "does any declared detail behave differently between the two paths": YES, but only
for LAYOUT/GROUPING nodes — never for field-level properties.** `binds = formBindings(_def)` runs
UNCONDITIONALLY before the `isTree` branch, and BOTH paths ultimately render each field's own row through the
SAME `renderOpForm(host, binds)` call (the tree path calls it into a detached temp host first, then re-places
the resulting rows by walking `uiChildren`) — so `widget`/`widgetConfig`/`units`/`help`/`formHidden`/
`tokenEligible`/etc. are IDENTICAL either way. What differs is PLACEMENT: `section` (the uiChildren NODE type,
titled/collapsible), `group_box`, `tab_group`, `grid_container`, and (per the same mechanism) `usage_text`/
`code_preview` are **completely inert outside tree mode** — declared, parsed into the template, visible if the
op is opened AS BLOCKS in the Blocks-tab canvas, but never reaching the live FORM a machinist actually uses.
Measured, not guessed: `section` (node) is declared by 3 twins — `cornerData.js`, `drillData.js`,
`pocketData.js` — of which only `drillData.js` (the one `isTree:true` twin) actually renders it; `corner`'s own
FIVE named, coloured `sec(...)` sections (VIEW/STRUCTURAL/VARIABLES/FORM/G-CODE) and `pocket`'s own are BOTH
dead for the live form. `grid_container`: 2 twins (`drillData.js`, `pocketData.js`), only drill renders.
`usage_text`/`code_preview`: 3 twins (`atcCheckData.js`, `drillData.js`, `pocketData.js`), only drill renders —
`atc_check`'s own `code_preview` gap was ALREADY named at t2263 as "structure only, proven safe... live-content
wiring is the reported, not solved, gap," which this sweep now explains structurally: it was never going to
wire live, because `atc_check` is `isTree:false`.

⇒ **"Author a wizard that looks like a built-in" currently means matching a DIFFERENT renderer than 31 of the
32 built-ins themselves use.** This is very likely the root the `section:` contiguous-run defect, the
three-name `field_ref`/`formfield`/`param_field` collision, and this session's own t2511 mis-migration all sit
downstream of — see PART 2's own numbered entries below for each, and BAND 2 for why this is a "has bitten,"
not "hasn't yet," finding.

---

## PART 1 — AUTHORABILITY: for every declared detail a built-in uses, is there a block?

Every count is out of 32 twins. **BLOCKS THE AUTHORING GOAL** band, ordered by twin count (highest first) —
these are the rows that actually stop a person authoring a built-in equivalent from the real UI:

| detail | USED BY | BLOCK? |
|---|---|---|
| `postInstantiate` (`def.postInstantiate =`, a `(stack,resolved)=>stack` closure) | **25/32** | **NO** — functions cannot be block data under the current architecture. NOT one missing capability: the 25 uses cover many distinct, per-op transforms (spindle-Head fill, header-comment recompose, structural-control sync, straight-peck application, …) — a genuine escape hatch by nature, not a single fixable gap. |
| `tokenRefusal` (a binding's own live-token refusal message) | **17/32** | **NO** — absent from `formfield`'s own field list entirely. |
| `tokenEligible` | **15/32** | **NO** — same; a twin-authoring-time-only concept, measured by hand-audit (t1704's own "32-op / 393-param survey"), fail-closed, no author-facing toggle anywhere. |
| `simStock` (`def.simStock =`, a `(params,stock)=>{...}` closure) | **11/32** (4 direct + 7 more via the shared `withLatheScene()` helper) | **NO** — function hook. |
| `tokenDeferrable` | **11/32** | **NO** |
| `zRuler` (`def.zRuler = {depthParam,stepParam}`, the 2D-plan depth-ruler strip) | **8/32** | **NO** — plain JSON-safe data (not a function!), read only by `userOpView.js:346`, yet still no block/field anywhere sets it. `userOps.js`'s own t1682 header independently names it one of 7 "real, live, generically-read hooks a `.wiz` fork cannot carry as data" — corroborating, not re-derived. |
| `entryPoint` (`def.entryPoint = ENTRY_POINT`, the draggable program-entry marker) | **8/32** | **PARTIAL** — a real `entryBlock` (`type:'entry'`, fields `entryX`/`entryY`) supplies the VALUE + emit waypoint; but the draggable CANVAS MARKER is gated on `def.entryPoint` being set directly in JS (`userOpView.js:731,798`), never auto-derived from the block's presence. A pure block-author gets the emitted waypoint but not the drag handle. |
| `previewGeometry` (interactive drag handles) | **7/32** | **NO authoring path at all — BACKLOG #71, cited not restated.** |
| `latheTool` / `latheProbeAxis` | **0 direct / 7 via the shared `withLatheScene()` helper** | **NO** — not even a per-twin literal; a constructor argument to a shared helper. |
| `widget:'action'` (opens a Settings sub-panel from a form button) | **3/32** (atcChangeData, atcTableData, homingData) | **NO** — absent from `formfield`'s own authorable widget vocabulary. |
| `widget:'feedsuggest'` (the Apply-computed-feed button) | **2/32** (drillData, pocketData) | **NO** |
| `simStartParams` (draggable per-pass sim-start markers) | **2/32** (rotaryClockData, alignmentData) | **NO** |
| `armGap` (`def.armGap =`, a function) | **2/32** (slotData, pocketData) | **NO** |
| `normalizeParams` (`def.normalizeParams =`, a function) | **1/32** (surfacingData — stored-stepover recovery) | **NO** |
| `previewVarSeed` | **1/32** (surfacingData — skim-mode jog seed) | **NO authoring path — BACKLOG #71.** |

**Full parity (checked, not just seeded), for contrast — these are NOT gaps:**

| detail | USED BY | BLOCK? |
|---|---|---|
| `section:` (binding-spec string tag) | **31/32** (every twin except `pauseConfirmData.js`, one field, nothing to group) | **YES**, full parity — `formfield`'s own `section` field, read generically off the binding-spec shape regardless of hand-JS or block origin. (Full parity does not mean bug-free: see BAND 2 below — the mechanism itself is the `section:`/PART-2 defect.) |
| `units` + live conversion readout | **10/32** | **YES**, full parity — `formfield`'s `units` field, read generically by `formWidgets.js`'s `unitsOf()`. |
| `path_anchor` (dual stock-attach/path-datum corner picker) | **6/32** | **YES** — `pathAnchorBlock`, renders via its own dedicated branch in BOTH render paths independently (tree AND flat each special-case it). Deliberately NOT used by `tapData`/`boreData` (plain dropdown rows instead — no stock-attach geometry for those ops, confirmed correct, not a gap). |
| `widget`/`widgetConfig` (dropdown, segmented, number min/max/step) | **24 / 25** resp. | **YES for the common cases** — see the NEW bug this sweep found, immediately below, for the two cases that are broken rather than merely absent. |
| `onEdgePick`/`onCornerPick` | N/A — **not twin-set at all, 0 hits.** Not a JS hook an author would assign: `panelTypes.js`'s own `layoutSpecFromOp` auto-derives a clickable wall/corner picker for ANY twin whose bindings declare an `axis`+`dir` or `corner` enum — already effectively block-authorable today (declare those params via `formfield`). Seed's own "callbacks, not data" framing REFUTED — it's auto-wiring off ordinary enum bindings, a different shape of question than the rest of this table. | — |

---

## PART 2 — DUPLICATES: what can be said two ways?

### BAND 2 — DUPLICATES THAT HAVE BITTEN (ordered by twin count)

1. ⭐⭐⭐ **`section:` string tag vs `section`/`group_box`/`grid_container`/`tab_group`/`usage_text`/`code_preview`
   uiChildren nodes, gated by the two-render-path split above — 31/32 twins carry `section:`; only 1/32
   (drill) is on the render path where the NODE vocabulary means anything at all.** TWO confirmed incidents on
   record: t2375/t2377 (the contiguous-run defect, two corrective turns) and **this session's own t2511** — the
   worker migrated `surfacingData.js` first, verified it structurally clean in isolation, and only the live
   before/after comparison exposed that `hasTreeLayout` never routes surfacing to the changed path at all. A
   structural check passing on a path the op never reaches is this project's own named
   green-tests-over-a-dead-path scar, and this is a second, independent instance of it, freshly demonstrated,
   not archival. Owner has already ruled on the direction: **containment (`group_box`) survives, the tag
   (`section:`) goes.** Record the ruling and the migration size (all 31 tag-using twins) — do NOT start it.
   >
   > **t2529 — ASSESSED, per the owner's own instruction to check the evidence before touching AGENTS.md rule
   > 1b's own named decision. STOP — not yet safe, and now with a MEASURED cost, not a guess.** Read
   > `renderUiTree` (formWidgets.js) end to end and confirmed structurally what this entry already suspected:
   > `renderUiTree`'s own `section`/`group_box` branches build sections ONLY from explicit `uiChildren` nodes —
   > they never read a binding's own `.section` string tag at all. The flat path's own grouping (`renderOpForm`'s
   > `SECTION_THRESHOLD`/`SECTION_RANK` logic) is the exact opposite: it reads ONLY the binding-level tag, never
   > `uiChildren`. **These are two independent mechanisms with zero overlap, confirmed by a real pilot, not
   > inferred from reading the code alone**: rendered `user_surfacing_data` (a real, live twin, its own real
   > `def.bindings`) through BOTH `renderOpForm` (the flat path — what every user of Surfacing sees today) and
   > `renderUiTree` (called directly against surfacing's own real `uiChildren`, zero production code touched —
   > `hasTreeLayout` itself was never modified or even called) in the SAME live page, then diffed the two
   > outputs row for row. Row count matched (30 = 30), every field-level property matched (param/label/tag/
   > type/value — confirming this entry's OWN "field-level props render identically" finding holds), and the
   > viz-box/path-anchor chrome matched exactly (`sim`/`path_anchor` DO faithfully reproduce the shell's own
   > markup, confirmed live: `hasVizSplit`/`has3dPane`/`has2dPane`/`hasPathAnchorMount`/`stockAttachRowHidden`
   > all identical between the real flat-rendered page and the direct tree call). **But EVERY ONE of the 30
   > rows lost its section**: the flat-rendered page groups them under 4 labelled, foldable sections (AREA /
   > TOOL / TOOL & STEPOVER / DEPTH & FEED, from each binding's own `.section` tag); the tree-rendered version
   > put all 30 in one flat, ungrouped list (`section: null` on every row), because surfacing's own `uiChildren`
   > declares no `section`/`group_box` node at all — it never needed to, while unreachable. This is the EXACT
   > silent-blanking shape rule 1b's own scar names, caught by the SAME instrument the rule demands (a real
   > rendered-output comparison, not a targeted check) — and it is bigger than "some sections might not carry
   > over": for THIS op, tree-rendering as-is is a TOTAL loss of grouping, not a partial one.
   >
   > **The corner check the dispatch also asked for came back with an independent finding of its own**:
   > corner's own `uiChildren` (unlike surfacing's) ALREADY declares 4 `section` nodes (`sec()`, `cornerData.js`)
   > — but TWO of them ("LAYOUT-2D", "PROJECTED-GCODE") are DECLARED EMPTY (`[]` children), dead placeholders
   > that would render as two visible, empty, collapsible boxes with nothing inside if corner were ever
   > tree-rendered as-is — a SECOND, independent way a naive migration would visibly change corner's own form,
   > on top of the same section-tag-vs-node gap surfacing has. (Also confirmed directly: corner's own `section`
   > nodes carry a `color` param the form tree renderer never reads at all — `bridge.js`'s own `ddcs_seccolor`
   > extension consumes it, for the BLOCKS-CANVAS editor's own comment-box colouring, a genuinely separate,
   > unrelated consumer of the SAME node type. Harmless to the form-render question — color is simply ignored
   > there — but it means these `section` nodes were never purely "for the form" even where declared, worth
   > knowing before reading them as evidence of tree-readiness.)
   >
   > **THE ACTUAL COST, now sized, not guessed**: making ONE op's tree-rendering byte-identical to its own
   > CURRENT flat rendering needs its own `uiChildren` rewritten with explicit `group_box` nodes reproducing
   > EXACTLY what its binding-level `.section` tags currently produce — for surfacing, 4 new `group_box` nodes
   > (AREA/TOOL/TOOL & STEPOVER/DEPTH & FEED) wrapping the correct 30 rows in the correct order, then the SAME
   > pilot method (function-level row diff + live chrome comparison) re-run to confirm zero drift. This is
   > **per-op DATA AUTHORING, not a `hasTreeLayout` code change** — the guardrail ("if unifying needs the TREE
   > PATH to grow capability... STOP AND REPORT") did not fire in the CODE sense (renderUiTree's own mechanism
   > is complete and correct for what it declares); what's missing is 31 twins' worth of DECLARATION, which is
   > exactly the "migration size (all 31 tag-using twins)" this entry's own t2513 line already named and
   > deferred — now confirmed to be real, not overstated, by an actual before/after render diff on the
   > cleanest candidate available. **Recommendation: stays deferred.** Widening `hasTreeLayout` without first
   > authoring EVERY affected op's own `group_box` replacement is the exact shape of the t2371 scar rule 1b
   > exists to prevent, now demonstrated on a SPECIFIC op with SPECIFIC missing declarations, not argued in the
   > abstract. Full account, including the corner empty-section/color findings and the pilot's own method:
   > WORK-LOG t2529.
   >
   > **⛔ t2531 — attempted, gate passed clean, the MANDATORY full suite caught a real regression the gate
   > could not see, REVERTED. New blocker for the whole migration, not just surfacing.** `surfacingData.js`'s
   > `buildSurfacingTwinStack()` nested 4 `group_box` nodes into `param_group.children`; the sizing pilot's own
   > before/after gate passed with zero adjustments (30=30 rows, section-identical, `hasTreeLayout` confirmed
   > still `false`, proven non-vacuous). But the full suite found 2 real, non-flaky failures (confirmed at
   > `--workers=1` too): the Blocks-tab "Customize" flow's own canvas materialization
   > (`userOps.materializeParamGroup`, called from both `registerUserOp` at boot and `devMode.editWizardDef`)
   > shares that SAME `param_group.children` array for an entirely different purpose — a FLAT list of literal
   > `param_field` Blockly block records it places on the canvas for the operator to author directly — gated by
   > an idempotency check (`children.length > 0` ⇒ "already materialized") that this turn's non-empty-but-
   > non-`param_field` `group_box` nodes defeat, silently. A tighter guard was tried and traced through: fixing
   > the check just uncovers that `materializeParamGroup` then OVERWRITES `param_group.children` outright with
   > its own flat records — destroying the group_box declaration the instant the app boots, trading one failure
   > for reintroducing the exact bug this migration exists to fix. **`param_group.children` is architecturally
   > overloaded between two owners (the declarative form-layout tree vs. the canvas materialization target) and
   > this migration's technique cannot ship for ANY twin until that's resolved — not a surfacing-specific
   > edge case.** Fully reverted (`surfacingData.js` back to byte-identical HEAD, the new gate test deleted, the
   > two previously-failing tests re-run in isolation and confirmed green again). `hasTreeLayout` untouched
   > throughout — this is not a t2371-shaped mistake, it's a genuinely new architectural fact the mandatory
   > full-suite run was built to catch, and did. Full account: WORK-LOG t2531.
2. ⭐⭐ **`widget:'tool-library'` / `widget:'thread-preset'` — a NAMING MISMATCH bug, found fresh this sweep, not
   seeded.** `formfield`'s own widget picker offers "Tool Library"/"Thread Preset" options that write
   `widget:'tool-library'`/`'thread-preset'` into the binding spec — but `formWidgets.js`'s own render-side map
   (`FORM_WIDGETS`) keys the real pickers as `toolpick`/`threadpick` (the string EVERY existing hand-JS twin
   actually uses — `pocketData.js`'s `restTool`, `tapData.js`'s `pitch`). `resolveFormWidget()` does a plain
   `FORM_WIDGETS[b.widget]` lookup with no match for the block-authored strings, so it silently falls back to
   the type-default (a plain number field) instead of erroring OR working — an author who picks "Tool Library"
   in the form-field authoring UI gets a bare number box with no warning. **2/32 twins use the REAL mechanism
   today** (`pocketData.js`, `tapData.js`); the bug affects any FUTURE author who reaches for the block's own
   offered option, not those two twins directly. Confirmed by reading `resolveFormWidget()` and
   `bindingsFromStack`'s own pass-through of `p.widget` unmodified — a real, live, verified defect, not merely
   absent.
   >
   > **✅ t2527 — FIXED, at the source.** `bridge.js`'s own dropdown vocabulary now commits `[label, value]`
   > pairs — `['tool-library', 'toolpick']` / `['thread-preset', 'threadpick']` — keeping the same friendly
   > display text while fixing the committed VALUE to the string `FORM_WIDGETS` actually reads (the OTHER
   > direction — renaming `FORM_WIDGETS`' own keys — was rejected: it would have broken `pocketData.js`/
   > `tapData.js`'s own EXISTING, working `toolpick`/`threadpick` bindings, the two real users this entry's own
   > count named). Verified live: a formfield authored with the "tool-library" option through the real UI, real
   > save, real reload, real reopen now renders the REAL `<select>` tool picker (confirmed by tag name, not
   > just a passing string check) — `verification/t2527-toolpick-widget-live.png`. The GENERAL case this entry's
   > own root cause names — `resolveFormWidget()`'s silent not-found fallback — is ALSO fixed, not just these
   > two strings: it now `console.warn`s whenever a widget is declared and doesn't resolve, for any widget
   > string from any source. Full account: WORK-LOG t2527.

### BAND 3 — DUPLICATES THAT HAVEN'T BITTEN YET

1. **`field_ref` / `formfield` / `param_field`** — `formWidgets.js`'s own tree-placement branch handles all
   three identically, and its OWN comment names the exact hazard: reusing `formfield`/`param_field` (which
   ALSO mean "declare a brand-new binding" elsewhere) as a tree-placement reference "silently corrupts
   `registerUserOp`'s own scan... matched against 0 blocks." `field_ref` (t2299) exists specifically to avoid
   this. **Zero twins today use the dangerous case** ("nothing shipped used either as a presentation reference
   before this," the code's own words) — a real, named, self-documented trap with no incident yet, not a
   collision by accident.
2. **`panel` — a genuine NAME COLLISION, confirmed NOT a duplicate mechanism, cheap to fix.** `def.panel`
   (a top-level enum, e.g. `'form3d+2d'`, set via `userOpFromStack`'s own positional arg, selecting whether the
   outer shell reserves a viz pane AT ALL — read by `panelType(_def.panel).viz`) and the `panel`-type
   `uiChildren` NODE (renders the 2D box's own content) share one English word but have ZERO functional
   coupling — confirmed directly: `formWidgets.js`'s own `panel`-node branch never reads `node.params.panel` at
   all (independently confirmed by `drillData.js`'s own comment saying the same). A rename removes the
   confusion at zero behavioural cost — this is the CHEAP problem the dispatch's own framing distinguished from
   a real duplicate mechanism.
   > **✅ t2515 — RESOLVED, owner ruling, hard rename no alias.** The block/uiChildren-node TYPE `panel` is now
   > `feature_canvas` everywhere (`wizards/ops/panel.js` → `featureCanvas.js`, every render/round-trip/palette
   > consumer, every test fixture). `def.panel`/`params.panel` (the FIELD this item confirmed was a distinct,
   > uncoupled concept) is UNCHANGED, exactly as this finding said to leave it. No back-compat alias — an older
   > saved wizard using the string `panel` is remakeable, per this project's own no-legacy-burden rule.
3. **`sim` — seed REFUTED. Not a duplicate; a normal declare→derive pipeline, say so plainly.** The `sim`/
   `preview3d` block's own raw params (`rotary`/`machine`/`magazine`/`probeWcs`) and `def.sim` (the object
   `simIntentFromStack` produces) are NOT two independent sources of truth — `def.sim` is COMPUTED FROM the
   block's own declared params (returns `null` if every flag is false, the object itself otherwise). One
   mechanism, read at two different moments (raw declaration, then post-processed intent) — the same shape
   `previewGeometry`/many other declared-property-to-derived-def-field pipelines already use throughout this
   codebase. The dispatch's own seed asked "are they truly redundant, or a real distinction wearing one name" —
   here it is cleanly the latter, and cheaper than that: not even two distinct concepts, just two views of one.

### BAND 4 — DECLARED BUT UNUSED (this project's own recurring class — `emits`/`modalPre`/`noSnap`/`mouth`/
`layout_2d_canvas` are the five already found; these are the sixth and seventh)

1. **`group_box`** — **0/32 twins.** The block is real, registered, and renders correctly if used
   (`formWidgets.js`'s own `node.type==='group_box'` branch) — the "nobody uses it" side of the authorability
   coin, distinct from "no block exists." (Bare-word grep found one apparent hit in `drillData.js`; spot-checked
   and it was a COMMENT — "a `section`/`group_box` node always renders a title" — not a declared node. Zero
   real usages.)
2. **`tab_group` / `tab_page`** — **0/32 twins**, same shape as `group_box`: real, wired, rendered, unused.

*(Minor footnote, not a full row: `widget:'select'`, used by 2/32 twins (`faceProbeData.js`/`odProbeData.js`,
both on `wcs`), is not in `formfield`'s vocabulary OR the `FORM_WIDGETS` render map either — but it happens to
render correctly anyway, because `resolveFormWidget`'s own type-default folds any unrecognised enum widget to
`dropdown`. A harmless accidental synonym, not a gap or a bug — named so it isn't mistaken for either.)*

---

## STILL REAL IF

- **The render-path split** (PART 2's own lead finding): `grep -l "type: 'split_horizontal'\|type: 'split_vertical'" web/blocks/dataOps/*.js` still returns exactly `drillData.js`, and a fresh live check (`hasTreeLayout(_def.template)` on every registered twin, via `listUserOps()`+`getUserDef()`, the exact method this sweep used) still returns exactly one `true`.
- **The `toolpick`/`threadpick` mismatch**: dragging a fresh `formfield` block, setting its own `widget` field to
  the option labelled "Tool Library" (or "Thread Preset"), saving, and opening the resulting form still shows a
  plain number input instead of the real picker.
- **The `group_box`/`tab_group` non-adoption**: `grep -l "type: 'group_box'\|type: 'tab_group'"
  web/blocks/dataOps/*.js` still returns nothing.
- **Every other count above**: re-run the SAME anchored greps (field-name + colon, or `def.<name> =`) this sweep
  used, against the current 32-twin file list — if the twin count for any row has moved, the entry is stale for
  that row specifically, not necessarily the others.

---

> **⛔✅ t2545 — surfacing migrated to the declared `group_box`/`field_ref` tree (BACKLOG #71's own pilot,
> finally unblocked by t2543's separate-slot fix). The two counts above this note now name are STALE for
> surfacing specifically**: `split_horizontal` now returns 2/32 (`drillData.js` + `surfacingData.js`), and
> `group_box` now returns 1/32 (surfacing's own four AREA/TOOL/TOOL & STEPOVER/DEPTH & FEED nodes) — not zero.
> `path_anchor`'s own 6/32 full-parity row is unaffected in count, but surfacing's own instance (t2271's own
> "the pilot," dead code since it was written per t2371's own WORK-LOG entry — declared, never once reachable
> because surfacing was never tree-rendered) is now FINALLY LIVE, a side effect of this migration, not a
> separate fix.
>
> **Proven, not asserted**: `surfacing-form-reproduction-2377.spec.js` (switched from `mode:'flat'`, which was
> silently testing the bypassed renderer, to `mode:'tree'`) renders the SAME real def through BOTH
> `renderOpForm` and `renderUiTree` and diffs — 30 rows, same order, zero orphans, all four section titles
> match the live shell exactly, usage text and code-preview label reproduced verbatim. A NEW permanent test
> (`surfacing-section-reorder-2545.spec.js`) settles the dispatch's own central question — measured directly,
> not assumed at face value: `renderOpForm`'s section-box creation turns out to be NAME-KEYED, not literally
> "contiguous run" fragile the way first framed; what genuinely IS array-position-hostage is section BOX
> ORDER — reversing `def.bindings` reverses the FLAT render's own section order right along with it, while the
> declared `group_box` tree's order (four explicit nodes) stays fixed regardless. A real, still load-bearing
> distinction, reported as measured.
>
> **⚠ A genuine, understood, NOT-fixed gap this migration exposed, per the dispatch's own "report the real
> cost" instruction — a new BACKLOG candidate, not silently absorbed into this turn's own scope.** Three tests
> (`drag-render-truth-gate-2461` surfacing sf_pos, `preview-mutation-manifest-2463`'s sf-pos-snapback entry,
> `surfacing-start-position-1648`'s cross-face ONE-SOURCED test) all trace to ONE shared root: the declared
> `split_horizontal`'s own inner visualization canvas renders at DIFFERENT effective screen geometry depending
> on which host container it's nested in (the Blocks-tab "auto op-preview" narrow panel: mouse-drag
> hit-testing returns an ancestor instead of the handle, 0px movement, deterministic; the wide Customize
> modal: the drag works but at roughly HALF the classic shell's own scale). Confirmed via a DIRECT CONTROL
> against DRILL — the only other `split_horizontal` twin exhibits the IDENTICAL narrow-panel symptom
> (`dr_pos`, same `.wiz-controls` overlap) — so this is PRE-EXISTING and LATENT in the split_horizontal
> mechanism itself, not something this turn's own group_box/field_ref/param_table work introduced; it simply
> had never been exercised through this exact narrow-panel drag route before, because drill was the only
> split_horizontal twin and its own drag tests all go through the classic shell or the wide modal instead.
> t2481's own container-query stacking fix (styles.css ~2779) IS firing correctly in the narrow case
> (confirmed live, `flexDirection:'column'`) — the remaining defect is specifically in mouse-event
> hit-testing/canvas scale, not the stacking mechanism. Not fixed this turn: genuinely out of "surfacing
> only... the section migration only" scope, shared with drill, and risks the exact kind of undetected
> second-order regression t2371's own full-suite catch already warns about if rushed. Full account, all three
> failing tests + the drill control comparison: WORK-LOG t2545.

---

### 73. `visualMaxHeight()`'s own "climb to `.ui-split`" strategy has never been asked to bound a split-nested visual inside an UNCONSTRAINED wide-modal host — a real, scoped gap, RULED to stay a documented constant rather than be closed

*(t2545/t2547/t2549/t2551/t2553's own arc — the split_horizontal cross-context canvas-geometry family. t2551
landed a hand-tuned CSS constant, `calc(min(93dvh,1000px) - 200px)`, as the fix for the canvas-growth half of
this arc; t2553 tried to replace it with the LIVE, principled computation `visualMaxHeight()` already
provides and found it does not yet reach this case. t2555 — owner-ruled: the constant STAYS, this entry
exists so a future turn starts from the diagnosis rather than re-deriving it, not because a fix is imminent.)*

**THE FINDING, precise, not "the wire-up failed":** `visualMaxHeight(visual)` (`web/ui/paneAccordion.js:210`)
computes a live, footer-aware ceiling by climbing from a `.wiz-visual`'s own immediate host to a container
that holds BOTH it and its sibling(s), then measuring `hostBottom - visualTop - roomBelow`. This is PROVEN
correct for exactly two cases: (1) the classic shell, where `.wiz-2pane`'s own `height:100%` resolves against
the modal's real `min(93dvh,1000px)` bound; (2) a split-nested visual in the NARROW/stacked layout (t2355's
own fix — climbing from `.ui-split-pane` to `.ui-split-horiz`, which at ≤860px is `height:auto` too and
therefore explicitly special-cased to return `VIZH_MAX`, since "the modal itself goes height:auto... there is
no real ceiling to protect"). **Never exercised in a THIRD combination**: a split-nested visual inside the
WIDE Customize modal. There, the climb correctly reaches `.ui-split-horiz`, but that container is ALSO
unbounded — for a DIFFERENT reason than the narrow case: `render()`'s own tree-mode JS (`userOpView.js`) sets
`.wiz-controls` to `flex: 1 1 100%` with no explicit height, and `align-items: stretch` then pulls
`.ui-split-horiz` to match `.wiz-controls`'s own unconstrained form-column content (the exact mechanism
t2551's own investigation named). MEASURED, not inferred (t2553): calling `visualMaxHeight()` on surfacing's
own twin in the wide modal returned `900` — `VIZH_MAX`, the function's own absolute safety fallback — because
the RAW computation (`1263px`) exceeded it, not because the function found a real ceiling and clamped
sensibly. **The function is not broken; it has never been asked this question.**

**THE COST OF NOT FIXING IT, stated in real numbers (t2555, measured live, both axes — the first report of
this only characterized jogX):** the twin's own split-nested preview canvas and the classic shell's canvas
scale a real-world drag distance differently, and NOT uniformly — width and height are bounded by two
independent factors (width by the split's own fixed-plus-flex column allocation; height by the landed
`-200px` chrome-aware bound). A dragged-jogX/jogY pair on IDENTICAL params/IDENTICAL pixel delta lands at
`ratioX ≈ 1.11` (twin ~11% larger) and `ratioY ≈ 2.20` (twin ~120% larger — the WORSE axis, not previously
reported) versus the classic shell's own numbers.
`tests/surfacing-start-position-1648.spec.js`'s own cross-face ONE-SOURCED test now DECLARES both bands
explicitly (t2555) rather than asserting exact equality and staying permanently red.

**WHAT CLOSING THIS WOULD ACTUALLY TAKE, so a future attempt doesn't re-discover the same dead end**:
`visualMaxHeight()`'s own climb-and-measure strategy needs a THIRD case — recognizing when the climbed host
is ITSELF unbounded because of tree-mode's own `flex:1 1 100%` override (not just the narrow-width
`height:auto` case it already special-cases), and in that case either climbing FURTHER (to something with a
genuinely definite height — the modal's own outer chrome) or independently locating the real footer boundary
rather than trusting the immediate climbed host's own `getBoundingClientRect().bottom`. This is a change to
the FUNCTION's own logic, not a wiring change — real, scoped work, not a five-minute pass.

**RULED, not merely deferred (t2555, owner)**: the residual is ~11%/~120% canvas-scale drift on ONE operation
(surfacing) in ONE modal (the wide Customize dialog) — extending `visualMaxHeight()` for a cosmetic gain, on a
rule that has already taken FOUR visits (t2347/t2355/t2357/t2551), is not worth a fifth. The `-200px` constant
in `styles.css` (t2551, `.ui-split-pane > .wiz-visual` inside `@media (min-width:861px)`) stays. This entry
exists to be the diagnosis a future turn starts from, if/when the cosmetic gain becomes worth the work — not
a queued TODO expected to be picked up soon.

**⚠ CORRECTION (t2567) — the `ratioY ≈ 2.20`/"WORSE axis" number above was NEVER this entry's own defect.**
It was a SEPARATE, UNRELATED bug (BACKLOG #64/#65's own pan-feedback compounding, `featureCanvas.js`'s
`_followHandle`, since removed) riding along on the SAME test's own drag gesture — that mechanism inflated
jogY specifically (this particular drag never triggered it on jogX) by roughly 2x, on top of whatever THIS
entry's own genuine canvas-scale gap contributes. MEASURED after #64/#65's own fix: `ratioX` and `ratioY` are
now `1.1121` and `1.1121` — identical to 4 significant figures. **This entry's OWN diagnosis (`visualMaxHeight`
has never been asked to bound a split-nested visual inside an unconstrained wide-modal host) is UNCHANGED and
still real** — it explains the ~11% BOTH axes now show equally — but the "WORSE axis"/~120% framing, and the
implication that HEIGHT is asymmetrically worse than WIDTH for this gap specifically, do not survive: they
described the other bug, not this one. `tests/surfacing-start-position-1648.spec.js`'s own declared band was
tightened to match (ONE band, ~1.05-1.20, both axes) at t2567 — see that turn's own WORK-LOG entry.

---

### 74. Desktop packaging is Windows-only — macOS was planned, never built

[OPEN, no build scheduled] All three CI workflows (`.github/workflows/desktop-release.yml`,
`desktop-build-check.yml`, `test.yml`) run on `windows-latest` only; `desktop/build_fairy.ps1` is PowerShell-only;
there is no `macos-latest` runner, `.app`, or `.dmg` anywhere in the repo. Do not design around a Mac build
existing — a Windows-only API (`winsound`, `windll`) costs nothing today beyond a `sys.platform` guard. If ever
built: the same pywebview script via WKWebView (pyobjc), built on a GitHub Actions `macos-latest` runner
(PyInstaller can't cross-compile) with `--windowed` (bare binaries lose keyboard focus on macOS); unsigned
builds hit Gatekeeper; real signing/notarization needs a $99/yr Apple Developer account. (Migrated from memory,
t2585 — verified still true at HEAD `2f6f9149`.)

### 75. CAM slot hand-edit escape hatch (Fork E) — still not built

[OPEN] The declare-once CAM authoring model (the wizard is the one editor, Settings is pure display) has no raw-
block hand-edit path: a slot with no `slot.ops` manifest shows "ⓘ hand-built — no wizard Edit" with no way in.
S4 (loading a universal/substack op's own structure into the Blocks tab on Edit) shipped 2026-08-07 and covers
block-able ops; Fork E — an app-wide code→blocks escape hatch for arbitrary CAM macro bodies — remains the one
deferred fork from the original declare-once design. `regenGuard` (`web/ui/macrosApp.js:1188`) is reserved for
this path; it currently only serves the unrelated "⟲ Rebuild" action (t1456). (Migrated from memory, t2585 —
the rest of that memory's own content, S4 itself, was confirmed already shipped and is not repeated here.)

### 76. [REJECTED 2026-07-10, do not re-propose] Enum-label "Engrave Label" CAM slot design

Operator-numbered + `-t2` preset labels for a CAM slot's own on-pendant name, rejected outright by the owner.
Grounded facts that survive the rejection and are worth keeping in mind if a similar idea resurfaces: the
Expert CAM/param fields are only `-t0` int / `-t1` dec / `-t2` enum; `#` vars are floats; free-typed text entry
on the controller pendant is impossible — any future "named label on the pendant" idea runs into this same
wall. (Migrated from memory, t2585.)

### 77. [✅ FIXED t2603] Tree-mode's `preview3d`-alone declaration mounted NO canvas — the 3D-only
(`panel:'form3d'`) shape was never wired, blocking 5 ops from Phase 1 (the entry's own count was wrong when
first filed — reconciled below)

**t2601 — root-caused, not fixed.** `formWidgets.js`'s own tree-mode adjacency-merge (the mechanism that lets a
`preview3d`+`feature_canvas` sibling pair render the SAME combined box the old `sim` node did) is proven correct
ONLY for the DUAL-mode case (`panel:'form3d+2d'`). A `preview3d` node declared ALONE (no `feature_canvas`
sibling, matching `panel:'form3d'` — a 3D-only op) mounted zero canvases. CONFIRMED LIVE: attempted on
`atc_table_data`, reproduced deterministically.

**t2603 — CORRECTED DIAGNOSIS, then fixed.** The advisor's own first-drafted framing ("`vid()` is missing a
declaration") was checked against the code before being sent and found wrong: `vizBase`/`vid` (`userOpView.js:
699-702`, added t2323) already IS that one-declaration resolver, and BOTH sides already run every id through it.
The real shape: `formWidgets.js`'s `preview3d`-alone fallback built `userViz3dBox_tree`/`userViz3dContainer_tree`
(the 3D-named base); `userOpView.js`'s own single-panel `'3d'`-mode branch (`vid('userVizContainer')`, reusing
the "2D" box as its one shared single-pane target — the SAME thing the classic shell's own static markup has
always done) asked for `userVizBox_tree`/`userVizContainer_tree` instead. Both correctly suffixed, both run
through the same resolver — the two sides simply picked DIFFERENT logical box names for the identical case, and
neither side hardcoded a raw id, which is exactly why the 73-file `_tree`-id census never caught it.

**FIX, measured not argued**: two forks were possible — (a) make the tree fallback build the base the branch
already asks for (local to `formWidgets.js`'s own never-yet-shipped template), or (b) make the `'3d'` branch ask
for the 3D-named box (reaches `userOpView.js`'s shared dispatch, used by every op — classic AND tree — with
`panel:'form3d'`, several of them already shipped and working). Fork (a) was implemented and verified live
first (a scratch probe: 0 canvases → 2 canvases, zero console errors) before being written into the real
migration — fork (b)'s own blast radius (touching working classic-mode rendering for multiple shipped ops) was
never worth risking once (a) was proven sufficient and fully local. Applied the identical fix to the analogous
`sim`-node branch (dead code today — no migrated op keeps a `sim` node — fixed anyway for consistency, so the
same latent bug isn't left for whoever next reads it).

**Reconciled count**: the entry's own heading said "4 ops," its own body named 5 (`atcChangeData`/`atcTableData`/
`atcTestData`/`atcCheckData`/`atcLengthData`) — 5 was correct, the heading undercounted. **All 5 are now
migrated and green** (t2603): `atc_table_data`, `atc_test_data`, `atc_change_data` (the "hardest of the ATC
set" per its own file header — no additional complexity survived the migration, since only the FORM tree was
touched, not the recompose/emit machinery), `atc_check_data`, `atc_length_data` — each verified with its own
row-diff test plus a live "does a real canvas mount" proof, plus its own full pre-existing test suite. Full
account: WORK-LOG t2601 (diagnosis) + t2603 (fix + all 5 migrations).

### 78. ⛔ REMOVE THE BEACON PROGRESS MECHANISM ENTIRELY — owner: "beacons dont work remove them"

**[DONE t2649. The mechanism, its per-job map, `slave.py`/`telemetry.py`/`checkpoint_insert.py`/the JS
instrumenter, and every UI surface that rendered its progress (History Duration/Last-time, the queue/tracker
percent bars, the Beacons checkbox in Send/Submit/Setup) are removed. `PROTOCOL.md` §1-2/§4/§5 mark what was
WIRE-FRAME evidence vs FEATURE evidence, per the caveat below. Delivery + BACKLOG #79's live tracking proven
working after the removal (bridge pytest 126/126). Was OPEN, owner-directed 2026-09-04 — not a cleanup, ~238
references in `bridge/bridge-app`.]**

⭐ **The owner's statement is the finding.** The beacon tracks job progress by **rewriting the user's `.nc`**:
the instrumenter inserts `#250 = <n>` + `MSETDATA[250,1,0,2,16,300]` checkpoints, each arriving at the PC
slave as `28416 + n`, decoded against a per-job JSON map into percent/op/line/ETA
(`bridge/bridge-app/shared/PROTOCOL.md` §1–§2).

⚠⚠ **THE BEACON FEATURE WAS NEVER TESTED TO WORK — owner-stated 2026-09-04, and the tests bear it out.**
An earlier draft of this entry said the proof was "a test file, never a real instrumented job." That was too
generous. Measured:

| what | status |
|---|---|
| `MSETDATA` **transport** — frames arrive, little-endian packing, wedge-free | ⭐ genuinely PROVEN (2026-06-06, `CHECKPOINT_TEST.nc`) |
| beacon **failure reporting** — `test_beacon_health_2057.py` | ⭐ tested — but ONLY the sad path: `COM999`, a bad/busy port, "does it report the honest reason" |
| beacon **feature end-to-end** — instrument a real job → checkpoints fire → map decodes → progress shown | ⛔ **NEVER TESTED, ANYWHERE** |

⇒ `PROTOCOL.md`'s *"Proven on the machine"* line is about the **wire frame**, not the feature. Nothing in the
suite ever receives and decodes a beacon; the only beacon tests assert that it fails honestly. ⛔ **Do not read
that line as evidence the mechanism worked** — and mark it on the way out so the next reader does not either.
Same narrow-proof-generalised-too-far shape as the t2599 `edge` comment claiming "faithful reproduction" of a
render nobody had called the function to observe.

⭐ **Consequence for the removal turn:** there is no "what regressed?" question and no behaviour to preserve.
This is deleting a path that never demonstrably ran, not retiring a working one.

⭐⭐ **THE REPLACEMENT ALREADY EXISTS AND IS BETTER:** Modbus live position polling —
*"the position registers TRACK LIVE during motion — progress without instrumentation"*
(`expert-m350/FINDINGS.md` §29, CONFIRMED 2026-08-26). Continuous rather than at inserted checkpoints, and
**it never touches the user's file**. A mechanism that rewrites a program which then cuts metal is a standing
hazard the poller removes entirely.

⚠ **The one trade, recorded and consciously accepted:** `MSETDATA` (master-mode push) works on ANY firmware;
the poller needs `P279 = SLAVE`, i.e. fw ≥ `2025-12-11-00`. Removing beacons therefore leaves pre-slave-mode
firmware with no progress tracking at all. Moot per the owner (it does not work anyway), but it is the reason
[[the firmware-capability gate]] below matters — an old-firmware user should be TOLD, not silently degraded.

**Related, same conversation:** a gateway notice that reads the firmware version (safely, from the `eng` dump
over SMB — works on any firmware, before any Modbus is attempted) and gates functions off ONE declared
capability table. Two gates, not one: `≥2025-12-11-00` → slave mode (DRO, machine coords, param table,
keypress); `≥2026-08-03-00` → injection (MDI, the universal variable reader). ⛔ Below `2025-12-11-00`,
`MGETDATA` does not fail politely — it **freezes the controller and needs a reboot**, so the gate BLOCKS a
known-harmful call rather than greying out a button. ⛔ No feature may test the version string itself; every
consumer reads the table (this repo has just spent an arc digging out `checkLayoutNodes` vs `hasTreeLayout` —
two hand-lists answering one question, disagreeing).

### 79. ⭐⭐ LIVE JOB TRACKING over Modbus — poll `10002`/`16062`, show run state + executing line in Studio

**[OPEN, owner-directed 2026-09-05: "we can add it to the backlogs". The controller side is PROVEN; only the
app side is missing.]**

⭐ **The substrate, confirmed on the owner's own M350 at fw `2026-09-02-00`** (FINDINGS 2026-09-05, verified
with `V22_lineno.nc` + the vendor's own polling tool):

| register | meaning |
|---|---|
| `10002` | `1` = a program is RUNNING, `0` = idle — program-level, holds through a `G04` dwell (not a motion flag) |
| ⭐ `16062` | **the line currently executing** — read `10` while line 10 ran, `0` at idle |
| `#701`/`#702` | completion counters, fire on the finish edge |

⇒ **This is the beacon replacement (#78) fully realised**: start edge, live line number, finish edge — with
**no file instrumentation, nothing injected, read-only FC03 polls**. It also answers the owner's months-old
vendor question ("does it allow to know what line number a running program is at? for tracking") — yes, on
current firmware, proven at the machine.

**The build (app side, all of it ours):** the gateway polls both registers over the existing serial link
(read-only; the poller machinery in `bridge/bridge-app` already has health/status discipline from t2063) and
Studio surfaces it — run/idle state, current line, and progress once the job's total line count is known
(the gateway already has the file it delivered; lines-total ÷ line-now is a percentage with no map file).

Constraints, all already on the record:
- ⚠ `16062`'s unit is **untested: file lines vs executable blocks** (FINDINGS 2026-09-05) — resolve before
  drawing a percent off it, or label the readout "line N" and sidestep the question entirely.
- ⚠ Only `0`/`1` observed on `10002`; the vendor treats any non-zero as running — treat unknown values as
  running, never as idle. Vendor question logged (feed hold? probing?).
- ⛔ **M350-only. The V4.1 has no Modbus at all** (`context/DDCS-VARIABLES.md`) — this feature gates on the
  #78 capability table, and a V4.1 profile simply never shows it.
- ⛔ Read-only polls only. This feature never writes a register; it shares a serial line with a channel that
  CAN write, and the #78 gate + `live-cnc` safety rules stay in force.
- ⭐ Poll cadence: the vendor's own tool polls `10002` continuously; the M3X bridge polls positions at 100 ms.
  Start there, measure, and never let tracking polls starve a position read.

**t2605 — `commData` (`panel:'commscreen'`), the LAST unverified panel kind, resolved: MIGRATABLE, not
blocked, and now migrated.** The container-ID mechanism this entry (#77) fixed was never in play for commscreen
— its own mount target (`userVizContainer_tree`) is already built correctly by `formWidgets.js`'s own
pre-existing standalone `feature_canvas` branch. A DIFFERENT, genuinely new defect was found instead, live:
`registerUserOp`'s own self-heal (`userOps.js:1432`) re-derives `.panel` from the template's `feature_canvas`
node's OWN `params.panel` (`panelFromStack`, `userOps.js:350-354`), overriding the `userOpFromStack` argument
entirely — a `feature_canvas` node with empty `params` silently lost the `'commscreen'` panel the instant it
registered. Every other migrated op's own `feature_canvas` node already carried this correctly (confirmed by
grep); comm was the first standalone (no adjacent `preview3d`) one in the whole arc, an isolated authoring
slip, not a second #77. Fixed, re-verified live. Full account: WORK-LOG t2605.
