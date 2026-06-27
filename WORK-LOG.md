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
