/**
 * wizards/ops/panelTypes.js — the small registry of PANEL LAYOUTS a custom wizard can use.
 *
 * Every op is a wizard; how its panel looks is one more thing the stack declares (def.panel, default 'form3d').
 * The generic userOpView reads this to show/hide the preview pane and pick 3D vs a 2D layout. The GUI "panel" block
 * (v2 authoring) is just a visual way to set def.panel — same registry.
 */
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { buildCanvasWidgets } from '../../viz/canvasWidgets.js';
import { middleAxes } from '../middleWizard.js';   // t1211 — the ONE middle axis-order resolver (the handle decls must agree with the emit)
import { opSimStarts, resolveRelToIndex } from '../../viz/opSimStarts.js';   // a `relTo` point anchors to the op's declared sim-start (incremental socket); resolveRelToIndex maps a SEMANTIC {row} → the surviving pass
import { markerWorldOf } from '../../viz/markerWorld.js';   // t301 Seam C — the ONE per-pass marker-world fn the 3D preview ALSO reads, so the Layout handle + the 3D ruby can't diverge
import { whenOk } from '../../blocks/whenGuard.js';   // a `when`-gated binding-group's handle shows only when its guard passes (③ — the prune-gated start handle)
import { datumXY, getWorkpiece, workpieceBackdrop } from '../../engine/workpiece.js';   // t359 — the datum crosshair; t385 — DRAW the workpiece INSIDE cavities (the pocket) from the DECLARED feature (stock-modal size)
import { opSimContext } from '../../viz/opSimContext.js';   // t554 — the DECLARED machine-frame-layout intent (homing's sim{toolMachine:true})
import { axisSpan, declaredHomeEdgeSide } from '../../engine/limitSwitches.js';   // t554 — the machine envelope span + the declared <edge>Home for the layout's HOME glyph
import { partZeroShift } from '../../viz/sceneFrame.js';   // t586 PREVIEW-PARITY E2c — THE ONE frame source: the layout stock rides part-zero (the stock PIN) exactly like the 3D, no local WCS math
import { BLOCKS } from './index.js';   // t708 — the block-def registry (type → def), to resolve an atom's DECLARED previewGeometry
import { builderOf } from '../../blocks/opBuilders.js';   // t708 — build the op's stack to find its geometry atom + its live params
import { getUserPreviewGeometry, flattenBlocks } from '../../blocks/userOps.js';   // t712 — a twin's DECLARED preview-geometry hook (slot/contour per-feature handles); t1627 — flattenBlocks: collect declared 2D shapes from the template
import { SHAPE_2D_TYPES } from './vizBlocks.js';   // t1627 — the ONE "is this a 2D shape declaration" set
import { evalExpr } from './expr.js';   // t1627 — shape fields take numbers OR expressions over the wizard's params (the ONE evaluator)
import { placeShiftOfStack } from '../../blocks/blockEmitter.js';
import { latheLayoutSpec } from '../../viz/latheProfileCanvas.js';   // t1273 — a LATHE op draws its half-profile here; the mill XY-stock layout has nothing to say about a bar on centres   // t718 LAYOUT PLACEMENT PARITY — the op's DECLARED placement shift (== the emit's), to draw previewGeometry PLACED

// t554 — the MACHINE-FRAME LAYOUT backdrop (the ENVELOPE rect + the declared HOME corner) — from settings.machine spans +
// settings.limits (the <edge>Home per axis). Machine coords, HOME pinned at the declared home edge. Null if no envelope.
function machineFrameSpec() {
    try {
        const st = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings() : {};
        const m = st.machine || {}, limits = st.limits || {};
        const X = Number(m.x) || 0, Y = Number(m.y) || 0;
        if (!(Math.abs(X) > 0) || !(Math.abs(Y) > 0)) return null;   // no envelope → fall back to the stock layout
        const homeOf = (axis, travel) => { const sp = axisSpan(travel); const side = declaredHomeEdgeSide(axis, limits) || sp.homeSide; return side === 'min' ? sp.lo : sp.hi; };
        return { x: X, y: Y, z: Number(m.z) || 0, homeX: homeOf('x', X), homeY: homeOf('y', Y) };
    } catch (_) { return null; }
}


export const PANEL_TYPES = {
    form:        { id: 'form',        label: 'Form only',      viz: false, mode: null },   // single column, no preview
    form3d:      { id: 'form3d',      label: 'Form + 3D',      viz: true,  mode: '3d' },   // form + the shared 3D preview (default)
    form2d:      { id: 'form2d',      label: 'Form + 2D',      viz: true,  mode: '2d' },   // form + a 2D stock layout of the op's xy/rect params
    'form3d+2d': { id: 'form3d+2d',   label: 'Form + 3D + 2D', viz: true,  mode: '3d2d' }, // BOTH: the 3D sim (+ declared per-pass markers) AND the 2D drag canvas (the built-in probe pattern, generalized — a visual data-op like Corner (data))
    commscreen:  { id: 'commscreen',  label: 'Form + DDCS screen', viz: true, mode: 'commscreen' },   // t518 — the Comm/MDI twin: form + a live mock of the controller's popup/status/input/beep screen (communicationWizard.generateScreenPreview) instead of a 3D toolpath
};
export const DEFAULT_PANEL = 'form3d';
export const panelType = (id) => PANEL_TYPES[id] || PANEL_TYPES[DEFAULT_PANEL];
export const LAYOUT_TYPES = {
    none:         { id: 'none',         label: 'No layout' },
    corner:       { id: 'corner',       label: 'Corner start layout' },
    drill:        { id: 'drill',        label: 'Drill pattern' },
    slot:         { id: 'slot',         label: 'Slot geometry' },
    surfacing:    { id: 'surfacing',    label: 'Surfacing region' },
    text:         { id: 'text',         label: 'Text outline' },
    pocket:       { id: 'pocket',       label: 'Pocket region' },
    contour:      { id: 'contour',      label: 'Contour profile' },
    edge:         { id: 'edge',         label: 'Edge probe starts' },
    middle:       { id: 'middle',       label: 'Middle probe starts' },
    alignment:    { id: 'alignment',    label: 'Alignment probe starts' },
    rotary_clock: { id: 'rotary_clock', label: 'Rotary clock probe' },
    rotary_center:{ id: 'rotary_center',label: 'Rotary center probe' },
    lathe_profile:{ id: 'lathe_profile',label: 'Lathe half-profile' },   // t1273 — Z across, radius up, centreline along the bottom
};
export const DEFAULT_LAYOUT = 'none';
export const layoutType = (id) => LAYOUT_TYPES[id] || LAYOUT_TYPES[DEFAULT_LAYOUT];

const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const r3 = (n) => Math.round(n * 1000) / 1000;

