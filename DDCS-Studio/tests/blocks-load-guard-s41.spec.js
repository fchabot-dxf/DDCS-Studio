import { test, expect } from '@playwright/test';

/**
 * S4-1 — the SHARED destructive-load guard (saveStates.confirmDestructiveLoad), wired into ddcsEditWizardDef (and the
 * future CAM-slot Edit path — S4-2). Opening an op in Blocks REPLACES the current program; when the program is
 * NON-EMPTY the guard CONFIRMS before replacing, so the user never loses visible work SILENTLY. Cancel KEEPS the
 * program (no load); an EMPTY / identical program → no prompt. The confirm is the IN-APP dialog (.app-dialog,
 * dlgConfirm) — NOT a native browser dialog. This fixes the latent silent-wipe editWizardDef had (it replaced the
 * program with no confirm).
 *
 * NOTE (t1145): the guard also snapshots the current program (best-effort), but the message promises CANCEL — not
 * Undo — because the program-level Undo does not reliably restore a programmatically-loaded prior program (measured).
 * So this spec asserts the guard's real contract (confirm / Cancel-keeps / OK-loads / empty-no-prompt), not undo.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const dialogOpen = (page) => page.evaluate(() => !!document.querySelector('.app-dialog'));

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.showApp && window.ddcsRefreshWizardBar);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        const template = [{ type: 'move', params: { x: 1, y: 2, z: -3 } }];
        U.createUserOp(U.userOpFromStack('guard', 'Guard Op', template, U.extractParamBlocks(template)));
        window.ddcsRefreshWizardBar();
    });
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram, { timeout: 8000 });
}

test('non-empty program: Edit-to-Blocks CONFIRMS; Cancel KEEPS the program (no silent wipe), OK loads the op', async ({ page }) => {
    await boot(page);
    // seed a NON-EMPTY program that is NOT the op (a loose atom) — the visible work we must not silently wipe
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 9, y: 9, z: 9 } }]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length > 0);
    const progBefore = await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram()));

    // FIRE without awaiting (editWizardDef awaits the confirm) → the in-app confirm must appear
    await page.evaluate(() => { window.ddcsEditWizardDef('user_guard'); });
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await expect(page.locator('.app-dialog')).toBeVisible();

    // CANCEL → the program is UNCHANGED (not replaced by the op) — the guaranteed protection
    await page.click('.app-dialog button:has-text("Cancel")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
    expect(await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram())),
        'Cancel keeps the current program (no silent wipe)').toBe(progBefore);
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op')),
        'the op was NOT loaded after Cancel').toBe(false);

    // RE-FIRE + OK → the guard passes the legit flow through: the op is loaded (replaces the program)
    await page.evaluate(() => { window.ddcsEditWizardDef('user_guard'); });
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Open (replace)")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op'), { timeout: 8000 });
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op')),
        'OK loaded the op into Blocks (the guard does not block the legit flow)').toBe(true);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('empty program: NO prompt — the op loads directly (the guard fires only when there is work to lose)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);

    // FIRE the edit → NO confirm should appear; the op loads straight in
    await page.evaluate(() => { window.ddcsEditWizardDef('user_guard'); });
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op'), { timeout: 8000 });
    expect(await dialogOpen(page), 'no confirm raised for an empty program').toBe(false);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
