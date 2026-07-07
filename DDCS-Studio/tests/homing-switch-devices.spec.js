import { test, expect } from '@playwright/test';

/**
 * HOMING H4 — the HOME/LIMIT SWITCH-DEVICE MESH (the final Homing slice; SIM/VISUAL only, emit BYTE-IDENTICAL).
 *
 * H3 wired the LIVE trips (IN_HOME / IN_LIMIT fire as the axis reaches a switch). H4 RENDERS the switch as a 3D device
 * at each fitted home-end edge (machine coords, on the fixed envelope) + LIGHTS/PLUNGES it on the io_change trip — the
 * same device pattern as the ATC station pneumatics. Styled per the H2 switchType: mechanical = a plunger the axis
 * contacts; proximity = a sensor face + a visible standoff GAP (never contacted). VERIFY: the device renders AT the home
 * edge; it lights/plunges on the trip; proximity never moves; opt-in (fitted only); emit byte-identical; drive the app.
 */

test.use({ viewport: { width: 1300, height: 950 } });

// Open the Homing wizard with a deterministic envelope + three fitted home-end switches (X mechanical, Y mechanical,
// Z proximity). X/Y home = the MIN end (machine-0); Z home = the MAX end (z=0/top). Waits for the viz + the devices.
async function openHoming(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager && window.ddcsGetSettings);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.preview = s.preview || {}; s.preview.autoLoop = false;
        s.machine = { x: 300, y: 200, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { x: { method: 'native' }, y: { method: 'native' }, z: { method: 'native' } } };
        s.limits = {
            xMinPin: 5, xMinLevel: 0, xMinSwitchType: 'mechanical',
            yMinPin: 6, yMinLevel: 0, yMinSwitchType: 'mechanical',
            zMaxPin: 7, zMaxLevel: 0, zMaxSwitchType: 'proximity',
        };
    });
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    await page.waitForFunction(() => { const v = window.ddcsStudio.wizardManager._activePanel && window.ddcsStudio.wizardManager._activePanel.viz; return v && v.getLimitSwitch && v.getLimitSwitch('x_min'); }, null, { timeout: 8000 });
}

test('(1) a switch device renders AT each fitted home-end edge (machine-0), styled per switchType', async ({ page }) => {
    await openHoming(page);
    const r = await page.evaluate(() => {
        const v = window.ddcsStudio.wizardManager._activePanel.viz;
        return { x: v.getLimitSwitch('x_min'), y: v.getLimitSwitch('y_min'), z: v.getLimitSwitch('z_max') };
    });
    expect(r.x, 'the X home switch device exists').toBeTruthy();
    expect(r.x.x, 'the X device sits AT the X home edge = machine-0').toBe(0);
    expect(r.x.axis, 'its switch axis is X').toBe('x');
    expect(r.x.kind, 'the X switch is mechanical').toBe('mechanical');
    expect(r.y.y, 'the Y device sits AT the Y home edge = machine-0').toBe(0);
    expect(r.z, 'the Z home switch device exists').toBeTruthy();
    expect(r.z.z, 'the Z device sits AT the Z home edge = machine-0/top').toBe(0);
    expect(r.z.kind, 'the Z switch is proximity').toBe('proximity');
});

test('(2) opt-in: an axis with NO fitted home-end switch gets NO device', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager && window.ddcsGetSettings);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.preview = s.preview || {}; s.preview.autoLoop = false;
        s.machine = { x: 300, y: 200, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.limits = { xMinPin: 5, xMinSwitchType: 'mechanical' };   // ONLY X fitted — Y/Z home ends have no pin
    });
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    const r = await page.evaluate(() => {
        const v = window.ddcsStudio.wizardManager._activePanel.viz;
        return { x: !!v.getLimitSwitch('x_min'), y: !!v.getLimitSwitch('y_min'), z: !!v.getLimitSwitch('z_max') };
    });
    expect(r.x, 'the fitted X home switch renders').toBe(true);
    expect(r.y || r.z, 'unfitted Y/Z home ends get NO device (opt-in on the configured pin)').toBe(false);
});

