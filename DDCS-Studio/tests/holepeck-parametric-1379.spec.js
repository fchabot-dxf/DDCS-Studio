import { test, expect } from '@playwright/test';

/**
 * t1379 — THE DRILL FAMILY'S FIRST PARAMETRIC ATOM: the peck cycle. Bridges only; nothing re-points yet.
 *
 * WHY THE CYCLE AND NOT THE PATTERN, in one line: the blocker is already written down in opToSlot.js and opCamMap.js —
 * the universal CAM path "cannot expose depth/peck AT ALL, because drill.js peckDrill drives a JS while loop that unrolls
 * the peck sequence and bakes every Z literal at build time." The two knobs an operator most wants live on a drilling job
 * are unreachable, and the cycle is the half of the family that unblocks them without prejudging how a pattern's points
 * get computed. (The pattern half has an open design question — see the work log.)
 *
 * THE CRITERION IS THE SAME ONE THE ARC HAS USED SINCE t1329, now with the feed dimension that t1377 made table stakes:
 * the OLD literal kernel at a config and the NEW parametric body at that config must EXECUTE THE SAME MOVES —
 * (position, feed) per move, resolved through the engine, in order. A text diff would prove nothing: one is a loop and
 * the other is a list.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * THE CONFIGS — every one is a HAND-DERIVED peck boundary, chosen where a loop and an unrolled list are most likely to
 * disagree rather than where they are most likely to match. Even divisions hide off-by-ones.
 */
const CONFIGS = [
    { name: 'depth NOT a multiple of the peck — the last bite clamps', depth: 5, peck: 2, feed: 100, clearance: 5 },
    { name: 'exact division — four equal pecks, the easy case kept honest', depth: 8, peck: 2, feed: 100, clearance: 5 },
    { name: 'ONE PECK — the bite equals the depth, so the loop runs once and there is no re-entry rapid', depth: 5, peck: 5, feed: 100, clearance: 5 },
    { name: 'BITE LARGER THAN THE DEPTH — one peck, clamped on the first pass', depth: 3, peck: 10, feed: 100, clearance: 5 },
    { name: 'DEEP — ten pecks, where a re-entry off by one would show as a re-cut', depth: 20, peck: 2, feed: 100, clearance: 5 },
    { name: 'a bite that leaves a sliver — 10 / 3 gives 3 + a 1mm last bite', depth: 10, peck: 3, feed: 100, clearance: 5 },
    { name: 'sub-millimetre bite — the re-entry is smaller than its own 0.5mm offset', depth: 2, peck: 0.3, feed: 250, clearance: 3 },
    { name: 'a NON-DEFAULT clearance, so the retract height is not the one the default hides', depth: 6, peck: 2.5, feed: 180, clearance: 12 },
];

/** literal kernel vs parametric body, both resolved: (position, feed) per move, in order. */
const bridge = (page, cfg) => page.evaluate(async (cfg) => {
    const { peckDrill } = await import('/wizards/ops/drill.js');
    const { holePeckLines } = await import('/wizards/ops/holepeck.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const NL = String.fromCharCode(10);
    // BOTH FRAMED IDENTICALLY and minimally: a G90 and a clearance rapid, which is what the real framing puts in front
    // of either kernel. The atom must not depend on anything else being there.
    const wrap = (body) => ['G90', `G0 Z${cfg.clearance}`, ...body, 'M30'].join(NL);
    const lit = wrap(peckDrill({ x: cfg.x || 0, y: cfg.y || 0 }, cfg));
    const par = wrap(holePeckLines({ ...cfg }));
    const moves = (nc) => (traceToolpath(nc).segments || []).map((s) => [
        +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), +Number(s.feed || 0).toFixed(3), !!s.rapid,
    ]);
    return { lit: moves(lit), par: moves(par), litLines: peckDrill({ x: 0, y: 0 }, cfg).length, parLines: holePeckLines(cfg).length, parText: holePeckLines(cfg).join(NL) };
}, cfg);

