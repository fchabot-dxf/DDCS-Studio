/**
 * blocks/dataOps/drillData.js — the DRILL built-in expressed as a pure DATA definition (ROADMAP Stage 4 + 5).
 *
 * The endgame (wizards-as-data): every built-in becomes a { template, bindings } def — open, fork, override,
 * reset-to-factory — exactly like a user op. This is the FIRST port: drill, expressed as data and PROVEN to emit
 * byte-identical G-code to the hand-coded drillStack across a param sweep (tests/drill-as-data.spec.js, via
 * dataOps/equivalence.js). It registers through the SAME federated user layer a wizard-maker op uses
 * (registerUserOp → builderOf), so it inherits the live block↔form round-trip for free.
 *
 * WHY DRILL IS ~90% DATA-EXPRESSIBLE: the per-hole loop + pattern geometry do NOT live in the stack — they live in
 * the emit fold (the `array` container atom stamps its single child at patternPoints(p)). So drillStack is a STATIC
 * 4-block tree [progstart, wcs, placeonstock{ array{ drill } }, progend] whose every variation is a SCALAR in a
 * fixed socket — precisely what a {template, bindings} def + instantiate() substitute. Pattern variety (grid /
 * circle / line / rect) is just the `pattern` enum + numbers, NOT a shape change.
 *
 * ✅ FRONTIER #2 (live bbox) — SOLVED in Stage 5 (the north-star fix). makePlace USED to bake
 * pointsBBox(patternPoints(params)) into the placeonstock snapshot, frozen at author time — so any moved/reshaped
 * pattern placed wrong (the snapshot was a DUPLICATE of derivable geometry → principle #4 "duplication is the enemy").
 * Now the geometry atom declares its own extent (drill/bore = a point; `array` = pattern-points ⊕ child extent) and
 * the place fold recomputes the bbox LIVE from params (blockEmitter.liveExtent → placeShiftFromParams override). So
 * the placement tracks the pattern (ONE source of truth, declared not inferred-from-motion), and this def is now FULLY
 * placement-portable: x0/y0 offsets, circle/line/rect shapes, AND stock-attach all emit byte-identical to drillStack.
 *
 * ✅ FRONTIER #3 (clearance fan-out) — SOLVED in t2293 (closing t2291's own wiring-gap gate). `clearance` binds the
 * holecycle leaf normally (matching depth/peck/feed); a `postInstantiate` hook copies the SAME resolved value onto the
 * framing progstart's own copy — the identical pattern pocketData.js already used for its own derived-socket rewrites
 * ("one source, no fan-out bindings"), not a new mechanism. `deriveBindings`/`instantiate` still write ONE
 * (blockIndex,key) per binding row; the fan-out is closed by postInstantiate, not by teaching that a second row.
 *
 * ✅ "METHOD SWAP" — CLOSED, t2297, and it was never actually an unsolved frontier: t1385 (already landed when this
 * comment was FIRST written, but not accounted for here until now) collapsed `array{drill|bore}` into ONE `holecycle`
 * block — there is no `bore` child block TYPE anywhere in this pipeline any more (confirmed: zero hits repo-wide for
 * a 'bore' block type). `cycle` (peck / bore-step / bore-helix) is a plain STRING PARAM on that ONE block, exactly
 * like `pattern` already is — internally branching the emit (holeCycleLines), never the model shape. So there was
 * never a block-type fork for a guard/pruneGuards mechanism (corner's probeZFirst/corner×probeSeq pattern) to close.
 *
 * AND the deeper reason `method` is correctly left unbound HERE is not a mechanism gap at all: `drillView.js`'s own
 * `applyVariant()` — called on EVERY wizard open, per `wizardManager.js`'s own comment "the menu choice fixes the
 * identity" — ALWAYS hides the method selector, in every mode (new-drill, new-bore, or edit). The shell never shows
 * this field to a human; Drill and Bore are two permanently identity-locked menu entries, not one form with a live
 * toggle. Mirroring that BY DESIGN, not by omission, drill and bore are two separate twins here — `DRILL_DATA_OPTYPE`
 * baked at method='peck', `BORE_DATA_OPTYPE` (boreData.js) baked at method='helical' — and `boreData.js` ALREADY
 * binds `holeDia`/`toolDia`/`pitch`/`ramp` completely on its own side (`ramp`'s own binding maps straight into the
 * SAME `cycle` socket via `cycleForMethod('helical', ramp)`, since method is fixed there too). Those three fields
 * were correctly left off THIS twin (t2293) because they are bore-only concepts that already have a home — not
 * because drill's twin is missing them. Binding a live `method` toggle here would ADD an ability the shipped wizard
 * deliberately never had, the exact "feature, not a reproduction" line t2293's own Step 1 discipline exists to catch.
 *
 * Scope note: the template is SEEDED from drillStack(DRILL_DEFAULTS) (== "BUILDERS(defaults)", the canonical
 * valid-by-construction template). The INDEPENDENT artifact under test is the hand-authored BINDINGS map below, proven
 * TWO ways by the spec:
 *   • EMIT-EQUIVALENCE — byte-identical to drillStack across a sweep that now spans off-origin x0/y0, circle/line/rect
 *     shapes, stock-attach placement, cut params, skip + wcs (frontier #2 solved → the bbox tracks the pattern live).
 *   • WIRING (structural, all bindings) — set one param to a sentinel and assert BOTH instantiate AND drillStack land
 *     it in the binding's (blockIndex,key); a wrong/dropped/swapped key fails. Belt-and-suspenders alongside the emit
 *     sweep (it also covers `method`, permanently baked rather than a socket to wire).
 * Stage 6 authors the template independently too (then the builder can be deleted); that's the self-host step, not this one.
 */
