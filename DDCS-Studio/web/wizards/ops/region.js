/**
 * wizards/ops/region.js — REGION: a shape value (kind:'reporter', returns:'region', category:'Shapes').
 *
 * The boundary as its own block (per the granular decomposition): a Region plugs into the `region` socket
 * of a fill/wall op, so the shape feeds the operation instead of being baked into it. `reduce` returns a
 * descriptor { kind, contour, …bounds } — zigzag scans the contour, concentric uses the bounds/centre,
 * the wall traces the contour. Rect + circle for now (clearing.js has both contour builders).
 */
import { num } from './util.js';
import { rectContour, circleContour } from '../clearing.js';

/** Region params → descriptor. Circle uses `w` as diameter about (x,y); rect is the corner (x,y)+w×h. */
export function regionDesc(p) {
    const x = num(p.x, 0), y = num(p.y, 0), w = num(p.w, 50), h = num(p.h, 30);
    if (p.shape === 'circle') { const r = w / 2; return { kind: 'circle', cx: x, cy: y, r, contour: circleContour(x, y, r) }; }
    return { kind: 'rect', x, y, w, h, contour: rectContour(x, y, x + w, y + h) };
}

/** A fill/wall op's `region` param → a descriptor: a plugged Region resolves to one; empty → a default rect. */
export function coerceRegion(v) {
    return v && v.contour ? v : regionDesc({ shape: 'rect', x: 0, y: 0, w: 50, h: 30 });
}

export const regionBlock = {
    type: 'region', label: 'Region', kind: 'reporter', returns: 'region', category: 'Shapes',
    defaults: { shape: 'rect', x: 0, y: 0, w: 50, h: 30 },
    fields: ['shape', 'x', 'y', 'w', 'h'],   // shape select rect/circle; w = diameter for circle
    reduce: (p) => regionDesc(p),
};
