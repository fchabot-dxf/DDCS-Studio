import { test, expect } from '@playwright/test';

/**
 * t854 part 1 — THE LIBRARY. One tabbed modal (Profiles · Projects · Wizards) opened from the header quick-menu
 * "Library…" on the last-used tab; the old entry points DEEP-LINK into their tab (the quick-menu "Open project" →
 * Projects, "Profiles…" → Profiles). Profiles + Projects speak the t805 select-then-load language; the Wizards tab
 * embeds the bar-designer + New-from-current. 390px reachability.
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

test('the quick-menu Library opens three tabs; each tab speaks its language', async ({ page }, testInfo) => {
    await seed(page);
    await openViaMenu(page);
    const ov = page.locator('#libraryOverlay');
    for (const t of ['profiles', 'projects', 'wizards']) await expect(ov.locator(`.library-tab[data-lib-tab="${t}"]`)).toBeVisible();

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

    // PROFILES tab — the Active badge (distinct from selection) + select-then-load
    await ov.locator('.library-tab[data-lib-tab="profiles"]').click();
    await expect(ov.locator('.sl-row', { hasText: 'Shop Expert' })).toBeVisible();
    await expect(ov.locator('[data-sl-active]')).toHaveCount(1);
    await expect(ov.locator('.sl-active-badge')).toHaveText('Active');
    const loadBtn = ov.locator('[data-sl-primary]');
    await expect(loadBtn).toBeDisabled();
    await ov.locator('.sl-row', { hasText: 'Bench Router' }).click();
    await expect(loadBtn).toBeEnabled();

    // WIZARDS tab — the bar-designer embeds + New-from-current
    await ov.locator('.library-tab[data-lib-tab="wizards"]').click();
    await expect(ov.locator('[data-newwiz]')).toBeVisible();
    await expect(ov.locator('#library_wizard_manager')).toBeVisible();
    await ov.screenshot({ path: testInfo.outputPath('library-wizards.png') });
});

test('last-used tab is remembered; the old entry points deep-link to their tab', async ({ page }) => {
    await seed(page);
    // switch to Profiles, close → reopening lands on Profiles (last-used, persisted)
    await openViaMenu(page);
    await page.locator('#libraryOverlay .library-tab[data-lib-tab="profiles"]').click();
    await page.locator('#libraryOverlay .library-x').click();
    await expect(page.locator('#libraryOverlay')).toHaveCount(0);
    await page.evaluate(() => window.openLibrary());
    await expect(page.locator('#libraryOverlay .library-tab[data-lib-tab="profiles"]')).toHaveClass(/active/);
    await page.locator('#libraryOverlay .library-x').click();

    // DEEP-LINK: the quick-menu "Profiles…" opens the Library on the Profiles tab (Projects stays on the drawer for now —
    // it carries the cloud volume the local Projects tab does not yet host; projects consolidation is the follow-up).
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-profact="browse"]');
    await expect(page.locator('#libraryOverlay')).toBeVisible();
    await expect(page.locator('#libraryOverlay .library-tab[data-lib-tab="profiles"]')).toHaveClass(/active/);
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
