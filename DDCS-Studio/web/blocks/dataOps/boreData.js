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
import { drillStack } from '../../wizards/drillWizard.js';
import { userOpFromStack } from '../userOps.js';
import { drillPatternGeometry } from './drillData.js';   // t716 — the SHARED drill/bore pattern previewGeometry (bore adds the Ø handle)
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, DRILL_PATTERN_OPTIONS } from './wizardOptions.js';   // t720 P1 — SHARED enum options

/** Author defaults — match drillStack's num() fallbacks so the seeded template == the true default stack. method='helical'
 *  → drillStack builds the `bore` leaf. The pattern/placement half is identical to DRILL_DEFAULTS. */
export const BORE_DEFAULTS = {
    pattern: 'grid', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20,
    count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, w: 100, h: 80, nx: 2, ny: 2, skip: '',
    method: 'helical', holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, ramp: 'step', feed: 100, clearance: 5, wcs: 'active',
    // placement (makePlace) — bindable: the placeOnStock bbox is recomputed LIVE from the pattern at emit (array.extent).
    stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, originX: 0, originY: 0, offZ: 0,
};

const RAMP_OPTIONS = [['Ring-step (G3 circle)', 'step'], ['Helix (linearized)', 'helix']];

// Flatten (pre-order) of drillStack's [progstart, wcs, placeonstock{array{bore}}, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 array · 4 bore · 5 progend
// (clearance NOT bound — frontier #3 fan-out to progstart + the bore leaf; method NOT bound — baked helical. The bbox
//  snapshot on block 2 is recomputed LIVE by the place fold from the array's params → placement is fully bindable.)
const BORE_EXEC_BINDINGS = [
    { param: 'wcs', blockIndex: 1, key: 'wcs', type: 'enum', default: BORE_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS } },
    // placement scalars (block 2, placeonstock)
    { param: 'stockAttach', blockIndex: 2, key: 'stockAttach', type: 'enum', default: BORE_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'pathDatum', blockIndex: 2, key: 'pathDatum', type: 'enum', default: BORE_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'stockDatum', blockIndex: 2, key: 'stockDatum', type: 'enum', default: BORE_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS } },
    { param: 'stockW', blockIndex: 2, key: 'stockW', type: 'number', default: BORE_DEFAULTS.stockW },
    { param: 'stockH', blockIndex: 2, key: 'stockH', type: 'number', default: BORE_DEFAULTS.stockH },
    { param: 'stockZ', blockIndex: 2, key: 'stockZ', type: 'number', default: BORE_DEFAULTS.stockZ },
    { param: 'originX', blockIndex: 2, key: 'offX', type: 'number', default: BORE_DEFAULTS.originX },
    { param: 'originY', blockIndex: 2, key: 'offY', type: 'number', default: BORE_DEFAULTS.originY },
    { param: 'offZ', blockIndex: 2, key: 'offZ', type: 'number', default: BORE_DEFAULTS.offZ },
    // pattern + geometry (block 3, the `array` container — patternPoints reads these scalars at emit)
    { param: 'pattern', blockIndex: 3, key: 'pattern', type: 'enum', default: BORE_DEFAULTS.pattern, widget: 'dropdown', widgetConfig: { options: DRILL_PATTERN_OPTIONS } },
    { param: 'x0', blockIndex: 3, key: 'x0', type: 'number', default: BORE_DEFAULTS.x0 },
    { param: 'y0', blockIndex: 3, key: 'y0', type: 'number', default: BORE_DEFAULTS.y0 },
    // t722 P2a — per-PATTERN field visibility + labels (mirrors drillData): grid → cols/rows/dx/dy · circle → dia/startAngle/
    // count · line → spacing/angle/count · rect → w/h/nx/ny (`count` shared by circle + line).
    { param: 'cols', blockIndex: 3, key: 'cols', type: 'number', default: BORE_DEFAULTS.cols, when: { param: 'pattern', is: 'grid' }, label: 'Columns', section: 'GEOMETRY' },
    { param: 'rows', blockIndex: 3, key: 'rows', type: 'number', default: BORE_DEFAULTS.rows, when: { param: 'pattern', is: 'grid' }, label: 'Rows', section: 'GEOMETRY' },
    { param: 'dx', blockIndex: 3, key: 'dx', type: 'number', default: BORE_DEFAULTS.dx, when: { param: 'pattern', is: 'grid' }, label: 'X pitch', section: 'GEOMETRY' },
    { param: 'dy', blockIndex: 3, key: 'dy', type: 'number', default: BORE_DEFAULTS.dy, when: { param: 'pattern', is: 'grid' }, label: 'Y pitch', section: 'GEOMETRY' },
    { param: 'count', blockIndex: 3, key: 'count', type: 'number', default: BORE_DEFAULTS.count, when: { param: 'pattern', in: ['circle', 'line'] }, label: 'Count', section: 'GEOMETRY' },
    { param: 'spacing', blockIndex: 3, key: 'spacing', type: 'number', default: BORE_DEFAULTS.spacing, when: { param: 'pattern', is: 'line' }, label: 'Spacing', section: 'GEOMETRY' },
    { param: 'angle', blockIndex: 3, key: 'angle', type: 'number', default: BORE_DEFAULTS.angle, when: { param: 'pattern', is: 'line' }, label: 'Angle°', section: 'GEOMETRY' },
    { param: 'dia', blockIndex: 3, key: 'dia', type: 'number', default: BORE_DEFAULTS.dia, when: { param: 'pattern', is: 'circle' }, label: 'Circle Ø', section: 'GEOMETRY' },
    { param: 'startAngle', blockIndex: 3, key: 'startAngle', type: 'number', default: BORE_DEFAULTS.startAngle, when: { param: 'pattern', is: 'circle' }, label: 'Start angle°', section: 'GEOMETRY' },
    { param: 'w', blockIndex: 3, key: 'w', type: 'number', default: BORE_DEFAULTS.w, when: { param: 'pattern', is: 'rect' }, label: 'Width', section: 'GEOMETRY' },
    { param: 'h', blockIndex: 3, key: 'h', type: 'number', default: BORE_DEFAULTS.h, when: { param: 'pattern', is: 'rect' }, label: 'Height', section: 'GEOMETRY' },
    { param: 'nx', blockIndex: 3, key: 'nx', type: 'number', default: BORE_DEFAULTS.nx, when: { param: 'pattern', is: 'rect' }, label: 'X count', section: 'GEOMETRY' },
    { param: 'ny', blockIndex: 3, key: 'ny', type: 'number', default: BORE_DEFAULTS.ny, when: { param: 'pattern', is: 'rect' }, label: 'Y count', section: 'GEOMETRY' },
    { param: 'skip', blockIndex: 3, key: 'skip', type: 'string', default: BORE_DEFAULTS.skip },
    // cut params (block 4, the helical `bore` leaf) — the DIFFERENCE from drillData: holeDia/toolDia/pitch/ramp, NOT peck
    { param: 'depth', blockIndex: 4, key: 'depth', type: 'number', default: BORE_DEFAULTS.depth, label: 'Depth', section: 'TOOL & CUT' },
    { param: 'holeDia', blockIndex: 4, key: 'holeDia', type: 'number', default: BORE_DEFAULTS.holeDia, label: 'Hole Ø', section: 'TOOL & CUT' },
    { param: 'toolDia', blockIndex: 4, key: 'toolDia', type: 'number', default: BORE_DEFAULTS.toolDia, label: 'Tool Ø', section: 'TOOL & CUT' },
    { param: 'pitch', blockIndex: 4, key: 'pitch', type: 'number', default: BORE_DEFAULTS.pitch, label: 'Pitch (Z / pass)', section: 'TOOL & CUT' },
    { param: 'ramp', blockIndex: 4, key: 'ramp', type: 'enum', default: BORE_DEFAULTS.ramp, widget: 'dropdown', widgetConfig: { options: RAMP_OPTIONS }, label: 'Ramp', help: 'Ring-step: plunge the pitch then a full G3 circle, repeat (the proven Expert form). Helix: continuous descent, linearized to G1 chords (the Expert has no proven helical G3).', section: 'TOOL & CUT' },
    { param: 'feed', blockIndex: 4, key: 'feed', type: 'number', default: BORE_DEFAULTS.feed, label: 'Feed', section: 'TOOL & CUT' },
];

const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const BORE_BINDINGS = BORE_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const BORE_DATA_OPTYPE = 'user_bore_data';

/** Build the bore-as-data def — the template is drillStack(BORE_DEFAULTS) (method='helical' → the bore leaf); the
 *  hand-authored BINDINGS map is the independent artifact, proven byte-identical + binding-wiring by tests/bore-as-data.spec.js. */
export function boreDataDef() {
    const exec = drillStack(BORE_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // t716 — the FeatureCanvas 2D with the bore pattern + pos + pattern-size + Ø handles (previewGeometry)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Bore' }, children: [] },
        ],
        children: exec,
    }];
    const def = userOpFromStack('bore_data', 'Bore (data)', stack, BORE_BINDINGS, 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = (p) => drillPatternGeometry(p, true);   // t716 — bore pattern + pos + pattern handles + a draggable Ø (holeDia)
    return def;
}
