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
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { deriveBindingsFor, mergeBindingsByParam, TOOL_BINDING_SPECS } from './deriveBindings.js';
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b — the declared mill entry point (entryX/entryY bind via POCKET_BINDING_SPECS)
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a — the declared tool-selection marker (toolNum binds via POCKET_BINDING_SPECS)
import { pruneGuards } from '../whenGuard.js';
import { regionDesc } from '../../wizards/ops/region.js';   // t716 — the true boundary ring (polygon/ellipse) for the 2D preview
import { pocketInsetRegion, stepoverMm } from '../../wizards/ops/pocketfill.js';   // t802 — the tool-inset boundary + ring spacing (one source with the emit)
import { concentricRings } from '../../wizards/ops/contour.js';   // t802 — the inward offset rings the concentric emit cuts (draw them in the 2D preview)
import { restValid, restRegion, restGreyReason } from '../../wizards/ops/restmachining.js';   // t871 — REST MACHINING: the _rest guard + the corner-sliver preview + the grey-out reason

/** Author defaults — match pocketStack's num() fallbacks AND the built-in Pocket form defaults (index.html p_*). */
export const POCKET_DEFAULTS = {
    shape: 'rect', w: 80, h: 60, dia: 50, sides: 6, toolDia: 6, wallOffset: 0, stepoverPct: 40,
    strategy: 'spiral', direction: 'bothways', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, wcs: 'active',
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
    restTool: 0, restDia: 0, restStepover: 40,   // t871 — REST MACHINING: 0 = no rest pass (byte-identical); a smaller tool clears the corners
};

