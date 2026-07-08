import { test, expect } from '@playwright/test';

/**
 * HOMING fix — increment 1: the I/O DECLARATION surface (t502). The I/O Input table gets (A) a per-row HOME flag on the
 * 'limit' switch row — DECLARING which fitted switch is the home reference for its axis (replacing the settings.machine
 * travel-SIGN guess that homing uses today = the positive-Z plunge) — and (B) two more switch types (optical, hall).
 * DECLARATION ONLY: homing is NOT rewired here (increment 2). VERIFY: the Home flag persists to settings.limits.<edge>Home,
 * at most ONE Home per axis, and all 4 switch types show in the picker + round-trip. + a screenshot of the limit row.
 */
test('SWITCH_TYPES has all 4 (mechanical/proximity/optical/hall) with the {standoff,render,help} shape', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { SWITCH_TYPES, switchStandoff } = await import('/engine/switchTypes.js');
        const by = (t) => SWITCH_TYPES.find((s) => s.type === t);
        return {
            types: SWITCH_TYPES.map((s) => s.type),
            optical: by('optical'), hall: by('hall'),
            opticalStandoff: switchStandoff('optical'), hallStandoff: switchStandoff('hall'),
        };
    });
    expect(r.types, 'the catalog is the 4 declared types').toEqual(['mechanical', 'proximity', 'optical', 'hall']);
    // the 2 new types are non-contact (a small standoff) with a render glyph + help — the existing {type,label,help,standoff,render} shape
    expect(r.optical && r.optical.label, 'optical has a label').toBe('Optical');
    expect(r.hall && r.hall.label, 'hall has a label').toBe('Hall effect');
    expect(!!(r.optical.help && r.hall.help), 'both new types carry a help string').toBe(true);
    expect(!!(r.optical.render && r.hall.render), 'both new types declare a render glyph').toBe(true);
    expect(r.opticalStandoff > 0 && r.hallStandoff > 0, 'both new types are non-contact (standoff > 0)').toBe(true);
});

test('the Home flag persists to settings.limits.<edge>Home, and all 4 switch types round-trip', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const { syncIO } = await import('/ui/settingsPanel.js');
        const s = window.ddcsGetSettings();
        // one fitted switch per switch-type, on distinct axis ends; z_max is marked HOME.
        s.inputs = [
            { id: 'lxmin', type: 'limit', axis: 'x_min', label: 'X−', pin: 3, level: 0, switchType: 'mechanical', home: false },
            { id: 'lymin', type: 'limit', axis: 'y_min', label: 'Y−', pin: 4, level: 0, switchType: 'proximity', home: false },
            { id: 'lzmin', type: 'limit', axis: 'z_min', label: 'Z−', pin: 5, level: 1, switchType: 'optical', home: false },
            { id: 'lzmax', type: 'limit', axis: 'z_max', label: 'Z+', pin: 6, level: 1, switchType: 'hall', home: true },
        ];
        syncIO();   // mirror inputs[] → the flat settings.limits the sim/wizards read
        return { L: s.limits };
    });
    // (A) Home flag persists per-edge
    expect(r.L.zMaxHome, 'the marked switch persists <edge>Home = true').toBe(true);
    expect(r.L.zMinHome, 'an un-marked end persists Home = false').toBe(false);
    expect(r.L.xMinHome, 'an un-marked edge persists Home = false').toBe(false);
    // (B) all 4 switch types round-trip to the flat config (incl. the 2 new ones)
    expect(r.L.xMinSwitchType).toBe('mechanical');
    expect(r.L.yMinSwitchType).toBe('proximity');
    expect(r.L.zMinSwitchType, 'optical round-trips').toBe('optical');
    expect(r.L.zMaxSwitchType, 'hall round-trips').toBe('hall');
    // per-edge pin/level persist alongside
    expect(r.L.zMaxPin).toBe(6);
    expect(r.L.zMaxLevel).toBe(1);
});

test.use({ viewport: { width: 1200, height: 700 } });
test('the limit-row Home toggle enforces ONE home per axis + the picker offers all 4 types + screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { renderIoTable } = await import('/ui/ioTable.js');
        const c = document.createElement('div'); c.id = 'io_shot';
        c.style.cssText = 'position:fixed; top:20px; left:20px; right:20px; background:#141a21; color:#cdd6e0; padding:18px; border:1px solid #2a3340; border-radius:8px; z-index:99999; font:13px system-ui;';
        c.innerHTML = '<div style="margin-bottom:10px; color:#9fb3c8;">Hardware ▸ Inputs — limit switches with the Home flag + the 4-type Switch-type picker</div>';
        document.body.appendChild(c);
        // BOTH ends of Z fitted → the one-home-per-axis rule must clear the other end when one is marked.
        const list = [
            { id: 'lzmin', type: 'limit', axis: 'z_min', label: 'Limit Z−', pin: 5, level: 0, switchType: 'mechanical', home: false },
            { id: 'lzmax', type: 'limit', axis: 'z_max', label: 'Limit Z+', pin: 6, level: 0, switchType: 'optical', home: false },
        ];
        renderIoTable(c, 'input', list, () => {});
        const homeBoxes = () => [...c.querySelectorAll('.io-home-cb')];
        homeBoxes()[1].click();                 // mark z_max Home → rerenders
        const afterMax = list.map((x) => !!x.home);
        homeBoxes()[0].click();                 // mark z_min Home → must CLEAR z_max (same axis)
        const afterMin = list.map((x) => !!x.home);
        const opts = [...c.querySelectorAll('select')].flatMap((sel) => [...sel.options].map((o) => o.textContent));
        return { afterMax, afterMin, opts };
    });
    expect(r.afterMax, 'marking z_max sets its Home flag').toEqual([false, true]);
    expect(r.afterMin, 'marking z_min sets it AND clears z_max — one home per axis').toEqual([true, false]);
    for (const t of ['Mechanical', 'Proximity', 'Optical', 'Hall effect']) {
        expect(r.opts.includes(t), `the Switch-type picker offers ${t}`).toBe(true);
    }
    await page.locator('#io_shot').screenshot({ path: 'scratchpad/io_home_flag_and_types.png' });
});

