import { test, expect } from '@playwright/test';

/**
 * t2439 ⛔⛔ URGENT REGRESSION, DATA-CORRUPTING — owner-reported, desktop: type one character into the editor
 * find bar, and every keystroke after that lands in the G-CODE PROGRAM instead of the search box.
 *
 * ROOT CAUSE: `ui/editorFind.js`'s `goTo()` ran on EVERY keystroke (the `input` listener calls it after each
 * character, not just on an explicit Enter/arrow cycle), and carried `ed.focus()` — t2383's own original code,
 * present since the very first version of this file. The moment the first match was found, DOM focus moved
 * from the find input to the editor textarea; every subsequent keystroke of the search query was then routed
 * to the textarea by the browser itself and inserted directly into the program.
 *
 * WHY NOTHING CAUGHT THIS EARLIER (t2383/t2435/t2437's own verification, this file's own first draft too):
 * every prior test set the find input's `.value` directly and dispatched ONE synthetic `input` event —
 * `inp.value = 'query'; inp.dispatchEvent(new Event('input'))` — which fires the listener once, with the
 * complete query already in place, and crucially does NOT route through the browser's own focus-dependent
 * keystroke delivery the way a real keyboard does. This file uses Playwright's `page.keyboard.type()` instead
 * — real, sequential keydown/keyup events delivered to whatever element currently has DOM focus — which is
 * the only way this class of bug is reproducible at all.
 *
 * THE FIX: `goTo()` no longer calls `ed.focus()`. A textarea's selection range and scroll position are plain
 * DOM properties, independent of focus — `setSelectionRange`/`scrollTop` still visibly highlight the match in
 * a BLURRED textarea (a real browser behavior, not assumed — nothing here would catch a regression to that
 * assumption since visual rendering isn't asserted, but the underlying DOM properties are). The find input
 * keeps focus for the entire interaction: typing, and cycling matches with Enter/arrows.
 *
 * The CANVAS find bar (`blocks/blockCanvasFind.js`) was checked too, per the dispatch's own explicit
 * instruction — its own `goTo()` never called `.focus()` on anything besides its own input inside `open()`
 * (a one-time call when the bar opens, not per-keystroke), so it was never exposed to this same mechanism.
 * Verified here anyway with the same real-keystroke methodology, not assumed clean from reading the code.
 */

function seedEditorAndSettle(page, lines) {
  return page.evaluate((text) => {
    const ed = document.getElementById('editor');
    ed.value = text;
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  }, lines.join('\n'));
}

test('editor find bar: typing a full word character-by-character never leaks into the program, and focus never leaves the find input', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(500);

  const lines = Array.from({ length: 30 }, (_, i) => (i === 15 ? 'FINDME' : `N${i} G1 X${i}`));
  await seedEditorAndSettle(page, lines);
  // let any pre-existing background reformatter (unrelated to find — the editor normalizes newly-loaded
  // content on its own) fully settle BEFORE baselining, so the byte-identical check below brackets ONLY the
  // find-bar interaction, not an unrelated seed-time pass.
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => document.getElementById('editor').value);

  await page.click('#editor-find-btn');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.activeElement.id), 'the find input has focus right after opening').toBe('editor-find-input');

  await page.keyboard.type('FINDME', { delay: 40 });   // REAL sequential keystrokes — the only way this bug reproduces
  await page.waitForTimeout(300);

  const afterTyping = await page.evaluate(() => ({
    editorValue: document.getElementById('editor').value,
    findValue: document.getElementById('editor-find-input').value,
    activeId: document.activeElement && document.activeElement.id,
    count: document.getElementById('editor-find-count').textContent,
  }));
  expect(afterTyping.findValue, 'every character landed in the find box, not scattered/dropped').toBe('FINDME');
  expect(afterTyping.activeId, 'focus NEVER left the find input while typing').toBe('editor-find-input');
  expect(afterTyping.editorValue, 'the program is BYTE-IDENTICAL after typing a full query — the real acceptance test').toBe(before);
  expect(afterTyping.count, 'the query still found its match').toBe('1/1');

  // cycling with REAL Enter presses must not leak a newline into the program or move focus away either
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const afterCycle = await page.evaluate(() => ({
    editorValue: document.getElementById('editor').value,
    activeId: document.activeElement && document.activeElement.id,
  }));
  expect(afterCycle.editorValue, 'the program is STILL byte-identical after cycling matches with Enter').toBe(before);
  expect(afterCycle.activeId, 'focus stayed in the find input through cycling too').toBe('editor-find-input');
});

test('canvas find bar: typing a query character-by-character never edits the block model, and focus never leaves the find input', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
  await page.evaluate(async () => {
    const { _framed, makeOp } = await import('/blocks/opBuilders.js');
    const params = { dist: 500, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2, travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, corner: 'FL', probeSeq: 'YX', wcs: 'active' };
    const framed = _framed('user_corner_data', params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const op = makeOp('user_corner_data', params, bare);
    const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
    window.ddcsLoadBlockStack(stack);
  });
  await page.waitForFunction(() => window.__blkws.getAllBlocks(false).length > 5);
  await page.waitForTimeout(800);

  const before = await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram()));

  // a JS-driven click (not a real mouse click) to open — this still exercises the app's own real open()/focus()
  // path; what needs to be REAL is the typing that follows, which page.keyboard.type() provides
  await page.evaluate(() => document.querySelector('.blk-find-chip').click());
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.className), 'the find input has focus right after opening').toBe('blk-find-input');

  await page.keyboard.type('radius', { delay: 40 });
  await page.waitForTimeout(300);

  const afterTyping = await page.evaluate(() => ({
    model: JSON.stringify(window.ddcsGetBlockProgram()),
    findValue: document.querySelector('.blk-find-input').value,
    activeClass: document.activeElement && document.activeElement.className,
    count: document.querySelector('.blk-find-count').textContent,
  }));
  expect(afterTyping.findValue, 'every character landed in the find box').toBe('radius');
  expect(afterTyping.activeClass, 'focus NEVER left the find input while typing').toBe('blk-find-input');
  expect(afterTyping.model, 'the block model is BYTE-IDENTICAL after typing a full query').toBe(before);
  expect(afterTyping.count, 'the query still found matches').not.toBe('0/0');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const afterCycle = await page.evaluate(() => ({
    model: JSON.stringify(window.ddcsGetBlockProgram()),
    activeClass: document.activeElement && document.activeElement.className,
  }));
  expect(afterCycle.model, 'the block model is STILL byte-identical after cycling matches with Enter').toBe(before);
  expect(afterCycle.activeClass, 'focus stayed in the find input through cycling too').toBe('blk-find-input');
});
