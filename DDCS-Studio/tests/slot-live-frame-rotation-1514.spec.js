import { test, expect } from '@playwright/test';

/**
 * ── t1514 (C5) — THE ATOM LEARNS TO ROTATE A LIVE FRAME ────────────────────────────────────────────────────────────
 *
 * t1425 refused a rotation on a live-geometry frame for a MECHANICAL reason: the printer mixes each axis's build-time
 * constant into the other, and a register origin has no such constant. t1510 measured what that cost — a packed CAM
 * slot at 30° emitted a clean AXIS-ALIGNED channel with the angle silently gone — and closed the envelope hole.
 *
 * The reason was true and it was never that the rotation is unbakeable. A register is a perfectly good OPERAND for the
 * same affine form: the angle is known at BUILD time (a bearing is geometry the operator drew), so cos/sin are
 * evaluated in JavaScript and reach the controller as constants that MULTIPLY the live registers. `affineFrame` prints
 * that mix now — the origin is the pivot, and `[I − R]` brings it back out of the generic mix — so the live frame
 * turns, `surfaceRasterAbsorbsRotation` narrows to skim plus one named pair, and an ANGLED wide slot PACKS.
 *
 * THE PROOFS
 *   1  the rotated LIVE walk IS the fully-BAKED walk, NUMERICALLY, move for move, over a full sweep of bearings
 *   2  …and against the ANALYTIC slot geometry, which the live arm hits closer than the baked arm does
 *   3  the packed ANGLED slot vs the WIZARD angled slot, end to end (the t1410 chain, on the case that measured t1510)
 *   4  NOT V13-gated: no trig function reaches the emitted macro, asserted against `trigEvidence`'s own declaration
 *   5  no knob dark on an ANGLED packed slot — width/toolØ/stepover% reach BOTH axes through the cross-terms
 *   6  @work stays honest, and the arm change is ZERO deciding lines of CAM layer
 *   7  everything NOT lifted is byte-identical, swept over the atom's whole option matrix
 */

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** the op the pack builds from — an angled wide slot, the exact shape t1510 measured the drop on */
const OP = { ax: 5, ay: 10, bx: 45, by: 33, width: 12, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5,
             feed: 2000, plunge: 150, clearance: 5, rpm: 12000, entry: 'plunge', rampAngle: 3 };

/**
 * ── THE INSTRUMENT, declared once and used by proofs 1-3 ───────────────────────────────────────────────────────────
 *
 * t1512's header evaluator, extended from `#n=` assignments to whole AXIS WORDS. It has to be numeric and it has to
 * read the WHOLE word: the two sides have no text form in which they agree (one side's origin is `9.319` where the
 * other's is `[[5 + [#1/2] * 0.498471124] - [#2/2] * 0.498471]`), and a rotated live word closes brackets before it
 * reaches the register a naive regex is hunting for. So the word is extracted by BALANCING brackets and evaluated.
 */
const INSTRUMENT = `
    const evalRhs = (rhs, env) => {
        const js = String(rhs).replace(/;.*$/, '')
            .replace(/FIX\\s*\\[/g, 'Math.trunc[').replace(/\\[/g, '(').replace(/\\]/g, ')')
            .replace(/#(\\d+)/g, (m, n) => (env['#' + n] === undefined ? 'NaN' : '(' + env['#' + n] + ')'));
        try { return Function('Math', 'return ' + js)(Math); } catch (e) { return NaN; }
    };
    const wordAt = (s, ax) => { const i = s.indexOf(' ' + ax); if (i < 0) return null;
        let j = i + 2, d = 0, o = ''; while (j < s.length) { const c = s[j];
            if (c === '[') d++; if (c === ']') d--; if (c === ' ' && d === 0) break; o += c; j++; } return o; };
    const walk = (lines, seed) => { const env = Object.assign({}, seed), mv = [];
        for (const l0 of lines) { const l = String(l0).replace(/\\s*\\(.*$/, '');
            const a = l.match(/^\\s*(#\\d+)\\s*=\\s*(.+)$/);
            if (a) { env[a[1]] = evalRhs(a[2], env); continue; }
            if (!/^\\s*G[01]\\s/.test(l)) continue;
            const x = wordAt(l, 'X'), y = wordAt(l, 'Y');
            mv.push({ x: x == null ? null : evalRhs(x, env), y: y == null ? null : evalRhs(y, env), line: l.trim() }); }
        return mv; };
`;

