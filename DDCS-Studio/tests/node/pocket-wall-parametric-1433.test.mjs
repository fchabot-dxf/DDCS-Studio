import { test, expect } from './support/harness.mjs';

/**
 * t1433 — THE WALL FINISH GOES PARAMETRIC: the freeze, then the bridge, then the re-point.
 *
 * ── TEST 1 IS THE FREEZE'S OWN PROOF, AND IT IS WHY THE FREEZE LANDS FIRST ────────────────────────────────────────
 * A frozen reference is only worth what it is faithful to. `/_test/literalPocketWall.js` claims to be the wall walk
 * "as it ships today"; this asserts that claim BYTE-FOR-BYTE against the live `pocketwall`, at the commit where the
 * two really are the same code and nothing else has moved yet. Land the freeze after the re-point and this test
 * cannot exist — there would be nothing left to compare the copy against.
 *
 * ── THE BRIDGE'S CRITERION IS TRACED MOTION PER LEVEL, NEVER TEXT (t1431, measured) ───────────────────────────────
 * The literal wall carries a per-level `( Step Down z=-1.5 )` comment holding the level's literal Z. In a runtime
 * loop the level IS a register, so that comment CANNOT survive and a text diff would fail by construction while
 * proving nothing about where the tool goes. Said out loud here so nobody writes one.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** The wall's own relationship sweep — the knobs that move the ring, the depth walk and the pause cadence. */
const BASE = { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, wallOffset: 0, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, strategy: 'raster' };
const SWEEP = [
    { name: 'the shipped defaults', p: {} },
    { name: 'wallOffset +0.5 — the ring moves OUT (oversize)', p: { wallOffset: 0.5 } },
    { name: 'wallOffset −0.5 — the ring moves IN (stock left)', p: { wallOffset: -0.5 } },
    { name: 'a bigger tool moves the inset', p: { toolDia: 10 } },
    { name: 'FULL DEPTH — one level, the stepdown reaches the floor', p: { depth: 2, stepdown: 2 } },
    { name: 'FULL DEPTH past — the last bite is clamped, not overshot', p: { depth: 2, stepdown: 5 } },
    { name: 'depth NOT a multiple of the stepdown', p: { depth: 4.3, stepdown: 1.2 } },
    { name: 'a NARROW pocket — the ring is nearly degenerate', p: { w: 40, h: 9 } },
    { name: 'PLACED — origin off zero, attached to a stock corner', p: { originX: 12.5, originY: -7.25, stockAttach: 'pp', pathDatum: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 } },
    { name: 'PLACED + a Z offset (the datum re-reference)', p: { originX: 12.5, originY: -7.25, offZ: 2, stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 } },
    { name: 'CONFIRM EVERY 2 — the pause cadence', p: { depth: 6, stepdown: 1.5, confirmEvery: 2 } },
    { name: 'CONFIRM EVERY 1 — a pause after every level but the last', p: { depth: 4.5, stepdown: 1.5, confirmEvery: 1 } },
];

/**
 * THE LITERAL WALL PROGRAM for one config, through the REAL emitter — the frozen leaf inside the frozen composition.
 * The `live` variant is the same composition with the SHIPPING `pocketwall` in place of the frozen one; test 1 is the
 * only caller of it and it exists solely to prove the copy faithful.
 */
const WALL_PROGRAMS = `
async (cfg, which) => {
    const { newBlock, emitMapped } = await import('/blocks/blockEmitter.js');
    const { makeStart, makeEnd, makePlace } = await import('/blocks/programFraming.js');
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const ref = await import('/_test/literalPocketWall.js');
    ref.installLiteralPocketWallRef(BLOCKS);
    const deps = { newBlock, makeStart, makeEnd, makePlace };
    const stack = ref.refPocketWallStack(cfg, deps);
    if (which === 'live') {
        // swap the frozen leaf for the shipping one, IN PLACE, so nothing else about the composition can differ
        const walk = (bs) => { for (const b of (bs || [])) { if (b.type === 'pocketwall_ref') b.type = 'pocketwall'; walk(b.children); } };
        walk(stack);
    }
    return emitMapped(stack).text;
}`;

