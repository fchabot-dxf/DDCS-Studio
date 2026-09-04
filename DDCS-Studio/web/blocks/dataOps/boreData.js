/**
 * blocks/dataOps/boreData.js — the BORE (helical) built-in as a pure DATA definition (fan-out port).
 *
 * Bore is the Drill wizard's HELICAL variant (wizardLibrary `bore` = {type:'drill', variant:'bore'}): drillStack builds a
 * `bore` leaf (a DIFFERENT block type + key set) instead of the peck `drill` leaf when method==='helical'. So the drill twin
 * (drillData, method='peck') CANNOT be reused — its block-4 bindings key the drill leaf (depth/peck) — Bore needs its OWN twin
 * keyed to the bore leaf (holeDia/toolDia/depth/pitch/ramp/feed). Everything else (the pattern array + placement, blocks 1-3)
 * is identical to drillData, so the shared pattern/placement bindings are copied verbatim.
 *
 * Mirrors drillData exactly (the mill emit-only twin pattern): positional bindings by (blockIndex,key); the coarse cutting
 * atoms carry no #var. The template is drillStack(BORE_DEFAULTS) (== BUILDERS(defaults), the canonical valid-by-construction
 * stack). Byte-identical to the built-in bore across the pattern + cut sweep (both ramp modes — step ring-plunge / helix
 * linearized to G1 chords; the bore atom NEVER emits G3-with-Z, so the twin inherits that exactly). Proven by
 * tests/bore-as-data.spec.js. `method` is BAKED helical (not bound — Bore is always helical, like drillData bakes peck);
 * `clearance` FANS OUT to progstart + the bore leaf → held at its default (frontier #3, same as drill).
 */
import { drillStack, cycleForMethod } from '../../wizards/stacks/drillWizard.js';   // t1385 — the switch: one holecycle block; cycleForMethod translates the form's ramp vocabulary to the socket's
import { userOpFromStack, flattenBlocks } from '../userOps.js';   // t1385 — flattenBlocks: postInstantiate normalises the merged block's cycle
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor, deriveBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity; t1385 — the WHOLE map is by identity now (positional cannot survive the holecycle collapse)
import { drillPatternGeometry } from './drillData.js';   // t716 — the SHARED drill/bore pattern previewGeometry (bore adds the Ø handle)
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, DRILL_PATTERN_OPTIONS } from './wizardOptions.js';   // t720 P1 — SHARED enum options

/** Author defaults — match drillStack's num() fallbacks so the seeded template == the true default stack. method='helical'
 *  → drillStack builds the `bore` leaf. The pattern/placement half is identical to DRILL_DEFAULTS. */
export const BORE_DEFAULTS = {
    pattern: 'single', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20,   // t848 — default = single hole (mirrors drill; the twin-default rule)
    count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, w: 100, h: 80, nx: 2, ny: 2, skip: '',
    method: 'helical', holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, ramp: 'step', feed: 100, clearance: 5, wcs: 'active',
    // placement (makePlace) — bindable: the placeOnStock bbox is recomputed LIVE from the pattern at emit (array.extent).
    stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, originX: 0, originY: 0, offZ: 0,
};

/**
 * THE RAMP OPTIONS NOW CARRY CYCLE VALUES (t1385) — the labels a user reads are unchanged; the stored value is the
 * socket's own vocabulary. `holecycle` has ONE knob (`cycle`) where the old `bore` leaf had `ramp`, so a binding that
 * substitutes values verbatim must offer the values the socket accepts. `cycleForMethod` normalises both spellings, so
 * the wizard FORM can keep saying `ramp: 'step'|'helix'` while the twin says `'bore-step'|'bore-helix'`.
 */
const RAMP_OPTIONS = [['Ring-step (G3 circle)', 'bore-step'], ['Helix (linearized)', 'bore-helix']];

