import { test, expect } from '@playwright/test';

/**
 * HOMING SECTION — DERIVED HOME-END, NO INERT DROPDOWNS (t628). The advisor ruling: the per-axis Home-dir + Method
 * dropdowns in Settings → Machine → Homing were INERT (homeAxisBlocks hardcodes the method from the axis and derives the
 * seek direction from the DECLARED home switch — c.dir/c.method are never read for the per-axis emit), and their tooltips
 * LIED ("Auto = envelope sign"). They're replaced with:
 *   • fixed method text — "Switch seek (G31)" for X/Y/Z, "Set zero (no motion)" for rotary A/B;
 *   • a READ-ONLY derived home-end per axis — "home: MAX — from the declared switch" / "home: min …" — computed from
 *     declaredHomeEdgeSide(settings.limits), the SAME source that drives the G31 seek direction in the emit.
 * settings.homing shape is UNCHANGED (c.dir/c.method stay stored, inert). This proves the real symptom: the derived
 * display FOLLOWS the declared switch when the operator flips Home Z max→min in the I/O table, and the emit follows the
 * SAME source (one source, no drift). The stored-but-inert c.dir/c.method never leak into the emit (byte-identity).
 */
test.use({ viewport: { width: 1300, height: 980 } });

// z:500 (positive travel) → span 500 → the G31 seek distance is dir*(span+20)=±520. seekFeed 600 → "G31 Z±520 F600".
const SETTINGS = {
    machine: { x: 600, y: 400, z: 500, show: false, softLimits: true, workOrigin: { x: 0, y: 0, z: 0 } },
    homing: { philosophy: 'sequential', axes: {
        z: { enable: true, order: 1, method: 'seek', seekFeed: 600 },
        x: { enable: true, order: 2, method: 'seek', seekFeed: 800 },
        y: { enable: true, order: 3, method: 'seek', seekFeed: 800 },
    } },
    // the I/O table (settings.inputs) is the ONE source for the declared home switch; the I/O checkbox's onChange runs
    // syncFlatFromIO → mirrors row.home → settings.limits.<edge>Home, which declaredHomeEdgeSide reads. Seed z_max as the
    // home end (router norm: Z homes UP), and set the flat `limits` to match so the pre-flip state is deterministic.
    limits: { zMaxHome: true, xMinHome: true, yMinHome: true },
    inputs: [
        { id: 'lim_zmax', type: 'limit', axis: 'z_max', label: 'Home Z', pin: '', level: 0, switchType: 'mechanical', home: true },
        { id: 'lim_zmin', type: 'limit', axis: 'z_min', label: 'Limit Z−', pin: '', level: 0, switchType: 'mechanical', home: false },
        { id: 'lim_xmin', type: 'limit', axis: 'x_min', label: 'Home X', pin: '', level: 0, switchType: 'mechanical', home: true },
        { id: 'lim_ymin', type: 'limit', axis: 'y_min', label: 'Home Y', pin: '', level: 0, switchType: 'mechanical', home: true },
    ],
};

async function seed(page) {
    await page.evaluate((S) => {
        const s = window.ddcsGetSettings();
        Object.assign(s, JSON.parse(JSON.stringify(S)));
        s._ioHomeBackfill = 1;   // the one-time backfill already ran on load; keep it from touching our seeded switches
    }, SETTINGS);
}

// the emit for the CURRENT settings, via the production contract helper (the same path the wizard + sysstart use)
async function homingEmit(page) {
    return page.evaluate(async () => {
        const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        return emitMapped(homingStack(homingRunParams(window.ddcsGetSettings()))).text;
    });
}

