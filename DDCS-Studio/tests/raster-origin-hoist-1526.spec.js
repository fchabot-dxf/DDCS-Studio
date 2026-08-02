import { test, expect } from '@playwright/test';

/**
 * ── t1526 — THE PACKED ROTATED SLOT'S MOVE WORDS COLLAPSE: the live origin is READ ONCE ────────────────────────────
 *
 * t1514 taught the atom to rotate a LIVE frame and named what it did not take: the move words are LONG. On a rotated
 * live frame the origin IS the pivot, so `affineFrame` prints it in every word — its own axis at coefficient 1 and,
 * through `[I − R]`, the other axis's origin beside it. The origin's contribution is CONSTANT for the whole program
 * (the pendant knobs behind it are read into their registers before the body starts and nothing writes them mid-run),
 * so it is computed once into the frame's own registers and the words carry a register instead of an expression.
 *
 * MEASURED on the t1514 angled config (A(5,10)→B(45,33), bearing 29.899°), before → after. These are the ATOM
 * BODY's own numbers; `raster-origin-hoist-shots-1526` puts the WHOLE MACRO's on the screenshot (2830 → 2112 chars,
 * 69 → 37 multiplies), which is a different denominator and not a disagreement:
 *
 *     move words                      10   →   10      the geometry does not move; only how it is written
 *     characters in those words     1233   →  548      −55.6%
 *     longest single word            175   →   84      −52%
 *     multiplies in the move words    60   →   30      −50%   (6.0 → 3.0 per word)
 *     whole body, comments stripped 2221   → 1503      −32.3%
 *     multiplies in the whole body    69   →   37      −46.4%
 *     lines                           54   →   56      +2, the hoist itself
 *     moves that shrink                        10/10
 *
 * THE PROOFS
 *   1  the hoist is a PURE FACTORING — substitute the registers back and the walk is identical, move for move
 *   2  the payoff, asserted as the RULE that produces it (the origin expression appears ONCE) plus the numbers
 *   3  a bearing-0 pack emits NOTHING — no rotation, no cross-terms, no hoist, and its bytes do not move
 *   4  ⚠ a NUMERIC origin axis is never hoisted (the defect this act found: it moved the tool 5mm)
 *   5  the BAND — #62/#63 need no new register, and the collision guard + allocator are asserted at those numbers
 *   6  SKIM is untouched, and the no-collision argument is STRUCTURAL rather than a refusal
 *   7  @work carries the two assignments, differenced against the engine's own executed count
 */

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** the op t1514 measured the lift on — an angled wide slot */
const OP = { ax: 5, ay: 10, bx: 45, by: 33, width: 12, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5,
             feed: 2000, plunge: 150, clearance: 5, rpm: 12000, entry: 'plunge', rampAngle: 3 };
const leafOf = (o) => ({ x0: o.ax, y0: o.ay, x1: o.bx, y1: o.by, width: o.width, tool: o.toolDia,
    stepoverPct: o.stepoverPct, depth: o.depth, stepdown: o.stepdown,
    feed: o.feed, plunge: o.plunge, clearance: o.clearance, entry: o.entry, rampAngle: o.rampAngle });

/**
 * ── THE INSTRUMENT — t1514's header evaluator, verbatim, plus the un-hoisting inverse ─────────────────────────────
 *
 * `walk` assigns registers as it reads them, so it honours `#62=` exactly as the controller would. `unhoist` is the
 * TEXTUAL INVERSE of the act: substitute each hoisted register back into every word that reads it and delete the
 * assignment. That is what makes PROOF 1 a proof of FACTORING rather than of arithmetic — the two texts differ by
 * exactly the substitution, and the walks are compared numerically.
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
            const x = wordAt(l, 'X'), y = wordAt(l, 'Y'), z = wordAt(l, 'Z');
            mv.push({ x: x == null ? null : evalRhs(x, env), y: y == null ? null : evalRhs(y, env),
                      z: z == null ? null : evalRhs(z, env), line: l.trim() }); }
        return mv; };
    const HOIST_LINE = /^(#6[23])=(.+?)   \\( frame origin /;
    const unhoist = (lines) => {
        const subs = [], out = [];
        for (const l of lines) { const m = HOIST_LINE.exec(String(l)); if (m) subs.push([m[1], m[2]]); else out.push(l); }
        // longest register name first so #6x never partially matches another register
        return { removed: subs.length,
            lines: out.map((l) => subs.reduce((s, [reg, expr]) =>
                String(s).replace(new RegExp(reg + '(?![0-9])', 'g'), expr), l)) };
    };
`;

/**
 * ── PROOF 1 — A PURE FACTORING: un-hoist the emit and the walk is IDENTICAL, move for move ────────────────────────
 *
 * The claim the act rests on is that nothing geometric moved — the origin's contribution was lifted out of every
 * word into one assignment, which is a factoring of a constant subexpression and not a change of arithmetic. Text
 * cannot say so (the two forms have no rendering in which they agree), so the hoist is REVERSED textually and both
 * walks are evaluated with the pendant registers seeded to the operator's numbers.
 *
 * ⚠ EXACT, not within a tolerance. Every other bridge in this family carries one because the two sides round
 * differently; here the two sides are the same expression with a name in front of part of it, so a non-zero
 * difference would mean the substitution is not what the emitter did.
 */
