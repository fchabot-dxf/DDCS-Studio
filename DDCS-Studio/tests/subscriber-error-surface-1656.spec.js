import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t1656 — a subscriber THROWING is isolated (one broken view must not take down every other view on a stack
 * change), but it must not be SILENT. `programModel.js`'s `setStack` wraps every `onChange` subscriber in
 * `try { fn(...) } catch (_) { }` — and `blocksApp.js`'s `renderFromModel` (the ONLY caller of
 * `stackToWorkspace`) is registered as exactly such a subscriber. That meant t1638's mouth-children guard and
 * t1654's durable-field guard BOTH fired correctly and were then silently discarded on this path — the guards
 * worked, and nobody ever saw it. The fix keeps the isolating `try/catch` (still just a `catch`, not a
 * `throw`-through) but reports what it caught via `console.error`, whose message + stack trace already names
 * the exact offending block/field (the guards' own error text), without adding a labelled-subscriber registry.
 */
const boot = async (page) => {
    await page.goto('/', { timeout: 30000 });
    await waitReady(page, () => window.ddcsGetBlockProgram && window.ddcsEditWizardDef);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await waitReady(page, () => !!window.__blkws);
};

test('t1654s durable-field guard surfaces via console.error on the REAL ddcsLoadBlockStack path (not just a direct stackToWorkspace call)', async ({ page }) => {
    test.setTimeout(60000);
    page.on('dialog', (d) => d.accept());
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await boot(page);

    await page.evaluate(async () => {
        const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
        const stack = parseGcodeToStack('G0 X10');
        stack[0].somethingNoOneDeclared = ['nope'];
        window.ddcsLoadBlockStack(stack);   // the REAL path — setStack -> subs.forEach -> renderFromModel -> stackToWorkspace
        await new Promise((res) => setTimeout(res, 500));
    });

    const hit = errors.find((e) => e.includes('recToJson') && e.includes('somethingNoOneDeclared'));
    expect(hit, 'the field-guard error reached the console, naming the offending field, instead of vanishing').toBeTruthy();
    expect(hit, 'the reported error identifies WHERE it came from (a subscriber, via the tagged prefix)').toContain('[programModel] a subscriber threw');
});

test('t1638s mouth-children guard ALSO surfaces via console.error on the REAL load path', async ({ page }) => {
    test.setTimeout(60000);
    page.on('dialog', (d) => d.accept());
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await boot(page);

    await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        BLOCKS['fake_mouthless_1656'] = { type: 'fake_mouthless_1656', label: 'fake', kind: 'fake_kind_1656', category: 'Move', defaults: {}, fields: [], emit: () => [] };
        window.Blockly.defineBlocksWithJsonArray([{ type: 'fake_mouthless_1656', message0: 'fake', args0: [], previousStatement: null, nextStatement: null }]);
        const badStack = [{ type: 'fake_mouthless_1656', id: 'f1', params: {}, children: [{ type: 'comment', id: 'c2', params: { text: 'lost' } }] }];
        window.ddcsLoadBlockStack(badStack);
        await new Promise((res) => setTimeout(res, 500));
    });

    const hit = errors.find((e) => e.includes('recToJson') && e.includes('declares no `mouth`'));
    expect(hit, 'the mouth-guard error reached the console too — the SAME fix covers both guards, one seam').toBeTruthy();
});

test('ISOLATION HOLDS: a throwing subscriber does not stop other subscribers, and the app recovers cleanly on the next load', async ({ page }) => {
    test.setTimeout(60000);
    page.on('dialog', (d) => d.accept());
    await boot(page);

    const r = await page.evaluate(async () => {
        const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
        const { onChange } = await import('/blocks/programModel.js');
        let canaryRan = 0;
        onChange(() => { canaryRan++; });

        const before = canaryRan;
        const badStack = parseGcodeToStack('G0 X10');
        badStack[0].somethingNoOneDeclared = ['nope'];
        window.ddcsLoadBlockStack(badStack);
        await new Promise((res) => setTimeout(res, 500));
        const afterBad = canaryRan;

        const goodStack = parseGcodeToStack('G0 X20');
        window.ddcsLoadBlockStack(goodStack);
        await new Promise((res) => setTimeout(res, 500));
        const afterGood = canaryRan;

        return { before, afterBad, afterGood, goodEmit: window.ddcsGetBlockGcode(), editorText: document.getElementById('editor').value };
    });
    expect(r.afterBad, 'a different subscriber still ran even while the blocksApp subscriber threw for the bad stack').toBeGreaterThan(r.before);
    expect(r.afterGood, 'subscribers keep firing normally on a LATER, good load — one throw does not wedge the fan-out').toBeGreaterThan(r.afterBad);
    expect(r.goodEmit, 'the app is fully usable again on the next good load — no lasting breakage from the earlier throw').toBe('G0 X20');
    expect(r.editorText).toBe('G0 X20');
});
