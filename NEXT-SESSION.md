# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c). NOT on main / not deployed. Served locally via VSCode Live Server. **Backups:** `wizard-porting-work` · `corner-notepad-enrich`.

## 🔒 THE LOCKED MODEL (human turn 6) — "Corner (data)" REPLACES the built-in; reposition = EXPRESSIONS of the stock-datum coord
Socket = `datum + offset` EXPRESSION. DEFAULT = stock-geometry-derived; DRAG = datum-RELATIVE literal; ABS = fallback. REPLACE mode.

## ✅ DONE + VERIFIED (advisor reviews = fan-out + adversarial verify + independent re-run)
- **EMIT** — A · B1 · B1b (reposition correct-by-default via signed-travelDist expressions).
- **SIM MARKERS** — B2 → B2b (per-PROBE-PASS start markers, pass-aligned vs the REAL engine). ⚠ these markers only render INSIDE a 3D preview
  pane → currently ORPHANED (see the 3D-SIM GAP below).
- **LAYOUT+DRAG** — B3 (2D canvas, flipped panel to `form2d`) → B3b (drag writes the correct incremental delta via a generic point-anchor).
- **① AUTO/MANUAL TRAVEL** — generalized into `safeTraverseStack` (`approach:'auto'|'manual'`); middle refactored onto it, proven BYTE-IDENTICAL
  (review CLEAN 2/2, re-run green vs a frozen golden). Corner adopts one `travelApproach`; twin bakes auto + frontier gate.
- **B3c WIZ-BAR ROUTING** — the bar now routes `form2d` data-ops to the canvas/wizard path (was: all user ops → the plain quick-insert form).
  User-CONFIRMED the 2D canvas now shows; test drives the real bar click (FAIL→PASS). Kept `form2d`-only (form3d is the default panel).

## 🐞 THE 3D-SIM GAP (user-found t22, trace-CONFIRMED) — the generic data-op view is EITHER/OR; probes need BOTH
"Corner (data)" is MISSING the 3D sim preview (+ its per-pass markers). ROOT CAUSE: the generic `userOpView` treats the panel as EITHER/OR —
`form3d` (3D preview) XOR `form2d` (2D canvas). B3 flipped corner to `form2d` for the drag handle; `userOpView.js:100-103` then does
`mode==='2d' → viz3d.style.display='none'` + `renderLayout2D()`, so the 3D pane is HIDDEN and the declared `CORNER_SIM_STARTS` markers ORPHAN
(no 3D pane to render into). The built-in probes (cornerView/edgeView/middleView) ALWAYS call `preview3D()` (3D base) AND layer a 2D canvas ON
TOP (`renderStartCanvas`) — never either/or. The generic view must do the same.

## 🚦 ACTIVE DISPATCH — B3d: the data-op view shows BOTH the 3D sim AND the 2D canvas [advisor turn 22; user-found]
Teach the GENERIC `userOpView` to render the 3D sim preview AND the 2D drag canvas TOGETHER — the built-in probe pattern (3D base + 2D
overlay), so "Corner (data)" shows the 3D probe sim + its per-pass markers + the draggable 2D reposition handle, all at once.
- **FIX (the built-in pattern, generalized — one-source):** enhance `userOpView.update()` (the either/or at `:100-103`) so a visual data-op
  renders BOTH `preview3D(gcode, ..., startHints)` (the 3D sim + the declared sim-starts) AND `renderLayout2D()` (the 2D drag overlay) —
  matching how `edgeView`/`middleView` layer the 2D over the 3D (never suppressing the 3D pane).
- **SCOUT the cleanest seam (prefer AUTOMATIC, not a corner special-case):** e.g. a `form3d` op that ALSO DECLARES layout roles (corner's
  `cross1_x/y {role}`) gets the 2D overlay automatically — so revert corner's panel to `form3d` and let the layout-roles trigger the 2D
  overlay. (vs a new `form3d+2d` panel type.) Must NOT break the existing form2d-only / form3d-only ops. GATE if it's a bigger view refactor.
- ⭐ **TEST (verify-real-symptom — the USER's bar path):** open "Corner (data)" via the bar → assert BOTH the 3D preview pane (`.wiz-viz3d`
  visible + the sim/markers) AND the `.fc-handle-move` 2D handle render TOGETHER. (The current test only checks the 2D handle.)
- SCOPE: the generic `userOpView` 3D+2D combo + corner's panel declaration. Benefits EVERY visual data-op.

**VERIFY:** "Corner (data)" from the bar shows the 3D sim + per-pass markers + the 2D drag handle together (matching the built-in corner's
preview); the combo test + the existing corner specs + full suite GREEN. **STAGE SURGICALLY**. Commit + WORK-LOG + pass.

**NORTH STAR:** one-source (the GENERIC view gains 3D+2D like the built-in probes — not a corner hack) · verify-real-symptom (assert BOTH panes
render via the user's path) · valid-by-construction.

## 📌 QUEUED (advisor dispatches each after review — no human check-in):
- **② B4 — PROBE-Z-FIRST + auto/manual LIVE toggle + the structural-toggle capability + GUI/round-trip.** Both are structural toggles the twin
  bakes; likely ALWAYS emit the block GUARDED by a flag (conditional goto) → a BOUND VALUE → both go LIVE + get their GUI control + round-trip.
  Also fix the latent `relTo` anchor shift under probeZFirst.
- **③ FOLLOW-UP — stock-datum integration (B1b GATE):** wire the stock-datum coord so the reposition DEFAULT + the B3 drag become datum-relative
  (interim = travelDist/wall-1-relative today). Cures the B3 (0,0) handle caveat.
- **④ inc C — VERIFY + RELEASE:** all dims end-to-end + full suite green → merge to main + version bump → pages.dev + exe. Closes the FIRST full
  wizard-as-data port that REPLACES its built-in.

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work on MAIN up to V10.49): `#53`/probe-calc SIM fix · auto →③ diagonal hard-coded · inc2b · canvas rollout · full-suite re-run.

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
