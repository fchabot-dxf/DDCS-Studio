import { test, expect } from '@playwright/test';

/**
 * t1295 — THE LATHE REACHES EVERY SURFACE. Two user-reported gaps: a main preview that stood the world on end, and a
 * hardware page still drawing a mill's table under a heading that explains X is a radius.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page, kind, view) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async ({ k, v }) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: k, chuck: 'axis' }, false);
        if (v) window.ddcsGetSettings().view = v;
    }, { k: kind, v: view });
};

const openHardware = async (page) => {
    await page.evaluate(() => window.openSettings());
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#settings-app .settings-main-tab')].find((b) => /hardware/i.test(b.textContent));
        if (t) t.click();
    });
    await page.waitForTimeout(600);
};

test('THE MAIN PREVIEW frames a lathe with the bed ACROSS the screen — even with a mill view saved', async ({ page }) => {
    // a camera saved in the mill era is present, which is exactly the state the user was in
    await boot(page, 'lathe', { theta: -1.5708, phi: 1.0472, byKind: { mill: { theta: -1.5708, phi: 1.0472 } } });
    await page.click('#view-toggle');
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
        const v = window.__ddcsLastViz;
        const up = v.camera.up;
        return { phi: +v.phi.toFixed(3), up: [+up.x.toFixed(2), +up.y.toFixed(2), +up.z.toFixed(2)] };
    });
    // square on to the ZX plane…
    expect(r.phi, 'the camera stands level with the bed, not above a table').toBeCloseTo(Math.PI / 2, 2);
    // …and rolled, so the bed lies ACROSS the screen. Both are needed: the roll alone still stood the bar upright,
    // because the standpoint came from an unscoped setting that always had a value.
    expect(r.up, 'up is +X — the cross-slide — so Z runs horizontally').toEqual([1, 0, 0]);
});

test('A MILL PREVIEW IS UNTOUCHED, and a lathe view never leaks into it', async ({ page }) => {
    await boot(page, 'mill', { theta: -1.5708, phi: 1.0472, byKind: { lathe: { theta: 0, phi: Math.PI / 2 } } });
    await page.click('#view-toggle');
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
        const v = window.__ddcsLastViz;
        const up = v.camera.up;
        return { phi: +v.phi.toFixed(3), upx: +up.x.toFixed(2) };
    });
    expect(r.phi, 'the mill keeps its three-quarter view').toBeCloseTo(1.047, 2);
    expect(r.upx, 'and its own up vector — the lathe roll does not reach it').toBeLessThan(0.01);
});

test('THE SAVED VIEW IS SCOPED — each kind gets its own, and the legacy flat one is the mill’s', async ({ page }) => {
    await boot(page, 'lathe');
    const r = await page.evaluate(async () => {
        const V = await import('/viz/viewScope.js');
        const legacy = { theta: 0.5, phi: 0.9 };                                   // saved before the scope existed
        const both = V.withSavedView(legacy, 'lathe', 1.1, 1.2);
        return {
            legacyMill: V.viewFor('mill', legacy),
            legacyLathe: V.viewFor('lathe', legacy),
            savedLathe: V.viewFor('lathe', both),
            millAfter: V.viewFor('mill', both),
        };
    });
    // a view saved before the scope existed WAS a mill view — read as one, and never applied to a lathe
    expect(r.legacyMill.theta, 'the legacy pair is the mill’s').toBe(0.5);
    expect(r.legacyMill.saved).toBe(true);
    expect(r.legacyLathe.saved, 'a lathe has none of its own yet, so it takes its default').toBe(false);
    expect(r.legacyLathe.phi, 'which stands it level with the bed').toBeCloseTo(Math.PI / 2, 3);
    // …and saving one kind's view leaves the other's exactly as it was
    expect(r.savedLathe.theta, 'the lathe view is now its own').toBe(1.1);
    expect(r.millAfter.theta, 'and the mill’s is untouched').toBe(0.5);
});

test('THE HARDWARE PAGE SPEAKS LATHE — its own envelope, Y greyed with the reason, homing on the declared axes', async ({ page }) => {
    await boot(page, 'lathe');
    await openHardware(page);
    const r = await page.evaluate(() => {
        const y = document.getElementById('set_mach_y'), row = y && y.closest('.mach-travel-row');
        return {
            svg: (document.getElementById('set_mach_env_svg') || {}).innerHTML || '',
            present: !!row, gated: !!(row && row.classList.contains('axis-gated')),
            why: (row && row.title) || '', disabled: !!(y && y.disabled),
            homing: [...document.querySelectorAll('#set_homing_axes .homing-axis-row')].map((r2) => r2.dataset.axis),
        };
    });
    // THE PICTURE IS THE LATHE'S: a bed and a cross-slide off a centreline, not a table
    expect(r.svg, 'the envelope names the carriage along the bed').toMatch(/carriage, along the bed/);
    expect(r.svg, 'and the cross-slide as a RADIUS').toMatch(/cross-slide \(radius\)/);
    expect(r.svg, 'drawn from the centreline it is measured from').toMatch(/centreline/);
    // THE Y ROW GREYS, never hides — the standing rule, with the standing reason
    expect(r.present, 'the Y row is still there to be understood').toBe(true);
    expect(r.gated, 'greyed').toBe(true);
    expect(r.disabled, 'and not editable').toBe(true);
    expect(r.why, 'with the reason under the cursor').toMatch(/lathe workspace/);
    // HOMING FOLLOWS THE DECLARED AXES: X and Z, plus the chuck, because this workspace declares it a driven axis
    expect(r.homing, 'X, Z and the driven chuck').toEqual(expect.arrayContaining(['x', 'z', 'a']));
    expect(r.homing.includes('y'), 'and no Y to home on a machine that has none').toBe(false);
});

test('THE MILL HARDWARE PAGE IS UNCHANGED — both ways, as always', async ({ page }) => {
    await boot(page, 'mill');
    await openHardware(page);
    const r = await page.evaluate(() => {
        const y = document.getElementById('set_mach_y'), row = y && y.closest('.mach-travel-row');
        return {
            svg: (document.getElementById('set_mach_env_svg') || {}).innerHTML || '',
            gated: !!(row && row.classList.contains('axis-gated')), disabled: !!(y && y.disabled),
            homing: [...document.querySelectorAll('#set_homing_axes .homing-axis-row')].map((r2) => r2.dataset.axis),
        };
    });
    expect(r.svg, 'a mill keeps its isometric table — no lathe wording').not.toMatch(/cross-slide|centreline/);
    expect(r.gated, 'Y is a real axis here').toBe(false);
    expect(r.disabled, 'and editable').toBe(false);
    expect(r.homing, 'and it homes all three').toEqual(expect.arrayContaining(['x', 'y', 'z']));
});
