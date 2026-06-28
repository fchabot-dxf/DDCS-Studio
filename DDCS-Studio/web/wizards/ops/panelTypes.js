/**
 * wizards/ops/panelTypes.js — the small registry of PANEL LAYOUTS a custom wizard can use.
 *
 * Every op is a wizard; how its panel looks is one more thing the stack declares (def.panel, default 'form3d').
 * The generic userOpView reads this to show/hide the preview pane and pick 3D vs a 2D layout. The GUI "panel" block
 * (v2 authoring) is just a visual way to set def.panel — same registry.
 */
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { buildCanvasWidgets } from '../../viz/canvasWidgets.js';

export const PANEL_TYPES = {
    form:   { id: 'form',   label: 'Form only', viz: false, mode: null },   // single column, no preview
    form3d: { id: 'form3d', label: 'Form + 3D', viz: true,  mode: '3d' },   // form + the shared 3D preview (default)
    form2d: { id: 'form2d', label: 'Form + 2D', viz: true,  mode: '2d' },   // form + a 2D stock layout of the op's xy/rect params
};
export const DEFAULT_PANEL = 'form3d';
export const panelType = (id) => PANEL_TYPES[id] || PANEL_TYPES[DEFAULT_PANEL];

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
export function layoutSpecFromOp(def, params) {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const stock = (s && s.x > 0 && s.y > 0) ? { w: s.x, h: s.y, ox: 0, oy: 0 } : { w: 200, h: 150, ox: 0, oy: 0 };
    const groups = {};
    for (const b of (def.bindings || [])) { if (b.group) (groups[b.group] = groups[b.group] || []).push(b); }
    const items = [], decls = [];
    for (const gid in groups) {
        const byRole = {};
        for (const b of groups[gid]) byRole[b.role] = b;
        const p = (r) => byRole[r] ? num(params[byRole[r].param]) : undefined;
        const wr = (r) => byRole[r] && _writable(byRole[r].param);   // a role whose param is a settable form field
        // pos handle = a `point` gesture over the x/y params (built only when both are writable — never a dead handle).
        const pos = () => { if (wr('x') && wr('y')) decls.push({ type: 'point', id: gid + '_pos', fx: byRole.x.param, fy: byRole.y.param, x: p('x'), y: p('y'), label: 'pos' }); };
        if (byRole.x && byRole.y && byRole.w && byRole.h) {
            const x = p('x'), y = p('y'), w = p('w'), h = p('h');
            items.push({ kind: 'rect', x, y, w, h });
            pos();
            if (wr('w') && wr('h')) decls.push({ type: 'rect', id: gid + '_size', field: byRole.w.param, fieldH: byRole.h.param, ax: x, ay: y, ex: w, ey: h, sx: 1, sy: 1, minw: 1, minh: 1, label: 'W', value: w });
        } else if (byRole.x && byRole.y && byRole.dia) {
            const x = p('x'), y = p('y'), dia = p('dia'), R = dia / 2;
            items.push({ kind: 'circle', cx: x, cy: y, r: R });
            pos();
            if (wr('dia')) decls.push({ type: 'radial', id: gid + '_size', field: byRole.dia.param, cx: x, cy: y, r: R, a: 0, rScale: 2, minR: 1, label: 'Ø', value: dia });
        } else if (byRole.x && byRole.y && byRole.len) {
            const x = p('x'), y = p('y'), len = p('len');
            items.push({ kind: 'hole', x, y, n: 1, r: Math.max(1, stock.w * 0.012) });   // anchor marker
            pos();
            // 1D extent: drag `len` along Y from the anchor (like text height) — axis FIXED Y (one gesture; X variant later).
            if (wr('len')) decls.push({ type: 'length', id: gid + '_len', field: byRole.len.param, ax: x, ay: y, axis: 'y', value: len, min: 1, label: 'len' });
        } else if (byRole.x && byRole.y) {
            const x = p('x'), y = p('y');
            items.push({ kind: 'hole', x, y, n: 1, r: Math.max(1, stock.w * 0.012) });
            pos();
        }
    }
    // Drag a handle → write the bound param FIELDS (their 'input' bubbles → userOpView.update() redraws). The gesture
    // math (corner/radius) lives in the registry; here `setFields` just routes each {param: value} to its form field.
    const setFields = (m) => { for (const k in m) _writeParam(k, m[k]); };
    const { handles, onDrag } = buildCanvasWidgets(decls, setFields);
    return { stock, items, handles, onDrag };
}

// One shared FeatureCanvas for the custom panel's 2D mode (lazy).
let _layout = null;
export function renderLayout2D(container, def, params) {
    if (!container) return;
    if (!_layout) _layout = new FeatureCanvas();
    _layout.render(container, layoutSpecFromOp(def, params));
}
