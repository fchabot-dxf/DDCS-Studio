import { test, expect } from '@playwright/test';
import { rampDescentRelationship } from './support/rampRelationship.js';

/**
 * t1524 — THE RAMP DESCENDS THE DROP THAT IS ACTUALLY LEFT, EVERYWHERE.
 *
 * The shelved half of t1504's fork (option B), landed as its own act. A ramp's run is `drop / tan(angle)`, and every
 * kernel but one read `drop` as the NOMINAL bite. On a CLAMPED final level the real remaining drop is smaller than a
 * whole bite, so the ramp began `(stepdown − lastBite)` ABOVE the true floor and spent that much of its descent
 * cutting air the previous level had already cleared — 9.54mm of run at the slot's shipped defaults (depth 4 @ 1.5, 3°).
 *
 * ⚠ THIS IS NOT A GOUGE FIX AND THE LOG IS EMPHATIC ABOUT IT. t1504 measured overshoot at 0.0000 on every kernel and
 * every config: both floors end at exactly the asked depth and neither leaves material. What moves is EFFICIENCY and
 * MEANING — a ramp ANGLE should describe the drop that is actually left.
 *
 * THE THREE PIECES, because the level walk lives in a different place for each caller:
 *   · THE ATOM (`surfaceraster`) walks levels in the MACRO, so it captures the floor in a register: `#35=#46` at the
 *     top of the depth loop, before the bite is added. It needs NO SEED — on the first pass `#46` is still 0 and 0 is
 *     exactly the stock top. `#35` is free by the same mutual exclusion that frees `#34` (the helix's `vy` can never
 *     be live with a ramp), so `SLOT_ARC_BAND` does not grow.
 *   · `stepover.js` / `contourfill.js` are called PER LEVEL and know the bite but not the total depth, so they cannot
 *     recognise a clamped level at all. The StepDown scope DECLARES the floor and they read it — from the SCOPE, via
 *     the fill fold, never as a param a builder writes (a builder that forgot it would silently keep the old descent).
 *   · `slot.js` walks its own levels in JS, so it reads the previous level directly — the floor it had before t1506.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE ATOM — the floor is captured in ONE line, seeded by nothing, and only when a ramp reads it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const base = { x: 0, y: 0, w: 120, h: 80, depth: 4, stepdown: 1.5, toolDia: 12, stepoverPct: 60,
            feed: 2000, plunge: 200, clearance: 5, rampAngle: 3, helixDia: 8, helixPitch: 1 };
        const txt = (entry) => surfaceRasterLines({ ...base, entry }).join(String.fromCharCode(10));
        return { ramp: txt('ramp'), plunge: txt('plunge'), helix: txt('helix') };
    });
    // THE CAPTURE — one line, and it sits ABOVE the increment, which is what makes 0 (the stock top) correct on the
    // first pass without a seed. If it ever moves below `#46=[#46 + #43]` the first level ramps from the wrong floor.
    const lines = r.ramp.split('\n').map((l) => l.trim());
    const cap = lines.findIndex((l) => l.startsWith('#35=#46'));
    const inc = lines.findIndex((l) => l.startsWith('#46=[#46 + #43]'));
    expect(cap, 'the floor capture is emitted').toBeGreaterThan(0);
    expect(cap, 'and it is captured BEFORE the bite is added — that is what makes the first pass 0 = the stock top').toBeLessThan(inc);
    expect(r.ramp.split('#35=#46').length - 1, 'exactly ONE capture — a seed above the loop would be a second statement of the same fact').toBe(1);
    // THE RUN reads the real remaining drop, and the rapid goes to that same floor.
    expect(r.ramp, 'the run is sized by the drop actually left').toContain('#34=[[#46 - #35] * 19.081]');
    expect(r.ramp, 'and the rapid drops to the floor this level starts from').toContain('G0 Z[0 - #35]');
    expect(r.ramp, 'the nominal form is gone — no ramp is sized by a whole bite any more').not.toContain('#34=[#43 *');
    // RAMP-ONLY: the other two descents do not read the floor, so their programs are untouched.
    expect(r.plunge, 'a plunge program never mentions the floor register').not.toContain('#35');
    expect(r.helix.includes('#35=#46'), 'and a helix does not capture it either — #35 is the helix vy, which is the whole basis for sharing the slot').toBe(false);
});

test('BYTE-IDENTICAL WHERE EVERY BITE IS WHOLE — the change can only reach a CLAMPED level', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { depthLevels } = await import('/wizards/clearing.js');
        const NL = String.fromCharCode(10);
        const out = [];
        // depth/stepdown pairs that divide EXACTLY — every level is a whole bite, so the two floors coincide
        for (const [depth, stepdown] of [[3, 1.5], [4.5, 1.5], [6, 1.5], [3.2, 0.8], [5, 1], [7.5, 2.5]]) {
            const lv = depthLevels(depth, stepdown);
            for (let i = 0; i < lv.length; i++) {
                const z = -lv[i], prevZ = i ? -lv[i - 1] : 0;
                const p = { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, stepoverPct: 40,
                    strategy: 'parallel', direction: 'bothways', entry: 'ramp', rampAngle: 3, by: stepdown,
                    feed: 2000, plunge: 150, clearance: 5 };
                const nominal = BLOCKS.pocketfill.lines(p, z).join(NL);                  // no declared floor → z + by
                const actual = BLOCKS.pocketfill.lines({ ...p, prevZ }, z).join(NL);     // the declared floor
                out.push({ depth, stepdown, i, same: nominal === actual });
            }
        }
        return out;
    });
    expect(r.length, 'the sweep really walked levels').toBeGreaterThan(20);
    const moved = r.filter((x) => !x.same);
    expect(moved, `a whole bite descends the same distance either way, so NOTHING moves: ${JSON.stringify(moved.slice(0, 3))}`).toEqual([]);
});

/**
 * ── THE BLAST RADIUS, AS A NUMBER ────────────────────────────────────────────────────────────────────────────────
 *
 * This act MOVES EMITTED BYTES, and pre-release "no legacy burden" is a reason not to migrate anything — not a reason
 * to leave the size of the move unmeasured. The rule is structural: a config's descent moves IFF it ramps AND its
 * final level is CLAMPED. This counts the sweep both ways and asserts the rule holds exactly, in both directions, so
 * the number is a measured fact rather than an estimate.
 */
