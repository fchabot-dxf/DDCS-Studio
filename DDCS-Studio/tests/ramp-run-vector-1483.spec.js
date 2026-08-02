import { test, expect } from '@playwright/test';

/**
 * t1483 (C4) — THE DECLARED RUN VECTOR. The bridge.
 *
 * ── WHY THIS IS A RELATIONSHIP BRIDGE AND NOT AN EQUIVALENCE ONE ────────────────────────────────────────────────
 * Every previous descent act was proved MOVE FOR MOVE against the literal kernel. This one cannot be and must not
 * pretend to be: a ramp along the row cuts a DIFFERENT set of moves from a ramp toward the area centre. That is the
 * whole point — t1339 named the centre-ward ramp's cost (it bakes a hypotenuse, and SQRT is unverified here) and
 * named this vector as the answer "that needs no square root at all".
 *
 * So the bridge is in two halves, and the split is the honest part:
 *   OUTSIDE the descent — BYTE-IDENTICAL. If a single character of the walk moved, this act did more than it said.
 *   INSIDE  the descent — the RELATIONSHIP: the declared angle, the full drop, the start point, the return to it,
 *                         the honest degrade, and the guard now reading a LIVE register instead of a baked number.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const BASE = { w: 80, h: 60, depth: 3, stepdown: 1.5, toolDia: 8, stepoverPct: 45, feed: 1200, plunge: 150, clearance: 5, rampAngle: 3 };

const emit = (page, over) => page.evaluate(async (o) => {
    const m = await import('/wizards/ops/surfaceraster.js');
    return m.surfaceRasterLines(o).join('\n');
}, { ...BASE, ...over });

/** the descent block: from the run assignment to the label that closes it (inclusive).
 *  t1524 — the run is now sized by the drop actually left (`[#46 − #35]`) rather than by the nominal bite `#43`, so
 *  the locator reads the register it ASSIGNS (`#34=`) rather than the expression it assigns FROM. That is the stable
 *  half of the line: this helper only needs to find where the descent starts, and it silently returned an EMPTY block
 *  when the expression changed — a helper that fails open makes every assertion below it vacuous. */
