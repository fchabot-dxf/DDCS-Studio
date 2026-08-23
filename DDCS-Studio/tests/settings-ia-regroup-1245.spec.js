import { test, expect } from '@playwright/test';

/**
 * t1245 (user) — THE SHRINK. Settings' "General" tab was a catch-all of NINE subtabs, and the question "how should
 * these nine be grouped?" turned out to be the wrong question: most of them were not settings at all.
 *
 *   Appearance · Preview · Editor · Wizards  →  STAY, as Look and feel (Wizards renamed WIZARD BAR — it configures
 *                                               the bar, it does not list wizards)
 *   Workspace                                →  DELETED (AT THE TIME). Its two buttons opened the workspace
 *                                               manager, which the quick menu's Save / Open already do. Settings
 *                                               kept ZERO workspace controls; the identity band above the strip
 *                                               still SAID which workspace this is, display-only.
 *                                               ⚠ SUPERSEDED (t2192): a Workspace tab exists again, but for a
 *                                               different job — the INVENTORY (counts + open-manager buttons off
 *                                               data/backup.js's own declared stores), not Save/Open controls.
 *                                               The identity band moved OUT of the always-visible header and
 *                                               INTO this new tab, since it is workspace content.
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
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openSettings, null, { timeout: 15000 });   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#settings-app .settings-tabs .settings-main-tab', { timeout: 8000 });
};
const openMenu = async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && document.querySelector('#hdrPostMenu .hq-identity-line'), null, { timeout: 15000 });
    await page.click('#hdrPostBtn');
    await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 6000 });
};
// t2149 (BACKLOG #9) — Help and Rate/Feedback moved from the FILE menu (openMenu above, #hdrPostMenu) to the
// new APP menu (the logo, #hdrAppMenu) — neither acts on this workspace/program.
const openAppMenu = async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio, null, { timeout: 15000 });
    await page.click('#hdrAppBtn');
    await page.waitForSelector('#hdrAppMenu:not([hidden])', { timeout: 6000 });
};

test('the strip is FOUR tabs — Look and feel, Controller, Hardware, Workspace', async ({ page }) => {
    // t2192 — Workspace joined as a fourth, for a different job than the three above (the inventory, not
    // settings): scratchpad/t-workspace-tab.md. Not a return of the DELETED t1245 Workspace subtab (that one
    // duplicated the workspace manager's Save/Open) — this one answers what IS in the file.
    await openSettings(page);
    const strip = await page.evaluate(() => [...document.querySelectorAll('#settings-app .settings-tabs .settings-main-tab')]
        .map((b) => ({ group: b.dataset.group, label: b.textContent.trim() })));
    expect(strip).toEqual([
        { group: 'lookfeel', label: 'Look and feel' },
        { group: 'controller', label: 'Controller' },
        { group: 'hardware', label: 'Hardware' },
        { group: 'workspace', label: 'Workspace' },
    ]);
    expect(await page.locator('.settings-main-tab[data-group="general"]').count(), 'the catch-all is gone').toBe(0);
});

test('Look and feel holds FOUR subtabs (t2196 — Wizard bar retired as a sub-tab; its tree moved into a row on Appearance)', async ({ page }) => {
    // t2125 (SOUND-PLAN.md amendment 4) — Sound joined as a sub-tab peer of Appearance (not a 4th MAIN
    // tab: ~11 toggle rows is too thin for one and too big to bolt onto Appearance), so this grew from
    // four to five. Adjacent to Appearance on purpose — sound follows the theme, which lives there.
    // t2196 — and back to four: the "Wizard bar" sub-tab (a 400+-line tree) buried Appearance's own theme/
    // setup-health controls under it. The tree lives on, in its own small panel — see wizard-manager.spec.js.
    await openSettings(page);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#settings-app .settings-sidebar .settings-tab[data-group="lookfeel"]')]
        .map((b) => ({ id: b.dataset.target, label: b.textContent.trim() })));
    expect(tabs).toEqual([
        { id: 'set_tab_appearance', label: 'Appearance' },
        { id: 'set_tab_sound', label: 'Sound' },
        { id: 'set_tab_preview', label: 'Preview' },
        { id: 'set_tab_compose', label: 'Editor' },
    ]);
    // and all four still open — a rename that broke its panel would be worse than the old name
    for (const t of tabs) {
        await page.click(`.settings-tab[data-target="${t.id}"]`);
        await expect(page.locator(`#${t.id}`), `${t.label} opens`).toBeVisible();
    }
    // the wizard-bar door lives on Appearance now, not a sidebar entry of its own
    await page.click('.settings-tab[data-target="set_tab_appearance"]');
    await expect(page.locator('#set_wizbar_open'), 'Wizard bar… row is on Appearance').toBeVisible();
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

// t2149 (human amendment: "i meant seperate them in 2 panel") — INVERTED: was ONE Help row opening ONE
// two-section panel; now TWO rows, each opening its OWN panel. FAQ and About are different things at very
// different visit frequencies (see helpPanel.js's own header for the full reasoning).
test('FAQ and About are TWO quick-menu rows, each opening its OWN panel', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openAppMenu(page);
    const faqRow = page.locator('#hdrAppMenu [data-act="helpFaq"]');
    const aboutRow = page.locator('#hdrAppMenu [data-act="helpAbout"]');
    await expect(faqRow, 'ONE FAQ row').toHaveCount(1);
    await expect(aboutRow, 'ONE About row').toHaveCount(1);
    // no combined "Help" row survives either
    await expect(page.locator('#hdrAppMenu [data-act="help"]'), 'the old combined Help row is gone').toHaveCount(0);

    await faqRow.click();
    await expect(page.locator('#helpOverlay')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#help_faq'), 'the FAQ panel').toBeVisible();
    await expect(page.locator('#help_about'), 'About is NOT in the same panel any more').toHaveCount(0);
    expect(await page.locator('#help_faq details').count(), 'the FAQ moved whole, not summarised').toBeGreaterThanOrEqual(10);
    await page.keyboard.press('Escape');
    await expect(page.locator('#helpOverlay'), 'Esc closes it').toHaveCount(0);

    await openAppMenu(page);
    await page.locator('#hdrAppMenu [data-act="helpAbout"]').click();
    await expect(page.locator('#helpOverlay')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#help_about'), 'the About panel').toBeVisible();
    await expect(page.locator('#help_faq'), 'FAQ is NOT in the same panel any more').toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#helpOverlay'), 'Esc closes it').toHaveCount(0);
});

test('ONE feedback door: the Settings Report-a-bug is gone and Rate / Feedback is still there', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openAppMenu(page);
    await expect(page.locator('#hdrAppMenu [data-act="rate"]'), 'the surviving door').toHaveCount(1);
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
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openWorkspaceManager);
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
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openWorkspaceManager && window.ddcsMarkWorkspaceSaved);
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
    expect(panels.length, 'fifteen subtabs (t2125 added Sound, t2192 added the Workspace tab, t2196 removed Wizard bar)').toBe(15);

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
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openSetupChecklist && window.openSettings, null, { timeout: 15000 });

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

test('all FOUR main tabs still fit a 390px phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);
    const m = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#settings-app .settings-tabs .settings-main-tab')].map((b) => b.getBoundingClientRect());
        return { overflowsRight: tabs.some((t) => t.right > innerWidth + 1), bodyScroll: document.body.scrollWidth, vw: innerWidth };
    });
    expect(m.overflowsRight, 'nothing runs off the edge').toBe(false);
    expect(m.bodyScroll, 'and the page never scrolls sideways').toBeLessThanOrEqual(m.vw);
});

test('t1265 — the close X lives in its own header row, not the tab strip', async ({ page }) => {
    // t2192 — the identity band that USED to share this row moved into the Workspace tab (workspace content
    // belongs beside the rest of the workspace's own inventory, not floating above unrelated tabs), so the X's
    // own claim shrinks to what is still true of it: its own corner, off the tab strip, still a real target.
    await openSettings(page);
    expect(await page.locator('#settings-app .settings-head .settings-close').count(),
        'the tab row does not carry it').toBe(0);
    const x = page.locator('#settings-app .settings-headerrow .settings-close');
    await expect(x, 'the header row does').toBeVisible();

    const m = await page.evaluate(() => {
        const btn = document.querySelector('#settings-app .settings-headerrow .settings-close').getBoundingClientRect();
        const head = document.querySelector('#settings-app .settings-head').getBoundingClientRect();
        const modal = document.getElementById('settings-app').getBoundingClientRect();
        return { w: btn.width, h: btn.height, fromRightEdge: modal.right - btn.right, aboveTabs: btn.bottom <= head.top + 1 };
    });
    expect(m.aboveTabs, 'above the tab strip entirely').toBe(true);
    expect(Math.min(m.w, m.h), 'still a ≥44px target').toBeGreaterThanOrEqual(44);
    expect(m.fromRightEdge, 'in the modal’s top-right corner').toBeLessThan(24);
    // it still closes
    await x.click();
    await expect(page.locator('#settings-overlay.active')).toHaveCount(0);
});

test('t2192 — on the Workspace tab, the identity band sits below the (now solitary) header X, never under it', async ({ page }) => {
    await openSettings(page);
    await page.click('.settings-main-tab[data-group="workspace"]');
    await page.waitForSelector('#set_identity_band', { state: 'visible' });
    const m = await page.evaluate(() => {
        const band = document.querySelector('#set_identity_band').getBoundingClientRect();
        const btn = document.querySelector('#settings-app .settings-headerrow .settings-close').getBoundingClientRect();
        return { bandBelowX: band.top >= btn.bottom - 1, overlaps: !(band.right <= btn.left || band.left >= btn.right || band.bottom <= btn.top || band.top >= btn.bottom) };
    });
    expect(m.overlaps, 'the band never sits under the X').toBe(false);
    expect(m.bandBelowX, 'the band is content, below the header row').toBe(true);
});

test('t1265/t2192 — at 390px the X is still a full 44px target, fully on screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);
    const m = await page.evaluate(() => {
        const btn = document.querySelector('#settings-app .settings-headerrow .settings-close').getBoundingClientRect();
        return { inView: btn.right <= innerWidth + 1, w: btn.width, h: btn.height };
    });
    expect(m.inView, 'the X is fully on screen').toBe(true);
    expect(Math.min(m.w, m.h), 'a phone target is still ≥44px').toBeGreaterThanOrEqual(44);
});

