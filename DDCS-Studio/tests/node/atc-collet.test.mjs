import { test, expect } from './support/harness.mjs';

/**
 * PICK-PLACE choreography kind (P-C.3a, t193). generic/disk resolve to a NEW 'pick-place' kind via the seam. SIM/VISUAL
 * only → emit byte-identical. Asserts the VALUE.
 *
 * TIER MIGRATION WORK PACKAGE D: moved browser→node. Only this first test moved — plain import()+evaluate over a
 * declared pure function, no DOM. The file's other three tests (the collet device open/close via a real viz panel,
 * the io_change-driven collet flip, and the sensor live-lighting DOM check) depend on a real wizard panel / Three.js
 * viz object / DOM query and a live io_change listener firing — genuine app+DOM dependencies, not candidates for this
 * tier. Split into tests/atc-collet-drive.spec.js.
 */

test('(1) the seam resolves generic/disk to the pick-place kind (firmware stays push, m6 macro-call)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const c = await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcChangeWizard.js');
    return {
      generic: atcChoreography({ method: 'generic' }), disk: atcChoreography({ method: 'disk' }),
      firmware: atcChoreography({ method: 'firmware' }).kind, m6: atcChoreography({ method: 'm6' }).kind, manual: atcChoreography({ method: 'manual' }),
    };
  });
  expect(c.generic, 'generic → pick-place / magazine').toMatchObject({ kind: 'pick-place', variant: 'magazine' });
  expect(c.disk, 'disk → pick-place / carousel').toMatchObject({ kind: 'pick-place', variant: 'carousel' });
  expect(c.firmware, 'firmware stays push').toBe('push');
  expect(c.m6, 'm6 stays macro-call').toBe('macro-call');
  expect(c.manual, 'manual → no inline choreography').toBeNull();
});
