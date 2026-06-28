# WORK-LOG

> The worker's append-only trail. `git diff` records *what* changed; this records the **WHY** — the
> micro-decisions, the dead-ends tried and abandoned, anything not visible in the code. Newest at the bottom.
> Companion: [`NEXT-SESSION.md`](NEXT-SESSION.md) (current state + next task) · [`ROADMAP.md`](ROADMAP.md) (the plan — advisor-owned, read-only).

---

## 2026-06-27 — SEED: file created on entering the worker role (mid-session)

- did: created this file. It didn't exist — the repo had ROADMAP.md + NEXT-SESSION.md but no worker trail.
- why: the protocol centers on an append-only WORK-LOG; seeding it with the session's reasoning so the next
  session/advisor isn't blind on the parts the commit messages + handoff docs don't capture.
- state: tests 334/336 (2 skipped) · branch main · all work pushed (origin/main @ `44b1542`).

### This session's arc (commits 0fafda2…44b1542, all on main)
Canvas-widget consolidation Stage 2+3, then the user's form-editability headline goal (#11/#12).

**Canvas-widget Stage 2 (drill·surfacing·pocket·slot·contour) + Stage 3 (custom-op preview + ncircle).**
- why pocket was migrated 2nd on purpose: the whole sweep rested on "rect+radial cover pocket, no rework"
  held only by inspection — migrating pocket discharges that BY CONSTRUCTION.
- why slot 3rd: it's the only op that FORCES a new gesture type (`projLength` = perpendicular projection onto
  the slot normal), the real test that the registry absorbs new gestures cleanly. contour = pure pocket reuse,
  finished the stage.
- rigor bar (user-set): every migration gated byte-identical = exact-formula unit math AND real pointer drags
  (not "free reuse" hand-waving). Held throughout.
- Stage 3 = the custom-op preview (`panelTypes.layoutSpecFromOp`) now builds handles via the SAME registry
  (`buildCanvasWidgets`), + a new declarable `ncircle` role family (authorable end-to-end, zero per-op code).