const WCS_OPTIONS = [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']];
const SHAPE_OPTIONS = [['Rectangle', 'rect'], ['Circle', 'circle'], ['Polygon', 'polygon'], ['Ellipse', 'ellipse']];
const STRATEGY_OPTIONS = [['Spiral (concentric)', 'spiral'], ['Raster (parallel + wall)', 'raster']];
// t800 P6 — DIRECTION: the RASTER scan pattern, labelled per what the kernel (stepover.js fillStrategy) ACTUALLY does.
// bothways = boustrophedon zig-zag (links passes); oneway = climb (lift + rapid back each pass); otherway = conventional
// (same, reversed). Only the raster/scanline path reads it — concentric rings on a circle/rect ignore it (fixed dir), so
// the binding is gated `when strategy is raster` (no whenAny/OR to also catch spiral+polygon/ellipse; bothways is the safe default there).
const DIRECTION_OPTIONS = [['Zig-zag (both ways)', 'bothways'], ['One-way climb', 'oneway'], ['One-way conventional', 'otherway']];
// t804 — DEPTH ENTRY: the per-level descent. Plunge = straight down (default); Ramp = a linear descent at ≤ the angle
// (greys → plunge when the pocket is too small); Helix = a descending helix (the existing helix atom), pitch = mm/rev.
const ENTRY_OPTIONS = [['Plunge (straight)', 'plunge'], ['Ramp', 'ramp'], ['Helix', 'helix']];
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
    { param: 'stockDatum', formHidden: true, type: 'enum', key: 'stockDatum', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, label: 'Stock Datum', section: G },
    { param: 'stockW', formHidden: true, type: 'number', key: 'stockW', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockW, label: 'Stock W', section: G },
    { param: 'stockH', formHidden: true, type: 'number', key: 'stockH', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockH, label: 'Stock H', section: G },
    { param: 'stockZ', formHidden: true, type: 'number', key: 'stockZ', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.stockZ, label: 'Stock Z', section: G },
    { param: 'offZ', type: 'number', key: 'offZ', match: { type: 'placeonstock' }, default: POCKET_DEFAULTS.offZ, label: 'Z Offset', section: G },
    // geometry (fan-out to both leaves)
    { param: 'shape', type: 'enum', key: 'shape', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.shape, widget: 'dropdown', widgetConfig: { options: SHAPE_OPTIONS }, label: 'Shape', section: G },
    { param: 'shape', type: 'enum', key: 'shape', match: { type: 'pocketwall' }, optional: true },
    ...leafPair('w', 'w', 'number', { default: POCKET_DEFAULTS.w, when: { param: 'shape', in: ['rect', 'ellipse'] }, label: 'Width', section: G }),   // t722 P2a — per-shape visibility
    ...leafPair('h', 'h', 'number', { default: POCKET_DEFAULTS.h, when: { param: 'shape', in: ['rect', 'ellipse'] }, label: 'Height', section: G }),
    ...leafPair('dia', 'dia', 'number', { default: POCKET_DEFAULTS.dia, when: { param: 'shape', in: ['circle', 'polygon'] }, label: 'Diameter', section: G }),
    ...leafPair('sides', 'sides', 'number', { default: POCKET_DEFAULTS.sides, when: { param: 'shape', is: 'polygon' }, label: 'Sides', section: G }),
    // t800 P6 — the CLEARING cluster (strategy → direction → stepover) lands together right after shape/size (strategy, the
    // structural driver, is spliced in ahead of these in pocketDataDef). direction gates to raster — the only path the kernel scans.
    { param: 'direction', type: 'enum', key: 'direction', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.direction, widget: 'dropdown', widgetConfig: { options: DIRECTION_OPTIONS }, label: 'Direction', section: T, group: 'clearing', when: { param: 'strategy', is: 'raster' }, help: 'Raster scan pattern: Zig-zag links passes back-and-forth (fastest); One-way lifts and rapids back before each pass for a consistent climb (or conventional) cut. Applies to the raster passes — concentric rings keep their fixed direction.' },
    { param: 'stepoverPct', type: 'number', key: 'stepoverPct', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.stepoverPct, label: 'Stepover %', section: T, group: 'clearing' },
    // t804 — DEPTH ENTRY (in the clearing cluster): the per-level descent + its per-mode fields (when-gated).
    { param: 'entry', type: 'enum', key: 'entry', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS }, label: 'Depth Entry', section: T, group: 'clearing', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a linear descent at ≤ the ramp angle (degrades to plunge, with the reason, on a pocket too small for it). Helix = a descending helix at the helix Ø, pitch mm per rev.' },
    { param: 'rampAngle', type: 'number', key: 'rampAngle', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.rampAngle, label: 'Ramp Angle', section: T, group: 'clearing', when: { param: 'entry', is: 'ramp' }, units: '°', help: 'Max descent angle of the ramp (degrees from horizontal). Shallower = gentler on the tool; too shallow needs a longer run than a small pocket has (then it degrades to a straight plunge).' },
    { param: 'helixDia', type: 'number', key: 'helixDia', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.helixDia, label: 'Helix Ø', section: T, group: 'clearing', when: { param: 'entry', is: 'helix' }, units: 'mm', help: 'Diameter of the descending helix (mm). 0 = auto (the tool Ø). Clamped so the helix + tool stays inside the pocket.' },
    { param: 'helixPitch', type: 'number', key: 'helixPitch', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.helixPitch, label: 'Helix Pitch', section: T, group: 'clearing', when: { param: 'entry', is: 'helix' }, units: 'mm/rev', help: 'How far the helix descends per full revolution (mm/rev). Smaller = gentler entry, more revolutions.' },
    ...leafPair('toolDia', 'toolDia', 'number', { default: POCKET_DEFAULTS.toolDia, label: 'Tool Ø', section: T }),
    ...leafPair('wallOffset', 'wallOffset', 'number', { default: POCKET_DEFAULTS.wallOffset, label: 'Wall Offset ±', section: T, help: 'Signed wall offset (mm): + cuts OVERSIZE (walls out), − cuts UNDERSIZE / leaves stock. 0 = the exact typed size.' }),
    ...leafPair('feed', 'feed', 'number', { default: POCKET_DEFAULTS.feed, label: 'Feed', section: T }),
    // depth pass (stepdown, clearing arm) + the drill arm (tooSmall) carry the SAME params at different keys
    { param: 'depth', type: 'number', units: 'mm', key: 'to', match: { type: 'stepdown' }, optional: true, default: POCKET_DEFAULTS.depth, label: 'Depth', section: T },
    { param: 'depth', type: 'number', units: 'mm', key: 'depth', match: { type: 'drill' }, optional: true },
    { param: 'stepdown', type: 'number', units: 'mm', key: 'by', match: { type: 'stepdown' }, optional: true, default: POCKET_DEFAULTS.stepdown, label: 'Step Down', section: T },
    { param: 'stepdown', type: 'number', units: 'mm', key: 'peck', match: { type: 'drill' }, optional: true },
    // plunge → both leaves + the drill's FEED (drill plunges at the plunge feed); clearance → progstart + both leaves + drill
    { param: 'plunge', type: 'number', units: 'mm/min', key: 'plunge', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.plunge, label: 'Plunge', section: T },
    { param: 'plunge', type: 'number', units: 'mm/min', key: 'plunge', match: { type: 'pocketwall' }, optional: true },
    { param: 'plunge', type: 'number', units: 'mm/min', key: 'feed', match: { type: 'drill' }, optional: true },
    { param: 'clearance', type: 'number', units: 'mm', key: 'clearance', match: { type: 'progstart' }, default: POCKET_DEFAULTS.clearance, label: 'Clearance', section: T },
    { param: 'rpm', type: 'number', key: 'rpm', match: { type: 'progstart' }, label: 'Spindle RPM', section: T, help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },   // t996 — rpm → progstart (no default → socket-held: blank keeps the Head)
    { param: 'clearance', type: 'number', units: 'mm', key: 'clearance', match: { type: 'pocketfill' }, optional: true },
    { param: 'clearance', type: 'number', units: 'mm', key: 'clearance', match: { type: 'pocketwall' }, optional: true },
    { param: 'clearance', type: 'number', units: 'mm', key: 'clearance', match: { type: 'drill' }, optional: true },
    // t726 P2b — the entry-point declaration. IN the bindingSpecs (not entryBindingsFor) so it RE-DERIVES over the PRUNED
    // stack each instantiate (pocket's entry index shifts with strategy/tooSmall — a static superset index would miss).
    { param: 'entryX', type: 'number', key: 'entryX', match: { type: 'entry' }, default: '' },
    { param: 'entryY', type: 'number', key: 'entryY', match: { type: 'entry' }, default: '' },
    // t768 P1a — the tool-selection declaration. IN the bindingSpecs (re-derived over the pruned stack each instantiate).
    ...TOOL_BINDING_SPECS,
];

