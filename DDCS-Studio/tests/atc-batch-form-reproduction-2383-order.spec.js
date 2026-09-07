import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2383: THE ATC BATCH. Split from atc-batch-form-reproduction-2383.spec.js at the t2697
 * tier migration (batch 6). The pure "section matches" test per wizard moved to
 * tests/node/atc-batch-form-reproduction-2383.test.mjs; these stayed because they build a real DOM tree via
 * `renderOpForm` and read it back with `querySelectorAll('[data-param]')` — the node tier's structural-only
 * document can't fake that. See the moved file's own header for the full per-wizard shell-mapping account.
 */

const CASES = [
    {
        wiz: 'atc_warmup', mod: '/blocks/dataOps/atcWarmupData.js', fac: 'atcWarmupDataDef',
        expectedOrder: ['rpm1', 'time1', 'rpm2', 'time2'],
    },
    {
        wiz: 'atc_check', mod: '/blocks/dataOps/atcCheckData.js', fac: 'atcCheckDataDef',
        expectedOrder: ['blockHeight', 'safeZ', 'maxDist', 'retract', 'f_fast', 'f_slow', 'port', 'tolerance'],
    },
    {
        wiz: 'atc_length', mod: '/blocks/dataOps/atcLengthData.js', fac: 'atcLengthDataDef',
        expectedOrder: ['blockHeight', 'safeZ', 'maxDist', 'retract', 'f_fast', 'f_slow', 'port'],
    },
    {
        wiz: 'atc_table', mod: '/blocks/dataOps/atcTableData.js', fac: 'atcTableDataDef',
        expectedOrder: ['includeLengths', 'includePockets', '_setup'],
    },
    {
        wiz: 'atc_change', mod: '/blocks/dataOps/atcChangeData.js', fac: 'atcChangeDataDef',
        expectedOrder: ['_setup', 'method', 'callMacro', 'x', 'y', 'z', 'zClear', 'fixedT', 'orient'],
    },
    {
        wiz: 'atc_test', mod: '/blocks/dataOps/atcTestData.js', fac: 'atcTestDataDef',
        expectedOrder: ['mode', 'cycles', 'dwellMs', 'first', 'count', 'zClear', 'descend'],
    },
];

for (const c of CASES) {
    test(`${c.wiz}-form-reproduction: declared bindings place fields in the shell's own order (live DOM)`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        const fields = await page.evaluate(async ({ mod, fac }) => {
            const dd = await import(mod);
            const { formBindings, renderOpForm } = await import('/ui/formWidgets.js');
            const def = dd[fac]();
            const binds = formBindings(def);
            const host = document.createElement('div');
            document.body.appendChild(host);
            renderOpForm(host, binds);
            return [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
        }, { mod: c.mod, fac: c.fac });

        expect(fields).toEqual(c.expectedOrder);
    });
}
