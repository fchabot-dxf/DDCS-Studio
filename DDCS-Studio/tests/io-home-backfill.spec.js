import { test, expect } from '@playwright/test';

/**
 * t534 — HOMING un-park part 1. An EXISTING config (probe/setter rows) skipped the t502 home-switch seed → no <edge>Home →
 * homing fell back to the travel-SIGN guess (a +Z envelope homes to machine-0 = the BOTTOM = the plunge). The backfill ADDS
 * the missing per-axis home end (once, flag-guarded); homing then drives to the DECLARED end (the top for Z). Verified against
 * the human's config shape (probe+setter, no home), not a fresh default.
 */
test('backfill adds the missing home ends (once); homing then drives to the DECLARED top for both Z signs', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { migrateIO } = await import('/ui/settingsPanel.js');
        const { axisHomeMotion } = await import('/engine/limitSwitches.js');
        // the human's config SHAPE: already-populated inputs (probe+setter), NO home flags, +Z machine
        const mk = () => ({ inputs: [{ id: 'probe', type: 'probe', pin: 5, level: 0 }, { id: 'setter', type: 'setter', pin: 6, level: 0 }], outputs: [], limits: {}, machine: { x: 600, y: 600, z: 500 } });

        const A = migrateIO(mk());
        const zMax = A.inputs.find((r) => r.type === 'limit' && r.axis === 'z_max');
        const a = { zMaxRowHome: !!(zMax && zMax.home), zMaxPinUnassigned: !!(zMax && (zMax.pin === '' || zMax.pin == null)), zMaxHomeFlag: !!A.limits.zMaxHome, xMinHome: !!A.limits.xMinHome, yMinHome: !!A.limits.yMinHome, flag: A._ioHomeBackfill };

        // (c) the flag guards re-run: delete the backfilled z_max, migrateIO again → NOT re-added (a user deletion stays)
        const cfgC = migrateIO(mk());
        cfgC.inputs = cfgC.inputs.filter((r) => r.axis !== 'z_max');
        migrateIO(cfgC);
        const cReadded = cfgC.inputs.some((r) => r.axis === 'z_max');

        // (d) an EXISTING z_min limit row (no home) → mark home on IT (prefer-existing), do NOT add a z_max
        const cfgD = mk();
        cfgD.inputs.push({ id: 'limit_z_min', type: 'limit', axis: 'z_min', pin: 3, level: 0, switchType: 'mechanical', home: false });
        const D = migrateIO(cfgD);
        const d = { zMinHome: !!(D.inputs.find((r) => r.axis === 'z_min') || {}).home, noZMaxAdded: !D.inputs.some((r) => r.axis === 'z_max') };

        // (a/b) MOTION: with the declared z_max home, Z homes to the TOP for BOTH signs; without it, +Z seeks 0 = the plunge
        const motion = {
            z500declared: axisHomeMotion(500, { axis: 'z', limits: { zMaxHome: true } }).seek,
            zNeg120declared: axisHomeMotion(-120, { axis: 'z', limits: { zMaxHome: true } }).seek,
            z500noHome: axisHomeMotion(500, { axis: 'z', limits: {} }).seek,
        };
        return { a, cReadded, d, motion };
    });
    console.log('BACKFILL: ' + JSON.stringify(r));
    // (a) the backfill added the home ends (z_max for Z + x_min/y_min), pin unassigned, flag set
    expect(r.a.zMaxRowHome && r.a.zMaxHomeFlag, 'Z gets a z_max home end (declared)').toBe(true);
    expect(r.a.zMaxPinUnassigned, 'the backfilled home switch has an UNASSIGNED pin (user wires it)').toBe(true);
    expect(r.a.xMinHome && r.a.yMinHome, 'X/Y get their min home ends').toBe(true);
    expect(r.a.flag, 'the one-time flag is set').toBeTruthy();
    // (c) delete + re-run → stays deleted
    expect(r.cReadded, 'a user-deleted backfilled switch is NOT re-added on the next migrate (flag)').toBe(false);
    // (d) prefer-existing: mark the z_min row, no duplicate z_max
    expect(r.d.zMinHome, 'an existing z_min row is marked home (prefer the fitted row)').toBe(true);
    expect(r.d.noZMaxAdded, 'no duplicate z_max row added when a z-axis row already exists').toBe(true);
    // (a/b) homing drives to the TOP (declared z_max) for BOTH signs; the plunge (0) only without a declared home
    expect(r.motion.z500declared, 'z=+500 homes to the TOP (500), not the bottom').toBe(500);
    expect(r.motion.zNeg120declared, 'z=-120 homes to the TOP (0)').toBe(0);
    expect(r.motion.z500noHome, 'contrast: no declared home → +500 seeks 0 = the OLD plunge').toBe(0);
});

