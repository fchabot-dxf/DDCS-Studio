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
 * FRONTIERS held BAKED (asserted as divergence tripwires, like drill's `method` / slot's `pattern`+`clearance`):
 *   • `probeZFirst` — ticking it INSERTS a Z-surface probe step + traverse (a CONDITIONAL STRUCTURE swap — adds #21/#22 +
 *     a probeSurfaceStack); `instantiate()` substitutes VALUES into a FIXED shape, it cannot add/remove blocks. corner /
 *     probeSeq / wcs / syncA are the same structural class (they change comment text + control-flow), all baked.
 *   • `safeZ` — a FAN-OUT: it feeds its own socket `#19` AND the COMPUTED `#17 = safeZ + scanDepth` (plunge depth). A single
 *     binding drives ONE socket, so binding safeZ→#19 would leave #17 stale (inconsistent plunge). Held baked (correct-by-
 *     construction) rather than shipped as a wrong binding — this is why the dump's 9th binding was unsound even before its
 *     off-by-one. scanDepth / level are baked for the same reason (computed into #17 / passed into probeSurfaceStack).
 * The built-in Corner keeps ALL of these working; see corner-data-probeZFirst-frontier.spec.js (the loud can't-forget gate
 * that blocks retiring the built-in).
 *
 * Template SEEDED from cornerStack(CORNER_DEFAULTS); the BINDINGS are derived + proven byte-identical by
 * tests/corner-data-emit.spec.js. SCOPE (inc B1) = EMIT only — no view/panel (B3), no sim-starts/inferStarts (B2).
 */
import { cornerStack } from '../../wizards/cornerWizard.js';
import { userOpFromStack, simStartsToBlocks } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';

/** Author defaults — match cornerStack's fallbacks + the built-in Corner field defaults. Structural params (corner/
 *  probeSeq/probeZFirst/wcs/syncA) are baked at their defaults: the twin is the FL / YX / no-Z / active-WCS shape. */
export const CORNER_DEFAULTS = {
    corner: 1, probeSeq: 0, probeZFirst: 0, wcs: 0,
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
    { param: 'cross1_x',   type: 'number', group: 'reposition', role: 'x',      label: 'Wall 2 dX',        section: 'GEOMETRY',   match: { type: 'assign', var: '#23' }, key: 'value' },
    { param: 'cross1_y',   type: 'number', group: 'reposition', role: 'y',      label: 'Wall 2 dY',        section: 'GEOMETRY',   match: { type: 'assign', var: '#24' }, key: 'value' },
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
 *  construction (NaN discipline). The Z-surface row is `when`-gated on probeZFirst (a baked frontier = off in the twin;
 *  probeZFirst's own pass-alignment — the Z→wall-1 traverse is not a REPOSITION: delimiter — is a B4 concern). */
export const CORNER_SIM_STARTS = [
    { anchor: 'frac', fx: 0.07, fy: 0.0875, plane: 'top',   when: { param: 'probeZFirst', is: true } },   // Z-surface probe (only when probeZ)
    { anchor: 'frac', fx: 0.20, fy: -0.625, plane: 'probe' },   // Wall-1 (Y, first) — _pass 0 in the no-Z default
    { anchor: 'frac', fx: -0.50, fy: 0.25,  plane: 'probe' },   // Wall-2 (X, second) — _pass 1 (after the wall-1→wall-2 REPOSITION traverse)
];

/** The wrapped `user_root` template for a given param set. Structural params bake the stack SHAPE; the 9 bound scalars
 *  are the value-sockets the bindings drive. The `simstart` rows declare the per-pass preview markers (canonical over
 *  def.sim.starts). Exported so the emit spec can build a probeZFirst=on variant to prove the derive helper re-finds #23/#24. */
export function cornerDataStack(params = CORNER_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form2d' } },   // inc B3: 2D FeatureCanvas layout so the reposition point drags
            { type: 'sim', params: { rotary: false, machine: true, magazine: false } },
            {
                type: 'param_group',
                params: { group: 'Corner' },
                children: [],
            },
            ...simStartsToBlocks(CORNER_SIM_STARTS),   // per-pass preview start markers (canonical; SIM only, emit nothing)
        ],
        children: cornerStack(params),
    }];
}

/** Bindings for the shipped (probeZFirst=off) template — DERIVED, not hand-counted. */
export const CORNER_BINDINGS = deriveBindingsFor(cornerDataStack(CORNER_DEFAULTS), CORNER_BINDING_SPECS);

/** Build the corner-as-data def — same userOpFromStack pattern as drill/surfacing/slot/text/atcWarmup. */
export function cornerDataDef() {
    return userOpFromStack('corner_data', 'Corner (data)', cornerDataStack(CORNER_DEFAULTS), CORNER_BINDINGS, 'form2d', { forceMachine: true }, 'probe_datawiz');
}
