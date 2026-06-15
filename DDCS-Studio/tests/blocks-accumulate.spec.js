import { test, expect } from '@playwright/test';

// Accumulating two snippet/probe ops into one program must NOT produce a mid-program M30 (which would halt the
// program after the first op) or duplicate jump labels (which make GOTOs resolve to the wrong target). Guards
// the renumber-labels + single-terminator normalisation in opStacks.appendIntoProgram.
test.use({ viewport: { width: 1400, height: 1000 } });

async function insertOp(page, name) {
  await page.evaluate((n) => window.ddcsStudio.wizardManager.open(n), name);
  await page.waitForSelector(`#wiz_${name}`, { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.ddcsStudio.wizardManager.insert());
  await page.waitForTimeout(150);
}

test('two probe ops accumulate with ONE M30 and unique labels', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetBlockGcode);

  await insertOp(page, 'middle');
  await insertOp(page, 'middle');

  const gcode = await page.evaluate(() => window.ddcsGetBlockGcode() || '');
  const lines = gcode.split('\n');

  // exactly one program terminator
  const ends = lines.filter((l) => /\bM30\b|\bM2\b/.test(l));
  expect(ends.length, `exactly one M30/M2 terminator\n${gcode}`).toBe(1);
  // and it is the last meaningful line
  const lastIdx = lines.map((l) => l.trim()).filter(Boolean).length - 1;
  const lastLine = lines.map((l) => l.trim()).filter(Boolean)[lastIdx];
  expect(/\bM30\b|\bM2\b/.test(lastLine), `terminator is last: "${lastLine}"`).toBeTruthy();

  // no duplicate jump labels (N<num> at line start)
  const labelNums = lines.map((l) => (l.match(/^\s*N(\d+)\b/) || [])[1]).filter(Boolean);
  const dupes = labelNums.filter((n, i) => labelNums.indexOf(n) !== i);
  expect(dupes, `duplicate labels: ${dupes.join(',')}\n${gcode}`).toEqual([]);
});
