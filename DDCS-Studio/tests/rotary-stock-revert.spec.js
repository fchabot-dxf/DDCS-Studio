import { test, expect } from '@playwright/test';

// t1722 (gate repair, cycle 857 ACT 2) — REWRITTEN to match the completed cleanup this file's OWN sibling
// (rotary-center-roundbar.spec.js) already named as deferred: "the BUILT-IN shim still mutates (deferred
// dead-code cleanup)". rotaryCenterView.js's activateCylinderStock() no longer mutates + persists
// window.ddcsGetSettings().stock at all (a preview writing user state was a defect on its own terms —
// PREVIEW-AS-DATA.md survey finding) — it derives a round bar LOCALLY, same shape as rotaryCenterData.js's own
// def.simStock. restoreBoxStock() is kept exported (edge/middle/rotary-clock views still call it on open) but
// is now a documented no-op: there is nothing left to restore.
test.use({ viewport: { width: 1000, height: 800 } });

test('opening the rotary-centre legacy view does NOT mutate the global stock; restoreBoxStock is a safe no-op', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings && !!window.ddcsApplySettings);
  const r = await page.evaluate(async () => {
    const rcv = await import('/wizards/views/rotaryCenterView.js');
    // Start from a known rectangular stock.
    window.ddcsApplySettings({ stock: { x: 120, y: 80, z: 25, shape: 'box', show: true } });
    const before = { ...window.ddcsGetSettings().stock };
    window.openWiz('rotary_center');   // the real gesture a rotary op's preview runs through
    await new Promise((r) => setTimeout(r, 200));   // onOpen's own update() runs on a 50ms setTimeout — outlast it
    const afterOpen = { ...window.ddcsGetSettings().stock };
    rcv.restoreBoxStock();                   // a non-rotary view (middle/corner/edge) still calls this on open — must stay harmless
    const afterRestore = { ...window.ddcsGetSettings().stock };
    return { before, afterOpen, afterRestore, hasActivate: typeof rcv.activateCylinderStock === 'function' };
  });
  expect(r.hasActivate, 'activateCylinderStock is retired, not just renamed — no export survives to mutate settings').toBe(false);
  expect(r.afterOpen.shape, 'opening the rotary-centre view never touches the global stock shape').toBe('box');
  expect(r.afterOpen.x, 'nor its dims').toBe(120);
  expect(r.afterRestore, 'restoreBoxStock is a safe no-op now — nothing changed because nothing needed reverting').toEqual(r.afterOpen);
});
