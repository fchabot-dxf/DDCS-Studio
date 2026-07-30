import { test, expect } from '@playwright/test';

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
