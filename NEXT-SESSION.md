# NEXT SESSION — handoff

**Current state (2026-06-25):** **V10.36 shipped** — web is live via GitHub Pages; the desktop exe + `v10.36` tag
are built/published by `desktop-release.yml`. On `main`, in sync with `origin`. The wizard-maker is built
end-to-end (fork an op → expose values as widget knobs → reuse the built-in wizard panel → edit from Studio →
save/re-author). The region editor, selection model, and coordinate-list positioner are banked in V10.36.

**The backlog lives in one place now:** [`ROADMAP.md`](ROADMAP.md) — the code-verified canonical roadmap
(NEAR / MID / STRATEGIC + non-wizard + gaps + parked). This handoff is only *"where we are + the next task."*
The old planning docs (`NEXT-TASKS`, the vision, `CRAZY-IDEAS`, `FUSION-INTEGRATION`, `docs/*`) were archived to
[`docs/archive/`](docs/archive/) and folded into ROADMAP.md — that sprawl is exactly why they went stale.

## ⚑ Reframe worth carrying
The "wizards-as-data engine" the vision treated as future is mostly **already built**: expressions (`expr.js`),
loops/control (`count`/`iff`/`array`/`flow`), and raw-emit atoms (`macro.js`) all ship. What remains is **Stages 4–6**
— express ONE built-in *as data* + assert output-equivalence → port the rest → self-host. See ROADMAP "Key reframe."

## ▶ Immediate next task — finish the spatial-GUI feature (the PRODUCER half)
**"2D point (numbers)" authoring path** `[M]` — complete custom-op preview drag-to-edit. **Context (the big
spatial-GUI thread, session 2):** decided + recorded in [[spatial-gui-form-vs-canvas]] + ROADMAP "GUI over fields" —
spatial input belongs on the **interactive preview canvas** (drag a feature → params, value as plain numbers on the
block), NOT a mini-canvas in a form row; discrete picks (datum/zone) stay as small form/block-field dual-render. Key
realisation: a wizard's **output = template + params**; the GUI is a **swappable layer of input blocks** over those
params — so the same output can be built with different GUI blocks (one source of truth). MID #3 (region poly tool)
**parked** as low-leverage (authoring modal, not the operator loop). drill ALREADY does full canvas write-back
(`drillView.buildDrillSpec` — handles + `onDrag`, the proven template); the gap is custom ops.
- ✅ **CONSUMER seam SHIPPED (`8b268c6`, tested, suite green, drill untouched):** `layoutSpecFromOp`
  (`wizards/ops/panelTypes.js`) now derives draggable point/rect handles from the grouped `x/y(/w/h)` param-block roles
  it already read to DRAW, + an `onDrag` that writes the bound number FIELDS (`formWidgets` number/slider now tag
  `data-param`; fires `'input'` → `userOpView.update()` redraws). Guarded to WRITABLE fields only (no dead handle over
  a canvas-widget param). Test: `custom-op-canvas-handles.spec`.
