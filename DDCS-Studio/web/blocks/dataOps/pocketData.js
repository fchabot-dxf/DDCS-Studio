/**
 * blocks/dataOps/pocketData.js — the POCKET clearing built-in as a pure DATA definition (E1 EMIT).
 *
 * Pocket is the FIRST COARSE-atom SUPERSET twin. Unlike drill/slot/surfacing/contour (no structural fork → frozen
 * positional bindings), pocket has TWO structural forks — `strategy` (raster → a parallel clearing + a wall finish /
 * spiral → concentric) + `tooSmall` (a pocket smaller than the tool → a single drill-plunge instead of a stepover). So
 * the template is pocketStack(DEFAULTS, {superset:true}) with GUARD blocks, and the value sockets bind BY IDENTITY
 * (bindingSpecs, re-derived over the PRUNED stack every build — like corner/middle), NOT by frozen (blockIndex,key). The
 * FLAT pocketfill/pocketwall leaves (E0 region-pill→flat reframe) carry every geometry dim as a clean socket.
 *
 * TWO E1 mechanisms this port introduces (approved t468):
 *  · setUserDeriveGuards — `tooSmall` is GEOMETRY-DERIVED (not any single user param), so def.deriveGuards computes
 *    `_tooSmall` from the resolved params + instantiate injects it BEFORE prune, so the tooSmall guard keys on it.
 *  · postInstantiate — the drill arm's x/y are the DERIVED pocket centre; the frozen superset bakes them at the DEFAULT
 *    geometry, so postInstantiate rewrites them from the resolved params (pocketDrillCentre) after prune (corner pattern).
 *
 * FAN-OUT: clearance/feed/plunge/originX/originY drive MULTIPLE sockets (across progstart/placeonstock/stepdown/pocketfill/
 * pocketwall/drill) — a param → N specs, each `optional` (present only in its arm). Every {type} match is UNIQUE per pruned
 * state (each block type appears at most once). Proven byte-identical to pocketStack across strategy × tooSmall (BOTH states)
 * × the 4 shapes × a scalar sweep + cross-dialect (tests/pocket-data-emit.spec.js).
 */
import { pocketStack, pocketTooSmall, pocketDrillCentre, pocketBBox } from '../../wizards/pocketWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards } from '../whenGuard.js';
import { regionDesc } from '../../wizards/ops/region.js';   // t716 — the true boundary ring (polygon/ellipse) for the 2D preview