for (const cfg of CONFIGS) {
    test(`EQUIVALENCE (peck) — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await bridge(page, cfg);
        expect(r.lit.length, 'the literal kernel really drills something').toBeGreaterThan(2);
        expect(r.par.length, `same number of moves (literal ${r.lit.length}, parametric ${r.par.length})`).toBe(r.lit.length);
        // EVERY MOVE: where, how fast, and whether it was a rapid or a cut. The rapid flag matters here more than in a
        // raster — a peck cycle is an alternation of feeds and rapids, and getting one of them wrong is the whole defect.
        expect(r.par, 'and every move is identical, in order — position, feed and rapid/cut alike').toEqual(r.lit);
    });
}

/**
 * THE FRAME AND THE ROTATION, INHERITED — and asserted, because "inherited" is a claim about code that has to be true
 * of the emitted program.
 *
 * A hole is one POINT, which is why the rotation is much simpler here than in a raster: surfacing needed a coupled
 * affine printer because a row's Y is a register, whereas a hole's X and Y are build-time constants and the rotation is
 * applied to the point before it is ever written down. So the assert is direct — the drilled point must be the
 * un-rotated point turned about the pivot, and the Z depths must not move at all.
 */
test('THE FRAME + THE ROTATION — the point moves, the depths do not, and 0° is byte-identical', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { holePeckLines } = await import('/wizards/ops/holepeck.js');
        const { peckDrill } = await import('/wizards/ops/drill.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const base = { depth: 10, peck: 3, feed: 120, clearance: 5 };
        const wrap = (body) => ['G90', 'G0 Z5', ...body, 'M30'].join(NL);
        const moves = (nc) => (traceToolpath(nc).segments || []).map((s) => [+s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), +Number(s.feed || 0).toFixed(3)]);
        const FR = { x: 40, y: 25, z0: 0 };
        return {
            // (1) THE FRAME: the atom placed at a point must drill where the literal placed at that point drills
            litPlaced: moves(wrap(peckDrill({ x: FR.x, y: FR.y }, base))),
            parPlaced: moves(wrap(holePeckLines({ ...base, ...FR }))),
            // (2) A NON-ZERO z0: the surface the depths are measured from
            litZ: moves(wrap(peckDrill({ x: 0, y: 0 }, { ...base, zOff: 6 }))),
            parZ: moves(wrap(holePeckLines({ ...base, z0: 6 }))),
            // (3) THE ROTATION at 0° must be byte-identical, and at an angle must turn the point only
            flatText: holePeckLines({ ...base, ...FR }).join(NL),
            zeroText: holePeckLines({ ...base, ...FR, rotAngle: 0 }).join(NL),
            turned: moves(wrap(holePeckLines({ ...base, ...FR, rotAngle: 12.5 }))),
            flat: moves(wrap(holePeckLines({ ...base, ...FR }))),
        };
    });
    expect(r.parPlaced, 'a placed hole drills exactly where the literal placed one does').toEqual(r.litPlaced);
    expect(r.parZ, 'and a non-zero surface Z measures the depths from it, as the literal shiftZ does').toEqual(r.litZ);
    expect(r.zeroText, 'a declared 0° rotation is byte-identical — the mechanism is invisible until asked for').toBe(r.flatText);
    // THE POINT TURNS, THE DEPTHS DO NOT. Computed here at full precision, never read back from the thing under test.
    const th = 12.5 * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    expect(r.turned.length, 'the rotation changes no move count').toBe(r.flat.length);
    for (let i = 0; i < r.flat.length; i++) {
        const [x, y, z, f] = r.flat[i];
        expect(r.turned[i][0], `move ${i} X turned about the datum`).toBeCloseTo(x * c - y * s, 3);
        expect(r.turned[i][1], `move ${i} Y turned about the datum`).toBeCloseTo(x * s + y * c, 3);
        expect(r.turned[i][2], `move ${i} Z is untouched by a planar rotation`).toBeCloseTo(z, 3);
        expect(r.turned[i][3], `move ${i} runs at the same feed`).toBe(f);
    }
});

/**
 * STAMPED — AND IT DOES NOT WORK, WHICH IS THE MOST USEFUL THING THIS TURN FOUND.
 *
 * The interim composition looked obvious: leave `array` computing its points in JavaScript and let it stamp the
 * parametric cycle once per hole, exactly as it stamps the literal drill today. It does not work, and the reason removes
 * an option from the next slice's design space rather than merely needing a patch.
 *
 * ONLY THE FIRST HOLE DRILLS. The cause is isolated below by separating the two candidates instead of assuming one:
 *   TWO `DO1` LOOPS in one program are FINE — both holes drill. Repeated loop pairs are not the problem.
 *   TWO COPIES OF THE SAME LABELS are not — the second copy's `GOTO61` binds to the FIRST copy's `N61`, and execution
 *   never reaches the later holes. Same class as the duplicate-N91 problem `uniquifySafeRetractLabels` was written for,
 *   except that mechanism uniquifies per BLOCK and a stamped block is ONE block emitted N times, so it cannot reach it.
 *
 * WHY THIS IS NOT PATCHED HERE: a label-free body is possible only by changing the MACHINING — the first peck's re-entry
 * rapid would have to become unconditional, starting the first cut 0.5mm above the surface instead of feeding down from
 * clearance. `THEN` takes an assignment and not a move, so there is no third option. That is a ruling, not a rider.
 *
 * WHAT IT SETTLES: the pattern cannot stay a build-time container. A parametric pattern loop emits ONE body with ONE set
 * of labels, so the collision disappears the moment the pattern folds into the atom. The family was already heading
 * there; this turns a preference into a constraint.
 */
test('STAMPED — a flow-carrying body CANNOT be stamped, and the cause is LABELS, not loops', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { newBlock, emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const cfg = { depth: 10, peck: 3, feed: 120, clearance: 5 };
        const stack = (childType, childParams) => {
            const arr = newBlock('array');
            arr.params = { pattern: 'line', count: 2, spacing: 30, x0: 0, y0: 0 };
            const hole = newBlock(childType); hole.params = childParams; arr.children = [hole];
            return [arr];
        };
        const xs = (nc) => [...new Set((traceToolpath(nc).segments || []).filter((s) => !s.rapid).map((s) => +s.x2.toFixed(2)))];
        // THE TWO CANDIDATES, ISOLATED — hand-written so each carries exactly one of them.
        const twoLoops = ['G90', 'G0 Z5',
            '#81=10', '#82=3', '#83=0', 'G0 X0 Y0',
            'WHILE [#83 < #81] DO1', '  #83=[#83 + #82]', '  IF #83 > #81 THEN #83=#81', '  G1 Z[0 - #83] F120', '  G0 Z5', 'END1',
            '#81=10', '#82=3', '#83=0', 'G0 X30 Y0',
            'WHILE [#83 < #81] DO1', '  #83=[#83 + #82]', '  IF #83 > #81 THEN #83=#81', '  G1 Z[0 - #83] F120', '  G0 Z5', 'END1',
            'M30'].join(NL);
        const twoLabelSets = ['G90', 'G0 Z5',
            'G0 X0 Y0', '#84=0', 'IF #84 <= 0 GOTO61', 'G0 Z1', 'N61', 'G1 Z-3 F120', 'G0 Z5', 'GOTO62', 'N62',
            'G0 X30 Y0', '#84=0', 'IF #84 <= 0 GOTO61', 'G0 Z1', 'N61', 'G1 Z-3 F120', 'G0 Z5', 'GOTO62', 'N62',
            'M30'].join(NL);
        return {
            litXs: xs(emitProgram(stack('drill', { x: 0, y: 0, ...cfg }))),
            parXs: xs(emitProgram(stack('holepeck', { x: 0, y: 0, z0: 0, ...cfg }))),
            loopXs: xs(twoLoops), labelXs: xs(twoLabelSets),
        };
    });
    // THE LITERAL DRILLS BOTH HOLES — the container itself is fine, which is what makes the finding specific.
    expect(r.litXs, 'the literal child drills both holes of the pattern').toEqual([0, 30]);
    // THE PARAMETRIC ONE DRILLS ONLY THE FIRST. Asserted as the measured truth, so it cannot silently change either way:
    // if a later turn makes stamping work, this test fails and says to update it.
    expect(r.parXs, 'the parametric cycle drills only the FIRST hole when stamped — the labels collide').toEqual([0]);
    // AND THE CAUSE IS LABELS, NOT LOOPS. This pair is the whole diagnosis, and it is why the next slice folds the
    // pattern into the atom instead of trying to make a container stamp a flow-carrying body.
    expect(r.loopXs, 'two DO1 loops in one program: BOTH holes drill — repeated loops are not the problem').toEqual([0, 30]);
    expect(r.labelXs, 'two copies of the same labels: only the first — that is the problem').toEqual([0]);
});

/**
 * THE LINE COUNT, REPORTED HONESTLY — because "parametric is shorter" is not true and claiming it would be the easy lie.
 *
 * A loop has fixed overhead. The parametric body is 13 lines whatever the depth: at 20mm/2mm that replaces 30 literal
 * lines, and at 5mm/5mm — a single peck — it replaces 3, so it is LONGER. Exactly the shape of the surfacing pilot's
 * finding, and the reason the win is stated as LIVE KNOBS rather than byte count.
 */
test('THE LINE COUNT IS FIXED, and on a shallow hole that means LONGER — said, not hidden', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { peckDrill } = await import('/wizards/ops/drill.js');
        const { holePeckLines } = await import('/wizards/ops/holepeck.js');
        const at = (depth, peck) => ({ lit: peckDrill({ x: 0, y: 0 }, { depth, peck, feed: 100, clearance: 5 }).length, par: holePeckLines({ depth, peck, feed: 100, clearance: 5 }).length });
        return { shallow: at(5, 5), mid: at(10, 3), deep: at(20, 2), veryDeep: at(60, 0.5) };
    });
    // THE PARAMETRIC BODY DOES NOT GROW WITH THE JOB — that is the property, and it is what makes the knobs live.
    expect(r.deep.par, 'the body is the same length at 20mm/2mm as anywhere else').toBe(r.shallow.par);
    expect(r.veryDeep.par, 'and at 60mm/0.5mm — 120 pecks — it is still that length').toBe(r.shallow.par);
    expect(r.veryDeep.lit, 'where the literal has unrolled 120 pecks into hundreds of lines').toBeGreaterThan(300);
    // AND ON A ONE-PECK HOLE IT IS LONGER. Asserted, so the honest claim cannot quietly become the flattering one.
    expect(r.shallow.par, 'a single-peck hole: the loop costs more lines than the three it replaces').toBeGreaterThan(r.shallow.lit);
});

/**
 * THE DECLARATIONS — the band, the guard, and the envelope's SCOPE.
 *
 * The envelope's wording is the surfacing pilot's hardest-won lesson (t1349): a covers() claim is worthless unless it
 * says what it is ABOUT. This one is about the CYCLE. The pattern is still `array`'s, computed in JavaScript, and that is
 * scope rather than a gap — asserted here so the two cannot be confused by a later reader.
 */
test('THE DECLARATIONS — band as data, a refused zero peck, and an envelope scoped to the CYCLE', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { holePeckLines, HOLE_SCRATCH, holePeckCovers, holePeckGap, holePeckAbsorbsRotation } = await import('/wizards/ops/holepeck.js');
        const { opBands } = await import('/data/universalScratch.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const lines = holePeckLines({ depth: 10, peck: 3, feed: 120, clearance: 5 });
        const used = new Set();
        for (const l of lines) for (const m of l.matchAll(/#(\d+)/g)) used.add(Number(m[1]));
        // every OTHER atom's declared band, so a collision is measured rather than eyeballed
        const mine = JSON.stringify(HOLE_SCRATCH);
        // t1381 — THE SUCCESSOR IS EXCLUDED, and the premise change is the reason rather than a weakening. `holecycle`
        // folded the pattern into this cycle and DELIBERATELY inherits #81 (depth) and #82 (bite): those are the two
        // LIVE KNOBS an operator edits on the pendant, so keeping their numbers stable across the fold is worth more
        // than a non-overlapping band. It cannot reach a program — both atoms are pre-consumer, asserted by the
        // PRE-CONSUMER bridges on both sides — and this atom retires when the switch re-points the drill family.
        const successor = (await import('/wizards/ops/holecycle.js')).HOLE_SCRATCH;
        const isSuccessor = (b) => successor.some(([lo, hi]) => b[0] === lo && b[1] === hi);
        const others = opBands().filter((b) => JSON.stringify([b]) !== mine.slice(1, -1) && !(b[0] === 81 && b[1] === 87) && !isSuccessor(b));
        return {
            used: [...used].sort((a, b) => a - b), band: HOLE_SCRATCH,
            bandRegistered: JSON.stringify(opBands()).includes('81'),
            others,
            registered: !!BLOCKS.holepeck,
            guard: lines.some((l) => /IF #82 <= 0 GOTO63/.test(l)) && lines.some((l) => /peck must be greater than zero/.test(l)),
            covers: holePeckCovers({}), gap: holePeckGap({}),
            skimCovers: holePeckCovers({ zMode: 'skim' }), skimGap: holePeckGap({ zMode: 'skim' }),
            skimRot: holePeckAbsorbsRotation({ zMode: 'skim' }), rot: holePeckAbsorbsRotation({}),
        };
    });
    expect(r.registered, 'the atom is in the palette registry (so it round-trips and the band is aggregated)').toBe(true);
    // NOTHING OUTSIDE THE DECLARED BAND, bar #1505 — the controller's own operator-message register.
    const [lo, hi] = r.band[0];
    const stray = r.used.filter((v) => (v < lo || v > hi) && v !== 1505);
    expect(stray, `every var used is inside the declared band ${lo}-${hi}: strays ${JSON.stringify(stray)}`).toEqual([]);
    expect(r.bandRegistered, 'and the band is read by universalScratch.opBands() — data, not a comment').toBe(true);
    // NO COLLISION with any other atom's declared band. Measured against the registry, so a future atom claiming #81
    // fails here instead of silently sharing a register across two ops in one program.
    const clash = r.others.filter((b) => !(b[1] < lo || b[0] > hi));
    expect(clash, `no other atom's band overlaps ${lo}-${hi}: ${JSON.stringify(clash)}`).toEqual([]);
    // THE GUARD: a zero bite never advances, so it refuses cleanly rather than looping forever.
    expect(r.guard, 'a zero peck is refused with the reason in the program').toBe(true);
    // THE ENVELOPE, SCOPED. The cycle is covered; a skim frame is named as unreachable rather than silently absent.
    expect(r.covers, 'the peck cycle is inside the proven envelope').toBe(true);
    expect(r.gap, 'with nothing left to name for it').toBe('');
    expect(r.skimCovers, 'a skim frame is outside it').toBe(false);
    expect(r.skimGap, 'and says why — never a bare false').toMatch(/jog|skim/i);
    expect(r.rot, 'a hole always absorbs a rotation: its point is a build-time constant').toBe(true);
    expect(typeof r.skimRot, 'except in a frame it cannot have, where it answers with the reason').toBe('string');
});

