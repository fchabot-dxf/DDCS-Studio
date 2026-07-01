# Middle / Boss probe backlog (consolidated 2026-06-28, advisor)

The middle/boss 2nd-start thread — the WORKER'S active focus. **Through-line:** the 2nd-axis probe must START at its
2nd start ②, which must be **visible + editable**, and the boss reposition (in-axis + trans-axis) must position it
right. Items are LOW-complexity (human: "they are easy"). **One INC per loop turn; HUMAN-eyes on every visual.**
(This is the clean overview; the live working detail + dispatch markers stay in NEXT-SESSION.)

---

## ✅ Status
- **INC 1 DONE (`af83777`, advisor PASS turn 50)** — the 2D canvas shows ALL per-pass start markers (①②③④),
  numbered + draggable, via a shared `passStarts` ONE-source (both views sync, both drag paths feed it; dup loop
  removed). Tests + 376 green. ⚠ **human-eyes:** 2D start = cyan **DIAMOND**, 3D = **LOZENGE** — match-or-fine?

## ▶ Increments (sequenced)

### INC 2 — jog-move the 2nd start (3D)
The jog pendant SELECTS ② but jogging won't MOVE it → per-pass starts (p>0) aren't jog-editable.
Verify-first the jog→selected-start wiring (`gcodeViz3d` pick/jog + the pendant); make the SELECTED per-pass start
move on jog. (= the per-pass slice of the declared-start work.)

### INC 3 — AUTO traverse + the TWO toggles (the core positioning fix)
- ⊕ **CONFIRMED bug** (screenshot): boss AUTO probe-both → the 2nd-axis ② is **MIS-POSITIONED** (diagonal path to the
  wrong spot, not the predicted position). **This is the core fix.**