test('PROOF 1 — the hoist is a pure factoring: un-hoisted and hoisted walk identically, at every bearing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op, instrument }) => {
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines, surfaceRasterLiveGap } = await import('/wizards/ops/surfaceraster.js');
        // eslint-disable-next-line no-new-func
        const { walk, unhoist } = Function(instrument + 'return { walk, unhoist };')();
        const seed = {};
        for (const k of Object.keys(SLOT_CAM_PACK_REGS)) seed[SLOT_CAM_PACK_REGS[k]] = op[k];
        let worst = 0, worstAt = null, tested = 0, moves = 0, hoisted = 0, shapeBad = null, noSub = null;
        for (let deg = 0; deg < 360; deg += 5)
            for (const entry of ['plunge', 'ramp'])
                for (const direction of ['bothways', 'oneway']) {
                    const rad = deg * Math.PI / 180;
                    const leaf = { x0: op.ax, y0: op.ay, x1: op.ax + 40 * Math.cos(rad), y1: op.ay + 40 * Math.sin(rad),
                        width: op.width, tool: op.toolDia, stepoverPct: op.stepoverPct, depth: op.depth,
                        stepdown: op.stepdown, feed: op.feed, plunge: op.plunge, clearance: op.clearance,
                        entry, rampAngle: op.rampAngle };
                    const live = { ...slotRasterParams(leaf, SLOT_CAM_PACK_REGS), direction };
                    if (surfaceRasterLiveGap(live)) continue;
                    const H = surfaceRasterLines(live);
                    const U = unhoist(H);
                    if (U.removed) hoisted++;
                    // the substitution must really have happened, or the "identity" is two copies of one text
                    if (U.removed && !noSub && U.lines.join('\n') === H.filter((l) => !/^#6[23]=/.test(l)).join('\n')) {
                        noSub = [deg, entry, direction];
                    }
                    const a = walk(U.lines, seed), b = walk(H, seed);
                    if (a.length !== b.length) { shapeBad = [deg, entry, direction, a.length, b.length]; continue; }
                    tested++; moves = a.length;
                    for (let i = 0; i < a.length; i++) for (const ax of ['x', 'y', 'z']) {
                        if ((a[i][ax] == null) !== (b[i][ax] == null)) { shapeBad = [deg, entry, direction, i, ax]; continue; }
                        if (a[i][ax] == null) continue;
                        const d = Math.abs(a[i][ax] - b[i][ax]);
                        if (d > worst) { worst = d; worstAt = [deg, entry, direction, i, ax]; }
                    }
                }
        return { worst, worstAt, tested, moves, hoisted, shapeBad, noSub };
    }, { op: OP, instrument: INSTRUMENT });
    expect(r.shapeBad, 'both forms emit the same moves with the same axis words present').toBe(null);
    expect(r.tested, 'the whole circle of bearings is exercised, on two entries and two directions').toBe(288);
    expect(r.moves, 'there is a real walk behind each').toBeGreaterThan(5);
    expect(r.hoisted, 'and all but the four un-rotated bearings hoist').toBe(284);
    expect(r.noSub, 'the un-hoisting really substitutes — an untouched text would prove nothing').toBe(null);
    expect(r.worst, `EXACT: the hoisted walk IS the un-hoisted walk (worst ${r.worst} at ${JSON.stringify(r.worstAt)})`).toBe(0);
});

