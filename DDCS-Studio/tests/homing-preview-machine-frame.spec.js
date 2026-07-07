import { test, expect } from '@playwright/test';

/**
 * HOMING PREVIEW — the tool renders in the MACHINE frame (t497). The homing LOGIC/engine/emit are correct (Z homes to
 * the top, engine.pos.z=-5), but the RENDERED tool used to ride the stock-floor-shifted part frame → with a stock shown
 * it drew ~95mm too low (worldZ ≈ -100, the envelope BOTTOM) = the "plunge" the operator WATCHES. Fix: the homing tool
 * ignores the part-frame shift (viz.setToolMachineFrame), so it draws at the TOP (rendered worldZ ≈ engine.pos.z) whether
 * or not a stock is shown; the STOCK + CUTTING ops are untouched. VERIFY IN THE REAL APP (drive the wizard, not a fn).
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function homingRenderedZ(page, stockShown) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate((stockShown) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, method: 'native', backoff: 5 }, x: { enable: true, order: 2, method: 'native' }, y: { enable: true, order: 3, method: 'native' } } };
        s.stock = stockShown ? { show: true, x: 100, y: 100, z: 25, datum: 'nnp' } : { show: false };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, stockShown);
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
    await page.evaluate(() => { const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); });
    const out = [];
    for (let i = 0; i < 22; i++) {
        out.push(await page.evaluate(() => {
            const p = window.ddcsStudio.wizardManager._activePanel;
            const ez = p && p.engine && p.engine.pos ? +p.engine.pos.z.toFixed(1) : null;
            let w = null; try { if (p && p.viz && p.viz._animTool) { p.viz._animTool.updateWorldMatrix(true, false); w = +p.viz._animTool.getWorldPosition(new (p.viz.THREE.Vector3)()).z.toFixed(1); } } catch (e) { /* */ }
            return { ez, w };
        }));
        await page.waitForTimeout(110);
    }
    const ez = out.map((s) => s.ez).filter((v) => v != null), w = out.map((s) => s.w).filter((v) => v != null);
    return { ezMin: Math.min(...ez), ezMax: Math.max(...ez), wMin: Math.min(...w), wMax: Math.max(...w) };
}

test('REAL APP: with a STOCK SHOWN, the rendered homing tool reaches the TOP (~-5), matching engine.pos.z — NOT -100', async ({ page }) => {
    const r = await homingRenderedZ(page, true);
    // the engine homes to the top (-5) — the logic was always correct
    expect(r.ezMax, 'engine.pos.z reaches the machine-0/top home').toBe(0);
    expect(r.ezMin, 'engine backs off to -5').toBe(-5);
    // THE FIX: the RENDERED tool now tracks the engine (top ~-5), NOT the stock-floor-shifted bottom (~-100)
    expect(r.wMax >= -6, `the rendered tool reaches the TOP (worldZ max=${r.wMax}), NOT the bottom`).toBe(true);
    expect(r.wMin >= -8, `the rendered tool never drops near the envelope bottom (worldZ min=${r.wMin}); the plunge is gone`).toBe(true);
    expect(Math.abs(r.wMin - r.ezMin) < 2, `the rendered worldZ (${r.wMin}) matches the engine pos (${r.ezMin})`).toBe(true);
});

test('REAL APP: with the STOCK HIDDEN, the rendered homing tool is still at the TOP (~-5)', async ({ page }) => {
    const r = await homingRenderedZ(page, false);
    expect(r.wMax >= -6, `stock hidden: rendered tool at the TOP (worldZ max=${r.wMax})`).toBe(true);
    expect(Math.abs(r.wMin - r.ezMin) < 2, `rendered worldZ (${r.wMin}) matches engine pos (${r.ezMin})`).toBe(true);
});

test('a CUTTING op (drill) leaves the tool on the stock-placed part frame (machine-frame flag OFF — unchanged)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z: -120, show: true };
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };
    });
    await page.evaluate(() => window.openWiz('drill'));
    await page.waitForSelector('#wiz_drill', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    const flag = await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz ? !!p.viz._toolMachineFrame : 'no-viz'; });
    expect(flag, 'a cutting op does NOT set the machine-frame tool flag (it rides the stock-placed part frame, unchanged)').toBe(false);
});

test('DRIVE THE APP: the homing tool renders AT THE TOP with a stock shown — screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, method: 'native', backoff: 5 }, x: { enable: true, order: 2, method: 'native' }, y: { enable: true, order: 3, method: 'native' } } };
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };   // a workpiece IS shown (the human's scenario)
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
    await page.evaluate(() => { const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 10000 });
    const w = await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; p.viz._animTool.updateWorldMatrix(true, false); return +p.viz._animTool.getWorldPosition(new (p.viz.THREE.Vector3)()).z.toFixed(1); });
    expect(w >= -8, `the homing tool rests at the TOP (worldZ=${w}) with a stock shown, not the -100 bottom`).toBe(true);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_tool_at_top_with_stock.png' });
});