import { drillStack } from '../../wizards/stacks/drillWizard.js';
import { patternPoints } from '../../wizards/drillWizard.js';   // patternPoints itself is a pass-through re-export (defined in ops/index.js), not a moved builder — stays at the old path
import { skipSet } from '../../wizards/ops/holecycle.js';   // t2042 — the SAME declared skip parse the real emit's IF/GOTO gates on
import { pointsBBox } from '../../wizards/ops/placement.js';   // t718 — the hole-CENTRES bbox for the placement-parity shift
import { userOpFromStack, flattenBlocks } from '../userOps.js';   // t2293 — flattenBlocks for the postInstantiate clearance fan-out copy
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor, deriveBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity; t1385 — the WHOLE map is by identity now (positional cannot survive the holecycle collapse)
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, DRILL_PATTERN_OPTIONS } from './wizardOptions.js';   // t720 P1 — SHARED enum options (were undeclared → empty dropdowns)

/** The author defaults — match drillStack's own num() fallbacks so the seeded template == the true default stack. */
export const DRILL_DEFAULTS = {
    pattern: 'single', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20,   // t848 — default = single hole (matches drillWizard's fallback: the twin-default rule)
    count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, w: 100, h: 80, nx: 2, ny: 2, skip: '',
    depth: 5, peck: 5, feed: 100, clearance: 5, wcs: 'active', method: 'peck',
    // placement (makePlace) — now bindable: the placeOnStock bbox snapshot is computed LIVE from the pattern at emit
    // (array.extent → place fold), so binding the placement scalars + a moved/attached pattern stays correct.
    stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, originX: 0, originY: 0, offZ: 0,
};

/**
 * The binding map: each drill param → the socket it drives, named BY IDENTITY (t1385).
 *
 * ── WHY THESE STOPPED BEING POSITIONAL ────────────────────────────────────────────────────────────────────────────
 * Until t1385 every row carried a hand-counted `blockIndex` into the flattened template, plus a `WRAP_PREFIX_COUNT`
 * offset for the four presentation blocks. That worked only because the flatten's shape was frozen — and the drill
 * switch breaks exactly that: re-pointing through `holecycle` MERGES the `array` container and its `drill` leaf into
 * ONE block, so the two indices those rows point at (the 15-row pattern/geometry cluster and the cut params) collapse
 * into one and every index after them shifts. A positional map cannot survive a 2-into-1 collapse; an identity map
 * does not notice it.
 *
 * So `match: {type}` names the target and `deriveBindings` re-finds its flat index by scanning. That is not a new
 * mechanism — it is the dataOps norm this twin had simply never been migrated to: `surfacingData` uses it 14x and is
 * the op that ALREADY survived this same switch, `centerDrillData` derives at module level exactly as below, and
 * `assign`-targeting specs use it 107x. Deriving over the ALREADY-WRAPPED stack is also what makes the old
 * `WRAP_PREFIX_COUNT` hand-count disappear rather than move.
 *
 * The CONVERSION'S OWN TEST is that nothing moved: every derived (param, key, blockIndex, default) equals what the
 * positional map produced, and both twins' emit is byte-identical — see tests/drill-bindings-identity-1385.spec.js.
 *
 * THE FLATTEN, for reading (no row depends on these numbers any more):
 *   0 user_root · 1 panel · 2 sim · 3 param_group · 4 progstart · 5 wcs · 6 placeonstock · 7 array · 8 drill ·
 *   9 progend · 10 entry · 11 toolsel
 * (clearance is deliberately NOT bound — frontier #3; method is NOT bound — frontier #1. The placeonstock bbox
 *  snapshot is NO LONGER a frontier — the place fold recomputes it LIVE from the array's params, so placement is
 *  fully bindable; only the 4 bbox-snapshot keys (bminX..) stay vestigial/ignored.)
 */
