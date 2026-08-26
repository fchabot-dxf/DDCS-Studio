/**
 * blocks/dataOps/cornerData.js — the CORNER built-in expressed as a pure DATA definition (the corner port, inc B1 EMIT).
 *
 * This REDOES the shipped-broken data/cornerPort.js. That version HAND-COUNTED each binding's blockIndex and skipped the
 * `=== CONFIGURATION ===` comment → every binding shifted by one → registerUserOp threw / mis-bound (defect #1). Here the
 * bindings are DERIVED from the flattened `user_root` stack by macro-var identity (deriveBindings.js) — valid-by-construction,
 * immune to a comment insertion AND to the `user_root` wrap offset (no `WRAP_PREFIX_COUNT` hand-count).
 *
 * ADDITIVE TWIN (historical — see t1670): this was seeded ALONGSIDE the then-untouched built-in Corner wizard
 * (wizardLibrary id:'corner'). That built-in view is now RETIRED (web/wizards/views/index.js) — this twin is the
 * ONLY live UI surface for Corner; `opensAs` routes every entry point here. Kept for the ADDITIVE history below.
 *
 * probeZFirst is now LIVE (② B4 step 4a): the twin SEEDs cornerStack in SUPERSET mode (both arms of the fork present, each
 * wrapped in a `guard`), and `instantiate()` prunes the guarded superset to the chosen shape — so ticking probeZFirst adds the
 * Z-surface step + the Z→wall1 traverse + flips the KIND-B text (OVER/OUTSIDE, "+ Z Surface", Step numbers), byte-for-byte ==
 * cornerStack({probeZ:true}). Value sockets re-derive BY IDENTITY over the pruned stack (def.bindingSpecs), so #23/#24 land
 * correctly under the +2 shift. See corner-data-probeZFirst-live.spec.js.
 *
 * travelApproach (4b) + wcs (4c) + syncA (4d) are now LIVE too: the superset taPair/wcsFork/syncA-guard emit ALL arms guarded
 * by value-equality when(travelApproach=='auto'|'manual') / when(wcs=='active'|'G54'…'G59') / when(syncA); prune selects one →
 * byte-for-byte == cornerStack. wcs is 7-way — its 'active' arm reads #578, each G54..G59 uses the literal base #70; syncA is a
 * bool block-ADD (G1 A0 + the slave-offset write #74=[#70+slave]). ALL FOUR prune-shaped structural toggles are now LIVE.
 *
 * corner + probeSeq are now LIVE too (③b): they're VALUE/ORDER swaps (corner flips the probe directions + reposition signs;
 * probeSeq swaps the wall order) that INTERACT → an 8-WAY corner×probeSeq guard (nested, like wcs — NOT a value-binding; the
 * swap is derived + the reorder is of differently-shaped blocks). The bound reposition sockets duplicate 8× in the superset →
 * CORNER_BINDINGS derives over a CANONICAL-pruned stack. ALL operator-facing structural params are now LIVE.
 *
 * THE ONLY REMAINING BAKED FRONTIER — `level` (DELIBERATE, FINAL; ④-verify decision, carried forward — do NOT relitigate):
 *   • `level` = the G31 probe LEVEL, a literal passed straight into the probe atom (no dedicated macro var; a multi-socket
 *     literal). It is NON-OPERATOR-FACING (a machine/probe-config constant, not a per-op operator choice — human t40-era call),
 *     so it does NOT get a live toggle: baked at level=0 by design, INTENTIONALLY not a binding. This is the FINAL state (not a
 *     "live later" follow-on like the toggles were) — carried forward into ④ verify+release unchanged. Documented tripwire:
 *     corner-data-baked-frontier.spec `level stays baked-final` (the twin diverges when level changes — the deliberate bake).
 *   • `safeZ` + `scanDepth` — WERE a fan-out (safeZ fed #19 AND the COMPUTED literal `#17 = safeZ + scanDepth`, so one binding
 *     couldn't drive both). ② B4(c) DISSOLVED it: cornerStack DECLARES `#17 = [#19 + #20]` (safeZ→#19, scanDepth→#20; the
 *     controller sums it at runtime, like `#18=[0-#17]`), so safeZ + scanDepth are now CLEAN single-socket bindings — live.
 * The built-in Corner stays REGISTERED until the ④ release retires it (end-to-end verify + version bump); see corner-data-baked-
 * frontier.spec's built-in gate. All operator-facing structural params are LIVE on the twin; only `level` (deliberate) remains.
 *
 * Template SEEDED from cornerStack(CORNER_DEFAULTS); the BINDINGS are derived + proven byte-identical by
 * tests/corner-data-emit.spec.js. SCOPE (inc B1) = EMIT only — no view/panel (B3), no sim-starts/inferStarts (B2).
 */
import { cornerStack, cornerReposOffsets, dirsOf, cornerHeaderComments } from '../../wizards/stacks/cornerWizard.js';
import { userOpFromStack, simStartsToBlocks, flattenBlocks } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards, whenOk } from '../whenGuard.js';   // ③b — derive CORNER_BINDINGS over a CANONICAL-pruned stack (the 8-way corner×probeSeq guard duplicates the bound sockets in the raw superset)
import { makeProvider } from '../../viz/opSimStarts.js';   // sim-marker positions: reuse the base frac provider, then CHAIN the reposition-destination passes off their anchor
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';   // t87 — the SAME source functions the built-in uses: srcVal picks src.ctrl over the literal; srcNote appends "- controller PrNNN"
import { clearModeOf, resolveClearMode } from '../../wizards/ops/safeZframe.js';   // t961 — the plane-guarantee backstop (ONE SOURCE): fold the frozen clearlift plane->hop when WCS!=Active or no Z-first

