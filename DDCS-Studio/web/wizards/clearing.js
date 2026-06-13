/**
 * wizards/clearing.js — shared area-clearing helpers for the Mill (cutting) generators.
 *
 * Pocket, Surfacing and Text-fill all reduce to the same job: take a set of closed CONTOURS (world
 * XY, already the tool-CENTRE boundary — i.e. inset by the tool radius), fill the interior, and emit
 * flat G-code. Keeping the fill here means the generators stay tiny and we only debug the geometry once.
 *
 *   scanlineFill(contours, yStep)      even-odd scanline → rows of x-spans (handles holes: O, A, 8…)
 *   fillLevelMoves(rows, ctx)          zig-zag the spans into G0/G1, lifting between disjoint spans
 *   concentricRect / concentricCircle  analytic inward offset rings (the 'spiral' strategy)
 *   contourLevel(contours, ctx)        one clean pass around each contour (wall finish / glyph edge)
 *   rectContour / circleContour        region → contour(s) for the scanline filler
 *
 * ctx = { z, clr, feed, plunge } — cut depth (signed, e.g. -2), clearance Z, cut feed, plunge feed.
 * Everything returns plain G0/G1/G2/G3 strings in the active WCS — no #vars / IF / GOTO.
 *
 * Conventions match gcodeViz3d.js / featureCanvas.js: work coords X-right / Y-up, mm, feed mm/min.
 */
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Region → contour(s). A contour is a closed ring of {x,y} (the close edge is implicit). */
export function rectContour(x0, y0, x1, y1) {
    return [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]];
}
export function circleContour(cx, cy, r, seg = 96) {
    const c = [];
    for (let i = 0; i < seg; i++) { const a = (2 * Math.PI * i) / seg; c.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    return [c];
}

/**
 * Non-zero-winding scanline fill. Rows are spaced `yStep` apart; each row lists the inside x-spans at
 * that y. Non-zero (not even-odd) so OVERLAPPING same-wound contours fill solid — which is what lets
 * the text generator union many ribbon pieces per glyph while the counters (O/A/8 holes), left
 * uncovered by any ribbon, stay empty. For a single CCW contour (pocket/surfacing) it is identical to
 * even-odd. Returns [{ y, spans:[[x0,x1],…] }].
 */
export function scanlineFill(contours, yStep) {
    let ymin = Infinity, ymax = -Infinity;
    for (const c of contours) for (const p of c) { if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y; }
    if (!isFinite(ymin) || ymax - ymin < 1e-6 || !(yStep > 0)) return [];
    const rows = [];
    for (let y = ymin + yStep * 0.5; y < ymax; y += yStep) {
        const xs = [];   // { x, w:+1 upward crossing / -1 downward }
        for (const c of contours) {
            const n = c.length;
            for (let i = 0; i < n; i++) {
                const a = c[i], b = c[(i + 1) % n];
                // half-open test (ya<=y<yb or yb<=y<ya) so a vertex shared by two edges counts once
                if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
                    xs.push({ x: a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x), w: b.y > a.y ? 1 : -1 });
                }
            }
        }
        if (xs.length < 2) continue;
        xs.sort((p, q) => p.x - q.x);
        const spans = [];
        let wind = 0, start = 0;
        for (const c of xs) {
            const prev = wind;
            wind += c.w;
            if (prev === 0 && wind !== 0) start = c.x;                 // entering filled region
            else if (prev !== 0 && wind === 0 && c.x - start > 1e-4) spans.push([start, c.x]);   // leaving
        }
        if (spans.length) rows.push({ y, spans });
    }
    return rows;
}

/**
 * Zig-zag the scanline rows into moves at depth ctx.z. Convex regions (one span per row) cut as a
 * smooth boustrophedon with no lifts; rows with holes lift to clearance and re-plunge between spans.
 */
