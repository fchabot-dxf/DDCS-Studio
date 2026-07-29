import { test, expect } from '@playwright/test';

/**
 * REGRESSION (live showstopper): opening the Blocks tab when the program ALREADY has content was dead.
 * showBlocks() (module scope) called renderFromModel() — a buildWorkspace() closure-local — so on
 * getStack().length > 0 it threw `ReferenceError: renderFromModel is not defined`, which the try/catch swallowed
 * (console.error('show blocks failed', …)). Net: the tab opened but the whole accumulated program never rendered.
 *
 * The 284-green suite missed it: nothing exercised showBlocks() with a NON-EMPTY program ([[verify-core-flow…]]).
 * This drives the real symptom — seed the shared program via a wizard insert, THEN open Blocks — and asserts the
 * crash path is silent-error-free AND the program actually rendered. (Fix: route line 98 through api.refresh(),
 * which is renderFromModel(getProjection()) — supplying the projection the bare no-arg call also lacked.)
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('Blocks tab renders a non-empty program on open (no swallowed showBlocks ReferenceError)', async ({ page }) => {
  const showFails = [];
  page.on('console', (m) => { if (m.type() === 'error' && /show blocks failed|renderFromModel|getProjection/.test(m.text())) showFails.push(m.text()); });
  page.on('pageerror', (e) => showFails.push(String(e)));
  page.on('dialog', (d) => d.accept());

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz && window.showApp && window.ddcsGetBlockProgram);

  // seed the shared program with content (an accumulated wizard insert) → getStack().length > 0
  await page.evaluate(async () => {
    window.openWiz('surfacing', undefined, true);
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
  });
  const seeded = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.type === 'op'));
  expect(seeded, 'program seeded with an op before opening Blocks').toBe(true);

  // open the Blocks tab with a non-empty program → the crash path (showBlocks → renderFromModel)
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws, { timeout: 8000 });
  await page.waitForTimeout(400);

  const types = await page.evaluate(() => (window.__blkws ? window.__blkws.getAllBlocks().map((b) => b.type) : []));

  expect(showFails, 'showBlocks() ran without throwing into its catch (renderFromModel/getProjection in scope)').toEqual([]);
  // t1365 — the seed is a surfacing op, and surfacing is ONE atom now: the switch collapsed `stepdown{ surfacefill }`
  // into `surfaceraster`, which carries the depth loop itself. Same claim about the same tab, naming the block there.
  expect(types, 'the seeded program rendered into the Blocks workspace').toEqual(expect.arrayContaining(['surfaceraster']));
});
