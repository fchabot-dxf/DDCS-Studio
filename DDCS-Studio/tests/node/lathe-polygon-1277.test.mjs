import { test, expect } from './support/harness.mjs';

/**
 * t1277 — POLYGON TURNING: the family's axis-mode member.
 *
 * THE GROUND TRUTH IS HAND-DERIVED. A hex across the flats at 17 has an apothem of 8.5 — that is the tool's distance
 * from the centre at the MIDDLE of a flat. At a CORNER it stands off by the apothem over the cosine of half a face:
 * 8.5 / cos 30° = 9.815. Those two numbers are the whole shape, and every assertion here is anchored to them.
 *
 * THE PATH IS COMPUTED IN STUDIO, not by the controller, and that is a finding rather than a preference: the DDCS
 * macro language shows no evidence of trig (59 captured factory macros use ABS ten times and COS/SIN never; the
 * parser dump holds no uppercase grammar tokens at all, not even ABS; and the lowercase asin/acos/atan/sqrt names a
 * Studio tool cites as "the parser's vocabulary" are the binary's libm imports — with cos and sin absent even there).
 *
 * t2689 — TIER MIGRATION BATCH 2: moved browser→node. boot() seeds the polygon twin via createUserOp (batch 1's
 * registerUserOp-vs-listUserOps bug applies here too), fresh-if-missing per call.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    const uo = await import('/blocks/userOps.js');
    const { polygonDataDef, POLY_DATA_OPTYPE } = await import('/blocks/dataOps/polygonData.js');
    if (!uo.listUserOps().some((d) => d.opType === POLY_DATA_OPTYPE)) uo.createUserOp(polygonDataDef());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsSetMachine, null, { timeout: 15000 });
};

const HEX = { sides: 6, barDiameter: 25, acrossFlats: 17, depth: 20, segmentsPerFace: 12, doc: 1, feed: 90 };

test('r(angle) matches hand-derived hex geometry — 8.5 at the flat, 9.815 at the corner', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const P = await import('/wizards/lathe/polygon.js');
        const at = (a) => P.polyRadiusAt(a, H.acrossFlats, H.sides);
        return {
            corner0: at(0), flat0: at(30), corner60: at(60), flat60: at(90), corner300: at(300),
            square: { flat: P.polyRadiusAt(45, 20, 4), corner: P.polyRadiusAt(0, 20, 4) },
            sides: [P.polySides(0), P.polySides(2), P.polySides(6.4)],
            segs: [P.polySegments(11), P.polySegments(0), P.polySegments(12)],
        };
    }, HEX);
    // THE TWO NUMBERS THE SHAPE IS: the apothem at the middle of a flat, the corner standing further out
    expect(r.flat0, 'the middle of a flat sits at the apothem — half the wrench size').toBe(8.5);
    expect(r.corner0, 'and a corner stands off by apothem / cos 30°').toBe(9.815);
    // …and it REPEATS, which is what makes it a polygon and not one flat
    expect(r.corner60, 'every face-angle round is another corner').toBe(9.815);
    expect(r.flat60, 'and every one has its flat').toBe(8.5);
    expect(r.corner300, 'including the last one before the sweep closes').toBe(9.815);
    // a square across 20: apothem 10, corner 10/cos45° = 14.142 — the same rule, not a special case
    expect(r.square.flat).toBe(10);
    expect(r.square.corner).toBe(14.142);
    expect(r.sides, 'fewer than three flats is not a polygon; a fractional count is not one either').toEqual([3, 3, 6]);
    // 11 → 12 (even); 0 → the declared default, because "no resolution" is not an answer; 12 → itself
    expect(r.segs, 'the resolution rounds EVEN so a point lands on the corner AND the flat').toEqual([12, 12, 12]);
});

test('THE SWEEP hits both defining radii at the right angles, and closes', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const P = await import('/wizards/lathe/polygon.js');
        const path = P.polygonPath(H);
        const at = (a) => path.find((pt) => Math.abs(pt.a - a) < 1e-6);
        return {
            n: path.length,
            first: path[0], last: path[path.length - 1],
            corners: [0, 60, 120, 180, 240, 300].map((a) => at(a) && at(a).x),
            flats: [30, 90, 150, 210, 270, 330].map((a) => at(a) && at(a).x),
            max: Math.max(...path.map((p) => p.x)), min: Math.min(...path.map((p) => p.x)),
        };
    }, HEX);
    expect(r.n, '6 faces × 12 segments, plus the closing point').toBe(73);
    expect(r.first, 'the sweep starts on a corner').toEqual({ a: 0, x: 9.815 });
    expect(r.last, 'and closes on the same corner a full turn later').toEqual({ a: 360, x: 9.815 });
    expect(r.corners, 'every corner is at the hand-derived stand-off').toEqual([9.815, 9.815, 9.815, 9.815, 9.815, 9.815]);
    expect(r.flats, 'and every flat centre is at the apothem').toEqual([8.5, 8.5, 8.5, 8.5, 8.5, 8.5]);
    expect(r.min, 'nothing goes tighter than the apothem — that would cut into the flat').toBe(8.5);
    expect(r.max, 'and nothing further out than the corner').toBe(9.815);
});

test('THE EMIT is A and X in one move — phase-locked, and the last sweep is the drawing size', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const P = await import('/wizards/lathe/polygon.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const stack = P.polygonStack(H);
        const nc = String(emitProgram(stack));
        const lines = nc.split(String.fromCharCode(10));
        // a phase-locked move carries BOTH words
        const both = lines.filter((l) => /^G1 /.test(l) && /A-?[\d.]/.test(l) && /X-?[\d.]/.test(l));
        const parse = (l) => ({ a: Number((l.match(/A(-?[\d.]+)/) || [])[1]), x: Number((l.match(/X(-?[\d.]+)/) || [])[1]) });
        const pts = both.map(parse);
        return {
            sweeps: P.polygonSweeps(H),
            bothCount: both.length,
            aOnly: lines.filter((l) => /^G1 /.test(l) && /A-?[\d.]/.test(l) && !/X-?[\d.]/.test(l)).length,
            finalFlat: pts.filter((p) => Math.abs(p.a - 90) < 1e-6).map((p) => p.x),
            finalCorner: pts.filter((p) => Math.abs(p.a - 120) < 1e-6).map((p) => p.x),
            head: lines.find((l) => /POLYGON TURNING/.test(l)) || '',
        };
    }, HEX);
    // roughing walks OUT from the finished size, so the light sweep meets the round bar first (the family's rule)
    expect(r.sweeps[r.sweeps.length - 1], 'the last sweep is the size on the drawing').toBe(17);
    expect(r.sweeps.length, 'and there are roughing sweeps before it').toBeGreaterThan(1);
    expect(r.sweeps[0], 'the first is the widest — nearest the bar').toBeGreaterThan(17);
    // EVERY cutting move in the sweep carries BOTH words: an A without an X is the work turning under a parked tool
    expect(r.aOnly, 'no move turns the chuck without moving X — that is not a polygon, it is a scratch').toBe(0);
    expect(r.bothCount, 'the sweeps are unrolled A/X pairs').toBeGreaterThan(70);
    // …and the FINISHING sweep passes through the hand-derived radii
    expect(r.finalFlat, 'the finishing sweep reaches the apothem at the flat').toContain(8.5);
    expect(r.finalCorner, 'and the stand-off at the corner').toContain(9.815);
    expect(r.head, 'the header restates no size').not.toMatch(/[0-9]/);
});

test('THE SIM PLAYS the A+X interpolation — the traced path carries the hand-derived radii', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const P = await import('/wizards/lathe/polygon.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const nc = String(emitProgram(P.polygonStack({ ...H, doc: 20 })));   // one sweep: the finishing size alone
        const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe);
        const xs = [...new Set(segs.map((s) => Math.round(s.x2 * 1000) / 1000))].sort((a, b) => a - b);
        return { count: segs.length, xs, min: xs[0], max: xs[xs.length - 1] };
    }, HEX);
    expect(r.count, 'the sweep really ran — one traced segment per A/X pair').toBeGreaterThan(70);
    expect(r.xs, 'and the executed path holds both defining radii').toEqual(expect.arrayContaining([8.5, 9.815]));
    expect(r.min, 'never tighter than the apothem').toBe(8.5);
    expect(r.max, 'never further out than the corner').toBe(9.815);
});

test('THE OP DECLARES ITS CHUCK — greyed with the reason on a spindle-only workspace, live on a driven one', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'lathe', chuck: 'spindle' }, false);
        const spindle = { axes: [...G.declaredAxes()], missing: G.missingAxesFor('user_lathe_polygon'),
                          why: G.axisWhy(G.missingAxesFor('user_lathe_polygon')), facing: G.missingAxesFor('user_lathe_facing') };
        M.setMachine({ kind: 'lathe', chuck: 'axis' }, false);
        const axis = { axes: [...G.declaredAxes()], missing: G.missingAxesFor('user_lathe_polygon') };
        M.setMachine({ kind: 'mill' }, false);
        const mill = { missing: G.missingAxesFor('user_lathe_polygon') };
        return { spindle, axis, mill, needs: G.OP_AXIS_NEEDS.lathe_polygon };
    });
    expect(r.needs, 'the A is the point of the op — it is declared, not inferred from the emit').toEqual(['X', 'Z', 'A']);
    // A SPINDLE CHUCK cannot run it, and the tooltip says what to change rather than naming a letter
    expect(r.spindle.axes, 'a spindle-chuck lathe declares no A').toEqual(['X', 'Z']);
    expect(r.spindle.missing).toEqual(['A']);
    expect(r.spindle.why, 'the reason names the CHUCK, not just an axis').toMatch(/chuck to be a DRIVEN AXIS/);
    expect(r.spindle.why, 'and says where to change it').toMatch(/Settings/);
    expect(r.spindle.facing, 'while the rest of the family is untouched — they never needed the chuck commanded').toEqual([]);
    // …and a DRIVEN chuck runs it
    expect(r.axis.axes, 'a driven chuck declares the A').toEqual(['X', 'Z', 'A']);
    expect(r.axis.missing, 'so the op is live').toEqual([]);
    expect(r.mill.missing, 'a mill has no chuck at all, so it is greyed there too').toEqual(['A']);
});

test('THE TWIN registers, and its Studio-side sizes REGENERATE the path instead of pretending to be sockets', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const D = await import('/blocks/dataOps/polygonData.js');
        const def = uo.listUserOps().find((d) => d.opType === D.POLY_DATA_OPTYPE);
        const build = builderOf(D.POLY_DATA_OPTYPE);
        const radiiFor = (p) => {
            const nc = String(emitProgram(build({ ...uo.defaultParams(def), ...p })));
            return [...new Set(nc.split(String.fromCharCode(10))
                .filter((l) => /^G1 /.test(l) && /A-?[\d.]/.test(l))
                .map((l) => Number((l.match(/X(-?[\d.]+)/) || [])[1])))].sort((a, b) => a - b);
        };
        const hex = radiiFor({ sides: '6', acrossFlats: 17, doc: 20 });
        const square = radiiFor({ sides: '4', acrossFlats: 20, doc: 20 });
        return {
            found: !!def, group: def && def.group, layout: def && def.layout && def.layout.kind,
            sections: [...new Set([...D.POLY_STRUCT_BINDINGS, ...D.POLY_BINDING_SPECS].map((s) => s.section))],
            sockets: D.POLY_BINDING_SPECS.map((s) => s.match.var || s.match.type),
            studioSide: D.POLY_STRUCT_BINDINGS.map((s) => s.param),
            hexMin: hex[0], hexMax: hex[hex.length - 1],
            sqMin: square[0], sqMax: square[square.length - 1],
        };
    });
    expect(r.found, 'polygon turning is a registered op').toBe(true);
    expect(r.group).toBe('lathe');
    expect(r.layout, 'it declares the lathe views').toBe('lathe_profile');
    expect(r.sections[0], 'the number of flats leads — it is what the part IS').toBe('IDENTITY');
    expect(r.sockets.every((m) => /^#\d+$|^toolsel$/.test(m)), 'the real sockets bind by identity').toBe(true);
    // the Studio-side sizes are NOT sockets, and the form says so by having them there without a match
    expect(r.studioSide, 'the sizes that regenerate the path are Studio-side, not machine-editable').toEqual(
        ['sides', 'acrossFlats', 'doc', 'segmentsPerFace']);
    // …and changing them really does regenerate: a hex across 17 vs a square across 20
    expect([r.hexMin, r.hexMax], 'the hex emits its hand-derived radii').toEqual([8.5, 9.815]);
    expect([r.sqMin, r.sqMax], 'and the square emits its own — same rule, different shape').toEqual([10, 14.142]);
});

test('THE END VIEW draws the OP’S OWN polygon, and its flats handle writes the size', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const V = await import('/viz/latheProfileCanvas.js');
        const P = await import('/wizards/lathe/polygon.js');
        const poly = { sides: H.sides, acrossFlats: H.acrossFlats, depth: H.depth, segmentsPerFace: H.segmentsPerFace };
        const spec = V.polygonProfileSpec({ diameter: H.barDiameter, stickOut: 60, allowance: 1 }, poly, (patch) => Object.assign(poly, patch));
        const pts = spec.paths[0].pts;
        // the end view is centred on its own circle; measure each drawn point back to that centre
        const circle = spec.items.find((i) => i.kind === 'circle');
        const radii = [...new Set(pts.map((p) => Math.round(Math.hypot(p.x - circle.cx, p.y - circle.cy) * 1000) / 1000))].sort((a, b) => a - b);
        const at = Object.fromEntries(spec.handles.map((h) => [h.id, { x: h.x, y: h.y }]));
        spec.onDrag(V.POLY_FLATS_HANDLE_ID, { x: circle.cx, y: circle.cy + 6 });    // smaller across-flats
        const smaller = poly.acrossFlats;
        spec.onDrag(V.POLY_FLATS_HANDLE_ID, { x: circle.cx, y: circle.cy + 999 });  // …and far too big
        const clamped = poly.acrossFlats;
        spec.onDrag(V.POLY_DEPTH_HANDLE_ID, { x: -34, y: 0 });
        return { radii, at, circleR: circle.r, smaller, clamped, depth: poly.depth,
                 cornerOfClamped: P.polyRadiusAt(0, poly.acrossFlats, H.sides), barR: H.barDiameter / 2 };
    }, HEX);
    // THE DRAWN SHAPE IS THE EMITTED SHAPE — the same r(angle), so the picture cannot promise a part the program won't
    // cut. The outline holds every segment radius, so what is asserted is its EXTREMES: the flat and the corner.
    expect(r.radii, 'the drawn outline runs between the two defining radii').toEqual(expect.arrayContaining([8.5, 9.815]));
    expect(r.radii[0], 'nothing drawn is tighter than the apothem').toBe(8.5);
    expect(r.radii[r.radii.length - 1], 'and nothing further out than the corner').toBe(9.815);
    expect(r.circleR, 'and the bar is drawn around it, as a radius').toBe(12.5);
    expect(r.at.polyFlats.y - (r.at.polyFlats.y - 8.5), 'the flats handle sits on the middle of a flat').toBe(8.5);
    expect(r.smaller, 'dragging it in wrote a smaller across-flats').toBe(12);
    // CLAMPED BY THE CORNERS, not the flats: a polygon whose corners stand outside the bar has flats never cut
    expect(r.cornerOfClamped, 'dragged past the stock, the CORNER is what gets pinned to the bar').toBeCloseTo(r.barR, 2);
    expect(r.clamped, 'so the across-flats lands under the bar diameter').toBeLessThan(25);
    expect(r.depth, 'and the extent handle writes the Z extent').toBe(34);
});
