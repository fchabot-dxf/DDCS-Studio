/**
 * DDCS Studio — G-code toolpath parser
 *
 * Parses LITERAL coordinate motion (G0/G1/G2/G3) from the editor into 3D line
 * segments for the preview. It silently skips anything it cannot resolve to a
 * real coordinate: lines containing #variables, G31 probing, or pure comments.
 *
 * Scope note: this app mostly generates variable-driven probe macros — those
 * cannot be plotted because the numbers aren't known until the machine runs.
 * This parser is for CAM-generated .nc files and hand-written cutting code.
 */

// Matches a single letter address + numeric value, e.g. "X-12.5", "G1", "F200".
const GP_TOKEN_RE = /([A-Za-z])\s*([-+]?\d*\.?\d+)/g;

export function parseGcode(text) {
    const segments = []; // { x1,y1,z1, x2,y2,z2, rapid }

    let pos = { x: 0, y: 0, z: 0 };
    let motion = 0;        // modal motion: 0 rapid, 1 feed, 2 CW arc, 3 CCW arc
    let absolute = true;   // G90 abs / G91 incremental
    let unitScale = 1;     // G21 mm = 1, G20 inch = 25.4 (everything stored in mm)
    let plane = 17;        // G17 XY, G18 ZX, G19 YZ
    let started = false;

    const bounds = {
        minX: Infinity, minY: Infinity, minZ: Infinity,
        maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
    };
    let feedCount = 0, rapidCount = 0, skipped = 0;

    const grow = (p) => {
        if (p.x < bounds.minX) bounds.minX = p.x;
        if (p.y < bounds.minY) bounds.minY = p.y;
        if (p.z < bounds.minZ) bounds.minZ = p.z;
        if (p.x > bounds.maxX) bounds.maxX = p.x;
        if (p.y > bounds.maxY) bounds.maxY = p.y;
        if (p.z > bounds.maxZ) bounds.maxZ = p.z;
    };

    const lines = String(text || '').split(/\r?\n/);

    for (const raw of lines) {
        // Strip comments: ( ... ) parenthetical and ; trailing
        let line = raw.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, ' ');
        if (!line.trim()) continue;
        // Unresolvable lines: variables (#) — skip whole line
        if (line.indexOf('#') !== -1) { skipped++; continue; }

        const words = {};   // address -> value (last wins), except G (collected)
        const gcodes = [];
        let m;
        GP_TOKEN_RE.lastIndex = 0;
        while ((m = GP_TOKEN_RE.exec(line)) !== null) {
            const letter = m[1].toUpperCase();
            const value = parseFloat(m[2]);
            if (letter === 'G') gcodes.push(value);
            else words[letter] = value;
        }

        // G31 (probe) — coordinates aren't deterministic; skip
        if (gcodes.indexOf(31) !== -1) { skipped++; continue; }

        // Apply modal settings present on this line
        for (const g of gcodes) {
            if (g === 20) unitScale = 25.4;
            else if (g === 21) unitScale = 1;
            else if (g === 90) absolute = true;
            else if (g === 91) absolute = false;
            else if (g === 17) plane = 17;
            else if (g === 18) plane = 18;
            else if (g === 19) plane = 19;
            else if (g === 0 || g === 1 || g === 2 || g === 3) motion = g;
        }

        const has = (k) => Object.prototype.hasOwnProperty.call(words, k);
        const hasAxis = has('X') || has('Y') || has('Z');
        const hasArcOff = has('I') || has('J') || has('K') || has('R');
        if (!hasAxis && !hasArcOff) continue; // modal-only / non-motion line

        // Resolve target position (carry current value for omitted axes)
        const target = { x: pos.x, y: pos.y, z: pos.z };
        if (has('X')) target.x = absolute ? words.X * unitScale : pos.x + words.X * unitScale;
        if (has('Y')) target.y = absolute ? words.Y * unitScale : pos.y + words.Y * unitScale;
        if (has('Z')) target.z = absolute ? words.Z * unitScale : pos.z + words.Z * unitScale;

        if (!started) { grow(pos); started = true; }

        if (motion === 0 || motion === 1) {
            segments.push({
                x1: pos.x, y1: pos.y, z1: pos.z,
                x2: target.x, y2: target.y, z2: target.z,
                rapid: motion === 0,
            });
            if (motion === 0) rapidCount++; else feedCount++;
            grow(target);
            pos = target;
        } else {
            // Arc G2/G3 — interpolate into short segments
            const pts = gpArcPoints(pos, target, words, motion, plane, unitScale);
            let prev = pos;
            for (let i = 1; i < pts.length; i++) {
                const p = pts[i];
                segments.push({
                    x1: prev.x, y1: prev.y, z1: prev.z,
                    x2: p.x, y2: p.y, z2: p.z,
                    rapid: false,
                });
                grow(p);
                prev = p;
            }
            feedCount++;
            pos = target;
        }
    }

    return {
        segments,
        bounds: started ? bounds : null,
        stats: { feed: feedCount, rapid: rapidCount, skipped, drawable: segments.length > 0 },
    };
}

// Interpolate a G2/G3 arc into points. Center from I/J/K offsets (incremental
// from start) or an R radius. Linear interpolation of the plane-normal axis
// gives helical (ramping) arcs. G17 is exact; G18/G19 are best-effort.
function gpArcPoints(start, end, w, motion, plane, scale) {
    let a, b, lin;
    if (plane === 18) { a = 'x'; b = 'z'; lin = 'y'; }
    else if (plane === 19) { a = 'y'; b = 'z'; lin = 'x'; }
    else { a = 'x'; b = 'y'; lin = 'z'; }

    const sa = start[a], sb = start[b], ea = end[a], eb = end[b];
    const sLin = start[lin], eLin = end[lin];

    const offFor = (axis) => (axis === 'x' ? w.I : axis === 'y' ? w.J : w.K);

    let cx, cy;
    if (offFor(a) !== undefined || offFor(b) !== undefined) {
        cx = sa + (offFor(a) || 0) * scale;
        cy = sb + (offFor(b) || 0) * scale;
    } else if (w.R !== undefined) {
        const R = w.R * scale;
        const mx = (sa + ea) / 2, my = (sb + eb) / 2;
        const dx = ea - sa, dy = eb - sb;
        const d = Math.hypot(dx, dy);
        if (d === 0 || Math.abs(R) < d / 2 - 1e-6) return [start, end]; // invalid → line
        const h = Math.sqrt(Math.max(0, R * R - (d * d) / 4));
        const ux = -dy / d, uy = dx / d; // unit perpendicular
        const sign = (motion === 2 ? -1 : 1) * (R >= 0 ? 1 : -1);
        cx = mx + sign * h * ux;
        cy = my + sign * h * uy;
    } else {
        return [start, end];
    }

    const r = Math.hypot(sa - cx, sb - cy);
    let a0 = Math.atan2(sb - cy, sa - cx);
    const a1raw = Math.atan2(eb - cy, ea - cx);
    let a1 = a1raw;
    if (motion === 3) { if (a1 <= a0) a1 += Math.PI * 2; }       // CCW
    else { if (a1 >= a0) a1 -= Math.PI * 2; }                    // CW
    let sweep = a1 - a0;
    if (Math.abs(sweep) < 1e-9) sweep = (motion === 3 ? 1 : -1) * Math.PI * 2; // full circle

    const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36))); // ~5° chords
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
