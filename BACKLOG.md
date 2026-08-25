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

### 11. NOTHING CHECKS THE WORKSPACE'S DECLARED CONTROLLER AGAINST THE ONE ACTUALLY PLUGGED IN
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

### 14. TWO DEAD-CODE CLUSTERS IN THE EDITOR CHROME, found during t2155 and deliberately NOT swept
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

### 17. THE DIRTY DOT IS ON AT BOOT ON THE HUMAN'S PHONE - and a fresh browser cannot reproduce it

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

---

### 18. THE KEYBOARD DOCK IS OPEN AT BOOT ON THE HUMAN'S PHONE - mobile only, and also not reproducible

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

### 19. [SHIPPED t2269 — viewport-derived cap, no item-count limit] THE WIZARD-BAR DROPDOWN HAS NO OVERFLOW PROTECTION AT ALL

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
→ **any count above 6 means the systemic half is STILL REAL.**

### 21. `ui/pathAnchorField.js` looks up its own mount point GLOBALLY — latent, currently dormant, found t2271

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