/** Author defaults — match pocketStack's num() fallbacks AND the built-in Pocket form defaults (index.html p_*). */
export const POCKET_DEFAULTS = {
    shape: 'rect', w: 80, h: 60, dia: 50, sides: 6, toolDia: 6, wallOffset: 0, stepoverPct: 40,
    strategy: 'spiral', depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, wcs: 'active',
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

const WCS_OPTIONS = [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']];
const SHAPE_OPTIONS = [['Rectangle', 'rect'], ['Circle', 'circle'], ['Polygon', 'polygon'], ['Ellipse', 'ellipse']];
const STRATEGY_OPTIONS = [['Spiral (concentric)', 'spiral'], ['Raster (parallel + wall)', 'raster']];
const XY_DATUM_OPTIONS = [
    ['Follow stock datum', ''], ['Front Left', 'nn'], ['Front Center', 'cn'], ['Front Right', 'pn'],
    ['Center Left', 'nc'], ['Center', 'cc'], ['Center Right', 'pc'], ['Back Left', 'np'], ['Back Center', 'cp'], ['Back Right', 'pp'],
];
const STOCK_DATUM_OPTIONS = [
    ['Front Left / Top', 'nnp'], ['Front Center / Top', 'cnp'], ['Front Right / Top', 'pnp'],
    ['Center Left / Top', 'ncp'], ['Center / Top', 'ccp'], ['Center Right / Top', 'pcp'],
    ['Back Left / Top', 'npp'], ['Back Center / Top', 'cpp'], ['Back Right / Top', 'ppp'],
];

const G = 'GEOMETRY', T = 'TOOL & CUT';
/** A dim BOTH flat leaves carry → 2 specs: pocketfill (primary — form label/default) + pocketwall (secondary). Both optional
 *  (absent in the drill arm). {type} match is unique per pruned state, so it lands on the sole block of that type. */
const leafPair = (param, key, type, extra) => [
    { param, type, key, match: { type: 'pocketfill' }, optional: true, ...extra },
    { param, type, key, match: { type: 'pocketwall' }, optional: true },
];

// ── VALUE bindingSpecs (identity-by-type over the pruned superset) ──────────────────────────────────────────────
const POCKET_BINDING_SPECS = [
    { param: 'wcs', type: 'enum', key: 'wcs', match: { type: 'wcs' }, default: POCKET_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, label: 'WCS', section: G },
    // placement (placeonstock, always present) — origin ALSO rides the leaves (pocket geometry carries its origin)
    { param: 'originX', type: 'number', key: 'offX', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.originX, label: 'Origin X', section: G },
    { param: 'originY', type: 'number', key: 'offY', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.originY, label: 'Origin Y', section: G },
    { param: 'originX', type: 'number', key: 'originX', match: { type: 'pocketfill' }, optional: true },
    { param: 'originX', type: 'number', key: 'originX', match: { type: 'pocketwall' }, optional: true },
    { param: 'originY', type: 'number', key: 'originY', match: { type: 'pocketfill' }, optional: true },
    { param: 'originY', type: 'number', key: 'originY', match: { type: 'pocketwall' }, optional: true },
    { param: 'stockAttach', type: 'enum', key: 'stockAttach', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Attach to Stock', section: G },
    { param: 'pathDatum', type: 'enum', key: 'pathDatum', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Path Datum', section: G },
    { param: 'stockDatum', type: 'enum', key: 'stockDatum', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, label: 'Stock Datum', section: G },
    { param: 'stockW', type: 'number', key: 'stockW', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockW, label: 'Stock W', section: G },
    { param: 'stockH', type: 'number', key: 'stockH', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockH, label: 'Stock H', section: G },
    { param: 'stockZ', type: 'number', key: 'stockZ', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockZ, label: 'Stock Z', section: G },
    { param: 'offZ', type: 'number', key: 'offZ', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.offZ, label: 'Z Offset', section: G },
    // geometry (fan-out to both leaves)
    { param: 'shape', type: 'enum', key: 'shape', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.shape, widget: 'dropdown', widgetConfig: { options: SHAPE_OPTIONS }, label: 'Shape', section: G },
    { param: 'shape', type: 'enum', key: 'shape', match: { type: 'pocketwall' }, optional: true },
    ...leafPair('w', 'w', 'number', { default: POCKET_DEFAULTS.w, label: 'Width', section: G }),
    ...leafPair('h', 'h', 'number', { default: POCKET_DEFAULTS.h, label: 'Height', section: G }),
    ...leafPair('dia', 'dia', 'number', { default: POCKET_DEFAULTS.dia, label: 'Diameter', section: G }),
    ...leafPair('sides', 'sides', 'number', { default: POCKET_DEFAULTS.sides, when: { param: 'shape', is: 'polygon' }, label: 'Sides', section: G }),
    ...leafPair('toolDia', 'toolDia', 'number', { default: POCKET_DEFAULTS.toolDia, label: 'Tool Ø', section: T }),
    ...leafPair('wallOffset', 'wallOffset', 'number', { default: POCKET_DEFAULTS.wallOffset, label: 'Wall Offset ±', section: T }),
    { param: 'stepoverPct', type: 'number', key: 'stepoverPct', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.stepoverPct, label: 'Stepover %', section: T },
    ...leafPair('feed', 'feed', 'number', { default: POCKET_DEFAULTS.feed, label: 'Feed', section: T }),
    // depth pass (stepdown, clearing arm) + the drill arm (tooSmall) carry the SAME params at different keys
    { param: 'depth', type: 'number', key: 'to', match: { type: 'stepdown' }, optional: true, default: POCKET_DEFAULTS.depth, label: 'Depth', section: T },
    { param: 'depth', type: 'number', key: 'depth', match: { type: 'drill' }, optional: true },
    { param: 'stepdown', type: 'number', key: 'by', match: { type: 'stepdown' }, optional: true, default: POCKET_DEFAULTS.stepdown, label: 'Step Down', section: T },
    { param: 'stepdown', type: 'number', key: 'peck', match: { type: 'drill' }, optional: true },
    // plunge → both leaves + the drill's FEED (drill plunges at the plunge feed); clearance → progstart + both leaves + drill
    { param: 'plunge', type: 'number', key: 'plunge', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.plunge, label: 'Plunge', section: T },
    { param: 'plunge', type: 'number', key: 'plunge', match: { type: 'pocketwall' }, optional: true },
    { param: 'plunge', type: 'number', key: 'feed', match: { type: 'drill' }, optional: true },
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'progstart' }, default: POCKET_DEFAULTS.clearance, label: 'Clearance', section: T },
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'pocketfill' }, optional: true },
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'pocketwall' }, optional: true },
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'drill' }, optional: true },
];

