/**
 * tests/support/served/literalHoleReference.js — THE FROZEN LITERAL HOLE KERNELS (t1385). TEST-ONLY. NEVER SHIPPED.
 *
 * Served at `/_test/literalHoleReference.js` by the mem-server and reachable from nothing else. The app cannot import
 * it, and that is the point: this is a duplicate of arithmetic the product is RETIRING, kept alive solely so the drill
 * family's equivalence bridges keep an INDEPENDENT truth to compare against.
 *
 * ── WHY A FROZEN COPY EXISTS AT ALL: THE VACUITY TRAP ─────────────────────────────────────────────────────────────
 * Every bridge in the drill arc asserts "the OLD literal composition and the NEW parametric body execute the same
 * moves". Until t1385 the literal side was built from the live registry — `newBlock('array')` wrapping
 * `newBlock('drill'|'bore')` — which was exactly right while the registry still HELD those literal emitters. The switch
 * re-points `drillStack` through `holecycle` and then retires `drill.js` / `bore.js`. At that moment a bridge built from
 * the registry would either fail to resolve or, worse, silently resolve to the parametric path and compare it against
 * ITSELF: 48 bridges passing while proving nothing. That is the trap this module exists to close, and it is why the
 * reference lands in the SAME act as the re-point rather than after it.
 *
 * ── WHAT IS FROZEN AND WHAT IS NOT — the line is deliberate ───────────────────────────────────────────────────────
 * FROZEN here: the KERNEL ARITHMETIC being replaced (the peck ladder, the ring-step and helix walks, the pattern point
 * list). Verbatim copies of `ops/drill.js` peckDrill, `ops/bore.js` helicalBore and `ops/array.js` patternPoints as they
 * stood at t1383, so the comparison is against the code that shipped rather than against a paraphrase of it.
 *
 * NOT frozen: everything the switch is NOT changing. The refs install as ordinary leaf block defs, so the container
 * stamp, the placement fold, label uniquification, modal-feed folding and cap gating all still run through the REAL
 * emitter. Re-implementing those in a reference would make the bridges test a second emitter instead of the real one —
 * and any drift between the two would read as a drill-family regression.
 *
 * ⚠ DO NOT "FIX" ANYTHING IN HERE. A bug in these kernels is part of the reference: the drill family's ledger records
 * two deliberate divergences from exactly this arithmetic (the R-plane rapid, and the helical bore's one-quantum
 * points). Improving the reference would silently move the baseline those exceptions are measured against.
 */

