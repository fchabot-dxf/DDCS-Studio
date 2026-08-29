import { test, expect } from '@playwright/test';

/**
 * t2395 (BACKLOG #47 item 1) — `gotoTargetReport` (userOps.js) is the save-time backstop for the goto family's
 * new forward-authorable picker: the picker itself lets a typed number through even with no matching label YET
 * ("people place the jump before the label"), so this is what nets a target still unmatched once the whole
 * stack is built. ⛔ INFORMATIONAL ONLY — the dispatch's own explicit ruling ("verification INFORMS, it never
 * gates") means this must NEVER become a blocking save refusal the way `formfieldMatchReport` is; devMode.js's
 * own wiring surfaces it through a toast, save proceeds regardless.
 *
 * Proven non-vacuous here: a genuinely dangling target flags, a matched one (in EITHER array order — the
 * picker is forward-authorable, so match must be order-independent) does not, and a symbolic non-numeric
 * override (ifgoto's own documented case, t1581) is correctly out of scope.
 */
test('a goto to a nonexistent label flags', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    const report = await page.evaluate(async () => {
        const { gotoTargetReport } = await import('/blocks/userOps.js');
        return gotoTargetReport([{ type: 'goto', params: { n: 99 } }]);
    });
    expect(report.unmatched).toEqual([{ type: 'goto', field: 'n', target: 99 }]);
    expect(report.total).toBe(1);
    expect(report.matched).toBe(0);
});

test('a goto to a label declared in the SAME stack does not flag', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    const report = await page.evaluate(async () => {
        const { gotoTargetReport } = await import('/blocks/userOps.js');
        return gotoTargetReport([{ type: 'label', params: { n: 5 } }, { type: 'goto', params: { n: 5 } }]);
    });
    expect(report.unmatched).toEqual([]);
    expect(report.matched).toBe(1);
});

test('forward-authorable: the label may appear AFTER the goto in array order — still matches', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' );
    const report = await page.evaluate(async () => {
        const { gotoTargetReport } = await import('/blocks/userOps.js');
        return gotoTargetReport([{ type: 'goto', params: { n: 7 } }, { type: 'label', params: { n: 7 } }]);
    });
    expect(report.unmatched).toEqual([]);
});

test('every jump-family field is checked: ifgoto/probecheck/confirm/hmiconfirm, each its own field name', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    const report = await page.evaluate(async () => {
        const { gotoTargetReport } = await import('/blocks/userOps.js');
        return gotoTargetReport([
            { type: 'ifgoto', params: { goto: 1 } },
            { type: 'probecheck', params: { goto: 2 } },
            { type: 'confirm', params: { cancel: 3 } },
            { type: 'hmiconfirm', params: { cancel: 4 } },
        ]);
    });
    expect(report.total).toBe(4);
    expect(report.unmatched.map((u) => u.type).sort()).toEqual(['confirm', 'hmiconfirm', 'ifgoto', 'probecheck']);
});

test('a symbolic (non-numeric) ifgoto target is out of scope — never flagged', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    const report = await page.evaluate(async () => {
        const { gotoTargetReport } = await import('/blocks/userOps.js');
        return gotoTargetReport([{ type: 'ifgoto', params: { goto: 'SOME_SYMBOL' } }]);
    });
    expect(report.total).toBe(0);
    expect(report.unmatched).toEqual([]);
});