/** The strategy fork is a STRUCTURAL driver (guard key), no block socket — declared as a bindingless (blockIndex-free)
 *  binding so withGuardDefaults fills it before prune + the form renders it. tooSmall is NOT here (it's the derive-hook). */
const POCKET_STRUCT_BINDINGS = [
    { param: 'strategy', type: 'enum', default: POCKET_DEFAULTS.strategy, widget: 'dropdown', widgetConfig: { options: STRATEGY_OPTIONS }, label: 'Strategy', section: T },
];

export const POCKET_DATA_OPTYPE = 'user_pocket_data';

const _pn = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
const _circlePath = (cx, cy, r) => { const pts = []; for (let i = 0; i <= 48; i++) { const a = 2 * Math.PI * i / 48; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); } return { pts, cls: 'fc-guide' }; };
/** t716 — DECLARED preview geometry (twin-level): the pocket boundary (the finished-wall outline) PER SHAPE KIND — the
 *  multishape solved by declaration (the twin knows p.shape) — + a pos handle (originX/originY) + a size handle per kind
 *  (circle/polygon → radial Ø; rect/ellipse → rect W×H). Mirrors the built-in pocketView.buildPocketSpec. Preview-side → emit unaffected. */
export function pocketPreviewGeometry(p) {
    const ox = _pn(p.originX, 0), oy = _pn(p.originY, 0), shape = p.shape || 'rect';
    const paths = [], handles = [{ type: 'point', id: 'pk_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos' }];
    if (shape === 'circle') {
        const R = _pn(p.dia, 50) / 2;
        paths.push(_circlePath(ox, oy, R));
        handles.push({ type: 'radial', id: 'pk_size', field: 'dia', cx: ox, cy: oy, r: R, a: 0, rScale: 2, minR: 1, label: 'Ø' });
    } else if (shape === 'polygon') {
        try { const ring = (regionDesc({ shape: 'polygon', x: ox, y: oy, w: _pn(p.dia, 50), sides: _pn(p.sides, 6) }).contour || [])[0] || []; if (ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-guide' }); } catch (_) { /* degenerate */ }
        handles.push({ type: 'radial', id: 'pk_size', field: 'dia', cx: ox, cy: oy, r: _pn(p.dia, 50) / 2, a: 0, rScale: 2, minR: 1, label: 'Ø' });
    } else if (shape === 'ellipse') {
        try { const ring = (regionDesc({ shape: 'ellipse', x: ox, y: oy, w: _pn(p.w, 80), h: _pn(p.h, 60) }).contour || [])[0] || []; if (ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-guide' }); } catch (_) { /* degenerate */ }
        handles.push({ type: 'rect', id: 'pk_size', field: 'w', fieldH: 'h', ax: ox, ay: oy, ex: _pn(p.w, 80) / 2, ey: _pn(p.h, 60) / 2, sx: 0.5, sy: 0.5, minw: 1, minh: 1, label: 'W×H' });
    } else {
        const w = _pn(p.w, 80), h = _pn(p.h, 60);
        paths.push({ pts: [{ x: ox, y: oy }, { x: ox + w, y: oy }, { x: ox + w, y: oy + h }, { x: ox, y: oy + h }, { x: ox, y: oy }], cls: 'fc-path' });
        handles.push({ type: 'rect', id: 'pk_size', field: 'w', fieldH: 'h', ax: ox, ay: oy, ex: w, ey: h, sx: 1, sy: 1, minw: 1, minh: 1, label: 'W×H' });
    }
    return { paths, handles };
}

/** The wrapped superset template: pocketStack(DEFAULTS, {superset:true}) under the user_root/panel/sim/param_group prefix. */
function pocketDataStack(defaults) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Pocket' }, children: [] },
        ],
        children: pocketStack(defaults, { superset: true }),
    }];
}

