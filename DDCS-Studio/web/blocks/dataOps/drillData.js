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
 * REMAINING FRONTIER (the vocabulary Stage 5 must still grow, each an executable divergence tripwire in the spec):
 *   1. METHOD SWAP — params.method==='helical' makes drillStack build a `bore` child (different block TYPE + key
 *      set) instead of `drill`. instantiate substitutes VALUES, never a block type. → this def covers the peck path.
 *   3. FAN-OUT PARAM — `clearance` feeds TWO sockets (progstart + the drill leaf); a binding is 1 param → 1 socket,
 *      and duplicate param names are rejected. → clearance is held at its default here.
 *
 * Scope note: the template is SEEDED from drillStack(DRILL_DEFAULTS) (== "BUILDERS(defaults)", the canonical
 * valid-by-construction template). The INDEPENDENT artifact under test is the hand-authored BINDINGS map below, proven
 * TWO ways by the spec:
 *   • EMIT-EQUIVALENCE — byte-identical to drillStack across a sweep that now spans off-origin x0/y0, circle/line/rect
 *     shapes, stock-attach placement, cut params, skip + wcs (frontier #2 solved → the bbox tracks the pattern live).
 *   • WIRING (structural, all bindings) — set one param to a sentinel and assert BOTH instantiate AND drillStack land
 *     it in the binding's (blockIndex,key); a wrong/dropped/swapped key fails. Belt-and-suspenders alongside the emit
 *     sweep (it also covers the unbound method/clearance sockets staying put).
 * Stage 6 authors the template independently too (then the builder can be deleted); that's the self-host step, not this one.
 */
import { drillStack, patternPoints } from '../../wizards/drillWizard.js';
import { pointsBBox } from '../../wizards/ops/placement.js';   // t718 — the hole-CENTRES bbox for the placement-parity shift
import { userOpFromStack } from '../userOps.js';
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings)
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, DRILL_PATTERN_OPTIONS } from './wizardOptions.js';   // t720 P1 — SHARED enum options (were undeclared → empty dropdowns)

/** The author defaults — match drillStack's own num() fallbacks so the seeded template == the true default stack. */
export const DRILL_DEFAULTS = {
    pattern: 'grid', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20,
    count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, w: 100, h: 80, nx: 2, ny: 2, skip: '',
    depth: 5, peck: 5, feed: 100, clearance: 5, wcs: 'active', method: 'peck',
    // placement (makePlace) — now bindable: the placeOnStock bbox snapshot is computed LIVE from the pattern at emit
    // (array.extent → place fold), so binding the placement scalars + a moved/attached pattern stays correct.
    stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, originX: 0, originY: 0, offZ: 0,
};

