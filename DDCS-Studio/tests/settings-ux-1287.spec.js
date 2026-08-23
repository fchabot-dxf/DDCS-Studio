import { test, expect } from '@playwright/test';

/**
 * t1287 — the user-ruled UX batch: a save that says what it saved, the reworded store labels, the follow-execution
 * preference where preferences live, and a Settings X that stopped shouting.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE SAVE SAYS WHAT IT SAVED — only the stores that actually changed', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const B = await import('/data/backup.js');
        // a clean baseline: nothing has changed since "the last save"
        B.markWorkspaceSavedToFile('Bench.ddcs');
        const quiet = B.changedStoresSince();
        // …now change ONE store, and only that one may be named
        const s = window.ddcsGetSettings();
        s.machine = { ...(s.machine || {}), x: (Number(s.machine && s.machine.x) || 300) + 7 };
        window.ddcsSaveSettings && window.ddcsSaveSettings();
        const after = B.changedStoresSince();
        return { quiet: quiet.map((c) => c.id), after: after.map((c) => c.id), labels: after.map((c) => c.label) };
    });
    // THE NOTHING-CHANGED CASE tells the truth rather than listing everything
    expect(r.quiet, 'straight after a save, nothing has changed').toEqual([]);
    // …and a real edit names ITS store, not the whole registry
    expect(r.after, 'the settings edit is named').toContain('settings');
    expect(r.after.length, 'and nothing else is claimed alongside it').toBe(1);
    expect(r.labels[0], 'in the words the modal and the FAQ use').toBeTruthy();
});

test('THE FOUR RULED LABELS come from the ONE registry every surface reads', async ({ page }) => {
    await boot(page);
    const labels = await page.evaluate(async () => {
        const B = await import('/data/backup.js');
        return Object.fromEntries(B.BACKUP_STORES.map((s) => [s.id, s.label]));
    });
    expect(labels.variables, 'Variables said nothing about whose or what').toBe('User variables (your #var values)');
    expect(labels.panePrefs, 'Panel layout named a thing the app does not call a panel').toBe('Window layout (which panes are open, their sizes)');
    expect(labels.displayPrefs, 'Preview display prefs was three nouns in a row').toBe('What the 3D preview shows');
    expect(labels.projects, 'Projects (local) buried the word people search for').toBe('Saved programs (projects)');
});

test('FOLLOW EXECUTION is a Settings preference now — not a button on the editor corner', async ({ page }) => {
    await boot(page);
    // the floating toggle is gone from the editor
    expect(await page.locator('.follow-toggle').count(), 'the floating button is gone').toBe(0);
    await page.evaluate(() => window.openSettings());
    await page.waitForTimeout(600);
    // it lives in the EDITOR tab, where editor preferences already are
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#settings-app .settings-tab')].find((b) => b.dataset.target === 'set_tab_compose');
        if (t) t.click();
    });
    await page.waitForSelector('#set_follow_exec', { timeout: 8000 });
    const r = await page.evaluate(async () => {
        const P = await import('/ui/panePrefs.js');
        const cb = document.getElementById('set_follow_exec');
        const sect = cb.closest('.settings-section');
        const title = sect.querySelector('.settings-section-title').textContent.trim();
        const before = P.getFollowExecOn();
        cb.checked = !before; cb.dispatchEvent(new Event('change', { bubbles: true }));
        const after = P.getFollowExecOn();
        // …and the preview's own follow-camera section is a DIFFERENT one
        const camSection = [...document.querySelectorAll('.settings-section-title')].map((t) => t.textContent.trim());
        return { title, before, after, hasCam: camSection.includes('FOLLOW CAMERA'), same: sect.contains(document.getElementById('set_pv_follow_default')) };
    });
    expect(r.title, 'it is filed under what happens while a program plays, in the Editor tab').toBe('WHILE A PROGRAM PLAYS');
    expect(r.after, 'and the checkbox drives the same pref the button did').toBe(!r.before);
    expect(r.hasCam, 'the preview’s follow-camera section still exists').toBe(true);
    expect(r.same, 'but this is NOT in it: one scrolls the text, the other centres the camera').toBe(false);
});

test('THE SETTINGS X: quieter to look at, still finger-sized to press', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openSettings());
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const b = document.querySelector('#settings-app .settings-close');
        const cs = getComputedStyle(b), r = b.getBoundingClientRect();
        // t1265 protects the band's TEXT from being covered — that is what the rule says and what matters
        const band = document.querySelector('#settings-app .settings-identity .si-name');
        const br = band ? band.getBoundingClientRect() : null;
        return {
            hit: { w: Math.round(r.width), h: Math.round(r.height) },
            font: parseFloat(cs.fontSize), bgColor: cs.backgroundColor,
            bg: cs.backgroundImage, shadow: cs.boxShadow, border: cs.borderTopColor,
            // a REAL rectangle intersection: the first version tested the vertical bands only, and the X shares a
            // row with the band by design — it is the horizontal separation that keeps it off the text.
            overlapsBand: br ? !(r.bottom <= br.top || r.top >= br.bottom || r.right <= br.left || r.left >= br.right) : false,
        };
    });
    // THE HIT AREA IS UNTOUCHED — the shrink is visual, not something you have to aim at
    expect(r.hit.w, 'still a finger-sized target').toBeGreaterThanOrEqual(44);
    expect(r.hit.h).toBeGreaterThanOrEqual(44);
    // …and the VISUAL is small and flat: the element box IS the hit area, so what shrank is the GLYPH and its ground
    expect(r.font, 'the glyph itself is small').toBeLessThanOrEqual(14);
    expect(r.bgColor, 'sitting on nothing — no red box').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(r.bg, 'no gradient').toBe('none');
    expect(r.shadow, 'no inset gloss').toBe('none');
    expect(r.border, 'and no ring until you reach for it').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    // t1265 still holds
    expect(r.overlapsBand, 'the X never rides over the identity band').toBe(false);
});

test('A REAL BOUND-FILE SAVE confirms in a DISMISSIBLE POPUP — at every width, phone included', async ({ page }) => {
    await boot(page);
    // a remembered handle writes with NO dialog: the silent gesture the user reported
    await page.evaluate(async () => {
        const h = { kind: 'file', name: 'Shop Bee.ddcs',
            queryPermission: async () => 'granted', requestPermission: async () => 'granted',
            createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
        await window.ddcsAdoptSaveHandle(h);
    });
    const pop = async () => page.evaluate(() => {
        const p = document.getElementById('fileSaveSaid');
        if (!p) return null;
        const c = p.querySelector('.saved-pop-card').getBoundingClientRect();
        return { title: p.querySelector('.saved-pop-title').textContent, name: p.querySelector('.saved-pop-name').textContent,
                 what: p.querySelector('.saved-pop-what').textContent,
                 centred: Math.abs((c.left + c.right) / 2 - window.innerWidth / 2) < 2, w: Math.round(c.width) };
    });
    // t2188 (amendment 1) — #fileSaveChip is deleted; window.ddcsFileSaveState.save is the SAME saveWorkspace()
    // function that used to be its click handler, still exposed as a declared door (see ui/fileSaveState.js's
    // own install() comment) for exactly this kind of direct trigger — the popup under test here is
    // announceSaved()'s own behavior, not any particular UI element's click.
    const save = async () => { await page.evaluate(() => window.ddcsFileSaveState.save()); await page.waitForTimeout(600); };

    // (1) FIRST save to this file: no baseline, so it writes everything — and says so rather than "nothing changed",
    //     which would be false in the case where the most is happening.
    await save();
    let p1 = await pop();
    expect(p1, 'the confirmation exists — there is no browser dialog to do this job').not.toBeNull();
    expect(p1.title).toBe('Saved');
    expect(p1.name, 'it names the file it went to').toMatch(/Shop Bee/);
    // t1321 (USER RULING, superseding this line's original): on a FIRST save there is no baseline, so there is no
    // change list — and the ABSENCE of one is the honest display. The popup shows the title and the filename, and
    // says nothing about what was written.
    expect(p1.what || '', 'a first save names the file and claims nothing about its contents').not.toMatch(/whole workspace/i);
    expect(p1.centred, 'CENTRED — not pinned to a chip a phone does not render').toBe(true);

    // …and it WAITS to be dismissed: a message naming what was written must not vanish before it is read
    await page.waitForTimeout(1200);
    expect(await pop(), 'still there a beat later — no timer').not.toBeNull();
    await page.locator('.saved-pop-ok').click();
    expect(await pop(), 'a click dismisses it').toBeNull();

    // (2) SAVE AGAIN with nothing touched: honest, not a claim of work that was not done
    await save();
    const p2 = await pop();
    expect(p2.title, 'it does not say Saved when nothing was').toBe('Already saved');
    expect(p2.what).toMatch(/nothing had changed/i);
    await page.keyboard.press('Escape');
    expect(await pop(), 'Esc dismisses it too').toBeNull();

    // (3) CHANGE ONE STORE and save: it names THAT store and no others
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { ...(s.machine || {}), y: (Number(s.machine && s.machine.y) || 300) + 5 };
        window.ddcsSaveSettings && window.ddcsSaveSettings();
    });
    await save();
    const p3 = await pop();
    expect(p3.what, 'the changed store is named').toMatch(/Settings/);
    expect(p3.what, 'and the untouched ones are not').not.toMatch(/wizards|CAM pack|presets/i);
    // the count QUALIFIES the store; it never stands in for it (a settings edit once read simply "4 tools")
    expect(p3.what, 'the store is named, not just counted').toMatch(/[A-Za-z]/);
    await page.locator('#fileSaveSaid').click();
});

test('THE POPUP WORKS ON A PHONE — the width where the chip it used to hang off is not even rendered', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await boot(page);
    await page.evaluate(async () => {
        const h = { kind: 'file', name: 'Phone.ddcs', queryPermission: async () => 'granted',
            requestPermission: async () => 'granted', createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
        await window.ddcsAdoptSaveHandle(h);
        await window.ddcsSaveWorkspace();          // the save path a phone actually reaches
        if (window.ddcsAnnounceSaved) window.ddcsAnnounceSaved({ ok: true, name: 'Phone.ddcs', changed: null });
    });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
        const p = document.getElementById('fileSaveSaid');
        if (!p) return null;
        const c = p.querySelector('.saved-pop-card').getBoundingClientRect();
        return { visible: c.width > 0 && c.height > 0, insideX: c.left >= 0 && c.right <= window.innerWidth,
                 insideY: c.top >= 0 && c.bottom <= window.innerHeight, ok: !!p.querySelector('.saved-pop-ok') };
    });
    expect(r, 'the popup exists at phone width').not.toBeNull();
    expect(r.visible, 'and it is on screen').toBe(true);
    expect(r.insideX, 'fitting the viewport horizontally').toBe(true);
    expect(r.insideY, 'and vertically').toBe(true);
    expect(r.ok, 'with a finger-sized way to dismiss it').toBe(true);
});