/** Author defaults — match cornerStack's fallbacks + the built-in Corner field defaults. Structural params (corner/
 *  probeSeq/probeZFirst/wcs/syncA) are baked at their defaults: the twin is the FL / YX / no-Z / active-WCS shape. */
export const CORNER_DEFAULTS = {
    // corner/probeSeq/wcs are the STRING forms — the guards match by value-equality (when(corner=='FL'…) / when(probeSeq=='YX'…)
    // / when(wcs=='active'…)); a numeric 1/0 would match no arm and drop the block. (cornerStack still accepts the numeric forms
    // for the built-in via its own normalization.)
    corner: 'FL', probeSeq: 'YX', probeZFirst: 0, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active',
    dist: 500, retract: 5, f_fast: 200, f_slow: 50, port: 3,
    level: 0, safeZ: 10, scanDepth: 5, radius: 2, travelDist: 50,
    clearMode: 'hop', hopDist: 15, planeZ: 10,   // t929 B2b-2c — the declared clearance mode for the wall1->wall2 traverse; t941 B2b-4 — DEFAULT flipped max->hop (the user's decision: capped 15mm relative lift is the friendly baseline); hopDist/planeZ are literals (no assign #var), read by cornerStack when the mode is set
    // NOTE: startX/startY/cross1_x/cross1_y are deliberately ABSENT — the reposition sockets default to their signed-travelDist
    // EXPRESSION (via the binding's socket-default), so a seed with no cross override stays non-degenerate. Listing them here as
    // literal 0 would make `'cross1_x' in params` true → instantiate() overwrites the expression with 0 (the degenerate default).
    syncA: 0, slave: '3',
};

/** The 9 bindable scalars → the `assign` macro var each writes. DECLARED by identity (var), NOT by position: deriveBindings
 *  re-finds the flat index, so the `=== CONFIGURATION ===` comment can never desync them again, and `#23`/`#24` are re-found
 *  even under probeZFirst's +2 shift. (safeZ is NOT here — a fan-out frontier; see the header note.)
 *  - `travelDist` → `#15` (=+travelDist; `#16=[0-#15]` derives, so binding #15 alone stays consistent — NOT a fan-out). It
 *    SCALES the default reposition, since #23/#24 reference #15/#16.
 *  - `cross1_x`/`cross1_y` → `#23`/`#24` with NO `default`: deriveBindings reads the socket's baked value (the signed-travelDist
 *    reposition EXPRESSION), so an UNSET cross stays non-degenerate (kills the old `G0 X0 Y0`); a bound literal (a B3 drag) still
 *    overrides the socket wholesale. This is the "expression-holding socket" of the LOCKED MODEL. */
