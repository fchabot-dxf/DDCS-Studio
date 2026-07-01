# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c = shipped V10.49 + concurrent H2). A FRESH, clean corner-port branch, cut
after the 89-file `wizard-porting-work` dump was audited. **Backups (READ-ONLY reference, nothing lost):** `wizard-porting-work`
(the audited 89-file dump) · `corner-notepad-enrich` (the retry + preserved uncommitted work).

## 📋 THE AUDIT (5 adversarial reviewers, runtime-verified — the basis for this plan)
`wizard-porting-work` (7634815) = **good code, unfit commit.** The wizards-as-data PORT MECHANISM is SOUND ("the crown jewel")
and the corner wizard/view port is clean; the break is 3 small corner-specific defects; the rest is junk + other agents' WIP swept
into one "wip" label. So: **DON'T build on that branch — LIFT the clean pieces here, worker-driven, and REDO the one broken file.**

**The 3 corner defects (runtime-proven):**
1. `data/cornerPort.js` `CORNER_EXEC_BINDINGS` — **hand-counted block-index map is off-by-one** (skips the `=== CONFIGURATION ===`
   comment at flat index 3) → all 9 bindings shift → `registerUserOp` THROWS (swallowed by an app.js try/catch → silently mis-binds).
2. `viz/opSimStarts.js` `corner()` — guard `stx !== null` but `n()` returns **`undefined`** → NaN preview-marker coords when the
   cross-over fields are blank (the default). `middle()` uses the correct `Number.isFinite()`.
3. `wizards/cornerWizard.js:224` — `inferStarts()` calls `window.app.opSimStarts(...)`, a global **assigned nowhere** → corner falls
   back to a single start (multi-handle drag / Wall-2 travel-tie never populate). Siblings `import { opSimStarts }` directly.

---

## ✅ inc A DONE + VERIFIED (advisor turn 2) — the wizards-as-data MECHANISM is lifted
- Worker lifted the mechanism (commits `fb3f439` [+13 swept] + `118a6f2` [+4 surgical] + `d06e770` [worklog]); 26-file footprint,
  mechanism-only — no corner-UI, no other-agent WIP, no junk leaked.
- **ADVISOR REVIEW** (4-lens fan-out + adversarial verify, 9 agents): **2 dims CLEAN** — *emit-identity* (all 5 as-data specs PROVE
  byte-identical emit via `instantiate()` over the full wrapped `user_root`, NOT a field-rewrite) · *mechanism-soundness* (resolver/
  round-trip core clean, verified statically + Node harness). **5 raw findings → 4 refuted, 1 nit.** 7 named specs re-run GREEN (10.9s).
- **FLAG1 (`fb3f439` commit-split):** advisor call = **LEAVE** (cosmetic; all code present + verified; the branch squash-merges clean).
- **FLAG2 (stale advisor marker):** **FIXED** (`.handoff/advisor.last` 178 → 2; the waiter fires again).
- **2 NITS carried forward (not blockers):**
  1. **Tree-hygiene:** 6 `_*.png` visual baselines + `HANDOFF.md` are uncommitted stray churn (concurrent UI-agent regen, NOT inc A).
     → **STAGE SURGICALLY on every commit** (`git add <files>`, **NEVER** `git add -A`/`commit -a`); do not sweep them.
  2. **`WRAP_PREFIX_COUNT=4`** is a hand-counted magic offset duplicated across the 5 dataOps (proven-correct + validator-guarded
     today → a nit) — but it is the SAME CLASS as corner defect #1. → inc B1 **DERIVES** corner's bindings (below); the derivation
     helper is the one-source the 5 siblings can later adopt.

---

## ⚡ AUTONOMOUS (human t178) — automate the FULL corner port, all THREE dimensions
Run to a working, verified corner port with NO per-increment HUMAN check-in. The advisor splits the port by DIMENSION so each gets a
fresh-eyes review, dispatches the next after review, and SURFACES to the human ONLY for: a genuine design fork · a regression the
advisor can't verify · a worker stall. The FULL port delivers **EMIT** (B1) · **SIM** (B2) · **LAYOUT** (B3), closed by **inc C**.

## 🚦 ACTIVE DISPATCH — CORNER-PORT inc B1: EMIT (the crown-jewel dimension) [autonomous; advisor turn 2]
The corner port's EMIT path — the exact dimension the shipped break lived in. Get corner's G-code byte-identical to the built-in
wizard, with DERIVED (not hand-counted) bindings, PROVEN by a real emit test. **Reference:** `git show wizard-porting-work -- <file>`.

**DO:**
- LIFT `wizards/cornerWizard.js` **cornerStack** (EMIT only): the #21–#24 cross-traverse via the shared `safeTraverseStack` (already
  lifted in inc A), the enum-normalizing param maps, and the FINAL field schema (`travelDist` → `startX/startY/cross1_x/cross1_y`,
  internally consistent) so the bindings are stable. Do NOT wire the sim/view yet.
