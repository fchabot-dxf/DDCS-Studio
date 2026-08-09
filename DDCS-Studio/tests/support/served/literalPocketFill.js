/**
 * tests/support/served/literalPocketFill.js — THE FROZEN LITERAL POCKET FILL (t1406). TEST-ONLY. NEVER SHIPPED.
 *
 * Served at `/_test/literalPocketFill.js` by the mem-server and reachable from nothing else. This is a verbatim copy
 * of the kernel walks a RECT pocket's clearing pass runs through TODAY — `fillStrategy` and everything it reaches —
 * kept alive solely so the re-point's equivalence bridges have an INDEPENDENT truth to compare against.
 *
 * ── WHY IT EXISTS: THE VACUITY TRAP, the same one t1385 closed for the drill family ───────────────────────────────
 * Every bridge in this act asserts "the literal fill and the parametric surfaceraster cut the same set of moves per
 * level". The moment `pocketStack` is re-pointed, a bridge that built its literal side by calling `pocketStack` would
 * compare the parametric emit TO ITSELF and pass while proving nothing. So the reference lands in the SAME act as the
 * re-point, never after it.
 *
 * ⚠ THE LITERAL ATOMS ARE **NOT** RETIRING THIS ACT, and that is why the freeze is worth its cost anyway.
 * `pocketfill`/`pocketwall` still emit for every arm outside the eligible one (non-rect, a rest tool, a one-way
 * raster, too-small, an unproven strategy/entry). A bridge could therefore have used the LIVE registry today and
 * stayed honest — right up until somebody re-points `fillStrategy` itself, at which point the baseline would move
 * silently underneath every assertion in this act. Frozen is the only version of "as they ship TODAY" that stays true.
 *
 * ── t1464 UPDATE — "NOT RETIRING THIS ACT" IS NOW "NOT RETIRING, FULL STOP" ──────────────────────────────────────
 * That paragraph read as a schedule (retirement pending, just not yet). It is settled: `pocketfill`'s domain is
 * DECLARED and PERMANENT — non-rect shapes (`POCKET_SHAPE_GAP`: a JS-walked offset polyline, 124-2496 trig calls per
 * level against ZERO for a rect) and rest machining (`REST_PARAMETRIC_GAP`: SQRT per row per corner). The one-way
 * raster arm did convert (t1418) and `direction` left the boundary; the rest of that list stands.
 *
 * WHAT THAT CHANGES FOR THIS FILE: nothing about the freeze, and everything about WHY it is kept. It is no longer a
 * bridge held until an atom dies — the atom is not dying — it is the independent baseline for a boundary that is now
 * permanent, which is a longer job, not a shorter one.
 *
 * ── WHAT IS FROZEN, AND WHAT DELIBERATELY IS NOT ──────────────────────────────────────────────────────────────────
 * FROZEN: the KERNEL ARITHMETIC — `fillStrategy`'s rect dispatch, `scanlineFill`, `fillLevelMoves`, `onewayMoves`,
 * `concentricRect`, `entryOrPlunge`/`levelEntry` and `helixPoints`, verbatim as of t1404.
 * NOT frozen: everything the re-point is not changing — the StepDown fold, the place fold, modal-feed folding, label
 * uniquification, cap gating. The reference installs as an ordinary kind:'fill' leaf so all of that still runs through
 * the REAL emitter; re-implementing it here would test a second emitter instead of the one that ships.
 *
 * ── RECT ONLY, BY DECLARATION ─────────────────────────────────────────────────────────────────────────────────────
 * The re-point touches the RECT arm and nothing else, so this reference covers rect and THROWS on any other shape
 * rather than quietly returning something. The non-rect arms are proven unchanged a different way — they are
 * byte-identical to tests/fixtures/pocket-golden.json, which is itself a frozen capture and needs no second copy.
 *
 * ⚠ DO NOT "FIX" ANYTHING IN HERE. A quirk in these kernels is part of the reference. The act's ledger records the
 * deliberate divergences (the sub-0.05 stepdown floor, the 0.2mm stepover floor); improving the reference would move
 * the baseline those exceptions are measured against.
 */

