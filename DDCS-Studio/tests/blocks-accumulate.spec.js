import { test, expect } from '@playwright/test';

// t1920 — REWRITTEN. This test used to guard "two snippet/probe ops accumulated into one program don't produce a
// mid-program M30 or duplicate jump labels" — i.e. it guarded opSession.js's own `appendIntoProgram` accumulation
// branch + `normalizeEnds`' label/terminator deconfliction. That machinery is DELETED (t1916/t1918/t1920's own
// ruling: a program is always exactly one op; a second insert REPLACES, it never splices). The underlying concern
// this test protects — can two ops' worth of content ever collide on one terminator or one label number — still
// matters, but the PROOF is different now: not "the normalisation pass cleaned it up" but "there is only ever one
// op's content to begin with, so the collision has no second op to collide WITH." Proves the replace itself
// happened (not just that the end-state happens to look clean), then proves the bug class this file used to name
// cannot arise from that replaced state.
test.use({ viewport: { width: 1400, height: 1000 } });

// t1730 — 'middle' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
// t1944 — `choice` (optional): a NON-empty canvas now confirms (t1942); pass the button text to click
// ("Replace it") when the canvas already holds a prior op — the empty-canvas first insert needs none.
async function insertOp(page, name, choice) {
  await page.evaluate((n) => window.ddcsStudio.wizardManager.open(n), name);
  await page.waitForSelector('#wiz_user', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  if (choice) {
    await page.evaluate(() => { window.ddcsStudio.wizardManager.insert(); });   // fire without awaiting — hangs on the confirm
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click(`.app-dialog button:has-text("${choice}")`);
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
  } else {
    await page.evaluate(() => window.ddcsStudio.wizardManager.insert());
  }
  await page.waitForTimeout(150);
}

test('a second op REPLACES the program — the M30/label-collision bug class this test used to guard cannot arise', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetBlockGcode);

  await insertOp(page, 'user_middle_data');
  const afterFirst = await page.evaluate(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').map((b) => b.opType));
  expect(afterFirst, 'the first insert is the whole program').toEqual(['user_middle_data']);

  // A SECOND, DIFFERENT op — if this merely appended (the old contract), the program would now hold both; if it
  // replaced (the new one), only the second survives. Two distinct opTypes make which one happened unambiguous.
  // t1944 — Replace is the explicit choice now (t1942's own 3-way dialog); it is the SAME behaviour this test
  // has always proven, just no longer the ONLY thing Insert can do.
  await insertOp(page, 'user_corner_data', 'Replace it');
  const afterSecond = await page.evaluate(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').map((b) => b.opType));
  expect(afterSecond, 'the second insert REPLACES the first — exactly one op, and it is the NEW one, not both').toEqual(['user_corner_data']);

  const gcode = await page.evaluate(() => window.ddcsGetBlockGcode() || '');
  const lines = gcode.split('\n');

  // THE BUG CLASS, PROVEN DEAD: exactly one program terminator — structurally guaranteed now (one op, one
  // terminator), not merely observed to be clean after a normalisation pass that no longer exists.
  const ends = lines.filter((l) => /\bM30\b|\bM2\b/.test(l));
  expect(ends.length, `exactly one M30/M2 terminator\n${gcode}`).toBe(1);
  const lastIdx = lines.map((l) => l.trim()).filter(Boolean).length - 1;
  const lastLine = lines.map((l) => l.trim()).filter(Boolean)[lastIdx];
  expect(/\bM30\b|\bM2\b/.test(lastLine), `terminator is last: "${lastLine}"`).toBeTruthy();

  // no duplicate jump labels (N<num> at line start) — again structural now: one op's own labels, nothing to collide with.
  const labelNums = lines.map((l) => (l.match(/^\s*N(\d+)\b/) || [])[1]).filter(Boolean);
  const dupes = labelNums.filter((n, i) => labelNums.indexOf(n) !== i);
  expect(dupes, `duplicate labels: ${dupes.join(',')}\n${gcode}`).toEqual([]);
});