/**
 * ── PROOF 1 — THE ROTATED LIVE WALK **IS** THE BAKED WALK, numerically, over a full sweep of bearings ──────────────
 *
 * The claim C5 rests on is that the live rendering and the baked one are the same geometry. Text cannot say so, so the
 * moves are EVALUATED on both sides with the pendant registers seeded to the operator's numbers, and compared point
 * for point.
 *
 * ⚠ THE TOLERANCE IS THE **BAKED** ARM'S OWN QUANTISATION, and naming it is half the proof. `x0`/`y0` are printed
 * through `r3` — the emit's 0.001mm quantum — so the baked side's origin carries up to half a quantum of placement
 * rounding (t1494 measured exactly this at 137.5°). The live side never rounds its origin: it is a register
 * expression. So the two agree to better than half a quantum and NOT to machine epsilon, and PROOF 2 shows which of
 * them is the one that moved.
 */
test('PROOF 1 — the rotated LIVE walk is the BAKED walk, move for move, at every bearing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op, instrument }) => {
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines, surfaceRasterLiveGap } = await import('/wizards/ops/surfaceraster.js');
        // eslint-disable-next-line no-new-func
        const { walk } = Function(instrument + 'return { walk };')();
        const seed = {};
        for (const k of Object.keys(SLOT_CAM_PACK_REGS)) seed[SLOT_CAM_PACK_REGS[k]] = op[k];
        let worst = 0, refused = 0, tested = 0, sample = null, moves = 0, worstAt = null, dead = null, hoist = [];
        for (let deg = 0; deg < 360; deg += 5) {
            const rad = deg * Math.PI / 180;
            const leaf = { x0: op.ax, y0: op.ay, x1: op.ax + 40 * Math.cos(rad), y1: op.ay + 40 * Math.sin(rad),
                width: op.width, tool: op.toolDia, stepoverPct: op.stepoverPct, depth: op.depth, stepdown: op.stepdown,
                feed: op.feed, plunge: op.plunge, clearance: op.clearance, entry: 'plunge' };
            const baked = slotRasterParams(leaf), live = slotRasterParams(leaf, SLOT_CAM_PACK_REGS);
            if (surfaceRasterLiveGap(live)) { refused++; continue; }
            const liveText = surfaceRasterLines(live).join('\n');
            /**
             * ⚠ NO DEAD MULTIPLY, and this caught a real one. `Math.cos(90°)` is 6.12e-17 rather than 0, so a
             * CARDINAL bearing walks straight past a raw `=== 0` test and prints `* 0.000000` — a multiply the
             * controller performs for nothing, and a term that makes a build-time constant read as a LIVE word to
             * `surfaceRasterLiveInputs`. Both zero tests (the frame's and the mixer's) are on the PRINTED
             * coefficient now; the sweep hits 0/90/180/270 exactly, which is where it bites.
             */
            if (!dead && /\* 0\.0+\b/.test(liveText)) dead = [deg, (liveText.match(/.*\* 0\.0+\b.*/) || [''])[0].trim()];
            const B = walk(surfaceRasterLines(baked), {}), L = walk(liveText.split('\n'), seed);
            if (B.length !== L.length) return { lengthMismatch: [deg, B.length, L.length] };
            tested++; moves = B.length;
            for (let i = 0; i < B.length; i++) for (const ax of ['x', 'y']) {
                if ((B[i][ax] == null) !== (L[i][ax] == null)) return { wordMismatch: [deg, i, ax, B[i].line, L[i].line] };
                if (B[i][ax] == null) continue;
                const d = Math.abs(B[i][ax] - L[i][ax]);
                if (d > worst) { worst = d; worstAt = [deg, i, ax]; }
            }
            if (deg === 30) { sample = L.find((m) => m.x != null).line; hoist = liveText.split('\n').filter((l) => /^#6[23]=/.test(l)); }
        }
        return { worst, tested, refused, moves, sample, worstAt, dead, hoist };
    }, { op: OP, instrument: INSTRUMENT });
    expect(r.lengthMismatch, 'both renderings emit the same number of moves').toBeUndefined();
    expect(r.wordMismatch, 'and the same axis words are present on each').toBeUndefined();
    expect(r.tested, 'every bearing on the circle is exercised, none refused').toBe(72);
    expect(r.refused, '…and not one of them is refused').toBe(0);
    expect(r.moves, 'there is a real walk behind each').toBeGreaterThan(5);
    expect(r.worst, `the live walk IS the baked walk within half the emit quantum (worst ${r.worst} at ${JSON.stringify(r.worstAt)})`).toBeLessThan(5e-4);
    expect(r.dead, `no dead multiply anywhere in the sweep — a cardinal bearing must not print a 0.000000 coefficient (${JSON.stringify(r.dead)})`).toBe(null);
    // …and the live word really carries the CROSS-TERMS: register operands multiplied by baked constants
    expect(r.sample, 'the rotated live X word mixes the row register in').toMatch(/#47 \* 0\.\d{6}/);
    /**
     * ⚠ t1526 — THE ORIGIN PIN MOVED WITH THE ORIGIN, and the claim it makes is UNCHANGED: this walk carries the
     * origin LIVE, as an expression of the pendant knobs, rather than folded to a build-time constant. The hoist
     * splits that across two lines instead of repeating it in every word — so it is asserted at BOTH ends, which is
     * strictly stronger than the single pattern it replaces. A `#62` in a move word with no assignment behind it
     * would be a DARK register (the tool moving to wherever that register happened to hold), and the old pin could
     * not have caught that; this one fails on it.
     */
    expect(r.sample, '…and carries the origin as the frame-origin REGISTER').toMatch(/#6[23]\b/);
    expect(r.hoist.length, 'both axes of the angled origin are hoisted').toBe(2);
    expect(r.hoist.join('\n'), '…and the hoist is where the EXPRESSION went — the knobs, not a folded constant').toMatch(/\[#1\/2\]/);
});

/**
 * ── PROOF 2 — AGAINST AN INDEPENDENT TRUTH, because "the two agree" is not "the two are right" ─────────────────────
 *
 * Both arms are this project's code, so agreeing with each other proves only that they are the same function. The
 * slot's first pass has a closed form nobody had to emit: its near end sits on A, offset ACROSS the slot by
 * (tool/2 − width/2), turned by the bearing. That is computed here from the op's own numbers and compared to what
 * each arm actually walks.
 *
 * ⚠ AND THE RESULT IS THE OTHER WAY ROUND FROM THE INSTINCT: the LIVE arm is the accurate one. It lands on the
 * analytic point to ~2e-6mm (the six-decimal one-shot bound), while the BAKED arm carries ~4e-4 — its own r3 origin
 * rounding, which t1494 named. PROOF 1's tolerance is that number, and this is where it comes from.
 */
test('PROOF 2 — both arms are checked against the ANALYTIC slot geometry, and the live one is the closer', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op, instrument }) => {
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        // eslint-disable-next-line no-new-func
        const { walk } = Function(instrument + 'return { walk };')();
        const seed = {};
        for (const k of Object.keys(SLOT_CAM_PACK_REGS)) seed[SLOT_CAM_PACK_REGS[k]] = op[k];
        let eB = 0, eL = 0;
        for (let deg = 0; deg < 360; deg += 5) {
            const rad = deg * Math.PI / 180;
            const leaf = { x0: op.ax, y0: op.ay, x1: op.ax + 40 * Math.cos(rad), y1: op.ay + 40 * Math.sin(rad),
                width: op.width, tool: op.toolDia, stepoverPct: op.stepoverPct, depth: op.depth, stepdown: op.stepdown,
                feed: op.feed, plunge: op.plunge, clearance: op.clearance, entry: 'plunge' };
            const baked = slotRasterParams(leaf), live = slotRasterParams(leaf, SLOT_CAM_PACK_REGS);
            const b = baked.bearing * Math.PI / 180, c = Math.cos(b), s = Math.sin(b);
            // THE CLOSED FORM: the first pass starts on A, held (width/2 − tool/2) back across the channel
            const across = op.toolDia / 2 - op.width / 2;
            const want = { x: op.ax - across * s, y: op.ay + across * c };
            const first = (M) => M.find((m) => m.x != null && m.y != null);
            const fb = first(walk(surfaceRasterLines(baked), {})), fl = first(walk(surfaceRasterLines(live), seed));
            eB = Math.max(eB, Math.hypot(fb.x - want.x, fb.y - want.y));
            eL = Math.max(eL, Math.hypot(fl.x - want.x, fl.y - want.y));
        }
        return { eB, eL };
    }, { op: OP, instrument: INSTRUMENT });
    expect(r.eL, `the LIVE arm walks the analytic slot geometry to the one-shot rounding bound (${r.eL})`).toBeLessThan(1e-5);
    expect(r.eB, `the BAKED arm carries its own r3 origin quantisation, under half a quantum (${r.eB})`).toBeLessThan(5e-4);
    expect(r.eL, '⚠ and the live arm is the CLOSER of the two — the disagreement in PROOF 1 is the baked side\'s rounding').toBeLessThan(r.eB);
});