/** The ops/util.js helpers these kernels used, copied so the reference has no product imports. */
const r3 = (n) => Math.round(n * 1000) / 1000;

/* ==== FROZEN VERBATIM: clearing.js  levelEntry / entryOrPlunge (t804 depth entry) ==== */
/** t804 — DEPTH ENTRY: the per-level descent to the cut Z `z`, by mode. Returns { ok, lines?, why? }. When ok, the caller
 *  kernel emits `lines` in place of its straight plunge; else it falls back to the plunge (byte-identical) — the honest
 *  degrade. Every entry rapids to (x0,y0), drops to the previous cleared floor (prevZ), descends `drop = prevZ − z`, and
 *  ENDS at (x0,y0,z) so the kernel proceeds unchanged. `plunge` is handled inline by the caller (not routed here).
 *   ramp  — descend TOWARD the region centre (cx,cy) at ≤ rampAngle°, then return to the start at z. Greys (ok:false +
 *           why) when the run to centre is shorter than the descent needs (drop / tan(angle)) — the greyed-ramp case.
 *   helix — a linearized descending helix (helixPoints) of radius helixR (the caller clamps it to fit) at (cx,cy),
 *           pitch = mm per rev, then a G1 to the start at z. */
export function levelEntry(mode, o) {
    const { x0, y0, cx, cy, z, prevZ, feed } = o, drop = prevZ - z;
    if (!(drop > 1e-6)) return { ok: false };   // no descent this level → let the kernel plunge (defensive)
    if (mode === 'ramp') {
        const ang = Math.min(45, Math.max(0.5, num(o.rampAngle, 3))), run = drop / Math.tan(ang * Math.PI / 180);
        let mx, my;
        if (o.runX != null && o.runY != null) {
            // t842 — a DECLARED run vector: a SLOT ramps along its LENGTH, a CONTOUR along its FIRST SEGMENT (toward-centre
            // is geometrically wrong for those). `runLen` = the run available that way; too short → degrade with the why.
            const rl = Math.hypot(o.runX, o.runY) || 1, avail = num(o.runLen, rl);
            if (!(avail >= run)) return { ok: false, why: `ramp ${r3(ang)}deg needs ${r3(run)}mm along the run, have ${r3(avail)}mm -> plunge` };
            mx = x0 + run * o.runX / rl; my = y0 + run * o.runY / rl;
        } else {
            // toward the region CENTRE (pocket/surfacing area-fill) — unchanged, byte-identical
            const toC = Math.hypot(cx - x0, cy - y0);
            if (!(toC >= run)) return { ok: false, why: `ramp ${r3(ang)}deg needs ${r3(run)}mm, first move ${r3(toC)}mm -> plunge` };
            const t = run / toC; mx = x0 + t * (cx - x0); my = y0 + t * (cy - y0);
        }
        return { ok: true, lines: [`G0 X${r3(x0)} Y${r3(y0)}`, `G0 Z${r3(prevZ)}`, `G1 X${r3(mx)} Y${r3(my)} Z${r3(z)} F${feed}   ( ramp )`, `G1 X${r3(x0)} Y${r3(y0)} F${feed}`] };
    }
    if (mode === 'helix') {
        // t842 — honest fit: when the op declares a max helix radius it can hold (a narrow slot), a helix that needs more
        // room degrades to the plunge with a why (the ramp precedent). Absent maxHelixR (pocket/surfacing) → unchanged.
        if (o.maxHelixR != null && !(o.maxHelixR >= 0.2)) return { ok: false, why: `helix needs room the geometry lacks -> plunge` };
        const cap = o.maxHelixR != null ? Math.min(num(o.helixR, 3), o.maxHelixR) : num(o.helixR, 3);
        const R = Math.max(0.2, cap), pitch = Math.max(0.1, num(o.helixPitch, 1));
        const pts = helixPoints({ cx, cy, radius: R, depth: drop, pitch, seg: 24 });   // p.z ∈ (0,−drop] → world prevZ+p.z ∈ [prevZ, z]
        const L = [`G0 X${r3(cx + R)} Y${r3(cy)}`, `G0 Z${r3(prevZ)}`];
        for (const p of pts) L.push(`G1 X${r3(p.x)} Y${r3(p.y)} Z${r3(prevZ + p.z)} F${feed}`);
        L.push(`G1 X${r3(x0)} Y${r3(y0)} Z${r3(z)} F${feed}   ( helix )`);
        return { ok: true, lines: L };
    }
    return { ok: false };
}
const num = (v, d) => { const n = Number(v); return isFinite(n) ? n : d; };

