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

// Derive a 2D FeatureCanvas spec from the op's xy/rect-bound params — a top-down summary that mirrors what the
// canvas pickers set (xy group → a point; rect group → a rectangle), drawn on the configured stock.
export function layoutSpecFromOp(def, params) {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const stock = (s && s.x > 0 && s.y > 0) ? { w: s.x, h: s.y, ox: 0, oy: 0 } : { w: 200, h: 150, ox: 0, oy: 0 };
    const groups = {};
    for (const b of (def.bindings || [])) { if (b.group) (groups[b.group] = groups[b.group] || []).push(b); }
    const items = [];
    for (const gid in groups) {
        const byRole = {};
        for (const b of groups[gid]) byRole[b.role] = b;
        const p = (r) => byRole[r] ? num(params[byRole[r].param]) : undefined;
        if (byRole.x && byRole.y && byRole.w && byRole.h) items.push({ kind: 'rect', x: p('x'), y: p('y'), w: p('w'), h: p('h') });
        else if (byRole.x && byRole.y) items.push({ kind: 'hole', x: p('x'), y: p('y'), n: 1, r: Math.max(1, stock.w * 0.012) });
    }
    return { stock, items, handles: [] };
}

// One shared FeatureCanvas for the custom panel's 2D mode (lazy).
let _layout = null;
export function renderLayout2D(container, def, params) {
    if (!container) return;
    if (!_layout) _layout = new FeatureCanvas();
    _layout.render(container, layoutSpecFromOp(def, params));
}