export function fillLevelMoves(rows, ctx) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    let dir = 1, started = false, liftNext = false;
    for (let ri = 0; ri < rows.length; ri++) {
        const ordered = dir > 0 ? rows[ri].spans : rows[ri].spans.slice().reverse();
        const y = rows[ri].y;
        for (let si = 0; si < ordered.length; si++) {
            const [xlo, xhi] = ordered[si];
            const xs = dir > 0 ? xlo : xhi, xe = dir > 0 ? xhi : xlo;
            if (!started) { L.push(`G0 X${r3(xs)} Y${r3(y)}`, `G1 Z${r3(z)} F${plunge}`); started = true; }
            else if (si > 0 || liftNext) { L.push(`G0 Z${r3(clr)}`, `G0 X${r3(xs)} Y${r3(y)}`, `G1 Z${r3(z)} F${plunge}`); }
            else { L.push(`G1 X${r3(xs)} Y${r3(y)} F${feed}`); }   // step to the next row through the cleared band
            L.push(`G1 X${r3(xe)} Y${r3(y)} F${feed}`);
            liftNext = false;
        }
        liftNext = ordered.length > 1;   // prior row had holes → start the next one with a lift
        dir = -dir;
    }
    return L;
}

/** One clean pass around each contour at depth ctx.z (wall finish, or a glyph outline). */
export function contourLevel(contours, ctx) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    for (const c of contours) {
        if (c.length < 2) continue;
        L.push(`G0 Z${r3(clr)}`, `G0 X${r3(c[0].x)} Y${r3(c[0].y)}`, `G1 Z${r3(z)} F${plunge}`);
        for (let i = 1; i < c.length; i++) L.push(`G1 X${r3(c[i].x)} Y${r3(c[i].y)} F${feed}`);
        L.push(`G1 X${r3(c[0].x)} Y${r3(c[0].y)} F${feed}`);
    }
    return L;
}

/** Inward concentric rectangles (plunge at the outer corner, step in by `step` each ring). */
export function concentricRect(x0, y0, x1, y1, step, ctx) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    let inset = 0, first = true;
    for (;;) {
        const ax = x0 + inset, ay = y0 + inset, bx = x1 - inset, by = y1 - inset;
        if (bx - ax < 1e-6 || by - ay < 1e-6) break;
        if (first) { L.push(`G0 X${r3(ax)} Y${r3(ay)}`, `G1 Z${r3(z)} F${plunge}`); first = false; }
        else L.push(`G1 X${r3(ax)} Y${r3(ay)} F${feed}`);   // diagonal step to the next ring's corner
        L.push(`G1 X${r3(bx)} Y${r3(ay)} F${feed}`, `G1 X${r3(bx)} Y${r3(by)} F${feed}`,
               `G1 X${r3(ax)} Y${r3(by)} F${feed}`, `G1 X${r3(ax)} Y${r3(ay)} F${feed}`);
        inset += step;
    }
    void clr;
    return L;
}

/** Inward concentric circles (full G3 arcs), then drag to centre to clear the core. */
export function concentricCircle(cx, cy, Rc, step, ctx) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    let rad = Rc, first = true;
    while (rad > 1e-6) {
        const sx = cx + rad, sy = cy;
        if (first) { L.push(`G0 X${r3(sx)} Y${r3(sy)}`, `G1 Z${r3(z)} F${plunge}`); first = false; }
        else L.push(`G1 X${r3(sx)} Y${r3(sy)} F${feed}`);
        L.push(`G3 X${r3(sx)} Y${r3(sy)} I${r3(-rad)} J0 F${feed}`);   // full CCW circle
        rad -= step;
    }
    if (!first) L.push(`G1 X${r3(cx)} Y${r3(cy)} F${feed}`);   // clear the centre core
    void clr;
    return L;
}

/** Depth levels for a stepdown: [sd, 2·sd, …, depth] (always finishing exactly at depth). */
export function depthLevels(depth, stepdown) {
    const D = Math.max(0, depth), sd = Math.max(0.05, stepdown), out = [];
    for (let d = sd; ; d += sd) { out.push(Math.min(d, D)); if (d >= D) break; }
    return out;
}
