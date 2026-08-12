import { test, expect } from '@playwright/test';

// t1722 (gate repair, cycle 857 ACT 2) — rotaryCenterView.js's activateCylinderStock() no longer mutated +
// persisted window.ddcsGetSettings().stock at all (a preview writing user state was a defect on its own terms —
// PREVIEW-AS-DATA.md survey finding) — it derived a round bar LOCALLY, same shape as rotaryCenterData.js's own
// def.simStock.
// t1732 port note — REPOINTED to the live path, twice over. (1) 'rotary_center' no longer opens a coded view
// at all — its wizard bar slot has opensAs'd to the twin ('user_rotary_center_data') for a while already
// (unrelated to t1730), so `openWiz('rotary_center')` was ALREADY not the door a real user goes through; the
// live equivalent is `openWiz('user_rotary_center_data')`. (2) t1730 deleted rotaryCenterView.js ENTIRELY (its
// sole remaining reason to exist — restoreBoxStock as a defensive no-op called by edge/middle/rotary-clock
// views' onOpen — vanished the same act those 3 views were deleted too, WORK-LOG t1730), so the import now
// throws (404) rather than returning a no-op export. Both changes point at the SAME underlying claim this test
// always made ("opening a rotary-centre preview never mutates the global stock") — now checked through the real
// twin-open gesture, with the legacy file's total absence standing in for "the mutating hack is gone."
test.use({ viewport: { width: 1000, height: 800 } });

test('opening the rotary-centre twin does NOT mutate the global stock; the legacy view is fully gone, not just its mutation', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings && !!window.ddcsApplySettings && window.openWiz);
  const r = await page.evaluate(async () => {
    let importThrew = false;
    try { await import('/wizards/views/rotaryCenterView.js'); } catch (_) { importThrew = true; }
    // Start from a known rectangular stock.
    window.ddcsApplySettings({ stock: { x: 120, y: 80, z: 25, shape: 'box', show: true } });
    const before = { ...window.ddcsGetSettings().stock };
    window.openWiz('user_rotary_center_data');   // the real gesture a rotary op's preview runs through today
    await new Promise((r) => setTimeout(r, 200));   // onOpen's own update() runs on a 50ms setTimeout — outlast it
    const afterOpen = { ...window.ddcsGetSettings().stock };
    return { before, afterOpen, importThrew };
  });
  expect(r.importThrew, 'the whole legacy view file is gone (t1730), not just activateCylinderStock retired within it').toBe(true);
  expect(r.afterOpen.shape, 'opening the rotary-centre twin never touches the global stock shape').toBe('box');
  expect(r.afterOpen.x, 'nor its dims').toBe(120);
});
