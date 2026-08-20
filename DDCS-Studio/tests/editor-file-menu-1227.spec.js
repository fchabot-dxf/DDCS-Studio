import { test, expect } from '@playwright/test';

/**
 * t1227 — THE CURATION (all user-ruled), REVERSED BY t2078 for three of the four actions.
 *
 * t1227: Load / Insert / Export / Clear act on the PROGRAM IN THE EDITOR, so they left the header quick menu
 * (where you look for app-level things) for the editor pane's own corner menu.
 *
 * t2099 — t2078 (human: "the load insert export button can go in the quick menu") reversed the Load/Insert/
 * Export half: the editor's own corner file button/menu (#editor-file-btn / #editor-file-menu) is RETIRED
 * entirely, not relocated — those three are back in the quick menu, the human's own refinement of t1227's
 * rule ("act on the program AS A WHOLE", never mid-edit, so they fall on the app side of it after all). Clear
 * alone stayed OUT of the quick menu (t1255) and lives in the editor's own toolbar row (`#btn-clear`) instead
 * of either menu. Same handlers throughout — only which door reaches them changed. The authoritative source
 * for the current shape is `editor-toolbar-2078.spec.js`; these tests are updated to match it rather than
 * duplicate it, while keeping the ordered-click-through coverage that spec doesn't do.
 *
 * Also here: the workspace manager's Browse… escape is gone (the granted folder is the ONE way in), and Duplicate…
 * does not appear before there is a file to duplicate.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.ddcsEditorFileMenu && window.openWorkspaceManager);   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
    // record which handler each menu item reaches (the SAME globals the quick menu's rows called)
    await page.evaluate(() => {
        window.__fired = [];
        for (const fn of ['loadGcodeFile', 'insertGcodeFile', 'downloadFile', 'clearCode']) {
            window[fn] = () => window.__fired.push(fn);
        }
    });
}

test('the editor corner FILE MENU IS RETIRED (t2078): Load / Insert / Export reach the quick menu, Clear reaches its own toolbar button, same handlers as before', async ({ page }, testInfo) => {
    await boot(page);

    // t2078 — the corner door is gone entirely, not just relocated (editor-toolbar-2078.spec.js's own 'gone' check).
    expect(await page.evaluate(() => !!document.getElementById('editor-file-btn')), 'the corner file button no longer exists').toBe(false);
    expect(await page.evaluate(() => !!document.getElementById('editor-file-menu')), 'the corner file menu no longer exists').toBe(false);
    await expect(page.locator('#editor-copy-btn'), 'the copy button stays in the editor toolbar').toBeVisible();

    // Load / Insert / Export: the quick menu's rows now, same handlers, and picking one closes the menu —
    // driven one at a time (not just checked for presence) to prove each ACTUALLY reaches its own handler, in order.
    for (const act of ['fileLoad', 'fileInsert', 'fileExport']) {
        await page.locator('#hdrPostBtn').click();
        await expect(page.locator('#hdrPostMenu')).toBeVisible();
        await page.locator(`#hdrPostMenu [data-act="${act}"]`).click();
        await expect(page.locator('#hdrPostMenu'), 'picking an item closes the menu').toBeHidden();
    }
    expect(await page.evaluate(() => window.__fired)).toEqual(['loadGcodeFile', 'insertGcodeFile', 'downloadFile']);
    await page.screenshot({ path: testInfo.outputPath('quick-menu-file-rows.png') });

    // Clear: the editor toolbar's own trash button — not a menu row anywhere (t1255: one door to a destructive action)
    await page.locator('#btn-clear').click();
    expect(await page.evaluate(() => window.__fired.at(-1)), 'the trash reaches the same clearCode handler').toBe('clearCode');
    await page.locator('#hdrPostBtn').click();
    await expect(page.locator('#hdrPostMenu [data-act="clear"]'), 'no Clear row anywhere in the quick menu').toHaveCount(0);
});

test('the header quick menu offers Load / Insert / Export (t2078 reversal) but never Clear', async ({ page }, testInfo) => {
    await boot(page);
    // initHeaderPost wires + FILLS the menu asynchronously on boot; clicking before that no-ops (it flaked exactly
    // once under -workers contention). Poll the way the account-row spec does instead of assuming boot has settled.
    const menu = page.locator('#hdrPostMenu');
    await expect(async () => {
        const open = await page.evaluate(() => { const m = document.getElementById('hdrPostMenu'); return !!(m && !m.hidden && m.children.length); });
        if (!open) await page.locator('#hdrPostBtn').click();
        await expect(menu.locator('.hq-ws-row')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });
    // t2099 — t2078 put these three BACK (this used to assert their absence; see the file-header comment).
    await expect(menu.locator('[data-act="fileLoad"]'), 'Load is back — acts on the program as a whole').toBeVisible();
    await expect(menu.locator('[data-act="fileInsert"]'), 'Insert is back').toBeVisible();
    await expect(menu.locator('[data-act="fileExport"]'), 'Export is back').toBeVisible();
    await expect(menu.locator('[data-act="clear"]'), 'Clear alone stayed out (t1255) — one door, the toolbar trash').toHaveCount(0);
    await expect(menu.locator('.hq-ws-row [data-act="wsSave"]'), 'the workspace row stays — it is app-level').toBeVisible();
    await expect(menu.locator('[data-act="library"]'),
        'Library STAYS: its tabs are Projects + Wizards, and the wizard library is app-level, not editor content').toBeVisible();
    await menu.screenshot({ path: testInfo.outputPath('quick-menu-file-rows-present.png') });
});

test('the workspace manager has ONE way in — the granted folder; Browse… is gone', async ({ page }, testInfo) => {
    await boot(page);
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await expect(page.locator('#wsmOverlay')).toBeVisible();
    await expect(page.locator('#wsmBrowse'), 'no Browse… escape').toHaveCount(0);
    await expect(page.locator('#wsmPickFolder'), 'the folder pick stays — it IS the door').toBeVisible();
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('manager-no-browse.png') });
});

test('Duplicate… appears only once there IS a file to duplicate', async ({ page }, testInfo) => {
    await boot(page);
    // FIRST RUN: nothing has ever been saved
    await page.evaluate(() => { localStorage.removeItem('ddcs_file_saved_name'); localStorage.removeItem('ddcs_file_saved_at'); });
    await page.evaluate(() => window.openWorkspaceManager('save'));
    const cur = page.locator('#wsmCurrent');
    await expect(cur.locator('[data-wsm="save"]')).toBeVisible();
    await expect(cur.locator('[data-wsm="saveas"]')).toBeVisible();
    await expect(cur.locator('[data-wsm="duplicate"]'), 'nothing to duplicate yet').toHaveCount(0);
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('manager-first-run.png') });

    // once a file exists it is offered
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); });
    await page.locator('#wsmOverlay .wsm-x').click();
    await page.evaluate(() => window.openWorkspaceManager('save'));
    await expect(page.locator('#wsmCurrent [data-wsm="duplicate"]'), 'now there is something to copy').toBeVisible();
});