/**
 * ── PROOF 2 — THE PAYOFF, as the RULE that produces it and then as the numbers ────────────────────────────────────
 *
 * The numbers in this file's header are a measurement against the previous revision, which a spec cannot re-run (it
 * cannot import the old module). What it CAN pin is the structural fact that produces them and would have to break
 * for them to stop being true: each hoisted origin expression appears EXACTLY ONCE in the whole body — in its own
 * assignment — and every move word carries the register instead. Re-inline the origin and this fails immediately,
 * whatever the character counts happen to be. The counts are asserted beside it as a ratchet.
 */
test('PROOF 2 — each origin expression appears exactly ONCE, and the move words collapse', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op, instrument }) => {
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        // eslint-disable-next-line no-new-func
        const { wordAt } = Function(instrument + 'return { wordAt };')();
        const leaf = { x0: op.ax, y0: op.ay, x1: op.bx, y1: op.by, width: op.width, tool: op.toolDia,
            stepoverPct: op.stepoverPct, depth: op.depth, stepdown: op.stepdown, feed: op.feed,
            plunge: op.plunge, clearance: op.clearance, entry: op.entry, rampAngle: op.rampAngle };
        const lines = surfaceRasterLines(slotRasterParams(leaf, SLOT_CAM_PACK_REGS));
        const body = lines.join('\n');
        const hoist = lines.filter((l) => /^#6[23]=/.test(l));
        const occurrences = hoist.map((l) => {
            const expr = l.slice(l.indexOf('=') + 1).replace(/\s*\(.*$/, '');
            return [l.slice(0, 3), body.split(expr).length - 1];
        });
        let moveWords = 0, wordChars = 0, mult = 0, longest = 0, carry = 0;
        for (const l0 of lines) {
            const l = String(l0).replace(/\s*\(.*$/, '');
            if (!/^\s*G[01]\s/.test(l)) continue;
            for (const ax of ['X', 'Y']) {
                const w = wordAt(l, ax); if (w == null) continue;
                moveWords++; wordChars += w.length; mult += (w.match(/\*/g) || []).length;
                longest = Math.max(longest, w.length);
                if (/#6[23]/.test(w)) carry++;
            }
        }
        const code = lines.map((l) => String(l).replace(/\s*\(.*$/, '').trimEnd()).filter(Boolean);
        return { hoistCount: hoist.length, occurrences, moveWords, wordChars, mult, longest, carry,
                 codeChars: code.reduce((n, l) => n + l.length, 0),
                 codeMult: code.reduce((n, l) => n + (l.match(/\*/g) || []).length, 0) };
    }, { op: OP, instrument: INSTRUMENT });
    expect(r.hoistCount, 'the angled pack hoists both axes').toBe(2);
    // THE RULE: once each, in its own assignment and nowhere else
    expect(r.occurrences, 'each origin expression is written ONCE in the whole body').toEqual([['#62', 1], ['#63', 1]]);
    expect(r.carry, 'and every move word carries a frame-origin register instead').toBe(r.moveWords);
    // THE NUMBERS (before → after in the header): a ratchet, so a re-inlining shows up as a number and not a shrug
    expect(r.moveWords, 'the same ten move words — the geometry did not move').toBe(10);
    expect(r.wordChars, `characters in the move words: 1233 → ${r.wordChars}`).toBeLessThanOrEqual(548);
    expect(r.mult, `multiplies in the move words: 60 → ${r.mult}`).toBeLessThanOrEqual(30);
    expect(r.longest, `the longest single word: 175 → ${r.longest}`).toBeLessThanOrEqual(84);
    expect(r.codeChars, `the whole body, comments stripped: 2221 → ${r.codeChars}`).toBeLessThanOrEqual(1503);
    expect(r.codeMult, `multiplies in the whole body: 69 → ${r.codeMult}`).toBeLessThanOrEqual(37);
});

/**
 * ── PROOF 3 — AN UN-ROTATED PACK EMITS NOTHING, and that is a requirement rather than a saving ────────────────────
 *
 * A bearing-0 slot is axis-aligned: `rot` is null, no cross-term exists, and the origin appears in a word at most
 * once. Two dead assignments at the top of every straight slot would be a cost nobody asked for, on the arm that
 * ships most. So the hoist is keyed on the ROTATION and the whole bearing-0 corpus is untouched — asserted here in
 * both directions, because "it does not fire" and "it fires only where it should" are different claims.
 */
test('PROOF 3 — bearing 0 hoists nothing; every other bearing does', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op }) => {
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines, surfaceRasterLiveGap } = await import('/wizards/ops/surfaceraster.js');
        const out = [];
        for (let deg = 0; deg < 360; deg += 5) {
            const rad = deg * Math.PI / 180;
            const leaf = { x0: op.ax, y0: op.ay, x1: op.ax + 40 * Math.cos(rad), y1: op.ay + 40 * Math.sin(rad),
                width: op.width, tool: op.toolDia, stepoverPct: op.stepoverPct, depth: op.depth,
                stepdown: op.stepdown, feed: op.feed, plunge: op.plunge, clearance: op.clearance, entry: 'plunge' };
            const live = slotRasterParams(leaf, SLOT_CAM_PACK_REGS);
            if (surfaceRasterLiveGap(live)) { out.push([deg, 'REFUSED']); continue; }
            const lines = surfaceRasterLines(live);
            out.push([deg, lines.filter((l) => /^#6[23]=/.test(l)).length,
                      /#6[23]/.test(lines.join('\n'))]);
        }
        return out;
    }, { op: OP });
    const zero = r.find((x) => x[0] === 0);
    expect(zero[1], 'bearing 0 emits NO hoist').toBe(0);
    expect(zero[2], '…and its body never mentions a frame-origin register at all').toBe(false);
    expect(r.filter((x) => x[0] !== 0 && x[1] === 0), 'every rotated bearing hoists').toEqual([]);
    expect(r.filter((x) => x[1] === 'REFUSED'), 'and none of them is refused').toEqual([]);
});

