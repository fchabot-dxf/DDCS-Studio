import { test, expect } from '@playwright/test';

/**
 * t846 — DRILL PATTERNS (bolt circle / row / grid) as first-class drill+bore options. GROUND-FIRST finding: the pattern
 * system was ALREADY built (patternPoints: circle/line/grid/rect; the array container stamps the hole at each point; the
 * drill+bore twins share it; drillPatternGeometry draws every hole + drag handles + a drag-translate pos handle). This turn
 * ADDS a SINGLE option and VERIFIES the patterns numerically + the layout/drag-translate/bore-share/time-estimate.
 */
const pp = (page, p) => page.evaluate(async (p) => (await import('/wizards/ops/array.js')).patternPoints(p), p);
const geo = (page, p, bore) => page.evaluate(async ({ p, bore }) => {
    const g = (await import('/blocks/dataOps/drillData.js')).drillPatternGeometry(p, bore);
    return { nHoles: g.paths.length, handleIds: g.handles.map((h) => h.id) };
}, { p, bore });

test.use({ viewport: { width: 1400, height: 1000 } });   // two-pane wizard → the pattern cluster shows in the form pane
test.beforeEach(async ({ page }) => { await page.goto('http://localhost:3211'); await page.waitForFunction(() => window.ddcsStudio && window.openWiz); });

test('BOLT CIRCLE positions == hand-computed trig (incl. startAngle)', async ({ page }) => {
    const got = await pp(page, { pattern: 'circle', cx: 10, cy: 20, dia: 100, count: 6, startAngle: 30 });
    expect(got.length).toBe(6);
    const cx = 10, cy = 20, R = 50, a0 = 30 * Math.PI / 180;
    for (let k = 0; k < 6; k++) {
        const a = a0 + k * 2 * Math.PI / 6;
        expect(got[k].x, `hole ${k} x`).toBeCloseTo(cx + R * Math.cos(a), 3);
        expect(got[k].y, `hole ${k} y`).toBeCloseTo(cy + R * Math.sin(a), 3);
    }
});

test('ROW (line) positions == hand-computed (count·spacing along the angle)', async ({ page }) => {
    const got = await pp(page, { pattern: 'line', x0: 5, y0: 5, count: 4, spacing: 15, angle: 90 });   // along +Y
    expect(got.map((p) => [p.x, p.y])).toEqual([[5, 5], [5, 20], [5, 35], [5, 50]]);
});

test('GRID positions == hand-computed corners', async ({ page }) => {
    const got = await pp(page, { pattern: 'grid', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 25 });
    expect(got.length).toBe(6);
    const has = (x, y) => got.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
    for (const [x, y] of [[0, 0], [40, 0], [0, 25], [40, 25]]) expect(has(x, y), `corner ${x},${y}`).toBe(true);
});

/**
 * t1385 — RESTATED FROM A BYTE-GOLDEN TO A MOVE-GOLDEN, and the change is forced by the switch rather than chosen.
 *
 * This used to assert that SINGLE and a 1x1 GRID emit the same BYTES. That held while the pattern was walked at BUILD
 * time: both stamped one literal hole at the same point, so the text was identical. `holecycle` walks the pattern at
 * RUNTIME, so the two now emit different ARITHMETIC for the same lone point — `single` writes `ox=0 / oy=0`, the grid
 * writes a FIX division for the row and column. Same hole, same motion, different words.
 *
 * The claim worth keeping is the one about the MACHINE, so it is asserted the way the whole drill arc asserts things
 * (since t1329): the traced moves must be identical. A byte comparison here would now be testing how the pattern is
 * SPELLED, which is exactly what the parametric family is allowed to change.
 */
test('SINGLE = exactly one hole, and it MOVES identically to a 1×1 grid at the same spot', async ({ page }) => {
    const single = await pp(page, { pattern: 'single', x0: 7, y0: 8 });
    expect(single).toEqual([{ x: 7, y: 8 }]);
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const base = { toolDia: 6, holeDia: 6, depth: 10, peck: 3, x0: 7, y0: 8 };
        const R = (n) => (+Number(n).toFixed(3)) + 0;   // normalise -0 (an expression can land on negative zero)
        const moves = (t) => (traceToolpath(t).segments || []).map((s) => ({ x: R(s.x2), y: R(s.y2), z: R(s.z2), f: R(s.feed || 0), r: !!s.rapid }));
        const single = emitMapped(drillStack({ ...base, pattern: 'single' })).text;
        const grid1 = emitMapped(drillStack({ ...base, pattern: 'grid', cols: 1, rows: 1 })).text;
        const ms = moves(single), mg = moves(grid1);
        return { sameMoves: JSON.stringify(ms) === JSON.stringify(mg), n: ms.length, cuts: ms.filter((m) => !m.r).length };
    });
    expect(r.n, 'the body really traced (not an empty program compared to another empty one)').toBeGreaterThan(3);
    expect(r.cuts, 'and it really cuts').toBeGreaterThan(0);
    expect(r.sameMoves, 'single and a 1×1 grid drive the machine identically (t1385: was a byte-golden)').toBe(true);
});

