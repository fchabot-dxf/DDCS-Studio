import { test, expect } from '@playwright/test';

/**
 * WCS POST-GATING (t475) — honest per-post gating of the WCS wizard form, caps-driven (the probePort pattern). The advisor
 * rulings: auto-mode = M350-only (gate the Active-WCS option on non-M350); the fixed WCS-number = meaningless on v41/dm500
 * G92 (gate G54-59 there); sync = M350-only (gate w_sync/w_slave on non-M350). VERIFY the greying per post + screenshot.
 */
test.use({ viewport: { width: 1280, height: 900 } });
test('WCS form gates auto/WCS-number/sync per post (M350 all on; rs274 fixed only; v41 G92 no picker)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('wcs'));
    await page.waitForSelector('#wiz_wcs', { state: 'visible', timeout: 8000 });

    const gateFor = async (id) => page.evaluate(async (postId) => {
        const { setActivePostId } = await import('/wizards/dialects/index.js');   // rs274/grbl aren't PROFILES — set the active POST override
        const { applyPostGating } = await import('/ui/postGating.js');
        setActivePostId(postId);
        applyPostGating();
        const wsys = document.getElementById('w_sys');
        const opt = (v) => [...wsys.options].find((o) => o.value === v);
        return {
            sysDisabled: wsys.disabled,
            autoOptDisabled: opt('0').disabled,
            g54Disabled: opt('54').disabled,
            syncDisabled: document.getElementById('w_sync').disabled,
            slaveDisabled: document.getElementById('w_slave').disabled,
        };
    }, id);

    const m350 = await gateFor('ddcs-expert-m350');
    const v41 = await gateFor('ddcs-v41');
    const rs274 = await gateFor('rs274ngc');   // rs274 last → the screenshot shows partial gating (auto+sync greyed, fixed G54 live) + the G10 preview
    await page.evaluate(() => { const x = document.getElementById('w_x'); if (x) { x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); } });   // refresh the preview under the active post
    await page.waitForTimeout(150);
    await page.locator('#wiz_wcs').screenshot({ path: 'scratchpad/wcs_gating.png' });
    // restore the default post ('auto') + M350 gating for other specs
    await page.evaluate(async () => { const { setActivePostId } = await import('/wizards/dialects/index.js'); const { applyPostGating } = await import('/ui/postGating.js'); setActivePostId('auto'); applyPostGating(); });
    console.log('WCS GATING: M350=' + JSON.stringify(m350) + ' rs274=' + JSON.stringify(rs274) + ' v41=' + JSON.stringify(v41));

    // M350 — everything on
    expect(m350.autoOptDisabled, 'M350: auto WCS enabled').toBe(false);
    expect(m350.g54Disabled, 'M350: G54 enabled').toBe(false);
    expect(m350.syncDisabled, 'M350: sync enabled').toBe(false);
    // rs274 — fixed WCS only (G10 L20 P<n>): auto gated, G54 enabled, sync gated
    expect(rs274.autoOptDisabled, 'rs274: auto WCS gated (M350-only)').toBe(true);
    expect(rs274.g54Disabled, 'rs274: fixed G54 enabled (G10 L20 P1)').toBe(false);
    expect(rs274.syncDisabled, 'rs274: sync gated (M350-only)').toBe(true);
    // v41 — G92 ignores the WCS number: the whole picker inert + sync gated
    expect(v41.sysDisabled, 'v41: the WCS picker is inert (G92 zeroes the active frame)').toBe(true);
    expect(v41.syncDisabled, 'v41: sync gated').toBe(true);
});