/** t804 — a kernel's first descent at (x0,y0): the level-entry (ramp/helix) when `ctx.entry` asks for it AND it fits, else
 *  the kernel's exact `plungeLines` (so PLUNGE — the default — stays byte-for-byte). A ramp that can't fit degrades to the
 *  plunge with a `( why )` comment (the honest greyed-ramp case). ctx carries {entry, cx, cy, z, prevZ, rampAngle, helixR, helixPitch, feed}. */
export function entryOrPlunge(ctx, x0, y0, plungeLines) {
    if (ctx && ctx.entry && ctx.entry !== 'plunge') {
        const e = levelEntry(ctx.entry, { x0, y0, cx: ctx.cx, cy: ctx.cy, z: ctx.z, prevZ: ctx.prevZ, rampAngle: ctx.rampAngle, helixR: ctx.helixR, helixPitch: ctx.helixPitch, feed: ctx.feed, runX: ctx.runX, runY: ctx.runY, runLen: ctx.runLen, maxHelixR: ctx.maxHelixR });
        if (e && e.ok) return e.lines;
        if (e && e.why) return [`( ${e.why} )`, ...plungeLines];
    }
    return plungeLines;
}


/* ==== FROZEN VERBATIM: clearing.js  rectContour ==== */
/** Region → contour(s). A contour is a closed ring of {x,y} (the close edge is implicit). */
export function rectContour(x0, y0, x1, y1) {
    return [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]];
}

/* ==== FROZEN VERBATIM: clearing.js  scanlineFill / fillLevelMoves ==== */

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
            if (!started) { L.push(...entryOrPlunge(ctx, xs, y, [`G0 X${r3(xs)} Y${r3(y)}`, `G1 Z${r3(z)} F${plunge}`])); started = true; }
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


/* ==== FROZEN VERBATIM: clearing.js  concentricRect ==== */
/** Inward concentric rectangles (plunge at the outer corner, step in by `step` each ring). */
export function concentricRect(x0, y0, x1, y1, step, ctx) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    let inset = 0, first = true;
    for (;;) {
        const ax = x0 + inset, ay = y0 + inset, bx = x1 - inset, by = y1 - inset;
        if (bx - ax < 1e-6 || by - ay < 1e-6) break;
        if (first) { L.push(...entryOrPlunge(ctx, ax, ay, [`G0 X${r3(ax)} Y${r3(ay)}`, `G1 Z${r3(z)} F${plunge}`])); first = false; }
        else L.push(`G1 X${r3(ax)} Y${r3(ay)} F${feed}`);   // diagonal step to the next ring's corner
        L.push(`G1 X${r3(bx)} Y${r3(ay)} F${feed}`, `G1 X${r3(bx)} Y${r3(by)} F${feed}`,
               `G1 X${r3(ax)} Y${r3(by)} F${feed}`, `G1 X${r3(ax)} Y${r3(ay)} F${feed}`);
        inset += step;
    }
    void clr;
    return L;
}

/* ==== FROZEN VERBATIM: stepover.js  onewayMoves ==== */
/** One-direction passes (climb/conventional): every pass cut the same way, lift + rapid back between rows. */
function onewayMoves(rows, ctx, reverse) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    let started = false;
    for (const row of rows) {
        for (const [xlo, xhi] of row.spans) {
            const xs = reverse ? xhi : xlo, xe = reverse ? xlo : xhi;
            if (!started) { L.push(...entryOrPlunge(ctx, xs, row.y, [`G0 X${r3(xs)} Y${r3(row.y)}`, `G1 Z${r3(z)} F${plunge}`])); started = true; }
            else L.push(`G0 Z${r3(clr)}`, `G0 X${r3(xs)} Y${r3(row.y)}`, `G1 Z${r3(z)} F${plunge}`);
            L.push(`G1 X${r3(xe)} Y${r3(row.y)} F${feed}`);
        }
    }
    return L;
}