/** The strategy fork is a STRUCTURAL driver (guard key), no block socket — declared as a bindingless (blockIndex-free)
 *  binding so withGuardDefaults fills it before prune + the form renders it. tooSmall is NOT here (it's the derive-hook). */
// t871 — the rest fields GREY (with the why) on a smooth shape: circle/ellipse have no corners → no rest to clear. The
// r2 ≥ r1 case is caught at emit (restValid false → byte-identical) + the restGreyReason (declared why); the shape gate is
// what whenOk can express declaratively (no param-to-param compare / OR).
const SMOOTH_GATE = { param: 'shape', in: ['circle', 'ellipse'], tip: 'Smooth walls (circle / ellipse) leave no corner material — there is no rest to clear.' };
const POCKET_STRUCT_BINDINGS = [
    { param: 'strategy', help: "Clearing pattern: Spiral = concentric offset rings inward (no wall pass); Raster = parallel zig-zag passes then a wall-finish pass.", type: 'enum', default: POCKET_DEFAULTS.strategy, widget: 'dropdown', widgetConfig: { options: STRATEGY_OPTIONS }, label: 'Strategy', section: T, group: 'clearing' },   // t800 P6 — group:'clearing' + spliced ahead of direction/stepover so it LEADS the cluster
    // t871 — REST MACHINING: a smaller 2nd tool clears the corner material this tool leaves. restTool picks the tool (fills
    // restDia); restDia > 0 on a cornered shape (rect/polygon) appends the rest pass. Bindingless (structural drivers of the
    // geometry-derived _rest guard) so they always render + drive prune; the value sockets bind on the pocketrest leaf.
    { param: 'restTool', type: 'number', default: POCKET_DEFAULTS.restTool, widget: 'toolpick', widgetConfig: { fill: { dia: 'restDia' } }, label: 'Rest tool', section: T, group: 'rest', gate: SMOOTH_GATE, help: 'REST MACHINING: pick a SMALLER second tool to clear the corner material this tool leaves (rect + polygon only — smooth walls have no corners). Its Ø fills Rest tool Ø below.' },
    { param: 'restDia', type: 'number', default: POCKET_DEFAULTS.restDia, label: 'Rest tool Ø', units: 'mm', section: T, group: 'rest', gate: SMOOTH_GATE, help: 'Diameter of the rest tool (mm) — must be SMALLER than the main tool Ø. 0 = no rest pass (byte-identical). Filled by the Rest tool picker, or type it.' },
    { param: 'restStepover', type: 'number', default: POCKET_DEFAULTS.restStepover, label: 'Rest stepover %', section: T, group: 'rest', gate: SMOOTH_GATE, help: 'Stepover of the rest tool as a % of its Ø (like the main stepover). Only used when a rest tool is set.' },
];