test('the Homing section shows the derived home-end (no dir/method dropdowns), the fixed G31 method, and it FOLLOWS the declared switch flipped in I/O — the emit follows the same source', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
    await seed(page);

    // ── open Settings → Machine → Homing ─────────────────────────────────────────────────────────────────────────
    await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_machine', scrollTo: 'set_homing_section' }));
    await page.waitForSelector('#settings-overlay.active #set_homing_section', { timeout: 8000 });
    await page.waitForFunction(() => document.querySelectorAll('#set_homing_axes .homing-axis-row').length >= 3);

    const before = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#set_homing_axes .homing-axis-row')];
        const zRow = rows.find((r) => r.getAttribute('data-axis') === 'z');
        return {
            dirSelects: document.querySelectorAll('#set_homing_axes .hm-dir').length,
            methodSelects: document.querySelectorAll('#set_homing_axes .hm-method').length,
            rotSelects: document.querySelectorAll('#set_homing_axes .hm-rotmode').length,
            zText: zRow.textContent.replace(/\s+/g, ' ').trim(),
            zEnd: (zRow.querySelector('.hm-home-end') || {}).textContent || '',
        };
    });
    // the inert dropdowns are gone
    expect(before.dirSelects, 'no Home-dir dropdown remains').toBe(0);
    expect(before.methodSelects, 'no Method dropdown remains').toBe(0);
    expect(before.rotSelects, 'no rotary switch/set-zero dropdown remains').toBe(0);
    // the method reads as fixed G31 text
    expect(before.zText, 'the Z method reads as fixed "Switch seek (G31)"').toContain('Switch seek (G31)');
    // the derived home-end shows MAX, from the declared switch (z_max Home is on)
    expect(before.zEnd, 'the Z home-end is derived from the declared switch').toMatch(/home:\s*MAX/);
    expect(before.zEnd, 'attributed to the declared switch (not the old "Auto envelope" lie)').toMatch(/declared switch/);
    await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/homing-derived-max.png' });

    // the emit seeks Z toward MAX (+520) with the configured 600 feed
    const emitMax = await homingEmit(page);
    expect(emitMax, 'Z seeks toward the declared MAX end (+520)').toMatch(/G31 Z520 F600/);
    expect(emitMax, 'not the min direction').not.toMatch(/G31 Z-520/);

    // ── the byte-identity guard: the STORED-but-inert c.dir/c.method must NOT leak into the emit ──────────────────
    const inertSame = await page.evaluate(async () => {
        const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const s = window.ddcsGetSettings();
        const clean = emitMapped(homingStack(homingRunParams(s))).text;
        // poison the removed dropdowns' fields with values that WOULD change the emit if they were read
        s.homing.axes.z.dir = '+'; s.homing.axes.z.method = 'native';
        s.homing.axes.x.dir = '-'; s.homing.axes.x.method = 'setzero';
        const poisoned = emitMapped(homingStack(homingRunParams(s))).text;
        // restore
        delete s.homing.axes.z.dir; delete s.homing.axes.z.method; delete s.homing.axes.x.dir; delete s.homing.axes.x.method;
        return { clean, poisoned };
    });
    expect(inertSame.poisoned, 'c.dir/c.method are inert — setting them does NOT change the emit (byte-identical)').toBe(inertSame.clean);

    // ── flip Home Z max→min in the I/O table (the REAL operator gesture) ──────────────────────────────────────────
    await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_input' }));
    await page.waitForSelector('#settings-overlay.active #io_input_table .io-home-cb', { timeout: 8000 });
    const flipped = await page.evaluate(() => {
        const table = document.getElementById('io_input_table');
        for (const cb of table.querySelectorAll('.io-home-cb')) {
            const row = cb.closest('div');
            const sel = [...row.querySelectorAll('select')].find((s) => /^[xyz]_(min|max)$/.test(s.value));
            if (sel && sel.value === 'z_min' && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        }
        return false;
    });
    expect(flipped, 'found the z_min limit row and checked its Home switch').toBe(true);
    // the declared switch mirrored to the flat limits (syncFlatFromIO): z_min Home on, z_max Home cleared (≤1 home/axis)
    const lim = await page.evaluate(() => { const L = window.ddcsGetSettings().limits; return { zMax: !!L.zMaxHome, zMin: !!L.zMinHome }; });
    expect(lim.zMin, 'z_min is now the declared home switch').toBe(true);
    expect(lim.zMax, 'z_max Home was cleared (only one end per axis)').toBe(false);

    // ── back to Machine → Homing: the derived display FOLLOWS the flip ────────────────────────────────────────────
    await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_machine', scrollTo: 'set_homing_section' }));
    await page.waitForSelector('#settings-overlay.active #set_homing_axes .homing-axis-row', { timeout: 8000 });
    const after = await page.evaluate(() => {
        const zRow = [...document.querySelectorAll('#set_homing_axes .homing-axis-row')].find((r) => r.getAttribute('data-axis') === 'z');
        return (zRow.querySelector('.hm-home-end') || {}).textContent || '';
    });
    expect(after, 'the Z home-end display followed the switch flip → min').toMatch(/home:\s*min/);
    await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/homing-derived-min.png' });

    // the emit follows the SAME source — Z now seeks toward MIN (-520). Display + emit are one source, no drift.
    const emitMin = await homingEmit(page);
    expect(emitMin, 'the emit followed the same declared switch → Z seeks toward MIN (-520)').toMatch(/G31 Z-520 F600/);
    expect(emitMin, 'no longer the max direction').not.toMatch(/G31 Z520 F600/);
});