test('THE BLAST RADIUS — exactly the ramped, partial-final-level configs move, counted in both directions', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { depthLevels } = await import('/wizards/clearing.js');
        const NL = String.fromCharCode(10);
        let total = 0, movedN = 0; const wrong = [];
        for (const kind of ['pocketfill', 'contourfill'])
            for (const entry of ['plunge', 'ramp'])
                for (const [depth, stepdown] of [[3, 1.5], [4, 1.5], [5, 1.5], [2, 1.5], [4.5, 1.5], [3.2, 0.8], [3.5, 0.8], [7, 2.5], [6, 1.5]]) {
                    const lv = depthLevels(depth, stepdown);
                    const lastBite = lv.length > 1 ? lv[lv.length - 1] - lv[lv.length - 2] : lv[0];
                    const partial = Math.abs(lastBite - stepdown) > 1e-9;
                    const i = lv.length - 1;                                  // the FINAL level is where it can bite
                    const z = -lv[i], prevZ = i ? -lv[i - 1] : 0;
                    const p = kind === 'pocketfill'
                        ? { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, stepoverPct: 40,
                            strategy: 'parallel', direction: 'bothways', entry, rampAngle: 3, by: stepdown,
                            feed: 2000, plunge: 150, clearance: 5 }
                        : { shape: 'rect', x: 0, y: 0, w: 80, h: 60, side: 'outside', tool: 6, entry, rampAngle: 3,
                            by: stepdown, feed: 2000, plunge: 200, clearance: 5 };
                    total++;
                    // pocketfill is a FILL (lines(p, z)); contourfill is a LEAF that reads its own `z` — call each as it is
                    const run = (q) => (kind === 'pocketfill' ? BLOCKS[kind].lines(q, z) : BLOCKS[kind].emit({ ...q, z })).join(NL);
                    const nominal = run(p);
                    const actual = run({ ...p, prevZ });
                    const moved = nominal !== actual;
                    if (moved) movedN++;
                    const shouldMove = entry === 'ramp' && partial;
                    if (moved !== shouldMove) wrong.push({ kind, entry, depth, stepdown, moved, shouldMove });
                }
        return { total, movedN, wrong };
    });
    console.log(`t1524 BLAST RADIUS — ${r.movedN} of ${r.total} swept literal configs move their bytes`);
    expect(r.total, 'the sweep covers both literal fill kernels, both descents, whole and partial').toBeGreaterThan(30);
    // ⚠ BOTH DIRECTIONS. A ramped partial level MUST move (or the act did nothing); anything else MUST NOT (or the
    // act moved bytes it had no business touching — a plunge program, or a level whose bite was already whole).
    expect(r.wrong, `bytes move in EXACTLY the ramp-over-partial case and nowhere else: ${JSON.stringify(r.wrong.slice(0, 4))}`).toEqual([]);
    expect(r.movedN, 'and the act really does move something — a blast radius of zero would mean it did nothing').toBeGreaterThan(0);
});