/**
 * THE FREEZE IS FAITHFUL — the frozen wall leaf and the shipping `pocketwall` emit the SAME BYTES, today.
 *
 * Asserted across the whole sweep rather than at the defaults, because a copy can be faithful at one configuration
 * and wrong at the one that moves the ring (the inset's sign) or the one that moves the level count.
 */
test('THE FREEZE — the frozen wall reference is byte-identical to the shipping pocketwall', async ({ page }) => {
    await boot(page);
    const rows = await page.evaluate(async ({ base, sweep, WALL_PROGRAMS }) => {
        // eslint-disable-next-line no-eval
        const programs = eval(WALL_PROGRAMS);
        const out = [];
        for (const cfg of sweep) {
            const p = { ...base, ...cfg.p };
            const frozen = await programs(p, 'frozen'), live = await programs(p, 'live');
            const a = frozen.split(String.fromCharCode(10)), b = live.split(String.fromCharCode(10));
            const i = a.findIndex((l, k) => l !== b[k]);
            out.push({ name: cfg.name, same: frozen === live, lines: a.length, cuts: (frozen.match(/^G1 /gm) || []).length, diff: i < 0 ? null : { i, frozen: a[i], live: b[i] } });
        }
        return out;
    }, { base: BASE, sweep: SWEEP, WALL_PROGRAMS });

    for (const r of rows) {
        expect(r.same, `${r.name}: the frozen copy differs${r.diff ? ` at line ${r.diff.i} — frozen "${r.diff.frozen}" vs live "${r.diff.live}"` : ''}`).toBe(true);
        // AND IT IS NOT AN EMPTY AGREEMENT: two programs that cut nothing would match perfectly.
        expect(r.cuts, `${r.name}: the frozen wall really cuts`).toBeGreaterThan(0);
    }
});

/**
 * THE MEASURED CADENCE, PINNED (t1431's four guessed-wrong facts, now assertions).
 *
 * These were MEASURED off the shipping emit before the atom was designed, precisely so the atom bridges against a
 * known cadence rather than discovering one. Pinning them here makes the reference's shape a checked fact: if any of
 * the four moves, the atom that was built to match it is the thing that needs revisiting, and this says which.
 */