// A param is WRITABLE from the 2D canvas only if the form rendered it as a settable field (data-param). Number/slider
// fields are; multi-param canvas widgets (xy-pad) own their value internally, so we DON'T put a (dead) preview handle
// over those — the form widget already drags them. (The selector targets the live custom-op form.)
const _field = (name) => (typeof document !== 'undefined') ? document.querySelector('#wiz_user_form [data-param="' + (window.CSS ? CSS.escape(name) : name) + '"]') : null;
const _writable = (name) => !!_field(name);
// t1648 — a PREVIEW-ONLY side-store for a declared handle target with NO bound form field (e.g. a Skim-mode jog
// seed — deliberately never bound, so it never reaches the emit). Before this, `_writeParam` silently no-op'd on
// such a name (strictly additive: nothing that has a real field is affected). Exported so the caller (userOpView's
// update()) can merge it into `params` the same way `_simStartFracs` merges declared marker fractions — one
// established convention, reused rather than restated. The caller clears it per fresh wizard OPEN.
export const previewOnlyParams = {};
/** Clear every preview-only side-store entry (a fresh wizard OPEN = undragged = byte-identical — mirrors the
 *  _simStartFracs/_layoutSpots reset). A plain reassignment would break the exported binding other modules hold. */
export function clearPreviewOnlyParams() { for (const k in previewOnlyParams) delete previewOnlyParams[k]; }
// A real form field's write dispatches 'input', which the host's OWN listener re-renders on. A preview-only target
// has no field to dispatch on, so the caller (userOpView) registers its own (throttled) update trigger here —
// dependency injection, not a new import cycle (panelTypes.js is a lower layer than userOpView.js).
let _onPreviewOnlyWrite = null;
export function setPreviewOnlyWriteHandler(fn) { _onPreviewOnlyWrite = typeof fn === 'function' ? fn : null; }
// t808 — LOOP-GUARD (stepper-runaway fix b): a handle write-back only dispatches when the value ACTUALLY changes. An
// unchanged write (a jittery drag frame, or any render-time re-derive that lands the same number) must NOT fire a
// synthetic 'input' — otherwise it re-triggers update() → re-render → write-back → … a self-sustaining round-trip that
// walks/sticks the value. (Mirrors setParam's `s.value !== val` guard for the enum pickers.)
function _writeParam(name, val) {
    const next = r3(val);
    const f = _field(name);
    if (!f) {   // no bound field → the preview-only side-store, then ask the host to re-render (no 'input' to dispatch)
        if (previewOnlyParams[name] === next) return;   // unchanged → no re-render (the same loop-guard real fields get)
        previewOnlyParams[name] = next;
        if (_onPreviewOnlyWrite) _onPreviewOnlyWrite();
        return;
    }
    if (String(f.value) === String(next)) return;   // unchanged → no dispatch (breaks the write-back→recompute→write-back chain)
    f.value = next; f.dispatchEvent(new Event('input', { bubbles: true }));
}

// Derive a 2D FeatureCanvas spec from the op's xy / rect / circle-bound params — a top-down summary that mirrors what
// the canvas pickers set (xy group → a point; rect group → a rectangle; circle group → a disc), drawn on the configured
// stock — and DRAGGABLE: for groups whose params are writable fields, a handle drives them, so a custom wizard gets
// canvas drag-to-edit with no per-op code. The handles are DECLARED from the param-block roles and built by the SAME
// reusable gesture registry the built-in views use (viz/canvasWidgets — point / rect / radial), not a parallel onDrag.
// See ROADMAP "CANVAS-WIDGET consolidation" Stage 3 + the spatial-gui-form-vs-canvas memory.
/** The corner DATUM (a physical stock corner) for a corner op — the ONE place the {corner param + stock} → world-corner
 *  mapping lives, shared by layoutSpecFromOp's spot derive AND pinnedStartsFor (the 3D marker-parity source), so they can't
 *  drift. Returns null for a non-corner op or an unset corner. `stock` = { w, h }. */
export function cornerDatumXY(params, stock) {
    const cid = ({ 1: 'FL', 2: 'FR', 3: 'BL', 4: 'BR', FL: 'FL', FR: 'FR', BL: 'BL', BR: 'BR' }[params && params.corner]);
    if (!cid || !stock) return null;
    return ({ FL: { x: 0, y: 0 }, FR: { x: stock.w, y: 0 }, BL: { x: 0, y: stock.h }, BR: { x: stock.w, y: stock.h } })[cid];
}

/** t301 MARKER PARITY (Seam A source): the datum-PINNED wall worlds keyed by PASS INDEX, derived from the Layout's spot
 *  store (`spots`, keyed by group id) as cornerXY + spot — the ONE place the spot→world formula lives. The shared 3D/2D-top
 *  panel (computePassStarts) reads these so a spotted wall marker HOLDS (does not ride the dragged Start) exactly like the
 *  Layout, keeping both panels coincident. Empty / no-spot / non-corner → null. Mirrors layoutSpecFromOp's stock + cornerXY. */
export function pinnedStartsFor(def, params, spots) {
    if (!spots || !Object.keys(spots).length) return null;
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const stock = (s && s.x > 0 && s.y > 0) ? { w: s.x, h: s.y } : { w: 200, h: 150 };
    const cornerXY = cornerDatumXY(params, stock);
    if (!cornerXY) return null;
    const relToByGid = {};   // group id → its x-role relTo (the reposition/start group's anchor pass)
    for (const b of (def && def.bindings) || []) if (b.group && b.role === 'x' && b.relTo != null) relToByGid[b.group] = b.relTo;
    const out = {};
    for (const gid in spots) {
        const relTo = relToByGid[gid]; if (relTo == null) continue;
        const ri = resolveRelToIndex(def.opType, params, relTo);   // the anchor pass index among the whenOk-surviving sim-starts
        if (ri == null) continue;
        out[ri + 1] = { x: cornerXY.x + spots[gid].dx, y: cornerXY.y + spots[gid].dy };   // the destination (wall) pass = ri+1
    }
    return Object.keys(out).length ? out : null;
}

// t708 — DECLARED preview geometry (the GENERAL seam). Build the op's stack, find the first atom whose block-def
// declares previewGeometry(atomParams) → { paths:[{pts,cls}], handles:[canvasWidget decls] }, and return it. The atom
// DECLARES its vector geometry + drag handles (declare-not-infer); the twin's 2D renders whatever it declares. text is
// the first consumer (real letters + pos/rotation handles); per-feature handles for other ops ride this same hook later.
function _flattenStack(blocks, out = []) {
    for (const b of (blocks || [])) { if (!b) continue; out.push(b); if (b.uiChildren) _flattenStack(b.uiChildren, out); if (b.children) _flattenStack(b.children, out); }
    return out;
}
function _previewGeometryOf(def, params) {
    try {
        // TWIN-LEVEL hook first (slot/contour): the twin declares previewGeometry over its OWN param names — sidesteps the
        // atom-field↔twin-param rename (slot ax↔x0) + contour's cross-atom position (shape on filltext, origin on placement).
        const tw = def && def.opType && getUserPreviewGeometry(def.opType);
        if (tw) { const g = tw(params); if (g && (Array.isArray(g.paths) || Array.isArray(g.handles))) return g; }
        // ELSE atom-level hook (text): the geometry atom declares it (params == atom keys); build the stack to reach it.
        const bo = def && def.opType && builderOf(def.opType);
        const atoms = _flattenStack(bo ? bo(params) : (def && def.template) || []);
        const a = atoms.find((b) => b && b.type && BLOCKS[b.type] && typeof BLOCKS[b.type].previewGeometry === 'function');
        if (!a) return null;
        const g = BLOCKS[a.type].previewGeometry(a.params || params);
        return (g && (Array.isArray(g.paths) || Array.isArray(g.handles))) ? g : null;
    } catch (_) { return null; }
}

