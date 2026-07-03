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
import { whenOk } from '../../blocks/whenGuard.js';   // a `when`-gated binding-group's handle shows only when its guard passes (③ — the prune-gated start handle)

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
export function layoutSpecFromOp(def, params, simStart, sources, passEnds) {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const stock = (s && s.x > 0 && s.y > 0) ? { w: s.x, h: s.y, ox: 0, oy: 0 } : { w: 200, h: 150, ox: 0, oy: 0 };
    // t81 — colour a handle by its pass's reposition SOURCE (auto=cyan / manual=amber), MATCHING the top panel. `sources` is the
    // per-pass array the panel exposes (getPassSources); absent → null → the FeatureCanvas keeps its CSS default (gold).
    const srcCol = (pass) => (!Array.isArray(sources)) ? null : (sources[pass] === 'manual' ? '#ffb300' : '#22d3ee');
    const groups = {};
    for (const b of (def.bindings || [])) { if (b.group) (groups[b.group] = groups[b.group] || []).push(b); }
    const items = [], decls = [];
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
            items.push({ kind: 'hole', x, y, n: 1, r: Math.max(1, stock.w * 0.012) });   // anchor marker
            pos();
            // 1D extent: drag `len` along Y from the anchor (like text height) — axis FIXED Y (one gesture; X variant later).
            if (wr('len')) decls.push({ type: 'length', id: gid + '_len', field: byRole.len.param, ax: x, ay: y, axis: 'y', value: len, min: 1, label: 'len' });
        } else if (byRole.x && byRole.y) {
            // A `relTo` role marks an INCREMENTAL socket (a delta from a previous pass's start — e.g. corner's #23/#24
            // wall-1→wall-2 reposition, consumed in G91): anchor the point to the op's Nth DECLARED sim-start, so the
            // handle renders at anchor+delta (the true wall position) and a drag writes world − anchor (the delta), not
            // the absolute world coord. Absent relTo → an absolute point (unchanged).
            let ax = 0, ay = 0, destX = null, destY = null, destPass = null;
            if (byRole.x.relTo != null && typeof opSimStarts === 'function') {
                // SEMANTIC relTo ({row:'wall1'}) → the pass index among the SURVIVING when-filtered starts (correct in
                // BOTH probeZ states); a numeric relTo passes straight through. null = the named pass isn't present here.
                const ri = resolveRelToIndex(def.opType, params, byRole.x.relTo);
                const starts = (ri != null) ? (opSimStarts(def.opType, params, s) || []) : [];
                const a = starts[ri];
                if (a) { ax = num(a.x, 0); ay = num(a.y, 0); }
                if (ri != null) destPass = ri + 1;   // the handle sits on the destination marker (pass ri+1) → colour by that pass's source (t81)
                // The reposition ARRIVES at the NEXT pass marker (starts[ri+1] — chained via the SAME cornerReposOffsets the
                // emit uses, and persistence-safe as the registered sim provider): the handle renders THERE (anchor+offset =
                // the true destination), whether the socket is set (marker reflects the literal) or UNSET. Fixes the num()→0
                // fallback that stuck the handle AT its anchor (masking the sim ◇). No 2nd hand-rolled path — ONE source.
                const dest = starts[ri + 1];
                if (dest) { destX = num(dest.x, 0); destY = num(dest.y, 0); }
                // t107 machine-faithful — shift the anchor (+ the destination) to the RUNTIME END of the anchor pass
                // (passEnds[ri], post probe+retract+lift), so the Layout handle sits at the SAME machine-correct ② the top
                // panel + 3D show, AND a drag writes #23/#24 = target − runtime-END (END-relative). The offset destX−ax stays
                // the cross (both shift by the same drift), so an UNSET default is unchanged. passEnds absent (pre-trace) →
                // the static start (graceful degradation, byte-identical to t94). The runtime END is stable while dragging the
                // DESTINATION (the anchor pass is upstream), so the drag is coherent.
                // GATED on the DESTINATION's anchorsAtPrev — EXACTLY like the 3D/2D _markerWorld: only an AUTO reposition
                // has a programmed dog-leg to relocate. MANUAL travel (anchorsAtPrev false — the operator jogs) keeps the
                // static wall marker on ALL surfaces, so the Layout handle can't diverge from the 3D/2D marker.
                const end = (Array.isArray(passEnds) && ri != null) ? passEnds[ri] : null;
                if (end && a && dest && dest.anchorsAtPrev) {
                    const dxE = num(end.x, 0) - ax, dyE = num(end.y, 0) - ay;
                    ax += dxE; ay += dyE;
                    if (destX != null) { destX += dxE; destY += dyE; }
                }
            }
            const offX = (destX != null) ? destX - ax : p('x');
            const offY = (destY != null) ? destY - ay : p('y');
            const x = ax + offX, y = ay + offY;
            items.push({ kind: 'hole', x, y, n: 1, r: Math.max(1, stock.w * 0.012) });
            if (wr('x') && wr('y')) decls.push({ type: 'point', id: gid + '_pos', fx: byRole.x.param, fy: byRole.y.param, x: offX, y: offY, ax, ay, label: 'pos', color: srcCol(destPass) });
        }
    }
    // Drag a handle → write the bound param FIELDS (their 'input' bubbles → userOpView.update() redraws). The gesture
    // math (corner/radius) lives in the registry; here `setFields` just routes each {param: value} to its form field.
    const setFields = (m) => { for (const k in m) _writeParam(k, m[k]); };
    const { handles, onDrag } = buildCanvasWidgets(decls, setFields);
    // t73 — the SIM-ONLY first-start marker also shows on the Layout canvas (a SECOND renderer of createPreviewPanel's
    // userStarts pass-0, never emitted): a hollow ◇ for spatial reference alongside the emitting reposition handles. It is
    // VISUAL here (excluded from the hit-test) because pass-0 always coincides with a reposition ANCHOR whose emitting handle
    // owns that point — the sim start is DRAGGED on the top panel (its natural sim surface). Host passes the pass-0 position.
    if (simStart && simStart.pos && Number.isFinite(+simStart.pos.x) && Number.isFinite(+simStart.pos.y)) {
        const SIM_ID = '__simstart0';
        const allHandles = [...handles, { id: SIM_ID, x: +simStart.pos.x, y: +simStart.pos.y, kind: 'move', simOnly: true, label: '', color: srcCol(0) }];
        // t87 — the sim-only marker is DRAGGABLE: route its drag to the panel's onStartDrag (writes userStarts, NEVER emitted —
        // reuses the top panel's seam, no new mechanism); every other handle keeps its param-writing onDrag. (placement is {0,0}
        // for a probe op → the canvas world-delta IS the absolute start world point onStartDrag expects.)
        const wrappedOnDrag = (typeof simStart.onDrag === 'function')
            ? (id, world) => { if (id === SIM_ID) simStart.onDrag({ x: world.x, y: world.y }); else if (onDrag) onDrag(id, world); }
            : onDrag;
        return { stock, items, handles: allHandles, onDrag: wrappedOnDrag };
    }
    return { stock, items, handles, onDrag };
}

// One shared FeatureCanvas for the custom panel's 2D mode (lazy).
let _layout = null;
export function renderLayout2D(container, def, params, simStart, sources, passEnds) {
    if (!container) return;
    if (!_layout) _layout = new FeatureCanvas();
    _layout.render(container, layoutSpecFromOp(def, params, simStart, sources, passEnds));
}

export function renderDeclaredLayout(container, def, params) {
    if (!container || !def) return false;
    if (panelType(def.panel).mode === '2d') {
        renderLayout2D(container, def, params);
        return true;
    }
    return false;
}