test('THE REFERENCE CADENCE — retract-first, no trailing retract, and the STEPDOWN form of the confirm', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ base, WALL_PROGRAMS }) => {
        // eslint-disable-next-line no-eval
        const programs = eval(WALL_PROGRAMS);
        const plain = await programs({ ...base, depth: 4, stepdown: 1.5 }, 'frozen');
        const paused = await programs({ ...base, depth: 6, stepdown: 1.5, confirmEvery: 2 }, 'frozen');
        const body = (t) => t.split(String.fromCharCode(10)).map((s) => s.trim()).filter(Boolean);
        const L = body(plain);
        const first = L.findIndex((l) => /^\( Step Down z=/.test(l));
        return {
            level: L.slice(first, first + 8),
            levelComments: L.filter((l) => /^\( Step Down z=/.test(l)),
            pauses: body(paused).filter((l) => /^#1505=-5000\(|^M00\b/.test(l)),
            // the LAST level's own lines, to prove there is no trailing retract of its own
            tail: L.slice(-4),
        };
    }, { base: BASE, WALL_PROGRAMS });

    // (1) THE PER-LEVEL SHAPE: the retract LEADS the level; the ring is four cuts and closes on its start.
    expect(r.level.slice(0, 3), 'the level opens with a retract, a rapid to the ring start, then the plunge')
        .toEqual(['( Step Down z=-1.5 )', 'G0 Z5', 'G0 X3 Y3']);
    expect(r.level.slice(3, 8), 'then the plunge and the four ring cuts, closing on the start corner')
        .toEqual(['G1 Z-1.5 F150', 'G1 X77 Y3 F2000', 'G1 X77 Y57', 'G1 X3 Y57', 'G1 X3 Y3']);
    // (2) NO PER-LEVEL TRAILING RETRACT — the next level's own `G0 Z5` serves, and the last level's is `progend`'s.
    expect(r.tail.filter((l) => /^G0 Z/.test(l)).length, 'the tail carries only the program end retract, not a per-level one').toBeLessThanOrEqual(1);
    // (3) THE LEVEL COMMENT IS LITERAL — which is exactly why the bridge's criterion cannot be text.
    expect(r.levelComments, 'each level names its own literal Z, so a runtime loop cannot reproduce these')
        .toEqual(['( Step Down z=-1.5 )', '( Step Down z=-3 )', '( Step Down z=-4 )']);
    // (4) THE CONFIRM IS THE STEPDOWN'S FORM — a #1505 popup line THEN M00, after level 2 only (not the last).
    // ⚠ THE MESSAGE CARRIES AN EM DASH, and that is a correction to t1431's own transcription of it (which wrote a
    // hyphen). Pinned to the real bytes because the atom reuses `pauseconfirm`'s emit rather than re-typing the text —
    // and a test written from a transcription would have made a faithful reuse look like a mismatch.
    expect(r.pauses, 'the popup line precedes the M00, and the last level is never paused after')
        .toEqual(['#1505=-5000(Pause — check the part, then press Cycle Start to continue)', 'M00   ( pause - press Cycle Start to resume )']);
});

/**
 * ── THE BRIDGE ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The parametric wall lives in a place of its own — `place{ wallfinish }`, one self-framing child, so `absorbingChild`
 * hands the atom its frame as PARAMS. That is the SAME shape the clearing place took at t1406, and the reason is the
 * same: a mixed body paints the placement shift onto macro text and shears it (t1349).
 *
 * THE PARAMETRIC SIDE IS THE SHIPPING COMPOSITION, decomposed by DROPPING the clearing place from the stack the
 * wizard actually built — never by rebuilding it. What is compared is therefore the program a user gets with one
 * phase hidden, not a test-only reconstruction of it (the literal side is decomposed the same way, by being a
 * wall-only frozen stack to begin with).
 */
const PARA_WALL = `
async (cfg) => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const keep = (b) => (b.type !== 'placeonstock' || b.params.role === 'wall');
    return emitMapped(pocketStack(cfg).filter(keep)).text;
}`;

/**
 * Cutting moves IN EMIT ORDER, plus the horizontal cutting floors.
 *
 * ── ORDERED, NOT SORTED — a stronger criterion than the fill's, and it is available here ──────────────────────────
 * t1406 compared SETS because the user ruled the fill/wall ORDER and a move-for-move comparison would have failed by
 * construction. Nothing about the wall's own walk moves this act: it is the same ring, the same corners, the same
 * direction, one level at a time. So the list is compared in order, and a walk that ran the ring the other way round
 * — cutting the same rectangle with the opposite climb — would FAIL here where a set comparison would pass it.
 *
 * A purely vertical descent is still compared by where it ENDS, with its start height held to "never lower than the
 * literal's" (t1406's rule, and its reason is unchanged: the start of a plunge is wherever the previous retract left
 * the tool, which the frame absorption can legitimately raise).
 */
const WALL_CUTS = `
(traceToolpath, nc) => {
    const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid);
    const q = (n) => +Number(n).toFixed(3);
    const cuts = segs.map((s) => ({
        v: Math.abs(s.x1 - s.x2) < 1e-6 && Math.abs(s.y1 - s.y2) < 1e-6 && s.z1 > s.z2 + 1e-9,
        t: [q(s.x1), q(s.y1), q(s.z1), q(s.x2), q(s.y2), q(s.z2), q(s.feed || 0)],
    }));
    const floors = [...new Set(segs.filter((s) => Math.abs(s.z1 - s.z2) < 1e-6).map((s) => q(s.z2).toFixed(2)))].sort();
    return { cuts, floors };
}`;