/**
 * ── PROOF 4 — ⚠ A NUMERIC ORIGIN AXIS IS NEVER HOISTED, and this one MOVED THE TOOL ───────────────────────────────
 *
 * The first cut hoisted any word that was not already a single register. At a CARDINAL bearing one axis folds to a
 * plain number — at 180° the X origin is `5`, because the width term's coefficient rounds to zero — so it emitted
 * `#62=5` and turned a BUILD-TIME CONSTANT into a live word. `affineFrame`'s `ORG` then moved it out of the axis
 * constant and into the terms, and the walk came out **5.000mm across**: clean G-code cutting a channel beside the
 * drawn one. Same class as the dead-multiply defects `geoMix` and `slotRasterParams` each record for their own zero
 * coefficients, reached from a third direction.
 *
 * So the rule is that an axis is hoistable only if it is ITSELF live, and it is asserted on the case that broke:
 * the cardinal bearings hoist exactly ONE axis, and the walk still agrees with the fully BAKED rendering.
 */
test('PROOF 4 — a cardinal bearing hoists one axis, not two, and the walk is unmoved', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ op, instrument }) => {
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        // eslint-disable-next-line no-new-func
        const { walk } = Function(instrument + 'return { walk };')();
        const seed = {};
        for (const k of Object.keys(SLOT_CAM_PACK_REGS)) seed[SLOT_CAM_PACK_REGS[k]] = op[k];
        const out = [];
        for (const deg of [0, 90, 180, 270]) {
            const rad = deg * Math.PI / 180;
            const leaf = { x0: op.ax, y0: op.ay, x1: op.ax + 40 * Math.cos(rad), y1: op.ay + 40 * Math.sin(rad),
                width: op.width, tool: op.toolDia, stepoverPct: op.stepoverPct, depth: op.depth,
                stepdown: op.stepdown, feed: op.feed, plunge: op.plunge, clearance: op.clearance, entry: 'plunge' };
            const live = surfaceRasterLines(slotRasterParams(leaf, SLOT_CAM_PACK_REGS));
            const baked = surfaceRasterLines(slotRasterParams(leaf));
            const hoist = live.filter((l) => /^#6[23]=/.test(l));
            // a hoisted line whose right-hand side is a bare number is the defect this proof exists for
            const numericHoist = hoist.filter((l) => /^#6[23]=-?\d*\.?\d+\s/.test(l)).map((l) => l.trim());
            const B = walk(baked, {}), L = walk(live, seed);
            let worst = 0;
            for (let i = 0; i < Math.min(B.length, L.length); i++) for (const ax of ['x', 'y'])
                if (B[i][ax] != null && L[i][ax] != null) worst = Math.max(worst, Math.abs(B[i][ax] - L[i][ax]));
            out.push({ deg, hoists: hoist.length, numericHoist, worst, moves: [B.length, L.length] });
        }
        return out;
    }, { op: OP, instrument: INSTRUMENT });
    expect(r.map((x) => [x.deg, x.hoists]), 'bearing 0 hoists nothing; each cardinal rotation hoists ONE axis — the other folded to a number')
        .toEqual([[0, 0], [90, 1], [180, 1], [270, 1]]);
    for (const x of r) {
        expect(x.numericHoist, `${x.deg}°: no origin register is assigned a plain NUMBER — that is the 5mm defect`).toEqual([]);
        expect(x.moves[0], `${x.deg}°: both renderings emit the same moves`).toBe(x.moves[1]);
        expect(x.worst, `${x.deg}°: the live walk still IS the baked walk (worst ${x.worst})`).toBeLessThan(5e-4);
    }
});