/**
 * PRE-CONSUMER, ASSERTED — this turn adds an atom and changes no shipping program.
 *
 * The switch is next turn's job (exactly as surfacing did it: atoms and bridges first, re-point second). So the drill
 * stack must still build the LITERAL child, and the assert is here rather than in a note because "nothing re-points" is
 * the kind of claim that quietly stops being true.
 */
test('PRE-CONSUMER — the drill stack still builds the literal child; nothing re-points this turn', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { BUILDERS } = await import('/blocks/opBuilders.js');
        const flat = (st, o = []) => { for (const b of (st || [])) { if (!b) continue; o.push(b.type); flat(b.children, o); flat(b.uiChildren, o); } return o; };
        const all = [];
        for (const [op, build] of Object.entries(BUILDERS)) { try { all.push({ op, types: flat(build({})) }); } catch (_) { /* needs params */ } }
        return {
            drill: flat(drillStack({})),
            helical: flat(drillStack({ method: 'helical' })),
            anyUser: all.filter((x) => x.types.includes('holepeck')).map((x) => x.op),
        };
    });
    expect(r.drill, 'the peck drill stack is unchanged — array{drill}').toContain('drill');
    expect(r.drill, 'and does NOT yet carry the parametric atom').not.toContain('holepeck');
    expect(r.helical, 'the helical method still builds a bore').toContain('bore');
    expect(r.anyUser, 'no registered op builder reaches the new atom yet — pre-consumer, by design').toEqual([]);
});