const descentOf = (text) => {
    const L = text.split('\n');
    const a = L.findIndex((l) => /^\s*#34=\[/.test(l));
    if (a < 0) throw new Error('descentOf: no ramp run assignment (#34=[…]) in this program — the locator is stale, not the program');
    const b = L.findIndex((l, i) => i > a && /^\s*N\d+\s*$/.test(l) && /rampEnd|N42/.test(l + ''));
    const end = b > 0 ? b : L.findIndex((l, i) => i > a && /\( the ramp did not fit/.test(l)) + 2;
    return { block: L.slice(a, end + 1), at: a, rest: L.filter((_, i) => i < a || i > end) };
};

test('BRIDGE A — everything OUTSIDE the descent is BYTE-IDENTICAL to the plunge walk', async ({ page }) => {
    await boot(page);
    const plunge = await emit(page, { strategy: 'parallel', entry: 'plunge' });
    const ramp = await emit(page, { strategy: 'parallel', entry: 'ramp' });
    // strip each program's descent; what is left must match character for character. A walk that changed with the
    // descent would mean this act reached past the thing it declared.
    const pl = plunge.split('\n').filter((l) => !/\( the ONE plunge of this level \)|G1 Z\[.*\] F150/.test(l));
    const rp = descentOf(ramp).rest;
    /**
     * ⚠ t1485 — THE `@work` TOKEN IS THE ONE THING OUTSIDE THE DESCENT THAT *MUST* MOVE, and this bridge asserted it
     * must not. It was RED on the parked branch for exactly this reason (`@work 482` vs `494`) — measured before this
     * turn touched anything, and not a consequence of the cross-axis fix.
     *
     * The count is a DECLARATION ABOUT the descent: it sizes the tracer's preview cap, and t1383 measured what an
     * undersized cap does (a preview silently showing a fraction of the toolpath). A ramp executes six more steps per
     * level than a plunge, so a header that read the same for both would be the defect, not the proof. Only the
     * NUMBER is neutralised — every other character of that header is still compared, so a reworded or dropped
     * declaration still fails here.
     */
    const norm = (a) => a.filter((l) => l.trim() !== '').join('\n').replace(/@work \d+/g, '@work <n>');
    /**
     * ⚠ t1524 — AND THE SECOND THING OUTSIDE THE DESCENT THAT MUST MOVE: the FLOOR CAPTURE, `#35=#46`.
     *
     * The ramp now descends the drop that is ACTUALLY left (`#46 − #35`) rather than a whole nominal bite, and the
     * floor it starts from is a property of the LEVEL, not of the descent — the depth loop is the only place that
     * knows it, because it is the only thing that sees `#46` before the bite is added. So one line of the ramp's
     * cost necessarily sits in the level loop rather than in the descent block this spec strips.
     *
     * It is NOT neutralised the way `@work` is. It is REMOVED AND COUNTED: the walk must be identical to the plunge
     * walk after taking out EXACTLY ONE capture line, and the count is asserted, so a second one appearing (a stray
     * seed, a duplicated capture) still fails here loudly.
     */
    const caps = rp.filter((l) => /^\s*#35=#46\b/.test(l));
    expect(caps.length, 'exactly ONE floor capture rides outside the descent — a seed or a duplicate would be a second').toBe(1);
    expect(norm(rp.filter((l) => !/^\s*#35=#46\b/.test(l))), 'the rest of the walk around the descent is untouched').toBe(norm(pl));
    // …and the count really did move, which is what makes neutralising it honest rather than convenient
    const workOf = (t) => Number((t.match(/@work (\d+)/) || [])[1]);
    expect(workOf(ramp), 'a ramp declares MORE executed steps than a plunge — seven per level since t1524').toBeGreaterThan(workOf(plunge));
});

test('BRIDGE B — INSIDE the descent: the angle, the drop, the start and the return are preserved', async ({ page }) => {
    await boot(page);
    const text = await emit(page, { strategy: 'parallel', entry: 'ramp', rampAngle: 3 });
    const d = descentOf(text).block.join('\n');
    // the run is still drop / tan(angle) — the tangent is the ONE thing that stayed baked, and the angle is a form field.
    // t1524 — the DROP it is applied to is now the real remaining one (`#46 − #35`) rather than the nominal bite `#43`:
    // on a clamped final level a whole bite over-ran the descent by `(stepdown − lastBite)/tan(angle)` and spent it in air.
    const invTan = 1 / Math.tan(3 * Math.PI / 180);
    expect(d, 'the run is the declared angle applied to the drop actually left').toContain(`#34=[[#46 - #35] * ${Math.round(invTan * 1000) / 1000}]`);
    // it descends to this level's floor and returns to the row start at depth
    expect(d, 'the ramp move reaches the level Z').toMatch(/\( ramp \)/);
    expect(d, 'and comes back to the row start').toMatch(/back to the row start, now at depth/);
    // the honest degrade survives — the property, not the wording
    expect(d, 'the degrade is still there when the run does not fit').toMatch(/the ramp did not fit — straight plunge/);
});

test('BRIDGE C — the guard reads a LIVE register: no baked distance survives anywhere', async ({ page }) => {
    await boot(page);
    for (const [tag, over] of [
        ['parallel', { strategy: 'parallel', entry: 'ramp' }],
        ['concentric', { strategy: 'concentric', entry: 'ramp' }],
        // t1485 — this row said `direction: 'y'` and the row axis is selected by `rowAxis`, so it was running the
        // BOTHWAYS X walk under a Y-row label: a green assert about a case it never reached. Corrected, and the
        // guard below now really does read #41 on this arm — which is the whole point of listing it separately.
        ['rows-along-Y', { strategy: 'parallel', entry: 'ramp', rowAxis: 'y' }],
        ['one-way', { strategy: 'parallel', entry: 'ramp', direction: 'oneway' }],
        ['mirrored', { strategy: 'parallel', entry: 'ramp', direction: 'otherway' }],
    ]) {
        const t = await emit(page, over);
        // ⚠ THE CAPABILITY IN ONE ASSERT: the guard compares the run to a REGISTER. It used to be a literal.
        expect(t, `${tag}: the run guard reads a live span register`).toMatch(/IF #34 > #4[01] GOTO/);
        expect(t, `${tag}: no baked distance-to-centre survives`).not.toMatch(/mm to centre/);
        // and no hypotenuse was ever written out as a constant multiplier pair
        expect(t, `${tag}: the direction is an AXIS vector, so one component is zero`).toMatch(/#34 \* (1|-1|0)\b/);
    }
});

test('BRIDGE D — a DIALLED area now cuts a real ramp, where it used to degrade to a plunge', async ({ page }) => {
    await boot(page);
    const live = await emit(page, { strategy: 'parallel', entry: 'ramp', w: '#4', h: '#5', toolDia: '#9', stepoverPct: '#10' });
    // this is the user-visible purchase of the whole act
    expect(live, 'a dialled ramp is a ramp').toMatch(/\( ramp \)/);
    expect(live, 'not a degraded plunge').not.toMatch(/entry degraded to a plunge/);
    expect(live, 'and its guard is against the live span').toMatch(/IF #34 > #4[01] GOTO/);
    // the HELIX on the same dialled area still degrades — the two descents must not be confused
    const helix = await emit(page, { strategy: 'parallel', entry: 'helix', w: '#4', h: '#5', toolDia: '#9', stepoverPct: '#10' });
    expect(helix, 'the helix still bakes its inradius, so it still degrades').toMatch(/entry degraded to a plunge/);
});

/**
 * ── BRIDGE F (t1485) — THE KINK, BRIDGED EXPLICITLY: a DIALLED walk DESCENDS WHERE IT CUTS ────────────────────────
 *
 * t1483 parked this act one axis short and said why: the run vector fixed the axis the ramp RUNS ALONG and left the
 * axis it SITS ON baked. Every assert above passes with that hole open — they read the guard, the direction and the
 * degrade, none of which move — which is exactly why this bridge exists and why it is written against MOTION.
 *
 * ⚠ THE HAZARD IS BIGGER THAN A KINKED ENTRY, and that was measured on the parked branch before the fix rather than
 * argued: the row cut deliberately omits its cross-axis word (modal, so the tool stays down between rows — see
 * `ROW_Y(null)` in the walk). So a ramp that ends at the wrong cross coordinate does not just enter badly — it LEAVES
 * THE TOOL THERE, and the row inherits it. Traced pre-fix, with a pendant stepover of 40% on a Ø6:
 *
 *     ramp   (0, 1.2, 0) → (28.621, 0, −1.5)      the rapid put the tool on the live row; the ramp cut off it
 *     back   (28.621, 0, −1.5) → (0, 0, −1.5)
 *     ROW    (0, 0, −1.5) → (80, 0, −1.5)         ⚠ the row itself cut at Y0, not at the Y1.2 it was counted for
 *
 * …and on the mirror, whose start was the baked far end, the ramp ran to X−28.621 — 28.6mm OUTSIDE the stock at
 * cutting feed. So this asserts the property in the only terms that matter: where the tool actually goes.
 *
 * THE EXPECTED COORDINATE IS COMPUTED BY THIS TEST from the dialled numbers, never read back out of the emit — the
 * t1425 rule (assert the value against an independent truth, not the change against itself).
 */
const REG = { x: '#2', y: '#3', w: '#4', h: '#5', inset: '#6', depth: '#7', stepdown: '#8', toolDia: '#9', stepoverPct: '#10', feed: '#11', plunge: '#12' };
/**
 * What the PENDANT holds. Deliberately NOT the atom's own defaults (w 100 · h 80 · tool Ø12) — that gap IS the
 * hazard: `num('#9', 12)` hands back 12 for a register, so anything baked is built from a number nobody dialled.
 */
const DIALLED = { x: 0, y: 0, w: 80, h: 60, inset: 0, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 1200, plunge: 150 };

const traceDialled = (page, cfg) => page.evaluate(async ({ REG, DIALLED, cfg }) => {
    const m = await import('/wizards/ops/surfaceraster.js');
    const { traceToolpath } = await import('/engine/trace.js');
    // seeded the way a CAM slot seeds them — one read-line per field into a local (the t1410 shape)
    const seeds = Object.keys(REG).map((k) => `${REG[k]}=${DIALLED[k]}   ;${k}`);
    const nc = seeds.concat(m.surfaceRasterLines({ z0: 0, clearance: 5, rampAngle: 3, ...cfg, ...REG })).join(String.fromCharCode(10));
    const q = (n) => +Number(n).toFixed(3);
    return (traceToolpath(nc).segments || []).filter((s) => !s.rapid).slice(0, 3)
        .map((s) => ({ x1: q(s.x1), y1: q(s.y1), z1: q(s.z1), x2: q(s.x2), y2: q(s.y2), z2: q(s.z2) }));
}, { REG, DIALLED, cfg });

/** cross = the axis the rows step across (where the row register lives); along = the axis a row runs down. */
const KINK_CASES = [
    { name: 'both-ways, rows ∥ X', cfg: { strategy: 'parallel', entry: 'ramp', direction: 'bothways' }, cross: 'y', along: 'x' },
    { name: 'one-way, rows ∥ X', cfg: { strategy: 'parallel', entry: 'ramp', direction: 'oneway' }, cross: 'y', along: 'x' },
    { name: 'the MIRROR — the row starts at the FAR end, so the ramp does too', cfg: { strategy: 'parallel', entry: 'ramp', direction: 'otherway' }, cross: 'y', along: 'x', far: true },
    { name: 'rows ∥ Y — the two axes swap and the register goes with them', cfg: { strategy: 'parallel', entry: 'ramp', rowAxis: 'y' }, cross: 'x', along: 'y' },
    { name: 'rows ∥ Y, MIRRORED — both corrections at once', cfg: { strategy: 'parallel', entry: 'ramp', rowAxis: 'y', direction: 'otherway' }, cross: 'x', along: 'y', far: true },
];

for (const c of KINK_CASES) {
    test(`BRIDGE F — descend-at == cut-at under a dialled stepover: ${c.name}`, async ({ page }) => {
        await boot(page);
        const [ramp, back, row] = await traceDialled(page, c.cfg);
        // THE ROW THE WALK IS ABOUT TO CUT, from the dialled numbers: rows sit at step/2 + i·step, so row 0 is step/2.
        const step = DIALLED.toolDia * DIALLED.stepoverPct / 100;                 // 2.4mm — nothing like the default
        const rowAt = DIALLED[c.cross] + step / 2;                                // 1.2mm from the area edge
        const span = c.along === 'x' ? DIALLED.w : DIALLED.h;
        const startsAt = DIALLED[c.along] + (c.far ? span : 0);

        // ⚠ THE ONE ASSERTION THIS ACT EXISTS FOR — all three moves share the row's cross coordinate.
        for (const [tag, seg] of [['the ramp descends on', ramp], ['it returns along', back], ['and the ROW cuts on', row]]) {
            expect(seg[`${c.cross}1`], `${tag} the live row`).toBeCloseTo(rowAt, 3);
            expect(seg[`${c.cross}2`], `${tag} the live row, both ends`).toBeCloseTo(rowAt, 3);
        }
        // …and the ALONG axis starts where the row starts — the mirror's far end is the LIVE span, not a baked default
        expect(ramp[`${c.along}1`], 'the ramp leaves the row start').toBeCloseTo(startsAt, 3);
        expect(back[`${c.along}2`], 'and comes back to it').toBeCloseTo(startsAt, 3);
        // it really did descend a full bite while running (a plunge would satisfy every line above)
        expect(ramp.z1 - ramp.z2, 'the ramp descends the level bite as it runs').toBeCloseTo(DIALLED.stepdown, 3);
        expect(Math.abs(ramp[`${c.along}2`] - ramp[`${c.along}1`]), 'and it RUNS — this is a ramp, not a plunge').toBeGreaterThan(1);
        // the run stays INSIDE the material: a mirrored ramp that kept the baked start left the stock entirely
        const lo = DIALLED[c.along], hi = lo + span;
        for (const p of [ramp[`${c.along}1`], ramp[`${c.along}2`]]) {
            expect(p, `the ramp stays inside the area (${lo}..${hi})`).toBeGreaterThanOrEqual(lo - 0.001);
            expect(p, `the ramp stays inside the area (${lo}..${hi})`).toBeLessThanOrEqual(hi + 0.001);
        }
    });
}

test('BRIDGE E — the mirrored walk ramps INTO the area, not out of it', async ({ page }) => {
    await boot(page);
    const fwd = await emit(page, { strategy: 'parallel', entry: 'ramp', direction: 'oneway' });
    const rev = await emit(page, { strategy: 'parallel', entry: 'ramp', direction: 'otherway' });
    const sign = (t) => (/#34 \* -1\b/.test(t) ? -1 : 1);
    // an `otherway` level starts at the FAR end, so its ramp must run the OTHER way or it would leave the material
    expect(sign(fwd), 'the forward walk ramps +').toBe(1);
    expect(sign(rev), 'the mirrored walk ramps − (into the area from the far end)').toBe(-1);
});