/**
 * ── PROOF 5 — THE BAND: the act needs NO new register, and the guard is asserted at the numbers it uses ───────────
 *
 * The band question is settled by the pair the atom ALREADY declares. `RASTER_SCRATCH` has carried #62-#64 since
 * t1355 for the skim frame, and the meaning is the same one — where this body's frame origin is — so the hoist
 * costs zero registers, zero allocator change and opens no adjacency question (`SLOT_ARC_BAND` records that the
 * #34-#49 block has no room to grow, so an act that needed a 51st register would not have been this act).
 *
 * What must still be proved is that the numbers are GUARDED: a composed slot whose own field vars walked into
 * #62/#63 would have the generator overwrite an operator value, which is the hazard `camScratch` exists for. So the
 * allocator is swept on BOTH arms the way t1512 swept them.
 */
test('PROOF 5 — #62/#63 are inside the declared band, guarded, and stepped over by the allocator on both arms', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const { bandsFor, fieldVarCollisions, nextLocalVar } = await import('/data/camScratch.js');
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const inB = (n, bands) => bands.some(([lo, hi]) => n >= lo && n <= hi);
        const slotB = bandsFor('slot');
        // the guard SEES a field var landing on the hoist registers
        const clash = fieldVarCollisions([{ var: '#62', key: 'feed', _op: 0 }, { var: '#63', key: 'plunge', _op: 0 }],
            [{ type: 'slot' }]).map((c) => c.varNum);
        // …and the allocator STEPS OVER them, so the collision can never be minted in the first place. #61 is asked
        // too and must come back UNMOVED: the step-over is this BAND, not a blanket over everything above #49 (the
        // probe temps end at #61 and are not a slot's band — `camScratch` keys by camType and a slot is not a probe).
        const stepped = [nextLocalVar(62, slotB), nextLocalVar(63, slotB), nextLocalVar(64, slotB), nextLocalVar(61, slotB)];
        // BOTH ARMS, swept: no field var of either lands in the raster band
        const OPV = { ax: 5, ay: 10, bx: 45, by: 33, width: 12, toolDia: 6, stepoverPct: 40, depth: 4,
                      stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, rpm: 12000, entry: 'plunge', rampAngle: 3 };
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: OPV[k] };
        const arms = {};
        for (const arm of [SLOT_ARM.atom, SLOT_ARM.literal])
            for (const off of [0, 10, 25, 33, 60]) {
                const g = slotFromOp('slot', arm, new Set(), off, decl);
                const bad = (g.fields || []).map((f) => Number(String(f.var || '').replace('#', '')))
                    .filter((n) => Number.isFinite(n) && inB(n, slotB));
                (arms[arm] = arms[arm] || []).push([off, bad]);
            }
        return { rasterBand: RASTER_SCRATCH, hoistInRaster: [inB(62, RASTER_SCRATCH), inB(63, RASTER_SCRATCH)],
                 hoistInSlot: [inB(62, slotB), inB(63, slotB)], clash, stepped, arms };
    });
    expect(r.rasterBand, 'the atom\'s declared band is unchanged by this act — no new register').toEqual([[34, 49], [62, 64]]);
    expect(r.hoistInRaster, '#62/#63 are inside it').toEqual([true, true]);
    expect(r.hoistInSlot, '…and inside the slot camType\'s union, which is what a packed slot is built against').toEqual([true, true]);
    expect(r.clash, 'the collision guard SEES a field var landing on either of them').toEqual([62, 63]);
    expect(r.stepped, 'the allocator steps over the whole band — and leaves #61, which is not a slot\'s band, alone').toEqual([65, 65, 65, 61]);
    for (const arm of Object.keys(r.arms))
        for (const [off, bad] of r.arms[arm])
            expect(bad, `${arm} arm at varOffset ${off}: no field var lands in the raster band`).toEqual([]);
});