/**
 * The binding map, BY IDENTITY (t1385) — the same conversion drillData got, and for the same reason: the drill switch
 * merges the `array` container and its `bore` leaf into ONE `holecycle` block, and a hand-counted blockIndex cannot
 * survive a 2-into-1 collapse. `match: {type}` names the target; `deriveBindings` scans for its flat index. The old
 * `WRAP_PREFIX_COUNT = 4` is gone rather than moved — deriving over the already-wrapped stack absorbs it.
 *
 * THE FLATTEN, for reading (no row depends on these numbers any more):
 *   0 user_root · 1 panel · 2 sim · 3 param_group · 4 progstart · 5 wcs · 6 placeonstock · 7 array · 8 bore ·
 *   9 progend · 10 entry · 11 toolsel
 * (clearance NOT bound — frontier #3 fan-out to progstart + the bore leaf; method NOT bound — baked helical. The bbox
 *  snapshot is recomputed LIVE by the place fold from the array's params → placement is fully bindable.)
 */
// t1758 — MACHINE VARIABLES ROLL OUT, mill family. Bore shares the `holecycle` atom + placement mechanism with
// drillData (traced independently, verdicts confirmed to match); the pattern/placement block below mirrors
// drillData's own declarations word-for-word since it's the same code. See drillData.js's own note for the full
// depth/feed liveWord()/val() citation.
// t2401 (CLOSE THE REGISTRY) — the 10 fields below (wcs through originY, plus `pattern`/`skip` further down)
// carried no `section:` at all — a real gap, no live shell to reproduce (bore has none). Sectioned 'GEOMETRY',
// matching every surrounding placement/pattern field in this SAME array (x0/y0/cols/rows/... already were).
const BORE_BINDING_SPECS = [
    { param: 'wcs', tokenEligible: true, match: { type: 'wcs' }, key: 'wcs', type: 'enum', default: BORE_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, section: 'GEOMETRY' },
    // placement scalars (the placeonstock C-block)
    { param: 'stockAttach', tokenEligible: true, match: { type: 'placeonstock' }, key: 'stockAttach', type: 'enum', default: BORE_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'GEOMETRY' },
    { param: 'pathDatum', tokenEligible: true, match: { type: 'placeonstock' }, key: 'pathDatum', type: 'enum', default: BORE_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'GEOMETRY' },
    { param: 'stockDatum', tokenEligible: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockDatum', type: 'enum', default: BORE_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, section: 'GEOMETRY' },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockW', type: 'number', default: BORE_DEFAULTS.stockW, section: 'GEOMETRY' },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockH', type: 'number', default: BORE_DEFAULTS.stockH, section: 'GEOMETRY' },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockZ', type: 'number', default: BORE_DEFAULTS.stockZ, section: 'GEOMETRY' },
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offX', type: 'number', default: BORE_DEFAULTS.originX, section: 'GEOMETRY' },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offY', type: 'number', default: BORE_DEFAULTS.originY, section: 'GEOMETRY' },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offZ', type: 'number', default: BORE_DEFAULTS.offZ, label: 'Z offset', units: 'mm', section: 'GEOMETRY', help: 'Shift the whole pattern up or down in Z from the datum.' },
    // pattern + geometry (the `array` container — patternPoints reads these scalars at emit). THIS CLUSTER AND THE
    // CUT PARAMS BELOW are the two the drill switch merges into one `holecycle` block — hence matched by type.
    { param: 'pattern', tokenRefusal: 'Picks between structurally different hole-pattern formulas and fixes how many holes get built — the program\'s SHAPE depends on this, not a value inside one.', match: { type: 'holecycle' }, key: 'pattern', type: 'enum', default: BORE_DEFAULTS.pattern, widget: 'dropdown', widgetConfig: { options: DRILL_PATTERN_OPTIONS }, section: 'GEOMETRY' },
    { param: 'x0', tokenRefusal: 'This position is baked directly into every hole\'s move coordinate before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'x0', type: 'number', default: BORE_DEFAULTS.x0, label: 'Pattern origin X', units: 'mm', section: 'GEOMETRY', help: 'The pattern local X origin (usually 0 — the Origin X placement positions it on the stock).' },
    { param: 'y0', tokenRefusal: 'This position is baked directly into every hole\'s move coordinate before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'y0', type: 'number', default: BORE_DEFAULTS.y0, label: 'Pattern origin Y', units: 'mm', section: 'GEOMETRY', help: 'The pattern local Y origin (usually 0 — the Origin Y placement positions it on the stock).' },
    // t722 P2a — per-PATTERN field visibility + labels (mirrors drillData): grid → cols/rows/dx/dy · circle → dia/startAngle/
    // count · line → spacing/angle/count · rect → w/h/nx/ny (`count` shared by circle + line).
    { param: 'cols', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'cols', type: 'number', default: BORE_DEFAULTS.cols, when: { param: 'pattern', is: 'grid' }, label: 'Columns', section: 'GEOMETRY' },
    { param: 'rows', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'rows', type: 'number', default: BORE_DEFAULTS.rows, when: { param: 'pattern', is: 'grid' }, label: 'Rows', section: 'GEOMETRY' },
    { param: 'dx', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'dx', type: 'number', default: BORE_DEFAULTS.dx, when: { param: 'pattern', is: 'grid' }, label: 'X pitch', section: 'GEOMETRY' },
    { param: 'dy', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'dy', type: 'number', default: BORE_DEFAULTS.dy, when: { param: 'pattern', is: 'grid' }, label: 'Y pitch', section: 'GEOMETRY' },
    { param: 'count', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time, and — for the bolt circle — the step angle between holes) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'count', type: 'number', default: BORE_DEFAULTS.count, when: { param: 'pattern', in: ['circle', 'line'] }, label: 'Count', section: 'GEOMETRY' },
    { param: 'spacing', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'spacing', type: 'number', default: BORE_DEFAULTS.spacing, when: { param: 'pattern', is: 'line' }, label: 'Spacing', section: 'GEOMETRY' },
    { param: 'angle', tokenRefusal: 'A trig calculation (the controller has no cosine/sine) bakes the line direction from this angle before the program is built — it can\'t be resolved at that point.', match: { type: 'holecycle' }, key: 'angle', type: 'number', default: BORE_DEFAULTS.angle, when: { param: 'pattern', is: 'line' }, label: 'Angle°', section: 'GEOMETRY' },
    { param: 'dia', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, help: "Bolt-circle diameter — holes sit evenly on this circle.", match: { type: 'holecycle' }, key: 'dia', type: 'number', units: 'mm', default: BORE_DEFAULTS.dia, when: { param: 'pattern', is: 'circle' }, label: 'Circle Ø', section: 'GEOMETRY' },
    { param: 'startAngle', tokenRefusal: 'A trig calculation (the controller has no cosine/sine) bakes the bolt-circle\'s starting position from this angle before the program is built — it can\'t be resolved at that point.', match: { type: 'holecycle' }, key: 'startAngle', type: 'number', default: BORE_DEFAULTS.startAngle, when: { param: 'pattern', is: 'circle' }, label: 'Start angle°', section: 'GEOMETRY' },
    { param: 'w', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'w', type: 'number', units: 'mm', default: BORE_DEFAULTS.w, when: { param: 'pattern', is: 'rect' }, label: 'Width', section: 'GEOMETRY' },
    { param: 'h', tokenRefusal: 'This pitch is baked directly into a coordinate coefficient before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'holecycle' }, key: 'h', type: 'number', units: 'mm', default: BORE_DEFAULTS.h, when: { param: 'pattern', is: 'rect' }, label: 'Height', section: 'GEOMETRY' },
    { param: 'nx', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time, and a per-hole branch threshold) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'nx', type: 'number', default: BORE_DEFAULTS.nx, when: { param: 'pattern', is: 'rect' }, label: 'X count', section: 'GEOMETRY' },
    { param: 'ny', tokenRefusal: 'Sets how many holes get built into the program (a loop bound baked at build time) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'holecycle' }, key: 'ny', type: 'number', default: BORE_DEFAULTS.ny, when: { param: 'pattern', is: 'rect' }, label: 'Y count', section: 'GEOMETRY' },
    { param: 'skip', tokenRefusal: 'Decides how many skip-guard lines (and whether the skip label) get built into the program — a build-time count decision, not a value inside one.', help: "1-based hole numbers to omit (as shown in the preview), e.g. 5, 9.", match: { type: 'holecycle' }, key: 'skip', type: 'string', default: BORE_DEFAULTS.skip, section: 'GEOMETRY' },
    // cut params (the helical `bore` leaf) — the DIFFERENCE from drillData: holeDia/toolDia/pitch/ramp, NOT peck.
    // depth/pitch/feed ride holecycle.js's liveWord()/val() pass-through (same seam as drillData's depth/peck/feed).
    { param: 'depth', tokenEligible: true, match: { type: 'holecycle' }, key: 'depth', type: 'number', units: 'mm', default: BORE_DEFAULTS.depth, label: 'Depth', section: 'TOOL & CUT' },
    // holeDia/toolDia together decide (1) the too-small tool-fit refusal (swaps the whole emitted body) and (2) the
    // plunge-vs-ring-step branch when the bore radius rounds to ~0 — a categorical arm decision, not a magnitude.
    { param: 'holeDia', tokenRefusal: 'Combined with the tool diameter, this decides whether the tool fits at all (swaps the whole emitted body when it doesn\'t) and whether the cut degenerates to a straight plunge — a categorical decision, not a value inside one.', help: "Target bored hole Ø (mm) — must be ≥ the tool Ø.", match: { type: 'holecycle' }, key: 'holeDia', type: 'number', units: 'mm', default: BORE_DEFAULTS.holeDia, label: 'Hole Ø', section: 'TOOL & CUT' },
    { param: 'toolDia', tokenRefusal: 'Combined with the hole diameter, this decides whether the tool fits at all (swaps the whole emitted body when it doesn\'t) and whether the cut degenerates to a straight plunge — a categorical decision, not a value inside one.', match: { type: 'holecycle' }, key: 'toolDia', type: 'number', units: 'mm', default: BORE_DEFAULTS.toolDia, section: 'TOOL & CUT' },   // t1662 — label from SHARED_LABELS
    { param: 'pitch', tokenEligible: true, help: "Z step per full circle (mm).", match: { type: 'holecycle' }, key: 'pitch', type: 'number', default: BORE_DEFAULTS.pitch, label: 'Pitch (Z / pass)', section: 'TOOL & CUT' },
    // t1385 — this row drives `cycle`, not a `ramp` key: the merged block folded the bore's ramp into the family's one
    // cycle knob. The param NAME stays `ramp` so every other consumer (the form, the CAM map, the wizard) is untouched.
    // t1758 — categorical: selects among 3 structurally different cycle-body generators (peck/ring-step/helix), each
    // its own register layout; the postInstantiate cycleForMethod normalise also silently discards anything outside
    // its known enum, an additional discard risk on top of the branch itself. NOT deferrable.
    { param: 'ramp', tokenRefusal: 'Picks between structurally different cycle-body generators (ring-step vs helix), each with its own register layout — the program\'s shape depends on this, not a value inside one.', match: { type: 'holecycle' }, key: 'cycle', type: 'enum', default: cycleForMethod('helical', BORE_DEFAULTS.ramp), widget: 'dropdown', widgetConfig: { options: RAMP_OPTIONS }, label: 'Ramp', help: 'Ring-step: plunge the pitch then a full G3 circle, repeat (the proven Expert form). Helix: continuous descent, linearized to G1 chords (the Expert has no proven helical G3).', section: 'TOOL & CUT' },
    { param: 'feed', tokenEligible: true, match: { type: 'holecycle' }, key: 'feed', type: 'number', units: 'mm/min', default: BORE_DEFAULTS.feed, label: 'Feed', section: 'TOOL & CUT' },
    { param: 'rpm', tokenRefusal: 'Falls back to the tool library\'s RPM when left blank — that fallback decision runs before the program is built.', tokenDeferrable: true, match: { type: 'progstart' }, key: 'rpm', type: 'number', socketHeld: true, label: 'Spindle RPM', section: 'TOOL & CUT', help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },   // t996 — rpm → progstart
];

/** The WRAPPED template — factored out of `boreDataDef` (t1385) so the derivation and the def read the SAME stack. */
function boreDataStack(p = BORE_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // t2301 (BACKLOG 20) — 'panel' removed: inert + id-collided with sim's own layout2d pane (see
            // drillData.js's own t2301 comment for the full mechanism, first fixed for ATC at t2257).
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Bore' }, children: [] },
        ],
        children: appendToolSel(appendEntry(drillStack(p))),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing)
    }];
}

