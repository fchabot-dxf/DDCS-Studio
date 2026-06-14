import { test, expect } from '@playwright/test';

// The block stack is the DATA (the model); the Studio editor is the PRIMARY surface; the Blocks tab is a second
// view. The editor⇄stack sync lives in programModel, wired at app START — so editing the editor builds/updates
// blocks WITHOUT ever opening the Blocks tab. Leaf-level edits round-trip; high-level programs (Fill/Step Down)
// can't be text-reconciled and revert on blur.
test.use({ viewport: { width: 1280, height: 900 } });

test('editor → blocks WITHOUT ever opening the Blocks tab', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.editorManager && window.ddcsGetBlockProgram);

  // Studio is the default tab (editor visible). Type leaf G-code — never touch the Blocks tab.
  await page.locator('#editor').fill('G0 X5 Y5 Z5\nG1 X10 Y10 Z-3 F150');
  await page.locator('#editor').blur();
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => ({
    types: window.ddcsGetBlockProgram().map((b) => b.type),
    gcode: window.ddcsGetBlockGcode(),
  }));
  expect(r.types, 'typed G-code became atom blocks in the model — no Blocks tab needed').toEqual(['move', 'move']);
  expect(r.gcode).toMatch(/G0 X5 Y5 Z5/);
  expect(r.gcode).toMatch(/G1 X10 Y10 Z-3 F150/);

  // NOW open Blocks → it renders the model that the editor built.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws, { timeout: 8000 });
  await page.waitForTimeout(300);
  const moves = await page.evaluate(() => window.__blkws.getAllBlocks(false).filter((b) => b.type === 'move').length);
  expect(moves, 'the Blocks view shows the two Move blocks').toBe(2);
  expect(errs, 'no page errors').toEqual([]);
});

test('editing a HIGH-LEVEL program is reverted (not flattened)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsStudio.editorManager && window.ddcsGetBlockProgram);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0, { timeout: 8000 });

  const beforeTypes = await page.evaluate(() => window.ddcsGetBlockProgram().map((b) => b.type));
  expect(beforeTypes, 'surfacing seeds a high-level program (contains a Step Down)').toContain('stepdown');

  await page.evaluate(() => window.showApp('studio'));   // editor visible
  await page.locator('#editor').fill('G1 X999 Y999 Z-99 F1\n( junk )');
  await page.waitForTimeout(700);
  await page.locator('#editor').blur();
  await page.waitForTimeout(250);

  const r = await page.evaluate(() => ({
    types: window.ddcsGetBlockProgram().map((b) => b.type),
    editor: window.ddcsStudio.editorManager.getValue(),
    proj: window.ddcsGetBlockGcode(),
  }));
  expect(r.types, 'block program unchanged (still high-level, not flattened)').toEqual(beforeTypes);
  expect(r.editor, 'editor reverted to the live projection on blur').toBe(r.proj);
  expect(r.editor.includes('X999'), 'the non-reconcilable edit did not stick').toBe(false);
});