export const CORNER_BINDING_SPECS = [
    { param: 'dist',       type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.dist,       label: 'Max Probe Dist',   help: 'How far the stylus travels toward each wall before it gives up — set larger than the gap to the wall, smaller than the next obstacle.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value' },
    { param: 'retract',    type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.retract,    label: 'Retract',          help: 'How far the probe backs off the wall after the first touch, before the slow, accurate re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value' },
    { param: 'f_fast',     type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.f_fast,     label: 'Fast Feed',        help: 'Feed rate (mm/min) for the initial fast approach to each wall, before the touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value' },
    { param: 'f_slow',     type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.f_slow,     label: 'Slow Feed',        help: 'Feed rate (mm/min) for the precise second touch — slower gives a more accurate trigger point.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value' },
    { param: 'port',       type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.port,       label: 'Port',             help: 'The controller input port the probe signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value',
        gate: { param: '_probePortOk', is: false, tip: 'This controller\'s own probe move has no port number to set — V4.1 selects it in firmware (a fixed L#682), DM500 probes via move-until-input (no G31 at all). The field is inert here.' } },
    { param: 'radius',     type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.radius,     label: 'Stylus Radius',    help: 'The probe stylus tip radius (mm) — added to each wall touch to give the true wall coordinate.', section: 'TOOL & CUT', match: { type: 'assign', var: '#6' },  key: 'value' },
    { param: 'travelDist', type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.travelDist, label: 'Reposition Travel', section: 'GEOMETRY',  match: { type: 'assign', var: '#15' }, key: 'value' },
    // ② B4(c) — fan-out DISSOLVED: #17 plunge now EMITS as [#19+#20], so safeZ→#19 + scanDepth→#20 are clean single-socket bindings (were baked frontiers).
    // t931 — HELP FIX: safeZ (#19) is the APPROACH/PLUNGE height, NOT the between-walls travel (that crosses at the machine
    // margin / the Clearance mode). #19 is the relative Z→wall1 jog lift + (with Scan Depth) #17=[#19+#20] the plunge.
    { param: 'safeZ',      type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.safeZ,      label: 'Safe Z',           help: 'The APPROACH / PLUNGE Z: the relative lift to jog to the first wall, and (with Scan Depth) the plunge before probing each wall. The between-walls clearance is the Clearance mode below (Max/Hop/Plane), not this.', section: 'GEOMETRY',   match: { type: 'assign', var: '#19' }, key: 'value' },
    { param: 'scanDepth',  type: 'number', tokenEligible: true, default: CORNER_DEFAULTS.scanDepth,  label: 'Scan Depth',       help: 'How far below Safe Z the stylus drops before probing sideways into each wall.', section: 'GEOMETRY',   match: { type: 'assign', var: '#20' }, key: 'value' },
    // t931 B2b-2c (Option B) — the CLEARANCE MODE + its per-mode fields, bound to the WALL1 clearlift folding atom's VALUE params
    // (NO assign #var — the atom folds max/hop/plane on these literals; matches middle's literals + the D2 ruling). when-gated.
    // t1704 — NOT token-eligible despite the value-socket shape: resolveClearMode (safeZframe.js) COMPARES this
    // value to decide which clearance-lift CONTENT gets folded into the atom (max/hop/plane pick different embedded
    // text, not just a number) — a categorical branch-selector, same shape as corner/probeSeq/wcs below.
    { param: 'clearMode', type: 'enum', tokenRefusal: 'The clearance mode changes which safety move gets built into the program (Max, Hop, or Plane are different moves, not different numbers) — pick one; it can\'t be read from the controller while the program is being written.', default: CORNER_DEFAULTS.clearMode, label: 'Clearance', help: 'How the probe clears between the walls. Max: retract to the machine safe-Z margin. Hop: a small relative lift, capped at that margin. Plane: an absolute work-Z (for fixtures / tall stock). Safe Z above stays the plunge/approach.', section: 'GEOMETRY', match: { type: 'clearlift' }, key: 'clearMode', widgetConfig: { options: [['Max safe height', 'max'], ['Hop up', 'hop'], ['Clearance plane', 'plane']] }, optionGate: { option: 'plane', requireAll: [{ param: 'wcs', is: 'active' }, { param: 'probeZFirst', is: true }], fallback: 'hop', tip: 'Clearance plane needs the Active WCS + a Z datum — set WCS = Active and turn on Probe Z First (a work-Z plane against an unset WCS-Z can descend).' } },   // a SELECT dropdown (matches middle); t961 — grey the Plane option unless the plane guarantee holds (declare-not-infer; the userOpView loop reads optionGate)
    // t1706 CORRECTION (found live, driving the real app — Act 2's survey checked only cornerWizard.js, not the
    // atom-kernel it hands off to): saferetract.js's OWN emit (safeHopBlock ~:42, planeLiftNodes ~:124) re-coerces
    // both via its own num()/r3() — `r3(num(p.hopDist,15))`, `r3(num(p.planeZ,10))` — a SECOND discard downstream
    // of cornerStack's own (already-fixed) call site. saferetract.js is shared by other ops (middle's literals) —
    // fixing it is a real option but out of THIS act's scope (the exact "4 pilot ops only" leak risk Act 3's own
    // dispatch names); reporting the gap rather than shipping a form that accepts but silently drops it.
    { param: 'hopDist',   type: 'number', tokenRefusal: 'This value is re-resolved by the clearance-lift atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, default: CORNER_DEFAULTS.hopDist,   label: 'Hop Height (mm)', help: 'Hop mode: how far to lift above the probe before crossing, capped at the machine margin.', section: 'GEOMETRY', when: { param: 'clearMode', is: 'hop' }, match: { type: 'clearlift' }, key: 'hopDist' },
    { param: 'planeZ',    type: 'number', tokenRefusal: 'This value is re-resolved by the clearance-lift atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, widget: 'plane-suggest', default: CORNER_DEFAULTS.planeZ,    label: 'Clearance Plane (work Z)', help: 'Plane mode: an absolute WORK-Z the probe clears to (fixtures / tall stock). A WORK Z — set the Z datum first.', section: 'GEOMETRY', when: { param: 'clearMode', is: 'plane' }, match: { type: 'clearlift' }, key: 'planeZ' },   // t933 — the plane-suggest widget: Suggest (stock top + margin) + inline floor warn
    // ② B4 step 4a — SEMANTIC relTo: anchor the drag to the sim-start row NAMED 'wall1' (not a fragile numeric index).
    // resolveRelToIndex maps 'wall1' → its position among the SURVIVING when-filtered starts, so the handle tracks wall-1
    // in BOTH probeZ states (off: wall1 is filtered-index 0; on: the zsurf row shifts it to 1). Declare-never-infer.
    { param: 'cross1_x',   type: 'number', tokenEligible: true, formHidden: true, group: 'reposition', role: 'x', relTo: { row: 'wall1' }, label: 'Wall 2 dX', section: 'GEOMETRY', match: { type: 'assign', var: '#23' }, key: 'value' },
    { param: 'cross1_y',   type: 'number', tokenEligible: true, formHidden: true, group: 'reposition', role: 'y', relTo: { row: 'wall1' }, label: 'Wall 2 dY', section: 'GEOMETRY', match: { type: 'assign', var: '#24' }, key: 'value' },
    // ③ — the Z-first START handle (#21/#22, the zsurf→wall1 traverse): PRUNE-GATED on probeZFirst (only emitted when Z-first),
    // so `optional` (deriveBindings skips it when the socket is pruned away, off) + `when` (the form field + the canvas handle
    // show only under probeZFirst). relTo:{row:'zsurf'} anchors the drag to the Z-surface pass (the incremental datum); NO
    // `default` → the socket's baked expression holds (perp axis = '0', probe axis = signed travel) → NON-DEGENERATE (kills B3 0,0).
    { param: 'startX', type: 'number', tokenEligible: true, formHidden: true, group: 'start', role: 'x', relTo: { row: 'zsurf' }, optional: true, when: { param: 'probeZFirst', is: true }, label: 'Z→Wall1 dX', section: 'GEOMETRY', match: { type: 'assign', var: '#21' }, key: 'value' },
    { param: 'startY', type: 'number', tokenEligible: true, formHidden: true, group: 'start', role: 'y', relTo: { row: 'zsurf' }, optional: true, when: { param: 'probeZFirst', is: true }, label: 'Z→Wall1 dY', section: 'GEOMETRY', match: { type: 'assign', var: '#22' }, key: 'value' },
];

export const CORNER_DATA_OPTYPE = 'user_corner_data';

/** inc B2/B2b — the per-PROBE-PASS PREVIEW start markers, DECLARED as `def.sim.starts` rows, authored as canonical template
 *  `simstart` blocks below. ONE marker per PROBE PASS (wall-1, wall-2, + Z-surface when probeZFirst) — NOT per waypoint. The
 *  engine indexes markers by `_pass`, which increments at each `REPOSITION:` traverse (a DELIMITER, not a pass — GcodeExecution
 *  Engine.js:598). The corner's single wall-1→wall-2 REPOSITION → 2 passes → 2 markers for the baked no-Z default; the
 *  reposition itself gets NO marker (a 3rd/waypoint marker would displace wall-2 to the reposition point INSIDE the stock and
 *  orphan the true wall-2 — the B2 bug this fixes). Sim-side ONLY (emit unchanged: simstart emits nothing). Positions follow the
 *  LOCKED-MODEL FL/YX default via the `frac` anchor — the only one that reaches a corner (`edge` centres the perp axis). All
 *  fractions are LITERAL → resolve to the default geometry, NEVER read the reposition EXPRESSION sockets (#23/#24) → finite by
 *  construction (NaN discipline). The Z-surface row is `when`-gated on probeZFirst — now a LIVE toggle (② B4 step 4a): its
 *  pass-alignment is resolved (step 3 made Z→wall-1 a REPOSITION: delimiter → 3 passes == 3 markers under Z). Each row carries a
 *  stable `id` so a binding's SEMANTIC relTo ({row:'wall1'}) anchors to the right pass regardless of the zsurf row's presence. */
// `emits` (sim-marker-distinguish, t69) marks a pass whose start is a PROGRAM-WRITTEN reposition destination — dragging
// its handle edits a macro var in the emitted G-code (corner #21-#24) → the marker gets the SOLID (emitting) shape vs the
// HOLLOW (sim-only jog preview) shape. Purely a SHAPE hint for the preview (never emitted); the FIRST surviving pass is
// always the operator's manual start (sim-only) so `emits` only takes effect from pass 2 on — see makeProvider. So: zsurf
// (no emits) is always sim-only (the Z-first lead); wall1 emits (its start is #21/#22) but reads sim-only when it IS the
// lead pass (probeZ off, index 0); wall2 always emits (#23/#24, never the lead).
export const CORNER_SIM_STARTS = [
    { id: 'zsurf', anchor: 'frac', fx: 0.07, fy: 0.0875, plane: 'top',   when: { param: 'probeZFirst', is: true } },   // Z-surface probe (only when probeZ) — filtered-index 0 when on; operator-jogged (sim-only)
    { id: 'wall1', anchor: 'frac', fx: 0.20, fy: -0.625, plane: 'probe', emits: true },   // Wall-1 (Y, first) — _pass 0 no-Z (sim-only lead) / _pass 1 under Z (EMITS #21/#22)
    { id: 'wall2', anchor: 'frac', fx: -0.50, fy: 0.25,  plane: 'probe', emits: true },   // Wall-2 (X, second) — always a reposition destination (EMITS #23/#24)
];

/** SIM-MARKER positions (t73) — the reposition-DESTINATION passes sit where the tool ARRIVES, chained by the SAME #21-#24
 *  reposition defaults the emit uses (cornerReposOffsets — ONE geometry source, combo-correct via axesOf). The zsurf FRAC is
 *  the fixed chain ANCHOR, computed even when its marker is gated off (Z-off) — so `wall1 = zsurf + Z→wall1 reposition` is the
 *  SAME physical point in BOTH probeZ states (the #23/#24 relTo:wall1 anchor invariant, 4a — the reposition drag must anchor
 *  to one wall-1 regardless of Z-first). `wall2 = wall1 + wall1→wall2 reposition`. Chained math is PREVIEW-ONLY, never
 *  emitted → byte-parity untouched. (Registered as def.simStartsProvider so registerUserOp uses it over makeProvider.)
 *    off : [wall1 = zsurf+start, wall2 = wall1+cross]           (zsurf marker gated off, but still the chain anchor)
 *    on  : [zsurf(frac), wall1 = zsurf+start, wall2 = wall1+cross] */
function cornerSimStartsProvider(params, stock) {
    const p = params || {};
    const prov = makeProvider(CORNER_SIM_STARTS);
    const real = prov(p, stock);                              // the whenOk-filtered SET — correct emits + z + count
    const zsurf = prov({ ...p, probeZFirst: 1 }, stock)[0];   // the zsurf FRAC (force it present) = the chain anchor, both states
    const off = cornerReposOffsets(p);
    // PREFILL FIX (t109) — the frac anchor is CANONICAL-FL (fx/fy measured from the origin = the FL corner); for a non-FL
    // corner it must FLIP to the RIGHT corner or the whole chain (+ the machine-faithful passEnds relocation that rides it)
    // sits at FL → the sim probe fires into EMPTY SPACE. Mirror the inset to the corner's side using dirsOf — the SAME
    // per-corner sign source the emit uses (cornerReposOffsets/axesOf) → one geometry, can't desync. FL (xd/yd '+') → no flip
    // → BYTE-IDENTICAL. Far-X corner (FR/BR, xd '−') mirrors to sx − inset; far-Y (BL/BR, yd '−') to sy − inset. Preview-only.
    const cornerId = ({ 1: 'FL', 2: 'FR', 3: 'BL', 4: 'BR', FL: 'FL', FR: 'FR', BL: 'BL', BR: 'BR' }[p.corner]) || 'FL';
    const [xd, yd] = dirsOf(cornerId);
    const sx = Number(stock && stock.x) || 100, sy = Number(stock && stock.y) || 80;
    const xy = { zsurf: { x: xd === '-' ? sx - zsurf.x : zsurf.x, y: yd === '-' ? sy - zsurf.y : zsurf.y } };
    xy.wall1 = { x: xy.zsurf.x + off.wall1.dx, y: xy.zsurf.y + off.wall1.dy };
    xy.wall2 = { x: xy.wall1.x + off.wall2.dx, y: xy.wall1.y + off.wall2.dy };
    const ids = CORNER_SIM_STARTS.filter((r) => whenOk(r.when, p)).map((r) => r.id);
    // t83 — DECLARE the per-pass reposition SOURCE (auto/manual → marker colour + the arc-vs-straight travel line) DIRECTLY from
    // the LIVE param travelApproach, NOT re-derived from the parsed G-code text (the engine's `auto-traverse`-comment inference,
    // which is unreliable — corner's auto travel isn't tagged, so it read 'manual' even at the auto default + didn't track the
    // toggle). Pass 0 = the operator jog LEAD (auto/default); every reposition-destination pass = travelApproach. Preview-only.
    const src = (p.travelApproach === 'manual') ? 'manual' : 'auto';
    // t94 — DECLARE the ROUTE draw-anchor decouple: an AUTO reposition pass (i>=1, source==='auto') draws its dog-leg
    // from the PREVIOUS pass's start (the re-park), NOT its own net-endpoint marker — else the incremental dog-leg
    // double-counts +cross and the route (+ the sim's probe collision origin) fires +cross beyond ②. drawAnchorFor reads
    // this flag; the marker {x,y} stays the net endpoint. MANUAL (no dog-leg — operator jogs) + pass 0 keep anchor=self.
    return real.map((m, i) => {
        const c = xy[ids[i]];
        const source = i === 0 ? 'auto' : src;
        const anchorsAtPrev = i >= 1 && source === 'auto';   // auto reposition destinations only
        return c ? { ...m, x: c.x, y: c.y, source, anchorsAtPrev } : { ...m, source, anchorsAtPrev };   // override XY, add DECLARED source + anchor flag, keep emits/z
    });
}

/** The STRUCTURAL toggle bindings — params that drive the guard prune (NO value socket → no blockIndex/match). Each flips
 *  the emit AND the preview between shapes: `probeZFirst` (bool, ② B4 step 4a) no-Z↔Z-first; `travelApproach` (enum, step 4b)
 *  auto↔manual — the hands-free G0 seq move vs the #1505 jog-and-wait prompt, on BOTH the Z→wall1 and wall1→wall2 traverses.
 *  (t154 — DEFINED HERE, above cornerDataStack, so cornerDataStack can DERIVE its STRUCTURAL-section controls from it at eval.) */
export const CORNER_STRUCT_BINDINGS = [
    // t1239 IDENTITY FIRST ([[op-defining-fields-at-top]], user) — WHICH CORNER and WHICH WALL FIRST decide what this
    // op IS: every other field below tunes an op these two have already defined. They lead the form now; the rest keep
    // their order (identity -> geometry -> tool/cut).
    // ③b — corner quadrant + probe order: value/order swaps driven by the 8-way corner×probeSeq guard (NOT prune-add/remove).
    // t1704 — none of these 7 are token-eligible, and none are deferrable-candidates: every one is a CATEGORICAL
    // branch-selector (cornerFork/csFork/zPair/taPair/tsPair/wcsFork/syncBlocks in cornerWizard.js), not a magnitude
    // — its value picks WHICH atoms get built (order, presence, count) or WHICH content lands in an already-fixed
    // atom, never a number a controller macro expression could compute instead.
    { param: 'corner', type: 'enum', tokenRefusal: 'Sets which corner you\'re probing — this decides the two walls and their approach directions, not a single moved value; it can\'t be resolved until the program is already built.', default: CORNER_DEFAULTS.corner, label: 'Corner', help: 'Which corner of the stock you are probing — sets the two walls and their approach directions (Front-Left / Front-Right / Back-Left / Back-Right).', section: 'IDENTITY', widgetConfig: { options: [['Front-Left', 'FL'], ['Front-Right', 'FR'], ['Back-Left', 'BL'], ['Back-Right', 'BR']] } },
    { param: 'probeSeq', type: 'enum', tokenRefusal: 'Decides the ORDER the two walls get probed — it reorders the moves themselves, not a value inside one.', default: CORNER_DEFAULTS.probeSeq, label: 'Probe Order', help: 'Which wall to probe first — Y-wall then X-wall, or X then Y.', section: 'IDENTITY', widgetConfig: { options: [['Y then X', 'YX'], ['X then Y', 'XY']] } },
    { param: 'probeZFirst', type: 'bool', tokenRefusal: 'Turns the whole Z-surface probe pass on or off — changes how many moves the program contains.', default: !!CORNER_DEFAULTS.probeZFirst, label: 'Probe Z First', help: 'Probe the top surface for Z before the two walls — anchors the sideways probes to a real measured Z instead of a jogged guess.', section: 'GEOMETRY' },
    { param: 'travelApproach', type: 'enum', tokenRefusal: 'Picks between an automatic move and a manual jog-and-wait prompt — two different program shapes, not two values of one move.', widget: 'segmented', default: CORNER_DEFAULTS.travelApproach, label: 'Travel', help: 'Auto = the machine moves itself between the walls; Manual = you jog to each start and press Cycle Start (operator-in-the-loop).', section: 'GEOMETRY', widgetConfig: { options: [['Manual', 'manual'], ['Auto', 'auto']] } },   // t323 — opt-in segmented; t328 human — DISPLAY order [Manual|Auto] (Manual left); default stays 'auto' (value-mapped, not index)
    // t328 — TRAVEL SHAPE for the wall1→wall2 AUTO traverse. dogleg (default) = BYTE-IDENTICAL to today (firstAxis routes around the
    // corner); diagonal = a single straight XY at the existing safe-Z retract height (OPT-A — zero added Z). Help is HONEST about
    // the user owning the clearance via their Safe Z [[dont-declare-away-user-responsibility]]. Kept [Dogleg|Diagonal] (default-first).
    { param: 'travelShape', type: 'enum', tokenRefusal: 'Picks the traverse route between the two walls — Dogleg emits two moves, Diagonal emits one — so it changes how many lines the program contains.', widget: 'segmented', default: CORNER_DEFAULTS.travelShape, label: 'Travel shape', help: 'Dogleg = the tool routes around the corner (two axis moves) — never passes over the stock; Diagonal = a single straight move across at your Safe Z — faster, but relies on your Safe Z clearing the stock top.', section: 'GEOMETRY', widgetConfig: { options: [['Dogleg', 'dogleg'], ['Diagonal', 'diagonal']] } },
    // ② B4 step 4c — the 7-way WCS target: 'active' reads the controller's #578, or write a fixed G54..G59 slot directly.
    { param: 'wcs', type: 'enum', tokenRefusal: 'Selects which work-coordinate register the found corner is written to — this changes which G-code gets built for every wall, not a number inside it.', default: CORNER_DEFAULTS.wcs, label: 'WCS', help: 'Which work-coordinate register to store the found corner into — Active uses the currently-selected WCS; G54..G59 write that specific register.', section: 'GEOMETRY', widgetConfig: { options: [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']] } },
    // ② B4 step 4d — dual-gantry sync: a bool block-ADD (appends G1 A0 + the slave-offset write #74=[#70+slave], #[#74]=#883).
    { param: 'syncA', type: 'bool', tokenRefusal: 'Turns the whole dual-gantry sync block on or off — changes how many lines the program contains.', default: !!CORNER_DEFAULTS.syncA, label: 'Dual-Gantry Sync A', help: 'Dual-gantry: also write the found corner to the slave A-axis WCS, keeping a twin-motor gantry squared. A WCS write only — no extra motion.', section: 'GEOMETRY' },
];

/** The wrapped `user_root` template for a given param set. Structural params bake the stack SHAPE; the 9 bound scalars
 *  are the value-sockets the bindings drive. The `simstart` rows declare the per-pass preview markers (canonical over
 *  def.sim.starts). Exported so the emit spec can build a probeZFirst=on variant to prove the derive helper re-finds #23/#24. */
export function cornerDataStack(params = CORNER_DEFAULTS) {
    // t130 — REDIVIDE (Option B, corner-piloted): organise the wizard's blocks into labeled concern-SECTIONS (transparent
    // `section` containers — emit their children in order, so this is byte-transparent). user_root keeps its 2 mouths (the
    // 5 OTHER user ops are untouched); the sections nest inside. PRESENTATION mouth = FORM + one peer per VIEW; EXECUTION
    // mouth = STRUCTURAL / VARIABLES / G-CODE.
    // t132 — CONCERN COLOUR (item h): each section declares its Blockly block colour (authoring-only — rides in `data`, never
    // a field, never emitted). VIEW family = a blue set (LAYOUT-2D / 3D-SIM / PROJECTED-GCODE read as related views);
    // STRUCTURAL / VARIABLES / FORM / G-CODE each a distinct hue. Palette is easily tweaked (the human can adjust).
    const sec = (title, color, children) => ({ type: 'section', params: { title, color }, children });
    // t2301 (BACKLOG 20) — 'panel' removed from the FORM section below: formWidgets.js's `sim` and `panel`
    // branches hardcode the SAME DOM ids for their own layout2d pane, a real id collision wherever both are
    // declared anywhere in ONE tree — regardless of which `section` nests them, since traverse() walks the
    // whole tree into one DOM. `sim` (declared in the 3D-SIM section below) already renders everything panel
    // did, per t2257's own systemic check (atcChangeData.js). See drillData.js's own t2301 comment for the
    // fuller mechanism.
    const sim = { type: 'sim', params: { rotary: false, machine: false, magazine: false, probeWcs: true } };   // t714 — corner is a PART-FRAME probe (lands on the physical corner of the datum-placed stock); machine:true was a latent-dead forceMachine (the old applySimIntent ignored plain forceMachine, so corner always rendered part-frame — its shipped behavior). Honest intent = no forceMachine.
    const paramGroup = { type: 'param_group', params: { group: 'Corner' }, children: [] };
    const simstarts = simStartsToBlocks(CORNER_SIM_STARTS);   // per-pass preview markers (canonical; SIM only, emit nothing)

    // PRESENTATION mouth — FORM (input) + one peer per VIEW of the program (t119). All emit ∅. The per-pass sim-start
    // markers are the SHARED anchor source (fed to BOTH the 2D + 3D views by cornerSimStartsProvider — ONE source, never
    // re-declared per view; the one-source guard); they ride 3D-SIM.
    //
    // t1724 — LAYOUT-2D + PROJECTED-GCODE stay EMPTY, TRACED, not "a later follow-up" (that framing is retired — this
    // is the trace, cycle 856 ACT 3's amendment). Corner's own preview content was checked live against the two
    // primitive vocabularies this follow-up meant to use:
    //   - `shape_rect/circle/line/marker` (vizBlocks.js) HAS a real, working consumer (panelTypes.js:293, flattens
    //     def.template and draws every shape it finds) — but corner has NOTHING to feed it. Its whole 2D vocabulary is
    //     either INTERACTIVE (the per-pass sim-start markers above, and the corner-pick handle — panelTypes.js's
    //     name-sniffed `cornerBind`) or TRACE-DERIVED (the toolpath overlay, correctly staying trace-only per this
    //     cycle's Fork-2 ruling: geometry with G-code behind it must never gain a second, declared copy). Shape
    //     primitives are deliberately non-interactive static drawing (vizBlocks.js's own doc: "no transform blocks");
    //     corner draws no static shape at all, so there is nothing to port, not an unfinished port.
    //   - `layout_2d_canvas`/`sim_3d_box`/`code_preview_panel` (the CONTAINER blocks this follow-up would have used)
    //     are THEMSELVES unfinished, independent of corner: grep confirms zero readers anywhere in the app — their
    //     `minHeight`/`showControls`/`showRuler`/`maxHeight`/`title` fields are inert, `kind:'uibox'` only wires the
    //     Blockly round-trip, never the real rendered panel. Placing one here would misrepresent inert machinery as
    //     functional — exactly the declared-but-unread shape this project already named four times (`emits`/
    //     `modalPre`/`noSnap`/`mouth`) and the fifth this act's trace found.
    // Reported, not invented: no new block, no placeholder block. See WORK-LOG t1724.
    const uiChildren = [
        sec('FORM', '#d946ef', [paramGroup]),                  // form input — magenta (panel removed, t2301 — see the const `sim`'s own comment above)
        sec('LAYOUT-2D', '#3b82f6', []),                       // view family — blue
        sec('3D-SIM', '#6366f1', [sim, ...simstarts]),         // view family — indigo
        sec('PROJECTED-GCODE', '#0ea5e9', []),                 // view family — sky
    ];

    // EXECUTION mouth. ② B4 step 4a — cornerStack emits the SUPERSET (both probeZFirst arms wrapped in `guard`s; instantiate()
    // prunes to the chosen shape). STRUCTURAL = a ∅ LABELED GROUPING (the structural knobs are the deferred item-d follow-up).
    // The VARIABLES/G-CODE split falls on the CONTIGUOUS SEAM = the first top-level guard/motion AFTER the first ungated
    // assign → VARS ++ G-CODE reproduces the cornerStack order EXACTLY (byte-identical; STRUCTURAL emits nothing). Robust:
    // no boundary found → everything lands in VARIABLES (still byte-exact, just coarser grouping).
    const exec = cornerStack(params, { superset: true });
    let seenAssign = false, seam = exec.length;
    for (let i = 0; i < exec.length; i++) {
        const b = exec[i];
        if (b && b.type === 'assign') seenAssign = true;
        else if (seenAssign && b && (b.type === 'guard' || b.type === 'distmode' || b.type === 'probe' || b.type === 'move')) { seam = i; break; }
    }
    // t154 — the STRUCTURAL controls are DERIVED from CORNER_STRUCT_BINDINGS (the SAME source the runtime form renders from) →
    // the Blocks-tab controls REFLECT THE FORM by construction (one source, no drift). Each `sc_<param>` block drives its op
    // param (pruneGuards branches on it) via the live-reprune hook (blocksApp); emits NOTHING. Value = the param default here;
    // postInstantiate re-syncs it to op.params after a reprune so it keeps the SET value.
    const structCtls = CORNER_STRUCT_BINDINGS.map((b) => ({
        type: 'sc_' + String(b.param).toLowerCase(),
        params: { value: b.type === 'bool' ? !!b.default : b.default },
    }));
    const children = [
        sec('STRUCTURAL', '#f59e0b', structCtls),              // the structural drivers, derived from CORNER_STRUCT_BINDINGS — amber
        sec('VARIABLES', '#06b6d4', exec.slice(0, seam)),      // #var defs — cyan
        sec('G-CODE', '#22c55e', exec.slice(seam)),            // the emit — green
    ];

    return [{ type: 'user_root', params: {}, uiChildren, children }];
}

/** Bindings for the value sockets — DERIVED (not hand-counted). The corner×probeSeq 8-way guard DUPLICATES the bound reposition
 *  sockets (#21-#24) 8× in the raw superset, so we derive over a CANONICAL-PRUNED stack (probeZFirst:1 · FL · YX → exactly 1×
 *  each socket, all 13 present incl the Z-first #21/#22). The frozen blockIndex is over this canonical stack (validateUserOp
 *  skips it for bindingSpecs defs); EMIT re-derives BY IDENTITY over the actual PRUNED stack each build (via bindingSpecs). */
const CANONICAL_BIND = { ...CORNER_DEFAULTS, probeZFirst: 1, corner: 'FL', probeSeq: 'YX', travelShape: 'dogleg' };   // t328 — pin dogleg so the canonical prune keeps the wall1→wall2 traverse at 1× (the diagonal arm's duplicate #23/#24 move is pruned away)
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(cornerDataStack(CORNER_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const CORNER_BINDINGS = deriveBindingsFor(canonicalPrunedStack(), CORNER_BINDING_SPECS);

// t87 — SOURCE-CHIPS: when the user opts a probe field to 'ctrl' (on a profile that has a native register, e.g. Expert), emit the
// CONTROLLER register (#5=#1078 &c.) instead of the literal — EXACT parity with the built-in's srcVal/srcNote. Applied POST-emit
// because the M2 template is FIXED at def-creation (no sources): rewrite the #5/#3/#2 assign value+note via the SAME srcVal/srcNote,
// reading LIVE from settings (a global profile+user setting — machine-facts-vs-macro — not a stored per-op binding). `level`
// stays baked (excluded). STUDIO-sourced (the default) or a profile with no native var → resolve returns {} → byte-IDENTICAL.
const PROBE_SRC_VARS = { port: '#5', fastFeed: '#3', retract: '#2' };
function applyProbeSources(stack) {
    const resolve = (typeof window !== 'undefined' && window.ddcsResolveProbeSources) ? window.ddcsResolveProbeSources : null;
    const sources = resolve ? resolve(['port', 'fastFeed', 'retract']) : {};
    if (!sources || !Object.keys(sources).length) return stack;   // studio / non-Expert profile → unchanged (byte-identical)
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'assign' || !b.params) continue;
        for (const field in PROBE_SRC_VARS) {
            if (b.params.var === PROBE_SRC_VARS[field] && sources[field]) {
                b.params.value = String(srcVal(sources[field], b.params.value));   // src.ctrl (the controller register) over the literal
                b.params.note = srcNote(sources[field], b.params.note);            // "<note> - controller PrNNN"
            }
        }
    }
    return stack;
}

// t138 — the static template froze the 2 header SUMMARY comments at CORNER_DEFAULTS (bindingSpecs only touch the #N assign
// VALUES, not composed comment text). Recompose them from the RESOLVED params via the SAME cornerHeaderComments format
// cornerStack uses → twin==built-in byte-identical for ALL scalars, not just defaults; no operator-facing change (still the
// values, now correct). Match the 2 target comments by their DEFAULT-composed text (exact — that IS what the template froze).
function applyHeaderComments(stack, resolved) {
    const [d1, d2] = cornerHeaderComments(CORNER_DEFAULTS);
    const [r1, r2] = cornerHeaderComments(resolved || {});
    if (d1 === r1 && d2 === r2) return stack;   // scalars at defaults → nothing to rewrite (byte-identical)
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'comment' || !b.params) continue;
        if (b.params.text === d1) b.params.text = r1;
        else if (b.params.text === d2) b.params.text = r2;
    }
    return stack;
}

// t154 — STRUCTURAL-CONTROL value sync. instantiate() rebuilds the template at its DEFAULTS, so after a live reprune
// (replaceOp re-instantiates from the edited op.params) each `sc_<param>` control would snap back to its default. Re-sync
// each control's `value` FROM the resolved op param it drives, so the toggle/dropdown keeps the SET value. Emits nothing —
// this only touches the authoring block's field (byte-parity untouched). SC maps derived from CORNER_STRUCT_BINDINGS (one source).
const SC_PARAM = Object.fromEntries(CORNER_STRUCT_BINDINGS.map((b) => ['sc_' + String(b.param).toLowerCase(), b.param]));
const SC_ISBOOL = Object.fromEntries(CORNER_STRUCT_BINDINGS.map((b) => ['sc_' + String(b.param).toLowerCase(), b.type === 'bool']));
function applyStructCtl(stack, resolved) {
    if (!resolved) return stack;
    for (const b of flattenBlocks(stack)) {
        if (!b || !b.type || !b.params) continue;
        const param = SC_PARAM[b.type];
        if (param && param in resolved) b.params.value = SC_ISBOOL[b.type] ? !!resolved[param] : resolved[param];
    }
    return stack;
}

/** t961 — the plane-guarantee BACKSTOP for the TWIN: the frozen clearlift carries the SAVED clearMode (a bound socket), which
 *  can be 'plane' with a config the UI gate never vetted (WCS!=Active or no Z-first). Fold it plane->hop at BUILD via the ONE
 *  source (resolveClearMode) + set planeFellBack (the same param the form path passes → the clearlift emit produces the same
 *  honest comment → twin byte-parity holds). Z-first for corner = probeZFirst (or probeZ). */
function applyClearModeBackstop(stack, resolved) {
    const wcs = resolved && resolved.wcs, zFirst = !!(resolved && (resolved.probeZFirst || resolved.probeZ));
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'clearlift' || !b.params) continue;
        const requested = clearModeOf(b.params.clearMode);
        const folded = resolveClearMode(b.params.clearMode, { wcs, zFirst });
        b.params.clearMode = folded;
        if (requested === 'plane' && folded !== 'plane') b.params.planeFellBack = true; else delete b.params.planeFellBack;
    }
    return stack;
}

/** Build the corner-as-data def — same userOpFromStack pattern as drill/surfacing/slot/text/atcWarmup, PLUS `bindingSpecs`
 *  (instantiate re-derives the value sockets by identity over the pruned superset) + the structural probeZFirst toggle. */
export function cornerDataDef() {
    // t87 — tag the probe-config bindings so the form GREYS them when 'ctrl'-sourced (the value then comes from the controller
    // register, not the literal — see applyProbeSources). Matches PROBE_SRC_VARS: port(#5)/f_fast(#3)/retract(#2). level is baked.
    const SRC_BY_PARAM = { port: 'port', f_fast: 'fastFeed', retract: 'retract' };
    const bindings = [...CORNER_BINDINGS, ...CORNER_STRUCT_BINDINGS].map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    // t339 E4 — NO '*_datawiz' group: corner is now opened IN-PLACE from the built-in Corner's Probe slot (opensAs), its own
    // menu entry hidden — RETROFIT of the pilot gap (corner was retired-and-RELOCATED to a data-wiz folder, never in-place).
    const def = userOpFromStack('corner_data', 'Corner (data)', cornerDataStack(CORNER_DEFAULTS),
        bindings, 'form3d+2d', {});   // t714 — no forceMachine (part-frame probe; the sim block above is the effective source, this fallback matches it)
    def.bindingSpecs = CORNER_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY over the PRUNED stack every build
    def.simStartsProvider = cornerSimStartsProvider;   // t73 — sim markers CHAIN off their anchor via the emit's reposition geometry (preview-only)
    def.postInstantiate = (stack, resolved) => applyClearModeBackstop(applyStructCtl(applyHeaderComments(applyProbeSources(stack), resolved), resolved), resolved);   // t87 source-chips + t138 header recompose + t154 struct-control value sync + t961 plane-guarantee backstop
    return def;
}
