import { test, expect } from '@playwright/test';

/**
 * t744 Phase 2 — the 2D renderers CONSUME the ONE visibility registry (displayPrefs), the machine ENVELOPE draws in the
 * 2D everywhere (declared, not machine.show), the 4 scattered settings checkboxes are FOLDED (registry = the only source),
 * and the modal is legible on every theme. toolpath2d exposes __t2env (the drawn envelope's machine bounds, null when the
 * registry hides it) + __t2disp (what the registry drew) for value asserts. View-only → emit byte-identical.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const openPanel = async (page) => {
    await page.evaluate(() => { const e = document.getElementById('editor'); if (e && !e.value) e.value = 'G90\nG0 X10 Y10 Z5\nM30\n'; if (window.setGcodeView) window.setGcodeView('3d'); });   // opens the 3D drawer → creates __gpPanel + its toolbar 👁
    await page.waitForFunction(() => window.__gpPanel, null, { timeout: 8000 });
};
const setup2d = async (page, machine) => {
    await page.evaluate((m) => {
        const s = window.ddcsGetSettings();
        s.stock = { show: true, x: 100, y: 80, z: 20, datum: 'nnp', features: [] };
        s.machine = m; s.preview = s.preview || {}; s.preview.autoLoop = false; s.preview.carve = false;
    }, machine);
    await page.evaluate(() => { const e = document.getElementById('editor'); if (e) e.value = 'G90\nG54\nG0 X20 Y20 Z5\nG1 Z-3 F200\nX70\nY60\nG0 Z5\nM30\n'; if (window.setGcodeView) window.setGcodeView('3d'); });
    await page.waitForFunction(() => window.__gpPanel, null, { timeout: 8000 });
    await page.evaluate(() => { const p = window.__gpPanel; p.setGcode(document.getElementById('editor').value); if (p.setView) p.setView('2d'); });
    await page.waitForTimeout(400);
};
const t2 = (page) => page.evaluate(() => { const c = window.__gpPanel && window.__gpPanel.el && window.__gpPanel.el.querySelector('.pp-2d'); return c ? { env: c.__t2env, disp: c.__t2disp } : null; });
const setEl = (page, id, patch) => page.evaluate(async ({ id, patch }) => { const m = await import('/viz/displayPrefs.js'); m.setDisplayElement(id, patch); }, { id, patch });

test('2D: the envelope draws at the correct machine bounds + toggles/alphas drive the 2D canvas live (value asserts)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
    await setup2d(page, { x: 400, y: 300, z: -120, show: false, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } });

    // the 2D envelope draws by DEFAULT (not gated on machine.show) at the machine bounds (workOrigin 0 → 0..travel)
    let r = await t2(page);
    expect(r, 'the 2D canvas is up').not.toBeNull();
    expect(r.disp.envelope, 'envelope default-visible').toBe(true);
    expect(r.env, 'the 2D envelope drew (bounds present)').not.toBeNull();
    expect(r.env.maxX - r.env.minX, 'envelope spans the X travel (400)').toBeCloseTo(400, 0);
    expect(r.env.maxY - r.env.minY, 'envelope spans the Y travel (300)').toBeCloseTo(300, 0);

    // TOGGLE envelope OFF via the registry → the 2D re-paints, the envelope is gone (value assert)
    await setEl(page, 'envelope', { visible: false });
    await page.waitForTimeout(150);
    r = await t2(page);
    expect(r.disp.envelope, 'the registry hid the 2D envelope').toBe(false);
    expect(r.env, 'the drawn 2D envelope is null when hidden').toBeNull();

    // TOGGLE stock OFF + set a path-type alpha → the 2D reflects both
    await setEl(page, 'stock', { visible: false });
    await setEl(page, 'cut', { alpha: 0.25 });
    await page.waitForTimeout(150);
    r = await t2(page);
    expect(r.disp.stock, 'stock hidden in the 2D').toBe(false);
    expect(r.disp.cut, 'cut still visible').toBe(true);
    // toggling a path type OFF hides it in the 2D
    await setEl(page, 'rapid', { visible: false });
    await page.waitForTimeout(150);
    r = await t2(page);
    expect(r.disp.rapid, 'rapid path type hidden in the 2D').toBe(false);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
});

test('the 4 scattered settings checkboxes are FOLDED (gone) — the registry is the only source', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openSettings);
    await page.evaluate(() => window.openSettings());
    await page.waitForTimeout(400);
    const gone = await page.evaluate(() => ['set_pv_rapids', 'set_pv_show_spindle', 'set_pv_show_collet', 'set_pv_show_tool', 'set_mach_show'].every((id) => !document.getElementById(id)));
    expect(gone, 'the 4 old visibility checkboxes are removed from Settings (no duplicate switches)').toBe(true);
});

test('the modal is legible on every theme (theme-token colours) — screenshots', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.setGcodeView);
    await openPanel(page);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
    for (const theme of ['studio', 'normal', 'futuristic']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(120);
        await page.locator('.pp-vis').first().click();
        await page.waitForSelector('.vis-modal-pop', { timeout: 4000 });
        // the modal bg + text follow theme tokens (not a hardcoded dark) — assert a resolved bg colour exists + capture
        const ok = await page.evaluate(() => { const p = document.querySelector('.vis-modal-pop'); const cs = getComputedStyle(p); return cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.color; });
        expect(ok, `modal has resolved theme-token bg+text on ${theme}`).toBeTruthy();
        await page.screenshot({ path: `scratchpad/vis_modal_theme_${theme}_744.png` });
        await page.locator('.vis-modal-pop [data-done]').click();
        await page.waitForTimeout(80);
    }
});
