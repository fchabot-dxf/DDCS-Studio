import { test, expect } from './support/harness.mjs';

/**
 * WIZARDS-AS-DATA — t2381: WCS's own section-metadata fix, ratcheted. wcsData.js's own `WCS_EXEC_BINDINGS`
 * used SECTION_RANK's canonical `GEOMETRY` for `sys`/`axisX`/`axisY`/`axisZ` — a name that happened to be
 * IN the whitelist, but not the shell's own real section (the shell (index.html:1196-1237) declares THREE:
 * `FEATURE CONTEXT` for the axis checkboxes, `WCS` for the system dropdown, `OPTIONS` for sync/slave — the
 * twin only had two, and `sys` sat in the wrong array position too). Fixed by reorder + resection, matching
 * the shell exactly. See wcsData.js's own header comment above `WCS_EXEC_BINDINGS` for the full account.
 *
 * TIER MIGRATION (batch 10): split out of tests/wcs-form-reproduction-2381.spec.js — this is the ONE test in
 * that 4-test file that reads `def.bindings` directly with zero DOM construction. The other 3 tests all build
 * or query a real DOM tree (`renderOpForm`+`querySelectorAll`, or a real page/wizard) and stay in
 * tests/wcs-form-reproduction-2381-drive.spec.js.
 */

const SHELL_SECTION_OF = {
    axisX: 'FEATURE CONTEXT', axisY: 'FEATURE CONTEXT', axisZ: 'FEATURE CONTEXT',
    sys: 'WCS',
    sync: 'OPTIONS', slave: 'OPTIONS',
};

test('wcs-form-reproduction: every binding\'s own section matches the shell\'s field-to-section mapping', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const dd = await import('/blocks/dataOps/wcsData.js');
        const def = dd.wcsDataDef();
        const bindings = def.bindings || [];
        const sectionOf = {};
        for (const b of bindings) sectionOf[b.param] = b.section || null;
        return { sectionOf, count: bindings.length };
    });

    expect(r.count, 'WCS has exactly 6 bindings today — a changed count is worth a fresh look at this spec').toBe(6);
    expect(r.sectionOf).toEqual(SHELL_SECTION_OF);
});
