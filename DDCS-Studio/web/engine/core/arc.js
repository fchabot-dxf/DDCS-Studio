/**
 * engine/core/arc.js — interpolate a G2/G3 arc into a polyline of points.
 *
 * Pure geometry: center from I/J/K offsets or an R radius, plane-aware (G17/18/19), with the
 * linear (helix) axis interpolated across the sweep. Used by the execution-engine trace so the
 * drawn toolpath includes arcs (the engine's real-time play still steps line-by-line). Endpoints
 * are RESOLVED coordinates (the caller has already evaluated #vars), so this never sees a macro.
 *
 *   arcPoints(start, end, off, motion, plane, scale) -> [{x,y,z}, ...]  (includes start & end)
 *     start/end : {x,y,z}    off : {I,J,K,R} (any may be null)    motion : 2 (CW) | 3 (CCW)
 *     plane     : 17|18|19   scale : unit scale (G20 inch = 25.4, G21 mm = 1)
 *
 * A degenerate arc (no usable center) returns just [start, end] — a straight chord.
 */
export function arcPoints(start, end, off, motion, plane, scale = 1) {
    let a, b, lin;
    if (plane === 18) { a = 'x'; b = 'z'; lin = 'y'; }
    else if (plane === 19) { a = 'y'; b = 'z'; lin = 'x'; }
    else { a = 'x'; b = 'y'; lin = 'z'; }

    const sa = start[a], sb = start[b], ea = end[a], eb = end[b];
    const sLin = start[lin], eLin = end[lin];
    const offFor = (axis) => (axis === 'x' ? off.I : axis === 'y' ? off.J : off.K);

    let cx, cy;
    if ((offFor(a) != null) || (offFor(b) != null)) {
        cx = sa + (offFor(a) || 0) * scale;
        cy = sb + (offFor(b) || 0) * scale;
    } else if (off.R != null) {
        const R = off.R * scale;
        const mx = (sa + ea) / 2, my = (sb + eb) / 2;
        const dx = ea - sa, dy = eb - sb;
        const d = Math.hypot(dx, dy);
        if (d === 0 || Math.abs(R) < d / 2 - 1e-6) return [start, end];
        const h = Math.sqrt(Math.max(0, R * R - (d * d) / 4));
        const ux = -dy / d, uy = dx / d;
        const sign = (motion === 2 ? -1 : 1) * (R >= 0 ? 1 : -1);
        cx = mx + sign * h * ux;
        cy = my + sign * h * uy;
    } else {
        return [start, end];
    }

    const r = Math.hypot(sa - cx, sb - cy);
    let a0 = Math.atan2(sb - cy, sa - cx);
    let a1 = Math.atan2(eb - cy, ea - cx);
    if (motion === 3) { if (a1 <= a0) a1 += Math.PI * 2; }
    else { if (a1 >= a0) a1 -= Math.PI * 2; }
    let sweep = a1 - a0;
    if (Math.abs(sweep) < 1e-9) sweep = (motion === 3 ? 1 : -1) * Math.PI * 2;

    const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36)));   // ~5° chords
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = a0 + sweep * t;
        const p = { x: 0, y: 0, z: 0 };
        p[a] = cx + r * Math.cos(ang);
        p[b] = cy + r * Math.sin(ang);
        p[lin] = sLin + (eLin - sLin) * t;
        pts.push(p);
    }
    return pts;
}
