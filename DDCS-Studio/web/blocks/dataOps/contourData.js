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
import { contourStack } from '../../wizards/stacks/contourWizard.js';
import { userOpFromStack } from '../userOps.js';
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings)
import { withPassesField } from './passesField.js';   // t1613 — the derived `passes` field (declared once, every depth+stepdown twin)
import { regionDesc } from '../../wizards/ops/region.js';      // t712 — the true boundary ring (polygon/ellipse) for the 2D preview
import { contourRegion } from '../../wizards/ops/contour.js';  // t712 — the OFFSET toolpath (tool-centre) so the 2D matches the cut
import { regionFromFlat } from '../../wizards/ops/contourfill.js';   // t2028 — the SAME shape→region-dims mapping the real emit reads (contourfill.js's own `emit` calls this), not a second hand-typed copy
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, ENTRY_OPTIONS_NO_HELIX } from './wizardOptions.js';   // t722 P2a rider — one-source; t842 depth entry (no helix — a profile trace)

/** Author defaults — match contourStack's num() fallbacks + the built-in Contour form defaults. Geometry is local-0-based
 *  (originX/originY ride the placement). All 4 shape dims present; the contourfill atom picks w×h vs dia+sides by shape. */
export const CONTOUR_DEFAULTS = {
    shape: 'rect', w: 80, h: 60, dia: 50, sides: 6, side: 'outside', toolDia: 6,
    entry: 'plunge', rampAngle: 3,   // t842 — depth entry (plunge default = byte-identical; no helix — a profile trace)
    depth: 4, stepdown: 1.5, feed: 2000, plunge: 200, clearance: 5, wcs: 'active',
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

const SHAPE_OPTIONS = [['Rectangle', 'rect'], ['Circle', 'circle'], ['Polygon', 'polygon'], ['Ellipse', 'ellipse']];
const SIDE_OPTIONS = [['Outside', 'outside'], ['Inside', 'inside'], ['On (finish)', 'on']];

// Pre-order flatten of contourStack's [progstart, wcs, placeonstock{ stepdown{ contourfill } }, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 stepdown · 4 contourfill · 5 progend
// (clearance NOT bound — frontier: fans out to progstart + the contourfill leaf. contourfill's x/y/z stay constant:
//  x=y=0 [local, origin rides the placement], z='z'.)
// t1758 — MACHINE VARIABLES ROLL OUT, mill family. Contour is NOT the "no structural fork" op its own header
// implies for token-eligibility purposes: it wraps the generic `stepdown` atom, which JS-UNROLLS its Z-level
// loop (blockEmitter.js kind==='depth'), and its own contourfill kernel branches heavily on shape/side/entry —
// unlike surfacing's fully-parametric `surfaceraster` (a controller-side runtime loop). Traced fresh against
// contourWizard.js/ops/contour.js/ops/contourfill.js, not copied from surfacing's verdicts.
const CONTOUR_EXEC_BINDINGS = [
    { param: 'wcs', tokenEligible: true, blockIndex: 1, key: 'wcs', type: 'enum', default: CONTOUR_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, label: 'WCS', section: 'GEOMETRY' },
    // placement scalars (block 2, placeonstock) — origin owned by the placement (region is local-0-based)
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offX', type: 'number', default: CONTOUR_DEFAULTS.originX, label: 'Origin X', section: 'GEOMETRY' },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offY', type: 'number', default: CONTOUR_DEFAULTS.originY, label: 'Origin Y', section: 'GEOMETRY' },
    { param: 'stockAttach', tokenEligible: true, blockIndex: 2, key: 'stockAttach', type: 'enum', default: CONTOUR_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Attach to Stock', section: 'GEOMETRY' },
    { param: 'pathDatum', tokenEligible: true, blockIndex: 2, key: 'pathDatum', type: 'enum', default: CONTOUR_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Path Datum', section: 'GEOMETRY' },
    { param: 'stockDatum', tokenEligible: true, formHidden: true, blockIndex: 2, key: 'stockDatum', type: 'enum', default: CONTOUR_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, label: 'Stock Datum', section: 'GEOMETRY' },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockW', type: 'number', default: CONTOUR_DEFAULTS.stockW, label: 'Stock W', section: 'GEOMETRY' },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockH', type: 'number', default: CONTOUR_DEFAULTS.stockH, label: 'Stock H', section: 'GEOMETRY' },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockZ', type: 'number', default: CONTOUR_DEFAULTS.stockZ, label: 'Stock Z', section: 'GEOMETRY' },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offZ', type: 'number', default: CONTOUR_DEFAULTS.offZ, label: 'Z Offset', section: 'GEOMETRY' },
    // depth pass (block 3, stepdown) — the generic `stepdown` atom (kind:'depth') JS-unrolls one G-code block per
    // Z level (blockEmitter.js's depthLevels loop) — a genuine line-count decision, not a re-coerced magnitude.
    { param: 'depth', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', blockIndex: 3, key: 'to', type: 'number', units: 'mm', default: CONTOUR_DEFAULTS.depth, label: 'Depth', section: 'TOOL & CUT' },
    { param: 'stepdown', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', blockIndex: 3, key: 'by', type: 'number', units: 'mm', default: CONTOUR_DEFAULTS.stepdown, label: 'Step Down', section: 'TOOL & CUT' },
    { param: 'confirmEvery', tokenRefusal: 'Decides whether the confirm-and-pause step exists at all — a threshold check made before the program is built, not a value read from one field.', blockIndex: 3, key: 'confirmEvery', type: 'number', default: 0, label: 'Confirm every N passes', section: 'TOOL & CUT', help: 'Pause + show a message + halt (M0) after every N depth passes (not the last) so you can clear chips / check the part, then press Cycle Start. 0 = off. A MACHINE pause — not visible in the sim.' },   // t1031
    // geometry + cut (block 4, the contourfill leaf). shape picks which dims matter; the 4 dims all bind, emit uses the right pair.
    // shape/side: read at wizard-build time by the twin's OWN contourBBox (a different point-generation kernel per
    // shape; side picks one of 3 fixed offset formulas) — categorical, not deferrable.
    { param: 'shape', tokenRefusal: 'Picks the region-generation kernel (rect / circle / polygon / ellipse each walk a different point set) — the program\'s shape depends on this before it can be built, not a value inside one.', blockIndex: 4, key: 'shape', type: 'enum', default: CONTOUR_DEFAULTS.shape, widget: 'dropdown', widgetConfig: { options: SHAPE_OPTIONS }, label: 'Shape', section: 'GEOMETRY' },
    { param: 'side', tokenRefusal: 'Picks which of three fixed offset formulas (outside / inside / on) computes the toolpath — a categorical choice read by the twin\'s own geometry build, not a value inside one.', blockIndex: 4, key: 'side', type: 'enum', default: CONTOUR_DEFAULTS.side, widget: 'dropdown', widgetConfig: { options: SIDE_OPTIONS }, label: 'Side', help: 'Outside/Inside offset the cut by the tool radius so the FINISHED edge matches the size you type; On traces the boundary itself.', section: 'GEOMETRY' },
    { param: 'w', tokenRefusal: 'Feeds the twin\'s own boundary-boundary build before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 4, key: 'w', type: 'number', units: 'mm', default: CONTOUR_DEFAULTS.w, when: { param: 'shape', in: ['rect', 'ellipse'] }, label: 'Width', section: 'GEOMETRY' },   // t722 P2a — W/H for rect AND ellipse
    { param: 'h', tokenRefusal: 'Feeds the twin\'s own boundary build before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 4, key: 'h', type: 'number', units: 'mm', default: CONTOUR_DEFAULTS.h, when: { param: 'shape', in: ['rect', 'ellipse'] }, label: 'Height', section: 'GEOMETRY' },
    // dia: a plain radius magnitude in every state EXCEPT shape:circle + entry:ramp, where it also sets the ramp
    // chord-line count (ops/contour.js circleTrace) — fail-closed (INV13's own doctrine) rather than picking the
    // common-case framing, since the two states disagree.
    { param: 'dia', tokenRefusal: 'On a circle with a ramp entry this also decides how many ramp-chord lines get built (not just its radius) — the program\'s shape can depend on this number, not just a value inside one.', blockIndex: 4, key: 'dia', type: 'number', units: 'mm', default: CONTOUR_DEFAULTS.dia, when: { param: 'shape', in: ['circle', 'polygon'] }, label: 'Diameter', section: 'GEOMETRY' },   // t722 P2a — Ø for circle AND polygon
    { param: 'sides', tokenRefusal: 'Sets the polygon\'s vertex count — a real loop bound, not a value inside one.', blockIndex: 4, key: 'sides', type: 'number', default: CONTOUR_DEFAULTS.sides, when: { param: 'shape', is: 'polygon' }, label: 'Sides', section: 'GEOMETRY' },
    { param: 'toolDia', tokenRefusal: 'Feeds the offset-toolpath computation (side inside/outside) before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 4, key: 'tool', type: 'number', units: 'mm', default: CONTOUR_DEFAULTS.toolDia, section: 'TOOL & CUT' },   // t1662 — label from SHARED_LABELS
    // t842 — DEPTH ENTRY: plunge or ramp (NO helix — a helix would gouge inside the profile). Polyline → ramp along the first
    // segment; circle → a helical lead-in around the arc. Degrades to plunge (with a why) if the first segment is too short.
    // t1758 — UNLIKE surfacing's own entry (eligible — surfaceraster is a fixed macro template regardless of mode):
    // contour is a literal transcript, so entry genuinely branches the JS kernel's own emitted line shape/count
    // (ops/contourfill.js, ops/contour.js) — same param name, opposite verdict (t1704's own warning).
    { param: 'entry', tokenRefusal: 'Picks a genuinely different descent shape in the literal transcript (a straight plunge vs. a ramp lead-in with its own line count) — not a value inside one.', blockIndex: 4, key: 'entry', type: 'enum', default: CONTOUR_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS_NO_HELIX }, label: 'Depth Entry', section: 'TOOL & CUT', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a lead-in descent at ≤ the ramp angle along the profile (degrades to plunge where the first segment is too short).' },
    // t1758 — UNLIKE pocket's rampAngle (deferrable, only clamps a descent angle): contour's own ops/contour.js
    // circleTrace derives `revs`/`n` (the literal ramp-chord line count) directly from rampAngle, and the polyline
    // path compares it against the available run to decide plunge-degrade — a real loop-bound + branch, not a
    // coercion casualty. Same param name, different op-specific wiring, NOT deferrable here.
    { param: 'rampAngle', tokenRefusal: 'Directly sets how many ramp-lead-in lines get built (and whether the descent degrades to a plunge) — the program\'s shape depends on this number, not a value inside one.', blockIndex: 4, key: 'rampAngle', type: 'number', default: CONTOUR_DEFAULTS.rampAngle, label: 'Ramp Angle', units: '°', when: { param: 'entry', is: 'ramp' }, section: 'TOOL & CUT', help: 'Max descent angle of the ramp lead-in (degrees from horizontal).' },
    { param: 'feed', tokenEligible: true, blockIndex: 4, key: 'feed', type: 'number', units: 'mm/min', default: CONTOUR_DEFAULTS.feed, label: 'Feed', section: 'TOOL & CUT' },
    { param: 'plunge', tokenEligible: true, blockIndex: 4, key: 'plunge', type: 'number', units: 'mm/min', default: CONTOUR_DEFAULTS.plunge, label: 'Plunge', section: 'TOOL & CUT' },
    { param: 'rpm', tokenRefusal: 'Falls back to the tool library\'s RPM when left blank — that fallback decision runs before the program is built.', tokenDeferrable: true, blockIndex: 0, key: 'rpm', type: 'number', socketHeld: true, label: 'Spindle RPM', section: 'TOOL & CUT', help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },   // t996 — rpm → progstart
];

// t2301 (BACKLOG 20) — dropped from 4 to 3: 'panel' removed from uiChildren below (id-collided with sim's own
// layout2d pane, see that node's own comment). Exactly the hazard t2257 caught on atcWarmupData.js — a stale
// hardcoded wrap left after panel's removal breaks every binding — caught here before committing, not after.
const WRAP_PREFIX_COUNT = 3;   // user_root + sim + param_group
export const CONTOUR_BINDINGS = CONTOUR_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const CONTOUR_DATA_OPTYPE = 'user_contour_data';

const _n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
// t718 — bbox over a set of {pts} paths (the origin-inclusive toolpath extent, for the layout placement-parity shift).
const _pbb = (ps) => { let b = null; for (const p of (ps || [])) for (const q of (p.pts || [])) { if (!b) b = { minX: q.x, maxX: q.x, minY: q.y, maxY: q.y }; else { if (q.x < b.minX) b.minX = q.x; if (q.x > b.maxX) b.maxX = q.x; if (q.y < b.minY) b.minY = q.y; if (q.y > b.maxY) b.maxY = q.y; } } return b; };
/** t712/t2028 — DECLARED preview geometry (twin-level, own param names). The MULTISHAPE is solved by DECLARATION, not by
 *  layoutSpecFromOp guessing: the twin KNOWS p.shape, so it returns the right boundary + size-handle FOR THAT KIND. The
 *  boundary ring + the OFFSET toolpath (what's cut) come from the SAME kernels the emit uses → the 2D can't diverge from
 *  the G-code. Handles write the TWIN params (originX/originY pos; w/h or dia size). Preview-side → emit unaffected.
 *  t2028 — the shape→region-dims mapping is no longer a 3rd hand-typed copy: `regionFromFlat` (contourfill.js) is the
 *  SAME function contourfill's own `emit` calls, reading its flat x/y — bridged here with the one real rename the twin
 *  and the atom disagree on (originX/originY vs x/y), the exact adapter `contourStack` already uses to build the atom's
 *  own params from these same twin fields. */
import { handleScale } from '../../wizards/ops/placement.js';
export function contourPreviewGeometry(p) {
    const ox = _n(p.originX, 0), oy = _n(p.originY, 0), shape = p.shape || 'rect';
    const brg = regionDesc(regionFromFlat({ ...p, x: p.originX, y: p.originY }));
    const hs = handleScale(p, '', ox, oy, _n(p.w, 80), _n(p.h, 60));
    const paths = [], handles = [{ type: 'point', id: 'ct_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos', ...hs.pos }];
    // the BOUNDARY you type (a closed guide ring, straight from the region kernel — correct for every shape)
    for (const ring of (brg.contour || [])) { if (ring && ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-guide' }); }
    // the OFFSET toolpath (tool-centre) — the SAME contourRegion the emit folds, so 2D == cut
    try { const rg = contourRegion({ region: brg, side: p.side || 'outside', tool: _n(p.toolDia, 6) }); for (const ring of (rg.contour || [])) { if (ring && ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-path' }); } } catch (_) { /* degenerate size → skip the offset ring */ }
    // the SIZE handle, PER KIND (declared, not sniffed): circle/polygon → radial Ø; rect/ellipse → rect W×H (ellipse = half-extent)
    if (shape === 'circle' || shape === 'polygon') {
        handles.push({ type: 'radial', id: 'ct_size', field: 'dia', cx: ox, cy: oy, r: _n(p.dia, 50) / 2, a: hs.size.a, rScale: 2, minR: 1, label: 'Ø' });
    } else if (shape === 'ellipse') {
        handles.push({ type: 'rect', id: 'ct_size', field: 'w', fieldH: 'h', minw: 1, minh: 1, label: 'W×H', ...hs.size, ax: ox + hs.pos.ax, ay: oy + hs.pos.ay, ex: hs.size.ex / 2, ey: hs.size.ey / 2 });
    } else {
        handles.push({ type: 'rect', id: 'ct_size', field: 'w', fieldH: 'h', minw: 1, minh: 1, label: 'W×H', ...hs.size });
    }
    // t718 — the origin-inclusive OFFSET-toolpath bbox (the drawn fc-path): the twin's contourfill geometry is FROZEN at 0
    // (originX rides the placement offX, unlike the built-in wizard), so the layout consumer places against THIS drawn-frame
    // bbox (not the emit's 0-relative liveExtent) → the offset ring coincides with the traced toolpath.
    const bbox = _pbb(paths.filter((q) => q.cls === 'fc-path')) || _pbb(paths);
    return { paths, handles, bbox };
}

/** Build the contour-as-data def — a fresh { opType, label, template, bindings } ready for registerUserOp. The template is
 *  contourStack(CONTOUR_DEFAULTS) (== BUILDERS(defaults), the canonical valid-by-construction stack); the hand-authored
 *  BINDINGS map is the independent artifact, proven byte-identical + binding-wiring by tests/contour-data-emit.spec.js. */
export function contourDataDef() {
    const exec = contourStack(CONTOUR_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // t2301 (BACKLOG 20) — 'panel' removed: inert + id-collided with sim's own layout2d pane (see
            // drillData.js's own t2301 comment for the full mechanism, first fixed for ATC at t2257).
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Contour' }, children: [] },
        ],
        children: appendToolSel(appendEntry(exec)),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing; no body-index shift)
    }];
    const def = userOpFromStack('contour_data', 'Contour (data)', stack, withPassesField([...toolBindingsFor(stack), ...CONTOUR_BINDINGS, ...entryBindingsFor(stack)]), 'form3d+2d', null, 'mill_datawiz');   // t1613 — the derived `passes` field, spliced after stepdown
    def.previewGeometry = contourPreviewGeometry;   // t712 — per-feature 2D handles (pos + shape size per kind) via the declared hook
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.zRuler = { depthParam: 'depth', stepParam: 'stepdown' };   // t1025 — the depth ruler strip down the LEFT of the 2D plan (reuses zRulerStrip, like pocket)
    def.postInstantiate = spindleHeadPatch;   // t945 — fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    return def;
}
