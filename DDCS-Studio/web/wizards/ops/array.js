/**
 * wizards/ops/array.js — ARRAY primitive: a MODIFIER (container), not a leaf.
 *
 * Pattern → XY points; the emit engine stamps the child block(s) at each point (translate by pt).
 * `patternPoints` is shared with the STUDIO drill generator and the 2D layout canvas.
 */
import { num, r3 } from './util.js';
import { pointsBBox } from './placement.js';

/** Pattern → XY list (work coords). grid / line / circle / rect. */
export function patternPoints(p) {
    const pts = [];
    const type = p.pattern || 'grid';
    if (type === 'circle') {
        const cx = num(p.cx, 0), cy = num(p.cy, 0), R = num(p.dia, 50) / 2;
        const n = Math.max(1, Math.round(num(p.count, 6))), a0 = num(p.startAngle, 0) * Math.PI / 180;
        for (let k = 0; k < n; k++) { const a = a0 + k * 2 * Math.PI / n; pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }); }
    } else if (type === 'line') {
        const n = Math.max(1, Math.round(num(p.count, 3))), s = num(p.spacing, 20), a = num(p.angle, 0) * Math.PI / 180;
        const x0 = num(p.x0, 0), y0 = num(p.y0, 0);
        for (let k = 0; k < n; k++) pts.push({ x: x0 + k * s * Math.cos(a), y: y0 + k * s * Math.sin(a) });
    } else if (type === 'rect') {
        const w = num(p.w, 100), h = num(p.h, 80), x0 = num(p.x0, 0), y0 = num(p.y0, 0);
        const nx = Math.max(2, Math.round(num(p.nx, 2))), ny = Math.max(2, Math.round(num(p.ny, 2)));
        const seen = new Set(), add = (x, y) => { const k = r3(x) + ',' + r3(y); if (!seen.has(k)) { seen.add(k); pts.push({ x, y }); } };
        for (let i = 0; i < nx; i++) { const x = x0 + (w * i) / (nx - 1); add(x, y0); add(x, y0 + h); }
        for (let j = 0; j < ny; j++) { const y = y0 + (h * j) / (ny - 1); add(x0, y); add(x0 + w, y); }
    } else { // grid
        const cols = Math.max(1, Math.round(num(p.cols, 3))), rows = Math.max(1, Math.round(num(p.rows, 3)));
        const dx = num(p.dx, 20), dy = num(p.dy, 20), x0 = num(p.x0, 0), y0 = num(p.y0, 0);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pts.push({ x: x0 + i * dx, y: y0 + j * dy });
    }
    return pts.map(pt => ({ x: r3(pt.x), y: r3(pt.y) }));
}

export const arrayBlock = {
    type: 'array', label: 'Array', kind: 'container', category: 'Transforms',
    defaults: { pattern: 'grid', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20, count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, skip: '' },
    fields: ['pattern'],   // pattern-specific fields resolved by fieldsFor()
    // Blocks view carries ALL pattern fields (so every pattern is editable + round-trips); a Blockly extension
    // toggles which are visible per `pattern` (the `dynamic` field). The wizard uses fieldsFor() directly.
    allFields: ['pattern', 'x0', 'y0', 'cols', 'rows', 'dx', 'dy', 'count', 'spacing', 'angle', 'dia', 'startAngle', 'w', 'h', 'nx', 'ny', 'skip'],
    dynamic: 'pattern',
    /** Pattern points; mirrors x0/y0 → cx/cy so circle reads the same origin. */
    points: (p) => patternPoints({ ...p, cx: num(p.x0, 0), cy: num(p.y0, 0) }),
    /** Declared geometry extent = the stamped footprint: the pattern-point bbox grown by the stamped child's OWN extent
     *  (Minkowski sum — a hole is a point, a slot has size). The place fold recomputes this LIVE from params, so the
     *  placement tracks the pattern instead of a frozen snapshot. Returns null when the child can't measure itself
     *  (e.g. an un-migrated slot leaf) → the place fold falls back to the snapshot, so nothing else changes.
     *  Measures the SAME points the container STAMPS — `arrayBlock.points(p)` (which mirrors x0→cx so a circle reads
     *  the pattern origin), NOT raw patternPoints — so the extent can never diverge from the emitted geometry. */
    extent: (p, childExt) => {
        if (!childExt) return null;
        const bb = pointsBBox(arrayBlock.points(p));
        if (!bb) return null;
        return { minX: bb.minX + childExt.minX, maxX: bb.maxX + childExt.maxX, minY: bb.minY + childExt.minY, maxY: bb.maxY + childExt.maxY };
    },
    /** Which fields to show depends on the chosen pattern. */
    fieldsFor(p) {
        const base = ['pattern', 'x0', 'y0'];
        if (p.pattern === 'circle') return [...base, 'dia', 'count', 'startAngle', 'skip'];
        if (p.pattern === 'line') return [...base, 'count', 'spacing', 'angle', 'skip'];
        if (p.pattern === 'rect') return [...base, 'w', 'h', 'nx', 'ny', 'skip'];   // rect-perimeter
        return [...base, 'cols', 'rows', 'dx', 'dy', 'skip'];   // grid
    },
};
