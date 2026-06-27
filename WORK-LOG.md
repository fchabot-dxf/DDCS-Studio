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
