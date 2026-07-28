import { test, expect } from '@playwright/test';

/**
 * t1227 — THE CURATION (all user-ruled).
 *
 * Load / Insert / Export / Clear act on the PROGRAM IN THE EDITOR, so they left the header quick menu (where you look
 * for app-level things) for the editor pane's own corner menu. The same handlers run — this spec drives the new door
 * and asserts each one reaches the function the quick-menu row used to call, so "moved" is proven, not assumed.
 *
 * Also here: the workspace manager's Browse… escape is gone (the granted folder is the ONE way in), and Duplicate…
 * does not appear before there is a file to duplicate.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditorFileMenu && window.openWorkspaceManager);
    // record which handler each menu item reaches (the SAME globals the quick menu's rows called)
    await page.evaluate(() => {
        window.__fired = [];
        for (const fn of ['loadGcodeFile', 'insertGcodeFile', 'downloadFile', 'clearCode']) {
            window[fn] = () => window.__fired.push(fn);
        }
    });
}

test('the editor corner carries a FILE menu: Load / Insert / Export / Clear, each reaching its own handler', async ({ page }, testInfo) => {
    await boot(page);

    const btn = page.locator('#editor-file-btn');
    await expect(btn, 'the file button sits in the editor pane, not the header').toBeVisible();
    expect(await page.evaluate(() => !!document.querySelector('.editor-container #editor-file-btn')), 'inside the editor container').toBe(true);
    await expect(page.locator('#editor-copy-btn'), 'the copy button STAYS beside it').toBeVisible();

    await btn.click();
    const menu = page.locator('#editor-file-menu');
    await expect(menu).toBeVisible();
    // t1255 (user) — THREE, not four: Clear left this menu. The header trash is THE clear at every width now, and
    // two doors to a destructive action is one too many. Named, so a re-added row has to be explained.
    await expect(menu.locator('[data-efm]')).toHaveCount(3);
    for (const [id, label] of [['load', /Load/], ['insert', /Insert/], ['export', /Export/]]) {
        await expect(menu.locator(`[data-efm="${id}"]`), `${id} is offered`).toHaveText(label);
    }
    await expect(menu.locator('[data-efm="clear"]'), 'and Clear is NOT here — the trash owns it').toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('editor-corner-menu.png'), clip: { x: 980, y: 90, width: 300, height: 230 } });

    // every item RUNS the handler its quick-menu row used to run
    await menu.locator('[data-efm="load"]').click();
    await expect(menu, 'picking an item closes the menu').toHaveCount(0);
    for (const id of ['insert', 'export']) {
        await btn.click();
        await page.locator(`#editor-file-menu [data-efm="${id}"]`).click();
    }
    expect(await page.evaluate(() => window.__fired)).toEqual(['loadGcodeFile', 'insertGcodeFile', 'downloadFile']);

    // and it toggles closed on a second press of its own button
    await btn.click();
    await expect(page.locator('#editor-file-menu')).toBeVisible();
    await btn.click();
    await expect(page.locator('#editor-file-menu')).toHaveCount(0);
});

test('the header quick menu no longer offers the editor file actions (they moved, they did not multiply)', async ({ page }, testInfo) => {
    await boot(page);
    // initHeaderPost wires + FILLS the menu asynchronously on boot; clicking before that no-ops (it flaked exactly
    // once under -workers contention). Poll the way the account-row spec does instead of assuming boot has settled.
    const menu = page.locator('#hdrPostMenu');
    await expect(async () => {
        const open = await page.evaluate(() => { const m = document.getElementById('hdrPostMenu'); return !!(m && !m.hidden && m.children.length); });
        if (!open) await page.locator('#hdrPostBtn').click();
        await expect(menu.locator('.hq-ws-row')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });
    await expect(menu.locator('.hq-gcode-row')).toHaveCount(0);
    await expect(menu.locator('[data-act="load"], [data-act="insert"], [data-act="export"], [data-act="clear"]')).toHaveCount(0);
    await expect(menu.locator('.hq-ws-row [data-act="wsSave"]'), 'the workspace row stays — it is app-level').toBeVisible();
    await expect(menu.locator('[data-act="library"]'),
        'Library STAYS: its tabs are Projects + Wizards, and the wizard library is app-level, not editor content').toBeVisible();
    await menu.screenshot({ path: testInfo.outputPath('quick-menu-slimmed.png') });
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
