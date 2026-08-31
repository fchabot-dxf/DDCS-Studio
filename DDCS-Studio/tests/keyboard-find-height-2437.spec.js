import { test, expect } from '@playwright/test';

/**
 * t2437 — the REAL root of "when the keyboard opens, the code disappears" (owner-reported, real device, two
 * rounds of screenshots; t2435's own `preventScroll` fix changed nothing because the actual bug was elsewhere,
 * plausibly named but not chased first: `styles.css`'s `body.keyboard-active .editor-container` pin, which
 * squeezes the WHOLE editor (toolbar + code) into a fixed 60px strip whenever the mobile keyboard is up. That
 * 60px is deliberately sized for `editorManager.js`'s own snippet-insert use case (one centered line is
 * enough there) — but a FIND bar needs to READ several lines while typing, and one line peeking from behind
 * the bar (the owner's own second screenshot) fails outright.
 *
 * THE FIX: `.ddcs-find-open` (set by `editorFind.js`/`blockCanvasFind.js`'s own `open()`/`close()`) stacks
 * onto `body.keyboard-active` — the PLAIN snippet-insert rule (no `.ddcs-find-open`) is completely untouched —
 * and gives the pinned pane the REAL visible height instead of 60px, via `--vv-height`: a CSS custom property
 * app.js's ALREADY-EXISTING keyboard detector (t2229/BACKLOG F3a) now also publishes (extended, not
 * duplicated — t2435's own reverted `ui/viewportKeyboard.js` mistake was building a SECOND listener instead of
 * reusing this one). The same idea covers the Blocks-tab canvas: `#blocks-app` gets the analogous pin (there
 * was no keyboard-active handling for it at all before this turn), so `.blk-bk-host`'s own `ResizeObserver` →
 * `Blockly.svgResize` sees the real shrink and t2435's own `centerOnBlock(id, true)` fix centers a matched
 * block within the space that's ACTUALLY visible, not the old, taller one.
 *
 * ⚠ WHAT THIS PROVES AND WHAT IT CAN'T. `visualViewport.height` is overridden and a `resize` event dispatched
 * synthetically — that runs the REAL app.js `_checkKeyboard` code path (not a reimplementation), so the
 * `keyboard-active` class and `--vv-height` are both set exactly the way a real device's keyboard would drive
 * them. What this can't prove: whether a real Android/iOS keyboard actually fires `visualViewport` events the
 * way assumed, or whether `newActive = vv.height < innerHeight * 0.8` is the right threshold on the owner's
 * own device — that's the part the amendment's own dispatch says goes back to the owner for a device recheck.
 */

async function simulateKeyboard(page, newHeight) {
  await page.evaluate((h) => {
    Object.defineProperty(window.visualViewport, 'height', { get: () => h, configurable: true });
    window.visualViewport.dispatchEvent(new Event('resize'));
  }, newHeight);
  await page.waitForTimeout(150);
}

test('the plain snippet-insert 60px pin is untouched when no find bar is open', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(500);

  await simulateKeyboard(page, 300);
  const height = await page.evaluate(() => document.querySelector('.editor-container').getBoundingClientRect().height);
  console.log('.editor-container height with keyboard active, NO find bar open:', height);
  expect(height, 'the original 60px snippet-insert pin still applies — this turn only ADDS a more specific case').toBeCloseTo(60, 0);
});

