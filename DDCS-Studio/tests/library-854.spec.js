import { test, expect } from '@playwright/test';

/**
 * t854 part 1 — THE PROJECTS MODAL. Opened from the header quick-menu "Open project…" row (t2173 — literalised
 * from "Library…"; the underlying door/data-act is unchanged) — select-then-load over the local + cloud
 * volumes, plus the save-as door. 390px reachability.
 *
 * t1217 — the PROFILES tab retired first ([[one-workspace-one-machine]]): a workspace holds exactly one
 * machine, so there is no library of machines to browse or switch between (a second machine is a second
 * .ddcs). The quick-menu identity row opens the machine's SETTINGS instead of deep-linking to a Profiles tab.
 *
 * t2178 (amendment 14, human: "i think the modal should be seperated, wizard modal and project modal dont need
 * to be shared") — the WIZARDS tab retired too, this time entirely (not relocated): it only ever embedded the
 * bar-arrangement designer (also independently reachable from Settings' own Wizards tab) plus a "New from
 * current" button that duplicated the quick-menu's own `case 'wizard'` door — and `window.openWizardManager()`
 * (t1617) already covered the richer lifecycle actions (rename/duplicate/fork/export/delete) this tab never
 * had. This modal is Projects-only now: no tab bar, `openLibrary()` takes no argument, and this file's own
 * former "last-used tab" test is gone with the thing it was testing (there is nothing left to remember between).
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function seed(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.openLibrary, null, { timeout: 15000 });   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
    await page.evaluate(async () => {
        // t1223 — the legacy profile-library seed is gone with the library itself ([[no-legacy-burden]]).
        const store = await import('/ui/projects/projectStore.js');
        await store.saveProject('Bracket', { kind: 'ddcs.macro', v: 1, name: 'Bracket', stack: [{ type: 'op', opType: 'user_pocket_data' }] });
    });
}
// Open the modal through the real header quick-menu "Open project…" row (t2173 — was "Library…").
async function openViaMenu(page) {
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-act="library"]');
    await expect(page.locator('#libraryOverlay')).toBeVisible();
}

test('the quick-menu opens the Projects modal directly — no tab bar, Wizards/Profiles are both gone', async ({ page }, testInfo) => {
    await seed(page);
    await openViaMenu(page);
    const ov = page.locator('#libraryOverlay');
    // t2178 — no tab-switcher of any kind: a single-item tab bar was the exact clutter the split removed.
    await expect(ov.locator('.library-tabs'), 'the tab-switcher itself is gone, not just its extra tabs').toHaveCount(0);
    await expect(ov.locator('.library-tab'), 'no tab buttons at all').toHaveCount(0);
    await expect(ov.locator('.library-title'), 'a plain title instead').toHaveText('Projects');

    // select-then-load over the seeded project + the save-as door lives here, unchanged
    const projRow = ov.locator('.sl-row', { hasText: 'Bracket' });
    await expect(projRow).toBeVisible();
    const openBtn = ov.locator('[data-sl-primary]');
    await expect(openBtn).toBeDisabled();
    await projRow.click();
    await expect(ov.locator('.sl-row.sl-selected')).toHaveCount(1);
    await expect(openBtn).toBeEnabled();
    await expect(ov.locator('[data-pa="save"]')).toBeVisible();
    await ov.screenshot({ path: testInfo.outputPath('library-projects.png') });
});

test('WIZARDS ARE GENUINELY ELSEWHERE — window.openWizardManager() is the real, independent door', async ({ page }) => {
    await seed(page);
    // t2178 — the thing the split actually asserts: Wizards never lived in a code path this modal owns.
    const has = await page.evaluate(() => typeof window.openWizardManager === 'function');
    expect(has, 'the wizard lifecycle modal is its own, already-wired global, not something libraryModal.js hosts').toBe(true);
    // and the quick-menu's own "Wizards…" row reaches it directly, not through this modal
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-act="wizards"]');
    await expect(page.locator('#libraryOverlay'), 'Wizards… never opens the Projects modal').toHaveCount(0);
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