test('(e) homingEdges draws the switch DEVICE at the DECLARED home end for BOTH Z signs (even unpinned)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingEdges } = await import('/wizards/views/homingView.js');
        const dev = (z) => (homingEdges({ machine: { x: 600, y: 600, z }, limits: { zMaxHome: true } }) || []).find((d) => d.axis === 'z') || null;
        const devNoHome = (homingEdges({ machine: { x: 600, y: 600, z: 500 }, limits: { zMinPin: 3 } }) || []).find((d) => d.axis === 'z') || null;   // a fitted z_min switch, NO declared home → sign fallback
        const p500 = dev(500), pneg = dev(-120);
        return {
            pos500: p500 && { side: p500.side, z: p500.z }, posNeg: pneg && { side: pneg.side, z: pneg.z },
            noHomeSide: devNoHome && devNoHome.side,   // no declared home → sign fallback (min for +Z = the bottom)
        };
    });
    console.log('DEVICE: ' + JSON.stringify(r));
    expect(r.pos500 && r.pos500.side, 'z=+500 device at the DECLARED max end (top), not the sign min').toBe('max');
    expect(r.pos500 && Math.round(r.pos500.z), 'the +500 device Z sits at the top (500)').toBe(500);
    expect(r.posNeg && r.posNeg.side, 'z=-120 device also at the declared max (top)').toBe('max');
    expect(r.posNeg && Math.round(r.posNeg.z), 'the -120 device Z sits at the top (0)').toBe(0);
    expect(r.noHomeSide, 'sanity: with NO declared home, +Z falls back to the sign end (min = bottom) — the old divergence').toBe('min');
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('REAL APP (the human config): an existing config reloads → z_max Home backfilled → homing preview homes UP; screenshot', async ({ page }) => {
    // seed an EXISTING config (probe+setter rows, +Z, NO home, NO backfill flag) into localStorage BEFORE the app loads
    await page.addInitScript(() => {
        localStorage.setItem('ddcs_studio_settings', JSON.stringify({
            machine: { x: 600, y: 600, z: 500, workOrigin: { x: 0, y: 0, z: 0 } },
            inputs: [{ id: 'probe', type: 'probe', label: '3D Probe', pin: 5, level: 0 }, { id: 'setter', type: 'setter', label: 'Tool Setter', pin: 6, level: 0 }],
            limits: {},
        }));
    });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openWiz);
    const loaded = await page.evaluate(() => { const s = window.ddcsGetSettings(); return { zMaxHome: !!s.limits.zMaxHome, flag: s._ioHomeBackfill, hasZMaxRow: (s.inputs || []).some((r) => r.type === 'limit' && r.axis === 'z_max' && r.home) }; });
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_backfill_top.png' });
    console.log('LOADED (existing config): ' + JSON.stringify(loaded));
    expect(loaded.zMaxHome, 'on load the existing config got its z_max home backfilled (declared)').toBe(true);
    expect(loaded.flag, 'the one-time backfill flag persisted').toBeTruthy();
    expect(loaded.hasZMaxRow, 'a z_max limit input row with home:true exists after load').toBe(true);
});
