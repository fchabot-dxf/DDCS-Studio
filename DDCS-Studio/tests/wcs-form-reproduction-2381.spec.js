import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2381: WCS's own section-metadata fix, ratcheted. wcsData.js's own `WCS_EXEC_BINDINGS`
 * used SECTION_RANK's canonical `GEOMETRY` for `sys`/`axisX`/`axisY`/`axisZ` — a name that happened to be
 * IN the whitelist, but not the shell's own real section (the shell (index.html:1196-1237) declares THREE:
 * `FEATURE CONTEXT` for the axis checkboxes, `WCS` for the system dropdown, `OPTIONS` for sync/slave — the
 * twin only had two, and `sys` sat in the wrong array position too (first, when the shell puts the axis
 * checkboxes first)). Fixed the same way as t2375's contour fix: reorder + resection, matching the shell
 * exactly. See wcsData.js's own header comment above `WCS_EXEC_BINDINGS` for the full account.
 *
 * ⛔ NOT registered on `tests/support/formReproduction.js`'s shared engine: that engine's own "wording" test
 * compares RENDERED `.form-sec-title` chrome against the shell — but `formWidgets.js`'s own `sectionize` gate
 * (`SECTION_THRESHOLD = 8`) means a form with ≤8 rows NEVER renders section fold chrome at all, by design
 * ("a short form doesn't need folding"). WCS has exactly 6 bindings — below threshold — so its own section
 * BOXES never render live, even though every binding's own `section:` value is correct. Comparing DOM section
 * titles would produce a FALSE NEGATIVE (the shell's static HTML shows 3 section-label spans unconditionally;
 * the twin's dynamic chrome shows none, correctly, per its own documented threshold rule) — not a real defect
 * to chase. This spec instead verifies the DECLARATION directly (every binding's own `section:` property) against
 * the shell's own field-to-section mapping, plus field ORDER via the live DOM (order is real regardless of
 * whether the chrome boxes around it render) — the axis this turn's fix actually owns.
 */

const SHELL_SECTION_OF = {
    axisX: 'FEATURE CONTEXT', axisY: 'FEATURE CONTEXT', axisZ: 'FEATURE CONTEXT',
    sys: 'WCS',
    sync: 'OPTIONS', slave: 'OPTIONS',
};
const EXPECTED_ORDER = ['axisX', 'axisY', 'axisZ', 'sys', 'sync', 'slave'];

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

test('wcs-form-reproduction: declared bindings place fields in the shell\'s own order (live DOM)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const fields = await page.evaluate(async () => {
        const dd = await import('/blocks/dataOps/wcsData.js');
        const { formBindings, renderOpForm } = await import('/ui/formWidgets.js');
        const def = dd.wcsDataDef();
        const binds = formBindings(def);
        const host = document.createElement('div');
        document.body.appendChild(host);
        renderOpForm(host, binds);
        return [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
    });

    expect(fields).toEqual(EXPECTED_ORDER);
});

test('wcs-form-reproduction: the shell\'s own live field order matches the declared order (independent check)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('wcs'));
    await page.waitForSelector('#wiz_wcs', { state: 'visible' });

    const shellFields = await page.evaluate(() => {
        const root = document.querySelector('#wiz_wcs');
        return [...root.querySelectorAll('[id^="w_"]')]
            .filter((el) => el.offsetParent !== null && (el.tagName === 'INPUT' || el.tagName === 'SELECT'))
            .map((el) => el.id);
    });

    // shell ids (w_x/w_y/w_z/w_sys/w_sync/w_slave) map 1:1 to the twin's own param names, same order.
    expect(shellFields).toEqual(['w_x', 'w_y', 'w_z', 'w_sys', 'w_sync', 'w_slave']);
});

test('wcs-form-reproduction: an edit in the declared form reaches the op model and comes back', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const dd = await import('/blocks/dataOps/wcsData.js');
        const { formBindings, renderOpForm } = await import('/ui/formWidgets.js');
        const { wcsStack } = await import('/wizards/wcsWizard.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');

        const def = dd.wcsDataDef();
        const dataBuilder = builderOf(dd.WCS_DATA_OPTYPE);
        const binds = formBindings(def);
        const host = document.createElement('div');
        document.body.appendChild(host);
        const readers = renderOpForm(host, binds) || [];

        const before = {};
        for (const read of readers) Object.assign(before, read());

        const editInput = host.querySelector('[data-param="sys"]');
        editInput.value = '55';
        editInput.dispatchEvent(new Event('input', { bubbles: true }));
        editInput.dispatchEvent(new Event('change', { bubbles: true }));

        const after = {};
        for (const read of readers) Object.assign(after, read());

        const emitParams = { ...dd.WCS_DEFAULTS, ...after };
        const eq = emitEquivalence(wcsStack, dataBuilder, [emitParams]);

        return { beforeVal: before.sys, afterVal: after.sys, eqPass: eq.pass, firstDiff: eq.firstDiff };
    });

    expect(r.beforeVal).toBe('0');
    expect(r.afterVal).toBe('55');
    expect(r.eqPass).toBe(true);
});