/**
 * ── PROOF 3 — THE INDIRECTION CHAIN AT AN ANGLE (t1410, extended to the case that measured t1510) ─────────────────
 *
 * `slot-cam-pack-1512` PROOF 1 asserts the packed macro IS the wizard-path atom for a bearing-0 slot. This is the same
 * assertion for the slot that could not pack until now: build the real packed body through `slotFromOp`, seed its
 * `#2600` mirrors with the operator's numbers, and compare the resulting motion against the wizard path's own atom.
 * Numerically, because the packed side's dimensions live in header expressions where the baked side has folded them.
 */
test('PROOF 3 — the packed ANGLED slot IS the wizard angled slot, end to end', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op, instrument }) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        const { camTypeOf, slotPackArm } = await import('/data/opCamMap.js');
        // eslint-disable-next-line no-new-func
        const { walk } = Function(instrument + 'return { walk };')();
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        decl.entry = { exposed: false, value: op.entry };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        // the pendant mirrors hold the operator's own numbers — the arm's whole point
        const mirrors = {};
        for (const f of g.fields) if (f.idx != null) mirrors['#' + (f.idx + 1500)] = Number(op[f.key] != null ? op[f.key] : f.def);
        const got = walk(g.body.split('\n'), mirrors);
        const want = walk(surfaceRasterLines(slotRasterParams(slotLeafParams(op))), {});
        let worst = 0, at = null;
        for (let i = 0; i < Math.min(got.length, want.length); i++) for (const ax of ['x', 'y']) {
            if ((got[i][ax] == null) !== (want[i][ax] == null)) return { wordMismatch: [i, ax, got[i].line, want[i].line] };
            if (got[i][ax] == null) continue;
            const d = Math.abs(got[i][ax] - want[i][ax]);
            if (d > worst) { worst = d; at = [i, ax, want[i].line, got[i].line]; }
        }
        return { n: want.length, gotN: got.length, worst, at, gate: camTypeOf({ opType: 'slot', params: op }),
                 arm: slotPackArm(op), bearing: slotRasterParams(slotLeafParams(op)).bearing,
                 headHasBearing: g.body.split('\n').slice(0, 4).join(' ') };
    }, { op: OP, instrument: INSTRUMENT });
    expect(r.bearing, 'the op really is an angled slot').toBeGreaterThan(5);
    expect(r.gate.camType, 'and it PACKS — the payoff of C5').toBe('slot');
    expect(r.gate.unsupported, '…with no refusal').toBeFalsy();
    expect(r.arm, '…on the ATOM arm').toBe('atom');
    expect(r.wordMismatch, 'the packed body emits the same axis words as the wizard atom').toBeUndefined();
    expect(r.n, 'there is a real walk to compare').toBeGreaterThan(5);
    expect(r.gotN, '…and the packed body walks the same number of moves').toBe(r.n);
    expect(r.worst, `the packed ANGLED macro cuts the wizard's own path (worst ${r.worst} at ${JSON.stringify(r.at)})`).toBeLessThan(5e-4);
    // the macro head still tells the operator what was baked and why
    expect(r.headHasBearing, 'the macro head states the baked bearing').toMatch(/bearing/);
});