/**
 * ── PROOF 6 — SKIM IS UNTOUCHED, and the no-collision argument is STRUCTURAL ──────────────────────────────────────
 *
 * The same pair has two claimants now: skim READS it from the machine, a rotated live-geometry frame COMPUTES it
 * from the knobs. They cannot collide, and the reason is not a refusal that a later act might lift — it is that on
 * a skim frame the origin word already IS `#62`, and the hoist only ever hoists a COMPOUND word. So the hoist can
 * never write a register the frame is already reading, whatever the envelope decides about skim + live geometry.
 * Asserted as the structure (a skim body's frame words are bare registers, and it emits no hoist) rather than as
 * "the combination is refused".
 */
test('PROOF 6 — a skim body still reads its frame and never hoists', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, surfaceRasterAbsorbsRotation } = await import('/wizards/ops/surfaceraster.js');
        const P = { w: 100, h: 80, depth: 2, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000,
                    plunge: 200, clearance: 5, zMode: 'skim', strategy: 'parallel', entry: 'plunge' };
        const out = {};
        for (const [k, extra] of [['plain', {}], ['liveGeom', { x: '#20', y: '#21', inset: '#22' }],
                                  ['rotated', { rotAngle: 30 }], ['liveRotated', { x: '#20', y: '#21', rotAngle: 30, bearing: 20 }]]) {
            const lines = surfaceRasterLines({ ...P, ...extra });
            out[k] = {
                reads: lines.filter((l) => /^#6[234]=#79\d/.test(l)).length,       // the machine read, as ever
                sentinels: lines.filter((l) => /^#6[234]=-99999/.test(l)).length,
                hoists: lines.filter((l) => /frame origin /.test(l)).length,
                absorbs: surfaceRasterAbsorbsRotation({ ...P, ...extra }) === true,
            };
        }
        return out;
    });
    for (const k of Object.keys(r)) {
        expect(r[k].reads, `${k}: the skim frame is still READ from #790/#791/#792`).toBe(3);
        expect(r[k].sentinels, `${k}: behind its three sentinels`).toBe(3);
        expect(r[k].hoists, `${k}: and a skim body never hoists — its origin word is already one register`).toBe(0);
        expect(r[k].absorbs, `${k}: skim still refuses to absorb a rotation, in its own words`).toBe(false);
    }
});

/**
 * ── PROOF 7 — @work CARRIES THE TWO ASSIGNMENTS, DIFFERENCED against the engine's executed count ──────────────────
 *
 * The hoist adds one executed statement per hoisted axis, once, before the depth loop — so it lands on the header
 * term (16) and nowhere else. It is read from the same derivation the emitter uses, so the declaration cannot claim
 * a hoist the body does not emit.
 *
 * ⚠ THE CONFIG HERE IS DELIBERATELY NOT THE PACKED SLOT. The marker is OMITTED whenever the area, depth, tool or
 * either inset is live, and the packed slot makes all of them live (t1514 PROOF 6 asserts exactly that, and still
 * does). The case this term is FOR is a live ORIGIN with everything else typed — which the atom's envelope permits
 * and no wizard builds today, so it is declared to the RULE rather than to the caller list.
 *
 * ⚠⚠ AND MEASURING IT FOUND A **PRE-EXISTING** UNDER-DECLARATION, WHICH IS NAMED HERE RATHER THAN QUIETLY FIXED.
 * A body with a NON-ZERO INSET executes four statements the model does not count: the two `IF <span> <= 0` guards
 * t1404 added to the header, and the `GOTO`/label pair that skips their refusal. Measured, with no hoist anywhere
 * near it — `inset 0` declares 559 against an executed 559 (EXACT, which is what t1440's calibration asserts and
 * still does), while the same body at `inset 3` declares 520 against an executed 524.
 *
 * It is on the WRONG side (under-declaring truncates a preview), it has been there since t1404, and t1440's audit
 * did not see it because its whole matrix runs at `inset: 0`. It is NOT this act's to fix: closing it moves
 * `ring-descent-1404`'s "an inset declares exactly what the equivalent bare rect declares" — a claim about the
 * AREA that would become `+ 4` — and that is a decision about a different declaration. So it is PINNED at its
 * measured value here, in both directions, so that the day it is closed this test says so and points at the fix,
 * and so that this act cannot be read as having caused it or widened it.
 */
