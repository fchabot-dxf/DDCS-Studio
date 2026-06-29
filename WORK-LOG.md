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
