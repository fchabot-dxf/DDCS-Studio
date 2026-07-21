// t994 — the ASYMMETRIC per-end soft-limit box (FINDINGS V5, machine-confirmed). The Expert soft limits are per-end
// (#161-168), can be offset/tighter than the symmetric span (e.g. xMin −5 / xMax 295), and use ±9999 as a per-end
// 'no-limit' sentinel. The old symmetric 0..travel box UNDER-flags a tighter/offset real box → a FALSE GREEN (fits the
// check, the machine halts). checkEnvelope now uses machine.softLimitBox when present (±9999 → unbounded), else falls
// back to the symmetric axisSpan(travel).
import { test, expect } from '@playwright/test';

const WCS = { active: 1, table: [{ x: 0, y: 0, z: 0 }] };
const run = (page, program, settings) => page.evaluate(async ({ program, settings }) => {
    const { checkEnvelope } = await import('/engine/envelopeCheck.js');
    const r = checkEnvelope(program, settings);
    return { status: r.status, viol: r.violations.map((v) => ({ axis: v.axis, over: v.overshoot })) };
}, { program, settings });

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
});

test('FALSE-GREEN CLOSED: a move past a TIGHTER asymmetric xMax flags with the box, but fits the symmetric span', async ({ page }) => {
    // symmetric travel X 0..300, but the REAL box is xMin −5 / xMax 295 (tighter + offset).
    const box = { xMin: -5, xMax: 295, yMin: -5, yMax: 295, zMin: -120, zMax: 0 };
    const boxed = { machine: { x: 300, y: 300, z: -120, wcs: WCS, softLimitBox: box } };
    const symmetric = { machine: { x: 300, y: 300, z: -120, wcs: WCS } };   // no box → the OLD symmetric check
    const prog = 'G21 G90 M3 S1000\nG0 X298';   // X=298: past the real xMax 295, but inside the symmetric 300
    const withBox = await run(page, prog, boxed);
    const symOld = await run(page, prog, symmetric);
    expect(symOld.status, 'the OLD symmetric check FITS X298 (the false-green)').toBe('green');
    expect(withBox.status, 'the real box FLAGS X298 > xMax 295 (false-green CLOSED)').toBe('red');
    expect(withBox.viol.find((v) => v.axis === 'X+'), 'an X+ over-travel').toBeTruthy();
});

test('OFFSET min: a move past a negative-offset xMin flags', async ({ page }) => {
    const box = { xMin: -5, xMax: 295, yMin: 0, yMax: 300, zMin: -120, zMax: 0 };
    const boxed = { machine: { x: 300, y: 300, z: -120, wcs: WCS, softLimitBox: box } };
    const in5 = await run(page, 'G21 G90 M3 S1000\nG0 X-3', boxed);   // X=-3: within xMin −5 → OK
    const past = await run(page, 'G21 G90 M3 S1000\nG0 X-8', boxed);  // X=-8: past xMin −5 → flag
    expect(in5.status, 'X-3 within xMin −5 → fits').toBe('green');
    expect(past.status, 'X-8 past xMin −5 → red').toBe('red');
    expect(past.viol.find((v) => v.axis === 'X-'), 'an X- over-travel').toBeTruthy();
});

test('SENTINEL end unbounded: ±9999 = no soft limit → no over-travel flag on that end', async ({ page }) => {
    const box = { xMin: -9999, xMax: 9999, yMin: -5, yMax: 295, zMin: -120, zMax: 0 };   // X unbounded both ends
    const boxed = { machine: { x: 300, y: 300, z: -120, wcs: WCS, softLimitBox: box } };
    const r = await run(page, 'G21 G90 M3 S1000\nG0 X5000 Y100', boxed);   // X=5000: unbounded → no flag; Y=100 within
    expect(r.status, 'a ±9999 (sentinel) X-end never flags an over-travel').toBe('green');
});

test('SYMMETRIC fallback unchanged: no box → the old axisSpan(travel) still flags past-travel', async ({ page }) => {
    const symmetric = { machine: { x: 300, y: 300, z: -120, wcs: WCS } };
    const r = await run(page, 'G21 G90 M3 S1000\nG0 X400', symmetric);   // no box → 0..300 → X400 past → red
    expect(r.status).toBe('red');
    expect(r.viol.find((v) => v.axis === 'X+' && v.over > 99), 'X+ by 100').toBeTruthy();
});
