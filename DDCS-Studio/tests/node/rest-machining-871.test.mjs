import { test, expect } from './support/harness.mjs';

/**
 * t871 — REST MACHINING (backlog item 9, Option A): a second SMALLER tool clears the corner material the first tool
 * couldn't reach. Rest = the corner slivers between the r1 and r2 fillets (rect + polygon only; smooth circle/ellipse
 * have no corners). Analytic cleared-region opening rings + the existing scanlineFill raster (masked to the corners).
 * A declared {restTool (tool-table picker), restStepover} appends a rest pass; unset = byte-identical.
 *
 * t871-drive.spec.js carries the two UI tests from the original file (form rendering, gating, and a canvas
 * screenshot) — they read `#wiz_user_form`/`#userVizContainer` DOM the node tier's stub document cannot produce.
 */

test('GEOMETRY: the rest region is the CORNER slivers per shape (corner count × fillet class); none for smooth shapes', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const M = await import('/wizards/ops/restmachining.js');
        const rr = (shape, extra) => M.restRegion({ shape, originX: 0, originY: 0, w: 80, h: 60, dia: 60, sides: 6, toolDia: 6, restDia: 3, restStepover: 40, wallOffset: 0, ...extra });
        const rect = rr('rect'), hex = rr('polygon'), circ = rr('circle'), ell = rr('ellipse');
        // the RIGHT-ANGLE sliver class = (1 − π/4)(r1² − r2²) for r1=3, r2=1.5
        const expectRectSliver = (1 - Math.PI / 4) * (3 * 3 - 1.5 * 1.5);
        return {
            rectCorners: rect && rect.corners, rectSliver: rect && rect.sliverAreaRightAngle, expectRectSliver,
            hexCorners: hex && hex.corners, circ, ell,
        };
    });
    expect(r.rectCorners, 'a rectangle pocket has 4 corners of rest').toBe(4);
    expect(r.hexCorners, 'a hexagon pocket has 6 corners of rest').toBe(6);
    expect(Math.abs(r.rectSliver - r.expectRectSliver), 'the per-corner sliver area = the hand-computed (1−π/4)(r1²−r2²) class').toBeLessThan(1e-6);
    expect(r.circ, 'a circle pocket has NO rest (smooth walls)').toBeNull();
    expect(r.ell, 'an ellipse pocket has NO rest (smooth walls)').toBeNull();
});

test('GREY-OUT with the honest WHY: r2 ≥ r1, and circle/ellipse (smooth), never emit rest', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const M = await import('/wizards/ops/restmachining.js');
        return {
            bigger: M.restGreyReason({ shape: 'rect', w: 80, h: 60, toolDia: 6, restDia: 8 }),   // r2 >= r1
            equal: M.restGreyReason({ shape: 'rect', w: 80, h: 60, toolDia: 6, restDia: 6 }),
            circle: M.restGreyReason({ shape: 'circle', dia: 50, toolDia: 6, restDia: 3 }),
            ellipse: M.restGreyReason({ shape: 'ellipse', w: 80, h: 60, toolDia: 6, restDia: 3 }),
            valid: M.restGreyReason({ shape: 'rect', w: 80, h: 60, toolDia: 6, restDia: 3 }),   // '' = valid
            undeclared: M.restGreyReason({ shape: 'rect', w: 80, h: 60, toolDia: 6, restDia: 0 }),
            validFlag: M.restValid({ shape: 'rect', w: 80, h: 60, toolDia: 6, restDia: 3 }),
            biggerInvalid: M.restValid({ shape: 'rect', w: 80, h: 60, toolDia: 6, restDia: 8 }),
        };
    });
    expect(r.bigger, 'r2 ≥ r1 → the why names the smaller-tool rule').toMatch(/smaller/i);
    expect(r.equal, 'r2 == r1 → greyed').toMatch(/smaller/i);
    expect(r.circle, 'circle → smooth-walls why').toMatch(/smooth|no rest/i);
    expect(r.ellipse, 'ellipse → smooth-walls why').toMatch(/smooth|no rest/i);
    expect(r.valid, 'a valid smaller tool on a rect → no grey reason').toBe('');
    expect(r.undeclared, 'no rest tool declared → no grey reason').toBe('');
    expect(r.validFlag).toBe(true);
    expect(r.biggerInvalid).toBe(false);
});

test('BYTE-IDENTITY: the pocket twin emit is UNCHANGED with no rest tool; the rest pass appears + grows the program when set', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        // node tier: builderOf('user_pocket_data') resolves via app.js's seedDefaultPortedUserOps(), which never
        // runs here — register the pocket data-twin explicitly (seeding pattern 2).
        const uo = await import('/blocks/userOps.js');
        const { pocketDataDef } = await import('/blocks/dataOps/pocketData.js');
        uo.registerUserOp(pocketDataDef());
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const em = (p) => emitMapped(builderOf('user_pocket_data')(p)).text;
        const base = { shape: 'rect', w: 80, h: 60, toolDia: 6, feed: 600, depth: 4, stepdown: 2 };
        const none = em(base);
        const set = em({ ...base, restTool: 2, restDia: 3, restStepover: 40 });
        const circ = { shape: 'circle', dia: 50, toolDia: 6, feed: 600, depth: 4, stepdown: 2 };
        return {
            unsetSame: none === em({ ...base, restDia: 0 }),
            restPresent: /REST — smaller tool/.test(set),
            grows: set.split('\n').length > none.split('\n').length,
            circleSame: em(circ) === em({ ...circ, restTool: 2, restDia: 3 }),   // circle → no rest even if declared
        };
    });
    expect(r.unsetSame, 'no rest tool → byte-identical emit (goldens untouched)').toBe(true);
    expect(r.restPresent, 'a valid rest tool → the rest section is emitted').toBe(true);
    expect(r.grows, 'the rest pass GROWS the program (estimate picks it up)').toBe(true);
    expect(r.circleSame, 'circle → no rest even if a rest tool is declared (byte-identical)').toBe(true);
});