// The hand-authored binding map: each drill param → its (blockIndex, key) socket in the flattened default template.
// Flatten (pre-order) of drillStack's [progstart, wcs, placeonstock{array{drill}}, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 array · 4 drill · 5 progend
// (clearance is deliberately NOT bound — frontier #3; method is NOT bound — frontier #1. The placeonstock bbox
//  snapshot on block 2 is NO LONGER a frontier — the place fold recomputes it LIVE from the array's params, so
//  placement is fully bindable now; only the 4 bbox-snapshot keys (bminX..) stay vestigial/ignored.)
const DRILL_EXEC_BINDINGS = [
    { param: 'wcs', blockIndex: 1, key: 'wcs', type: 'enum', default: DRILL_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS } },
    // placement scalars (block 2, placeonstock) — now correct because the bbox tracks the pattern live (array.extent)
    { param: 'stockAttach', blockIndex: 2, key: 'stockAttach', type: 'enum', default: DRILL_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'pathDatum', blockIndex: 2, key: 'pathDatum', type: 'enum', default: DRILL_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'stockDatum', formHidden: true, blockIndex: 2, key: 'stockDatum', type: 'enum', default: DRILL_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS } },
    { param: 'stockW', formHidden: true, blockIndex: 2, key: 'stockW', type: 'number', default: DRILL_DEFAULTS.stockW },
    { param: 'stockH', formHidden: true, blockIndex: 2, key: 'stockH', type: 'number', default: DRILL_DEFAULTS.stockH },
    { param: 'stockZ', formHidden: true, blockIndex: 2, key: 'stockZ', type: 'number', default: DRILL_DEFAULTS.stockZ },
    { param: 'originX', blockIndex: 2, key: 'offX', type: 'number', default: DRILL_DEFAULTS.originX },
    { param: 'originY', blockIndex: 2, key: 'offY', type: 'number', default: DRILL_DEFAULTS.originY },
    { param: 'offZ', blockIndex: 2, key: 'offZ', type: 'number', default: DRILL_DEFAULTS.offZ },
    // pattern + geometry (block 3, the `array` container — patternPoints reads these scalars at emit)
    { param: 'pattern', blockIndex: 3, key: 'pattern', type: 'enum', default: DRILL_DEFAULTS.pattern, widget: 'dropdown', widgetConfig: { options: DRILL_PATTERN_OPTIONS } },
    { param: 'x0', blockIndex: 3, key: 'x0', type: 'number', default: DRILL_DEFAULTS.x0 },
    { param: 'y0', blockIndex: 3, key: 'y0', type: 'number', default: DRILL_DEFAULTS.y0 },
    // t722 P2a — per-PATTERN field visibility (map the real fields): grid → cols/rows/dx/dy · circle → dia/startAngle/count ·
    // line → spacing/angle/count · rect → w/h/nx/ny (`count` is shared by circle + line). + labels (were cryptic param names).
    { param: 'cols', blockIndex: 3, key: 'cols', type: 'number', default: DRILL_DEFAULTS.cols, when: { param: 'pattern', is: 'grid' }, label: 'Columns', section: 'GEOMETRY' },
    { param: 'rows', blockIndex: 3, key: 'rows', type: 'number', default: DRILL_DEFAULTS.rows, when: { param: 'pattern', is: 'grid' }, label: 'Rows', section: 'GEOMETRY' },
    { param: 'dx', blockIndex: 3, key: 'dx', type: 'number', default: DRILL_DEFAULTS.dx, when: { param: 'pattern', is: 'grid' }, label: 'X pitch', section: 'GEOMETRY' },
    { param: 'dy', blockIndex: 3, key: 'dy', type: 'number', default: DRILL_DEFAULTS.dy, when: { param: 'pattern', is: 'grid' }, label: 'Y pitch', section: 'GEOMETRY' },
    { param: 'count', blockIndex: 3, key: 'count', type: 'number', default: DRILL_DEFAULTS.count, when: { param: 'pattern', in: ['circle', 'line'] }, label: 'Count', section: 'GEOMETRY' },
    { param: 'spacing', blockIndex: 3, key: 'spacing', type: 'number', default: DRILL_DEFAULTS.spacing, when: { param: 'pattern', is: 'line' }, label: 'Spacing', section: 'GEOMETRY' },
    { param: 'angle', blockIndex: 3, key: 'angle', type: 'number', default: DRILL_DEFAULTS.angle, when: { param: 'pattern', is: 'line' }, label: 'Angle°', section: 'GEOMETRY' },
    { param: 'dia', blockIndex: 3, key: 'dia', type: 'number', default: DRILL_DEFAULTS.dia, when: { param: 'pattern', is: 'circle' }, label: 'Circle Ø', section: 'GEOMETRY' },
    { param: 'startAngle', blockIndex: 3, key: 'startAngle', type: 'number', default: DRILL_DEFAULTS.startAngle, when: { param: 'pattern', is: 'circle' }, label: 'Start angle°', section: 'GEOMETRY' },
    { param: 'w', blockIndex: 3, key: 'w', type: 'number', default: DRILL_DEFAULTS.w, when: { param: 'pattern', is: 'rect' }, label: 'Width', section: 'GEOMETRY' },
    { param: 'h', blockIndex: 3, key: 'h', type: 'number', default: DRILL_DEFAULTS.h, when: { param: 'pattern', is: 'rect' }, label: 'Height', section: 'GEOMETRY' },
    { param: 'nx', blockIndex: 3, key: 'nx', type: 'number', default: DRILL_DEFAULTS.nx, when: { param: 'pattern', is: 'rect' }, label: 'X count', section: 'GEOMETRY' },
    { param: 'ny', blockIndex: 3, key: 'ny', type: 'number', default: DRILL_DEFAULTS.ny, when: { param: 'pattern', is: 'rect' }, label: 'Y count', section: 'GEOMETRY' },
    { param: 'skip', blockIndex: 3, key: 'skip', type: 'string', default: DRILL_DEFAULTS.skip },
    // cut params (block 4, the peck `drill` leaf)
    { param: 'depth', blockIndex: 4, key: 'depth', type: 'number', default: DRILL_DEFAULTS.depth },
    { param: 'peck', blockIndex: 4, key: 'peck', type: 'number', default: DRILL_DEFAULTS.peck },
    { param: 'feed', blockIndex: 4, key: 'feed', type: 'number', default: DRILL_DEFAULTS.feed },
];