/* ==== FROZEN VERBATIM: stepover.js  fillStrategy ==== */
/** Full clearing toolpath for the region at depth z (auto-cut: StepOver with an empty body). */
export function fillStrategy(p, z) {
    const rg = fillRegion(p), step = Math.max(0.1, num(p.stepover, 4));
    const ctx = { z, clr: num(p.clearance, 5), feed: num(p.feed, 600), plunge: num(p.plunge, 200) };
    // t804 — DEPTH ENTRY context: the per-level descent (ramp/helix) the kernels apply at their first plunge. prevZ = the
    // previous cleared floor (this level's z + the StepDown step `by`); centre + a tool-clamped helix radius from the region.
    ctx.entry = p.entry || 'plunge';
    if (ctx.entry !== 'plunge') {
        ctx.prevZ = z + num(p.by, Math.abs(z));   // by from the enclosing StepDown scope; standalone → the whole depth
        ctx.cx = rg.cx != null ? rg.cx : (rg.x + rg.w / 2);
        ctx.cy = rg.cy != null ? rg.cy : (rg.y + rg.h / 2);
        ctx.rampAngle = num(p.rampAngle, 3);
        const toolR = Math.max(0.1, num(p.toolDia, 6)) / 2, wantR = num(p.helixDia, 0) > 0 ? num(p.helixDia, 0) / 2 : toolR;
        ctx.helixR = Math.max(0.2, Math.min(wantR, regionInradius(rg) - 0.01));   // clamp so the helix + tool stays inside the pocket
        ctx.helixPitch = num(p.helixPitch, 1);
    }
    // Concentric rings: circle + rect keep their analytic kernels (byte-identity); polygon + ellipse now clear via
    // concentricContour — inward OFFSET RINGS over the same offsetRegion the wall uses (t802: replaces the old silent
    // raster FALLBACK, which existed only because concentricRect-on-NaN hung on a centred shape — concentricContour terminates).
    if (p.strategy === 'concentric' && rg.kind === 'circle') return concentricCircle(rg.cx, rg.cy, rg.r, step, ctx);
    if (p.strategy === 'concentric' && rg.kind === 'rect') return concentricRect(rg.x, rg.y, rg.x + rg.w, rg.y + rg.h, step, ctx);
    if (p.strategy === 'concentric') return concentricContour(rg, step, ctx);   // polygon / ellipse
    const rows = scanlineFill(rg.contour, step);
    if (p.direction === 'oneway') return onewayMoves(rows, ctx, false);
    if (p.direction === 'otherway') return onewayMoves(rows, ctx, true);
    return fillLevelMoves(rows, ctx);   // both-ways (default)
}

/* ==== FROZEN VERBATIM: helix.js     helixPoints ==== */
/** Ordered descending helix points (x,y,z), work coords. */
export function helixPoints(p) {
    const cx = num(p.cx, 0), cy = num(p.cy, 0), R = num(p.radius, 10);
    const depth = num(p.depth, 10), pitch = Math.max(0.2, num(p.pitch, 2)), seg = Math.max(8, Math.round(num(p.seg, 24)));
    const a0 = num(p.startAngle, 0) * Math.PI / 180, n = Math.round(Math.max(1, depth / pitch) * seg), pts = [];
    for (let k = 1; k <= n; k++) {
        const a = a0 + k * 2 * Math.PI / seg;
        pts.push({ x: r3(cx + R * Math.cos(a)), y: r3(cy + R * Math.sin(a)), z: r3(-depth * k / n) });
    }
    return pts;
}

/* ==== THE RECT-ONLY ADAPTERS — frozen shape, deliberately NARROWED ==== */

