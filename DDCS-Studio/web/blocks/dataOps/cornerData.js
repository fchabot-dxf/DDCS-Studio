/**
 * blocks/dataOps/cornerData.js — the CORNER built-in expressed as a pure DATA definition (the corner port, inc B1 EMIT).
 *
 * This REDOES the shipped-broken data/cornerPort.js. That version HAND-COUNTED each binding's blockIndex and skipped the
 * `=== CONFIGURATION ===` comment → every binding shifted by one → registerUserOp threw / mis-bound (defect #1). Here the
 * bindings are DERIVED from the flattened `user_root` stack by macro-var identity (deriveBindings.js) — valid-by-construction,
 * immune to a comment insertion AND to the `user_root` wrap offset (no `WRAP_PREFIX_COUNT` hand-count).
 *
 * ADDITIVE TWIN: this is a NEW "Corner (data)" op seeded ALONGSIDE the UNTOUCHED built-in Corner wizard (wizardLibrary
 * id:'corner'). Nothing the operator uses is disabled.
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
import { cornerStack } from '../../wizards/cornerWizard.js';
import { userOpFromStack, simStartsToBlocks } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards } from '../whenGuard.js';   // ③b — derive CORNER_BINDINGS over a CANONICAL-pruned stack (the 8-way corner×probeSeq guard duplicates the bound sockets in the raw superset)

/** Author defaults — match cornerStack's fallbacks + the built-in Corner field defaults. Structural params (corner/
 *  probeSeq/probeZFirst/wcs/syncA) are baked at their defaults: the twin is the FL / YX / no-Z / active-WCS shape. */