// t1758 — MACHINE VARIABLES ROLL OUT, mill family. `instantiate()` writes each binding's raw value straight into
// the already-built template's block (userOps.js), bypassing drillStack's own num() calls entirely — so eligibility
// hinges on what `holecycle.js` (the atom every bound value reaches) does with the value, not on drillStack's own
// defaulting. depth/peck/feed are the one shape not seen on any other mill op yet: holecycle.js has an EXPLICIT
// live-token seam (`liveWord()`) built for exactly this (t1389) — a `#`/`[` string passes through verbatim into a
// register seed the RUNTIME loop reads, never JS-branched.
export const DRILL_BINDING_SPECS = [
    { param: 'wcs', tokenEligible: true, match: { type: 'wcs' }, key: 'wcs', type: 'enum', default: DRILL_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS } },
    // placement scalars (the placeonstock C-block) — correct because the bbox tracks the pattern live (array.extent)
    // stockAttach/pathDatum/stockDatum: the SAME placementShift datum lookup surfacing/pocket/contour already
    // declare eligible (a raw string picking which of 3 fixed-corner FORMULAS computes one shift — never a
    // different atom/line count) — not the corner-probe's own `corner` field (which reorders which walls the
    // machine touches, a genuinely different "corner" semantic); consistent with the already-shipped precedent.
    { param: 'stockAttach', tokenEligible: true, match: { type: 'placeonstock' }, key: 'stockAttach', type: 'enum', default: DRILL_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'pathDatum', tokenEligible: true, match: { type: 'placeonstock' }, key: 'pathDatum', type: 'enum', default: DRILL_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'stockDatum', tokenEligible: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockDatum', type: 'enum', default: DRILL_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS } },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockW', type: 'number', default: DRILL_DEFAULTS.stockW },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockH', type: 'number', default: DRILL_DEFAULTS.stockH },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockZ', type: 'number', default: DRILL_DEFAULTS.stockZ },
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offX', type: 'number', default: DRILL_DEFAULTS.originX },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offY', type: 'number', default: DRILL_DEFAULTS.originY },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offZ', type: 'number', default: DRILL_DEFAULTS.offZ, label: 'Z offset', units: 'mm', section: 'GEOMETRY', help: 'Shift the whole pattern up or down in Z from the datum.' },
    // pattern + geometry (the `array` container — patternPoints reads these scalars at emit). THIS CLUSTER AND THE CUT
    // PARAMS BELOW are the two the drill switch merges into one `holecycle` block, which is why they are matched by type.
    // pattern: picks between 5 structurally different point-generation/register-usage formulas (holecycle.js's
    // patternLines) AND fixes the baked hole COUNT (array.js's patternPoints) — the pocket-shape class, categorical.
    { param: 'pattern', tokenRefusal: 'Picks between structurally different hole-pattern formulas and fixes how many holes get built — the program\'s SHAPE depends on this, not a value inside one.', match: { type: 'holecycle' }, key: 'pattern', type: 'enum', default: DRILL_DEFAULTS.pattern, widget: 'dropdown', widgetConfig: { options: DRILL_PATTERN_OPTIONS } },
    { param: 'x0', tokenRefusal: 'This position is baked directly into every hole\'s move coordinate before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'x0', type: 'number', default: DRILL_DEFAULTS.x0, label: 'Pattern origin X', units: 'mm', section: 'GEOMETRY', help: 'The pattern local X origin (usually 0 — the Origin X placement positions it on the stock).' },
    { param: 'y0', tokenRefusal: 'This position is baked directly into every hole\'s move coordinate before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'y0', type: 'number', default: DRILL_DEFAULTS.y0, label: 'Pattern origin Y', units: 'mm', section: 'GEOMETRY', help: 'The pattern local Y origin (usually 0 — the Origin Y placement positions it on the stock).' },
    // t722 P2a — per-PATTERN field visibility (map the real fields): grid → cols/rows/dx/dy · circle → dia/startAngle/count ·
    // line → spacing/angle/count · rect → w/h/nx/ny (`count` is shared by circle + line). + labels (were cryptic param names).
    // cols/rows/count/nx/ny: each is a real hole-COUNT / loop-bound baked into the WHILE loop's trip count — never
    // deferrable (a controller can't retroactively resize an already-generated program).
    { param: 'cols', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'cols', type: 'number', default: DRILL_DEFAULTS.cols, when: { param: 'pattern', is: 'grid' }, label: 'Columns', section: 'GEOMETRY' },
    { param: 'rows', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'rows', type: 'number', default: DRILL_DEFAULTS.rows, when: { param: 'pattern', is: 'grid' }, label: 'Rows', section: 'GEOMETRY' },
    { param: 'dx', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'dx', type: 'number', default: DRILL_DEFAULTS.dx, when: { param: 'pattern', is: 'grid' }, label: 'X pitch', section: 'GEOMETRY' },
    { param: 'dy', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'dy', type: 'number', default: DRILL_DEFAULTS.dy, when: { param: 'pattern', is: 'grid' }, label: 'Y pitch', section: 'GEOMETRY' },
    { param: 'count', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time, and — for the bolt circle — the step angle between holes) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'count', type: 'number', default: DRILL_DEFAULTS.count, when: { param: 'pattern', in: ['circle', 'line'] }, label: 'Count', section: 'GEOMETRY' },
    { param: 'spacing', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'spacing', type: 'number', default: DRILL_DEFAULTS.spacing, when: { param: 'pattern', is: 'line' }, label: 'Spacing', section: 'GEOMETRY' },
    // angle/startAngle: a real Math.cos/Math.sin call bakes the direction vector — the controller has no trig, so
    // this can never move downstream (the same "DDCS macro language has no cosine" class as lathe polygon.js).
    { param: 'angle', tokenRefusal: 'A trig calculation (the controller has no cosine/sine) bakes the line direction from this angle before the program is built — it can\'t be resolved at that point.', match: { type: 'holecycle' }, key: 'angle', type: 'number', default: DRILL_DEFAULTS.angle, when: { param: 'pattern', is: 'line' }, label: 'Angle°', section: 'GEOMETRY' },
    { param: 'dia', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, help: "Bolt-circle diameter — holes sit evenly on this circle.", match: { type: 'holecycle' }, key: 'dia', type: 'number', units: 'mm', default: DRILL_DEFAULTS.dia, when: { param: 'pattern', is: 'circle' }, label: 'Circle Ø', section: 'GEOMETRY' },
    { param: 'startAngle', tokenRefusal: 'A trig calculation (the controller has no cosine/sine) bakes the bolt-circle\'s starting position from this angle before the program is built — it can\'t be resolved at that point.', match: { type: 'holecycle' }, key: 'startAngle', type: 'number', default: DRILL_DEFAULTS.startAngle, when: { param: 'pattern', is: 'circle' }, label: 'Start angle°', section: 'GEOMETRY' },
    { param: 'w', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'w', type: 'number', units: 'mm', default: DRILL_DEFAULTS.w, when: { param: 'pattern', is: 'rect' }, label: 'Width', section: 'GEOMETRY' },
    { param: 'h', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'h', type: 'number', units: 'mm', default: DRILL_DEFAULTS.h, when: { param: 'pattern', is: 'rect' }, label: 'Height', section: 'GEOMETRY' },
    { param: 'nx', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time, and a per-hole branch threshold) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'nx', type: 'number', default: DRILL_DEFAULTS.nx, when: { param: 'pattern', is: 'rect' }, label: 'X count', section: 'GEOMETRY' },
    { param: 'ny', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'ny', type: 'number', default: DRILL_DEFAULTS.ny, when: { param: 'pattern', is: 'rect' }, label: 'Y count', section: 'GEOMETRY' },
    // skip: parsed into a set at build time; its SIZE decides how many skip-guard lines (and whether the skip label
    // itself) exist — a count/branch decision on a string, no numeric "resolved value" a token could even represent.
    { param: 'skip', tokenRefusal: 'Decides how many skip-guard lines (and whether the skip label) get built into the program — a build-time count decision, not a value inside one.', help: "1-based hole numbers to omit (as shown in the preview), e.g. 5, 9.", match: { type: 'holecycle' }, key: 'skip', type: 'string', default: DRILL_DEFAULTS.skip },
    // cut params (the peck `drill` leaf) — depth/peck ride holecycle.js's declared live-token seam (liveWord()), and
    // feed rides the shared val() pass-through — all genuinely eligible, not just "no branch found".
    { param: 'depth', tokenEligible: true, match: { type: 'holecycle' }, key: 'depth', type: 'number', units: 'mm', default: DRILL_DEFAULTS.depth },
    { param: 'peck', tokenEligible: true, help: "Peck increment (mm) — full retract to clearance each peck to clear chips.", match: { type: 'holecycle' }, key: 'peck', type: 'number', default: DRILL_DEFAULTS.peck },
    // t2293 (BACKLOG arc, closing the wiring gap t2291's own gate found) — holeDia: the shell exposes it
    // unconditionally (drillView.js's own HOLE Ø field, shown for BOTH peck and bore) and it is NOT
    // method-entangled the way toolDia/pitch/ramp are (peck mode genuinely uses it — it's the drill bit size —
    // unlike the bore-only trio, which the shell only shows once method=helical, itself unbound and out of
    // scope this turn). tokenRefusal, not tokenEligible: holeCycleLines' own tool-fit refusal
    // (holeCycleToolRefusal, holecycle.js:401) reads holeDia as a plain JS number at BUILD time, on every
    // cycle including peck (t1444's own ruling extended the check universally) — a `#var` token here would
    // reach that comparison as NaN, not a real value. NO explicit `default`: DRILL_DEFAULTS never declared
    // one, so the binding inherits the socket's own BAKED value (12, drillWizard.js's own `num(params.holeDia,
    // 12)` fallback) rather than the shell's DIFFERENT hardcoded default (6) — binding must not also silently
    // change what a default-valued op emits; that pre-existing 6-vs-12 divergence between the shell and the
    // wizard-stack builder is real but predates this turn and is out of scope to fix here.
    { param: 'holeDia', tokenRefusal: 'Feeds the build-time tool-fit refusal (a hole narrower than its tool refuses, on every cycle) — a categorical decision about whether the program builds at all, not a value inside one.', match: { type: 'holecycle' }, key: 'holeDia', type: 'number', units: 'mm', label: 'Hole Ø', help: "Hole diameter. Peck: this is your drill size. Bore: target hole size (must be ≥ tool Ø)." },
    { param: 'feed', tokenEligible: true, match: { type: 'holecycle' }, key: 'feed', type: 'number', units: 'mm/min', default: DRILL_DEFAULTS.feed },
    // t2293 — clearance: the shell exposes it unconditionally (DEPTH & FEED's own CLEARANCE Z), not
    // method-entangled — but it is a genuine FAN-OUT (drillWizard.js's own drillStack sets it on BOTH the
    // framing progstart, via programFraming.js's makeStart, AND the holecycle leaf itself — confirmed by
    // reading both, not assumed from the param name). `deriveBindings`/`instantiate` write ONE (blockIndex,key)
    // per binding row, so this binds the holecycle leaf's own copy the ordinary way (matching depth/peck/feed
    // above) and the progstart copy is kept in sync via `drillDataDef`'s own postInstantiate below — the SAME
    // established pattern pocketData.js already uses for its own frozen-superset "derived socket" rewrites
    // (pocketData.js:426-452's own comment: "one source, no fan-out bindings"), not a new mechanism invented
    // for this turn. `DRILL_DEFAULTS.clearance` (5) already matches both the shell's own default and
    // drillStack's own `num(params.clearance, 5)` fallback — no discrepancy to preserve here.
    { param: 'clearance', tokenEligible: true, match: { type: 'holecycle' }, key: 'clearance', type: 'number', units: 'mm', default: DRILL_DEFAULTS.clearance, label: 'Clearance Z' },
    { param: 'rpm', tokenRefusal: 'Falls back to the tool library\'s RPM when left blank — that fallback decision runs before the program is built.', tokenDeferrable: true, match: { type: 'progstart' }, key: 'rpm', type: 'number', socketHeld: true, label: 'Spindle RPM', help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },   // t996 — rpm → progstart
];

