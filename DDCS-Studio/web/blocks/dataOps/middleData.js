/**
 * blocks/dataOps/middleData.js — the MIDDLE built-in expressed as a pure DATA definition (the middle port, E1 EMIT).
 *
 * Middle (find a pocket/boss CENTRE) is the probe-fan-out pilot payoff after corner/edge: it INHERITS all the
 * corner-hardened machinery — userOpFromStack, deriveBindings (by macro-var IDENTITY), bindingSpecs (re-derive at
 * build), the guard/prune superset (E0), and the emitEquivalence byte-test. No hand-counted blockIndex anywhere.
 *
 * The 8 non-optional SCALAR bindings (#1..#6, #17, #18) + 4 PRUNE-GATED optionals (#19/#20 boss-cross-over, #21/#22
 * the trans-axis diagonal) are DECLARED by identity (var), never position. The 8 STRUCTURAL params (featureType /
 * inAxis / transAxis / twoAxis / circular / probeZ / wcs / syncA) drive the middleStack superset guards (E0);
 * instantiate() prunes to the concrete shape, then re-injects the scalars → the twin emits byte-identical to the
 * built-in middle across a structural + scalar sweep (tests/middle-data-emit.spec.js).
 *
 * BAKED (not bound, by design — E1 scope): axis / dir1 / dir2 are VALUE/order swaps (they change the G31 axis letter,
 * register selection + probe-order text, not add/remove blocks). They stay baked at the default X-primary / +dir shape;
 * the workpiece feature-read (fork a: derive featureType/size from getWorkpiece().features + retire syncStockShape) and
 * an axis/dir toggle are LATER slices. `level` follows the corner precedent (a machine constant, baked). SCOPE (E1) =
 * EMIT only — no sim-starts (E2), no in-place swap (E4).
 *
 * NOTE (source-chips, E1-FIX t375): the middle twin does NOT source #5/#3/#2 — DROPPED applyProbeSources so it is byte-
 * identical to the built-in on ALL profiles (studio AND Expert). Unlike cornerStack (4 srcVal hits), the built-in middle has
 * ZERO sourcing, so a source-chip hook on the twin ALONE would DIVERGE on an Expert profile (source the register while the
 * built-in emits the literal). Whether the built-in middle SHOULD source #5/#3/#2 like corner (a probe-param harmonisation)
 * is a SEPARATE question deferred to the human — if yes, add it to BOTH the built-in + the twin together (keeping byte-identical).
 */
import { middleStack, middleAxes } from '../../wizards/middleWizard.js';   // t1211 — middleAxes: the ONE declared axis-order resolver
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards } from '../whenGuard.js';   // derive MIDDLE_BINDINGS over a CANONICAL-pruned stack (the boss/twoAxis sockets are prune-gated in the superset)
import { makeProvider, middleReposLanding } from '../../viz/opSimStarts.js';   // E2 — reuse the DECLARED anchor geometry (rowToStart) so the twin's per-pass markers == BUILT_IN.middle; t963 B1 — the auto trans-traverse wall-2 landing (#21/#22)

/** Author defaults — match middleStack's num() fallbacks + the built-in Middle field defaults. Structural params baked at
 *  their default shape (pocket / auto travel / single-axis / active-WCS / no-Z / no-sync). axis/dir1 baked X-primary/+. */
export const MIDDLE_DEFAULTS = {
    // structural (STRING enums / bools — the guards match by value-equality / !! coercion)
    featureType: 'boss', inAxis: 'auto', transAxis: 'auto', travelShape: 'dogleg', twoAxis: false, circular: false, probeZ: 0, wcs: 'active', syncA: 0,
    // t1211 — axisOrder is DECLARED (which axis probes first). t1237 — and so are the DIRECTIONS: dir1 (the first
    // axis's probe direction) and dir2 (the second axis's, shown only under Find Both). Every default below is the
    // value the resolver ALREADY produced when they were baked — 'XY' + dir1 'pos' + dir2 the derived opposite 'neg' —
    // so the default emit is byte-identical and the unbake is a pure surfacing.
    axisOrder: 'XY', dir1: 'pos', dir2: 'neg',
    // baked value swaps (NOT bound)
    axis: 'X', slave: '3',
    // scalars — dist default 200 (t381: 20 was too small to reach the wall on a typical stock → "retract-only"; matches middleStack's fallback + the m_dist form default)
    dist: 200, retract: 2, f_fast: 200, f_slow: 50, port: 3, radius: 2, safeZ: 10, clearOver: 15,
    crossX: '80', crossY: '80', diagTravel: '50', diagPrimary: '#53',
};

