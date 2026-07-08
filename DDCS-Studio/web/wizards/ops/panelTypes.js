/**
 * wizards/ops/panelTypes.js — the small registry of PANEL LAYOUTS a custom wizard can use.
 *
 * Every op is a wizard; how its panel looks is one more thing the stack declares (def.panel, default 'form3d').
 * The generic userOpView reads this to show/hide the preview pane and pick 3D vs a 2D layout. The GUI "panel" block
 * (v2 authoring) is just a visual way to set def.panel — same registry.
 */
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { buildCanvasWidgets } from '../../viz/canvasWidgets.js';
import { opSimStarts, resolveRelToIndex } from '../../viz/opSimStarts.js';   // a `relTo` point anchors to the op's declared sim-start (incremental socket); resolveRelToIndex maps a SEMANTIC {row} → the surviving pass
import { markerWorldOf } from '../../viz/markerWorld.js';   // t301 Seam C — the ONE per-pass marker-world fn the 3D preview ALSO reads, so the Layout handle + the 3D ruby can't diverge
import { whenOk } from '../../blocks/whenGuard.js';   // a `when`-gated binding-group's handle shows only when its guard passes (③ — the prune-gated start handle)
import { datumXY, getWorkpiece, workpieceBackdrop } from '../../engine/workpiece.js';   // t359 — the datum crosshair; t385 — DRAW the workpiece INSIDE cavities (the pocket) from the DECLARED feature (stock-modal size)

export const PANEL_TYPES = {
    form:        { id: 'form',        label: 'Form only',      viz: false, mode: null },   // single column, no preview
    form3d:      { id: 'form3d',      label: 'Form + 3D',      viz: true,  mode: '3d' },   // form + the shared 3D preview (default)
    form2d:      { id: 'form2d',      label: 'Form + 2D',      viz: true,  mode: '2d' },   // form + a 2D stock layout of the op's xy/rect params
    'form3d+2d': { id: 'form3d+2d',   label: 'Form + 3D + 2D', viz: true,  mode: '3d2d' }, // BOTH: the 3D sim (+ declared per-pass markers) AND the 2D drag canvas (the built-in probe pattern, generalized — a visual data-op like Corner (data))
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
function _writeParam(name, val) { const f = _field(name); if (f) { f.value = r3(val); f.dispatchEvent(new Event('input', { bubbles: true })); } }

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

export function layoutSpecFromOp(def, params, simStart, sources, passEnds, spots, setSpots, panelStarts, simMarkers) {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const stock = (s && s.x > 0 && s.y > 0) ? { w: s.x, h: s.y, ox: 0, oy: 0 } : { w: 200, h: 150, ox: 0, oy: 0 };
    // t359 — the part-zero crosshair follows the DATUM (the selected part-zero corner/centre), consistent with the stock
    // modal + the 3D. The corner-pick circles stay on the PHYSICAL corners (cornerDatumXY, datum-independent) — the datum
    // and the probed corner are INDEPENDENT. Display-only (the crosshair position); the emit is untouched. Default datum
    // ('nnp') → origin {0,0} = the min-XY corner = the prior behaviour, so nothing shifts unless a non-FL datum is set.
    const _dp = datumXY({ x: stock.w, y: stock.h, datum: s && s.datum });
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
    // t385 (human) — DRAW the workpiece INSIDE cavities (the pocket) in the 2D layout from the DECLARED workpiece
    // (getWorkpiece → the stock-modal-defined pos+size), so a Middle probe SHOWS the pocket it finds — matching the 3D
    // render + the probe-stop (ONE source, no hardcoded inset). Only inside cavities draw; an outer boss/solid has none →
    // unchanged for corner/edge. Drawn first (behind the handles/glyphs).
    try { items.push(...(workpieceBackdrop(getWorkpiece(), { ox: stock.ox || 0, oy: stock.oy || 0 }).items || [])); } catch (_) { /* no workpiece → no cavity */ }
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
        const primaryX = (params.axis || 'X') !== 'Y';
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
    // Drag a handle → write the bound param FIELDS (their 'input' bubbles → userOpView.update() redraws). The gesture
    // math (corner/radius) lives in the registry; here `setFields` just routes each {param: value} to its form field.
    const setFields = (m) => { for (const k in m) _writeParam(k, m[k]); };
    const { handles, onDrag } = buildCanvasWidgets(decls, setFields);
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
    const rotCenterBind = (def.bindings || []).find((b) => b && b.param === 'diameter');
    const rotClockBind  = (def.bindings || []).find((b) => b && b.param === 'span');
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
        const markerHandles = simMarkers.map((m, i) => ({ id: '__simstart' + i, x: +m.pos.x, y: +m.pos.y, kind: 'move', label: m.label || String(i + 1), color: '#39c0d8' }));
        const onDragMarkers = (id, world) => {
            const mi = markerHandles.findIndex((h) => h.id === id);
            if (mi >= 0 && typeof simMarkers[mi].onDrag === 'function') simMarkers[mi].onDrag({ x: world.x, y: world.y });
            else if (spotOnDrag) spotOnDrag(id, world);
        };
        return { stock, items, handles: [...handles, ...markerHandles], onDrag: onDragMarkers, origin, ...cornerPick, ...edgePick };
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
        return { stock, items, handles: allHandles, onDrag: wrappedOnDrag, origin, ...cornerPick, ...edgePick };
    }
    return { stock, items, handles, onDrag: spotOnDrag, origin, ...cornerPick, ...edgePick };
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
