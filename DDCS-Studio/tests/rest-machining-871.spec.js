import { test, expect } from '@playwright/test';

/**
 * t871 — REST MACHINING (backlog item 9, Option A): a second SMALLER tool clears the corner material the first tool
 * couldn't reach. Rest = the corner slivers between the r1 and r2 fillets (rect + polygon only; smooth circle/ellipse
 * have no corners). Analytic cleared-region opening rings + the existing scanlineFill raster (masked to the corners).
 * A declared {restTool (tool-table picker), restStepover} appends a rest pass; unset = byte-identical.
 */
test.use({ viewport: { width: 1300, height: 950 } });

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

test('THE FORM + PREVIEW: the pocket twin renders the rest picker + Ø; a set rest tool draws the corner slivers (fc-rest)', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => window.openWiz('user_pocket_data', null, true));
    await page.waitForSelector('#wiz_user_form [data-param="restDia"]', { timeout: 8000 });
    // the rest tool picker + Ø render (tool-table integration)
    await expect(page.locator('#wiz_user_form [data-param="restTool"]')).toHaveCount(1);
    await expect(page.locator('#wiz_user_form [data-param="restDia"]')).toHaveCount(1);
    // set a smaller rest tool Ø → the layout draws rest regions distinctly (fc-rest)
    await page.evaluate(() => {
        const form = document.getElementById('wiz_user_form');
        const set = (p, v) => { const el = form.querySelector(`[data-param="${p}"]`); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
        set('toolDia', '6'); set('restDia', '3');
    });
    await page.waitForFunction(() => document.querySelectorAll('#userVizContainer .fc-rest, #wiz_user .fc-rest').length > 0, null, { timeout: 8000 });
    const restPaths = await page.evaluate(() => document.querySelectorAll('#wiz_user .fc-rest').length);
    expect(restPaths, 'the 2D layout draws the rest corner regions in the distinct fc-rest colour').toBeGreaterThan(0);
    await page.locator('#wiz_user').screenshot({ path: testInfo.outputPath('t871-rest-pocket.png') });
});

test('the rest fields GREY with the why on a smooth shape; the estimate (cut moves) grows with the rest pass', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => window.openWiz('user_pocket_data', null, true));
    await page.waitForSelector('#wiz_user_form [data-param="restDia"]', { timeout: 8000 });
    // GREYING: switch the shape to circle → the rest fields grey (disabled + data-op-gated) with the honest smooth-walls why
    const grey = await page.evaluate(async () => {
        const form = document.getElementById('wiz_user_form');
        const shp = form.querySelector('[data-param="shape"]'); shp.value = 'circle'; shp.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
        const rd = form.querySelector('[data-param="restDia"]');
        return { disabled: rd.disabled, gated: rd.getAttribute('data-op-gated'), tip: rd.title };
    });
    expect(grey.disabled, 'a circle pocket → the rest Ø field greys (disabled)').toBe(true);
    expect(grey.gated, 'the grey is op-gated (survives postGating)').toBe('on');
    expect(grey.tip, 'the grey carries the honest WHY (smooth walls)').toMatch(/smooth|no rest/i);
    // ESTIMATE: the rest pass adds cut (G1) moves — the time estimate is derived from these, so it grows
    const moves = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const g1 = (p) => (emitMapped(builderOf('user_pocket_data')(p)).text.match(/^G1 /gm) || []).length;
        const base = { shape: 'rect', w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 2 };
        return { none: g1(base), rest: g1({ ...base, restTool: 2, restDia: 3, restStepover: 40 }) };
    });
    expect(moves.rest, 'the rest pass adds cut moves → the run-time estimate grows').toBeGreaterThan(moves.none);
});