/** num/r3/val/shiftZ — the `ops/util.js` helpers these kernels used, copied so the reference has no product imports. */
const num = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));
const r3 = (n) => Math.round(n * 1000) / 1000;
const val = (v, d) => {
    const s = String(v == null ? '' : v).trim();
    if (/^(#|\[)/.test(s)) return s;         // a #var / [expr] passes through verbatim
    return r3(num(v, d));
};
const shiftZ = (lines, dz) => {
    const d = Number(dz) || 0;
    if (!d) return lines;
    return lines.map((ln) => ln.replace(/Z(-?\d*\.?\d+)/g, (_, z) => 'Z' + r3(parseFloat(z) + d)));
};

/** FROZEN copy of ops/array.js patternPoints (t1383). The rect branch keeps its JS `Set` dedup — the very thing the
 *  parametric body reproduces as a RANGE, and the reason the degenerate-rect divergence is a named envelope gap. */
export function refPatternPoints(p) {
    const pts = [];
    const type = p.pattern || 'grid';
    if (type === 'single') {
        pts.push({ x: num(p.cx, num(p.x0, 0)), y: num(p.cy, num(p.y0, 0)) });
    } else if (type === 'circle') {
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
    } else {
        const cols = Math.max(1, Math.round(num(p.cols, 3))), rows = Math.max(1, Math.round(num(p.rows, 3)));
        const dx = num(p.dx, 20), dy = num(p.dy, 20), x0 = num(p.x0, 0), y0 = num(p.y0, 0);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pts.push({ x: x0 + i * dx, y: y0 + j * dy });
    }
    return pts.map((pt) => ({ x: r3(pt.x), y: r3(pt.y) }));
}

/** FROZEN copy of ops/drill.js peckDrill (t1383) — note `if (prev > 0)`: the literal has NO first-peck rapid, which is
 *  drill-family ledger EXCEPTION 1 (the R-plane). It stays exactly as it was. */
export function refPeckDrill(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = val(p.feed, 100);
    const q = Math.max(0.1, num(p.peck, depth));
    const reentry = 0.5;
    const L = [`G0 X${pt.x} Y${pt.y}`];
    let prev = 0, d = 0;
    while (d < depth - 1e-6) {
        d = Math.min(d + q, depth);
        if (prev > 0) L.push(`G0 Z${r3(-(prev - reentry))}`);
        L.push(`G1 Z${r3(-d)} F${feed}`);
        L.push(`G0 Z${clr}`);
        prev = d;
    }
    return shiftZ(L, num(p.zOff, 0));
}

/** FROZEN copy of ops/bore.js helicalBore (t1383) — including the runaway-pass guard and the trig-based helix points
 *  that make the bore's one-quantum divergence (ledger EXCEPTION 2) what it is. */
export function refHelicalBore(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = val(p.feed, 100);
    const r = (num(p.holeDia, 12) - num(p.toolDia, 6)) / 2, pitch = Math.max(0.05, num(p.pitch, 0.5));
    const ramp = p.ramp === 'helix' ? 'helix' : 'step';
    const zb = num(p.zOff, 0);
    const cx = pt.x, cy = pt.y;
    if (r <= 0.01) return shiftZ([`G0 X${cx} Y${cy}`, `G0 Z${clr}`, `G1 Z${r3(-depth)} F${feed}`, `G0 Z${clr}`], zb);
    const linesPerPass = ramp === 'helix' ? 24 : 2, passes = Math.max(1, Math.ceil(depth / pitch));
    if (passes * linesPerPass > 100000)
        return shiftZ([`G0 X${cx} Y${cy}`, `G0 Z${clr}`, `( bore: ${ramp} too fine — ${passes} passes capped )`, `G0 Z${clr}`], zb);
    const L = [`G0 X${r3(cx + r)} Y${cy}   ( bore radius )`, `G0 Z${clr}`];
    const arc = `G3 X${r3(cx + r)} Y${cy} I${r3(-r)} J0`;
    if (ramp === 'helix') {
        const segPerTurn = 24, turns = Math.max(1, Math.ceil(depth / pitch)), total = turns * segPerTurn;
        L.push(`G1 Z0 F${feed}   ( helix top )`);
        for (let s = 1; s <= total; s++) {
            const a = (s / segPerTurn) * 2 * Math.PI;
            L.push(`G1 X${r3(cx + r * Math.cos(a))} Y${r3(cy + r * Math.sin(a))} Z${r3(-(depth * s) / total)} F${feed}`);
        }
        L.push(`${arc} F${feed}   ( finish circle )`, `G0 Z${clr}`);
        return shiftZ(L, zb);
    }
    let z = 0;
    while (z < depth - 1e-6) {
        z = Math.min(z + pitch, depth);
        L.push(`G1 Z${r3(-z)} F${feed}`, `${arc} F${feed}   ( full circle )`);
    }
    L.push(`${arc}   ( finish pass )`, `G0 Z${clr}`);
    return shiftZ(L, zb);
}

/** The frozen leaf defs, shaped exactly like the `drill`/`bore` blocks they copy (same `emit(p, dx, dy)` contract, same
 *  declared point `extent`), so the REAL emitter stamps and places them identically. */
export const REF_BLOCKS = {
    drill_ref: {
        type: 'drill_ref', label: 'Drill', kind: 'leaf', category: 'Toolpaths',
        defaults: { x: 0, y: 0, depth: 5, peck: 5, feed: 100, clearance: 5, zOff: 0 },
        fields: ['x', 'y', 'depth', 'peck', 'feed', 'clearance'],
        emit: (p, dx = 0, dy = 0) => refPeckDrill({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p),
        extent: (p) => ({ minX: num(p.x, 0), maxX: num(p.x, 0), minY: num(p.y, 0), maxY: num(p.y, 0) }),
    },
    bore_ref: {
        type: 'bore_ref', label: 'Bore', kind: 'leaf', category: 'Toolpaths',
        defaults: { x: 0, y: 0, holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, ramp: 'step', feed: 120, clearance: 5, zOff: 0 },
        fields: ['x', 'y', 'holeDia', 'toolDia', 'depth', 'pitch', 'ramp', 'feed', 'clearance'],
        emit: (p, dx = 0, dy = 0) => refHelicalBore({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p),
        extent: (p) => ({ minX: num(p.x, 0), maxX: num(p.x, 0), minY: num(p.y, 0), maxY: num(p.y, 0) }),
    },
};

/**
 * Install the frozen refs into the live block registry FOR THIS PAGE ONLY (each Playwright test gets a fresh page and a
 * fresh module graph, so nothing leaks between tests). Returns the two type names.
 *
 * The refs are registered rather than called directly so the literal side of a bridge keeps going through the real
 * container stamp and the real emitter passes — see the header on what is deliberately NOT frozen.
 */
export function installLiteralHoleRefs(BLOCKS) {
    for (const [type, def] of Object.entries(REF_BLOCKS)) BLOCKS[type] = def;
    return Object.keys(REF_BLOCKS);
}