test('a FRESH machine seeds a Home switch per linear axis (X/Y/Z), Z up (z_max), pin unassigned + mirrored to flat', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { migrateIO } = await import('/ui/settingsPanel.js');
        // the FRESH-load path: empty inputs, default-empty limits → migrateIO seeds the defaults
        const s = { inputs: [], outputs: [], probes: {}, limits: {} };
        migrateIO(s);
        const limits = s.inputs.filter((i) => i.type === 'limit');
        return {
            rows: limits.map((l) => ({ axis: l.axis, home: !!l.home, pin: l.pin, switchType: l.switchType })),
            flat: { xMinHome: s.limits.xMinHome, yMinHome: s.limits.yMinHome, zMaxHome: s.limits.zMaxHome, zMinHome: s.limits.zMinHome },
        };
    });
    expect(r.rows.length, 'three seeded home switches — one per linear axis (X/Y/Z)').toBe(3);
    const byAxis = Object.fromEntries(r.rows.map((l) => [l.axis, l]));
    expect(byAxis.x_min && byAxis.x_min.home, 'X home at x_min').toBe(true);
    expect(byAxis.y_min && byAxis.y_min.home, 'Y home at y_min').toBe(true);
    expect(byAxis.z_max && byAxis.z_max.home, 'Z home at z_max (top — routers home Z UP; sign-agnostic default)').toBe(true);
    expect(r.rows.every((l) => l.pin === ''), 'the pin is UNASSIGNED (the user sets their controller pin)').toBe(true);
    expect(r.rows.every((l) => l.switchType === 'mechanical'), 'default switch type is mechanical').toBe(true);
    // the seed is mirrored into the flat settings.limits on first load (increment 2 reads it)
    expect(r.flat.zMaxHome && r.flat.xMinHome && r.flat.yMinHome, 'seeded Home flags mirror to flat limits').toBe(true);
    expect(!!r.flat.zMinHome, 'the un-seeded z_min end is NOT home').toBe(false);
});

test('the "+ Add input" entry-point is a MODAL type-picker (not an inline dropdown) that adds the row + screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    await page.evaluate(async () => {
        const { renderIoTable } = await import('/ui/ioTable.js');
        const c = document.createElement('div'); c.id = 'io_add_host';
        c.style.cssText = 'position:fixed; top:20px; left:20px; right:20px; background:#141a21; color:#cdd6e0; padding:18px; border-radius:8px; z-index:50000; font:13px system-ui;';
        document.body.appendChild(c);
        window.__ioAddList = [];
        renderIoTable(c, 'input', window.__ioAddList, () => {});
    });
    // an empty input table has NO inline <select> for the add entry-point (the old dropdown is gone → a modal now)
    expect(await page.evaluate(() => !document.querySelector('#io_add_host select')), 'the add entry-point is not an inline dropdown').toBe(true);
    await page.getByRole('button', { name: '+ Add input' }).click();
    await expect(page.locator('.io-add-modal')).toBeVisible();
    // the modal offers the input types (cards with help)
    const cards = await page.evaluate(() => [...document.querySelectorAll('.io-add-modal .io-add-type')].map((b) => b.getAttribute('data-type')));
    expect(cards.includes('limit') && cards.includes('probe') && cards.includes('sensor'), 'the modal offers the input types').toBe(true);
    await page.locator('.io-add-modal').screenshot({ path: 'scratchpad/io_add_input_modal.png' });
    // pick 'limit', confirm → the row is added + the modal closes
    await page.locator('.io-add-modal .io-add-type[data-type="limit"]').click();
    await page.locator('.io-add-modal .io-add-confirm').click();
    await expect(page.locator('.io-add-modal')).toHaveCount(0);
    const added = await page.evaluate(() => window.__ioAddList.map((r) => ({ type: r.type, axis: r.axis, home: r.home })));
    expect(added.length, 'confirming the modal adds one row').toBe(1);
    expect(added[0].type, 'the added row is the picked type (limit)').toBe('limit');
    expect(added[0].axis, 'a limit row is created with an axis end').toBe('x_min');
});
