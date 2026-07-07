/**
 * blocks/dataOps/contourData.js — the CONTOUR (profile) built-in as a pure DATA definition (the mill FEATURE-WRITE port,
 * E1 EMIT). Contour is the cheapest FULL mill port: NO structural fork (side inside/outside/on + the 4 shapes are pure
 * VALUE-swaps → no superset) — so this mirrors slotData/surfacingData (positional bindings; the coarse cutting atoms carry
 * no #var, so the twin binds by (blockIndex,key), not by macro-var identity).
 *
 * THE REFRAME (region-pill → flat): contourStack now rides a FLAT `contourfill` atom (shape/x/y/w/h/dia/sides on the block,
 * no Region SOCKET) — so every geometry dim is a clean (blockIndex,key) binding. Emit is BYTE-IDENTICAL (contourfill rebuilds
 * the same region descriptor + reuses the same kernels); the shared region-socket `contour` atom is untouched (pocket's wall
 * finish still uses it). ORIGIN owned by the placement (offX/offY) — the geometry is local-0-based, so origin is a SINGLE
 * placement socket (region-at-0 + shift originX == region-at-originX + shift 0), exactly like surfacing.
 *
 * FRONTIER (intentionally unbound, like surfacing/drill): `clearance` FANS OUT to progstart (block 0) + the contourfill leaf
 * (block 4) — a binding is 1 param → 1 socket, so it stays at its default. Everything else binds. Proven byte-identical to
 * contourStack across side × the 4 shapes × a scalar/placement/wcs sweep (tests/contour-data-emit.spec.js).
 */
import { contourStack } from '../../wizards/contourWizard.js';
import { userOpFromStack } from '../userOps.js';

/** Author defaults — match contourStack's num() fallbacks + the built-in Contour form defaults. Geometry is local-0-based
 *  (originX/originY ride the placement). All 4 shape dims present; the contourfill atom picks w×h vs dia+sides by shape. */
