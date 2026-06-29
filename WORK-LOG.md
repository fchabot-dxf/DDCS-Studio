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