/** The bindable scalars → the `assign` macro var each writes. DECLARED by identity (var), NOT position — deriveBindings
 *  re-finds the flat index over the PRUNED stack, so a template edit / a prune shift can never desync them.
 *  - #1..#6, #17, #18 are ALWAYS present (config) → non-optional.
 *  - #19/#20 (boss cross-over) exist only when featureType=boss AND inAxis=auto; #21/#22 (the trans-axis diagonal) only
 *    when featureType=boss AND transAxis=auto AND twoAxis → `optional` (deriveBindings skips them when pruned away). The
 *    `when` gates the FORM field only (instantiate applies a binding by SOCKET PRESENCE, never by `when`).
 *  - diagPrimary → #22 has NO explicit default: the socket holds the expression '#53' (re-centre at rest) → socket-held,
 *    so an untouched field keeps '#53' (the ② drag target is a later slice). */
export const MIDDLE_BINDING_SPECS = [
    { param: 'dist',      type: 'number', default: MIDDLE_DEFAULTS.dist,      label: 'Max Probe Dist', help: 'How far the stylus travels toward each wall before it gives up — larger than the gap to the wall, smaller than the far side.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value' },
    { param: 'retract',   type: 'number', default: MIDDLE_DEFAULTS.retract,   label: 'Retract',        help: 'How far the probe backs off each wall after the first touch, before the slow, accurate re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value' },
    { param: 'f_fast',    type: 'number', default: MIDDLE_DEFAULTS.f_fast,    label: 'Fast Feed',      help: 'Feed rate (mm/min) for the initial fast approach to each wall, before the touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value' },
    { param: 'f_slow',    type: 'number', default: MIDDLE_DEFAULTS.f_slow,    label: 'Slow Feed',      help: 'Feed rate (mm/min) for the precise second touch — slower gives a more accurate trigger point.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value' },
    { param: 'port',      type: 'number', default: MIDDLE_DEFAULTS.port,      label: 'Port',           help: 'The controller input port the probe signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value' },
    { param: 'radius',    type: 'number', default: MIDDLE_DEFAULTS.radius,    label: 'Stylus Radius',  help: 'The probe stylus tip radius (mm) — applied to each wall touch to give the true wall coordinate.', section: 'TOOL & CUT', match: { type: 'assign', var: '#6' },  key: 'value' },
    // t919 B2b-2a — the `safeZ` binding is RETIRED: the end park now always takes Max safe height (no user Safe-Z field), and #17
    // survives only as a FIXED DM500 work-frame degrade clearance (not param-driven), so it's no longer a bound/editable scalar.
    // t923 B2b-2b-cov — the `clearOver`/#18 binding is RETIRED: the in-axis cross-over now follows the CLEARANCE mode (Max/Hop/
    // Plane) like the trans-axis, so there's no separate Traverse-Over Clearance knob (one clearance concept). #18 is no longer emitted.
    // prune-gated optionals — present only in their structural shape (deriveBindings skips when the socket is pruned away)
    { param: 'crossX',    type: 'number', default: 80, optional: true, when: { param: 'featureType', is: 'boss' }, label: 'X Cross-Over', help: 'Boss auto: how far to traverse across the feature from wall 1 to wall 2 in X (≈ feature width + 2× approach).', section: 'GEOMETRY', match: { type: 'assign', var: '#19' }, key: 'value' },
    { param: 'crossY',    type: 'number', default: 80, optional: true, when: { param: 'featureType', is: 'boss' }, label: 'Y Cross-Over', help: 'Boss auto: how far to traverse across the feature from wall 1 to wall 2 in Y (≈ feature width + 2× approach).', section: 'GEOMETRY', match: { type: 'assign', var: '#20' }, key: 'value' },
    // diagTravel #21 + diagPrimary #22 are DRAG-DRIVEN by the ② canvas handle (t383) — the SOLE editor. t389 (human): render
    // them READONLY (display the ②-derived value, not a competing editable input) — the ② drag still writes them via _writeParam.
    { param: 'diagTravel', type: 'number', default: 50, optional: true, readonly: true, readonlyHint: 'Set by dragging the ② handle on the 2D canvas', when: { param: 'twoAxis', is: true }, label: 'Diag Travel', help: 'Boss two-axis auto: the diagonal traverse distance from the first axis walls to the perpendicular walls — set by dragging the ② handle.', section: 'GEOMETRY', match: { type: 'assign', var: '#21' }, key: 'value' },
    // diagPrimary → #22: NO default → the socket-held expression '#53' (re-centre) holds when untouched; the ② drag sets it.
    { param: 'diagPrimary', type: 'number', optional: true, readonly: true, readonlyHint: 'Set by dragging the ② handle on the 2D canvas', when: { param: 'twoAxis', is: true }, label: 'Diag Primary Target', section: 'GEOMETRY', match: { type: 'assign', var: '#22' }, key: 'value' },
];