test('the LAYOUT draws N holes + the drag-translate pos handle (per pattern)', async ({ page }) => {
    const circle = await geo(page, { pattern: 'circle', originX: 0, originY: 0, dia: 80, count: 8, startAngle: 0 });
    expect(circle.nHoles, 'bolt circle draws 8 holes').toBe(8);
    expect(circle.handleIds, 'a drag-translate pos handle + the Ø size handle').toEqual(expect.arrayContaining(['dr_pos', 'dr_ring']));
    const grid = await geo(page, { pattern: 'grid', originX: 0, originY: 0, cols: 4, rows: 3, dx: 10, dy: 10 });
    expect(grid.nHoles, 'grid draws 12 holes').toBe(12);
    expect(grid.handleIds).toEqual(expect.arrayContaining(['dr_pos', 'dr_grid']));
});

test('DRAG-TRANSLATE moves every hole rigidly; the shape is untouched', async ({ page }) => {
    const p = { pattern: 'circle', dia: 100, count: 6, startAngle: 30 };
    const at = (ox, oy) => pp(page, { ...p, cx: ox, cy: oy, x0: ox, y0: oy });   // the pos handle writes originX/originY → cx/cy
    const a = await at(0, 0), b = await at(25, -10);
    expect(b.length).toBe(a.length);
    for (let k = 0; k < a.length; k++) {   // every hole shifted by exactly (25, −10)
        expect(b[k].x - a[k].x, `hole ${k} dx`).toBeCloseTo(25, 3);
        expect(b[k].y - a[k].y, `hole ${k} dy`).toBeCloseTo(-10, 3);
    }
});

test('BORE shares the pattern: bore hole positions == drill hole positions', async ({ page }) => {
    const p = { pattern: 'grid', originX: 5, originY: 5, cols: 3, rows: 2, dx: 12, dy: 18 };
    const drill = await geo(page, p, false), bore = await geo(page, p, true);
    expect(bore.nHoles, 'bore stamps the same hole count as drill').toBe(drill.nHoles);
    // bore also gets a hole-Ø handle (dr_dia); both share dr_pos
    expect(bore.handleIds).toEqual(expect.arrayContaining(['dr_pos', 'dr_grid', 'dr_dia']));
});

test('the TIME ESTIMATE grows with the hole count (the multiplied positions flow through for free)', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { estimateProgram } = await import('/engine/timeEstimate.js');
        const base = { toolDia: 6, holeDia: 6, depth: 10, peck: 3, pattern: 'circle', dia: 100, startAngle: 0 };
        const few = estimateProgram(emitMapped(drillStack({ ...base, count: 3 })).text, {}).seconds;
        const many = estimateProgram(emitMapped(drillStack({ ...base, count: 12 })).text, {}).seconds;
        return { few, many };
    });
    expect(r.many, '12 holes take longer than 3').toBeGreaterThan(r.few);
});

test('FORM: the drill twin renders the pattern cluster (screenshots per pattern)', async ({ page }, testInfo) => {
    await page.evaluate(() => window.openWiz('user_drill_data'));
    await page.waitForSelector('#wizard', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    // The form carries the pattern cluster: a Pattern dropdown (Single/Grid/Bolt circle/Row/Rectangle) + the per-pattern
    // when-gated params. (The dropdown is a custom widget over a hidden <select>, so we assert on the rendered text.)
    const wiz = page.locator('#wizard');
    await expect(wiz, 'the pattern field is in the form').toContainText('pattern');
    await expect(wiz, 'the bolt-circle option is offered').toContainText('Bolt circle');
    await page.locator('#wizard').screenshot({ path: testInfo.outputPath('drill-form.png') });
});