/**
 * ── THE ALLOWANCE ITSELF IS TESTED, because it is the one comparison this act LOOSENED ───────────────────────────
 *
 * The frozen literal bridges (1406, 1418) compare against references captured before the descent moved, so
 * `rampDescentRelationship` gained an `actualDrop` declaration permitting the start Z to differ on a clamped level.
 * An allowance nobody probes is a hole: it could be swallowing a real regression on every one of those bridges. So
 * it is exercised directly here — it must ACCEPT the shape this act produces and still REJECT everything else.
 *
 * Rows are [x1,y1,z1,x2,y2,z2,feed]: a ramp move, then the flat return that undoes it.
 */
const RAMP = (z0, z1, run) => [[0, 0, z0, run, 0, z1, 1200], [run, 0, z1, 0, 0, z1, 1200]];
const ANGLE = 19.081;   // 1/tan(3°) — run per mm of drop, the operator's declared angle

test('THE ALLOWANCE — it accepts a deeper start at the SAME angle, and rejects everything else', async ({ page }) => {
    // the reference: a nominal whole-bite descent on a clamped level — starts at −2.5, drops 1.5, runs 1.5 × 19.081
    const lit = RAMP(-2.5, -4, 1.5 * ANGLE);
    // what this act emits: starts at the REAL floor −3, drops 1.0, runs 1.0 × 19.081 — same angle, same end
    const ok = rampDescentRelationship(lit, RAMP(-3, -4, 1.0 * ANGLE), { actualDrop: true });
    expect(ok.ok, `the declared divergence is accepted — ${ok.why}`).toBe(true);
    expect(ok.deepened, 'and it is RECORDED as having taken the allowance, so a bridge can tell it fired').toBe(1);

    // …and without the declaration it is still a failure, so no bridge gets this silently
    expect(rampDescentRelationship(lit, RAMP(-3, -4, 1.0 * ANGLE), {}).ok, 'undeclared, the same divergence still fails').toBe(false);

    // ⚠ THE THREE THINGS THE ALLOWANCE MUST STILL CATCH — each is a real defect this act could otherwise mask:
    // 1. starting ABOVE the reference: the actual floor can only be at or below the nominal one
    expect(rampDescentRelationship(lit, RAMP(-2, -4, 2.0 * ANGLE), { actualDrop: true }).ok, 'a start ABOVE the reference is rejected').toBe(false);
    // 2. ending somewhere else: both descents must reach the SAME level floor — this is the safety-relevant one
    expect(rampDescentRelationship(lit, RAMP(-3, -4.5, 1.5 * ANGLE), { actualDrop: true }).ok, 'a different END depth is rejected').toBe(false);
    // 3. a different ANGLE: the operator set that, and a shorter drop is no licence to change it
    expect(rampDescentRelationship(lit, RAMP(-3, -4, 1.0 * 9.5), { actualDrop: true }).ok, 'a changed ramp ANGLE is rejected').toBe(false);
    // …and a whole-bite level is still held to exact equality even WITH the declaration
    const whole = RAMP(-1.5, -3, 1.5 * ANGLE);
    expect(rampDescentRelationship(whole, RAMP(-1.5, -3, 1.4 * ANGLE), { actualDrop: true }).ok, 'where the floors coincide, the run must still match exactly').toBe(false);
});

test('THE SCOPE CONTRACT — a StepDown declares the floor, and a StepOver on its own still has none', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const NL = String.fromCharCode(10);
        // depth 4 @ 1.5 → levels 1.5 / 3.0 / 4.0: the last bite is 1.0, so the final level is CLAMPED.
        const prog = (entry) => String(emitProgram([
            { type: 'stepdown', params: { to: 4, by: 1.5 }, children: [
                { type: 'pocketfill', params: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6,
                    stepoverPct: 40, strategy: 'parallel', direction: 'bothways', entry, rampAngle: 3,
                    by: 'by', z: 'z', feed: 2000, plunge: 150, clearance: 5 } },
            ] },
        ]));
        const ramp = prog('ramp');
        // the FINAL level's descent must start at the real previous floor (−3), not the nominal one (−2.5)
        const zs = ramp.split(NL).filter((l) => /^G0 Z-/.test(l)).map((l) => l.trim());
        return { ramp, zs, hasReal: /G0 Z-3\b/.test(ramp), hasNominal: /G0 Z-2\.5\b/.test(ramp) };
    });
    expect(r.hasReal, 'the clamped final level rapids to the REAL previous floor (−3), which only the scope knows').toBe(true);
    expect(r.hasNominal, '…and not to the nominal one (−2.5), which is where it used to start its ramp').toBe(false);
});
