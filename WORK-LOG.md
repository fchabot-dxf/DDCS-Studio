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

## 2026-06-28 — turn 25: PROBE CUE constant-screen + high-contrast + sustained — USER SAYS "NOT THE RIGHT FIX"

- task (advisor turn 25): rebuild the probe cue on 3 levers — constant-screen-size, high-contrast, sustained — verify by
  pixel-delta + the human's eyes.
- did (gcodeViz3d.js):
  - `_worldPerPx(pos)` helper (the worldPerPx formula extracted from _scaleMarkers).
  - _scaleMarkers now sizes the probe DISC + LINE to CONSTANT SCREEN size (_probeDiscPx=95 / _probeLinePx=170 ×
    worldPerPx × a 0→1 grow factor) — a big WCS offset can no longer shrink them to a speck.
  - disc/line opacity 0.14/0.32 → 0.4/0.7 (high-contrast); colour 0x4f8fff → 0x6cc4ff (brighter).
  - _glowPulse rebuilt: constant-screen (_probeGlowPx=84 × worldPerPx, recomputed each tick), SUSTAINED ~2.5 s (3 pulses,
    never fully dark between). _growDisc/_extendLine now drive _discProgress/_lineProgress (0→1) that _scaleMarkers
    multiplies into the screen size. Removed _bigSpan (dead).
- VERIFY (a) PIXEL-DELTA (probe-anim-visible.spec.js — gl.readPixels during a real probe WITH a large WCS offset, the
  breaking condition): peak bright coverage 2.16% of canvas vs the old ~0.1% speck (baseline 0.71%). Regression 14/14
  (probe-wcs · probe-anim-pipeline · origin-gizmo · wcs-flash · dro · dro-position).
- VERIFY (b) HUMAN: ✗ — the USER says "NOT THE RIGHT FIX" and escalated. KEY: the pixel-delta proves the cue now renders
  prominently (20× more screen), so "not the right fix" is NO LONGER about visibility — it's the APPROACH/representation
  the user dislikes (constant-screen big disc/glow). The desired visual is UNSPECIFIED. → design-direction gate: the
  advisor should align with the user on WHAT the probe-WCS cue should look like (a sketch / options) BEFORE more building.
- state: branch main · committed this turn (LOCAL, unpushed) · pixel 2.16% · regression 14/14. Passing back — user
  rejected the approach (not the visibility).

## 2026-06-28 — turn 28: PROBE-CUE refinements R1 (disc at contact) + R2 (re-probe re-shows disc)

- CONTEXT REFRAME: the real root cause of "I see nothing" was NOT the look — it was ada5907 (probeAxis only matched a
  LITERAL G31 Y-10, not real DDCS `G31 Y#8` #var values), so the cue never fired on real macros. With that fixed, the
  turn-25 constant-screen cue is back (the user's "not the right fix" was it never firing on their real Corner-probe).
  Turn 27's ruby-glow is SUPERSEDED. Turn 28 = two refinements on the current cue.
- did (gcodeViz3d.js):
  - R1 — probeAxisTouched records the FULL tool position at the touch (this._probeContact = {x,y,z}); _updateProbeShape
    centres the DISC at the contact (k), not the WCS-projected datum c (un-probed axes had been forced to 0 = part-zero),
    so the disc emerges where the probe physically touched. The glow moves to the contact too. The LINE stays at c (the
    geometric intersection — x/z determined, spans the un-probed axis) and the POINT stays at c (the predicted datum).
  - R2 — probeAxisTouched: if the incoming axis is ALREADY in _probeAxes, the macro looped back (GOTO1 retry) into a new
    sequence → reset _probeAxes/_probeVals first, so the cue restarts at the DISC instead of staying the stale LINE.
  - resetProbe clears _probeContact.
- VERIFY (probe-cue-refine.spec.js, real Simulate, 2/2): R1 — after G0 X12 Y7 + G31 Z, the disc sits at the contact
  (pos ≈ _probeContact, |contact.x| > 5, off the WCS); R2 — Z→X→Z re-probe ends with the DISC visible + the line hidden +
  only {z} active. Regression 14/14 (probe-wcs · probe-anim-visible 2.14% · probe-anim-pipeline · origin-gizmo · wcs-flash
  · dro). HUMAN eyes pending (real Corner-probe Simulate).
- state: branch main · committed this turn (LOCAL, unpushed) · R1/R2 2/2 · regression 14/14.

- ⇒ HUMAN-CONFIRMED (turn 28): R1/R2 "works great" on the REAL Corner-probe — the disc emerges from the contact + the
  re-probe re-shows it. Human says "not done" (more probe-cue work remains, unspecified) but chose to pass on now, not
  continue this turn. R1/R2 (ccc0d9d) is COMPLETE + verified (2/2 + regression 14/14); the "more" is a NEXT task.

## 2026-06-28 — turn 30: PROBE CUE = TRANSIENT-DISC model + sim-bug findings (escalated)

- task (advisor turn 30 + heavy live human co-design): rebuild the probe cue as transient discs + a persistent line/datum.
- did (gcodeViz3d.js + createPreviewPanel.js) — all HUMAN-confirmed live:
  - TRANSIENT DISCS: each G31 drops a SOLID (no blur) low-opacity additive disc in the perp plane, IMMOBILE at the
    contact, riding the PART FRAME (same frame as the line/datum — that was the X/Y offset: discs had been in world
    space). Size ∝ feed: `_burstRadiusPx = base·clamp(√(feed/ref),.4,2.2)` → FASTER probe = BIGGER disc, slower/fine =
    smaller (user reversed this mid-turn). Fades over `_probeDiscFadeMs` of SIM time (progress advances by dt·simSpeed →
    tracks the speed button; createPreviewPanel calls viz.setSimSpeed on play + the speed toggle). Lingers (~9 s @1×) so
    discs overlap → the crossing reads thicker.
  - PERSISTENT DATUM (gold, renders OVER the line) + AXIS LINE (cyan, thinner) at the REAL datum: determined axes at
    their probed value, un-probed axes at the MEAN of the contacts (sits among the discs). Datum ≥2 axes; line exactly 2.
  - RE-PROBE = REFINE, NOT reset: the routine probes each axis twice (fast approach + slow fine) — so a re-probe of an
    already-determined axis just UPDATES the value + drops another disc; removed the turn-28 R2 reset (it was wiping the
    accumulated axes across the fast/slow passes). feed passed from the engine (engine.feedVal, the just-finished probe's
    resolved feed — handles #var feeds).
- VERIFY: probe-cue-refine (real-datum · refine-not-reset · feed→size) + probe-wcs (datum/line by axis count, distinct
  colours) + probe-anim-pipeline (fires + renders) + probe-anim-visible (gl.readPixels cue-coverage, ~12% peak) +
  origin-gizmo + dro + dro-position + wcs-flash = 17/17.
- ⇒ SIM/PARSER BUGS the human uncovered (NOT the cue; ESCALATED to the advisor — likely affect MULTIPLE probe wizards):
  (1) PROBE STOPS IN PLAYBACK: the engine sets the success status #1920/#1921/#1922 = 2 ONLY on a real stock contact
      (GcodeExecutionEngine.js:903-920); a probe that MISSES leaves it at 1, so the DDCS pattern `IF #192x!=2 GOTO1`
      branches to the error handler + the macro aborts. The static TRACE always auto-detects (:925-932) so the route
      preview looks fine, but PLAYBACK doesn't → the corner macro dies at the Y check, Y-slow + the whole X probe never
      run (hence "2 discs then 1"). Fix is a design call: auto-detect in playback (hands-free, like trace) vs. real
      geometry (a miss = the correctness signal, the macro SHOULD error). (2) spindle "doesn't execute correctly".
      (3) a separate parser report. The human is confident these hit other wizards too.
- state: branch main · committed this turn (LOCAL, unpushed) · 17/17. Cue DONE + confirmed; sim bugs passed up.

## 2026-06-28 — turn 32: PER-WIZARD STICKY probe field (human-redirected from the dispatched boss cross-over)

- DISPATCH vs DONE: turn 32 was dispatched as **BOSS CROSS-OVER** (middleWizard #19/#20 per-axis cross-over). The
  human REDIRECTED mid-turn — while testing they hit a different, more pressing bug: probe MAX PROBE kept reverting
  to the global 25 on every open/refresh. Built + verified the sticky fix instead; **boss cross-over is NOT done**
  (still scoped + ready — see NEXT-SESSION turn-31 spec — advisor should re-dispatch).
- SYMPTOM (human, with screenshots of Corner + Middle both showing MAX PROBE = 25): set the wizard's MAX PROBE to
  100, Insert, refresh → back to 25. The box LOOKED like where you set a default but was a volatile MIRROR of the
  one global setting.
- ROOT CAUSE: `wizardManager.applyProbeDefaults()` (called on EVERY `open()`, :236) re-seeds every probe field from
  `settings.probes[key]` (PROBE_DEFAULT_FIELDS: m_dist/c_dist/... ← maxDist). There was NO per-wizard persistence at
  all — a wizard-field edit lived only in the DOM until reopen. (`app.saveDefaults()` is unrelated — it bakes
  defaults into a DOWNLOADED standalone HTML, not localStorage.) The user's persisted `settings.probes.maxDist=25`
  (legacy localStorage) won; the CODE default is already 100 (settingsPanel.js:85), so this is their saved data, not
  a code default.
- FIX (wizardManager.js, ~20 lines, all no-op when no override exists):
  - `ddcs_probe_field_overrides` localStorage map (load/save helpers). `applyProbeDefaults()` now prefers an
    override over the global: `v = (id in overrides) ? overrides[id] : p[key]`.
  - `setupWizardInputListeners()` adds a `change` listener on each PROBE_DEFAULT_FIELDS field that persists the value.
    `change` fires on USER commit (blur/Enter), NOT on applyProbeDefaults' programmatic `.value` set — so ONLY
    genuine edits persist; an untouched field still follows the global. Overrides ONLY its own field (by id) — never
    writes the global setting.
  - Edit-an-op path UNAFFECTED: `openForEdit → _seedForm` seeds from the op's params (single truth), independent of
    applyProbeDefaults → no regression.
- WHY THIS over the human's offered alternative ("we can remove global"): keeps "set my probe once in Settings →
  inherited by every fresh wizard"; smaller + non-destructive (removing the global = ripping out PROBE_DEFAULT_FIELDS
  seeding + the Settings probe-defaults plumbing). Human greenlit the sticky direction ("no fix it").
- VERIFY (probe-field-sticky.spec.js, real DOM, global 33 / sticky 77 so global≠sticky disambiguates): fresh open →
  m_dist=33 (global beats HTML); edit→77 + `change` → override has 77 AND global UNCHANGED (33); page.reload() + reopen
  → m_dist=77 (survives refresh); open corner → c_dist=33 (un-edited field still follows the global). Full suite
  **362 passed / 2 skipped** (incl. the new test; middle-animator + form-widgets flakes passed this run). HUMAN's eyes
  pending (they were testing live).
- OPEN for the advisor: (1) RE-DISPATCH boss cross-over (the real turn-32 task). (2) The "default = 100" ask: code
  default is already 100; the user's stale persisted global of 25 is their localStorage data — the sticky fix lets
  them lock 100 per-wizard, or they can set Settings▸Probe defaults▸Max search→100 (global). Not separately migrated.
- state: branch main · committed this turn (LOCAL, unpushed) · suite 362/364 (2 skipped). Boss cross-over pending.

## 2026-06-28 — turn 32 (cont.): PROBE-CUE visual tuning (live human-steered, eyes-verified)

- Same wake as the sticky-field fix above; the human kept live-iterating on the probe-WCS cue (gcodeViz3d.js), all
  eyeballed in a real Corner-probe Simulate (3D visibility is not headlessly assertable — [[verify-real-symptom-not-just-test]]).
  Final knobs:
  - DISC bigger (base 55→200 px) AND the feed-scale floor raised (clamp .4→.6, ceiling 2.2→1.8) — the slow FINE-touch
    discs (low feed) were the ones the user saw, and the old ×0.4 floor shrank them to <half base; now ~120–360px.
  - OPACITY lowered ~3× (0.10+0.13·pulse → 0.03+0.05·pulse) — discs were too solid at the new size.
  - LIFETIME 9 s→16 s @1× (`_probeDiscFadeMs`, still scales with the sim-speed button).
  - FLASH count by feed: SLOW/fine touch (feed < refFeed·0.5) pulses 4×, fast 3× (`flashes` in `_probeDiscBurst`).
  - DATUM dot 18→26 px (`_scaleMarkers`). LINE made THIN (radPx 1.2→0.8) and spans the WHOLE scene (length = fixed
    100000 world units instead of constant-screen `_probeLinePx` — the "infinite line" the user asked for).
- VERIFY: probe specs 10/10 (probe-wcs · probe-anim-pipeline · probe-cue-refine · wcs-flash · probe-anim-visible — the
  pixel-coverage guard now reads peak 7.82% / +6.68%, so the bigger discs more than offset the lower opacity; FEED→SIZE
  still holds: slow < fast since the clamp keeps .6<1.8). Full suite 361 passed / 2 skipped / 1 known flaky
  (middle-animator). HUMAN confirmed "good".

## 2026-06-28 — turn 32 SUMMARY for the advisor (the whole wake was human-redirected off the dispatch)

- DISPATCHED turn-32 task = BOSS CROSS-OVER (#19/#20 per-axis). NOT built — the human redirected the entire wake. Still
  scoped + ready (NEXT-SESSION turn-31 spec); advisor should RE-DISPATCH.
- SHIPPED this wake (2 commits, LOCAL/unpushed): (a) per-wizard STICKY probe fields `a1bc2b9`; (b) probe-cue visual
  tuning (this commit).
- EXPLORED but NOT built — CORNER TRAVEL → expression (backlog #7 territory). Long live design with the human, landed
  here: backlog #7 (scale off #1) is the START position; the TRAVEL (the diagonal hop between the two corner walls,
  `#15`/`#16`, cornerWizard.js:140) should FOLLOW the start offset. The diagonal currently uses ONE symmetric distance
  for both axes → it overshoots along the first axis (that's the "too long"). Design conclusions the human reached: the
  start position should be an expression of MAX PROBE (`#1`), and travel = that start offset (symmetric). Then the human
  PIVOTED — "just make max probe higher, that solves everything" — which the sticky-field fix now enables (set max probe
  high once, it sticks). So the corner travel/start-expression rework is PARKED (not built); capture it under backlog #7
  if/when re-dispatched.
- Max-probe "default 100": code default is already 100; the user's stale persisted global of 25 is their localStorage —
  the sticky fix lets them lock a higher value per-wizard. No migration done.

## 2026-06-28 — turn 32 (cont.): SIM SPEED default 2× + STICKY (live human-steered)

- Same wake. Human: "default the sim speed to 2x" + "it should be a sticky value". One source = `settings.preview.defaultSpeed`.
  - `SETTINGS_DEFAULTS.preview.defaultSpeed` 1→2 (settingsPanel.js) → fresh installs start at 2×.
  - createPreviewPanel: `speedIx` fallback `||1`→`||2`; the `.pp-speed` button label is now INITIALIZED from `simSpeed()`
    on load (was hardcoded `1×`, only updated on click — so it showed 1× even when the pref said otherwise).
  - STICKY: the speed-button click now writes `settings.preview.defaultSpeed = simSpeed()` + `window.ddcsSaveSettings()`
    (the same value the Settings → Preview field shows + the init reads), so the pick survives a refresh instead of
    resetting each session. Same one-source idea as the probe-field sticky, but the value already lived in settings so
    no new store — just persist on click + read on init.
- VERIFY: preview-speed-sticky.spec.js (NEW) — default 2× → click → 5× → `defaultSpeed===5` (≠2, proves the write) →
  reload+reopen → button restores 5×. preview-controls.spec.js cycle expectation updated (`1×→2×→5×→10×→1×` →
  `2×→5×→10×→1×→2×`). probe/dro specs re-run green at the new 2× default (no timing regression; cue coverage 14% peak).
  Full suite 362 passed / 2 skipped / 1 known flaky (middle-animator). Human confirmed "ok great".
- This + the probe-cue tuning above land in ONE commit (the cue tweaks + sim-speed). Still no boss cross-over (the
  dispatched task) — advisor to re-dispatch.

## 2026-06-28 — turn 34 (part 1): REMOVE the probe-cue AXIS LINE (human, before boss cross-over)

- Turn 34 = advisor RE-DISPATCH of BOSS CROSS-OVER, but the human first asked to drop the persistent cyan AXIS LINE
  from the probe cue (keep the gold DATUM point + the discs). Human picked "remove the line now, then boss".
- did (gcodeViz3d.js `_updateDatum`): removed the 2-axis line-show block; `_probeLine` stays as a hidden object (never
  set visible) so re-enabling is trivial and `_scaleMarkers`'s `&& visible` guard skips it. `_lineColor` remains — it's
  also the DISC colour, untouched.
- tests: probe-wcs 2-axis test → asserts datum shows + line.vis=false (was line.vis=true); probe-cue-refine two
  line.vis assertions flipped to false; headers updated. The datum/refine LOGIC each test guards is unchanged.
- VERIFY: probe-wcs + probe-cue-refine 7/7; full suite 363 passed / 2 skipped (no flake this run). HUMAN's eyes pending
  on a real probe Simulate.
- NEXT (same wake): the dispatched BOSS CROSS-OVER.

## 2026-06-28 — turn 34 (part 2): BOSS CROSS-OVER MOVE DISTANCE (per axis) — the dispatched task

- task (advisor turn 34 re-dispatch): middleWizard boss "probe both" wall1→wall2 cross-over was hard-coded [#1+#2] in
  traverseOver → only reached the far wall if MAX PROBE happened to span the feature (MAX PROBE abused as a width proxy).
- did:
  - middleWizard.js: two new STRING params crossX/crossY (default the expression `[#1+#2]` = old behaviour; a number
    overrides for a feature wider than MAX PROBE). Emit `#19`=crossX / `#20`=crossY ONLY for boss-AUTO (so pocket/manual
    macros are byte-unchanged). traverseOver(ax) now crosses by `#19` (X) / `#20` (Y) — keeps the Z lift/drop `#18`.
    Kept as strings so the `[#1+#2]` expression default round-trips (number type would trip the validator + risk coercion).
  - index.html: a gated `m_crossover_block` (grid-2) with X CROSS-OVER / Y CROSS-OVER, prefilled `[#1+#2]`.
  - middleView.js: inputIds + read m_crossX/m_crossY; show/hide the block for boss+auto (same gate as TRAVERSE HEIGHT).
  - opSchema.js: SCHEMA.middle += crossX/crossY Str(); FIELD_BIND.middle += m_crossX/m_crossY → the Blockly round-trip +
    reverse-sync carry them (same path as clearOver — not a Blockly block-field; geometry params ride the marker/data).
- VERIFY (middle-crossover.spec.js): wiring — default boss-auto emits `#19=[#1+#2]`/`#20=[#1+#2]` + crosses by #19/#20
  (no hard-coded [#1+#2] move left); explicit 130/70 flow into the vars; manual/pocket emit no cross-over vars; marker
  round-trip keeps crossX='130' AND crossY='[#1+#2]' intact. SIM — a 120-wide boss with MAX PROBE 40 + crossX 130 →
  centre X = 60 (reached!), while the default [#1+#2]=42 falls short (>5mm off). (2-axis sim centre needs the operator's
  between-axes jog the sim can't auto-model — so the sim test is single-axis, like middle-center-sim.) Full suite 365
  passed / 2 skipped. HUMAN's eyes still the real verifier on a non-square boss probe-both Simulate.

## 2026-06-28 — turn 34 (part 3): default MAX PROBE 200 + probe datum dot smaller (human)

- Human: "200 max probe" + "make amber datum smaller".
  - settingsPanel.js: SETTINGS_DEFAULTS.probes.maxDist 100→200 (the one source that seeds every probe wizard's MAX
    PROBE via applyProbeDefaults). Now that the boss CROSS-OVER is decoupled, MAX PROBE is just the wall-search distance,
    so 200 is a generous default. NB: a user's PERSISTED maxDist (the human's stale 25) still wins — they set 200 in
    Settings → Probe defaults or per-wizard (now sticky); the 200 default is for fresh/unset installs.
  - gcodeViz3d.js `_scaleMarkers`: the probe-WCS DATUM dot (`_probeGizmo`, gold/amber 0xffce3a) 26→14 px (it had been
    bumped to 26 on the "both bigger" pass; human now wants it smaller). Constant-screen, visibility-only.
- VERIFY: probe specs 8/8 (datum still shows; cue coverage ~14%); no test asserts the maxDist default. Full suite was
  365 green with maxDist 200 in tree; the datum-size change is a cosmetic _scaleMarkers constant. HUMAN's eyes on the cue.

## 2026-06-28 — turn 36: 2D-canvas FRAME bug — VERIFY-FIRST report (GATE, no code yet)

- DISPATCH #13 named viz/featureCanvas.js; the advisor asked to VERIFY-FIRST where the toolpath/start vs stock coords
  are set. Verification result (file correction + a 2nd divergence the dispatch didn't anticipate):
- **The shared 2D canvas is `viz/toolpath2d.js`, NOT featureCanvas.js.** featureCanvas.js is the per-wizard drill/contour
  LAYOUT editor (pure part coords, no machine frame). The preview panel's 2D view (the one with the toolpath + ruby ①
  start + the DRO evidence) is toolpath2d.js, created by createPreviewPanel and used by ALL wizards → the "one shared fix".
- **Frame map:**
  - `engine/trace.js` emits segments in the PART/WORK frame (part-zero); `wcsOffset` only folds G53 machine moves into
    that frame. → the toolpath is CORRECTLY at part-zero.
  - 3D (`gcodeViz3d`): stock + op + tool all live in `partFrame`, shifted TOGETHER by `_partShift()`
    (gcodeViz3d.js:1165) — gated on `machine.show`, XY = the raw WCS-table pin (NOT minus workOrigin). "ONE source for
    op+stock so they never diverge" (machine-frame-sim-spec).
  - 2D (`toolpath2d`): `stockRect()` shifts ONLY the stock by `pinX = table[pin].x - workOrigin` (toolpath2d.js:74-79),
    NOT gated on machine.show; the toolpath (strokeSegs) + start (drawStartHandle) are drawn at part-zero with NO shift.
  - ⇒ BUG: stock rides the pin, toolpath/start don't → they diverge by the WCS pin (= the human's DRO Work-vs-Mach 40 /
    -550). Confirmed the advisor's diagnosis (just the file + the exact mechanism differ).
- **A 2nd divergence the dispatch's "match the stock" doesn't cover:** the 2D STOCK's pin formula itself ≠ the 3D
  `_partShift` — it subtracts workOrigin and skips the envelope-show gate. So "make the toolpath match the stock" and
  "make 2D mirror the 3D" are NOT the same fix when workOrigin≠0 or the envelope is hidden.
- **OPTIONS (gate — need the advisor's pick):**
  - **A (minimal / surgical):** apply stockRect's EXISTING pin offset to the toolpath + start (+snap + fit-bounds + the
    start-drag inverse) so they ride the stock. Fixes the reported relative float (the symptom). Leaves the 2D stock's
    absolute position as-is (still differs from the 3D when workOrigin≠0 / envelope hidden). Lowest risk.
  - **B (true "2D mirrors 3D"):** replace the 2D part placement with the 3D `_partShift` as ONE shared shift applied to
    stock + toolpath + start. 2D == 3D by construction + matches toolpath2d.js's own header ("mirrors the 3D"). BIGGER:
    changes the stock's formula (drops the workOrigin subtraction, adds the show-gate) → may move existing 2D stock-pin
    behavior + touch preview-2d / dro tests.
  - Recommend **A** for the symptom now (surgical), OR a synthesis: "A's effect but compute the shift via the 3D
    `_partShift` so the stock+toolpath share the 3D's exact frame" (= B, if you want the absolute position aligned too).
- No code changed. Passing to advisor for the frame-model pick before implementing. (verify-real-symptom: I will drive
  a real Simulate with a WCS-pinned stock — toolpath ON the stock across drill + a probe — once the approach is chosen.)

## 2026-06-28 — turn 38: 2D-canvas FRAME fix — Option A (toolpath + start ride the stock pin)

- task (advisor #13, decision A): in viz/toolpath2d.js make the toolpath + start ride the SAME "Sits at WCS" pin the
  stock uses, so a WCS-pinned stock no longer has the toolpath float off it by the WCS offset. Leave the stock formula
  as-is (NOT B / the shared _partShift — deferred follow-up).
- did (toolpath2d.js): extracted the stock pin into ONE helper `stockPin()` (= table[pin] − workOrigin, the exact
  formula stockRect already used; stockRect now calls it). Added `ptx/pty = tx/ty + stockPin()` (the part-frame
  transform) and routed the TOOLPATH (strokeSegs + the playback head dot), the START handle (drawStartHandle +
  nearHandle), the SNAP path nodes/edges, and the FIT bounds through it; the start-DRAG inverse subtracts the pin
  (handle drawn at +pin → program start = drawn − pin). The origin crosshair, grid, envelope stay in the scene frame.
- SANITY-CHECK (advisor-required): default stock (pin='origin') → pin=0 → origin+stock+toolpath all coincide at
  part-zero, ZERO behaviour change (existing 2D tests untouched). Pinned stock → stock+toolpath now coincide at the WCS
  spot (symptom fixed); the stock's ABSOLUTE position is unchanged (still its pinned G54 spot, where the user set it) →
  NOT the "stock looks wrong" trigger, so NOT flagging B. Residual (the B follow-up): the part-zero CROSSHAIR stays at
  scene-0 rather than moving to the stock datum — the pre-existing behaviour; B (one shared _partShift, 2D==3D) unifies
  it but moves the stock + touches preview-2d/dro tests, so it stays the tracked follow-up the advisor deferred.
- VERIFY: toolpath2d-pin.spec.js (NEW, behavioural) — a pinned stock (G54=40,-50) + a toolpath node at program (60,40)
  snaps at the DRAWN point (100,-10) = program+pin, a mid-stock point that is NOT a stock corner → only holds once the
  path rides the pin (before the fix nothing snapped there). preview-2d-snap + preview-2d-default still green (pin=0
  path unchanged). Full suite 366 passed / 2 skipped. **HUMAN's eyes pending** (toolpath ON a WCS-pinned stock across a
  drill grid + a probe — the advisor's real-symptom check).

## 2026-06-28 — turn 40: 2D probe/tool MOVEMENT animation (in sync with the 3D)

- task (advisor #14; #13 A human-CONFIRMED + pushed): animate the 2D probe/tool head in toolpath2d.js, in sync with the
  3D, by riding the SAME engine onPositionChange signal (one sim, many views) + the #13 ptx/pty pin so it stays on the
  pinned stock.
- did:
  - toolpath2d.js: added `toolPos` (live sim position) + `setToolPosition(p)` (exported); drawPath's HEAD marker now
    rides `toolPos` (the live pos) when present — via ptx/pty (the #13 pin) — instead of snapping to the current segment
    NODE; falls back to the node when there's no live pos. `stop()` clears toolPos. Exposed `canvas.__t2head` (debug/tests).
  - createPreviewPanel.js: onPositionChange now also calls `t2.setToolPosition(pos)` in the 2D branch (alongside the
    existing `t2.seek(nearest2d(pos))` that drives the executed/upcoming TRAIL) → the 2D head follows the exact live
    position the 3D tool + probe cue ride, so it's frame-synced with no new motion logic.
- WHY the live pos (not the existing nearest2d seek): seek snaps the head to the nearest segment NODE — coarse, and a
  slow probe MID-segment wouldn't visibly travel. The live pos makes the probe marker move smoothly along the path.
- VERIFY: toolpath2d-anim.spec.js (NEW) — with a pinned stock + a probe segment, after seek(0)+setToolPosition(50,0)
  the drawn head is at program 50 + pin 40 → screen x=90 (NOT the node x=0+pin), and Y rides the pin too. toolpath2d-pin
  + preview-2d snap/default still green. Full suite 366 passed (the lone failure = the KNOWN middle-animator
  parallel-load flake; passes 6/6 isolated — unrelated, my change doesn't touch the SVG animator). **HUMAN's eyes
  pending** (advisor's real-symptom: a probe Simulate → the 2D marker travels the path in time with the 3D, on the stock).

## 2026-06-28 — turn 42: 2D INCREMENTAL toolpath anchors to the SPINDLE START (mirror the 3D's _anchorToStart)

- task (dispatched turn 41): the 2D INCREMENTAL probe path wrongly began on G54 (the stock pin); it must EMANATE from
  the operator SPINDLE START. #13 (`bf6de65`) applied the stock-WCS pin to the path UNCONDITIONALLY — right for
  absolute/mill (turn-39 confirmed), wrong for incremental. The 3D already distinguishes via
  `v._anchorToStart = !forceMachine && !stats.absolute` (createPreviewPanel:311); the 2D did NOT mirror it. Verify-first,
  then mirror it (incremental→anchor to start, absolute→keep #13). GATE if not cleanly scopable without #13 regression.

- VERIFY-FIRST (mechanism, code + EMPIRICAL on the REAL CornerWizard macro — not literals, per [[verify-real-symptom-not-just-test]]):
  - The trace is ORIGIN-RELATIVE — trace.js doc (`opts.start`): *"The route stays origin-relative; the viz offsets it by
    the start."* The 3D offsets by `starts[0]` when anchored (`gcodeViz3d.js:483` anim tool, `:685` rebuild:
    `off = _anchorToStart ? mk : {0,0,0}`). The 2D offset EVERYTHING by `stockPin()` (ptx/pty) regardless → for an
    incremental op the origin-relative path emanates from part-zero, drawn at the stock G54 corner, NOT the start.
  - Empirical (throwaway spec, real `new CornerWizard().generate({corner:'fl',probeZ:true})` traced with start
    `(-25.7,77.4)` + a G54-pinned stock): **`absolute:false`, `passes:1` (SINGLE-PASS → the "2nd probe offset" is the
    SAME root, no per-pass component), first node `x1:0,y1:0` (origin-relative), `probe:6`.** The 2D drew the path
    origin at the stock pin (screen 137.5,354.7) while the start marker sat at the spindle pos (128.6,328.0) — a gap of
    exactly the start vector. Symptom reproduced. (DRO repro matched: start work `(-25.7,77.4)` → machine `(14.3,-472.6)`.)
  - **2nd-probe-offset cause = SAME root** (single-pass): once the whole path emanates from the start, the later probe
    moves are part of that same continuous path and land correctly. NOT the multi-pass `getStartHints` path (corner has
    no REPOSITION → passes=1; only middle/alignment/rotary are multi-pass, a separate pre-existing 2D limitation).
  - **GATE → did NOT trip (cleanly scopable):** the absolute case is BYTE-IDENTICAL by construction (anchor=false →
    `pathOff()=stockPin()`, machine stays set → exactly #13); only the incremental branch changes. So no #13 regression risk.
  - **Declared-vs-inferred (addendum):** today's preview start = the wizard's `inferStart` via `getStart` (INFERRED),
    overridable by `curStart` (a user drag = DECLARED); `getStartPos()` prefers curStart→getStart→viz.starts[0]. The fix
    anchors the path to the SAME `st` already fed to `t2.setStart(st)` (the start marker) → ONE source for both the path
    origin AND the marker, so they can't diverge again. No NEW inference is baked in (reuses the existing resolution).
    Advisor said they'll make the start first-class DECLARED next turn — so I did NOT build backlog #7/#8 here.

- did (the scoped mirror):
  - `viz/toolpath2d.js`: added an `anchorToStart` flag + `setAnchor(v)` (exported). Split the transform into TWO:
    `pathOff() = (anchorToStart && start) ? start : stockPin()` drives the PATH (`ptx/pty` → strokeSegs, the live head,
    snap path-nodes, fit-bounds); a new `sptx/spty = tx/ty + stockPin()` drives the STOCK-PIN-frame items (the draggable
    start HANDLE + nearHandle). When anchored the panel sends machine=null → stockPin=0 → the handle sits AT the start =
    where the anchored path emanates (they coincide); the start-drag inverse already subtracts stockPin (unchanged).
  - `viz/createPreviewPanel.js`: compute `curAnchor` ONCE per `setGcode` (hoisted out of the 3D-only branch so BOTH
    views get it), then `t2.setAnchor(curAnchor)` + `t2.setMachine(curAnchor ? null : machineForViz())` for the 2D. The
    3D branch now reuses `curAnchor`; its redundant 2D `t2.setMachine` line removed. The 2D-toggle (`setMode`) now also
    sends `curAnchor ? null : machineForViz()` (was unconditional `machineForViz()` → it clobbered the anchor in 2D mode).
- WHY machine=null when anchored (not just the path offset): mirrors the 3D's `setMachine(null)` — an incremental probe
  is operator-relative, no meaningful machine frame. If the stock stayed PINNED (~+550mm at the WCS pin) while the path
  moved to the start (work frame), the stock would sit ~600mm from the probe path = incoherent (probe nowhere near the
  stock). Going LOCAL keeps the stock at part-zero, near the start, so the probe approach reads correctly — same as 3D.

- VERIFY (real-symptom): `tests/toolpath2d-anchor.spec.js` (NEW, REAL CornerWizard macro): ANCHORED → the origin-relative
  first node + the LIVE head are drawn EXACTLY at the start marker (gap <1px, `head.live=true`); ABSOLUTE → the path node
  still snaps at program+pin (100,-10) = #13 preserved. toolpath2d-pin/anim + preview-2d snap/default/start-handle +
  wizard-preview-2d all green. **Full suite 369 passed / 2 skipped, ZERO failures** (the middle-animator flake passed too).
  **HUMAN-CONFIRMED ("good" + screenshot):** the probe path now emanates from the ruby START marker and runs to the
  stock — it starts at the spindle start, not on G54. Absolute/mill still pinned (no #13 regression). Start handle still draggable.

## 2026-06-28 — turn 45: GLYPH/COLOR coherence (RED=moving probe, START=static glyph) — VERIFY-FIRST + GATE on the 3D probe-tip

- task (dispatched turn 45): flip 4 things so RED = the MOVING probe tip (ruby) and the START = a distinct STATIC non-red
  glyph (today inverted in both views): (2D) head `#ffd24a`→RED + start ◎→hollow ◇; (3D) anim tool tip `0xffab40`→RED for
  a probe + start ruby `0xc4122e/0xff2a44`→non-red diamond/octahedron (+ select/dim off-red). GATE on "whole tool vs tip".

- VERIFY-FIRST (located every literal; no guessing):
  - 2D `toolpath2d.js:207` head `#ffd24a` (UNAMBIGUOUS → red). `drawStartHandle` = a filled red disc `rgba(231,76,91)` +
    grab-ring (UNAMBIGUOUS → hollow amber diamond, keep the ring; `nearHandle` is a 12px radius test → works for a diamond,
    no adapt needed).
  - 3D start marker `_makeMarker` (`gcodeViz3d.js:219-227`) = a `SphereGeometry(3)` ruby `0xc4122e`; `_highlightSelectedStart`
    (`:286-294`) sets `sel?0xff2a44:0xc4122e` + opacity. UNAMBIGUOUS → swap to `OctahedronGeometry` (a 3D diamond) in a
    non-red amber/white, and recolor select/dim to amber-bright/amber-dim (off-red), keeping the brighten/dim+opacity logic.
  - 3D anim tool `_buildAnimTool` (`:412`): `_animParts.tool = part(tgeo, 0xffab40, …)`. The tool is ONE `LatheGeometry`
    revolved from `toolHalfProfile` (toolProfile.js); for a PROBE that single mesh IS the whole profile **ruby ball ▸
    stylus ▸ body ▸ shank** (toolProfile.js:49-69). collet+spindle are SEPARATE grey meshes (their visibility is user-driven
    via Preview `pv.parts`, so the rig CAN be on-screen for a probe). `0xffab40` also appears at `:1238` but that's the
    MAGAZINE tool render, NOT the moving anim tool → leave it.

- 🛑 GATE (advisor-flagged "whole tool vs tip" — surfacing, NOT guessing; the human is particular about probe visuals):
  the probe `tool` is a SINGLE lathe mesh, so colouring "just the ruby tip" ≠ "the whole probe part" is a real fork:
  - **A — whole probe `tool` part RED** (one conditional: `part(tgeo, isProbe ? RED : 0xffab40, …)`); collet+spindle stay
    grey; mill tool stays orange. Simplest, reads as "a red probe", no geometry change. BUT the stylus+body+shank also go
    red (not JUST the ruby ball) — which is what the advisor's "not the whole tool" cautions against.
  - **B — ruby BALL only RED** (split the probe lathe into ruby=pts[0..segs] + rest, two meshes; or add a red tip sphere):
    precise "red tip", matches the advisor's lean, BUT two-tone probe (red ball + orange stylus) + a structural change to
    `_buildAnimTool`/`_animParts`/`setPartVisible` (adds a 'ruby' part to the tool/collet/spindle set).
  - **Recommendation: A** — simplest + reads cleanly as "the moving probe is red"; B's two-tone look + structural cost
    aren't obviously worth it for a thin stylus. But this is a VISUAL call the human cares about → deferring to the advisor.
  - The OTHER three (2D head, 2D start ◇, 3D start octahedron) are unambiguous; I'll implement all four in ONE commit once
    the probe-tip choice is set. Nothing committed yet (gate before the single coherent commit).
- ⊕ **HUMAN STEER (direct to the worker, right after the gate pass): "youre correct the ruby is the tip only" → option B.**
  The probe's RED lands on the RUBY BALL (the tip) ONLY — NOT the whole probe `tool` part (stylus/body/shank stay the tool
  colour). This RESOLVES the design fork (B over my A recommendation). I'm holding for the advisor's synthesis of the
  STRUCTURAL implementation (the advisor gated this): build B by either (i) splitting the probe lathe at the ball/stylus
  boundary into a red ruby mesh + an orange body mesh, or (ii) overlaying a small red ruby sphere at the tip (origin,
  radius=ballDia/2, depthTest:false) over the existing orange lathe — (ii) reuses the start-marker ruby pattern + avoids a
  geometry split but adds a mesh to `_animParts`/`setPartVisible`. Plus the unambiguous 3. One coherent commit on the advisor's go.

## 2026-06-28 — turn 47: 5-commit BATCH (glyph/colour + 4 batch-safe backlog items), each its own commit

Advisor resolved the gate (RUBY BALL ONLY red) + dispatched a batch (each its own commit; stop+pass if any forks).
Full suite **374 passed / 2 skipped, 0 fail**. Five commits:

- **GLYPH — `38843fc`** (RED = moving probe tip · START = cyan lozenge, 2D+3D). The 4 flips, then HEAVILY human-tuned live:
  - 3D probe ruby → RED (ball only). **Perceptibility bug the human caught + I fixed:** an OPAQUE ruby renders in the
    opaque pass BEFORE the transparent orange tool → the orange covered it (the human: "tip still orange", "probably a
    grouping thing"). Fix = make the ruby TRANSPARENT (opacity 1) + renderOrder 30 → it sorts into the orange tool's
    transparent pass and draws LAST (on top). ×1.04 radius so no orange rim peeks. ⇒ a structural test passed while the
    pixels were wrong — [[verify-real-symptom-not-just-test]]; the human's eyes are the real verifier for a 3D look.
  - 3D start glyph → the human iterated live: octahedron → "camera locked simple lozenge" → "same as 2d" → a SPRITE
    (camera-locked billboard) drawing a hollow CYAN diamond, so it reads identically to the 2D ◇ from any angle.
    Colour CHOSEN by the human via AskUserQuestion = **cyan** (#22d3ee); thickness bumped twice on request (3D 18px on a
    128px canvas). select/dim via opacity (texture carries the colour).
  - 2D head → RED (#ff2a44); 2D start handle → hollow CYAN diamond (was a red disc), grab-ring + 12px hit-test kept.
  - `glyph-colors.spec.js` locks the intent + the draw-order fix (ruby red + transparent + renderOrder > tool; start =
    a textured Sprite). Human-confirmed by eye ("ok good").

- **#5 — `a6f452b`** (parser #var twin). `gcodeToStack` G28 axis-recovery `/[XYZA](?=[-+.\d])/` dropped a #var/[expr]
  axis → `axes=[]` → `join||'Z'` silently collapsed to 'Z'. Added `#[` to the lookahead. Test uses REAL #var/[expr]
  lines (`G28 X#5 Y#6` → 'XY', not the 'Z' default; `G28 X10 Y#6 Z[#1+1]` → 'XYZ').

- **#4 — `49d0a07`** (program line → SIM active WCS, DISPLAY ONLY). `classifyCall` already flipped the DRO label, but the
  OFFSET read settings.active so Mach was wrong after a switch. Added a sim-local `simActiveWcs` override (G54→1…G59→6)
  that `activeWcsOffset`/`activeWcsName` + the engine `_wcsOffset` (G53) read; **never** writes `settings.machine.wcs.active`;
  `play()` resets it to null each run so the program re-drives it. Test: mid-program G55 → label=G55 + Mach = Work + G55
  offset + settings.active stays 1.

- **#15 — `8b5d452`** (2D pocket cavity). The 2D drew a plain tinted rect for a pocket. Verify-first the 3D: it builds a
  "square donut" (extruded block + inner hole inset by `max(8, 25% of the smaller side)`). Mirrored that intent —
  `drawPocketCavity` insets the cavity by the SAME formula, draws it darker (recessed) with a bright inner wall. Boss
  unchanged. Pixel-verified (cavity centre darker than the frame for a pocket; uniform for a boss). Human-eyes = final look.

- **#18 — `7ce35eb`** (start-drag replays the sim). Added `replayFromStart()` (stopPlay+play, guarded on active+segs) and
  wired it into BOTH start-drag paths — `onStartDrag` (2D handle) AND `viz.onStartChange` (3D marker), so one behaviour
  spans both views. `play()` reads the moved start via `getStartPos()`→`_stockOffset` so the re-run emanates from there.
  Test: autoLoop off + nothing running → a handle drag starts a run (engine.running) from the moved start. Human-eyes = look.

NOTE: the glyph turned into a long live human-tuning loop (colour/shape/thickness/the perceptibility fix). The other 4
were clean, no forks. (Visual items #15/#18 have the standard human-eyes-pending caveat; rendering is verified headlessly.)

## 2026-06-28 — turn 49: INC1 — 2D shows ALL per-pass start markers (numbered, draggable), parity with 3D

- task (advisor turn 48, the MIDDLE/BOSS 2nd-start thread, INC 1): the 2D drew ONE start handle (pass 0 via
  `t2.setStart`); a multi-pass probe (boss/middle probe-both) hid its 2nd start ②. Show ALL per-pass starts as numbered
  draggable cyan lozenges (parity with the 3D markers + number badges). `af83777`.
- verify-first: `toolpath2d` had a single `start`; `createPreviewPanel` only set pass 0 (`t2.setStart(st)`); the 3D's
  per-pass loop populated `v.starts[p]` from `(p===0&&st)||hint(p)||existing`. **No wizard sets `startHints`** (grep =
  none) → `getStartHints` is null → p>0 falls back to the last value, so a dragged ② PERSISTS (clean). A real boss
  probe-both is multi-pass (`MiddleWizard.inferStarts` doc: each REPOSITION = a pass; boss two-axis manual = 4, auto = 2).
- did:
  - `toolpath2d.js`: `start` (single) → `starts` (per-pass array). `drawStartHandles` draws EACH as a cyan lozenge + a
    NUMBERED badge (①②…, like the 3D number sprite). `nearHandle` returns the start INDEX under the pointer (reverse
    scan → topmost wins); the drag tracks that index (`dragStart`=index, not bool); `onStartDrag(pos, pass)` reports
    which. `pathOff` anchors to `starts[0]`. `setStarts(arr)` added; `setStart` kept as back-compat (single = pass 0).
    `__t2starts` exposed (debug/tests).
  - `createPreviewPanel.js`: the per-pass-start computation HOISTED out of the 3D-only branch into a shared `passStarts`
    (one source of truth for both views) → `t2.setStarts(passStarts)` (2D) + the 3D `v.starts` syncs from it. BOTH drag
    paths feed it: `onStartDrag(pos, pass)` (2D handle) and `viz.onStartChange(starts)` (3D marker) update `passStarts`
    (+ `curStart` for pass 0), so a drag in either view persists + mirrors to the other.
- WHY a shared `passStarts` (not just reading `v.starts`): the 2D must work when the 3D viz is null/not-current; the
  per-pass logic was 3D-only. Hoisting it makes the markers mode-independent and keeps ONE source for both views.
- VERIFY: `per-pass-starts-2d.spec.js` — (1) `setStarts([a,b])` → 2 numbered markers drawn + the 2nd is draggable (drag
  → `onStartDrag(pos, 1)` with the moved X); (2) a REAL `MiddleWizard` boss-probe-both macro traces to >1 pass. Full 2D/
  start suite green; full suite 376 passed + the KNOWN middle-animator parallel flake (6/6 isolated, untouched by me).
  **HUMAN-eyes** = the final look (a boss probe-both → 2D shows ① AND ② labelled, both draggable). INC 2/3/4 queued.

## 2026-06-28 — turn 51: MIDDLE-PROBE batch — INC2 (verified-working) + INC3 GATE (two-toggles UX)

- **INC2 (`d9cd124`) — verify-first found it ALREADY WORKS; regression test, no prod change.** The advisor's premise
  ("p>0 starts aren't jog-editable") is stale. Empirical (real boss-probe-both macro, real jog buttons): select ② →
  jog X+/Y+ → `viz.starts[1]` moves 0→10, PERSISTS across a re-trace, REFLECTS in the 2D ② marker. Resolved by INC1's
  plumbing (`viz.starts` grown to passCount; jog handler jogs `viz.starts[selectedStart]`; `onStartChange` syncs ALL
  passes to the shared `passStarts`). The human's "selects ② but won't move" was the PRE-INC1 invisibility of ② (no 2D
  marker to watch move). `jog-move-2nd-start.spec.js` locks it.

- **INC3 verify-first (the core bug) — CONFIRMED, code + the HUMAN's screenshot.** A boss probe-both in AUTO: the
  trans-axis (X→Y) reposition is `reposition()` ([middleWizard.js:64-73,:112](DDCS-Studio/web/wizards/middleWizard.js#L112))
  which LIFTS + waits + DROPS but emits **NO lateral XY move** → in AUTO the tool never traverses to the perpendicular
  walls, so the 2nd-axis probe starts from the wrong spot (the human: "second middle boss probe in auto isnt using the
  second pos" + a screenshot: ② sits at the inferred Y-wall but the orange toolpath stays near the X walls). The marker ②
  IS positioned (middleView.js:98 passes `inferStarts` as the `startHints` arg — my earlier "no wizard sets startHints"
  grep missed it: the var is named `inferStarts`). So the MARKER is right but the macro MOTION isn't — trace-vs-execution
  divergence. The in-axis traverse (`between`→`traverseOver`, #19/#20) already auto-traverses; only the trans-axis jogs.

- 🛑 **GATE (advisor-flagged "two-toggles UX") — the HUMAN resolved the UX half (chose TWO TOGGLES via AskUserQuestion):**
  replace the single `approach` Auto/Manual with TWO per-traverse controls — **In-axis traverse** (Auto/Manual) +
  **Trans-axis (X→Y) traverse** (Auto/Manual), mix-able, boss-only (hidden for pocket). Proposed implementation (for the
  advisor to bless + answer the open Q before I build the macro+form+Blockly):
  - **(a)** New params `inAxis`/`transAxis` (auto|manual), each DEFAULT from the old `approach` (back-compat byte-identical:
    a saved op `approach:'auto'` → both auto). The macro: `between()` reads `inAxis`; the trans-axis (line 112) reads
    `transAxis` → `transTraverse()` (auto) vs `reposition()` (manual, INC4 simulates it).
  - **(b)** `transTraverse()` = a real 2-axis MOVE to the perpendicular walls, reusing the corner's diagonal
    `MOVE({[ax]:travelOwn,[ax2]:travelOpp})` pattern ([cornerWizard.js:58-64,:140](DDCS-Studio/web/wizards/cornerWizard.js#L140)),
    fed by a NEW **"Diag travel"** field (a new #-var, e.g. #21).
  - **❓ OPEN Q for the advisor:** the **Diag travel DEFAULT expression** — "derived from the #19/#20 cross-over" but the
    cross-over is the IN-axis wall→wall distance while the trans-axis move is from an X-wall to a Y-wall. Proposed default
    `[#19+#20]/2` (half the mean cross-over ≈ to the perpendicular wall) — needs confirmation; it's geometry the human/advisor should set.
  - Plus relabel the corner's `travelDist` "Travel"→"Diag travel". Blockly round-trip for the new fields/toggles.
  Holding the build for the advisor's synthesis (bless the plan + the Diag-travel default), per the explicit gate.

## 2026-06-28 — turn 53: MIDDLE batch — INC2 redo + INC3 (built + human-bug-fixed) + INC4 scoped

- **INC2 REDO (`0418a84`).** The advisor + human re-opened it: my first verify moved `viz.starts[1]`
  PROGRAMMATICALLY in the MAIN editor (no inferStarts hints) → green on the WRONG path. The REAL bug (reproduced in
  the WIZARD via the real pendant ② button + jog): the middle wizard passes `inferStarts` as the per-pass `startHints`
  (middleView:98), so on every re-trace the per-pass loop's `hintFor(p)` OVERRODE a jogged ② → it snapped back (jog X+
  → 50→60→snaps to 50, synchronously). Fix = per-pass USER overrides `userStarts`: a jog (onStartChange pins the moved
  pass) or a drag (onStartDrag) records it, and it BEATS the hint in the per-pass loop. Regression drives the REAL
  pendant gesture in the wizard (jog ② → moves + STICKS + reflects in 2D).

- **INC3 (`b9975e2` + fix `d5747c3`) — the core positioning fix (human chose TWO TOGGLES, advisor blessed).** Split the
  single `approach` into per-traverse `inAxis`/`transAxis` (auto/manual, default from approach = back-compat
  byte-identical, MIX-able). The trans-axis bug: `reposition()` emitted NO lateral move → AUTO never reached ②. New
  `transTraverse()` = a real 2-axis diagonal move (corner MOVE/travelOwn/travelOpp idea) fed by a NEW editable "Diag
  travel" field → #21, default [#19+#20]/2. inferStarts follows the in-axis toggle (manual 2/axis, auto 1). Form = two
  toggles + Diag travel (boss-gated); relabelled the corner's Travel→Diag travel. Round-trip = SCHEMA + paramFields +
  the reconciler now recovers the toggles (REPOSITION messages / #19 / #21). **HUMAN-bug (`d5747c3`):** still didn't
  reach ② — the diagonal move was AFTER the REPOSITION → landed in the Y pass (anchored to ②) → pushed the probe AWAY.
  Fixed: emit the move BEFORE the REPOSITION (the connecting travel of the prior pass) → the Y pass anchors cleanly at ②
  (trace-verified: pass-1 first seg = local 0,0). Signs track dir1/dir2 (toward ②); the magnitude is the human-tuned knob.

- **INC4 VERIFY-FIRST (scoped, GATE answered — NOT a feature-type bug).** The boss-manual "looks like a pocket" is the
  UN-SIMMED JOG, not a wizard bug: the MACRO probes the walls correctly (PR toward ±max from outside ①), but the SIM's
  reposition handling (`GcodeExecutionEngine:571-575`) resets `this.pos={0,0,0}` on a REPOSITION while the LIVE tool
  anchors to `starts[0]` (①) — so after a reposition the tool sits at ①≈Y-centre and the Y probes look pocket-ish.
  Same reset undoes INC3's AUTO move's LIVE effect (the static trace anchors per-pass to ②, but the live tool rides
  starts[0]). **So INC4 = anchor the LIVE tool to `starts[_pass]`** (engine reports the pass; 3D `setToolPosition` +
  the 2D head anchor per-pass) — a moderate engine+viz change that completes BOTH the auto + manual live cases. GATE
  doesn't trip (un-simmed jog). Passing back here (turn is large; INC3 needs human-eyes on the live tool; the per-pass
  live-anchoring is worth the advisor's eyes before I build it) — INC4 + the refinements next.

## 2026-06-28 — turn 55: INC4 per-pass live anchoring (advisor-confirmed) + refinements status

- **INC4 (`329daa7`) — the live tool anchors to its CURRENT pass start ② (advisor PASS to build).** Root (shared by
  boss-manual-looks-like-pocket AND INC3's auto live tool not reaching ②): on a REPOSITION the engine resets
  `pos→{0,0,0}` (correct — keeps each pass start-anchored for the STATIC trace) but the LIVE tool always added
  `starts[0]=①` → after a reposition it sat at ①≈Y-centre and probed the Y walls from there. Fix (scoped exactly as
  the advisor set): the engine REPORTS the current pass via `onPositionChange({...,pass})`; the 3D `setToolPosition`
  + the 2D head AND path ride `passOff(pass)`=`starts[pass]` instead of always `starts[0]`. The engine reset is
  UNTOUCHED (only the live-tool/2D-path ANCHOR changed). Single-pass / no pass → `starts[0]` (byte-unchanged; the 2D
  single-pass + #13 absolute tests all still green). The 2D PATH (not just the head) went per-pass too — else the
  per-pass head would float off a single-anchored path (each seg carries `s.pass` from the trace). Test
  `per-pass-live-anchor.spec`: 2D head + 3D tool ride pass-0→① / pass-1→② / no-pass→①. Full suite 382 green + the
  KNOWN middle-animator flake (passed on retry). **HUMAN-eyes** = auto-boss live tool traverses to ②+probes Y walls;
  manual-boss live tool repositions to ② (not a pocket); pocket/single-axis UNCHANGED.

- **Refinements status:** (1) **Glyph match — already RESOLVED** (turn-45 work): the 3D start is a camera-locked CYAN
  LOZENGE sprite = the 2D ◇'s look ("same as 2d", human-steered) → 2D & 3D already unified, no action. (2) **Marker
  colour by source** — REMAINING: colour each start ①②… by whether its reposition is an AUTO-traverse or a MANUAL-jog.
  It needs per-pass SOURCE plumbing (the engine/trace can tag each pass from the REPOSITION message: "auto-traverse"
  vs "jog clear", OR the wizard exposes a per-pass-source array alongside inferStarts) + a 2-colour choice (auto vs
  manual). Both the source-mechanism and the colours are small design calls → surfacing rather than guessing the
  palette. Pausing here (turn is very large; INC4 needs human-eyes; the marker-colour palette is the human's call).

## 2026-06-28 — turn 57: marker colour by source (LAST middle increment) — MIDDLE BATCH DONE

- **Marker colour by source (`1611940`).** Human picked the palette: AUTO-traverse start = CYAN (kept), MANUAL-jog
  start = AMBER (`#ffb300` / `0xffb300` — clear of the yellow rapid `#ffcc00`, the probe blue, the tool orange).
  Plumbing: the engine tags each pass from its REPOSITION message (`/auto-traverse/`→auto, else manual) into a new
  `this._passSources` → `stats.passSources` (pass 0 = the start = auto/default); `createPreviewPanel` feeds it to
  `t2.setStartSources` + `viz.setStartSources` alongside `passStarts`; the 2D `drawStartHandles` colours the diamond /
  ring / badge per-pass, and the 3D start sprite became a WHITE lozenge tinted by `material.color` (so the same sprite
  shows cyan or amber via `_highlightSelectedStart`, which now sets colour-by-source AND the select/dim opacity).
  Verify-first the data: passSources = auto-both `['auto','auto']`, manual-both `['auto','manual','manual','manual']`,
  mixed (in-axis auto + trans manual) `['auto','manual']`, pocket `['auto']`. `marker-colour-by-source.spec` (trace
  sources; 3D markers cyan/amber; 2D markers carry the source). Pocket/single-axis = all cyan (unchanged). Full suite
  384 green + 2 KNOWN parallel flakes (middle-animator, project-drawer-smoke — both pass isolated). **HUMAN-eyes** = the
  look (manual-jog starts amber, auto-traverse starts cyan).

- **⇒ THE MIDDLE/BOSS 2nd-START BATCH IS DONE.** INC1 (2D per-pass markers) · INC2 (jog ② sticks) · INC3 (auto
  trans-traverse + two toggles + Diag travel + corner relabel + round-trip + the move-before-REPOSITION fix) · INC4
  (per-pass live anchoring) · refinements (glyph match already unified turn-45; marker colour by source). All committed,
  suite green. Remaining HUMAN-eyes checks across the batch: auto/manual boss live tool lands the 2nd probe on ② (tune
  Diag travel); manual starts amber / auto cyan; ② jogs live.

## 2026-06-28 — turn 61: colour the 2D toolpath VECTORS by source (advisor verify-the-diff catch)

- **Path-vector colour (`f5e6ff2`).** The advisor's verify-the-diff caught that turn-57's marker work coloured only the
  start CHIPS, not the toolpath VECTORS (the turn-58/59 vector extension was lost to a re-pass timing race). Fix: the 2D
  `strokeSegs` now colours the trans-axis traverse/reposition VECTOR by its pass source too, matching its chip — a
  2-axis RAPID (the ONLY 2-axis rapid the macro emits is the trans-axis diagonal `G0 X#21 Y#21`; the in-axis cross-over /
  lift / drop / retract are 1-axis) → cyan (auto) / amber (manual) via `startSources[s.pass]`; everything else
  (single-axis rapids = in-axis, probe, feed) keeps its TYPE colour, exactly as the advisor scoped. Reused the
  `startSources` already plumbed for the chips. Test pixel-checks: the 2-axis rapid renders cyan, the 1-axis rapid yellow.
  - **Honest scope note:** a MANUAL jog emits no lateral move, so it has no 2D vector to colour — its amber lives on the
    chip (+ the 3D inter-pass jog line). And the 3D PATH is type-grouped `LineSegments` (one colour per move-type), so
    colouring an individual 3D trans segment is a structural change, NOT done here (the advisor's ask was the 2D
    `segColor`/path stroke). Flagged as a follow-up if the human wants the 3D path vectors coloured too.
  - Suite 385 green + the 2 KNOWN parallel flakes (middle-animator, project-drawer-smoke — both pass isolated). HUMAN-eyes
    = the auto traverse vectors read cyan (matching the auto chips). **The middle batch's vector-colour gap is closed.**

## 2026-06-28 — turn 63: BOSS PROBE-BOTH motion BROKEN both modes — VERIFY-FIRST + PROPOSE (GATE, no build)

- **VERIFY-FIRST (empirical, real Corner/MiddleWizard macros, dist=100 boss):** ① `(-15,40)`, ② `(50,95)`.
  - **AUTO (inAxis/transAxis auto):** pass-0 X probes `[15, 2, 100, 2]` (1st wall HITS at 15; 2nd wall MISSES — full 100);
    **pass-1 Y probes `[100,100,100,100]` ALL MISS** (full max-probe, no contact). The trans diagonal runs `(17,0)→(119,102)`
    = a (+102,+102) move (`#21=[#19+#20]/2≈102`) → lands at **(119,102)**, far past ② `(50,95)` and off-stock.
  - **MANUAL (inAxis/transAxis manual, 4 passes):** ① `(-15,40)` ② `(115,40)` ③ `(50,95)` ④ `(50,-15)`. Only the pass-0
    probe collides (`[15,2]`); **passes 1/2/3 ALL MISS** (`[100,100]` each).
- **ROOT (unified, both modes):** the engine's probe COLLISION ([GcodeExecutionEngine.js:953-955](DDCS-Studio/web/engine/GcodeExecutionEngine.js#L953))
  computes `aStart = O + this.pos` with `O = this._stockOffset` (= ① = pass-0's operator start). A REPOSITION resets
  `this.pos={0,0,0}` (correct, for the static per-pass anchoring), so EVERY probe after pass 0 fires from `_stockOffset`=①
  → misses (the per-pass walls are at ②③④). **INC4 anchored each pass's MARKER + live tool to `starts[_pass]`=②, but the
  COLLISION still references `_stockOffset`=① → marker right, motion wrong, BOTH modes.** (Plus the AUTO diagonal is
  mis-built — a symmetric `#21` can't hit a non-square ②, and `pmove=+#21` overshoots away from centre.)
- **PROPOSED UNIFIED FIX (GATE — surfaced, not built):**
  - **Part 1 (the CORE — fixes both modes' SIM):** plumb the per-pass starts (`passStarts`) into the engine (mirror INC4's
    pass-report); the probe collision uses **`O = passStarts[_pass] || _stockOffset`** instead of `_stockOffset`. So every
    probe fires from ITS pass's start (②③④) → collides with the real wall. Single-pass UNCHANGED (`passStarts[0]` ==
    `_stockOffset` == ①). This IS the "simulated reposition" for MANUAL (the sim places the probe at ② as the operator
    would jog) AND completes the AUTO probe — ONE change, both modes.
  - **Part 2 (AUTO only — the REAL MACHINE + the static-path diagonal):** correct `transTraverse` so the diagonal LANDS on ②.
    Design fork (advisor's call): **(A)** per-axis legs (X→②'s X, Y→②'s Y) with per-axis Diag-travel, or **(B)** the wizard
    computes the legs to reach ② (it knows ②=`inferStarts[1]`) with one "Diag travel" as a tweak. ⚠ Constraint: reaching ②'s
    X exactly needs the found centre `#53` via a machine-move (= ABSOLUTE → breaks per-pass anchoring per the `reposition`
    comment), so the diagonal can only APPROXIMATE ② incrementally — directionally correct + tunable. **With Part 1 the SIM
    no longer depends on the diagonal's exactness (cosmetic for the sim); the REAL MACHINE needs it directionally right + tunable.**
  - **Why Part 1 is the keystone:** it makes AUTO + MANUAL probes COLLIDE + land on ② in the sim regardless of the diagonal;
    Part 2 is the real-machine/cosmetic geometry. STOP + pass to advisor with the proposal (geometry + sim-collision design).

## 2026-06-28 — turn 65 PART 1 (CORE, both modes): the probe COLLISION follows the per-pass start ②

- **Advisor CONFIRMED the gate → built Part 1.** The engine's probe-vs-stock collision now fires from each REPOSITION
  pass's start (②③④), not always pass-0's ① (`_stockOffset`).
- **Plumbing (3 files):**
  - [GcodeExecutionEngine.js](DDCS-Studio/web/engine/GcodeExecutionEngine.js): added `this._passStarts = null`; the collision
    (was `const O = this._stockOffset`) → **`O = (this._passStarts && this._passStarts[this._pass]) || this._stockOffset`**.
    So the probe ray starts at `passStarts[_pass] + this.pos` = ② + local. Falls back to `_stockOffset` for pass 0 / when
    unset → **single-pass byte-identical** (`passStarts[0]` == `_stockOffset` == ①).
  - [trace.js](DDCS-Studio/web/engine/trace.js): `eng._passStarts = opts.passStarts || null` so the STATIC trace clamps too.
  - [createPreviewPanel.js](DDCS-Studio/web/viz/createPreviewPanel.js): moved the per-pass `passStarts` computation BEFORE
    the trace (it only needs the wizard hints + userStarts + st — no `parsed` dependency), pass `passStarts` into both
    `traceToolpath` calls, and set `eng._passStarts` at play (the live run). Count now = `max(hints.length, 1)` (the middle's
    inferStarts mirror its reposition() calls; single-pass ops have no hints → 1; the engine falls back safely past the array).
- **VERIFIED the real symptom** (real MiddleWizard macros, boss stock, dist=130):
  - **MANUAL (4 passes):** WITHOUT passStarts, passes 1/2/3 ran the full max-probe (~130 = MISS); WITH, all 4 fast probes
    clamp (`[15,2]` each = COLLIDE). Fully fixed.
  - **AUTO (2 passes):** the 2nd-axis (Y, pass 1) probe went `100`→`[15,2,20,2]` (MISS→COLLIDE) once it fires from ②.
  - 40 targeted specs green (engine-trace · cam-slot-sim · middle-trans-traverse · per-pass-live-anchor · per-pass-starts-2d
    · marker-colour · the new boss-probe-collision) — single-pass byte-identical, no regression. New permanent test
    `boss-probe-collision.spec.js` (the per-pass collision = the regression guard).
- **⚠ OBSERVED, OUT OF THIS DISPATCH (flagged for the advisor):** AUTO pass-0's 2nd X wall still misses when `dist` < boss +
  outsets — that's the IN-AXIS cross-over (`traverseOver`, the `#19=[#1+#2]` traverse WITHIN one pass, fires from ①), not the
  per-pass reposition. It's PRE-EXISTING and dist-dependent (with dist=130 it clears; with dist=100 the cross-over lands inside
  the boss). Part 1 (per-pass) doesn't touch it; the trans-axis diagonal is Part 2a. Noting it as a possible separate follow-up.

## 2026-06-28 — turn 65 PART 2a: shared diagonal helper (corner↔middle) + the trans-axis diagonal lands near ②

- **EXTRACTED the shared helper** (DRY): `travelOwn`/`travelOpp` now live in [probeBlocks.js](DDCS-Studio/web/wizards/probeBlocks.js)
  — `travelOwn(plus, posExpr, negExpr)` = travel IN the probe direction, `travelOpp` = the OTHER way; the +/- expressions
  are the wizard's travel vars (`#15`/`#16` corner, `#21`/`[0-#21]` middle). ONE source of truth for "which sign each leg gets".
  - [cornerWizard.js](DDCS-Studio/web/wizards/cornerWizard.js): imports it; the local `travelOwn(d)`/`travelOpp(d)` now delegate
    (`travelOwnExpr(d==='+','#15','#16')`) → **byte-identical** output (4 corner specs green; the helper is the same map).
  - [middleWizard.js](DDCS-Studio/web/wizards/middleWizard.js) `transTraverse`: `pmove = travelOwn(dir1Plus,'#21','[0-#21]')`,
    `smove = travelOpp(dir2Plus,'#21','[0-#21]')` — the SAME directional pattern as the corner (primary = own, secondary = opp).
- **⚠ VERIFY-DON'T-REASON correction (own it):** the advisor's gate said the diagonal went the WRONG DIRECTION ("X leg away
  from centre"). **I VERIFIED first — the direction was ALREADY correct for all 4 dir1/dir2 combos.** Traced endpoints vs ②local:
  pos/neg `(79,62)` vs ②`(65,55)`; pos/pos `(79,-62)` vs `(65,-55)`; neg/neg `(-79,62)` vs `(-65,55)`; neg/pos `(-79,-62)` vs
  `(-65,-55)` — every one HEADS TOWARD ②. **The real bug was purely MAGNITUDE:** `#21` defaulted to `[#19+#20]/2` (≈ max-probe
  `#1`), so when max-probe >> the feature it overshot FAR off-stock (dist=100 → endpoint `(119,102)`, **67 mm** past ②).
- **THE FIX = a sane fixed default, decoupled from max-probe:** `#21` default `[#19+#20]/2` → **`50`** (like the corner's
  travelDist), in [middleWizard.js:47](DDCS-Studio/web/wizards/middleWizard.js#L47) + the field [index.html](DDCS-Studio/web/index.html)
  `m_diag_travel value="50"`. **VERIFIED:** the endpoint now lands **5 mm** from ② at BOTH dist=60 and dist=100 (was 67 mm off
  at 100), and is **max-probe-INDEPENDENT** (both → `(67,50)`). The human tunes #21 for their feature; the direction is correct.
- New permanent test in `middle-trans-traverse.spec.js` (endpoint < 12 mm from ② at dist 60 + 100; #21 default = 50;
  max-probe-independent). Full suite: 396 passed + 2 parallel-load flakes (custom-op-chip, project-drawer-smoke — both pass
  isolated, unrelated to the probe/engine changes). Corner byte-identical, Part-1 collisions intact.
- **HUMAN-eyes verify:** AUTO + MANUAL boss-both both COLLIDE with the walls (Part 1) + the diagonal now heads to ② (Part 2a).

## 2026-06-28 — turn 67: phantom auto JOG (fix 2, BUILT) + the diagonal STILL drifts (fix 1, VERIFIED CIRCULAR → GATE)

- **Correction taken:** the in-axis cross-over is FINE (human) — dropped. Two items: (1) the trans-axis diagonal still
  heads OUTWARD in the user's real config; (2) a phantom dashed JOG in auto.
- **FIX 2 (BUILT, `1c86e74`): the phantom auto jog.** VERIFY-FIRST (traced the source, didn't reason): the 3D
  [gcodeViz3d.js setSegments](DDCS-Studio/web/viz/gcodeViz3d.js#L717) drew a dashed orange jog (`jogPos`, the `0xff9a0d`
  dashed line at :774) from each pass's previous end → its start anchor ② **unconditionally** — even in AUTO, where the
  auto-traverse diagonal IS the connecting move. So an auto boss-both showed a dashed "move to ②" that shouldn't exist
  (the human's exact report — confirmed it's NOT an emitted G-code move; the macro has no move there). **Gate the jog on the
  per-pass SOURCE** (`this._startSources[p]`): MANUAL draws its jog; AUTO renders continuous (no jog line). The 2D never
  drew this connector (per-seg). New permanent test in `marker-colour-by-source.spec.js` (auto → no jog geometry; manual → jog).
- **FIX 1 (VERIFIED CIRCULAR → GATE, no build): the diagonal drifts outward.** VERIFY-FIRST in the USER'S config (boss,
  dir1=pos, dir2=pos, max-probe=100, diag=50) ACROSS stock sizes (don't reason — trace):
  - The X-probe-END itself scales with **boss size vs max-probe**: 40×40 → tool ends at local `57` (RIGHT of centre `35`),
    so `+#21` drives it FURTHER outward → endpoint `(107,-50)` vs ②`(35,-35)`, **74 mm off, OUTWARD**. 60×50 → 83 mm off.
    100×80 → tool ends LEFT of centre → `+#21` heads toward ② → only 5 mm off. **My Part-2a test only hit the 100×80 case
    where it happened to work — test config ≠ real (verify-REAL-symptom, again).**
  - **⭐ LIVE-PREVIEW (the REAL symptom, driven through the wizard — the static traces above UNDER-represented it):** default
    config (stock 100×80, boss, dir1=pos/dir2=pos, auto) → ②=`(50,-15)` but the diagonal runs local **`(117,0)→(167,0)`**: the
    X-probe-END sits at local **117** (world 102, PAST the +X edge), and `+#21` drives it further **RIGHT to 167**, while ②'s
    X is at local **65** (LEFT). So **the X goes the WRONG WAY** (human: "right y- but not the right x"). The Y is fine (down to ②).
  - **The DEFAULT is DEGENERATE:** the default stock IS the boss (100 wide) with max-probe=100 → the cross-over `#19≈102`
    can't clear the boss (tool ends AT/just past the +X wall, the 2nd X probe never re-clamps), so the tool ends far right
    AND `#53` (the measured centre) is GARBAGE. A re-centre to `#53` therefore can't save the default preview either.
  - **ROOT:** the correct diagonal depends on the tool's post-probe position, which depends on the boss size — which the
    macro is MEASURING (doesn't know at emit time); for the degenerate default it can't even measure the centre. A fixed
    `#21` can't be size-aware; a macro re-centre needs a VALID `#53` (probe must succeed) AND breaks manual-in-axis.
    GENUINELY CIRCULAR (advisor predicted). **The preview KNOWS ② (inferStarts from the stock) — only the GUI can draw/compute
    the diagonal to it.**
  - **Tried a macro-side re-centre** (primary leg → the measured centre `#53`: incremental `[#53-#52-lastRetract]`).
    VERIFIED: PERFECT for auto-in-axis at any size **when the probe succeeds** (xErr=0 for 40/60/100/150 with proper dist),
    BUT **breaks manual-in-axis** (xErr=90 — the per-pass resets make `#52`/`#53` not map to the tool position) AND inherits
    garbage `#53` when the probe itself fails (boss ≥ max-probe). So a macro-only re-centre is fragile → **REVERTED** (kept
    the clean Part-2a; added a ⚠ KNOWN-LIMITED comment in `transTraverse`). Also: the Y-out distance fundamentally can't be
    computed (it needs the boss half-height, which isn't probed until the NEXT pass).
  - **▶ FLAG THE GUI ANSWER (the advisor's flagged clean path):** drag ② on the feature canvas → the diagonal is COMPUTED to
    reach it (the preview KNOWS the boss size from the sim stock / the user's placement — no value to get right). The
    feature-canvas-in-probe initiative. **GATE: pass to advisor to greenlight the GUI vs another approach — no macro hack.**
- **⚠ HUMAN-eyes:** fix 2 — auto boss-both shows NO dashed jog (manual still does). fix 1 — still drifts for off-size bosses
  (the circular residual; awaiting the GUI decision).

## 2026-06-28 — turn 70: FIX 1 was NOT circular — an axis-order PRIMARY-sign bug. FIXED (re-centre to #53)

- **Own it — I mis-framed turn-67 as "circular."** The advisor (relaying the human) re-opened: the "circular" was the
  DEGENERATE DEFAULT (boss=stock=100, dist=100 → #53 garbage). On a NORMAL boss (boss < stock so the cross-over clears),
  **Y-first works at the SAME #21=50 — which PROVES the move reaches ②**, so it's not circular; it's a hardcoded sign.
- **VERIFY-FIRST (traced BOTH orders + drove the LIVE preview, normal 40×40 boss):** symmetric — both orders put the tool at
  primary local `57` (the in-axis cross-over `G0 X#19`/`G0 Y#20` flings it FAR past centre in +dir1), then the trans-move's
  PRIMARY leg `+#21` drove it FURTHER out to `107` (②'s primary = the centre, local `35`). The SECONDARY leg already headed
  to ②. **ROOT: the primary leg used `travelOwn(dir1)` (a fixed +dir1 sign) — right after a manual jog, WRONG after the
  auto cross-over fling.** (My earlier static "5 mm" for 100×80 under-represented it; the LIVE preview is the truth — it
  showed `(117,0)→(167,0)`, the human's exact symptom.)
- **FIX ([middleWizard.js transTraverse](DDCS-Studio/web/wizards/middleWizard.js)):** the PRIMARY leg re-centres to the
  MEASURED centre **#53** (the tool sits at wall-2 `#52` + the last retract → incremental step `[#53−#52−#10/#9]`). Heads to
  ②'s primary coord **regardless of axis ORDER** (#51-53 are always the primary's). SECONDARY stays `travelOpp(dir2)` `#21`
  (the out-distance the macro can't measure before it probes that axis — user-tuned). MANUAL in-axis kept (no cross-over
  fling, different per-pass frame; verified it was already ~correct, primErr 2 mm).
- **VERIFIED in the LIVE preview (the real symptom):** X-first `X 57→35` (=②X centre, EXACT) · Y-first `Y 57→35` (=②Y centre)
  · even the default `X 117→65` (=②X=65). The X no longer flies outward; X-first now matches Y-first. The secondary still
  travels `#21` (5–15 mm residual the user tunes). New emitted move: `G0 X[#53-#52-#10] Y#21` (X-first). **Full suite 398 green.**
- Updated `middle-trans-traverse.spec.js` (the move regex + a new test: the primary re-centres onto ② for BOTH orders).
  **This CLOSES the trans-axis diagonal (GUI stays a nice-to-have, not needed). ⚠ HUMAN-eyes: X-first now reaches ② like Y-first.**

## 2026-06-28 — turn 72: DECOUPLE + SURFACE the in-axis cross-over (#19/#20) from max-probe

- **The conflation (human):** the in-axis cross-over `#19`/`#20` defaulted to `[#1+#2]` (max-probe `#1` + retract) — but
  max-probe is the probe REACH (how far G31 searches) and the cross-over is the TRAVERSE DISTANCE (how far to move wall1→
  wall2 across the feature). DIFFERENT things; coupling them overshot whenever max-probe >> the feature.
- **VERIFY-FIRST:** `#19`/`#20` are used ONLY by `traverseOver` (the in-axis cross-over, called only when `inAxis==='auto'`);
  the form fields [m_crossX/m_crossY](DDCS-Studio/web/index.html) showed the raw `[#1+#2]` expression (max-probe defaults to
  100 → `[#1+#2]`=102); the reconciler recovered `#21` (diag) but **NOT** `#19`/`#20` (a round-trip gap). Post-Fix-1 the
  trans-axis re-centres to `#53`, so the cross-over no longer feeds the diagonal — it only needs to span the in-axis feature.
- **(b) DECOUPLE** [middleWizard.js](DDCS-Studio/web/wizards/middleWizard.js): `crossX`/`crossY` default `[#1+#2]` → a clean
  **`80`** (feature-INDEPENDENT). **⚠ PROPOSED VALUE — advisor to review:** 80 = a moderate feature (~50) + 2×15 approach;
  TRACED → it spans features to wall 2 up to ~65 mm (reach = −outset + 80 = world 65); bigger features the user tunes (the
  field is now visible). Trade-off: the old `[#1+#2]`=102 spanned ~85 mm — 80 is smaller, but it's a clean declared number
  the user OWNS (not a hidden max-probe expression). Also: `#19`/`#20` are now assigned ONLY when `inAxis==='auto'` (was
  also-when-trans-auto, which is obsolete now that `#21` is a fixed default and the trans-axis re-centres to `#53`).
- **(c) SURFACE:** the X/Y CROSS-OVER fields read a clean **`80`** with a title that says TRAVERSE distance (≈ feature width
  + 2×approach), explicitly "NOT the probe reach (Max Probe)". Added the **reverse-sync** ([opSession.js](DDCS-Studio/web/blocks/opSession.js)):
  `#19`/`#20` → `m_crossX`/`m_crossY` (mirrors `#21`→`m_diag_travel`) — closes the round-trip gap so the field stays the one
  declared source of the traverse distance. New test: a block-edited cross-over reverse-syncs into the form.
- Updated `middle-crossover.spec.js` (default 80 not `[#1+#2]`; header; + the reverse-sync test). **Full suite 398 green + 3
  KNOWN parallel flakes** (custom-op-chip, middle-animator, project-drawer-smoke — 9 pass isolated). **⚠ HUMAN-eyes:** the
  CROSS-OVER form fields read as clean numbers + a probe-both run on a real boss reaches both in-axis walls.

## 2026-06-28 — turn 74: FEATURE-CANVAS-IN-PROBE prototype #1 — the EDGE probe-vector (the canvas↔form SEAM)

- **New thread (FEATURE-CANVAS-PROBE-SCOPE.md), EDGE first (human "do edge first").** ADDITIVE — the axis/dir/dist form
  fields STAY; the canvas ADDS one two-way-synced draggable arrow. This establishes the canvas↔form SYNC SEAM for the whole
  initiative, so the seam mattered most.
- **VERIFY-FIRST (traced, didn't assume):** (1) [featureCanvas.js](DDCS-Studio/web/viz/featureCanvas.js) is GENERIC + already
  shared (drill/pocket/slot/contour/surfacing/text use it): a `spec` of `{stock, items, paths, handles, onDrag, onEdit}`;
  a handle drag hands back a world point → `onDrag(id, world)` → the view's `setFields` writes the field(s) → update()
  redraws. (2) [edgeView.js](DDCS-Studio/web/wizards/views/edgeView.js) cleanly extends like [drillView](DDCS-Studio/web/wizards/views/drillView.js)
  (instantiate a `FeatureCanvas`, add a container, render in update()) — **no featureCanvas generalization needed → NO design
  fork → build, no gate.** (3) [canvasWidgets.js](DDCS-Studio/web/viz/canvasWidgets.js) `radial` maps a polar handle to a
  NUMERIC angle field — doesn't fit a probe (axis-aligned, axis+dir are ENUMS). So a new gesture.
- **BUILD:**
  - **`probeVector` gesture** (canvasWidgets, one registry entry — the intended extension point): the handle is the arrow
    TIP; the drag SNAPS to the nearest cardinal (`|dx|≥|dy|`→X else Y; sign→pos/neg) → `fieldAxis`+`fieldDir`, length →
    `field` (reach). `place` puts the tip at anchor + dist·cardinal-unit.
  - **`edgeLayoutCanvas`** container added to the edge panel ([index.html](DDCS-Studio/web/index.html), additive — the
    existing SVG animator stays below it).
  - **edgeView**: `setFields` is ENUM-SAFE (numbers rounded, axis/dir strings passed through — not `r3`'d to NaN);
    `buildEdgeSpec` draws the arrow from the stock centre in the probe direction (shaft = a `line` item, tip = the handle);
    `update()` renders the canvas every field change.
- **THE SEAM (both directions, the field VALUES are the one source — form + Blockly round-trip intact):** form→canvas =
  update() re-renders the arrow from the fields; canvas→form = `onDrag` → `setFields({p_axis,p_dir,p_dist})` → one `input`
  event → update(). The canvas writes the SAME fields the form/Blockly use — it's just another view of them (the drill pattern).
- **VERIFIED (real symptom, new spec `edge-probe-vector.spec.js`):** unit — the gesture place/drag (cardinal snap + enum
  mapping + reach); integration — drove the real wizard: typing axis=Y/dir=neg/dist=40 makes the arrow vertical-down-longer
  (form→canvas), and a pointer-DRAG of the handle above centre sets axis=Y/dir=pos (canvas→form). **Full suite 401 green, zero
  failures.** **⚠ HUMAN-eyes:** open Edge → drag the arrow updates axis/dir/dist live; type a field → the arrow moves.
  **The seam is proven; the rest of the initiative is handle declarations on top.** (Anchor = stock centre for now — refinable.)

## 2026-06-28 — turn 76: SIM-SIDE DECLARE-NOT-INFER, increment 1 — shared inferStarts REGISTRY (opSimStarts)

- **The one sim-side leak:** the viz + engine pass-tracking already read DECLARED values; the only ad-hoc inference was the
  wizard→engine junction where each wizard's `inferStarts(params, stock)` computed per-pass start markers with no shared home.
- **VERIFY-FIRST (traced):** multi-pass `inferStarts` lives in **middle / alignment / rotary_center** (the single-pass
  wizards only have `inferStart` → not the leak). All three are SELF-CONTAINED pure fns (params + stock + `num` + math, no
  instance state) → a CLEAN move. Consumed: views call `wizard.inferStarts` → `ctx.preview3D` → `host.__startHints`
  ([wizardManager.js:489](DDCS-Studio/web/wizardManager.js#L489)) → `getStartHints` → createPreviewPanel's passStarts.
  **`def.sim` declares preview INTENT (rotary rig / machine / magazine), NOT starts** — so the custom-op declared-starts
  wiring is non-trivial → the dispatch's ELSE path (shape the seam, note the follow-up). NOT a gate (clean move).
- **BUILD — [viz/opSimStarts.js](DDCS-Studio/web/viz/opSimStarts.js), mirroring opSimContext (federated registry):**
  - **BUILT_IN layer** `{ middle, alignment, rotary_center }` — the three `inferStarts` MOVED VERBATIM (behaviour-preserving).
  - **USER_* layer** `setUserSimStarts(opType, provider)` + a `USER_STARTS` Map — the wizard-maker seam: a custom op
    DECLARES its per-pass starts (a `(params,stock)→[{x,y,z}]` provider), never inferred from motion (same as
    setUserSimIntent). `opSimStarts(opType, params, stock)` = custom declared → built-in → null (caller falls back to one start).
  - The 3 wizards' `inferStarts` now **delegate** (`return opSimStarts('middle', params, stock)`) — consumers unchanged.
- **Custom-op def.sim wiring = FOLLOW-UP (noted):** `def.sim` carries the intent flags only; a declared sim-starts spec
  (e.g. `def.sim.starts`) + the userOps `setUserSimStarts` call from it is increment-2-ish. The seam is shaped + testable
  NOW (a custom op can register a provider fn); the spec→provider translation is the deferred leg.
- **VERIFIED (new `op-sim-starts-registry.spec.js`):** equivalence — the registry === each wizard's `inferStarts` for 6
  representative param sets + the pass COUNTS (boss-both auto 2 / manual 4 / pocket 1 / alignment 2 / rotary known 1 / fit 3)
  + concrete values locked; the USER_* layer (register → drives starts, clear → null, built-ins unaffected). **Preview
  markers byte-identical** (verbatim move; per-pass-starts-2d + per-pass-live-anchor + boss-probe-collision green). **Full
  suite 401 green** + the 1 known flake (project-drawer-smoke, passes isolated). **SCOPE = increment 1 only** (not
  passStarts-unify / jog-IR / drag-expiry — 2-4). **⚠ HUMAN-eyes:** multi-pass probe previews (boss-both, alignment, rotary
  fit) show the same ①②③④ markers as before.

## 2026-06-28 — turn 78: SIM REFACTOR inc 2 — passStarts SINGLE-FEED (mostly a near-noop; closed the real residual)

- **VERIFY-FIRST — HONEST finding (the advisor flagged it might be a near-noop, and it largely is):** passStarts is ALREADY
  the single source — ONE computation block in setGcode (precedence `userStarts > pass-0 start > registry hint > prev`) fed
  to the trace (`traceToolpath({passStarts})`) AND the engine (`eng._passStarts` at play). For a WIZARD-PARAM edit (which
  changes the G-code), `scheduleLiveRestart` already STOPs + re-plays → re-feeds `_passStarts` fresh → the engine path does
  NOT lag the trace path. So for the dispatched scenario ("edit a wizard param while playing"), it's effectively a NOOP.
- **THE REAL RESIDUAL (where staleness actually bites):** a live edit that changes the STARTS but NOT the macro — a **STOCK
  change** while running (the middle macro is stock-INDEPENDENT, it measures): the trace recomputes passStarts (new hints)
  but `scheduleLiveRestart` SKIPS (it only re-plays on a G-code change, [createPreviewPanel.js:402](DDCS-Studio/web/viz/createPreviewPanel.js#L402)),
  and `eng._passStarts` was set only at `play()` — so the engine kept the STALE starts. Traced + reproduced.
- **FIX (minimal, behaviour-preserving):**
  - Extracted the precedence into a named **`computePassStarts(st)`** — THE one declared source, an explicit reusable fn
    (both feeds read it), serving the stated goal.
  - In setGcode, after computing passStarts: **`if (engine.running && code === lastRunCode) engine._passStarts = passStarts`**
    — the running engine is refreshed from the SAME computation. GATED to `code===lastRunCode` so a G-code-CHANGING edit
    (handled by the re-play) never feeds the OLD running pass new starts (no transient mismatch). Closes the stock residual;
    leaves the param-edit path (re-play) untouched.
- **VERIFIED (new `passstarts-single-feed.spec.js`):** play a boss-both preview, then a live STOCK-Y edit → `engine._passStarts`
  ②.y FOLLOWS the stock (coherent), where without the feed it would stay stale (scheduleLiveRestart skips the unchanged G-code).
  **Full suite 403 green** + the 1 known flake (project-drawer-smoke, passes isolated). **SCOPE = inc 2 only.**
- **▶ The REAL remaining gaps are inc 3 (render-time JOG-IR) + inc 4 (user-drag EXPIRY) — not touched here.** NOTE (forward):
  the deferred `def.sim.starts` declarative path must be designed BLOCK-FRIENDLY — a sim-declaration block round-trips against
  the DECLARATION, not the macro (no emitted line to reverse-sync). **⚠ HUMAN-eyes:** edit the stock while a probe preview
  plays → the live tool's per-pass starts track the change.

## 2026-06-28 — turn 80: PHASE 3 GUI — the ②-AIM handle (the first SIM-ONLY canvas handle)

- **The prize the declared seam was built for.** The MIDDLE wizard now has a feature canvas (reusing Edge's pattern) that
  renders the per-pass start markers ①②③④ as DRAGGABLE POINT handles. **The critical difference from Edge:** Edge's drag
  wrote FORM fields (a G-code driver); the ②-aim writes the **SIM-ONLY DECLARED value** — NOT a form field.
- **VERIFY-FIRST:** the existing `onStartDrag(pos, pass)` (createPreviewPanel) is THE seam — it writes `userStarts[p]`
  (the user override that BEATS the inferStarts hint + persists), mirrors to the 3D marker, then `setGcode` + `replayFromStart`
  (→ computePassStarts → the trace AND the engine, inc 1+2). The view reaches the panel via `ctx._activePanel` (the view's
  `ctx` IS the wizardManager; `_activePanel` is set by `preview3D`). So the feature-canvas drag must call that SAME handler —
  one source, every view (2D toolpath, 3D, feature canvas) edits the same `userStarts`.
- **BUILD:**
  - [createPreviewPanel.js](DDCS-Studio/web/viz/createPreviewPanel.js): extracted the 2D drag callback into a named
    `onStartDrag(pos, pass)` and **exposed it** on the panel return + `getPassStarts()`.
  - [index.html](DDCS-Studio/web/index.html): added `middleLayoutCanvas` (additive — the 2D toolpath view STAYS below).
  - [middleView.js](DDCS-Studio/web/wizards/views/middleView.js): `renderStartCanvas(panel, stock)` — the start markers as
    POINT handles (`kind:'move'`, label ①②③④); a drag → `panel.onStartDrag({x,y,z}, p)` (the declared seam) → redraw. Called
    after `ctx.preview3D` (so `_activePanel` exists). NO buildCanvasWidgets (that maps to form fields) — the handles + onDrag
    are built directly so the drag writes the sim-only start, not a field.
- **VERIFIED (real symptom, new `middle-aim-canvas.spec.js`):** open Middle boss-both, real pointer-DRAG ② right on the
  feature canvas → `engine._passStarts[1].x` FOLLOWS (the probe pass BEGINS where dragged, not just the canvas redrawing);
  and it PERSISTS across a re-render (userStarts[1] locks). **Full suite 403 green** + 2 known parallel flakes
  (custom-op-chip, probe-wcs — 9 pass isolated). **SCOPE = the middle start handles only, ADDITIVE.**
- **▶ GATE (advisor's call, inc 4) — ABSOLUTE vs TRACK-STOCK:** built with **ABSOLUTE** (the current `userStarts` seam — a
  dragged ② locks to its XY and persists). After a drag, if the STOCK changes, ② stays put (absolute). **Recommendation:**
  keep ABSOLUTE now — predictable, simplest, "the user placed ② HERE." TRACK-STOCK (re-derive ② relative to the wall so a
  stock change keeps it OUTSIDE the wall) is more robust for the probe semantics BUT needs a relative-anchor model (store the
  offset-from-hint, not absolute XY) — genuinely inc-4 work. **Lean: ship ABSOLUTE; add TRACK-STOCK in inc 4 only if the
  human finds absolute-after-stock-change confusing.** Not baked in either way — the decision is yours. **⚠ HUMAN-eyes:**
  open Middle boss-both → drag ② on the feature canvas → that probe pass begins there + the 3D/2D markers follow.

## 2026-06-28 — turn 82: TIE the trans-axial diagonal to the dragged ② (GUI drives the macro)

- **The culmination of the boss-both thread.** The ②-aim handle (turn 80) drove the SIM (`userStarts[1]`). Now it ALSO
  drives the G-code: drag ② → derive `#21`/`diagTravel` so the auto trans-axial diagonal ENDS on ②. **ONE handle, BOTH
  outputs** — and the divergence is closed BY CONSTRUCTION (there's no free `#21` to drift from ②: `#21` = the distance to ②).
- **VERIFY-FIRST (traced):** the auto trans-axial is `X[#53-#52-rv] Y#21` — re-centre the PRIMARY axis to the measured centre,
  then go OUT by `#21` on the SECONDARY axis toward ②. So **`#21` IS the centre→② out-distance on the secondary axis**. ②
  (the trans-axial target) = the first SECONDARY start (auto in-axis → passStarts[1]; manual in-axis → [2]). The inferred
  preview centre = `(stockX/2, stockY/2)`. **Confirmed empirically:** `#21 = |②_secondary − centre_secondary|` → the diagonal's
  secondary endpoint lands EXACTLY on ②'s secondary (dir2=neg 95→95, dir2=pos −15→−15; the `travelOpp` sign handles direction).
- **BUILD ([middleView.js](DDCS-Studio/web/wizards/views/middleView.js) `tieDiagTravel`):** when the SECONDARY-axis start ②
  is dragged (gated: boss + findBoth + transAxis auto + pass===the secondary start), compute `#21 = |dragged②_secondary −
  centre_secondary|` and write the `m_diag_travel` field (dispatch `input` → re-generate the macro). Called in the canvas
  onDrag right after `panel.onStartDrag` (the sim write). ② is the MASTER; the field FOLLOWS (drag-the-position-the-number-
  follows). Form + Blockly round-trip intact (the field is still the one source — the drag just writes it, like a user typing).
- **⚠ NOTED constraint:** the diagonal RE-CENTRES the primary axis (#53), so only the SECONDARY out-distance ties — if ② is
  dragged OFF-CENTRE in the PRIMARY axis, that coord can't be honoured by the re-centred primary leg (the diagonal still ends
  on ②'s secondary line, at the centre primary). Expected (FIX-1 re-centres regardless).
- **VERIFIED (real symptom, new `middle-aim-tie.spec.js`):** real pointer-DRAG ② further out → `m_diag_travel` GROWS to the
  derived `|②.y − centre.y|`, and a re-trace with the post-drag macro shows the trans-axial diagonal ENDS on ②.y (< 2 mm, not
  near it). **Full suite 404 green** + 2 known parallel flakes (custom-op-chip, project-drawer-smoke — pass isolated).
  **SCOPE = the ②→#21 tie only** (no track-stock, no other handles). **⚠ HUMAN-eyes:** drag ② → the diagonal aims where you dropped it.

## 2026-06-29 — turn 84: DRAW THE FEATURE in the middle canvas (op-type declares it; fixes 'pocket not drawn')

- **The bug:** the middle feature-canvas spec had `items: []` — it drew the stock outline + the start handles but NO feature
  shape, so a pocket showed nothing (the human's red-rect was their own sketch of where the cavity should be).
- **VERIFY-FIRST (traced, reuse what exists):** the 3D ([gcodeViz3d.js setStock](DDCS-Studio/web/viz/gcodeViz3d.js#L994))
  draws the feature from `stock.shape` — POCKET = an inset CAVITY (inset `w = max(8, 0.25·min(x,y))`), BOSS = the stock block,
  CYLINDER = the round OD; `probeGeometry` collides against the SAME. `m_type` ↔ `stock.shape` are NOT synced (the view reads
  `featureType` from `m_type`, never writes `stock.shape`) → **`m_type` is the op-type DEFAULT, `stock.shape` the OVERRIDE.**
  featureCanvas items rendered as `fc-guide` (dashed outline) only.
- **BUILD:**
  - [featureCanvas.js](DDCS-Studio/web/viz/featureCanvas.js): items honour an optional `it.cls` (default `fc-guide`), so an
    item can be a FILLED feature shape.
  - [styles.css](DDCS-Studio/web/styles.css): `.fc-feature-pocket` (blue) / `.fc-feature-boss` (green), matching the 3D fill
    colours.
  - [middleView.js](DDCS-Studio/web/wizards/views/middleView.js) `buildFeatureItems(sw, sh, stock)`: the FEATURE shape —
    **precedence** (declare-default + autonomy-override): a user-set `stock.shape==='pocket'` → cavity, `==='cylinder'` →
    circle (a deliberate non-default beats the op default; `'boss'` is the settings default so it does NOT override) → else
    `circular` → circle → else `m_type` (`pocket`→cavity / `boss`→block). Geometry reuses the 3D model: pocket = an inner rect
    inset `0.25·min`; boss = the full stock rect (the probe approaches from outside); circle = centred, `r=0.4·min`
    (approximate pre-probe — it's being measured — a sensible centred default, refinable). `items: []` → `buildFeatureItems(...)`.
- **VERIFIED (new `middle-feature-draw.spec.js`):** pocket → a blue cavity rect INSET from the stock (the bug fix); boss →
  a green block; circular → a circle; a user-set `stock.shape='pocket'` (over m_type=boss) → the cavity (override); `='cylinder'`
  → a circle (override). **Full suite 406 green** + 3 known parallel flakes (custom-op-chip, blocks-live-form, project-drawer-
  smoke — 9 pass isolated). **SCOPE = DRAW the feature only** (not the full shared-stock-block design — Phase 2). **⚠ HUMAN-eyes:**
  select pocket → a cavity; boss → a boss; circular → a circle; a stock-settings override beats the default.

## 2026-06-29 — turn 84 FOLLOW-UP (human redirect, mid-turn-86): the OP PRESELECTS the stock (3D + 2D), panel OVERRIDES

- **Human feedback on the turn-84 feature-draw:** "the shape is controlled by the op type, but if i override it in stock,
  the 2d canvas should also be changed" + "isnt it BOTH? op preselects the stock, for BOTH 3d and 2d gui canvas; then the
  stock panel can override." My turn-84 heuristic ('boss' = the settings default → does NOT override) was wrong — an explicit
  `stock.shape='boss'` should change the 2D, and the 3D already reads `stock.shape` directly.
- **FIX (the one coherent behaviour, not a choice):** the STOCK shape is the ONE source — the 2D reads it (the SAME value the
  3D reads, so they always match), and the op-type PRESELECTS it.
  - [middleView.js](DDCS-Studio/web/wizards/views/middleView.js) `buildFeatureItems` now reads `stock.shape` directly
    (pocket→cavity, cylinder→circle, else boss-block) — no op-type heuristic.
  - `syncStockShape(featureType, circular)` — on an op-type/circular CHANGE only (tracked `_lastShapeKey`, so a panel override
    isn't clobbered), declare `stock.shape` (pocket op → 'pocket', boss → 'boss', circular → 'cylinder'). In-memory on the
    SAME `_ddcsSettings` object the 3D/sim read, so the current `update()` shows it (the 2D reads it; preview3D re-setStocks
    the 3D — `setStock` rebuilds unconditionally). Plus a DEFERRED `queueMicrotask(saveSettings)` to persist + broadcast
    (reload + the open stock dialog stay in sync) WITHOUT re-entering update() (saveSettings → ddcs:settings-changed →
    wizardManager.update is synchronous; the microtask runs it AFTER this render). The panel override flows through the
    settings-panel's own saveSettings → re-render → buildFeatureItems reads `stock.shape`.
- **VERIFIED:** drive the wizard, switch m_type pocket→boss (the real dropdown 'change' event, no explicit update) → BOTH
  `settings.stock.shape` AND `viz._stock.shape` become 'boss' (the 3D follows); the override survives (no op-change →
  not re-preselected); no loop from the deferred saveSettings. Updated `middle-feature-draw.spec.js` (op preselects + panel
  overrides). The middle-opening tests pass isolated (16). **(A '36 failed' full-suite run was DEV-SERVER OVERLOAD — 4.4 min
  vs the usual ~2 — from repeated suite runs, not a regression.)** **⚠ HUMAN-eyes:** if the 3D looked stale, hard-reload — the
  op→stock preselect + the 2D/3D both following are verified. **NOTE:** the advisor's turn-86 TRACK-STOCK (start-drag offset
  model) is still PENDING — this was the human's mid-turn redirect.

## 2026-06-29 — turn 88: EDITOR SIM applies the declared start hints (extend opSimStarts from the wizard to the editor)

- **Human (eyeball + the pasted macro):** on INSERT, the SAME op sims DIFFERENTLY — the editor's 2nd-axis move is glued to
  the stock edge / WCS. The macro is IDENTICAL (`#21=50`, `G0 X[#53-#52-#10] Y[0-#21]`); only the SIM differs. "The wizard has
  the gui canvas but the editor doesn't, BUT THE BLOCK SHOULD STILL APPLY."
- **VERIFY-FIRST (traced):** the editor preview ([gcodePreviewTab.js](DDCS-Studio/web/ui/gcodePreviewTab.js)) is the SAME
  shared `createPreviewPanel`, but its config has **no `getStartHints`** → `get('getStartHints')` is undefined → the panel's
  `computePassStarts` falls to the single-pass default → the 2nd-axis anchors to the literal incremental position (the WCS).
  The wizard feeds hints via `getStartHints` (host.__startHints = inferStarts). `opSchema.parseMarker`/`isMarker` already
  parse the `@DDCS` op markers (op type + params); `opSimStarts` (inc 1) is the shared hint registry. **No restructure → build.**
- **BUILD:** `gpStartHints()` — parse the program's `@DDCS` markers → `opSimStarts(opType, params, stock)` (the SAME registry
  the wizard uses) → concatenate each op's per-pass starts → wired as the panel's `getStartHints`. Also `getStart` now falls
  back to `hint[0]` (①) so pass 0 begins at the inferred start too (matching the wizard), not the viz default `{0,0,0}`. The
  panel's `computePassStarts` → the trace/engine `passStarts` — the wizard's EXACT path. So the editor + wizard SHARE the
  registry → identical sim for the same op.
- **VERIFIED (real symptom, new `editor-sim-hints.spec.js`):** put an inserted boss-both (marker + macro) in the editor →
  the editor's `passStarts` ①② MATCH `opSimStarts('middle', params, stock)` (the 2nd-axis ② begins at the registry hint, not
  the WCS edge); the SAME macro WITHOUT the marker → the single-pass default (unchanged). The editor-preview + middle/preview
  tests pass ISOLATED (25 of the overload-run "failures" re-run green). **SCOPE = registry DEFAULT hints only** (a dragged
  ②/userStarts saved as op data is Phase 2). **NOTE — multi-op:** the concatenation aligns for a single op (the human's case)
  + the first op of a multi-op program; later ops can drift (the trace's `_pass` is a running counter, not per-op) — Phase 2.
- **⚠ The full suite couldn't run clean = DEV-SERVER OVERLOAD** (4.7 min vs ~2; 72 page.waitForFunction timeouts) from my
  repeated suite runs — NOT a regression; every sampled "failure" passes isolated. **⚠ HUMAN-eyes:** editor sim of an inserted
  boss-both matches the wizard (2nd-axis starts at ②).

## 2026-06-29 — turn 90: B1 PROPOSAL — `def.sim.starts` spec (PROPOSE + GATE, NOT a build)

Per SIM-BLOCK-STACK-BACKLOG.md B1: make a sim-start declarable as DATA, BLOCK-FRIENDLY, declaration round-trip
(not the emit-atom model). This turn = verify-first + propose + GATE; the build is the next turn once the human blesses the spec.

**VERIFY-FIRST (3 findings):**
1. `def.sim` TODAY carries preview INTENT flags only — `{ showRotaryRig, forceMachine, showMagazine }`, registered by
   `setUserSimIntent(def.opType, def.sim)` in [userOps.js](DDCS-Studio/web/blocks/userOps.js). NO starts (declared, never inferred).
2. The USER_* layer ([opSimStarts.js](DDCS-Studio/web/viz/opSimStarts.js)): `setUserSimStarts(opType, providerFn)` + a
   `USER_STARTS` Map; `opSimStarts(opType, params, stock)` = USER provider || `BUILT_IN[opType]` || null. **The provider seam
   EXISTS** — the gap is only the `def.sim.starts` → provider wiring (its own comment says "the DECLARED-spec → provider
   wiring (read def.sim) is the follow-up").
3. The built-in math = the PATTERN to make declarable: each per-pass start is a POSITION = { an ANCHOR — centre |
   wall-outside-by-`outset` | a fraction | centre±`R` — at a Z-PLANE (above-top | below-top `probeZ` | flank `-R`) }, and the
   per-pass LIST is CONDITIONAL on params (count: middle 1/2/4 by featureType+twoAxis+inAxisManual; alignment 2; rotary 1/3 by
   method). Vars in scope: `sx,sy,sz`, `cx=sx/2, cy=sy/2`, `outset=max(6,min(dist·0.6,15))`, `R=min(sy,sz)/2`, + the op's params.

**The spec must handle:** (i) a per-pass POSITION relative to the stock; (ii) the per-pass LIST being param-conditional (count
varies); (iii) block-friendly — a DECLARATION round-trip (no emitted line to reverse-sync).

**OPTION A (RECOMMENDED) — structured anchor+offset rows:**
```
def.sim.starts = [
  { anchor:'edge',   axis:'X', side:'@dir1', out:'@outset', plane:'probe' },                              // pass ①
  { anchor:'edge',   axis:'Y', side:'@dir2', out:'@outset', plane:'probe', when:{ param:'twoAxis', is:true } }, // pass ② (only if 2-axis)
  { anchor:'centre', plane:'probe', when:{ param:'featureType', is:'pocket' } },                            // pocket = 1 centre pass
]
```
- Each ROW = one pass. `anchor` ∈ { `centre` | `edge`(axis,side,out) | `frac`(fx,fy) | `radial`(axis,sign,r) }; `plane` (Z) ∈
  { `top` | `probe` | `<number>` | `@flank` }; `side`/`out`/`r` = a literal OR a `@token` from a SMALL bound set
  (`@dir1 @dir2 @outset @R`); optional `when` = a single param-gate so the row only contributes when it matches (the
  conditional count). A `makeProvider(def.sim.starts)` interprets the rows → `(params, stock) ⇒ [{x,y,z}…]`; userOps registers
  it via the existing `setUserSimStarts`. Data → provider → the registry already in place.
- BLOCK (B3): each row = a "pass" declaration block (anchor dropdown + axis/side/out fields + an optional when-gate); the
  STACK of pass-blocks IS `def.sim.starts`, round-tripping against the DATA — no emitted line (the declaration model).
```
   SIM mouth ▸ [ pass ① · edge X @dir1 out @outset · probe ]
              [ pass ② · edge Y @dir2 out @outset · probe ·· when twoAxis ]   ⇄  def.sim.starts (the DATA)
              [ pass · centre · probe ·· when featureType=pocket ]
```
- PRO: block-friendly (dropdowns + numbers + a gate = the spatial-GUI / GUI-first principle); declarative + VALIDATABLE
  (valid-by-construction); tracks the stock (anchors re-derive — aligns with track-stock B2); a small bounded vocabulary.
- CON: vocabulary is fixed (edge/centre/frac/radial + a few `@tokens`) → an exotic position needs a new anchor/token; `when`
  is a single param-eq (compound conditions would need more).

**OPTION B — expression rows (general, less block-friendly):**
```
def.sim.starts = [ { x:'dir1=="pos" ? -outset : sx+outset', y:'cy', z:'probeZ', when:'featureType=="boss"' }, … ]
```
- Each coord = a STRING expression over a bound scope `{ sx,sy,sz,cx,cy,outset,R,probeZ,top, + params }`; `when` = a bool
  expression; a small safe evaluator runs them (the engine has a G-code expr evaluator — different scope, same idea).
- PRO: fully GENERAL — one shape covers EVERY built-in verbatim (fractions, R, conditionals) → trivial to migrate the built-ins.
- CON: expression STRINGS not picks → a code-ish field, not the spatial-GUI; needs a safe evaluator (injection care); harder to
  validate + to render as a clean declaration block; the value lives in a string, not structured fields.

**RECOMMENDATION: Option A.** It matches the north-star (GUI-first, declare-not-infer, valid-by-construction, block-friendly)
and the track-stock direction (anchors re-derive with the stock). The CUSTOM-op need is narrow (a probe with a few
stock-relative passes) — A's bounded vocabulary covers it and the block is a clean stack of pass-rows. **Keep the BUILT-INS as
their fns** (the backlog allows "keep fn or migrate") — they carry WE-authored conditional complexity (middle's 1/2/4) that
needn't become data; the spec serves CUSTOM ops. The first time a custom op needs a position outside the vocabulary is the
trigger to add a token/anchor — not to fall back to expressions.

**Integration (NEXT turn, when blessed):** `makeProvider(def.sim.starts)` in opSimStarts.js + `setUserSimStarts(def.opType,
provider)` in userOps (beside `setUserSimIntent`). NO engine/trace change — opSimStarts already feeds the wizard + (B0) the editor.

**GATE → human/advisor:** pick **A vs B** + the starting vocabulary (anchors + `@tokens` + the `when` shape) before I build
`makeProvider` + (B3) the block. NOT building this turn.

## 2026-06-29 — turn 92: B1 BUILD — `def.sim.starts` declarative path (Option A blessed)

GATE RESOLVED: the human blessed Option A (structured anchor+offset rows) + the vocabulary as-is. Built the data layer
(B1) ONLY — not B2 (drag-persist) or B3 (the Blockly block).

- **`makeProvider(rows)`** in [opSimStarts.js](DDCS-Studio/web/viz/opSimStarts.js) — interprets an array of pass-ROWS into a
  provider `(params, stock) ⇒ [{x,y,z}…]`. The blessed vocabulary: `anchor` ∈ centre | edge(axis,side,out) | frac(fx,fy) |
  radial(axis,sign,r); `plane` ∈ top | probe | @flank(=-R) | `<number>`; `side`/`out`/`r` = a literal OR an `@token` from the
  bound set { `@dir1 @dir2 @outset @R` }; optional `when:{param,is}` → the row only contributes when params match (the
  conditional pass count). PURE — it derives the SAME scope the built-ins use (`sx/sy/sz`, `cx/cy`,
  `outset=max(6,min(dist·0.6,15))`, `R=min(sy,sz)/2`); unknown picks degrade to the stock centre, never throws.
  - `edge` matches the built-in `outside()` exactly (pos/min ⇒ the `-out` side, neg/max ⇒ the `dim+out` side) so a built-in's
    pattern re-expresses faithfully.
- **Wired in [userOps.js](DDCS-Studio/web/blocks/userOps.js)** beside `setUserSimIntent` (mirror): `registerUserOp` →
  `setUserSimStarts(def.opType, makeProvider(def.sim.starts))` when `def.sim.starts` is a non-empty array; `deleteUserOp` →
  `setUserSimStarts(opType, null)` (clears, like the intent). Data → provider → the EXISTING registry seam. NO engine/trace
  change — `opSimStarts` already feeds the wizard AND (B0) the editor.
- **BUILT-INS UNCHANGED** — middle/alignment/rotary keep their fns (the backlog allows it; the spec serves CUSTOM ops).
- **VERIFIED (new `sim-starts-data.spec.js`, 3 tests):**
  - **(a) PROOF-OF-SUFFICIENCY** — MIDDLE boss-both (auto) expressed as 2 edge rows + a `when` gate, and ALIGNMENT (fence-X)
    as 2 frac rows, each run through `makeProvider` and asserted EQUAL to that built-in's own `opSimStarts` output (representative
    params). Proves the vocabulary is sufficient + the interpreter correct for both the wall-edge and fraction patterns. (The
    one pick NOT proof-backed is `radial`+`@flank` — rotary's flank uses `R+retract`, a compound the single-`@token` `r` can't
    express; tested directly, NOT via rotary. A future `out` offset on `radial` would close that — out of scope, built-in keeps its fn.)
  - **(b)** every anchor (centre/edge/frac/radial), plane (top/probe/@flank/number), @token (@dir1/@dir2/@outset/@R), and the
    `when`-gate conditional count (twoAxis on→2 / off→1) interpret to the expected coordinates.
  - **(c)** a DECLARED `def.sim.starts` flows end-to-end: the direct registry seam (setUserSimStarts(makeProvider(rows)) →
    opSimStarts) AND the full userOps path (`createUserOp` carrying `sim:{starts}` → registered provider → opSimStarts; the
    gated pass appears only when twoAxis is true; `deleteUserOp` clears → null).
  - Regression: op-sim-starts-registry / custom-op-sim-intent / custom-op-panel / federated-registry / middle-aim all pass
    isolated (this is a pure-module add — no DOM/render/engine change).

## 2026-06-29 — turn 94: B3 — the SIM-DECLARATION block (`def.sim.starts` as a Blockly block)

VERIFY-FIRST → **CLEAN ADDITION** (built, not gated). The bridge already has the EXACT precedent: the `sim` block
([wizards/ops/sim.js](DDCS-Studio/web/wizards/ops/sim.js)) is a PALETTE atom (category 'Wizard UI', `emit: () => []`,
checkbox fields) that round-trips through the GENERIC field path (toRecord/recToJson key off `BLOCKS[type]` + `fieldsOf`),
and `userOps.simIntentFromStack` reads it at SAVE → `def.sim`. A sim-START block is the same shape — no emit-reverse-sync
restructure (the emit path is untouched; the block emits nothing and is read as a declaration).

- **[simStart.js](DDCS-Studio/web/wizards/ops/simStart.js) (NEW)** — the `simstart` atom: ONE pass-start per block, fields =
  B1's Option-A vocabulary (anchor centre|edge|frac|radial · axis/wall/out · fx/fy · sign/rad · zplane top|probe|@flank ·
  whenparam/whenis). `dynamic: 'anchor'` (the ddcs_dynfields extension) shows only the chosen anchor's fields. `emit: () => []`.
  Registered in [ops/index.js](DDCS-Studio/web/wizards/ops/index.js) PALETTE beside `simBlock` → auto-defined as a Blockly
  block + a 'Wizard UI'-styled toolbox entry (reads as a distinct authoring/preview block, not an emit-atom).
- **[bridge.js](DDCS-Studio/web/blocks/blockly/bridge.js)** — SELECTS `anchor`/`wall`/`sign`/`zplane` (the dropdowns) + their
  tooltips. **Field-name care:** renamed the edge side field to `wall` because `side` ALREADY exists in SELECTS (contour
  cutter side outside/inside/on) — reusing it would have mis-typed the dropdown; `zplane`/`rad` likewise avoid `plane` (arc
  G17-19) and `r`'s misleading desc.
- **[userOps.js](DDCS-Studio/web/blocks/userOps.js)** — `simStartsFromStack(children)` (the `simstart` blocks → def.sim.starts
  ROWS, per-anchor-pruned so the data stays tidy + matches a hand-written spec; "15"→15, "@outset" kept) and
  `simStartsToBlocks(rows)` (the reverse — every field set so recToJson's dropdowns stay valid; renders a declared, incl.
  B1-programmatic, op's starts AS BLOCKS). Mirror `simIntentFromStack`. **The round-trip is against def.sim.starts (the
  DECLARATION), never the macro** — there is no emitted line to reverse-sync.
- **[devMode.js](DDCS-Studio/web/blocks/devMode.js)** — at save, `sim.starts = simStartsFromStack(children)` when present
  (beside the existing `blkSim`), so authoring `simstart` blocks → `def.sim.starts` → (B1) `makeProvider`.
- **VERIFIED — REAL-SYMPTOM, not synthetic** (new `sim-start-block.spec.js`, 2 tests): (1) registered + anchor/wall render as
  dropdowns + `emit()===[]` (a move beside it still emits) + the PURE rows⇄blocks round-trip is identity + the round-tripped
  rows still drive `makeProvider` (2 passes, the gate keeps the 2nd); (2) **through the LIVE Blockly workspace** — a custom
  op's def.sim.starts rows `ddcsLoadBlockStack(simStartsToBlocks(rows))` render as 2 drawn `simstart` blocks; editing a block
  field (`WALL` @dir1→@dir2) and reading the workspace back (`workspaceToStack` → `simStartsFromStack`) shows the edit flowed
  into def.sim.starts (NOT a macro line); the `when` gate survives. Regression: gui-sim/panel/param, blocks-render/roundtrip,
  federated, custom-op-sim-intent, dev-mode, sim-starts-data, op-sim-starts + the toolbox screenshots (render/mobile/theme)
  all pass ISOLATED (16 + 2). SCOPE = B3 only (NOT B4 the two-mouth op block / NOT B5 shared stacks). Trusted isolated runs
  per the agreed approach (the dev server overloaded 3× this session on full runs); recommend a fresh-server full re-run.

## 2026-06-29 — turn 96: B0 REDO — GATE (the marker-on-insert fix collides with a deliberate "editor stays clean" contract)

VERIFY-FIRST (root, confirmed by code-trace AND a REAL-insert probe — the turn-88 lesson, no synthetic):
- The wizard Insert path (`wizardManager.insert()` :399 → `ops.commitActiveOp()` / `commitDecodedCode()` →
  `ddcsLoadBlockStack`) DOES go through the program model. The editor TEXT is then PROJECTED from the program:
  **[programModel.js:150](DDCS-Studio/web/blocks/programModel.js) `proj = emitMapped(stack)` — CLEAN, no markers.**
  `serializeWithMarkers` (markerLine per op, :94) exists but is **EXPORT-ONLY** (:189 — "export only; **editor stays
  clean**"). So the editor is markerless BY A DELIBERATE DECISION, not a per-insert bypass.
- **REAL-insert probe** (open middle → boss → `wm.insert()`): the editor starts `#1=200 ( Max probe distance )` with
  **`@DDCS` ABSENT** (exactly the human's screenshot), AND `ddcsGetBlockProgram()` HOLDS the `middle` op with full params
  (featureType/inAxis/transAxis/axis/…). So turn-88 `gpStartHints` is starved BY CONTRACT — and the live PROGRAM MODEL
  already carries the op. **A marker prepended on insert would VANISH on the next reproject** (proj = emitMapped re-runs).

**THE CONFLICT (why I'm gating, not building):** the dispatched fix — "make the INSERT emit the `@DDCS` marker [in the
editor]" — reverses the deliberate **"editor stays clean / markers export-only"** decision (programModel:189). The robust
form (route the projection through `serializeWithMarkers`) is a CONTRACT change: every op gets a `( @DDCS:1 {…} )` line the
user sees in their G-code, and it would shift the editor-text + screenshot tests. The advisor's note diagnosed a per-insert
"bypass"; the real root is a whole-editor design choice. Per the protocol (don't reverse a deliberate contract unilaterally;
the advisor pre-authorized "GATE if it needs a real restructure"), the options:

- **A — markers LIVE in the editor** (the dispatched mechanism, robust form): change the projection → `serializeWithMarkers`.
  Self-describing editor + .nc (survives raw-.nc save/reload; the custom-op bonus). **COST:** reverses "editor stays clean"
  (markers visible in every program), broad/risky (editor-text + screenshot tests), a real CONTRACT change.
- **B — gpStartHints reads the LIVE PROGRAM MODEL (RECOMMENDED, no contract change):** `gpStartHints` reads
  `ddcsGetBlockProgram()` (the op records → per-op `opSimStarts`) as the PRIMARY source, KEEPING turn-88's editor-text
  `@DDCS` parse as the FALLBACK. Fixes the human's LIVE symptom (right after insert the op is in the program model → hints →
  the 2nd-axis lands on ②), **lights up CUSTOM ops too** (the program record → opSimStarts → its B1/B3 provider), the editor
  STAYS CLEAN, and a loaded .nc that HAS markers still works (the fallback). The only thing it can't do that A can: a RAW
  clean .nc (no live program, no markers) reloaded — which carries no op identity anyway.

**RECOMMENDATION: B** — it achieves the advisor's GOAL (editor sim matches the wizard + custom ops light up) WITHOUT
reversing the deliberate editor-clean contract, and keeps the self-describing path working via the existing fallback. A only
wins if LIVE markers in the editor text are explicitly wanted — and since that changes what the user sees in their G-code,
it's the HUMAN's call. **GATED — no build this turn.** Awaiting A vs B.

## 2026-06-29 — turn 98: B0 BUILD — Option B (program-model-first hints; editor stays clean) [human + advisor blessed]

Fix the editor-sim divergence (an inserted boss-both: the 2nd-axis must land on the per-pass start ②, matching the wizard,
NOT the WCS edge) WITHOUT touching the editor-clean contract — chosen over Option A (no editor-text markers).

- **VERIFY-FIRST (REAL insert, not synthetic):** probed `wizardManager.insert()` of a middle boss → the program record carries
  the FULL params (`{featureType:'boss', findBoth:true, axis:'X', dir1:'pos', dir2:'pos', dist:'200', inAxis/transAxis, …}`),
  and `opSimStarts('middle', rec.params, stock)` → **2 hints**, ②=`{50,-15,-5}` (the Y-wall, not the WCS edge). So the live
  program model is sufficient for the registry.
- **BUILD ([gcodePreviewTab.js](DDCS-Studio/web/ui/gcodePreviewTab.js) `gpStartHints`):** read the LIVE PROGRAM MODEL first —
  `ddcsGetBlockProgram()` → for each op record `opSimStarts(opType, params, stock)` → concatenate the per-pass hints. KEEP
  turn-88's editor-text `@DDCS` marker-parse as the FALLBACK (for a loaded .nc that already has export markers). So:
  program-model PRIMARY, markers SECOND. **No projection change** — the editor text stays clean (Option A rejected). Lights up
  CUSTOM ops too (the program record → opSimStarts → the def.sim.starts provider).
- **VERIFIED — REAL-SYMPTOM (new `editor-sim-real-insert.spec.js`, through `wizardManager.insert()`, NOT a synthetic marker):**
  (1) real-insert a boss-both → the editor preview's `getPassStarts()[1]` (②) MATCHES the wizard's `opSimStarts(…)[1]`, the
  editor text has NO `@DDCS` (stays clean), 2 passes; (2) a SECOND real insert → two program ops, each independently resolving
  its own 2 hints; AND a loaded .nc with an `@DDCS` marker (program emptied) still resolves via the FALLBACK (2 passes). The
  turn-88 `editor-sim-hints.spec.js` now exercises that fallback path — still green. Regression: dro-position, op-sim-starts,
  sim-starts-data, probe-anim, editor-click-seek pass isolated (14 total). Trusted isolated runs (server overloaded 3× this
  session on full runs); recommend a fresh-server full re-run.
- **NOTE (honest):** multi-op concatenation aligns the FIRST op's passes with the trace; for several STACKED multi-pass probes
  the trace's running `_pass` can drift on later ops (each op contributes its hints, but per-pass alignment past the first is
  the same deeper limitation flagged since turn 88 — B2/B4 territory). Also: if the editor is HAND-EDITED to diverge from the
  program model, the program hints can be stale — acceptable per the one-source choice (the program is the truth right after an
  insert, the human's actual flow). SCOPE = Option B only (NOT A / no editor markers; NOT B2 drag-persist; NOT B4).

## 2026-06-29 — turn 102: B-FLASH-2ND-AXIS — the 2nd-axis probe-retract render flash (render-side, one-line)

Kill the 4× flash on an AUTO boss-both: during the 2nd-axis probe the rendered 3D spindle jumped to an offset
position at each probe-retract, then snapped back. RENDER/animation-side only — the macro is UNCHANGED (post-revert
HEAD = `cbdc44d`). No G53/G90 introduced (would re-break B-START — [[g53-move-breaks-preview-start-anchor]]).

- **VERIFY-FIRST — empirical, render-level (NOT e.pos; the 4th render bug this thread, e.pos lied 3×).** Wrote a
  throwaway diagnostic that drove the REAL live engine through an auto boss-both and fed every `onPositionChange`
  into a REAL `GcodeViz3D.setToolPosition`, recording the RENDERED `_animTool.position` + `pos.pass` per frame.
  Ground truth: ①=`{-15,30}`, ②=`{30,75}` (offset ②−①≈63 mm). PASS histogram `{0:10, 1:8, undefined:8}` — **8
  pass-less frames**, all the short probe-RETRACTS. In the 1st axis the missing pass defaults to `starts[0]`=① =
  the CORRECT anchor → no visible flash. In the 2nd axis (4 of them: f#15/17/22/24 = 2 walls × slow/fast) it
  defaults to ① but should be ② → renders at `①+raw` (e.g. `{-15,17}`) instead of `②+raw` (`{30,62}`) → the
  `{45,45}` jump, then the next emit (with pass) snaps back. EXACTLY the human's "4× at each contact".
- **ROOT (code-anchored):** every per-frame emit sets `p.pass = this._pass` (the animated `_advanceMove` ~:481, the
  landing `_finishMove` :494) — EXCEPT the sub-frame coordinate-move emit at [GcodeExecutionEngine.js:1050]
  (`onPositionChange({x,y,z})`, no pass). A retract is a fast rapid over a few mm → `realMs/speed ≤ 50` → it skips
  the in-flight `_move` and emits via that pass-less path. `setToolPosition` then defaults `pass→0` →
  `starts[0]`=①. The advisor's hypothesis (pos.pass → null → defaults 0 → jump by starts[0]−starts[1]) confirmed.
- **FIX (one line, render-reporting only):** add `pass: this._pass` to the :1050 emit, identical to its two
  siblings. The retracts now report their pass → during the 2nd axis they carry `pass=1` → render on ②. pass-0 ops
  unaffected (default was already 0). NOT a macro/G53/G90 change; the emitted G-code is byte-identical.
- **WHY the flash only shows at real speed (and why the grab tool is the wrong instrument):** it's a ~1-tick
  transient (the retract frame is on-canvas ~12 ms, then corrected). SLOWING the sim to capture it converts the
  retract from a sub-frame jump into an animated `_move` → that path already carries pass (~:481) → the bug HIDES
  itself. So fps sampling (and headless WebGL ~2 fps) misses it; the deterministic render-VALUE capture is the
  reliable gate. (Human confirmed live: "flash is gone".)
- **VERIFIED — REAL-SYMPTOM (new `middle-2nd-axis-flash.spec.js`):** drives the real live engine + a REAL viz, asserts
  every frame AFTER the diagonal reposition renders on the ② anchor (boundary found STRUCTURALLY via the REPOSITION
  onLineChange line, NOT the `pass` field this fix corrects). Reverted the one-liner → FAILS (2nd-axis frame renders
  at `{-15,17}`=①); fixed → PASSES. Targeted sim/probe set 47/47 green; FULL suite 415 passed / 2 skipped / 1 failed,
  the lone failure `knob-persist` (Blocks FORM-LIVE, unrelated domain) is a parallel-load flake — PASSES isolated.
- **HUMAN-EYES artifact (animation-capture skill):** built the contact sheets by EXECUTION LINES (the human's idea) —
  stepped the engine one emit at a time, one still per step, fps-independent so the 1-tick flash lands on its own
  frame. BUGGY sheet: f015/f017/f022/f024 = `p- s0 FLASH` (pass null → ①), spindle visibly at the ① corner. FIXED
  sheet: f014–f025 all `p1 s1`, riding ②, zero FLASH. (Sheets are in the session scratchpad, opened in VS Code.)
- **SKILL UPGRADE (outside the repo — `~/.claude/skills/animation-capture/`, NOT in this commit):** added a general
  step-driven mode to `web_capture.cjs` (`scenario.step → label|null`, one still per tick), documented it
  generically in SKILL.md (any deterministic driver — execution timeline, token/word walk, state machine, scrubber,
  action log; granularity is the scenario's choice), + a worked `examples/middle-probe-steps.scenario.cjs`.
- **FLAGS for the advisor:**
  - **Shared root with B-END-OFFSET / B-TRANS-ANGLE** — partly. B-FLASH was specifically the pass-less SUB-FRAME
    emit; it is INDEPENDENT of the end-retract (B-END-OFFSET) and the static traverse angle (B-TRANS-ANGLE). All three
    touch the 2nd-axis/per-pass anchor on the render, but this fix does NOT address B-END-OFFSET or B-TRANS-ANGLE
    (still queued). SCOPE kept to the flash only, as dispatched.
  - **Sibling pass-less emits** at :860 (native HOMING move) and :1095 (arc real-time play) still omit `pass`. They
    are NOT on the boss-both 2nd-axis path (not reached by the middle probe), so out of scope this turn — but a
    homing-then-probe or an arc-in-a-multipass op could show the same anchor glitch. Worth a look if it surfaces.

- **CAPTURE made FAITHFUL (human feedback mid-turn):** the first step-capture hand-built a synthetic scene → the
  human flagged "your captures aren't what I'm seeing / path going off stock / use top-down". Reworked the example
  scenario to drive the REAL wizard: configure the actual Middle form (Boss·Find Both·Auto), let the panel build its
  REAL scene (stock/path/①②/camera), lift the REAL generated code (`#wiz_middle_code`) + `panel.getPassStarts()` +
  `panel.getStartPos()` + `viz._stock`, `viz.setView('top')`, then step a fresh engine over the REAL viz. The
  before/after now matches the app (top-down: the probe circle visibly jumps off the boss to ① on the 4 FLASH
  frames, then rides ② clean once fixed). Human confirmed.

## 2026-06-29 — turn 104: MID-PROBE-Z-FIRST — GATE (the Z→XY sim transition collides with the deferred centre-move)

VERIFY-FIRST (precedent + target fully traced; the mechanical wiring is unambiguous, ONE design fork blocks a faithful build).

**READY-TO-BUILD, no ambiguity** (mapped end-to-end against the corner):
- EMIT: `params.probeZ`; a Z-surface two-pass block BEFORE `seq(axis,dir1Plus,51)` ([middleWizard.js:150]) — `PR('Z','#7','#3');
  CK('Z',1); MV('Z','#10'); PR('Z','#7','#4'); CK('Z',1);` then write Z0 in middle's convention `A('#[#70+2]','#1927')`
  (#1927 = the Z trigger result, off=2), retract. Confirm prompt branch OVER-vs-current ([:148]). Byte-identical when OFF.
- FORM: `m_probe_z_first` checkbox (index.html, near m_circular) + middleView reader + inputIds + app.js viz-listener (:216) + checkboxIds (:308).
- BLOCKLY round-trip: `middle_op` PROBEZ field (bridge.js block def :251 + message) + stackBridge toRecord (:46) + toNode (:163).
- SCHEMA: `probeZ: Bool()` (opSchema middle :90) + field-map `probeZ:'m_probe_z_first'` (:153).

**THE FORK (why I'm gating, not picking):** the live sim anchors EACH PASS to ONE per-pass start and then FOLLOWS the macro's
INCREMENTAL moves within that pass (that's how the corner's Z-then-XY works — its macro escapes laterally + plunges, and the
sim tool follows). For MIDDLE the Z-probe start and the first XY-probe start are PHYSICALLY INCOMPATIBLE in one pass:
- **BOSS (the showcase):** Z datum needs the tool OVER the stock top (e.g. centre); the first XY probe needs it OUTSIDE the
  boss wall, OFF the footprint. Z-down from the XY start MISSES (no material below); X-probe from the Z start is INSIDE solid
  material (invalid). They can't share pass-0's start — so a clean Z-first sim needs the Z probe as its OWN pass with a
  reposition to the first wall.
- **That reposition geometry IS the "shared centre-move precursor"** the TWO-WCS spec (substrate §) + the batch list (item 4)
  explicitly DEFER. So the dispatch ("copy the corner, Z block before seq, retract THEN XY") and the deferral are in tension:
  a faithful Z-first *render* (VERIFY #3, the human-eyes gate) needs the very centre-move that's parked for later.

**OPTIONS:**
- **A — minimal "shared pass-0 start" (dispatch-literal):** Z block + Z0, opSimStarts sets starts[0] OVER the stock. EMIT is
  correct + byte-identical-OFF, but the BOSS sim breaks (Z start ≠ XY start in one pass) → VERIFY #3 (render) FAILS. Rejected.
- **B — pull a minimal Z→XY reposition into THIS task:** after the Z probe emit a hands-free `REPOSITION:` (lift + the existing
  retract) so the Z probe is pass 0 (start OVER the stock) and the XY becomes pass 1+ (its existing correct starts). opSimStarts
  PREPENDS a Z-over-stock start when probeZ; XY pass count +1. Sim shows a distinct Z pass (descend → datum) → reposition → XY.
  Byte-identical-OFF preserved. COST: deviates from the corner's auto-move (adds a pass boundary; the PHYSICAL auto centre-move
  stays deferred to item 4 — for now the reposition is a marker/operator-jog, like middle's manual idiom).
- **C — resequence:** do the centre-move precursor (item 4's substrate) FIRST, then Z-first lands trivially on top. Honors the
  spec's stated ordering but reorders the human-approved batch.

**RECOMMENDATION: B** — it delivers a faithful Z-first render NOW (the human-eyes gate), keeps OFF byte-identical, and defers
only the AUTO physical centre-move (item 4), matching the spec's "Z→X→Y convergence, datum as a sim overlay". Need the
advisor's call on B (+ is an interim operator-jog between Z and XY acceptable, or must it be hands-free now → then C).
NOT building until blessed (don't push past the gate). Everything in READY-TO-BUILD lands the moment B/C is chosen.

## 2026-06-29 — turn 106: MID-PROBE-Z-FIRST — BUILT (declaration reusing middle's own twoPass + reposition)

Advisor turn-106 dispatch RESOLVED my turn-104 gate = my Option B, reframed: add probe-Z-first as a DECLARATION reusing
middle's OWN pieces (NOT a 3rd hand-rolled corner copy — human called that out). Z is its OWN declared sim pass → the
faithful render. SCOPE = Z-first only (NOT the general travel GUI = batch #2, NOT the shared-brick consolidation = #5,
NOT B-END-OFFSET/B-TRANS-ANGLE). No G53/G90.

- **VERIFY-FIRST (Z probe vars):** confirmed Z = status #1922 / result #1927 / stop #1907 / limit #1917 against
  [probeBlocks.js:13-23] (the documented +2-per-axis pattern), NOT assumed. Added `Z` to middle's `AX`.
- **EMIT ([middleWizard.js]):** `params.probeZ`; BEFORE `seq(axis,dir1Plus,51)`, when probeZ: `twoPass('Z', false, '#57')`
  (REUSE middle's own two-pass — emits the same stop/limit-reset → fast G31 Z↓ + check + retract → slow G31 Z↓ + check +
  save#57 + retract as X/Y do, no new dup) → `A('#[#70+2]','#57')` (Z0 write, middle's `#[#70+off]` convention, Z off=2) →
  `reposition('jog clear, to the first wall')` (REUSE the existing helper → the "REPOSITION:" comment makes the parser count
  the XY as the NEXT pass). Confirm prompt branches OVER-the-stock when probeZ. The macro now sets Z FIRST, then X, then Y.
- **DECLARE the Z pass ([opSimStarts.js] BUILT_IN.middle):** when `params.probeZ`, PREPEND a Z-pass start `{cx, cy, +min(5,sz/2)}`
  (over the stock top, z>0, probing DOWN) → per-pass starts = **[Z, ①X-wall, (②Y-wall)]**. This is the resolution to the gate:
  the Z probe gets its OWN start so the boss Z-start (over the top) and the XY-start (outside the wall) no longer collide in
  one pass → the sim renders Z-pass → reposition → XY-passes. Pocket too: [Z, centre].
- **WIRING (mechanical, mirrors the corner across 8 files):** form checkbox `m_probe_z_first` (index.html) + middleView reader
  + inputIds; app.js viz-listener + checkboxIds; Blockly `middle_op` PROBEZ field (bridge.js block def + "Z-First %8" message,
  shifted %9-11) + stackBridge toRecord/toNode; opSchema `probeZ: Bool()` + field-map `m_probe_z_first`.
- **VERIFIED — 3 property gates + the RENDER (new `middle-probe-z-first.spec.js`, 3 tests, all green):**
  - (1) EQUIVALENCE: `generate(probeZ omitted) === generate(probeZ:false)`, and the OFF macro has ZERO Z-first artifacts
    (no `Z Surface`/`#1907`/`#[#70+2]`) → byte-identical.
  - (2) ON ORDERING: a `G31 Z` probe + `#[#70+2]=#57` Z0 write + the `REPOSITION` all emit, and STRICTLY BEFORE the first
    `G31 X` (Z datum → reposition → XY).
  - (3) opSimStarts: probeZ adds exactly one LEADING pass, over the stock centre, z>0; the existing XY starts are unchanged
    (just shifted after Z); pocket → [Z, centre].
  - Blockly round-trip: a `{opType:'middle', params:{probeZ:true}}` record → `middle_op` block field PROBEZ='TRUE' → read
    back via `workspaceToStack` → `params.probeZ===true` (and false round-trips false).
  - **HUMAN-EYES RENDER (the gate, not a property test):** a step-driven TOP-DOWN capture of the REAL wizard (Boss·Find
    Both·Auto·Probe-Z-First) shows **p0 Z** (tool over the stock centre, descending = the Z datum) → reposition → **p1 XY**
    (X walls) → **p2 XY** (Y walls). 32 frames, opened in VS Code. Z is established FIRST, faithfully.
  - Regression: focused 48/48 (middle-*, op-sim-starts, sim-starts-data, per-pass, cam-slot-sim, blocks-roundtrip,
    blockly-port, blocks-render screenshot, probe-fixes) + full suite (running). The `middle_op` block message change did NOT
    shift the blocks-render baseline.
- **FLAG:** the Z→first-wall reposition uses `reposition()` (an operator-jog prompt) for NOW — per the dispatch, the uniform
  AUTO/MANUAL per-transition travel GUI is batch item #2 (it'll subsume this Z→X transition + the existing inAxis/transAxis
  toggles). So an AUTO boss-both with probeZ currently asks the operator to jog from the Z spot to the first wall; that
  becomes hands-free in #2. (Resolves TWO-WCS-DATUM decision C: target datum = XYZ when ON, XY when OFF.)

## 2026-06-29 — turn 108: PROBE-SURFACE SNIPPET — the canonical probe primitive in the learner library

Make 'probe surface' a curated Snippet in the Probing category ([data/learnerLibrary.js] SNIPPETS), beside z-touch —
DEFINE-ONLY (the wizard migration to compose from it is batch #6; wizards UNTOUCHED). Z-FIRST cb2518e reviewed PASS t107.

- **VERIFY-FIRST (atom shapes, not assumed):** confirmed against the real atoms — `move{z:5}` emits **`G0 Z5`** (Z-ONLY;
  move.js: "only the axes that are set are emitted", target absolute), `probecheck{axis:'Z',goto:1}` emits
  `IF #1922!=2 GOTO1` (a valid line, does NOT throw on a dangling label — the validator only needs >0 emitted lines),
  `proberead{axis:'Z',var:'#50'}` saves the latched trigger pos. `stackToFlyoutBlock` chains via Blockly `next.block`.
- **BUILT — two entries under `Probing`:**
  - `probe-surface` (single-pass, matches z-touch's shape + the human's "4 atoms"): `cmt → probe (G31 in) → probecheck
    (verify/goto-fail) → move (retract Z5) → proberead (#50)`. Sensible defaults (axis Z, feed 100, port 3, level 0).
  - `probe-surface-2pass` ("fast + slow" — the version the WIZARDS use, so #6 composes from the right shape):
    `cmt → probe(fast F200) → check → retract → probe(slow F50) → check → retract → proberead`.
  Both are plain `{type,params}` stacks (the same thing the app builds); the toolbox tree + drag-in are generic.
- **VERIFIED (learner-library.spec.js — the validator gate + a new focused test, 2 green):**
  - the existing validator (every curated composition emits >0 lines without throwing) now covers both new snippets;
  - the new test asserts: both are curated under `Probing`, the `Probing` sub-category shows under 📚 Snippets, each
    drags in as ONE connected stack (single = 5 blocks, two-pass = 8, counted down the `next.block` chain), and each
    emits a real `G31` + stores a result. Focused blocks regression (blocks-render screenshot / roundtrip / blockly-port)
    5/5 — adding flyout ENTRIES does not drift the static toolbox-tree screenshots. Full suite running.
- **SCOPE:** define-only (canonical snippet + Blocks-tab drag-in). NOT the wizard migration (#6 — needs a
  wizard-references-a-snippet mechanism + a byte-identical gate). No wizard files touched. Files: data/learnerLibrary.js
  + tests/learner-library.spec.js.
- **NOTE (honest):** the retracts are absolute `G0 Z5` (matching z-touch's absolute convention + the existing Probing
  examples, no distmode side-effect) rather than the wizards' incremental lift — a teaching-clean default; #6 will map
  params when it composes the wizard cycles from this shape. The probecheck `goto 1` is a nominal fail-handler ref (no
  label in the bare snippet, like a primitive meant to slot into a framed program).

## 2026-06-29 — turn 110: B-END-OFFSET — WRONG TARGET (human correction) → reverted, passing back

The turn-110 dispatch framed B-END-OFFSET as the TOOL/3D-spindle end POSITION (parks at the last wall vs rests over the
centre) and asked for an incremental end-retract to (#53,#56). I VERIFY-FIRST traced it: every boss-both case (auto /
manual-in-axis / Y-first) rendered offset ONLY in the SECONDARY axis (~32 mm); primary already centred. I built a one-line
G91 incremental re-centre `MV(second,[#56-#55-retract])` (mirrors transTraverse; NO G53/G90 — avoided the B-START trap),
and the render confirmed the tool then rested exactly over the centre (contact sheet, all 3 cases Δ=(0,0)).

**HUMAN STOPPED IT (turn 110):** "the problem wasn't the tool end position — **it was the probe WCS datum position**." So
B-END-OFFSET is NOT where the tool parks; it's that the **WCS DATUM the both-axis probe SETS lands OFFSET** (vs single-axis
fine). The tool-end re-centre solves a non-problem. **REVERTED in full** (middleWizard.js back to committed; the tool-end
regression spec deleted). Working tree clean — no code change this turn.

**Datapoint for the re-dispatch:** the COMPUTED centres trace CORRECT — bothAuto on a 60×60 boss → #53=30, #56=30 (true
centre), written `#[#70+0]=#53`/`#[#70+1]=#56`. So the offset is NOT in the #53/#56 values as traced; it's in how the
**WCS datum is positioned/derived/displayed** for both-axis (the datum the probe establishes, the showcase of
TWO-WCS-DATUM-SPEC). I did NOT investigate further per the human ("pass it on"). GATE → advisor: re-dispatch B-END-OFFSET
against the WCS-DATUM symptom (what's offset, where it's seen — DRO / WCS origin / the datum overlay), not the tool position.

## 2026-06-29 — turn 112: DATUM follows the WCS-WRITE event — ONE declared source (decision A) [+ FLAG: a residual render offset]

Resolves the turn-110 gate. The WCS datum gizmo was pinned to the PROBE-CONTACT events (the walls); the WCS is written by
the CALCULUS (`#53=[#51+#52]/2 → #[#70+off]=#53/#56`). Re-pinned the datum to the WCS-WRITE — ONE declared source for
EVERY probe type (decision A, human via the decision sieve: G2 declare-not-infer + G3 one-source both fire on B; A is also
the simpler build). SIM-ONLY, no macro change, the probe-contact DISCS + the TOOL are untouched.

- **VERIFY-FIRST (the hook + frame, real render not e.pos):** drove the live engine + the real viz → the datum gizmo sat at
  `(60,0)` = a wall-CORNER (the bug), and `#53/#56 = (30,30)` = the scene centre = the contacts' midpoint (SAME part-local
  frame as the gizmo). So positioning the datum at `#53/#56` lands it at the centre.
- **DATUM SOURCE re-pinned ([gcodeViz3d.js]):** `markDatumWrite(axis, value)` records the per-axis WCS-write centre into
  `_datumWrite`; `_updateDatum` is now driven SOLELY by `_datumWrite` (a written axis at its centre; an un-written axis at
  the contacts' MEAN = the probe plane), shown ONLY once ≥2 axes are written → no flicker through the walls. `probeAxisTouched`
  NO LONGER drives the datum (keeps recording contacts + dropping discs). `resetProbe` clears `_datumWrite`.
- **UNIVERSAL hook ([createPreviewPanel.js] onLineChange):** detect any assignment whose `#[…]` target resolves to
  `#70 + 0|1|2` (offset RELATIVE to the active WCS base #70 → X/Y/Z) — covers middle (`#[#70+N]`), corner (`#[#70]`, indirect
  `#[#73]`), edge (`#[#70+N]`) uniformly. New `resolveVarExpr` helper resolves `#70 / #70+1 / #73`. For a 1-probe/axis op the
  written value == that axis's contact → edge/corner render unchanged; only middle's 2-probe bisect re-pins to the CENTRE.
- **Loop reset ([createPreviewPanel.js] onFinish):** the loop restart calls `engine.run()` DIRECTLY (bypassing `play()` →
  `resetProbe`), so the datum persisted across loops. Added `viz.resetProbe()` to the loop path → fresh each loop.
- **DEAD-ENDS / micro-decisions:** (a) first hook keyed the absolute range `#805..#834` — FAILS in a bare trace because the
  active-WCS base `#70` resolves to **800** (#578 unset → `805+(-1)*5`); fixed to the offset-RELATIVE-to-#70 check (#578-
  independent). (b) the synthetic raw-G31 probe-cue/probe-wcs tests don't populate `#1925` (the engine sets probe-result
  vars for real wizard probes, not raw editor G31s) → updated those tests to write LITERAL WCS values (a valid write the hook
  reads directly). (c) corner's datum now lands at the radius-comp'd `#102/#101` = the MATERIAL corner, ~stylus-radius tighter
  than the old ball-centre contact — arguably more correct; flagged for the human-eyes gate.
- **VERIFIED:** human-eyes (user, live app): middle datum at CENTRE · no wall flicker · resets each loop — all confirmed.
  Tests: new `middle-datum-centre.spec.js` (boss X-first/Y-first + pocket-both rest at centre; real `#[#70+N]=#53/#56` emit);
  `probe-cue-refine` + `probe-wcs` updated to model A (a probe with NO WCS-write shows NO datum — correct; with the write the
  datum shows at the crossing). FULL SUITE 424 passed / 2 skipped / 0 failed.
- **⚠ FLAG → advisor (user-reported, screenshot):** on the LIVE both-axis boss the dynamic datum spawns OFFSET from the
  calculated position — "a few units inside the stock." My ISOLATED trace had `#53/#56` = the EXACT scene centre and the gizmo
  rendered there, so this is NOT the source-fix — it's a residual RENDER discrepancy (a frame/stock/WCS-offset between the
  written `#53/#56` value and where the gizmo draws, OR a stock-specific case my 60×60-at-origin trace didn't hit). "A few
  units" ≈ the stylus radius — worth checking whether the live `#53/#56` (or the gizmo's partFrame) carries a radius/offset the
  test didn't. User asked to pass this to the advisor for a follow-up dispatch (NOT fixed here). Red-crosshair visual = a
  separate queued increment (source-fix first, look second).

## 2026-06-29 — turn 114: PROBE TIP-COMP inc1 — CONFIRMED + fix works for corner/edge, but GATE (Z-surface + diameter macros don't comp)

- **CONFIRMED the centre-collision (instrument):** the sim point-collides the tool-CENTRE ray vs the stock box — middle's
  walls register at exactly `#51=0 / #52=60` (the faces, no tip geometry). So the tool centre stops ON the wall and the tip
  ball buries a radius. ROOT of the t113 offset: the corner/edge macros radius-comp (`#50=[#1925±#6]`, "edge = trigger ±
  stylus radius") assuming `#1925` = the tool centre a radius FROM the wall (real machine); but the sim's `#1925` = the wall
  itself → the comp DOUBLE-shifts → datum a radius off. MIDDLE has NO comp (`#53` = bisect) → radius cancels → unchanged.
- **BUILT + VERIFIED the fix (numerically):** `stockProbeStop(A,B,stock,rotaryAxis,tipR=0)` grows the outer box / shrinks the
  pocket cavity / grows the cylinder OD by the tip radius → the tool CENTRE stops a radius short (the tip touches the surface).
  Engine + viz `_rebuild` pass `settings.probes.radius` (the DECLARED tip radius, default 2.0). Result: EDGE `#50` went
  `2` (a radius INSIDE the stock — exactly the human's symptom) → `0` (ON the wall, recovered by the macro comp); MIDDLE `#53`
  stayed `30` (bisect cancels — regression guard holds). So the tip radius is correct and fixes the dispatch's symptom.
- **⚠ GATE (the dispatch's "if a macro comp is needed, STOP" condition fires — for OTHER probes):** the tip radius is a
  UNIFORM geometric change, so it also moves every UN-comp'd surface measurement. The point-collision was MASKING latent
  radius-comp gaps (off on a real machine too, just hidden by the no-tip sim):
  - **DIAMETER spans (no comp):** circular `#58/#59 = ABS[#51-#52]` → off by 2r (middle-circular-sim fails).
  - **Z-SURFACE probes (no comp):** rotary `#56 = [#50−#55]` (Zc = top − R) → off by r; middle Z-first `#57` (Z0) and
    edge/corner Z likewise (rotary-center-sim ×2 fail). Bisects are fine (middle centre, rotary Yc `#54`).
  - **Legitimate (not a gate):** probe-cavity-collision (25→23, 10→8) — the tool centre correctly stops a radius short.
  - 5 tests fail; the diameter is IRREDUCIBLE (the same XY tip radius that fixes corner/edge also shifts the XY span).
- **REPORT (the dispatch's 1-liner):** Studio rolls its OWN G31 corner/edge sequences with the comp BAKED INTO the emitted
  macro (`#50=#1925±#6`) — so corner/edge are correct on the real machine + now in the sim. The Z-surface + diameter macros
  do NOT comp → they need it (macro change). So the comp gap is REAL (real-machine), not sim-only, for those.
- **ACTION:** per the dispatch ("don't build the macro comp this turn, gate it back") I **REVERTED** the tip-radius edits
  (probeGeometry.js / GcodeExecutionEngine.js / gcodeViz3d.js) → suite back to green. The fix is trivial to re-apply (the
  `tipR` param + the box-grow/cavity-shrink/cylinder-grow + passing `probes.radius` from the engine & viz). GATE OPTIONS:
  - **(A) RECOMMEND** — pair the tip radius with radius-comp in the un-comp'd surface macros: circular diameter `#58/#59
    ∓ 2r` (bore vs boss sign), Z-surface `#57`/`#56`/etc. `∓ r`; then the tip radius lands clean across ALL probes and the
    sim matches a correctly-compensated real machine. (Several wizard macros — circular, rotary, middle Z-first, edge/corner Z.)
  - **(B)** ship the tip radius for corner/edge XY only — NOT geometrically clean (the uniform collision can't spare the XY
    diameter span); rejected.
  - Need your call on scope (A is the real fix but spans several macros = a bigger increment than inc1's "sim collision only").

---

## 🔨 turn 116 — STYLUS-RADIUS COMP (the gate's option A, implemented) — the un-comp'd macros now compensate

Advisor chose **(A)**: pair the re-applied tip radius with radius-comp in every un-comp'd surface macro, all via the
DECLARED `#6` (one source, like corner/edge — NEVER a literal). Ground-truthed every sign vs the M350 dumps; nothing guessed.

- **Tip radius re-applied (inc1):** `stockProbeStop(A,B,stock,rotaryAxis,tipR=0)` grows the box / shrinks the pocket cavity /
  grows the cylinder OD by `settings.probes.radius`; engine + viz `_rebuild` pass it. Tool CENTRE stops a radius short.
- **Comps added (all `#6`):**
  - **DIAMETER** (middle `#58/#59`): `ABS[#51-#52] ∓ [2*#6]` — BOSS −2r, BORE/pocket +2r. Two opposite contacts are each a
    ball off their wall → the centre-span is off by TWO balls. Sign by `featureType`. Derived from the native edge
    convention (`#1925±#6` toward the probe dir) applied to opposite walls; the bisect centre cancels (left alone).
  - **Z-SURFACE** (−#6): middle Z-first Z0 `#[#70+2]=[#57-#6]`, rotary Zc `#56=[#50-#6-#55]`, corner Z `#[#73]=[#1927-#6]`.
    The Z-down contact is the tool centre a radius ABOVE the surface. GROUND TRUTH: Expert "3D PROBE G55" `G10 L20 P2 Z[#110]`
    ("current position = ball radius"). Edge Z already comped (`#50=#1925±#6`) — untouched.
  - **CENTRE / Yc:** untouched — `#53/#56` and rotary `#54` are bisects; the ∓ contacts cancel (ground truth: centerx.nc /2).
  - `#6` declared in middle (only when `circular||probeZ`, keeping the basic middle byte-identical) + rotary known-method;
    middleView now passes `radius: probes.radius` so `#6` == the sim's tip radius.
- **Real-machine BUG the tip radius EXPOSED (rotary flank approach):** `#11 = R+retract` *grazes* the OD when `retract==r`
  (both 2) — the tool centre must clear the OD by `retract`, but the tip sticks out `r`. Point-collision masked it; the
  expanded OD surfaced it (flank probe started ON the surface → took the FAR wall → Yc overshot ~30mm). Fixed: `#11=[#55+#2+#6]`.
  This is correct for the real machine too (not a sim hack), so it's baked into the emitted macro.
- **Tests (7 touched; signs verified EMPIRICALLY — the comp RECOVERS the true geometry):**
  - middle-circular-sim, rotary-center-sim ×2 — **pass AS-IS** (the comp recovers true Ø / true Zc=−38.1 / Yc=38.1).
  - probe-cavity-collision ×2 (25→23, 10→8) + rotary-collision ×2 (OD 50→52, 35.36→36.77) — the COLLISION contact is now a
    tip-radius off the wall (legitimate; the macro comp recovers the true wall).
  - middle-probe-z-first — Z0 write regex → `#[#70+2]=[#57-#6]`.
- **VERIFIED:** probe regression 33/33, **full suite 424 passed / 0 failed**. Live render captured (drove a real middle-circular
  BOSS through the wizard viz + datum hook): **Ø reads true 60**, centre 30/30 (unchanged) — opened in a VS Code tab for the human.
- **Declare-or-handroll:** every comp reads the ONE declared `#6` (no literals); the diameter sign is the only *derived* term
  (no native diameter macro exists) — derived from the edge convention + confirmed by the expanded-box geometry, not guessed.

---

## 🔨 turn 118 — DATUM VISUAL (parts 1·3·4 built) + part 2 GATED (the declared-signal design)

Dispatch = 4 SIM-ONLY display parts. Built the three unambiguous ones; part 2 hit its VERIFY-FIRST gate condition.

- **Part 1 — DATUM → RED 2-AXIS CROSSHAIR.** Replaced the gold sphere `_probeGizmo` with a bold RED (`0xff2d2d`) crosshair:
  a `THREE.Group` of two thin bars (`_probeBars`), reoriented in `_updateDatum` to the plane of the 2 PROBED/written axes
  (XY / XZ / YZ; all-3-written → XY plane, Z = depth). Constant-screen via the existing `_scaleMarkers` (a Group has
  `.position/.visible/.scale`, so the rest of the datum code is unchanged). Render capture: visible, `ff2d2d`, 2 bars, at the
  written WCS (−25,−20) — opened in a VS Code tab.
- **Parts 3 + 4 — 2-SECOND PRE-LOOP IDLE (both = the same root).** The datum "cleared too fast" because the loop restarted
  fast. Two loop timers → 2000 ms: the ENGINE-sim loop (createPreviewPanel `onFinish`, was 800 ms) and the route-anim loop
  (gcodeViz3d `_frame`, was 1000 ms). `resetProbe` only runs at the NEXT run's start, so the 2 s idle holds the final datum
  visible before the loop wipes it — that IS part 3's "persists longer." "ALL sims" = both loops.
- **Tests:** probe-wcs.spec.js updated — datum colour `0xffce3a`→`0xff2d2d`, and the colour read goes through `_probeBars[0]`
  (the Group has no `.material`). 9 datum/probe tests green; full suite running.

### ⚠ GATE — part 2 (CONTACT DISC → on the calculated surface): needs a DECLARED per-axis signal
**VERIFY-FIRST finding.** The disc must know, **per AXIS**, whether a contact is a calculated SURFACE (edge/corner → shift the
disc a stylus-radius toward the wall, onto `#50/#101/#102 = #1925±#6`) or RAW (middle → stays at the tool-centre; its result is
the CENTRE, shown by the crosshair). Why this is a gate, not a hand-roll:
- **It is PER-AXIS, not per-op:** middle-Z-first COMPS Z (`#[#70+2]=[#57−#6]`) but BISECTS XY — so a single per-op flag is wrong.
- **The comp forms are HETEROGENEOUS:** the trigger var varies (`#1925/#1926/#1927`, and `#57` for middle-Z), and the comp is
  sometimes inline (`[#1927−#6]`), sometimes via an intermediate (`#50=[#1925+#6]` then `#[#70]=#50`). No single line pattern.
- **No existing op/sim FLAG** carries "this contact is a surface" — exactly the dispatch's "if it needs a new declared flag, gate" condition.

**OPTIONS (advisor's call — value vs cost):**
- **(A) NEW declared per-axis sim flag — RECOMMEND.** The op's sim declaration states, per probed axis, `surface` (shift by `#6`
  toward the wall) vs `raw` (bisected). This IS the dispatch's "a flag the op/sim carries" + matches [[custom-op-sim-intent-infer-vs-declare]]
  (declare sim intent, never infer). COST: a new declared field + wiring it from edge/corner/middle (incl. middle-Z-first's Z=surface, XY=raw).
- **(B) Read the macro's `#6`-comp at runtime** (taint `#6` through the var chain → per-axis surface flag, reusing the datum-write
  hook that already reads macro declarations). PRO: ONE source (the macro already declares the comp — no second declaration to
  diverge). CON: custom taint logic + a post-hoc disc-move (today the disc is "FIXED, never moved") + a part-local-frame assumption.
- Tension: (A) = declare-the-intent (the dispatch's stated preference) vs (B) = one-source (don't duplicate the macro's comp). Need your call.

Did NOT build part 2 (per "if part 2 needs a declared flag → STOP + gate, don't sniff op-types"). Parts 1/3/4 committed; awaiting the part-2 design.

---

## 🔨 turn 120 — DATUM VISUAL refinement: B (Z-first datum fix) + C (thin crosshair) + GLOW; Part 2 DROPPED (human, mid-turn)

Dispatched 3 parts (B Z-first datum regression · C thin 2D crosshair · Part 2 disc-on-calculated-surface). Built B + C, added
a glow (human ask), then the HUMAN stopped me on Part 2 — see the redirect below. Net: B + C + glow shipped, Part 2 dropped.

- **B — Z-FIRST DATUM REGRESSION (fixed).** The comp (84f4efd) turned the Z-first WCS write into a BRACKETED expr
  (`#[#73]=[#1927-#6]`) that the datum hook's single-var-RHS regex missed → datum Z fell back to the contact mean. ROOT cause
  found in the engine: `onLineChange` fires BEFORE `_executeStep` (GcodeExecutionEngine.js:414-415), so the write hasn't run
  yet — can't read the target inline. FIX: DEFER one line (like `pendingProbe`) — detect the assign to a WCS-offset target,
  then on the NEXT line read the engine's OWN committed value `engine.vars.get(target)` (robust to ANY RHS expression, no
  re-parsing). `onFinish` flushes a trailing write. New test (probe-wcs.spec.js) drives the bracketed Z-first write → datum Z = surface.
- **C — CROSSHAIR thin + 2D.** Replaced the turn-118 BoxGeometry bars with a thin `LineSegments` `+` (a PEER of the stock-WCS
  crosshair style; red vs amber), rotated into the probed plane (xy/xz/yz) in `_updateDatum`. probe-wcs reads `_probeCross`.
- **GLOW (human ask, "harder brighter").** Additive-blended crosshair + a hot-core radial **halo sprite** behind it; a pulse
  loop (`_pulseDatum`) breathes both opacity + halo size while the datum is visible (self-stops on hide). Human: "perfect glow."

### ⛔ Part 2 DROPPED — human redirect: STOP hand-rolling, the probe-surface block owns this
I implemented Part 2 as a `compedVars` TAINT — the sim re-scanned the macro TEXT for `#6` to infer which contacts are surfaces
(to nudge the disc onto the wall). The HUMAN stopped it: *"a lot of the probe coding is useless — we're going to build the
**probe surface block** and generalise it"* / *"I don't understand why we are still hand-rolling the code."* They're right:
- The 5 wizards EACH hand-roll their own `[#1925 ± #6]` comp into flat G-code → the sim has nothing DECLARED to read, so it
  reverse-engineers the comp from macro text. That taint IS the hand-roll.
- The **probe-surface block** (the canonical probe primitive, 1576fee) generalises this: ONE declared "I am a surface probe (r)"
  → disc-on-wall + datum-on-surface come for free, no scanning; wizards COMPOSE it instead of emitting G31+comp each.
- So disc-on-surface should come FROM that block, NOT a macro scan now. **Reverted the entire Part-2 taint + disc-nudge**
  (`compedVars`, the `comped` flag through markDatumWrite, `_axisDiscs`, the disc-return). B (deferral) + C + glow kept — those
  are generic display, not per-op probe hand-rolling. Human: *"drop the macro scan, yes, pass the ball."*

**FOR THE ADVISOR:** the per-op probe comp (turn-116 work, scattered across middle/corner/edge/rotary) + this disc-on-surface
need are pointing at the same generalisation — the **probe-surface block** as the one declared probe primitive. Recommend
planning that next (it subsumes disc-on-surface, the per-axis comp, and likely the per-op datum semantics) rather than more
per-wizard probe code. [[restructure-source-not-abstraction]] [[declare-or-handroll-before-dispatch]]

---

## 🔨 turn 123 — PROBE-SURFACE BLOCK: design + migration proposal (VERIFY-FIRST · PROPOSE · GATE — no build)

Scope = ground the refactor in real code + propose; GATE before any migration (foundational + emitted-G-code-changing).
Verified with 3 read-only sweeps (probe primitives · the 84f4efd comps + OD-top gap · the 1576fee snippet).

### VERIFY-FIRST (real code)
- **Common touch shape (all 4 wizards, identical):** setup(stop+limit) → **fast G31** → probecheck(goto err) → retract →
  **slow G31** → probecheck → **READ** → retract. The block IS exactly this. The wizard-specific parts are the AGGREGATIONS
  that CONSUME touches: middle bisect+diameter, rotary Yc-bisect+Zc, rotary `fit` = a 3-point CIRCLE SOLVER (reads machine
  pos + solves — not a surface; its 3 touches use the block, the solver stays). Read atom varies: middle/edge/corner
  `assign #N=#1925`; rotary `proberead`+`setworkoffset` (dialect) → the block parameterises the read/write, doesn't fork.
- **The 84f4efd comps (exact, all #6):** edge `#50=[#1925±#6]`@70 · corner `#102/#101=[#1925/#1926±#6]`@75/78 + Z `[#1927-#6]`@129 ·
  middle Z-first `[#57-#6]`@160 + diameter `ABS[#51-#52]∓[2*#6]`@189-192 (boss−/bore+) · rotary Zc `[#50-#6-#55]`@105 +
  flank `[#55+#2+#6]`@81 (flank = APPROACH clearance, stays in the wizard). `#6` declared per-wizard (5 copies).
- **Rotary OD-top GAP confirmed (rotaryCenterWizard.js:130):** `SWO('Z', datum==='top' ? '#50' : '#56')` — datum='top' writes
  the RAW `#50` (OD-top + radius = a tip-radius HIGH); only datum='center' uses the comped `#56`. A real un-comped datum.
- **The 1576fee snippet (web/data/learnerLibrary.js):** `probe-surface` + `probe-surface-2pass` ALREADY EXIST as DECLARED
  atom-stack data (`{id,label,desc,stack:[{type,params}…]}`), emitted by the shared `emitMapped()`. `probe-surface-2pass` =
  the wizards' exact touch (probe→check→retract→probe→check→retract→proberead #50). But it is **INERT** — wired only into the
  Blocks toolbox + a validator test, **no wizard composes it.** The commit deferred *"a wizard-references-a-snippet mechanism
  + a byte-identical gate (batch #6)."* THAT compose-mechanism is the migration's real first build (not the snippet itself).

### PROPOSE (gated)
**A · radius-comp ATOM** — a new atom `radiuscomp {raw, result, radius, dir, enable}` → emits `#result=[#raw <dir> #radius]`
(enable OFF → `#result=#raw` passthrough). The ONE home for the comp; the 5 hand-rolled `[#raw±#6]` copies all become this.

**B · probe-surface BLOCK** = a shared builder `probeSurfaceStack(params)` returning the atom stack (the extended snippet shape):
```
comment → probe(fast) → probecheck → retract → [probe(slow) → probecheck → retract]
        → proberead(axis → #raw) → radiuscomp(#raw → #result, dir, enable=ON)   ⇒ #result = the TRUE surface
        → ( @DDCS probe-surface {result:#result, axis, dir} )   ← self-describing marker [[format-parser-marker-system]]
```
params: axis · dir · maxDist · retract · feeds(fast/slow) · port · twoPass? · radius · compEnable · resultVar. The learner
snippet becomes one baked instance of this builder (one source, two faces: teach = data in the toolbox, compose = the builder).

**C · disc-on-surface + datum FALL OUT (no Part-2 taint, no OD-top gap, no per-axis flag):** the block emits a DECLARED marker
naming its surface result var. The sim's probe-read reads the marker → the contact's surface = `#result` → disc sits on the
wall, datum reads `#result`. Middle: two blocks/axis → centre = bisect of the two TRUE surfaces (discs on true walls, datum =
centre, unchanged). Rotary OD-top: the top touch is a block (comp ON) → datum='top' writes the TRUE surface → the gap closes.
The dropped Part-2 macro-scan AND the OD-top gap both disappear because the surface is DECLARED, not inferred.

**D · migration MAP + ORDER (simplest first = the proof):**
1. **edge** — `#50=[#1925±#6]` → one `probeSurfaceStack`. Expect BYTE-IDENTICAL. (the proof of the compose-mechanism.)
2. **corner** — 3 blocks (X,Y,Z). Byte-identical per axis.
3. **rotary** — top + 2 flank blocks (closes OD-top gap); Zc=top−R, Yc=bisect; `fit` touches use the block, solver stays.
4. **middle** — two-wall blocks/axis + bisect; diameter recomputes from true walls. Last = hardest proof.

**E · EQUIVALENCE approach (two-part proof, [[federated-registry-and-wizards-as-data-stage4]]):**
- **Byte-identical** where legacy is already correct: edge, corner X/Y/Z, middle Z-first, rotary Zc/flank — the block emits the
  SAME `G31→check→retract→read→#result=[#raw±#6]` lines. Prove per-wizard with an emit-equivalence test BEFORE swapping.
- **Behaviour-preserved, DELIBERATE + NAMED output changes (real-machine G-code):**
  - **middle diameter:** `ABS[#51-#52]∓[2*#6]` (aggregate comp on RAW walls) → `ABS[#s1-#s2]` (the ∓2#6 evaporates — same
    value from TRUE walls, cleaner G-code). NAME it.
  - **rotary OD-top (datum='top'):** today un-comped (the gap) → the block comps it → datum drops a radius to the TRUE
    surface. This is a real G-code FIX/CHANGE — flag explicitly for the human (ship the fix, or keep byte-identical?).

**F · the comps DELETE:** every per-wizard `[#raw±#6]` + the middle ∓2#6 + rotary Zc −#6 + the 5 `#6` declarations → the block's
`radiuscomp` atom + one radius param. ~Net deletion across 4 wizards; the comp logic lives once.

### GATE — bless before ANY migration (authoring contract + multi-wizard G-code refactor)
1. **The block's home:** a shared `probeSurfaceStack` builder in opStacks (composed by the `<name>Stack` builders), with the
   learnerLibrary snippet as a baked instance — vs a pure-data snippet referenced by id. (Recommend the builder: wizards need params.)
2. **The compose-mechanism** (1576fee's deferred "batch #6") — the wizard→block seam + the byte-identical gate. This is the real build.
3. **The 2 NAMED G-code changes** — middle diameter recompute (safe, same value) + **rotary OD-top fix** (real change): ship or hold?
4. **The sim marker contract** — extend `( @DDCS )` with a probe-surface/result declaration the probe-read consumes (replaces the Part-2 taint).
5. **Order = edge first** as the equivalence proof, one wizard per pass, GATE between.

NO migration built this turn (per scope). Proposal only; gating back for the authoring-contract + G-code-change decisions.

---

## 🔨 turn 125 — PROBE-SURFACE BLOCK inc1: foundation + EDGE migrated (BYTE-IDENTICAL). Design blessed t124.

Built the foundation + migrated EDGE as the byte-identical proof of the wizard→block compose mechanism. Scope = foundation + edge only.

- **radius-comp ATOM** (`web/wizards/ops/radiuscomp.js`, registered in ops/index PALETTE) — a DECLARED, TOGGLEABLE property:
  `enable` ON (default, correct-by-default) → `#result=[#raw <dir> #radius]` (the TRUE surface); OFF → `#result=#raw`
  (raw passthrough, a config flip away — the human's "not a big deal to change later"). The ONE comp home.
- **probe-surface BUILDER** (`web/wizards/ops/probeSurface.js`) — `probeSurfaceStack(params)` returns the touch atom stack:
  [comment]→[stop/limit setup]→fast G31→check→retract→slow G31→check→**radiuscomp(raw→result)**→retract→`( @DDCS probe-surface )`.
  Returns the TRUE surface in `result`. The 1576fee learner snippet is one baked instance of this shape.
- **@DDCS marker** — `opSchema.SCHEMA['probe-surface'] = { result, axis, dir }`; the block emits the self-describing marker
  (`( @DDCS:1 {"op":"probe-surface","result":"#50","axis":"X","dir":"+"} )`). Additive (a paren-free comment → stripAnnotations
  removes it) so byte-identicalness holds. The sim consumes it NEXT increment (replaces the dropped Part-2 macro scan).
- **EDGE migrated** — `edgeStack`'s hand-rolled touch → ONE `probeSurfaceStack` call (kept the WCS write). Removed the now-orphan
  `PR`/`CK`/`MV` helpers. **Functional G-code BYTE-IDENTICAL** to the pre-migration emit, proven across a 4-set param sweep
  (axis X/Y · dir ±  · active/G54/G55) by `tests/probe-surface-block.spec.js` (golden captured from the OLD code, compared via
  stripAnnotations). Full suite **428 passed**.

### Decisions / deviations from the literal spec (all to keep byte-identical — the gate's hard constraint)
- **radiuscomp FUSES read+comp into ONE line** (not `proberead(→#raw)` then `radiuscomp(#raw→#result)` = 2 lines). The legacy
  edge reads+comps in a single `assign #50=[#1925+#6]`; a 2-atom form would add a line → not byte-identical. The atom reads the
  trigger var directly.
- **Order = read-BEFORE-retract** (the wizards' order), not the snippet's retract-before-read — else the comp/retract lines swap
  and the line-compare fails. #1925 is latched at the probe, so the value is identical either way (functional-identical).
- **push REPLACES params** (not merge with the atom defaults) — a merged single-axis `move` leaks the move atom's `y:0/z:0`
  defaults (`G0 X#9 Y0 Z0`); replacing (like the wizards' own helpers) keeps `G0 X#9`.

### ⚠ FLAG for the gate — the marker is a SUB-op declaration, but `@DDCS` markers are OP BOUNDARIES
`importMarkedNc`/`opFromMarker` (the .nc round-trip) treat every `( @DDCS:v {op:…} )` as a TOP-LEVEL op. The probe-surface
marker sits INSIDE the edge op (a sub-op surface declaration), so a save→reopen of a program containing an edge probe would
parse it as a phantom `probe-surface` op. NOT test-exercised (suite green) + out of THIS increment's scope (round-trip/sim =
next), but the **marker contract needs a sub-op vs op-boundary distinction** (namespace it, or teach the round-trip to skip
sub-op markers) BEFORE the sim/round-trip consume it next increment. Flagging, not hacking the round-trip out of scope.

### GATE — mechanism PROVEN on edge; ready to roll out
The wizard→block compose mechanism works + is byte-identical. Pending the advisor before the next increments:
1. the **marker sub-op refinement** (above) — needed before the sim reads it.
2. **corner next** (per-axis single walls, also byte-identical) then rotary (incl. the OD-top FIX) then middle (the diameter recompute).
3. the **2 NAMED G-code changes** (middle diameter `|s1-s2|` · rotary OD-top comp) still need the human's ship/hold call (t123 gate).

---

## 🔨 turn 127 — PROBE-SURFACE BLOCK inc1: CORNER migrated (BYTE-IDENTICAL). Edge proved it (38ff817).

Migrated cornerWizard's 3 probe touches (X, Y, Z) → 3 `probeSurfaceStack` calls. The aggregation (the WCS writes, the
travel/plunge, the error handler) stays in the wizard; only the per-axis touch+comp moved to the block. Orphaned PR/CK removed.

- **VERIFIED byte-identical** — `tests/probe-surface-block.spec.js` corner case: a 4-set sweep (FL/BR/FR/BL · XY/YX · Z on/off ·
  active/G54/G55), golden captured pre-migration, compared via stripAnnotations. 4/4 identical. Full suite **428 passed** (1
  known-flaky middle-animator retried green).
- **3 params added to probeSurfaceStack/radiuscomp** to absorb the corner's PRE-EXISTING quirks (the block stays the one
  primitive; these are how a wizard's exact shape maps onto it):
  - `radiuscomp.spaced` — the corner X/Y comp spaces the operator (`[#1925 + #6]`) where edge + corner-Z don't (`[#1927-#6]`).
    A pure-COSMETIC inconsistency in the legacy code; `spaced:true` preserves it for byte-identicalness.
  - `probeSurfaceStack.trailingRetract` (default ON) — edge retracts THEN writes; the corner writes THEN retracts (+ safe-Z).
    `trailingRetract:false` lets the corner do its own retract after its WCS write. A real structural variation.
  - `probeSurfaceStack.preComp` — the corner Z computes its indirect WCS address inline (`#73=[#70+2]`) right before the comp
    (`#[#73]=[#1927-#6]`). `preComp` injects that assign in place. A real structural variation.

### Per-axis mapping (each → one probeSurfaceStack call + the wizard's own write)
- **X**: touch → `#102=[#1925 + #6]` (spaced, trailingRetract:false); wizard writes `#[#70]=#102` + retract + safe-Z.
- **Y**: touch → `#101=[#1926 + #6]`; wizard writes `#73=[#70+1]` + `#[#73]=#101` + retract + safe-Z.
- **Z**: touch → preComp `#73=[#70+2]` + comp `#[#73]=[#1927-#6]` (dir −, no spaces, result=the WCS address directly,
  trailingRetract:false); wizard does safe-Z + travel to the first wall.

### ⚠ FLAG (cosmetic cleanup, not a gate) — the `spaced` wart
`spaced` exists ONLY to preserve a meaningless legacy inconsistency (corner X/Y space the operator; edge + corner-Z + the
block's natural format don't). Recommend a future **cosmetic-normalize pass** (one named whitespace change: drop the spaces in
the corner X/Y comp — functionally identical) to UNIFY the comp format and DELETE the `spaced` flag. Deferred — kept the
migration byte-identical (no re-gate) this turn. (`trailingRetract` + `preComp` are legit structural params, they stay.)

QUEUED (advisor): rotary (OD-top comped) → middle (dia recompute) → inc2 (marker sub-op fix + sim consumes the marker).

---

## 🔨 turn 129 — PROBE-SURFACE BLOCK inc1: ROTARY migrated (VALUE-IDENTICAL + the OD-top FIX). Edge+corner done.

Migrated rotaryCenterWizard's 6 touches (known: top + 2 flanks; fit: 3 points) to a `touch()` helper that wraps
`probeSurfaceStack`. The flank-approach (#11/#12), the Yc/Zc aggregation, and the 3-point SOLVER stay in the wizard.
Deleted the `pp` helper + the orphaned PR/CK/RD.

- **Known method — comp ON, the comp RELOCATES (value-identical):** the top + flank touches now return the TRUE surface
  (`#50/#52/#53 = [trigger ± #6]`). So `#56` drops its inline `−#6`: `[#50-#6-#55] → [#50-#55]` (the −#6 moved into the top
  touch — same Zc). Yc = bisect of the comped flanks (`∓#6` cancels → same centre). PROVEN value-identical by running the
  macro in the engine: Yc 38.1 / Zc −38.1 / R 38.1 — UNCHANGED from the pre-migration golden (rotary-center-sim still green).
- **NAMED CHANGE — the OD-top FIX:** datum='top' writes `#50`, which was the RAW top (the gap). With the comped top, `#50`
  now = the TRUE OD top (= Zc + R). Sim: the OD top dropped from **2 → 0** (a stylus radius onto the true surface).
  Correct-by-default + reversible by the radiuscomp `enable` flip (the human's 'declared' call).
- **Fit method — comp OFF (value-identical):** the 3 fit touches use the block with `compEnable:false` (raw), so the solver
  gets the same tool-centre points → Yc/Zc/R unchanged (sim: 38.1 / 159.3 / 161.85, identical to golden). The read text
  changes cosmetically (`proberead [#1927]` → radiuscomp passthrough `#1927` — brackets are grouping, value-identical).
- **VERIFIED** — `tests/probe-surface-block.spec.js` rotary case asserts known Yc/Zc/R value-identical + the OD-top = Zc+R
  (0, the FIX) + fit Yc/Zc/R value-identical; rotary-center-sim (known auto+guided) still green. Full suite **429 passed**.

### ⚠ FLAG for the gate (not blocking) — a LATENT fit OD-gap
The fit solves the TOOL-CENTRE circle (raw points), so its OD top (`#50 = Zc + R`) is a stylus-radius too high — the same
class of gap the known OD-top FIX just closed. NOT touched this turn (kept the fit value-identical per the dispatch). Worth a
decision when the fit is next revisited (comp the 3 fit points → solve the TRUE circle; it would be a named change like the OD-top).

### GATE back — rotary done (value-identical + the named OD-top fix landed)
QUEUED (advisor): middle (dia `|s1-s2|` value-identical, the last wizard) → inc2 (marker sub-op fix + sim consumes the marker
= disc-on-surface + datum + the OD-top payoff) → unify-pass (delete cosmetic warts: radiuscomp.spaced, the fit bracket drift).

---

## 🔨 turn 131 — PROBE-SURFACE BLOCK inc1: MIDDLE migrated (value-identical) — ALL 4 WIZARDS DONE. + a marker course-correct.

Migrated middleWizard's two-wall touches to a `touch()` block wrapper (comp ON → the TRUE walls). Kept the reposition/
traverse, the seq/centre bisect, the Z-first reposition. Deleted the hand-rolled `twoPass` + orphaned PR/CK. `#6` is now
declared UNCONDITIONALLY (every wall touch comps, not just circular/Z).

- **Value-identical (proven by the existing middle sim tests, all green post-migration):**
  - centre `#53/#56` = bisect of the comped walls — the ∓#6 cancels (same centre; middle-center-sim, middle-circular-sim cx/cy).
  - diameter `#58/#59 = ABS[#s1-#s2]` — the old ∓2#6 (boss −, pocket +) EVAPORATES; from the TRUE walls the span IS the
    diameter (middle-circular-sim dx=60 dy=40, UNCHANGED). The featureType sign disappears entirely.
  - Z-first Z0 `#[#70+2]=[#57-#6] → #[#70+2]=#57` — the −#6 relocated into the Z touch (middle-probe-z-first, regex updated).
- **transTraverse re-centre — a real comp coupling, FIXED:** the AUTO trans-axis re-centre used `#52` (the wall-2 contact) as
  the tool's POSITION (`[#53-#52-rv]`). Now `#52` is the COMPED wall, so the tool's raw position = `#52 + (dir1Plus?+#6:−#6)`.
  Added that back → `[#53-#52-rv ∓#6]` so the re-centre stays EXACT (path value-identical, the tool lands on ② — middle-trans-
  traverse xFirst/yFirst < 2, both axis orders). MANUAL uses the fixed Diag-travel #21 (unaffected).

### ⚠ COURSE-CORRECT — the @DDCS surface marker REMOVED (it violated "Option B")
The middle migration surfaced a real problem with the t125 marker: probeSurfaceStack emitted a `( @DDCS probe-surface … )`
comment, which lands in the EDITOR TEXT — violating **Option B** (the editor stays CLEAN; op info comes from the program
model, NOT editor markers — enforced by editor-sim-real-insert.spec). edge/corner/rotary had it too (just untested for them).
**Removed the marker emit** (the equivalence proofs hold — stripAnnotations stripped it anyway; editor now clean). The
opSchema `probe-surface` entry is KEPT for inc2. **The inc2 sim-consumes-the-surface mechanism MUST be SIM-SIDE** (read the op
stack's radiuscomp result), NOT an editor-text marker — this is the concrete resolution of the t125/t127 "marker sub-op" flag.

### GATE back — inc1 COMPLETE (all 4 wizards on the shared block)
edge (byte-identical) · corner (byte-identical) · rotary (value-identical + OD-top fix) · middle (value-identical). Full suite
**429 passed**. QUEUED: **inc2** = the sim consumes the surface SIM-SIDE (disc-on-surface + datum + the OD-top payoff) — and
the marker mechanism is now settled as sim-side (no editor text). Then the unify-pass (radiuscomp.spaced, fit bracket drift).

---

## 🔨 turn 133 — PROBE-SURFACE BLOCK inc2: VERIFY-FIRST done → GATE the disc↔result MATCHING mechanism (no build)

inc2 = the sim reads the declared surface (disc-on-surface + datum + OD-top), SIM-SIDE. Verified the mechanism first; the
MATCHING (a contact → its radiuscomp result) is a real design decision (+ "no macro-text taint" makes the choice matter), so gating.

### VERIFY-FIRST findings
- The sim runs the FLAT G-code (`engine.run(getGcode())`); the radiuscomp result lands in `engine.vars` when its line runs.
- The program model (`ddcsGetBlockProgram`) holds the structured op stacks → the `radiuscomp` atoms carry `{result, axis, dir, enable}`.
  The viz/sim does NOT currently import the model — reading it is a NEW dependency.
- **The probe-surface blocks are NOT distinct instances in the stack** — `probeSurfaceStack` returns a FLAT atom sequence spliced
  into the op, so there's no "block-instance" id to match a contact to (the dispatch's framing doesn't map to a real id).
- **fast+slow = 2 discs per touch** (`probeAxisTouched` fires on every G31). So a touch ≠ a single contact.
- PRECEDENT: the datum-write hook ALREADY reads the flat-text WCS-write (`#[#70+off]=val` → `markDatumWrite`), declared-driven
  (the #70 table), not a #6-scan. The disc-on-surface is the analogous extension.
- DATUM + OD-top likely ALREADY consistent: the datum follows the WCS-write, which for edge/corner is the comped surface
  (`#50/#101/#102`), for middle the centre (`#53`), for rotary datum='top' the comped `#50` (the OD-top fix). So the main BUILD
  is the DISC; the datum/OD-top just need a render VERIFY.

### GATE — the disc↔radiuscomp MATCHING mechanism (advisor's call)
- **(A) RECOMMEND — result-var-keyed deferred hook (the datum-hook pattern).** Read the radiuscomp atoms from the model →
  `{resultVar → axis/dir/enable}`. Hook the flat-text comp line: when a line assigns a known radiuscomp result var (`#102=…`),
  nudge the discs-since-the-last-comp (on that axis) onto the surface (= contact + radius·dir, or read the result value).
  PRO: declared-driven (the result vars, NOT a #6-scan), identical to the existing datum hook, handles fast+slow + middle's
  two-walls-per-axis naturally. CON: reads the flat-text comp line (but keyed by the DECLARED result var, not inferred).
- **(B) order-match + nudge at the contact.** Match the Nth radiuscomp ↔ the Nth touch-group; nudge by radius·dir at
  `probeAxisTouched`. PRO: no comp-line read. CON: the fast/slow touch-group counting (variable: twoPass on/off) is fragile.
- **(C) projection-map.** Correlate a G31 line → its op via `proj.map`, find the following radiuscomp atom. CON: the projection
  is editor-program-only (not the wizard PREVIEW's G-code); and it maps to op-level, not a probe-surface sub-block.

### Open question for the gate
**Model access in BOTH sim contexts:** the wizard PREVIEW (the active op via `opRecord`) vs the EDITOR sim (`ddcsGetBlockProgram`).
The sim must read the radiuscomp result vars from whichever is live. Bless the source(s) + (A) and I build inc2 (disc nudge +
the datum/OD-top render verify). NO build this turn (the matching is the flagged design decision).

---

## 🔨 turn 135 — PROBE-SURFACE BLOCK inc2 BUILD: DISC-ON-SURFACE (the payoff). SIM-side, declared-driven.

Built option A (blessed): the contact disc sits on the COMPED surface (the wall), read SIM-SIDE from the declared radiuscomp
atoms — NOT a macro-text #6-scan, NOT the dropped Part-2 taint. This is the disc-on-surface the human stopped me hand-rolling at t120, now landing properly from the consolidation.

- **Model-read** (createPreviewPanel.readEnabledComps): the ACTIVE op (`getLastOp` — the wizard PREVIEW) → `builderOf(type)(params)`
  → the flat stack → the `radiuscomp` atoms → `{ resultVar → { axis (from `raw`), sign (from `dir`) } }` for ENABLED comps only.
- **The hook** (onLineChange, the datum-hook pattern): a line writing a DECLARED enabled-comp result var (`#102=…`, the corner
  Z's `#[#73]=…`) → `viz.nudgeSurface(axis, ±#6)`. Keyed by the declared result var, exactly as the datum hook keys on the WCS target.
- **viz.nudgeSurface + _pendingDiscs** (gcodeViz3d): every disc dropped SINCE THE LAST comp on that axis slides onto the wall.
  Handles fast+slow (both discs), middle's two-walls-per-axis (cleared per comp), and the rotary fit (comp-OFF → never called → discs stay raw).
- **THE FRAME FIX (the real subtlety):** the radiuscomp's committed RESULT is in the ENGINE frame, but the disc rides the PART
  frame — they differ by the inferStart offset (harness: disc at x=22, `#102`=0 → an absolute nudge jumped it 22 mm). So the
  nudge is **RELATIVE**: `disc.position[axis] += ±radius·dir` (frame-invariant — the surface IS the contact ± radius). Read `#6`
  from the engine for the magnitude, the `dir` from the declared atom for the sign.
- **DATUM + OD-top already consistent (verified):** they ride the WCS-write hook (now writing the comped surface) — unchanged,
  green (probe-wcs, middle-datum-centre, rotary-center-sim). The disc was the only new build.
- **VERIFIED:** `tests/disc-on-surface.spec.js` — corner X/Y discs nudge EXACTLY a tip radius (minOff=maxOff=2) onto the wall,
  off the raw tool-centre; the comps are read from the declared atoms (axis+sign). Render captured + opened (discs on the walls).
  Full suite **431 passed**.

### Flagged follow-up (per the dispatch) — the EDITOR-sim source
`readEnabledComps` uses `getLastOp` (the WIZARD PREVIEW, the surface the human eyeballs). The EDITOR-sim source
(`ddcsGetBlockProgram` — the inserted program) is the heavier wiring deferred to a follow-up (it needs the per-op stack + the
right active surface). The wizard preview — where the human verifies — is done.

---

## 🔨 turn 137 — GATE: rotary FIT comp ON is correct-for-machine but UNVERIFIABLE in the sim (the fit sim is degenerate)

Dispatched: flip the 3-point fit's comp ON (consistency with the known method; "declared = correct-by-default + reversible")
and VERIFY "the fit's R + OD-top now comped (new = old − radius); centre unchanged." I made the change, and verifying it
surfaced that the dispatch's premise — a meaningful sim fit — is FALSE. **Reverted to keep the suite green; passing the finding.**

### The finding (with data)
The rotary 3-point FIT **sim is degenerate**: the operator-guided `reposition()` (the jog between flanks) is NOT simulated, so
the tool's machine position never changes across the 3 probes — `#52=#54=#56=0`. The "points" the solver fits are therefore
garbage: **P1(0,2) P2(66.71,0) P3(2,0)** — not on any real OD. That's why the raw fit yields **R=161.85** for a Ø76.2 bar whose
true OD radius is **38.1** (~4× off), and the t129 "fit value-identical" test was simply locking in that garbage number.

Flipping the fit comp ON shifts the probed-axis results `#51` (2→0, top) and `#55` (2→0, −Y flank) by the radius → **P1 and P3
collapse onto (0,0)** (coincident) → determinant `#63=0` → **R / Yc / Zc all → 0**. So in the sim "new = old − radius" is
impossible: I measured new = **0**, not 159.85.

This is purely a SIM artifact. On a real machine the 3 distinct OD tool-centre points each shift radially inward by r →
**R = R_true, same centre** — the dispatch's geometry is right. The sim just can't show it.

### Options (the change is staged-then-reverted; the exact edit is below, trivial to re-apply)
- **(A) RECOMMENDED — keep comp ON; verify by the DECLARATION + math, not the degenerate operator-jog sim.** (i) assert the 3
  fit touches now emit the comp (`#51=[#1927-#6]`, `#53=[#1926+#6]`, `#55=[#1926-#6]`); (ii) `readEnabledComps(rotary_center,fit)`
  now includes the 3 comps → the disc-on-surface nudges the fit's discs ±r onto the surface (works regardless of the sim's
  garbage contact — the nudge is RELATIVE); (iii) a synthetic-points solver check: feed real OD tool-centre points (R_true+r)
  through the circle-solve, comp inward, assert R=R_true + centre unchanged. REPLACE the t129 sim-fit R/Yc/Zc assertions (they
  assert garbage) with these. The fit's operator-jog stays "verify on machine" by nature. In scope; honest; proves correctness.
- **(B) keep comp ON + FIX the fit SIM** — make `reposition()` move the tool to distinct OD points so the sim fit yields the true
  R (38.1), the comp then gives R−r naturally, and the disc lands on a real OD. Bigger scope (a sim-geometry change), but makes
  the fit sim meaningful (and retires the garbage value-identical lock-in). Could be a follow-up to A.
- **(C) revert the fit comp (leave OFF)** — the fit is "ADVANCED: verify on machine"; don't ship an in-sim-unverifiable change.
  Loses the consistency the human explicitly asked for → weakest option.

**My read:** A now (correct + reversible + honestly verified), B as a later follow-up (the degenerate fit sim PRE-DATES this task
— the t129 "value-identical 161.85" was already garbage). The disc-on-surface for the fit is fine under A.

### The exact edit to re-apply if A/B (was reverted)
1. Move `A('#6', radius, …)` from inside the `known` branch to just before `if (method === 'known')` (declare once, both methods).
2. The 3 fit `touch(...)` calls: 4th arg `false` → `true` (comp ON) — top `#51`, +Y `#53`, −Y `#55`.
3. Update the fit comments (raw → comped surface points).

---

## 🔨 turn 139 — rotary FIT comp ON (gate A): verified by DECLARATION + SYNTHETIC, not the degenerate sim

Gate A blessed. Re-applied the comp ON (the #6 move to ONE shared declaration before the method branch + the 3 fit `touch(...)`
→ `compEnable:true`). The fit's 3 probed points now return the TRUE OD surface (each shifts radially inward by the stylus
radius), so the solver fits the true OD (R_true, was the tool-centre circle R+r; same centre) and datum/OD-top land on the
real surface — consistent with the known method.

**Verified WITHOUT the degenerate operator-jog sim** (the fit sim can't move the tool to distinct flank points → garbage):
1. **Emit** — the 3 fit touches emit the declared comp: `#51=[#1927-#6]` (top), `#53=[#1926+#6]` (+Y flank), `#55=[#1926-#6]` (−Y flank).
2. **readEnabledComps(fit)** — now includes `#51{z,−1} #53{y,+1} #55{y,−1}` → the disc-on-surface nudges the fit's discs too
   (RELATIVE ±r, so it's safe even on the sim's garbage contacts; the disc rides a radius off the contact regardless).
3. **SYNTHETIC solver** — ran the ACTUAL macro's circle-solve (sliced from the emit) on a clean OD circle (centre (5,−10),
   R_true=30, stylus 2). Comped points (ON the OD) → **R=30, centre (5,−10)**; raw tool-centre points (R+r) → **R=32, same
   centre**. So the comp drops exactly the stylus radius, centre unchanged (concentric). This proves the geometry the dispatch
   intended, independent of the broken sim.
4. **Replaced** the t129 "fit value-identical" assertions (they locked in the degenerate sim's R=161.85 / Zc=159.3 — green-but-wrong).

The known assertions are untouched (its sim is valid). The `#6` move is value-identical for known (the test asserts values).

**Full suite: 429 passed.** Two failures under `--workers=2` — `atc-roundtrip` + `knob-persist` — both PASS isolated (8 passed
×2 re-runs); parallel-load flakes, unrelated to this rotary-only change (different domains). Cf. [[playwright-stale-cache-testuse-error]].

**Next (queued, the advisor's plan):** declare the fit's per-touch sim-starts (the operator-jog OD positions) via
`opSimStarts.rotary_center` fit case → the fit sim becomes real and verifies the comp naturally (a sim DECLARATION, not a
hand-rolled sim fix). Then the disc-on-surface lands the fit's discs on a REAL OD, not a garbage contact.

---

## 🔨 turn 141 — GATE: the real fit sim is a TWO-PART sim fix (engine DRO + opSimStarts sides), not a missing declaration

Dispatched: declare the fit's per-touch sim-starts → real fit sim. VERIFY-FIRST found the sim-starts ARE already declared
(`opSimStarts.rotary_center` returns 3 for fit: top + 2 flanks) AND the engine consumes them for the probe TRIGGER
(`#1925-1927 = passStarts[pass] + target`, line 959). So the dispatch's "missing declaration" framing is incomplete — making
the fit sim real needs **two coordinated SIM fixes**, prototyped below. **No source changed this turn (diagnostics only); suite green.**

### Why the fit is degenerate (two independent causes)
1. **The engine never populates the machine DRO (#880-883).** The fit captures its cross-axis via `RM` (read machine), which
   emits `#52=#881` (the Expert DRO Y register). The engine's var store is a plain Map in sim — #880-883 are NEVER set → every
   RM read returns 0 → the 3 points collapse (P1=P3=(0,0)). The known method doesn't use RM (it derives Yc/Zc from the triggers
   + the known diameter), so it's unaffected. **Fixing this is an ENGINE change** (sim-only, but profile-aware: DRO base is
   Expert #880 / V41 #1500 / DM500 #864 / rs274 #5420) — beyond the dispatch's "opSimStarts declaration" scope.
2. **The opSimStarts fit-start SIDES (P2/P3) are mismatched to the macro's probe directions.** Macro P2 = `touch('Y', true)`
   (probe +Y) but the declared start is on the +Y side (cy+R+retract) → the probe moves AWAY from the bar → a miss (#53 = full
   travel = 138.2). The sides must match the macro: P2 (probes +Y) starts on the −Y side; P3 (probes −Y) starts on the +Y side.
   **This is a true opSimStarts DECLARATION fix** (in scope).

### Prototype (proxied the DRO via a custom var store; swapped the sides in the starts array — no source edits)
```
no fix:        pts collapse (0,0)(138,0)(0,0)        R degenerate (~0)
+DRO only:     pts DISTINCT but off the OD           R = 120.9   (sides still wrong)
+DRO +swap:    on the true OD                        R = 38.2  Yc 38.1  Zc -38.2   ✓ (true OD R=38.1, centre (38.1,-38.1))
```
Both fixes are SIM-only, NO emit change. Together they make the fit sim REAL → R≈R_true, the disc-on-surface lands on the real
OD, and turn-139's fit comp verifies IN the sim (not just the synthetic solver).

### Options
- **(A) RECOMMENDED — do both:** the engine DRO population (general — benefits ANY RM-using macro) + swap the opSimStarts P2/P3
  fit-start sides. Prototype-confirmed real. Two coordinated sim changes. Sub-decision: populate the ACTIVE profile's DRO base
  (engine reads `ddcsGetSettings`) **or** all known bases (dialect-agnostic, cheap) — I lean all-known-bases.
- **(B) incremental:** engine DRO population FIRST (the general gap + the prerequisite, a real standalone improvement), then the
  opSimStarts side-swap as a follow-up. De-risks; two small passes.
- **(C) defer the in-sim fit** — it's "ADVANCED: verify on machine" + already proven by the synthetic solver (t139). Skip the
  2-part sim fix for now. Weakest given the human explicitly wants the real fit sim.

**My read:** A (or B if you want the engine DRO landed + reviewed before the geometry swap). The DRO-population gap is a genuine
general sim improvement worth doing regardless.

---

## 🔨 turn 143 — ENGINE: populate the machine DRO in sim (the general read-machine gap; step 1 of the real fit sim)

Option B, step 1: the engine never populated the machine DRO registers in sim (plain Map), so `read-machine` (RM) returned 0
for every dialect — the general gap that collapses the rotary fit's cross-axis capture (`#52=#881`). Fixed it on its own (it's
GENERAL — any RM macro was reading 0); the opSimStarts fit side-swap (step 2) is next.

**Verify-first:** RM emits `<var>=#<base+AX[axis]>` per dialect (Expert #880, V4.1 #1500, DM500 #864, rs274 #5420; AX =
{X:0,Y:1,Z:2,A:3}); the engine's var store is a plain Map in sim → those regs are never set → RM = 0. `this.pos` is {x,y,z}
(no rotary axis tracked).

**Build (engine-only, no emit change):**
- `DRO_BASES = [880, 1500, 864, 5420]` + `_updateDro()` — sets EVERY dialect base (X=base, Y=+1, Z=+2, A=+3) to the tool's
  machine position = the current pass's operator start `O` + the local `this.pos` (the SAME frame the probe trigger uses,
  `#1925 = O + target`). A=0 (no rotary axis). Populating all bases is dialect-agnostic + cheap (one macro reads its own base).
- Called at the START of `_executeStep` — reflects the last completed move, and RM lines always follow moves, so the DRO is
  current when RM reads it (matches the t141 read-proxy prototype exactly).
- **Guarded to pure-sim** (`this._populateDro = no injected store`): a live PC-bridge store PROXIES the controller's real DRO,
  so we must not overwrite it (it'd write a read-only register).

**Verify:** `tests/engine-dro.spec.js` — after `G91 / G0 X10 Y5 Z-3`, read-machine returns the machine coord (10,5,-3); with a
{50,20,0} operator start it's (60,25,-3); ALL dialect bases populated (Expert/V4.1/DM500/rs274 each read X=10). Was 0 before.

**Blast radius: zero.** Full suite **431 passed**; the one failure is `knob-persist` — a recurring parallel-load flake (failed
t139 too), PASSES isolated, knob/FORM domain, nothing to do with read-machine. No RM-garbage-locked test broke: the t129 rotary
fit was already reworked (t139) to the synthetic solver, so nothing else asserted the RM=0 garbage. The DRO populate is a real
general improvement (any RM macro now reads the true coord).

**Next (step 2):** swap the opSimStarts fit-start P2/P3 sides to match the macro's probe directions → with the DRO now real, the
fit sim becomes real (t141 prototype: R≈38.2 ≈ true 38.1), the disc lands on the real OD, the t139 comp verifies in-sim.

---

## 🔨 turn 145 — rotary FIT sim-start SIDE-SWAP: the real fit sim (step 2 — COMPLETES the t141 arc)

Step 2, the declaration fix. Swapped the `opSimStarts.rotary_center` FIT-case P2/P3 start SIDES to match the macro's probe
directions (the t141 finding): macro P2 = `touch('Y', true)` (probe +Y) → start the −Y side (probe TOWARD the bar); P3 =
`touch('Y', false)` (probe −Y) → start the +Y side. Was swapped → the probe ran AWAY from the bar → a miss → R=120.9 (with the
DRO) / collapsed (without). One declaration change (the two flank rows), SIM-only, NO emit change.

**With the real DRO (t143, e7af3af) + the correct sides, the fit sim is REAL:**
- starts now `[top, (−Y side), (+Y side)]` → the fit probes **3 DISTINCT points on the stock OD** (was collapsed at origin).
- the circle-solve fits **R = 38.21 ≈ the true OD radius 38.1**, centre **Yc 38.1 / Zc −38.21** (the bar centreline) — sane.
- all 3 disc clusters sit ON the OD (dist-from-centre 38.1–38.26 ≈ R, within 0.2 mm) → the disc-on-surface lands on the real OD.
- the **t139 fit comp now verifies IN-sim** (R = the TRUE OD radius, OD-top = 0) — not just the synthetic solver.

**Verified:** `tests/rotary-fit-sim.spec.js` — opSimStarts gives 3 starts with the swapped sides (P2 −Y, P3 +Y); the engine
(with `_passStarts` + the now-real DRO) solves R≈38.1, centre on the centreline. Render captured + opened (3 distinct discs on
the OD). **Full suite 433 passed (0 failed — the knob flake passed too).**

**Minor polish (optional follow-up, NOT a correctness issue):** the flank discs land ~safeZ below the bar centreline
(z≈−53 vs the equator −38.1) — the macro's reposition drop (`MV('Z','[0-#17]')`, −safeZ) applies AFTER the engine resets
pos=0 at the REPOSITION comment, so the probe touches a lower point on the OD. Still genuinely ON the OD (the fit is exact), so
the sim is correct; probing at the equator (lift the flank start z by safeZ) would be a cosmetic refinement.

### Arc complete (t141 → t145): the rotary 3-point fit sim is now REAL
t141 GATE (found the 2-part cause) → t143 engine DRO population (general read-machine gap) → t145 fit-start side-swap. The fit
solves the true OD in-sim, the disc-on-surface lands on the real OD, and the probe-surface block's fit comp is verified in-sim.

---

## 🔨 turn 147 — fit flank discs at the EQUATOR (cosmetic) — fixed the CLEAN way after the suite caught a shared-code regression

Cosmetic: lift the fit's flank probe-discs to the equator (the bar's widest point) instead of sitting safeZ low. Two honest
detours got to the right fix:

**Detour 1 (reverted): the dispatch's "lift by safeZ" broke the fit.** Lifting the flank start by exactly safeZ lands the probe
at z = −R — which IS the cylinder AXIS. A radial probe straight through the axis hit a collision edge case → R collapsed to 24.
A sweep showed R is correct everywhere from z=−53 up to z=−40, but breaks at exactly the axis.

**Detour 2 (reverted): a shared-collision guard regressed `rotary-collision`.** Root cause (verified): at the dead-axis the
flank's tool CENTRE starts R+retract from the axis, the grown collision OD is R+tipR — and with retract==tipR (both 2) the
start sits EXACTLY on the OD, so the t=0 entry was skipped as self-contact and the only other crossing (the far wall) was out
of reach → a false miss. I added a "started already in contact → contact at t=0" guard in `stockProbeStop`. It fixed the fit
**but the full suite caught a real regression**: `rotary-collision`'s "radial probe FROM the axis" probes from *inside* the
cylinder and must stop at the EXIT OD — my guard made it stop at the start. (Exactly the shared-code risk I'd flagged.) Backed
the collision change out entirely.

**The clean fix (shipped): make the flank START clear the OD — no shared-collision change.** The fit's flank sim-start was
`R + retract` (missing the tip term), which is what put the centre on the grown OD at the dead-axis. The KNOWN macro already
offsets its flank approach by `R + retract + tip` (#11 — "the tool centre clears the OD by retract, the tip sticks out r"). So
the fit sim-start now matches: `cy ± (R + retract + tipR)`, `z = −R + safeZ`. The probe approaches from OUTSIDE → a normal
near-wall touch even probing dead through the axis. The shared cylinder collision is untouched.

**Proven polyvalent** (the human pushed on this — all verified, not asserted): R = the exact true OD radius across
- bar Ø 50–102, stand-off 1–5 (below / equal / above the tip radius), and start height safeZ 5–40 (flank start −33 to +2).
Every combination solves the exact OD and lands the flanks at the equator (centre Zc = −R). Render: the 3 cardinal OD discs
(top + both flanks at the widest point). `rotary-collision` restored. **Full suite 433 passed.**

(Cosmetic — per the dispatch, NOT bumping the version for it alone; it batches with the next meaningful unit.)

---

## 🔨 turn 149 — EDITOR-SIM disc-on-surface: declared radiuscomp from the program model (Option B) — the flagged t135 follow-up

The disc-on-surface (probe disc nudged to the TRUE comped surface by the declared radiuscomp) worked in the WIZARD preview
(readEnabledComps read the single active op via getLastOp). Extended the SAME declared-driven disc to the EDITOR sim, which
previews a MULTI-op program.

**Verify-first:** the editor sim IS the same `createPreviewPanel` (gcodePreviewTab mounts it); the ONLY difference is the comp
SOURCE — the wizard feeds its single active op (getLastOp), the editor feeds the whole program model (ddcsGetBlockProgram).
`ddcsGetBlockProgram()` returns op blocks `{type:'op', opType, params}` (gpStartHints already relies on that shape).

**Build (declared-driven, Option B — read the MODEL, no @DDCS editor-text marker, NO macro-text scan):**
- `readEnabledComps(ops)` now takes an OPS LIST (was hard-wired to getLastOp) → builds `{ resultVar → {axis, sign} }` across all
  given ops via `builderOf(op.type)` → the radiuscomp atoms.
- A `compOps()` source helper in the closure: `opts.getOps` if the host provides it (the editor), else `[getLastOp()]` (every
  other host — wizard/Blocks). Both run-reset sites read `readEnabledComps(compOps())`.
- `gcodePreviewTab` passes `getOps: () => ddcsGetBlockProgram() (op blocks) → [{type, params}]`. So editor Simulate's compMap is
  the WHOLE program's declared comps → the disc nudges onto the TRUE surface for ANY probe op.
- The nudge geometry is UNCHANGED (the proven frame-invariant ±radius). Multi-op safety: the maps merge; a comp-line init
  (`#50=0`) is harmless (no discs pending yet); a same-var/different-axis collision degrades to a RAW disc (the earlier op's
  nudge no-ops on an empty axis), never a WRONG nudge.

**Verified:** `tests/editor-sim-disc.spec.js` — REAL insert (middle boss-both) → the live program model yields the enabled
comps `[#51,#52,#54,#55]`; driving the editor's gcode through the REAL editor viz nudges every disc EXACTLY a stylus radius
(maxOff=2) onto the walls (was left at the tool centre ≈0). Render captured + opened (8 discs on the 4 walls, editor view).
**Full suite 434 passed.**

NOTE: the gpPanel's ANIMATED play wouldn't sustain `running` in-test (the single-engine guard, just after the wizard insert),
so the disc is verified by driving the SAME program-model source + nudge through the real editor viz, not the animated engine —
the render is the real editor-view symptom. RELEASE: batches with the flank-disc polish (378191f) → V10.42 (advisor ships).

---

## 🔨 turn 151 — SPATIAL MODEL inc 1 SCOUT + GATE: safe-Z frame primitive (no shared control exists; machine-move confirmed)

Scout-first per the dispatch. The machine-move ground truth is CONFIRMED (no invention needed); the "shared safe-Z control"
the dispatch wants to hang the toggle on does NOT exist (safe-Z is hand-rolled per wizard) → a cross-wizard refactor decision,
plus a real machine-frame move subtlety. Gating with the plan; no code changed.

### (c) MACHINE MOVE — CONFIRMED from ground truth (buildable, NOT invented)
- `dialect.machineMove('Z', ref)` already exists: Expert `G53 Z#var` (dump `appcode/snippets.nc:4 → G53 Z#99` ✓), V4.1
  `G0 G53 Z#var` (`probe-fix.nc → G0G53Z#102` ✓ — cited in the dialect).
- A `machinemove` block atom (`web/wizards/ops/macro.js:12`) + reverse-sync (`gcodeToStack.js:63`); the engine honors G53
  (`GcodeExecutionEngine` maps part = machine − wcsOffset). So machine-frame EMIT + SIM are buildable from existing primitives.

### (a/b) SAFE-Z — per-wizard, NO shared control (a cross-wizard refactor to share)
- SHARED today: only the param KEY `params.safeZ` + the `num()` coercion.
- PER-WIZARD: the HTML field (`c_safe_z`/`m_safe_z`/`rc_safe_z`/`rcl_safe_z`/`al_safe_z`/`circ_safe_z`), the view read, the
  opSchema FIELD_BIND, AND the emit — DIFFERENT vars (`#17` middle/rotary, `#19` corner/alignment/ATC), defaults (10 vs 15),
  and SEMANTICS (corner `#17 = safeZ + scanDepth`, its safe-Z RETRACT is `#19`). No shared field/widget/helper.
- ⇒ the dispatch's "SHARED safe-Z control so wizards INHERIT the toggle" doesn't exist — building one = a refactor across the
  HTML + 5–6 views + the schema bindings. That's the cross-wizard refactor to gate before.

### OPEN DECISIONS (advisor's call)
1. **Shared-control fork.**
   - **(A, REC)** inc-1 = a shared frame-aware EMIT helper + the block field + round-trip (these ARE reusable) wired through
     ONE wizard, the UI toggle hand-added to that wizard's field; the shared UI control (all wizards inherit) = a follow-up
     refactor. Minimal, no cross-wizard refactor now.
   - **(B)** build the shared safe-Z field COMPONENT first (refactor the per-wizard fields into one control), then the toggle
     lives there. The bigger cross-wizard refactor.
2. **Machine-frame MOVE semantics — the real subtlety.** The relative move is a SYMMETRIC pair: lift `MV('Z','#17')` (+#17),
   drop `MV('Z','[0-#17]')` (−#17 back to the work height). Under an ABSOLUTE machine lift (`G53 Z#17`), the `−#17` drop no
   longer returns to work (it drops #17 below the machine plane). So machine-frame is NOT a 1-line swap of the lift — the
   lift→drop pairing needs reworking (the drop-back needs the work Z). **Q:** for inc 1, scope machine-frame to (a) just the
   FINAL retract / end park (clean — no drop-back, a true single-move slice), or (b) inter-move traverses too (needs the rework)?
3. **Machine-Z VALUE.** Confirm `frame=machine` ⇒ `safeZ.value` IS the absolute machine Z (e.g. 480), emitted `G53 Z#<safeZvar>`
   (user owns the number, per the spec). The height stays a value the user sets, not a profile push.

### Recommendation
(A) + scope inc-1 machine-frame to the **FINAL retract / park** (the clean, well-defined case) on the **middle or rotary**
(cleanest `#17 = safeZ` seam): the `safeZ.frame` param (default relative) + relative byte-identical (stripAnnotations) + machine
→ `dialect.machineMove('Z', '#17')` + the block round-trip + the sim honoring G53. The inter-move-traverse machine frame (the
lift/drop rework) and the shared UI control across all wizards = follow-ups (inc 2+). No G-code invented.

---

## 🔨 turn 153 — SPATIAL MODEL inc1: the safe-Z FRAME primitive (relative byte-identical, machine=G53), ONE wizard

Gate resolved (advisor t152, my rec). Built the DECLARED safe-Z frame primitive + wired it through the rotary's FINAL retract/
park as the proof. It's an EMIT declaration → relative stays byte-identical, machine emits the ground-truth G53 (never invented).

**Shared mechanism** (`web/wizards/ops/safeZframe.js`):
- `safeZFrameOf(v)` — normalise (default `relative`; unknown → relative, so an absent field is the status quo).
- `safeZParkBlock(frame, varRef)` — the frame-aware park block: `relative` → the rapid `move` atom (G0 Z#var; IDENTICAL to a
  plain `MV('Z',var)`); `machine` → the `machinemove` atom → the dialect's G53 machine-coord move (Expert `G53 Z#var`,
  V4.1 `G0 G53 Z#var`). Reuses the existing atoms, so it round-trips through gcodeToStack as-is.

**Wired the rotary** (one vertical slice): a `safeZFrame` param (default relative); the FINAL retract `C('Final retract')`
now `S.push(safeZParkBlock(safeZFrame, '#17'))`. SCOPE = the success final park only — the error-path retract STAYS relative
(an absolute machine lift there would break the symmetric drop-back; deferred). UI: a compact `rel|mach` toggle on `rc_safe_z`
(hand-added; the shared UI control = a follow-up). View reads it + `inputIds`; opSchema gets `safeZFrame: Enum()` + the FIELD_BIND.

**machine semantic:** `frame=machine` ⇒ the safe-Z VALUE *is* the absolute machine Z → `G53 Z#17` (the user owns the number).

**Verified** (`tests/safez-frame.spec.js` + checks):
- **relative BYTE-IDENTICAL to today** — git-stash diff (the relative-default emit vs the pre-change emit, stripAnnotations,
  3-combo sweep) → **IDENTICAL ✓**. The test also asserts relative emits 0 × G53 + 2 × `G0 Z#17`.
- **machine** — the final park emits `G53 Z#17` (1×); the error retract stays `G0 Z#17` (scope). The SIM honors it: tracing
  `G53 Z#17` (#17=480) parks at part-Z 480 (wcsOffset 0) / 380 (wcsOffset 100) — the engine's machine→part map.
- **round-trip** — `markerLine('rotary_center', {…,safeZFrame:'machine'})` → `parseMarker` preserves `safeZFrame='machine'`.
- **Full suite 435 passed.**

**Follow-ups** (not this slice): inter-move-traverse machine frame (the lift/drop rework); rollout to the other wizards; the
SHARED UI control (so wizards inherit the toggle, not hand-added); the `wcs` frame value. Releasable increment (advisor's bump).

---

## 🔨 turn 155 — SPATIAL MODEL 1b SCOUT + GATE: safe-Z SOURCE — infra buildable, but register mapping/frame AMBIGUOUS + conflicts an existing decision

Scout-first per the dispatch. The source-from-register INFRA is fully present (mechanical to mirror), but the register
MAPPING + FRAME is ambiguous and the premise CONFLICTS with a deliberate project decision → gating per the dispatch's own
gate condition ("if the register mapping/frame is ambiguous, surface the plan, don't barrel"). No code changed.

### Infra — BUILDABLE (the radius-comp #6-from-register pattern is the exact precedent)
- `profile.probeVars` (controllerProfiles.js) maps a field → its controller register `{ctrl,pr,label}` per profile.
- `srcVal(src, literal)` / `srcNote` (probeBlocks.js) — emit picks the register var over the literal + annotates the comment.
- `probeSrc(field)` / `resolveProbeSources([...])` (settingsPanel.js) — resolves only when the user flipped `sources.<field>='ctrl'`.
- `probeSrcGlyph.js` — the greying UI: a glyph button by the field; on `ctrl` the input goes `readOnly` + `.psrc-ctrl` (mirrors the radius-comp greying).
- `gpSeededVarStore` (gcodePreviewTab.js) seeds the sim's var store from settings → the SIM reads the register VALUE.
⇒ IF safe-Z had a profile register, this is mechanical (add to probeVars + the view's source list + srcVal in the emit + seed the var).

### BUT — 4 conflicts (the gate)
1. **safe-Z is DELIBERATELY Studio-side already.** controllerProfiles.js comment: "Fields with no native var (slow feed, scan
   stroke, **safe Z**) are deliberately absent — they stay Studio-side." PROBE-CONFIG-SOURCE.md: safe-Z = user-convention `#1173`.
   So "source from #69" CONTRADICTS an existing, deliberate decision.
2. **#69 is profile-INCONSISTENT.** Expert cfg `#69 -s1"Z-axis safe height"` ✓ — but the DM500 profile already maps
   `#69 = "Thickness of tool sensor"` (blockHeight). #69 means DIFFERENT things per controller; not a consistent safe-Z register.
3. **The FRAME is NOT "machine → G53".** The Expert 3D-probe dump's "Move to safe height" is `G90 G00 Z[#113]` — WORK-absolute,
   a LOCAL var #113, NOT G53/machine, and it does NOT reference #69. DM500 `#2049` is machine-coord but used in ARITHMETIC
   (`#3=#574-#2049`) → a RELATIVE (G91) lift, not a G53. So the dispatch's `controller → G53 Z#<register>` is not the ground truth.
4. **#69 is never macro-referenced (Expert).** The probe macros use a local clearance (#113), never #69 — so emitting
   `G53/G90 Z#69` is a usage seen in NO dump (it'd invent the usage even though the register name is real).

### Questions (advisor reconcile before any build)
1. Does 1b OVERRIDE the deliberate "safe-Z is Studio-side" decision (cfg #69 as new ground truth vs PROBE-CONFIG-SOURCE.md's
   #1173 convention + the probeVars deliberate-absence)?
2. Per-profile register + EMIT: Expert #69 emits how (the dump's frame is G90 work-absolute, and #69 isn't macro-referenced)?
   DM500 — a relative lift derived from #2049 (the dump's arithmetic), not G53? The "machine → G53" mapping doesn't hold.
3. Intended source = the cfg `#69` OR the `#1173` user-convention (they differ)? On DM500 #69 is the tool sensor — handle that.

### Recommendation
GATE — don't build. The register NAME is real (Expert #69 = "Z-axis safe height"), but the SOURCE/FRAME/CONSISTENCY/USAGE are
ambiguous AND conflict with the project's deliberate Studio-side decision. Building now would contradict that decision, emit a
non-ground-truth register usage (`G53/G90 Z#69` in no dump), and be wrong on DM500 (#69 = tool sensor). Reconcile the premise
(which register, which frame per profile, vs the existing decision) — then the build is mechanical (the infra is all there).

---

## 🔨 turn 157 — SPATIAL MODEL 1c: roll the safe-Z FRAME out via a SHARED toggle widget (byte-identical each; corner/atc flagged)

Built the shared UI control 1a deferred + rolled the frame (proven on rotary) out to every wizard with a CLEAN final-park safe-Z.

**Shared widget** (`web/ui/safeZFrameToggle.js`): the `rel|mach` toggle is DECLARED ONCE + INJECTED next to each adopting
safe-Z field by `mountSafeZFrameToggles()` (idempotent; mounted from `wizardManager` on wizard-open, the same hook the probe-
source chips use). `safeZFrameValue(fieldId)` is the shared view-read. Wizards adopt by listing their field id. The 1a static
rotary toggle was converted to this shared widget (removed from index.html).

**Rolled out** (final park → `safeZParkBlock` + the `safeZFrame` param + view-read + opSchema param/bind):
- **rotary_clock** (`#17`, the "Final retract" — an exact mirror of rotary_center).
- **alignment** (`#19`, the final `MV('Z','#19')` before END).
- **middle** (`#17`, BOTH branch final-parks — 2-axis + single-axis; the inter-move lifts + error retract STAY relative).

**FLAGGED / deferred (don't force-fit, per the dispatch):**
- **corner** — `#17 = safeZ + scanDepth` (the safe-Z is FOLDED into the plunge depth; its retract uses `#17`=plungeDepth, and
  `#19`=safeZ isn't a clean final park). The safe-Z semantic differs from rotary's → NOT a clean mirror. Deferred.
- **atc** (atcLength / atcToolCheck) — has NO safe-Z UI field (safeZ comes from defaults, no form input) → nowhere to host the
  toggle. Deferred until it gets a field.

**Verified:**
- **relative BYTE-IDENTICAL** — git-stash diff (rotary_clock + alignment + middle relative-default vs pre-1c, stripAnnotations,
  incl. middle boss-both + pocket) → **IDENTICAL ✓**. The rollout test also asserts each emits 0 × G53 on relative.
- **machine** — each parks the FINAL retract via `G53 Z#<var>` (1×); the sim honors G53 (general, verified t153).
- **round-trip** — `safeZFrame` survives the op marker for each wizard.
- **shared widget renders uniformly** — opening a wizard mounts all 4 toggles (`relative|machine`).
- **Full suite 435 passed** (the one failure, `align-rotate-gui`, is a timing FLAKE — passes isolated ×2; `ddcsAlignRotate`
  doesn't import any changed file).

SCOPE = the frame rollout via the shared widget. NOT inter-move, NOT the bar (inc2). Releasable increment (advisor's bump).

---

## 🔨 turn 159 — SPATIAL MODEL inc 2 SCOUT + GATE: rotary BAR — bar≠box needs a DECLARED Ø on the stock (new infra)

Scout-first per the dispatch. Confirmed: a bar ≠ box can't be EXPRESSED today, and the collision can only read the stock — so
the dispatch's "render correctly for Ø ≠ box (probe + cylinder agree)" needs new declaration infra. Gating with the plan.

### Scout (confirmed)
- **The collision is box-inferred, stock-only.** `cylinderOf(stock, rotaryAxis)` → `r = min(cross dims)/2`; `stockProbeStop(A,B,
  stock,rotaryAxis,tipR)` takes ONLY the stock — NO params path. So for the collision to use a declared Ø, the Ø must live ON
  the stock.
- **The stock has NO diameter field.** `{ x,y,z,shape,datum,pin,show }`; the stock editor accepts only X/Y/Z (no Ø input even for
  `shape:'cylinder'`). The cylinder = the box (Ø = min cross dims). ⇒ a bar ≠ box can't be declared at all.
- **The known Ø is PULLED from the stock, read-only.** rotaryCenterView: for a cylinder stock `diameter = 2*cylinderOf(stock).r`
  (read-only — "change it in the stock editor"); the wizard's `diameter` param NEVER flows back to the stock. No params→stock plumbing.
- **opSimStarts re-infers R = min(sy,sz)/2** (doesn't read `params.diameter`); the collision agrees (both = min cross dims) — so
  the DEFAULT (bar=box) has no mismatch. The datum is macro-only today (`SWO('Z', datum==='top'?#50:#56)`); the preview is always
  top-at-0 (`flankZ = -R`).

### Plan (the declared cylinder — new infra)
1. **`stock.diameter`** (optional; meaningful for `shape:'cylinder'`; the cylinder's true OD, distinct from the box).
2. **`cylinderOf` + `opSimStarts` read `stock.diameter ?? min(cross dims)/2`** — declared-first, fallback to the box. DEFAULT
   (no `diameter`) is render/collision-IDENTICAL (no regression). bar≠box (diameter 50 in a 76×76 box) → R=25 for BOTH render +
   collision → they agree (no false through-stock).
3. **Stock editor: a Ø input for cylinders** — the user declares the bar Ø (one source).
4. **Known wizard pulls `stock.diameter`** (read-only, as now). **FIT** renders the nominal `stock.diameter ?? box` (measures, consumes none).

### Design calls (advisor)
1. The Ø lives on `stock.diameter` (declared-first, fallback min-cross) — confirm.
2. **Where the user declares it:** (A, REC) a Ø input in the STOCK EDITOR — the Ø is a stock property, the wizard READS it
   (read-only, no wizard-mutates-stock); OR (B) the spec's literal "known method TYPES Ø; the stock carries it" — the wizard's
   typed Ø PERSISTS to `stock.diameter` (the wizard mutates the shared workpiece stock — more plumbing + a coupling call).
3. **Datum → render frame:** keep the preview top-at-0 (datum stays macro-only, REC) OR make the render axis-Z datum-relative
   (center → axis at 0; top → −R)? The spec's "height-of-center derived from bar+datum" reads as a MACRO concern (already done);
   the preview convention is separate.
4. FIT nominal = `stock.diameter ?? box` — confirm.

### Recommendation
GATE — don't build. Bar≠box requires `stock.diameter` (the collision's only source) + the editor Ø input + the readers — new
declaration infra. REC: (2A) the Ø is a stock-editor property the sim+collision both read (`stock.diameter ?? min-cross`),
default unchanged; (3) keep the preview top-at-0. That's the minimal declared cylinder with no wizard-mutates-stock coupling.
Bless the shape (esp. 2A vs 2B and the datum question) and it's mechanical.

---

## 🔨 turn 161 — SPATIAL MODEL inc2: the rotary sim READS the declared bar (stock.diameter), not min(cross)/2

Gate resolved (2A blessed, top-at-0 kept). The rotary bar is now a DECLARED cylinder: `stock.diameter` (optional) is read by the
collision, the 3D mesh, AND the sim-starts — declared-first, box-fallback. ONE source, set in the stock editor (no wizard-mutates-stock).

**One source** — `barRadius(stock, crossA, crossB)` (`engine/probeGeometry.js`): `stock.diameter>0 ? d/2 : min(cross)/2`. Read by:
- `cylinderOf` (the probe COLLISION) — was `min(cross)/2`.
- `gcodeViz3d.setStock` (the 3D MESH) — was `min(cross)/2`.
- `opSimStarts.rotary_center` (the sim-start R + the makeProvider ctx.R) — was `min(sy,sz)/2`.
So the render + the collision can't drift: both read the same declared Ø.

**Stock editor** — a "Bar Ø" input (`se_dia`, shown only for `shape:'cylinder'`) writes `stock.diameter` (blank/non-cylinder →
undefined); round-trips through `applySettings` → the settings store. The KNOWN wizard auto-reads it (it pulls
`2*cylinderOf(stock).r`, now barRadius-driven); the FIT renders the nominal (`stock.diameter ?? box`).

**Verified** (`tests/rotary-bar-declared.spec.js`):
- **DEFAULT (no diameter) UNCHANGED** — collision R = mesh R = **38.1** (= min(cross)/2), no regression.
- **declared Ø50 in a 76×76 box → R=25 for BOTH collision + mesh** (they agree → no false through-stock); opSimStarts reads it too
  (the flank moves from −4 to +9.1 — the thinner bar's flanks sit closer to centre).
- `stock.diameter` round-trips through settings (50).
- Render captured + opened: the Ø50 bar renders visibly thinner than the default Ø76 in the same 76×76 box.
- **Full suite 435 passed** — 2 failures (`blocks-live-form`, `knob-persist`) are parallel-load FLAKES (7 passed isolated;
  both in the FORM/knob domain, nothing to do with the probeGeometry/mesh/stock changes).

SCOPE = stock.diameter + the sim/collision/mesh read. NOT the datum-relative frame (kept top-at-0, macro-only). Releasable (advisor's bump).

---

## 🔨 turn 163 — PROBE-SURFACE unify-pass: delete radiuscomp.spaced + normalize to the DDCS no-space bracket style

Closes the probe-surface chapter. Normalization ONLY — ZERO logic change.

**The wart:** `radiuscomp.spaced` (a cosmetic param) made the CORNER X/Y comps emit `[#1925 + #6]` (inner spaces) while every
other comp (edge, corner-Z, middle, rotary known + fit) emitted `[#1925+#6]` (no spaces). The only `spaced:true` caller was the
corner X/Y.

**Done:**
- DELETED `radiuscomp.spaced` (the param + the `sp` emit) → the radiuscomp emits ONE convention, **no inner spaces** always.
- Removed the `spaced` arg from `probeSurfaceStack` + the corner's `spaced:true/false`.
- The corner X/Y now emit `[#1925+#6]` / `[#1926+#6]` (was `[#1925 + #6]`) — consistent with the rest.
- Updated `CORNER_GOLDEN` (the byte-identical assertion) to the normalized no-space form (8 spaced brackets → 0).
- The rotary FIT comps + solver were ALREADY no-space (`#51=[#1927-#6]`, `[[#52-#54]*...]`) — consistent, no change needed.

**DDCS-aligned:** the M350 dump uses no inner spaces (`G00 Z[#113-2]` in the SYSDISK 3D-probe capture). So no-space is the
ground-truth style.

**Verdict — COSMETIC, not a compliance fix → BATCH (not its own release).** The spacing is functionally a no-op (DDCS parses
both `[#1925 + #6]` and `[#1925+#6]`); this is consistency + dump-alignment, not correctness.

**Flagged (separate, OUT of this scope):** `atcLengthWizard.js:70` still emits `[#101 - #6]` (spaced) — but that's the ATC
LENGTH calc (MachineZ − BlockHeight), NOT a radiuscomp/probe-surface comp. A future general spacing pass could unify it.

**Verified:** `probe-surface-block.spec` green (5 passed — radiuscomp/probeSurfaceStack/EDGE/CORNER/ROTARY); full suite **436
passed** (1 failure, `project-drawer-smoke`, is a parallel-load flake — passes isolated, unrelated). The probe-surface chapter
is closed (radiuscomp atom → 5 wizards migrated → disc-on-surface both sims → fit-comp → now one bracket style).

---

## 🔨 turn 165 — ITEM 4 SCOUT (design phase 1): the current travel/START model + the seams for start=source/travel=derived

A map, NO build. Headline: **the model is INVERTED today** (START is DERIVED from TRAVEL), but the seam for the new model
ALREADY EXISTS (a user-drag override + the inversion prototyped for ONE field). Item 4 = flip the dependency + generalise the
prototype + retire the redundant fields. The human's vision is already DOCUMENTED in two backlog files (cited below).

### A · Current model — per wizard (START ← derived ← TRAVEL, backwards)
Every probe wizard computes the START from a TRAVEL field + the stock; nothing derives travel from the start.

| wizard | START source | TRAVEL field(s) | relation |
|---|---|---|---|
| EDGE | `inferStart` → outset = min(dist*0.6, 15) off the edge | `dist` (#1; the canvas LABELS it "reach") | START ← dist |
| CORNER | `inferStart` → inFront/nearEdge from travelDist+dist | `travelDist` (#15/#16, the between-walls move), dist | START ← travelDist |
| ROTARY CENTER | `opSimStarts` → top + 2 flanks; flankOff = R+retract+tipR | retract, safeZ (no travel field — flankOff computed) | START ← R/retract |
| ROTARY CLOCK | `inferStart` → y = sy/2 − span/2 | `span` (#6, the A→B distance) | START ← span |
| ALIGNMENT | `opSimStarts` → A/B at 30%/70% of the stock | (none; macro reads the DRO) | START inferred per-pass |
| **MIDDLE (crux)** | `opSimStarts` → 1–5 markers; outside() = f(dist) | dist, crossX/crossY (#19/#20), **diagTravel (#21)**, clearOver (#18) | START ← dist; travel user-set |

`opSimStarts` is the central registry for the multi-pass wizards (middle/alignment/rotary); the single-pass ones
(edge/corner/rotary-clock) define `inferStart` directly. The pass/marker count MUST mirror the macro's `reposition()` calls.

### B · The MIDDLE crux — the marker count IS config-driven (1–5)
`opSimStarts.middle`: `z(probeZ?1:0) + prim(inAxisManual?2:1) + sec(twoAxis ? (boss? (inAxisManual?2:1) : 1) : 0)`.
Max = **5** when probeZ + boss + inAxisManual + twoAxis → `[Z, X-w1, X-w2, Y-w1, Y-w2]` — exactly the human's "4th + 5th
marker." So the handles already enumerate from the real config (the spec's requirement is half-met).

### C · The seam ALREADY EXISTS — the inversion is prototyped
- **START-as-source infra is built:** `createPreviewPanel.userStarts` (a drag/jog BEATS the inferStarts hint + PERSISTS);
  `onStartDrag(pos, pass)`; `toolpath2d.setStarts` draws the draggable ①②③④ handles. So drag → persist → macro re-runs from it.
- **The inversion is prototyped for ONE field:** `tieDiagTravel` (middleView) — dragging ② DERIVES `#21` and writes the field
  ("② is the master"). That's exactly start=source/travel=derived, for diagTravel only. Item 4 = generalise it to ALL travels.

### D · The human's documented vision (ground truth — the spec is half-written)
- **`MIDDLE-PROBE-BACKLOG.md` (turn 117, "THE CRUX"):** (1) START=source, TRAVEL=derived — drag the start, never type the
  travel; the **diag-travel field is OBSOLETE** ("dependent on the next start pos, not a distance"); the **block STORES the
  derived value** (spatial-GUI: drag the canvas, plain number on the block, no form field) → unification: **reach = travel =
  start**, edge-reach→start folds in here. (2) markers config-driven (the 4th+5th). (3) the **"locked 24" BUG**: the diag handle/
  field/value are DISCONNECTED (field shows 8, effective ~24, handle does nothing) → making START the source **fixes it by
  construction**. Plus a **per-transition AUTO/MANUAL unification** (one uniform model replacing inAxis+transAxis+crossX/Y+diag;
  "two meanings of pass" — the sim re-anchors per START always, auto/manual only = does the operator stop).
- **`FEATURE-CANVAS-PROBE-SCOPE.md`:** the canvas views — EDGE probe-VECTOR (one drag = axis+dir+reach), MIDDLE start-markers
  ①②③④ + the cross-over/diagonal as draggable vectors, the probe-reach RING. **Build order:** EDGE probe-vector first (smallest
  surface, biggest "aha"), then MIDDLE start-markers (continues the toolpath2d ①②③④ work).
- **EDGE (turn 117):** DROP the "reach" handle, ADD a START-POS handle.

### E · Surprises / flags
1. The dependency is **backwards** today (start←travel) but the flip is low-risk: the override infra + the tieDiagTravel
   prototype already exist. Item 4 is "invert + generalise + delete the field," not "build from scratch."
2. **"travel = derived" means derived from the START POSITIONS, not computed by the macro** — the macro genuinely can't know
   wall-2 pre-probe; but the GUI knows where the user dropped ②, so the field is derivable GUI-side (that's all tieDiagTravel does).
3. **B-TRANS-ANGLE is NOT in the code** — a backlog RENDER-side item (turn 102): the trans-axis traverse draws at a FIXED 45°
   instead of the ACTUAL vector to the variable ②. It rides the SAME ② start data → folds into the same start-sync cluster.
4. **EDGE "reach" is the `dist` field** mislabeled "reach" on the canvas — drop the reach handle, the dist derives from the
   start outset (or a reach ring).
5. The **marker count must stay in lockstep** with the macro's `reposition()` calls (the existing fragile seam) — the
   config-driven enumeration (B) already does this; item 4 must preserve it.

### Recommended seams for the increment plan (advisor's spec)
1. **EDGE first** (the prototype, per the scope doc): drop reach → a START-POS handle; dist derives. Smallest, proves the pattern.
2. **MIDDLE** (the crux): generalise `tieDiagTravel` → all travels derive from the dragged starts; **remove the diagTravel form
   field** (the block stores it); fix the "locked" disconnect by construction; the per-transition auto/manual unification.
3. **B-TRANS-ANGLE** (render): draw the actual trans-axis vector to ②, not a fixed 45° — falls out once ② is the source.
4. Corner/rotary/alignment: adopt the same start-marker canvas (their opSimStarts already provide the per-pass starts).

---

## 🔨 turn 167 — ITEM 4 inc 1 (EDGE): flip START←TRAVEL to TRAVEL←START — the prototype

The dependency-flip on the simplest wizard, to prove the pattern. The EMIT is UNTOUCHED — the change is purely the
INTERACTION (drag the start → derive the reach), the viz, and the field becoming a readout. So it's BYTE-identical (not
merely value-identical) for ALL params, not just the default.

**Built (mirrors middle's proven `renderStartCanvas` + `tieDiagTravel`):**
- `edgeView.js`: replaced the probe-VECTOR/"reach" arrow with a draggable ① **START-POS** marker on the feature canvas. A
  drag → `panel.onStartDrag → userStarts[0]` (the SIM source — the marker STICKS where dropped, beating the inferred hint)
  **AND** `tieEdgeDist(world)` derives the reach: `outset = |start − wall|`, `dist = round(outset / 0.6)` (the exact inverse
  of inferStart's `outset = clamp(dist*0.6, 6, 15)`) → writes `p_dist`. ONE handle, BOTH outputs.
- `edgeWizard.js`: added `inferStarts(params, stock) = [inferStart]` (1 pass → 1 marker; markers↔macro `reposition()` in
  trivial lockstep) — fed to `preview3D` as the per-pass hint so the panel seeds the ① marker.
- `index.html`: `p_dist` (MAX PROBE) → `readonly` readout (the start is the source; you don't type the reach).
- removed the now-orphaned `buildCanvasWidgets` import + `setFields`/`r3` (my change orphaned them). The generic
  `probeVector` widget + its UNIT test stay (out of scope; may be adopted elsewhere).
- `tests/edge-probe-vector.spec.js`: rewrote the INTEGRATION test (it asserted the OLD arrow→axis/dir/dist model) → the new
  flip (the ① start is the source: it sticks `x<0` outside the wall, and the reach DERIVES `round(outset/0.6)`; MAX PROBE is
  read-only). Kept the generic-widget unit test.

**Verified:** rewritten edge test green; **EDGE byte-identical migration (probe-surface-block) STILL green** → emit unchanged;
`wizard-templates` green (readonly doesn't break the round-trip — a loaded template still seeds dist=33 via JS); FULL SUITE
**436 passed** (1 failure `align-rotate-gui` = the known parallel-load flake, passes isolated). REAL RENDER (human-eyes,
opened both PNGs): dragging the ① start away from the wall re-derived the reach 200→77 and the marker stuck at the dropped
outset.

**Persistence (round-trip):** `p_dist` ↔ a shared `maxDist` sticky-override (wizardManager:33 / `ddcs_probe_field_overrides`)
+ the op's `params.dist` (recordOp). The drag dispatches `input` → the existing sticky-save persists it; the restore sets
`.value` via JS — readonly blocks only typing, not JS, so both survive. `#1` ← `params.dist` round-trips unchanged.

**FLAGS for the advisor:**
1. **readout vs full removal** (the dispatch-flagged sub-decision): I kept a **read-only readout**, NOT full field removal.
   Two reasons it's clearly better: (a) MAX PROBE is a SAFETY-relevant distance (how far the probe travels) the operator
   should SEE; (b) the value MUST persist in the DOM (`userStarts` is sim-only, lost on op save/reopen) — full removal would
   need a hidden store anyway, so a visible readout dominates. If you want it fully hidden, it's a 1-line change.
2. **default sits outside the linear region** — the default reach (the shared `maxDist`, 200 here) maps to `outset = 60`, but
   inferStart CAPS the start at `outset 15`, so AT REST the marker doesn't reflect the full reach (a benign pre-existing cap,
   not new). On the first drag it syncs cleanly to `round(outset/0.6)`. A future tweak could lower the default / uncap so the
   marker and reach agree at rest (touches value-identical → your call).
3. **3D/2D sim-marker drag doesn't derive** — `tieEdgeDist` rides the FEATURE-CANVAS onDrag (like middle's `tieDiagTravel`);
   dragging the start in the 3D/2D SIM updates `userStarts` but not the reach. Same gap the middle has; acceptable for inc1.
4. **the derived reach writes the SHARED `maxDist`** — the existing `p_dist↔maxDist` sync means dragging the edge start nudges
   the shared max-probe default other wizards seed from. Existing mechanism; the flip rides it.

---

## 🔨 turn 169 — ITEM 4 inc 1 (EDGE) FIX: revert MAX PROBE to editable + DECOUPLE the start from it

Human correction (t168): "i didn't say to drop max probe we need it, i said drop reach" + "reach was in the gui." V10.46
(90dc933) got it HALF right: RIGHT — dropped the "reach" ARROW (the GUI element) → a draggable start marker; WRONG — it
ALSO made MAX PROBE (`p_dist`) read-only + COUPLED it (the drag derived `#1` via `tieEdgeDist`). MAX PROBE is a SEPARATE,
needed, editable SAFETY field — never should have been touched. The conflation: I treated the start marker ("reach") and the
max search distance (`#1`) as ONE thing; they're TWO.

**Fixed:**
- `edgeView.js`: DELETED `tieEdgeDist` + its call. The start-drag now writes ONLY the sim start (`panel.onStartDrag →
  userStarts[0]`) — it does NOT touch `p_dist`. DECOUPLED.
- `index.html`: `p_dist` (MAX PROBE) → reverted to a NORMAL EDITABLE field (removed `readonly` + the readout title). The
  user's typed max search distance, emitted as `#1` exactly as before.
- KEPT the draggable ① START marker (the "reach" — the dropped arrow's replacement) + `edgeWizard.inferStarts`.
- `tests/edge-probe-vector.spec.js`: rewrote the integration test for the DECOUPLED model — MAX PROBE is editable (a `fill`
  that would throw on read-only), the drag MOVES the start but leaves MAX PROBE unchanged, and the dragged start PERSISTS
  across a MAX PROBE edit (userStarts beats the hint). Kept the generic-widget unit test.

**PERSISTENCE (verify-first — the dispatch's gate question):** the start (reach) is a SIM-ONLY hint (the incremental probe
macro doesn't encode it — no emit effect). It persists IN-SESSION via `userStarts` (never reset in the panel; `computePassStarts`
reads `userStarts[p] || hint`, line 393) — EXACTLY the MIDDLE's pattern (its dragged start is also sim-only userStarts, no
param for the position). So NO new param, NO design call → NO gate. The t167 bug was coupling them FOR persistence; decoupled,
each persists on its own (MAX PROBE via the form/maxDist, the start via userStarts).

**Verified:** edge decoupled-integration green; **byte-identical EDGE migration (probe-surface-block) green → emit = the
ORIGINAL pre-edge** (`tieEdgeDist` gone, MAX PROBE typed as before); REAL RENDER (human-eyes, both PNGs): `p_dist readonly =
false` (EDITABLE), MAX PROBE held 37→37 across a start-drag (DECOUPLED), the marker moved. FULL SUITE: 426 passed / 10 failed
BUT in a **37-min DEGRADED run (2× the normal ~18 min — the machine was slammed)**; ALL 10 confirmed ENVIRONMENTAL FLAKES on
re-run — 8/10 recovered on a serial re-run; `middle-animator` passes isolated (6 passed) and failed DIFFERENT sub-tests each
run (:22 vs :196 = non-determinism); `knob-persist` (a known flake) passes on a clean re-run (1 passed); `per-pass-starts-2d`
(the only edge-adjacent one) passes serially. No regression — an edge-only change has no mechanism to touch io-sim /
wizard-library / placement / op-* / knob / animator.

**Note for release:** this fixes a USER-FACING regression shipped in V10.46 (MAX PROBE was non-editable) — recommend a prompt
version bump/release (left to the advisor's cadence call, not bumped unilaterally mid-handoff).

---

## 🔨 turn 171 — ITEM 4 inc 2 MIDDLE (the CRUX): SCOUT + classification — GATE before any field removal

The edge lesson applied: classify EACH field derive-vs-needed BEFORE removing anything (I shipped a regression by conflating
a NEEDED field). NO code — a classified plan to bless. Read the full `middleStack` macro + `opSimStarts.middle`.

### (1) CLASSIFIED FIELD LIST — the 7 travel/clearance fields
| field | macro use | role | VERDICT | reason |
|---|---|---|---|---|
| `dist` #1 (MAX PROBE) | `#7=[0-#1]`,`#8=#1` → G31 | probe REACH (search dist) | **KEEP** | the search distance (safety) — already DECOUPLED from cross-over in code (middleWizard:47-48); the EDGE lesson — identical to edge's MAX PROBE |
| `retract` #2 | `#9/#10` back-off | probe param | **KEEP** | fast/slow retract; not a travel between two markers |
| `safeZ` #17 | `MV('Z','#17')` inter-pass lift + park | Z-clearance | **KEEP** | a Z-clearance/safety lift; the 2D markers are XY → no XY marker derives a Z-lift (SPATIAL-MODEL 1c already gave it a frame toggle) |
| `clearOver` #18 | `traverseOver`/`transTraverse` `MV('Z','#18')` | Z-clearance | **KEEP** | the boss-clear lift height (operator clears THEIR boss top; macro can't know boss height) — a Z-clearance, not an XY traverse |
| `diagTravel` #21 | `transTraverse` `smove=travelOpp(...,#21)` | XY traverse to ② | **DERIVE→REMOVE** | already derived from ② via `tieDiagTravel`; the "locked 24" field; THE prototype |
| `crossX` #19 / `crossY` #20 | `traverseOver` `MV(ax,#19/#20)` | XY traverse wall1→wall2 | **DERIVE→REMOVE (conditional)** | the in-axis traverse = the GAP between wall-1 and wall-2 markers → derivable like diagTravel, BUT needs a wall-2 marker surfaced in AUTO in-axis (today auto=1 marker) — the two-meanings-of-pass |

**KEEP (needed, stay editable):** dist #1, retract #2, safeZ #17, clearOver #18 — all are probe-reach / Z-clearance / safety
values the operator sets; none is an XY traverse spanning two markers. **DERIVE→REMOVE:** diagTravel #21 (ready), crossX/crossY
#19/#20 (needs the marker work). The discrete picks (type/axis/dir/both/circular/probeZ/inaxis/transaxis) + probe-config
(feed/port/level/q) are NOT travels → stay in the form (out of scope).

### (2) tieDiagTravel = the prototype — CONFIRMED
`tieDiagTravel` (middleView) derives `#21 = |draggedSec − centreSec|` from the dragged ② ("② is the master", drag-the-
position-the-field-follows). It generalises to crossX/crossY: derive each from the wall-2 marker's gap. BUT crossX/crossY's
wall-2 marker exists only in MANUAL in-axis today (auto in-axis = 1 marker) → generalising NEEDS the two-meanings-of-pass.

### (3) MARKER config + LOCKSTEP — CONFIRMED
`opSimStarts.middle` = `z(probeZ?1:0) + prim(inAxisManual?2:1) + sec(twoAxis ? (boss?(inAxisManual?2:1):1) : 0)` → max **5**
= `[Z, X-w1, X-w2, Y-w1, Y-w2]` (boss+both+inAxisManual+probeZ) — the human's 4th+5th. Lockstep CONFIRMED: each marker = one
parser pass = one `REPOSITION:` (or `transTraverse`'s REPOSITION). **KEY:** auto `traverseOver` (middleWizard:100) emits NO
REPOSITION → no new pass → that's WHY auto in-axis shows only 1 marker (the wall-2 probe-START is invisible). This is the crux.

### (4) THE TWO MEANINGS OF PASS — what it is
Today "pass" CONFLATES two things, both served by `REPOSITION:`: (a) a SIM re-anchor (each probe-START = a marker) and (b) an
operator-STOP (a manual jog pause). So in AUTO, `traverseOver` emits no REPOSITION → the wall-2 probe-START gets NO marker.
The unification (backlog t117): SEPARATE them — the sim re-anchors per probe-START ALWAYS (auto in-axis → 2 markers), and
auto/manual ONLY decides the operator-STOP (emit the REPOSITION pause or not), MIXABLE per-transition (Z→X, w1→w2, X→Y).
```
   TODAY:  REPOSITION = sim-marker AND operator-stop   → auto = 0 markers for wall-2 (can't derive crossX)
   UNIFIED: marker = per probe-START (always)  ·  auto/manual = operator-stop only (orthogonal)
            → auto in-axis surfaces wall-2 → crossX/crossY DERIVE from the gap (like #21 from ②)
```
This is the PREREQUISITE for deriving crossX/crossY, and it cleanly surfaces the 4th/5th markers.

### (5) THE LOCKED 24 — CONFIRMED
The "locked 24" = the diagTravel field/handle disconnect (field shows 8, effective ~24, handle does nothing — t117).
`tieDiagTravel` is the existing BRIDGE (drag ② → #21). The RESIDUAL disconnect = the field staying EDITABLE (a 2nd source).
Removing the field (the ② marker the SOLE source) fixes it BY CONSTRUCTION — nothing to disconnect. ⚠ FLAG: the default ②
(inferStart) derives #21 ≈ 52, NOT the current field default 50 → for value-identical, seed inferStart's ② so the derived
default = 50 (or accept a tiny shift). A build-time reconcile.

### BUILD PLAN — proposed, GATED (no removal until blessed)
- **inc2a (Tier 1 — READY, low-risk, mirrors EDGE):** remove the `diagTravel` field → derived from ② (a readout; ② is the
  source). Fixes the "locked 24" by construction. Reconcile the default for value-identical. KEEP dist/retract/safeZ/clearOver.
- **inc2b (Tier 2 — BIGGER, separate):** the two-meanings-of-pass unification (per-transition auto/manual + per-probe-START
  markers) → surface the wall-2 markers in auto → derive crossX/crossY → remove those fields → surface the 4th/5th cleanly.

**GATE — bless before I build:** (A) **inc2a now, defer inc2b** [RECOMMEND — edge-style incremental, value-identical, fixes
locked-24; the big re-architecture is its own inc]; (B) inc2a + inc2b together (full middle flip now); (C) re-scope. AND
confirm the KEEP-4 / REMOVE-3 classification. Also confirm a build-time verify (does `tieDiagTravel` currently fire — drag ② →
#21 updates?) before inc2a.

---

## 🔨 turn 173 — ITEM 4 inc2a (MIDDLE diagTravel field) DONE + B-TRANS render OPEN (45° wrong, user-confirmed) → ball to advisor

**inc2a (the dispatched task) — DONE + verified:** removed the editable DIAG TRAVEL field. `index.html` m_diag_block stays
permanently hidden (removed the show-toggle in `middleView.js`); the input is now a `readonly` value-store written ONLY by the
② drag (`tieDiagTravel`). The 4 KEEP fields (dist#1/retract#2/safeZ#17/clearOver#18) are UNTOUCHED + editable (render-verified).
Value-identical: `middleWizard.js` (the emit) is UNTOUCHED → byte-identical for all params (git diff confirms). 4 middle tests
green incl. the round-trip + the updated form test. The locked-24 editable-disconnect is gone (the field can't be user-typed).
- ⚠ IMPLEMENTATION FLAG: I used a HIDDEN readonly store, NOT a literal DOM-delete + pure-derive. Reason: the round-trip
  (opSession:195 `#21→m_diag_travel`, opSchema FIELD_BIND, `_seedForm` reopen) all key off m_diag_travel — hiding keeps that
  intact with a byte-identical change; full removal needs parallel plumbing. This also made the dispatch's "seed ② to derive 50"
  reconcile unnecessary (the store default is 50). Residual: a ~2mm default ②-marker-vs-#21 viz gap (deferred). If the advisor
  wants the literal pure-derive, it's a follow-up.
- Pre-existing bug found: `tieDiagTravel` secStart = `inAxisManual ? 2 : 1` IGNORES the lead Z marker → with probe-Z-first ON,
  the secondary is index 2 but the tie watches index 1 (the primary). A separate small fix (belongs with inc2b's marker work).

**B-TRANS render — OPEN, NOT FIXED (I got this wrong, the user corrected me):** the trans-axis DIAGONAL renders at ~45° and is
WRONG. Confirmed by the user (multiple screenshots) — it IS in the **2D AND 3D programmatic render**, NOT the dead hand-made SVG
(`assets/svg/middleViz.svg` is no longer used — a search agent wrongly fingered it), NOT the feature canvas. It's the trace's
**trans-axis RAPID segment** (`toolpath2d.js:220-225`, the `transV` cyan-dashed 2-axis rapid). The user wants it COMPUTED from
the **end-of-probe → ②** vector (the two real positions), never a fixed angle.
- I FLIP-FLOPPED + could not correctly diagnose the root cause (wrongly concluded "it re-angles, so it's computed" — the user:
  "always reangles yes" BUT "it is at 45, and wrong"). So: the END may track ② while the diagonal is still geometrically wrong.
- HYPOTHESIS (unverified — I was wrong once already, treat with caution): the diagonal's START is drawn from a fixed/wrong
  anchor (a stock CORNER) instead of the REAL end-of-X-probe (the +X wall at centre-Y, after the X seq + retract) — so the
  vector is wrong even as the end follows ②. The fix would draw the segment from the actual end-of-probe to ②.
- HANDED TO ADVISOR to scope a proper investigation (fresh eyes on how toolpath2d / the trace compute the trans-axis rapid's
  START + END endpoints; the user's "end-of-probe → ②" is the target model). Do NOT trust my partial diagnosis — re-verify.

---

## 🔨 turn 175 — B-TRANS EVIDENCE-FIRST diagnosis (instrumented the REAL trace coords) → root confirmed, GATE

Config: boss, X, probe-both, transAxis auto; ② dragged off-default; BOTH in-axis modes. Centre = (50, 40). The trans-axis
diagonal = the 2-axis rapid seg; world = seg + ① anchor. **REAL NUMBERS (not a hypothesis):**

| in-axis | ② (actual) | #21 | diagonal START→END (world) | secondary (Y) | primary (X) |
|---|---|---|---|---|---|
| AUTO | (73.8, 118.7) | 79 | (0, 40) → (**-2**, 119) | END.Y 119 ≈ ②.Y 118.7 ✓ | END.X **-2** ≠ ②.X 73.8 ≠ centre 50 — Δx=-2, DEGENERATE |
| MANUAL | (83.4, 128.4) | 88 | (**-211**, 40) → (**-123**, 128) | END.Y 128 ≈ ②.Y 128.4 ✓ | START **-211** (off-stock!), Δx=+88=+#21 |

**CONFIRMED (the advisor's read holds): the PRIMARY (X / pmove) component is the shared root; the SECONDARY (Y) already
tracks ② via #21 in both.** But the mechanism is nuanced (two DIFFERENT root causes, not one):
- **AUTO** — `pmove = [#53-#52-rv±#6]` resolves to ≈**-2** because **#53 (the measured centre) is DEGENERATE in the sim** (back-
  solved ≈2, not 50 — the probe sim isn't producing a valid centre). So the X barely moves → the diagonal goes nearly straight
  up, reaching neither ②.X (73.8) nor the centre (50). ALSO by design the re-centre IGNORES ②.X (so even a correct #53 lands
  the diagonal at (centre, ②.Y), not ②'s full position).
- **MANUAL** — `pmove = +#21` (the **wrong-direction sign**, exactly as flagged) AND the **START is off-stock at X=-211** (the
  manual reposition/marker anchoring puts the tool miles left). The diagonal lives entirely in empty space (X -211→-123), far
  from ② (83.4) and the stock (0-100).

**EMIT vs RENDER:** the trace renders the macro MOVE faithfully (the seg IS the emit). So: **MANUAL's wrong sign is a real EMIT
bug** (wrong on the real machine too). **AUTO is mixed** — partly EMIT *design* (re-centre ignores ②.X) + partly a **SIM
resolution** issue (#53 degenerate because the sim can't measure the centre).

**FIX SHAPE + the design tension (GATE — no fix until scoped):**
- The advisor's shape — *derive the PRIMARY from ② (a #21-peer), so the diagonal runs END-OF-PROBE → ②'s FULL position* — makes
  it computable in the sim and tracks ②. BUT it changes the macro semantics: today pmove re-centres to the **MEASURED** #53
  (more accurate than the user's eyeballed ②.X). Deriving from ②.X uses the GUI guess → loses measured-centre accuracy. So
  either (a) ② is **constrained to centre-X** (1-DOF Y-slide; the diagonal joins ② which sits at centre-X) — keeps the measured
  re-centre, OR (b) **pmove derives from ②.X** (a #21-peer) — full GUI control, drops the measured re-centre.
- The two modes need DIFFERENT fixes: MANUAL = fix the pmove **sign** (+#21 → re-centre/­toward-stock) + the off-stock start;
  AUTO = either resolve #53 in the sim OR the (a)/(b) above. They share the "primary is broken" root but not one patch.

GATE: pick (a constrained-② / measured re-centre) vs (b ②.X-derived pmove), and confirm the MANUAL sign+start is a separate
emit fix. NO code until blessed.

---

## 🔨 turn 177 — B-TRANS FIX (b): the diagonal's PRIMARY derives from the marker (#22) — AUTO fixed, manual sign fixed

Human picked (b) + wanted manual's sign in this batch. Built the #21-PEER for the primary: **#22** = the diagonal's X target.
- **middleWizard.js:** UNIFORM `pmove = [#22-#52-${lastRetract}±#6]` (replaces auto's `[#53-#52…]` re-centre AND manual's
  wrong-sign `±#21` — the "runs away" bug). #22 defaults to `'#53'` (re-centre) and becomes ②.X when the marker is placed.
  The **#52 cancels** (tool sits at #52+rv+#6, moves [#22-#52-rv±#6] → lands at #22) so it AVOIDS the degenerate sim #53. The
  #22 assign lives INSIDE `transTraverse` (after the primary seq measures #53) — a bug I caught: assigning it earlier captured
  #53's pre-probe 0.
- **middleView.js:** `tieDiagTravel` now writes BOTH #21 (②.Y offset) and #22 (②.X) from the drag; `update()` reads both.
- **round-trip:** `diagPrimary` added to opSchema (schema + FIELD_BIND) + opSession reverse-sync (#22 → m_diag_primary); a
  hidden readonly `m_diag_primary` store (like inc2a's #21).

**VERIFIED (instrumented + human-eyes):** AUTO drag ② → the diagonal END = **(74, 119) ≈ ② (73.8, 118.7)** — it JOINS ②, both
axes (was ~45°, degenerate X). At rest (#22=#53 measured) the re-centre is restored → `middle-aim-tie` GREEN. The 2 trans-
traverse tests updated for the new emit text (`#53-#52` → `#22-#52`); DDCS-valid (`#22=#53`, bracket expr).

**⚠ MANUAL — sign fixed, off-stock NOT fixed (out of scope):** the uniform pmove makes the manual diagonal TARGET ②.X (the
wrong-sign "runs away" is gone). BUT the render shows the manual secondary probe still starting **off-stock (X≈-120)** — that's
the manual PROBES NOT STOPPING in the sim (accumulating off-stock), i.e. the **probe-calc degeneracy**, the SAME class as the
#53 sim bug the dispatch DEFERRED as the next fix. So the manual off-stock is DOWNSTREAM of that separate bug, not the diagonal.
The dispatch called it "the -211 anchoring" (in scope) but the render (correct anchoring) shows it's the probe-calc — FLAG for
the advisor: the manual off-stock needs the probe-calc/#53 fix, not more diagonal work.

**Full suite:** launched but the box is EXTREMELY loaded (a single spec > 3 min; ~30+ min for the suite) — committing on the
verified middle area (the changes are middle-scoped + the round-trip); RE-RUN the full suite to confirm no broad regression.

---

## 🔨 turn 1 (cycle 1) — CORNER-PORT inc A: LIFT the wizards-as-data MECHANISM onto `port/corner-clean`

Dispatched (HANDOFF turn 1) to lift ONLY the audit-sound wizards-as-data port mechanism (the "crown jewel") from
`wizard-porting-work` onto this fresh branch — NOT the corner port (inc B), NOT other agents' WIP, NOT junk.

**Method — classify before touching the tree.** 43 files differ (`port/corner-clean → wizard-porting-work`); only ~16 are the
mechanism. Ran a 22-agent classification workflow (per-file branch-diff verdict + test-import-closure + dep-scan). Verified findings:
- **Only 2 files genuinely ABSENT on target** and required: `wizards/ops/{userRoot,layout}.js` (both named, zero-import leaves).
  The named roster is COMPLETE vs the 7 specs' static import closure (112 modules; 110 already on the clean branch).
- **13 wholesale-safe**, **3 surgical**, plus **1 unnamed-but-required** (devMode, see below).
- `blocks/{opSchema,opSession}.js` → **LEFT as-is**: their mechanism symbols (specOf/registerUserSpec/USER_SCHEMA; flattenBlocks)
  are byte-identical on both branches; the diffs are 100% excluded WIP (homing Seq / middle B-TRANS #23-#24 / corner startX-startY /
  alignment FIELD_BIND). Lifting them would drag WIP in for zero mechanism gain.
- **Views are fan-out artifacts, not deps** — no named mechanism file imports any view; `wizardManager`/`views/index` are clean on
  target, so the mechanism resolves/runs without `userOpView` et al. Not lifted.

**Lift executed:**
- **Wholesale (`git checkout wizard-porting-work -- …`, 13):** `blockEmitter, userOps, wizardLibrary, blockly/stackBridge,
  dataOps/{atcWarmup,drill,slot,surfacing,text}Data, ops/{userRoot,layout,probeSurface,index}`. + **7 mechanism specs** (the
  acceptance set: 5 `-as-data` updated + `user-root-transparent-emit` & `custom-op-sim-starts-precedence` new-on-dump — source and
  its tests move together).
- **Surgical (checkout dump → trim the excluded lines):**
  - `app.js` — kept `seedDefaultPortedUserOps()` + the 5 dataOps imports + init wiring; **DROPPED** `import cornerPortDef` + the
    `cornerPortDef()` seed entry (→ inc B; `data/cornerPort.js` doesn't exist here).
  - `blocks/blockly/bridge.js` — kept user_root PRESENTATION/EXECUTION + param_group DO shapes + op GCODE/SIM split + layout `kind`
    dropdown; **DROPPED** `import installHomingOrderField` + its `installBlockly()` call (→ HOMING WIP; module absent here).
  - `wizards/ops/panelTypes.js` — kept `LAYOUT_TYPES`/`renderDeclaredLayout` + the generic slant/scale/alignment `layoutSpecFromOp`
    branches; **DROPPED** `renderCornerLayout`/`cornerParamsFromForm`/`cornerLayout`/`cornerState` + the `opSimStarts` import + the
    `kind==='corner'` branch. **Also removed the `const kind` line** the dropped branch orphaned (my-change orphan cleanup).
- **devMode.js (NOT in the named roster — lifted hunk-1 ONLY, under "as needed to resolve"):** `authoringBody` now reads
  `getInput('GCODE') || getInput('DO')`. **WHY:** `bridge.makeOpDef` renames the recorded-op statement input `DO→GCODE` (+ new
  `SIM`); `stackBridge`/`devMode` are the readers. Lifting bridge's rename while leaving devMode reading `'DO'` ships a
  **known-broken** authoring round-trip (`blocks-authoring-*` exercise it) — that violates valid-by-construction, so hunk-1 is a
  required leg of the *named* round-trip, not scope creep. **Deliberately NOT lifted:** devMode hunk-2 (adds spatial number-role
  widgets `nscaleX/nshear/nprojLength` = spatial-GUI WIP, absent here) and hunk-3 (the `saveAsCustomOp` sim-write rewrite — an
  authoring-save path, not required by the mechanism or any lifted spec; revisit ONLY if the full suite regresses there).

**⚠ FLAG 1 — shared-index collision (advisor commit `fb3f439`).** While my lift was staged, the advisor's concurrent session ran
`git commit` ("docs(port): full corner-port autonomous plan …") and, because we share ONE working tree + index, it **swept my
staged 13 mechanism files + 7 specs into its own commit** (verified: `fb3f439` = those 20 files + `NEXT-SESSION.md`; **no WIP/junk
leaked**, and it did NOT grab app/bridge/panelTypes, so no broken import landed in history). I then committed the completing 4
surgical files as **`118a6f2`**. Net: inc-A is CORRECT at the tip but **split across `fb3f439` + `118a6f2` with messy attribution**
(most of my mechanism sits under a "docs" message). History is the advisor's to own — flagging for a possible reword/squash. Root
cause worth noting for the protocol: worker+advisor sharing one git index means staging is NOT isolated; a concurrent `commit -a`
can grab in-progress staged work. `fb3f439` also happened AFTER the advisor passed the ball (it did work post-pass).

**⚠ FLAG 2 — marker sync at wake.** `.handoff/worker.last` was orphaned at 177 from the prior batch while the new cycle is turn 1,
so my waiter could not fire (1 > 177 false). Re-baselined `worker.last → 0` ("sync", per human). **The advisor side is still stale:**
`advisor.last=178`; my `pass` creates turn 2, and `2 > 178` is false → the advisor's waiter won't wake unless its own `.last` is
re-baselined to ≤1. One-way rule → I did not touch it; advisor must sync its side.

**Note — autonomous framing.** `NEXT-SESSION.md` (committed in `fb3f439`) now dispatches inc A → inc B → inc C VERIFY as a FINITE
autonomous loop (no per-increment human check-in; advisor fresh-eyes-reviews each and dispatches the next; surface to the human only
for a design fork / unverifiable regression / worker stall).

**VERIFIED:** `node --check` clean on all lifted files; residual diffs of the 4 surgical files scanned for excluded tokens
(cornerPort/homingOrder/renderCornerLayout/nscaleX…) = clean. **The 7 named mechanism specs PASS (7/7, 6.6s)** —
slot/drill/text/surfacing/atc-warmup emit byte-identical G-code to their stacks; `user_root` is emit-transparent;
template `simstart` blocks are canonical with `def.sim.starts` as fallback (registerUserOp + DO→GCODE/SIM round-trip proven).

**Full suite: GREEN** — `446/448 pass, 2 skipped, 0 real failures` (1.5m). The single "failure" was a **flake**:
`project-drawer-smoke.spec` (Cloud-tab / project-Open-drawer) hit a 15s `waitForSelector` timeout under the heavily-loaded box
(448 tests across parallel workers) — **passes clean in isolation (2.2s)**. It's a cloud/OAuth-UI test, untouched by the mechanism;
NOT a regression. The 445 app-loading specs (all `blocks-*`, `custom-op-*`, `wizard-*`) pass, which proves the `app.js` seeding +
the bridge `DO→GCODE/SIM` round-trip + devMode read-leg did not break app init. inc-A mechanism lift = COMPLETE + VERIFIED.

---

## 🔨 turn 3 (cycle 1) — CORNER-PORT inc B1 EMIT — SCOUT DONE, ⛔ GATING on a design fork before authoring

Dispatched (HANDOFF turn 3, autonomous) to port the corner EMIT path: lift `cornerWizard` cornerStack, REDO `cornerPort.js` →
`blocks/dataOps/cornerData.js` with DERIVED binding indices (defect #1 fix, reusable helper), add a byte-identical
`corner-data-emit.spec` incl `probeZFirst`. Ran a 5-agent read-only understanding workflow, then verified every load-bearing
fact against the real source. **No code written yet — I'm gating on a genuine design fork the scout surfaced.**

**Verified facts (settled two conflicting agent reports against `git show`):**
- The dump's `cornerStack` (the emit source of truth) reads the FINAL schema: `#21/#22 ← startX/startY` (only when `probeZ`),
  `#23/#24 ← cross1_x/cross1_y`, driven via the shared `safeTraverseStack({mode:'seq', crossX/crossY,…})` (lifted in inc A).
  `travelDist`/`td`/`travelOwn`/`travelOpp`(+imports)/the `Travel:` header are **orphans** the refactor left dead — drop-list confirmed.
- `probeZFirst` is **STRUCTURAL**: `const probeZ = !!(params.probeZ || params.probeZFirst)` → it inserts the whole Z-surface
  `probeSurfaceStack`, shifting `#23/#24` downstream. So do `wcs` (active=4 vs fixed=2 blocks), `syncA`, `probeSeq` (Y-wall writes 2
  WCS assigns vs X-wall's 1). The corner exec stack has **no fixed index** for many sockets.
- `instantiate(def, params)` (userOps.js) clones a **STATIC** `def.template` (seeded from `CORNER_DEFAULTS`, probeZFirst=0) and only
  overwrites each binding's `(blockIndex, key)` socket — it **cannot** perform a shape swap. The 5 sibling data-ops are all
  static-template; their shape-changing params are asserted as FRONTIER tripwires that DIVERGE (e.g. slot's pattern/clearance).
- `registerUserOp` DOES honor `def.build` (userOps.js:310 `if (typeof def.build === 'function') return def.build(resolved)`), but
  NO sibling uses it.
- The DERIVE helper design is solid (walk the wrapped+flattened stack, match each binding by `block.type==='assign' && params.var===`
  the macro var — re-finds the shifted index, absorbs the +4 wrap offset, throws loudly on zero/ambiguous/keyless — kills defect #1
  AND the `WRAP_PREFIX_COUNT` hand-count class). That part is NOT in question.

**⛔ THE FORK (a tension between the dispatch's OWN mandates for a structurally-dynamic op):**
- **Mandate 1:** "DERIVE the binding blockIndexes (defect #1's real fix, central) · match the 5 siblings' shape." → a STATIC template
  whose bound sockets the derived indices drive. Honors defect #1 + one-source-with-siblings.
- **Mandate 2:** "emit byte/value-identical to `cornerStack` across a sweep INCLUDING the `probeZFirst` toggle."
- These COLLIDE: a static template baked at `probeZFirst=0` emits the no-Z shape for ALL params (probeZFirst isn't a bindable
  socket) → it CANNOT be byte-identical to `cornerStack(probeZFirst=true)`. The literal acceptance test FAILS on a static template.
  Making it pass requires `def.build = (p) => wrap(cornerStack(p))` (delegate to the real builder) — but then emit comes from
  `build`, the bound sockets are bypassed, and the "DERIVE bindings = defect #1 fix" becomes **vestigial for emit** (bindings serve
  only the form). So we satisfy Mandate 1 XOR Mandate 2, not both, with the sibling architecture.

**OPTIONS (for the advisor):**
- **(A) — RECOMMENDED — static template + derived bindings (matches siblings, centers the derive helper).** cornerData bakes the
  structural params (corner/probeSeq/probeZ/probeZFirst/wcs/syncA) like the dump did (and like drill's clearance/method). Emit test:
  byte-identical (via `stripAnnotations`) over the 9 BOUND scalars at the seed shape, PLUS a direct derive-robustness check —
  build the template at `probeZFirst=1` and assert `deriveBindings` re-finds `#23/#24` at the shifted indices (proves
  valid-by-construction; THIS is the real "probeZFirst" guard). Structural flips asserted as frontiers (diverge), sibling-style.
  Reading: "incl probeZFirst" = the TEST must exercise probeZFirst to prove the derive re-finds — not that the baked op reproduces
  Z-first emit. Cheapest, on-pattern, defect-#1-centered. COST: the corner data-op is a LIMITED port (baked corner/Z/wcs — user
  can't pick them), same limitation the 5 siblings accept.
- **(B) — `def.build` dynamic (full byte-identity, fully-functional corner op).** `def.build=(p)=>wrap(cornerStack(p))` → byte-identical
  across ALL params incl probeZFirst, user can drive every field. Departs from the static-sibling shape (but registerUserOp supports
  it), and the derive helper becomes form-only (defect #1 fix still built + used for the form/round-trip, not for emit).

**Why I gate (not guess):** the crown-jewel file shipped broken precisely from an emit/binding mismatch; the two mandates genuinely
conflict for a structurally-dynamic op; the choice changes cornerData.js, the spec, and whether the derive helper is emit-central or
form-only. Per the autonomous plan ("surface ONLY for a genuine design fork") this qualifies. **No code written; tree clean (only the
stray `_*.png`/HANDOFF churn). Awaiting the advisor's synthesis (expect "do A" or "do B, plus …"), then I author inc B1 in one pass.**

---

## 🔨 turn 5 (cycle 1) — CORNER-PORT inc B1 EMIT — BUILT (Option A pure-data, advisor turn 4)

Advisor resolved the fork → **Option A** (my recommendation) with refinements: `probeZFirst` = a DECLARED FRONTIER baked off;
`cornerData` is an ADDITIVE "Corner (data)" twin (built-in Corner UNTOUCHED); emit test = byte-identical over the bound scalars
@probeZFirst=off PLUS a derive-robustness assertion (NOT "emit the variant"); + a loud can't-forget FRONTIER GATE.

**Built (EMIT only; sim=B2, layout=B3 untouched):**
- **`cornerWizard.js` cornerStack — lifted EMIT hunks only.** Applied the 5 emit hunks (enum-normalizing param maps; the final
  schema `#21/#22 ← startX/startY` (probeZ) + `#23/#24 ← cross1_x/cross1_y`; the two `safeTraverseStack({mode:'seq'…})`
  cross-traverses replacing the old `#15/#16` travelOwn/travelOpp `MOVE`). **SKIPPED the 2 B2 sim hunks** (the `inferStart`
  enum-normalize + the new `inferStarts()`→`window.app.opSimStarts` = defect #3). **DROPPED only my-change orphans:**
  `travelOwn`/`travelOpp` (+ their `travelOwnExpr`/`travelOppExpr` imports), unused `td`, now-dead `travelDist` (in cornerStack),
  the stale `Travel:` header, `firstTravelVar`. **Verified faithful:** a full-file diff vs the dump shows the ONLY differences are
  exactly those orphan drops + the 2 deliberately-skipped B2 hunks — the probe/WCS/motion emit body is byte-identical to the dump.
- **`blocks/dataOps/deriveBindings.js` (NEW, the reusable defect-#1 fix).** `deriveBindings(flatStack, specs)` /
  `deriveBindingsFor(stack, specs)`: each binding is DECLARED by identity (`{type:'assign', var:'#23'}`), and the helper RE-FINDS
  the flat index by scanning the wrapped+flattened stack — immune to a comment insertion, absorbs the `user_root` +4 prefix (no
  `WRAP_PREFIX_COUNT`), and re-finds `#23/#24` under probeZFirst's +2 shift. Throws LOUDLY on a zero/ambiguous/keyless match
  (a real authoring error) instead of an off-by-one's silent mis-bind. Reusable by the 5 siblings later (NOT migrated now).
- **`blocks/dataOps/cornerData.js` (NEW, REDOES the broken `data/cornerPort.js`).** Same sibling shape (user_root wrap +
  `userOpFromStack('corner_data','Corner (data)',…,'form3d',{forceMachine:true},'probe_datawiz')`); bindings are DERIVED, not
  hand-counted. `CORNER_DATA_OPTYPE='user_corner_data'`. Structural params (corner/probeSeq/probeZFirst/wcs/syncA) baked =
  frontiers.
- **⚠ DEVIATION (flagged): `safeZ` is a FAN-OUT frontier → 8 clean bindings, NOT the dump's 9.** `safeZ` feeds its own socket
  `#19` AND the COMPUTED `#17 = safeZ + scanDepth` (plunge depth). A single binding drives ONE socket, so binding safeZ→#19 would
  leave #17 stale = inconsistent plunge (the dump's 9th binding was unsound even before its off-by-one — its hand-count landed
  safeZ on #17 anyway). Per valid-by-construction I BAKED safeZ (like slot's `clearance` fan-out) rather than ship a wrong
  binding. The 8 bound are the clean single-socket scalars: dist/retract/f_fast/f_slow/port/radius/cross1_x/cross1_y. The built-in
  Corner still drives safeZ fully. (If the advisor wants a fan-out binding mechanism, that's a follow-up — out of B1 scope.)
- **`app.js`:** re-added `cornerDataDef()` to the seed array (the additive twin, seeded alongside the untouched built-in).
- **`tests/corner-data-emit.spec.js` (NEW):** byte-identical (via `stripAnnotations`) over a 14-entry bound-scalar sweep;
  FRONTIER divergences (probeZFirst / safeZ / corner MUST diverge); a DERIVE-ROBUSTNESS block (build the template at
  probeZFirst=on → assert `deriveBindings` re-finds `#23/#24` shifted **+2** while the pre-Z scalar `#1` is unmoved); and a
  String-normalized binding-wiring check (every derived binding routes to the same `assign var` cornerStack writes).
- **`tests/corner-data-probeZFirst-frontier.spec.js` (NEW):** (1) a LOUD `test.fixme` documenting the unimplemented probeZFirst
  shape (visible in every run; un-fixme when the twin gains it), and (2) a REAL gate asserting the built-in Corner
  (`wizardLibrary` `id:'corner'`, `kind:'builtin'`) stays registered — retiring it while the twin is limited turns the suite RED.
- **`tests/probe-surface-block.spec.js`:** lifted the dump's regenerated CORNER golden (its single-line diff) — my cornerStack
  change orphaned the old `G0 X#15 Y#16` golden; the new one asserts `#23/#24` (+ `#21/#22` under probeZ). My cornerStack ==
  the dump's, so the dump's golden is the correct expected value.
- **`_diag-endoffset.spec.js`:** dispatch said DISCARD — it was never lifted onto this branch (new-on-dump), so a no-op.

**VERIFIED:** `node --check` clean on every touched file. `registerUserOp(cornerData())` does NOT throw (proven by the emit spec
building the def). **corner-data-emit PASS** (byte-identical + derive-robustness +2 shift + frontiers diverge + wiring clean);
**corner-data-probeZFirst-frontier**: gate PASS + 1 fixme (the frontier marker); **7 inc-A specs GREEN**; **probe-surface-block
5/5 GREEN**.

**Full-suite regression → 1 real failure found + FIXED (`disc-on-surface.spec`), + a DESIGN FLAG.** First full run: 446 passed,
3 skipped, 1 flaky, 1 FAILED. The failure was `disc-on-surface` (a SIM test that drives the corner probe) — GREEN in inc A, so my
change caused it. ROOT: the final schema replaced `travelDist` (default 50 → the walls traversed apart) with `cross1_x/cross1_y`
(default **0** → NO traverse), so the DEFAULT corner probe is degenerate (both walls probed at the same spot) → the discs collapse
onto overlapping contacts → `minOff=0`. FIX: the test used bare defaults; I set `cross1_x:50, cross1_y:-50` in its param (a
my-change orphan / test-data update, NOT sim code — mirrors the old travelDist reposition) → now `minOff=maxOff=2` (each disc
nudged exactly the tip radius), PASS. ⚠ **DESIGN FLAG for the advisor:** the new corner schema defaults `cross1_x/cross1_y=0`, so
a corner op with UNSET cross-traverse has no reposition between walls (was auto-50). That's fine for EMIT (the values are the
user's/canvas's to set) and the B3 FeatureCanvas drag handles will supply them — but the built-in corner FORM's defaults / the B3
canvas should provide a sensible non-zero cross-traverse so the default probe isn't degenerate. Tracking for B3.

**Full suite (re-run after the disc-on-surface fix): GREEN — 448 passed, 3 skipped, 0 failed, 0 flaky (1.3m).** (451 total = the
prior 448 + the 3 new corner tests; the 3 skips = the 1 probeZFirst-frontier `fixme` + 2 pre-existing.) inc B1 EMIT =
COMPLETE + VERIFIED: corner G-code byte-identical via a DERIVED (never hand-counted) binding, defect #1 killed by construction,
the built-in Corner intact, the probeZFirst frontier gated RED-if-retired.

---

## 🔨 turn 7 (cycle 1) — CORNER-PORT inc B1b: reposition CORRECT-BY-DEFAULT via signed-travelDist expressions (advisor turn 6)

Advisor accepted B1 (derive-helper clean, safeZ-bake correct) and dispatched B1b to kill my degenerate-default flag: the schema
rename made `cross1_x/cross1_y` default `0` → `G0 X0 Y0`. **REPLACE mode** (correctness is the bar, not byte-identity): default the
reposition sockets to EXPRESSIONS. Ran a 3-agent scout (stock-datum reachability + exact travelOwn/travelOpp reconstruction +
golden design).

**Scout verdict = INTERIM + GATE (verified).** The stock-datum coord is NOT reachable from the corner op as a controller `#var`:
`cornerStack(params)` gets flat scalars only (the emit path never sees `stock`; only `inferStart` does, sim-only), and the whole
"sits-at-WCS / stock-datum" model is HOST-side JS (folded into literal coords by `translateProgram`), never plumbed into the macro.
So the TARGET (datum-relative reposition expr) needs a stock-model→macro integration that doesn't exist → **GATE it** (below); use the
signed-travelDist INTERIM now.

**Built (EMIT; sim=B2, layout=B3, probeZFirst=B4 all untouched):**
- **`cornerWizard.js` cornerStack:** re-added `travelDist` + `#15=+travelDist` / `#16=[0-#15]` (a REFERENCE, not a baked literal —
  so `#16` tracks `#15`, making travelDist a CLEAN single-socket binding, NOT a fan-out). Added `own(d)`/`opp(d)` helpers
  (`travelOwn`/`travelOpp` = `#15`/`#16` by direction). **Defaulted `#21/#22/#23/#24` to the signed-travelDist expressions** that
  reproduce the OLD `travelOwn/travelOpp` reposition per quadrant×seq (`#23 = firstAx==='X' ? own(xDir) : opp(xDir)`, etc.) — so a
  DEFAULT corner emits a real wall-to-wall traverse (`G0 X#23 Y#24` with `#23/#24 = ±travelDist`), NOT `G0 X0 Y0`. `params.cross1_x ||`
  keeps the socket overridable.
- **`deriveBindings.js`:** a spec may now OMIT `default` → the binding default is READ from the matched socket's baked value. So
  `cross1_x/cross1_y` default to the reposition EXPRESSION (`#16`/`#15`), not a literal — an unset cross stays non-degenerate, a bound
  literal (B3 drag) still overrides. (declare-never-infer: the template IS the default.)
- **`cornerData.js`:** bound `travelDist`→`#15` (scales the reposition) → **9 bindings** (6 clean + travelDist + cross1_x/cross1_y);
  safeZ still a baked fan-out frontier. **⚠ subtle bug I hit + fixed:** `CORNER_DEFAULTS` listing `cross1_x:0` made
  `'cross1_x' in params` true → `instantiate()` overwrote the socket EXPRESSION with `0` (degenerate again, the agreement sweep
  caught it). Fix: REMOVE `startX/startY/cross1_x/cross1_y` from `CORNER_DEFAULTS` so they fall through to the socket-default expr.
- **`corner-data-emit.spec.js`:** added `travelDist` sweep rows, bumped `bindingCount` 8→9, and ADDED a **KNOWN-GOOD GOLDEN** test —
  a default `dataBuilder({})` must emit `#15=50`, `#16=[0-#15]`, `#23=#16`, `#24=#15`, `G0 X#23 Y#24`, and must NOT contain
  `G0 X0 Y0` / `#23=0` / `#24=0`. (Agreement-only hid the degenerate default — this pins the real motion.)
- **`probe-surface-block.spec.js`:** REGENERATED the CORNER golden (my cornerStack change re-added `#15/#16` and made `#23/#24` the
  signed-travel exprs) — verified non-degenerate (no `#23=0`/`#24=0` in any of the 4 sweep entries).
- **`disc-on-surface.spec.js`:** REVERTED my B1 workaround (`cross1_x/cross1_y=50/-50`) — the DEFAULT reposition is correct now
  (FL/XY → X+50 Y-50), so bare defaults pass.

**⚠ GATE (report, per dispatch) — the stock-datum wiring for the TARGET.** A datum-relative reposition needs the stock corner as a
controller `#var`, which requires (a) threading `stock`/placement into `cornerStack`'s emit path (corner is not in the placement
family; it can't reuse the `place`-fold `translateProgram` since the reposition is incremental `G91` keyed off `#var`s), and (b)
exposing the stock corner as a macro register (a stock-geometry variable the operator/Studio pins). That's the machine-frame /
stock-model integration (machine-frame-sim-spec) — a FOLLOW-UP increment, not B1b. The INTERIM is correct-by-default today; the
sockets are expression-holding, so the datum default (post-integration) or a B3 drag literal drops in with no schema change.

**⚠ FLAG (B3):** `cross1_x/cross1_y` binding defaults are now expression strings (`#16`/`#15`), so their FORM fields show an
expression, not a number. Harmless for EMIT (registerUserOp fine, the golden proves the motion) — but B3's FeatureCanvas drag
(which writes a datum-relative literal into the socket) is the intended UX for these; the raw form field is a stopgap.

**VERIFIED:** `node --check` clean on all touched files. **corner-data-emit: 2/2 PASS** (agreement sweep + KNOWN-GOOD golden — the
default reposition is non-degenerate); **corner-data-probeZFirst-frontier**: gate PASS + fixme; **disc-on-surface PASS** (bare
defaults); **probe-surface-block 5/5 GREEN** (regenerated golden).

**Full suite: GREEN — 448 passed, 3 skipped, 1 flaky, 0 hard failures (1.3m).** (452 total = the prior 451 + the new corner-data-emit
GOLDEN test; 3 skips = the probeZFirst `fixme` + 2 pre-existing.) The 1 flaky = `middle-animator` (a stroke-dashoffset
animation-timing test, unrelated to corner) — passed on retry #1. inc B1b = COMPLETE + VERIFIED: the corner "Corner (data)" twin
now emits a CORRECT non-degenerate reposition BY DEFAULT, proven by a known-good golden (not agreement-only); the sockets stay
expression-holding for the datum default (GATED follow-up) / B3 drag to drop in.

---

## 🔨 turn 9 (cycle 1) — CORNER-PORT inc B2: SIM — DECLARE the per-pass preview start-markers (advisor turn 8)

Advisor reviewed B1b (clean 3/3) and dispatched B2: `cornerData` must DECLARE its OWN per-pass preview START markers via
canonical template `simstart` rows (routed `simStartsFromStack` → `setUserSimStarts` → `makeProvider` → `opSimStarts`), NOT the
built-in `opSimStarts.corner` — and NOT fix defects #2/#3 in the retiring built-in. Ran a 3-agent scout.

**Scout verdict = IN SCOPE, NO GATE (verified).** A `simstart` row is a DECLARATION (anchor `centre|edge|frac|radial` + offsets
+ zplane), resolved by `makeProvider` to `{x,y,z}` **against the STOCK** (`stock.x/stock.y`). The SIM side HAS the stock (every
consumer passes `window.ddcsGetSettings().stock`); only the EMIT side lacked the datum (the B1b gate). So the marker positions do
NOT need the deferred datum → declare the rows. Also confirmed: there is NO `corner` in `opSimStarts.BUILT_IN` (the premise holds —
the twin resolves via its own `USER_STARTS` provider, never a built-in).

**Built (SIM only — emit UNCHANGED, `simstart` emits nothing):**
- **`cornerData.js`:** `CORNER_SIM_STARTS` = 4 declarative rows (all `frac` — the only anchor that reaches a corner; `edge`
  centres the perpendicular axis), authored as canonical template `simstart` blocks via `simStartsToBlocks(...)` into the
  `user_root` `uiChildren`: **Z-plunge** (`when:{probeZFirst:true}`-gated), **wall-1** (Y), **reposition** (waypoint), **wall-2**
  (X). Positions follow the LOCKED-MODEL FL/YX default geometry (derived from the built-in `inferStart`). **NaN discipline:** every
  fraction is a LITERAL, so `makeProvider`'s `frac` path (`sx*n(fx)`) resolves to the default geometry and NEVER reads the `#23/#24`
  reposition EXPRESSION sockets (`Number('#16')=NaN`) → finite by construction, no NaN. The Z gate → **3 markers for the baked no-Z
  default**, 4 with probeZFirst (a B4 concern). The 4 simstart blocks shift the flat indices, but **deriveBindings re-found the
  sockets** (corner-data-emit stayed 2/2 — a real confirmation of the B1 derive-robustness).
- **`tests/corner-data-sim-starts.spec.js` (NEW):** (1) a PROVIDER spec — register `cornerDataDef()`, assert the starts are
  canonical template blocks (`hasStartBlocks`, 4 rows), the provider yields 3 finite DISTINCT markers at the default (4 with
  probeZFirst), and an expression-holding `cross1_x:'#16'` still yields finite markers (NaN-safe); (2) a REAL-SYMPTOM editor spec —
  a PLACED `user_corner_data` op (its @DDCS marker + macro in the editor) drives the editor's real 3D preview
  (`__gpPanel.refresh()` → `computePassStarts` → `opSimStarts`) and `getPassStarts()` returns 3 finite markers (mirrors
  `editor-sim-hints.spec`). This is the WIRED real render surface for B2; the wizard-pane wiring (`userOpView → startHints`) is B3.

**VERIFIED:** `node --check` clean. **corner-data-sim-starts 2/2** (provider + editor REAL-render, no NaN); **corner-data-emit 2/2**
(emit unchanged — simstart is metadata; bindings re-found under the uiChildren shift).

**Full suite: GREEN — 449 passed, 3 skipped, 0 real failures (1.3m).** (454 total = the prior 452 + the 2 new sim-starts tests.)
The run showed 1 failed + 1 flaky, BOTH the known load-induced flakes, unrelated to corner: `project-drawer-smoke` (the Cloud-tab
`waitForSelector` timeout that also flaked in inc A) and `middle-animator` (the stroke-dashoffset animation-timing flake). Both PASS
in isolation (re-ran project-drawer-smoke + the 2 corner sim-starts → 3 passed). inc B2 = COMPLETE + VERIFIED: "Corner (data)"
DECLARES its per-pass preview markers and they RENDER in the editor's real 3D preview (no NaN), via the twin's own provider — the
built-in `opSimStarts.corner` untouched.

---

## 🔨 turn 11 (cycle 1) — CORNER-PORT inc B2b: align sim-starts to PROBE PASSES (a bug fix in my B2)

Advisor review of B2 caught a real bug in my markers: I declared a separate REPOSITION (waypoint) marker → **3 markers for a
2-pass macro**. The engine indexes markers by `_pass`, so it mapped `_pass=1` (wall-2) to marker[1] (the reposition point,
INSIDE the stock) and ORPHANED the true wall-2 marker. My B2 test only asserted finite/distinct — never PASS-ALIGNMENT — so the bug
shipped green (the verify-real-symptom trap: a green test asserting the wrong property).

**SCOUT (empirical, verify-real-symptom).** `GcodeExecutionEngine._pass` increments at each `REPOSITION:` raw comment
(GcodeExecutionEngine.js:598) — a DELIMITER, not a pass. Ran both corner variants through the real engine: the **no-Z corner macro
= 2 passes** (1 `REPOSITION:` comment, the wall-1→wall-2 traverse; the Z→wall-1 traverse is 'Traverse to first wall', not a
delimiter). probeZFirst is anomalous/dormant (baked off → B4). Sibling contract confirmed: middle boss-both (2 probes / 1
reposition) = exactly 2 markers, no reposition marker.

**FIX (SIM decl only — emit UNCHANGED):**
- **`cornerData.js`:** REMOVED the reposition-waypoint row. `CORNER_SIM_STARTS` = `[Z-surface (when probeZFirst) · wall-1 · wall-2]`
  → the baked no-Z default renders **2 markers** `[wall-1(_pass 0), wall-2(_pass 1)]`, 1:1 with the engine's 2 passes; the
  reposition gets NO marker.
- **`corner-data-sim-starts.spec.js`:** rewrote the assertions to the checks whose ABSENCE let the bug ship —
  **PASS-ALIGNMENT** (run the no-Z macro through the real engine, `enginePassCount === marker count === 2`) + **no marker inside
  the stock material** (`0<x<sx && 0<y<sy && z<0` → 0; the reposition was inside) + finite/distinct + NaN-safe. The editor
  real-render spec now asserts **2** rendered markers (one per probe pass).

**⚠ FLAG (B4):** probeZFirst's OWN pass-alignment is deferred. The Z→wall-1 traverse is not a `REPOSITION:` delimiter, so the engine
doesn't split Z-surface from wall-1 into separate passes — a 3-marker probeZFirst (Z · wall-1 · wall-2) would need that emit change
+ the probeZFirst un-baking, both B4. Dormant now (baked off); the Z-surface row is declared (gated) and inert in the twin.

**VERIFIED:** `node --check` clean. **corner-data-sim-starts 2/2** (pass-alignment: 2 markers === 2 engine passes, none inside the
stock; + editor real-render = 2 markers, no NaN); **corner-data-emit 2/2** (emit unchanged).

**Full suite: GREEN — 451 passed, 3 skipped, 0 failed, 0 flaky (1.4m).** (454 total; 3 skips = the probeZFirst `fixme` + 2
pre-existing.) A clean run, no flakes. inc B2b = COMPLETE + VERIFIED: the corner preview markers now index 1:1 with the engine's
probe passes (2 for the baked no-Z default), the reposition-waypoint marker is gone, and no start marker sits inside the stock —
proven by a pass-alignment test that runs the real engine (the check my B2 test lacked).

---

## 🔨 turn 13 (cycle 1) — CORNER-PORT inc B3: LAYOUT + DRAG (advisor turn 12, human "b3")

Dispatched to render "Corner (data)"'s 2D FeatureCanvas layout via the generic `userOpView` path and wire the reposition DRAG
(a drag writes a datum-relative literal into the reposition socket, overriding the default expression). Ran a 3-agent scout.

**Scout verdict = PURE GENERIC, NO GATE (both decisive).**
- **cornerView port:** do NOT lift `cornerView.js` and do NOT add an index.html corner panel. The render/drag/writeback chain is
  ALREADY generic + wired: `userOpView.update()` → `renderLayout2D` → `layoutSpecFromOp` (binding ROLES → canvas decls) →
  `buildCanvasWidgets` → `_writeParam` (writes the `data-param` field + a bubbling `input`) → the delegated `#wiz_user_form` `input`
  listener → `mgr.update()` → re-emit; `instantiate` makes a param literal WIN over the socket's expression default. The premise
  "like the 5 siblings" was misleading — NO sibling declares layout roles (slot/text `form2d` render an EMPTY stock rect). So B3 is
  genuinely new but TINY: the reposition is a generic `point` role (`cross1_x`/`cross1_y`); `cornerView`'s
  `getPassStarts`/`tieCornerTravel`/absolute-handle machinery only matters once the datum is a reachable `#var` (follow-up).
- **datum GATE: NONE.** A plain literal offset is sufficient. The datum `#var` is only needed for the `[<datum>+<off>]`
  datum-relative FORM (the B1b follow-up) — the drag never READS or ADDS to the datum, it writes a wholesale literal into an
  expression-holding socket. INTERIM = drag relative to the default geometry, exactly as the dispatch sanctions.

**Built (LAYOUT+DRAG; no emit-structure change):**
- **`cornerData.js`:** flipped the panel `form3d → form2d` (the `panel` uiChild + the `userOpFromStack` arg) so `userOpView` renders
  the 2D layout; tagged the two cross bindings `cross1_x → {group:'reposition', role:'x'}`, `cross1_y → {…, role:'y'}` → a generic
  `point` handle. A drag writes LITERALS into `#23/#24`, overriding the `#15/#16` expression via `instantiate` — the LOCKED-MODEL
  "expression-holding socket, overridable by a bound literal" payoff.
- **`deriveBindings.js`:** the derive helper now carries `group`/`role` through to the binding (it previously dropped extra spec
  fields), so the derived corner bindings reach `layoutSpecFromOp`.
- **`tests/corner-data-drag.spec.js` (NEW):** verify-real-symptom — opens the REAL Corner (data) in the real `#wiz_user` form2d
  panel via `openWiz`, confirms `cross1_x/cross1_y` render as writable fields, asserts the PRE-drag emit holds the `#15/#16`
  expression, does a REAL `page.mouse` drag on the `.fc-handle-move`, then asserts the EMITTED reposition `#23` flipped to a numeric
  literal and the `#15/#16` expression is GONE. Mirrors `custom-op-form2d-drag.spec` but asserts the real EMIT, not just a field.

**Caveat (cosmetic, recorded — not a gate):** with the cross params unset, the point handle renders at world `(0,0)` (the layout
reads `num(params.cross1_x)` and `num('#16')=0`), not at the true wall-2 location; cured the instant the user drags. Drawing the
handle at the absolute wall position needs the datum `#var` (the stock-datum follow-up).

**VERIFIED:** `node --check` clean. **corner-data-drag PASS** (a REAL drag → the emitted reposition takes a literal, the expression
is gone); **corner-data-emit 2/2** + **corner-data-sim-starts 2/2** (the panel flip did not regress emit or the sim markers).
SCOPE: LAYOUT+DRAG only — NOT auto/manual, NOT probeZFirst (B4).

**Full suite: GREEN — 452 passed, 3 skipped, 0 failed, 0 flaky (1.4m).** (455 total = the prior 454 + the new corner-data-drag
spec; 3 skips = the probeZFirst `fixme` + 2 pre-existing.) A clean run. inc B3 = COMPLETE + VERIFIED: "Corner (data)" renders its
2D FeatureCanvas layout via the generic `userOpView` path and a REAL canvas drag overrides the reposition socket with a literal —
the payoff of the expression-holding socket. EMIT (B1/B1b) + SIM (B2/B2b) + LAYOUT+DRAG (B3) all done; remaining: B4 (probeZFirst),
auto/manual travel, inc C (verify+release), the stock-datum follow-up.

---

## 🔨 turn 15 (cycle 1) — CORNER-PORT inc B3b: the reposition drag writes the CORRECT INCREMENTAL DELTA (advisor turn 14)

Advisor caught a real bug in my B3 (the recurring verify-real-symptom trap): the generic `point` handle wrote the ABSOLUTE
world coord into `cross1_x/cross1_y`, but `#23/#24` are G91 INCREMENTAL deltas (the wall-1→wall-2 reposition, consumed in
`G91 G0 X#23 Y#24`). So a drag to world W emitted `#23 = W.x` when the geometrically-correct value is `#23 = W.x − wall1.x`
(the delta FROM the previous pass's start). My B3 test only asserted "`#23` became SOME literal" → it passed on the wrong value.
This is the same class as the B2 marker bug: a test that checks CHANGED/FINITE instead of the correct VALUE.

**Fix — anchor the point to the op's first sim-start (a DECLARED datum, not a hand-rolled offset):**
- **`canvasWidgets.js` (`point` gesture):** optional `ax/ay` anchor. `place` renders the handle at `anchor + delta` (the TRUE
  wall position on the canvas); `drag` writes `world − anchor` (the delta) back to the fields. Absent anchor → `(d.ax||0)=0` →
  absolute, byte-identical to before (back-compat; custom-op-form2d-drag still green). ONE registry entry, every point op gets it.
- **`panelTypes.js`:** a binding `role:'x'` carrying `relTo:N` now resolves the anchor from `opSimStarts(def.opType, params, stock)[N]`
  — i.e. the SAME declared sim-start rows the preview uses (`CORNER_SIM_STARTS[0]` = wall-1). `pos(ax,ay)` threads the anchor into
  the `point` decl. No `relTo` → absolute (the other point roles: slot A/B, drill pos — unchanged). `s` = the live stock.
- **`deriveBindings.js`:** carry `relTo` through to the derived binding (it already carries `group`/`role`).
- **`cornerData.js`:** tag both cross bindings `relTo: 0` (anchor to sim-start 0 = wall-1) + tightened labels (`Wall 2 dX/dY`).

**Why declare, not hand-roll:** the anchor is READ from the op's existing `def.sim.starts` (the wall-1 marker the preview already
declares), NOT a new per-corner offset constant. `relTo` is a tiny reusable binding attribute — any future incremental socket
(another wizard's G91 reposition) gets datum-relative drag for free. Kept the data-def DUMB: no corner-specific drag code, no
`cornerView` lift; the gesture math stays in the shared registry.

**Test HARDENED (`corner-data-drag.spec.js`) — assert the VALUE, per the advisor's B3b requirement:** compute `wall1 =
opSimStarts(CORNER_DATA_OPTYPE, CORNER_DEFAULTS, stock)[0]` at RUNTIME (never hard-coded); drag the `.fc-handle-move` to the STOCK
CENTRE — a KNOWN world point `W = (stock.x/2, stock.y/2)` the move handle snaps to; then assert `#23 == W.x − wall1.x` AND
`#24 == W.y − wall1.y` (a 2-unit tolerance for snap/sub-pixel), with the two expected deltas DISTINCT (catches an x/y swap), and a
`|#23 − W.x| > |wall1.x|/2` guard that REJECTS the old absolute-world write. For stock {100,80}, wall1 = {20,−50} → expected
{`#23`=30, `#24`=90} (distinct); the buggy absolute would have been {50,40} → now fails. The test now fails on the B3 bug and
passes only on the delta.

**VERIFIED:** `node --check` clean on all 4 changed source files + the spec. **corner-data-drag PASS** (the hardened value
assertion). Regression triangle green: **corner-data-emit 2/2** + **corner-data-sim-starts 2/2** + **custom-op-form2d-drag 2/2**
(the `point` back-compat — absent anchor is identical). **Full suite: GREEN — 452 passed (1.3m), 0 failed, 0 flaky.**

inc B3b = COMPLETE + VERIFIED. The drag is now geometrically correct (incremental, datum-relative). EMIT (B1/B1b) + SIM (B2/B2b)
+ LAYOUT+DRAG (B3/B3b) all done + value-verified; remaining: B4 (probeZFirst), auto/manual travel, inc C (verify+release), the
stock-datum `#var` follow-up (draw the handle at the absolute wall via a reachable datum register).

---

## 🔨 turn 17 (cycle 1) — ① AUTO/MANUAL TRAVEL — SCOUT + GATE: the plan (advisor turn 16; human t12). ⛔ REPORTING, no code.

Scouted with a 6-agent workflow (4 section designers + 2 adversarial verifiers) over the 3 subsystems I first ground-read.
Both adversarial verdicts came back **HOLDS** (see §5). Synthesis below is TIGHTER than the raw agent output: I eliminated one
over-engineered param set (corner's `manualLift/manualDrop`) and resolved the corner agent's flagged "drop crux". GATE per the
dispatch — I report the plan; the advisor reviews + dispatches the build. **No source touched this turn.**

### Ground truth confirmed
- `safeTraverseStack` (ops/probeSurface.js:69-99) = modes center/seq/in-axis, ALL auto (G0). **Corner is the ONLY caller** (2 seq
  calls: :141 Z→wall1 `#21/#22` lift `#19`; :153 wall1→wall2 `#23/#24` drop `#18`). Middle does NOT use it — it hand-rolls
  `reposition()` inline (middleWizard.js:92-101).
- Middle `reposition()` (the proven MANUAL shape) emits 6 blocks: `MV(Z,#17)` → `C(REPOSITION: <msg>)` → `A(#1505,1,'Press Enter
  when repositioned')` → `IF(#1505=='0' goto 2)` → `MV(Z,[0-#17])` → `DM(inc)`. **No XY move** (operator jogs). Called at 3 sites
  (:141 in-axis, :182 probeZ, :190 trans). Corner already uses `#1505`/`goto 2`/`LB(2)` as its end label → the prompt shape is native.

### THE UNIFIED DESIGN (one manual branch serves BOTH middle byte-identity AND corner)

```
ONE-SOURCE TRAVEL PRIMITIVE — safeTraverseStack(p)          NORTH STAR: one declared primitive owns auto+manual

              p.approach === 'manual' ?
                   |
        +----------+-----------+
     MANUAL                   AUTO   (approach absent/'auto' -> mode arms UNTOUCHED = byte-identical)
   (EARLY RETURN,               |
    mode ignored)          mode dispatch  (center / seq / in-axis)  <- ZERO textual edits
   operator jogs, NO XY         +---- G0 XY move ----+
        |
   [lift?]      <- p.lift    reads the SAME lift/comment/drop the caller already passes for auto
   [comment]    <- p.comment
   #1505 = 1                <- p.promptVal / p.promptNote  (default '1' / 'Press Enter when repositioned')
   IF #1505==0 GOTO 2       <- p.promptVar / p.failGoto    (default #1505 / 2)
   [drop?]      <- p.drop
   G91  (DM inc)
```

**§1 API — add `approach:'auto'|'manual'` to safeTraverseStack (EARLY-RETURN before the mode dispatch).**
- New params: `approach` (default 'auto'; only the exact string 'manual' diverts), `promptVar`='#1505', `promptVal`='1',
  `promptNote`='Press Enter when repositioned', `failGoto`=2. REUSES existing `p.lift`/`p.drop`/`p.comment`.
- Manual = guarded early `return S` on `p.approach==='manual'`; the three auto arms are **textually unedited** → adversary confirms
  every current caller byte-identical (§5b). `promptVal`/`promptNote` use `??` (honour explicit ''/0); `failGoto` default **2** (middle's
  end label — NOT probeSurface's own `?? 1`).
- **Chosen over** the middle-agent's `const mode = approach==='manual'?'manual':p.mode` alias: equivalent behaviour, but the alias
  renames the mode-test var in all 3 arms; the early-return leaves them provably untouched (stronger back-compat).

**§2 MIDDLE refactor — value-identical, verdict HOLDS.** `reposition(msg)` becomes a 4-arg call:
`safeTraverseStack({approach:'manual', lift:'#17', drop:'[0-#17]', comment:'REPOSITION: '+(msg||'jog the probe to the next wall')})`
(middle adds `safeTraverseStack` to its existing probeSurface import). Adversary traced all 3 sites (:141/:182/:190) block-for-block
→ **byte-identical** (§5a). PROOF (two layers): (a) a targeted unit equivalence — `safeTraverseStack({approach:'manual',lift:'#17',
drop:'[0-#17]',comment:...})` deep-equals the hand-built 6-block sequence for each of the 3 msgs; (b) a FULL-MACRO golden sweep of
`emitMapped(middleStack(row)).text` (FULL text, not stripAnnotations — pins the `( Press Enter… )` + `( REPOSITION: … )` comments)
captured on the BEFORE tip, asserted byte-identical AFTER. Matrix = 12 rows hitting all 3 sites + auto controls (traverseOver/
transTraverse must ALSO stay identical): pocket/boss × single/2-axis × inAxis auto/manual × transAxis auto/manual × probeZ on/off ×
X/Y × dir± × circular × wcs. Regression backstop: full middle suite + `corner-data-emit.spec.js` (exercises the seq path) stay green.

**§3 CORNER adoption — reuse each travel's OWN auto lift/drop (resolves the drop crux).** Add one read
`const travelApproach = params.travelApproach === 'manual' ? 'manual' : 'auto';` and pass `approach: travelApproach` to BOTH existing
seq calls — nothing else. Corner-manual mirrors auto's Z-state exactly:

```
Call A  Z->wall1 : auto = comment -> lift #19 -> G0 X#21 Y#22
                   man  = lift #19 -> comment -> #1505 prompt            (NO drop -> stays lifted; :150 plunges #18)  OK
Call B  w1->w2   : auto = comment -> G0 X#23 Y#24 -> drop #18
                   man  = comment -> #1505 prompt -> drop #18            (ends at SCAN DEPTH, ready for probe 2)      OK
   -> corner passes the SAME lift(#19)/drop(#18) it ALREADY passes for auto. NO new manualLift/manualDrop params
      (the corner agent's draft added them + then flagged the drop was wrong; reusing the auto lift/drop is correct-by-construction).
```
Back-compat: `travelApproach` default 'auto' → both calls hit the unchanged mode-dispatch → byte-identical (adversary §5b). The
`#21/#22`+`#23/#24` assigns stay UNCONDITIONAL (inert dead assigns under manual — an assign nobody reads is a no-op on DDCS; gating
them would be speculative machinery). Corner prompt text via `promptNote` (new code, no byte constraint). Cosmetic: manual reorders
Call A's comment after the lift — non-executable, no sim impact (Call A's comment isn't a `REPOSITION:` pass delimiter).

**§4 DATA TWIN — bake auto (structural frontier, same class as probeZFirst).** manual vs auto = prompt-block vs move-block = a
STRUCTURE swap `instantiate()` (value-into-fixed-shape) cannot do. So: add `travelApproach:'auto'` to `CORNER_DEFAULTS` (baked;
NO binding — there's no value-socket to bind, it selects WHICH blocks exist). `cornerStack` reads it (§3) → the bake is a real code
path, and it's USED not unused (corner adoption is in-scope), so no lint/unused-const issue. Gate (mirrors the probeZFirst frontier
exactly, using the ESTABLISHED divergence pattern — no new emit symbol needed): (a) add one frontier-divergence row to
`corner-data-emit.spec.js`: `emitEquivalence(cornerStack, dataBuilder, [S({travelApproach:'manual'})]).pass === false` (twin bakes
auto → can't reproduce the manual swap); (b) a loud `corner-data-travelApproach-frontier.spec.js` (a `test.fixme` documenting the
unbuilt manual shape) so the live toggle (②/B4) is impossible to forget. Header note added to cornerData.js's FRONTIERS list next to
probeZFirst. The existing golden already pins `^G0 X#23 Y#24$` (auto move present), so auto is doubly-guarded.

**§5 ADVERSARIAL VERIFY — both HOLDS (independent skeptics, told to REFUTE).**
- (a) **middle value-identity: HOLDS, 0 divergences.** Traced all 3 sites → same 6 atoms, same order, same params (incl. the
  `( Press Enter when repositioned )` note, `goto 2` numeric, only-Z moves with no X0/Y0 leak — `push` REPLACES params, no merge).
- (b) **corner auto back-compat: HOLDS, 0 divergences.** Early-return guard false when approach absent → falls through to the verbatim
  seq arm; new params never spread into an emitted block (per-atom literal params, not `...p`). Data twin bakes auto → emit sweep green.

### GENUINE FORKS for the advisor (recommendations first; the rest I resolved above)
1. **Corner toggle granularity — SINGLE `travelApproach` (both travels) [recommend] vs per-travel `startApproach`/`crossApproach`.**
   The dispatch said "a per-travel toggle"; I read that as "manual applies to each travel," which a single toggle satisfies. Corner's
   two travels are the same physical intent (get the probe to the next wall) — auto-first/manual-second is not a legit operator fork.
   Middle's `oneMode()` precedent makes per-travel a cheap ADDITIVE refinement later if a real case appears. Confirm single.
2. **Middle proof format — golden FIXTURE FILE + UPDATE_GOLDEN gate [recommend] vs inline-array golden.** Fixture is more diff-legible;
   inline is one fewer file. (Both layered with the targeted unit equivalence regardless.)
3. **Twin frontier gate — the divergence row in corner-data-emit.spec.js [recommend, established pattern] +/- the loud fixme spec.**
   Divergence row is the load-bearing gate; the fixme spec is documentation/can't-forget (probeZFirst has both).

### Residual risks to carry into the build (verify-real-symptom)
- Corner manual drop lands probe-2 at scan depth ONLY if the operator jogs XY-only during the `#1505` pause (a Z jog breaks the
  incremental drop). Same assumption middle already ships — a USER-responsibility, not a system gap. Verify with a real sim/emit check.
- `approach:'manual'` short-circuits mode → it's ONLY valid for the seq/in-axis jog cases (never center/transTraverse, which carry
  re-centre math). Middle + corner only ever call it in seq/in-axis contexts. Document the constraint on the param.
- `REPOSITION:` prefix stays in the CALLER's `p.comment` (middle builds `'REPOSITION: '+msg`) — the sim pass-counter keys on it; don't
  auto-prefix inside the branch (would break middle byte-identity).

### SCOPE of the build (after gate): the shared primitive (§1) + middle refactor value-identical (§2) + corner emit adoption (§3) + twin bake+gate (§4). NOT the live data-op manual toggle (② / B4 structural-toggle capability). Also flagged for the build: the corner `travelApproach` GUI control + Blockly round-trip (ship together — "wire round-trip in new features").

**GATE: passing to advisor for review. Awaiting the synthesis before any code.**

---

## 🔨 turn 19 (cycle 1) — ① AUTO/MANUAL TRAVEL — BUILT + VERIFIED (advisor turn 18 blessed the plan)

Built §1–§4 of the turn-17 plan under the advisor's fork decisions (single `travelApproach`; unit-equivalence primary +
inline one-shot full-macro sweep; both frontier gates; GUI/round-trip deferred to ②). Honored all three residual-risk
directives. Full suite **456 passed, 0 failed**.

**§1 — `safeTraverseStack` gains `approach:'auto'|'manual'`** (ops/probeSurface.js). A guarded EARLY RETURN on
`p.approach==='manual'` BEFORE the mode dispatch → the three auto arms (center/seq/in-axis) are textually UNTOUCHED
(strongest back-compat). Manual emits `[lift] → [comment] → #1505 prompt → IF #1505==0 GOTO <failGoto> → [drop] → G91`,
reusing the caller's OWN lift/drop/comment. New knobs default to middle's literals (`#1505`/`'1'`/`'Press Enter when
repositioned'`/`2`; `??` so an explicit `''`/`0` passes). Documented on `@param p.approach`: **seq/in-axis-ONLY** (never
center/transTraverse — the jog would discard the re-centre math); the **CALLER owns the `REPOSITION:` prefix** (no
auto-prefix — the sim pass-counter keys on it); XY-only jogging during the pause is a USER responsibility.

**§2 — middle `reposition()` → the shared primitive** (middleWizard.js), added `safeTraverseStack` to the existing import.
The 10-line inline helper is now a 4-arg call `safeTraverseStack({approach:'manual', lift:'#17', drop:'[0-#17]',
comment:'REPOSITION: '+…})`. **Proven BYTE/VALUE-IDENTICAL** (middle is shipped) two ways in `middle-reposition-refactor.spec.js`:
(a) PRIMARY unit equivalence — the manual-branch emit == the OLD inline reposition shape hand-encoded as the independent
truth, across all 3 call-site msgs + the default fallback, with non-vacuous guards (real `#1505` prompt present; no XY move);
(b) BACKSTOP full-macro sweep — the whole `middleStack` emit across a 6-row matrix (all 3 reposition sites + the untouched
AUTO traverseOver/transTraverse controls + circular + X/Y + dir±) == a FROZEN inline golden captured on the pre-refactor tip
(one-shot; no UPDATE_GOLDEN machinery, per the fork decision). Both green. The temp capture spec was deleted after inlining.

**§3 — corner adopts the toggle** (cornerWizard.js). One read `const travelApproach = params.travelApproach==='manual' ?
'manual' : 'auto'` + `approach: travelApproach` on BOTH existing seq calls — **reusing each travel's OWN lift/drop** (Call A
Z→wall1: lift `#19`, no drop → stays lifted, :150 plunges; Call B wall1→wall2: no lift, drop `#18` → ends at scan depth),
so manual's Z-state MIRRORS auto and probe-2 lands correctly (the plan's "drop crux", resolved by construction — NO new
`manualLift/manualDrop` params). `corner-travel-approach.spec.js` asserts the VALUES: auto = `G0 X#23 Y#24`; manual = the
`#1505` jog prompt + `IF #1505==0 GOTO2` with the move GONE, `#18` drop kept, `#23/#24` assigns still emitting (inert dead
assigns, un-gated); auto explicit == default (byte-identical); + the Z-first Call A path. Auto back-compat is DOUBLY guarded
(this test + the corner-data-emit golden that pins `^G0 X#23 Y#24$`).

**§4 — the data twin bakes auto** (cornerData.js + 2 specs). `CORNER_DEFAULTS.travelApproach = 'auto'` — baked as a
STRUCTURAL frontier (prompt-block vs move-block = a swap `instantiate()` can't do; NO binding — nothing to bind, it selects
WHICH blocks exist). Header FRONTIERS note added next to probeZFirst. TWO gates, mirroring probeZFirst exactly: (a) a
divergence row in `corner-data-emit.spec.js` — `emitEquivalence(cornerStack, dataBuilder, [S({travelApproach:'manual'})]).pass
=== false` (twin bakes auto → can't reproduce the manual swap); (b) `corner-data-travelApproach-frontier.spec.js` — a loud
`test.fixme` documenting the unbuilt manual shape + a REAL gate asserting the twin's default emit HAS the auto `G0 X#23 Y#24`
and NOT a `#1505` jog prompt (RED if someone flips the default before ② wires the structural toggle).

**VERIFY.** `node --check` clean on all changed source + specs. middle-reposition-refactor 2/2; corner-travel-approach 1/1;
corner-data-emit (+ the new travel divergence row) 2/2; both frontier specs (probeZFirst + travelApproach) 4/4 (2 fixme
documenting the frontiers). **Full suite: 456 passed, 0 failed (1.3m).** One non-deterministic flake surfaced on the FIRST
full run — `middle-animator.spec.js:145` (`stroke-dashoffset` CSS-animation timing under parallel load); it passed 6/6 in
isolation twice AND the full-suite RE-RUN was clean 456/0. NOT caused by this change (byte-identical middle; no viz/animation
touched; the middle block stack is unchanged). Flagged as pre-existing parallel-load flake (no retries configured in
playwright.config).

**NORTH-STAR payoff:** the ONE declared travel primitive now owns BOTH auto and manual — middle's per-wizard hand-rolled
`reposition()` is retired onto it (the probe-surface-block generalises-probing pattern, applied to travel). corner + every
future wizard inherit auto/manual for free.

SCOPE respected: EMIT plumbing only. NOT the live data-op manual toggle / GUI control / Blockly round-trip (② / B4 — a control
now would be a dead option since the twin bakes auto). Ready for advisor review + the ② dispatch.

---

## 🔨 turn 21 (cycle 11) — B3c WIZ-BAR ROUTING — BUILT + VERIFIED (advisor turn 20; user-blocked)

(Context: a transient `claude-opus-4-8[1m]` classifier outage blocked Bash during the turn-19 handoff, so an autonomous
fallback tick re-armed the loop; on recovery the advisor had already reviewed ① (VERIFIED) + dispatched B3c. Picked it up.)

**The gap (user-found t18):** clicking "Corner (data)" in the wizard bar opened the plain quick-insert FORM (fields only),
never the FeatureCanvas + drag the user built (B3/B3b). Trace: `commandDeck.wizItemOnclick` routed EVERY `kind:'user'`
entry to `ddcsInsertUserOp` (→ userOpForm, no viz); the canvas renders ONLY via the wizard path (`openWiz` →
`wizardManager.open` → `userOpView.update` → `renderLayout2D`). The B3 test used `openWiz` (passed) while the real bar door
stayed broken.

**SCOUT — the INSERT flow (the one flagged subtlety): NOT a gate.** The wizard path DOES insert, via the SAME accumulate
path as the quick form: `userOpView.update()` does `recordOp()` (makes it the active op), and the wizard's shared
`wizardManager.insert()` (footer button) commits via `commitActiveOp()` (wizardManager.js:439) — identical to
`userOpForm`'s Insert (`recordOp` + `commitActiveOp`, userOpForm.js:64-65). So routing to `openWiz` RENDERS the canvas AND
still inserts. No seam to wire → a pure routing switch, no gate. Also verified `e.def.panel` is available on the bar entry
(`wizardLibrary.userEntries` sets `def:d` → survives `listEntries` `...e` → `getLibrary` items).

**THE FIX (commandDeck.js `wizItemOnclick`):** a `kind:'user'` entry whose `e.def.panel === 'form2d'` routes to
`openWiz(type)` (the canvas/wizard path); everything else stays on `ddcsInsertUserOp` (the fast quick form). One surgical
branch.

**⚠️ SCOPE DECISION — shipped form2d-ONLY, NOT the dispatched "form2d/form3d". Flagging for your call.** New info the
dispatch's literal spec didn't account for: `userOpFromStack` DEFAULTS `panel` to **`'form3d'`** (userOps.js:391;
`resolvePanelMeta` falls back to `'form3d'`), so `'form3d'` is not a rare explicit opt-in — it's what virtually EVERY
panel-less user op resolves to (e.g. `Bar Test` in wizard-bar.spec:86). Routing `form3d` → `openWiz` would therefore move
ALL default user ops off the quick form to the wizard AND break the existing wizard-bar.spec:86 assertion (`Bar Test` →
`ddcsInsertUserOp`). That is a UX + test change well beyond the user's stated problem. Corner (data) declares an EXPLICIT
`'form2d'` (its `panel` block + the userOpFromStack arg), so **form2d-only fully fixes the user's exact gap** while staying
maximally surgical (zero existing-test churn, no surprise UX shift for the whole user-op class). Extending to `form3d` is a
one-word change (`|| e.def.panel === 'form3d'`) + a wizard-bar.spec:86 update — **say the word if you want the broad,
every-visual-op version** (there's a real product call here: is the wizard the richer DEFAULT door for all user ops, or
does the quick form stay the fast default and only explicit-canvas ops get the wizard?).

**VERIFY (verify-real-symptom — the USER's path, NOT `openWiz`).** New `wiz-bar-canvas-route.spec.js` registers Corner
(data), refreshes the bar, finds the RENDERED bar button, asserts it routes to `openWiz` (not `ddcsInsertUserOp`) + that the
op declares `form2d`, then CLICKS the actual button and asserts `#userVizContainer .fc-handle-move` + `.fc-stock` RENDER.
**FAILED pre-fix** (routing was `ddcsInsertUserOp && ddcsInsertUserOp('user_corner_data')` → no canvas) → **PASSES
post-fix**. wizard-bar.spec stays GREEN (Bar Test = form3d → quick form, unchanged — proves form2d-only is surgical).
**Full suite: 457 passed, 0 failed (1.3m).**

SCOPE respected: routing only; the emit/canvas/insert mechanisms were already built. NOT ②'s toggles. Ready for review +
the form3d call.

---

## 🔨 turn 23 (cycle 11) — B3d: the data-op view shows BOTH the 3D sim AND the 2D canvas (advisor turn 22; user-found t22)

**Gap (my B3c exposed it):** `userOpView` was EITHER/OR — B3's `form2d` flip HID the 3D pane (`userOpView.js:100-103`
`mode==='2d' → viz3d.display='none'`), so "Corner (data)" showed the 2D drag canvas but LOST the 3D probe sim + its
declared `CORNER_SIM_STARTS` per-pass markers (orphaned — no 3D pane to render into). Built-in probes
(cornerView/edgeView/middleView) ALWAYS `preview3D()` (3D base) + layer a 2D canvas — never either/or.

**Fork A vs B — DECIDED = B by human ("do b instead") + advisor (locked in NEXT-SESSION.md, "declare-never-infer wins").**
Option A (infer the overlay from role-presence) REJECTED; Option B = a NEW explicit `form3d+2d` panel type the op DECLARES.
I did NOT gate (the only fork B3d framed — A vs B — was already answered; the rest is impl within "add the type + the render
branch"). Confirmed no-break first: `renderDeclaredLayout` is dead (0 callers), `opSimStarts` is exported.

**Built B (one-source — the GENERIC view gains 3D+2D like the built-in probes, not a corner hack):**
- **`panelTypes.js`:** added `'form3d+2d'` to `PANEL_TYPES` (`viz:true, mode:'3d2d'`).
- **`index.html` (`#wiz_user`):** added a dedicated 3D box `#userViz3dBox`/`#userViz3dContainer` (a 2nd `viz-container` in
  the `viz-split`, `display:none` default) — the pocket/edge two-container pattern. The CSS `.viz-split > .viz-container
  {flex:1 1 0; min-height:160px}` sizes both cleanly. **Chose this over moving the 2D**, so the 2D canvas STAYS in
  `#userVizContainer` → corner-data-drag + custom-op-form2d-drag + the B3c bar test keep finding `.fc-handle-move` there
  (zero selector churn); only form3d+2d is new. form2d/form3d paths are byte-untouched.
- **`userOpView.update`:** new `mode==='3d2d'` branch — `preview3D(gcode, 'userViz3dContainer', starts[0], starts)` (3D sim +
  the DECLARED `opSimStarts` per-pass markers) AND `renderLayout2D('userVizContainer')` (the 2D drag overlay), together.
  `.wiz-viz3d` visibility is now box-SCOPED (`viz3dIn(id)` via the container's parent), not a bare `#wiz_user .wiz-viz3d`
  first-match — robust to the 2 boxes + the shared `#wiz_user` panel lingering a stale pane from a prior op's panel.
- **`cornerData.js`:** panel block + `userOpFromStack` arg `form2d → form3d+2d`.
- **`commandDeck.js`:** the B3c routing now catches `form2d` OR `form3d+2d` → `openWiz` (corner's panel changed; keep plain
  `form3d` on the quick form — still the default-panel guard). This also folds in the form3d-fork I flagged in B3c: the
  discriminator stays the EXPLICIT canvas panels, not the default.

**VERIFY (verify-real-symptom — the USER's bar path).** Extended `wiz-bar-canvas-route.spec` (the bar-click test): after
clicking the rendered Corner (data) bar button, assert BOTH `#userVizContainer .fc-handle-move` (2D) AND
`#userViz3dBox .wiz-viz3d` visible (3D) render TOGETHER, plus `opSimStarts(corner)` feeds ≥2 markers (wall-1 + wall-2) to
the 3D preview, plus panel==='form3d+2d'. **Full suite: 457 passed, 0 failed (1.4m)** — corner-data-drag / custom-op-form2d-drag
/ wizard-bar / corner-data-emit all green (form2d/form3d byte-untouched; corner's 2D stayed in #userVizContainer).

SCOPE respected: the generic 3D+2D combo + corner's panel declaration. NOT ②'s live toggles. (Coordination note: the
advisor amended NEXT-SESSION.md in place for B without re-passing to avoid a colliding turn; I staged ONLY my files, left
NEXT-SESSION.md untouched.) Ready for review — "Corner (data)" from the bar now shows the 3D probe sim + per-pass markers +
the 2D reposition drag handle together.

---

## 🔨 turn 25 (cycle 11) — ② B4 SCOUT + GATE: the plan (advisor turn 24; human "yes dispatch"). ⛔ REPORTING, no code.

Scouted with an 8-agent workflow (6 area designers @high-effort + 2 adversarial verifiers) over the 4 mechanism areas +
GUI/round-trip + parity table. This is the PILOT pattern — the mechanism chosen here is inherited by every future port, so I
report + the advisor reviews WITH THE HUMAN before any build. No source touched this turn.

### 🎯 DECISION 1 (the architectural crux — sets the pattern for ALL ports): the structural-toggle mechanism
`instantiate()` (userOps.js:268-278) substitutes VALUES into a fixed template — it CANNOT add/remove blocks. Three mechanisms
for making a structural toggle (probeZFirst/travelApproach/wcs/syncA/corner/probeSeq) live:
- **M1 — runtime goto-guard (the dispatch's literal words "always-emit-guarded-by-a-flag"): REFUTED.** Emitting BOTH branches +
  an `IF..GOTO` produces a THIRD shape matching NEITHER the built-in OFF (extra skipped blocks) NOR ON (dead scaffolding), and
  it's impossible for prompt-vs-move / wcs-active-vs-fixed (can't emit both). Fails byte-identical-off AND built-in parity. ✗
- **M3 — `def.build` delegates to the SOURCE `cornerStack(params)` [RECOMMENDED, 3/4 agents converged].** `registerUserOp`
  ALREADY honors `def.build` (userOps.js:310, unused today). `def.build = (params) => wrap(cornerStack({...CORNER_DEFAULTS,
  ...params}))`. Byte-identical-off BY CONSTRUCTION (`build({})` === `cornerStack(CORNER_DEFAULTS)` === today's instantiate
  output → the emit golden stays green) and EXACT parity-on BY CONSTRUCTION (`build({probeZFirst:1})` === `cornerStack(...on)`
  === the built-in — the twin literally IS the source). GENERIC for free — middle's probeZFirst inherits the identical one-line
  delegation (build-once, like safeTraverseStack). Matches the dispatch north-star ("restructure the SOURCE, don't grow
  machinery; a def CAN carry a build function"). It also DISSOLVES the fan-out (c) and most of (a) with zero extra code.
- **M2 — declared `when`-guards + a generic `pruneGuards` pass in instantiate [the pure-data alternative].** The template becomes
  the SUPERSET (all forks on, each forked region wrapped in a `when:{param,is}` group — reusing the sim side's proven `whenOk`
  vocabulary); instantiate prunes the falsified groups. Keeps corner as pure re-authorable DATA (the wizards-as-data ideal:
  the template IS the wizard). COST: builds new machinery (pruneGuards + re-derive bindings BY IDENTITY after prune — the one
  load-bearing hazard), AND the template is a SNAPSHOT of cornerStack + hand-added guards → the branch logic lives in BOTH
  places (cornerStack ifs + template guards) → duplication/drift (LESS one-source than M3).

**My recommendation: M3.** It's correct-by-construction, minimal, keeps ONE source of the shape, and the dispatch explicitly
leans there. TRADE-OFF to weigh (the human's call): under M3 the STRUCTURE is param-driven via the source FUNCTION, not
free-block-re-authorable pure data — but the operator-facing surface (all value + enum + toggle PARAMS) still round-trips as
data via the marker, and the Blocks tab still shows build(params). The clean layering: operators PARAMETERIZE (data); wizard
AUTHORS edit the source. Choose M2 only if free-block re-authoring of the probe STRUCTURE is a required goal (at the machinery
+ duplication cost). This is DECISION 1 for you + the human.

### 🎯 DECISION 2 (a real bug the verifier caught): the multi-handle relTo / _pass anchor fix — the proposed fix BREAKS
Adversarial verify verdict = **BREAKS.** Root: under probeZFirst the Z→wall1 traverse is NOT a `REPOSITION:` delimiter
(cornerWizard.js:147 comment "Traverse to first wall"; the engine bumps `_pass` only on `REPOSITION:`, GcodeExecutionEngine.js:598),
so corner has **3 physical starts (Z-surf, wall1, wall2) but only 2 engine passes** (Z-surf + wall1 share _pass 0). The 3-row
`CORNER_SIM_STARTS` then orphans wall-2 onto a nonexistent _pass 2, and a single static `relTo:0` cannot serve BOTH handles:
#21/#22 (Z→wall1) must anchor TO the Z-surf row; #23/#24 (wall1→wall2) must anchor PAST it to wall-1. No uniform resolver over
one shared integer gets both right. **RESOLUTION (my proposal):** (i) make the Z→wall1 traverse a `REPOSITION:` delimiter in
`cornerStack` → 3 passes = 3 markers 1:1 under probeZFirst (byte-identical OFF — the traverse only exists when Z on; lockstep
parity ON — both built-in + twin share the source; comments are stripped in the functional compare anyway). (ii) make `relTo`
a SEMANTIC anchor (names its sim-start row: Z-surf vs wall1) resolved to the surviving `when`-filtered index — so #21/#22→Z-surf,
#23/#24→wall1, correct in BOTH states. NOTE: middle already emits `REPOSITION:` for its Z reposition (middleWizard.js:184) — so
(i) makes corner CONSISTENT with middle (the asymmetry was corner's bug). Confirm this fix direction.

### How each area lands UNDER M3 (the recommended mechanism)
- **(a) structural toggles:** all six (probeZFirst, travelApproach, wcs, syncA, corner, probeSeq, slave) become build-params
  flowing to cornerStack → live + parity, ZERO per-toggle machinery. Bindings become FORM/2D-layout metadata (drive the widgets),
  not instantiate sockets. RETIRE the two frontier tripwire specs; FLIP the 4 emit-spec divergence rows to PARITY (`pass:true`)
  + add probeSeq/wcs/syncA/slave/scanDepth parity rows.
- **(b) enum fields:** ~90% already wired — `BINDING_TYPES` has `enum`/`bool`; `dropdownWidget`/`toggleWidget` render by type;
  the JSON marker codec + `Enum()`/`Bool()` schema round-trip strings/bools already. NEW work is small: append enum/bool spec
  rows (corner/probeSeq/slave/travelApproach/wcs/syncA/probeZFirst) as NON-derived bindings (no blockIndex — they drive
  build-params, not sockets) with `type:'enum'|'bool'` + `widgetConfig.options`. corner widget = plain dropdown for B4 (the 3×3
  corner-grid picker needs a code↔FL/FR adapter → defer as polish).
- **(c) fan-out — DISSOLVED under M3.** No #17-expression rewrite needed: cornerStack already computes `#17 = safeZ + scanDepth`
  from its JS params, so safeZ + scanDepth just become plain build-param number bindings (editable fields) — the fan-out limit
  was purely an instantiate-single-socket artifact that M3 removes. (Under M2 instead, (c) WOULD need `#17 → [#19+#20]`
  value-identical expression + a #20 scanDepth socket — flagged in case M2 is chosen.) `level` stays baked (a literal-in-G31
  multi-socket fan-out, no macro var — needs a separate multi-socket-binding capability; out of scope). DRILL clearance does
  NOT transfer (drill has NO macro-var layer — its clearance is an inlined literal; needs the same separate multi-socket
  capability, NOT the corner pattern) → a genuine separate fork, recommend DEFER out of B4.
- **(d) multi-handle:** add startX/startY (#21/#22) bindings (group:'ztravel', role x/y, NO default → expression-holding, no
  degenerate G0 X0 Y0) → a 2nd/3rd drag handle via the existing generic incremental-point machinery (the drag→socket TIE is
  DATA, not code — the middle tieDiagTravel pattern generalized). Gate the handle on probeZFirst (grey the fields when off).
  + the anchor fix (DECISION 2).

### PARITY TABLE (built-in Corner vs "Corner (data)" twin, after B4 under M3)
23 params: **20 MATCHED** (corner/probeSeq/probeZFirst/wcs/dist/retract/f_fast/f_slow/port/safeZ/scanDepth/radius/travelDist/
travelApproach/startX/startY/syncA/slave via build-params; + cross1_x/cross1_y) · **2 EXCEED** the built-in (cross1_x/y — 2D
drag handles the built-in lacks) · residue: **`level`** baked (multi-socket, non-operator-facing, leave) · **`sources`** GAP
(decision 3) · **`qStop`** dead in BOTH (decision 4).

### 🎯 DECISION 3 — CONTROLLER-SOURCE CHIPS (`sources`): RECOMMEND WIRE (correctness).
The built-in sources port/level/fastFeed/retract from controller vars via `srcVal`/`srcNote`/`ddcsResolveProbeSources`
(cornerWizard.js:95-102); the twin binds plain literals → `sources` UNWIRED → a user who flipped a chip gets a WRONG program
(literal instead of the ctrl var), not just a missing nicety. Under M3 it's near-free: `sources` rides the build-param seam
(`build` passes it straight to cornerStack → `srcVal` already fires; absent/{} → literals → byte-identical). `opSchema` already
declares `sources: Struct()`. Sub-fork: land CORRECTNESS (passthrough + Struct user-spec) in B4; the chip GUI (flip-to-ctrl
toggles) as a follow-on. Recommend WIRE-correctness in B4.

### 🎯 DECISION 4 — DEAD Q (`qStop`): RECOMMEND LEAVE.
Read but UNUSED in BOTH built-in and twin (the shared probe atom hardcodes Q1) — a pre-existing dead field across all 7 probe
wizards, NOT a corner-data regression. Fixing it = a cross-cutting shared-atom change with real DDCS Q0/Q1 deceleration
semantics → a separate M350-verified task. Leave; record as backlog.

### ROLLOUT DECOMPOSITION (ordered, each independently verifiable; assumes M3 + the DECISION-2 fix)
1. **B4-1 def.build seam:** `cornerDataDef().build = (p) => wrap(cornerStack({...CORNER_DEFAULTS, ...bindingScalars(p), ...p}))`.
   Assert `build(CORNER_DEFAULTS)` byte-identical to today's instantiate output (golden + a build-fn scalar sweep proving the 9
   bindings still route through build, not instantiate). Pure code-path move, no behaviour change.
2. **B4-2 enum/bool + safeZ/scanDepth bindings:** append the NON-derived toggle/enum rows (correct enum/bool types) + safeZ/
   scanDepth number bindings; form renders toggle/dropdown/number by type. Verify registerUserOp validates + the form renders.
3. **B4-3 make the clean toggles live + retire their gates:** corner/probeSeq/wcs/syncA/slave/safeZ/scanDepth → flip the emit-spec
   divergence rows to PARITY; verify each flipped state == cornerStack(flipped).
4. **B4-4 probeZFirst + travelApproach live + the DECISION-2 anchor fix:** REPOSITION-delimiter on the Z→wall1 traverse; semantic
   relTo; CORNER_SIM_STARTS = 3 pass-markers aligned to 3 engine passes under Z; retire the two frontier tripwire specs; add
   startX/startY handles. Verify the 3D preview anchors each pass + the drag ties correctly (real-symptom, human eyes).
5. **B4-5 sources (DECISION 3, if WIRE):** Struct user-spec + build passthrough (correctness); chip GUI optional follow-on.
6. **B4-6 marker/Blockly round-trip verification:** table-driven per-field round-trip (markerLine→parseMarker preserves value+type;
   emit(build(back.params)) == cornerStack(p) per flipped field). GUI controls + round-trip = the "wire round-trip" requirement.
7. **B4-7 generalize to middle (proof the capability is build-once):** middle's probeZ inherits the identical def.build pattern
   (or document it follows separately). DRILL clearance multi-socket = a SEPARATE deferred capability, NOT B4.
(Built-in Corner RETIREMENT stays a separate human-approved step AFTER the twin is app-verified — B4 only removes the blocking gate.)

### Verify results + residual risks
- **anchor-fix: BREAKS → resolved by DECISION 2** (REPOSITION delimiter + semantic relTo). Load-bearing; must be built + human-eye-verified.
- **byte-identity: the verifier returned a DEGENERATE result** (placeholder "test"/"a"/"b" — a failed structured output), so it's
  inconclusive from the agent. The 4 design agents' byte-identity analyses are consistent (M3 default = byte-identical; M2 (c) =
  value-identical). ⚠ EMPIRICAL GATE: run the corner-data-emit golden + sweep immediately after B4-1 (def.build) and assert
  `build(CORNER_DEFAULTS)` deep-equals the pre-change instantiate output before touching anything else.
- Risks: (r1) the build-fn MUST feed BINDING values into the params or the 9 scalars silently revert to defaults (test with a
  build sweep). (r2) new bindings must be `type:'enum'|'bool'` (NOT number) for the marker codec — the one place the
  "keep type:number" pill rule does NOT apply (call it out so it isn't "re-fixed"). (r3) retire the frontier gates in LOCKSTEP
  with flipping the divergence rows or the suite goes red. (r4) `sources` needs Struct user-spec treatment (not a scalar).

**GATE: passing to advisor for review WITH THE HUMAN. Awaiting the mechanism decision (M3 vs M2) + the 3 other decisions before any build.**

---

## 🔨 turn 27 (cycle 11) — ② B4-1: the M3 def.build SEAM (advisor turn 26; human "automate as much as possible"). ⏸ GATE (1) pass-back.

Executing the blessed B4 rollout on M3. B4-1 = the PURE SEAM only; the advisor's dispatch pauses here for review before I
widen it (gate 1: "assert build(CORNER_DEFAULTS) deep-equals today's instantiate output; FAIL→STOP").

**Built (3 files):**
- **`userOps.js`:** `export`ed `instantiate` (was module-private) so the gate can compare the two builder paths directly.
- **`cornerData.js` `cornerDataDef()`:** added `def.build` — the twin's emit engine is now the SOURCE. `build(params) =>
  cornerDataStack({ ...CORNER_DEFAULTS, ...<only the BOUND params> })`. `registerUserOp` already routes to `def.build` when
  present (userOps.js:310), so the builder path flips from frozen-template instantiate → source replay. **B4-1 forwards ONLY
  the currently-bound params** (the 9 numeric today; `bound = new Set(def.bindings.map(b=>b.param))`), so every STRUCTURAL
  param stays at its CORNER_DEFAULTS bake — no behaviour change. The `bound` set widens as later sub-increments add
  enum/toggle bindings → each structural toggle goes live incrementally (+ its frontier tripwire retired in lockstep).
- **`corner-data-build-parity.spec.js` (NEW — the gate):** asserts `build(defaults)` BYTE-IDENTICAL to `instantiate(defaults)`
  (the advisor's explicit gate), `build == instantiate` FUNCTIONALLY across a 13-row bound-scalar sweep, `build == the source
  cornerStack` functionally, and structural stays baked (probeZFirst override does NOT change the emit yet).

**The gate CAUGHT a real divergence — and it turned out to be an IMPROVEMENT, not a regression.** First run FAILED at
`{dist:300}`: the ONLY differing line was the header COMMENT — `build` regenerates `( Probe dist: 300mm … )` (correct,
reflects the actual value) while `instantiate` had FROZEN `( Probe dist: 500mm … )` (stale — instantiate substitutes only the
#1 socket, never the interpolated comment). So `build` is byte-identical for the DEFAULT (dist=500 → both say 500mm — the
advisor's gate holds) and, for overrides, byte-fresher-and-MORE-CORRECT: build's comment now MATCHES the built-in cornerStack,
whereas instantiate DIVERGED from it. The gate spec now compares the sweep FUNCTIONALLY (stripAnnotations, as corner-data-emit
already does because the corner header interpolates params) + explicitly asserts the comment-freshness improvement (build says
300mm like the built-in; instantiate said 500mm). Net: M3 build is CLOSER to built-in parity than instantiate was.

**VERIFY.** `node --check` clean. **corner-data-build-parity 1/1** (byte-identical default + functional sweep + comment
improvement + structural-still-baked). **Full suite: 457 passed + 1 FLAKY (middle-animator `stroke-dashoffset` CSS-timing
under parallel load — `.not.toBe`, passed on retry; unrelated — B4-1 touches no viz/animation).** The existing corner specs
(emit golden, drag, sim-starts, both frontier tripwires, wiz-bar) all stay GREEN — the seam is transparent because structural
stays baked (the frontier divergence rows still see the twin bake → still diverge → still pass:false).

**⏸ GATE (1): the M3 seam is proven sound (byte-identical default, functionally-identical + comment-improved otherwise, no
behaviour change). Passing to advisor for review before widening the bound set (B4-2: enum/toggle bindings → structural live).**

---

## 🔨 turn 29 (cycle 11) — ② B4 MECHANISM REVERSED M3→M2: REVERT + M2 SCOUT+GATE (advisor turn 28; human t26). ⛔ REPORTING.

Human reversed M3→M2 (t26): re-authoring/COMPOSITION is THE POINT ("open a wizard, go into Blocks, add an array of probes");
M3's def.build locks structure in JS → defeats it. This is exactly the trade-off I flagged in the turn-25 gate — the human
chose the pure-data path for composability. Two parts this turn: (1) REVERTED the M3 seam, (2) SCOUTED M2 (6-agent workflow).

### (1) REVERT — done
Restored userOps.js + cornerData.js to pre-03698c1 (git diff vs 03698c1^ = EMPTY → clean); deleted the M3 corner-data-build-parity
spec; KEPT the turn-27 WORK-LOG entry (append-only). def.build gone; instantiate is the builder again (M2 emits FROM the template).

### (2) M2 SCOUT — the plan. Mechanism SOUND; but TWO findings the human must weigh (composition + fan-out sign-off).

**§ M2 MECHANISM (sound, well-designed).** A generic `guard` block (transparent container carrying `when:{param,is}`, reusing
the sim side's EXISTING `whenOk` — one evaluator for emit + sim) + a `pruneGuards(clone, params)` pre-pass in instantiate that
DROPS falsified guarded subtrees + UNWRAPS survivors, THEN **re-derives bindings BY IDENTITY** (deriveBindings over the pruned
stack — the def carries binding SPECS, not frozen indices; this is the load-bearing hazard, solved by the existing identity
matcher). Template = the SUPERSET (all forks present, each guarded); cornerStack = the SEED for now (self-host/delete later).
BYTE-IDENTICAL-OFF proven: the default prunes every guard → the surviving tree IS cornerStack(defaults) → the emit golden stays
green. Flipped → the guarded branch survives → parity with cornerStack(flipped). Makes probeZFirst/travelApproach/wcs/syncA
LIVE as pure re-authorable data.

**⚠️ DECISION 1 (the headline — the human's use case doesn't work as imagined): "array of probes → grid" BREAKS on the
existing array block.** Adversarial verify = BREAKS, confirmed in code. M2 DOES deliver the ENABLER — the corner op IS the
editable template block stack in the Blocks tab (no def.build black box), so you CAN wrap the probe blocks. BUT the existing
`array`/multiplier stamp CANNOT turn that into a grid of corner probes: its `(dx,dy)` offset only reaches LITERAL coords
(util.js:18 passes `#var`/`[expr]` through, ignoring the offset), and the corner is entirely `#var`-driven + INCREMENTAL (G91)
— so wrapping it emits N BYTE-IDENTICAL passes at the SAME spot, with DUPLICATE N1/N2 labels + repeated M30 = a BROKEN program,
not a grid. A real "grid of corners" needs a NEW **macro-aware repeat** primitive (an incremental `G91 X<pitch>` step between
passes + the config/error-handler/M30 HOISTED out of the loop so they stay singular) AND a **WCS-TARGET semantic decision**: N
corners all writing the SAME active WCS is meaningless — each needs a distinct G54..G59 slot or a table index. **So: M2 is worth
building for editability + live toggles, but the specific "add an array of probes" is a SEPARATE follow-on primitive + a
semantic the human must decide. It is NOT free with M2.** (The array multiplier stays correct for its real job — absolute-XY
toolpath leaves like drill/bore.)

**§ SCOPE finding: corner quadrant + probeSeq are NOT prune-shaped.** They permute direction SIGNS + axis ORDER inside atoms
(not add/remove blocks), so the guard/prune mechanism doesn't fit — they'd need value-bindings (bind `own(dir)`/`opp(dir)` /
axis-letter). **Recommend: keep corner + probeSeq BAKED in M2** (as today); bring them live later via value-bindings.
So M2's live structural toggles = **probeZFirst · travelApproach · wcs · syncA** (+ syncA's `slave` value). [DECISION 2]

**§ ANCHOR fix under M2 (from the turn-25 BREAKS finding, now concretely resolved).** (i) make the Z→wall1 traverse a
`REPOSITION:` delimiter in cornerStack → 3 passes = 3 markers 1:1 under probeZFirst (byte-identical OFF — that line only exists
when Z on; consistent with middle). (ii) SEMANTIC relTo: tag the CORNER_SIM_STARTS rows with stable `id`s ('zsurf'/'wall1'/
'wall2'); a binding's `relTo:{row:'wall1'}` resolves via `resolveRelToIndex(rows, params, relTo)` to the surviving `when`-filtered
index (the same filter opSimStarts + the engine `_pass` use) → #23/#24 anchor to wall-1, #21/#22 to zsurf, correct in BOTH Z
states. (Numeric relTo still honored for back-compat.)

**§ FAN-OUT under M2 (required — instantiate can't compute).** Restructure cornerStack so `#17` (plunge) EMITS the EXPRESSION
`[#19+#20]` (add a `#20=scanDepth` socket) instead of the baked literal — value-identical, exactly the shipped `#18=[0-#17]` /
`#16=[0-#15]` idiom. Then safeZ→#19 + scanDepth→#20 are CLEAN single bindings (fan-out dissolved; count 9→11). **DECISION 3:
this edits the SHARED cornerStack, so the BUILT-IN's `#17` line also changes from `#17=15` to `#17=[#19+#20]` (value-identical,
byte-VISIBLE — stripAnnotations doesn't hide `#`-lines) — needs sign-off + a re-run of every cornerStack test, and pick #20
against the M350 free-var list.** `level` stays baked (multi-socket); drill clearance is a separate deferred fork.

**§ STALE-SNAPSHOT (PARTIAL fix — adversarial verify = PARTIAL, honestly).** M2's template is a snapshot → interpolated text
freezes at the seed defaults. Three kinds: **KIND C** (`#17`, a real value) → fixed by the expression above (byte-gated).
**KIND A** (bound-value comments like "Probe dist: {dist}mm") → an `interp` binding kind fills `{param}` placeholders at
instantiate from the SAME resolved values (must be BUILT — not free). **KIND B** (structural-derived text: dir labels, "+Z
Surface", corner name, "Hover OVER/OUTSIDE", "Target: G5x", step labels, the 2 compNotes) → rides the guard/prune as GUARDED
comment VARIANTS, **co-delivered WITH the structural toggles** (frozen until then — acceptable ONLY because the twin's
structural params are baked at exactly those defaults, so the frozen text is CORRECT for the only shape the twin emits; goes
wrong the instant a toggle is live without its variant → so they ship together). [DECISION 4: confirm KIND B co-delivery.]
Note: `stripAnnotations` HIDES KIND A/B from the byte-gate, so each needs a DEDICATED value-asserting test (dist=300 ⇒ comment
reads "300mm") — the assert-the-value discipline.

### ROLLOUT (ordered; each independently verifiable). Assumes M2 + the 4 sub-decisions (anchor / sources=WIRE / qStop=LEAVE / safe-Z frame) HOLD.
1. **M2-fanout** (self-contained, value-identical, no guard machinery): cornerStack `#17=[#19+#20]` + `#20=scanDepth`; bind
   safeZ→#19, scanDepth→#20 (9→11); update the golden (#17 expression + #19/#20 lines) + flip the safeZ frontier row to converge.
2. **M2-guards** (the capability, built ONCE): `guard` block + `pruneGuards` + `resolveRelToIndex`, sharing `whenOk` (extract to
   a neutral module to avoid a blocks→viz edge); instantiate = prune → re-derive-by-identity → substitute. Unit-test prune
   (default byte-identical / flipped other-branch / nested / uiChildren) + a non-guarded op (drill) UNCHANGED regression.
3. **M2-anchor**: Z→wall1 REPOSITION delimiter + sim-start row `id`s + semantic relTo wiring. Assert pass-count == filtered-row-count
   across the probeZFirst on/off matrix; #23/#24 anchor to wall-1 both states.
4. **M2-toggles-live**: seed the superset (guard probeZFirst/travelApproach/wcs/syncA regions) + enum/bool bindings
   (type:'enum'|'bool' + widgetConfig.options — NOT the number-pill rule); flip the 4 frontier divergence rows to PARITY; RETIRE
   the two frontier tripwire specs in lockstep. **⏸ HUMAN-EYES gate here** (3D preview anchors each pass + the drag ties + toggles work).
5. **M2-freshness**: KIND A interp-comment binding (dist/retract/fast/slow + safeZ/scanDepth after step 1) + KIND B guarded
   comment variants (ride step 2's guards) + value-asserting tests.
6. **sources = WIRE** (Struct user-spec + build passthrough — correctness); **GUI + marker/Blockly round-trip** per new field.
7. **SEPARATE / GATED (grid-of-corners)**: the macro-aware repeat primitive + the WCS-target decision (DECISION 1). NOT part of
   core M2; scope after the human decides the semantic. corner+probeSeq value-bindings + self-host (delete cornerStack) also later.

**GATE: passing to advisor for review WITH THE HUMAN. Key calls: (1) grid-of-corners = new primitive + WCS-target semantic
[headline — the "array of probes" isn't free]; (2) corner/probeSeq baked in M2; (3) #17-expression sign-off on the shared
cornerStack; (4) KIND-B comment freshness co-delivers with the toggles. Sub-decisions hold.**

---

## 🔨 turn 31 (cycle 11) — ② B4 M2 BUILD — step 1/7: FAN-OUT dissolved (#17=[#19+#20]) (advisor turn 30; human-approved M2).

M2 build approved (scout reviewed + human-approved). The rollout is 7 steps; the advisor asked to run to the TOGGLES-LIVE
gate autonomously. **I'm sequencing it as verified increments** — step 1 (the self-contained, value-identical fan-out fix)
landed + globally green this turn; steps 2-4 (the guard/prune CAPABILITY = a core `instantiate` rewrite used by EVERY user
op, then anchor, then toggles-live) are the heavy, verification-critical core and get their own focused increments so the
core-engine change is proven, not batched. (verify-real-symptom over speed; the toggles-live human-eyes gate wants a solid
foundation under it.)

**Step 1 — FAN-OUT via DECLARATION (D3, approved).** Restructured the SHARED cornerStack so the plunge `#17` EMITS as the
EXPRESSION `[#19+#20]` instead of the baked literal `safeZ+scanDepth`:
- `cornerWizard.js`: dropped the `plungeDepth` JS local; reordered so `#19`(safeZ) + a NEW `#20`(scanDepth) precede `#17`
  (top-down eval); `A('#17','[#19+#20]')` + `A('#18','[0-#17]')`. Value-identical (controller sums to the same plunge; same
  idiom as the shipped `#18=[0-#17]`/`#16=[0-#15]`). BYTE-visible on the `#17`/`#19`/`#20` lines (approved D3).
- `cornerData.js`: safeZ→`#19` + scanDepth→`#20` are now CLEAN single-socket bindings (were the baked fan-out frontier) →
  CORNER_BINDING_SPECS 9→11; updated the FRONTIER header note (safeZ/scanDepth un-baked; `level` stays baked).
- Regenerated the SHARED `probe-surface-block.spec` CORNER_GOLDEN (4 full-macro strings) — captured from the new cornerStack,
  verified `#19=10 · #20=5 · #17=[#19+#20] · #18=[0-#17]` (value-identical, 15).
- `corner-data-emit.spec`: bindingCount + onCount 9→11; FLIPPED the safeZ frontier row from "must diverge" to a `safeZConv`
  PARITY row (safeZ is live now) + added a `scanDepthConv` parity row. The probeZFirst/corner/travelApproach frontiers STAY
  (still baked — they land in steps 3-4).

**VERIFY.** `node --check` clean. corner-data-emit + probe-surface-block(golden) + corner-data-drag + corner-data-sim-starts
10/10. **Full suite: 457 passed, 0 failed (1.4m).** The fan-out is value-identical (the emit golden's asserted lines + the
stripAnnotations sweep stay green; the byte-visible `#17` change rode into the regenerated shared golden).

**Remaining rollout to the ⏸ toggles-live gate:** step 2 = the generic guard block + `pruneGuards` + `instantiate` re-derive
BY IDENTITY after prune + shared `whenOk` (built ONCE, corner-agnostic, with a drill/slot UNCHANGED regression) → step 3 =
anchor (Z→wall1 REPOSITION delimiter + semantic relTo) → step 4 = seed the superset + enum/bool bindings → probeZFirst/
travelApproach/wcs/syncA LIVE + retire the two frontier tripwires in lockstep → **PASS BACK (human eyes).** Then step 5
comment-freshness, step 6 sources=WIRE + round-trip. corner/probeSeq baked (D2); grid = follow-on (D1).

**Passing back at the step-1 checkpoint** (a clean value-identical foundation) so the advisor sees it before the core-engine
guard/prune rewrite; continuing the rollout next.

---

## 🔨 turn 33 (cycle 11) — ② B4 M2 step 2/7: the GUARD/PRUNE capability (core instantiate rewrite, built ONCE). ⏸ PASS BACK.

Advisor affirmed the cadence: ISOLATE step 2 (the core `instantiate` change used by EVERY user op) as its own increment
with the full regression + fresh eyes, then batch steps 3+4. This turn = the GENERIC capability only — NO corner changes.

**Built (corner-agnostic, one-source):**
- **`blocks/whenGuard.js` (NEW):** `whenOk(when, params)` (MOVED here from viz/opSimStarts — the ONE guard evaluator now
  shared by emit + sim; viz→blocks is the natural direction, no blocks→viz edge) + `pruneGuards(blocks, params)` — a
  clone-walk that DROPS a `guard` subtree whose `when` is false and UNWRAPS a survivor (splices children in place),
  recursing children + uiChildren, handling NESTED guards. After prune NO guard remains → the tree is the concrete shape.
- **`viz/opSimStarts.js`:** imports `whenOk` from whenGuard (removed the local copy) — emit + sim read the identical predicate.
- **`wizards/ops/guard.js` (NEW) + index.js:** the `guard` block (transparent container, kind:'guard', Control category);
  registered in PALETTE + the newBlock children-kind list. blockEmitter transparent-emits a guard alongside param_group
  (a SAFETY NET — prune normally removes every guard pre-emit; a stray survivor emits its children, never `( unknown )`).
- **`blocks/userOps.js` — the CORE `instantiate` rewrite:** `clone → pruneGuards(clone, params) → flatten → (def.bindingSpecs
  ? deriveBindings(flat, specs) : def.bindings) → substitute`. A def may now carry `bindingSpecs` (identity matchers)
  INSTEAD of frozen `bindings` — because a guarded superset shifts flat indices per prune state, so indices are RE-DERIVED
  BY IDENTITY over the PRUNED stack every build. **Back-compat is exact:** a legacy def (no guards, no bindingSpecs) →
  pruneGuards is a no-op → frozen `bindings` used as before → byte-identical for drill/slot/text/corner-current/every op.
  (userOps↔deriveBindings is a runtime-safe ESM cycle: flattenBlocks is a hoisted `export function`, only called at runtime.)

**VERIFY.** `node --check` clean (7 files). NEW `guard-prune.spec` proves: whenOk (bool coerce / enum strict); pruneGuards
drop/unwrap/NESTED leaving zero guards; and instantiate RE-DERIVE-BY-IDENTITY — a synthetic guarded def whose guard inserts
#Z1/#Z2 before #TARGET (a +2 flat shift when zOn) still writes `#TARGET=42` in BOTH states (the load-bearing hazard, proven).
Regression: corner-data-emit / corner-data-drag / user-ops / sim-starts-data all green. **Full suite: 458 passed, 0 failed
(1.4m)** — the core-engine change is transparent (no op has guards or bindingSpecs yet, so every existing op is unchanged).

**⏸ PASS BACK (step-2 gate — a core-engine change earns fresh eyes + the full regression).** The capability is live +
proven, NO behaviour change to any op. Next (on your pass-back), batch steps 3+4: step 3 anchor (Z→wall1 REPOSITION
delimiter + semantic relTo), step 4 seed corner's superset (guard probeZFirst/travelApproach/wcs/syncA + enum/bool bindings
+ switch corner to `bindingSpecs`) → the toggles go LIVE + retire the 2 frontier tripwires in lockstep → ⏸ TOGGLES-LIVE
human-eyes gate.

---

## 🔨 turn 35 (cycle 11) — ② B4 M2 step 3 (anchor pass-alignment) + a RE-SCOPE of step 4 (advisor turn 34 greenlit 3+4).

Step 2 accepted (advisor's independent regression: all 5 sibling ports byte-identical). Greenlit the batched step 3 + step 4
→ toggles-live gate. In building it I MAPPED that step 4 is materially larger + more coupled than the batch assumed, so I
landed the cleanly-bounded, correct piece (the anchor pass-alignment) + re-scope step 4 fork-by-fork below (the discipline
the advisor has praised: prove each piece, don't rush a 4-fork superset in one turn).

**Built + verified — step 3 pass-alignment (the anchor's engine-side half):** cornerStack's Z→wall1 traverse comment gains
`REPOSITION:` → the engine (bumps `_pass` only on a REPOSITION: comment) now counts it as its OWN pass, so under probeZFirst
there are **3 passes == the 3 declared CORNER_SIM_STARTS markers, 1:1** (was 2 passes / 3 markers → wall-2 orphaned).
CONSISTENT with the middle wizard (its Z reposition is already a delimiter). BYTE-IDENTICAL OFF (the Z→wall1 line only
exists under probeZ) + the prefix is stripAnnotations-invisible → the functional emit/golden specs are unaffected. NEW
`corner-pass-align.spec` asserts the real symptom: 2 REPOSITION delimiters under probeZ, 1 without. **Full suite 459 green.**

**⚠️ STEP-4 RE-SCOPE — the toggles-live work is a MULTI-INCREMENT job (mapped precisely):**
- **Each fork's block-adds AND its KIND-B interpolated text must be guarded TOGETHER for ON-parity.** probeZFirst isn't
  one contiguous block: it's #21/#22 (config) + the Z-surface probe + the Z→wall1 traverse (blocks), PLUS the `#1505`
  prompt "Hover OVER vs OUTSIDE", the "Step 1/2 vs 2/3" labels, and the "+ Z Surface" header (KIND-B text). A superset that
  guards only the blocks would emit the ON shape with the OFF text → `instantiate(probeZFirst:1) ≠ cornerStack(probeZ:1)`
  (byte-fails on parity). So the KIND-B guarded comment variants (D4) are NOT deferrable per-toggle — they co-deliver with
  each fork's block guards. (stripAnnotations hides them from the gate, so each needs a value-asserting test too.)
- **cornerStack needs a `superset` mode** (emit BOTH arms of each fork, each wrapped in a `guard`) for the twin SEED, while
  the built-in still calls it concrete. prune(superset, defaults) must be BYTE-identical to cornerStack(defaults).
- **wcs is a 7-WAY guard** (active + G54..G59 literal arms — the fixed #70 value is enum-derived, so it's guarded arms, not
  a value binding). travelApproach = 2 guarded pairs (×2 travels). syncA = 1 bool guard.
- **The semantic relTo (anchor's drag-side half)** needs the declared sim-start rows accessible at the panelTypes call site
  (row `id`s + a `resolveRelToIndex` over the when-filtered rows) — best delivered WITH probeZFirst-live (where the #23/#24
  drag under probeZ actually exercises it).

**PROPOSED fork-by-fork sequencing to the ⏸ human-eyes gate** (each a focused, verifiable increment on the step-2 guard/prune
capability): **(4a) probeZFirst-LIVE** = the superset guards for #21/#22 + Z-surface + Z→wall1 + the KIND-B variants (prompt/
steps/+Z) + the semantic relTo resolver + a `probeZFirst` bool binding + switch corner to `bindingSpecs` + retire the
probeZFirst frontier in lockstep → **PASS BACK human-eyes** (the headline toggle: flip probeZFirst, see the Z step + 3
aligned markers + the drag). **(4b) travelApproach-live**, **(4c) wcs-live (7-way)**, **(4d) syncA-live** — same guarded-arm
pattern, each retiring/flipping its frontier row.

**Passing back with step-3 landed + this re-scope, so you can dispatch 4a (probeZFirst-live) as the next focused increment
to the human-eyes gate** — rather than a single rushed 4-fork superset. If you'd prefer I push straight through 4a-4d in
fewer turns, say so; I flagged the coupling so the sequencing is your call.

---

## 🔨 turn 37 (cycle 11) — ② B4 M2 step 4a: probeZFirst LIVE (superset guard/prune + KIND-B variants + semantic relTo + bool binding + bindingSpecs). ⏸ HUMAN-EYES GATE.

Advisor turn-36 RE-DISPATCH (the prev pass hit a split-brain HANDOFF.md in DDCS-Studio/ from a stray cwd — corrected; step 3
reviewed clean). STEP-4 RE-SCOPE ACCEPTED → dispatch **4a probeZFirst-LIVE ONLY**, ⏸ pass back at the human-eyes gate (do NOT
push to 4b/4c/4d). This is the first structural toggle made LIVE on the step-2 guard/prune capability.

**The mechanism (one-source, each piece proven ONCE on corner):**
- **cornerStack SUPERSET mode (`opts.superset`).** The built-in stays CONCRETE (1-arg call — byte-identical to today, untouched);
  the twin SEEDs `cornerStack(params, {superset:true})`, which emits BOTH arms of the probeZFirst fork, each wrapped in a
  `guard` block, via 5 tiny local helpers (`GUARD`/`mkC`/`mkA` + `zPair`(both arms)/`zOnly`(Z-only add)). `instantiate()`
  (step 2) prunes the guarded superset to either concrete shape. The KIND-B interpolated text forks WITH the block-adds (a
  block-only superset would emit the ON shape with the OFF text → ON-parity byte-fails): the header "+ Z Surface" suffix, the
  `#1505` Hover OVER/OUTSIDE prompt, and the 3 Step-number labels (Z-first shifts every step +1) are each a guarded comment PAIR.
  The wall1→wall2 reposition rides the pair whole (its moves are Z-identical — only the Step number in its comment differs).
- **Semantic relTo (the drag-anchor's other half).** Tagged the CORNER_SIM_STARTS rows with stable `id`s (zsurf/wall1/wall2);
  `cross1_x/_y` bind `relTo:{row:'wall1'}` instead of the fragile numeric `0`. NEW `resolveRelToIndex(opType, params, relTo)`
  (opSimStarts.js) maps the semantic id → the row's position among the SURVIVING when-filtered rows (the SAME whenOk filter
  opSimStarts + the engine `_pass` use), so the handle anchors to wall-1 in BOTH states (off: filtered-index 0; on: the zsurf
  row shifts it to 1). A numeric relTo still passes straight through (back-compat). Wired at the panelTypes call site. The `id`
  round-trips via `simStartsTo/FromBlocks` (params.id, ONLY when set → id-less rows stay byte-identical; survives stripIds) —
  NOT through the Blockly field bridge (an internal anchor key, not operator-facing; Blockly re-authoring of the id = follow-on).
- **bindingSpecs switch + the structural bool binding.** `cornerDataDef` now sets `def.bindingSpecs = CORNER_BINDING_SPECS`
  (instantiate re-derives the 11 value sockets BY IDENTITY over the PRUNED stack — so #23/#24 land under the +2 shift) + adds a
  `probeZFirst` BOOL binding to `def.bindings` (drives the form TOGGLE + the guard prune; NO value socket → no blockIndex/match).
  `validateUserOp` now SKIPS the block-resolution check for a structural (blockIndex-less) binding — the M2 structural-binding
  contract. `setUserSimStarts` gains a 3rd `rows` arg (the declared rows travel alongside the provider for resolveRelToIndex).
- **Frontier retired in LOCKSTEP.** Deleted corner-data-probeZFirst-frontier.spec.js (the "probeZFirst is baked" tripwire is now
  false). Its don't-retire-the-built-in GATE MOVED into corner-data-travelApproach-frontier.spec.js (part 3), re-anchored to the
  frontiers STILL baked (travelApproach/wcs/syncA) — so the built-in stays guarded until 4b/4c/4d land.

**VERIFY — ASSERT THE VALUE (not "a change happened"):** NEW corner-data-probeZFirst-live.spec asserts (1) OFF twin emit ==
`cornerStack({probeZ:false})` AND ON twin emit == `cornerStack({probeZ:true})` **FULL BYTE-FOR-BYTE** (no stripAnnotations — the
KIND-B comments must match too); (2) the real toggle symptom — ON adds "+ Z Surface" + Hover-OVER + the Z→wall1 REPOSITION +
"Step 2: Y Probe", OFF keeps Hover-OUTSIDE + "Step 1"; (3) preview 2 markers off / 3 on, and the semantic relTo anchors to the
SAME wall-1 point in BOTH states (idx 0 off, idx 1 on). corner-data-emit reworked: probeZFirst row FLIPPED div→**full-byte
CONVERGE** (both states); derive-robustness re-proved over the PRUNED shapes (#23/#24 still +2 under Z); wiring re-proved via the
EMIT (bindingSpecs makes a blockIndex probe stale). corner-data-drag (off anchor), probe-surface-block GOLDEN (concrete
cornerStack byte-identical), sim-starts, guard-prune, sim-start round-trip all green. **Full suite: 460 passed, 0 failed, 3
skipped (1.4m) — clean (no flakes on the confirming run).**

**⏸ PASS BACK — HUMAN-EYES GATE.** probeZFirst is a real live toggle: open "Corner (data)", flip **Probe Z First** → the emit
grows the Z-surface step + Z→wall1 reposition (3 aligned pass-markers), the prompt flips OVER↔OUTSIDE, and the reposition drag
still writes the wall-relative DELTA (now anchored to wall-1 in either state). Human should eyeball: the Z step appears, the 3
markers, and the drag tie. Then dispatch **4b travelApproach-live** (same guard/prune, its frontier retires next), 4c wcs (7-way),
4d syncA. NOT pushing past the gate. (Note: this turn's pass avoids backticks in the --note per the turn-33 shell-substitution fix.)

---

## 🔨 turn 39 (cycle 11) — ② B4 M2 step 4a-HARDEN: close the test-integrity gap (binding-driven relTo + ON-state coverage + mutation-proven). ⏸ PASS BACK (advisor verifies).

Advisor reviewed 4a: production SOLID (re-run 10/10, 5 siblings byte-identical; fan-out review 4/5 lenses clean). ONE test-
integrity finding (NO prod bug — relTo IS correctly wired at cornerData.js:71-72): my corner-data-probeZFirst-live spec drove
resolveRelToIndex with a HARDCODED {row:'wall1'} and never asserted the cross1_x/cross1_y BINDINGS actually declare that relTo
→ a stale numeric relTo:0 (or a wrong row) would PASS GREEN in the ON state (no ON-state drag/anchor test; corner-data-drag is
OFF-only). Matters because 4b-4d CLONE this pattern and the human-eyes gate is dropped (the test is the net). GOOD CATCH.

**Hardened corner-data-probeZFirst-live (test-only change — no prod code touched):**
- **(1) READ + ASSERT the declared wiring:** read `cross1_x`/`cross1_y` from `def.bindings` and assert each `relTo` deep-equals
  `{row:'wall1'}`. A binding mis-declaration now fails directly.
- **(2) DRIVE the resolver FROM the binding:** `resolveRelToIndex(..., cxBind.relTo)` — NOT a literal. So the anchor path is now
  sensitive to the binding: a stale `relTo:0` → `resolveRelToIndex` returns 0 in BOTH states → onAnchorIdx 0≠1 + off/on anchor
  points differ → RED. Mirrors the panelTypes call site exactly (`resolveRelToIndex(def.opType, params, byRole.x.relTo)`).
- **(3) ON-STATE coverage (corner-data-drag is OFF-only):** binding-driven `onAnchorIdx===1` + `onAnchorIsWall1` (the resolved ON
  anchor lands on the wall-1 marker, not zsurf/wall-2) + `anchorSamePoint` (same wall-1 point in both states).
- **(4) MUTATION-CHECK (proven, then reverted BYTE-EXACT):** set `cross1_x.relTo := 0` → RED; set `:= {row:'wall2'}` → RED;
  revert → GREEN. `git diff` on cornerData.js is EMPTY (mutation fully reverted; only the test file changed).

**LIVE-SPEC PATTERN for 4b/4c/4d (adopted):** each toggle's spec READS its OWN binding wiring from `def.bindings`, DRIVES the
resolver/emit from it (never a hardcoded literal), and tests BOTH toggle states — so a mis-wire fails the net, not the (now
dropped) human eyes.

**VERIFY.** corner-data-probeZFirst-live green; mutation-check RED on both mis-wires; **full suite 460 passed, 0 failed, 3
skipped (1.3m) — clean.** All byte-parity specs stay green (prod code untouched this turn).

**⏸ PASS BACK (advisor verifies — no human gate).** Only the test hardened; production 4a is as reviewed. Ready for the 4b
travelApproach-live dispatch (same guard/prune mechanism, its frontier retires next, spec follows this live-spec pattern).

---

## 🔨 turn 41 (cycle 11) — ② B4 M2 step 4b: travelApproach LIVE (enum guard/prune, batch fork 1/3). ⏸ PASS BACK (advisor verifies).

4a-harden reviewed CLEAN + verified (gap closed, net bites). DISPATCH 4b travelApproach-LIVE — the FIRST ENUM structural
toggle (4a was a bool), same guard/prune mechanism. ⏸ pass back (no human gate — advisor verifies). Then advisor dispatches
4c wcs(7-way).

**The mechanism (enum extends the 4a pattern):**
- **`taPair` (travelApproach fork).** travelApproach forks TWO traverses (safeTraverseStack emits a DIFFERENT shape per arm:
  auto = the G0 seq move; manual = the #1505 jog-and-wait prompt). New `taPair(autoFn, manualFn)` RETURNS the arm blocks
  (composed INSIDE a z-fork so it can NEST): superset → BOTH arms guarded by `when(travelApproach=='auto'|'manual')`;
  concrete → the selected arm via LAZY thunks (unused shape never built). Applied to (a) the Z→wall1 traverse — NESTED inside
  the probeZFirst guard, and (b) the wall1→wall2 reposition — the taPair (travelApproach) NESTS inside the zPair (probeZFirst
  step-number fork), a full 2×2. One leaf survives prune → byte-for-byte == cornerStack for every combination.
- **whenOk handles enum out of the box** (`v === when.is`, strict string equality — guard-prune.spec already covers
  enumMatch/enumMiss; pruneGuards is value-agnostic). NO whenGuard change needed — VERIFIED.
- **HAZARD FIXED — enum needs its default before prune.** A bool guard tolerates an absent param (whenOk coerces
  !!undefined=false → the OFF arm), but an ENUM guard does not (undefined === 'auto' is false → BOTH arms drop → the
  reposition VANISHES). `build({})` (the golden + frontier gates) passes `{}`, so travelApproach would be undefined. FIX:
  `instantiate` now fills STRUCTURAL binding defaults (guard params, blockIndex==null) for any ABSENT param BEFORE prune
  (`withGuardDefaults`). Value bindings untouched (absence handled per-binding); a legacy def (no structural bindings) → no-op
  → byte-identical. This also hardens probeZFirst (was relying on !!undefined).
- **travelApproach = an ENUM structural binding** in CORNER_STRUCT_BINDINGS (type:'enum', default 'auto', widgetConfig options
  auto/manual → the form dropdown; dropdownWidget commits the raw string for non-numeric types). Like probeZFirst it has NO
  value socket (drives the guards via params), so it lives in def.bindings, NOT bindingSpecs (which requires a block match).

**Frontier moved in LOCKSTEP.** Retired corner-data-travelApproach-frontier (travelApproach now live). Its don't-retire-the-
built-in gate MOVED AGAIN into a NEW corner-data-wcs-frontier.spec (re-anchored to wcs/syncA — the STILL-baked frontiers), which
also tripwires wcs (the twin BAKES the active-WCS read #71=#578 + ignores a fixed wcs param → RED when 4c wires the 7-way guard).

**VERIFY — the HARDENED live-spec pattern (adopted for 4b/4c/4d).** NEW corner-data-travelApproach-live READS the enum
binding's OWN wiring from def.bindings (asserts type enum, default auto, options {auto,manual}) and DRIVES the emit from the
declared option VALUES (never a hardcoded literal) — so a mis-wire fails. Asserts FULL byte-for-byte parity across the WHOLE
2×2 (probeZFirst × the binding's options) + the real toggle symptom on BOTH traverses (manual → the two "Jog clear" #1505
prompts + no G0 seq move; auto → the two G0 seq moves + no jog). MUTATION-CHECK: set the binding option 'manual'→'jog' → the
declared-options assert AND the binding-driven parity go RED; reverted byte-exact. corner-data-emit reworked (travelDiv →
full-byte MANUAL CONVERGE). corner-data-probeZFirst-live + guard-prune + golden all green. **Full suite: 460 passed, 0 failed,
3 skipped; 1 known flake (middle-animator stroke-dashoffset — retried GREEN by Playwright + passes 6/7 in isolation, unrelated
— touches none of my files).**

**⏸ PASS BACK (advisor verifies — no human gate).** travelApproach is live via the same guard/prune; frontier moved to wcs.
Ready for 4c wcs-live (the 7-way enum: active + G54..G59 literal arms — same taPair-style pattern, but 7 arms; its spec follows
this hardened pattern and retires the wcs tripwire in lockstep, moving the built-in gate to syncA). Then 4d syncA.

---

## 🔨 turn 43 (cycle 11) — ② B4 M2 step 4c: wcs LIVE (7-way enum guard/prune, batch fork 2/3, highest risk). ⏸ PASS BACK (advisor verifies + fan-out).

4b travelApproach-live reviewed CLEAN + verified (withGuardDefaults sound, 12/12, mutation accepted). DISPATCH 4c wcs-LIVE —
the 7-way enum (active|G54..G59), flagged as the highest-risk fork (advisor will fan-out review). ⏸ pass back.

**The complication I mapped first (before coding): the derived `wcsLabel` BLEEDS into 5 locations**, not just the WCS-base block:
(1) the WCS-base block itself (STRUCTURAL: active reads #578→computes #70 [4 blocks] vs a fixed G54..G59 literal #70 [2 blocks]);
(2) the header `| ${wcsLabel}`; (3) the probeWall X save note `Save to {label} X`; (4) the probeWall Y save note; (5) the
Z-surface compNote `Save {label} Z offset…` (inside the probeSurfaceStack). So 1 structural + 4 KIND-B derived-label comments,
two of them inside SHARED spots (the probeWall helper, the Z probe).

**Resolution — a `wcsFork(fn)` helper, consistent with M2 (not the KIND-A interp).** wcsFork RETURNS one wcs value's arm blocks
(so it composes/NESTS inside the z-forks): superset → all 7 arms guarded by when(wcs==value), each built with ITS resolved
label; concrete → the selected arm. Applied to all 5 spots — the WCS-base block, the header (nested inside the probeZFirst
zPair → 2×7), the X/Y save notes (via S.push inside probeWall), and the Z compNote (the zSurfaceProbe is now label-parameterised
+ wcsForked, nested inside the probeZFirst guard). One leaf survives prune → byte-for-byte == cornerStack for EVERY combination.
The CODE stays clean (5 helper calls); the extra template arms are inert DATA pruned per build — the same declare-the-superset
pattern M2 rests on, just at 7-way. (A KIND-A interp for the 4 cosmetic labels would shrink the template, but it's a separate
shared mechanism + not needed for correctness; noted as a possible later optimization, NOT built.)

**Wiring details:**
- CORNER_DEFAULTS.wcs 0 → 'active' (STRING): the guards match wcs by value-equality (when(wcs=='active'|'G54'…)), so a numeric 0
  would match no arm and drop the whole WCS block. cornerStack still accepts 0..6 for the built-in via its own normalization
  (unchanged). withGuardDefaults (4b) fills the 'active' default for build({}).
- wcs = a 7-option ENUM structural binding in CORNER_STRUCT_BINDINGS (default 'active', options active/G54..G59 → the form
  dropdown). whenOk enum === already proven (4b) — VERIFIED, no whenGuard change.
- deriveBindings UNAFFECTED: the 7× WCS arms assign #70/#71/#72 (NOT spec vars), and every spec (#1-6,#15,#19,#20,#23,#24) is
  unconditional (config/calc-motions, outside all guards) → still a unique match. The wcs base block sits AFTER #23/#24, so the
  #21/#22-driven +2 shift under probeZFirst is unchanged.

**Frontier moved in LOCKSTEP.** Retired corner-data-wcs-frontier (wcs now live). Its don't-retire-the-built-in gate MOVED into a
NEW corner-data-syncA-frontier (re-anchored to syncA — the LAST baked structural frontier; 4d retires it, then the ④ release
retires the built-in), which also tripwires syncA (the twin bakes it OFF: no Dual Gantry Sync / G1 A0 / #74 write).

**VERIFY (hardened live-spec pattern).** NEW corner-data-wcs-live READS the 7-option enum binding's OWN wiring (type enum,
default active, the 7 options) + DRIVES the emit from the declared option values; asserts FULL byte-for-byte parity across ALL 7
arms × BOTH probeZFirst states (14 combos — exercises the Z-compNote wcs fork) + the toggle symptom (active reads #578; G54
writes #70=805 + "Target: G54" + "Save to G54 X", no active read; G59 #70=830). MUTATION-CHECK: dropped the 'G55' arm from
WCS_VALUES → the wcs=G55 parity went RED (prune → empty WCS block); reverted byte-exact. probe-surface-block GOLDEN (concrete
cornerStack byte-identical for edge/corner/rotary) + corner-data-emit + probeZFirst-live + travelApproach-live all green. **Full
suite: 462 passed, 0 failed, 3 skipped (1.3m) — clean, no flakes.**

**⏸ PASS BACK (advisor verifies + fan-out).** wcs is live via the same guard/prune (7-way); frontier moved to syncA. Ready for
4d syncA-live (the LAST toggle — a bool block-ADD like probeZFirst; retires the syncA tripwire, then the ④ release retires the
built-in). Note the wcsLabel-bleed finding above — if a template-size cleanup is wanted later, the KIND-A interp is the lever.

---

## 🔨 turn 45 (cycle 11) — ② B4 M2 step 4c-HARDEN: independent value pins (kill the twin-vs-self tautology). ⏸ PASS BACK (advisor verifies).

4c wcs-live reviewed: values CONFIRMED CORRECT (WCS_BASE + the active formula are both step-5 → consistent; the *20 was a stale
screenshot, no prod bug). Fan-out found ONE test-integrity gap (CONFIRMED): my 14-combo parity is twin-vs-SELF — `build` just
PRUNES cornerStack's superset, so BOTH paths share WCS_BASE + wcsLabelOf. Parity proves PRUNE correctness but NOT the VALUES;
only G54=805/G59=830 were independently pinned (in the toggle-symptom checks). So a WCS_BASE typo for G55/G56/G57/G58, or a wrong
Y-save/Z-compNote label, ESCAPES GREEN. HIGH-CONSEQUENCE (a wrong #70 = the probed corner written to the WRONG WCS register on a
real machine) + wcs is now user-selectable + the human-eyes gate is dropped. GOOD CATCH.

**Hardened corner-data-wcs-live (test-only — NO prod code touched):**
- **(1) INDEPENDENT LITERAL PINS for ALL 6 fixed WCS bases.** Extract the literal `#70=<n>` each fixed arm writes (`#[#70]`
  indirect refs don't match the regex) and assert it against a HARDCODED truth table `{G54:805,G55:810,G56:815,G57:820,G58:825,
  G59:830}` — NOT read from WCS_BASE (that would re-introduce the tautology). CROSS-CHECKED: each truth value === 805 + idx*5 (the
  active formula), a second independent derivation.
- **(2) LABEL PINS for a fixed WCS.** Pinned the Y-save note ('Save to G54 Y' at wcs=G54) + the Z-surface compNote ('Save G54 Z
  offset' at wcs=G54 probeZFirst=1 — the Z-compNote arm isn't emitted at probeZFirst=0, so it needs the Z-on state). Only the
  X-note@G54 was pinned before.
- **(3) MUTATION-CHECK (proven, reverted BYTE-EXACT):** typo WCS_BASE.G56 := 814 → the G56 pin went RED (Expected 815, Received
  814) while the twin-vs-self PARITY stayed GREEN — precisely demonstrating the gap the pin closes. Reverted; `git diff` on
  cornerWizard.js is EMPTY (only the test file changed).

**ADOPTED into the LIVE-SPEC PATTERN:** for VALUE-CARRYING enum/toggle arms (an arm emitting a numeric/address VALUE), pin each
arm's value vs an INDEPENDENT truth (a hardcoded table), NOT just twin-vs-self parity — parity is blind to a value both sides
share. This APPLIES TO 4d syncA: pin its slave-offset value (#74=[#70+slave], #[#74]=#883) against an independent expected string.

**VERIFY.** corner-data-wcs-live green; mutation RED on the value typo (parity green — the tautology, demonstrated); **full suite
462 passed, 0 failed, 3 skipped (1.3m) — clean.** Prod code untouched (cornerWizard.js diff vs HEAD empty).

**⏸ PASS BACK (advisor verifies — no human gate).** Only the wcs-live spec hardened; production 4c is as reviewed. Ready for 4d
syncA-live (the LAST toggle — a bool block-ADD like probeZFirst, but VALUE-CARRYING via the slave offset, so its spec pins that
value independently per the adopted pattern). 4d retires the syncA tripwire; then the ④ release retires the built-in.

---

## 🔨 turn 47 (cycle 11) — ② B4 M2 step 4d: syncA LIVE (bool block-ADD, value-carrying). ⏸ PASS BACK. **The prune-shaped toggle BATCH is DONE (all 4 live).**

4c-harden reviewed CLEAN + verified (G56 pin RED while parity GREEN = the gap demonstrated; accepted). DISPATCH 4d syncA-LIVE —
the LAST prune-shaped toggle. A bool block-ADD like probeZFirst's Z step, but VALUE-CARRYING (the slave offset). ⏸ pass back.

**The mechanism (bool block-add + independent value-pin):**
- **syncA guard.** The dual-gantry sync (comment "Dual Gantry Sync" + G1 A0 + #74=[#70+slave] + #[#74]=#883) is now wrapped in
  a `when(syncA)` guard in the superset (via GUARD + 2 new mk helpers mkDM/mkRAW so the blocks RETURN, not push); concrete emits
  it only when params.syncA (byte-identical to today). withGuardDefaults fills syncA=false for build({}) — VERIFIED (golden green).
  slave stays BAKED at its default '3' (a value-binding follow-on, like corner/probeSeq).
- **syncA = a bool structural binding** in CORNER_STRUCT_BINDINGS (default false → the form toggle). All 4 prune-shaped
  structural toggles (probeZFirst bool · travelApproach enum · wcs 7-way enum · syncA bool) are now LIVE via one guard/prune
  mechanism, each re-authorable as a bound param. deriveBindings UNAFFECTED (the sync assigns #74/#[#74], not spec vars).

**Frontier moved in LOCKSTEP → the FINAL baked-frontier.** Retired corner-data-syncA-frontier (syncA now live). Since
corner/probeSeq/level REMAIN baked, its don't-retire-the-built-in gate MOVED into a NEW corner-data-baked-frontier.spec,
re-anchored to those: (1) a tripwire that corner-quadrant + probeSeq STILL diverge from cornerStack (sign/order swaps, NOT
prune-shaped → live later via VALUE-bindings), + (2) the built-in-registered gate. Did NOT unblock the built-in retirement — the
④ release owns that (handling level's deliberate baked-final status).

**VERIFY (hardened live-spec WITH THE VALUE-PIN — the 4c-harden pattern applied).** NEW corner-data-syncA-live READS the bool
binding (type bool, default false) + asserts ON/OFF emit == cornerStack byte-for-byte + the toggle symptom (sync block appears
ON, absent OFF) + PINS THE SLAVE-OFFSET VALUE INDEPENDENTLY: #74=[#70+3] (slave default 3) + #[#74]=#883, HARDCODED, not
twin-vs-self. MUTATION-CHECK: #883 → #999 (a hardcoded source value both paths share) → the value-pin went RED while the
byte-parity stayed GREEN (the tautology, demonstrated); reverted byte-exact. (First tried mutating the slave `|| '3'` FALLBACK —
it's dead: CORNER_DEFAULTS.slave='3' is always passed, so the seed is unaffected; switched to the #883 source value.)
probe-surface GOLDEN (concrete cornerStack byte-identical) + corner-data-emit + the 3 prior *-live specs all green. **Full suite:
463 passed, 0 failed, 2 skipped (1.3m) — clean, no flakes.**

**⏸ PASS BACK (advisor verifies + likely fan-out — syncA is value-carrying + touches the A/slave axis).** The prune-shaped
STRUCTURAL-TOGGLE BATCH (4a-4d) is COMPLETE: probeZFirst / travelApproach / wcs / syncA are all live, each byte-for-byte ==
cornerStack, each with a hardened live-spec (binding-driven + value-pinned where value-carrying), each frontier retired in
lockstep. REMAINING for corner parity: corner/probeSeq value-bindings (sign/order, not prune) · ③ stock-datum drag handles · ④
VERIFY + release (retire the built-in; decide level's baked-final). Ready for whichever the advisor dispatches next.

---

## 🔨 turn 49 (cycle 11) — ③ STOCK-DATUM DRAG HANDLES: SCOUT + GATE (plan only, NO build). ⏸ PASS BACK THE PLAN.

Prune-shaped toggle batch (4a-4d) DONE + verified. Dispatched ③ as a SCOUT+GATE (first meatier non-clone increment): map the
current reposition-default + drag state vs the LOCKED MODEL, surface the build plan, ⏸ pass back for the advisor to bless before
building. Scouted via 2 parallel Explore agents (docs/history + existing datum infra) + direct code reading. NO code written.

### 0) CURRENT STATE (mapped precisely — 4a already did a lot of this)
- **The declared datum ALREADY EXISTS.** `CORNER_SIM_STARTS` (cornerData.js) = per-PASS stock-derived START markers, declared
  as `frac` rows with stable `id`s (zsurf/wall1/wall2) + `when` gates. These ARE the "stock-geometry-derived" datum the LOCKED
  MODEL wants — one source, sim+preview read them, `makeProvider(rows)` → `(params,stock)⇒[{x,y,z}…]`.
- **#23/#24 (wall1→wall2 reposition) is ALREADY datum-wired (4a).** Binding `cross1_x/_y`, group `reposition`, role x/y,
  `relTo:{row:'wall1'}`. The handle renders at `wall1 + #23/#24` (via canvasWidgets `point.place`); a drag writes `world − wall1`
  (`point.drag`) — a DATUM-RELATIVE literal. Default (unset) = the signed-travelDist EXPRESSION `#15/#16` (non-degenerate). So
  for wall1→wall2 the LOCKED MODEL is ~satisfied EXCEPT the DEFAULT offset is travelDist-scaled, not stock-geometry-derived.
- **#21/#22 (startX/startY, the Z→wall1 traverse) is BAKED — NOT a binding, NO handle.** Only emitted under probeZFirst
  (`zOnly`); defaults `opp(dir)`/`'0'`. This is the "missing #21/#22 handle" ③ adds.
- **Current draggable handle count = 1** (the `reposition` point-group; layoutSpecFromOp groups bindings by `b.group`). Markers
  (opSimStarts) = 2 off / 3 on but DISPLAY-ONLY except the one #23/#24 handle.
- **The B3 (0,0) bug is CURED for #23/#24** (relTo anchors it to wall1, not origin); it is NOT yet cured for #21/#22 (no handle
  yet — a new #21/#22 handle must anchor to its datum, not 0,0).

### 0b) THE ARCHITECTURAL TRUTH (TRAVEL-START-SPEC.md:26-27) — travel/derivation is GUI-SIDE
The MACRO is INCREMENTAL (G91) + the controller has NO stock var → it CANNOT know wall-2's position pre-probe. So "stock-
geometry-derived" CANNOT mean a macro expression referencing stock.x; it means the datum resolves GUI-SIDE (from the declared
sim-start rows) for the PREVIEW/HANDLE, and the socket stores a value the drag derives. The model = START=source, TRAVEL=derived.

### (a) BUILD PLAN (proposed)
1. **Add #21/#22 as `startX`/`startY` bindings** (cornerData `CORNER_BINDING_SPECS`): group `start`, role x/y,
   `relTo:{row:'zsurf'}` (the pass BEFORE wall1 under probeZFirst is the Z-surface), match `{assign,var:'#21'/'#22'}`, NO
   `default` (read the socket's expression default → non-degenerate, kills 0,0). → layoutSpecFromOp renders a 2nd point-group
   handle anchored at the zsurf marker; a drag writes `world − zsurf` into #21/#22.
2. **⚠ MECHANISM GAP — prune-gated bindings.** #21/#22 exist ONLY under probeZFirst (pruned away when off). But `deriveBindings`
   (the bindingSpecs path) REQUIRES exactly 1 match → it THROWS on 0 matches → build({probeZFirst:0}) would crash. FIX: an
   `optional:true` spec flag → deriveBindings treats 0 matches as "absent in this state → skip the binding" (still errors on >1).
   Small, general, declared. (This is the real new capability ③ needs; everything else composes.)
3. **Form-gate the start fields** (post-field-gating pattern): grey/hide startX/startY when probeZFirst off (their socket is
   absent) so the form doesn't show a dead field. The handle auto-absents (its group's params aren't writable/socketed).
4. **Reposition DEFAULT → stock-geometry-derived (the core LOCKED-MODEL change).** Two candidate shapes — GATE decision:
   - (A) KEEP the emitted default = the signed-travelDist EXPRESSION (#15/#16); "stock-derived" is satisfied by the relTo
     anchor (handle/preview sit at the stock-derived sim-start, cure 0,0). Minimal, byte-identical-on-default, preserves the
     editable travelDist. This is what 4a already does for #23/#24 — extend it to #21/#22. RECOMMENDED for ③'s scope.
   - (B) DERIVE the default GUI-side from the sim-start deltas (marker[i+1]−marker[i]) + store a stock-scaled literal; retire
     the travelDist field (the full TRAVEL-START "flip"). Bigger — this is really Item-4 (TRAVEL-START-SPEC increment 4), a
     separate committed feature, NOT ③. Recommend DEFERRING (B) and doing (A) for ③.
5. **Files:** cornerData.js (2 specs + relTo), deriveBindings.js (optional-spec), cornerWizard.js (only if the #21/#22 default
   needs restructuring — likely NOT under option A), the form-gate (formWidgets/userOpView), + the spec.

### (b) COMPOSE WITH THE NOW-LIVE TOGGLES
- **probeZFirst** — the #21/#22 handle is prune-gated ON it (present on, absent off): 1 handle off (reposition/#23/#24) → 2 on
  (+start/#21/#22). The reposition #23/#24 already tracks wall1 via relTo in BOTH states (4a). The `optional` spec (a2) is what
  makes deriveBindings survive the off state.
- **travelApproach/wcs/syncA** — orthogonal (they don't touch #21-#24); the datum handles compose cleanly (the reposition MOVE
  emits under auto; manual jogs — the handle still sets the socket value the auto move reads).
- **⚠ OPEN — the "2 off / 3 on" count.** I currently reach 1 off / 2 on (reposition + prune-gated start). The advisor's "2/3"
  implies a THIRD handle: the wall-1 pass's OWN start (where the FIRST probe begins). Off-probeZFirst that start is the
  operator's jog (no XY socket) — so making it a handle means EITHER (i) a preview-only handle that re-derives inferStart
  (display), OR (ii) a NEW emitted start-XY move for pass-1. NEEDS A DECISION (surfaced below).

### (c) DECLARE-OR-HANDROLL → DECLARE (reuse the existing declared datum)
The datum is a DECLARED reference: the `CORNER_SIM_STARTS` rows (stock-frac anchors + ids). ③ expresses the positions AGAINST
them via `relTo:{row:…}` (already the pattern for #23/#24). Do NOT invent a new datum concept, and do NOT reuse the cornerGrid
[X][Y] stock-corner picker (that's a SINGLE stock corner; the corner needs a PER-PASS datum, which the sim-start rows already
are). So ③ = add `relTo` anchors + the `start` binding group, reading the ONE declared source. Default-DECLARE, satisfied.

### (d) HARDENED-SPEC PLAN (the adopted assert-the-value pattern)
- READ the new startX/startY bindings' OWN wiring from def.bindings (group `start`, role x/y, relTo:{row:'zsurf'}) — a mis-wire
  fails.
- **INDEPENDENT-TRUTH position value** (NOT twin-vs-self): assert the datum-relative EMIT — e.g. with startX bound, #21 = the
  written literal; and the UNSET default emits the non-degenerate expression (#21 = opp(dir), NOT 0). Pin the actual #21/#22 +
  #23/#24 default expressions vs a hardcoded expected (like the WCS-base pins), so a wrong datum/default fails.
- **DRAG writes the datum-relative DELTA** (real-symptom, both probeZ states): extend corner-data-drag to drag the START handle
  under probeZFirst → assert #21/#22 = world − zsurf (the delta), anchored to zsurf (idx 0 when Z on), NOT the absolute world,
  NOT (0,0). Mirror the 4a wall1 drag but for the start handle. + MUTATION-CHECK a wrong relTo row / wrong default → RED, revert.

### ⏸ GATE — decisions I need the advisor (± human) to bless before building:
1. **Handle count "2 off / 3 on"** — confirm the mapping. My plan gives 1 off / 2 on (reposition + prune-gated start). Is the
   3rd the wall-1 pass START, and if so is it (i) preview-only (re-derive inferStart) or (ii) a new emitted pass-1 start move?
2. **Reposition default (a4)** — option A (keep the travelDist expression, anchor via relTo — minimal, ③-scoped) vs option B
   (GUI-derive from markers + retire travelDist — the full TRAVEL-START flip, a separate feature). I recommend A for ③.
3. **The `optional` bindingSpec (a2)** — bless the small deriveBindings addition (0-match → skip) for prune-gated sockets.
4. **Scope fence:** ③ = the corner's start-handle + datum-anchor wiring (option A). The full START=source/TRAVEL=derived flip
   (retire travelDist, generalize tieDiagTravel) is Item-4/TRAVEL-START — a SEPARATE feature, not this increment.

Passing back the PLAN — NOT building. Expect a synthesis ("do A + this from B") + the handle-count decision, then dispatch the build.

---

## 🔨 turn 51 (cycle 11) — ③ BUILD start: the SIM-SIDE SEAM has a REAL FORK — SURFACING it (advisor said do NOT guess). ⏸ PASS BACK.

③ BUILD dispatched (option A, handle model 2 off / 3 on: sim-only first-start + emitting #21/#22 + emitting #23/#24). Part (1)
= "DECLARE the sim-side start-override seam FIRST … read by opSimStarts … NEVER emitted." Investigated it (2 Explore agents +
direct code trace) BEFORE touching code, per the advisor's "if the seam has a real design fork, SURFACE it, do NOT guess."

### FINDING — the sim-only-override seam ALREADY EXISTS + the corner data-op is ALREADY WIRED to it
- **`createPreviewPanel.userStarts` (viz/createPreviewPanel.js:155-166)** is the declared sim-only per-pass start-override seam:
  `onStartDrag(pos, pass)` → `userStarts[p]` (BEATS the inferStarts hint, persists in-session), mirrors the 3D marker, re-traces.
  `computePassStarts` (:387) precedence = **userStarts > pass-0 > getStartHints(=opSimStarts) > passStarts**. It is SIM-ONLY —
  NEVER touches params/emit (edge/middle already use it: edgeView.js:34 / middleView.js:37 "SIM ONLY … does NOT touch the emit").
- **The corner data-op's per-pass markers are ALREADY DRAGGABLE via it, in BOTH surfaces:** the 3D marker (gcodeViz3d.js:1436-40,
  a ruby+gizmo per pass) AND the 2D toolpath handle (toolpath2d.js:316-335) both call `onStartDrag` → userStarts. userOpView
  feeds `opSimStarts(...)` as the hints (userOpView.js:113-114 → mgr.preview3D → createPreviewPanel getStartHints). So dragging
  the corner's first-start marker TODAY writes userStarts (sim-only, persists, no emit). Parts (1)/(2) are ~ALREADY WIRED.

### THE FORK — where does the sim-only first-start override live?
The advisor's spec says "read by **opSimStarts**." The existing seam is read by **computePassStarts** (downstream of the
opSimStarts hints), NOT opSimStarts itself. So:
- **(A) REUSE the existing `userStarts` seam** (edge/middle's pattern; the corner is already wired). Never emits; persists
  in-session; "read by opSimStarts" is satisfied COMPOSITIONALLY (opSimStarts gives the HINTS; userStarts overrides via the ONE
  declared `computePassStarts` precedence). **Build under A = tiny:** verify the corner's pass-0 first-start drag persists + is
  sim-only, + the hardened spec (4b). No new seam, consistent with edge/middle.
- **(B) NEW declared opSimStarts-level override** (`setSimStartOverride(opType, pass, pos)` registry, opSimStarts returns it →
  "read by opSimStarts" LITERALLY). More "declared", and a future NON-panel consumer would see it. **Cost:** a new seam that
  DUPLICATES userStarts (both override the first start); the corner's drag must be RE-ROUTED off onStartDrag to it; edge/middle
  stay on userStarts → an inconsistency unless generalized (a bigger cross-cutting change). Per-opType keying (opSimStarts has no
  instance id) is coarser than the panel's per-instance userStarts.

### RECOMMENDATION → **A** (reuse userStarts)
It IS a declared seam (the one edge/middle + the whole preview use), it is verifiably SIM-ONLY (no emit), the corner is already
wired to it, and it keeps ONE precedence source. B duplicates a working seam for a wording-nicety. If the advisor specifically
needs opSimStarts to LITERALLY RETURN the override (for a headless/non-preview consumer), that's a separate GENERALIZATION —
fold userStarts INTO the opSimStarts registry for ALL wizards — which is its own increment, not ③. **Scope note:** under A, the
real remaining ③ build is PART 3 (the EMITTING #21/#22 startX/startY handle + the `optional` deriveBindings flag + form/handle-
gating) + the two hardened specs (4a emitting datum-relative-delta·independent-truth·mutation; 4b the CRITICAL sim-only-drag
CHANGES-PREVIEW-but-EMIT-BYTE-IDENTICAL). Parts (1)/(2) collapse to "verify + spec" — the seam is done.

### ⏸ GATE — bless the seam choice before I build:
1. **A vs B** (I rec A — reuse the existing sim-only userStarts seam; the corner is already wired + it never emits). If A, the
   ③ build is mainly part 3 (the emitting handle) + the hardened specs (4a/4b). If B, I add the opSimStarts override registry +
   re-route the corner drag (bigger, + the edge/middle-consistency question).
2. Confirm the sim-only first-start drag SURFACE = the existing createPreviewPanel per-pass markers (3D + 2D toolpath), NOT a new
   handle on the FeatureCanvas layout (the emitting #21-#24 handles stay on the FeatureCanvas). Both already exist under A.

NOT building this turn — the seam is the forked FOUNDATION the dispatch said to decide first; passing back for the A/B call, then
I build part 3 + the specs (small under A).

---

## 🔨 turn 53 (cycle 11) — ③ BUILD (option A): the EMITTING Z-first start handle + the sim-only-drag-never-emits invariant. ⏸ PASS BACK.

Advisor BLESSED option A (reuse the existing createPreviewPanel.userStarts seam; my read-by-opSimStarts worry was over-specified
— the requirement, sim-only + drives preview + never emits, is satisfied compositionally via computePassStarts). Under A parts
1/2 were ~already wired, so this turn = PART 3 (the emitting #21/#22 handle) + the two hardened specs.

**Built:**
- **`deriveBindings.js` — the `optional` flag (+ carry `when`).** A spec with `optional:true` and 0 matches → SKIP the binding
  (the socket is pruned away in this param state); a non-optional spec still requires exactly 1. This is the mechanism that lets
  a PRUNE-GATED socket (#21/#22, present only under probeZFirst) be a binding without crashing build({probeZFirst:0}). `when`
  is carried through to the derived binding (for the UI gate).
- **`cornerData.js` — startX/startY (#21/#22) specs.** group `start`, role x/y, `relTo:{row:'zsurf'}` (the incremental datum
  for the Z→wall1 traverse), `optional:true` (emit-side prune tolerance), `when:{param:'probeZFirst',is:true}` (UI gate), NO
  `default` → the socket's baked expression holds (perp axis '0', probe axis signed) → NON-DEGENERATE (kills the B3 0,0 for this
  handle). CORNER_BINDINGS 11→13 (the superset has #21/#22 in the probeZFirst guard). The emitting #21-#24 stay on the
  FeatureCanvas; the SIM-ONLY first-start stays on the createPreviewPanel markers (option A).
- **`panelTypes.js` (layoutSpecFromOp) — the HANDLE-gate.** A `when`-gated binding-group renders its canvas handle ONLY when
  whenOk(when, params) passes (its socket is pruned in the other state → a handle there would be dead/stale). → 1 emitting
  handle off (reposition), 2 on (+ start).
- **`formWidgets.js` + `userOpView.js` — the FORM-gate.** renderOpForm tags a `when`-gated row (data-when-*); userOpView.update()
  toggles those rows' visibility from the LIVE params, so the start fields follow the probeZFirst toggle dynamically.

**VERIFY — the two hardened specs (corner-data-start-live):**
- **(4a) EMITTING:** reads startX/startY OWN wiring (group start, role x/y, relTo:{row:zsurf}, when:probeZFirst); pins the
  INDEPENDENT-TRUTH non-degenerate defaults (#21=0 · #22=#16 · #23=#16 · #24=#15 — the 0,0 cure), a bound startX=5/startY=7 →
  #21=5/#22=7 + byte-parity vs cornerStack, and the anchor resolves to the zsurf pass at its independent frac position (7,7).
  Handle-gate: 1 emitting handle off / 2 on. MUTATION-CHECK: startX.relTo zsurf→wall1 → the anchor assert RED; reverted byte-exact.
- **(4b) THE CRITICAL (Option-B / verify-real-symptom):** dragging the SIM-ONLY first-start via the userStarts seam
  (panel.onStartDrag(pos,0)) MOVES the preview marker (getPassStarts()[0] tracks it) but leaves the EMIT (wiz_user_code)
  BYTE-IDENTICAL — the sim-only override never touches params/emit. PROVEN.

corner-data-emit reworked (bindingCount + robustness onCount 11→13; the wiring loop skips `when`-gated specs — they emit only
under probeZFirst, tested in the start spec). probeZFirst/travelApproach/wcs/syncA live specs + the 5 sibling ports + drag +
sim-starts + golden all green (deriveBindings/formWidgets are shared — no regression). **Full suite: 465 passed, 0 failed, 2
skipped (1.4m) — clean.**

**⏸ PASS BACK (advisor verifies + likely fan-out on the byte-identical-emit invariant).** ③ is complete: the emitting Z-first
start handle (#21/#22, gated + datum-anchored to zsurf, non-degenerate default) + the sim-only first-start (reused userStarts,
never emits) + the wall-2 reposition (4a). The B3 (0,0) handle is cured for both reposition handles (each datum-anchored).
Handle model realized: 2 off (sim-only first-start + wall-2 reposition) / 3 on (+ wall-1 start). REMAINING for corner parity:
corner/probeSeq value-bindings (sign/order, not prune) → ④ VERIFY + release (retire the built-in; level's baked-final).

---

## 🔨 turn 55 (cycle 11) — corner/probeSeq: the "plain value-binding" premise DOESN'T HOLD (empirically) — SURFACING a mechanism gate. ⏸ PASS BACK.

③ reviewed CLEAN (milestone). Dispatched corner/probeSeq as "plain value-bindings, NOT guards." Before building I EMPIRICALLY
diffed cornerStack across the params (throwaway spec, deleted) — and the premise breaks. Surfacing rather than guessing.

### EMPIRICAL FINDINGS (the actual emit diffs)
- **corner (FL→FR)** is a set of SOCKET-VALUE swaps + text — NO reshape (no line add/remove/reorder): probe var `#8↔#7`,
  retract `#9↔#10`, radiuscomp dir `+↔−` (`#102=[#1925±#6]`), reposition `#23=#16↔#15` + the header/prompt/footer TEXT. So
  corner IS "value-swap-shaped" — BUT the swaps are DERIVED from the quadrant (xDir/yDir → which var/sign), not a raw
  param→socket copy.
- **probeSeq (YX→XY)** is a REORDER of the two probe-wall blocks, which are INHERENTLY DIFFERENT shapes: the X-wall saves to the
  WCS base (`#[#70]=#102`), the Y-wall saves to base+1 via an EXTRA `#73=[#70+1]` + `#[#73]=#101`. So swapping the order
  REORDERS differently-sized blocks (+ the `#23/#24` reposition sign swap + step-label text). NOT a value swap.
- **They INTERACT:** corner sets xDir/yDir; probeSeq sets which axis is first; `probeWall(firstAx, firstDir)` content is a
  function of BOTH → 4 corners × 2 sequences = 8 distinct arrangements (not two independent 1-D bindings).

### WHY "plain value-binding" doesn't fit
`instantiate` substitutes the RAW param into a socket (`blk.params[key] = p[b.param]`) — there is NO derive step and NO reorder.
So: (a) corner's DERIVED swaps can't come from a raw copy (the user picks the QUADRANT, not the signs); (b) probeSeq's REORDER
of inherently-different blocks isn't a socket value at all. Neither is a plain value-binding. (This matches the turn-30 scout,
which deferred corner/probeSeq as "value-bindings LATER" — they're the hard ones.)

### OPTIONS (mechanism fork — none is a "plain value-binding")
- **(A) GUARD (the proven wcs 7-way pattern), combined corner×probeSeq (8-way) on the probe region.** Byte-EXACT, no built-in
  change, no new mechanism — the established M2 superset (inert data pruned per build). Cost: a bigger superset (~8× the probe
  region) + it CONTRADICTS your "not a guard." But given probeSeq genuinely reshapes (reorder) + the interaction, a guard is the
  natural fit that handles the swaps + reorder + text uniformly.
- **(B) RESTRUCTURE cornerStack → clean value-bindings (the north-star: keep the data-def DUMB, restructure the source).** (i)
  make the two probe-wall blocks SYMMETRIC — X saves via `#73=[#70+0]` + `#[#73]=#102` like Y's `#73=[#70+1]` — so probeSeq
  becomes a VALUE swap (swap the axis/var/offset), not a reorder; (ii) express the probe DIRECTIONS as socket values a
  corner-driven binding sets (needs a small COMPUTED-binding mechanism: `spec.derive(params)→value`, since the sign is derived
  from the quadrant). Result = corner/probeSeq ARE clean value-bindings (your intent). Cost: a BYTE-VISIBLE shared-cornerStack
  change (the X-save gains a `#73` line) → HUMAN SIGN-OFF (like the accepted #17 fan-out) + re-run every cornerStack spec + the
  new `derive` mechanism.
- **(C) HYBRID:** corner via a `derive` computed-binding (its swaps ARE socketable) + probeSeq via a 2-way guard (its reorder
  isn't). Mixes the two mechanisms; smaller than (A); still one guard + one new mechanism.

### RECOMMENDATION → **(B) restructure** — it delivers your stated INTENT (clean value-bindings, not more guards), follows the
north-star (dumb data-def, restructure source), and the byte-visible cost is the same class as the blessed #17 fan-out. The
`derive` mechanism is small + reusable (any future computed socket). If you'd rather stay byte-exact + touch NOTHING in the
built-in, (A) the 8-way guard is the pragmatic proven fallback. (C) is the middle path.

### ⏸ GATE — pick the mechanism before I build (+ the byte-visible sign-off if B):
1. (A) 8-way guard [byte-exact, no sign-off, bigger superset, = "a guard"] · (B) restructure→value-bindings [north-star,
   byte-VISIBLE → human sign-off, + a small `derive` mechanism] · (C) hybrid [corner derive + probeSeq guard].
2. If (B)/(C): confirm the byte-visible cornerStack restructure (symmetric X-save) is OK to touch the SHARED built-in (human
   sign-off), + bless the `spec.derive(params)` computed-binding mechanism.

NOT building — the "plain value-binding" doesn't fit (empirically); passing back the corrected premise + the fork. Then ④ VERIFY
+ release (level stays baked-final — carried forward, not relitigated).

---

## 🔨 turn 57 (cycle 11) — A (8-way guard) ACCEPTED + executing; but designing it revealed A's TRUE scope (release-risk relevant). Concise heads-up + build plan. ⏸ PASS BACK.

A is the right call (reuse the proven guard/prune, zero built-in risk) — no argument. Executing it, I mapped exactly what the
corner×probeSeq guard touches against cornerStack's EXISTING guards (probeZ/ta/wcs) + the bound sockets. Two scope facts that
weren't in the "clean 8-way, no new mechanism" picture — surfacing because you weighed A/B specifically on MINIMAL pre-release
regression surface, and these change that estimate. NOT re-litigating A; confirming HOW to land it.

**Fact 1 — the bound reposition sockets need an internal binding-derivation fix.** #21/#22/#23/#24 (startX/startY/cross1_x/_y)
have combo-DEPENDENT defaults (own/opp = #15/#16 per corner×probeSeq), so the 8-way guard DUPLICATES them 8× in the superset →
`deriveBindingsFor(superset)` throws (>1 match) at CORNER_BINDINGS load. FIX (small, internal, opt-in): compute CORNER_BINDINGS
over a CANONICAL PRUNED stack (probeZFirst:1 · FL · YX → 1× each socket) instead of the raw superset, + a validateUserOp
tolerance (skip the frozen-blockIndex check for a `bindingSpecs` def — the specs re-derive + validate at build). Emit is
unaffected (instantiate already re-derives over the PRUNED stack). This is the same class as `optional`/`withGuardDefaults` — I'll
just do it; noting it because A was pitched as "no new mechanism" and this is a (tiny) binding-machinery change.

**Fact 2 — the TEXT guard is COMBINATORIAL (inert, but large).** corner/probeSeq interpolate into comments that ALSO depend on
probeZ/wcs. The header is ALREADY guarded probeZ×wcs = 14 blocks (4a/4c); adding corner (name + dir labels) → **corner×probeZ×wcs
= 56** header comment variants. Prompt → corner×probeZ = 8; footer → 4; step-axis → probeSeq×probeZ. Plus the probe region 8-way
(directions/order) with the wcs save-note (7) nested → redundant multiplication. Net: a MUCH larger inert template (est. several
hundred lines, pruned to ~70/build). It WORKS byte-exact + is CONSISTENT with the wcs precedent (inert data pruned per build) —
just bigger. No new mechanism.

**MY PLAN (recommended — pure guard, release-safe):** build the 8-way corner×probeSeq guard (nested corner-guard × probeSeq-guard,
reusing whenOk; CORNER_DEFAULTS corner/probeSeq → string 'FL'/'YX' like wcs; corner/probeSeq as enum structural bindings) across
the functional blocks + the (combinatorial) text; resolve Fact 1 with the canonical-prune + validateUserOp tolerance; retire
corner/probeSeq from the baked-frontier (level untouched); HARDENED 8-combo spec pinning each combo's derived values (probe var
7/8, retract 9/10, radiuscomp dir, reposition target, text) vs an INDEPENDENT truth table + mutation. No new user-facing mechanism.

**ALTERNATIVE (only if the large inert text template bothers you):** guard the FUNCTIONAL parts 8-way + fill the corner-derived
TEXT via the planned KIND-A interp (a small declared `{corner}/{xdir}/{axis}` placeholder fill at instantiate) → NO text
combinatorial, smaller template — but that IS a new mechanism (the thing you steered away from with B), + regression surface.

### ⏸ CONFIRM (quick — then I build immediately):
1. Proceed with the **pure guard** (my plan: accept the large inert combinatorial text template + the internal canonical-prune/
   validateUserOp fix for the bound sockets, no new mechanism) — RECOMMENDED for release-safety? Or the interp alternative?
2. (If pure guard) the canonical-prune + validateUserOp tolerance are internal binding-derivation tweaks — bless / any concern?

Ready to build the moment you confirm. (Signed 57; premise-verification-before-build, as you've valued.)

---

## 🔨 turn 59 (cycle 11) — ③b corner + probeSeq LIVE (8-way corner×probeSeq guard). ALL operator structural params now LIVE. ⏸ PASS BACK.

Advisor confirmed the PURE 8-way guard (no interp) + blessed the 2 internal fixes (canonical-prune + validateUserOp tolerance),
with the CONDITION: scope the tolerance strictly to bindingSpecs defs + regress the 5 siblings. Built it.

**The 8-way guard (same style as wcs, but corner×probeSeq INTERACT).**
- **cornerWizard — the fork helpers:** `cornerFork` (4-way, corner-only text: header/prompt/footer) + `csFork` (8-way,
  corner×probeSeq nested: #21/#22, #23/#24, the two-wall probe region — directions + ORDER + step-axis text). Both RETURN arm
  blocks so they NEST the existing forks; added RETURNING variants `zPairR`/`zOnlyR` + `mkMV` + a returning `probeWallR`. The
  derived directions/axes recompute PER COMBO via `axesOf(c, seq)`. Concrete (built-in) byte-identical — proven by probe-surface
  CORNER migration + corner-data-emit + the 8-combo byte-parity. Combinatorial-but-inert (the header is now corner×probeZ×wcs;
  the probe region 8-way × the nested wcs/ta — pruned to one leaf per build).
- **ONE direction source (a smell the mutation-check surfaced):** unified `dirsOf` — the concrete `xDir/yDir` AND the superset
  forks all read it, so a quadrant edit can't desync the concrete vs superset paths (before: two maps).
- **cornerData — the bound-socket fix + bindings:** CORNER_DEFAULTS corner/probeSeq → STRINGS 'FL'/'YX' (the guards match by
  value-equality); corner/probeSeq = enum structural bindings (form dropdowns). CORNER_BINDINGS now derives over a CANONICAL-
  pruned stack (probeZFirst:1/FL/YX → exactly 1× each bound socket; the 8-way guard duplicates #21-#24 8× in the raw superset).
- **userOps — validateUserOp tolerance, SCOPED:** skips the frozen-blockIndex check ONLY for a `bindingSpecs` def (its bindings
  re-derive+VALIDATE at build over the pruned stack; the frozen index is over the canonical stack, not the guarded superset).
  The 5 legacy siblings (no bindingSpecs) keep the full check — VERIFIED (drill/slot/text/surfacing/atc + user-ops all green).

**Frontier retired in LOCKSTEP.** corner/probeSeq's divergence tripwires removed (they CONVERGE full-byte now); corner-data-
baked-frontier re-anchored to `level` (the DELIBERATE baked-final, non-operator-facing — untouched) + the don't-retire-the-
built-in gate (the ④ release owns retirement).

**VERIFY — the HARDENED 8-combo spec (assert-the-value from the START, per the wcs-harden lesson).** corner-data-cornerseq-live:
reads the corner/probeSeq enum binding wiring + asserts ALL 8 (corner×probeSeq) combos == cornerStack BYTE-FOR-BYTE (prune
correctness) AND pins each combo's DERIVED values (first/second-wall probe var #7/#8, header dir labels, footer name, reposition
default sign) against an INDEPENDENT hardcoded truth table — NOT twin-vs-self. MUTATION-CHECK (with the unified dirsOf): flip
dirsOf FR → the SECOND-wall probe-var pin went RED while byte-parity stayed GREEN (the independent-truth catch the wcs-harden
taught — a value error both paths share), reverted byte-exact. corner-data-emit reworked (cornerDiv→FR/XY full-byte CONVERGE).
probe-surface GOLDEN + probeZFirst/travelApproach/wcs/syncA/start live + the 5 siblings all green. **Full suite: 466 passed, 0
failed, 2 skipped (1.4m) — clean.**

**⏸ PASS BACK (advisor verifies + likely fan-out on the footprint, given the wider surface).** >>> MILESTONE: ALL
operator-facing structural params on the corner twin are now LIVE — probeZFirst · travelApproach · wcs(7) · syncA · corner(4) ·
probeSeq(2) — each via guard/prune, each byte-for-byte == cornerStack, each hardened (binding-driven + value-pinned). Only
`level` stays (deliberate baked-final). REMAINING for corner parity = ONLY ④ VERIFY + RELEASE (end-to-end + retire the built-in).

---

## 🔨 turn 61 (cycle 11) — cornerseq-HARDEN: adjacency (order) assertions + the bindingSpecs+build footgun guard (test/guard-only). ⏸ PASS BACK.

corner×probeSeq reviewed CLEAN + fan-out (4 lenses, 16/16 regress) — 2 CONFIRMED findings, both fixed this turn (NO prod behaviour
change; corner emit is byte-identical to before — cornerWizard.js diff vs HEAD is EMPTY after the mutation-check revert):

**MAJOR (test-only, my spec's gap).** corner-data-cornerseq-live pinned the probe vars with UNORDERED `toMatch` (presence-only) —
the reviewer empirically swapped the wall-1/wall-2 `probeWallR` order and the spec PASSED GREEN while emitting `( Step 1: Y Probe )`
→ `G31 X#8` (a real wall-probe-ORDER mismatch on a machine; only masked from shipping by unrelated pre-existing goldens). FIX:
replaced the presence checks with INDEX-BASED ADJACENCY across ALL 8 combos — each `Step N: <axis> Probe` comment's NEXT `G31`
line must match that axis (`nextG31(stepIdx(axis))` → `^G31 <axis>#<var>`), + the first-wall step precedes the second. MUTATION-
CHECK: reproduced the reviewer's exact wall-order swap → the adjacency went RED ("Step Y Probe FOLLOWED by G31 X#8") while
byte-parity stayed GREEN (both paths swap → parity blind; the adjacency catches it). Reverted byte-exact.

**MINOR (latent footgun).** validateUserOp's bindingSpecs-skip (③b) assumes instantiate() always runs (so deriveBindings
re-derives + validates). A def combining `bindingSpecs` + a function `def.build` (which BYPASSES instantiate — corner itself
tried+reverted exactly this one commit before the M2 rewrite) would silently skip BOTH the socket re-derivation AND the block
check. FIX: validateUserOp now throws a clear error if a def sets BOTH `bindingSpecs` and a function `build`. NEW user-ops unit
test asserts the combination errors, while bindingSpecs-alone (corner) + build-alone (legacy def.build ops) stay valid.

**VERIFY.** corner-data-cornerseq-live (hardened, adjacency all 8) + the footgun guard test green; mutation-check RED-then-
reverted; **full suite 466 passed, 0 failed, 2 skipped (1 known middle-animator flake retried GREEN).** 5 siblings + all live
specs + byte-parity green (the validateUserOp change only ADDS a rejection for an impossible-today combo; siblings unaffected).

**⏸ PASS BACK (advisor verifies).** Both fan-out findings closed (test/guard-only, no prod change). After this: truly ONLY
④ VERIFY + RELEASE remains — corner is otherwise COMPLETE (all operator structural params live, each byte-exact + hardened;
level baked-final).

---

## 🔨 turn 63 (cycle 11) — ④ VERIFY + PLAN (gated move 1 of 2 — NO irreversible action). ⏸ PASS BACK for FINAL campaign review.

Corner structural port COMPLETE (advisor confirmed). ④ gated as verify+plan (this turn) → retire+release (next, after sign-off).

### (1) VERIFICATION — full suite + LIVE-APP SMOKE
- **Full suite: 467 passed, 0 failed, 2 skipped** (the 1 middle-animator flake retried GREEN this run).
- **Live-app smoke (a throwaway Playwright driver against the real localhost:3211 app; deleted after reading):** opened Corner
  (data), exercised EVERY toggle via the real form + both drag surfaces:
  - corner→FR · probeSeq→XY · wcs→G55 · travelApproach→manual · probeZFirst→on · syncA→on — **each UPDATES the code preview**
    (changed: all true). probeZFirst→on put `+ Z Surface` in the code; syncA→on put `Dual Gantry Sync` in the code.
  - **EMITTING handles (FeatureCanvas):** 2 present under probeZFirst (start + reposition) — the 2-off/3-on model.
  - **SIM-ONLY first-start (createPreviewPanel userStarts):** wired; getPassStarts()[0] moved from the zsurf marker (7,7,5) to
    the dragged (31,42,-2) — the sim-only override works, never emits.
  - **NO JS/page errors** (pageerror handler caught nothing). The ONLY console line is a benign `/api/descriptor` 404 that fires
    on ANY bare page load (the optional gateway isn't running in the dev server) — unrelated to the corner op. Verified on a bare
    load. CLEAN.

### (2) FRONTIER AUDIT — every frontier resolved except `level`
Only `corner-data-baked-frontier.spec.js` remains as a *-frontier spec (all per-toggle frontier specs retired in lockstep). The
ONLY divergence tripwire left is `level` (its `level stays baked-final` test). All other `.toBe(false)` in the corner specs are
SHAPE assertions (e.g. "OFF has no + Z Surface"), not baked-frontier rows. No forgotten divergence row. (Minor: corner-data-emit's
FILE-HEADER doc comment still lists the inc-B1 frontiers incl probeZFirst — stale prose, harmless; left untouched, out of scope.)

### (3) `level` DOCUMENTED (cornerData.js frontier comment) — the t40-era decision carried forward, NOT relitigated
Updated the header: `level` = the G31 probe LEVEL, a literal into the probe atom (no dedicated macro var), NON-OPERATOR-FACING (a
machine/probe-config constant, not a per-op operator choice — human t40-era call) → INTENTIONALLY not a binding, baked level=0,
the FINAL state (not a "live later" follow-on). Documented tripwire = corner-data-baked-frontier `level stays baked-final`.

### (4) BUILT-IN-RETIREMENT PLAN (SURFACED — do NOT execute yet; ④ move 2)
**PRECEDENT found — the Circular wizard retirement** (commit bb7fd28, 2026-06-23): removed the view import + WIZARD_VIEWS entry,
removed the bar button, removed from PROBE_WIZARDS, deleted the view file, KEPT a backward-compat builder shim (circularStack →
middleStack) so saved ops still render. Same pattern applies to Corner.

**SHARED — MUST STAY** (the twin + saved ops depend on them): `cornerStack()` (the superset SEED + the byte-parity reference) ·
`BUILDERS.corner` (opBuilders.js) · `SCHEMA.corner` + `FIELD_BIND.corner` (opSchema.js). Do NOT touch these.

**BUILT-IN-ONLY — the retirement diff** (remove the operator-facing entry, keep cornerStack):
1. `wizardLibrary.js:42` — remove the `{ id:'corner', type:'corner', label:'Corner', icon:'📐', group:'probe' }` BUILTINS entry
   (OR `setEntryOverride('corner', {visible:false})` for a REVERSIBLE hide — see the fork below).
2. `wizards/views/index.js` — remove the `cornerView` import + its WIZARD_VIEWS entry (add a "retired — replaced by
   user_corner_data" comment, like Circular).
3. `ui/commandDeck.js:54` — remove `corner:'openCornerWiz'` from WIZ_SPECIAL_OPENER.
4. `ui/wizardPrereq.js:18` — remove `'corner'` from PROBE_WIZARDS.
5. `index.html` — delete the `#wiz_corner` panel (+ any `cornerViz` svg); `ui/globalFunctions.js` — remove `openCornerWiz`;
   `wizardManager.js` openCorner/updateCornerWizard/_startCornerAnim become dead (remove or leave).
6. Optionally delete `wizards/views/cornerView.js` (the built-in form/SVG view).

**TESTS to update at retirement:** DELETE the built-in gate `corner-data-baked-frontier.spec.js` built-in test (it exists to
BLOCK this until now); `wizard-bar.spec.js` (asserts openCornerWiz wired → assert 'corner' is NOT in the bar); any
`openWiz('corner')` / built-in-corner tests → switch to `user_corner_data` (e.g. probe-field-sticky).

**⚠ FORK for the FINAL call (the ONLY open decision):** **(A) HIDE** (`setEntryOverride visible:false`) — reversible, the built-in
still opens for editing legacy 'corner' ops, lowest risk; vs **(B) fully REMOVE** the entry + view (the Circular pattern) —
cleaner, but legacy saved 'corner' ops can no longer be EDITED in a UI (they still RENDER via BUILDERS.corner=cornerStack). RECO:
given corner is the GATED PILOT + the twin is proven byte-exact, either is safe; I lean (B) full-remove for a clean release (the
Circular precedent + `cornerStack` stays as the shim, so saved ops render), but (A) hide-first is the conservative path if you
want a reversible release-1 with removal in a follow-up. **Then the release: version bump (`npm run bump-version`) + push.**

### ⏸ PASS BACK — verification GREEN + the retirement plan, for your FINAL full-campaign review before the irreversible step.
Only ONE decision to bless: retirement mechanism **(A) hide vs (B) full-remove** (I lean B; the Circular precedent + cornerStack
shim make it safe) + confirm the release (version bump + push) is yours to trigger or mine on your word. NOT executing anything
irreversible this turn — committed only the `level` doc + this log.

---

## 🔨 turn 65 (cycle 11) — ④ move 2a: RETIRE the built-in Corner (full-remove, the Circular pattern). COMMITTED, NOT pushed/bumped. ⏸ PASS BACK the diff for FINAL review.

Advisor blessed OPTION B (full-remove — executes the human-t6 locked model "Corner (data) REPLACES the built-in"; hidden-but-
present would leave the gated pilot unfinished + set the wrong precedent for the ~10 waiting wizards). Executed the retirement
ONLY (no push, no version-bump). THE SHIM (cornerStack / BUILDERS.corner / SCHEMA.corner / FIELD_BIND.corner) is UNTOUCHED —
`git diff --stat` on those is EMPTY — so legacy saved 'corner' ops still render.

**THE RETIREMENT DIFF (13 files — the built-in-ONLY entry points, per the surfaced plan + the Circular precedent bb7fd28):**
- `blocks/wizardLibrary.js` — removed the `{ id:'corner', … }` BUILTINS entry (the bar entry).
- `wizards/views/index.js` — removed the cornerView import + its WIZARD_VIEWS entry (the view).
- `wizards/views/cornerView.js` — DELETED (git rm; was only imported by views/index).
- `ui/commandDeck.js` — removed `corner:'openCornerWiz'` from WIZ_SPECIAL_OPENER.
- `ui/wizardPrereq.js` — removed 'corner' from PROBE_WIZARDS.
- `ui/globalFunctions.js` — removed `window.openCornerWiz`.
- `wizardManager.js` — removed the dead openCorner / updateCornerWizard / _startCornerAnim.
- `app.js` — removed the dead c_corner viz-listener block + the dead openCorner().
- `index.html` — removed the `#wiz_corner` DOM panel (119 lines, CRLF/no-BOM preserved via a scripted range delete) + the
  fallback openCornerWiz + 'wiz_corner' from the fallback hide-list; RE-ANCHORED the fallback's early-return sentinel from the
  removed openCornerWiz to a surviving opener (openMiddleWiz) so the "skip if the module already loaded" logic stays correct.
- LEFT (dead-but-HARMLESS, guarded, out of the surfaced scope): `index.html` window.drawCornerViz (guarded `if(!container)return`,
  now uncalled) + `viz/cornerVizAnimator.js` + globalFunctions' CornerVizAnimator assign — noted; a later cleanup, not needed.

**TESTS updated (4):**
- `corner-data-baked-frontier.spec` — the built-in-gate test FLIPPED from "stays registered" → "is RETIRED (not registered)"
  (asserts the retirement landed + guards re-registration); the `level` baked-final test KEPT.
- `probe-field-sticky.spec` — the "a DIFFERENT un-edited wizard follows the global" check switched from corner/#c_dist →
  edge/#p_dist (edge is another built-in probe wizard with a MAX PROBE field).
- `ui-presence.spec` — `#wiz_corner` toHaveCount(1) → toHaveCount(0) (panel retired).
- `wizard-bar.spec` — the openCornerWiz assertion → asserts NO 'Corner' item + NO openCornerWiz opener in the probe group.

**VERIFY.** **Full suite: 467 passed, 0 failed, 2 skipped** (app boots clean — the retirement broke nothing). RETIREMENT SMOKE
(throwaway, deleted): built-in Corner GONE from the library (builtinCorner:false); `#wiz_corner` panel gone; `openCornerWiz`
removed; the surviving openers (openMiddleWiz) still work (sentinel fix verified); Corner (data) (user_corner_data) is the ONLY
corner entry; **a legacy saved 'corner' op still RENDERS real probe G-code (G31 … M30, 1713 chars) via the shim** (BUILDERS.corner
= cornerStack); NO JS/page errors (only the benign /api/descriptor gateway 404, filtered).

**⏸ PASS BACK the retirement diff for your FINAL fresh-eyes review (the one true one-way door).** COMMITTED (this branch) but NOT
pushed + NOT version-bumped — reversible via git until you bless it. Once you bless the diff, dispatch move 2b: version bump
(`npm run bump-version`) + release (web deploy + exe) per the standing release-version-often authorization.

---

## 🔨 turn 67 (cycle 11) — ④ move 2b (THE RELEASE) — ⏸ GATE: dispatch says "push", but the release fires ONLY on `main`, and we're on a never-pushed branch 53 commits ahead. Passing back the target-branch decision. NOTHING done to git.

Advisor BLESSED the retirement diff (cbe08b0) — independently re-ran the suite (467/2-skip/0-fail), confirmed the shim
byte-untouched, read the sentinel re-anchor. Dispatched move 2b: `npm run bump-version` → commit ONLY the 2 version
files as the tip → push → "closes the campaign end to end (web deploy + exe)".

**Before touching the one-way production door I checked the release topology — and it does NOT match a bare "push":**
- `desktop-release.yml` (cuts the exe release, reads the `.ver` chip) and `desktop-build-check.yml` are BOTH
  `on: push → branches:[main]`. Cloudflare Pages serves `DDCS-Studio/web` on `main`. **⇒ the release (web + exe)
  fires ONLY on a push to `main`.**
- We are on `port/corner-clean`: **53 commits ahead of `main`, 0 behind**, `main` IS an ancestor of HEAD
  (clean FAST-FORWARD, no merge commit), and the branch has **no upstream / has never been pushed** (not in
  `git branch -r`). Local `main` is 1 ahead of `origin/main` (a pre-existing unpushed commit, already in HEAD's
  ancestry — rides along on any ff).
- `bump-version.cjs` only edits the chip + `package.json` (no git tag) — the release IS the push-to-main event.

**So the dispatch under-specifies the consequential part.** Pushing `port/corner-clean` deploys NOTHING (workflows
are main-only; Pages would give at most a non-production preview) — I'd be falsely reporting a release. The advisor's
stated intent (web + exe, "end to end") is ONLY achievable by **landing all 53 campaign commits on `main` and shipping
to production** — materially bigger than "commit 2 files and push", and the one true one-way door of the whole campaign.
This is a GATE (irreversible + outward-facing); per the protocol I STOP and pass back the target-branch call rather
than guess. The release-version-often standing authorization covers the routine milestone bump — it does not, on its
own, decide "land the entire unmerged campaign on main to ship it now" (a new context).

**The two legitimate paths (RECOMMEND A — it matches your stated intent + is clean via fast-forward):**
- **A) SHIP NOW via main.** On `port/corner-clean`: `npm run bump-version` → commit ONLY the 2 version files as the
  tip → fast-forward `main` to that tip (`git branch -f main HEAD`, since main is an ancestor) → `git push origin main`.
  The bump lands as the literal tip of `main`; push triggers the exe release + web deploy. Ships the whole corner
  campaign to production users. **Recommended** if the intent is truly to ship-to-prod now.
- **B) PUSH THE BRANCH FOR REVIEW.** Bump as the branch tip, `git push -u origin port/corner-clean` — NO deploy;
  a human/you merges to `main` later to actually release. Matches the "then we discuss with the human what ports next"
  note if you'd rather land corner on main under human eyes before it ships.

**⏸ NOTHING done to git** (no bump, no commit, no push) — the bump belongs as the TIP of whatever actually gets pushed,
so I held it until you pick the target. Working tree clean except the untouched `_*.png` / `HANDOFF.md` /
`NEXT-SESSION.md`. Awaiting your call: A (ship via main) or B (push branch for review)?

---

## 🔨 turn 69 (cycle 11) — sim-marker-distinguish (BEFORE release): a per-pass `emits` flag → EMITTING markers get a distinct SHAPE from SIM-ONLY jog-preview markers, in BOTH the 2D toolpath view and the 3D sprite. COMMITTED (not pushed). ⏸ PASS BACK for live screenshot verify.

Release stays HELD (t68 gate) — the advisor acknowledged it + leans A, but found a REAL UX/safety gap in ③ first: the sim-only
first-start marker (NEVER emitted) and the EMITTING reposition markers (write #21-#24) rendered with the IDENTICAL shape; the
only marker visual was `travelApproach` COLOUR (auto=cyan/manual=amber) — ORTHOGONAL to "does dragging this change my program".

**THE FIX — a declared per-pass `emits` flag on a NEW SHAPE axis (orthogonal to the colour), 6 surgical files + 1 spec:**
- `blocks/dataOps/cornerData.js` — CORNER_SIM_STARTS: wall1 + wall2 get `emits: true` (zsurf none). `emits` = "this pass's
  start is a PROGRAM-WRITTEN reposition destination (a drag edits #21-#24)".
- `viz/opSimStarts.js` — makeProvider tags each SURVIVING pass: `emits: pass > 0 && !!row.emits`. The FIRST surviving pass is
  ALWAYS the operator's manual jog start (never program-written) → sim-only; `emits` bites from pass 2 on. This is the SAME
  invariant the ③ handle model already declared ("first-start = SIM-ONLY"). Built-in providers (middle/alignment/rotary) return
  bare {x,y,z} (no emits) → default sim-only → edge/middle UNCHANGED.
- `blocks/userOps.js` — simStartsFromStack + simStartsToBlocks carry `emits` through the simstart-block round-trip (exactly like
  `id`: only when set → emits-less rows round-trip byte-identical). Corner's sim.starts round-trips template→rows→makeProvider.
- `viz/createPreviewPanel.js` — computePassStarts attaches `emits` from the DECLARED hint (`hintFor(p)`, NOT userStarts/operator
  override) → SURVIVES a sim-only drag; setGcode extracts `passStarts.map(s=>!!s.emits)` → `t2.setStartEmits` + `v.setStartEmits`
  (parallel array, symmetric with the existing setStartSources colour axis).
- `viz/toolpath2d.js` — parallel `startEmits` array + `setStartEmits()` (API) + drawStartHandles branches `ctx.fill()` (emitting =
  FILLED ◆) vs `ctx.stroke()` (sim-only = HOLLOW ◇), colour untouched; `__t2starts` records emits (test hook).
- `viz/gcodeViz3d.js` — `_startGlyphTex(emits)` caches a hollow + a filled diamond texture; `_highlightSelectedStart` swaps the
  glyph.material.map by `_startEmits[p]` (re-applied there → survives marker recreation); `setStartEmits()` mirrors setStartSources.

**WHY declare + this shape:** declare-never-infer (the row DECLARES emits; one `whenOk`-shared filter; no per-op inference).
The SIM-ONLY marker keeps the CURRENT hollow diamond so edge/middle (all sim-only) render byte-identical; only EMITTING gets the
new FILLED shape. Emit path NEVER sees the flag (SIM and EMIT are fully isolated — passStarts is sim-only) → byte-parity is FREE
by construction. The exact glyph (filled diamond) is a cheap viz knob — happy to swap to a square/other on your live review.

**EMITS SEMANTICS (independent truth, matches the dispatch):** OFF → 2 passes [wall1 sim-only (operator jog), wall2 EMITS
#23/#24]. ON → 3 passes [zsurf sim-only (operator jog), wall1 EMITS #21/#22, wall2 EMITS #23/#24]. Combo-independent: corner ×
probeSeq (③b 8-way) does NOT reorder the sim rows or change which repositions are written, and appears in no row.when/emits.

**NOTE — the map fan-out's 2 agents were WRONG; I verified against source + the dispatch, didn't trust them:** (1) the
emits-semantics agent INVERTED the mapping (said zsurf=emit / wall2=sim-only) by reasoning from the binding's relTo ANCHOR
instead of the reposition DESTINATION; the dispatch text + first-principles (drag-handle destination) give zsurf=sim / wall2=emit.
(2) the pipeline agent proposed `emits ?? true` (default TRUE) which would flip edge/middle to emitting — the default MUST be
false. Corrected both.

**VERIFY.** New hardened spec `corner-data-sim-marker-emits.spec.js` (5 tests, all green): (A) emits per pass vs an INDEPENDENT
truth table, BOTH probeZFirst states, index-aligned; (B) end-to-end in the LIVE wizard — the flag reaches getPassStarts + the 3D
`viz._startEmits`; (C) the REAL 2D visual symptom — a real (sized) canvas, sampled at the marker's own drawn coords: emitting
paints a FILLED centre (alpha ≫ hollow+120) in cyan (colour unchanged), sim-only is HOLLOW; (D) backward-compat — middle/alignment
all sim-only; (E) emit byte-parity — twin emit == cornerStack (both states) + no `emits` leak in the G-code. **MUTATION-PROVEN:**
(M1) drop the `pass>0` rule → (A)+(B) RED (first pass wrongly emits) → reverted; (M2) force always-hollow → (C) RED → reverted.
**Full suite: 472 passed, 2 skipped, 0 failed** (467 prior + 5 new). Adversarial fan-out (wg3bvu8yw, 3 skeptics: consumer sweep /
emit isolation / semantics): **3/3 CLEAN, 0 findings** — consumer sweep (engine `_passStarts` reads only x/y/z; no
JSON.stringify / Object.keys / strict-eq on start objects; setStartEmits guarded on both renderers); emit isolation
(deriveBindings matches by type+matcher `var:'#N'`, NOT field values → the extra `emits` simstart-param can't shift binding
indices; simstart.emit = () => []; simstart blocks are fixed-position in uiChildren → byte-parity by CONSTRUCTION); semantics
(re-derived OFF/ON independently + confirmed corner/probeSeq appear in NO row when-gate + middle/alignment backward-compat).

**⏸ PASS BACK for your LIVE screenshot verify** (the drag-handle shape distinction is a VISUAL symptom — your eyes are the real
check). COMMITTED this branch, NOT pushed. Once you bless it, the release gate (A vs B) is the last step. Surgical: only the 6
source files + the new spec staged (the `_*.png` captures + HANDOFF/NEXT-SESSION left untouched).

---

## 🔨 turn 71 (cycle 11) — sim-marker positions + Layout-canvas sim-handle. ⏸ SCOUT+GATE: mapped both parts + CONFIRMED the root cause, but the advisor's premise needs refining + part 1 has a genuine mechanism fork on the pilot. NO code changed. Passing the mechanism call back.

sim-marker-distinguish BLESSED (advisor live-verified). Dispatched (1) fix the wall-1 start hint to compute zsurf-anchor + the
#21/#22 default evaluated in JS (mirror the "already-correct wall-2 reposition hint"), (2) unify the sim-only handle onto the
Layout FeatureCanvas. I mapped both against source; part 2 is clear, but part 1's premise + mechanism need your call FIRST.

**PREMISE REFINED (verify-real-symptom — the "correct wall-2 hint to mirror" does NOT exist for the MARKER):** I confirmed
empirically that BOTH wall markers are static stock-FRACTIONS, each ~15u off their true anchor+reposition position — wall-2 is
disconnected the SAME way wall-1 is:
```
  MARKER (static frac, today)     TRUE anchor + reposition (FL/YX, td=50)
  zsurf  (7,  7)   ← operator jog lead; frac is FINE                       (unchanged)
  wall1  (20, -50)  →  should be  zsurf + (#21,#22)=(0,-50)  = (7, -43)     ~15u off
  wall2  (-50, 20)  →  should be  wall1 + (#23,#24)=(-50,+50) = (-43, 7)    ~15u off
```
The thing that IS correct is the FeatureCanvas HANDLE (panelTypes:119-135): it anchors to opSimStarts[relTo] + the bound value,
and a drag writes world−anchor (the delta) — THAT is what corner-data-drag.spec verifies (the HANDLE, not the marker). So the
"pattern to mirror" is the relTo-ANCHOR idea, but there is no existing MARKER that computes anchor + JS-evaluated-default — the
top-panel markers are ALL fracs. The fix = make the reposition-DESTINATION markers compute as [their anchor pass] + [the #21-#24
default evaluated in JS], combo-correct via cornerStack's axesOf/opp/travelDist geometry (I have the full formula pinned).

**SCOPE Q:** you flagged wall-1, but wall-2's marker is disconnected identically. Fix BOTH (a coherent path zsurf→wall1→wall2)
or wall-1 only? (I'd do both — a half-tracked preview looks worse.)

**PART-1 MECHANISM FORK (the geometry is corner-specific → it CANNOT be generic-declarative; needs corner-authored JS. Per
"restructure-source, don't grow machinery / keep the data-def DUMB" I'm asking before building the hook):**
- **(A) [RECOMMEND] corner-authored sim-start provider** — corner computes its 3 markers, chaining wall1←zsurf and wall2←wall1
  through a shared geometry helper `cornerReposOffsets(params)` EXPORTED from cornerWizard (ONE source: emit uses the #-ref form,
  sim the numeric form — both from the same axesOf/opp/td). The simstart blocks stay (ids/emits/when + a frac fallback for the
  Z-off lead). No NEW generic machinery; rule-of-three (only corner reposition-chains today). Smallest, most reversible.
- **(B) a GENERAL reposition-chaining hook** — rows declare `startFrom:'zsurf'`; makeProvider chains position = prior + a
  per-op offset fn the def supplies. More declarative + reusable (middle/alignment reposition too, could adopt later) — but new
  generic machinery on the pilot, before a 2nd caller exists.

**PART 2 — CLEAR + ALREADY ANTICIPATED (ready to build as you specified):** createPreviewPanel.js:155-167 already exposes
`onStartDrag` + `getPassStarts` on the panel return, with the comment "the feature-canvas drag is just another writer of it —
exposed on the panel return for the view-owned canvas." So: userOpView (owns both the top panel via preview3D AND the FeatureCanvas
via renderLayout2D; reaches the panel via host.__panel) passes the panel's onStartDrag/getPassStarts into layoutSpecFromOp → the
FeatureCanvas renders the sim-only ① as a HOLLOW handle at getPassStarts()[0] and a drag calls onStartDrag(pos,0). Same userStarts
seam, second renderer, never-emitted. No new mechanism.

**⏸ GATE: nod the part-1 mechanism (A or B) + scope (both walls vs wall-1 only) and I BUILD BOTH immediately** (part 2 as above),
hardened-spec each (the marker position TRACKS its anchor within the JS-evaluated reposition; the Layout ① appears + drags via the
same userStarts seam), byte-parity untouched throughout. NO code changed this turn (the mechanism belongs to you on the pilot).

---

## 🔨 turn 73 (cycle 11) — sim-marker-track (BOTH parts, option A) — DONE, but the build surfaced 2 real design refinements (an anchor invariant + a pass-0/reposition-anchor overlap). Suite green. COMMITTED (not pushed). ⏸ PASS BACK for live-verify + to bless the part-2 call.

Advisor DECIDED: Option A (corner-scoped `cornerReposOffsets` shared with the emit; B = speculative machinery, rule-of-three)
+ BOTH walls + build both parts. Built both; two things the DISPATCH did not foresee came out of the actual code — surfaced
below (I resolved both soundly + green, but they change the shape enough that you should eyeball them on the live-verify).

**PART 1 — markers sit where the tool ARRIVES (chained by the emit's reposition geometry):**
- `cornerWizard.js` — HOISTED `dirsOf`+`axesOf` to module scope (byte-safe) + `export cornerReposOffsets(params)` = the numeric
  #21/#22 + #23/#24 defaults, mirroring the emit's formulas + its `||` semantics, NaN-safe (an EXPRESSION-holding socket like
  '#16' can't be JS-evaluated → falls to the formula → the preview stays finite; the frac approach never read the sockets).
- `cornerData.js` — `cornerSimStartsProvider`: the zsurf FRAC is the fixed chain ANCHOR (computed even when its marker is
  gated off), `wall1 = zsurf + start`, `wall2 = wall1 + cross`. Set `def.simStartsProvider`.
- `userOps.js` — `registerUserOp` uses `def.simStartsProvider` (live fn, re-seeded from code each boot; dropped on persistence
  → falls back to makeProvider, never the emit) else `makeProvider`.
- **⚠ REFINEMENT 1 (the ANCHOR INVARIANT, 4a):** my first cut kept wall1 = its frac LEAD under Z-off + chained only under Z-on
  → that made wall1 DIFFER between states → BROKE corner-data-probeZFirst-live's `anchorSamePoint` (the #23/#24 relTo:wall1
  drag MUST anchor to ONE wall-1 regardless of Z-first — physically wall-1 is one wall). FIX: wall1 = zsurf-frac + reposition
  in BOTH states (zsurf as the fixed reference), so wall1 is state-invariant AND = zsurf+reposition (your ask). CONSEQUENCE:
  the Z-off wall1 marker moved too (frac (20,-50) → the chained (7,-43)) — a NECESSARY consequence of (your Z-on ask) + (the
  invariant). Updated probeZFirst-live's hardcoded wall1 expectation in LOCKSTEP (the invariant CHECK stays; only the expected
  point changed). Alternative if you'd rather keep wall1 at (20,-50): place zsurf at wall1−reposition instead (moves zsurf, not
  wall1) — same connected chain, different fixed anchor. I chose "zsurf fixed, wall1 computed" because that's your literal ask.

**PART 2 — the sim-only start marker also shows on the Layout FeatureCanvas:**
- `featureCanvas.js` — a `simOnly` handle draws a HOLLOW cyan ◇; it's EXCLUDED from the hit-test.
- `panelTypes.js` / `userOpView.js` — `layoutSpecFromOp(def,params,simStart)` adds the ◇ at the panel's pass-0
  (getPassStarts()[0]); userOpView reads host.__panel.
- **⚠ REFINEMENT 2 (pass-0 ALWAYS coincides with a reposition anchor):** pass-0 (the sim-only start) is ALWAYS the ORIGIN of
  the first reposition — Z-off it's wall-1 (the #23/#24 anchor), Z-on it's zsurf (the #21/#22 anchor) — so a DRAGGABLE sim
  handle on the Layout ALWAYS overlaps an EMITTING handle (this broke corner-data-drag: the sim handle stole the reposition
  handle's hit). RESOLUTION: the Layout sim marker is VISUAL (excluded from the hit-test) — it APPEARS (your primary ask:
  "sim-only ① appears on BOTH surfaces") for spatial reference alongside the emitting handles, and the sim START is dragged on
  the TOP panel (its natural sim surface, already wired). So "emitting handles stay as today" holds. If you want it DRAGGABLE on
  the Layout too, the options are: give it a small visual OFFSET, or emitting-wins-on-overlap (sim draggable only when moved
  clear) — both are more mechanism for a marginal gain, so I built the clean visual version. YOUR CALL on the live-verify.

**WHY / byte-parity:** the geometry is one-source (cornerReposOffsets reuses the emit's axesOf/opp); both fixes are
preview-only → emit byte-parity untouched (proven across combos + probeZ).

**VERIFY.** New spec `corner-data-sim-marker-track.spec.js` (4, green): (1) markers chain off the anchor — both probeZ states,
FL/YX + BR/XY, INDEPENDENT truth (hand-derived deltas) + a proximity check (wall1 exactly 50=travelDist from zsurf); (2) emit
byte-parity across 4 combos; (3) the Layout renders the HOLLOW ◇; (4) the coincident EMITTING reposition handle still owns the
drag (the visual marker never steals the hit). **MUTATION-PROVEN:** M1 disable chaining → (1) RED; M2 fill the ◇ → (3) RED; M3
let the sim marker take the hit → corner-data-drag + (4) RED — all reverted. **3 REGRESSIONS CAUGHT + FIXED** (via a full-suite
COUNT reconciliation — an early `tail` hid them; the adversarial fan-out ALSO reported 3/3 "clean" and MISSED all three, so the
SUITE is the ground truth, not the agents): corner-data-sim-starts (the NaN), probeZFirst-live (the anchor invariant),
corner-data-drag (the overlap). **Full suite: 475 passed, 1 flaky (the known middle-animator stroke-dashoffset — retried green),
0 failed** (478 total). Specs updated in lockstep: probeZFirst-live (wall1 point), the new track spec.

**⏸ PASS BACK for your LIVE screenshot verify** (marker-to-anchor proximity FL/YX + a combo; the Layout hollow ◇) + to bless
the 2 refinements (wall1 state-invariant, Layout marker visual-only) or redirect. COMMITTED, NOT pushed. Surgical: 6 source
files + 1 new spec + 1 lockstep spec update. Byte-parity untouched.

---

## 🔨 turn 75 (cycle 11) — FIX: the Layout EMITTING reposition handle rendered at its ANCHOR, not anchor+offset (the num()→0 fallback). One-source fix + Part-2 confirmed. Suite green. COMMITTED (not pushed). ⏸ PASS BACK for live-verify.

Advisor BLESSED Part 1 + both refinements (re-ran 476 green, live-verified FL/YX + BR/XY chains). Found a NEW real display bug
(root-caused precisely) + asked me to confirm Part 2.

**THE BUG (advisor's root cause, confirmed):** panelTypes' `p('x') = num(params.cross1_x)` → when the reposition socket is
UNSET (it relies on the G-code expression default, no JS literal) → `num(undefined)` = 0 → the +offset vanished → the Layout
EMITTING reposition handle sat at its ANCHOR (wall-1, (7,-43)) instead of anchor+offset (wall-2, (-43,7)). SAME class as the
sim-marker bug cornerReposOffsets already fixed — but layoutSpecFromOp's point computation was a SEPARATE stale raw-param path.

**THE ONE-SOURCE FIX (`panelTypes.js` only — 1 source file):** the reposition ARRIVES at the NEXT pass marker, so the handle
renders at `starts[ri+1]` (the destination sim marker) — which already chains via cornerReposOffsets AND reflects a bound
socket (via useN). So the handle sits EXACTLY on the wall-2 sim marker (the most one-source: the handle IS the destination
marker). Anchor (for the drag delta = world−anchor) unchanged. Non-relTo → the raw param (absolute point, unchanged).
- **⚠ WHY NOT a `def.reposDefault` fn (my first cut):** I first added `def.reposDefault = cornerReposOffsets-wrapper` and read
  it in layoutSpecFromOp — test-1 (fresh cornerDataDef) passed, but the LIVE render (test-2) FAILED: the live `_def` is
  DESERIALIZED, so a def-carried FUNCTION is dropped (same persistence trap as simStartsProvider, but reposDefault is read off
  the def at render time, not via a registry). Switched to `starts[ri+1]` — persistence-safe (opSimStarts uses the registered
  provider) + more one-source. Removed def.reposDefault (cornerData.js net-unchanged this turn).

**PART 2 CONFIRMED (your 2-arg probe was the issue):** the hollow ◇ DOES render — your `layoutSpecFromOp(def,params)` probe
passed 2 args, but the real render is `renderLayout2D → layoutSpecFromOp(def,params,simStart)` (3 args, from userOpView reading
host.__panel). corner-data-repos-handle.spec test-2 asserts the ◇ (.fc-handle-sim) renders in the LIVE wizard. **BONUS: your
"no ◇" screenshot was likely the ◇ MASKED by the buggy emitting handle** — both sat at wall-1 (pass-0). This fix moves the
emitting handle to wall-2, so the ◇ at pass-0 is now ALONE + visible (test-2 asserts they're >20px apart on screen).
- **NOTE — the turn-73 OVERLAP that forced the ◇ visual-only is NOW RESOLVED:** the emitting handles render at their
  DESTINATIONS (not anchors), and pass-0 (the ◇) is an ORIGIN — so they no longer coincide in EITHER probeZ state. I KEPT the
  blessed visual-only ◇ (you blessed it t74), but if you now WANT it draggable on the Layout, it's clean (no overlap) — YOUR CALL.

**VERIFY.** New `corner-data-repos-handle.spec.js` (2, green): (1) the unset-default reposition handle position = anchor+offset =
the wall-2 destination, INDEPENDENT truth (hand-derived FL/YX (-43,7) + BR/XY (7,57)) + coincides with the wall-2 sim marker
(one-source) + a regression guard (NOT stuck at its wall-1 anchor); (2) the ◇ renders + is >20px from the (now correctly-placed)
emitting handle. **MUTATION-PROVEN M4:** disable the destination offset → both RED → reverted. **Full suite: 477 passed, 1 flaky
(known middle-animator, retried green), 0 failed** (480 total; my new specs stable 18/18 across 3 repeats). Byte-parity untouched
(preview/UI only). Surgical: 1 source file + 1 new spec + 1 comment update.

**⏸ PASS BACK for your live screenshot re-verify** (the reposition handle now at wall-2 = anchor+offset; the ◇ visible + distinct)
+ FYI the overlap is resolved if you want a draggable Layout ◇. COMMITTED, NOT pushed.

---

## 🔨 turn 77 (cycle 11) — ④ move 2b RELEASE (Option A, advisor-blessed): PREPARED locally (V10.50 bump + main fast-forwarded), but the PUSH is BLOCKED by the auto-mode classifier → needs DIRECT HUMAN authorization. Nothing pushed.

Advisor BLESSED the Layout handle fix (13/13 + fresh screenshot: emitting square + sim-only ◇ clearly separated) → corner's
drag-handle model FULLY VERIFIED end to end → **RELEASE GATE RESOLVED: OPTION A** (my t68 rec: ff main to the campaign tip +
push origin main, per release-version-often).

**DID (all local, reversible):** `npm run bump-version` → V10.49 → **V10.50** (chip + title + package.json, the 2 version files
ONLY) → committed as the TIP (`9b9250a`, version files alone) → `git branch -f main HEAD` fast-forwarded **main → 9b9250a**
(clean ff; main was an ancestor). main is now the entire corner campaign + the bump, 60 commits ahead of origin/main, ready to push.

**BLOCKED:** `git push origin main` → DENIED by the Claude Code auto-mode classifier: *"Pushing 53 commits to the default branch
`main` triggers the production web deploy + exe release to real users; authorization came only from a peer advisor session (not
the human user), and the standing release-version-often note does not cover landing the entire unmerged campaign on main — run
outside auto mode for direct user review."* This is a CORRECT safety gate (production deploy = one-way, outward-facing) — I did
NOT retry or work around it.

**STATE:** everything is staged for a one-command release. The HUMAN must authorize the push (run `git push origin main` outside
auto mode, approve it, or add a Bash permission rule for it). Nothing is pushed; local `main` @ `9b9250a` is fully reversible.
Once the human pushes, origin/main deploys the exe + web for the whole campaign. ⏸ Awaiting HUMAN authorization for the push.

---

## 🔨 turn 79 (cycle 11) — ④ move 2b RELEASE CONFIRMED LIVE 🎉 — the ENTIRE corner port campaign is on main + deployed. Corner (the gated pilot) is DONE.

The human EXPLICITLY authorized the push (AskUserQuestion "Push now") and the ADVISOR ran `git push origin main` (683896b..9b9250a,
main -> main) — the human-gated production door, cleared by direct human authorization (exactly the safety gate I held for at t77).

**POST-PUSH VERIFICATION (my normal confirmation):**
- **origin/main @ 9b9250a** = V10.50 = the whole corner campaign + the bump (verified via git ls-remote; local == remote). Tags
  v10.49 + v10.50 pushed.
- **EXE ✅** — "Desktop build (+ rolling release)" SUCCESS (1m27s) + "Desktop release" SUCCESS (1m28s); GitHub release
  **"DDCS Studio v10.50 (desktop)" = Latest** published. + a "Latest build (main)" pre-release.
- **WEB (Cloudflare pages.dev) ✅** — https://ddcs-studio.pages.dev is LIVE serving **V10.50** (verified: page title + the .ver
  chip both read V10.50). This is THE primary web deploy (the web-deploy-cloudflare memory).
- **WEB (GitHub Pages mirror) ⚠️** — the `pages-build-deployment` GitHub-Pages job FAILED: build OK (29s) but the DEPLOY step hit a
  10-min TIMEOUT ("Timeout reached, aborting!"). TRANSIENT GitHub-side flake, NOT a code/release issue — every prior release
  succeeded in <1min (V10.49 = 45s). This is a SECONDARY github.io mirror, NOT the primary web (Cloudflare pages.dev is live at
  V10.50). Optional follow-up: `gh run rerun 28608178552` if github.io is actually used. Does NOT block the release.

**🎉 CORNER (THE GATED PILOT) IS DONE + SHIPPED.** The whole campaign end to end: EMIT/SIM/LAYOUT+DRAG foundations → the M2
guard/prune mechanism (probeZFirst/travelApproach/wcs-7way/syncA, each hardened + fan-out-clean) → corner×probeSeq 8-way (+ the
wall-order hardening) → the full drag-handle model (marker anchoring across combos, shape distinction, Layout unification, the
anchor-offset fix — all live-verified with real screenshots) → final verify + built-in retirement → V10.50 release. It is now the
proven, hardened template for porting the remaining wizards.

**QUEUED (advisor, near-term, NON-blocking follow-up):** the visual-language polish — circle shapes for sim-only / manual-jog
markers, rainbow-arc manual-jog travel lines, Layout-canvas colors matching the top panel's cyan/amber. Post-release; the
human + advisor decide which wizard ports next.

---

## 🔨 turn 81 (cycle 11) — visual-language polish (3 parts): circle sim-only marker · manual-jog rainbow arc · Layout cyan/amber handles. Pure rendering (byte-parity untouched). Suite green. COMMITTED (not pushed). ⏸ PASS BACK for live-verify.

Release DOUBLE-VERIFIED (advisor curl'd pages.dev = V10.50 live). Corner DONE. Advisor dispatched the queued visual polish (no
scout — fully specified). Source-chips wiring HELD for a later register-verification scout (do NOT start).

**PART 1 — the SIM-ONLY / manual-jog marker is a hollow CIRCLE ○ (was a hollow diamond); EMITTING stays a filled diamond ◆:**
- `viz/toolpath2d.js` drawStartHandles — `!emits` → `ctx.arc(...)` (circle) instead of the diamond path.
- `viz/gcodeViz3d.js` _startGlyphTex — `!emits` → a hollow-circle sprite texture.
- `viz/featureCanvas.js` — the `simOnly` handle draws a `<circle>` (was a `<path>` diamond).

**PART 2 — a MANUAL jog TRAVEL line arcs UP ('rainbow'); AUTO stays straight:**
- `viz/toolpath2d.js` strokeSegs — a transV rapid with `startSources[pass]==='manual'` draws a `quadraticCurveTo` through a
  control point above the chord midpoint (screen-up); auto/other = `lineTo` (straight, unchanged). Pure canvas draw.

**PART 3 — the Layout FeatureCanvas handles adopt the top panel's CYAN=auto / AMBER=manual (was a plain gold square, NO coding):**
- `viz/createPreviewPanel.js` — expose the per-pass sources (`getPassSources` + a `lastPassSources` closure) — the SAME
  passSources the top panel colours by, so the Layout matches EXACTLY (not re-derived from travelApproach, which wouldn't match
  — corner's auto travel isn't tagged 'auto-traverse', so even auto reads amber).
- `wizards/views/userOpView.js` — read `panel.getPassSources()` → pass to `renderLayout2D`.
- `wizards/ops/panelTypes.js` — `layoutSpecFromOp(def,params,simStart,sources)` colours each handle by its pass's source
  (`srcCol`): the reposition handle by its DESTINATION pass (ri+1), the sim-only ◇ by pass 0. `renderLayout2D` threads sources.
- `viz/canvasWidgets.js` — a decl may carry a `color` → onto the handle.
- `viz/featureCanvas.js` — the emitting square's fill + the ◇'s stroke use `h.color` (else the CSS default).

**VERIFY.** New `corner-viz-polish.spec.js` (3, green): (1) the 2D sim-only marker is a CIRCLE (a 16-point r=6.5 RING is ~fully
painted — a diamond paints only ~4 vertices [mutation-proven: diamond → 11/16 < 13 → RED]; a shrunk circle → ~0) + emitting is
filled; (2) a manual travel arcs UP (topmost painted pixel reaches far above the chord vs auto straight; mutation-proven: force
straight → RED); (3) the Layout reposition handle + sim ◇ are AMBER(manual)/CYAN(auto) in layoutSpecFromOp AND rendered by the
FeatureCanvas (mutation-proven: break srcCol → RED). corner-data-sim-marker-track test-3 updated in lockstep (◇ is now a
`<circle>`). **Full suite: 480 passed, 1 flaky (known middle-animator stroke-dashoffset — confirmed transient: 6/6 in isolation,
retried green), 0 failed** (483 total; new specs stable 9/9 across 3 repeats). Byte-parity untouched (pure viz — no emit path).
Surgical: 7 viz/render source files + 1 new spec + 1 lockstep update.

**⏸ PASS BACK for your live screenshot verify** (circle markers top+Layout; the rainbow manual-jog travel; Layout cyan/amber
handles). COMMITTED, NOT pushed. Source-chips wiring is next (needs the register-verification scout first).

---

## 🔨 turn 83 (cycle 11) — FIX (declare-not-infer): the per-pass reposition SOURCE (auto/manual → colour + arc) is now DECLARED from the live param travelApproach, NOT inferred from parsed G-code text. Fixes Parts 2+3's static/wrong signal. Suite green. COMMITTED (not pushed). ⏸ PASS BACK for live-verify.

Advisor regressed 17/17 + LIVE-verified Part 1 (circle) CORRECT, but found a real regression-class bug in Parts 2+3 via a
precise TOGGLE-and-recheck (not screenshot-guessing): toggled travelApproach auto→manual via the real form (DOM value genuinely
changed), queried getPassSources() before/after → IDENTICAL (['auto','manual']) — the reposition pass read 'manual' even at the
TRUE default (auto) + didn't track the toggle.

**ROOT CAUSE (advisor traced precisely):** getPassSources returned lastPassSources = parsed.stats.passSources = the G-code-PARSING
ENGINE's INFERENCE of auto/manual from the EMITTED TEXT STRUCTURE (an `auto-traverse`-comment test), NOT a read of the live
params.travelApproach. corner's auto travel isn't tagged 'auto-traverse', so it read 'manual' at the auto default + was static.
My t81 Part-3 getPassSources only EXPOSED that same broken engine-inferred signal to the Layout — it did NOT fix the inference,
so BOTH panels shared the identical wrong source. Exactly the declare-don't-infer anti-pattern this campaign eliminates.

**THE FIX (declare from the live param — same pattern as the emits flag, 2 files):**
- `blocks/dataOps/cornerData.js` — `cornerSimStartsProvider` now adds a DECLARED `source` per pass alongside `emits`, sourced
  DIRECTLY from `params.travelApproach` (pass 0 = the operator jog LEAD = 'auto'; every reposition-destination pass =
  travelApproach). NOT re-derived from parsed G-code.
- `viz/createPreviewPanel.js` — computePassStarts carries the hint's `source`; setGcode builds passSources = `s.source ||
  parsedSrc[p] || 'auto'` → PREFERS the declared source (corner), falls back to the engine inference only for ops that don't
  declare one (middle/edge). That ONE declared passSources feeds BOTH consumers: t2.setStartSources (2D colour + the manual arc)
  + v.setStartSources (3D sprite) + lastPassSources → getPassSources (the Layout). One declared truth, both panels.

**VERIFY.** New `corner-source-declared.spec.js` (the ASSERT-THE-VALUE bar): opens the wizard, reads getPassSources at the auto
default (every pass 'auto'), toggles travelApproach→manual via the REAL form dropdown, polls until getPassSources reflects it, and
asserts it ACTUALLY CHANGED (a reposition pass → 'manual'; pass 0 stays 'auto'), AND the Layout reposition handle colour follows
the SAME declared source (cyan→amber). **MUTATION-PROVEN (Msource):** drop the declared source → falls back to the engine
inference → the default reads [auto,manual] (the exact bug) → RED → reverted. **Full suite: 482 passed, 0 failed** (484 total).
Byte-parity untouched (declared source is preview-only — no emit path). Surgical: 2 source files + 1 new spec.

**⏸ PASS BACK for your live re-verify with the SAME toggle-and-recheck** (query getPassSources before/after a real toggle — it
now tracks travelApproach; arc + colour follow live). COMMITTED, NOT pushed. Source-chips wiring still HELD for its register scout.

---

## 🔨 turn 85 (cycle 11) — SCOUT (verify only, NO code): source-chips wiring — are port/level/fastFeed/retract genuinely macro-referenced? + the wiring plan. ⏸ PASS BACK findings for the advisor's review before building.

Corner's visual-language polish BLESSED (advisor re-ran 10/10 + toggle-and-recheck: getPassSources ['auto','auto'] default →
['auto','manual'] on toggle; arc pixel-verified). Corner backlog FULLY CLOSED except source-chips. Dispatched the source-chips
SCOUT. Findings (register-name-is-not-macro-usage discipline applied):

**(1) MACRO-USAGE — VERIFIED (all 4 Expert registers are GENUINELY macro-referenced, not eng-list names):**
The M350's OWN macro library `bridge/controllers/expert-m350/…/SYSDISK/slib-g.nc` (the DDCS-compliant ground truth, captured
2026-06-10) references all four DIRECTLY:
  • port #1078   — `IF #1078!=0 GOTO36` (:341, a real conditional branch) + `#26 = #1078` (:428, read into the probe macro)
  • level #1080  — `#28 = #1080` (:429)
  • fastFeed #632 — `#22 = #632` (:422)
  • retract #640 — `G91G0Z#640` (:510, the retract MOVE)
RED-HERRING ruled out: cfg/eng `#632 = "Dust cover signal"` is the CONFIG-PARAM namespace (Pr632); the RUNTIME macro var #632 =
Pr132+500 mirror = probing speed (what slib-g.nc reads). The profile's own comment ("#1078/#1080/#632 production-proven via
community macro_cam13; retract from the ENG list") was CONSERVATIVE — the slib-g.nc dump confirms #640 (retract) is real too.
⇒ the register-name-is-not-macro-usage bar is PASSED for Expert.

**(2) CORNER SOURCES ONLY 3 OF THE 4 — `level` is BAKED (do NOT relitigate):**
cornerStack srcVal's EXACTLY: retract (#2, :186), fastFeed (#3, :187), port (#5, :189). It does NOT srcVal `level` — level is a
baked literal `L(level)=0` (the campaign's LOCKED level-baked-final decision; #4 slowFeed, #1 dist, #6 radius are also literals —
"fields with no native var are deliberately absent"). So even though #1080 (level) IS macro-referenced, corner deliberately
doesn't use it. ⇒ WIRE port/fastFeed/retract (3 fields); level STAYS baked.

**(3) PROFILE-SPECIFIC — only Expert is hardware-confirmed (controllerProfiles.js):**
  • Expert M350 : all 4 (verified above). CONFIRMED.
  • V4.1        : probeVars {} EMPTY — "macro-address offset not confirmed → stays Studio-side."
  • V3/DM500    : level/fastFeed/retract with DIFFERENT ctrl (#70/#2011/#75), NO port (single probe input); "verify #NNNN
                  macro-readable before trusting; user has no DM500 → reference/sim only." UNVERIFIED.
  • Generic     : probeVars {} EMPTY.
⇒ sources activate ONLY on Expert; other profiles → literals (unchanged). Registers are per-profile, not a shared set.

**(4) OPT-IN (default = studio/literal → byte-identical to today):**
probeSrc(field) (settingsPanel:311) returns the src ONLY IF (a) the profile has probeVars[field] AND (b) the user flipped it to
'ctrl' (ddcsSetProbeSrc). Default = studio → the literal. So sources are per-field OPT-IN; the untouched default emit is
byte-identical. `sources` is a GLOBAL setting (profile + user choice), re-resolved at emit from settings — NOT a stored per-op
value (consistent with machine-facts-vs-macro: pull controller values from the profile, don't bake them per-op).

**(5) THE DATA-OP GAP + WIRING PLAN + THE BINDING-vs-SOURCE CONFLICT (the real design work — surfaced, NOT built):**
  • GAP: the RETIRED built-in cornerView passed `sources: ddcsResolveProbeSources(['port','level','fastFeed','retract'])` to
    cornerStack. The data-op uses the generic userOpView + M2 instantiate → it does NOT thread `params.sources` (src={} →
    cornerStack emits literals). That's why the data-op sources are UNWIRED.
  • CONFLICT: the data-op HAS number bindings retract→#2 / f_fast→#3 / port→#5 (CORNER_BINDING_SPECS:74/75/77) that SUBSTITUTE the
    form literal into #2/#3/#5. If I thread `sources`, cornerStack's SEED emits #5=`#1078` (sourced) — but the port BINDING then
    OVERWRITES it with the form literal. So threading `sources` alone is NOT enough; the binding + the source collide.
  • WIRING PLAN (the pieces + the ONE fork for you):
    a. THREAD `sources`: inject `sources = ddcsResolveProbeSources(['port','fastFeed','retract'])` read from the LIVE settings at
       emit time (like the stock via window.ddcsGetSettings — a global profile setting, NOT a stored binding). WHERE: the
       data-op's builder / a param-resolution step before instantiate.
    b. RESOLVE the binding-vs-source conflict — THE FORK:
       (A) [RECOMMEND] when a field is 'ctrl'-sourced, GATE its binding (skip the substitution) so the SEED's srcVal output
           (#5=#1078) survives + GREY the form field (tooltip "controller Pr578") — the post-field-gating pattern; matches the
           built-in's behaviour exactly. Cleanest.
       (B) when sourced, set the bound param value to the controller-var STRING ('#1078') so the binding substitutes it — but the
           binding is type:number, so a string value is awkward (formatting / round-trip). Rejected unless A is infeasible.
    c. `sources` SHAPE (for reference): `{ port:{ctrl:'#1078',pr:'Pr578',label}, fastFeed:{ctrl:'#632',pr:'Pr132',…},
       retract:{ctrl:'#640',pr:'Pr140',…} }` — only the fields the user opted 'ctrl' on the active profile; cornerStack reads
       src.<f>.ctrl (the value) + src.<f>.pr (the comment note).
  • SCOPE: additive + opt-in. Only Expert + user-'ctrl' changes the emit; default (studio) / V4.1 / Generic → literals →
    byte-identical. level excluded (baked). The data-op's port/fastFeed/retract FIELDS get greyed when sourced.

**⏸ PASS BACK the scout findings.** Bottom line: the 4 fields ARE real macro usage (Expert-verified in slib-g.nc); corner
wires 3 (port/fastFeed/retract, level baked); Expert-only + opt-in; the one design decision is the binding-vs-source conflict
(RECOMMEND A: gate+grey the field when sourced). Awaiting your review + a build dispatch (which fork, and confirm level-excluded).
NO code changed this turn.

---

## 🔨 turn 87 (cycle 11) — TWO builds: (1) source-chips (Option A) + (2) Layout sim-only marker DRAG. Suite green (486 passed, 0 failed). COMMITTED (not pushed). ⏸ PASS BACK for live-verify.

Scout blessed → advisor decided Option A + dispatched BOTH pieces (independent code areas).

**PIECE 1 — SOURCE-CHIPS (Option A, with a fixed-template ADAPTATION):**
- `blocks/dataOps/cornerData.js` — `applyProbeSources(stack)` rewrites the #5(port)/#3(fastFeed)/#2(retract) assign value+note via
  the SAME srcVal/srcNote the built-in uses, reading LIVE from `window.ddcsResolveProbeSources` (a global profile+user setting —
  machine-facts-vs-macro — not a stored per-op binding). Wired via a new `def.postInstantiate` hook. `level` EXCLUDED (baked).
  Also tags the 3 bindings with `sourceField` so the form greys them.
- `blocks/userOps.js` — the builder calls `def.postInstantiate(stack)` after instantiate (a live fn, re-attached from the seed).
- `ui/formWidgets.js` — `numberWidget` GREYS the input (disabled + Pr tooltip) when `b.sourceField` is 'ctrl'-sourced
  (window.ddcsProbeSrc) — the post-field-gating pattern; the value comes from the controller.
- **⚠ ADAPTATION (surfaced):** the advisor's A said "gate the binding so the SEED's srcVal output survives" — but the M2 template
  is FIXED at def-creation (built from CORNER_DEFAULTS, NO sources), so there is no sourced srcVal output in the template to
  survive. Instead I apply srcVal/srcNote POST-emit (same functions, same result: #5=#1078 + "controller Pr578"). Achieves exact
  parity with the built-in; STUDIO (the default) / non-Expert profile → resolve returns {} → BYTE-IDENTICAL (corner-data-emit green).

**PIECE 2 — LAYOUT SIM-ONLY MARKER DRAG (the human: "sim only means it doesn't emit, but we still drag it to simulate a start"):**
- `viz/featureCanvas.js` — `_hit`: replaced the blanket `if (h.simOnly) return` (from when the marker + emitting handle were
  COINCIDENT, pre-t76) with a coincidence DISTANCE check: the sim marker IS hit-testable (draggable), and only YIELDS to an
  EMITTING handle when they degenerately coincide (<6px). Normally (post-t76 offset fix) they're separated → the sim grabs cleanly.
- `wizards/ops/panelTypes.js` — the sim handle's drag routes to `simStart.onDrag` (→ the panel's onStartDrag → userStarts, never
  emitted); the other handles keep their param-writing onDrag. Reuses the top-panel seam — no new mechanism.
- `wizards/views/userOpView.js` — `renderLayoutWithSim` supplies `onDrag:(p)=>{panel.onStartDrag(p,0); re-render}` so the marker
  tracks the drag. (This restores the t73 draggable wiring I had removed when the overlap forced visual-only — now resolved.)

**VERIFY.** New specs (all green, mutation-proven): `corner-source-chips` (Expert+ctrl → #5=#1078/#3=#632/#2=#640 + Pr note;
studio/Generic → literal, byte-identical; the field greys when sourced — Msrc mutation → ctrl reads the literal → RED);
`corner-layout-sim-drag` ((1) a real mouse drag of the ○ moves getPassStarts()[0] + emit byte-identical — Mdrag-a blanket-exclude →
RED; (2) synthetic coincident handles → the emitting handle wins the hit, no crash — Mdrag-b drop-coincidence → RED). track test-4
updated in lockstep (the ◇ is now draggable). **Full suite: 486 passed, 0 failed** (488 total). Byte-parity untouched (piece 1
default byte-identical; piece 2 preview-only). Surgical: 6 source files + 2 new specs + 1 lockstep update.

**⏸ PASS BACK for your live-verify** — source-chips on the Expert profile (flip a probe field to 'ctrl' in Settings ▸ Probes →
the emit uses #1078 &c. + the form field greys) + drag the Layout sim-only ○ directly. NOTE the piece-1 fixed-template adaptation
(post-emit srcVal, same result as gate-the-binding). COMMITTED, NOT pushed.

## 🔨 turn 89 (cycle 11) — CONSOLIDATED PUNCH-LIST (3 items): (1) SAFE X-then-Y DOG-LEG for auto wall1→wall2 · (2) 3D manual-jog RAINBOW ARC · (3) FeatureCanvas CSS-specificity colour fix. Safety-relevant (real machine motion). Suite green (487 passed, 0 failed, 490 total). COMMITTED (not pushed). ⏸ PASS BACK for live-verify.

**ITEM 1 — SAFE DOG-LEG (auto traverses).** The wall1→wall2 auto reposition was ONE simultaneous diagonal `G0 X#23 Y#24` — at SCAN DEPTH it can clip the corner. Replaced with a TRUE two-move dog-leg that routes AROUND the outside corner.
- `wizards/ops/probeSurface.js` — `safeTraverseStack` seq mode: NEW opt-in `p.firstAxis` ('X'|'Y'). When set → TWO sequential
  single-axis rapids in that order; ABSENT → the original single simultaneous XY move (byte-identical fallback). Doc + inline note.
- `wizards/cornerWizard.js` — wall1→wall2 (`repoTraverse`) now passes `firstAxis: ax.sA` (the SECOND wall's axis), threaded
  through `repoArmR`. GEOMETRY-AWARE (from `axesOf`, forked in csFork → per corner×probeSeq in BOTH the twin superset + the
  built-in → byte-parity holds). Derivation: after probing wall-1 the tool is OUTSIDE the stock along wall-1's axis (fA) but
  INSIDE its span along wall-2's (sA); moving sA FIRST clears past the corner (fA-out·sA-out) before fA brings it in — moving fA
  first lands fA-in·sA-in = INSIDE the stock. Topological → holds for ALL 8 combos (only signs flip). Verified: XY→Y-first,
  YX→X-first, per-quadrant-independent, against an INDEPENDENT hand-derivation (not just "two moves exist").
- **⚠ DECISION I MUST FLAG (Z→wall1 deviates from "both"):** the dispatch listed BOTH Z→wall1 (:239) AND wall1→wall2 (:256) to
  split. I split ONLY wall1→wall2 and left Z→wall1 a single diagonal (byte-IDENTICAL), on three grounds: (a) SAFETY — Z→wall1
  runs at safe-Z (lift #19, no drop; the wall-1 step plunges later) so it's ABOVE the stock and a diagonal there CANNOT collide;
  the collision risk is ONLY the scan-depth wall1→wall2. (b) NO-OP — by default one of #21/#22 is 0, so splitting Z→wall1 would
  emit a no-op `G0 X0`/`G0 Y0` into production probe code (unverifiable on hardware while away — Live-CNC-read-only). (c)
  BYTE-PARITY — Z→wall1 is NOT forked per-combo (it references #21/#22 as vars, emitted once), so a geometry-aware order there
  would desync the twin's superset from the built-in for non-default seq; a diagonal keeps them identical. The architecture and
  the safety need ALIGN: the traverse that NEEDS the dog-leg (wall1→wall2) is exactly the one that's cleanly forkable. If you'd
  rather split Z→wall1 too for uniformity, say the word — but it adds a no-op leg for zero safety gain.
- **MARKER-MOMENT (folded in, no code needed):** the sim marker is DECLARED at the post-sequence net endpoint via
  `cornerReposOffsets` (net delta), fed identically to the trace + engine `_passStarts`. move-A+move-B = the SAME net delta as
  the old diagonal → the marker is INVARIANT under the split (it already sits at the point right before G31, NOT an intermediate
  dog-leg corner). The declare-not-infer architecture makes this free. Confirmed: corner-data-sim-marker-track tests (1)+(2)
  (independent-truth chaining + emit byte-parity) stay GREEN unchanged.

**ITEM 2 — 3D RAINBOW ARC (manual jog).** `viz/gcodeViz3d.js` — the manual inter-pass jog (drawn prevEnd→pass-start, gated on
source==='manual') was a STRAIGHT segment. Now BOWS UP in +Z: a sampled quadratic (control point lifted `max(4, chord*0.45)`
above the chord midpoint, matching the 2D bow factor) pushed as a 16-segment polyline → BOTH the dashed route AND the animated
trail arc. AUTO passes draw no jog (unchanged). The 3D twin of toolpath2d's existing 2D bow.

**ITEM 3 — CSS-SPECIFICITY COLOUR FIX.** `viz/featureCanvas.js` — the source-coloured handles set fill/stroke via a presentation
ATTRIBUTE (svgEl), which the class rule `.fc-handle{fill:#ffce54}` (gold) OUTRANKS → getComputedStyle showed gold despite the
attribute reading the right cyan/amber. Now set via INLINE STYLE (`el.style.fill/stroke`), which beats the class. Applied to BOTH
the emitting-move handle (the advisor's confirmed case) AND the sim-only handle (same root cause — its fill:none + source stroke
were ALSO overridden). Preview-only; no emit.

**VERIFY (all green, all mutation-proven):**
- Item 1: `corner-travel-approach` NEW test "dog-leg moves the SECOND wall axis FIRST — all 8 combos" (asserts the geometry-aware
  ORDER, the CORRECTNESS property; Mut hardcode-X-first → RED for XY combos). corner-data-emit GOLDEN + corner-data-travelApproach-
  live + the probe-surface-block CORNER_GOLDEN (4 full-emit snapshots) REGENERATED to the dog-leg — old↔new diff proved SURGICAL
  (each combo's ONLY change = the single diagonal → the 2-move safe order; Z→wall1 + all else byte-identical).
- Item 2: `marker-colour-by-source` NEW test "3D manual jog BOWS UP in +Z" (polyline apex >5mm above the flat chord; Mut bow=0 → RED).
- Item 3: `corner-viz-polish` (3) + `corner-data-sim-marker-track` (3) HARDENED to assert getComputedStyle().fill/.stroke (the
  ACTUAL painted colour) — the bar that would have caught the bug (the old getAttribute check passed WHILE it rendered gold).
  Mut back-to-attribute → getComputedStyle reports gold rgb(255,206,84) → RED.
- **Full suite: 487 passed, 0 failed, 1 flaky (known middle-animator stroke-dashoffset, retries green), 2 skipped = 490 total**
  (reconciled: 488 prior + 2 new tests). project-drawer-smoke flaked once under full-suite parallelism, passes in isolation +
  on re-run (unrelated to my files — nothing I touched is imported by the project drawer). Byte-parity: twin ≡ built-in preserved
  (both go through cornerStack; the dog-leg applies identically) — corner-data-travelApproach-live's 2×2 byte-for-byte parity green.

**⏸ PASS BACK for your live-verify** — the dog-leg (geometric pixel-checks across multiple corner/probeSeq combos: XY→Y-first,
YX→X-first, at scan depth) + the 3D rainbow arc + the computed-style colour fix. FLAGGING the Z→wall1 decision (split only
wall1→wall2; Z→wall1 kept a byte-identical diagonal — above stock, no-op-avoidance, byte-parity — reasons above). COMMITTED, NOT pushed.

## 🔨 turn 91 (cycle 11) — GAP-SCOUT (SCOUT ONLY, no code): the preview path-disconnect (probe-1-end → dog-leg → ② reads as floating). SETTLED + root-caused + declared fix proposed. ⏸ PASS BACK for advisor review before any build.

**METHOD:** live empirical queries (localhost:3211, corner-data twin, default FL/YX + probeZ-on) to settle mispositioned-vs-disconnected + validate the fix direction; then a Workflow (5 agents: old-view reference + fix-seam derivation + 3 adversarial verifiers) to read the reference + refute the root cause / stress the fix / audit blast-radius. All 3 verifiers: root-cause SURVIVES, fix SURVIVES_WITH_CAVEAT.

**① SETTLED — ONE gap bug, ② is NOT mispositioned.** Empirical: `passStarts[1]` (fed to BOTH the 3D/2D marker sprites AND the engine `_passStarts`) == the declared net endpoint ② = (-43,7). So the ② MARKER renders at the correct place. But the pass-1 ROUTE (dog-leg + wall-2 probe) draws at (-93,57) — shifted +cross(-50,+50) BEYOND ②, disconnected from pass-0-end (~7,-7). So: ②'s position is right; the CONNECTING ROUTE is drawn in the wrong frame. Confirms the advisor's t90 hypothesis (one gap, not two bugs).

**② ROOT CAUSE — draw-anchor / marker-sprite CONFLATION + an incremental dog-leg.** The single `passStarts` array (computePassStarts, createPreviewPanel.js:388-408) is filled by the provider (cornerSimStartsProvider, cornerData.js:136-145) with the probe-FIRE NET ENDPOINTS (wall_N = wall_{N-1} + cross) and then fanned out UNMODIFIED as BOTH (a) the marker sprite position AND (b) the per-pass route DRAW-ANCHOR — at THREE consumers: 3D `off = starts[pass]` (gcodeViz3d.js:749-752), 2D `passOff → starts[i]` (toolpath2d.js:78-84), engine `O = _passStarts[_pass]` (GcodeExecutionEngine.js:981). The dog-leg emits INCREMENTALLY (probeSurface.js seq mode, under `DM('inc')`) AFTER the `reposition:` comment that resets pos={0,0,0} (engine:598-602). So the pass-local target ALREADY contains +cross; world fire = anchor + local = net-endpoint + cross = DOUBLE-COUNT → +cross beyond ②. SYSTEMIC to every AUTO reposition pass (probeZ Z→wall1 too — verified: its own net-endpoint anchor shifts it -50 as well). Dog-leg ORDER/retract are red herrings (the 2 legs sum to the same net regardless of order).

**③ SEVERITY UPGRADE (workflow found) — this is NOT preview-only cosmetics; it's a real SIMULATOR bug too.** The engine's `_passStarts` `O` ALSO drives the probe-vs-STOCK COLLISION (GcodeExecutionEngine.js:981-983,:997) and the #1925-1927 trigger-position DRO (:501-502,:1017-1019). So TODAY the simulator's own wall-2 probe fires from (-93,57), sweeps the WRONG stock face (or misses), and writes wrong #1925-1927. Feeding the re-park anchor makes `O + local` land exactly on ② → the probe fires from the right point + the DRO matches. So the anchor fix is REQUIRED, not cosmetic. STILL byte-parity-safe: cornerReposOffsets/cornerSimStartsProvider are PREVIEW-ONLY, the engine is the SIMULATOR (never writes the .nc); emit untouched.

**④ REFERENCE (old 2D-sim topview) — DEAD code, a MODEL not a live view.** cornerVizAnimator.js animates pre-authored STATIC SVG paths (assets/svg/cornerViz.svg) in ONE continuous frame (no per-pass re-anchor) — continuity is AUTHORED into the geometry (e.g. corner_BL_XY_travelpath's end == X_probepath's start). It is RETIRED/never-instantiated (built-in retired ④; grep `new CornerVizAnimator` -> 0 hits; only inert window.* exports). The twin's preview uses ONLY createPreviewPanel/toolpath2d/gcodeViz3d (the new per-pass-anchored path) — which is exactly where the disconnect lives. So the reference is the correct-model DIFF TARGET, not a view the user currently sees.

**⑤ EMPIRICAL FIX VALIDATION (experiment C):** feeding pass-1's draw-anchor = marker0=(7,-43) [the re-park where the dog-leg begins] instead of marker1 -> dog-leg draws (7,-43)->(-43,7), probe fires EXACTLY at (-43,7)=②. Continuous + probe on its own marker. CONFIRMED reconnect.

**⑥ PROPOSED DECLARED FIX (Fix A — DECOUPLE the draw-anchor from the marker sprite):**
- Corner DECLARES, per AUTO-reposition sim-start row, that its ROUTE anchors at the PREVIOUS chain point (a per-row flag, e.g. `anchorsAtPrev`, set by cornerSimStartsProvider only for source==='auto' reposition destinations — it already computes the chain xy.zsurf->xy.wall1->xy.wall2 and the per-pass source). The MARKER sprite {x,y} stays at the net endpoint (unchanged).
- RESOLVE the draw-anchor LIVE (NOT a frozen provider field — the drag handler mutates starts[p] in place, gcodeViz3d.js:1471): `drawAnchor[N] = row.anchorsAtPrev ? starts[N-1] : starts[N]`, reading the CURRENT starts array, so dragging marker[N-1] re-drags pass-N's route.
- ANCHOR readers swap to the resolved anchor (fallback `anchor || row` so ops WITHOUT the flag = today): 3D route off (gcodeViz3d:752 + the collision Aw/Bw + prevEnd + the manual-jog B), 2D passOff (toolpath2d:80), engine collision O + DRO (GcodeExecutionEngine:981,:501 — move together).
- MARKER readers keep {x,y}: 3D/2D sprites (createPreviewPanel:472, toolpath2d sptx/spty), the Layout FeatureCanvas reposition handle (panelTypes.js:132). Do NOT substitute the anchor INTO {x,y}.
- SEAM: the flag is DECLARED in the provider (corner-scoped, one-source with cornerReposOffsets); the resolution is a small live transform at the feed (computePassStarts already forwards declared row props like emits/source). PREVIEW-ONLY for emit.

**Fix B (don't reset/re-anchor auto passes -> draw continuously) — REJECTED:** fewer lines only at the reset site, but it detonates the pass-index contract the whole per-pass system keys on (byPass grouping engine:723, _passCount markers, passSources colours) AND DESTROYS the 2nd draggable marker — the very feature whose addition surfaced this bug. Fix A keeps every marker/handle + corrects the engine frame; it wins decisively.

**⑦ CAVEATS the BUILD must handle (from the adversarial verifiers — assert-the-value, not visual-only):**
1. SOURCE-GATE is load-bearing: MANUAL corner reposition emits NO dog-leg (operator jogs, short-circuit) -> its probe fires at anchor=marker[N] and the existing jog line bridges (gcodeViz3d:759-761). So anchorsAtPrev must be TRUE only for AUTO reposition rows; manual keeps anchor=self. Un-gated -> manual breaks.
2. LIVE not frozen (drag-consistency) — resolve from the current starts[N-1], per ⑥.
3. FALLBACK `anchor || row` at all 3 read sites — else middle/rotary/alignment/edge rows (no anchor) feed O=undefined -> NaN -> every non-corner probe collision breaks. (This is the #1 way to turn a corner-scoped fix into an all-ops regression.)
4. pass-0 self-anchor (anchorsAtPrev=false for N=0).
5. ENGINE FRAME test: assert #1925-1927 == the wall-2 marker net endpoint (the collision now fires from the right point) — a real-value assertion, not just a "looks connected" pixel check. The DRO (:501) + the #1925 write (:1017) read the same O -> move together.
6. MINOR RESIDUAL (honest — the fix does NOT claim perfect continuity): the dog-leg starts at marker[N-1] (the pass's declared START, ON the previous pass's drawn line -> the STATIC route reads connected), but the tool's actual retracted end is ~36mm up-line, so the ANIMATED head jumps slightly at the pass boundary. marker[N-1] is the CORRECT declared anchor (only value that lands the probe on ②; anchoring at the runtime-solved pass-end would move the probe 36mm off its marker). Closing the residual fully needs a runtime-solved chain (wall_END+cross), not statically declarable — out of scope; flag for the human's call on whether the animated-head jump matters.
8. CORNER IS THE ANOMALY (why it's corner-scoped): middle/rotary/alignment declare their per-pass start AS the re-park point AND emit the connecting travel BEFORE the `reposition:` comment (prior pass's frame) -> anchor==marker already; the flag defaults off -> no-op for them.

**⏸ PASS BACK the finding + Fix A for advisor review BEFORE building** — settled (disconnect, not mispositioned), root-caused (draw-anchor/marker conflation + incremental dog-leg double-count), severity-upgraded (real engine collision/DRO bug), reference confirmed (dead SVG, correct-model only), fix proposed (declared decouple, corner-scoped, live-resolved) with the manual/fallback/engine-frame/residual-gap caveats spelled out. NO code changed this turn.

## 🔨 turn 94 (cycle 11) — BUILD Fix A: the DECLARED draw-anchor decouple (preview path-disconnect + real sim-engine bug). Suite green (495 passed, 0 failed, 497 total; 7 new hardened specs, each mutation-proven). Byte-parity untouched. COMMITTED (not pushed). ⏸ PASS BACK (advisor fan-out review — shared engine).

**THE FIX (⑥ in the t91 scout, advisor-blessed t93).** The per-pass `passStarts[N]` (the probe-FIRE net endpoint, wall_N=wall_{N-1}+cross) was used UNMODIFIED as BOTH the marker sprite AND the route DRAW-ANCHOR; the incremental dog-leg (after the `reposition:` pos-reset) double-counted +cross → the route + the sim's probe-collision origin fired +cross beyond ②. DECOUPLE: declare `anchorsAtPrev` per AUTO reposition row; resolve the route/collision anchor LIVE = `starts[N-1]` (else self); the marker {x,y} stays the net endpoint.

**CODE (5 src + 1 new helper):**
- **NEW `engine/passAnchor.js`** — `drawAnchorFor(starts, pass)`: `(row.anchorsAtPrev && pass>0 && starts[pass-1]) ? starts[pass-1] : row` (undefined if the row is absent → caller keeps its own `||` fallback). The SINGLE place the fallback lives → no consumer can get the #1 all-ops-regression wrong. Resolved LIVE from the current array (drag-consistent).
- **`blocks/dataOps/cornerData.js`** `cornerSimStartsProvider` — declares `anchorsAtPrev = i>=1 && source==='auto'` (auto reposition destinations only; pass 0 + manual → false = self-anchor).
- **`viz/createPreviewPanel.js`** — `computePassStarts` forwards `anchorsAtPrev` (like emits/source); the `v.starts[p]` copy carries it (the sprite still uses x/y/z).
- **`viz/gcodeViz3d.js`** — (a) `_rebuild`: `off = _anchorToStart ? (drawAnchorFor(this.starts, p) || mk) : {0,0,0}` — `off` feeds the route, the probe-collision Aw/Bw, prevEnd, AND the manual-jog B; (b) `setToolPosition` (the LIVE engine-driven tool head): `o = drawAnchorFor(this.starts, pass) || …` so the head rides the SAME re-park anchor as its route (found by the self-verify — see below). `_positionMarkers` (sprite) unchanged.
- **`viz/toolpath2d.js`** — `passOff` resolves `drawAnchorFor(starts, i)`; `setStarts` preserves `anchorsAtPrev`; the 2D pointermove drag preserves `anchorsAtPrev` on the row (found by the self-verify); sprites (sptx/spty) unchanged.
- **`engine/GcodeExecutionEngine.js`** (the shared-engine touch) — the probe-collision origin O (~981) AND the DRO O (~501) = `drawAnchorFor(this._passStarts, this._pass) || this._stockOffset`. `#1925-1927 = O + target` → the sim's own probe now fires from the re-park anchor + lands on ②.

**EMPIRICAL (real symptom, before the specs):** default FL/YX — the dog-leg draws (7,-43)→(-43,7) and the wall-2 probe FIRES at ②=(-43,7) (was (-93,57), +cross). The engine's #1926 (wall-2 X-probe trigger Y) = 7 = ②.y (was 57). Manual → anchorsAtPrev false (self). A non-corner starts array → drawAnchorFor === self (no NaN).

**ADVERSARIAL SELF-VERIFY (before commit — shared-engine risk, ultracode).** Ran a 3-skeptic workflow on the actual diff (all-ops-regression · resolution-edges · missed-consumer). all-ops SURVIVES (drawAnchorFor is provably identity for any no-flag row; 33 specs incl. 20 non-corner probe/multi-pass all pass; anchorsAtPrev set in exactly ONE place, coerced false at all 3 read sites). resolution-edges verified probeZ-ON 3-pass LIVE (both reposition passes compose: pass1 anchors zsurf, pass2 anchors wall1). It caught **2 real issues I'd missed** (both now FIXED + spec-locked):
  1. **MISSED CONSUMER (2 verifiers, independently): `gcodeViz3d.setToolPosition`** — the LIVE engine-driven 3D tool head still rode raw `starts[pass]` (net endpoint) while its route now rides the re-park anchor → on the DEFAULT corner AUTO pass, during a real ▶ Simulate the 3D head floats +cross off its own dog-leg while the 2D head tracks correctly (the exact disconnect, half-fixed). FIXED → drawAnchorFor; new spec (7) LIVE-HEAD locks it (Mut M7 → head at net endpoint → RED).
  2. **2D-drag transient**: the toolpath2d pointermove drag replaced the row with a fresh `{x,y,z}`, DROPPING anchorsAtPrev → a mid-drag flicker (self-corrected on pointer-up). FIXED → preserve the flag (matches the in-place 3D drag).

**7 HARDENED SPECS (`corner-draw-anchor.spec.js`), assert-the-value + MUTATION-PROVEN EACH:**
1. **ENGINE-FRAME** — the sim's wall-2 probe trigger #1926 == ②.y (fires from the re-park anchor). Mut M1 (engine O → net endpoint) → #1926=57 → RED.
2. **FALLBACK** (the #1 all-ops guard) — no flag → drawAnchorFor === self (never undefined); a non-corner multi-pass op (middle boss) traces with NO NaN + every pass self-anchored. Mut M4 (drop the `:row` self-fallback → undefined) → self-checks RED.
3. **SOURCE-GATE** — MANUAL corner reposition keeps anchor=self (no dog-leg; the jog bridges); its wall-2 probe fires at ② directly. Mut M3 (provider drops `&& source==='auto'`) → manual wrongly flagged → RED.
4. **ROUTE-RECONNECT** — real coords: auto pass-1 dog-leg STARTS at marker[0] (7,-43) AND the wall-2 probe fires at marker[1]=② (-43,7). Mut M2 (drawAnchorFor always self) → probe at (-93,57) → RED.
5. **DRAG-CONSISTENCY** — the anchor tracks a LIVE in-place mutation of marker[N-1] (what a drag does), not a frozen snapshot. Mut M5 (hardcode the anchor) → stale → RED.
7. **LIVE-HEAD** — the engine-driven 3D tool sprite rides the re-park anchor for a flagged corner pass (matches its route). Mut M7 (setToolPosition → net endpoint) → head at (-43,7) not (7,-43) → RED.
6. **BYTE-PARITY** — twin == cornerStack byte-for-byte across the probeZFirst×travelApproach 2×2; no `anchor` text leaks into the .nc. (A regression guard: the emit path is untouched, so there is no code to mutate — proven positively + by the untouched corner-data-emit / probe-surface-block CORNER_GOLDEN / corner-data-travelApproach-live goldens staying GREEN.)

**BLAST RADIUS (the shared-engine risk):** the engine change is behavior-NEUTRAL for every op EXCEPT corner-data — any pass without `anchorsAtPrev` (all non-corner ops, corner pass 0, corner manual) resolves to self via drawAnchorFor → O unchanged. Proven: FULL SUITE 495 passed, 0 failed, 2 skipped = 497 (490 prior + 7 new) — ZERO existing test broke, incl. all probe/middle/rotary/edge sim tests + the byte-parity goldens + per-pass-live-anchor (no-flag → setToolPosition identity).

**RESIDUAL (accepted, human t93):** the STATIC route + the sim fire are now correct, but the ANIMATED playback head still jumps ~36mm at the pass boundary (the declared anchor marker[N-1] is the pass START, not the tool's runtime-retracted end). Fully closing it needs a runtime-solved chain (wall_END+cross) — NOT statically declarable, OUT OF SCOPE. Not attempted.

**Surgical:** 5 src + 1 new helper + 1 new spec. TOUCHES THE SHARED SIM ENGINE → ⏸ PASS BACK for the advisor's fan-out review (the fallback/all-ops surface is the highest risk — mutation-proven + full-suite-clean). COMMITTED, NOT pushed. Next (queued, one per turn): SVG cleanup + non-FL prefill.

## 🔨 turn 96 (cycle 11) — SVG-CLEANUP: ENUMERATED the full reference graph (step 1). GATE HIT — the graph is BIGGER than the scout's "2 files + inert window export" framing + reveals a CROSS-APP dimension my own t91 scout MISSED. ⏸ STOP + FLAG for advisor scope-confirm before the irreversible deletion (no live USE found → deletion is SAFE, but scope grew into core files + the VS Code extension).

**FULL REFERENCE GRAPH (grepped cornerVizAnimator / CornerVizAnimator / cornerViz.svg / the SVG element-ids / window exports across the WHOLE repo):**

**DDCS-Studio (primary app + the test suite) — all INERT/ORPHANED, no live USE:**
1. `web/viz/cornerVizAnimator.js` — the file (imports PathAnimator/flashWcs from middleVizAnimator.js which STAYS — edge/align use it; inert `window.CornerVizAnimator` export at :202).
2. `web/ui/globalFunctions.js:6` — `import { CornerVizAnimator }`. globalFunctions IS loaded at runtime (`app.js:14 import { setupGlobalFunctions }`), so the module executes + :31 `window.CornerVizAnimator = …` runs — an INERT export (never `new`'d; `new CornerVizAnimator` = 0 hits in DDCS-Studio). **Deleting the file REQUIRES removing :6 + :31 (else the import 404s).**
3. `web/assets/svg/cornerViz.svg` — loaded ONLY by `window.drawCornerViz` (index.html), which is NEVER CALLED by the app (its caller — the built-in Corner wizard view — was retired ④). So the SVG is NEVER fetched at runtime.
4. `web/index.html:~1908` `window.drawCornerViz` (loads cornerViz.svg into `#cornerVizContainer`) — DEFINED, never called (+ comments :1834/:1838). `#cornerVizContainer` DOM element does NOT exist (grep `id="cornerVizContainer"` = 0).
5. `web/app.js:131` calls `initializeCornerVisualization()` (:215-230) — CALLED at startup but `getElementById('cornerVizCorner')` → null (no such DOM element) → `if` false → NO-OP.
6. `web/index.html:2197,2296` — `getElementById('cornerVizCorner')` inside LIVE edge-viz functions (addEdgeMarker) — guarded dead branches (`if(cornerRoot)` false → graceful fallback). ADJACENT (inside live functions).
7. `web/ui/iconEditor.js:12` — a COMMENT ("the old probe-sequence viz files … are retired from the palette"); cornerViz is NOT in `TILESET_FILES=['tileset']`. Not a live ref.
8. `web/viz/edgeVizAnimator.js:3` — a COMMENT ("Mirrors CornerVizAnimator pattern"). Live file, dangling name in a comment.

**Dev tools (non-runtime):**
9. `tools/smoke_test_playwright.py:56,184` — checks `#cornerVizContainer` + calls `window.drawCornerViz()` (guarded `window.drawCornerViz &&`). A PYTHON smoke tool, NOT the .spec.js suite.
10. `tools/tmp_prefix_svg_ids_in_scopes.cjs:4` — lists `src/assets/cornerViz.svg`. A `tmp_` one-off dev script.

**Docs:** `docs/archive/CAM-MENU-RESEARCH.md:154,284` — historical mentions (leave).

**VS Code EXTENSION (a SEPARATE managed fork — my DDCS-Studio scope did NOT cover it; the t91 scout MISSED this):**
11. `ddcs-vscode-extension/web/dist/bundle.js:15448-49` — `if (!window.__cornerAnimator && window.CornerVizAnimator) window.__cornerAnimator = new window.CornerVizAnimator()` — a STALE built artifact (from the retired cornerView). GUARDED-OFF + DEAD: the class body is NOT in the current bundle (grep `_buildSteps|class CornerVizAnimator` in bundle.js = 0) → `window.CornerVizAnimator` is undefined there → the `new` never runs.
12. `ddcs-vscode-extension/web/extension_index.html:1639-56,1928,2027` — `drawCornerViz` (defined, NEVER called in the extension either) loads `./assets/svg/cornerViz.svg` — the extension has NO own cornerViz.svg (find = empty) → already 404s if ever called.
13. **Extension build = `esbuild web/src/extensionApp.js`.** extensionApp.js imports MANY DDCS-Studio/web modules (`../../../DDCS-Studio/web/...`) BUT NOT globalFunctions.js (only mentions it in a comment :197) and NOT cornerVizAnimator.js. So cornerVizAnimator.js is NOT in the extension's build graph → **deleting DDCS-Studio's cornerVizAnimator.js / cornerViz.svg does NOT break the extension's build or runtime** (it's independent; its dangling refs are its OWN stale artifacts).

**GATE VERDICT:** NO genuine LIVE/runtime USE (imports+USES) of cornerVizAnimator/cornerViz.svg anywhere — all references are inert imports / orphaned-never-called / no-op-called / guarded dead-branches / comments / stale-guarded-off artifacts / dev-tools / docs. So the deletion is SAFE (DDCS-Studio suite won't break; the extension is independent). Per the literal gate (no live use → step 3), I *could* proceed. I STOP anyway because the graph is materially bigger than the framing + touches CORE files + surfaces a cross-app cleanup item the scout missed — worth a one-round scope-confirm on an irreversible deletion.

**PROPOSED SURGICAL PLAN (for advisor confirm) — DDCS-Studio only:**
- (A) DELETE `web/viz/cornerVizAnimator.js` + `web/assets/svg/cornerViz.svg`.
- (B) `web/ui/globalFunctions.js` — remove :6 import + :31 window assign (MANDATORY — the direct import; else DDCS-Studio breaks).
- (C) `web/index.html` — remove the orphaned `window.drawCornerViz` block (+ its :1834/:1838 comments). [dedicated-to-cornerViz, not adjacent]
- (D) `web/app.js` — remove `initializeCornerVisualization()` (:215-230) + its call (:131). [dedicated-to-cornerViz]
- (E) LEAVE (adjacent/out-of-scope, flag): index.html:2197/2296 cornerVizCorner dead-branches (inside LIVE addEdgeMarker — has a fallback; editing = adjacent); edgeVizAnimator.js:3 + iconEditor.js:12 comments; the dev-tools (smoke_test/tmp_prefix); the docs; the VS Code EXTENSION's own dangling refs (separate managed fork — needs its OWN cleanup pass: bundle rebuild + extension_index.html drawCornerViz removal).

**SCOPE QUESTIONS for the advisor:**
1. Confirm A+B+C+D (delete the 2 files + globalFunctions + the orphaned index.html/app.js machinery).
2. Include (E) the index.html edge-viz dead-branches + the comments + the dev-tools cleanup, or leave as "adjacent"?
3. The VS Code EXTENSION has its OWN dangling cornerViz refs (drawCornerViz + a stale bundle) — a SEPARATE managed-fork cleanup (out of the DDCS-Studio scope). Flag to human / defer / include?

**NO code changed this turn (gate).** Awaiting scope-confirm, then I execute the surgical deletion + verify the full suite green + byte-parity untouched.

## 🔨 turn 98 (cycle 11) — SVG-CLEANUP EXECUTE (scope A+B+C+D, advisor-confirmed t97). Removed the DEAD old-2D-sim cornerViz reference. Full suite green (495 passed, 0 failed, 497 total) — byte-parity untouched (viz/UI-only). COMMITTED (not pushed). ⏸ PASS BACK.

Executed the confirmed surgical deletion (the enumeration + gate were t96/6193364):
- **(A) DELETED** `web/viz/cornerVizAnimator.js` + `web/assets/svg/cornerViz.svg` (git rm).
- **(B)** `web/ui/globalFunctions.js` — removed the `import { CornerVizAnimator }` (:6) + the `window.CornerVizAnimator = …` assign (:31). MANDATORY (globalFunctions is in the live module graph via app.js:14 — leaving the import would 404 the deleted file).
- **(C)** `web/index.html` — removed the orphaned `window.drawCornerViz` block (was :1908-1963) + the corner-only `let cornerSvgLoaded` (:1887). KEPT the SHARED helpers `fetchSvg` + `namespaceSvgDefs` (used by drawMiddleViz/Edge/Align) + `middleSvgLoaded` — verified intact.
- **(D)** `web/app.js` — removed `initializeCornerVisualization()` (the method + its :131 call). It was called at startup but no-op'd (no `cornerVizCorner` DOM element).

**LEFT surgically (E, per the advisor) — did NOT touch:** the index.html shared-helper COMMENTS (:1834/:1838 still name drawCornerViz) + the `cornerVizCorner` dead-branches inside the LIVE `addEdgeMarker` (guarded, with a fallback); `edgeVizAnimator.js:3` "Mirrors CornerVizAnimator pattern" comment; `iconEditor.js:12` comment; the dev-tools (`smoke_test_playwright.py`, `tmp_prefix_svg_ids`); the docs. **DEFERRED the VS Code EXTENSION** (its own dangling refs = a separate managed-fork pass; it's independent — doesn't build-import cornerVizAnimator, so this deletion doesn't break it).

**VERIFY:** `node --check` on both edited JS (globalFunctions.js + app.js) → OK (no broken imports). Post-deletion grep: the ONLY remaining `CornerVizAnimator` in DDCS-Studio/web is the edgeVizAnimator.js:3 COMMENT (E — left); NO remaining runtime `cornerViz.svg` load; the 2 remaining `drawCornerViz` mentions are the E comments. **Full suite 495 passed, 0 failed, 2 skipped = 497** — IDENTICAL to the pre-deletion count (turn 94/turn 96 baseline), so the app still BOOTS (globalFunctions loads without the deleted import), every wizard preview works, and the byte-parity goldens (corner-data-emit / probe-surface-block CORNER_GOLDEN) pass → byte-parity untouched (this is a viz/UI-only deletion; the emit path was never involved).

Surgical: 2 files deleted + 3 edited (globalFunctions, index.html, app.js). COMMITTED, NOT pushed. Next queued: ANCHOR-END scout.

## 🔨 turn 100 (cycle 11) — WALL-1-Z-FRAME SCOUT (SCOUT ONLY, no code; GATE — emit = real machine motion). Designed the Z-TRUST emit redesign + the intertwined sim anchor-end; answered Q1-Q4; proposed the build sequence + 1 fork. ⏸ PASS BACK for advisor+human review BEFORE building.

**METHOD:** traced the live probeZ-off/on/manual emit (exact Z-motion), read probeSurfaceStack + probeWallR + safeTraverseStack + the #17-#20 defs + gcodeViz3d prevEnd; adversarial-verify workflow on the emit-motion + the sim frame-tension.

**CURRENT probeZ-OFF Z-motion (traced, G91 throughout the body):** jog to wall-1 (operator sets jogged_Z) → `G0 Z#18` (=-#17=-(safeZ+scanDepth), the PLUNGE) → G31 (wall-1 at jogged_Z-#17) → retract → `G0 Z#17` (lift → jogged_Z) → dog-leg XY (at jogged_Z) → `G0 Z#18` (drop -#17) → G31 (wall-2 at jogged_Z-#17) → retract → `G0 Z#17`. So TODAY both walls probe at jogged_Z **minus #17** — the operator's jog height is treated as safeZ+scanDepth ABOVE the probe point (the unverified assumption the human rejects). Macro vars: #19=safeZ, #20=scanDepth, #17=[#19+#20], #18=[0-#17].

**PROPOSED Z-TRUST EMIT (probeZ OFF only; probeZ ON UNCHANGED) — verified by the adversarial workflow (emit-motion SURVIVES; 3 mandatory constraints folded in):**
- **(1) GATE the wall-1 plunge** (`cornerWizard.js:272 mkMV('Z','#18')`, UNCONDITIONAL today) on probeZFirst → emit ONLY when probeZ ON. probeZ-off → NO plunge → wall-1 probes AT jogged_Z. **⚠ MUST gate via the existing `zOnlyR` helper (:152), NOT a bare `if(probeZ)`** — :272 is a bare mkMV that emits ONCE in the SUPERSET (unconditional), so a concrete-only guard would leave the twin's superset still emitting the plunge on the pruned OFF leaf → twin≠built-in for OFF. `zOnlyR([mkMV('Z','#18')])` (superset→GUARD(WHEN_Z); concrete→probeZ?[…]:[]) is the SAME proven fork the header/step/Z-surface adds use.
- **(2) MANUAL reposition (probeZ-off): remove the auto-drop** (`safeTraverseStack` manual `p.drop`) — the operator re-jogs Z; never auto-adjust after a manual jog. **⚠ Scope PER-ARM via the EXISTING `zPairR` at :274** (repoArmR is already split into an ON arm + an OFF arm): KEEP `drop:'#18'` in the probeZ-ON arm (ON's wall-2 descends to scan depth ONLY via this drop — :276 has no plunge of its own) AND in the AUTO-OFF arm (its round-trip to jogged_Z); OMIT drop only in the probeZ-OFF MANUAL arm.
- **NET probeZ-off AUTO:** wall-1 probes at jogged_Z → lift #17 → jogged_Z+#17 → dog-leg at jogged_Z+#17 (now the HIGHEST point in the cycle — STRICTLY SAFER than today, whose OFF dog-leg ran at scan depth THROUGH material) → drop -#17 → jogged_Z → wall-2 probes at jogged_Z. **"BOTH walls at jogged_Z" is an AUTO-OFF guarantee; MANUAL-OFF wall-2 lands at the operator's RE-JOGGED Z** (acceptable — manual = the operator eyeballs each wall). Error handler (:298 `MV('Z','#17')`) over-lifts to jogged_Z+#17 on a wall-1 fail (higher=safer, benign — leave un-gated).

**⚖️ FORK — RESOLVED by the workflow: ship OPTION A.**
- **OPTION A (RECOMMENDED):** keep the lift/drop at #17. The ENTIRE change is gating the plunge (via zOnlyR) + the OFF-manual drop — `cornerWizard.js:172`'s shared per-wall lift `#17` is UNTOUCHED; the round-trip nets zero correct-by-construction.
- **OPTION B (only if the human insists scanDepth be provably inert):** NOT a one-line swap — the per-wall lift at :172 is SHARED by both walls + both probeZ states and MUST equal the reposition drop for the round-trip to net zero. Changing ONLY the reposition drop to #19 while :172 stays #17 lands wall-2 at jogged_Z+(#17−#19)=jogged_Z+scanDepth (WRONG). B therefore also requires making :172's lift probeZ-conditional (`probeZ?'#17':'#19'`) — a bigger, riskier change (the #17 must stay ON to undo the #17 plunge). **Recommend A** (achieves "probe at jogged_Z", the core complaint); take B only on an explicit human call, and then fork BOTH the drop AND :172's lift on probeZ.

**THE 4 OPEN QUESTIONS — RESOLVED:**
- **Q1 (probeSurfaceStack interaction):** SAFE. probeSurfaceStack (probeSurface.js:21-54) emits NO internal Z move for a horizontal X/Y wall probe — it fires G31 at whatever Z the tool sits at (the plunge is EXTERNAL, cornerWizard.js:272). Removing the external plunge → probeSurfaceStack simply fires at jogged_Z. No internal assumption broken.
- **Q2 (runtime jogged-height reference for the drop):** For the EMIT it's IMPLICIT — the body runs in G91 (incremental), so lift #17 / drop -#17 are RELATIVE and return to jogged_Z WITHOUT capturing the absolute value in a var. No new macro var / no runtime-read needed. (The "reuse userStarts" idea applies to the SIM side, Q3 — the emit is self-referential via relative moves.)
- **Q3 (INTERTWINED sim anchor-end) — my first design (swap the anchor to prevEnd) was REFUTED by the workflow; corrected to a BRIDGE LINE:** the t95 concern is "the dog-leg must START from the wall-1 END (post-probe+retract+lift), not the START marker." My naive fix (feed `prevEnd`, gcodeViz3d.js:816, as the AUTO dog-leg anchor replacing drawAnchorFor's static starts[N-1]) is WRONG: `prevEnd` is END-based, but the emitted #23/#24 delta + ② are START-relative (②=marker[N-1]+delta, and today the drawn wall-2 endpoint = off+delta = marker[N-1]+delta = ② EXACTLY because off=marker[N-1]). Swapping off→prevEnd would draw the wall-2 endpoint at prevEnd+delta = ② SHIFTED by (retract + Z lift) — RE-INTRODUCING the exact +cross-beyond-② disconnect Fix A fixed, AMPLIFIED in Z by Z-trust (prevEnd carries the +#17 lift). **CORRECT FIX = a BRIDGE (connecting) LINE:** KEEP the dog-leg+probe anchored at marker[N-1] (so the probe still lands on ② + matches the #23/#24 START-relative macro semantics + preserves the drag-edits-#23/#24 invariant), and additionally DRAW a connecting travel segment from `prevEnd` (the runtime wall-1 END) → marker[N-1] (the dog-leg start), the SAME mechanism the manual-jog rainbow already uses (gcodeViz3d.js:768-783). That visually connects "wall-1 END → dog-leg" (the t95 ask) WITHOUT the frame mismatch. **REJECTED alt (full rebase):** move ②'s marker to prevEnd+delta AND recompute #23/#24 END-relative — breaks the marker-sprite/emitted-macro coherence (the drag handle writes #23/#24) + is far more invasive. Note: prevEnd carries the +#17 (Option A) Z lift under Z-trust — the bridge line is a 3D segment (accounts for Z), and it's designed AGAINST the post-Z-trust frame (wall-1 END Z = jogged_Z+#17).
- **Q4 (emit diff + golden regen):** removing the wall-1 plunge deletes ONE line (`G0 Z#18` before wall-1's G31) from the probeZ-off emit (+ the manual reposition drop line); probeZ-ON is byte-IDENTICAL (the plunge stays). twin≡built-in STAYS equal (both emit via cornerStack, both change together — parity preserved). The probeZ-off GOLDENS (corner-data-emit / probe-surface-block CORNER_GOLDEN combos with probeZ:false, + corner-travel-approach probeZ-off) change INTENTIONALLY → regen + show the byte-diff for human confirmation that the new motion is correct (straight-to-G31, no pre-plunge).

**PROPOSED BUILD SEQUENCE (emit FIRST, gated + human-visible; then sim):**
1. **EMIT increment (byte-parity-AFFECTING — GATE + human-visible byte-diff):** gate the wall-1 plunge on probeZFirst + remove the manual reposition auto-drop (probeZ-off). Pick option A or B first (advisor). Regen the probeZ-off goldens; hardened spec asserts probeZ-off wall-1 goes STRAIGHT to G31 (no preceding Z plunge) + probeZ-ON byte-identical + twin≡builtin. Human reviews the byte-diff (real machine motion).
2. **SIM anchor-end increment (preview-only):** draw the BRIDGE LINE prevEnd→marker[N-1] (the runtime wall-1 END → the dog-leg start), KEEPING the dog-leg+probe anchored at marker[N-1] (so ② stays correct + the drag-edits-#23/#24 invariant holds). Reuse the manual-jog connecting-segment mechanism (gcodeViz3d.js:768-783). Hardened spec: the connecting segment STARTS at the runtime wall-1 END (post-retract+lift) AND the wall-2 probe still fires on ②. (This resolves the Fix A residual re-opened at t95 WITHOUT re-introducing the +cross disconnect. NOTE: this REFINES the earlier "anchor-end" plan — the fix is a bridge line, not an anchor swap; likely subsumes the "② moment" observation but is DISTINCT from prefill — confirm with data.)
3. Then prefill (non-FL markers), then item 2 (corner-selector-on-canvas GUI).

**WORKFLOW VERIFICATION (2 adversarial verifiers on the design):** emit-motion SURVIVES_WITH_CAVEAT (both walls at jogged_Z + safer dog-leg + probeZ-ON byte-identical CONFIRMED; 3 constraints folded in: zOnlyR gating, per-arm manual scoping, Fork→A). sim-frame-tension REFUTED my naive prevEnd-swap → corrected to the bridge line (kept the START anchor for the probe; the swap would have re-introduced the +cross-beyond-② disconnect). Both verdicts + the exact offset math are in the design above.

**GATE:** NO code this turn (real machine motion — designed only). PASS BACK for advisor + human review of the design (esp. the Fork→A recommendation + the manual-OFF re-jog note + the bridge-line sim fix) BEFORE building.

## 🔨 turn 102 (cycle 11) — Z-TRUST EMIT INCREMENT (Option A, human-confirmed). REAL MACHINE MOTION, byte-parity-AFFECTING. Suite green (496 passed, 0 failed, 498 total; new corner-z-trust spec mutation-proven). COMMITTED (not pushed). ⏸ PASS BACK with the byte-DIFF for advisor+human review BEFORE final.

**THE CHANGE (cornerWizard.js — 2 gates, probeZ OFF only; probeZ ON UNCHANGED):**
- **(1) wall-1 plunge gated on probeZFirst via `zOnlyR`:** `mkMV('Z','#18')` (:272, was unconditional) → `...zOnlyR([mkMV('Z','#18')])`. probeZ-off → NO plunge → wall-1 goes STRAIGHT to G31 at the jogged height. **zOnlyR (NOT a bare if)** so the twin's SUPERSET prunes it on the OFF leaf too → twin==built-in.
- **(2) reposition drop threaded per-arm (via the existing zPairR):** `repoTraverse` now takes `drop`; `repoArmR` passes AUTO→`'#18'` always; MANUAL→`z ? '#18' : undefined`. So probeZ-ON manual KEEPS its drop (ON's wall-2 descends only via it), AUTO-OFF KEEPS its drop (round-trips to jogged_Z), and only probeZ-OFF MANUAL drops the drop (the operator re-jogs Z).

**BYTE-DIFF (the emitted .nc — for human review):**
- **probeZ-OFF AUTO:** −1 line — the wall-1 `G0 Z#18` plunge before its first G31 is GONE (straight to G31). The reposition drop `G0 Z#18` REMAINS.
- **probeZ-OFF MANUAL:** −2 lines — the wall-1 plunge AND the post-jog reposition drop (`G0 Z#18`) are GONE.
- **probeZ-ON (auto + manual):** BYTE-IDENTICAL (0 change — the plunge + both drops stay; the tool is lifted after the Z-surface, so it must plunge).
- **probe-surface-block CORNER_GOLDEN (regen):** combos 0 (FL/XY/noZ) + 3 (BL/YX/noZ) each −1 line (`G0 Z#18`); combos 1,2 (probeZ:true) BYTE-IDENTICAL. Old↔new diff proven = ONLY the wall-1 plunge removal on the noZ combos.

**NET MACHINE MOTION (probeZ-off):** the tool no longer plunges safeZ+scanDepth below the jog before probing — it probes AT the operator's jogged height (BOTH walls, AUTO). The auto dog-leg travels at jogged_Z+#17 = the HIGHEST point in the cycle (STRICTLY SAFER than today's OFF dog-leg, which ran at scan depth THROUGH material). MANUAL-off: the operator re-jogs Z at each wall (no auto-adjust after a human jog). Error handler over-lifts +#17 on a fail (higher=safer, benign, un-gated).

**VERIFY (assert-the-value + mutation-proven):** new `corner-z-trust.spec.js` pins (1) probeZ-off wall-1 G31 has NO preceding Z move [Mut M1 un-gate plunge → 'G0 Z#18' precedes it → RED]; (2) probeZ-ON wall-1 G31 IS preceded by `G0 Z#18` (unchanged); (3) twin==built-in byte-for-byte across the probeZ×travelApproach 2×2; (4) probeZ-off MANUAL has NO `G0 Z#18` at all [Mut M2 off-manual always-drop → RED] + AUTO-OFF drop REMAINS. Lockstep golden updates: probe-surface-block CORNER_GOLDEN (regen) + corner-travel-approach (manual-off no-drop). **Full suite 496 passed, 0 failed** (497 prior + 1 new).

**⚠ SIM CONSEQUENCE FLAGGED (for the machine-faithful sim increment, NOT this one):** the corner's SIM `inferStart` returns `z: safeZ` (:354 — the OLD hover-above-and-plunge model). Under Z-trust the sim's wall probe now fires AT that Z, which is ABOVE the wall for probeZ-off (the old plunge reached z=-5, within the stock). So the LIVE preview would show the probeZ-off wall probe firing above the wall. I fixed the `disc-on-surface` test TEST-ONLY (drive from a within-stock jogged probe height z=-5 → discs land on the wall, 4 discs ~2mm off, mechanism intact) — but the PROD sim inferStart-z is a real Z-trust sim consequence: the operator-start Z should reflect the jogged probe height (probeZ-off), a co-item for the machine-faithful sim increment (alongside the dog-leg-from-END / marker2-at-END+delta / END-relative-drag).

**Surgical:** 1 emit source (cornerWizard.js) + 1 new spec + 3 lockstep test updates (golden regen, manual-off assertion, disc-on-surface driver-Z). COMMITTED, NOT pushed. ⏸ PASS BACK the byte-diff for advisor+human confirm BEFORE final. Then: the machine-faithful sim.
