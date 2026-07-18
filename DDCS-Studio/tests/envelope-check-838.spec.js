// t838 — the PRE-FLIGHT ENVELOPE CHECK core: trace in the machine frame vs the declared envelope, report line+axis+overshoot.
// Drives the pure checkEnvelope() with SYNTHETIC settings (it takes settings as an arg — no app-state mutation needed).
import { test, expect } from '@playwright/test';

// Envelope: X 0..300, Y 0..300, Z -120..0 (z:-120 homes at the top). Declared = a non-empty WCS table.
const DECLARED = { machine: { x: 300, y: 300, z: -120, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }] } }, limits: {} };
const UNDECLARED = { machine: { x: 300, y: 300, z: -120, wcs: { active: 1, table: null } }, limits: {} };

// t947 — the cutting snippets carry `M3 S1000` on line 1 so the DEAD-SPINDLE guard (a G1/G2/G3 feed with no preceding
// spindle-on) does not fire, isolating the ENVELOPE behaviour under test. M3 is not a move → the trace + envelope
// violations are byte-identical, and it sits on the existing G21 G90 line so no line number shifts. Probe snippets
// (G0 + G31, no feed cut) need no M3 — the guard excludes probes by construction (see spindle-guard-947.spec.js).
const run = (page, program, settings) => page.evaluate(async ({ program, settings }) => {
    const { checkEnvelope } = await import('/engine/envelopeCheck.js');
    return checkEnvelope(program, settings);
}, { program, settings });

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
});

test('RED: a move that climbs above the Z top reports LINE + AXIS + exact OVERSHOOT (the user crash)', async ({ page }) => {
    // Line 0: G21 G90 ; line 1: a Z+3 move → machine Z=3, 3mm above the Z max (0) → Z+ by 3.
    const r = await run(page, 'G21 G90 M3 S1000\nG1 Z3 F100', DECLARED);
    expect(r.status).toBe('red');
    expect(r.violations.length).toBeGreaterThanOrEqual(1);
    const v = r.violations.find(v => v.axis === 'Z+');
    expect(v, 'a Z+ violation exists').toBeTruthy();
    expect(v.line, 'reported 1-based line of the offending move').toBe(2);
    expect(v.overshoot).toBeGreaterThan(2.9);
    expect(v.overshoot).toBeLessThan(3.1);
});

test('GREEN: a program that stays inside the envelope fits', async ({ page }) => {
    const r = await run(page, 'G21 G90 M3 S1000\nG0 X10 Y10\nG1 Z-5 F100\nG1 X20 Y20', DECLARED);
    expect(r.status).toBe('green');
    expect(r.violations.length).toBe(0);
});

test('AMBER: undeclared placement (no WCS table) cannot be verified — never false-green', async ({ page }) => {
    // Same climbing move, but placement is UNDECLARED → we must NOT map/verify → amber with a why.
    const r = await run(page, 'G21 G90 M3 S1000\nG1 Z3 F100', UNDECLARED);
    expect(r.status).toBe('amber');
    expect(r.violations.length).toBe(0);
    expect(r.reason).toMatch(/placement not declared|WCS/i);
});

test('PROBE: the trip-dependent G31 move is NAMED unchecked; the deterministic moves are checked', async ({ page }) => {
    // G0 down (deterministic, in-envelope) → G31 probe (trip-dependent, unchecked) → G0 retract (deterministic, in-envelope).
    const r = await run(page, 'G21 G90\nG0 Z-5\nG31 Z-50 F100\nG0 Z-5', DECLARED);
    expect(r.uncheckedProbes, 'the G31 segment is counted as unchecked').toBeGreaterThanOrEqual(1);
    expect(r.status, 'the deterministic moves are in-envelope → green (the probe class is separate)').toBe('green');
});

test('PROBE + a real breach: a deterministic rapid past the envelope is RED even amid probe moves', async ({ page }) => {
    // The G0 X400 rapid exceeds X max (300) by 100 — a DETERMINISTIC move → red; the G31 stays counted-but-unchecked.
    const r = await run(page, 'G21 G90\nG0 X400\nG31 Z-50 F100', DECLARED);
    expect(r.status).toBe('red');
    const v = r.violations.find(v => v.axis === 'X+');
    expect(v).toBeTruthy();
    expect(v.overshoot).toBeGreaterThan(99);
    expect(r.uncheckedProbes).toBeGreaterThanOrEqual(1);
});