export const BORE_BINDINGS = deriveBindingsFor(boreDataStack(BORE_DEFAULTS), BORE_BINDING_SPECS);

// t2595 (BACKLOG #71/#72, Phase 1 step 1) — the ordered/grouped field lists this def's own uiChildren tree AND
// its flat bindings array both need, computed ONCE (mirrors surfacingFieldGroups' own header: one computation,
// not two hand-kept copies that could drift). ⚠ DIAGNOSED LIVE: `deriveBindingsFor`'s own `match:{type}`
// resolution bakes a concrete `blockIndex` at DERIVE time (deriveBindings.js:63) — it does NOT re-resolve
// later, so reusing the STALE module-level `BORE_BINDINGS` (derived against the OLD, smaller uiChildren)
// directly against the NEW, bigger tree-shaped stack breaks every binding (confirmed: registerUserOp threw
// "does not resolve in the template" for all 32 params on the first attempt). Fixed by re-deriving fresh here,
// against whatever `stack` is actually passed — mirrors surfacingDataDef's own exact two-call pattern (once
// against a bootstrap stack to compute field order for BUILDING the tree, once again against the FINAL,
// already-tree-built stack for the bindings actually passed to `userOpFromStack`). Unlike drill's own PATTERN
// section (which needed per-pattern grid_container sub-groups purely for COLUMN LAYOUT — a cosmetic concern,
// not a `when:`-visibility requirement), bore's own `when:`-gated pattern fields (cols/rows/dx/dy, count/
// spacing/angle, dia/startAngle, w/h/nx/ny) are declared as PLAIN field_ref rows inside ONE GEOMETRY group_box,
// in their own binding-array order — `field_ref`'s own renderer already reads each binding's `when` to hide/
// show, the SAME mechanism drill's own pattern fields already rely on regardless of which grouping node wraps
// them (confirmed by reading drillData.js's own uiChildren: the visibility logic lives in `field_ref`/the
// binding's own `when`, never in the wrapper node type).
function boreFieldGroups(stack) {
    const derived = deriveBindingsFor(stack, BORE_BINDING_SPECS);
    const geometryFields = derived.filter((b) => b.section === 'GEOMETRY');
    const toolCutFields = derived.filter((b) => b.section === 'TOOL & CUT');
    const toolNum = toolBindingsFor(stack).map((b) => ({ ...b, section: 'TOOL & CUT' }));
    const entryXY = entryBindingsFor(stack);
    return {
        GEOMETRY: [...geometryFields, ...entryXY],
        TOOL_CUT: [toolNum[0], ...toolCutFields],   // toolNum FIRST, matching boreDataDef's own pre-existing [...toolNum, ...BORE_BINDINGS] flat order
    };
}