// The FORM bindings are DERIVED over a CANONICAL-pruned stack (raster + big pocket → every clearing socket present once)
// then DEDUPED by param (fan-out yields N specs per param; the form wants ONE — keep the first, which carries the label).
const CANONICAL_BIND = { ...POCKET_DEFAULTS, strategy: 'raster', _tooSmall: false };
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(pocketDataStack(POCKET_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
function dedupeByParam(bindings) { const seen = new Set(); return bindings.filter((b) => (seen.has(b.param) ? false : (seen.add(b.param), true))); }
export const POCKET_BINDINGS = dedupeByParam(deriveBindingsFor(canonicalPrunedStack(), POCKET_BINDING_SPECS));

/** Build the pocket-as-data def — the superset-twin pattern (corner/middle): bindingSpecs (emit re-derivation) + a
 *  structural strategy toggle + the derive-guards hook (_tooSmall) + postInstantiate (the derived drill centre). */
export function pocketDataDef() {
    const def = userOpFromStack('pocket_data', 'Pocket (data)', pocketDataStack(POCKET_DEFAULTS),
        [...POCKET_BINDINGS, ...POCKET_STRUCT_BINDINGS], 'form3d+2d');
    def.bindingSpecs = POCKET_BINDING_SPECS;                       // re-derive value sockets BY IDENTITY over the PRUNED stack each build
    def.deriveGuards = (p) => ({ _tooSmall: pocketTooSmall(p || {}) });   // GEOMETRY-DERIVED guard key, injected before prune
    def.postInstantiate = (stack, resolved) => {                  // rewrite the DERIVED sockets the frozen superset baked at DEFAULT geometry
        const { cx, cy } = pocketDrillCentre(resolved || {});     // the drill arm's plunge point (geometry-derived)
        const bb = pocketBBox(resolved || {});                    // the PlaceOnStock footprint bbox (drives placementShift's corner; baked-stale otherwise → a phantom shift)
        for (const b of flattenBlocks(stack)) {
            if (!b || !b.params) continue;
            if (b.type === 'drill') { b.params.x = cx; b.params.y = cy; }
            else if (b.type === 'placeonstock') { b.params.bminX = bb.minX; b.params.bmaxX = bb.maxX; b.params.bminY = bb.minY; b.params.bmaxY = bb.maxY; }
        }
        return stack;
    };
    def.previewGeometry = pocketPreviewGeometry;   // t716 — per-feature 2D handles (shape boundary + pos/size per kind) via the declared hook
    return def;
}
