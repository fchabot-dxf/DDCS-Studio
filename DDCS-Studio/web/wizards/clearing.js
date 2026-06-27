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
/** Regular n-gon of circum-radius r about (cx,cy); a flat edge sits at the bottom (first vertex at -90°). */
export function polygonContour(cx, cy, r, sides = 6) {
    const n = Math.max(3, Math.round(sides)), c = [], off = -Math.PI / 2 + Math.PI / n;
    for (let i = 0; i < n; i++) { const a = off + (2 * Math.PI * i) / n; c.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    return [c];
}
/** Ellipse of x-radius rx, y-radius ry about (cx,cy). */
export function ellipseContour(cx, cy, rx, ry, seg = 96) {
    const c = [];
    for (let i = 0; i < seg; i++) { const a = (2 * Math.PI * i) / seg; c.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); }
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
    // Runaway guard: a pathological height/stepover (e.g. the value-glow perturbs a fill's height/strokeWidth to its
    // ~1e6 sentinel to localize that token) would scan tens of millions of rows SYNCHRONOUSLY and freeze the tab. A real
    // fill is far under the cap, so emit stays byte-identical; an absurd one yields no rows (an empty toolpath — the
    // caller signals it, e.g. fillText's '( nothing to engrave )'). Mirrors blockEmitter's Math.min(steps,100000) guard.
    if ((ymax - ymin) / yStep > 100000) return [];
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

// ── Heavy fill blocks (Fill Zigzag / Fill Concentric) ────────────────────────────────────────────────
// Richer, dedicated versions of the scanline/ring fills above: zigzag scans at an arbitrary angle and can
// run one-way (climb/conventional); concentric clears outside-in or inside-out with an optional finish pass.
// At their defaults (angle 0 / both-ways / outside-in / no finish) they are byte-identical to fillLevelMoves
// and concentricRect/Circle, so reworking the wizards onto them changes nothing until those knobs are used.

/** Zig-zag (scanline) fill at an arbitrary scan angle (deg off +X). oneway = lift+return every pass
 *  (climb/conventional); reverse = cut the other way. Rotates the region into the scan frame, fills with
 *  the shared scanline, and rotates each move back to world — so holes still lift correctly at any angle. */
export function zigzagFill(contours, step, ctx, opts = {}) {
    const { z, clr, feed, plunge } = ctx;
    const ang = (opts.angleDeg || 0) * Math.PI / 180, oneway = !!opts.oneway, reverse = !!opts.reverse;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const toScan = (p) => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos });   // world → scan (rotate −ang)
    const toWorld = (x, y) => ({ x: x * cos - y * sin, y: x * sin + y * cos });          // scan → world (rotate +ang)
    const rows = scanlineFill(contours.map((c) => c.map(toScan)), step);
    const L = [];
    const G0 = (x, y) => { const w = toWorld(x, y); return `G0 X${r3(w.x)} Y${r3(w.y)}`; };
    const G1 = (x, y) => { const w = toWorld(x, y); return `G1 X${r3(w.x)} Y${r3(w.y)} F${feed}`; };
    let dir = reverse ? -1 : 1, started = false, liftNext = false;
    for (let ri = 0; ri < rows.length; ri++) {
        const ordered = dir > 0 ? rows[ri].spans : rows[ri].spans.slice().reverse();
        const y = rows[ri].y;
        for (let si = 0; si < ordered.length; si++) {
            const [xlo, xhi] = ordered[si];
            const xs = dir > 0 ? xlo : xhi, xe = dir > 0 ? xhi : xlo;
            if (!started) { L.push(G0(xs, y), `G1 Z${r3(z)} F${plunge}`); started = true; }
            else if (oneway || si > 0 || liftNext) { L.push(`G0 Z${r3(clr)}`, G0(xs, y), `G1 Z${r3(z)} F${plunge}`); }
            else { L.push(G1(xs, y)); }                       // both-ways: step through the cleared band, no lift
            L.push(G1(xe, y));
            liftNext = false;
        }
        liftNext = ordered.length > 1;                        // prior row had holes → lift into the next
        if (!oneway) dir = -dir;                              // one-way keeps the same cut direction every pass
    }
    return L;
}