test('PROOF 7 — the declared work grows by exactly the hoist, and matches the engine', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
        const { surfaceRasterLines, surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const steps = (nc) => {
            const eng = new GcodeExecutionEngine({ autoAnswer: true });
            let n = 0; const orig = eng._executeStep.bind(eng);
            eng._executeStep = (s) => { n++; return orig(s); };
            eng.traceStepCap = 8000000;
            const res = eng.trace(nc);
            return { n, capped: !!res.stats.capped };
        };
        // a live ORIGIN, everything else typed — the shape in which a marker and a hoist coexist
        const P = { x: '#20', y: '#21', w: 100, h: 80, depth: 1.5, stepdown: 0.5, toolDia: 12, stepoverPct: 50,
                    inset: 3, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel',
                    direction: 'bothways', entry: 'plunge', bearing: 30 };
        const flat = { ...P, bearing: 0 };
        const NL = String.fromCharCode(10);
        const hoisted = surfaceRasterLines(P), straight = surfaceRasterLines(flat);
        // the INSET-FREE control, which is what isolates the pre-existing gap from anything this act did
        const clean = { ...P, inset: 0, x: 0, y: 0, bearing: 0 };
        return {
            hoistLines: hoisted.filter((l) => /frame origin /.test(l)).length,
            flatHoistLines: straight.filter((l) => /frame origin /.test(l)).length,
            declaredHoisted: surfaceRasterWorkSteps(P), declaredFlat: surfaceRasterWorkSteps(flat),
            realHoisted: steps(hoisted.join(NL)), realFlat: steps(straight.join(NL)),
            declaredClean: surfaceRasterWorkSteps(clean), realClean: steps(surfaceRasterLines(clean).join(NL)),
        };
    });
    expect(r.hoistLines, 'the rotated live-origin config hoists both axes').toBe(2);
    expect(r.flatHoistLines, '…and the same config at bearing 0 hoists neither').toBe(0);
    for (const [k, real] of [['hoisted', r.realHoisted], ['flat', r.realFlat], ['clean', r.realClean]])
        expect(real.capped, `${k}: the body ran to completion — an incomplete run measures nothing`).toBe(false);
    // ── THE ACT'S OWN CLAIM, DIFFERENCED: declared and executed each grow by exactly the two assignments ──────────
    expect(r.declaredHoisted - r.declaredFlat, 'the declaration grows by exactly the two assignments').toBe(2);
    expect(r.realHoisted.n - r.realFlat.n, 'and the ENGINE executes exactly two more statements — differenced, not reasoned').toBe(2);
    // ── THE INSET-FREE CONTROL: still EXACT, so the model itself is unmoved by this act ───────────────────────────
    expect(r.declaredClean, `an inset-free body is still EXACT (declared ${r.declaredClean} vs executed ${r.realClean.n})`).toBe(r.realClean.n);
    // ── ⚠ THE PRE-EXISTING GAP, PINNED AT ITS MEASURED VALUE (see the header): t1404's two inset guards plus their
    //    GOTO/label pair, four statements the model has never counted. Unmoved by the hoist — the SAME 4 on both
    //    sides — which is the point: this act neither caused it nor widened it.
    expect(r.realFlat.n - r.declaredFlat, 'PRE-EXISTING: an insetted body executes 4 statements the model does not count').toBe(4);
    expect(r.realHoisted.n - r.declaredHoisted, '…and the hoist does not widen it by so much as one').toBe(4);
});
