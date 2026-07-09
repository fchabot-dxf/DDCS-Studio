import { test, expect } from '@playwright/test';

/**
 * PREVIEW-PARITY E2 (t582/t584) — ONE FRAME SOURCE. sceneFrame.js is THE declared scene transform every renderer reads,
 * so their pins can't drift (the few-inch-offset class). This locks the "one source" property NUMERICALLY:
 *   • partZeroShift (3D machine-frame part offset) and stockPinOffset (2D part-frame stock pin) share ONE WCS-table read.
 *   • the 2D pin is byte-identical to toolpath2d's former local stockPin formula (table[pin] − workOrigin; unpinned → 0).
 *   • for a pinned stock, stockPinOffset == partZeroShift.xy − workOrigin (the 2D derives from the SAME pin the 3D uses).
 * Checked at 2 WCS values × pinned/unpinned. Pure-module test (import the seam directly).
 */
test('sceneFrame: the 2D stock pin derives from the SAME declared source as the 3D part shift (2 WCS, pinned/unpinned)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const { partZeroShift, stockPinOffset } = await import('/viz/sceneFrame.js');
        // the OLD toolpath2d.stockPin formula, inline, as the byte-identity reference
        const oldStockPin = (machine, stock) => {
            const s = stock;
            if (!s || !s.pin || s.pin === 'origin' || !(machine && machine.wcs && machine.wcs.table)) return { x: 0, y: 0 };
            const gi = parseInt(String(s.pin).replace(/[^0-9]/g, ''), 10) - 54;
            const t = machine.wcs.table[gi], wo = machine.workOrigin || {};
            return t ? { x: (Number(t.x) || 0) - (wo.x || 0), y: (Number(t.y) || 0) - (wo.y || 0) } : { x: 0, y: 0 };
        };
        const cases = [];
        for (const wo of [{ x: 50, y: 30, z: 0 }, { x: 0, y: 0, z: 0 }]) {
            const machine = { x: 600, y: 400, z: -120, show: true, workOrigin: wo, wcs: { active: 1, table: [{ x: wo.x + 20, y: wo.y + 10, z: -5 }] } };
            for (const pinned of [true, false]) {
                const stock = { show: true, x: 100, y: 80, z: 25, datum: 'nnp', pin: pinned ? 'G54' : 'origin' };
                const sp = stockPinOffset(machine, stock);
                const old = oldStockPin(machine, stock);
                const pz = partZeroShift(machine, stock, null);
                cases.push({ wo, pinned, sp, old, pzDerived: { x: pz.x - wo.x, y: pz.y - wo.y }, pinnedPz: pinned });
            }
        }
        return cases;
    });
    for (const c of r) {
        // (1) byte-identical to the former local toolpath2d.stockPin
        expect(c.sp, `stockPinOffset == old local formula (wo ${c.wo.x},${c.wo.y}, ${c.pinned ? 'pinned' : 'unpinned'})`).toEqual(c.old);
        // (2) for a PINNED stock, the 2D pin == the 3D part shift − workOrigin (same declared source, one pin)
        if (c.pinned) {
            expect(Math.abs(c.sp.x - c.pzDerived.x) + Math.abs(c.sp.y - c.pzDerived.y), 'the 2D pin derives from the SAME pin the 3D partZeroShift uses').toBeLessThan(1e-9);
        } else {
            expect(c.sp, 'an unpinned stock IS part-zero → {0,0}').toEqual({ x: 0, y: 0 });
        }
    }
});
