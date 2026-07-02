# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c). NOT on main / not deployed; local via VSCode Live Server. **Backups:** `wizard-porting-work` · `corner-notepad-enrich`.
**STRATEGY (human t24):** corner is the GATED PILOT — NO other wizard is ported until corner is PERFECT + human-eye-confirmed. Each mechanism piece proven ONCE on corner; the rest inherit it.

## 🔒 THE LOCKED MODEL (human t6) — "Corner (data)" REPLACES the built-in; reposition = EXPRESSIONS of the stock-datum coord
Socket = `datum + offset` EXPRESSION. DEFAULT = stock-geometry-derived; DRAG = datum-RELATIVE literal; ABS = fallback.

## ✅ DONE + VERIFIED (fan-out review + adversarial verify + independent re-run + human eyes)
EMIT (A·B1·B1b) · SIM markers (B2·B2b) · LAYOUT+DRAG (B3·B3b) · ① AUTO/MANUAL travel (shared `safeTraverseStack`, middle byte-identical) ·
B3c wiz-bar routing (bar opens the wizard view) · B3d 3D-sim+2D-layout combo (`form3d+2d`, human-confirmed).
**Decisions:** axis `+h` = CORRECT, do NOT remove (regresses drill/slot/pocket) · 2D-sim-view removal = BACKLOG (own decision, not corner) ·
the data-op already matches the built-in on the 9 value fields + EXCEEDS it on drag handles (built-in has NONE).

## 🚦 ACTIVE DISPATCH — ② B4: STRUCTURAL-TOGGLE + ENUM-FIELD CAPABILITY + MULTI-HANDLE (SCOUT + GATE) [human "yes dispatch" t24]
The last big mechanism piece — makes the baked corner frontiers LIVE. GENERIC (every future port inherits it). **SCOUT + GATE first:**
propose the mechanism + the rollout decomposition; the advisor reviews WITH THE HUMAN before any build (it sets the pattern for all ports).
**Parity-confirmed baked frontiers to make live** (`cornerData` CORNER_DEFAULTS):
- **(a) STRUCTURAL toggles — build the capability GENERICALLY** (Z-First is in BOTH corner AND middle `m_probe_z_first`; build ONCE, both
  inherit — like auto/manual → `safeTraverseStack`) (reshape blocks → `instantiate` can't → needs "always-emit the block GUARDED by a flag"
  so a structural choice becomes a BOUND VALUE): `probeZFirst` (adds Z-surface step + #21/#22 traverse) · `travelApproach` auto|manual
  (prompt-vs-move) · `wcs` active|G54–G59 (active reads #578/computes #70 vs fixed literal — BOTH branches guarded) · `syncA` (dual-gantry) · `slave` A|B.
- **(b) ENUM/non-numeric field kind** (a dropdown/text param, NOT a numeric socket — the ROADMAP capability: Blockly field adapter + `enum`
  bindings + marker round-trip; SHARED across future ports): `corner` FL/FR/BL/BR · `probeSeq` YX/XY · `slave` A/B.
- **(c) FAN-OUT via DECLARATION** (safeZ + scanDepth are REAL — human t24 "declare", NOT baked): restructure `cornerStack` so `#17` (plunge)
  EMITS as the EXPRESSION `[#19 + #scanDepth-socket]` (not a baked literal) → bind `safeZ`→#19 + `scanDepth`→its own socket as single editable
  bindings; `#17` recomputes at emit (`#18=[0-#17]` already an expression). Same expression-socket / declare-never-infer pattern as the
  reposition — restructure the SOURCE, keep the data-def DUMB (`level` similarly if computed-in). SHARED with middle (same plunge=safeZ+scanDepth)
  + apply the SAME fix to the DRILL port's `clearance` fan-out (was held baked).
- **MULTI-HANDLE editor (2 XY / 3 Z-first) in the LAYOUT CANVAS** (sim stays display-only): ADD the missing `#21/#22` bindings
  (`startX/startY`, Z→wall1 — preserve the expression default when unset, NO degenerate `G0 X0 Y0`) as a 2nd reposition handle, gated by
  probeZFirst → 3rd handle. FIX the `relTo:0`/`_pass` anchor: under probeZFirst the passes shift +2 (Z→wall1 is not a `REPOSITION:` delimiter),
  so the marker alignment + the drag anchor are wrong when Z is on.
- **GUI control + Blockly round-trip** for every new toggle/enum/binding. **RETIRE** the frontier tripwire specs
  (`corner-data-probeZFirst-frontier`, `corner-data-travelApproach-frontier`) once the toggles are live.
- ⚠ Emit BYTE-IDENTICAL when a toggle is untouched; the multi-handle drag writes the socket via a corner tie (the middle `tieDiagTravel`
  pattern) so emit follows; SIM-declaration-clean (no `( @DDCS )` in editor text).
- **GATE:** report the capability mechanism (structural-guard + enum-field) + the rollout decomposition (which sub-increments) BEFORE building.

**NORTH STAR:** declare-never-infer · valid-by-construction · keep the data-def DUMB (restructure source, don't grow machinery) · one-source (the capability serves every port) · verify-real-symptom (human eyes on each live toggle).

## 📌 QUEUED:
- **③ stock-datum wire (B1b GATE):** reposition DEFAULT + drag → datum-relative (`socket = datum + offset`); cures the B3 (0,0) handle.
- **④ inc C — VERIFY + RELEASE:** all dims end-to-end + full suite → merge to main + version bump → pages.dev + exe; retire the built-in.
- **✅ FAN-OUT — RESOLVED (human t24: "declare, don't bake"; safeZ + scanDepth are REAL):** moved INTO ② B4 (c) — `#17` becomes the declared
  expression `[#19 + #scanDepth]`, so safeZ + scanDepth are editable bindings. Apply the same declared-expression fix to DRILL's `clearance`.
- **⚠ 2 PARITY GAPS — pending the human's "perfect"-bar decision (surfaced t24):**
  2. **CONTROLLER-SOURCE CHIPS (port/level/fastFeed/retract):** the built-in sources these from controller-resident values (`srcVal`/`srcNote`/
     `ddcsResolveProbeSources`); the data-op binds plain literals — `sources` is UNWIRED. Advisor rec = include (real parity), late sub-task. HUMAN CALL.
  3. **DEAD Q field (`qStop`):** read but UNUSED in BOTH (probe atom hardcodes Q1) — a pre-existing bug, not a data-op regression. Advisor rec = leave. HUMAN CALL.
- **Likely-acceptable-drop (confirm):** the built-in's `CornerVizAnimator` SVG walkthrough (the data-op has 3D sim + per-pass markers instead) · the corner-specific status label (generic `label · N lines` today).

---
## ⏸️ PAUSED — B-TRANS / middle (SHIPPED on MAIN ≤ V10.49): `#53`/probe-calc SIM fix · auto →③ diagonal hard-coded · inc2b · canvas rollout · full-suite re-run.
**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