// t867 — FEEDS & SPEEDS: the material picker + the advisory "Suggest feed" button (the feedsuggest composite widget).
// A bindingless binding (no socket) in TOOL & CUT next to Feed — it drives NO G-code, so an unset/empty material is
// byte-identical; a picked material round-trips like a dropdown (the widget's read omits it when empty).
const MATERIAL_BINDING = { param: 'material', type: 'enum', default: '', widget: 'feedsuggest', label: 'Material', section: T, help: 'Feeds & speeds helper: pick the stock material, then ✨ Suggest fills Feed from the tool Ø / flutes and the declared spindle (RPM = surface speed ÷ circumference, clamped to the spindle range; feed = RPM × flutes × chip load). Advisory — it never overwrites until you click, and you own the final numbers.' };

export const POCKET_DATA_OPTYPE = 'user_pocket_data';

const _pn = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
const _circlePath = (cx, cy, r) => { const pts = []; for (let i = 0; i <= 48; i++) { const a = 2 * Math.PI * i / 48; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); } return { pts, cls: 'fc-guide' }; };
// t718 — bbox over a set of {pts} paths (the origin-inclusive boundary extent, for the layout placement-parity shift).
const _pbb = (ps) => { let b = null; for (const p of (ps || [])) for (const q of (p.pts || [])) { if (!b) b = { minX: q.x, maxX: q.x, minY: q.y, maxY: q.y }; else { if (q.x < b.minX) b.minX = q.x; if (q.x > b.maxX) b.maxX = q.x; if (q.y < b.minY) b.minY = q.y; if (q.y > b.maxY) b.maxY = q.y; } } return b; };
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
    // t718 — the origin-inclusive boundary bbox: the twin's pocket geometry emits 0-relative (origin rides the placement
    // offX), so the layout consumer places against THIS drawn-frame bbox → the pocket frames the traced clearing passes.
    const bbox = _pbb(paths);   // the boundary bbox — computed BEFORE the inner rings (which are ⊂ the boundary anyway)
    // t802 — CONCENTRIC strategy: draw the actual inward offset RINGS the emit cuts, from the SAME concentricRings source
    // (over the tool-inset region) — so the 2D layout shows the octagon/ellipse clearing pattern, not just the boundary,
    // and the drawn rings equal the cut rings by construction. (Raster keeps the boundary-only preview.)
    if ((p.strategy || 'spiral') === 'spiral') {
        try {
            for (const ring of concentricRings(pocketInsetRegion(p), stepoverMm(p))) {
                if (ring && ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-guide' });
            }
        } catch (_) { /* degenerate pocket (smaller than the tool) — no rings to draw */ }
    }
    // t871 — REST regions: the corner slivers a smaller 2nd tool clears, drawn in a DISTINCT colour (fc-rest) between the
    // r1- and r2-cleared boundaries. Only when a valid rest tool is declared on a cornered shape (rect/polygon).
    try {
        const rest = restRegion(p);
        if (rest) for (const ring of [rest.ring1, rest.ring2]) {
            if (ring && ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-rest' });
        }
    } catch (_) { /* no rest to draw */ }
    return { paths, handles, bbox };
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
        children: appendToolSel(appendEntry(pocketStack(defaults, { superset: true }))),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing)
    }];
}