/** The STRUCTURAL toggle bindings — params that drive the guard prune (NO value socket → no blockIndex/match). Each flips
 *  the emit (and later the preview) between shapes; instantiate prunes the superset to the chosen shape by these params. */
export const MIDDLE_STRUCT_BINDINGS = [
    // t1211 — PROBE ORDER: which axis probes FIRST. Corner's exact wording/pattern (cornerData 'Probe Order'), driving a
    // 2-way guard fork in middleStack's superset. Structural (no value socket) → it belongs here, not in the value specs.
    { param: 'axisOrder', type: 'enum', default: MIDDLE_DEFAULTS.axisOrder, label: 'Probe Order', help: 'Which axis to probe first — Y then X, or X then Y.', section: 'IDENTITY', widgetConfig: { options: [['Y then X', 'YX'], ['X then Y', 'XY']] } },
    // t1237 — THE DIRECTIONS, mirroring the built-in form's own wording + show-when (m_dir / m_dir2). They are
    // op-DEFINING (which wall face each probe approaches), so they sit with the order at the top of the form.
    { param: 'dir1', type: 'enum', default: MIDDLE_DEFAULTS.dir1, label: '1st Axis Dir', help: 'Probe direction for the first axis. The opposite wall is probed automatically. First edge → #51, second → #52, center → #53.', section: 'IDENTITY', widgetConfig: { options: [['pos', 'pos'], ['neg', 'neg']] } },
    // shown only under Find Both, exactly like the built-in's m_dir2_block; its default is the OPPOSITE of dir1 (the
    // resolver's own rule — middleAxes derives it that way when nothing is stored).
    { param: 'dir2', type: 'enum', default: MIDDLE_DEFAULTS.dir2, when: { param: 'twoAxis', is: true }, label: '2nd Axis Dir', help: 'Probe direction for the second axis (Find Both). Its opposite wall is probed automatically. Edges → #54 and #55, center → #56.', section: 'IDENTITY', widgetConfig: { options: [['pos', 'pos'], ['neg', 'neg']] } },
    { param: 'featureType', type: 'enum', default: MIDDLE_DEFAULTS.featureType, label: 'Feature', help: 'Pocket (find the centre from INSIDE two walls) or Boss (find the centre from OUTSIDE, crossing over the part).', section: 'IDENTITY', widgetConfig: { options: [['Pocket', 'pocket'], ['Boss', 'boss']] } },
    { param: 'inAxis', type: 'enum', widget: 'segmented', default: MIDDLE_DEFAULTS.inAxis, label: 'In-Axis Travel', help: 'Boss: how to reach wall 2 within an axis — Auto crosses over hands-free (the cross-over distance), Manual pauses for you to jog around.', section: 'GEOMETRY', widgetConfig: { options: [['Manual', 'manual'], ['Auto', 'auto']] } },
    { param: 'transAxis', type: 'enum', widget: 'segmented', default: MIDDLE_DEFAULTS.transAxis, label: 'Trans-Axis Travel', help: 'Boss two-axis: how to reach the perpendicular walls — Auto crosses hands-free, Manual pauses for you to jog.', section: 'GEOMETRY', widgetConfig: { options: [['Manual', 'manual'], ['Auto', 'auto']] } },
    // t383 (human) — the TRANS-axis AUTO route SHAPE: Dogleg (default) routes AROUND the boss (secondary out first, then re-centre); Diagonal is one straight move.
    { param: 'travelShape', type: 'enum', widget: 'segmented', default: MIDDLE_DEFAULTS.travelShape, label: 'Trans Route', help: 'Boss two-axis auto: how the tool crosses from the first-axis walls to the perpendicular walls — Dogleg routes AROUND the boss (two axis moves, never diagonally over the corner), Diagonal is one straight move (faster, relies on clearing the boss).', section: 'GEOMETRY', widgetConfig: { options: [['Dogleg', 'dogleg'], ['Diagonal', 'diagonal']] } },
    { param: 'twoAxis', type: 'bool', default: !!MIDDLE_DEFAULTS.twoAxis, label: 'Find Both Axes', help: 'Also probe the perpendicular axis and set both X and Y — a full centre-find instead of a single axis.', section: 'GEOMETRY' },
    { param: 'circular', type: 'bool', default: !!MIDDLE_DEFAULTS.circular, label: 'Circular', help: 'Round bore/boss: also report the diameter (the opposite-touch span) and re-centre between axes so the touches cross the true diameter.', section: 'GEOMETRY' },
    { param: 'probeZ', type: 'bool', default: !!MIDDLE_DEFAULTS.probeZ, label: 'Probe Z First', help: 'Probe the top surface for Z before the centre-finding — anchors the sideways probes to a real measured Z instead of a jogged guess.', section: 'GEOMETRY' },
    { param: 'wcs', type: 'enum', default: MIDDLE_DEFAULTS.wcs, label: 'WCS', help: 'Which work-coordinate register to store the found centre into — Active uses the currently-selected WCS; G54..G59 write that specific register.', section: 'GEOMETRY', widgetConfig: { options: [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']] } },
    { param: 'syncA', type: 'bool', default: !!MIDDLE_DEFAULTS.syncA, label: 'Dual-Gantry Sync A', help: 'Dual-gantry: also write the found centre to the slave A-axis WCS, keeping a twin-motor gantry squared. A WCS write only — no extra motion.', section: 'GEOMETRY' },
];

export const MIDDLE_DATA_OPTYPE = 'user_middle_data';

/** The wrapped `user_root` template for a param set. The superset (middleStack {superset:true}) carries every structural
 *  arm guarded; instantiate() prunes to the concrete shape. Byte-transparent wrap (user_root emits its children in order). */
export function middleDataStack(params = MIDDLE_DEFAULTS) {
    const exec = middleStack(params, { superset: true });
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: false, machine: false, magazine: false, probeWcs: true } },   // t714 — middle is a PART-frame probe (no forceMachine); machine:true was latent-dead (see cornerData/opSimContext)
            { type: 'param_group', params: { group: 'Middle' }, children: [] },
        ],
        children: exec,
    }];
}

