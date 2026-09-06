import { test, expect } from './support/harness.mjs';

/**
 * HOMING increment 2 (t504) — homing READS the DECLARED home switch (settings.limits.<edge>Home), NOT the machine
 * travel-SIGN. The sign inference (axisSpan.homeSide → machine-0) WAS the positive-Z plunge: a +Z envelope makes
 * machine-0 the BOTTOM. Now the home end = the declared edge (seeded Z→z_max/top), so Z homes UP to the TOP whether
 * machine.z is + or − (SIGN-AGNOSTIC). VERIFY the seek TARGET (axisHomeMotion), the sim proxy, the emitted G31
 * direction, and the REAL wizard at BOTH signs. DECLARATION-read only — the emit STRUCTURE is untouched (increment 3).
 *
 * t2695 — TIER MIGRATION BATCH 5: moved browser→node. ONLY the first ("deterministic") test moved — pure
 * `axisHomeMotion`/`declaredHomeEdgeSide`/`homingStack`/`emitMapped`, no DOM. The file's other 2 tests
 * ("REAL APP: machine.z=...") drive the real wizard, play a real Three.js simulation, and screenshot — a genuine
 * app+DOM+render dependency. Split into tests/homing-declared-home-drive.spec.js, left in the browser tier.
 */

// ── DETERMINISTIC: the home TARGET + emit direction are the declared TOP (z_max = hi) for BOTH signs. ──
test('axisHomeMotion + the emitted G31 target the DECLARED home edge (z_max = TOP), sign-agnostic', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    const r = await page.evaluate(async () => {
        const { axisHomeMotion, declaredHomeEdgeSide } = await import('/engine/limitSwitches.js');
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const zMax = { zMaxHome: true }, zMin = { zMinHome: true };
        const seekOf = (travel, limits) => axisHomeMotion(travel, { axis: 'z', limits, backoff: 5 }).seek;
        const g31Dist = (z, limits) => (emitMapped(homingStack({ axes: ['z'], config: { z: { enable: true } }, machine: { z }, limits })).text.match(/G31 Z(-?[\d.]+)/) || [])[1];   // t536 — the simple shape's first (fast) G31 Z seek distance (span-sized, signed toward the home end)
        return {
            side: { neg: declaredHomeEdgeSide('z', zMax), noDecl: declaredHomeEdgeSide('z', {}) },
            seek: { negMax: seekOf(-120, zMax), posMax: seekOf(500, zMax), posMin: seekOf(500, zMin), posNoDecl: seekOf(500, {}) },
            g31: { neg: g31Dist(-120, zMax), pos: g31Dist(500, zMax) },
        };
    });
    // declaredHomeEdgeSide reads the flag (max) and returns null when nothing is declared
    expect(r.side.neg, 'zMaxHome → the max edge is home').toBe('max');
    expect(r.side.noDecl, 'no declared home → null (caller falls back to the sign)').toBe(null);
    // the home TARGET is the DECLARED edge (z_max = hi = the TOP), SIGN-AGNOSTIC:
    expect(r.seek.negMax, 'Z=-120, zMaxHome → seek the TOP (hi=0)').toBe(0);
    expect(r.seek.posMax, 'Z=+500, zMaxHome → seek the TOP (hi=500), NOT machine-0/bottom (the plunge)').toBe(500);
    // it READS the flag, not the sign: zMinHome on the same +500 envelope → the BOTTOM (lo=0)
    expect(r.seek.posMin, 'Z=+500, zMinHome → seek the bottom (lo=0) — proves it reads the flag').toBe(0);
    // no declaration → the sign-derived machine-0 fallback (no regression)
    expect(r.seek.posNoDecl, 'Z=+500, no declared home → sign-derived machine-0 (0)').toBe(0);
    // t542 — the hand-made simProxy is DELETED (the preview plays the real emit); the declared-edge target lives in
    // axisHomeMotion (asserted above) + the emitted G31 direction (below), the ONE source. No proxy assertion.
    // the emitted G31 seeks UP (a POSITIVE, span-sized distance) toward z_max for BOTH signs (t536 simple shape)
    expect(Number(r.g31.neg), 'G31 Z=-120 seeks UP (positive) toward z_max').toBeGreaterThan(0);
    expect(Number(r.g31.pos), 'G31 Z=+500 seeks UP (positive) toward z_max, NOT down toward machine-0').toBeGreaterThan(0);
});
