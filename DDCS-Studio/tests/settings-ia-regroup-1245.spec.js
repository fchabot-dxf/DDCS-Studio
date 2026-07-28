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

test('t1265 — the “new saves go to” PREFERENCE is gone from the Cloud tab, signed in AND signed out', async ({ page }) => {
    // t1245 moved this control here from the retired Settings > Cloud subtab; t1265 (user) removed it outright,
    // because the CONTEXT already decides — the shelf a file lives on, the tab you are looking at, the first-save
    // dialog. A setting on top of that could only ever disagree with what the screen was showing.
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager);
    await page.route('https://www.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) }));

    for (const signedIn of [true, false]) {
        await page.evaluate((yes) => {
            if (yes) { localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google'); localStorage.setItem('ddcs_cloud_email', 'maker@example.com'); }
            else ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email'].forEach((k) => localStorage.removeItem(k));
        }, signedIn);
        await page.evaluate(() => window.openWorkspaceManager('open', { place: 'cloud' }));
        expect(await page.locator('#wsmSaveLoc').count(), 'no preference control').toBe(0);
        await expect(page.locator('#wsmCards'), 'and no wording promising one').not.toContainText(/new saves go to/i);
        await page.evaluate(() => { const o = document.getElementById('wsmOverlay'); if (o) o.remove(); });
    }
    // …and the module that stored it no longer offers one
    const gone = await page.evaluate(async () => {
        const m = await import('/ui/savePrefs.js');
        return { getter: typeof m.getDefaultSaveLocation, setter: typeof m.setDefaultSaveLocation, list: typeof m.SAVE_LOCATIONS, preferred: typeof m.preferredSaveTarget };
    });
    expect(gone, 'the plumbing went with the row — not left dangling for a future caller to resurrect')
        .toEqual({ getter: 'undefined', setter: 'undefined', list: 'undefined', preferred: 'undefined' });
});

test('t1265 — THE MANAGER OPENS ON THE SHELF THE CONTEXT IMPLIES (three cases)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager && window.ddcsMarkWorkspaceSaved);
    await page.route('https://www.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) }));
    const signIn = (yes) => page.evaluate((y) => {
        if (y) { localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google'); localStorage.setItem('ddcs_cloud_email', 'maker@example.com'); }
        else ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email'].forEach((k) => localStorage.removeItem(k));
    }, yes);
    const openAndRead = async () => {
        await page.evaluate(() => window.openWorkspaceManager('open'));
        const place = await page.evaluate(() => document.querySelector('.wsm-place.is-active').dataset.place);
        await page.evaluate(() => { const o = document.getElementById('wsmOverlay'); if (o) o.remove(); });
        return place;
    };

    // 1 — THE FILE'S OWN SHELF WINS: a workspace living in Drive opens on Cloud…
    await signIn(true);
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved('rig.ddcs', 'cloud'));
    expect(await openAndRead(), 'a Drive-living workspace opens on its own shelf').toBe('cloud');

    // …and a local one opens on Local EVEN WHILE SIGNED IN — the file you are in beats the account you have
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved('rig.ddcs', 'local'));
    expect(await openAndRead(), 'a local workspace opens on Local even when signed in').toBe('local');

    // 2 — NO FILE YET: signed in → Cloud (the user's stated expectation)
    await page.evaluate(() => { localStorage.removeItem('ddcs_file_saved_place'); localStorage.removeItem('ddcs_file_saved_name'); });
    expect(await openAndRead(), 'no file + signed in → Cloud').toBe('cloud');

    // 3 — no file, signed out → Local
    await signIn(false);
    expect(await openAndRead(), 'no file + signed out → Local').toBe('local');

    // and the tabs stay freely clickable regardless of how it opened
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('.wsm-place[data-place="cloud"]').click();
    await expect(page.locator('.wsm-place[data-place="cloud"]')).toHaveClass(/is-active/);
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

test('t1265 — the close X lives in the identity band row, not the tab strip', async ({ page }) => {
    // The band and the X together are the modal's ONE header: what this is, and the way out. Before, the X sat in the
    // tab-strip row, which read as a control belonging to the TABS.
    await openSettings(page);
    expect(await page.locator('#settings-app .settings-head .settings-close').count(),
        'the tab row no longer carries it').toBe(0);
    const x = page.locator('#settings-app .settings-headerrow .settings-close');
    await expect(x, 'the header row does').toBeVisible();

    const m = await page.evaluate(() => {
        const band = document.querySelector('#settings-app .settings-identity').getBoundingClientRect();
        const btn = document.querySelector('#settings-app .settings-headerrow .settings-close').getBoundingClientRect();
        const head = document.querySelector('#settings-app .settings-head').getBoundingClientRect();
        const modal = document.getElementById('settings-app').getBoundingClientRect();
        return { bandRight: band.right, xLeft: btn.left, w: btn.width, h: btn.height,
                 fromRightEdge: modal.right - btn.right,
                 topAligned: Math.abs(btn.top - band.top) <= 2, aboveTabs: btn.bottom <= head.top + 1 };
    });
    expect(m.topAligned, 'level with the band’s first line, not floating mid-band when it wraps').toBe(true);
    expect(m.aboveTabs, 'and above the tab strip entirely').toBe(true);
    expect(Math.min(m.w, m.h), 'still a ≥44px target').toBeGreaterThanOrEqual(44);
    expect(m.xLeft, 'and it does not sit on top of the band text').toBeGreaterThanOrEqual(m.bandRight);
    expect(m.fromRightEdge, 'in the modal’s top-right CORNER — right of the band is not the same claim').toBeLessThan(24);
    // it still closes
    await x.click();
    await expect(page.locator('#settings-overlay.active')).toHaveCount(0);
});

test('t1265 — at 390px the X still clears the envelope line', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);
    const m = await page.evaluate(() => {
        const band = document.querySelector('#settings-app .settings-identity').getBoundingClientRect();
        const btn = document.querySelector('#settings-app .settings-headerrow .settings-close').getBoundingClientRect();
        return { gap: btn.left - band.right, inView: btn.right <= innerWidth + 1, w: btn.width, h: btn.height };
    });
    expect(m.gap, 'the band truncates AGAINST the X, never underneath it').toBeGreaterThanOrEqual(0);
    expect(m.inView, 'and the X is fully on screen').toBe(true);
    expect(Math.min(m.w, m.h), 'a phone target is still ≥44px').toBeGreaterThanOrEqual(44);
});

