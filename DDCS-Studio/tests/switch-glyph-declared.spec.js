import { test, expect } from '@playwright/test';

/**
 * The 3D home/limit switch DEVICE glyph is DECLARED by the switch type's `render` field (t512) — NOT the hardcoded
 * 'proximity' string. So the 2 new non-contact types (optical / hall, standoff 1) draw the SENSOR-FACE glyph (like
 * proximity), not the mechanical plunger. mechanical (render:'plunger') → the contact plunger; proximity/optical/hall
 * (render:'sensor-face') → the non-contact sensor face (no plunger, never moves). One source: switchTypes.js.
 */
test.use({ viewport: { width: 1200, height: 900 } });

test('the switch glyph reads the DECLARED render field: mechanical→plunger, proximity/optical/hall→sensor-face (non-contact)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager && window.ddcsGetSettings);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.preview = s.preview || {}; s.preview.autoLoop = false;
        s.machine = { x: 300, y: 200, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { x: { method: 'native' }, y: { method: 'native' }, z: { method: 'native' } } };
        s.limits = { xMinPin: 5, xMinSwitchType: 'mechanical' };
    });
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.setLimitSwitchDevices; }, null, { timeout: 8000 });

    const r = await page.evaluate(async () => {
        const { switchTypeOf } = await import('/engine/switchTypes.js');
        const v = window.ddcsStudio.wizardManager._activePanel.viz;
        // one fitted device per switch type, on the 4 XY envelope edges (mid-Z), so all 4 glyphs render together
        v.setLimitSwitchDevices([
            { edge: 'x_min', axis: 'x', side: 'min', x: 0, y: 100, z: -60, dir: 1, switchType: 'mechanical', standoff: 0 },
            { edge: 'x_max', axis: 'x', side: 'max', x: 300, y: 100, z: -60, dir: -1, switchType: 'proximity', standoff: 3 },
            { edge: 'y_min', axis: 'y', side: 'min', x: 150, y: 0, z: -60, dir: 1, switchType: 'optical', standoff: 1 },
            { edge: 'y_max', axis: 'y', side: 'max', x: 150, y: 200, z: -60, dir: -1, switchType: 'hall', standoff: 1 },
        ]);
        const dev = (e) => { const d = v._limitDevices[e]; return d ? { kind: d.kind, hasPlunger: !!d.plunger, hasFace: !!(d.indicator && d.kind !== 'mechanical') } : null; };
        return {
            declared: { mechanical: switchTypeOf('mechanical').render, proximity: switchTypeOf('proximity').render, optical: switchTypeOf('optical').render, hall: switchTypeOf('hall').render },
            mech: dev('x_min'), prox: dev('x_max'), opt: dev('y_min'), hall: dev('y_max'),
        };
    });
    // the DECLARED render field is the ONE source (mechanical=plunger; the other 3 = sensor-face)
    expect(r.declared, 'switchTypes.js declares the glyph per type via `render`').toEqual({ mechanical: 'plunger', proximity: 'sensor-face', optical: 'sensor-face', hall: 'sensor-face' });
    // mechanical (render:'plunger') → the CONTACT plunger glyph
    expect(r.mech.kind).toBe('mechanical');
    expect(r.mech.hasPlunger, 'mechanical → a plunger glyph (contact)').toBe(true);
    // proximity/optical/hall (render:'sensor-face') → the NON-CONTACT sensor face, NO plunger (the fix — optical/hall no longer draw the plunger)
    for (const [name, d] of [['proximity', r.prox], ['optical', r.opt], ['hall', r.hall]]) {
        expect(d.kind, `${name}: kind is the type (never 'mechanical' → never plunges)`).toBe(name);
        expect(d.hasPlunger, `${name}: NO plunger — the non-contact sensor-face glyph`).toBe(false);
    }
    await page.locator('#wiz_user .wiz-viz3d').first().screenshot({ path: 'scratchpad/switch_glyphs_4types.png' });
});