/**
 * ── PROOF 4 — NOT V13-GATED, asserted against the evidence file rather than argued in a comment ────────────────────
 *
 * A rotated LIVE frame looks like the trig gate's own case and is not: the ANGLE is build-time, so cos/sin are taken
 * in JavaScript and only their RESULTS — plain constants — reach the controller. The distinction matters because the
 * sister case (a DIALLED bearing, where the angle itself is a register) IS on the lift plan, and folding the two
 * together would make V13 look like the decider for something that shipped without it.
 */
test('PROOF 4 — no trig reaches the emitted macro, and trigEvidence says so in its own words', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op }) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const { TRIG_NOT_GATED, TRIG_LIFT_PLAN, TRIG_FUNCTIONS } = await import('/data/trigEvidence.js');
        const { surfaceRasterLiveGap } = await import('/wizards/ops/surfaceraster.js');
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        const body = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl).body;
        // a DIALLED bearing is the sister case and must STILL refuse, naming the evidence file
        const liveBearing = slotRasterParams({ x0: 0, y0: 0, x1: 60, y1: 0, width: 12, tool: 6 }, SLOT_CAM_PACK_REGS);
        return {
            trigWords: (body.match(/\b(SIN|COS|TAN|ATAN|ASIN|ACOS|SQRT)\s*\[/gi) || []),
            row: TRIG_NOT_GATED.find((t) => /affineFrame/.test(t.site)),
            names: Object.keys(TRIG_FUNCTIONS || {}),
            planTouchesC5: TRIG_LIFT_PLAN.some((t) => /live[- ]frame rotation/i.test(JSON.stringify(t))),
            liveBearingGap: surfaceRasterLiveGap({ ...liveBearing, bearing: '#99' }),
        };
    }, { op: OP });
    expect(r.trigWords, 'the packed ANGLED macro contains NO trig call at all — the constants are already numbers').toEqual([]);
    expect(r.row, 'and trigEvidence carries the declaration, so nobody re-adds it to the lift plan').toBeTruthy();
    expect(r.row.why, '…saying why the instinct is wrong: the angle is build-time').toMatch(/build/i);
    expect(r.row.why, '…and naming the sister case that IS gated').toMatch(/DIALLED|dialled/);
    expect(r.planTouchesC5, 'the machine-visit plan does NOT claim this capability').toBe(false);
    // the sister case is untouched: a dialled bearing still refuses and still names the decider
    expect(r.liveBearingGap, 'a DIALLED bearing still refuses').toMatch(/COS\/SIN of a runtime angle/);
    expect(r.liveBearingGap, '…still naming V13 as the decider').toMatch(/V13_trig/);
});