/** Concentric (ring) fill. order = 'outside-in' (default) | 'inside-out'; finishPass = an extra clean pass
 *  around the outer boundary at the end. `rg` is a Region descriptor ({kind:'rect',x,y,w,h} | {kind:'circle',cx,cy,r}). */
export function concentricFill(rg, step, ctx, opts = {}) {
    const { z, clr, feed, plunge } = ctx;
    const insideOut = opts.order === 'inside-out', finish = !!opts.finishPass;
    const L = [];
    let first = true;
    const plungeTo = (x, y) => { L.push(`G0 X${r3(x)} Y${r3(y)}`, `G1 Z${r3(z)} F${plunge}`); first = false; };

    if (rg.kind === 'circle') {
        const radii = [];
        for (let rad = rg.r; rad > 1e-6; rad -= step) radii.push(rad);
        const seq = insideOut ? radii.slice().reverse() : radii;
        if (insideOut && seq.length) plungeTo(rg.cx, rg.cy);   // start at the centre, spiral out (no uncut core)
        for (const rad of seq) {
            const sx = rg.cx + rad, sy = rg.cy;
            if (first) plungeTo(sx, sy); else L.push(`G1 X${r3(sx)} Y${r3(sy)} F${feed}`);
            L.push(`G3 X${r3(sx)} Y${r3(sy)} I${r3(-rad)} J0 F${feed}`);   // full CCW circle
        }
        if (!insideOut && !first) L.push(`G1 X${r3(rg.cx)} Y${r3(rg.cy)} F${feed}`);   // ending inward → clear the core
        if (finish && seq.length) {
            const sx = rg.cx + rg.r;
            L.push(`G0 Z${r3(clr)}`, `G0 X${r3(sx)} Y${r3(rg.cy)}`, `G1 Z${r3(z)} F${plunge}`, `G3 X${r3(sx)} Y${r3(rg.cy)} I${r3(-rg.r)} J0 F${feed}`);
        }
        return L;
    }

    const x0 = rg.x, y0 = rg.y, x1 = rg.x + rg.w, y1 = rg.y + rg.h;
    const rings = [];
    for (let inset = 0; ; inset += step) {
        const ax = x0 + inset, ay = y0 + inset, bx = x1 - inset, by = y1 - inset;
        if (bx - ax < 1e-6 || by - ay < 1e-6) break;
        rings.push({ ax, ay, bx, by });
    }
    const seq = insideOut ? rings.slice().reverse() : rings;
    for (const { ax, ay, bx, by } of seq) {
        if (first) plungeTo(ax, ay); else L.push(`G1 X${r3(ax)} Y${r3(ay)} F${feed}`);   // diagonal step to the next ring
        L.push(`G1 X${r3(bx)} Y${r3(ay)} F${feed}`, `G1 X${r3(bx)} Y${r3(by)} F${feed}`,
               `G1 X${r3(ax)} Y${r3(by)} F${feed}`, `G1 X${r3(ax)} Y${r3(ay)} F${feed}`);
    }
    if (finish && rings.length) {
        const o = rings[0];   // the outer ring, run clean last
        L.push(`G0 Z${r3(clr)}`, `G0 X${r3(o.ax)} Y${r3(o.ay)}`, `G1 Z${r3(z)} F${plunge}`,
               `G1 X${r3(o.bx)} Y${r3(o.ay)} F${feed}`, `G1 X${r3(o.bx)} Y${r3(o.by)} F${feed}`,
               `G1 X${r3(o.ax)} Y${r3(o.by)} F${feed}`, `G1 X${r3(o.ax)} Y${r3(o.ay)} F${feed}`);
    }
    return L;
}

/** Depth levels for a stepdown: [sd, 2·sd, …, depth] (always finishing exactly at depth). */
export function depthLevels(depth, stepdown) {
    const D = Math.max(0, depth), sd = Math.max(0.05, stepdown), out = [];
    for (let d = sd; ; d += sd) { out.push(Math.min(d, D)); if (d >= D) break; }
    return out;
}