/** The WRAPPED template — factored out of `drillDataDef` (t1385) so the binding derivation below and the def itself read
 *  the SAME stack. Without that they could disagree, which is the whole failure mode identity bindings exist to prevent.
 *  Mirrors `centerDrillData`'s `cdrillDataStack`. */
function drillDataStack(p = DRILL_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // t716 — the FeatureCanvas 2D with the hole pattern + pos + pattern-size handles (previewGeometry)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Drill' }, children: [] },
        ],
        children: appendToolSel(appendEntry(drillStack(p))),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing)
    }];
}

// The old `WRAP_PREFIX_COUNT = 4` offset is GONE, not moved: deriving over the already-wrapped stack finds the four
// presentation blocks by scanning, so the hand-count that used to encode them has nothing left to encode.
export const DRILL_BINDINGS = deriveBindingsFor(drillDataStack(DRILL_DEFAULTS), DRILL_BINDING_SPECS);

// t867 — FEEDS & SPEEDS: the material picker + advisory "Suggest feed" button (the feedsuggest composite widget). A
// bindingless binding (no socket) next to Feed — drives NO G-code, so unset = byte-identical; a picked material round-
// trips like a dropdown. Drill has no tool-Ø field, so the helper reads the diameter from the selected tool row.
const MATERIAL_BINDING = { param: 'material', type: 'enum', default: '', widget: 'feedsuggest', label: 'Material', help: 'Feeds & speeds helper: pick the stock material, then ✨ Suggest fills Feed from the selected tool’s Ø / flutes and the declared spindle (RPM = surface speed ÷ circumference, clamped to the spindle range; feed = RPM × flutes × chip load). Advisory — it never overwrites until you click, and you own the final numbers.' };