- 🛑 **INERT until the PRODUCER lands** (verify-real-symptom catch): the authoring couples "role" with the
  `xy-pad`/`rect` FORM-canvas widget — `CANVAS_DECODE` (`blocks/userOps.js:54`) has `'xy-x'→['xy-pad','x']`, **no
  `number+role`** — so a role-tagged param renders as the form mini-canvas (which the writability guard skips); the
  handle NEVER fires for a real authored op. **Build:** (1) add decode entries `point-x→[number,x]` /
  `point-y→[number,y]` (+rect) to `CANVAS_DECODE`/`CANVAS_ROLE_WIDGETS`; (2) **the fiddly bit** — render a number-role
  GROUP as PAIRED `data-param` number fields, NOT a multi-param canvas widget (`groupCanvasBindings` /
  `renderOpForm`'s grouping currently assumes a role-group IS a canvas widget). Then an author tags x/y as "2D point
  (numbers)" + Form+2D panel → the big preview is drag-to-edit. **VERIFY END-TO-END** (a real authored custom op's
  preview drags + writes the form), not just the unit seam. (Stages 2–3 = preset patterns + parametric-handle presets
  extracted from drill — ROADMAP STRATEGIC #8.)

*(Parked: MID #3 region poly tool — low-leverage, see ROADMAP. The false-glow + hover work is archived below.)*

## 🗄️ Session-2 diagnosis archive (false-glow → declare-edit; SHIPPED `2789c37`, kept for reference)
**Middle false-glow bug — ✅ SHIPPED (`2789c37`, declare-edit B).** The glow/chip/merge-guard now read the user's
DECLARED edits (`opEdits.js`, recorded on the Blockly change event) instead of inferring editedness by re-derivation,
so the round-trip's representation drift can never read as a false edit. Recorder + `blocksApp` listener hook + 4
`opGlow` surfaces rewritten + `.mjson` persistence (a saved block-edit fires no reload event, so it must ride with the
program); word-level glow localizes by the old→new emit diff (no sentinel collision); ~134 lines of inference removed.
**SUPERSEDES MID #1** — the reconciler "surfaced edits are silently reconstructable → not edited" optimisation is gone
(it WAS the inference); a surfaced block-edit now correctly trips the chip (a form Replace would lose it without the
reconciler). Deleted `op-edited-reconcile.spec`; consumer specs now declare their model-injected edits. Full suite
green. **Residuals (follow-ups, NOT blockers):** (a) a pure DELETION isn't flagged (its atom id is gone — documented
in `opEdits.js`; revisit if a delete-then-Replace clobber surfaces); (b) the BENIGN emit drift itself (`G0 X#9` →
`Y0 Z0`, a no-op in incremental but latent for abs-mode single-axis moves) is unfixed — the `omitEmpty` faithful-move
fix (empty axis sockets stay unset, distinguished from a deliberate 0 via empty vs shadow) is the clean fix if wanted;
(c) the `m_both↔twoAxis` reconciler key-mismatch (reverse-sync, not the glow) still drops a real `twoAxis` form edit.
*(Original diagnosis kept below for reference.)*

**0. (superseded scoping — kept for reference)** — **FULLY DIAGNOSED + SCOPED (2026-06-26, session 2, repro'd empirically).**
- **Root = blocks round-trip is NOT representation-faithful** (the `m_both↔twoAxis` hypothesis was a RED HERRING — the
  glow hits EVERY middle config incl. single-axis, and `twoAxis` survives). `stackToWorkspace→workspaceToStack`
  NORMALIZES atom params in ≥2 ways that the clean `BUILDERS` rebuild doesn't, so the diff-based glow fires:
  - **(i) absent move axes → `0`** — `middleStack` builds `MV(ax,v)` = `{mode:'rapid', x:'#9'}` (sparse); `recToJson`
    fills the move block's empty Y/Z `value` sockets with `math_number` shadow `0`, `toRecord` reads `0` back → `G0 X#9`
    becomes **`G0 X#9 Y0 Z0`**. This one CHANGES THE EMIT (6 lines on single-axis). **Harm: BENIGN for middle** — the
    moves are after `DM('inc')` (`middleWizard.js:95`), so `Y0 Z0` = incremental no-op. Would be harmful only for a
    single-axis move in G90 **absolute** mode (latent risk for other ops).
  - **(ii) `#var` string → `variable` record** — a param like `to:'#8'` round-trips to `{type:'variable',params:…}`
    (intended #var-survival, `recToJson:206` / `toRecord:94`). Emit-EQUIVALENT but the param representation differs →
    also feeds the glow. Affects ANY op with `#var` atom params, not just middle.
  - ⇒ Making the round-trip byte-identical to the rebuild is **whack-a-mole** (0-axes, #var-records, likely more).
- **Fix fork (both real, both have costs):**
  - **(A) faithful round-trip** — only PARTIAL for the glow (fixes (i) not (ii)); and (i)'s clean fix has a tradeoff:
    a `math_number` shadow can't express "axis absent" (empty socket inline-edits as `0`, and `0` is a valid abs move).
    The clean form = move def opts into **`omitEmpty`**: `recToJson` leaves an absent optional `value` field's socket
    EMPTY (no shadow); `toRecord` OMITS an empty optional socket (no default) — this DISTINGUISHES absent (empty
    socket) from a deliberate `0` (shadow 0). Cost: unset axes show empty (draggable) sockets, not inline `0`. **This
    is a worthwhile EMIT-faithfulness fix on its own (stops `Y0 Z0`), but it does NOT fix the glow alone (ii remains).**
  - **(B) declare-edit refactor (user's call) — the right glow fix.** Glow = what the user ACTUALLY edited, not a
    representation diff, so ANY round-trip normalization is invisible. **No existing infra** — `777490a` is DOCS-ONLY;
    `saveStates.js` is full-program undo snapshots, NOT a per-op delta recorder. **Key design insight (the cheap path):
    diff the op's live children against a baseline that has been THROUGH THE SAME ROUND-TRIP** (e.g. capture the op's
    children right after insert + first reproject, persist it on the op) — the drift is then identical on both sides and
    CANCELS, leaving only real edits. (Alt: an `edited` flag set on a Blockly change within the op's subtree handles the
    WHETHER for the chip/merge-guard; the three glow surfaces' WHERE still needs the delta.) Rewire
    `isOpBlockEdited`/`editedLinesForOp`/`editedRangesForOp` (`opGlow.js`) onto it; `replayReconcile` then becomes
    secondary. ⚠️ This refactors the EDIT PIPELINE — the area that just had a live regression (`039244d`); do it as a
    focused effort, test-first (the repro: a no-edit round-trip must NOT glow; a real edit MUST), not half-landed.
- **Separate latent bug (not symptom a):** the `m_both`→`both` strip vs `middleStack`'s `params.twoAxis` (`opSession.js:184`
  / `middleWizard.js:28`) would drop a genuine `twoAxis` BLOCK edit on round-trip. Worth a one-line align regardless.

▸ **B build status (session 2 — STARTED, parked at a real design catch; user chose B emphatically):**
  - **Built (parked WIP, uncommitted):** `web/blocks/opEdits.js` — the per-op declared-edit recorder (`recordEdit`/`opEditMap`,
    keyed `opId → Map<atomId, {paramKey,from,to}>`); `tests/op-declared-edits.spec.js` — the two-direction regression
    (no-edit middle round-trip ⇒ NOT edited; a real `setFieldValue` ⇒ edited + glows). **Designed but NOT wired:** the
    `blocksApp` listener hook (record on `!e.isUiEvent && !muteChanges`, reuse `resolveHoverTarget` to map the changed
    block → its model atom + paramKey; the drift fires during MUTED reloads so it's never recorded) + the 4 `opGlow`
    surface rewrites (`isOpBlockEdited`/`editedLinesForOp`/`editedRangesForOp`/`opEditSummary` read `opEditMap`, counting
    only edits whose atom STILL EXISTS in `op.children` — so a Replace's fresh atom-ids auto-clear stale records; the
    leaf-id fix `dc581b3` keeps ids stable across the round-trip so a real edit survives it).
  - 🛑 **THE CATCH (must resolve before cutover):** pure declare-edit (live change events) **can't see a block-edit in a
    LOADED program** — `.mjson` saves the FULL stack incl. edits (`programFile.js:17`) and `ddcsLoadBlockStack` restores
    it with NO event firing. So a Replace after reload would clobber loaded block-edits, AND the 3 consumer specs that
    inject via the model (`op-edited-reconcile`, `op-header-edit-merge`, `informed-merge-notice` — all do
    `op.children=[…,{type:'raw'}]; ddcsLoadBlockStack`) would read un-edited. Inference-on-load doesn't save us either
    (it false-glows on the same drift). ⇒ **B MUST persist the declared-edit record**: serialize `opEdits` into
    `serializeProject` + restore in `loadProject` (atom-ids match — the stack is saved/loaded WITH ids). Then update the
    3 consumer specs to ALSO declare their injection (or drive it via a live gesture). Net B scope = recorder + listener
    hook + 4 surfaces + **file-format persistence** + consumer-test updates — a focused effort, not a one-sitting tail.

## ✅ Shipped 2026-06-26 (session 2)
- **Middle false-glow → declare-edit** (`2789c37`) — chip/glow/merge-guard read the user's DECLARED block edits
  (`opEdits.js`, recorded on the Blockly change event), not a re-derivation diff — so a blocks round-trip's
  representation drift can never read as a false edit. Recorder + listener hook + 4 `opGlow` surfaces + `.mjson`
  persistence; word-level glow by old→new emit diff; ~134 lines of inference removed. SUPERSEDES MID #1. Residuals:
  deletions unflagged (v1 gap); benign `Y0 Z0` emit drift unfixed (`omitEmpty` fix if wanted); `m_both↔twoAxis`
  reverse-sync mismatch open. *(Full diagnosis in the Session-2 archive above.)*
- **Hover/select → projected-code highlight** (`dc581b3` + `e309963`) — the learner feature, both granularities (user
  asked for "both"): **block hover** → its emitted lines glow lighter than selection (`.warm`, no scroll, innermost
  block via Blockly's `data-id`); **value-field hover** → the exact emitted token boxed (`.thot`) via
  `opGlow.valueTokenRanges` (perturb the socket to a sentinel, diff the re-emit — declared, no regex); **select a leaf**
  → all its value tokens boxed (`valueRangesForSubtree`, leaf-scoped — a container shows lines only, kept cheap +
  uncluttered). All from the ONE emit map (no second map). Overlays re-applied after each render (`renderCode` rebuilds
  the spans). Tests `blocks-hover.spec` (incl. innermost-resolution + mouseleave + value-token + select-to-token, all
  stress-stable) + `value-token-ranges.spec` (exact span via a non-circular splice-reconstruct + `[]`-guards). Built
  understand→implement→review across two ultracode workflows; the review's "critical `diffRange` inversion" was a
  false positive (verified — `s < max-p` precludes inversion). *DEFERRED:* value-token highlight for **container**
  selections (perf + clutter — currently leaf-scoped).
- **🐞 Pre-existing root-cause fix surfaced by the above** (`dc581b3`) — `recToJson` preserved `id: rec.id` for **op**
  blocks but **not leaf atoms**, so a stack→workspace load gave leaves fresh random Blockly ids → the panel's per-line
  ancestry (model ids) didn't match the workspace (random ids) until an async reproject realigned them. That broke
  **click-selection AND hover** on first open (a brief, self-healing transient). One-line fix (carry the leaf id);
  fixes selection too.

## ✅ Shipped 2026-06-26
- **🔴→✅ Blocks tab regression — was DEAD on a non-empty program** (`039244d`, live showstopper on `pages.dev`).
  `showBlocks()` (module scope) called `renderFromModel()`, a `buildWorkspace()` closure-local → `ReferenceError` on
  `getStack().length > 0`, swallowed by the try/catch, so the Blocks tab opened blank with any accumulated program.
  A 3-agent audit (ultracode) confirmed it's the **ONLY** such leak (no churn siblings) and caught a bug-amplifier:
  even in-scope, `renderFromModel()` was called with **no projection arg** → `renderViews(undefined)` →
  `undefined.lines`. Fix: route line 98 through **`api.refresh()`** (= `renderFromModel(getProjection())` +
  `panel.setActive`) — reachable at module scope AND supplies the projection. Test-first
  `tests/blocks-open-seeded.spec.js` (seed an insert → open Blocks → no swallowed error + program renders) — the
  exact gap the 284-green suite had (nothing exercised `showBlocks()` on a non-empty program;
  [[verify-core-flow-before-features]]). Suite 287 green. *(Minor still-open: the `Pixelated Arial` web-font fails
  OTS `cmap` decode — corrupt font asset, cosmetic.)*
- **Informed Merge/Replace modal (FORM path)** (`6f7e8fc`). The form's block-edit notice now SHOWS what a Replace
  would discard instead of a blind 3-way choice — `opGlow.opEditSummary(opId)` reuses the **same MID #1 diff**
  (`collectEdits(replayReconcile baseline, op.children)` + `emitMapped`) to render the block-only residue (injected
  lines `+`, value overrides old→new) above the buttons; `showBlockEditNotice(label, summary)` renders it (backward-
  compatible), `wizardManager.insert()` passes it. FORM only — Blocks stays silent-merge (#3). Test-first on the real
  rendered output (`tests/informed-merge-notice.spec.js`). Suite 286 green. *(Optional follow-on: a 3rd "merged
  result" preview pane.)*
- **MID #1 — One diff at 3 surfaces** (`5d348af`). `isOpBlockEdited` now means exactly "would a form Replace lose
  something?" `opSession.replayReconcile(opId)` replays the DECLARED Replace path (reconcile live blocks → params →
  `BUILDERS`), sourcing untouched form-only values (toolØ, wallOffset) from the op's **STORED params, not the DOM** —
  faithful **wizard-closed** (where the chip + Blocks-guard run); memoized by op-object identity. All three surfaces
  (`isOpBlockEdited` + `editedLinesForOp` + `editedRangesForOp`) diff against that one baseline, fail-safe to the
  stored-params rebuild where an op has no reconciler. A SURFACED edit no longer trips chip/notice/glow; an
  injection/unrepresentable residue still does. Built **test-first, wizard-CLOSED** (`tests/op-edited-reconcile.spec.js`),
  incl. a non-default-toolØ case that *forces* stored-state sourcing. Approach A held; the cycle worry
  (`opGlow→opSession→opBuilders→opGlow`) was a false alarm (`opBuilders` only *mentions* opGlow in a comment).
  `editorOpHover.js` needed no change — it consumes the re-based glow. Suite 284 green (macros-tabs known-stale).
  - 🐞 **OPEN BUG + APPROACH CORRECTION (user-reported 2026-06-26, MID #1 follow-up).** On a **middle probe** op the
    user saw: (a) **probe lines glow as edited though never touched**, and (b) **a block edit didn't survive
    round-trip**. Investigation (partial, stopped at user request — NOT fully proven):
    • `replayReconcile` rebuilds from `_builderAtoms(opType, { ...op.params, ...overrides })` where `overrides` =
      the reconciler's recovered fields with the prefix stripped (`m_axis`→`axis`). So a false glow on an UNTOUCHED
      op can only be a **recovered field that DISAGREES with the stored param** (a mis-fire), NOT a "lost field" —
      un-recovered fields correctly come from `op.params`. (Corrects my earlier "partial-rebuild smear" guess.)
    • **Confirmed candidate:** the `middle` reconciler emits `m_both`, stripped to **`both`**, but `middleStack`
      reads **`params.twoAxis`** (`middleWizard.js:28`) — so the override key doesn't match the builder param: the
      recovered value is silently dropped (→ a `twoAxis` block-edit is LOST on round-trip = symptom b) and is a
      no-op for the rebuild. `m_circular`→`circular` DOES match (`middleWizard.js:29`). Which recovered field
      actually drives the probe-line glow (symptom a) was NOT pinned before stopping — verify before fixing.
    • **APPROACH CORRECTION (user's key point):** a manual edit is a **one-time, specific** event, but MID #1
      *detects* edits by re-running the WHOLE reconciler + rebuilding the WHOLE stack + diffing — through a reconciler
      that's partial AND partly inferential. So one mis-recovered/un-recoverable field **smears glow across lines the
      user never touched** and **drops edits** the reconciler can't represent. The cleaner model: **RECORD the edit
      as a one-time declaration when it happens** (Blockly fires the change event; transactional-snapshot machinery
      exists, `777490a`) → glow = exactly the recorded deltas (no smear), round-trip carries them (no drop). I.e.
      *declare* the edit instead of *inferring* it by full-stack re-derivation. Tradeoff: re-derivation is stateless
      but needs a faithful reconciler (the failing assumption); edit-recording is precise but must catch every
      mutation path. Reconcilers ARE (disciplined, closed-world) inference — editable blocks force it — and that's
      exactly where this bites.
- **Dev-mode panel → Save dialog** (`eb70de2`). The lingering authoring panel is gone; Dev mode shows just the
  per-field "expose" affordances + a "Save wizard…" button, and name/panel-type/preview-rig are collected in a
  dismissable Save dialog at save time (stale-model guard preserved: bindings frozen from the live workspace before
  the dialog awaits).
- **Honest flat category taxonomy + Wizard UI group** (`2c6743a`). Retired the hidden `RECAT` remap (each `ops/*.js`
  declares its real category); Ops→Toolpaths, Modify→Transforms, Cutting→Spindle & Feed; the authoring blocks
  (param/region-pick/coord-list/panel/preview-rig) gathered into a new **Wizard UI** category.

*▶ **UX DIRECTION (queue → ROADMAP) — ONE Blocks mode: authoring always present, chrome subordinate. DISSOLVE the
normal/dev split entirely** (NOT "default to dev" — there's no other mode to fall back to; both the "normal" and
"dev" labels + the toggle go away, leaving just "the Blocks tab" with authoring built in. **Blocks tab ONLY** —
operators stay in the **wizards** with their clean form UI unchanged).
Rationale (user, 2026-06-26): the Blocks tab is inherently an **author + learner** surface — operators live in the
**wizards** and may never open it, so the "don't overwhelm casual users" concern doesn't apply here. Authors and
learners both need to **read the whole macro at a glance** (it's the thing raw G-code does right), so **nothing is
hidden on selection** — values + structure always visible (NOT collapse-by-default; NOT show-on-select — that was
considered and rejected as a glanceability "trap"). This supersedes the old "normal mode lets users acclimate"
reasoning. The ONLY refinement: the authoring chrome (widget-type dropdowns, expose markers) should be **visually
light / subordinate** so the code stays the thing your eye lands on — present but quiet, not competing with the
values. **What survives:** the authoring capability (expose value → knob, save-as-wizard, widget pick), always on;
glanceability, preserved by styling not a toggle. **What goes:** the toggle, the two-state split, both mode names.
**Bonus:** a simplification — one render path instead of two conditional states to keep in sync (single-source,
applied to UI).*

*(NEAR #3 — app-wide Merge/Replace/Cancel — was initially **resolved-by-analysis** (a docs-only commit, `9e37ed7`);
counter-verification refuted that: `appendIntoProgram` IS append-only (Leg 1 ✓) but the guard was NOT centralised —
a real unguarded `replaceOp` lived at `blocksApp.js:373` (header-field edits on typed op blocks), which post-dated
the notice (`4e5ce98`) and was never retrofitted. **Fix now in tree**: the listener checks `isOpBlockEdited`
(imported L18 → guard is live) and routes to `mergeOpBlocks` instead of `replaceOp`. **Verified by code-read
(2026-06-25)** — both `replaceOp` callers safe from silent clobber. Before marking DONE: (1) this path
**auto-merges SILENTLY** — no 3-way prompt like the wizard `insert()` path. **CONFIRMED INTENTIONAL (user,
2026-06-25):** Blocks is the granular surface, so a coarse dropdown change should let the granular body survive —
merge, no modal. The path is REACHABLE, not dead code: typed ops are dropdown + editable-`DO`-body hybrids
(`bridge.js:197` gives every op a `DO` statement input; `stackBridge.js:193` fills it with editable atoms), so
hand-edit-a-child-then-flip-a-header genuinely collides. (2) **COMMITTED** (`e5d808c`) — guard + test; (3) **regression test ADDED + passing** (2026-06-25) —
`tests/op-header-edit-merge.spec.js` drives the real gesture (insert edge probe → inject a `raw` body atom → flip
the `edge_op` AXIS dropdown in `__blkws`) and asserts the injected atom survives + the op stays block-edited (under
the buggy `replaceOp` both would fail). This was the OPPOSITE-case gap in `op-params-complete.spec.js` that let #3
be falsely closed the first time — now closed. **NEAR #3 is DONE.**)*

**Shipped this session:**
- NEAR #4 — Field-targeting / non-numeric param mechanism (`230245a`) — extended dev-mode's inline exposure so dropdowns, text, corner-grids, checkboxes, and coordlists become fully saved valid-by-construction wizard knobs.
- NEAR #1 — re-icon any wizard (built-ins incl.) + line-art icon picker (`ef0ee43`); shared `web/ui/wizIcons.js` registry.
- NEAR #2 — in-block ✎ editor for the coordlist positioner (`105c837`); `buildCoordEditor`/`openCoordEditor` shared by the form widget + the block ✎ affordance.

## Environment — fresh-checkout gotchas (cost real time this session)
- Git root has a **doubled `DDCS-Studio/` dir**; the npm project + app code is under `DDCS-Studio/DDCS-Studio/`. Use absolute paths — a stray relative `cd DDCS-Studio` lands you one level too deep.
- `node_modules` is gitignored → run `npm ci` **and** `npx playwright install chromium` before the suite (a bare `npx playwright test` silently fetches a mismatched throwaway and fails on `@playwright/test`).
- Running the suite churns tracked `tests/_*.png` screenshots → `git restore 'DDCS-Studio/tests/*.png'` before any release commit.
- **Release flow:** `npm run bump-version` (bumps the `.ver` chip in `web/index.html`) → push the chip change to `main` → `desktop-release.yml` builds the exe and **creates the `v<chip>` tag + release itself** (idempotent). Don't tag locally; push the bump commit as the tip (a batched push tags the wrong commit — that's how `v10.35` drifted).

## Test baseline (2026-06-25)
**279 passed, 2 skipped, 1 known-stale failing:** `macros-tabs.spec.js` (asserts the old flat-tab macros layout;
the UI is a sidebar+tree now — pending the macrosApp restructure). `middle-animator.spec.js` is flaky (passes in
isolation). The `header-responsive:47` off-by-one was a stale assertion (Copy moved to a floating button) — fixed
this session.

## Traps / rules (also in ROADMAP "Conventions")
- **Blockly v13 Class-B render trap** — a valid block model isn't drawn until the async render queue runs; load via `ddcsLoadBlockStack` and add a render-guard (`getHeightWidth().height > 0`), not just an emit assertion.
- **Valid by construction** — `BUILDERS(op.params) == op.children`; GUI param pills resolve to numbers in `instantiate` so committed ops stay clean.
- **GUI over fields** — default to a visual/canvas picker, not a text field.
- **Verify the real symptom at runtime** — a green emit ≠ a working app; reproduce the user's exact symptom in the right viewport.
