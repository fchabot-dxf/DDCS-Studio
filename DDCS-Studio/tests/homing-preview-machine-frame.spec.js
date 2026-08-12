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
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    await page.evaluate((stockShown) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, method: 'native', backoff: 5 }, x: { enable: true, order: 2, method: 'native' }, y: { enable: true, order: 3, method: 'native' } } };
        s.stock = stockShown ? { show: true, x: 100, y: 100, z: 25, datum: 'nnp' } : { show: false };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, stockShown);
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
    // t542 — the preview now plays the REAL emit (G31 with slow F100 re-touches, ~12s for 3 axes at real speed); simSpeed
    // it up so the FULL trajectory (mid Start -> seek -> settle) lands inside the sampling window below (was the proxy's ~1s).
    await page.evaluate(() => { const host = document.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 20; });
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
    const last = [...out].reverse().find((s) => s.ez != null && s.w != null) || {};   // t540 — the SETTLED (homed rest) sample; the switch-touch peak (0) is a transient the sampling skips
    return { ezMin: Math.min(...ez), ezMax: Math.max(...ez), wMin: Math.min(...w), wMax: Math.max(...w), ezLast: last.ez, wLast: last.w };
}

test('REAL APP: with a STOCK SHOWN, the rendered homing tool reaches the TOP (~-5), matching engine.pos.z — NOT -100', async ({ page }) => {
    const r = await homingRenderedZ(page, true);
    // t540 — the engine now STARTS at the mid-envelope draggable Start (z=-120 → -60) and homes UP to the top switch (0),
    // settling backed off at -5 (ezLast). (Was: started AT the top, ezMax=0 / ezMin=-5.) The switch-touch 0 is a transient
    // the 110ms sampling skips (engine.pos updates at segment completion) — so assert the START + SETTLED, not the peak.
    expect(r.ezMin, 'engine STARTS at the mid-envelope Start (z=-120 → -60)').toBe(-60);
    expect(r.ezLast, 'engine settles backed off from the top switch (-5)').toBe(-5);
    // THE FIX: the RENDERED tool now tracks the engine (top ~-5), NOT the stock-floor-shifted bottom (~-100)
    expect(r.wMax >= -6, `the rendered tool reaches the TOP (worldZ max=${r.wMax}), NOT the bottom`).toBe(true);
    // t540 — the tool now STARTS at the mid-envelope draggable Start and travels UP to the switch, so wMin is the Start
    // (mid-Z), not the top (was: wMin >= -8, which assumed the tool starts PINNED at the top). The t497 "no plunge" guard
    // is the TRACKING below: the rendered worldZ matches engine.pos.z; a stock-floor plunge decouples them by ~95mm.
    expect(Math.abs(r.wMin - r.ezMin) < 2, `the rendered worldZ (${r.wMin}) matches the engine pos (${r.ezMin}) — no stock-floor plunge`).toBe(true);
});

test('REAL APP: with the STOCK HIDDEN, the rendered homing tool is still at the TOP (~-5)', async ({ page }) => {
    const r = await homingRenderedZ(page, false);
    expect(r.wMax >= -6, `stock hidden: rendered tool at the TOP (worldZ max=${r.wMax})`).toBe(true);
    expect(Math.abs(r.wMin - r.ezMin) < 2, `rendered worldZ (${r.wMin}) matches engine pos (${r.ezMin})`).toBe(true);
});

test('a CUTTING op (drill) leaves the tool on the stock-placed part frame (machine-frame flag OFF — unchanged)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
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
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, method: 'native', backoff: 5 }, x: { enable: true, order: 2, method: 'native' }, y: { enable: true, order: 3, method: 'native' } } };
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };   // a workpiece IS shown (the human's scenario)
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
    await page.evaluate(() => { const host = document.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60; });   // t542 — real emit is slower (slow re-touch); speed it so it settles inside the wait
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 20000 });
    const w = await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; p.viz._animTool.updateWorldMatrix(true, false); return +p.viz._animTool.getWorldPosition(new (p.viz.THREE.Vector3)()).z.toFixed(1); });
    expect(w >= -8, `the homing tool rests at the TOP (worldZ=${w}) with a stock shown, not the -100 bottom`).toBe(true);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_tool_at_top_with_stock.png', clip: _b }); }   // t710 clip capture (rAF-starved actionability dodge)
});