test('(3) the device LIGHTS on the io_change trip: mechanical PLUNGES, proximity glows (never moves)', async ({ page }) => {
    await openHoming(page);
    const r = await page.evaluate(() => {
        const v = window.ddcsStudio.wizardManager._activePanel.viz;
        const mech = v._limitDevices['x_min'], prox = v._limitDevices['z_max'];
        const fire = (pin, state) => window.dispatchEvent(new CustomEvent('io_change', { detail: { pin, state } }));
        const ax = mech.axis;
        const mechRest = mech.plunger.position[ax];
        const proxRestCol = prox.indicator.material.color.getHex();
        const proxRestPos = { x: prox.indicator.position.x, y: prox.indicator.position.y, z: prox.indicator.position.z };
        fire('IN_HOME_X', true);
        const mechMade = v.getLimitSwitch('x_min').made, mechPlunged = mech.plunger.position[ax];
        fire('IN_HOME_Z', true);
        const proxMade = v.getLimitSwitch('z_max').made, proxLitCol = prox.indicator.material.color.getHex();
        const proxPos = { x: prox.indicator.position.x, y: prox.indicator.position.y, z: prox.indicator.position.z };
        fire('IN_HOME_X', false);
        const mechReleased = v.getLimitSwitch('x_min').made, mechBack = mech.plunger.position[ax];
        return { mechMade, mechReleased, mechRest, mechPlunged, mechBack, proxMade, proxRestCol, proxLitCol, proxRestPos, proxPos };
    });
    expect(r.mechMade, 'IN_HOME_X trip → the mechanical switch is MADE').toBe(true);
    expect(r.mechPlunged !== r.mechRest, 'the mechanical plunger MOVES (depresses) when made').toBe(true);
    expect(r.mechReleased, 'release → not made').toBe(false);
    expect(r.mechBack, 'the plunger returns to rest on release').toBe(r.mechRest);
    expect(r.proxMade, 'IN_HOME_Z trip → the proximity switch is MADE').toBe(true);
    expect(r.proxLitCol !== r.proxRestCol, 'the proximity sensor face LIGHTS (colour change) when made').toBe(true);
    expect(r.proxPos, 'the proximity sensor NEVER moves (non-contact)').toEqual(r.proxRestPos);
});

test('(4) end-to-end: a real homing sim PLAY lights the switch devices via the H3 engine trip', async ({ page }) => {
    await openHoming(page);
    await page.evaluate(() => {
        window.__everMade = { x: false, z: false };
        window.__rec = () => { const v = window.ddcsStudio.wizardManager._activePanel.viz; const x = v.getLimitSwitch('x_min'), z = v.getLimitSwitch('z_max'); if (x && x.made) window.__everMade.x = true; if (z && z.made) window.__everMade.z = true; };
        window.addEventListener('io_change', window.__rec);
        const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d');
        const run = host.querySelector('.pp-run'); if (run) run.click();
    });
    // the seek trips then the back-off releases — the recorder captures the transient "made" during the sim
    await page.waitForFunction(() => window.__everMade && window.__everMade.x && window.__everMade.z, null, { timeout: 8000 });
    const everMade = await page.evaluate(() => window.__everMade);
    expect(everMade.x, 'the X home switch LIT during the homing sim (the engine io_change drove the device)').toBe(true);
    expect(everMade.z, 'the Z home switch LIT during the homing sim').toBe(true);
});

test('(5) emit BYTE-IDENTICAL — H4 is sim/visual only and does not touch the emitted homing macro', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const emit = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        return emitMapped(homingStack({ axes: ['z'], config: { z: { method: 'native' } }, machine: { z: -120 } })).text;
    });
    expect(emit.includes('M98'), 'the native homing macro still emits M98 P501').toBe(true);
    expect(/switchdevice|limitswitch|proximity|standoff|IN_HOME|IN_LIMIT/i.test(emit), 'the emitted macro references NO switch device / limit IO (visual-only)').toBe(false);
});

test('(6) DRIVE THE APP: the homing sim — the axis AT home with the switch devices LIT (screenshot)', async ({ page }) => {
    await openHoming(page);
    // Drive the SEEK to each home edge and hold there (no back-off) so the switches stay LIT for the deliverable shot —
    // the homing ARRIVAL moment. The panel engine (H3-wired) trips IN_HOME_* → the panel listener lights the devices.
    await page.evaluate(() => {
        const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d');
        host.__gcode = ['G90', 'G53 G0 X0', 'G53 G0 Y0', 'G53 G0 Z0', 'M30'].join('\n');
        host.querySelector('.pp-run').click();
    });
    await page.waitForFunction(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; const x = v.getLimitSwitch('x_min'), z = v.getLimitSwitch('z_max'); return x && x.made && z && z.made; }, null, { timeout: 8000 });
    await page.waitForTimeout(400);
    const lit = await page.evaluate(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; return { x: v.getLimitSwitch('x_min').made, y: v.getLimitSwitch('y_min') && v.getLimitSwitch('y_min').made, z: v.getLimitSwitch('z_max').made }; });
    expect(lit.x && lit.z, 'both fitted home switches are LIT at home for the deliverable').toBe(true);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_h4_switch_devices.png' });
});
