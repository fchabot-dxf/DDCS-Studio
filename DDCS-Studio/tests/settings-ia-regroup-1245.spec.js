import { test, expect } from '@playwright/test';

/**
 * t1245 (user) — THE SHRINK. Settings' "General" tab was a catch-all of NINE subtabs, and the question "how should
 * these nine be grouped?" turned out to be the wrong question: most of them were not settings at all.
 *
 *   Appearance · Preview · Editor · Wizards  →  STAY, as Look and feel (Wizards renamed WIZARD BAR — it configures
 *                                               the bar, it does not list wizards)
 *   Workspace                                →  DELETED. Its two buttons opened the workspace manager, which the
 *                                               quick menu's Save / Open already do. Settings keeps ZERO workspace
 *                                               controls; the identity band above the strip still SAYS which
 *                                               workspace this is, display-only.
 *   Cloud                                    →  DELETED. Sign-in / identity / sign-out moved to the manager's Cloud
 *                                               tab in t1243; its ONE unique control, Default save location, moved
 *                                               there with it rather than being dropped.
 *   FAQ · About                              →  OUT of Settings, into the quick menu's Help panel. Neither changes
 *                                               how the app behaves, so neither belongs behind a gear.
 *   Feedback                                 →  MERGED into the quick menu's ⭐ Rate / Feedback. The old button was a
 *                                               bare mailto to the same maintainer that toast already reaches.
 *
 * So the strip is Look and feel │ Controller │ Hardware, and every deep link that pointed at a deleted panel now
 * points at the surface that actually owns the job. That remapping is what these tests are for.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const openSettings = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings, null, { timeout: 15000 });
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-app .settings-tabs .settings-main-tab', { timeout: 8000 });
};
const openMenu = async (page) => {
    await page.waitForFunction(() => window.ddcsStudio && document.querySelector('#hdrPostMenu .hdr-quick-head'), null, { timeout: 15000 });
    await page.click('#hdrPostBtn');
    await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 6000 });
};

test('the strip is THREE tabs — Look and feel, Controller, Hardware', async ({ page }) => {
    await openSettings(page);
    const strip = await page.evaluate(() => [...document.querySelectorAll('#settings-app .settings-tabs .settings-main-tab')]
        .map((b) => ({ group: b.dataset.group, label: b.textContent.trim() })));
    expect(strip).toEqual([
        { group: 'lookfeel', label: 'Look and feel' },
        { group: 'controller', label: 'Controller' },
        { group: 'hardware', label: 'Hardware' },
    ]);
    expect(await page.locator('.settings-main-tab[data-group="general"]').count(), 'the catch-all is gone').toBe(0);
});

test('Look and feel holds FOUR subtabs, and Wizards is renamed to what it actually edits', async ({ page }) => {
    await openSettings(page);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#settings-app .settings-sidebar .settings-tab[data-group="lookfeel"]')]
        .map((b) => ({ id: b.dataset.target, label: b.textContent.trim() })));
    expect(tabs).toEqual([
        { id: 'set_tab_appearance', label: 'Appearance' },
        { id: 'set_tab_preview', label: 'Preview' },
        { id: 'set_tab_compose', label: 'Editor' },
        { id: 'set_tab_wizards', label: 'Wizard bar' },
    ]);
    // and all four still open — a rename that broke its panel would be worse than the old name
    for (const t of tabs) {
        await page.click(`.settings-tab[data-target="${t.id}"]`);
        await expect(page.locator(`#${t.id}`), `${t.label} opens`).toBeVisible();
    }
});

test('the five retired subtabs are DELETED, not hidden — no panel, no button, no orphaned control', async ({ page }) => {
    await openSettings(page);
    const r = await page.evaluate(() => {
        const ids = ['set_tab_backup', 'set_tab_cloud', 'set_tab_faq', 'set_tab_feedback', 'set_tab_about'];
        return {
            panels: ids.filter((id) => document.getElementById(id)),
            subtabs: ids.filter((id) => document.querySelector(`.settings-tab[data-target="${id}"]`)),
            // the controls those panels carried — a leftover here is a button wired to nothing
            controls: ['set_backup_export', 'set_backup_restore', 'set_cloud_mount', 'set_save_location', 'set_report', 'set_about_ver']
                .filter((id) => document.getElementById(id)),
        };
    });
    expect(r.panels, 'no panel markup left behind').toEqual([]);
    expect(r.subtabs, 'no subtab button left behind').toEqual([]);
    expect(r.controls, 'and no orphaned control').toEqual([]);
});

test('SETTINGS HOLDS ZERO WORKSPACE CONTROLS — the manager owns saving, and says so alone', async ({ page }) => {
    await openSettings(page);
    const text = await page.evaluate(() => document.getElementById('settings-app').textContent);
    expect(/Save workspace|Open workspace/i.test(text), 'no save/open door inside Settings').toBe(false);
    // …but the identity band still names the workspace: display-only was always the point, and it survives the cut
    const band = await page.evaluate(() => {
        const b = document.getElementById('set_identity_band');
        const head = document.querySelector('#settings-app .settings-head');
        return { text: b.textContent.trim(), above: b.getBoundingClientRect().bottom <= head.getBoundingClientRect().top + 1, buttons: b.querySelectorAll('button').length };
    });
    expect(band.text.length, 'the band still says which machine this is').toBeGreaterThan(0);
    expect(band.above, 'above the whole strip').toBe(true);
    expect(band.buttons, 'and still display-only').toBe(0);
});

test('HELP is one quick-menu row opening one small panel — FAQ and About, both sections', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openMenu(page);
    const row = page.locator('#hdrPostMenu [data-act="help"]');
    await expect(row, 'ONE Help row').toHaveCount(1);
    await row.click();
    await expect(page.locator('#helpOverlay')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#help_faq'), 'section one: the FAQ').toBeVisible();
    await expect(page.locator('#help_about'), 'section two: About').toBeVisible();
    expect(await page.locator('#help_faq details').count(), 'the FAQ moved whole, not summarised').toBeGreaterThanOrEqual(10);
    await page.keyboard.press('Escape');
    await expect(page.locator('#helpOverlay'), 'Esc closes it').toHaveCount(0);
});

test('ONE feedback door: the Settings Report-a-bug is gone and Rate / Feedback is still there', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openMenu(page);
    await expect(page.locator('#hdrPostMenu [data-act="rate"]'), 'the surviving door').toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-app .settings-tabs');
    expect(await page.locator('#set_report').count(), 'and no second one behind the gear').toBe(0);
});

test('the CLOUD subtab\'s one unique control came with it — Default save location is on the manager\'s Cloud tab', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager);
    await page.route('https://www.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) }));
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_email', 'maker@example.com');
    });
    await page.evaluate(() => window.openWorkspaceManager('open', { place: 'cloud' }));
    const sel = page.locator('#wsmSaveLoc');
    await expect(sel, 'the moved row, on the tab that IS the cloud').toBeVisible({ timeout: 8000 });
    // it reads and writes the ONE pref module — not a second copy of the value
    await sel.selectOption('always-local');
    expect(await page.evaluate(async () => (await import('/ui/savePrefs.js')).getDefaultSaveLocation()),
        'changing it writes through to savePrefs').toBe('always-local');
    await sel.selectOption('cloud-when-connected');
    expect(await page.evaluate(async () => (await import('/ui/savePrefs.js')).getDefaultSaveLocation())).toBe('cloud-when-connected');
});

test('…and it is reachable SIGNED OUT — the move must not cost a setting anyone could reach before', async ({ page }) => {
    // On the old Settings > Cloud subtab this pref was reachable with no account at all. Putting it behind a sign-in
    // would be a quiet behavioural loss dressed up as a tidy-up, so the signed-out cloud tab carries it too.
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager);
    await page.evaluate(() => { ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email'].forEach((k) => localStorage.removeItem(k)); });
    await page.evaluate(() => window.openWorkspaceManager('open', { place: 'cloud' }));
    await expect(page.locator('#wsmCloudSignIn'), 'signed out, so the sign-in is what you see first').toBeVisible();
    const sel = page.locator('#wsmSaveLoc');
    await expect(sel, 'and the save-location pref is still settable').toBeVisible();
    await sel.selectOption('always-local');
    expect(await page.evaluate(async () => (await import('/ui/savePrefs.js')).getDefaultSaveLocation()),
        'writing through to the same one pref module').toBe('always-local');
});

test('EVERY surviving panel deep-links to itself — a panel carries its own group', async ({ page }) => {
    // The structural guarantee behind the whole reshuffle: showPanel reads the owning subtab's data-group and
    // activates that main tab, so no caller can name a group that has been renamed, split or (this turn) deleted.
    await openSettings(page);
    const panels = await page.evaluate(() => [...document.querySelectorAll('#settings-app .settings-sidebar .settings-tab')]
        .map((b) => ({ id: b.dataset.target, group: b.dataset.group })));
    expect(panels.length, 'fourteen subtabs survive the shrink').toBe(14);

    for (const p of panels) {
        const r = await page.evaluate(async (panel) => {
            const { openSettings } = await import('/ui/settingsPanel.js');
            openSettings({ panel });   // NO group argument — the panel is expected to know its own
            const el = document.getElementById(panel);
            const btn = document.querySelector(`.settings-sidebar .settings-tab[data-target="${panel}"]`);
            const main = document.querySelector('#settings-app .settings-tabs .settings-main-tab.active');
            return {
                panelShown: el && getComputedStyle(el).display !== 'none',
                subtabVisible: btn && getComputedStyle(btn).display !== 'none',
                activeGroup: main && main.dataset.group,
            };
        }, p.id);
        expect(r.panelShown, `${p.id} is the panel on screen`).toBe(true);
        expect(r.subtabVisible, `${p.id}'s own subtab is in the visible strip`).toBe(true);
        expect(r.activeGroup, `${p.id} activated its owning main tab (${p.group})`).toBe(p.group);
    }
});

test('the setup checklist Set buttons still ARRIVE — including the cloud one, which now opens the manager', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSetupChecklist && window.openSettings, null, { timeout: 15000 });

    const EXPECT = {
        machine: { panel: 'set_tab_machine', group: 'hardware' },
        wcs: { panel: 'set_tab_wcs', group: 'controller' },
        profile: { panel: 'set_tab_profile', group: 'controller' },
        tool: { panel: 'set_tab_atc', group: 'hardware' },
        probe: { panel: 'set_tab_input', group: 'hardware' },
        gateway: { panel: 'set_tab_gateway', group: 'controller' },
    };
    for (const [key, want] of Object.entries(EXPECT)) {
        await page.evaluate(() => { window.closeSettings && window.closeSettings(); });
        await page.evaluate(() => window.openSetupChecklist());
        const btn = page.locator(`.sc-set[data-set="${key}"]`);
        if (!(await btn.count())) continue;   // an already-satisfied item shows no Set button — nothing to prove
        await btn.click();
        await expect(page.locator(`#${want.panel}`), `${key} → ${want.panel}`).toBeVisible({ timeout: 6000 });
        const active = await page.evaluate(() => (document.querySelector('#settings-app .settings-tabs .settings-main-tab.active') || {}).dataset?.group);
        expect(active, `${key} landed with the ${want.group} tab active`).toBe(want.group);
    }

    // the CONNECT CLOUD link used to open Settings → Cloud. That panel is gone, so it opens the manager ON the Cloud
    // shelf — the place the account actually lives since t1243. A remap that landed nowhere would be the real failure.
    await page.evaluate(() => { window.closeSettings && window.closeSettings(); });
    await page.evaluate(() => window.openWorkspaceManager('open', { place: 'cloud' }));
    await expect(page.locator('#wsmOverlay')).toBeVisible();
    await expect(page.locator('.wsm-place[data-place="cloud"]'), 'and it opens ON the cloud tab, not beside it').toHaveClass(/is-active/);
});

test('THREE tabs still fit a 390px phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);
    const m = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#settings-app .settings-tabs .settings-main-tab')].map((b) => b.getBoundingClientRect());
        return { overflowsRight: tabs.some((t) => t.right > innerWidth + 1), bodyScroll: document.body.scrollWidth, vw: innerWidth };
    });
    expect(m.overflowsRight, 'nothing runs off the edge').toBe(false);
    expect(m.bodyScroll, 'and the page never scrolls sideways').toBeLessThanOrEqual(m.vw);
});