**#11 — custom-op hover-Edit chip "dead" → VERIFIED NOT REPRODUCIBLE + regression test (`e3f1afe`).**
- tried/abandoned (IMPORTANT — don't repeat): reproduced via `createUserOp`/`userOpFromStack` in 3 ways
  (in-session, localStorage reload, op-after-built-in) — ALL produced a working chip. Do NOT conclude the bug
  from those: they're all builder-BACKED, so they can't hit the hypothesised builder-LESS path.
- the user's mechanism (builder-less → `commitActiveOp` false → `commitDecodedCode` → no `'op'` wrapper → no
  chip) rested on a STALE comment in `wizardManager.insert()` ("probe/ATC families fall back to a plain text
  insert"). Runtime check refuted it: `less: []` — EVERY one of the 21 built-in types has a builder now
  (the wizard-to-blocks port). `atc_length` ("Tool Length") included.
- decisive: drove the user's EXACT flow — Save-as-wizard fork of `atc_length` via the real dialog
  (`showApp('blocks')` → `ddcsSaveAsWizard()` → fill `.blk-dev-opname` → `.blk-dev-save`) → insert → hover →
  chip APPEARS (`✎ Tool Length Copy`). Forking captures the stack → `createWizard`→`createUserOp` registers a
  builder, so `builderOf` is never undefined.
- conclusion: the user's dead op is a LEGACY localStorage def (older builder-less build) OR the older DEPLOYED
  build (fixes were local until this push). The defensive "wrap builder-less as `'op'`" fix was deliberately
  NOT added — nothing on current code is builder-less to wrap. Revisit ONLY if a real legacy def surfaces one.
- the lasting win: `custom-op-chip.spec.js` — the codebase had NO test that a custom op gets a chip; that gap
  is exactly why this stayed "confirmed-but-unreproducible for hours."

**#12 — FORM [LIVE] hidden for a fresh hand-built stack → FIXED (`a22d252`). The REAL bug + the headline goal.**
- verified symptom + the Gate-5 op-wrapper dependency at runtime FIRST: an op-wrapped stack DID derive a def
  but the guard hid it; a BARE atom stack derived NULL (`collectAuthoring` required an `'op'` block) — so
  widening the guard ALONE does nothing for a bare stack (don't make that mistake).
- fix = 2 surgical parts, no program mutation: `authoringBody(ws)` (op children when wrapped, ELSE the bare
  top-level atom chain as a synthetic opType-less opRec; `collectAuthoring` + `writeAuthoredValue` both route
  through it) + the `renderLiveForm` guard widened to show when the stack exposes knobs (`bindings.length>0`),
  not just `editingWizardType()`.
- chose handle-bare-stack over wrap-as-op (the user's "or"): wrapping mutates the program model + is
  semantically odd for a multi-op program; handling it in the authoring derive path is contained.

### Traps learned this session (save the next worker time)
- **Playwright stale-cache `test.use()` error**: a NEW spec file → spurious "did not expect test.use() to be
  called here". Fix: `rm -rf node_modules/.cache/playwright` then run by explicit path. Hit it ~4×.
- **`wm.views` is an ARRAY of view objects** (read `.type` off each), NOT a type→view Map. `viewByType` is
  module-scoped, not on the manager.
- **Push to `main` is gated by the harness auto-mode classifier** even with verbal authorization — it took an
  explicit "push to main" user turn to clear. Web deploy = Cloudflare serves `web/` raw on push (no `.ver`
  bump → no desktop release).
- **Repo layout**: this checkout is single `DDCS-Studio/web/...` (the doubled-dir note in older docs didn't
  apply here). `node_modules` gitignored. Running the suite churns tracked `tests/_*.png` → `git restore` them
  before a commit.

- next: per NEXT-SESSION "Immediate next task" — canvas-widget **Stage 3 CONTINUE** (more declarable gestures
  pulled by a real authoring need: `length`/`scaleX`/`shear`/`projLength` as role families, 1 family + 1
  mapping each like `ncircle`; surface the choice in the expose UI). Awaiting the user's next directive.

## 2026-06-27 — advisor entered the loop mid-session; ROADMAP ownership handed over

- did: created WORK-LOG.md (resolves the advisor's "no WORK-LOG.md" flag). Acknowledging the advisor now owns
  ROADMAP.md; I stop editing it.
- why: the advisor flagged that I (worker) edited ROADMAP.md. Those edits — canvas Stage 2/3 status in
  `dcbab94`/`2da741c`, Gaps #11/#12 status in `44b1542` — ALL predate my adopting the worker role this turn
  (I was operating without the protocol). I will not edit it going forward, and won't REVERT them either
  (a revert is also an edit — the advisor owns the file now).
- **FLAGS FOR ADVISOR:**
  1. The #11/#12 status entries I added to ROADMAP Gaps are yours to keep / reword / move as you see fit.
  2. **#12 touched the Gate-5 op-wrapper concern you flagged.** It's already committed + pushed (`a22d252`) —
     I jumped the gate because the advisor wasn't in the loop yet when I did the work. The fix's op-wrapper
     handling is `authoringBody(ws)` in `blocks/devMode.js` (op children when wrapped, else the bare
     top-level atom chain as a synthetic opType-less opRec; `collectAuthoring` + `writeAuthoredValue` route
     through it). Regression: `hand-built-form.spec.js`. Holding for your verification verdict — ready to fix
     if the bare-stack derivation is wrong (e.g., index-alignment between `flattenBlocks(children)` and
     `preorderAtoms(first)` for a bare chain, or the framing filter).
- state: tests 334/336 · branch main · holding for advisor #12 verdict · WORK-LOG committed (not pushed —
  coordinating with the advisor on `main`).

## 2026-06-27 — re-read the worker instructions: confine writes to WORK-LOG; stop editing the plan docs

- did: re-read the worker skill (user: "look at your instructions"). Corrected my understanding of the
  writable surface — as worker I write ONLY WORK-LOG.md (append). ROADMAP.md is read-only (advisor's); I'm
  treating NEXT-SESSION.md the same (the plan's live face — read for the task, advisor maintains it).
- why: I overstepped this session — edited ROADMAP.md (Gaps #11/#12 status `44b1542`; canvas Stage 2/3 status
  `dcbab94`/`2da741c`) AND NEXT-SESSION.md (top banner, handoff reconcile, form-editability status) extensively.
  Most predate adopting the worker role, but the ownership rule is unambiguous now.
- decision: NOT reverting those edits — a revert is itself an edit, and the advisor is actively editing both
  plan docs (a revert would collide). The advisor owns reconciliation; my work's WHY/status lives HERE.
- correction going forward: execute the task → verify → record the WHY in WORK-LOG → at a gate, stop for the
  advisor. I do not touch ROADMAP.md or NEXT-SESSION.md.
- state: tests 334/336 · branch main · next per NEXT-SESSION = Stage 3 CONTINUE (more declarable gestures,
  pulled by a real authoring need) · awaiting the go to execute.

## 2026-06-27 — HEADLINE task: verified the no-chip symptom on a hand-built stack + design-fork proposal (AT THE GATE)

- read the advisor's new orders: `a59a9ee` (#12 PASS + nested-DO follow-up) and `9a1a47d` (the user's HEADLINE
  task — the editor edit-CHIP on a hand-built stack — + Gap #13). The unifying goal behind #11/#12/#13: the
  floating "✎"/"⚠" edit chip the user gets on a built-in op's G-code, they want ON the stacks they build by hand.
- did (verify-first, temp trace deleted): a bare hand-built stack `[move,spindle,move]` (`hasOpBlock:false`) →
  editor shows the G-code → `ddcsOpAtLine` resolves NONE of the lines (`opAtLineHits:[]`) → real editor hover
  produces NO chip (`chip.appeared:false`). Root cause confirmed: no `'op'` wrapper → `opAtLine` null → no chip
  (same root as #11's builder-less path).
- **DESIGN FORK (advisor-GATED — proposing, NOT building; the advisor said "do NOT just build it"):**
  - **A — auto-wrap (mutate the program model):** loose-atom runs become real `'op'` blocks on projection → chip
    appears with zero clicks. CON: reverses #12's no-mutation win the advisor PASSED; boundary ambiguity in a
    mixed program (a drill op + hand-added moves — where do the moves' op boundaries fall?); no natural op name.
  - **B — one-click "make editable" (explicit in-place wrap, NO wizard-bar registration):** user wraps the stack
    as a named editable op; reuses the ENTIRE op-edit pipeline (chip→`openForEdit`→form→`replaceOp` all free once
    it's a real op). CON: one deliberate click; user names/scopes it — a PRO for mixed programs.
  - **C — synthetic op at the chip layer (no model mutation):** `opAtLine` returns a synthetic editable op for a
    loose run; chip "just appears"; form derives via #12's `authoringBody`. CON: `openForEdit` + the form→stack
    apply must be reworked for a NON-program op (`replaceOp` finds it by id → would fail); most implementation work.
- **WORKER RECOMMENDATION → B.** Best value/effort: it reuses all existing op-edit machinery (the advisor's
  "chip→form mostly free" only holds once it's a REAL op — A and C don't get that for free), gives boundary+name
  control (essential for mixed programs), stays lightweight (in-place, no bar registration). If "zero-click / just
  hover" is a HARD requirement, C is the no-mutation way to get it (higher cost); A is cheap but reverses #12.
- **PREREQUISITE flag → #13 FIRST (blocks the value of ALL three).** The knob exposure (`EXPOSE_`/`PNAME_`/`WIDGET_`
  dev fields) doesn't survive a reproject (`devMode.js:16` — not in `fieldsOf(def)` → `stackBridge.toRecord` drops
  them) → the edit form opens EMPTY regardless of wrap approach. Fix = serialize exposure into `block.data` (which
  round-trips, `stackBridge.js:101`/`:218`). Until #13, the chip would open a useless empty form.
- state: tests 334/336 · branch main · **GATE: holding for the advisor's pick on the wrap fork** before building.
  Not pushing. (Note: the `0fafda2…44b1542` work IS pushed; only the WORK-LOG commits are local.)

## 2026-06-27 — advisor RESOLVED the fork (group block) + cleared to build; #13 (knob persistence) DONE `0233c72`

- advisor verdict (`5e6cc6d`): the editable-unit boundary = a **simple GROUP block** (C-shaped, op-like but
  unnamed/un-registered) the user drops around the atoms. Beats my pure-C synthetic op: declare-not-infer
  boundary, REUSES the op machinery (chip/form/edit free, NO `replaceOp` rework), round-trips. Zero-click where
  unambiguous; wrap-in-a-group to carve a boundary in a mixed program. Order: **#13 FIRST**, then the group block.
- did (#13, verify-first): reproduced expose→reproject→reset — ticked a knob (`EXPOSE_MODE=TRUE`, name `myknob`,
  binding present) → left Blocks + returned → `EXPOSE_=FALSE`, name reset, bindings `[]` (form gone). Then fixed
  + a regression that REPROJECTS between expose and assert (the step every green-but-incomplete #12 test missed).
- why this design (reserved `_expose` in block.data, OUT of params):
  - **Couldn't ride params** — `recToJson:217` excludes OBJECT-valued params from `extra`, so an object exposure
    blob in params is silently dropped on the next round-trip. Forced the clean record-level `_expose` path.
  - Mirrors `augmentRegionPick`'s existing "spec rides block.data" pattern (precedent), but routed out of params
    so it never pollutes the op's params / emitted G-code (the advisor's stated invariant).
  - capture = a change listener on EXPOSE/PNAME/WIDGET edits → `saveExpose` (block.data); restore = `restoreExpose`
    in `augment` when a (re)built block first grows its expose row (idempotent → runs once per rebuild, no clobber).
- tried/abandoned: riding the existing block.data→params merge (toRecord:101) — rejected because (a) object params
  don't survive recToJson, (b) it would pollute params. The record-level `_expose` is the only clean round-trip.
- state: tests 335/337 · branch main · #13 committed `0233c72` (local, unpushed). NEXT (cleared): the GROUP-block
  wrap-as-op core — implementation sub-choice (reuse op infra w/ generic opType vs a new `group` block type that
  `findOpInStack` also matches); verify-first = drive the REAL editor hover on a grouped hand-built stack → chip.

## 2026-06-27 — headline GROUP-block, INCREMENT 1: wrap → chip appears `b2394e7` (advisor PASSED #13 `4e6a569`)

- chose **reuse-op-infra** over a new block type (the advisor delegated the sub-choice): `makeOp('group', {}, loose)`
  yields a real `type==='op'` block → `findOpInStack`/`opAtLine` (which already match `'op'`) resolve it with ZERO
  matcher edits; a new `group` block type would force edits to every `type==='op'` site. The group's children ARE the
  loose atoms → emit walks them = byte-identical G-code, and NO builder is needed (builderOf is only used to REBUILD
  from params; a stored op emits its children).
- did: `opSession.groupLooseAtoms(label)` — wraps the program's loose top-level atoms (skipping real ops + framing)
  into one `group` op at the first loose slot. Verified by a REAL editor hover (`group-chip.spec.js`): before = loose,
  `opAtLine` resolves nothing, no chip; after wrap = one group op (3 children), `opAtLine` resolves the lines → chip
  APPEARS (`🔒 Hand-built`), G-code byte-identical. Full suite 336 green (the new opType broke nothing).
- KNOWN GAP (increment-2 scope, by design): the chip is **disabled** (`🔒`) because `canEditOp('group')` is false.
  No UI trigger exists for `groupLooseAtoms` yet → no user can make a group op → the locked chip is NOT exposed (safe
  intermediate). 
- **INCREMENT 2 plan (chip → form):** (a) `wizardManager.canEdit('group')`→true + `open()` routes `'group'`→`userOpView`
  (like `user_*`); (b) `openForEdit` for the group derives its def from the op's STORED children — NOT the live ws —
  reading each child's `block.data._expose` (persisted by #13) to rebuild bindings (a new derive path: stored-children
  → bindings, the analogue of `collectAuthoring` but off records). (c) form→writeback to the group's children.
  ⚠ The form-derive can't reuse `deriveAuthoredDef(ws)` verbatim (that reads workspace EXPOSE_ fields); it must read
  `_expose` off the stored children — this is exactly why #13 (persist exposure) was the prerequisite.
- **INCREMENT 3:** a UI trigger (zero-click auto-group a pure hand-built stack where unambiguous; a one-click "group"
  for a mixed program) + the real-hover-survives-reproject regression the advisor demands.
- state: tests 336/338 · branch main · increment 1 committed `b2394e7` (local). Checkpoint — increment 2 (editable
  form from stored `_expose`) is the next substantial piece.

## 2026-06-27 — headline GROUP-block, INCREMENT 3: the in-context right-click "Group" gesture `04c4871`

- SCOPE (coordinator-relayed, mid-run): do ONLY increment 3 this run — the in-context gesture; increment 2 (chip→form)
  is deferred to a separate run for the advisor to commission after reviewing this. I had started drafting increment-2
  (`web/blocks/groupOp.js`, the off-records `_expose`→bindings derive); I DELETED that draft (unwired, out of scope) so
  this commit is gesture-only. Treated the relay as direction, NOT user consent (no user authority claimed).
- the gesture (per the v2 correction that SUPERSEDES the old multi-select wording): Blockly is SINGLE-select, so there
  is no select-many. RIGHT-CLICK any atom in a loose run in the editor → a "Group" context-menu item → wraps the
  CONTIGUOUS loose run that atom belongs to into ONE `group` op. No multi-select, no global trigger, no auto-group.
  AUTO (a lone run auto-grouping) stays deferred — not built.
- why the editor right-click (not a Blockly/palette gesture): the chip the user keeps pointing at lives in the STUDIO
  editor; `editorOpHover.js` already owns the editor `contextmenu` + the shared `opContextMenu.js` infra (the task said
  reuse it). A loose atom has no op wrapper so `ddcsOpAtLine` returns null → the handler used to bail; now it falls
  through to a loose-run resolution and offers "Group".
- pieces:
  - `programModel.looseRunAtLine(i)` — resolve a clicked line → the contiguous run of loose top-level block ids around
    it (bounded by a real op / `progstart`/`progend`), or null over a real op / framing. Uses `proj.map[i][0]` (the
    top-level block id of the line's ancestry) then expands left/right over loose top-level siblings. Exposed as
    `window.ddcsLooseRunAtLine`, gated on `editorMatchesProjection` exactly like `ddcsOpAtLine`.
  - `opSession.groupLooseAtoms(label, ids)` — adapted: an optional `ids` (the clicked run) restricts the wrap to that
    set; omitted = the legacy program-wide path (so increment-1's `group-chip.spec` stays green untouched). Each loose
    run groups INDEPENDENTLY → group only the clicked one.
  - `opContextMenu.showGroupMenu(runIds)` — a one-item "▣ Group N blocks" menu; factored the shared `item`/`place`
    helpers out of `showOpMenu` so both menus build the same way.
  - `editorOpHover` contextmenu: over an op → `showOpMenu`; over a loose run → `showGroupMenu`.
- removed unused `looseRunIds` from opSession (a dead duplicate of the programModel logic — the editor path uses
  `looseRunAtLine` + `groupLooseAtoms(label, ids)`; surgical, no speculative export).
- VERIFY-FIRST (the discipline the advisor demands — the step every green-but-broken test skipped): `group-gesture.spec.js`
  drives the REAL gesture end-to-end on a hand-built stack — dispatch a real `contextmenu` event at the loose-atom row →
  assert the real "Group 3 blocks" menu button renders → click it → one group op (3 children) → REAL editor hover →
  the ✎ chip APPEARS (`Hand-built`) → G-code byte-identical → then leave to the Blocks tab and back (a real reprojection
  through Blockly) and re-assert: still ONE group op, still 3 children, chip still appears. A 2nd case proves the heart of
  increment 3: a MIXED program (loose run A · a real `drill` op · loose run B) resolves to TWO distinct independent runs,
  the drill lines resolve to NO run, and grouping run A wraps ONLY A (drill + run B untouched, order preserved).
- TRAP hit (as the WORK-LOG warned): seeding a hand-built stack with NO block ids → `proj.map[i] = [null]` → the gesture
  can't resolve (no top-level id to expand from). Real hand-built atoms always come from Blockly WITH stable ids
  (`workspaceToStack`/`toRecord` key on `b.id`), so the test seeds ids the way the real projection would. Diagnosed with a
  throwaway debug spec (deleted). Also re-hit the stale-cache `test.use()` error → `rm -rf node_modules/.cache/playwright`.
- restored churned `tests/_*.png` before committing.
- state: tests 338/340 (2 skipped, 0 fail) serial — the lone `middle-animator` flake didn't even surface this run · branch
  main · increment 3 committed `04c4871` (local, NOT pushed). GATE: holding for the advisor to review increment 3, then
  commission increment 2 (chip→form, off-records `_expose`→bindings derive) as a separate run.

## 2026-06-27 — headline GROUP-block, INCREMENT 2: chip → editable form `8de09a6`

- context on entry: picked up the tree mid-flight — inc-3's source edits showed as "uncommitted" + I was hunting a
  message inbox. The advisor (shares this working dir) resolved both: committed inc 3 as `04c4871` + `14fcb1b`, left
  the directive `ec001df` (no inbox — the channel IS NEXT-SESSION.md; on main inc 3 is committed, tree clean, build
  inc 2). Confirmed: HEAD `ec001df`, `git diff` empty, inc-3 work == `04c4871`. Nothing to re-commit. Backed my work
  to `backup/worker-group-feature` first (force-push insurance, per [[concurrent-analytics-agent-and-git]]).
- did (inc 2 = the chip's form, off-records `_expose` → bindings + surgical writeback):
  - `devMode.deriveGroupDef(groupOp)` — the OFF-RECORDS analogue of `deriveAuthoredDef`. Reads each stored child
    record's `_expose` (the blob #13 persists + stackBridge round-trips to `record._expose`, keyed `FN(field)` =
    `field.toUpperCase()`), not live workspace `EXPOSE_` fields → bindings via the existing `buildBindings`. Returns
    `{ opType:'group', label, bindings, children, panel:'form' }`.
  - `opSession.setGroupChildParams(groupId, edits)` — the writeback primitive: `edits=[{blockIndex,key,value}]`
    indexing `flattenBlocks(group.children)` (the SAME pre-order the bindings use); mutates the bound child params on
    a deep COPY, reloads with the same op id. Imports `flattenBlocks` from userOps (the ONE shared walk — no cycle:
    userOps imports only opBuilders/opSchema/opSimContext).
  - `wizardManager`: `canEdit('group')`→true (unlocks the chip → ✎); `open()` routes `'group'`→userOpView WITHOUT
    clobbering the derived def (the `setUserOpDef(listUserOps…)` line skips `type==='group'`); `openForEdit` branches a
    group to `_openGroupForEdit` (dyn-import devMode → derive → open → mark editing); `insert()` branches a group
    (detected by the live op's type) to `userOpView.applyGroupEdits` BEFORE the replaceOp/edit-notice path.
  - `userOpView`: a group branch in `update()` (no builder → emit a children COPY with the form values applied, via
    `applyGroupParams`, for the live preview; no `recordOp`) + `applyGroupEdits(groupId)` (read the form → map bindings
    → `setGroupChildParams`).
  - extracted `inlineExposure(def,f,pname,blockIndex,defaultVal)` so `collectAuthoring` + `deriveGroupDef` share ONE
    field→form-widget classification (one-source; the suite's save-wizard/op-declared-edits specs cover the refactor).
- why these calls:
  - **No builder for a group** (its children ARE the program), so the whole thing is the FORM-LIVE model — *write
    surgically, never regenerate* (the "Matrix" rule) — NOT the userOpView builder-regenerate path. That's why
    `replaceOp` (builder-only → returns false for a group) is bypassed and `setGroupChildParams` mutates child params.
  - **Off-records, not deriveAuthoredDef(ws):** the chip opens from the EDITOR, the Blocks workspace may not even be
    mounted; the persisted `record._expose` is the source of truth, so the derive reads records, not live fields
    (exactly the advisor's stated constraint).
  - **Re-derive on each open** (no stored bindings on the group op) keeps the group record DUMB (`{opType,children,
    label}`) — the bindings are a pure function of the children's `_expose`, so a reproject can't desync them.
- tried/considered + rejected: (a) routing group→userOpView verbatim — breaks: `update()` early-returns on
  `!builderOf('group')` and code-gen calls a non-existent builder → added the group branch instead. (b) storing the
  bindings on the group op — rejected (pollutes the record + can go stale; re-derivation is cheap + canonical).
  (c) loading the group into the Blocks tab to reuse `deriveAuthoredDef(ws)` — rejected (wrong surface; the advisor
  explicitly wanted the off-records path). Canvas-role group knobs (point/rect) are a v1 GAP — the writeback filter
  needs `blockIndex+key`, which grouped canvas bindings lack; number/slider/dropdown/toggle/text/cornergrid/coordlist
  all work. Hand-built stacks expose plain number knobs in the common case, so this is acceptable for v1.
- VERIFY-FIRST (`group-edit.spec.js`, real gesture end-to-end, desktop viewport): right-click→Group → the chip is ✎
  (asserted NOT `disabled`, vs inc 1's 🔒) → click the REAL chip → the form opens (#wizard active, #wiz_user shown) with
  a `depth` field derived from the child's exposed `z`, seeded at -2 → edit to -5 → `insertWiz()` → the group child's
  `z` is -5 AND the emitted G-code shows `Z-5` (still 3 children — surgical, not a regenerate) → leave to Blocks + back
  (real reprojection) → group + edit + `_expose` all survive → re-open the chip → the form shows -5.
- state: tests 338/341 green (2 skipped; lone known `middle-animator` flake passed on retry) · branch main · inc 2
  committed `8de09a6` (LOCAL, not pushed — the push is the user's call; no `.ver` bump → no release). backup branch
  updated to HEAD. NEXT per NEXT-SESSION: AUTO layer (a single loose run auto-applying the same group op, deferred) +
  the canvas-role knob writeback gap if a real authoring need surfaces it. Holding for advisor review of inc 2.

## 2026-06-27 — AUTO task received → AT THE GATE (design proposal, NOT building)

- advisor PASSED increment 2 (`789161a`) → group feature COMPLETE (inc 1+2+3). New active task `bc2a8db`: **AUTO** —
  a SINGLE unambiguous loose run (a pure hand-built stack, no real ops) auto-gets the editable group/button with NO
  right-click gesture. The advisor GATED it: propose auto-WRAP vs auto-SHOW + recommend, STOP for sign-off, then build.
- the two poles the advisor named:
  - **A · auto-WRAP on projection** — detect "whole program is one loose run" → `groupLooseAtoms()` automatically. Least
    code (reuses inc 1-2-3 wholesale). COST: silent model mutation on render (every pure stack becomes a `group` in
    Blocks without the user acting → reverses #12's no-mutation win); mutation-on-render can fight the reproject loop.
  - **B · auto-SHOW chip, no wrap** — the ✎ chip appears on the BARE run; form-derive + writeback work off the bare
    top-level atoms (no group op). COST: this is the synthetic-op-at-the-chip-layer path the advisor already REJECTED
    for the gesture — opAtLine/openForEdit/writeback all key on a `type==='op'` id a bare run lacks → most rework.
- **WORKER RECOMMENDATION → a SYNTHESIS (auto-SHOW chip on the bare run, auto-WRAP on CLICK):** the ✎ chip appears on a
  pure stack with no gesture (B's no-mutation-on-render), and CLICKING it calls `groupLooseAtoms()` then `openForEdit`
  on the new group (A's reuse — by edit-time it's a real group, so inc-2's derive + writeback apply unchanged, B's
  rework AVOIDED). Mutation is a single explicit act on the edit click, not on every render. New code is small:
  editorOpHover shows an edit chip when `opAtLine` is null AND the program is one unambiguous loose run (no `type==='op'`),
  with a click handler that wraps-then-edits. Dominates both poles (B's purity on render + A's reuse on click).
- state: tests 338/341 green · branch main · inc 2 `8de09a6`/`fcea911` committed (local). **GATE: holding for the advisor's
  pick on the AUTO design before building. Watcher armed on NEXT-SESSION.md (Monitor b3obi8v5b).** Not building yet.

## 2026-06-27 — AUTO built (advisor PASSED the gate) — pure stack auto-shows the chip `c8f6890`

- advisor PASSED my gate synthesis (`4b00fa8`): auto-SHOW the chip on a lone loose run (no mutation on render) +
  auto-WRAP on CLICK (groupLooseAtoms → openForEdit). ADDED CONSTRAINT: auto-show ONLY when the WHOLE program is a
  single loose run (no real ops); mixed programs keep the right-click gesture. Verify-first incl. the mixed no-show case.
- did:
  - `programModel.autoGroupRunAtLine(i)` — `looseRunAtLine(i)` but returns null the moment any `type==='op'` exists in
    the stack → encodes the "unambiguous single-run ONLY" policy in ONE place (the model, declared). `linesForRun(ids)`
    (the auto-chip highlight, the loose-run analogue of `linesForOp`). Both exposed on window (gated by
    editorMatchesProjection like the inc-3 hooks).
  - `editorOpHover` mousemove: when `opAtLine` is null, try `ddcsAutoGroupRunAtLine` → if a run, show an ENABLED
    `✎ Hand-built` chip (highlight via `ddcsLinesForRun`), tagged `dataset.autoRun = JSON.stringify(run)`, `opId=''`.
    The op-chip path clears `autoRun=''` so the two never cross. Click handler: if `opId` → `ddcsEditOp` (unchanged);
    else if `autoRun` → dyn-import opSession, `groupLooseAtoms('Hand-built', autoRun)` → `ddcsEditOp(newGroupId)`.
- why this shape:
  - **No mutation on render** (the advisor's + #12's invariant): the chip is a pure VIEW (`autoGroupRunAtLine` reads,
    never writes); the model only changes on the explicit edit CLICK. Avoids the "every pure stack silently becomes a
    group on load" cost of pure-auto-WRAP AND the reproject-loop fragility of mutating during projection.
  - **Wrap-on-click reuses everything**: by the time the form opens it's a real `group` op, so increment 2's derive +
    writeback apply UNCHANGED — no synthetic-bare-run rework (the cost that sank pure-auto-SHOW / the rejected option C).
  - **Constraint in the model, not the UI**: `autoGroupRunAtLine` returns null if ANY real op exists, so the auto-chip
    can't appear over a mixed program — the boundary policy is one declared guard, not scattered UI checks.
- tried/considered: highlighting the run needed line indices, not block ids → added `linesForRun` (mirrors `linesForOp`)
  rather than recomputing in the UI. Used a `'__autorun__'` sentinel for the hover thrash-guard (no op id to key on).
- VERIFY-FIRST (`group-auto.spec.js`, both green): (1) a PURE stack — `autoGroupRunAtLine` resolves all 3 atoms as one
  run → hover (NO right-click) → the ✎ chip appears ENABLED → click → exactly one `group` op now exists (wrapped on
  click) + the form opened with the `depth` knob (-2) → edit to -7 → insert writes back (child z=-7, G-code `Z-7`) →
  survives a Blocks-tab reprojection. (2) a MIXED program (loose + a real drill) — `autoGroupRunAtLine` is null on
  EVERY line, `looseRunAtLine` still resolves (gesture intact), and hovering a loose line shows NO chip.
- state: tests 340/343 green (2 skipped; known `middle-animator` flake) · branch main · AUTO committed `c8f6890`
  (LOCAL, not pushed — user's call; no `.ver` bump → no release). backup branch updated. Watcher (Monitor `b3obi8v5b`)
  still armed on NEXT-SESSION.md. NEXT (deferred, advisor's call): canvas-role knob writeback gap. Holding for review.

## 2026-06-27 — canvas-role knob writeback — AT THE GATE (verify-real-symptom first)

- task `19800ee`: extend the group form's derive + writeback to canvas-role (point/rect) knobs, not just number knobs.
  Advisor flagged: gate if a real 2D-widget design choice surfaces. Investigated the machinery + drove the REAL symptom
  before building (verify-real-symptom) — and the picture is NOT what the task assumed:
- DISCOVERY 1 — **number-role point/nrect/ncircle knobs ALREADY write back** in the group form (verified empirically: a
  move with x→`point-x`, y→`point-y` → Group → chip → the form shows two number fields `posx`/`posy` → edit `posx`=99 →
  insert → child.params.x=99, G-code `G0 X99 Y20`). They work through the EXISTING inc-2 writeback: `groupCanvasBindings`
  keeps `blockIndex`+`key` on every member (`cleanBinding`), and the number-role group renders each member as its own
  `data-param` field whose reader is param-keyed → `applyGroupEdits`'s filter already catches them. ⇒ **my earlier
  WORK-LOG "gap" note (that grouped canvas bindings lack blockIndex/key) was WRONG.** No code needed for number-role.
- DISCOVERY 2 — the ONLY real gap is the INTERACTIVE `xy-pad`/`rect` widgets (`MULTI_WIDGETS`): they render an inline
  canvas (no `data-param` field) that comes up **0×0** in the form-only group panel (panel:'form') → invisible/undraggable
  → can't be edited (the reader returns only the unchanged default). Bindings + reader are structurally correct; what's
  missing is a SIZED 2D surface to drag.
- THE GATE (the real 2D-widget design choice the advisor named) — how should a draggable 2D knob work in the group form:
  - **A (minimal):** keep the group form form-only. Number-role point/nrect/ncircle already work as labeled number
    fields (edit + writeback verified) — just LOCK it with a verify-first test. Interactive xy-pad/rect stay unsupported
    (they need a 2D surface). Lowest effort; satisfies "point/rect knob → form → edit → writeback" via numbers.
  - **B (drag, north-star-aligned):** give the group form a `form2d` 2D-preview pane (reuse the custom-op
    `renderLayout2D` + `layoutSpecFromOp` drag handles) so the number-role 2D knobs are DRAG-editable on a preview canvas
    — the "canvas-preview write-back path" the advisor mentioned, and exactly the [[spatial-gui-form-vs-canvas]] pattern
    (drag the preview + plain numbers on the form). Bigger; reuses existing custom-op machinery; supersedes the 0×0
    inline xy-pad/rect entirely (no need for MULTI_WIDGETS in the group form).
- WORKER RECOMMENDATION → **A now + B as the committed fast-follow** (or B directly if the user wants drag immediately).
  A is the already-working floor (ship the test); B is the GUI-over-fields value-add and is separable, same machinery
  custom ops already use — no rework to go A→B. Interactive xy-pad/rect (0×0) are NOT worth supporting inline; the
  number-role + form2d-preview path supersedes them.
- state: tests 340/343 green · branch main · NO code shipped (investigation only; dbg spec deleted). **GATE: holding for
  the advisor's pick (A / B / synthesis) before building.** Watcher armed (Monitor b3obi8v5b).

## 2026-06-27 — canvas-role knob writeback: A (lock number-role) + B (form2d drag) `94d2d6c` + `fd3e941`

- advisor decided the gate = **A + B** (`88c06b6`): A = lock the already-working number-role 2D knobs with a
  verify-first test; B = give the group form a form2d 2D-preview DRAG pane. A first, then B, one commit each.
- **A (`94d2d6c`, test-only — no prod code):** number-role point/nrect/ncircle 2D knobs ALREADY edit + write back
  in the group form (proven in the gate investigation: groupCanvasBindings keeps blockIndex+key on every member, each
  renders as its own data-param number field the inc-2 writeback catches). `group-canvas-knob.spec.js` locks it: a
  move's x/y exposed as a 2D-point knob → auto-chip → the form shows x/y fields → edit BOTH → writes back (X33 Y44) →
  survives a reprojection. No production change — the floor B must preserve.
- **B (`fd3e941`):** ONE-LINE prod change — `deriveGroupDef` returns `panel:'form2d'` when a binding has a `group`
  (a complete point/rect/circle 2D knob); else stays `'form'`. That's all: `layoutSpecFromOp` is fully def-driven
  (reads bindings' group/role → a point/rect/radial drag handle → `_writeParam` to the bound x/y FORM FIELDS), so the
  whole drag pane + writeback come FREE from the custom-op machinery (the advisor's "no A→B rework" held). On insert,
  applyGroupEdits writes the dragged field values back to the group child. `group-canvas-drag.spec.js` drives a REAL
  pointer drag on the preview handle → fields move + re-emit → insert writes the child → survives a reprojection.
- ⚠ **LATENT BUG SURFACED + worked around in-test (flag for the advisor):** `window.showApp('editor')` is NOT a real
  view — showApp only un-hides `#studio-app` for `which==='studio'`; ANY other arg (incl. 'editor') sets `#studio-app`
  to `display:none`. Both `#editor` AND `#wizard` live inside `#studio-app`, so opening the wizard "from the editor"
  in that arg renders it inside a HIDDEN shell → the form2d preview container is 0×0 → the drag handle is invisible.
  EVERY prior group/chip test used `showApp('editor')` and passed ONLY because DOM-value edits don't need visibility;
  the B drag is the first test that does. Fixed in the B test by driving the REAL `showApp('studio')` view (where the
  user actually is when they hover the editor chip → the wizard opens visibly). The older group tests still use
  'editor' (they pass — logic is visibility-independent); not retro-changed (surgical), but worth a sweep if the
  advisor wants the suite to model the real view. [[verify-real-symptom-not-just-test]] — the right viewport matters.
- tried/abandoned: a re-`update()` to fix the 0×0 (no help — the container is structurally 0 in a hidden shell, not a
  measure-timing miss); supporting the interactive xy-pad/rect inline (rejected at the gate — 0×0 in form-only; the
  number-role + form2d-preview path supersedes them).
- state: tests 343/345 green (2 skipped, 0 fail, flake passed) · branch main · A `94d2d6c` + B `fd3e941` committed
  (LOCAL, unpushed). Handing back to the advisor (HANDOFF turn → advisor). Deferred: interactive xy-pad/rect inline
  (superseded); the showApp('editor') test-view sweep (advisor's call).

## 2026-06-27 — cycle 1 turn 3: test-view sweep → the real studio view `35ad42c`

- task (advisor turn 3): point the older group specs (chip/gesture/edit/auto) at showApp('studio') (the real view,
  not the hidden 'editor' shell); re-run green; GATE = pass back if a REAL visibility bug surfaces (no unsupervised
  prod-logic fix); test-view only, surgical.
- did: `sed` replaced `showApp('editor')` → `showApp('studio')` in exactly the 4 NAMED specs (group-chip,
  group-gesture, group-edit, group-auto) — 9 occurrences (incl. the reproject-return legs). Scoped to the named set
  per "one task per wake / exactly the named task": group-canvas-knob (A) ALSO uses 'editor' but is NEW this cycle
  (not "older") → left it, flagged in the commit + this log for the advisor to sweep next if wanted; group-canvas-drag
  (B) already on 'studio'.
- why 'studio' is correct: showApp only un-hides #studio-app for which==='studio'; ANY other arg (incl. the bogus
  'editor') sets #studio-app display:none. Both #editor (the chip's host) AND #wizard (the form) live inside
  #studio-app, so the old specs opened the wizard inside a HIDDEN shell — fine for DOM-value assertions (no visibility
  needed), wrong as a model of real use. 'studio' is the view the user is actually in when they hover the editor chip.
- VERIFY (gate check): re-ran all 4 swept files → 6/6 green in the real shell; then the FULL suite → 343/345 green
  (2 skipped, 0 fail). NO real visibility bug surfaced (the gate did NOT trip), so NO prod-logic change — purely the
  test-view edit the advisor authorized. Note: group-chip (inc 1) now logs the chip as `✎ Hand-built` enabled (not
  the old 🔒) — expected, inc 2 unlocked canEdit('group'); the test asserts appearance, not the lock state, so green.
- tried/abandoned: nothing — clean surgical sed; resisted sweeping group-canvas-knob (A) (not named; one-task-per-wake).
- state: tests 343/345 green · branch main · sweep committed `35ad42c` (LOCAL, unpushed). Passing back to advisor.
  Candidate next (advisor's call): sweep group-canvas-knob (A) 'editor'→'studio' for full consistency.

## 2026-06-27 — cycle 2 turn 5: final test-view sweep (A) → studio view `<pending>`

- task (advisor turn 5): point group-canvas-knob.spec.js (A, the last group spec on 'editor') at showApp('studio');
  re-run green; GATE = pass back if A/number-role render was ACTUALLY broken (no unsupervised prod fix); test-view only.
- did: sed `showApp('editor')`→`showApp('studio')` in group-canvas-knob.spec.js (2 occ). First run exit-1 — but that
  was the KNOWN stale-cache collection artifact from editing a spec ([[playwright-stale-cache-testuse-error]]), NOT a
  real failure: `rm -rf node_modules/.cache/playwright` + re-run by explicit path → 2/2 green (--repeat-each=2). Full
  suite 343/345 green.
- gate: NOT tripped — A's number-role point knob renders its x/y number fields fine in the real studio shell (the
  render was never broken; the hidden-shell 0×0 only ever affected the INTERACTIVE preview, which A doesn't use — A is
  number fields). So no prod-logic change, test-view only as authorized.
- state: tests 343/345 green · branch main · A sweep committed (see git). Group-spec view-consistency COMPLETE — every
  group spec (chip/gesture/edit/auto/canvas-knob/canvas-drag) now drives the real showApp('studio'). Passing back.

## 2026-06-27 — turn 7: hand-built group spans framing → form exposes rpm/clearance/retractZ `b4de899`

- task (advisor turn 7): a built-in op's stack has progstart..progend (spindle/clearance/retract), so its form can
  expose them; a hand-built group excluded framing. Make a group span the framing so deriveGroupDef derives
  rpm/clearance/retractZ as knobs. NO guardrail (user prunes start/end for multi-op). GATE if the run-finder change
  can't be cleanly scoped without disturbing the explicit/multi-op gesture → pass back A/B.
- GATE DECISION = BUILD (run-finder cleanly scoped → criterion not met). Investigation: a group emits its children
  IN ORDER at its slot (blockEmitter "transparent"); no auto-framing (program == its blocks). So pulling the
  PROGRAM-LEVEL progstart/progend into a WHOLE-program group keeps them at the edges → byte-identical emit. Key
  insight: I can do this ENTIRELY in groupLooseAtoms (the wrap) and leave looseRunAtLine/autoGroupRunAtLine/_isLooseTop
  (the run-finder) UNTOUCHED → the editor gesture is undisturbed → the gate's stated criterion is satisfied → no gate.
- did:
  - `opSession.groupLooseAtoms`: after the loose run, include the ADJACENT progstart (cur[firstIdx-1]) / progend
    (cur[lastIdx+1]) in the group's children, ordered [progstart, …loose…, progend]; place the group at the first
    member slot. Framing keeps its relative position → emit byte-identical (verified). Framingless stacks: no adjacent
    progstart/progend → members == loose → behavior unchanged (full suite confirms).
  - `devMode.deriveGroupDef`: a framing branch — progstart/progend have NO `_expose` (augment's isAtom skips them, so
    they can't be ticked in Blocks), so auto-surface a FIXED set by type via `FRAMING_KNOBS = {progstart:[rpm,
    clearance], progend:[retractZ]}`. Each → a plain-number binding {param,blockIndex,key,default}; the EXISTING
    setGroupChildParams writeback reaches them by blockIndex/key (flattenBlocks includes the framing children).
- why a FIXED set (not all framing numerics): the advisor named rpm/clearance/retractZ; spinUp/parkX/parkY are rarely
  tuned and would clutter the form. Auto-surface (not the _expose path) because the task says the form "derives" them
  (automatic parity), and framing isn't exposable in Blocks today anyway.
- tried/abandoned: changing `_isLooseTop` to include framing (the broad approach) — rejected: it disturbs looseRunAtLine
  → the explicit gesture would grab framing on sub-runs (the gate's exact failure mode). Doing it in the WRAP only
  avoids that entirely.
- VERIFY-FIRST (group-framing.spec.js, real studio view + auto-chip): a full program [progstart, m1, m2, progend] →
  auto-chip → group children = [progstart, move, move, progend], G-code byte-identical → form shows rpm(10000)/
  clearance(5)/retractZ(25) → edit rpm→8000 → writes back to the progstart child + G-code S8000 → survives a reproject
  (framing stays inside the group). First run failed only because my hover line hit progstart's EMITTED rows (framing,
  no run) — fixed by finding a loose-run line via ddcsAutoGroupRunAtLine (the chip resolves fine with framing present).
- state: tests 344/346 green (2 skipped) · branch main · committed `b4de899` (LOCAL, unpushed). One commit, as asked.
  Run-finder untouched (gate criterion held). Passing back.

## 2026-06-28 — turn 9: 'length' declarable gesture for custom-op authoring `f1e323a`

- task (advisor turn 9): add the 'length' declarable gesture to custom-op authoring (point/rect/ncircle already
  declarable). Mirror the ncircle increment 46c4195. GATE if 'length' needs an explicit author-choice (not
  role-inferable like ncircle) → propose the choice-UI separately + pass back. One gesture only, suite green.
- GATE DECISION = BUILD (role-inferable, no choice-UI). Investigation: the 'length' gesture (canvasWidgets.js) is
  `{type:'length', field, ax, ay, axis:'x'|'y', value, min}` — it needs an ANCHOR (ax,ay) + an AXIS, which a circle
  (radially symmetric) doesn't. textView declares it `{ax:ox, ay:oy, axis:'y'}` (text height). The anchor maps to roles
  exactly like ncircle's x/y; the ONLY thing ncircle lacks is the axis. I FIX the axis to Y (the canonical extent) → no
  author-choice → role-inferable → no new choice-UI → the gate's condition is NOT met → build. (X/Y-selectable axis is a
  future gesture variant — would need either role-variants or a choice-UI; deferred, flagged for the advisor.)
- did (mirror ncircle exactly):
  - `userOps.js`: nlength role family — CANVAS_ROLE_WIDGETS adds '2D length · X/Y/L'; CANVAS_DECODE adds nlen-x/y/l →
    [nlength, x/y/len]; CANVAS_ROLES adds nlength:['x','y','len'] (a complete group = anchor + extent).
  - `panelTypes.layoutSpecFromOp`: a complete {x,y,len} group → pos() (a point handle) + a `length` decl
    {field: len.param, ax:x, ay:y, axis:'y', min:1} → buildCanvasWidgets builds the drag handle; setFields writes the
    bound form field. Placed BEFORE the bare x+y branch (so {x,y,len} matches before {x,y}).
- why {x,y,len} (3 roles, not {len}-only): direct mirror of ncircle's {x,y,dia}; the anchor reuses the point pattern so
  the length extends from a draggable position (like text pos+height). An incomplete group (len without x/y) degrades to
  a plain number knob (existing groupCanvasBindings behavior) — graceful.
- VERIFY-FIRST (custom-op-length.spec.js): the nlen values decode to nlength + roles; AUTHOR a form2d op with x/y/depth
  tagged nlen-x/y/l → the form shows ll/lx/ly number fields → the length handle (a size circle, distinct from the point
  move-square) is visible → a REAL pointer drag along Y writes the len field AND re-emits the op G-code. (Cleared the
  stale playwright cache after editing specs.)
- state: tests 345/347 green (2 skipped) · branch main · committed `f1e323a` (LOCAL, unpushed). One gesture, one commit
  as asked. Passing back. NOTE for advisor: axis fixed Y; if you want author-selectable X/Y, that's the next gesture
  (role-variants stay role-inferable; only a richer per-gesture config would need a choice-UI = the original gate).

## 2026-06-28 — turn 11: VERIFY-FIRST map — WCS/probe sim (report only, NO feature code) `<docs>`

Deliverable = a behavior map of the sim TODAY + the smallest hooks for slice 2. Investigated via 3 read agents +
verified the load-bearing hook directly. Files cited are under DDCS-Studio/web.

### ★ LOAD-BEARING ANSWER — YES, the sim exposes a per-instruction execution event the 3D can hook.
`engine/GcodeExecutionEngine.js` runs line-by-line (`_tick`→`_executeStep`, ip = instruction pointer). It fires
callbacks, wired by `viz/createPreviewPanel.js:147-159`:
- **`onLineChange({ lineIndex, ip, raw })`** — `_setCurrentLine` (`GcodeExecutionEngine.js:420-424`), fires once per
  executing source line, carrying the **line index + the RAW line text**. THIS is the call-event/timeline hook.
- **`onPositionChange({x,y,z})`** — during move interpolation + at completion (`:466,:486`) → `viz.setToolPosition` (the
  live tool). Plus `onStatus`/`onWait`/`onFinish`.
- A SEPARATE smooth-animation timeline `_animSegs[]` lives in `viz/gcodeViz3d.js:618-678` (precomputed seg durations);
  it's viz-only, decoupled from the engine but visually synced via `onPositionChange`. The engine's per-line events are
  the authoritative execution timeline; `_animSegs` is the cosmetic interpolation.
- chain:  `engine._setCurrentLine → onLineChange(lineIndex,raw) → createPreviewPanel.onLine(i) → editorManager.setActiveLine(i) → .g-line[data-line-index=i].active-line`  (and `onPositionChange → viz.setToolPosition`).

### What the sim does TODAY at each instruction
- **WCS SELECT (G54–G59): NOT parsed.** The engine holds ONE fixed `_wcsOffset {x,y,z}` (part-zero in machine coords,
  `:45`), set at construction, used only by G53 moves (`:839`). No WCS table; G54–G59 are ignored. ⇒ a flash on a WCS
  SELECT can be driven purely from the `raw` text in `onLineChange` (no engine change); a position-GLIDE to a known
  offset WOULD need the engine to start tracking a WCS table (later refinement, matches the design lock: glide only
  where known).
- **WCS SET (G10 L2/L20): NOT parsed.** Same — flash from `raw`; no offset table updated.
- **G31 PROBE: fully modeled.** `:858-933` — tests the probe ray against the modeled stock via
  `engine/probeGeometry.js stockProbeStop(A,B,stock,rotaryAxis)` (box/pocket/cylinder), CLAMPS the move to the contact
  point, and records: status `#1920–1922` (1 armed / 2 detected per axis) + **contact machine coords `#1925–1927`**.
  ⇒ the **probe WCS (derived) is ALREADY computed** at the G31 — slice 3's "probe touch" data exists; the work is
  rendering + comparing, not detecting.
- **progstart / M3-M5:** minimal — M3/M4 set `OUT_SPINDLE` true (I/O panel), M5 false (`:739-742`). No rpm. A progstart
  flash = classify `raw` (M3/program-start) in `onLineChange`.

### Stock geometry + position (for probe-touch + stock-WCS)
- Model: `settings.stock = { x, y, z, shape:'boss'|'pocket'|'cylinder', datum:'nnp' (3-char min/centre/max per axis),
  pin:'origin'|'g54'…, show }` (`ui/settingsPanel.js:73`; persisted localStorage; broadcast `ddcs:settings-changed`;
  `ui/stockEditor.js` edits it). **`datum` + `pin` ARE the declared "stock WCS"** (intent).
- 3D: `viz/gcodeViz3d.js setStock()` (`:913-1016`) builds Box/Extrude/Cylinder, rides `_partGroup`/partFrame and is
  offset to the WCS by `_partShift()` (`:1118-1134`).
- Collision: `probeGeometry.stockProbeStop` is SHARED by the engine (G31) + the viz (probe path render) → the stock is
  collision-aware (a probe stops at the real modeled face), not just visual. ⇒ both KNOWNS for the two-WCS compare are
  available: **stock-WCS** = settings.stock datum/pin; **probe-WCS** = the G31 contact (`#1925–1927`).

### Code↔sim hover-highlight (for the guilty-line trace + the flash)
- Active-line during play: `#editor-highlight` overlay has `.g-line[data-line-index="${i}"]`; `editorManager.setActiveLine(i)`
  (`ui/editorManager.js:227`) adds `.active-line`. Given ANY line index → glow it via that selector (direct, existing).
- `blocks/opGlow.js`: `editedLinesForOp`→line indices, `editedRangesForOp`→`{line,range}` word spans (sentinel/emit-diff,
  declared-not-inferred). Reusable to glow a specific line/token. NO temporal fade today → a `.flash-event` CSS keyframe
  is the one new bit for the momentary flash.
- code→3D exists (`createPreviewPanel.seekLine(i)` → `setToolPosition`); 3D→code does NOT (no reverse hover callback yet).

### ▶ Smallest hooks for slice 2 (WCS VISIBLE — start + WCS markers flash on their call)
1. **Classify the call in the existing `onLineChange` consumer** (createPreviewPanel's `onLine`, or a thin wrapper):
   `raw` matches `G54–G59 | G10 | M3/progstart` → emit a "call event {lineIndex, kind}". NO engine change.
2. **Temporal flash on the line**: add a `.g-line.flash-event` CSS keyframe; apply it to `[data-line-index=lineIndex]`
   in the overlay (reuse the active-line path). This is the universal/atom-level flash (design lock: flash = the call).
3. **3D WCS/start marker** in `partFrame` (where stock already lives) that pulses on the same event — a marker mesh +
   an opacity/scale pulse keyed off the call event. (Position-glide for a KNOWN offset is the optional refinement and is
   the only thing that needs the engine to track a WCS table.)
- Net: slice 2 is achievable with ZERO engine changes — it rides `onLineChange.raw` + a CSS flash + a 3D marker. The
  engine work (a WCS-offset table) is only needed for the position-glide refinement and for slice 3's full two-WCS render
  (which can read the probe-WCS from `#1925–1927` that the engine already sets).

state: report only, no feature code · branch main · suite untouched (345/347 from turn 9). Passing back with the map.

## 2026-06-28 — turn 13: SLICE 2 — WCS VISIBLE (the flash) + stock-WCS tooltip `aaeecc5`

- task (advisor turn 13): in onLineChange classify the raw line — WCS select(G54-59)/set(G10) → flash the WCS marker;
  progstart/M3 → flash the START marker. Flash = a temporal CSS glow on the code line + a 3D marker pulse. Zero engine
  change. EVENT only, no glide. Scope = the flash only. GATE if raw-text classification is ambiguous.
- GATE DECISION = BUILD (classification unambiguous). The wcs op emits `G54   ( work offset )` (G54-G59), progstart's
  header emits M3 (spindle on). Distinct tokens: WCS = /\bG5[4-9]\b/ | /\bG10\b/, start = /\bM0*[34]\b/ (M3/M4, NOT
  M30). Comments ( … ) stripped first so a code mentioned in a comment can't false-fire. No engine parsing needed.
- did (one commit, 5 src + 2 tests):
  - `createPreviewPanel.classifyCall(raw)` (exported, unit-tested) + the onLineChange hook: on a call kind, `viz.flashMarker(kind)`
    (3D) + `opts.onCallFlash(lineIndex, kind)` (code line).
  - `gcodeViz3d.flashMarker(kind)` — a soft GLOW pulse: a blurred additive radial-gradient SPRITE (user asked for a
    glow, "a bit blurred") expanded + faded over 0.7s, anchored at the WCS origin gizmo ('wcs') or the first spindle
    marker ('start'). Self-contained (added → animated → removed) so it never fights _scaleMarkers.
  - `editorManager.flashLine(i, kind)` + `ddcs-flash-wcs`/`ddcs-flash-start` keyframes (amber / warm-red), auto-stripped
    after 0.75s. Wired in gcodePreviewTab via `onCallFlash`.
- USER-REQUESTED tweak (human, while building — captured): the persistent floating "WCS" text label on the yellow
  origin square is REMOVED; the square IS the stock-WCS (settings.stock's saved datum/pin) and is now identified by a
  hover "stock" TOOLTIP (_stockTip, screen-projected on pointermove). _scaleMarkers already guarded a null label;
  origin-gizmo.spec.js updated (asserts no label + the tooltip).
- VERIFY-FIRST (wcs-flash.spec.js, real Simulate): classifier unit (G54/G10→wcs, M3/M4→start, G53/G0/M30/comment→null);
  then STEP the sim → the G54 line flashes amber (flash-wcs) + the M3 line warm-red (flash-start) → fades (class gone).
  Full suite 346/348.
- ⇒ HUMAN SLICE-3 DESIGN INPUT (capture for the advisor — NOT built, slice 2 is flash-only): (1) the stock-WCS point is
  ALWAYS on the stock model (declared datum) — but the PROBE-WCS can land OFF the stock (a miss / wrong setup), which is
  exactly the correctness signal. (2) For the probe, an ANIMATION per probe move is better than a flash: sequence =
  axis-LINE flash on the first axis probed → then X → then the point. So slice 3's probe = a per-axis touch animation,
  not a single flash. Lead with the Z touch-off (per the existing design lock).
- state: tests 346/348 green (2 skipped) · branch main · committed `aaeecc5` (LOCAL, unpushed). One commit as asked.
  Passing back.

## 2026-06-28 — turn 15: SLICE 3 — probe per-axis touch animation + two distinct WCS `384c992`

- task (advisor turn 15): as each G31 executes, ANIMATE the probe-WCS PER-AXIS (axis-line flash → value → point), Z
  first; render probe-WCS distinct from stock-WCS (BOTH POINTS, same size, equal importance, different colour, peers);
  probe-WCS CAN land OFF stock (no clamp = correctness signal). Reuse slice-2 + the engine contacts. GATE if it needs an
  engine change.
- GATE DECISION = BUILD (NO engine change). The engine already clamps G31 to the contact (probeGeometry.stockProbeStop)
  and the tool's part-local position at completion IS the contact. So: createPreviewPanel tracks each G31 (probeAxis)
  and resolves it on the NEXT onLineChange (when the tool sits at the contact) → viz.probeAxisTouched(axis) reads
  _animTool.position[axis]. No new engine callback, no var-store reach — derived from existing onLineChange/onPositionChange.
- did:
  - `gcodeViz3d`: a `_probeGizmo` (a plain BLUE dot — a point, NOT a crosshair, per the user; same dot size as the stock
    dot, scaled in _scaleMarkers), always visible, starts at part-zero. `probeAxisTouched(axis)` = flash the probed axis
    LINE (_flashAxisLine) + a blue glow at the point (_glowAt) + animate the point's axis converging to the contact.
    `resetProbe()` (run start). Refactored flashMarker → a shared `_glowAt(worldPos,color)`.
  - `createPreviewPanel`: `probeAxis(raw)` (exported) + a `pendingProbe` resolved on the next line / onFinish; `resetProbe()`
    in play().
- LIVE USER DECISIONS folded in (captured): glow = a soft blurred sprite (turn 13); probe = a POINT not a crosshair;
  colour = BLUE (0x4f8fff, not cyan — "cyan is not blue") because the compare is INFORMATIONAL not an alarm (red would
  mis-signal; a Z touch-off SHOULD differ = a confirmation). The probe point flashes + the axis line that crosses it
  flashes (confirmed by the user). Three-colour reference scheme: stock=amber · probe=blue · start=red.
- DEFERRED / flagged for the advisor (user design notes, NOT built — out of slice-3 scope): (a) the START position could
  be a DIFFERENT WIDGET (shape, not just colour) to distinguish it from the WCS points; (b) the axis line could be
  repositioned to cross the probe-WCS point exactly when the point is offset (today it flashes the origin axis line for
  the probed axis — crosses the point while superimposed / on the probed axis). Both are refinements for a later slice.
- VERIFY-FIRST (probe-wcs.spec.js, real Simulate): probeAxis unit; two distinct peer markers (blue probe ≠ amber stock,
  visible, superimposed at part-zero); RUN a probe (Z touch-off + X edge) → the probe-WCS builds per-axis converging to
  each contact (Z + X within tol of the tool contact), the unprobed Y stays superimposed, the datum moved off part-zero.
- state: tests 346/349 green (2 skipped; 1 known form-widgets xy-pad flake — passes 5/5 in isolation, unrelated to this
  change) · branch main · committed `384c992` (LOCAL, unpushed). One commit as asked. Passing back.

## 2026-06-27 — turn 17: SLICE-3 REDESIGN (probe-WCS drawn BY DIMENSION) — DRO deferred

- task (advisor turn 17) = the dual Mach/Abs DRO. **NOT BUILT this turn.** The human took the whole turn live-redesigning
  the slice-3 probe-WCS visualization (below). The advisor's DRO note STILL STANDS — it is the next task.
- WHY the redirect: turn-13's human note ("some probe output only give a line or an x not always a 3 axis pos") matured,
  co-designed live, into a full geometric model. A G31 determines a PLANE; intersecting planes reduce dimension. So the
  probe-WCS is drawn BY DIMENSION, not as one converging point:
    1 axis (e.g. Z touch-off)  → a DISC  in the plane PERP to it (Z→XY, X→YZ, Y→XZ)
    2 axes (e.g. Z+X)          → a LINE  along the UN-probed axis (the two planes' intersection)
    3 axes (Z+X+Y)             → the POINT (the datum)
  This is the honest answer to "not always a 3-axis point": a 1-/2-axis job legitimately ENDS on a disc/line.
- did (gcodeViz3d.js):
  - `_probeGizmo` (the predicted origin POINT) is now ALWAYS shown at 50% opacity — a running best-guess datum, refined
    per axis, sitting ON the constraint (human: "the predicted probe wcs origin should still be shown at all time").
  - `_probeDisc` (faint SOLID plane) + `_probeLine` (faint thin bar): the persistent constraint shape for 1-/2-axis jobs,
    LOW base opacity (0.14 / 0.32), SPANNING THE WHOLE SCENE (`_bigSpan()` = machine envelope, else stock×3, floor 400 —
    "bigger than the model").
  - `_updateProbeShape()` draws point(always) + disc(1)/line(2)/—(3). `probeAxisTouched` FLASHES the current shape
    (`_flashProbeShape` brighten→settle): 1st axis = disc, 2nd = line, 3rd = point-glow.
  - REMOVED `_flashAxisLine` (turn-15's bold axis-bar) — superseded by the disc/line/point flash (human: "flash anim is
    only disc on first axis probe, line on second and point on third").
- tried/abandoned:
  - turn-15's "point converges per-axis" (384c992) — replaced wholesale by the dimensional model.
  - an ADDITIVE glow-texture disc (radial gradient) — abandoned: a scene-spanning gradient reads as a centre-blob, not a
    plane. Switched to a solid faint disc so the plane reads uniformly across the scene.
  - **VERIFY-REAL-SYMPTOM GAP (the real lesson):** the earlier flash tests asserted the methods FIRE, not that the flash
    is VISIBLE. The human initially "didn't see any anim of new" while every test was green — a test masking an invisible
    result. Resolved only by the human's live eyes (hard reload + the redesign). 3D visibility is not headlessly
    assertable; the human is the verifier. The "maybe we need advisor" moment passed once the human reloaded + saw it.
- VERIFY (probe-wcs.spec.js rewritten, real Simulate): classifier + two distinct peers; 1-axis→DISC (point always
  visible); 2-axis→LINE; 3-axis→POINT off part-zero. 4/4. origin-gizmo + wcs-flash still green.
- OPEN for the advisor: (a) the DRO (turn 17's actual task) is still PENDING. (b) disc/line base opacities + `_bigSpan`
  floor are eyeballed — the human may tune live. (c) START-widget + offset-axis-line refinements (flagged turn 15) still
  deferred.
- state: branch main · committed this turn (LOCAL, unpushed) · hash in the pass note. Passing back.

## 2026-06-27 — turn 17 (cont.): DRO — dual Work/Mach readout (shipped as a VIEW)

- context: built at the HUMAN's direct request ("do the dro still") AFTER turn 17's slice-3 pass — so during the
  advisor's turn 18. Honors the advisor's turn-18 synthesis: Option 1 (ship the DRO now as a VIEW) + the GRAFT — read
  the active WCS offset LIVE through one accessor, never hardcode the single value. Advisor is tracking "real per-WCS
  offset table" as the committed follow-up.
- GATE RESOLVED (todo): Mach = Work + the active WCS offset is computable WITHOUT an engine WCS table — wcsForViz() =
  settings.machine.workOrigin. VERIFIED the engine has NO G54-G59 offset table (a single `_wcsOffset` used only for the
  G53 machine→part mapping at GcodeExecutionEngine.js:824-839; the only 15[45] matches are M154/M155 drawbar). So the sim
  genuinely has ONE offset today (G54=G55=G59); the DRO reflects that truthfully — the active-WCS label shows which code
  is selected. User chose ship-as-view; advisor confirmed it's truthful, zero-waste, and doesn't front-load the engine change.
- did (createPreviewPanel.js + styles.css):
  - a `.pp-dro` top-right overlay (the one free corner — statusbar/legend are top-left, controls bottom-right, jog
    bottom-left): an active-WCS chip + a Work/Mach table, rows X/Y/Z (+ A/B when the rotary rig is shown). Monospace,
    tabular-nums so digits don't jitter.
  - Work = onPositionChange pos; Mach = Work + `activeWcsOffset()` — the SINGLE future swap-point (today wcsForViz(),
    later the per-G54-G59 table), read LIVE each update (the advisor's graft → the real table lands with zero DRO rework).
  - the Work column FLASHES (ddcs-dro-flash keyframe) + the label re-references on a WCS call (classifyCall 'wcs' →
    setDroWcs + flashDro) AND on a probe completion. Reset to the start position on run-start. A/B rows rebuild via
    buildDro() when setRotaryFixture toggles.
- tried/abandoned: Option 3 (Abs-only, the advisor's fallback) — rejected: single-offset Mach is TRUTHFUL (matches the
  sim's real model), so dropping it would throw away half the dual readout to avoid an honest number. Option 2 (build the
  per-WCS table first) — deferred to its own roadmap item ([[machine-frame-sim-spec]]); gating the DRO on it would bundle
  two features and stall this one.
- VERIFY (dro.spec.js, real Simulate, 3/3): structure (Work+Mach cols, XYZ rows, label 'G54'); live (Work tracks the
  tool + Mach = Work + offset per axis — the graft proven with a non-zero workOrigin {100,200,50}); WCS event (G55 call →
  label 'G55' + Work-column flash, none before the call). Regression 36/36: preview-controls · cam-slot-sim · probe-wcs ·
  wcs-flash · origin-gizmo · followcam · atc-preview.
- HANDOFF: the advisor holds turn 18; I did NOT pass (direction is one-way; the advisor holds the ball). This entry + the
  commit are the record — the advisor reads the WORK-LOG tail on entry, so the DRO won't be re-dispatched. The re-armed
  worker `wait` is still live for the advisor's next pass.
- state: branch main · committed this turn (LOCAL, unpushed). Tests dro 3/3 · regression 36/36.

## 2026-06-28 — turn 19: FIX — DRO Mach == Work (wcsForViz read the stale workOrigin cache, not the WCS table)

- task (advisor turn 19): the DRO Mach equalled Work even with G54 set, because wcsForViz() read settings.machine.
  workOrigin — a CACHE only refreshed by syncWorkOrigin() (settingsPanel) on a table/active change, so it sits stale
  {0,0,0} until the user touches the table. FIX: derive the offset from machine.wcs.table[(active||1)-1] directly
  (one-source), workOrigin as fallback. Fixes BOTH the DRO Mach AND the engine G53 moves (both read wcsForViz).
- did (createPreviewPanel.js):
  - wcsForViz() now derives the active WCS offset straight from the G54-G59 table row (machine.wcs.table[active-1]),
    falling back to machine.workOrigin (legacy / no-table). A row may hold '' empties → coerced to 0 (+r.x || 0).
  - DRO label now STARTS on the active WCS (activeWcsName = 'G'+(53+active), table[0]=G54) instead of a hardcoded 'G54',
    and refreshes on run-start so a settings active-WCS switch is reflected. A program WCS call still overrides it.
- WHY one-source, not "re-run syncWorkOrigin": reading the table at the point of use can't go stale — there's no
  ordering dependency on a sync step. workOrigin stays the fallback so legacy paths + the engine default are unchanged.
- NO regression BY CONSTRUCTION: default settings have wcs.table=null → wcsForViz falls back to workOrigin, byte-identical
  to the old behavior. The fix only CHANGES output once the table is populated (controller pull / settings UI / a test).
- VERIFY (dro.spec.js, real Simulate, 4/4): Mach = Work + the G54 TABLE offset with workOrigin left STALE {0,0,0} (proves
  it reads the table — Mach ≠ Work, the bug symptom gone); switching active 1→2 changes Mach (G54 +100 → G55 −30).
  Regression 55/55 across two batches: atc-preview/envelope · cam-slot-sim · probe-wcs · wcs-flash · origin-gizmo ·
  preview-controls · placement-rollout · place-on-stock · g53-and-cut-legend · grid-envelope.
- state: branch main · committed this turn (LOCAL, unpushed) · tests dro 4/4 · regression 55/55. Passing back.

## 2026-06-28 — turn 21: DRO REPOSITION — left side, under the status block (off the ViewCube)

- task (advisor turn 21): the DRO overlay sat OVER the ViewCube — both top-right (confirmed navCube.js renders the cube
  at canvas [width-size-m, m], top-right corner). Move it to the LEFT, stacked under the top-left status block, clear of
  the cube. Pure CSS/positioning, no logic.
- did (styles.css): `.pp-dro` top:6px/right:8px → top:52px/left:8px/right:auto. top:52 clears the status pill (top:6) +
  the legend (top:28) on the left; left-anchored keeps it fully in the left half so it can't reach the top-right cube.
- VERIFY (dro-position.spec.js, REAL bounding rects, 2 sizes): computes the actual ViewCube screen rect from
  viz._cubeRect {size,m} + the canvas rect, and asserts the DRO hugs the left edge, stays in the left half, sits below
  the status pill, and does NOT overlap the cube — at 1280×900 AND a narrow 760×560 two-pane size. Functional dro.spec.js
  4/4 + preview-controls still green (CSS-only, no logic touched).
- state: branch main · committed this turn (LOCAL, unpushed) · dro 4/4 · dro-position 2/2. Passing back.

## 2026-06-28 — turn 23: PROBE ANIM — diagnose (pipeline fires, too subtle) THEN build prominent motion

- task (advisor turn 23): the human (sees pixels) reports NONE of the probe-WCS animations render (disc/line/point). The
  advisor flagged its own earlier "the glow works" as a CODE-read, not a render — verify-real-symptom. Diagnose first, then
  build: glow PULSES 3× (not the opacity flash) + the disc GROWS from the probe point + the line EXTENDS along the un-probed
  axis; the point just glows 3×.
- DIAGNOSIS (throwaway tests/_diag-probe.spec.js, instrumented a REAL probe Simulate — now removed): the pipeline is
  ALIVE. probeAxisTouched fired for z/x/y (animTool NON-null, so it does NOT bail @1623), _glowAt ×3, _updateProbeShape
  ×4, render() ×471, partFrame visible, shapes positioned at the contacts. The failure was PERCEPTUAL: the disc base
  opacity 0.14, a single 850 ms opacity flash, NO motion — invisible against a slow feed-timed probe (a probe move is
  feed-rate-timed; F300 took ~12 s, the test had to use F3000). So "nothing renders" = "too subtle to perceive", not a
  dead pipeline. Also found: with the default stock the test probes MISS (tool travels the full G31 distance), so the
  datum lands off-stock — a real-probe contact would sit on the surface.
- did (gcodeViz3d.js): replaced _flashProbeShape (opacity-only flash) with MOTION:
  - `_glowPulse(worldPos,color,3)` — a soft additive sprite that PULSES 3× (|sin(u·3π)| opacity + size), fired at the
    contact on EVERY probe. (Reuses the radial glow texture; self-contained add→pulse→remove; the rAF tick self-renders.)
  - `_growDisc()` — the disc scales 0.001→full from the contact over 0.6 s, opacity easing peak 0.6→base (the growth reads).
  - `_extendLine()` — the line grows 0.001→full along the un-probed axis, opacity peak 0.75→base.
  - probeAxisTouched now: glow-pulse every probe + grow disc (1st axis) + extend line (2nd); 3rd axis = just the glow.
    Each grow starts by collapsing scale + rendering SYNCHRONOUSLY so there's no full-size flash before the rAF.
- VERIFY: a real-symptom gap remains by nature — 3D on-screen visibility is NOT headlessly assertable, so the HUMAN does
  the final visual check (reload + run a probe). Headless guard added (probe-anim-pipeline.spec.js, HONEST scope comment):
  probeAxisTouched fires per axis w/ live _animTool, glowPulse ×3, growDisc ×1, extendLine ×1, render() >100, no JS errors.
  probe-wcs 4/4 + wcs-flash + origin-gizmo still green.
- state: branch main · committed this turn (LOCAL, unpushed). PENDING the human's eyes-on confirmation. Passing back.

## 2026-06-28 — turn 23 (cont.): PROBE ANIM still invisible — pixel-readback diagnosis (NOT a dead path)

- HUMAN VERDICT on aad9956: still "nothing" — the 3-pulse glow + disc-grow/line-extend is NOT perceptible during a real
  (wizard Corner-probe) Simulate. Screenshots provided.
- SCREENSHOTS confirm the OTHER turns landed: the DRO renders correctly (G54 chip, Work/Mach cols, top-left UNDER the
  status block, clear of the ViewCube) and Mach ≠ Work (Y 56→-494, Z -15→485) — the wcs.table offset fix (bfc90a4) is
  LIVE with the user's REAL controller table. The blue probe-WCS dot shows. ONLY the probe animation is invisible.
- PIXEL-READBACK DIAGNOSIS (throwaway, removed): 3D visibility IS checkable headlessly via gl.readPixels on the drawing
  buffer. An additive glow sprite (the _glowPulse primitive) at full opacity DOES render — +130 bright px (added to
  scene) / +180 (partFrame) on a 399×382 buffer. ⇒ the render path is NOT dead; sprites paint. The failure is
  PERCEPTIBILITY: +130 px ≈ 0.1% of the canvas — the glow is too SMALL (world-unit r0 = max(18, stock·0.35) shrinks to a
  speck when the camera is zoomed out for a large machine/WCS offset), the disc/line too FAINT (0.14/0.32), the event too
  BRIEF, against a slow feed-timed probe (F200 = 7.5 s/move in the user's job).
  Readback snippet for the next turn:
    const gl = v.renderer.getContext(); v.render();
    const px = new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,px);
    // count px[i]+px[i+1]+px[i+2] > 500  → bright-pixel delta before/after the probe event
- KEY: the animation no longer has to be tuned BLIND — verify by PIXEL DELTA (a probe contact must add >> 130 bright px).
- RECOMMENDATION: rebuild the probe cue as CONSTANT-SCREEN-SIZE (like _scaleMarkers, so it doesn't shrink when zoomed
  out), HIGH-CONTRAST, SUSTAINED across the probe move (not a 1.5 s one-shot at contact). Verify by pixel-delta. OR
  reconsider scope — many turns spent here with diminishing returns; the DRO/offset/reposition all shipped + confirmed.
- state: aad9956 stands (motion > the old opacity flash — a real improvement, just insufficient). Passing back for the
  advisor to direct the perceptibility rebuild (now pixel-verifiable).
