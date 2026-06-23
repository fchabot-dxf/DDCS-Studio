import { test, expect } from '@playwright/test';

// Position (translate the whole program on the stock) is now the Position tab of the ⟳ Transform modal — the
// standalone ✥ Position button was removed. translateProgram shifts absolute X/Y/Z, leaves arc offsets (I/J)
// and G91 incremental moves alone.
test.use({ viewport: { width: 1280, height: 900 } });

test('translateProgram shifts absolute moves only; translate wired via Transform', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const m = await import('/data/rotateProgram.js');
    const a = m.translateProgram('G90\nG1 X10 Y5 Z-2 F100\nG2 X20 Y5 I5 J0', 3, 4, 1);
    const b = m.translateProgram('G91\nG1 X10 Y10', 3, 4, 1);
    return {
      aText: a.text, aMoved: a.moved, bInc: b.hadIncremental, bText: b.text,
      hasBtn: !!document.getElementById('align-rotate-btn'),   // the ⟳ Transform button opens the modal (Align + Position tabs)
      hasFn: typeof window.ddcsPositionTranslate === 'function',
    };
  });

  expect(r.aText, 'X shifted +3').toContain('X13');
  expect(r.aText, 'Y shifted +4').toContain('Y9');
  expect(r.aText, 'Z shifted +1').toContain('Z-1');
  expect(r.aText, 'arc offset I unchanged').toContain('I5');
  expect(r.aMoved, 'both moves counted').toBe(2);
  expect(r.bInc, 'G91 flagged').toBe(true);
  expect(r.bText, 'G91 X not shifted').toContain('X10');
  expect(r.hasBtn && r.hasFn, 'Transform button + translate handler wired').toBe(true);
});