/** The emit's own quantum. A coordinate may differ by one unit of it — never more. */
const QUANTUM = 0.0015;

/** Compare two ordered cut lists. Returns { ok, why, quantised }. */
function compareCuts(lit, par) {
    if (lit.length !== par.length) return { ok: false, why: `move count ${par.length} vs ${lit.length}`, quantised: 0 };
    let quantised = 0;
    for (let i = 0; i < lit.length; i++) {
        const a = lit[i], b = par[i];
        if (a.v !== b.v) return { ok: false, why: `move ${i}: one is a vertical descent and the other is not ([${b.t}] vs [${a.t}])`, quantised };
        const idx = a.v ? [3, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 6];
        let near = false;
        for (const k of idx) {
            const d = Math.abs(a.t[k] - b.t[k]);
            if (d > QUANTUM) return { ok: false, why: `move ${i} field ${k}: ${b.t[k]} vs ${a.t[k]} (Δ${d.toFixed(4)}) — [${b.t}] vs [${a.t}]`, quantised };
            if (d > 0) near = true;
        }
        if (a.v && b.t[2] < a.t[2] - QUANTUM) return { ok: false, why: `move ${i}: the parametric plunge APPROACHES LOWER (from Z${b.t[2]} vs Z${a.t[2]})`, quantised };
        if (near) quantised++;
    }
    return { ok: true, why: '', quantised };
}

