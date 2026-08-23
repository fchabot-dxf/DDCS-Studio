import { test, expect } from '@playwright/test';

/**
 * t2196 — THE WIZARD BAR PANEL. The "Wizard bar" Settings sub-tab is retired (bar arrangement IS appearance,
 * but a 400+-line tree buried Appearance's own theme/setup-health controls) — reached from ONE row on Appearance
 * instead, opening the SAME tree (ui/wizardManagerPanel.js's renderWizardLibrary, unchanged) in its own small
 * panel (openWizardBarManager). The return-path stack from t2192 gets its second consumer: closing the panel
 * returns to Settings, on Appearance, on every exit.
 *
 * ALSO: Edit / Export .wiz / Delete move OUT of this panel's rows — those are ui/wizardManager.js's own
 * lifecycle job (t1617's own header always said so; this is the turn that stops the boundary leaking). This
 * panel keeps only arrangement: on/off, rename, group, order, icon, reset values.
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function seedCustomOp(page) {
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        U.createUserOp(U.userOpFromStack('bar2196', 'Bar2196 Op', [{ type: 'move_rapid', params: { x: 1 } }], [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 1 }]));
    });
}

test('the old "Wizard bar" sub-tab is DELETED, not hidden — no panel, no button, no orphaned mount point', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-app .settings-body');
    const r = await page.evaluate(() => ({
        panel: !!document.getElementById('set_tab_wizards'),
        subtab: !!document.querySelector('.settings-tab[data-target="set_tab_wizards"]'),
        mount: !!document.getElementById('wizard_library_manager'),
    }));
    expect(r.panel, 'no panel markup left behind').toBe(false);
    expect(r.subtab, 'no subtab button left behind').toBe(false);
    expect(r.mount, 'no orphaned mount point').toBe(false);
});

test('Appearance carries the "Wizard bar…" door; clicking it opens the tree in its own small panel', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-app .settings-body');
    await page.click('.settings-main-tab[data-group="lookfeel"]');
    await page.click('[data-target="set_tab_appearance"]');
    const door = page.locator('#set_wizbar_open');
    await expect(door).toBeVisible();
    await door.click();
    const ov = page.locator('#wizbarOverlay');
    await expect(ov).toBeVisible();
    await expect(ov.locator('.modal-card')).toBeVisible();   // the shared, previously-zero-consumer modal base
    await expect(ov).toContainText('WIZARD LIBRARY');
    // Settings itself is hidden while the panel is up — no stacked overlays fighting for input
    expect(await page.evaluate(() => document.getElementById('settings-overlay')?.classList.contains('active'))).toBe(false);
});

test('closing the panel (✕) returns to Settings, on Appearance', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-app .settings-body');
    await page.click('.settings-main-tab[data-group="lookfeel"]');
    await page.click('[data-target="set_tab_appearance"]');
    await page.click('#set_wizbar_open');
    await page.waitForSelector('#wizbarOverlay', { state: 'visible' });
    await page.click('#wizbarOverlay .wizbar-x');
    await expect(page.locator('#wizbarOverlay')).toHaveCount(0);
    await expect(page.locator('#settings-overlay.active')).toHaveCount(1);
    await expect(page.locator('.settings-main-tab[data-group="lookfeel"].active')).toHaveCount(1);
    await expect(page.locator('#set_tab_appearance')).toBeVisible();
});

test('ESC and the BACKDROP return identically to ✕', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    for (const exit of ['esc', 'backdrop']) {
        await page.evaluate(() => window.openSettings());
        await page.waitForSelector('#settings-app .settings-body');
        await page.click('.settings-main-tab[data-group="lookfeel"]');
        await page.click('[data-target="set_tab_appearance"]');
        await page.click('#set_wizbar_open');
        await page.waitForSelector('#wizbarOverlay', { state: 'visible' });
        if (exit === 'esc') await page.keyboard.press('Escape');
        else await page.mouse.click(5, 5);
        await expect(page.locator('#wizbarOverlay'), exit).toHaveCount(0);
        await expect(page.locator('#settings-overlay.active'), exit).toHaveCount(1);
        await expect(page.locator('.settings-main-tab[data-group="lookfeel"].active'), exit).toHaveCount(1);
        await page.evaluate(() => window.closeSettings());
    }
});

test('opened directly (not from Settings), the panel closes to the app — no return, exactly like the other managers', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.openWizardBarManager());
    await page.waitForSelector('#wizbarOverlay', { state: 'visible' });
    await page.click('#wizbarOverlay .wizbar-x');
    await expect(page.locator('#wizbarOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.getElementById('settings-overlay')?.classList.contains('active'))).toBe(false);
});

test('LIFECYCLE BUTTONS ARE GONE from a custom-op row: no Edit, no Export .wiz, no Delete — only arrangement', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await seedCustomOp(page);
    await page.evaluate(() => window.openWizardBarManager());
    await page.waitForSelector('#wizbarOverlay', { state: 'visible' });
    const row = page.locator('[data-entry="user_bar2196"]');
    await expect(row).toBeVisible();
    const buttonTexts = await row.locator('button').allTextContents();
    const joined = buttonTexts.join(' | ');
    expect(joined, 'no Edit').not.toMatch(/Edit/);
    expect(joined, 'no Export').not.toMatch(/Export/);
    expect(joined, 'no Delete').not.toMatch(/Delete/);
    // arrangement itself still works on a custom row: the visibility switch and rename input are present
    await expect(row.locator('input[type="checkbox"]')).toHaveCount(1);
    await expect(row.locator('input[type="text"]')).toHaveCount(1);
});

test('ARRANGEMENT STILL WORKS on a custom op: hide it, and it drops out of the live bar', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsRefreshWizardBar);
    await seedCustomOp(page);
    await page.evaluate(() => window.ddcsRefreshWizardBar());
    await page.evaluate(() => window.openWizardBarManager());
    await page.waitForSelector('#wizbarOverlay', { state: 'visible' });
    const row = page.locator('[data-entry="user_bar2196"]');
    await expect(row.locator('input[type="checkbox"]')).toBeChecked();
    await row.locator('.ddcs-slider').click();
    const visible = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        return WL.getLibrary().groups.some((g) => g.items.some((i) => i.id === 'user_bar2196'));
    });
    expect(visible, 'hiding it drops it from the visible (bar-facing) library').toBe(false);
});

test('the wizard-bar manager MODULE registers its global even though settingsPanel.js no longer imports renderWizardLibrary directly', async ({ page }) => {
    // t2196 — a real regression this turn hit once: settingsPanel.js was wizardManagerPanel.js's ONLY importer;
    // dropping the named import without a side-effect import meant the module (and window.openWizardBarManager)
    // never loaded at all. This proves the fix, not just the happy path above.
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    expect(await page.evaluate(() => typeof window.openWizardBarManager)).toBe('function');
});