const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const DRILL_BINDINGS = DRILL_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const DRILL_DATA_OPTYPE = 'user_drill_data';

const _dn = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
const _holeRing = (cx, cy, r) => { const pts = []; for (let i = 0; i <= 12; i++) { const a = 2 * Math.PI * i / 12; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); } return { pts, cls: 'fc-guide' }; };
/** t716 — DECLARED preview geometry for the DRILL/BORE pattern family: the hole positions (patternPoints) drawn as rings +
 *  a pos handle (originX/originY) + the pattern SIZE handle PER KIND (grid dx/dy · circle Ø/angle · line pitch/angle · rect
 *  W/H). Bore (boreDia=true) ALSO gets a draggable hole-DIAMETER handle (holeDia). Mirrors drillView.buildDrillSpec; handles
 *  write the TWIN params directly (preview-side → emit unaffected). SHARED by drillData + boreData (bore imports it). */
export function drillPatternGeometry(p, boreDia) {
    const pattern = p.pattern || 'grid';
    const ox = _dn(p.originX, 0), oy = _dn(p.originY, 0);
    const holeR = boreDia ? Math.max(0.5, _dn(p.holeDia, 12) / 2) : 3;   // bore = the real bore Ø; drill = a small display dot
    const pts = patternPoints({ ...p, cx: ox, cy: oy, x0: ox, y0: oy }) || [];   // patternPoints reads cx/cy or x0/y0 per pattern
    const paths = pts.map((pt) => _holeRing(pt.x, pt.y, holeR));
    const handles = [{ type: 'point', id: 'dr_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos' }];
    if (pattern === 'circle') {
        handles.push({ type: 'radial', id: 'dr_ring', field: 'dia', fieldA: 'startAngle', cx: ox, cy: oy, r: _dn(p.dia, 50) / 2, a: _dn(p.startAngle, 0) * Math.PI / 180, rScale: 2, minR: 0, label: 'Ø' });
    } else if (pattern === 'grid') {
        const cols = Math.max(1, Math.round(_dn(p.cols, 3))), rows = Math.max(1, Math.round(_dn(p.rows, 2))), dx = _dn(p.dx, 20), dy = _dn(p.dy, 20);
        handles.push({ type: 'rect', id: 'dr_grid', field: 'dx', fieldH: 'dy', ax: ox, ay: oy, ex: (cols - 1) * dx, ey: (rows - 1) * dy, sx: cols - 1, sy: rows - 1, label: 'pitch' });   // signed pitch (no min)
    } else if (pattern === 'rect') {
        handles.push({ type: 'rect', id: 'dr_rect', field: 'w', fieldH: 'h', ax: ox, ay: oy, ex: _dn(p.w, 100), ey: _dn(p.h, 80), sx: 1, sy: 1, minw: 1, minh: 1, label: 'W×H' });
    } else if (pattern === 'line') {
        const n = Math.max(1, Math.round(_dn(p.count, 3))), s = _dn(p.spacing, 20);
        handles.push({ type: 'radial', id: 'dr_line', field: 'spacing', fieldA: 'angle', cx: ox, cy: oy, r: (n - 1) * s, a: _dn(p.angle, 0) * Math.PI / 180, rScale: n > 1 ? 1 / (n - 1) : null, minR: 0, label: 'pitch' });
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
    const exec = drillStack(DRILL_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // t716 — the FeatureCanvas 2D with the hole pattern + pos + pattern-size handles (previewGeometry)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            {
                type: 'param_group',
                params: { group: 'Drill' },
                children: [],
            },
        ],
        children: appendToolSel(appendEntry(exec)),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing; no body-index shift)
    }];
    const def = userOpFromStack('drill_data', 'Drill (data)', stack, [...toolBindingsFor(stack), ...DRILL_BINDINGS, ...entryBindingsFor(stack)], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = (p) => drillPatternGeometry(p, false);   // t716 — hole pattern + pos + pattern handles (diameter DISPLAY)
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    return def;
}
