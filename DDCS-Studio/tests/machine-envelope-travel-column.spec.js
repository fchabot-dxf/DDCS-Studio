import { test, expect } from '@playwright/test';

/**
 * MACHINE ENVELOPE travel fields — a CLEAN COLUMN beside the 3D box (t540, supersedes the corner-offset attempt 7458548).
 * The three inputs used to FLOAT at the box corners and OVERLAP each other (the human's repro: -120 stacked on 300). Now
 * they stack vertically in one aligned labeled column (X red / Y green / Z blue) beside the envelope box — nothing floats
 * on the box, nothing overlaps at ANY aspect ratio. The box still redraws live as you type. VERIFY the column + no overlap.
 */
test.use({ viewport: { width: 900, height: 800 } });

async function openMachineTab(page, mach) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
    await page.evaluate((mach) => { const s = window.ddcsGetSettings(); s.machine = { ...(s.machine || {}), ...mach, show: true }; }, mach);
    await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_machine' }));
    await page.waitForSelector('#set_tab_machine', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const el = document.getElementById('set_mach_env_svg'); return el && el.querySelector('svg'); }, null, { timeout: 8000 });
    await page.waitForTimeout(250);
}

function rects(page) {
    return page.evaluate(() => {
        const svg = document.getElementById('set_mach_env_svg').getBoundingClientRect();
        const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; };
        return { svg: { left: svg.left, right: svg.right }, x: r('set_mach_x'), y: r('set_mach_y'), z: r('set_mach_z') };
    });
}

function assertColumn(r) {
    // 1. VERTICAL STACK: X above Y above Z (increasing cy), and NO overlap (each row's bottom ≤ the next row's top).
    expect(r.x.cy, 'X sits above Y').toBeLessThan(r.y.cy);
    expect(r.y.cy, 'Y sits above Z').toBeLessThan(r.z.cy);
    expect(r.x.bottom, 'X does not overlap Y').toBeLessThanOrEqual(r.y.top + 0.5);
    expect(r.y.bottom, 'Y does not overlap Z').toBeLessThanOrEqual(r.z.top + 0.5);
    // 2. ALIGNED column: the three inputs share a left edge (within 1px).
    expect(Math.abs(r.x.left - r.y.left), 'X/Y left edges aligned').toBeLessThan(1.5);
    expect(Math.abs(r.y.left - r.z.left), 'Y/Z left edges aligned').toBeLessThan(1.5);
    // 3. BESIDE the box: every field is to the RIGHT of the SVG box (no field floats over the 3D box).
    for (const k of ['x', 'y', 'z']) expect(r[k].left, `${k} field is beside (right of) the box, not on it`).toBeGreaterThanOrEqual(r.svg.right - 1);
}

test('the travel fields render as one aligned labeled column beside the box (default)', async ({ page }) => {
    await openMachineTab(page, { x: 600, y: -600, z: -120 });
    const r = await rects(page);
    assertColumn(r);
    // the fields still read their axis values
    const vals = await page.evaluate(() => ['set_mach_x', 'set_mach_y', 'set_mach_z'].map((id) => document.getElementById(id).value));
    expect(vals).toEqual(['600', '-600', '-120']);
    await page.locator('#set_mach_env_gui').screenshot({ path: 'scratchpad/machine_travel_column.png' });
});

test('no overlap at the human\'s repro aspect ratio (756 / -776 / -150)', async ({ page }) => {
    await openMachineTab(page, { x: 756, y: -776, z: -150 });
    assertColumn(await rects(page));
    await page.locator('#set_mach_env_gui').screenshot({ path: 'scratchpad/machine_travel_column_756.png' });
});

test('no overlap at an extreme thin envelope (a stress aspect ratio)', async ({ page }) => {
    await openMachineTab(page, { x: 1200, y: -40, z: -600 });
    assertColumn(await rects(page));
});

test('typing a travel redraws the 3D box live (the column drives the box)', async ({ page }) => {
    await openMachineTab(page, { x: 600, y: -600, z: -120 });
    const before = await page.evaluate(() => document.getElementById('set_mach_env_svg').innerHTML);
    await page.fill('#set_mach_x', '350');
    await page.dispatchEvent('#set_mach_x', 'input');
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => document.getElementById('set_mach_env_svg').innerHTML);
    expect(after, 'the 3D envelope box re-renders as the travel is typed').not.toBe(before);
});
