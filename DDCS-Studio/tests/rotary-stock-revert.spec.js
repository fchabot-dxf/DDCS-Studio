import { test, expect } from '@playwright/test';

// A rotary-centre op forces the stock to a round CYLINDER (so the preview / probe collision / Ø-pull all match).
// When the operator then opens a NON-rotary probe op (middle / corner / edge), the stock must revert to the
// remembered BOX — restoreBoxStock() does that, and those views call it from onOpen. This verifies the round-trip.
test.use({ viewport: { width: 1000, height: 800 } });

test('cylinder stock reverts to the box when a non-rotary view restores it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings && !!window.ddcsApplySettings);
  const r = await page.evaluate(async () => {
    const { activateCylinderStock, restoreBoxStock } = await import('/wizards/views/rotaryCenterView.js');
    // Start from a known rectangular stock.
    window.ddcsApplySettings({ stock: { x: 120, y: 80, z: 25, shape: 'box', show: true } });
    const before = { ...window.ddcsGetSettings().stock };
    activateCylinderStock();                 // rotary op → forced cylinder
    const asCyl = { ...window.ddcsGetSettings().stock };
    restoreBoxStock();                       // a non-rotary view (middle/corner/edge) calls this from onOpen
    const reverted = { ...window.ddcsGetSettings().stock };
    return { before, asCyl, reverted };
  });
  expect(r.before.shape).toBe('box');
  expect(r.asCyl.shape, 'rotary op forced a cylinder').toBe('cylinder');
  expect(r.reverted.shape, 'non-rotary view reverted to the box').toBe('box');
  expect(r.reverted.x, 'original box dims restored').toBe(120);
  expect(r.reverted.y).toBe(80);
});
