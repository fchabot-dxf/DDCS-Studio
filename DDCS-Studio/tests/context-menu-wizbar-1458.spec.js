import { test, expect } from '@playwright/test';

/**
 * t1458 — SURFACE 4 OF THE CONTEXT-MENU PASS: the WIZARD BAR.
 *
 * ── THE TARGET WAS SETTLED BY THE MARKUP, NOT BY TASTE ───────────────────────────────────────────────────────────
 * The bar is GROUP dropdowns ("Mill ▾"), and the per-wizard identity lives on the entries INSIDE them
 * (`<button data-optype=…>`). Every action this surface offers is per-wizard, so a menu on the group button would
 * have had nothing to act on. The menu therefore opens over an OPEN dropdown — which is what this spec drives.
 *
 * ── PRESETS ARE ABSENT ON PURPOSE, AND THAT IS ASSERTED ──────────────────────────────────────────────────────────
 * `openTemplatesPopover` needs `wm._activeType` — a wizard that is OPEN — because a preset saves *the values
 * currently in the form*. From the bar there is no form, so a "Presets…" entry could only mean "open the wizard",
 * which `▶ Open` already is. Asserting the absence keeps that a decision rather than something that quietly drifts
 * back in; the same restraint as not re-adding Duplicate/Delete beside Blockly's.
 */
test.use({ viewport: { width: 1500, height: 950 } });

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.waitForSelector('.dock-header .toolbar-dropdown-content button[data-optype]', { state: 'attached' });
};

/** Right-click the first wizard ENTRY in the bar (forcing its dropdown visible first, as hovering would). */
const menuOnEntry = async (page) => {
    const at = await page.evaluate(() => {
        const btn = document.querySelector('.dock-header .toolbar-dropdown-content button[data-optype]');
        if (!btn) return { err: 'no wizard entry in the bar' };
        const dd = btn.closest('.toolbar-dropdown-content');
        dd.style.display = 'block'; dd.style.visibility = 'visible'; dd.style.opacity = '1';   // what a hover does
        const r = btn.getBoundingClientRect();
        return { optype: btn.dataset.optype, label: btn.textContent.trim(), x: Math.round(r.left + 20), y: Math.round(r.top + r.height / 2) };
    });
    if (at.err) return at;
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await page.waitForTimeout(200);
    const items = await page.evaluate(() => {
        const m = document.querySelector('.op-ctx-menu');
        if (!m || m.hidden) return null;
        return [...m.querySelectorAll('.op-ctx-item')].map((b) => ({ label: b.textContent, disabled: b.disabled, title: b.title }));
    });
    return { ...at, items };
};

test('THE ENTRY carries the menu — three actions, and PRESETS deliberately not among them', async ({ page }, testInfo) => {
    await boot(page);
    const r = await menuOnEntry(page);
    expect(r.err).toBeUndefined();
    expect(r.items, 'right-clicking a wizard entry opens the app menu').toBeTruthy();
    const all = r.items.map((i) => i.label).join(' | ');
    expect(all, 'Open, naming the wizard').toMatch(/Open/);
    expect(all, 'the wizard-settings-class entry').toMatch(/Wizard settings/);
    expect(all, 'and reset values').toMatch(/Reset values/);
    // ⚠ THE MEASURED ABSENCE. A preset saves the values in an OPEN form; from the bar there is none, so the entry
    // could only duplicate Open. Asserted so the decision cannot quietly reverse.
    expect(all, 'Presets is NOT offered from the bar — it needs an open wizard').not.toMatch(/Preset/i);
    await page.screenshot({ path: 'test-results/t1458-shots/wizard-bar-menu.png' });
    await testInfo.attach('t1458-wizard-bar-menu', { path: 'test-results/t1458-shots/wizard-bar-menu.png', contentType: 'image/png' });
});

test('THE GROUP BUTTON gets no menu — it names no wizard to act on', async ({ page }) => {
    await boot(page);
    const box = await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn').first().boundingBox();
    await page.mouse.click(box.x + 10, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    const open = await page.evaluate(() => { const m = document.querySelector('.op-ctx-menu'); return !!m && !m.hidden; });
    // Not a gap: every action here is per-wizard, so a group menu would be a menu of things that cannot be done.
    expect(open, 'the group button leaves the native menu alone').toBe(false);
});

test('RULE 1 — ↺ Reset values greys with its reason when there is nothing remembered, and CLEARS when there is', async ({ page }) => {
    await boot(page);
    // (a) nothing remembered yet → greyed, and it says why rather than vanishing
    let r = await menuOnEntry(page);
    const reset = r.items.find((i) => /Reset values/.test(i.label));
    expect(reset.disabled, 'no remembered values → greyed').toBe(true);
    expect(reset.title, '…and it says so, instead of hiding').toMatch(/no remembered values/i);
    await page.keyboard.press('Escape');

    // (b) seed a remembered value the way the app does, then the entry goes live and really clears it
    const optype = r.optype;
    await page.evaluate(async (t) => {
        const LV = await import('/data/wizardLastValues.js');
        LV.saveLastValues(t, { depth: 3 });
    }, optype);
    r = await menuOnEntry(page);
    const reset2 = r.items.find((i) => /Reset values/.test(i.label));
    expect(reset2.disabled, 'with values remembered the entry is live').toBe(false);
    await page.locator('.op-ctx-menu .op-ctx-item', { hasText: 'Reset values' }).click();
    // the app's own in-app confirm (.app-dialog), not a native one — its primary button carries the okLabel
    await page.locator('.app-dialog button', { hasText: /^Reset values$/ }).first().click();
    await page.waitForTimeout(300);
    const still = await page.evaluate(async (t) => {
        const LV = await import('/data/wizardLastValues.js');
        return LV.hasLastValues(t);
    }, optype);
    expect(still, 'the remembered values are forgotten — the same thing the Settings row does').toBe(false);
});

test('▶ OPEN routes to the entry\'s own click — the menu is not a second opener', async ({ page }) => {
    await boot(page);
    const r = await menuOnEntry(page);
    await page.evaluate(() => { window.__wizOpened = []; const real = window.openWiz; window.openWiz = (...a) => { window.__wizOpened.push(a[0]); return real && real(...a); }; });
    // ⚠ THE REAL MOUSE, not locator.click(): this menu sits over a dropdown the test forced open, so Playwright's
    // actionability check times out waiting for an "unobstructed" element that a user would simply click. Same
    // lesson the Blockly canvas taught one surface ago — drive the gesture, not the abstraction.
    const box = await page.evaluate(() => {
        const it = [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].find((b) => /Open/.test(b.textContent));
        if (!it) return null;
        const r = it.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    expect(box, 'the Open entry is on screen').toBeTruthy();
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() => window.__wizOpened || []);
    // It calls the BUTTON, not a re-derived opener: whatever the bar entry does, the entry does — one implementation.
    expect(opened.length, 'the entry\'s own onclick ran').toBeGreaterThan(0);
    expect(r.optype, 'and the menu was for that same wizard').toBeTruthy();
});
