/**
 * wizards/ops/region.js — REGION: a shape value (kind:'reporter', returns:'region', category:'Shapes').
 *
 * The boundary as its own block (per the granular decomposition): a Region plugs into the `region` socket
 * of a fill/wall op, so the shape feeds the operation instead of being baked into it. `reduce` returns a
 * descriptor { kind, contour, …bounds } — zigzag scans the contour, concentric uses the bounds/centre,
 * the wall traces the contour. Rect + circle for now (clearing.js has both contour builders).
 */
import { num } from './util.js';
import { rectContour, circleContour, polygonContour, ellipseContour } from '../clearing.js';

/** Region params → descriptor. Circle/polygon/ellipse are CENTRED at (x,y) with `w` (and `h` for ellipse) as
 *  diameters; rect is the corner (x,y)+w×h. polygon adds `sides`. */
export function regionDesc(p) {
    const x = num(p.x, 0), y = num(p.y, 0), w = num(p.w, 50), h = num(p.h, 30);
    if (p.shape === 'circle') { const r = w / 2; return { kind: 'circle', cx: x, cy: y, r, contour: circleContour(x, y, r) }; }
    if (p.shape === 'polygon') { const r = w / 2, n = Math.max(3, Math.round(num(p.sides, 6))); return { kind: 'polygon', cx: x, cy: y, r, sides: n, contour: polygonContour(x, y, r, n) }; }
    if (p.shape === 'ellipse') { const rx = w / 2, ry = h / 2; return { kind: 'ellipse', cx: x, cy: y, rx, ry, contour: ellipseContour(x, y, rx, ry) }; }
    return { kind: 'rect', x, y, w, h, contour: rectContour(x, y, x + w, y + h) };
}

/** A fill/wall op's `region` param → a descriptor: a plugged Region resolves to one; empty → a default rect. */
export function coerceRegion(v) {
    return v && v.contour ? v : regionDesc({ shape: 'rect', x: 0, y: 0, w: 50, h: 30 });
}

export const regionBlock = {
    type: 'region', label: 'Region', kind: 'reporter', returns: 'region', category: 'Shapes',
    defaults: { shape: 'rect', x: 0, y: 0, w: 50, h: 30, sides: 6 },
    fields: ['shape', 'x', 'y', 'w', 'h', 'sides'],   // shape: rect/circle/polygon/ellipse; w=diameter (circle/polygon), w×h=ellipse; sides=polygon
    allFields: ['shape', 'x', 'y', 'w', 'h', 'sides'],
    // t2403 (BACKLOG #48 item 5) — `h` only means anything for rect/ellipse (`regionDesc`, above: circle/
    // polygon use `w` alone as a diameter), `sides` only for polygon. Every other shape showed both regardless.
    // ⚠ THE LABEL ITSELF STAYS UNCHANGED, DELIBERATELY: `w` reads "Width" for rect/ellipse but is really a
    // DIAMETER for circle/polygon (see the field comment above) — a per-shape-reactive label would need NEW
    // machinery (jsonDef()'s own `labels` map is a static, build-time string, not reactive to the live `shape`
    // field), which the dispatch's own instruction was explicit not to build for this. Noted here instead.
    dynamic: 'shape',
    fieldsFor(p) {
        const shape = (p && p.shape) || 'rect';
        const f = ['shape', 'x', 'y', 'w'];
        if (shape === 'rect' || shape === 'ellipse') f.push('h');
        if (shape === 'polygon') f.push('sides');
        return f;
    },
    reduce: (p) => regionDesc(p),
};
