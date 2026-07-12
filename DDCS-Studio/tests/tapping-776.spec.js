import { test, expect } from '@playwright/test';

/**
 * t776 — THE TAPPING WIZARD (floating-holder). The pitch-locked feed is DERIVED (F = RPM × pitch; imperial pitch =
 * 25.4/TPI), and the tap atom emits the cycle: M3 S<low> + a stabilize dwell, feed to depth at the locked F, M4 (reverse)
 * + feed out at the same F, M5. Feed is never a stored param, so the shown feed can't drift from the emit.
 */

test('the pitch-locked feed: metric M6×1.0 → F400, imperial 1/4-20 → F508 (both at 400 rpm)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { tapFeed, threadPreset } = await import('/wizards/threads.js');
    const m6 = threadPreset('M6 × 1.0'), q = threadPreset('1/4-20 UNC');
    return { m6feed: tapFeed(400, m6.pitch), qpitch: Math.round(q.pitch * 1000) / 1000, qfeed: tapFeed(400, q.pitch) };
  });
  expect(r.m6feed, 'M6×1.0 @ 400rpm → F = 400 × 1.0 = 400').toBe(400);
  expect(r.qpitch, '1/4-20 lead = 25.4/20 mm').toBe(1.27);
  expect(r.qfeed, '1/4-20 @ 400rpm → F = 400 × 1.27 = 508').toBe(508);
});

test('the floating-holder cycle emits M3 + dwell → feed-to-depth at the locked F → M4 → feed out → M5', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { tapStack } = await import('/wizards/tapWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const metric = emitMapped(tapStack({ x: 10, y: 20, depth: 12, rpm: 400, pitch: 1.0, clearance: 5, dwell: 0.3 })).text;
    const imperial = emitMapped(tapStack({ x: 0, y: 0, depth: 8, rpm: 400, pitch: 25.4 / 20, clearance: 5 })).text;
    return { metric, imperial };
  });
  const g = r.metric;
  expect(/M3 S400/.test(g), 'spindle forward at the tap rpm').toBe(true);
  expect(/G1 Z-12 F400/.test(g), 'feed to depth at the pitch-locked F400').toBe(true);
  expect(/M4 S400/.test(g), 'reverse at depth').toBe(true);
  expect(/G1 Z5(\s|$)/m.test(g), 'feed out to clearance (feed is modal → F400 not repeated)').toBe(true);
  expect(/M5/.test(g), 'spindle off').toBe(true);
  expect(g.indexOf('G1 Z-12') < g.indexOf('M4'), 'feed-in precedes the reverse').toBe(true);
  expect(g.indexOf('M4') < g.lastIndexOf('G1 Z5'), 'reverse precedes the feed-out').toBe(true);
  expect(/G1 Z-8 F508/.test(r.imperial), '1/4-20 emits the derived F508 to depth').toBe(true);
});

test('the RIGID variant emits a G84-style cycle with a verify note (gating is upstream)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const g = await page.evaluate(async () => {
    const { tapStack } = await import('/wizards/tapWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    return emitMapped(tapStack({ depth: 12, rpm: 500, pitch: 1.0, rigid: true })).text;
  });
  expect(/G84 Z-12/.test(g), 'a G84-style rigid cycle to depth').toBe(true);
  expect(/G80/.test(g), 'cancels the canned cycle').toBe(true);
  expect(/VERIFY/i.test(g), 'carries the honest unverified-on-hardware note').toBe(true);
  expect(/G1 Z-12 F/.test(g), 'rigid does NOT use the floating-holder feed move').toBe(false);
});