export function layoutSpecFromOp(def, params, simStart, sources, passEnds, spots, setSpots, panelStarts, simMarkers) {
    // t1273 — A LATHE OP DRAWS ITSELF. Everything below this line reasons about an XY stock rectangle: a datum corner,
    // a top-down footprint, corner picks. None of that means anything for a bar spinning on centres, so a lathe op
    // DECLARES its layout kind and gets its half-profile instead. Its handles route to the SAME _writeParam field
    // writer as every other canvas handle — a lathe drag and a mill drag reach the form by one path.
    const _lathe = latheLayoutSpec(def, params, (m) => { for (const k in m) _writeParam(k, m[k]); });
    if (_lathe) return _lathe;
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const stock = (s && s.x > 0 && s.y > 0) ? { w: s.x, h: s.y, ox: 0, oy: 0 } : { w: 200, h: 150, ox: 0, oy: 0 };
    // t359 — the part-zero crosshair follows the DATUM (the selected part-zero corner/centre), consistent with the stock
    // modal + the 3D. The corner-pick circles stay on the PHYSICAL corners (cornerDatumXY, datum-independent) — the datum
    // and the probed corner are INDEPENDENT. Display-only (the crosshair position); the emit is untouched. Default datum
    // ('nnp') → origin {0,0} = the min-XY corner = the prior behaviour, so nothing shifts unless a non-FL datum is set.
    const _dp = datumXY({ x: stock.w, y: stock.h, datum: s && s.datum });
    // t554 — MACHINE-FRAME layout flavor (DECLARED via the op's sim{toolMachine:true} → opSimContext.toolMachineFrame; homing):
    // draw the ENVELOPE rectangle + the declared HOME corner glyph as the backdrop (machine coords). t578 — the STOCK RIDES its
    // WCS inside the FIXED envelope. t586 PREVIEW-PARITY E2c — read part-zero from THE ONE frame source (sceneFrame.partZeroShift,
    // the SAME transform the 3D uses): the stock's DATUM corner lands at part-zero (min-XY = partZeroShift − datumXY), so the
    // layout stock coincides with the 3D stock. BEHAVIOR FIX vs t578's local wcsOffsetXY (the ACTIVE WCS): a stock pinned to a
    // NON-active WCS now follows its PIN like the 3D (before: it sat at the active WCS). Unpinned is unchanged (both = the active
    // fallback). The homing switch-seek still IGNORES this stock for COLLISION (createPreviewPanel stk=null) — render-only here.
    const machine = (def && def.opType && opSimContext(def.opType).toolMachineFrame) ? machineFrameSpec() : null;
    const stockOut = machine
        ? (() => { const pz = partZeroShift((typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().machine) || null, s, null); return { w: stock.w, h: stock.h, ox: pz.x - _dp.x, oy: pz.y - _dp.y }; })()
        : stock;
    const machSpread = machine ? { machine } : {};
    const origin = { x: (stock.ox || 0) + _dp.x, y: (stock.oy || 0) + _dp.y };
    // t120 — CORNER-MARKER INDEPENDENCE (Option A): the DATUM for the datum-relative marker spots = the CORNER position
    // (cornerXY, per-corner) — so a stored spot re-anchors when the corner changes. Only the corner op has one; absent →
    // no spot logic (other ops keep the incremental-socket behavior). `spots` = the persisted per-group datum-relative spot
    // store (userOpView); `setSpots` re-renders after a drag captures/sets them. `repoGroups` stashes each relTo emitting
    // group's live world + anchor so the drag can CAPTURE the un-dragged ones (freeze) → full independence after any drag.
    const cornerXY = cornerDatumXY(params, stock);   // the datum stock corner (shared with pinnedStartsFor — one source)
    const spotStore = (cornerXY && spots && typeof setSpots === 'function') ? spots : null;   // active only for a corner op with the store wired
    const repoGroups = [];   // { gid, fx, fy, ax, ay, worldX, worldY } per relTo emitting group (for the drag capture)
    // t81 — colour a handle by its pass's reposition SOURCE (auto=cyan / manual=amber), MATCHING the top panel. `sources` is the
    // per-pass array the panel exposes (getPassSources); absent → null → the FeatureCanvas keeps its CSS default (gold).
    const srcCol = (pass) => (!Array.isArray(sources)) ? null : (sources[pass] === 'manual' ? '#ffb300' : '#22d3ee');
    const groups = {};
    for (const b of (def.bindings || [])) { if (b.group) (groups[b.group] = groups[b.group] || []).push(b); }
    const items = [], decls = [];
    // t708 — DECLARED preview geometry (the general seam): an atom may declare real vector geometry + handles. Its handle
    // decls join `decls` (so they build through the SAME setFields writer round-trip below); its paths join a `paths` array
    // returned in the spec (FeatureCanvas draws paths as <path>). text's filltext is the first consumer (real letters + ↻/pos).
    const _pgeo = _previewGeometryOf(def, params);
    // t718 LAYOUT PLACEMENT PARITY — the previewGeometry is DUMB raw-param math (drawn at originX); PLACE it onto the stock
    // with the SAME shift the emit bakes (placeShiftOfStack → placeShiftFromParams) so the drawn rings/handles COINCIDE with
    // the traced toolpath (which is the placed emit). We BAKE the shift into the previewGeometry paths + handle RENDER positions
    // and INVERSE-map their drag world (world − shift → raw param) — NOT via spec.placement, so the already-placed sim Start ○
    // (drawn from the placed sim) is untouched. A twin whose preview frame differs from its emit geometry frame (drill/bore:
    // pattern emits 0-relative but draws at originX) declares its own origin-inclusive toolpath bbox (_pgeo.bbox) so the shift
    // lands the DRAWN feature; others fall through to the emit's liveExtent (identical result). Probe ops (no place block) → {0,0}.
    let _pShift = { x: 0, y: 0 };
    const _pgIds = new Set();
    if (_pgeo) {
        if (Array.isArray(_pgeo.handles)) for (const h of _pgeo.handles) { decls.push(h); if (h && h.id != null) _pgIds.add(h.id); }
        try { const _bo = builderOf(def.opType); if (_bo) { const s = placeShiftOfStack(_bo(params), _pgeo.bbox || null); _pShift = { x: s.x || 0, y: s.y || 0 }; } } catch (_) { /* no place block / unbuildable → no shift */ }
    }
    const _placed = _pShift.x || _pShift.y;
    const previewPaths = (_pgeo && Array.isArray(_pgeo.paths))
        ? (_placed ? _pgeo.paths.map((pth) => ({ ...pth, pts: (pth.pts || []).map((q) => ({ x: q.x + _pShift.x, y: q.y + _pShift.y })) })) : _pgeo.paths)
        : null;
    // t385 (human) — DRAW the workpiece INSIDE cavities (the pocket) in the 2D layout from the DECLARED workpiece
    // (getWorkpiece → the stock-modal-defined pos+size), so a Middle probe SHOWS the pocket it finds — matching the 3D
    // render + the probe-stop (ONE source, no hardcoded inset). Only inside cavities draw; an outer boss/solid has none →
    // unchanged for corner/edge. Drawn first (behind the handles/glyphs).
    try { items.push(...(workpieceBackdrop(getWorkpiece(), { ox: stock.ox || 0, oy: stock.oy || 0 }).items || [])); } catch (_) { /* no workpiece → no cavity */ }
    /**
     * ── t1627 — DECLARED SHAPE PRIMITIVES → canvas items (CONSUMED from the declaration, never re-derived) ─────
     * The template's shape blocks (Wizard Shapes: rect/circle/line/marker — wherever they sit, mouth-agnostic:
     * flattenBlocks walks every mouth) draw as the canvas's own item kinds. Each field is a number OR an
     * expression over the LIVE params (the ONE evaluator, params as scope — the t1566 caller-populated rule);
     * a field that resolves to nothing skips ITS shape only — an unfinished declaration never breaks the canvas.
     * Pushed here, early: declared shapes sit BEHIND the role-derived features and every handle, like the backdrop.
     */
    {
        const num1627 = (v) => {
            if (v == null || v === '') return NaN;
            const n = Number(v);
            if (Number.isFinite(n)) return n;
            try { const r = evalExpr(String(v), params || {}); return Number.isFinite(r) ? r : NaN; } catch (_) { return NaN; }
        };
        const shapes = (def && Array.isArray(def.template)) ? flattenBlocks(def.template).filter((b) => b && SHAPE_2D_TYPES.has(b.type)) : [];
        for (const b of shapes) {
            const P = b.params || {}, n = (k) => num1627(P[k]);
            if (b.type === 'shape_rect') {
                const x = n('x'), y = n('y'), w = n('w'), h = n('h');
                if ([x, y, w, h].every(Number.isFinite)) items.push({ kind: 'rect', x, y, w, h });
            } else if (b.type === 'shape_circle') {
                const cx = n('cx'), cy = n('cy'), dia = n('dia');
                if ([cx, cy, dia].every(Number.isFinite)) items.push({ kind: 'circle', cx, cy, r: dia / 2 });
            } else if (b.type === 'shape_line') {
                const x1 = n('x1'), y1 = n('y1'), x2 = n('x2'), y2 = n('y2');
                if ([x1, y1, x2, y2].every(Number.isFinite)) items.push({ kind: 'line', x1, y1, x2, y2 });
            } else if (b.type === 'shape_marker') {
                const x = n('x'), y = n('y');
                if ([x, y].every(Number.isFinite)) items.push({ kind: 'hole', x, y, r: Math.max(1, stock.w * 0.012) });   // the drill-pattern dot size (panelTypes' own convention)
            }
        }
    }
    for (const gid in groups) {
        // ③ — a `when`-gated group (e.g. corner's `start` #21/#22, gated on probeZFirst) renders its handle ONLY when the
        // guard passes: its socket is pruned away in the other state, so a handle there would be dead / write a stale param.
        const gWhen = groups[gid].find((b) => b.when);
        if (gWhen && !whenOk(gWhen.when, params)) continue;
        const byRole = {};
        for (const b of groups[gid]) byRole[b.role] = b;
        const p = (r) => byRole[r] ? num(params[byRole[r].param]) : undefined;
        const wr = (r) => byRole[r] && _writable(byRole[r].param);   // a role whose param is a settable form field
        // pos handle = a `point` gesture over the x/y params (built only when both are writable — never a dead handle).
        const pos = (ax = 0, ay = 0) => { if (wr('x') && wr('y')) decls.push({ type: 'point', id: gid + '_pos', fx: byRole.x.param, fy: byRole.y.param, x: p('x'), y: p('y'), ax, ay, label: 'pos' }); };
        // composable GUI (PILOT 2) — a binding may DECLARE its anchor kind+frame explicitly (the `layoutwidget` block) instead
        // of the role/param-name sniff → SWITCH on anchor.kind. kind 'point' + frame 'stock-min' = an ABSOLUTE PHYSICAL point
        // (ax=0, the datum model — datum-relative display is a later slice). The role ladder + the corner/edge/② magic-name
        // sniffs below stay as the FALLBACK (untouched) → corner/edge/middle byte-identical (they declare no anchor).
        const anchor = groups[gid].map((b) => b && b.anchor).find(Boolean);
        if (anchor && anchor.kind === 'point') { pos(); continue; }
        if (byRole.x && byRole.y && byRole.w && byRole.h && byRole.slant) {
            const x = p('x'), y = p('y'), w = p('w'), h = p('h'), slant = p('slant');
            const dx = Math.tan(slant / 180 * Math.PI) * h;
            items.push(
                { kind: 'line', x1: x, y1: y, x2: x + w, y2: y },
                { kind: 'line', x1: x + w, y1: y, x2: x + w + dx, y2: y + h },
                { kind: 'line', x1: x + w + dx, y1: y + h, x2: x + dx, y2: y + h },
                { kind: 'line', x1: x + dx, y1: y + h, x2: x, y2: y }
            );
            pos();
            if (wr('slant')) decls.push({ type: 'shear', id: gid + '_shear', field: byRole.slant.param, ax: x + w, ay: y, h: h, value: slant, label: 'slant°' });
        } else if (byRole.x && byRole.y && byRole.w && byRole.h) {
            const x = p('x'), y = p('y'), w = p('w'), h = p('h');
            items.push({ kind: 'rect', x, y, w, h });
            pos();
            if (wr('w') && wr('h')) decls.push({ type: 'rect', id: gid + '_size', field: byRole.w.param, fieldH: byRole.h.param, ax: x, ay: y, ex: w, ey: h, sx: 1, sy: 1, minw: 1, minh: 1, label: 'W', value: w });
        } else if (byRole.x && byRole.y && byRole.dia) {
            const x = p('x'), y = p('y'), dia = p('dia'), R = dia / 2;
            items.push({ kind: 'circle', cx: x, cy: y, r: R });
            pos();
            if (wr('dia')) decls.push({ type: 'radial', id: gid + '_size', field: byRole.dia.param, cx: x, cy: y, r: R, a: 0, rScale: 2, minR: 1, label: 'Ø', value: dia });
        } else if (byRole.x && byRole.y && byRole.w && byRole.scale) {
            const x = p('x'), y = p('y'), w = p('w'), scale = p('scale');
            const currentW = w * scale;
            items.push({ kind: 'line', x1: x, y1: y, x2: x + currentW, y2: y });
            pos();
            if (wr('scale')) decls.push({ type: 'scaleX', id: gid + '_scale', field: byRole.scale.param, ax: x, edgeX: x + currentW, ay: y, value: scale, min: 0.1, label: 'scale' });
        } else if (byRole.ax && byRole.ay && byRole.bx && byRole.by && byRole.width) {
            const ax = p('ax'), ay = p('ay'), bx = p('bx'), by = p('by'), W = p('width');
            const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;
            const mx = (ax + bx) / 2, my = (ay + by) / 2;
            const hw = W / 2;
            items.push(
                { kind: 'line', x1: ax, y1: ay, x2: bx, y2: by },
                { kind: 'line', x1: ax + nx * hw, y1: ay + ny * hw, x2: bx + nx * hw, y2: by + ny * hw },
                { kind: 'line', x1: ax - nx * hw, y1: ay - ny * hw, x2: bx - nx * hw, y2: by - ny * hw }
            );
            if (wr('ax') && wr('ay')) decls.push({ type: 'point', id: gid + '_a', fx: byRole.ax.param, fy: byRole.ay.param, x: ax, y: ay, label: 'A' });
            if (wr('bx') && wr('by')) decls.push({ type: 'point', id: gid + '_b', fx: byRole.bx.param, fy: byRole.by.param, x: bx, y: by, label: 'B' });
            if (wr('width')) decls.push({ type: 'projLength', id: gid + '_width', field: byRole.width.param, cx: mx, cy: my, nx, ny, off: hw, scale: 2, min: 1, label: 'width' });
        } else if (byRole.x && byRole.y && byRole.len) {
            const x = p('x'), y = p('y'), len = p('len');
            items.push({ kind: 'hole', x, y, r: Math.max(1, stock.w * 0.012) });   // t297 — a MUTE anchor dot (no n:1): the pass NUMBER is owned by the point handle alone; a numbered hole coincident with a relTo pass-numbered handle would stack two labels (the two-"1" ghost). Handle-owns-number, hole-is-mute.
            pos();
            // 1D extent: drag `len` along Y from the anchor (like text height) — axis FIXED Y (one gesture; X variant later).
            if (wr('len')) decls.push({ type: 'length', id: gid + '_len', field: byRole.len.param, ax: x, ay: y, axis: 'y', value: len, min: 1, label: 'len' });
        } else if (byRole.x && byRole.y) {
            // A `relTo` role marks an INCREMENTAL socket (a delta from a previous pass's start — e.g. corner's #23/#24
            // wall-1→wall-2 reposition, consumed in G91): anchor the point to the op's Nth DECLARED sim-start, so the
            // handle renders at anchor+delta (the true wall position) and a drag writes world − anchor (the delta), not
            // the absolute world coord. Absent relTo → an absolute point (unchanged).
            let ax = 0, ay = 0, destX = null, destY = null, destPass = null;
            if (byRole.x.relTo != null) {
                // SEMANTIC relTo ({row:'wall1'}) → the pass index among the SURVIVING when-filtered starts (correct in BOTH
                // probeZ states); a numeric relTo passes straight through. null = the named pass isn't present here.
                const ri = resolveRelToIndex(def.opType, params, byRole.x.relTo);
                if (ri != null) destPass = ri + 1;   // the handle sits on the destination marker (pass ri+1) → colour by that pass's source (t81)
                // t301 Seam C (ONE declared source) — read the anchor + the DESTINATION wall world from the SHARED per-pass
                // starts (panelStarts = computePassStarts's output, which the 3D marker ALSO consumes) via the ONE wizard-
                // agnostic markerWorldOf. So the two panels can't diverge BY CONSTRUCTION: a datum-PINNED wall is absolute in
                // BOTH; an AUTO reposition relocates to the anchor pass's runtime END in BOTH. NO parallel opSimStarts/cornerXY
                // POSITION derive here. Fall back to the op's declared sim-starts ONLY when no panel is wired (2d-only mode —
                // there is no 3D preview to be coincident with, so nothing to diverge from).
                const src = (Array.isArray(panelStarts) && panelStarts.length) ? panelStarts
                    : ((ri != null) ? (opSimStarts(def.opType, params, s) || []) : []);
                const a = src[ri], dest = src[ri + 1];
                if (a) { ax = num(a.x, 0); ay = num(a.y, 0); }
                if (ri != null && dest) { const mw = markerWorldOf(src, passEnds, ri + 1); destX = num(mw.x, 0); destY = num(mw.y, 0); }
                // shift the ANCHOR to the anchor pass's RUNTIME END (passEnds[ri], post probe+retract+lift) when the destination
                // has a programmed dog-leg — EXACTLY the markerWorldOf gate, so the emitted #23/#24 = wall − runtime-END. MANUAL
                // travel (anchorsAtPrev false — the operator jogs) keeps the static anchor: the handle can't diverge from the ruby.
                const end = (Array.isArray(passEnds) && ri != null) ? passEnds[ri] : null;
                if (end && a && dest && dest.anchorsAtPrev) { ax = num(end.x, 0); ay = num(end.y, 0); }
            }
            let offX = (destX != null) ? destX - ax : p('x');
            let offY = (destY != null) ? destY - ay : p('y');
            // t301 — the #23/#24 (G91 increment) WRITE-BACK: when this destination wall is datum-PINNED (its world is fixed on
            // the stock — the `pinned` flag flows from pinnedStartsFor THROUGH computePassStarts, the ONE source), DERIVE the
            // emitted increment = pinned world − the (current, possibly Start-shifted) anchor and WRITE it to the form field
            // (guarded — only on a real change, so no re-render loop; the anchor is upstream + never depends on this field).
            // So dragging the Start (which moves this anchor) keeps the wall put — its increment re-derives. NO cornerXY here.
            const destPinned = destPass != null && Array.isArray(panelStarts) && panelStarts[destPass] && panelStarts[destPass].pinned;
            if (destPinned) {
                if (wr('x') && r3(offX) !== r3(num(params[byRole.x.param]))) _writeParam(byRole.x.param, offX);
                if (wr('y') && r3(offY) !== r3(num(params[byRole.y.param]))) _writeParam(byRole.y.param, offY);
            }
            const x = ax + offX, y = ay + offY;
            // stash this relTo emitting group's live world + anchor so a drag on ANY handle can CAPTURE (freeze) the others
            if (spotStore && byRole.x.param && byRole.y.param) repoGroups.push({ gid, fx: byRole.x.param, fy: byRole.y.param, ax, ay, worldX: x, worldY: y });
            // t297 INVARIANT (handle-owns-number, hole-is-mute): the numeric pass label is a property of exactly ONE marker
            // kind — the emitting `_pos` handle below — and is NEVER duplicated onto this coincident anchor hole (which is a MUTE
            // dot, no n) nor onto the sim-only Start ◇ (which stays 'Start', non-numeric). That is what keeps the two-"1" ghost dead.
            items.push({ kind: 'hole', x, y, r: Math.max(1, stock.w * 0.012) });   // MUTE anchor dot — the pass number rides the handle label alone
            const reposManual = Array.isArray(sources) && sources[destPass] === 'manual';   // auto → cyan square, manual → amber circle
            if (wr('x') && wr('y')) decls.push({ type: 'point', id: gid + '_pos', fx: byRole.x.param, fy: byRole.y.param, x: offX, y: offY, ax, ay, label: destPass != null ? String(destPass) : 'pos', color: srcCol(destPass), manual: reposManual });   // label = the destination PASS NUMBER (1,2,…) — the SOLE owner of the number
        }
    }
    // t383 (human) — MIDDLE ② DIAGONAL-AIM (opt-in, mirror cornerPick's declared detection): an op with diagTravel + diagPrimary
    // bindings (middle) whose trans-axis AUTO traverse is emitted (boss + twoAxis + transAxis auto — dogleg OR diagonal, both use
    // #21) gets a draggable ② handle. Dragging it re-derives diagTravel (#21 = |secondary out-distance from centre|) + diagPrimary
    // (#22 = the primary coord) so the diagonal/dogleg ENDS on ② — the built-in middleView.tieDiagTravel mapping, PORTED. The ②
    // handle is the ONLY secondary-start marker in the 2D canvas (the per-pass ②③④ ride the 3D panel), so no marker conflict.
    const diagTBind = (def.bindings || []).find((b) => b && b.param === 'diagTravel');
    const diagPBind = (def.bindings || []).find((b) => b && b.param === 'diagPrimary');
    if (diagTBind && diagPBind && params.featureType === 'boss' && (params.twoAxis || params.findBoth) && (params.transAxis || 'auto') === 'auto' && _writable('diagTravel') && _writable('diagPrimary')) {
        const { primaryX } = middleAxes(params);   // t1211 — one order source
        const centreSec = primaryX ? stock.h / 2 : stock.w / 2;
        const centrePrim = primaryX ? stock.w / 2 : stock.h / 2;
        const dir1Plus = (params.dir1 || 'pos') === 'pos';
        const dir2 = (typeof params.dir2 === 'string') ? params.dir2 : (dir1Plus ? 'neg' : 'pos');
        const sign = dir2 === 'pos' ? -1 : 1;   // the ② side = travelOpp(dir2): dir2 pos → −#21, dir2 neg → +#21 (matches the emit smove)
        const travel = Math.max(1, num(params.diagTravel, 50));
        const pp = parseFloat(params.diagPrimary);
        const prim = Number.isFinite(pp) ? pp : centrePrim;   // '#53' (re-centre, at rest) → the stock centre; a placed ② → its numeric primary coord
        decls.push({ type: 'diagAim', id: 'diagAim', primaryX, centreSec, sign, travel, prim, fieldTravel: 'diagTravel', fieldPrimary: 'diagPrimary', label: '②' });
    }
    // t1201 — MIDDLE in-axis CROSS-OVER AIM (user: "the traverse target position needs a GUI"): a boss with the in-axis
    // traverse on AUTO emits the hands-free wall1→wall2 cross-over (#19/#20 = crossX/crossY — numeric-only fields until
    // now). Each emitted crossover gets a draggable TARGET handle riding its probe line at wallFace + sign·cross; a drag
    // writes that axis's cross-over field, so the traverse lands where the handle is. PRIMARY always (boss+auto); the
    // SECONDARY when Find Both Axes is on (its crossover runs along the second axis, riding the ② line — the wall-2 pass
    // start, which since the t1201 landing fix follows a placed ②). Opt-in by bindings (middle only), like diagAim.
    const crossXBind = (def.bindings || []).find((b) => b && b.param === 'crossX');
    const crossYBind = (def.bindings || []).find((b) => b && b.param === 'crossY');
    if (crossXBind && crossYBind && params.featureType === 'boss' && (params.inAxis || 'auto') === 'auto') {
        const { primaryX, dir1Plus } = middleAxes(params);   // t1211 — one order source
        const pField = primaryX ? 'crossX' : 'crossY';
        if (_writable(pField)) {
            // wall 1 = the face the first probe TOUCHES: probing toward + touches the LOW face (0), toward − the HIGH face.
            const span = primaryX ? stock.w : stock.h;
            const wallFace = dir1Plus ? 0 : span, sign = dir1Plus ? 1 : -1;
            const cross = Math.max(1, num(primaryX ? params.crossX : params.crossY, 80));
            const p0 = (Array.isArray(panelStarts) && panelStarts[0]) || null;   // ride the LIVE first-probe line (follows a dragged Start)
            const lineAt = p0 ? num(primaryX ? p0.y : p0.x, primaryX ? stock.h / 2 : stock.w / 2) : (primaryX ? stock.h / 2 : stock.w / 2);
            decls.push({ type: 'crossAim', id: 'crossAimP', axisX: primaryX, wallFace, sign, cross, lineAt, field: pField, label: (primaryX ? 'X' : 'Y') + '↔', color: '#39c0d8' });   // TEAL circle: colour=automatic, shape=travel type (circle=in-axis distance vs the ② square=trans-axial end) — the user's declared language
        }
        const sField = primaryX ? 'crossY' : 'crossX';
        if ((params.twoAxis || params.findBoth) && _writable(sField)) {
            const dir1PlusB = dir1Plus;
            const dir2Plus = ((typeof params.dir2 === 'string') ? params.dir2 : (dir1PlusB ? 'neg' : 'pos')) === 'pos';
            const span2 = primaryX ? stock.h : stock.w;
            const wallFace2 = dir2Plus ? 0 : span2, sign2 = dir2Plus ? 1 : -1;
            const cross2 = Math.max(1, num(primaryX ? params.crossY : params.crossX, 80));
            const pw = (Array.isArray(panelStarts) && panelStarts.length > 1) ? panelStarts[panelStarts.length - 1] : null;   // the wall-2 pass start = the ② line
            const lineAt2 = pw ? num(primaryX ? pw.x : pw.y, primaryX ? stock.w / 2 : stock.h / 2) : (primaryX ? stock.w / 2 : stock.h / 2);
            decls.push({ type: 'crossAim', id: 'crossAimS', axisX: !primaryX, wallFace: wallFace2, sign: sign2, cross: cross2, lineAt: lineAt2, field: sField, label: (primaryX ? 'Y' : 'X') + '↔', color: '#39c0d8' });   // teal in-axis distance circle (see crossAimP)
        }
    }
    // Drag a handle → write the bound param FIELDS (their 'input' bubbles → userOpView.update() redraws). The gesture
    // math (corner/radius) lives in the registry; here `setFields` just routes each {param: value} to its form field.
    const setFields = (m) => { for (const k in m) _writeParam(k, m[k]); };
    const { handles, onDrag: _rawOnDrag } = buildCanvasWidgets(decls, setFields);
    // t718 LAYOUT PLACEMENT PARITY — PLACE the previewGeometry handles: bake the shift into their RENDER position and
    // INVERSE-map their drag world (world − shift → the raw param), keyed by the previewGeometry handle ids. Role/probe
    // handles + the sim Start are untouched (the shift is 0 for probe ops anyway). Size/delta fields pass through — the
    // gesture math reads the un-shifted world, so a pos handle writes world−shift while W/H/Ø/dx/dy are pure translation.
    if (_placed && _pgIds.size) for (const h of handles) if (_pgIds.has(h.id)) { h.x += _pShift.x; h.y += _pShift.y; }
    const onDrag = (_placed && _pgIds.size)
        ? (id, world) => _rawOnDrag(id, _pgIds.has(id) ? { x: world.x - _pShift.x, y: world.y - _pShift.y } : world)
        : _rawOnDrag;
    // t120 — Option A independence: wrap the emitting-handle drag. On dragging ANY relTo handle, CAPTURE (freeze) every OTHER
    // relTo group's spot at its CURRENT displayed world (no jump), then SET the dragged group's spot to the drop world — all
    // datum-relative to cornerXY. The re-render then derives each group's G91 increment off the current planned anchor, so
    // dragging one marker leaves the others put (their increments re-derive off the moved chain). Non-corner/no-store → plain onDrag.
    const spotOnDrag = (spotStore && repoGroups.length && cornerXY) ? (id, world) => {
        const dragged = repoGroups.find((g) => id === g.gid + '_pos');
        if (dragged) {
            const next = { ...spotStore };
            for (const g of repoGroups) { if (g !== dragged && !next[g.gid]) next[g.gid] = { dx: g.worldX - cornerXY.x, dy: g.worldY - cornerXY.y }; }
            next[dragged.gid] = { dx: world.x - cornerXY.x, dy: world.y - cornerXY.y };
            setSpots(next);
        }
        if (onDrag) onDrag(id, world);
    } : onDrag;
    // t112 — GUI CORNER-SELECTOR: an op that declares a `corner` enum binding gets clickable stock-corner targets on the
    // canvas (FeatureCanvas._drawCornerPick). Clicking one SETS the corner <select> + dispatches change → update() re-emits
    // (already correct per corner) + re-derives the per-corner markers/sim (prefill t109) — reusing the dropdown's OWN change
    // seam, no new param path. Opt-in (only corner-bearing ops); the corner targets sit on the stock corners, distinct from
    // the reposition handles (no hit-test overlap). Absent → the canvas draws no corner targets (unchanged for other ops).
    // EDGE DATUM VIZ (t339 E3, opt-in — mirror cornerPick's declared detection): an op declaring an `axis` + `dir` enum (a
    // ONE-wall probe) shows its datum — a highlighted WALL LINE (the probed stock edge) + an APPROACH line from the sim-start
    // toward it. Edge's datum is a LINE + a direction (vs corner's POINT). PURELY VISUAL (items only; no handle/emit/drag) →
    // sim-only, byte-parity untouched. Absent (any non-axis/dir op) → no edge glyph (unchanged). Gated on axis+dir; a future
    // explicit `def.datum` kind could disambiguate if more one-wall variants appear (flagged) — today only edge has axis+dir.
    const edgeAxisBind = (def.bindings || []).find((b) => b && b.param === 'axis' && b.type === 'enum');
    const edgeDirBind = (def.bindings || []).find((b) => b && b.param === 'dir' && b.type === 'enum');
    if (edgeAxisBind && edgeDirBind) {
        const eAxis = params.axis === 'Y' ? 'Y' : 'X';
        const ePos = (params.dir || 'pos') !== 'neg';   // pos → the near/0 face; neg → the far face
        const sp = simStart && simStart.pos && Number.isFinite(+simStart.pos.x) && Number.isFinite(+simStart.pos.y) ? simStart.pos : null;
        if (eAxis === 'X') {
            const wx = ePos ? 0 : stock.w;
            items.push({ kind: 'line', x1: wx, y1: 0, x2: wx, y2: stock.h, cls: 'fc-edge-wall' });                       // the probed wall (a vertical stock edge)
            if (sp) items.push({ kind: 'line', x1: +sp.x, y1: +sp.y, x2: wx, y2: +sp.y, cls: 'fc-edge-approach' });      // approach: the start → the wall (perpendicular)
        } else {
            const wy = ePos ? 0 : stock.h;
            items.push({ kind: 'line', x1: 0, y1: wy, x2: stock.w, y2: wy, cls: 'fc-edge-wall' });                       // the probed wall (a horizontal stock edge)
            if (sp) items.push({ kind: 'line', x1: +sp.x, y1: +sp.y, x2: +sp.x, y2: wy, cls: 'fc-edge-approach' });
        }
    }
    // ROTARY DATUM VIZ (t465, opt-in — MIRROR the edge wall-glyph): a rotary op declaring a `diameter` binding (rotaryCenter)
    // or a `span` binding (rotaryClock) shows its DATUM in the 2D top-view. rotaryCenter → the bar CENTRELINE (the rotary
    // A-axis, a dash-dot line at the stock Y-centre running along X) + a dot at the bar centre (the found Z0 datum point).
    // rotaryClock → the SPAN SEGMENT (the two Z-down touches A→B, `span` apart in Y, mirroring the rotary_clock sim-start) +
    // the two touch dots. PURELY VISUAL (items only; no handle/emit/drag) → sim-only, byte-parity untouched. Absent (any
    // non-rotary op) → no glyph (unchanged). `diameter`/`span` are GLOBALLY-UNIQUE binding params so the gate can't misfire.
    // FLAGGED design choice (NOT drawn): whether/how to indicate the clock's A0 REFERENCE direction (top +Z vs +Y side) — a
    // rotation is edge-on in a top-view, so it has no unambiguous 2D rendering; the concrete probe geometry is shown instead.
    // t570 — SCOPE the rotary datum glyph to ROTARY ops. `span` is NO LONGER globally-unique: alignment (t544) added a `span`
    // binding (the A→B probe span), so keying purely on the binding MISFIRED — the rotary-clock span rail + touch dots drew on
    // the alignment layout, DUPLICATING its A/B drag handles (the human: "not much use"). Gate on the op being rotary so a
    // non-rotary op that happens to bind `span`/`diameter` shows no glyph (alignment → only its A/B handles + the traced path).
    const isRotaryOp = /rotary/i.test(def.opType || '');
    const rotCenterBind = isRotaryOp && (def.bindings || []).find((b) => b && b.param === 'diameter');
    const rotClockBind  = isRotaryOp && (def.bindings || []).find((b) => b && b.param === 'span');
    if (rotCenterBind) {
        const cyAxis = stock.h / 2;                                    // the rotary A-axis runs along X at the stock Y-centre (the bar axis = the datum)
        const rotR = Math.max(2, Math.min(stock.w, stock.h) * 0.02);
        items.push({ kind: 'line', x1: 0, y1: cyAxis, x2: stock.w, y2: cyAxis, cls: 'fc-rotary-axis' });   // the bar centreline (the Y datum reference)
        items.push({ kind: 'circle', cx: stock.w / 2, cy: cyAxis, r: rotR, cls: 'fc-rotary-datum' });      // the bar-centre datum point (Z0)
    } else if (rotClockBind) {
        const cx = stock.w / 2, cy = stock.h / 2;
        const span = Number.isFinite(+params.span) ? +params.span : 20;   // the Y distance between the two touches (fallback matches rotary_clock's)
        const ay = cy - span / 2, by = cy + span / 2;                      // touch A (−Y half-span) → touch B (+Y), matching rotary_clock's sim-start
        const rotR = Math.max(2, Math.min(stock.w, stock.h) * 0.02);
        items.push({ kind: 'line', x1: cx, y1: ay, x2: cx, y2: by, cls: 'fc-rotary-span' });   // the measured flat segment (A→B, span apart in Y)
        items.push({ kind: 'circle', cx, cy: ay, r: rotR, cls: 'fc-rotary-touch' });           // touch A
        items.push({ kind: 'circle', cx, cy: by, r: rotR, cls: 'fc-rotary-touch' });           // touch B
    }
    // t345 E6 — the GUI EDGE PICKER (opt-in, MIRROR cornerPick): an axis+dir op gets clickable stock WALLS — click a wall to
    // SET axis+dir in ONE gesture (FeatureCanvas._drawEdgePick draws the 4 edge strips; onEdgePick writes the dropdowns via
    // their OWN change seam, so the dropdowns stay as fallback + sync). Form-write only, NO emit change (the emit reads the params).
    const edgePick = (edgeAxisBind && edgeDirBind) ? {
        edgeSel: { axis: params.axis === 'Y' ? 'Y' : 'X', dir: (params.dir || 'pos') !== 'neg' ? 'pos' : 'neg' },
        onEdgePick: (axis, dir) => {
            const setParam = (param, val) => { const s = (typeof document !== 'undefined') && document.querySelector(`#wiz_user_form [data-param="${param}"]`); if (s && s.value !== val) { s.value = val; s.dispatchEvent(new Event('change', { bubbles: true })); } };
            setParam('axis', axis); setParam('dir', dir);
        },
    } : {};
    const cornerBind = (def.bindings || []).find((b) => b && b.param === 'corner' && b.type === 'enum');
    const cornerPick = cornerBind ? {
        corner: params.corner,
        onCornerPick: (code) => {
            const sel = (typeof document !== 'undefined') && document.querySelector('#wiz_user_form [data-param="corner"]');
            if (sel && sel.value !== code) { sel.value = code; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        },
    } : {};
    // t508 Fork 1 — DECLARED marker→param handles: an op that binds each sim-start marker to a param (def.simStartParams)
    // renders EVERY marker as a DRAGGABLE handle here (labelled A, B, …). A drag routes to the marker's onDrag (userOpView
    // writes the FRACTION param → the ONE source). Distinct from the sim-only pass-0 ○ below (which those ops don't use).
    if (Array.isArray(simMarkers) && simMarkers.length) {
        // t532 — noSnap: a sim-start probe point is a FREE position (anywhere in reach), NOT a feature to seat on the stock —
        // so it must NOT snap to stock corners/edges (the snap CAUGHT it at the perimeter → "can't exit the stock", the human's bug).
        // t1201 (user) — a marker may declare manual/simOnly/color (a MANUAL jog landing renders amber = the established
        // manual language, and drags sim-only); the spb param-markers keep the cyan default.
        const markerHandles = simMarkers.map((m, i) => ({ id: '__simstart' + i, x: +m.pos.x, y: +m.pos.y, kind: 'move', noSnap: true, label: m.label || String(i + 1), color: m.color || '#39c0d8', manual: !!m.manual, simOnly: !!m.simOnly, yieldCoincident: !!m.yieldCoincident }));   // t726 P2b — the entry marker yields to a coincident feature handle
        const onDragMarkers = (id, world) => {
            const mi = markerHandles.findIndex((h) => h.id === id);
            if (mi >= 0 && typeof simMarkers[mi].onDrag === 'function') simMarkers[mi].onDrag({ x: world.x, y: world.y });
            else if (spotOnDrag) spotOnDrag(id, world);
        };
        return { stock: stockOut, items, handles: [...handles, ...markerHandles], onDrag: onDragMarkers, origin, paths: previewPaths, ...machSpread, ...cornerPick, ...edgePick };
    }
    // t73 — the SIM-ONLY first-start marker also shows on the Layout canvas (a SECOND renderer of createPreviewPanel's
    // userStarts pass-0, never emitted): a hollow ◇ for spatial reference alongside the emitting reposition handles. It is
    // VISUAL here (excluded from the hit-test) because pass-0 always coincides with a reposition ANCHOR whose emitting handle
    // owns that point — the sim start is DRAGGED on the top panel (its natural sim surface). Host passes the pass-0 position.
    if (simStart && simStart.pos && Number.isFinite(+simStart.pos.x) && Number.isFinite(+simStart.pos.y)) {
        const SIM_ID = '__simstart0';
        // pass-0 is the operator's manual jog START — always a jog, so always an AMBER CIRCLE, labelled 'Start'.
        const allHandles = [...handles, { id: SIM_ID, x: +simStart.pos.x, y: +simStart.pos.y, kind: 'move', simOnly: true, manual: true, label: 'Start', color: '#ffb300' }];
        // t87/t120 → t297 — the Start ◇ is now the REPOSITION-CHAIN DATUM (TRAVEL-START-SPEC "START=SOURCE"), not a decorative
        // preview jog. Its drag routes to onStartDrag (writes userStarts pass-0, sim-only — the Start never emits its OWN value).
        // BUT #21-#24 are DEFINED relative to the Start, so dragging it must HOLD each wall on the physical stock and RE-DERIVE
        // the increments: capture EVERY repoGroup's current world into spotStore BEFORE the Start re-trace, and the derive
        // (:174-179) recomputes #21-#24 = wall_world − (the Start-shifted anchor) → walls stay put, offsets adapt. ORDER is
        // LOAD-BEARING: setSpots must run BEFORE simStart.onDrag (which re-renders synchronously) or the walls jump one frame.
        // This CHANGES the emitted program on a Start jog BY DESIGN (human-signed-off t294/t296) — it REVERSES the old t120
        // "must NOT capture" preview-only stance, because the Start is the datum now, not a jog the operator drifts from.
        const wrappedOnDrag = (typeof simStart.onDrag === 'function')
            ? (id, world) => {
                if (id === SIM_ID) {
                    // freeze the walls (every repoGroup — there is no "dragged" emitting group here) so they hold their world
                    if (spotStore && repoGroups.length && cornerXY && typeof setSpots === 'function') {
                        const next = { ...spotStore };
                        for (const g of repoGroups) if (!next[g.gid]) next[g.gid] = { dx: g.worldX - cornerXY.x, dy: g.worldY - cornerXY.y };
                        setSpots(next);   // MUST precede simStart.onDrag (the synchronous Start re-render), else the walls flash
                    }
                    simStart.onDrag({ x: world.x, y: world.y });
                } else if (spotOnDrag) spotOnDrag(id, world);
            }
            : spotOnDrag;
        return { stock: stockOut, items, handles: allHandles, onDrag: wrappedOnDrag, origin, paths: previewPaths, ...machSpread, ...cornerPick, ...edgePick };
    }
    return { stock: stockOut, items, handles, onDrag: spotOnDrag, origin, paths: previewPaths, ...machSpread, ...cornerPick, ...edgePick };
}

// One shared FeatureCanvas for the custom panel's 2D mode (lazy).
let _layout = null;
export function renderLayout2D(container, def, params, simStart, sources, passEnds, spots, setSpots, panelStarts, simMarkers) {
    if (!container) return null;
    if (!_layout) _layout = new FeatureCanvas();
    _layout.render(container, layoutSpecFromOp(def, params, simStart, sources, passEnds, spots, setSpots, panelStarts, simMarkers));
    return _layout;   // t309 — hand back the FeatureCanvas so the Layout host can pin an animation overlay to its transform (getTransform/onTransform)
}

export function renderDeclaredLayout(container, def, params) {
    if (!container || !def) return false;
    if (panelType(def.panel).mode === '2d') {
        renderLayout2D(container, def, params);
        return true;
    }
    return false;
}
