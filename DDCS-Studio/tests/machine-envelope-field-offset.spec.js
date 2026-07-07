import { test, expect } from '@playwright/test';

/**
 * MACHINE ENVELOPE — the axis-travel input fields are offset CLEAR of the 3D envelope edges (t493, UI polish; the human
 * asked). The fields used to sit ON the edge midpoints and obscure the box; now each is pushed OUTWARD from the box
 * centre so the coloured edges read clear while the field stays beside its own axis. VERIFY: the box is un-obscured
 * (fields off the edges), the fields still read + edit each axis's travel, + a screenshot of the tidied envelope.
 */
test.use({ viewport: { width: 900, height: 800 } });

async function openMachineTab(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = { ...(s.machine || {}), x: 600, y: -600, z: -120, show: true }; });
    await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_machine' }));
    await page.waitForSelector('#set_tab_machine', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const el = document.getElementById('set_mach_env_svg'); return el && el.querySelector('svg'); }, null, { timeout: 8000 });
    await page.waitForTimeout(250);
}

test('the travel fields are offset OFF their edge midpoints (box un-obscured) + read each axis correctly', async ({ page }) => {
    await openMachineTab(page);
    const r = await page.evaluate(() => {
        const gui = document.getElementById('set_mach_env_gui');
        const gb = gui.getBoundingClientRect();
        const rel = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { cx: b.left - gb.left + b.width / 2, cy: b.top - gb.top + b.height / 2 }; };
        const val = (id) => document.getElementById(id).value;
        // the SVG edge midpoints (where the fields USED to sit) — recompute from the same projection to prove the offset.
        const W = 260, H = 200, c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
        const X = 600, Y = -600, Z = -120;   // the values set in openMachineTab
        const P = (x, y, z) => [(x - y) * c, (x + y) * s - z];
        const all = []; for (const x of [0, X]) for (const y of [0, Y]) for (const z of [0, Z]) all.push(P(x, y, z));
        const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), pad = 38;
        const scale = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY));
        const ox = (W - (minX + maxX) * scale) / 2, oy = (H - (minY + maxY) * scale) / 2;
        const S = (x, y, z) => { const p = P(x, y, z); return [ox + p[0] * scale, oy + p[1] * scale]; };
        const k = (i, j, l) => S(i ? X : 0, j ? Y : 0, l ? Z : 0);
        const O = k(0, 0, 0), c100 = k(1, 0, 0), c010 = k(0, 1, 0), c001 = k(0, 0, 1);
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const midOf = { set_mach_x: mid(O, c100), set_mach_y: mid(O, c010), set_mach_z: mid(O, c001) };
        const dist = (id) => { const f = rel(id); const m = midOf[id]; return Math.hypot(f.cx - m[0], f.cy - m[1]); };
        return {
            vx: val('set_mach_x'), vy: val('set_mach_y'), vz: val('set_mach_z'),
            dx: dist('set_mach_x'), dy: dist('set_mach_y'), dz: dist('set_mach_z'),
        };
    });
    await page.locator('#set_mach_env_gui').screenshot({ path: 'scratchpad/machine_envelope_fields.png' });
    // the fields still read each axis's travel
    expect(r.vx, 'X field shows the X travel').toBe('600');
    expect(r.vy, 'Y field shows the Y travel').toBe('-600');
    expect(r.vz, 'Z field shows the Z travel').toBe('-120');
    // each field is now offset OFF its edge midpoint (no longer sitting ON the edge → the box reads clear). The exact px
    // varies with the clamp at the container edge; a meaningful (>12px) shift proves the field left the edge line.
    expect(r.dx, 'X field is offset clear of its edge midpoint').toBeGreaterThan(12);
    expect(r.dy, 'Y field is offset clear of its edge midpoint').toBeGreaterThan(12);
    expect(r.dz, 'Z field is offset clear of its edge midpoint').toBeGreaterThan(12);
});

test('editing a travel field still updates that axis (the offset is visual-only)', async ({ page }) => {
    await openMachineTab(page);
    await page.fill('#set_mach_x', '450');
    await page.dispatchEvent('#set_mach_x', 'change');
    const x = await page.evaluate(() => window.ddcsGetSettings().machine.x);
    expect(x, 'editing the X field commits the new travel to settings').toBe(450);
});