/** Bindings for the value sockets — DERIVED (not hand-counted) over a CANONICAL-pruned stack that makes ALL bound sockets
 *  present exactly once: boss + inAxis-auto (→ #19/#20) + transAxis-auto + twoAxis (→ #21/#22). EMIT re-derives BY IDENTITY
 *  over the actual PRUNED stack each build (via def.bindingSpecs), so the frozen indices below never desync. */
const CANONICAL_BIND = { ...MIDDLE_DEFAULTS, axisOrder: 'XY', dir1: 'pos', dir2: 'neg', featureType: 'boss', inAxis: 'auto', transAxis: 'auto', twoAxis: true };   // t1237 — pin the DIRECTION arms too (order × dir1 × dir2 duplicates every bound socket 8×; the derive must see exactly one)   // t1211 — PIN the order too: the fork duplicates every bound socket per arm, so the derive must see ONE arm (mirrors cornerData pinning corner/probeSeq)
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(middleDataStack(MIDDLE_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const MIDDLE_BINDINGS = deriveBindingsFor(canonicalPrunedStack(), MIDDLE_BINDING_SPECS);

/** E2 — the per-pass PREVIEW-START provider, PORTING BUILT_IN.middle (opSimStarts.js) into a declared provider on the twin.
 *  Middle's pass count is VARIABLE (1→5) with COMPOUND gates (boss ∧ inAxisManual ∧ twoAxis) + OPPOSITE-dir walls (!dir1) —
 *  which makeProvider's single-{param,is} `when` + @dir1 token can't express directly. So this wraps makeProvider (reusing its
 *  `rowToStart` anchor geometry — the ONE source, so a boss wall is the SAME edge/@outset math the built-in uses) with:
 *   (a) DERIVED gate params (_pocket/_boss/_primW2/_sec/_secW2), computed from the SAME boss/twoAxis/inAxisManual derivations
 *       BUILT_IN.middle uses (incl the legacy approach/findBoth aliases) → the pass STRUCTURE is byte-faithful; and
 *   (b) RESOLVED side strings (dir1 / opp(dir1) / dir2 / opp(dir2)) — the edge anchor reads 'pos'→−outset / 'neg'→+outset,
 *       exactly BUILT_IN.middle's outside(ax, plus). The Z-first lead + the pocket centre are 'centre' rows (top / probe plane).
 *  Result: byte-faithful to BUILT_IN.middle POSITIONS + COUNT (proven vs opSimStarts('middle') in middle-data-emit.spec). The
 *  count MUST mirror the macro's reposition() calls (length == 1 + the 'REPOSITION:' comment count). SIM-only (emit untouched).
 *  (The reconcile noted E2 could read featureSize instead — a later slice; the port keeps the built-in positions.) */
export function middleSimStartsProvider(params, stock) {
    const p = params || {};
    const boss = (p.featureType || 'pocket') === 'boss';
    const twoAxis = !!p.twoAxis || !!p.findBoth;
    const inAxisManual = (p.inAxis || p.approach) === 'manual';
    // t1211 — the ONE order source, shared with the emit. Before this the twin's provider read p.axis LIVE while the
    // twin's EMIT ignored it, so changing the axis moved the preview markers but not one byte of G-code; both now
    // resolve through middleAxes, so the markers and the program can only move together.
    const { fA: axis, sA: second, dir1, dir2 } = middleAxes(p);
    const opp = (d) => (d === 'pos' ? 'neg' : 'pos');
    // ONE row per potential pass; the DERIVED `when` gate = the exact BUILT_IN.middle pass structure (order preserved).
    const rows = [
        { anchor: 'centre', plane: 'top',   when: { param: '_zlead',  is: true } },   // probe-Z-first: the leading Z-surface pass (over the top, probe down)
        { anchor: 'centre', plane: 'probe', when: { param: '_pocket', is: true } },    // pocket: one centre pass
        { anchor: 'edge', axis, side: dir1,       out: '@outset', plane: 'probe', when: { param: '_boss',   is: true } },   // boss primary wall 1
        { anchor: 'edge', axis, side: opp(dir1),  out: '@outset', plane: 'probe', when: { param: '_primW2', is: true } },   // boss primary wall 2 (in-axis manual → its own pass)
        { anchor: 'edge', axis: second, side: dir2,      out: '@outset', plane: 'probe', when: { param: '_sec',   is: true } },   // boss two-axis secondary wall 1
        { anchor: 'edge', axis: second, side: opp(dir2), out: '@outset', plane: 'probe', when: { param: '_secW2', is: true } },   // boss two-axis secondary wall 2 (in-axis manual)
    ];
    const gated = { ...p, _zlead: !!p.probeZ, _pocket: !boss, _boss: boss, _primW2: boss && inAxisManual, _sec: boss && twoAxis, _secW2: boss && twoAxis && inAxisManual };
    const passes = makeProvider(rows)(gated, stock);
    // t963 B1 — the AUTO trans-traverse's secondary marker (the LAST pass when !inAxisManual) LANDS at the declared #21/#22
    // point, not edge+outset (mirror BUILT_IN.middle). Preserve the pass's emits/source fields; sim-only, emit untouched.
    if (boss && twoAxis && !inAxisManual && ((p.transAxis || 'auto') === 'auto') && passes.length) {
        const i = passes.length - 1;
        passes[i] = { ...passes[i], ...middleReposLanding(p, stock) };
    }
    return passes;
}

/** Build the middle-as-data def — same userOpFromStack pattern as corner/edge/drill/slot, PLUS `bindingSpecs` (instantiate
 *  re-derives the value sockets by identity over the pruned superset) + the 8 structural toggles + the E2 sim-starts provider.
 *  NO postInstantiate: the built-in middle bakes no scalar-interpolated comment text (no header recompose needed) and does NOT
 *  source #5/#3/#2 (no source-chips — a hook here would DIVERGE on an Expert profile; see the header NOTE) → byte-identical on ALL profiles. */
export function middleDataDef() {
    // t1213 (USER RULING — [[op-defining-fields-at-top]]): the op-DEFINING fields come FIRST. Probe Order / Feature /
    // travel mode are what the op IS; the scalars (probe distance, feeds, retract) are how it is tuned. The form renders
    // in BINDING ORDER and buckets by `section`, so putting the STRUCT rows first makes GEOMETRY render above TOOL & CUT —
    // identity → geometry → tool/cut. Declared ordering only: no per-wizard CSS, and the emit is untouched (bindings drive
    // the FORM; the value-socket derivation reads MIDDLE_BINDING_SPECS, which is unchanged).
    const bindings = [...MIDDLE_STRUCT_BINDINGS, ...MIDDLE_BINDINGS];
    const def = userOpFromStack('middle_data', 'Middle (data)', middleDataStack(MIDDLE_DEFAULTS), bindings, 'form3d+2d', { forceMachine: true });
    def.bindingSpecs = MIDDLE_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY over the PRUNED stack every build
    // t1211 — fill in `axisOrder` for the guard when an op stored only the legacy `axis` (middleAxes normalises), so a
    // pre-existing saved op still prunes to exactly one order arm instead of losing both.
    // t1211/t1237 — fill the guard params the FORK reads from the ONE resolver, so a stored op that predates them (or
    // one that simply never set dir2, whose default is DERIVED) still matches an arm: whenOk is a strict === and an
    // absent key would prune every arm away.
    def.deriveGuards = (p) => { const a = middleAxes(p || {}); return { axisOrder: a.order, dir1: a.dir1, dir2: a.dir2 }; };
    def.simStartsProvider = middleSimStartsProvider;   // E2 — the per-pass preview markers, byte-faithful to BUILT_IN.middle (sim-only)
    // t1722 (gate repair, cycle 857 ACT 2) — THE STOCK-SHAPE PREVIEW, DECLARED NON-MUTATINGLY. The legacy built-in view's
    // syncStockShape (middleView.js) mutated + PERSISTED the global settings.stock.shape so the 3D preview matched
    // Feature/Circular — a preview writing user state is a defect on its own terms, and it left the twin with no
    // equivalent at all (Feature=Boss+Circular showed whatever the global stock happened to be, not a round bar/boss).
    // Mirrors rotaryCenterData.js's def.simStock exactly (registered the same way, read the same way by userOpView.js →
    // mgr.preview3D): DERIVE the shape from the op's OWN declared params, return a NEW object, touch nothing global.
    // Sim-only → emit byte-identical.
    def.simStock = (params, stock) => {
        const p = params || {};
        const want = p.circular ? 'cylinder' : ((p.featureType || MIDDLE_DEFAULTS.featureType) === 'boss' ? 'boss' : 'pocket');
        return { ...(stock || {}), shape: want };
    };
    return def;
}