- ⭐ **REDO `data/cornerPort.js` → `blocks/dataOps/cornerData.js`** (one-source: match the 5 siblings' shape). **DERIVE the binding
  blockIndexes PROGRAMMATICALLY from the flattened stack** — walk the flattened `user_root` and match each binding to its target
  block by role/key, **NOT hand-counted**. This is defect #1's real fix AND kills the `WRAP_PREFIX_COUNT` class for corner. Make the
  derivation a small **REUSABLE helper** (valid-by-construction; the 5 siblings can adopt it later — but do NOT migrate them now).
  The helper must re-find the sockets correctly EVEN under `probeZFirst`'s structural shift (see the FRONTIER below).
- ⭐ **`probeZFirst` = a DECLARED FRONTIER (baked off), NOT a bound param.** Ticking it INSERTS a Z-surface step + traverse (changes the
  stack SHAPE, shifts #23/#24); `instantiate()` substitutes VALUES in a fixed shape — it cannot add/remove blocks. Same class as drill's
  baked `method` (peck-not-bore). So `cornerData` bakes `probeZFirst=off` (the default shape). **This is ADDITIVE:** `cornerData` is a
  NEW "Corner (data)" op seeded ALONGSIDE the UNTOUCHED built-in Corner wizard (`wizardLibrary` id:`corner`, which keeps `probeZFirst`
  fully working) — nothing the operator uses is disabled. Don't surface a working probeZFirst control in the twin (a B3 concern).
- ⭐ **ADD an EMIT-CORRECTNESS test** `corner-data-emit.spec.js`: assert `cornerData` emits **byte/value-identical** G-code to the
  built-in `cornerStack` across a sweep of the BOUND scalars (all quadrants, WCS, offsets, cross-traverse) at the baked
  `probeZFirst=off`, via `stripAnnotations` (mirror the 5 as-data specs) — PLUS a **DERIVE-ROBUSTNESS** assertion: the derive helper
  re-finds the shifted `#23/#24` sockets when built against a `probeZFirst=on` stack. That guards defect #1's ROOT (bindings under a
  structural shift) BETTER than the impossible "emit the variant" test my first dispatch wrongly demanded. **DISCARD
  `_diag-endoffset.spec.js`** (asserts nothing).
- ⭐ **ADD a can't-forget FRONTIER GATE** (`corner-data-probeZFirst-frontier.spec.js`): a LOUD, named `test.fixme`/skip documenting that
  the data model can't yet do the add-a-step toggle, PLUS an assertion that the built-in Corner (`wizardLibrary` id:`corner`) stays
  registered — so any future attempt to RETIRE the built-in while the twin is limited turns the suite RED. A red/skipped marker can't be
  forgotten like a backlog note (this is the anti-"risky-to-forget" guard, human t178).
- DROP the corner emit-path orphans your changes make dead (`travelOwn`/`travelOpp` + imports, unused `td`, stale `Travel:` header) —
  only the ones YOUR changes orphan.
- **SCOPE: EMIT ONLY.** Do NOT lift `cornerView.js` / the `index.html` panel (= inc B3 LAYOUT). Do NOT touch `opSimStarts` /
  `inferStarts` (= inc B2 SIM). Do NOT migrate the 5 existing dataOps to the derive helper (follow-up).

**VERIFY:** `node --check` clean on every touched file; `registerUserOp(cornerData())` does NOT throw; `corner-data-emit` +
`corner-data-probeZFirst-frontier` + the 7 inc-A specs GREEN. **STAGE SURGICALLY** (the tree has stray PNG/HANDOFF churn — never
`git add -A`). Commit + WORK-LOG + pass.

**NORTH STAR:** valid-by-construction (DERIVE, never hand-count) · one-source (cornerData matches the 5 siblings; the derive helper is
the single binding-index authority) · verify-real-symptom (the emit test asserts real G-code, not a field rewrite) · declare-never-infer.

## 📌 QUEUED (advisor dispatches each after review — no human check-in):
- **inc B2 — SIM:** FIX defect #2 (`opSimStarts.corner()` `!== null` → `Number.isFinite()`, like `middle()`) + defect #3
  (`cornerWizard.js` `window.app.opSimStarts` → `import { opSimStarts }`) + `inferStarts`. VERIFY: a placed corner op renders its start
  markers (**NO NaN**); multi-handle drag + Wall-2 travel-tie populate (defect #3 gone).
- **inc B3 — LAYOUT:** LIFT `cornerView.js` FeatureCanvas port (drag handles, `tieCornerTravel`, `getPassStarts`) + the `index.html`
  corner panel; render through the generic `registerUserOp → def.panel/def.layout → userOpView`. VERIFY: the FeatureCanvas layout +
  form panel render, matching the built-in corner wizard's panel.
- **inc C — VERIFY + RELEASE:** all 3 dims end-to-end (EMIT byte-identical incl. `probeZFirst` · SIM no-NaN + multi-handle · LAYOUT
  renders via `userOpView`) + full suite green. Release when verified. Closes the FIRST full wizard-as-data port (emit + sim + layout).

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work is on MAIN up to V10.49; resume later)
- the **`#53` / probe-calc SIM fix** — the sim's probe doesn't STOP / accumulates → degenerate `#53` (auto measured-centre ≈2) +
  the manual off-stock start. ONE fix, BOTH symptoms.
- the **AUTO second-transition (→③) diagonal is still hard-coded** — the B-TRANS (b) fix (V10.49, `#22` primary-peer) only covered
  the FIRST transition (→②); manual→③ works, auto→③ doesn't. (human-demonstrated t178.)
- inc2b (two-meanings-of-pass → the 4th/5th markers) · B-TRANS canvas rollout to corner/rotary/alignment.
- a full-suite re-run to confirm V10.49 (the box was heavily loaded).

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