/**
 * The three helpers `fillStrategy` reaches that this reference does NOT need in full. Each is the rect branch of the
 * live function, verbatim, with every other branch replaced by a THROW. That is the declaration: this reference covers
 * the arm the re-point touches and refuses — loudly, by name — on anything else, rather than answering for a shape it
 * was never checked against. (The non-rect pocket arms are unchanged this act and are proven so by pocket-golden.json.)
 */
const NOT_RECT = (kind) => { throw new Error(`literalPocketFill: the frozen reference covers RECT only (got "${kind}") — the non-rect pocket arms are unchanged this act and are proven by tests/fixtures/pocket-golden.json`); };

/** clearing.js regionDesc, RECT branch verbatim. */
export function regionDesc(p) {
    const x = num(p.x, 0), y = num(p.y, 0), w = num(p.w, 50), h = num(p.h, 30);
    if (p.shape && p.shape !== 'rect') return NOT_RECT(p.shape);
    return { kind: 'rect', x, y, w, h, contour: rectContour(x, y, x + w, y + h) };
}

/** contour.js offsetRegion, RECT branch verbatim (note the SIGN: a NEGATIVE d insets). */
export function offsetRegion(rg, d) {
    if (!d) return rg;
    if (rg.kind !== 'rect') return NOT_RECT(rg.kind);
    const x0 = rg.x - d, y0 = rg.y - d, x1 = rg.x + rg.w + d, y1 = rg.y + rg.h + d;   // rect
    return { kind: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0, contour: rectContour(x0, y0, x1, y1) };
}

/** contour.js regionInradius, RECT branch verbatim (the helix clamp reads it). */
export function regionInradius(rg) {
    if (rg.kind !== 'rect') return NOT_RECT(rg.kind);
    return Math.min(rg.w, rg.h) / 2;
}

/** stepover.js fillRegion — the flat form only (a pocket leaf never plugs a Region socket). */
const fillRegion = (p) => (p.region ? p.region : regionDesc(p));
/** The two non-rect walks fillStrategy can dispatch to. Unreachable here by construction; they refuse rather than 404. */
const concentricCircle = () => NOT_RECT('circle');
const concentricContour = () => NOT_RECT('polygon/ellipse');

/* ==== THE POCKET LEAF'S OWN GEOMETRY (pocketfill.js), frozen ==== */

/** pocketfill.js trueRegionFromFlat, RECT branch. */
export function refTrueRegionFromFlat(p) {
    if ((p.shape || 'rect') !== 'rect') return NOT_RECT(p.shape);
    return regionDesc({ shape: 'rect', x: num(p.originX, 0), y: num(p.originY, 0), w: num(p.w, 80), h: num(p.h, 60) });
}
/** pocketfill.js pocketInsetRegion — r = max(0.1,toolDia)/2, inset = r − wallOffset (the SHIPPED sign). */
export function refPocketInsetRegion(p) {
    const r = Math.max(0.1, num(p.toolDia, 6)) / 2;
    return offsetRegion(refTrueRegionFromFlat(p), -(r - num(p.wallOffset, 0)));
}
/** pocketfill.js stepoverMm — NOTE THE 0.2mm FLOOR. It is one of the two divergences this act names. */
export function refStepoverMm(p) { return Math.max(0.2, Math.max(0.1, num(p.toolDia, 6)) * num(p.stepoverPct, 40) / 100); }

/** clearing.js depthLevels — NOTE THE 0.05mm FLOOR. The other named divergence (the atom floors at 0.01). */
export function refDepthLevels(depth, stepdown) {
    const D = Math.max(0, depth), sd = Math.max(0.05, stepdown), out = [];
    for (let d = sd; ; d += sd) { out.push(Math.min(d, D)); if (d >= D) break; }
    return out;
}

/**
 * THE FROZEN LEAF. Same contract as the live `pocketfill` block (kind:'fill', the StepDown fold supplies `z` and `by`)
 * so the StepDown/place folds, modal-feed folding and cap gating all run through the REAL emitter — only the walk is
 * frozen. Registered under its own type so it can never shadow the shipping atom.
 */
