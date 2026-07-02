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

## ⚠️ MECHANISM REVERSED → M2 (human turn 26) — the M3 dispatch below is SUPERSEDED
**Human ruling:** re-authoring/COMPOSITION is THE POINT — "open a wizard, go into Blocks, add an array of probes." M3 (`def.build`→
cornerStack) locks the block STRUCTURE in JS → editing Blocks would be decorative → defeats the vision. So **M2** (pure-data template + guards;
the TEMPLATE is the emit source, re-authorable). Cost accepted (guard/prune machinery + re-derive bindings BY IDENTITY after prune = the
load-bearing hazard, but `deriveBindings` handles it). Scope: **M2 now** (template = cornerStack blocks + guards, cornerStack stays as the SEED)
→ self-host (author the template directly, DELETE cornerStack) as the natural NEXT step. The 4 sub-decisions (anchor fix / sources=WIRE /
qStop=LEAVE / safe-Z-frame add) STILL HOLD.

**🚦 ACTIVE — M2 BUILD (scout reviewed + human-approved t30):** M3 seam reverted (suite green). Build the M2 7-step rollout (WORK-LOG t29).
- **MECHANISM = M2** (guard block + `pruneGuards` at build + **RE-DERIVE bindings BY IDENTITY after prune** = the load-bearing hazard + shared
  `whenOk`): the TEMPLATE is the emit source, re-authorable; byte-identical-OFF proven; probeZFirst/travelApproach/wcs/syncA go LIVE as re-authorable data.
- **D1 — GRID = FOLLOW-ON (NOT this build; human-approved deferral):** M2 delivers the RE-AUTHORING (editable blocks). But "wrap corner in an
  `array` → grid of probes" BREAKS on the existing array (can't stamp #var/incremental coords; duplicate labels; repeated M30; N corners on ONE
  WCS is meaningless). A real grid needs a NEW macro-aware REPEAT primitive (renumber labels, single M30) + a WCS-per-probe semantic (distinct
  G54..G59) — a SEPARATE GENERIC capability (every probe benefits). M2 makes it POSSIBLE. → **QUEUED as the next big capability after B4.**
- **D2 — corner/probeSeq = SIGN-SWAPS (not prune-shaped):** keep baked in the guard work; live via VALUE-bindings alongside the enum field.
- **D3 — #17 fan-out fix APPROVED (human t30):** declare `#17 = [#19 + #20]` (scanDepth socket) in the SHARED cornerStack → built-in + twin `#17`
  go literal→expression, VALUE-IDENTICAL (byte-visible in the text; human signed off — touches the built-in).
- **D4 — comment freshness co-delivers WITH the toggles** (frozen-but-correct until then). Anchor fix (Z→wall1 REPOSITION + semantic relTo) resolved.
- Sub-decisions hold: sources=WIRE · qStop=LEAVE · safe-Z frame add.
- **BUILD AUTONOMOUSLY; ⏸ PASS BACK at the TOGGLES-LIVE gate (human eyes: probeZFirst etc. actually flip the emit + preview) + on completion.**
  Emit byte-identical when a toggle untouched; retire the frontier tripwires in LOCKSTEP; re-derive bindings by identity after EVERY prune.

## 🚦 ~~ACTIVE DISPATCH — ② B4: BUILD on M3~~ (SUPERSEDED by M2 above — kept for the decision record) [human "automate as much as possible" t26]
**MECHANISM = M3** (`def.build = (p)=>wrap(cornerStack({...defaults, ...bindingScalars(p), ...p}))`): cornerStack IS the emit engine →
all structural toggles become BUILD-PARAMS → live + EXACT parity + byte-identical-off BY CONSTRUCTION, ZERO per-toggle machinery, one-source,
DISSOLVES the fan-out (cornerStack computes `#17=safeZ+scanDepth` → both become plain number bindings). Bindings become FORM/2D-layout METADATA
(drive widgets), NOT instantiate sockets. Aligned w/ the 2026 reframe (keep the data-def DUMB, source does the work). Trade-off (human-accepted,
veto→M2 before B4-1): structure is param-driven via the source fn, not free-block-re-authorable — but all params round-trip. (M1 refuted; M2 =
pure-data when-guards at machinery+duplication cost — only if free-block STRUCTURE re-authoring is required.)
**ANCHOR FIX (verifier caught the proposed fix BREAKING — Z→wall1 isn't a REPOSITION delimiter → 3 starts/2 passes):** (i) make Z→wall1 a
`REPOSITION:` delimiter in cornerStack → 3 passes = 3 markers 1:1 (byte-identical OFF; CONSISTENT with middle); (ii) a SEMANTIC `relTo` (names
its sim-start row) → #21/#22→Z-surf, #23/#24→wall1. **sources = WIRE** (correctness; near-free under M3 + Struct user-spec). **qStop = LEAVE** (backlog).
**PILOT ADD: safe-Z FRAME toggle (rel|mach)** — corner alone hand-rolls its Z retract; add `safeZParkBlock(frame)` + a `frame` build-param to
cornerStack (byte-identical when frame=relative) → proves the G53/machinemove atom in a data-op (edge/middle late-discovery risk). [add #3
"bless deriveBindings" = established BY the M3 rollout + B4-7; #4 probeVector deferred post-enum.]

**BUILD — the 7-step rollout (execute AUTONOMOUSLY; pass back only at the 2 marked checkpoints):**
1. **B4-1 def.build seam + ⚠ EMPIRICAL GOLDEN GATE** — assert `build(CORNER_DEFAULTS)` deep-equals today's instantiate output (golden + a
   9-binding build-fn sweep) BEFORE anything else; if it FAILS → STOP. **⏸ PASS BACK after B4-1** (advisor confirms M3 empirically).
2. B4-2 append NON-derived enum/bool + safeZ/scanDepth + `frame` bindings (`type:'enum'|'bool'|'number'` — NOT the number-pill rule; call it out).
3. B4-3 make the clean toggles live (corner/probeSeq/wcs/syncA/slave/safeZ/scanDepth/frame) + flip their emit-spec divergence rows to PARITY.
4. **B4-4 probeZFirst + travelApproach live + the ANCHOR FIX + startX/startY (#21/#22) handles** → **⏸ PASS BACK (human eyes: 3D preview anchors each pass + the drag ties).**
5. B4-5 sources (Struct user-spec + build passthrough — correctness; chip GUI = follow-on).
6. B4-6 marker/Blockly round-trip verification (per-field: markerLine→parse preserves value+type; emit(build(back)) == cornerStack(p)) + GUI controls.
7. B4-7 generalize the M3 pattern to middle (proof build-once). DRILL `clearance` multi-socket = a SEPARATE deferred fork (drill has no macro-var layer). `level` stays baked (multi-socket, non-operator-facing).
RETIRE the two frontier tripwire specs in LOCKSTEP with flipping the divergence rows. Emit byte-identical when a toggle is untouched.
Risks: (r1) build MUST feed binding values into params or the 9 scalars silently revert; (r2) new bindings enum/bool NOT number; (r3) gates retire in lockstep; (r4) sources = Struct not scalar.
**(scout+gate: the mechanism plan + these decisions came from the turn-25 scout, WORK-LOG.)**
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
