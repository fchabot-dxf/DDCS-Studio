/**
 * wizards/ops/panelTypes.js — the small registry of PANEL LAYOUTS a custom wizard can use.
 *
 * Every op is a wizard; how its panel looks is one more thing the stack declares (def.panel, default 'form3d').
 * The generic userOpView reads this to show/hide the preview pane and pick 3D vs a 2D layout. The GUI "panel" block
 * (v2 authoring) is just a visual way to set def.panel — same registry.
 */
import { FeatureCanvas } from '../../viz/featureCanvas.js';

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

// Derive a 2D FeatureCanvas spec from the op's xy/rect-bound params — a top-down summary that mirrors what the canvas
// pickers set (xy group → a point; rect group → a rectangle), drawn on the configured stock — and now DRAGGABLE:
// for groups whose params are writable fields, a handle drives them, so a custom wizard gets canvas drag-to-edit with
// no per-op code (the handle is derived from the param-block roles, the same `x/y/w/h` the items are). See ROADMAP
// "GUI over fields" + the spatial-gui-form-vs-canvas memory.
export function layoutSpecFromOp(def, params) {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const stock = (s && s.x > 0 && s.y > 0) ? { w: s.x, h: s.y, ox: 0, oy: 0 } : { w: 200, h: 150, ox: 0, oy: 0 };
    const groups = {};
    for (const b of (def.bindings || [])) { if (b.group) (groups[b.group] = groups[b.group] || []).push(b); }
    const items = [], handles = [], map = {};   // map: handleId → the param(s) it writes
    for (const gid in groups) {
        const byRole = {};
        for (const b of groups[gid]) byRole[b.role] = b;
        const p = (r) => byRole[r] ? num(params[byRole[r].param]) : undefined;
        if (byRole.x && byRole.y && byRole.w && byRole.h) {
            const x = p('x'), y = p('y'), w = p('w'), h = p('h');
            items.push({ kind: 'rect', x, y, w, h });
            if (_writable(byRole.x.param) && _writable(byRole.y.param)) { handles.push({ id: gid + '_pos', x, y, kind: 'move', label: 'pos' }); map[gid + '_pos'] = { x: byRole.x.param, y: byRole.y.param }; }
            if (_writable(byRole.w.param) && _writable(byRole.h.param)) { handles.push({ id: gid + '_size', x: x + w, y: y + h, kind: 'size', label: 'W', value: w }); map[gid + '_size'] = { w: byRole.w.param, h: byRole.h.param, ox: x, oy: y }; }
        } else if (byRole.x && byRole.y) {
            const x = p('x'), y = p('y');
            items.push({ kind: 'hole', x, y, n: 1, r: Math.max(1, stock.w * 0.012) });
            if (_writable(byRole.x.param) && _writable(byRole.y.param)) { handles.push({ id: gid + '_pos', x, y, kind: 'move', label: 'pos' }); map[gid + '_pos'] = { x: byRole.x.param, y: byRole.y.param }; }
        }
    }
    return {
        stock, items, handles,
        // Drag a handle → write the bound param fields (their 'input' bubbles → userOpView.update() redraws).
        onDrag(id, w) {
            const m = map[id]; if (!m) return;
            if (m.w !== undefined) { _writeParam(m.w, Math.max(1, w.x - m.ox)); _writeParam(m.h, Math.max(1, w.y - m.oy)); }   // size a rect from its origin
            else { _writeParam(m.x, w.x); _writeParam(m.y, w.y); }                                                            // move a point
        },
    };
}

// One shared FeatureCanvas for the custom panel's 2D mode (lazy).
let _layout = null;
export function renderLayout2D(container, def, params) {
    if (!container) return;
    if (!_layout) _layout = new FeatureCanvas();
    _layout.render(container, layoutSpecFromOp(def, params));
}