export const pocketFillRefBlock = {
    type: 'pocketfill_ref', label: 'Pocket Fill (frozen ref)', kind: 'fill', mouth: 'DO', category: 'Toolpaths',
    defaults: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, wallOffset: 0, toolDia: 6, stepoverPct: 40, strategy: 'concentric', direction: 'bothways', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, by: 'by', z: 'z', feed: 2000, plunge: 150, clearance: 5 },
    fields: ['shape', 'originX', 'originY', 'w', 'h', 'wallOffset', 'toolDia', 'stepoverPct', 'strategy', 'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'by', 'z', 'feed', 'plunge', 'clearance'],
    lines: (p, z) => fillStrategy({ ...p, region: refPocketInsetRegion(p), stepover: refStepoverMm(p) }, z),
};

/** Install the frozen leaf into a live BLOCKS registry (the t1385 shape). Returns the types it added. */
export function installLiteralPocketRef(BLOCKS) {
    BLOCKS[pocketFillRefBlock.type] = pocketFillRefBlock;
    return [pocketFillRefBlock.type];
}

/**
 * THE FROZEN COMPOSITION — pocketStack's concrete clearing arm EXACTLY as it stood at t1404, with the frozen leaf in
 * place of the live one. `deps` are the framing helpers the re-point does NOT change (newBlock / makeStart / makeEnd /
 * makePlace and the wall leaf's own type), injected rather than imported so this module stays product-import-free and
 * so the boundary is visible: what is frozen is the SHAPE `place{ stepdown{ fill (, wall) } }` and the order of its
 * children — which is precisely what the re-point moves.
 */
/**
 * `phase` DECOMPOSES the frozen composition; it does not alter it. 'both' (the default) is the shape exactly as it
 * shipped. 'fill' / 'wall' return that same shape with only one of the StepDown's children, which is what makes the
 * ruled PER-PHASE criterion literal rather than approximate: comparing whole programs would trip over an artifact of
 * the interleaving itself — in the shipped order the wall pass leaves the tool at depth, so the NEXT level's fill
 * plunges from the previous floor instead of from clearance. That start height is a consequence of the order the user
 * ruled away, not of the walk, and a criterion that could not tell those two apart would be measuring the wrong thing.
 */
export function refPocketLiteralStack(params, deps, phase = 'both') {
    const { newBlock, makeStart, makeEnd, makePlace } = deps;
    const clr = num(params.clearance, 5), feed = num(params.feed, 2000), plunge = num(params.plunge, 150);
    const raster = (params.strategy || 'spiral') === 'raster';
    const depth = num(params.depth, 4), by = num(params.stepdown, 1.5);
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };
    const geom = { shape: params.shape || 'rect', originX: num(params.originX, 0), originY: num(params.originY, 0), w: num(params.w, 80), h: num(params.h, 60), wallOffset: num(params.wallOffset, 0), toolDia: num(params.toolDia, 6) };
    const fill = newBlock('pocketfill_ref');
    fill.params = { ...geom, stepoverPct: num(params.stepoverPct, 40), strategy: raster ? 'parallel' : 'concentric', direction: params.direction || 'bothways', entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3), helixDia: num(params.helixDia, 0), helixPitch: num(params.helixPitch, 1), by: 'by', z: 'z', feed, plunge, clearance: clr };
    const kids = phase === 'wall' ? [] : [fill];
    if (raster && phase !== 'fill') { const wall = newBlock('pocketwall'); wall.params = { ...geom, dia: num(params.dia, 50), sides: num(params.sides, 6), z: 'z', feed, plunge, clearance: clr }; kids.push(wall); }
    const down = newBlock('stepdown'); down.params = { to: depth, by, confirmEvery: num(params.confirmEvery, 0) }; down.children = kids;
    const bb = { minX: geom.originX, maxX: geom.originX + geom.w, minY: geom.originY, maxY: geom.originY + geom.h };
    return [makeStart(params), wcs, makePlace(params, bb, [down]), makeEnd(params)];
}