test('opening the editor find bar under an active keyboard gives the editor real room, and the match stays visible while cycling', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(500);

  const lines = Array.from({ length: 80 }, (_, i) => (i === 60 ? 'FIND_ME_TARGET' : i === 65 ? 'FIND_ME_SECOND' : `N${i} G1 X${i} Y${i}`));
  await page.evaluate((text) => { const ed = document.getElementById('editor'); ed.value = text; ed.dispatchEvent(new Event('input', { bubbles: true })); }, lines.join('\n'));

  await simulateKeyboard(page, 300);

  await page.evaluate(() => document.getElementById('editor-find-btn').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => { const inp = document.getElementById('editor-find-input'); inp.focus(); inp.value = 'FIND_ME'; inp.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(200);

  const heightWithFindOpen = await page.evaluate(() => document.querySelector('.editor-container').getBoundingClientRect().height);
  console.log('.editor-container height with keyboard active AND find bar open:', heightWithFindOpen);
  // NOT the full 300px simulated visual-viewport height — .app-shell also hosts the 54px dock-header and the
  // controller-dock panel above/below .main, both still taking their own real estate. 149px (measured: a
  // legitimate `300 - 54(app-shell offset) - 54(dock-header) - 43(controller-dock)`) is the CORRECT remaining
  // room, not a bug — still roughly DOUBLE+ the old 60px pin's usable lines (~7 lines vs ~2-3).
  expect(heightWithFindOpen, 'the editor is now in normal flow, well past the old 60px insert-only pin').toBeGreaterThan(100);

  const readBand = async () => page.evaluate(() => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed);
    let lineHeight = parseFloat(cs.lineHeight);
    if (Number.isNaN(lineHeight) || lineHeight <= 0) lineHeight = parseFloat(cs.fontSize) * 1.6 || 22;
    const before = ed.value.slice(0, ed.selectionStart);
    const lineIndex = before.split('\n').length - 1;
    const matchY = lineIndex * lineHeight - ed.scrollTop;
    return { matchY, clientHeight: ed.clientHeight, lineIndex };
  });

  const band1 = await readBand();
  console.log('match 1 band:', band1);
  expect(band1.lineIndex, 'first match found').toBe(60);
  expect(band1.matchY, 'match sits within the visible band (bottom)').toBeLessThanOrEqual(band1.clientHeight);
  expect(band1.matchY, 'match sits within the visible band (top)').toBeGreaterThanOrEqual(0);
  // multiple lines of context around the match should be visible — not just the match's own line peeking out
  expect(band1.clientHeight, 'more than a sliver of the editor is visible (several code lines, not one)').toBeGreaterThan(100);

  await page.evaluate(() => document.getElementById('editor-find-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await page.waitForTimeout(150);
  const band2 = await readBand();
  console.log('match 2 band (after cycling):', band2);
  expect(band2.lineIndex, 'cycled to the second match').toBe(65);
  expect(band2.matchY, 'the SECOND match also stays within the visible band while cycling').toBeLessThanOrEqual(band2.clientHeight);
  expect(band2.matchY, 'the second match sits within the visible band (top)').toBeGreaterThanOrEqual(0);

  await page.evaluate(() => document.getElementById('editor-find-close').click());
  await page.waitForTimeout(150);
  const heightAfterClose = await page.evaluate(() => document.querySelector('.editor-container').getBoundingClientRect().height);
  console.log('.editor-container height after closing find (keyboard still active):', heightAfterClose);
  expect(heightAfterClose, 'closing the find bar reverts to the plain 60px insert pin — the override is scoped to find being open').toBeCloseTo(60, 0);
});

test('opening the canvas find bar under an active keyboard gives the Blocks tab real room, and the matched block stays visible', async ({ page }) => {
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

  await simulateKeyboard(page, 300);

  const heightBeforeFind = await page.evaluate(() => document.getElementById('blocks-app').getBoundingClientRect().height);
  console.log('#blocks-app height with keyboard active, NO find bar open:', heightBeforeFind);
  // no pre-existing keyboard-active handling for the Blocks tab at all — confirm this turn's new rule doesn't
  // fire until a find bar is actually open (gated on .ddcs-find-open, not just .keyboard-active alone)
  expect(heightBeforeFind, 'unpinned until the find bar is open').toBeGreaterThan(310);

  await page.evaluate(() => document.querySelector('.blk-find-chip').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => { const inp = document.querySelector('.blk-find-input'); inp.focus(); inp.value = 'radius'; inp.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(400);   // ResizeObserver -> Blockly.svgResize is async

  const heightWithFindOpen = await page.evaluate(() => document.getElementById('blocks-app').getBoundingClientRect().height);
  console.log('#blocks-app height with keyboard active AND find bar open:', heightWithFindOpen);
  expect(heightWithFindOpen, 'the Blocks tab now pins to the real visible height (300px), same technique as the editor').toBeLessThan(310);
  expect(heightWithFindOpen).toBeGreaterThan(200);

  const result = await page.evaluate(() => {
    const host = document.querySelector('.blk-bk-host');
    const hostRect = host.getBoundingClientRect();
    const glowing = window.__blkws.getAllBlocks(false).find((b) => {
      const r = b.getSvgRoot && b.getSvgRoot();
      return r && r.style.filter && r.style.filter.includes('drop-shadow');
    });
    if (!glowing) return null;
    const br = glowing.getSvgRoot().getBoundingClientRect();
    return { hostTop: hostRect.top, hostBottom: hostRect.bottom, blockTop: br.top };
  });
  console.log('glowing block vs. the now-pinned canvas host:', result);
  expect(result, 'a block is glowing after the match').not.toBeNull();
  expect(result.blockTop, "the matched block's own top sits within the pinned, visible canvas band").toBeGreaterThanOrEqual(result.hostTop - 2);
  expect(result.blockTop, "the matched block's own top sits within the pinned, visible canvas band").toBeLessThanOrEqual(result.hostBottom);
});