export const BORE_DATA_OPTYPE = 'user_bore_data';

/** Build the bore-as-data def — the template is drillStack(BORE_DEFAULTS) (method='helical' → the bore leaf); the
 *  hand-authored BINDINGS map is the independent artifact, proven byte-identical + binding-wiring by tests/bore-as-data.spec.js. */
export function boreDataDef() {
    // t2595 — a bootstrap stack (same `children`, no tree yet) just to read the ordered/grouped param names
    // boreFieldGroups derives — see that function's own header for why this first pass is safe (it is
    // RE-DERIVED again below, against the real, final stack, for the bindings actually shipped).
    const bootstrapStack = [{ type: 'user_root', params: {}, uiChildren: [], children: appendToolSel(appendEntry(drillStack(BORE_DEFAULTS))) }];
    const g = boreFieldGroups(bootstrapStack);
    const fieldRefsOf = (group) => group.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2595 (BACKLOG #71/#72, Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout()
            // (userOpView.js) routes this twin onto renderUiTree, the SAME mechanism drill/surfacing already
            // use (t2299/t2341, t2545) — NOT a widened predicate, a real declared split, same guardrail held.
            // Bore has NO classic hand-written shell page (`wiz_bore` — grepped index.html, zero hits; it was
            // born a pure data-op, "fan-out port," auto-rendered from bindings) — so, unlike surfacing/text,
            // there is no shell usage_text to reproduce verbatim. DIAGNOSED LIVE (not guessed): the generic
            // `#wiz_user` container carries its OWN always-present `#wiz_user_usage` element, defaulting to
            // the op's bare LABEL ("Bore") when no `usage_text` node is declared — a real, harmless fallback,
            // but thin, and it does not reach `renderUiTree`'s own direct-call path the same way a DECLARED
            // usage_text node does (found via the row-diff gate's own usage-parity check). Given a real
            // description, matching every other tree-mode op's own guidance quality bar, in bore's own voice
            // (drillData.js's own shell text — this file's header calls bore "the Drill wizard's HELICAL
            // variant" — adapted for the ring-step/helix-only case, not copied verbatim since no shell exists).
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Bore' },
                    children: [
                        { type: 'usage_text', params: { text: 'Bores a hole pattern in the active WCS with an end mill (hole Ø ≥ tool Ø), ring-stepping or helixing out to size rather than plunging. Drag the handles in the 2D layout to set the pattern; the 3D view verifies the cut. Spindle start + end-of-program come from Settings.' } },
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(g.GEOMETRY) },
                        { type: 'group_box', params: { title: 'TOOL & CUT' }, children: fieldRefsOf(g.TOOL_CUT) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2595 (BACKLOG #71/#72, Phase 1 step 2) — preview3d + feature_canvas as ADJACENT RIGHT-pane
                // siblings, the SAME adjacency-merge shape drill/surfacing already ship (t2511) — byte-identical
                // DOM to the old combined `sim` node per t2511's own proof.
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, machine: false, magazine: false } },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                ],
            },
        }],
        children: appendToolSel(appendEntry(drillStack(BORE_DEFAULTS))),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing)
    }];
    // t2595 — re-derived over the FINAL, real stack (safe — see boreFieldGroups' own header on why uiChildren's
    // shape DOES affect blockIndex resolution here, unlike surfacing's own case), the SAME computation the tree
    // above already used, so the flat binding array below and the declared tree can never disagree.
    const gFinal = boreFieldGroups(stack);
    const def = userOpFromStack('bore_data', 'Bore (data)', stack, [...gFinal.GEOMETRY, ...gFinal.TOOL_CUT], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = (p) => drillPatternGeometry(p, true);   // t716 — bore pattern + pos + pattern handles + a draggable Ø (holeDia)
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.zRuler = { depthParam: 'depth', depthOnly: true };   // t1026 — the depth-only ruler (helical bore has no stepdown): axis + total-depth grip, no pass ticks
    /**
     * t1385 — NORMALISE THE CYCLE, and this is a defect I introduced and measured, not a precaution.
     *
     * The `ramp` binding substitutes its value VERBATIM into the merged block's `cycle` socket. Picking from the form is
     * fine (the dropdown now offers the cycle spellings), but a caller passing the WIZARD's vocabulary — `ramp: 'helix'`,
     * which is exactly what an in-place open seeds from wizard params, and what the as-data sweep passes — wrote
     * `cycle: 'helix'`. `cycleOf` does not know that word, so it fell back to **peck**: a bore op silently emitting a
     * DRILL cycle. It showed up as 10 byte-diffs against drillStack, which is the sweep earning its keep.
     *
     * Fixed HERE rather than by teaching the atom the wizard's words: `cycleForMethod` stays the single translation, and
     * postInstantiate is the declared seam for a resolved-at-insert value (the same seam the spindle patch below uses).
     * The atom keeps one vocabulary; the twin does the translating, because the twin is the one with two callers.
     */
    def.postInstantiate = (stack, resolved) => {
        for (const b of flattenBlocks(stack)) {
            if (b && b.type === 'holecycle' && b.params) b.params.cycle = cycleForMethod('helical', b.params.cycle);
        }
        return spindleHeadPatch(stack, resolved);   // t945 — fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    };
    return def;
}
