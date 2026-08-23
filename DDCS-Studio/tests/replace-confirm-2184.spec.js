import { test, expect } from '@playwright/test';

/**
 * t2184 (amendments 21-23) — "am I really going to lose something?" (the human's own question). Workspace Open
 * (ui/workspaceManager.js's confirmDiscardBuffer) used to gate ONLY on isWorkspaceDirtyToFile() — the
 * WORKSPACE's own file-dirty signal — which does not account for the fact that opening a workspace RELOADS THE
 * PAGE, also wiping any unsaved PROGRAM content even when the workspace itself reads clean. Fixed via a shared
 * predicate (blocks/saveStates.js's wouldLoseWork()) asking BOTH halves for Workspace Open, reused by G-code
 * Open / Project Open (already routed through the SAME seam, confirmDestructiveLoad, for the program half).
 *
 * t2186 — the SAME predicate closes a third gap the t2184 sweep found and reported rather than fixed: raw/
 * marker-free G-code loads bypassed the confirm entirely (commandDeck.js's loadGcodeFile fallback branch).
 *
 * TWO-SIDED on purpose (amendment 22's own instruction: "one-sided tests are how the fix drifts back") — silent
 * when there's nothing to lose, present when there is, both asserted, never just one.
 */
async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

// t2184 — confirmDiscardBuffer only fires from openWorkspaceObject, which runs when a SPECIFIC workspace row is
// opened from the granted-folder list inside the manager modal — not from the wsOpen quick-action itself (that
// only opens the manager, focused on its "open" half). Driving a real granted-folder row needs a File System
// Access mock this repo doesn't have for this surface, so these tests call the exported gate directly — the
// exact function this turn's fix changed, without needing the full open-a-real-file UI flow around it.
async function callConfirmDiscardBuffer(page) {
    return page.evaluate(async () => {
        const m = await import('/ui/workspaceManager.js');
        return m.confirmDiscardBuffer('a workspace');
    });
}

test('SILENT: confirmDiscardBuffer on a fresh, empty, untouched boot — nothing to lose', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(2500);   // let the watermark-settle poll finish (fileSaveState.js)
    const proceed = await callConfirmDiscardBuffer(page);
    expect(proceed, 'resolves true immediately, no dialog — the canvas is empty and the workspace is untouched').toBe(true);
});

test('PRESENT: confirmDiscardBuffer with real unsaved PROGRAM content, even if the workspace itself reads clean', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: -1, mode: 'rapid' } }], simChildren: [] }]));
    // the workspace's OWN dirty signal is unaffected by program content (data/backup.js's own scope) — this
    // is exactly the case the old isWorkspaceDirtyToFile()-only gate would have missed.
    const workspaceDirty = await page.evaluate(() => window.ddcsFileSaveState.isDirty());
    expect(workspaceDirty, 'sanity: the workspace itself reads clean here — only the program changed').toBe(false);

    // call it (don't await the resolution — it stays pending until the dialog answers)
    const pending = callConfirmDiscardBuffer(page);
    await expect(page.locator('.wsm-3way'), 'prompt fires — the program has real, unsaved content the reload would wipe').toBeVisible({ timeout: 3000 });
    await page.locator('.wsm-3way [data-w3="cancel"]').click();
    expect(await pending, 'Cancel resolves false').toBe(false);
});

test('PRESENT: confirmDiscardBuffer with real unsaved WORKSPACE content (a settings change), even on an empty canvas', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.openSettings && window.openSettings({ group: 'lookfeel', panel: 'set_tab_appearance' }));
    await page.waitForSelector('#set_theme', { timeout: 6000 });
    await page.selectOption('#set_theme', 'organic');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const workspaceDirty = await page.evaluate(() => window.ddcsFileSaveState.isDirty());
    expect(workspaceDirty, 'sanity: the settings change marked the workspace dirty').toBe(true);

    const pending = callConfirmDiscardBuffer(page);
    await expect(page.locator('.wsm-3way'), 'prompt fires — the workspace itself has unsaved content').toBeVisible({ timeout: 3000 });
    await page.locator('.wsm-3way [data-w3="cancel"]').click();
    expect(await pending).toBe(false);
});

test('SILENT vs PRESENT — G-code Open (confirmDestructiveLoad, the marker-based path) on the same two-sided bar', async ({ page }) => {
    await ready(page);
    // empty canvas: wouldLoseWork() returns false on its own, no dialog import needed to prove it
    const emptyResult = await page.evaluate(async () => {
        const { confirmDestructiveLoad } = await import('/blocks/saveStates.js');
        return confirmDestructiveLoad([{ type: 'op', opType: 'pocket' }]);
    });
    expect(emptyResult, 'silent (returns true with no dialog) — nothing on the canvas to lose').toBe(true);

    // real content: loading a genuinely DIFFERENT stack over it must ask
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'drill', label: 'Drill', params: {}, children: [], simChildren: [] }]));
    const dialogPromise = page.evaluate(async () => {
        const { confirmDestructiveLoad } = await import('/blocks/saveStates.js');
        return confirmDestructiveLoad([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {} }]);
    });
    await expect(page.locator('.app-dialog, [role="dialog"]').first(), 'a real dialog appears — real, different content would be lost').toBeVisible({ timeout: 3000 });
    // cancel it so the evaluate() promise resolves and the test can finish cleanly
    await page.keyboard.press('Escape');
    await dialogPromise;
});

// t2186 — raw/marker-free G-code loads (commandDeck.js's loadGcodeFile, the fallback branch — files with no
// `( @DDCS:… )` markers) used to bypass the confirm ENTIRELY: `ed.value = text` with no guard at all, silently
// destroying unsaved work. The only door in (Insert was deleted at t2173). Fixed via the SAME wouldLoseWork()
// predicate the marker path already used through confirmDestructiveLoad — not a second check.
async function pickRawFile(page, name, text) {
    await page.evaluate(({ name, text }) => {
        window.loadGcodeFile();
        const input = document.getElementById('gcode-file-input');
        const file = new File([text], name, { type: 'text/plain' });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { name, text });
}

test('SILENT: raw G-code Load on an empty canvas — loads immediately, no dialog', async ({ page }) => {
    await ready(page);
    await pickRawFile(page, 'raw1.nc', 'G90\nG0 X0 Y0\nG1 Z-1 F100\n');
    await page.waitForTimeout(400);
    await expect(page.locator('.app-dialog, [role="dialog"]'), 'no dialog — nothing on the canvas to lose').toHaveCount(0);
    const val = await page.evaluate(() => document.getElementById('editor').value);
    expect(val, 'the file actually loaded').toContain('G1 Z-1');
});

test('PRESENT: raw G-code Load with real unsaved program content — asks first', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: -1, mode: 'rapid' } }], simChildren: [] }]));
    await page.waitForTimeout(300);
    await pickRawFile(page, 'raw2.nc', 'G90\nG0 X10 Y10\n');
    await expect(page.locator('.app-dialog, [role="dialog"]').first(), 'prompt fires — real, unsaved content would be lost').toBeVisible({ timeout: 3000 });
});
