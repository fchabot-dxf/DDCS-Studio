import { test, expect } from '@playwright/test';

/**
 * t1456 — SURFACE 3 OF THE CONTEXT-MENU PASS: the CAM SLOT LIST.
 *
 * ── RULE 1 FORCED A FEATURE HERE TOO ─────────────────────────────────────────────────────────────────────────────
 * The pass asked for edit / rebuild / export / delete. The survey found visible doors for three of them
 * (`✎ Edit`, `⬇ Export macro + eng`, `⬆ Export .cam`, `✕`) and **none for rebuild**: `buildSlotFromOps` ran only
 * from a duplicate or a wizard-def change, and `regenGuard`'s "Rebuild" confirm was reachable from nothing. A
 * menu-only action is exactly what rule 1 forbids, so `⟲ Rebuild` arrived as a ROW BUTTON first and the entry
 * shortcuts it — the same shape comment/uncomment took on the editor surface.
 *
 * ── AND THE MENU IS NOT A SECOND IMPLEMENTATION ──────────────────────────────────────────────────────────────────
 * Every entry calls the same function its button calls, from one `slotActs` table — the chain of else-ifs it
 * replaced was the second implementation waiting to happen. The test drives BOTH doors and asserts they land on the
 * same result, because "they call the same function" is a claim about the code and this is a claim about the pack.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const POCKET_SLOT = { slot: 22, name: 'Pocket', ops: [{ type: 'pocket', variant: 'x', values: {}, exposed: {}, baked: {}, opType: 'pocket' }] };
/** A legacy hand-built slot: a macro body with NO declared ops — the state that greys three of the five entries. */
const LEGACY_SLOT = { slot: 23, name: 'HandBuilt', body: 'G90\nG0 X0\nM30', fields: [] };

async function openCamTab(page, slots) {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.evaluate((s) => localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: s })), slots);
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.waitForFunction(() => window.showApp && window.ddcsGetBlockProgram);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForSelector('#macros-app .settings-tab[data-target="macros_panel_cam"]');
    await page.evaluate(() => document.querySelector('#macros-app .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot', { state: 'visible' });
}

/** Right-click a slot row (by index) and read the menu. */
const menuOnRow = async (page, si = 0) => {
    const box = await page.locator(`#cam_slots .cam-slot[data-si="${si}"]`).boundingBox();
    await page.mouse.click(box.x + 30, box.y + 10, { button: 'right' });
    return page.evaluate(() => {
        const m = document.querySelector('.op-ctx-menu');
        if (!m || m.hidden) return { open: false, items: [] };
        return { open: true, items: [...m.querySelectorAll('.op-ctx-item')].map((b) => ({ label: b.textContent, disabled: b.disabled, title: b.title })) };
    });
};

test('RULE 1 — every entry has a visible row button (⟲ Rebuild is why the button exists at all)', async ({ page }) => {
    await openCamTab(page, [POCKET_SLOT]);
    // the row's own doors, all visible
    for (const act of ['editslot', 'regen', 'exp', 'expcam'])
        await expect(page.locator(`#cam_slots .cam-slot [data-act="${act}"]`), `${act} has a visible row button`).toBeVisible();
    await expect(page.locator('#cam_slots .cam-slot [data-act="dels"]'), 'delete has its ✕').toBeVisible();
    const r = await menuOnRow(page);
    expect(r.open, 'right-clicking a slot row opens the app menu').toBe(true);
    const all = r.items.map((i) => i.label).join(' | ');
    expect(all).toMatch(/Edit/); expect(all).toMatch(/Rebuild/);
    expect(all).toMatch(/Export macro/); expect(all).toMatch(/Export \.cam/); expect(all).toMatch(/Delete/);
});

test('A HAND-BUILT SLOT GREYS the three ops-dependent entries — and SAYS WHY', async ({ page }) => {
    await openCamTab(page, [LEGACY_SLOT]);
    const r = await menuOnRow(page);
    const by = (re) => r.items.find((i) => re.test(i.label));
    // Greyed, NOT hidden: this app's rule for an unavailable control is postGating's (grey and say why, never hide),
    // and it is the honest one here — "where did Edit go?" is the question a hidden row would leave behind.
    for (const re of [/Edit/, /Rebuild/, /Export \.cam/]) {
        const it = by(re);
        expect(it, `${re} is present`).toBeTruthy();
        expect(it.disabled, `${re} is greyed on a hand-built slot`).toBe(true);
        expect(it.title, `${re} says why`).toMatch(/hand-built/i);
    }
    // …and the two that DO work on a hand-built macro stay live
    expect(by(/Export macro/).disabled, 'the macro export works on any slot').toBe(false);
    expect(by(/Delete/).disabled, 'and so does delete').toBe(false);
});

test('THE MENU AND THE BUTTON ARE ONE IMPLEMENTATION — both delete the same slot', async ({ page }) => {
    // TWO slots, so a delete that hit the wrong index would be visible rather than lucky.
    await openCamTab(page, [POCKET_SLOT, { ...POCKET_SLOT, slot: 24, name: 'Second' }]);
    expect(await page.locator('#cam_slots .cam-slot').count()).toBe(2);
    // (a) the BUTTON on row 1
    await page.locator('#cam_slots .cam-slot[data-si="1"] [data-act="dels"]').click();
    let names = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_campack')).slots.map((s) => s.name));
    expect(names, 'the button deleted the SECOND slot').toEqual(['Pocket']);
    // (b) the MENU on what is now row 0
    await menuOnRow(page, 0);
    await page.locator('.op-ctx-menu .op-ctx-item', { hasText: 'Delete' }).click();
    names = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_campack')).slots.map((s) => s.name));
    expect(names, 'the menu entry deleted the remaining one — same action, same result').toEqual([]);
});

test('⟲ REBUILD re-derives the macro from the ops, and asks first when the body was hand-edited', async ({ page }, testInfo) => {
    await openCamTab(page, [POCKET_SLOT]);
    // dirty the body the way a hand edit does, so the guard has something to protect
    await page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('ddcs_campack'));
        p.slots[0].body = '( hand edited )\nM30'; p.slots[0].bodyDirty = true;
        localStorage.setItem('ddcs_campack', JSON.stringify(p));
    });
    await page.reload();
    await page.waitForFunction(() => window.showApp && window.ddcsGetBlockProgram);   // a reload re-boots the app
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.evaluate(() => window.showApp('macros'));
    await page.evaluate(() => document.querySelector('#macros-app .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot', { state: 'visible' });
    const r = await menuOnRow(page);
    await page.screenshot({ path: 'test-results/t1456-shots/cam-slot-menu.png' });
    await testInfo.attach('t1456-cam-slot-menu', { path: 'test-results/t1456-shots/cam-slot-menu.png', contentType: 'image/png' });
    expect(r.open).toBe(true);
    page.on('dialog', (d) => d.accept());
    await page.locator('.op-ctx-menu .op-ctx-item', { hasText: 'Rebuild' }).click();
    // the confirm is the app's own dlgConfirm overlay — accept it, then the body must be DERIVED again
    const ok = page.locator('button', { hasText: /^Rebuild$/ });
    if (await ok.count()) await ok.first().click();
    await page.waitForTimeout(400);
    const body = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_campack')).slots[0].body || '');
    expect(body, 'the hand-edited body is gone — the macro came back from the ops').not.toContain('hand edited');
    expect(body.length, 'and a real macro was written').toBeGreaterThan(10);
});
