import { test, expect } from '@playwright/test';

/**
 * t1942 — THE + ADD BUTTON, WIRED. The human's own Add-to-program ruling, on the real wizard-bar Insert door
 * (wizardManager.js:512): a NON-EMPTY canvas offers Add / Replace / Cancel; an EMPTY canvas commits straight
 * through with NO dialog, exactly as before t1938/t1942 ever touched this file — `confirmDestructiveLoad`'s own
 * silent-pass condition decides that, the ONE seam, never re-checked here. Add routes through `addOperation`
 * (t1940); Replace keeps today's behaviour (`commitActiveOp`). The 3rd choice is `ui/dialog.js`'s own declared
 * `dlgChoice` primitive, not a bespoke modal hand-rolled in wizardManager.js.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode
        && window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz);
}

async function insertDirect(page, opType) {
    // A plain insert with nothing on the canvas — no dialog, matches the silent-pass condition.
    await page.evaluate(async (t) => {
        window.openWiz(t, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    }, opType);
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.type === 'op'), { timeout: 8000 });
}

async function openWizNoInsert(page, opType) {
    await page.evaluate((t) => { window.openWiz(t, undefined, true); window.updateWiz(); }, opType);
}

test('EMPTY canvas: Insert commits with NO dialog at all — unchanged from before this turn', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);

    await openWizNoInsert(page, 'drill');
    await page.evaluate(() => window.insertWiz());   // awaited directly — must resolve with no dialog to click
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'drill'), { timeout: 8000 });
    expect(await page.evaluate(() => !!document.querySelector('.app-dialog')), 'no confirm raised for an empty canvas').toBe(false);
});

test('ADD: gives two operations on the canvas, with both bodies in the emitted G-code', async ({ page }) => {
    await boot(page);
    await insertDirect(page, 'drill');
    await openWizNoInsert(page, 'surfacing');

    await page.evaluate(() => { window.insertWiz(); });   // fire without awaiting — hangs on the confirm
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await expect(page.locator('.app-dialog')).toContainText('Your canvas already has');
    await page.click('.app-dialog button:has-text("Add as a 2nd operation")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));

    const r = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const ops = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return { opTypes: ops.map((b) => b.opType), nc: window.ddcsGetBlockGcode() };
    });
    expect(r.opTypes, 'both operations present, drill first then surfacing').toEqual(['drill', 'surfacing']);
    expect(r.nc.includes('DRILL'), 'the drill body is still in the emitted G-code').toBe(true);
    expect(r.nc.includes('SURFACING'), 'the surfacing body is in the emitted G-code too').toBe(true);
});

test('REPLACE: gives one operation, the previous one gone', async ({ page }) => {
    await boot(page);
    await insertDirect(page, 'drill');
    await openWizNoInsert(page, 'surfacing');

    await page.evaluate(() => { window.insertWiz(); });
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Replace it")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));

    const r = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const ops = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return { opTypes: ops.map((b) => b.opType), nc: window.ddcsGetBlockGcode() };
    });
    expect(r.opTypes, 'only surfacing remains — drill is gone').toEqual(['surfacing']);
    expect(r.nc.includes('DRILL'), 'the drill body is gone from the emitted G-code too').toBe(false);
});

test('CANCEL: leaves the program byte-identical, the wizard form stays open, nothing inserted', async ({ page }) => {
    await boot(page);
    await insertDirect(page, 'drill');
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());
    await openWizNoInsert(page, 'surfacing');

    await page.evaluate(() => { window.insertWiz(); });
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Cancel")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));

    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'Cancel leaves the G-code byte-identical').toBe(gcodeBefore);
    const opTypes = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        return progMod.flattenOps(window.ddcsGetBlockProgram() || []).map((b) => b.opType);
    });
    expect(opTypes, 'only the original drill remains — surfacing was never inserted').toEqual(['drill']);
    // the wizard's own shared overlay (#wizard, toggled by WizardManager.close()) is still visible — Cancel does
    // not close it, matching showBlockEditNotice's own established "if (choice === 'cancel') return" idiom.
    expect(await page.evaluate(() => document.getElementById('wizard').classList.contains('active')),
        'the wizard overlay is still open after Cancel').toBe(true);
});
