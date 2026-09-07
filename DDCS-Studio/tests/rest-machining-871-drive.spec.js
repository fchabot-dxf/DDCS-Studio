import { test, expect } from '@playwright/test';

/**
 * t871 — REST MACHINING (backlog item 9, Option A). The two UI tests from the original rest-machining-871.spec.js:
 * they open the real pocket wizard form, read/mutate its DOM, and read the rendered canvas layout — none of which
 * the node tier's structural-only `document` stub can produce. The pure geometry/emit tests moved to
 * tests/node/rest-machining-871.test.mjs.
 */
test.use({ viewport: { width: 1300, height: 950 } });

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
