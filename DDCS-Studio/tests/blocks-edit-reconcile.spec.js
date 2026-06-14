import { test, expect } from '@playwright/test';

// Layer 3 (write direction): editing the projected G-code in the STUDIO editor reconciles back into the blocks.
// Leaf-level programs round-trip (type code → atom blocks); a program with a high-level op (Fill/Step Down)
// can't be text-reconciled, so those edits revert on blur (edit via blocks/fields instead). The editor is only
// visible on the Studio tab, so the realistic flow is: open Blocks once (inits the workspace + listener), then
// edit on the Studio tab.
test.use({ viewport: { width: 1280, height: 900 } });

test('editor → blocks: typing leaf G-code into an empty program creates atom blocks', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsStudio.editorManager);
  await page.evaluate(() => window.ddcsStudio.editorManager.setValue(''));   // empty editor, no wizard op
  await page.evaluate(() => window.showApp('blocks'));                       // inits the workspace + editor listener
  await page.waitForFunction(() => window.__blkws, { timeout: 8000 });
  expect(await page.evaluate(() => (window.ddcsGetBlockGcode() || '').trim()), 'workspace starts empty').toBe('');

  await page.evaluate(() => window.showApp('studio'));                       // editor is visible on Studio
  await page.locator('#editor').fill('G0 X5 Y5 Z5\nG1 X10 Y10 Z-3 F150');
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    gcode: window.ddcsGetBlockGcode(),
    moves: window.__blkws.getAllBlocks(false).filter((b) => b.type === 'move').length,
  }));
  expect(after.moves, 'two Move blocks were created from the typed lines').toBe(2);
  expect(after.gcode).toMatch(/G0 X5 Y5 Z5/);
  expect(after.gcode).toMatch(/G1 X10 Y10 Z-3 F150/);
  expect(errs, 'no page errors').toEqual([]);
});

test('editor → blocks: editing a HIGH-LEVEL program is reverted (not flattened)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsStudio.editorManager);
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
  await page.waitForTimeout(200);

  const r = await page.evaluate(() => ({
    types: window.ddcsGetBlockProgram().map((b) => b.type),
    editor: window.ddcsStudio.editorManager.getValue(),
    proj: window.ddcsGetBlockGcode(),
  }));
  expect(r.types, 'block program unchanged (still high-level, not flattened to moves)').toEqual(beforeTypes);
  expect(r.editor, 'editor reverted to the live projection on blur').toBe(r.proj);
  expect(r.editor.includes('X999'), 'the non-reconcilable edit did not stick').toBe(false);
});
