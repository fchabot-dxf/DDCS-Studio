import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

/**
 * t2192 — SETTINGS GAINS A WORKSPACE TAB (spec: DDCS-Studio/scratchpad/t-workspace-tab.md).
 *
 * ITS JOB IS THE INVENTORY, NOT NAVIGATION: a number and a button per row, reading data/backup.js's own declared
 * BACKUP_STORES counts directly — no re-typed labels, no hardcoded counts. A row gets a door only where a real
 * manager exists (Wizards, Projects, the tool table's own Settings tab); every other row is a count with no button.
 * Plus the return path: opening a manager FROM this tab returns to Settings, on the same tab, on every exit
 * (✕ / Esc / backdrop) — and no depth limit (ui/navReturn.js generalised to a real stack for this).
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function openWorkspaceTab(page) {
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-app .settings-body');
    await page.click('.settings-main-tab[data-group="workspace"]');
    await page.waitForSelector('#set_tab_workspace', { state: 'visible' });
    // the inventory renders ASYNC (one store's count is an IndexedDB read) — wait for actual row content, not
    // just the panel becoming visible, or a fast assertion races the fire-and-forget refresh and reads it empty.
    await page.waitForSelector('[data-wsrow]', { timeout: 5000 });
}

test('the Workspace tab exists beside UI / Controller / Hardware, and shows the identity band', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openWorkspaceTab(page);
    const groups = await page.evaluate(() => [...document.querySelectorAll('.settings-main-tab')].map((b) => b.dataset.group));
    expect(groups).toEqual(['lookfeel', 'controller', 'hardware', 'workspace']);
    // the identity band moved IN, not duplicated — exactly one #set_identity_band, inside the workspace panel
    const band = await page.evaluate(() => {
        const b = document.getElementById('set_identity_band');
        const panel = document.getElementById('set_tab_workspace');
        return { count: document.querySelectorAll('#set_identity_band').length, insidePanel: !!(b && panel && panel.contains(b)), text: b ? b.textContent : '' };
    });
    expect(band.count, 'exactly one identity band in the whole document').toBe(1);
    expect(band.insidePanel, 'it lives inside the Workspace tab now, not the header').toBe(true);
    expect(band.text).toMatch(/Controller/);
});

test('THE COUNTS ARE REAL: add a wizard, reopen the tab, the number moves', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openWorkspaceTab(page);
    const before = await page.evaluate(() => document.querySelector('[data-wsrow="userOps"] b').textContent);
    // add a custom wizard directly through the registry the row's own count reads (backup.js's userOps store)
    await page.evaluate(async () => {
        const { createUserOp } = await import('/blocks/userOps.js');
        createUserOp({ opType: 'user_t2192_probe', label: 'T2192 probe wizard', template: [{ type: 'move_rapid', params: { x: 0 } }], bindings: [] });
    });
    // leave and come back (the acceptance bar names this exact gesture) rather than assume a live re-render
    await page.click('.settings-main-tab[data-group="lookfeel"]');
    await page.click('.settings-main-tab[data-group="workspace"]');
    await page.waitForFunction((prev) => {
        const el = document.querySelector('[data-wsrow="userOps"] b');
        return el && el.textContent !== prev;
    }, before, { timeout: 5000 });
    const after = await page.evaluate(() => document.querySelector('[data-wsrow="userOps"] b').textContent);
    expect(after, 'the count reflects the real registry, not a stale render').not.toBe(before);
    expect(after).toMatch(/^\d+ wizards$/);
});

test('A NUMBER AND A BUTTON, NOTHING MORE: doors only where a manager exists; the rest are count-only', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openWorkspaceTab(page);
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-wsrow]')].map((r) => ({
        id: r.dataset.wsrow,
        hasButton: !!r.querySelector('[data-wsinv]'),
        hasList: !!r.querySelector('ul, .lsh-grid, .wizm-list'),   // no inline lists / expandable content, ever
    })));
    expect(rows.length, 'every BACKUP_STORES row is represented').toBeGreaterThanOrEqual(11);
    const withDoors = rows.filter((r) => r.hasButton).map((r) => r.id).sort();
    expect(withDoors, 'exactly the three rows a real manager exists for').toEqual(['projects', 'settings', 'userOps']);
    expect(rows.every((r) => !r.hasList), 'no row expands into a list — a count and, at most, one button').toBe(true);
});

test('an EMPTY workspace reads sensibly — "no wizards yet", not "0 wizards"', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
    await openWorkspaceTab(page);
    const text = await page.evaluate(() => document.querySelector('[data-wsrow="userOps"] b').textContent);
    expect(text).toBe('no wizards yet');
});

test('the TOOL TABLE row door jumps to Settings\' own ATC tab — no manager, no new surface', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openWorkspaceTab(page);
    await page.click('[data-wsrow="settings"] [data-wsinv]');
    await page.waitForSelector('#set_tab_atc', { state: 'visible' });
    // still Settings, just a different internal tab — not a second modal
    expect(await page.evaluate(() => document.querySelectorAll('#settings-app.active, #settings-overlay.active').length)).toBeGreaterThan(0);
});

// ── THE RETURN PATH ─────────────────────────────────────────────────────────────────────────────────────────────
test('opening the WIZARD MANAGER from the Workspace tab returns to Settings, on the Workspace tab, on ✕', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openWorkspaceTab(page);
    await page.click('[data-wsrow="userOps"] [data-wsinv]');
    await page.waitForSelector('#wizmOverlay', { state: 'visible' });
    // Settings itself is hidden while the manager is up (no stacked overlays fighting for input)
    expect(await page.evaluate(() => document.getElementById('settings-overlay')?.classList.contains('active'))).toBe(false);
    await page.click('#wizmOverlay .wsm-x');
    await expect(page.locator('#wizmOverlay')).toHaveCount(0);
    await expect(page.locator('#settings-overlay.active')).toHaveCount(1);
    await expect(page.locator('.settings-main-tab[data-group="workspace"].active')).toHaveCount(1);
    await expect(page.locator('#set_tab_workspace')).toBeVisible();
});

test('ESC and the BACKDROP return identically to ✕', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    for (const exit of ['esc', 'backdrop']) {
        await openWorkspaceTab(page);
        await page.click('[data-wsrow="projects"] [data-wsinv]');
        await page.waitForSelector('#projmOverlay', { state: 'visible' });
        if (exit === 'esc') await page.keyboard.press('Escape');
        else await page.mouse.click(5, 5);   // the scrim, outside the modal box
        await expect(page.locator('#projmOverlay'), exit).toHaveCount(0);
        await expect(page.locator('#settings-overlay.active'), exit).toHaveCount(1);
        await expect(page.locator('.settings-main-tab[data-group="workspace"].active'), exit).toHaveCount(1);
        await page.evaluate(() => window.closeSettings());
    }
});

test('opened from the FILE MENU instead, the SAME manager closes to the app — no return, exactly as before', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.openWizardManager());
    await page.waitForSelector('#wizmOverlay', { state: 'visible' });
    await page.click('#wizmOverlay .wsm-x');
    await expect(page.locator('#wizmOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.getElementById('settings-overlay')?.classList.contains('active'))).toBe(false);
});

test('NO DEPTH LIMIT: Settings → Wizards → (file-menu) Settings again → close both, unwinds two levels correctly', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openWorkspaceTab(page);
    await page.click('[data-wsrow="userOps"] [data-wsinv]');
    await page.waitForSelector('#wizmOverlay', { state: 'visible' });
    // a SECOND, independent Settings open while the wizard manager sits behind it — simulates a deeper chain
    // without inventing a UI door that doesn't exist: the mechanism must not special-case "already open".
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-overlay.active');
    await page.evaluate(() => window.closeSettings());
    // back to the wizard manager (still there, untouched)
    await expect(page.locator('#wizmOverlay')).toBeVisible();
    await page.click('#wizmOverlay .wsm-x');
    // now the ORIGINAL Settings-from-Workspace-tab return fires
    await expect(page.locator('#wizmOverlay')).toHaveCount(0);
    await expect(page.locator('#settings-overlay.active')).toHaveCount(1);
    await expect(page.locator('.settings-main-tab[data-group="workspace"].active')).toHaveCount(1);
});

test('390px and all themes: the tab is reachable and legible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openWorkspaceTab(page);
    for (const theme of ['studio', 'normal', 'steampunk', 'futuristic', 'organic']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(60);
        await expect(page.locator('#set_tab_workspace')).toBeVisible();
    }
});