export const CONTOUR_DEFAULTS = {
    shape: 'rect', w: 80, h: 60, dia: 50, sides: 6, side: 'outside', toolDia: 6,
    depth: 4, stepdown: 1.5, feed: 400, plunge: 200, clearance: 5, wcs: 'active',
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

const WCS_OPTIONS = [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']];
const SHAPE_OPTIONS = [['Rectangle', 'rect'], ['Circle', 'circle'], ['Polygon', 'polygon'], ['Ellipse', 'ellipse']];
const SIDE_OPTIONS = [['Outside', 'outside'], ['Inside', 'inside'], ['On (finish)', 'on']];
const XY_DATUM_OPTIONS = [
    ['Follow stock datum', ''], ['Front Left', 'nn'], ['Front Center', 'cn'], ['Front Right', 'pn'],
    ['Center Left', 'nc'], ['Center', 'cc'], ['Center Right', 'pc'], ['Back Left', 'np'], ['Back Center', 'cp'], ['Back Right', 'pp'],
];
const STOCK_DATUM_OPTIONS = [
    ['Front Left / Top', 'nnp'], ['Front Center / Top', 'cnp'], ['Front Right / Top', 'pnp'],
    ['Center Left / Top', 'ncp'], ['Center / Top', 'ccp'], ['Center Right / Top', 'pcp'],
    ['Back Left / Top', 'npp'], ['Back Center / Top', 'cpp'], ['Back Right / Top', 'ppp'],
];

// Pre-order flatten of contourStack's [progstart, wcs, placeonstock{ stepdown{ contourfill } }, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 stepdown · 4 contourfill · 5 progend
// (clearance NOT bound — frontier: fans out to progstart + the contourfill leaf. contourfill's x/y/z stay constant:
//  x=y=0 [local, origin rides the placement], z='z'.)
const CONTOUR_EXEC_BINDINGS = [
    { param: 'wcs', blockIndex: 1, key: 'wcs', type: 'enum', default: CONTOUR_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, label: 'WCS', section: 'GEOMETRY' },
    // placement scalars (block 2, placeonstock) — origin owned by the placement (region is local-0-based)
    { param: 'originX', blockIndex: 2, key: 'offX', type: 'number', default: CONTOUR_DEFAULTS.originX, label: 'Origin X', section: 'GEOMETRY' },
    { param: 'originY', blockIndex: 2, key: 'offY', type: 'number', default: CONTOUR_DEFAULTS.originY, label: 'Origin Y', section: 'GEOMETRY' },
    { param: 'stockAttach', blockIndex: 2, key: 'stockAttach', type: 'enum', default: CONTOUR_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Attach to Stock', section: 'GEOMETRY' },
    { param: 'pathDatum', blockIndex: 2, key: 'pathDatum', type: 'enum', default: CONTOUR_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Path Datum', section: 'GEOMETRY' },
    { param: 'stockDatum', blockIndex: 2, key: 'stockDatum', type: 'enum', default: CONTOUR_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, label: 'Stock Datum', section: 'GEOMETRY' },
    { param: 'stockW', blockIndex: 2, key: 'stockW', type: 'number', default: CONTOUR_DEFAULTS.stockW, label: 'Stock W', section: 'GEOMETRY' },
    { param: 'stockH', blockIndex: 2, key: 'stockH', type: 'number', default: CONTOUR_DEFAULTS.stockH, label: 'Stock H', section: 'GEOMETRY' },
    { param: 'stockZ', blockIndex: 2, key: 'stockZ', type: 'number', default: CONTOUR_DEFAULTS.stockZ, label: 'Stock Z', section: 'GEOMETRY' },
    { param: 'offZ', blockIndex: 2, key: 'offZ', type: 'number', default: CONTOUR_DEFAULTS.offZ, label: 'Z Offset', section: 'GEOMETRY' },
    // depth pass (block 3, stepdown)
    { param: 'depth', blockIndex: 3, key: 'to', type: 'number', default: CONTOUR_DEFAULTS.depth, label: 'Depth', section: 'TOOL & CUT' },
    { param: 'stepdown', blockIndex: 3, key: 'by', type: 'number', default: CONTOUR_DEFAULTS.stepdown, label: 'Step Down', section: 'TOOL & CUT' },
    // geometry + cut (block 4, the contourfill leaf). shape picks which dims matter; the 4 dims all bind, emit uses the right pair.
    { param: 'shape', blockIndex: 4, key: 'shape', type: 'enum', default: CONTOUR_DEFAULTS.shape, widget: 'dropdown', widgetConfig: { options: SHAPE_OPTIONS }, label: 'Shape', section: 'GEOMETRY' },
    { param: 'side', blockIndex: 4, key: 'side', type: 'enum', default: CONTOUR_DEFAULTS.side, widget: 'dropdown', widgetConfig: { options: SIDE_OPTIONS }, label: 'Side', help: 'Outside/Inside offset the cut by the tool radius so the FINISHED edge matches the size you type; On traces the boundary itself.', section: 'GEOMETRY' },
    { param: 'w', blockIndex: 4, key: 'w', type: 'number', default: CONTOUR_DEFAULTS.w, when: { param: 'shape', is: 'rect' }, label: 'Width', section: 'GEOMETRY' },
    { param: 'h', blockIndex: 4, key: 'h', type: 'number', default: CONTOUR_DEFAULTS.h, when: { param: 'shape', is: 'rect' }, label: 'Height', section: 'GEOMETRY' },
    { param: 'dia', blockIndex: 4, key: 'dia', type: 'number', default: CONTOUR_DEFAULTS.dia, when: { param: 'shape', is: 'circle' }, label: 'Diameter', section: 'GEOMETRY' },
    { param: 'sides', blockIndex: 4, key: 'sides', type: 'number', default: CONTOUR_DEFAULTS.sides, when: { param: 'shape', is: 'polygon' }, label: 'Sides', section: 'GEOMETRY' },
    { param: 'toolDia', blockIndex: 4, key: 'tool', type: 'number', default: CONTOUR_DEFAULTS.toolDia, label: 'Tool Ø', section: 'TOOL & CUT' },
    { param: 'feed', blockIndex: 4, key: 'feed', type: 'number', default: CONTOUR_DEFAULTS.feed, label: 'Feed', section: 'TOOL & CUT' },
    { param: 'plunge', blockIndex: 4, key: 'plunge', type: 'number', default: CONTOUR_DEFAULTS.plunge, label: 'Plunge', section: 'TOOL & CUT' },
];

const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const CONTOUR_BINDINGS = CONTOUR_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const CONTOUR_DATA_OPTYPE = 'user_contour_data';

/** Build the contour-as-data def — a fresh { opType, label, template, bindings } ready for registerUserOp. The template is
 *  contourStack(CONTOUR_DEFAULTS) (== BUILDERS(defaults), the canonical valid-by-construction stack); the hand-authored
 *  BINDINGS map is the independent artifact, proven byte-identical + binding-wiring by tests/contour-data-emit.spec.js. */
export function contourDataDef() {
    const exec = contourStack(CONTOUR_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form2d' } },
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Contour' }, children: [] },
        ],
        children: exec,
    }];
    return userOpFromStack('contour_data', 'Contour (data)', stack, CONTOUR_BINDINGS, 'form2d', null, 'mill_datawiz');
}
