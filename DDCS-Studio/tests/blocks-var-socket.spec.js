import { test, expect } from '@playwright/test';

// A #var / [expr] coordinate (e.g. `G0 Z#18`, common in probe/comm/ATC macros) must survive a round-trip
// THROUGH the Blockly workspace. The Move's x/y/z are numeric value sockets; a math_number shadow would
// collapse `#18` to 0, so a #var must render as a Variable reporter pill (and emit back verbatim).
test.use({ viewport: { width: 1280, height: 900 } });

test('#var coordinate survives the Blockly workspace round-trip (Variable pill, not 0)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws, { timeout: 8000 });

  // Load a program whose Move carries a #var Z and an [expr] X — straight into the Blockly workspace.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'move', params: { mode: 'rapid', x: '[0-#1]', y: 5, z: '#18' } },
  ]));
  await page.waitForTimeout(250);

  const r = await page.evaluate(() => ({
    gcode: window.ddcsGetBlockGcode(),
    varPills: window.__blkws.getAllBlocks(false).filter((b) => b.type === 'variable').length,
  }));
  expect(r.gcode, 'the #var Z survived (not collapsed to Z0)').toMatch(/Z#18/);
  expect(r.gcode, 'the [expr] X survived').toContain('X[0-#1]');
  expect(r.gcode, 'the plain numeric Y is still a number').toMatch(/Y5/);
  expect(r.varPills, 'the #var/[expr] coords became Variable reporter pills, not math_number 0s').toBe(2);
});
