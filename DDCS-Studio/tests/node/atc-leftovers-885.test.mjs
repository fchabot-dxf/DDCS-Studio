import { test, expect } from './support/harness.mjs';

/**
 * t885 — ATC LEFTOVERS (backlog item 12), the advisor-ruled re-scope:
 * (1) machine-frame ATC sim = VERIFY-ONLY (already built + locked by atc-magazine-frame.spec) — a screenshot here.
 * (2) DISK INDEXING = option A: a DECLARED `atc.diskOffsetDeg` (one whole-carousel angular offset) folded into the ring's
 *     ang0, so slot angle = ang0_base + offset + index x 360/n; the change theta cancels BOTH offset and index to the pickup.
 * (3) 3D MAGAZINE POLISH: the carousel PLATE renders as a thin disc (magazinePockets carries .disk); EMPTY pockets (a
 *     magazine row with no tool) draw a dimmed slot box, NOT a fake tool silhouette.
 * Byte-identity: sim-only — the real ATC emit is `T# M6` / the inline body (never the ring positions), so the offset never
 * leaks into the .nc (the atc emit goldens are asserted untouched by the full gate).
 *
 * TIER MIGRATION WORK PACKAGE D: moved browser→node. Only the pure magazinePockets() tests (piece 2 x2 + piece 3) moved
 * — plain import()+evaluate over a declared pure function, no DOM. The file's 4th test ("pieces 1+3: the machine-frame
 * magazine renders...") builds a real GcodeViz3D (Three.js), appends a DOM host, and screenshots it — a genuine
 * app+DOM+render dependency, not a candidate for this tier. Split into tests/atc-leftovers-885-drive.spec.js.
 */

const DISK = {
    magType: 'disk', pickup: { x: 150, y: 100, z: -40 }, diskDia: 120, diskAxis: '+y',
    magazine: [{ pocket: 1, tool: 1 }, { pocket: 2, tool: 2 }, { pocket: 3, tool: '' }, { pocket: 4, tool: 4 }],
    tools: [{ num: 1, dia: 6, type: 'endmill' }, { num: 2, dia: 3, type: 'ballnose' }, { num: 4, dia: 6, type: 'vbit', angle: 60 }],
};

test('piece 2: the declared diskOffsetDeg rotates the WHOLE carousel; slot angle = ang0 + offset + index x 360/n', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async ([DISK]) => {
        const { magazinePockets } = await import('/wizards/views/atcViews.js');
        const base = magazinePockets(DISK, 0);                          // offset unset → 0
        const off = magazinePockets({ ...DISK, diskOffsetDeg: 30 }, 0);  // + a declared 30° carousel offset
        const n = DISK.magazine.length;
        return {
            n,
            rot: base.map((p, i) => off[i].ang - p.ang),                 // per-pocket rotation from the offset (should all be 30° = π/6)
            spacing: base.map((p) => p.ang - base[0].ang),              // even index spacing (should be i·2π/n)
        };
    }, [DISK]);
    const d = 30 * Math.PI / 180;
    for (let i = 0; i < r.n; i++) {
        expect(Math.abs(r.rot[i] - d), `pocket ${i} rotates by the declared 30° offset`).toBeLessThan(1e-9);
        expect(Math.abs(r.spacing[i] - i * (2 * Math.PI / r.n)), `pocket ${i} sits at index x 360/n (even spacing)`).toBeLessThan(1e-9);
    }
});

test('piece 2: a change indexes the target pocket to the fixed pickup, cancelling BOTH the offset and the index', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async ([DISK]) => {
        const { magazinePockets } = await import('/wizards/views/atcViews.js');
        const n = DISK.magazine.length, i = 1, off = 30 * Math.PI / 180;   // target pocket index 1 (tool 2), 30° carousel offset
        const theta = -(off + (i / n) * 2 * Math.PI);                       // the diskTheta formula (offset + index → pickup)
        const pk = magazinePockets({ ...DISK, diskOffsetDeg: 30 }, theta)[i];
        return { x: pk.x, y: pk.y };
    }, [DISK]);
    expect(Math.abs(r.x - 150), 'the indexed target pocket lands at the pickup X').toBeLessThan(0.01);
    expect(Math.abs(r.y - 100), 'the indexed target pocket lands at the pickup Y').toBeLessThan(0.01);
});

test('piece 3: magazinePockets carries the carousel PLATE geometry + flags EMPTY pockets (a no-tool row)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async ([DISK]) => {
        const { magazinePockets } = await import('/wizards/views/atcViews.js');
        const out = magazinePockets(DISK, 0);
        return { hasDisk: !!out.disk, R: out.disk && out.disk.R, cx: out.disk && out.disk.cx, empties: out.map((p) => p.empty) };
    }, [DISK]);
    expect(r.hasDisk, 'the disk pocket list carries .disk plate geometry').toBe(true);
    expect(Math.abs(r.R - 60), 'the plate radius = diskDia/2').toBeLessThan(0.01);
    expect(r.empties, 'pocket 3 (no tool) is flagged empty; the rest occupied').toEqual([false, false, true, false]);
});