// The FORM bindings are DERIVED over a CANONICAL-pruned stack (raster + big pocket → every clearing socket present once)
// then DEDUPED by param (fan-out yields N specs per param; the form wants ONE — keep the first, which carries the label).
const CANONICAL_BIND = { ...POCKET_DEFAULTS, strategy: 'raster', _tooSmall: false, _rest: true, restDia: 3 };   // t871 — _rest+a real restDia so the pocketrest leaf is present → restDia/restStepover derive their bindings
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(pocketDataStack(POCKET_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const POCKET_BINDINGS = mergeBindingsByParam(deriveBindingsFor(canonicalPrunedStack(), POCKET_BINDING_SPECS));

/** Build the pocket-as-data def — the superset-twin pattern (corner/middle): bindingSpecs (emit re-derivation) + a
 *  structural strategy toggle + the derive-guards hook (_tooSmall) + postInstantiate (the derived drill centre). */
export function pocketDataDef() {
    // t800 P6 — the CLEARING cluster reads strategy → direction → stepover. strategy is the structural driver (appended
    // separately, so it would otherwise trail at the form's end); splice it in just before the first derived clearing
    // binding (direction) so the toggle LEADS its gated dependents, right after shape/size.
    const clAt = POCKET_BINDINGS.findIndex((b) => b.group === 'clearing');
    const withStrategy = clAt < 0
        ? [...POCKET_BINDINGS, ...POCKET_STRUCT_BINDINGS]
        : [...POCKET_BINDINGS.slice(0, clAt), ...POCKET_STRUCT_BINDINGS, ...POCKET_BINDINGS.slice(clAt)];
    // t867 — the feeds-helper sits right after Feed in the TOOL & CUT cluster (it fills that field).
    const fdAt = withStrategy.findIndex((b) => b.param === 'feed');
    const orderedBindings = fdAt < 0
        ? [...withStrategy, MATERIAL_BINDING]
        : [...withStrategy.slice(0, fdAt + 1), MATERIAL_BINDING, ...withStrategy.slice(fdAt + 1)];
    const def = userOpFromStack('pocket_data', 'Pocket (data)', pocketDataStack(POCKET_DEFAULTS),
        orderedBindings, 'form3d+2d');   // t726 P2b — entryX/entryY are in POCKET_BINDINGS (via the specs, re-derived by bindingSpecs)
    def.bindingSpecs = POCKET_BINDING_SPECS;                       // re-derive value sockets BY IDENTITY over the PRUNED stack each build
    def.deriveGuards = (p) => ({ _tooSmall: pocketTooSmall(p || {}), _rest: restValid(p || {}) && !pocketTooSmall(p || {}) });   // t871 — _rest: a valid smaller rest tool on a cornered pocket (GEOMETRY-DERIVED, injected before prune)
    def.postInstantiate = (stack, resolved) => {                  // rewrite the DERIVED sockets the frozen superset baked at DEFAULT geometry
        const { cx, cy } = pocketDrillCentre(resolved || {});     // the drill arm's plunge point (geometry-derived)
        const bb = pocketBBox(resolved || {});                    // the PlaceOnStock footprint bbox (drives placementShift's corner; baked-stale otherwise → a phantom shift)
        const r = resolved || {};
        for (const b of flattenBlocks(stack)) {
            if (!b || !b.params) continue;
            if (b.type === 'drill') { b.params.x = cx; b.params.y = cy; }
            else if (b.type === 'placeonstock') { b.params.bminX = bb.minX; b.params.bmaxX = bb.maxX; b.params.bminY = bb.minY; b.params.bmaxY = bb.maxY; }
            else if (b.type === 'pocketrest') {   // t871 — the rest leaf is frozen at DEFAULT geometry in the superset; rewrite ALL its params from the resolved op (one source, no fan-out bindings)
                for (const k of ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'restDia', 'restStepover', 'depth', 'feed', 'plunge', 'clearance']) if (r[k] !== undefined) b.params[k] = r[k];
                if (r.stepdown !== undefined) b.params.by = r.stepdown;
            }
        }
        return spindleHeadPatch(stack);   // t945 — after the derived-socket rewrite, fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    };
    def.previewGeometry = pocketPreviewGeometry;   // t716 — per-feature 2D handles (shape boundary + pos/size per kind) via the declared hook
    def.entryPoint = ENTRY_POINT;   // t726 P2b — the emitting-square entry marker (replaces the sim-only ○)
    return def;
}
