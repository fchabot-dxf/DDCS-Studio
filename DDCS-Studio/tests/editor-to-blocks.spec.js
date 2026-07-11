import { test, expect } from '@playwright/test';

// Raw G-code typed in the Studio editor spawns the corresponding blocks in the shared program model (the Blocks
// view renders that model). Recognised lines map to typed leaf blocks; anything unrecognised becomes a `raw`
// block so no line is ever lost. (programModel debounces editor input → reconcileGcodeToStack.)
test.use({ viewport: { width: 1280, height: 900 } });

test('typing raw G-code in the editor decodes into the proper atom blocks', async ({ page }) => {
  await page.goto('http://localhost:3211');
  // Wait for the editor's input→reconcile listener to be wired (programModel sets __pmWired once editorManager
  // exists), else we'd type before the listener attaches and the 'input' event is missed (a startup race).
  await page.waitForFunction(() => { const e = document.getElementById('editor'); return e && e.__pmWired && window.ddcsGetBlockProgram; });

  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.value = 'G54\nG17\nM3 S12000\nG0 X#9\nG1 Z-2 F100\nG28 Z0\nM98 P9083\nM5\nM30';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length >= 9, { timeout: 15000 });   // t728 r2 — condition-gated (debounce+reconcile lands the blocks); 4000ms was too tight under -workers contention (t710 headroom)

  const prog = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).map((b) => ({ t: b.type, p: b.params })));
  const types = prog.map((b) => b.t);
  // every real code maps to its proper atom — plane / home / call no longer fall to raw or generic mcode
  expect(types).toEqual(['wcs', 'plane', 'spindle', 'move', 'move', 'home', 'call', 'spindle', 'endprogram']);
  expect(types).not.toContain('raw');

  // params survive, including a #var coordinate kept literal
  expect(prog[3].p).toMatchObject({ mode: 'rapid', x: '#9' });
  expect(prog[5].p.axes).toBe('Z');
  expect(prog[6].p.prog).toBe(9083);
});

test('control flow (#var / label / IF-GOTO / GOTO / stop) decodes through the editor', async ({ page }) => {
  await page.goto('http://localhost:3211');
  // Wait for the editor's input→reconcile listener to be wired (programModel sets __pmWired once editorManager
  // exists), else we'd type before the listener attaches and the 'input' event is missed (a startup race).
  await page.waitForFunction(() => { const e = document.getElementById('editor'); return e && e.__pmWired && window.ddcsGetBlockProgram; });
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.value = '#100=5\nN1\nG0 X#100\nIF #100>0 GOTO1\nGOTO2\nN2\nM1\nM0\nM30';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length >= 9, { timeout: 15000 });   // t728 r2 — condition-gated (debounce+reconcile lands the blocks); 4000ms was too tight under -workers contention (t710 headroom)
  const types = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).map((b) => b.type));
  expect(types).toEqual(['assign', 'label', 'move', 'ifgoto', 'goto', 'label', 'stop', 'stop', 'endprogram']);
  expect(types).not.toContain('raw');
});
