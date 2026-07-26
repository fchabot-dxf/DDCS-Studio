import { test, expect } from '@playwright/test';

/**
 * t854 part 1 — THE LIBRARY. One tabbed modal opened from the header quick-menu "Library…" on the last-used tab.
 * Projects speaks the t805 select-then-load language; the Wizards tab embeds the bar-designer + New-from-current.
 * 390px reachability.
 *
 * t1217 — the PROFILES tab is RETIRED ([[one-workspace-one-machine]]): a workspace holds exactly one machine, so there
 * is no library of machines to browse or switch between (a second machine is a second .ddcs). The Library is now two
 * tabs, and the quick-menu identity row opens the machine's SETTINGS instead of deep-linking to a Profiles tab.
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function seed(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openLibrary, null, { timeout: 15000 });
    await page.evaluate(async () => {
        localStorage.setItem('ddcs_profile_library', JSON.stringify({ activeId: 'p1', profiles: [
            { id: 'p1', name: 'Shop Expert', controllerId: 'ddcs_expert', settings: {}, userVars: [] },
            { id: 'p2', name: 'Bench Router', controllerId: 'generic', settings: {}, userVars: [] },
        ] }));
        const store = await import('/ui/projects/projectStore.js');
        await store.saveProject('Bracket', { kind: 'ddcs.macro', v: 1, name: 'Bracket', stack: [{ type: 'op', opType: 'user_pocket_data' }] });
    });
}
// Open the Library through the real header quick-menu "Library…" row.
async function openViaMenu(page) {
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-act="library"]');
    await expect(page.locator('#libraryOverlay')).toBeVisible();
}

test('the quick-menu Library opens two tabs; each tab speaks its language; Profiles is GONE', async ({ page }, testInfo) => {
    await seed(page);
    await openViaMenu(page);
    const ov = page.locator('#libraryOverlay');
    for (const t of ['projects', 'wizards']) await expect(ov.locator(`.library-tab[data-lib-tab="${t}"]`)).toBeVisible();
    // t1217 — retired, and it must not come back: a seeded legacy library (see seed()) must NOT resurrect the tab.
    await expect(ov.locator('.library-tab[data-lib-tab="profiles"]')).toHaveCount(0);

    // PROJECTS tab — select-then-load over the seeded project + the save-as door lives here
    await ov.locator('.library-tab[data-lib-tab="projects"]').click();
    const projRow = ov.locator('.sl-row', { hasText: 'Bracket' });
    await expect(projRow).toBeVisible();
    const openBtn = ov.locator('[data-sl-primary]');
    await expect(openBtn).toBeDisabled();
    await projRow.click();
    await expect(ov.locator('.sl-row.sl-selected')).toHaveCount(1);
    await expect(openBtn).toBeEnabled();
    await expect(ov.locator('[data-pa="save"]')).toBeVisible();

    // WIZARDS tab — the bar-designer embeds + New-from-current
    await ov.locator('.library-tab[data-lib-tab="wizards"]').click();
    await expect(ov.locator('[data-newwiz]')).toBeVisible();
    await expect(ov.locator('#library_wizard_manager')).toBeVisible();
    await ov.screenshot({ path: testInfo.outputPath('library-wizards.png') });
});

test('last-used tab is remembered; the identity row opens the MACHINE settings (t1217, was a Profiles deep-link)', async ({ page }) => {
    await seed(page);
    // switch to Wizards, close → reopening lands on Wizards (last-used, persisted)
    await openViaMenu(page);
    await page.locator('#libraryOverlay .library-tab[data-lib-tab="wizards"]').click();
    await page.locator('#libraryOverlay .library-x').click();
    await expect(page.locator('#libraryOverlay')).toHaveCount(0);
    await page.evaluate(() => window.openLibrary());
    await expect(page.locator('#libraryOverlay .library-tab[data-lib-tab="wizards"]')).toHaveClass(/active/);
    await page.locator('#libraryOverlay .library-x').click();

    // t1217 — the quick-menu identity row used to deep-link into a Profiles tab. With one machine per workspace the
    // row names THAT machine, so it opens the machine's own settings instead. Assert the real destination.
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-profact="browse"]');
    await expect(page.locator('#settings-app')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#set_machine_name')).toBeVisible();
    await expect(page.locator('#libraryOverlay')).toHaveCount(0);
});

test('reachable + legible at 390px, both themes', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await seed(page);
    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu [data-act="library"]')).toBeVisible();   // reachable on mobile via the menu
    await page.click('#hdrPostMenu [data-act="library"]');
    const ov = page.locator('#libraryOverlay');
    await expect(ov).toBeVisible();
    for (const theme of ['studio', 'futuristic']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(90);
        await ov.screenshot({ path: testInfo.outputPath(`library-390-${theme}.png`) });
    }
});
