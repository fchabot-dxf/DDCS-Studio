import { test, expect } from '@playwright/test';

// Raw G-code typed in the Studio editor spawns the corresponding blocks in the shared program model (the Blocks
// view renders that model). Recognised lines map to typed leaf blocks; anything unrecognised becomes a `raw`
// block so no line is ever lost. (programModel debounces editor input → reconcileGcodeToStack.)
test.use({ viewport: { width: 1280, height: 900 } });

test('typing raw G-code in the editor decodes into the proper atom blocks', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.getElementById('editor') && window.ddcsGetBlockProgram);

  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.value = 'G54\nG17\nM3 S12000\nG0 X#9\nG1 Z-2 F100\nG28 Z0\nM98 P9083\nM5\nM30';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length >= 9, { timeout: 4000 });

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