export const CORNER_DEFAULTS = {
    // corner/probeSeq/wcs are the STRING forms — the guards match by value-equality (when(corner=='FL'…) / when(probeSeq=='YX'…)
    // / when(wcs=='active'…)); a numeric 1/0 would match no arm and drop the block. (cornerStack still accepts the numeric forms
    // for the built-in via its own normalization.)
    corner: 'FL', probeSeq: 'YX', probeZFirst: 0, travelApproach: 'auto', wcs: 'active',
    dist: 500, retract: 5, f_fast: 200, f_slow: 50, port: 3,
    level: 0, safeZ: 10, scanDepth: 5, radius: 2, travelDist: 50,
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
    { param: 'dist',       type: 'number', default: CORNER_DEFAULTS.dist,       label: 'Max Probe Dist',   section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value' },
    { param: 'retract',    type: 'number', default: CORNER_DEFAULTS.retract,    label: 'Retract',          section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value' },
    { param: 'f_fast',     type: 'number', default: CORNER_DEFAULTS.f_fast,     label: 'Fast Feed',        section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value' },
    { param: 'f_slow',     type: 'number', default: CORNER_DEFAULTS.f_slow,     label: 'Slow Feed',        section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value' },
    { param: 'port',       type: 'number', default: CORNER_DEFAULTS.port,       label: 'Port',             section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value' },
    { param: 'radius',     type: 'number', default: CORNER_DEFAULTS.radius,     label: 'Stylus Radius',    section: 'TOOL & CUT', match: { type: 'assign', var: '#6' },  key: 'value' },
    { param: 'travelDist', type: 'number', default: CORNER_DEFAULTS.travelDist, label: 'Reposition Travel', section: 'GEOMETRY',  match: { type: 'assign', var: '#15' }, key: 'value' },
    // ② B4(c) — fan-out DISSOLVED: #17 plunge now EMITS as [#19+#20], so safeZ→#19 + scanDepth→#20 are clean single-socket bindings (were baked frontiers).
    { param: 'safeZ',      type: 'number', default: CORNER_DEFAULTS.safeZ,      label: 'Safe Z',           section: 'GEOMETRY',   match: { type: 'assign', var: '#19' }, key: 'value' },
    { param: 'scanDepth',  type: 'number', default: CORNER_DEFAULTS.scanDepth,  label: 'Scan Depth',       section: 'GEOMETRY',   match: { type: 'assign', var: '#20' }, key: 'value' },
    // ② B4 step 4a — SEMANTIC relTo: anchor the drag to the sim-start row NAMED 'wall1' (not a fragile numeric index).
    // resolveRelToIndex maps 'wall1' → its position among the SURVIVING when-filtered starts, so the handle tracks wall-1
    // in BOTH probeZ states (off: wall1 is filtered-index 0; on: the zsurf row shifts it to 1). Declare-never-infer.
    { param: 'cross1_x',   type: 'number', group: 'reposition', role: 'x', relTo: { row: 'wall1' }, label: 'Wall 2 dX', section: 'GEOMETRY', match: { type: 'assign', var: '#23' }, key: 'value' },
    { param: 'cross1_y',   type: 'number', group: 'reposition', role: 'y', relTo: { row: 'wall1' }, label: 'Wall 2 dY', section: 'GEOMETRY', match: { type: 'assign', var: '#24' }, key: 'value' },
    // ③ — the Z-first START handle (#21/#22, the zsurf→wall1 traverse): PRUNE-GATED on probeZFirst (only emitted when Z-first),
    // so `optional` (deriveBindings skips it when the socket is pruned away, off) + `when` (the form field + the canvas handle
    // show only under probeZFirst). relTo:{row:'zsurf'} anchors the drag to the Z-surface pass (the incremental datum); NO
    // `default` → the socket's baked expression holds (perp axis = '0', probe axis = signed travel) → NON-DEGENERATE (kills B3 0,0).
    { param: 'startX', type: 'number', group: 'start', role: 'x', relTo: { row: 'zsurf' }, optional: true, when: { param: 'probeZFirst', is: true }, label: 'Z→Wall1 dX', section: 'GEOMETRY', match: { type: 'assign', var: '#21' }, key: 'value' },
    { param: 'startY', type: 'number', group: 'start', role: 'y', relTo: { row: 'zsurf' }, optional: true, when: { param: 'probeZFirst', is: true }, label: 'Z→Wall1 dY', section: 'GEOMETRY', match: { type: 'assign', var: '#22' }, key: 'value' },
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
export const CORNER_SIM_STARTS = [
    { id: 'zsurf', anchor: 'frac', fx: 0.07, fy: 0.0875, plane: 'top',   when: { param: 'probeZFirst', is: true } },   // Z-surface probe (only when probeZ) — filtered-index 0 when on
    { id: 'wall1', anchor: 'frac', fx: 0.20, fy: -0.625, plane: 'probe' },   // Wall-1 (Y, first) — _pass 0 no-Z / _pass 1 under Z
    { id: 'wall2', anchor: 'frac', fx: -0.50, fy: 0.25,  plane: 'probe' },   // Wall-2 (X, second) — after the wall-1→wall-2 REPOSITION traverse
];

/** The wrapped `user_root` template for a given param set. Structural params bake the stack SHAPE; the 9 bound scalars
 *  are the value-sockets the bindings drive. The `simstart` rows declare the per-pass preview markers (canonical over
 *  def.sim.starts). Exported so the emit spec can build a probeZFirst=on variant to prove the derive helper re-finds #23/#24. */
export function cornerDataStack(params = CORNER_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // B3d: BOTH the 3D probe sim (+ per-pass markers) AND the 2D reposition drag canvas (built-in probe pattern)
            { type: 'sim', params: { rotary: false, machine: true, magazine: false } },
            {
                type: 'param_group',
                params: { group: 'Corner' },
                children: [],
            },
            ...simStartsToBlocks(CORNER_SIM_STARTS),   // per-pass preview start markers (canonical; SIM only, emit nothing)
        ],
        // ② B4 step 4a — the SUPERSET seed: cornerStack emits BOTH probeZFirst arms wrapped in `guard`s, so instantiate()
        // prunes to either shape. The built-in still calls cornerStack CONCRETE (no opts) — the twin alone carries the forks.
        children: cornerStack(params, { superset: true }),
    }];
}

/** Bindings for the value sockets — DERIVED (not hand-counted). The corner×probeSeq 8-way guard DUPLICATES the bound reposition
 *  sockets (#21-#24) 8× in the raw superset, so we derive over a CANONICAL-PRUNED stack (probeZFirst:1 · FL · YX → exactly 1×
 *  each socket, all 13 present incl the Z-first #21/#22). The frozen blockIndex is over this canonical stack (validateUserOp
 *  skips it for bindingSpecs defs); EMIT re-derives BY IDENTITY over the actual PRUNED stack each build (via bindingSpecs). */
const CANONICAL_BIND = { ...CORNER_DEFAULTS, probeZFirst: 1, corner: 'FL', probeSeq: 'YX' };
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(cornerDataStack(CORNER_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const CORNER_BINDINGS = deriveBindingsFor(canonicalPrunedStack(), CORNER_BINDING_SPECS);

/** The STRUCTURAL toggle bindings — params that drive the guard prune (NO value socket → no blockIndex/match). Each flips
 *  the emit AND the preview between shapes: `probeZFirst` (bool, ② B4 step 4a) no-Z↔Z-first; `travelApproach` (enum, step 4b)
 *  auto↔manual — the hands-free G0 seq move vs the #1505 jog-and-wait prompt, on BOTH the Z→wall1 and wall1→wall2 traverses. */
export const CORNER_STRUCT_BINDINGS = [
    { param: 'probeZFirst', type: 'bool', default: !!CORNER_DEFAULTS.probeZFirst, label: 'Probe Z First', section: 'GEOMETRY' },
    { param: 'travelApproach', type: 'enum', default: CORNER_DEFAULTS.travelApproach, label: 'Travel', section: 'GEOMETRY', widgetConfig: { options: [['Auto', 'auto'], ['Manual', 'manual']] } },
    // ② B4 step 4c — the 7-way WCS target: 'active' reads the controller's #578, or write a fixed G54..G59 slot directly.
    { param: 'wcs', type: 'enum', default: CORNER_DEFAULTS.wcs, label: 'WCS', section: 'GEOMETRY', widgetConfig: { options: [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']] } },
    // ② B4 step 4d — dual-gantry sync: a bool block-ADD (appends G1 A0 + the slave-offset write #74=[#70+slave], #[#74]=#883).
    { param: 'syncA', type: 'bool', default: !!CORNER_DEFAULTS.syncA, label: 'Dual-Gantry Sync A', section: 'GEOMETRY' },
    // ③b — corner quadrant + probe order: value/order swaps driven by the 8-way corner×probeSeq guard (NOT prune-add/remove).
    { param: 'corner', type: 'enum', default: CORNER_DEFAULTS.corner, label: 'Corner', section: 'GEOMETRY', widgetConfig: { options: [['Front-Left', 'FL'], ['Front-Right', 'FR'], ['Back-Left', 'BL'], ['Back-Right', 'BR']] } },
    { param: 'probeSeq', type: 'enum', default: CORNER_DEFAULTS.probeSeq, label: 'Probe Order', section: 'GEOMETRY', widgetConfig: { options: [['Y then X', 'YX'], ['X then Y', 'XY']] } },
];

/** Build the corner-as-data def — same userOpFromStack pattern as drill/surfacing/slot/text/atcWarmup, PLUS `bindingSpecs`
 *  (instantiate re-derives the value sockets by identity over the pruned superset) + the structural probeZFirst toggle. */
export function cornerDataDef() {
    const def = userOpFromStack('corner_data', 'Corner (data)', cornerDataStack(CORNER_DEFAULTS),
        [...CORNER_BINDINGS, ...CORNER_STRUCT_BINDINGS], 'form3d+2d', { forceMachine: true }, 'probe_datawiz');
    def.bindingSpecs = CORNER_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY over the PRUNED stack every build
    return def;
}
