import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2381: WCS's own section-metadata fix, ratcheted. See the sibling
 * tests/node/wcs-form-reproduction-2381.test.mjs for the section-mapping test (pure, moved to the node tier
 * at tier-migration batch 10) and its own full header comment on the fix.
 *
 * The three tests below all construct or query a real DOM tree (`renderOpForm`+`querySelectorAll`, or a real
 * opened wizard page) — none convert to the node tier's structural-only `document` stub.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const EXPECTED_ORDER = ['axisX', 'axisY', 'axisZ', 'sys', 'sync', 'slave'];

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