for (const cfg of SWEEP) {
    test(`THE BRIDGE — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async ({ base, over, WALL_PROGRAMS, PARA_WALL, WALL_CUTS }) => {
            const { traceToolpath } = await import('/engine/trace.js');
            // eslint-disable-next-line no-eval
            const programs = eval(WALL_PROGRAMS), para = eval(PARA_WALL), cuts = eval(WALL_CUTS);
            const { pocketRasterGap } = await import('/wizards/pocketWizard.js');
            const p = { ...base, ...over };
            const lit = await programs(p, 'frozen'), par = await para(p);
            return {
                gap: pocketRasterGap(p),
                onAtom: /"type":"wallfinish"/.test(JSON.stringify((await import('/wizards/pocketWizard.js')).pocketStack(p))),
                lit: cuts(traceToolpath, lit), par: cuts(traceToolpath, par),
                // THE PREMISE: the parametric side really is a MACRO LOOP, not another unrolled transcript.
                isMacro: /WHILE \[#13 < #11\] DO1/.test(par),
                // …and it really is ONE ring in the text, whatever the level count — the thing a loop buys.
                ringsInText: (par.match(/closed on the corner it started at/g) || []).length,
                litRings: (lit.match(/^\( Step Down z=/gm) || []).length,
            };
        }, { base: BASE, over: cfg.p, WALL_PROGRAMS, PARA_WALL, WALL_CUTS });

        // THE PREMISE: this config really is on the re-pointed arm, and the wall it built really is the atom.
        expect(r.gap, `this config rides the parametric arm (gap: "${r.gap}")`).toBe('');
        expect(r.onAtom, 'and the wizard\'s own wall place carries `wallfinish`').toBe(true);
        expect(r.isMacro, 'the wall emitted as a MACRO loop, not an unrolled transcript').toBe(true);
        expect(r.ringsInText, 'and ONE ring in the text however many levels it runs').toBe(1);
        expect(r.lit.cuts.length, 'the literal wall cuts (two empty programs would agree perfectly)').toBeGreaterThan(0);
        expect(r.litRings, 'at real depth levels').toBeGreaterThan(0);
        // THE SAME CUTTING FLOORS — the runtime depth loop counted the same levels and clamped the last one the same way.
        expect(r.par.floors, `the same cutting floors: literal ${JSON.stringify(r.lit.floors)} vs parametric ${JSON.stringify(r.par.floors)}`).toEqual(r.lit.floors);
        // …AND THE SAME MOVES, IN THE SAME ORDER, at the same feeds.
        const c = compareCuts(r.lit.cuts, r.par.cuts);
        expect(c.ok, `the same cutting moves in the same order — ${c.why}`).toBe(true);
        expect(c.quantised, `moves agreeing only to within the 0.001mm emit quantum: ${c.quantised} of ${r.lit.cuts.length}`).toBeLessThanOrEqual(r.lit.cuts.length);
    });
}

/**
 * THE CONFIRM CADENCE, asserted STRUCTURALLY — and the reason it cannot be asserted any other way is worth stating.
 *
 * `traceToolpath` does not record `M00` (checked — the tracer has no pause concept at all), so the RUNTIME cadence is
 * not observable through the motion the bridge above compares. What IS observable, and is what the bridge above
 * therefore proves, is that the confirm moves NOTHING: the traced motion at `confirmEvery: 2` is the literal's,
 * move for move. The cadence itself is asserted here on the emitted arithmetic:
 *   · the literal writes N pause PAIRS, one per qualifying level — an unrolled cadence.
 *   · the parametric writes exactly ONE pair, inside the loop, behind two guards: a last-level skip and a FIX()
 *     modulo on the operator's own N. That is `surfaceraster`'s proven form (t1335, swept again at t1406), reused
 *     rather than re-derived, so what is checked here is that this atom really did reuse it.
 */
test('THE CONFIRM CADENCE — N unrolled pauses become one guarded pause per loop', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ base, WALL_PROGRAMS, PARA_WALL }) => {
        // eslint-disable-next-line no-eval
        const programs = eval(WALL_PROGRAMS), para = eval(PARA_WALL);
        const at = async (over) => {
            const p = { ...base, ...over };
            const lit = await programs(p, 'frozen'), par = await para(p);
            return {
                litPauses: (lit.match(/^M00\b/gm) || []).length,
                parPauses: (par.match(/^\s*M00\b/gm) || []).length,
                lastSkip: /IF #13 >= #11 GOTO\d+/.test(par),
                modulo: (par.match(/IF \[#14 \/ ([\d.]+) - FIX\[#14 \/ [\d.]+\]\] > 0\.001/) || [])[1] || null,
                levels: (lit.match(/^\( Step Down z=/gm) || []).length,
            };
        };
        return {
            every2of4: await at({ depth: 6, stepdown: 1.5, confirmEvery: 2 }),
            every1of3: await at({ depth: 4.5, stepdown: 1.5, confirmEvery: 1 }),
            off: await at({ depth: 6, stepdown: 1.5, confirmEvery: 0 }),
        };
    }, { base: BASE, WALL_PROGRAMS, PARA_WALL });

    // the literal's unrolled cadence is the ground truth for what N means: every Nth level EXCEPT the last
    expect([r.every2of4.levels, r.every2of4.litPauses], '4 levels, every 2nd, never the last → one pause (after level 2)').toEqual([4, 1]);
    expect([r.every1of3.levels, r.every1of3.litPauses], '3 levels, every level, never the last → two pauses').toEqual([3, 2]);
    // …and the parametric writes ONE pause behind the two guards that reproduce it
    expect(r.every2of4.parPauses, 'the parametric writes exactly one M00 — inside the loop').toBe(1);
    expect(r.every1of3.parPauses, 'likewise at every level').toBe(1);
    expect(r.every2of4.lastSkip, 'guarded by the last-level skip').toBe(true);
    expect(r.every2of4.modulo, 'and by a FIX() modulo on the operator\'s own N').toBe('2');
    expect(r.every1of3.modulo, 'which follows N').toBe('1');
    // OFF means OFF — no pause, no guard, no reserved label
    expect([r.off.litPauses, r.off.parPauses], 'confirmEvery 0 emits no pause on either side').toEqual([0, 0]);
    expect(r.off.lastSkip, 'and no last-level guard either').toBe(false);
});

/**
 * THE DECLARED WORK IS THE BODY'S OWN COUNT, not a guess — the t1418 discipline, where a per-pass number that had
 * been reasoned out came back LOWER than the reasoning when it was measured against the emitted body.
 *
 * `wallFinishWorkSteps` claims `12 + levels × 11` (+6 per level with a confirm). This counts what the emitter really
 * writes per level so the claim and the body cannot drift; the tracer's cap is sized from it, and t1383 measured what
 * an undersized cap does — a preview silently showing a fraction of the toolpath.
 */
test('THE DECLARED WORK — the per-level line count is measured against the emitted body, not reasoned', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { wallFinishLines, wallFinishWorkSteps, wallFinishNeedsRingGuard, wallFinishBlock } = await import('/wizards/ops/wallfinish.js');
        // THE REAL POST, not a stub: the confirm's banner is the dialect's own form, so a body handed `{}` would be
        // exercising a path the product never takes (and the first cut of this test did exactly that, and threw).
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const D = activeDialectOpts().dialect;
        const base = { x: 0, y: 0, z0: 0, w: 80, h: 60, inset: 3, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5 };
        // the lines BETWEEN `WHILE … DO1` and `END1` are the per-level body the loop executes
        const inLoop = (p) => {
            const L = wallFinishLines(p, D).filter((s) => s !== '');
            const a = L.findIndex((s) => /^WHILE /.test(s)), b = L.findIndex((s) => /^END1$/.test(s));
            return (b - a) - 1;
        };
        const collapsed = { ...base, w: 4 };   // a 4mm span against a 3mm inset → −2: an INVERTED ring
        return {
            perLevel: inLoop(base),
            perLevelConfirm: inLoop({ ...base, confirmEvery: 2 }),
            steps: wallFinishWorkSteps(base),
            stepsConfirm: wallFinishWorkSteps({ ...base, depth: 6, confirmEvery: 2 }),
            liveOmits: wallFinishWorkSteps({ ...base, depth: '#2601' }),
            // the ring guard's predicate, and the LABELS that follow it — one reading, three consumers
            guard: { ok: wallFinishNeedsRingGuard(base), collapsed: wallFinishNeedsRingGuard(collapsed), live: wallFinishNeedsRingGuard({ ...base, w: '#2601' }) },
            labels: { ok: wallFinishBlock.flowLabels(base), collapsed: wallFinishBlock.flowLabels(collapsed) },
            okBody: wallFinishLines(base, D).join('\n'),
            collapsedBody: wallFinishLines(collapsed, D).join('\n'),
        };
    });
    // 7 motion lines + 2 loop-bookkeeping lines inside the body; the declaration adds the WHILE and END1 the
    // controller also executes each turn, which is where 9 becomes 11.
    expect(r.perLevel, 'the emitted per-level body').toBe(9);
    expect(r.perLevelConfirm - r.perLevel, 'a confirm adds six lines per level').toBe(6);
    expect(r.steps, '3 levels, no ring guard: 9 + 3 x 11 (t1440 re-calibrated the header from 6 to the measured 9)').toBe(9 + 3 * 11);
    expect(r.stepsConfirm, '4 levels with a confirm: 9 + 4 x 16 (t1440: the confirm is 5, its measured 4.25 rounded UP)').toBe(9 + 4 * 16);
    expect(r.liveOmits, 'and it is OMITTED, never guessed, once an input is dialled').toBe(null);

    /**
     * THE RING GUARD IS EMITTED EXACTLY WHERE IT CAN FIRE — found by reading the running program, not by reasoning.
     * An ordinary pocket carried `IF 18 <= 0 GOTO103`, a comparison of two build-time constants, plus a four-line
     * refusal and TWO reserved flow labels. Labels come from one per-program counter (t1408), so reserving them for
     * an unreachable branch pushes every later body's numbers up for nothing.
     */
    expect(r.guard, 'the guard: skipped when the span is a positive constant, emitted when dialled or already collapsed')
        .toEqual({ ok: false, collapsed: true, live: true });
    expect(r.okBody.includes('GOTO103'), 'an ordinary ring carries no constant comparison').toBe(false);
    expect(r.collapsedBody.includes('leaves no width to finish'), 'a collapsed ring refuses BEFORE any motion').toBe(true);
    // ⚠ THE COLLAPSED CASE IS REACHABLE, which is why the guard is a predicate and not a deletion: `w: 4` against a
    // 3mm inset is what editing the block on the Blocks canvas produces, with no `pocketTooSmall` upstream to catch it.
    expect(r.labels.ok, 'and the label declaration follows the body exactly').toEqual(['errLabel', 'okLabel']);
    expect(r.labels.collapsed, 'reserving the ring pair only where the body writes it').toEqual(['errLabel', 'okLabel', 'ringErrLabel', 'ringOkLabel']);
});

/**
 * THE LIVE RING — a dialled geometry input reaches the corner, FLAT, and the rotation is refused rather than half-baked.
 *
 * This is what the atom exists for beyond tidiness: the CAM delegation ahead hands `inset` the `#22` its slot already
 * computes and `w` a `#26xx`. Asserted on the emitted FORM as well as on the reachability, because the form is the
 * part with an evidence question attached: nested brackets inside a coordinate word are not demonstrated anywhere in
 * the factory corpus, and the first cut of this atom emitted them.
 */
test('THE LIVE RING — dialled corners are ONE flat bracket, and rotation refuses instead of dropping a constant', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { wallFinishLines, wallFinishAbsorbsRotation } = await import('/wizards/ops/wallfinish.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const D = activeDialectOpts().dialect;
        const base = { x: 0, y: 0, z0: 0, w: 80, h: 60, inset: 3, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5 };
        const baked = wallFinishLines(base, D).join('\n');
        const live = wallFinishLines({ ...base, w: '#2601', inset: '#22', depth: '#2603' }, D).join('\n');
        const words = (t) => (t.match(/\b[XY](\[[^\]]*\]|#\d+|-?\d*\.?\d+)/g) || []);
        return {
            bakedWords: [...new Set(words(baked))].sort(),
            liveWords: [...new Set(words(live))].sort(),
            nested: (live.match(/[XY]\[[^\]]*\[/g) || []),
            depthSeed: (live.match(/#11=\S+/) || [''])[0],
            rotOk: wallFinishAbsorbsRotation(base),
            rotLive: wallFinishAbsorbsRotation({ ...base, w: '#2601' }),
        };
    });
    // the BAKED ring is the reference's own four corners, as plain coordinates
    expect(r.bakedWords, 'a typed ring prints literal corners').toEqual(['X3', 'X77', 'Y3', 'Y57']);
    // the LIVE ring: `x + inset` is a lone register (no bracket around nothing); `x + w − inset` is ONE bracket
    expect(r.liveWords, 'a dialled ring prints flat, demonstrated forms').toEqual(['X#22', 'X[#2601 - #22]', 'Y#22', 'Y[60 - #22]']);
    expect(r.nested, 'and NO coordinate word carries a nested bracket').toEqual([]);
    expect(r.depthSeed, 'the depth register takes the #var verbatim').toBe('#11=#2603');
    // the ROTATION SEAM: absorbed when every corner is a build-time constant, refused IN WORDS when one is not
    expect(r.rotOk, 'a typed ring absorbs a program rotation').toBe(true);
    expect(typeof r.rotLive === 'string' && /w/.test(r.rotLive), `a dialled ring refuses it, naming the input: "${r.rotLive}"`).toBe(true);
});