export const DRILL_DATA_OPTYPE = 'user_drill_data';

const _dn = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
const _holeRing = (cx, cy, r) => { const pts = []; for (let i = 0; i <= 12; i++) { const a = 2 * Math.PI * i / 12; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); } return { pts, cls: 'fc-guide' }; };
/** t716 — DECLARED preview geometry for the DRILL/BORE pattern family: the hole positions (patternPoints) drawn as rings +
 *  a pos handle (originX/originY) + the pattern SIZE handle PER KIND (grid dx/dy · circle Ø/angle · line pitch/angle · rect
 *  W/H). Bore (boreDia=true) ALSO gets a draggable hole-DIAMETER handle (holeDia). Mirrors drillView.buildDrillSpec; handles
 *  write the TWIN params directly (preview-side → emit unaffected). SHARED by drillData + boreData (bore imports it). */
import { handleScale } from '../../wizards/ops/placement.js';

export function drillPatternGeometry(p, boreDia) {
    const pattern = p.pattern || 'single';   // t848 — the view fallback tracks the default (twin-default rule)
    const ox = _dn(p.originX, 0), oy = _dn(p.originY, 0);
    const holeR = boreDia ? Math.max(0.5, _dn(p.holeDia, 12) / 2) : 3;   // bore = the real bore Ø; drill = a small display dot
    const pts = patternPoints({ ...p, cx: ox, cy: oy, x0: ox, y0: oy }) || [];   // patternPoints reads cx/cy or x0/y0 per pattern
    // t2042 — a skipped hole (the SAME declared skipSet the real emit's IF/GOTO gates on, 1-based like the emit's
    // own hole index) is OMITTED here, not drawn: the machine never cuts it, so a ring at that point was a phantom
    // — a hole the picture promised and the program refused. Not the drillView-style strikethrough (that convention
    // is item/kind:'hole'-shaped, this preview draws hole-rings as paths — a different, pre-existing primitive;
    // adopting the DECLARED skip rule doesn't require also adopting that rendering shape).
    const skip = skipSet(p);
    const paths = pts.map((pt, i) => (skip.has(i + 1) ? null : _holeRing(pt.x, pt.y, holeR))).filter(Boolean);
    
    // Calculate effective width/height for handleScale based on pattern
    let w = 0, h = 0;
    if (pattern === 'grid') { w = (Math.max(1, Math.round(_dn(p.cols, 3))) - 1) * _dn(p.dx, 20); h = (Math.max(1, Math.round(_dn(p.rows, 2))) - 1) * _dn(p.dy, 20); }
    else if (pattern === 'rect') { w = _dn(p.w, 100); h = _dn(p.h, 80); }
    else if (pattern === 'circle') { w = _dn(p.dia, 50); h = _dn(p.dia, 50); }
    else if (pattern === 'line') { w = (Math.max(1, Math.round(_dn(p.count, 3))) - 1) * _dn(p.spacing, 20); h = w; }
    
    const hs = handleScale(p, '', ox, oy, w, h);
    const handles = [{ type: 'point', id: 'dr_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos', ...hs.pos }];
    if (pattern === 'circle') {
        handles.push({ type: 'radial', id: 'dr_ring', field: 'dia', fieldA: 'startAngle', cx: ox, cy: oy, r: _dn(p.dia, 50) / 2, a: hs.size.a + _dn(p.startAngle, 0) * Math.PI / 180, rScale: 2, minR: 0, label: 'Ø' });
    } else if (pattern === 'grid') {
        handles.push({ type: 'rect', id: 'dr_grid', field: 'dx', fieldH: 'dy', minw: null, minh: null, label: 'pitch', ...hs.size, sx: Math.max(1, Math.round(_dn(p.cols, 3))) - 1, sy: Math.max(1, Math.round(_dn(p.rows, 2))) - 1 });   // signed pitch (no min)
    } else if (pattern === 'rect') {
        handles.push({ type: 'rect', id: 'dr_rect', field: 'w', fieldH: 'h', minw: 1, minh: 1, label: 'W×H', ...hs.size });
    } else if (pattern === 'line') {
        const n = Math.max(1, Math.round(_dn(p.count, 3))), s = _dn(p.spacing, 20);
        handles.push({ type: 'radial', id: 'dr_line', field: 'spacing', fieldA: 'angle', cx: ox, cy: oy, r: (n - 1) * s, a: hs.size.a + _dn(p.angle, 0) * Math.PI / 180, rScale: n > 1 ? 1 / (n - 1) : null, minR: 0, label: 'pitch' });
    }
    if (boreDia) handles.push({ type: 'radial', id: 'dr_dia', field: 'holeDia', cx: (pts[0] && pts[0].x) || ox, cy: (pts[0] && pts[0].y) || oy, r: holeR, a: 0, rScale: 2, minR: 0.5, label: 'Ø' });
    // t718 — the origin-inclusive hole-CENTRES bbox (NOT the rings, which inflate by holeR): the drill emit's pattern
    // is 0-relative (array x0/y0 default 0, origin rides the placement offX), so the layout consumer resolves the shift
    // against THIS drawn-frame bbox (placeShiftOfStack bboxOverride) — landing the drawn pattern where the trace lands.
    return { paths, handles, bbox: pointsBBox(pts) };
}

