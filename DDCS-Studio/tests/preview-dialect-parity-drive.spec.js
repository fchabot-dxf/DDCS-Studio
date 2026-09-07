import { test, expect } from '@playwright/test';

/**
 * PREVIEW DIALECT PARITY (t634). See tests/node/preview-dialect-parity.test.mjs for the pure sibling (byte-level
 * parity across posts) and this file's own header there. This one drives the real wizard preview panel DOM and
 * stays in the browser tier.
 */
test.use({ viewport: { width: 1300, height: 950 } });

test('REAL-SYMPTOM: the edge wizard preview panel shows the V4.1 emit (no #1925), then Expert (with #1925)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.openWiz);

    // V4.1 active → open the edge wizard → the preview code panel shows the V4.1 emit. t1730 — 'edge' opens the twin
    // now (its coded view is retired); '#wiz_user'/'#wiz_user_code' are the shared twin panel/code element.
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-v41'); });
    await page.evaluate(() => window.openWiz('user_edge_data'));
    await page.waitForSelector('#wiz_user_code', { timeout: 8000 });
    await page.waitForFunction(() => (document.getElementById('wiz_user_code')?.textContent || '').length > 20, null, { timeout: 8000 });
    const v41Panel = await page.evaluate(() => document.getElementById('wiz_user_code').textContent || '');
    expect(v41Panel, 'the V4.1 edge preview panel has NO Expert #1925 register').not.toContain('#1925');
    await page.screenshot({ path: 'scratchpad/preview-v41.png' });

    // switch to Expert → the panel re-renders with the Expert emit (#1925 back)
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForFunction(() => (document.getElementById('wiz_user_code')?.textContent || '').includes('#1925'), null, { timeout: 8000 });
    const expertPanel = await page.evaluate(() => document.getElementById('wiz_user_code').textContent || '');
    expect(expertPanel, 'the Expert edge preview panel uses #1925').toContain('#1925');
    expect(expertPanel, 'the panel actually changed between posts').not.toBe(v41Panel);
    await page.screenshot({ path: 'scratchpad/preview-expert.png' });
});