- **TWO KINDS of traverse, kept DISTINCT:**
  - **(1) IN-AXIS** — wall1→wall2 within an axis (the EXISTING `#19`/`#20` cross-over, `traverseOver` [middleWizard.js:77](DDCS-Studio/web/wizards/middleWizard.js#L77)).
  - **(2) TRANS-AXIS** — X→Y between axes (currently the always-jog at [:112](DDCS-Studio/web/wizards/middleWizard.js#L112) — the bug).
- The TRANS-axis traverse gets a value: **the MIDDLE gets a NEW "Diag travel" FIELD** (human, turn 50:
  "middle needs the new travel field too"), like the corner's. **DEFAULT it derived from the `#19`/`#20` cross-over**
  (valid-by-construction) but **EDITABLE** (autonomy). It feeds the **REUSED corner diagonal `MOVE` pattern**
  ([cornerWizard.js:140](DDCS-Studio/web/wizards/cornerWizard.js#L140), `travelOwn`/`travelOpp` [:63-64](DDCS-Studio/web/wizards/cornerWizard.js#L63)). Form + Blockly round-trip.
- **TWO AUTO TOGGLES — BOSS ONLY:** one for the IN-AXIS traverse (auto vs manual jog) + one for the TRANS-AXIS traverse
  (auto vs manual jog) — refines the single `approach` into PER-TRAVERSE control (the user can MIX, e.g. in-axis AUTO +
  trans-axis MANUAL). HIDE for pocket (a pocket never repositions). Form + Blockly round-trip.

### INC 4 — MANUAL simulate-to-②
The manual reposition = a move to ②. **NOT emitted** (the operator jogs on the real machine) — **SIMULATE** it (the sim
places the tool at ②); G31 is incremental → safe. Reuse the per-pass start ②.
- ⊕ **SYMPTOM:** a boss in MANUAL currently behaves like a **POCKET** (probes the CENTRE, not the OUTSIDE walls) because
  the reposition jog isn't simulated. Verify-first sim-vs-wizard: `between()` ([:83](DDCS-Studio/web/wizards/middleWizard.js#L83)) is NOT feature-type-aware,
  vs the between-axes ([:112](DDCS-Studio/web/wizards/middleWizard.js#L112)) which IS.

## ▶ Refinements (after the increments)
- **Marker COLOUR by source** — each start lozenge ①②… a DIFFERENT colour by whether its reposition is an
  AUTO-traverse or a MANUAL-jog (per the toggle) → see auto vs manual at a glance. Reuse INC 1's per-pass draw.
- **Glyph match** — 2D diamond vs 3D lozenge; human-eyes decides whether to unify.
- **Rename the "travel" label** (human, turn 50) — the corner's `travelDist` "Travel" label is not descriptive; rename
  it to something that describes the **trans-axis DIAGONAL reposition move** — suggest **"Diag travel"** (alt:
  "Diagonal step-over" / "Corner step-over"; tunable). Apply wherever the diagonal-reposition value is labelled (corner
  now; the middle if it surfaces the field).

## ❓ Open / clarify
- **"when start is outside pocket"** (human, turn 50 — incomplete) — a condition about the start being OUTSIDE the
  pocket; the thought was cut off. Get the rest before acting.

## ▶ Corner (next thread — lighter)
Corner ALREADY auto-travels between walls ([cornerWizard.js:139-140](DDCS-Studio/web/wizards/cornerWizard.js#L139) "Travel past corner…") → likely NO manual-jog
bug. So corner mostly needs the GENERAL INC 1/2 (2D starts + jog-move, which already cover it) + a sanity-check of its
existing travel + the renamed label. **Reuse the SAME diagonal-reposition concept ("travel"/"Diag travel") as
the middle** — one shared movement across both wizards.

---

## REAL-REVIEW BUGS (turn 101+, human eyeballing the LIVE render — verify the RENDER, not property tests)
- **B-START (FIXED, turn 101)** — single-axis probe started at the WCS, not ①. ROOT = a G53 end-move flipped the trace anchoring. Reverted `cbdc44d`. [[g53-move-breaks-preview-start-anchor]]
- **B-END-OFFSET — BOTH-AXIS ONLY** (human, turn 101). The tool/3D spindle ends OFFSET (not over the feature) **only when PROBE-BOTH-AXIS**; single-axis ends fine. ⇒ the end-retract re-do (the reverted `af9e574` intent) only needs the **both-axis** case, and must return-to-centre with an **INCREMENTAL G91** move, NOT a G53 (G53 re-breaks B-START — [[g53-move-breaks-preview-start-anchor]]).- **B-FLASH-2ND-AXIS — ✅ FIXED (turn 102, `b790caa`, advisor-reviewed PASS turn 103)** (human, turn 101). During the
  **2nd-axis** probe the rendered tool/spindle **FLASHED to the offset 4×** (2 walls × slow/fast). ROOT: the sub-frame
  probe-retract emit ([GcodeExecutionEngine.js:1050](DDCS-Studio/web/engine/GcodeExecutionEngine.js#L1050)) was the ONE
  `onPositionChange` site that omitted `pass`, so `setToolPosition` defaulted to `starts[0]=①`. Fix = report
  `pass: this._pass` (one line, render-only, macro byte-identical, NO G53). Verified render-level
  (`middle-2nd-axis-flash.spec.js`, reverted=fail/fixed=pass) + HUMAN-confirmed live. INDEPENDENT of B-END-OFFSET /
  B-TRANS-ANGLE (those are NOT touched, still queued).
  - **FOLLOW-UP (worker flag):** two SIBLING pass-less emits remain — `:860` (native homing move) + `:1095` (arc
    real-time play) — not on the boss-both path so out of scope this turn, but a homing-then-probe or arc-in-a-multipass
    op could glitch the same way. Small consistency fix (report `pass` at all `onPositionChange` sites). Queued.
- **B-TRANS-ANGLE — BOTH-AXIS** (human, turn 102). The trans-axis (X→Y) **reposition traverse is rendered at a FIXED 45°**, but the real move is `end-of-1st-axis-retract → ② (the second start)`. Since **② is VARIABLE** (draggable / derived from the feature + the Diag-travel field), the rendered traverse **angle must be variable too** — draw the ACTUAL vector from the 1st-axis retract-end to ②, not a hardcoded diagonal. RENDER-side (the 2D/3D trans-axis traverse vector). Shares the per-pass start data (`starts[1]`/②) with B-FLASH, but distinct: FLASH = a transient per-contact glitch; this = the STATIC traverse vector drawn at the wrong angle. Queued after B-FLASH.

## ▶ MIDDLE feature additions (human, turn 102)
- **MID-PROBE-Z-FIRST** (human, turn 102). Add a **"probe Z first" checkbox** to the middle probe — same as the
  CORNER's. PRECEDENT = [`cornerWizard.js`](DDCS-Studio/web/wizards/cornerWizard.js): `params.probeZ` (:31) → an
  optional **two-pass Z-surface probe BEFORE the XY work** (:121–130) that sets Z0, flips the hover prompt
  "OUTSIDE"→"OVER" the material (:118), and shifts the start position (`zFirst` in inferStarts :192). For middle:
  when ON, probe the top surface (two-pass Z) at the start, write the Z datum, retract, THEN run the XY
  centre-finding. **Form checkbox + Blockly round-trip** (the middle block gets a `probeZ` field —
  [[wire-blockly-roundtrip-new-features]]) + the sim shows the Z probe + Z datum first. Contained, low-risk, copy-adapt.
  - **Resolves TWO-WCS-DATUM-SPEC decision C (Z scope):** with probe-Z-first ON the middle's target WCS carries Z,
    set FIRST → the datum convergence is **Z → X → Y** (respect execution); OFF → **XY only** (Z stays at stock
    height). ⇒ target datum = XY when off, XYZ when on.
  - ⚠ Touches `middleWizard.js` → **shares the file with B-END-OFFSET** (the G91 end-retract). Sequence them on the
    SAME file to avoid a collision (NOT parallelizable against B-END-OFFSET).
  - **ARCH (human, turn 103):** probe-Z-first is NOT a new atom — it's **probe-surface** = the two-pass `probeFace`
    brick (the SAME one flagged for the shared centre-move) on Z + a Z0 write, gated by the `probeZ` checkbox.
    Composing it here (copy the corner) makes the **3rd** hand-rolled copy of the two-pass probe (corner/middle/
    centreline) → **fold this Z-probe into the shared `probeFace` brick** when the shared-centre-move refactor lands
    (see TWO-WCS-DATUM-SPEC "Substrate"). Decision: compose-now, share-later (don't refactor mid-feature).
  - **RESEQ (human, turn 105):** ship probe-Z-first NOW **as a declaration** reusing middle's OWN `twoPass('Z',…)` +
    the existing `reposition()` (NOT a corner copy); the general per-transition TRAVEL-GUI (below) comes AFTER.
- **TRAVEL-GUI — uniform per-transition travel control** (human, turn 105). Generalize probe travels: **EACH**
  transition (in-axis wall→wall · trans-axis X→Y · Z→first-wall) is independently **AUTO** (a GUI-driven travel
  distance) or **MANUAL** (a jog stop), with the **SAME granular settings**, freely **MIXABLE** (e.g. "Z→X auto,
  X→Y manual"). UNIFIES the existing scattered toggles (middle's inAxis auto/manual + `#19/#20` cross-over, transAxis
  auto/manual + Diag `#21`) into ONE uniform per-transition model + GUI. **Two meanings of "pass"** (resolves the
  worker's gate): the SIM re-anchors per probe-START (Z ≠ X ≠ Y, always — the ①②③ markers); AUTO/MANUAL only decides
  whether the OPERATOR stops (auto = one hands-free run = "both in one pass"; manual = a jog stop = a break) — so the
  toggle is ORTHOGONAL to the sim anchors. Comes AFTER probe-Z-first; upgrades all declared travels into GUI-driven
  ones. Form + Blockly round-trip. Promote to ROADMAP.
  - ⊕ **THE CRUX (human, turn 117 — eyeballing middle with Z-first + both-axis ON). Middle covers BOTH auto AND manual ×
    BOTH in-axis AND trans-axis — that wizard is the test.** Three things:
    1. **START POS = the source; TRAVEL = DERIVED.** You DRAG the start handle; the travel (diag, in-axis cross-over) is
       COMPUTED from where the start lands — you never type it. ⇒ the editable **DIAG TRAVEL field is OBSOLETE**: "you
       wouldn't enter a value there, it's dependent on the next start pos, not a distance — and changing it would move the
       start, which you don't want." Remove the field; the start handle sets it; the **block STORES the value** (the
       spatial-GUI pattern [[spatial-gui-form-vs-canvas]] — drag the canvas, plain number on the block, no form field).
       This is the unification: reach = travel = start (one source, the markers/handles are its views; the standalone
       "edge reach→start" folds in HERE).
    2. **Start markers are CONFIG-DRIVEN — they must reflect the ACTUAL pass list.** With **Z-first ON + both-axis ON**
       there are MORE passes than the viz currently draws → there should be a **4th and 5th** start handle (Z-first adds the
       Z start; both-axis adds the perpendicular-axis start(s)). The handles enumerate from the real config, not a fixed set.
    3. **BUG (same screenshot):** the **diag travel is LOCKED** — moving the GUI handle doesn't update it (field shows 8,
       effective ~24, handle does nothing) → the handle / field / value are disconnected. Making the START the one source
       (1) fixes this by construction. Related to **B-TRANS-ANGLE** (the trans-axis vector rendered at a fixed angle, not
       tracking ②) — same trans-axis/start sync cluster.
- **PROBE-SURFACE SNIPPET** (human, turn 105). "Probe surface" = a **Snippet** in the learner library's **Probing**
  category ([data/learnerLibrary.js](DDCS-Studio/web/data/learnerLibrary.js) `SNIPPETS`), decomposed into its ~4 atoms
  as a `{type,params}` stack: **`probe` → `probecheck` → `move`(retract) → `proberead`/`assign`(save)** — matches the
  Snippets size (2–5 atoms) + the existing `z-touch` shape (which is `probe → proberead`). **This is the north-star HOME
  for the shared "probe surface" brick** — it UNIFIES the #5 shared-`probeFace` consolidation with the Snippets infra
  the human ALREADY built: ONE definition (a Snippet) that the Blocks tab drags in AND (end-state) the wizards
  (middle/corner/centreline) compose from, replacing their hand-rolled `twoPass`. A two-pass variant ("probe surface —
  fast+slow") = a sibling snippet (wizards probe twice for accuracy). ⇒ **Reframes batch #5**: the shared brick IS a
  learner-library Snippet, not a bespoke mechanism. Promote to ROADMAP (wizards-as-data / learner library).

## ▶ PROBE-VIZ refinements (human eyeballing the t116 comp fix, turn 117)
- **DISC ON THE CALCULATED SURFACE** (folded into 3c). The contact disc must sit where the macro **calculates** the
  surface, not at the raw tool-centre. Edge/corner compute a compensated wall (`#50 / #101/#102 = #1925 ± #6`) → the disc
  snaps ONTO the wall/edge (render shift by the stylus radius toward the wall; collision/WCS math untouched). **MIDDLE is
  the EXCEPTION** — it bisects raw tool-centre contacts and never computes a per-wall surface → its wall discs stay at the
  raw contact (middle's result is the CENTRE, shown by the crosshair). So the disc mirrors what the macro computes:
  compensated surface where it exists, raw contact where it doesn't. Declare-aligned. *(Edge single-axis: with the disc on
  the edge, the disc IS the visible "WCS is here" — no separate single-axis datum needed; the red crosshair stays for the
  2-axis corner/centre datum.)*
- **EDGE wizard — DROP the "reach" handle, ADD a START-POSITION handle** (human, turn 117). The edge 2D viz shows a `reach`
  (max-probe-distance) handle — DROP it. Instead add a draggable **START-POS** handle (the probe's ① start — "touching or
  just clear of the edge", per the wizard text), consistent with the per-pass start-marker work (INC 1/2). *(Also resolved
  the `MAX PROBE 82.579` vs viz `reach 100` mismatch — moot once reach is dropped.)* Separate from 3c; edge-wizard GUI.
- **3c (datum visual) — ASSEMBLED** (human, turn 117): (1) datum → RED CROSSHAIR (replaces the yellow sphere `0xffce3a`;
  2-axis plane + depth); (2) DISC on the calculated surface (all probes except middle — above); (3) the crosshair PERSISTS
  LONGER than the yellow; (4) a **2-SECOND idle before the loop restarts, in ALL sims** (so the final datum is visible
  before looping). ✅ CORNER datum confirmed correct by human eyes (t117) — the comp fix is validated.

## ⚠ PRE-EXISTING BUG (surfaced by a DDCS check, t130 — NOT a refactor regression; deferred per human "keep burning the refactor")
**Rotary active-WCS write emits the literal `active`:** with `wcs='active'` the rotary-center emit ends with
`#[805+[active-1]*5+1]=#54` / `#[805+[active-1]*5+2]=#56` → DDCS check: "unrecognized word 'active' outside of a comment".
The `active` should resolve to `#578` (the active-WCS index var). ROOT: the rotary's WCS-write path doesn't resolve
`'active'→#578` like middle/edge/corner do (`#71=#578 → #70=[805+[#72*5]] → #[#70+off]`). PRE-EXISTING (the probe-surface
migration only touched the probe *touches*, not the WCS write). Fix later — align the rotary's active-WCS write with the
other wizards' `#578` resolution (or route it through the same `#70` base-address pattern). Real bug (invalid G-code for a
rotary active-WCS probe), just not the refactor's.

## ▶ PROBE-SURFACE CONSOLIDATION (CONFIRMED human, turn 117 — the real fix behind the comp gaps)
**Why:** each wizard hand-rolls its OWN probe primitive (middle `twoPass`, corner own, rotary `pp`) → no shared brick → the
stylus-radius comp had to be added **per-branch** (diameter ∓2r, Z −r, corner ±#6, rotary Zc) and a branch was **MISSED**
(rotary OD-top datum `#50` + 3-pt-fit R `#55`). The snippet shipped (`1576fee`) is **data-only** (a learner-library drag-in);
the WIZARDS never migrated to compose from it ("migration is #6"). So the gap = a **missing declaration**, not a rotary bug.
⇒ **STOP patching — do NOT fix the rotary OD-top; the brick erases the whole class** (human, t117: "why patch what we'll erase").
**The design (human, t117 — "bundle"):**
- **`radius-comp` ATOM** — fields: **tip radius** (`#6` / a `#110` ref) + **comp ENABLE** (toggle; off for a flat/disc probe,
  or raw-vs-comp compare). Emits `#result = #raw ± #radius` along the probe direction when enabled. The **same atom a future
  TOOL/cutter comp leans on** (concept shared — centre→edge by the radius; the path-normal shape is rule-of-three, don't build
  that engine now).
- **`probe-surface` BRICK** — `probe → check → retract → read → [radius-comp]`. **BUNDLES the comp atom (enable defaults ON)**
  so it is ALWAYS present → no branch can omit it → **no gap**. Returns the **TRUE surface**.
- Returning the true surface makes the downstream math CLEAN: diameter = `|s1−s2|` (the `∓2r` **deletes**), Z-surface = `s`
  (the `−r` **deletes**), centre = bisect of true surfaces, rotary OD-top = the surface. **The per-branch comps in `84f4efd`
  dissolve** (keep them until the brick lands — live correctness in the interim).
- **Migrate** middle / corner / rotary / edge onto the brick, **equivalence-verified per wizard** (emitted G-code byte-identical
  or behaviour-preserved — it's real-machine code).
**Sequencing (t117):** the brick is FOUNDATIONAL → do it **BEFORE item 4** (travel/start also touches the probes), **AFTER 3c**.
The `1576fee` snippet becomes the thing the wizards actually compose from (closes the deferred "migration is #6").

## ▶ SIM-SNIPPET CATEGORY (human, turn 111 — promote to ROADMAP)
Keep EMIT snippets **emit-only**; add a SEPARATE **Sim category of snippet** for sim DECLARATIONS (per-pass starts,
datum). Keeps the two layers SEPARATE (the user's consistency rule) AND keeps authoring uniform (everything composes
as a snippet). Lands on existing substrate: `def.sim.starts` (B1/B3) already makes sim a DECLARATION (data) — the Sim
category just surfaces those as drag-in compositions, like the Probing category does for emit stacks. **NEW — doesn't
exist yet** (today the sim layer is `opSimStarts` / `def.sim`, not a drag-in category); the *direction*, not assumed.
Worked shape: "centre" = an EMIT snippet (probe → bisect); "centre datum" = a SIM snippet (starts + datum-at-centre);
they connect by the shared `#53/#56` value. ⇒ resolves the "snippet can't carry sim atoms" tension — sim gets its own
category, not mixed in. [[declare-or-handroll-before-dispatch]]

## ▶ TOUCH-OFF clarified + TOOLS menu (human, turn 107 — promote to ROADMAP)
TWO distinct touch-offs — "both need to exist," and one already does:
- **TOOL touch-off (tool LENGTH)** = touch a tool on the fixed setter → save the tool-table length offset. **ALREADY
  EXISTS** = [`atc_length`](DDCS-Studio/web/wizards/atcLengthWizard.js) ("Tool Length Setter", group `atc`). No new work.
- **SURFACE touch-off (work Z0)** = touch the work surface / a touch plate → set the WORK coord Z0 (− plate
  thickness). **GAP.** → **a Snippet AND/OR a Complete Program in the Blocks tab** (human, turn 107: "def their
  snippet or full program, dunno if they warrant a wizard yet"), composing the `probe surface` Snippet(Z) + plate
  thickness + the Z0 write. Optional: a touch-plate DIGITAL input (`waitInput`/M66) vs the probe port (G31). **A full
  WIZARD is DEFERRED** — graduate to one later only if the snippet/program proves it needs one. Sets the WORK offset
  (not the tool). Follow-on to the `probe surface` snippet (#2).
- **z-touch snippet = DROP** (redundant — `probe surface` + the new wizard cover it; z-touch never even set an offset).
- **RENAME the ATC dropdown → "Tools"** (human) — the group is ALREADY 4/5 "Tool X" (Length/Check/Change/Table);
  "ATC" is too narrow, and users author tool macros beyond ATC. Small UI change — a group-label override
  (`setGroupOverride` already exists in `wizardLibrary.js`).

## ▶ GENERAL sim-playback UX (surfaced in the middle thread — **promote to ROADMAP**, not middle-specific)
- **EXEC-LINE-VISIBILITY** (human, turn 102, screenshot). During sim playback the currently-EXECUTED G-code line is
  highlighted in the editor/preview, but it's **hard to follow** — make it **more visible** and/or **persist a bit
  LONGER**. The highlight is a SINGLE active line that moves + clears immediately: [`editorManager.setActiveLine`](DDCS-Studio/web/ui/editorManager.js#L219)
  / `clearActiveLine` (the `#editor-highlight .g-line[data-line-index]` overlay), driven per-frame by
  [`gcodePreviewTab.js:87`](DDCS-Studio/web/ui/gcodePreviewTab.js#L87). Options (S): a **fade-out trail of the last N
  executed lines** (decreasing opacity — mirrors the 3D `_trailLine` bold-trail idea), a **bolder active-line style**,
  and/or a **short dwell** before it clears. Pairs with the 3D executed-route trail (`gcodeViz3d._trailLine`/`_dimRoute`).
  Pure UX, all ops. NOT in the current dispatch — queued.
- **MOBILE-3D-PUSH** (human, turn 103). On mobile **PORTRAIT** the 3D preview (`.viz3d-drawer`) is a bottom-sheet —
  `position:absolute; bottom:0; height:var(--viz3d-size)` inside `.editor-container` (`position:relative;
  overflow:hidden`), sliding up via `translateY` (styles.css [:4102](DDCS-Studio/web/styles.css#L4102) base,
  [:4463](DDCS-Studio/web/styles.css#L4463) portrait) — so it **OVERLAYS / COVERS** the bottom `--viz3d-size` of the
  editor; `.editor-layer` (`height:100%`, :864) never shrinks. WANTED: when the drawer is OPEN the editor area
  shrinks so its content is **PUSHED UP** above the drawer (both visible). FIX (CSS-only, portrait): when
  `.editor-container:has(.viz3d-drawer.open)` set `.editor-layer { height: calc(100% - var(--viz3d-size,50%)); }`
  (the `:has()` pattern already exists at :640). WATCH: the `.editor-statusbar` (absolute bottom:0), the
  keyboard-active state (:4029 sets the drawer `bottom:var(--kbd-clear)`), and keep **LANDSCAPE** (side drawer)
  unchanged. styles.css only → DISJOINT from the whole batch. **Being parallel-built (advisor, turn 103).** Promote to ROADMAP (general mobile UX).
- **HEAD-VIS-REFRESH** (human, turn 113, screenshot). Toggling head-part visibility (Settings → **SPINDLE/HEAD (SIM
  VIEW)** → `Show: ☐Spindle ☐Collet ☑Tool`) does **NOT** refresh an already-open 3D preview — the canvas only picks it
  up on a full preview **reload**. WANT: the toggle **auto-refreshes** the open canvas. Read: the preview **snapshots**
  the visibility setting at build/reload instead of **subscribing** to it (declare-not-infer / one-source — the setting
  is the source, the preview should react). FIX: on the `Show` toggle change, signal the live viz to re-read head-part
  visibility + redraw (no full reload). ⊕ **GENERAL** — likely the SAME staleness for the other SIM-VIEW settings that
  feed the preview (3D-probe sizes, head dims, grid spacing, rapid-moves toggle): fix the head toggle now, but consider a
  **settings→preview live-refresh seam** so every SIM-VIEW setting reacts. Pure UX / friendliness; verify the real
  symptom (toggle → open canvas updates, no reload). Queued.