/** Build the drill-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. The template
 *  is drillStack(defaults) with ids stripped (userOpFromStack does both) — the canonical valid-by-construction stack. */
export function drillDataDef() {
    const stack = drillDataStack(DRILL_DEFAULTS);   // t1385 — ONE stack builder, shared with the binding derivation above
    // t867 — the feeds-helper sits right after Feed (it fills that field).
    const baseBindings = [...toolBindingsFor(stack), ...DRILL_BINDINGS, ...entryBindingsFor(stack)];
    const fdAt = baseBindings.findIndex((b) => b.param === 'feed');
    const bindings = fdAt < 0 ? [...baseBindings, MATERIAL_BINDING] : [...baseBindings.slice(0, fdAt + 1), MATERIAL_BINDING, ...baseBindings.slice(fdAt + 1)];
    const def = userOpFromStack('drill_data', 'Drill (data)', stack, bindings, 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = (p) => drillPatternGeometry(p, false);   // t716 — hole pattern + pos + pattern handles (diameter DISPLAY)
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.zRuler = { depthParam: 'depth', depthOnly: true };   // t1026 — the depth-only ruler (peck drill has no stepdown): axis + total-depth grip, no pass ticks
    // t2293 — clearance's own fan-out (its OTHER copy, on the framing progstart — see the binding's own comment
    // above) kept in sync here, composed with the existing spindleHeadPatch (same shape as surfacingData.js/
    // pocketData.js/boreData.js, all of which compose spindleHeadPatch with their OWN derived-socket rewrite).
    def.postInstantiate = (stack, resolved) => {
        const r = resolved || {};
        if (r.clearance !== undefined) for (const b of flattenBlocks(stack)) if (b && b.type === 'progstart' && b.params) b.params.clearance = r.clearance;
        return spindleHeadPatch(stack);   // t945 — fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    };
    return def;
}