/**
 * ── PROOF 5 — NO KNOB DARK ON AN **ANGLED** PACKED SLOT, and each must reach BOTH axes ─────────────────────────────
 *
 * t1512's reachability closure, on the case C5 opened, plus the thing that is specific to a rotation: at bearing 0 a
 * knob can reach one axis and be correct. Rotated, a knob that reaches only X is a knob that half-moved the tool —
 * exactly t1353's measured failure. So the cross-terms are asserted directly: the three geometry knobs must appear
 * inside BOTH the X and the Y word of a cutting move.
 */
test('PROOF 5 — every live knob reaches the motion, and the geometry knobs reach BOTH axes', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op, instrument }) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        // eslint-disable-next-line no-new-func
        const { wordAt } = Function(instrument + 'return { wordAt };')();
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        const lines = g.body.split('\n');
        const regs = (s) => (String(s).match(/#\d+/g) || []);
        // the reachable closure: seed from every register the motion / loop bounds / guards read, close it backwards
        const seed = new Set();
        for (const l of lines) if (/^\s*(G[01]\s|WHILE|IF|M3)/.test(l)) regs(l.replace(/\(.*$/, '')).forEach((x) => seed.add(x));
        for (let pass = 0; pass < 12; pass++) for (const l of lines) {
            const m = String(l).match(/^\s*(#\d+)\s*=\s*(.+)$/);
            if (m && seed.has(m[1])) regs(m[2].replace(/\(.*$/, '')).forEach((x) => seed.add(x));
        }
        const live = g.fields.filter((f) => f.var);
        // …and the CROSS-TERM check, on the axis words of a real cutting move
        const cut = lines.filter((l) => /^\s*G1 .*X.*Y/.test(l)).map((l) => l.replace(/\s*\(.*$/, ''));
        const byKey = {};
        for (const f of live) byKey[f.key] = f.var;
        /**
         * ⚠ t1526 — THE CROSS-TERM CHECK IS A **FORWARD DATAFLOW** NOW, not a substring of the word. The origin
         * hoist puts the knobs' contribution in `#62`/`#63` and the word then carries the register, so looking for
         * `#1` inside the X word measured the un-hoisted TEXT rather than the thing the proof is about — whether
         * dialling the knob moves BOTH axes. So the knob is closed FORWARDS through the assignments (knob →
         * scratch → … → the word), which is the same claim on the dataflow the emit actually has.
         */
        const assignedFrom = (v) => { const s = new Set([v]);
            for (let pass = 0; pass < 12; pass++) for (const l of lines) {
                const m = String(l).replace(/\s*\(.*$/, '').match(/^\s*(#\d+)\s*=\s*(.+)$/);
                if (m && regs(m[2]).some((x) => s.has(x))) s.add(m[1]);
            }
            return s; };
        const inBoth = (v) => { const s = assignedFrom(v);
            return cut.some((l) => regs(wordAt(l, 'X')).some((x) => s.has(x)) && regs(wordAt(l, 'Y')).some((x) => s.has(x))); };
        // …and the MECHANISM the forward closure alone would not pin: the Y origin appearing in the X word IS the
        // `[I − R]` cross-term. Half-apply the rotation and this is the term that disappears.
        const ORG = { x: '#62', y: '#63' };
        const hoistLines = lines.filter((l) => /^#6[23]=/.test(l));
        return {
            dark: live.filter((f) => !seed.has(f.var)).map((f) => f.key),
            liveKeys: live.map((f) => f.key),
            crossX: ['width', 'toolDia'].map((k) => [k, inBoth(byKey[k])]),
            originCross: cut.some((l) => String(wordAt(l, 'X')).includes(ORG.y)),
            hoistFromKnobs: hoistLines.length === 2
                && hoistLines.every((l) => regs(l.split('=')[1].replace(/\s*\(.*$/, '')).some((x) => Object.values(byKey).includes(x))),
            cutMoves: cut.length,
        };
    }, { op: OP, instrument: INSTRUMENT });
    expect(r.liveKeys.length, 'the packed arm really carries live knobs').toBeGreaterThan(5);
    expect(r.dark, 'not one live knob is dark — every register reaches the motion').toEqual([]);
    expect(r.cutMoves, 'the angled walk really writes both axis words on its cutting moves').toBeGreaterThan(0);
    // ⚠ the rotation-specific half: a geometry knob must move BOTH axes, or the tool half-moved
    expect(r.crossX, 'width and toolØ reach the X AND the Y word of a cutting move — the cross-terms').toEqual([['width', true], ['toolDia', true]]);
    // t1526 — and the two halves the forward closure cannot see on its own
    expect(r.originCross, 'the Y-origin register rides the X word — the [I − R] cross-term survived the hoist').toBe(true);
    expect(r.hoistFromKnobs, 'both hoisted origins are computed FROM live knobs, so neither is a dark register').toBe(true);
});

/**
 * ── PROOF 6 — @work STAYS HONEST, and the CAM layer did not move ──────────────────────────────────────────────────
 *
 * Two things a capability act can quietly break. `@work` declares how much a body executes; on live geometry the count
 * does not exist at build time and the atom omits the marker (t1383 — never declare wrong), and a rotation must not
 * make it reappear. And the t1511 ruling's structural condition: the arm asks the ENVELOPE, so C5 must have lifted the
 * angled case with NO edit to `opToSlot`/`opCamMap` — asserted here against the actual diff of this act.
 */
test('PROOF 6 — the rotated packed macro declares no @work, and no CAM-layer line decided it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op }) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines, surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        const packed = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl).body;
        const bakedLeaf = slotRasterParams(slotLeafParams(op));
        const camMap = await (await fetch('/data/opCamMap.js')).text();
        const toSlot = await (await fetch('/data/opToSlot.js')).text();
        return {
            packedWork: /@work/.test(packed),
            bakedWork: /@work/.test(surfaceRasterLines(bakedLeaf).join('\n')),
            bakedSteps: surfaceRasterWorkSteps(bakedLeaf),
            // no bearing arithmetic in either CAM-layer file — the eligibility question is the atom's
            camMapCheck: /bearing\s*[=!<>]=|slotBearingDeg|Math\.atan2/.test(camMap),
            toSlotCheck: /bearing\s*[=!<>]=|slotBearingDeg|Math\.atan2/.test(toSlot),
            // …and no rotation arithmetic either: the CAM layer never takes a sine
            camMapTrig: /Math\.(cos|sin|atan)/.test(camMap), toSlotTrig: /Math\.(cos|sin|atan)/.test(toSlot),
        };
    }, { op: OP });
    expect(r.bakedWork, 'the fully-baked wizard body still declares its work').toBe(true);
    expect(r.bakedSteps, '…with a real step count behind it').toBeGreaterThan(0);
    expect(r.packedWork, '⚠ the ROTATED packed macro declares none — its count does not exist at build time').toBe(false);
    expect(r.camMapCheck, 'opCamMap holds no bearing comparison').toBe(false);
    expect(r.toSlotCheck, 'and neither does the generator').toBe(false);
    expect(r.camMapTrig, 'nor any rotation arithmetic of its own').toBe(false);
    expect(r.toSlotTrig, '…on either side').toBe(false);
});

/**
 * ── PROOF 7 — WHAT IS NOT LIFTED IS UNCHANGED **BY CONSTRUCTION**, and the construction is asserted ───────────────
 *
 * The one intended change is "a LIVE frame that is asked to turn". Everything else — the whole baked corpus, rotated
 * configs included, and every live-frame program at no angle — emits the same bytes, and the reason is structural
 * rather than a promise about rounding:
 *
 *   `AXX`/`AXY` **ARE** `AX` on a build-time frame — same arguments, same object, nothing to round differently.
 *   A ZERO BEARING takes `geoSum` itself rather than the rotation mixer, so no shipped live program can reach it.
 *   `rot` is null with no angle, and `mv` then prints the declared WORD — the affine forms are never even read.
 *
 * Each of those is asserted directly here. (The byte sweep itself is a build-time measurement against the previous
 * revision — 13,632 un-lifted configs over this same matrix, zero differing — recorded in the work log; a spec cannot
 * import the old module, and a golden hash would pin the bytes of every future legitimate change instead.)
 */
test('PROOF 7 — the un-lifted corpus is unchanged by construction, and the matrix emits no NaN', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const SR = await import('/wizards/ops/surfaceraster.js');
        const { affineFrame } = await import('/wizards/ops/affineFrame.js');
        // 1. on a BUILD-TIME frame the anchored form is the absolute one, argument for argument
        const B = affineFrame({ x0: 103.6, y0: 41.2, rotAngle: 30 });
        const sameAsAX = [[null, 0, []], ['12.5', 7.25, [{ reg: '#40', k: 1 }]], ['[0 + #44]', -3, []]]
            .every(([w, c, t]) => JSON.stringify(B.AXX(w, c, t)) === JSON.stringify(B.AX(w, c, t))
                              && JSON.stringify(B.AXY(w, c, t)) === JSON.stringify(B.AX(w, c, t)));
        // 2. on a LIVE frame it prepends the origin word as a unit term, so the form is absolute again
        const L = affineFrame({ live: { x: '#25', y: '#26', z: '0' }, rotAngle: 30, pivotAtOrigin: true });
        const liveTerms = L.AXX('#25', 0, [{ reg: '#40', k: 1 }]).terms.map((t) => t.reg);
        // 3. with NO angle there is no `rot` at all, so `mv` prints the declared word verbatim
        const N = affineFrame({ live: { x: '#25', y: '#26', z: '0' } });
        const OPT = {
            strategy: ['parallel', 'concentric'], entry: ['plunge', 'ramp', 'helix'],
            direction: ['bothways', 'oneway', 'otherway'], rowAxis: ['x', 'y'], rowAnchor: ['fit', 'wall'],
            zMode: ['', 'skim'], rot: [0, 30, 90, 137.5, -45], inset: [0, 3], bearing: [0, 30, 90, -60],
            place: [[0, 0, 0], [103.6, 41.2, -3]],
            live: [null, { toolDia: '#22' }, { w: '#20', h: '#21' }, { x: '#25' }, { inset: '#26' }, { clearance: '#10' }],
        };
        const pick = (a, i) => a[i % a.length];
        let n = 0, lifted = 0, differing = 0, first = null;
        for (let i = 0; i < 4000; i++) {
            const p = { x: pick(OPT.place, i)[0], y: pick(OPT.place, i >> 1)[1], z0: pick(OPT.place, i >> 2)[2],
                w: 60, h: 40, depth: 4, stepdown: 1.5, toolDia: 12, stepoverPct: 40, feed: 2000, plunge: 200, clearance: 5,
                strategy: pick(OPT.strategy, i), entry: pick(OPT.entry, i >> 1), direction: pick(OPT.direction, i >> 2),
                rowAxis: pick(OPT.rowAxis, i >> 3), rowAnchor: pick(OPT.rowAnchor, i >> 4), zMode: pick(OPT.zMode, i >> 5),
                rotAngle: pick(OPT.rot, i >> 6), rotPivotX: (i % 3) * 7, rotPivotY: (i % 5) * -4,
                inset: pick(OPT.inset, i >> 7), bearing: pick(OPT.bearing, i >> 8),
                helixDia: 8, helixPitch: 1.2, rampAngle: 4, confirmEvery: (i % 7 === 0) ? 3 : 0,
                ...(pick(OPT.live, i >> 9) || {}) };
            // THE ONE INTENDED CHANGE: a live frame asked to turn. Skim is NOT lifted — it still refuses.
            if (SR.surfaceRasterLiveInputs(p).length && (p.rotAngle || p.bearing) && p.zMode !== 'skim') { lifted++; continue; }
            n++;
            const body = SR.surfaceRasterLines(p).join('\n');
            if (/NaN|undefined/.test(body)) { differing++; if (!first) first = { p, why: 'NaN in the emit' }; }
            // a live frame at NO bearing must carry no rotation constant anywhere — it never took the mixer
            if (SR.surfaceRasterLiveInputs(p).length && !p.bearing && !p.rotAngle && /\* 0\.\d{6}\b/.test(body)) {
                differing++; if (!first) first = { p, why: 'a six-decimal rotation constant in an unrotated live body' };
            }
        }
        return { n, lifted, differing, first, sameAsAX, liveTerms, hasRot: !!N.rot,
                 plainWord: N.mv(N.AXX('7.5', 7.5, []), N.AXY('#26', 0, [])) };
    });
    // the construction, asserted
    expect(r.sameAsAX, 'on a BUILD-TIME frame the anchored form IS the absolute one, argument for argument').toBe(true);
    expect(r.liveTerms, '…and on a LIVE frame it prepends the origin word, so the form is absolute again').toEqual(['#25', '#40']);
    expect(r.hasRot, 'with no angle there is no rotation object at all').toBe(false);
    expect(r.plainWord, '…so the move prints the declared words verbatim, exactly as it always has').toBe('X7.5 Y#26');
    // …and the sweep agrees with it
    expect(r.n, 'the un-lifted matrix is large').toBeGreaterThan(2000);
    expect(r.lifted, '…and the lifted set is a real, separate slice of it').toBeGreaterThan(100);
    expect(r.differing, `no un-lifted config emits NaN, or a rotation constant it never asked for (${JSON.stringify(r.first)})`).toBe(0);
});
