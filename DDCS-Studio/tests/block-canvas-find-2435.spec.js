import { test, expect } from '@playwright/test';

/**
 * t2435 (BACKLOG #44, owner-approved "4 yes") — CANVAS FIND: find a block already ON the Blocks canvas. The
 * palette search (`.blk-search`) only filters what you can ADD from the toolbox; nothing searched the ~150
 * blocks a real corner stack already has. Same contract as the editor's own find bar (t2383,
 * `ui/editorFind.js`) — live n-of-m count, Enter/Shift+Enter or ▲/▼ cycle, Esc closes, case-insensitive,
 * search only — sharing its match-cycling shape via `ui/findBarCore.js`; the MATCHING itself is canvas-
 * specific (`blocks/blockCanvasFind.js`), matched against every field's own rendered text
 * (`Field.getText()` — a caption like "depth", a value like "18000"/"#100"/"cw", a dropdown's own displayed
 * option) plus the block's own type. A hit PANS + GLOWS (reusing t2397's own established reveal, not a text
 * selection — a match here is a BLOCK).
 */

async function bootCornerPlaced(page) {
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
}

test('end-to-end: type a param name, cycle matches (pan + glow), zero-match state, Esc closes — never edits a block', async ({ page }) => {
  await bootCornerPlaced(page);

  const blockCount = await page.evaluate(() => window.__blkws.getAllBlocks(false).length);
  console.log('corner block count:', blockCount);
  expect(blockCount, 'a real corner stack, not a toy fixture').toBeGreaterThan(50);

  expect(await page.evaluate(() => !!document.querySelector('.blk-find-chip')), 'the find chip is mounted on the canvas').toBe(true);

  await page.evaluate(() => document.querySelector('.blk-find-chip').click());
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !document.querySelector('.blk-findbar').classList.contains('hidden')), 'the find bar opened').toBe(true);

  const modelBefore = await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram ? window.ddcsGetBlockProgram() : null));
  await page.evaluate(() => {
    const inp = document.querySelector('.blk-find-input');
    inp.focus(); inp.value = 'radius'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const afterTypeCount = await page.evaluate(() => document.querySelector('.blk-find-count').textContent);
  console.log('count after typing "radius":', afterTypeCount);
  expect(afterTypeCount, 'a param name (radius) hits').not.toBe('0/0');

  // ⛔ typing in the find bar must never edit a block — the model is the ONE thing that would prove it did.
  const modelAfter = await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram ? window.ddcsGetBlockProgram() : null));
  expect(modelAfter, 'the model is byte-identical after typing in the find bar').toBe(modelBefore);

  await page.evaluate(() => document.querySelector('.blk-find-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await page.waitForTimeout(200);
  const glowActive = await page.evaluate(() => window.__blkws.getAllBlocks(false).some((b) => {
    const r = b.getSvgRoot && b.getSvgRoot();
    return r && r.style.filter && r.style.filter.includes('drop-shadow');
  }));
  expect(glowActive, 'a block is glowing after cycling to a match (the SAME reveal t2397 already uses)').toBe(true);

  await page.evaluate(() => {
    const inp = document.querySelector('.blk-find-input');
    inp.value = 'zzz_nonexistent_zzz'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  const zeroState = await page.evaluate(() => ({
    count: document.querySelector('.blk-find-count').textContent,
    noMatchClass: document.querySelector('.blk-find-input').classList.contains('no-match'),
  }));
  expect(zeroState.count, 'zero matches says so plainly, never a silent no-op').toBe('0/0');
  expect(zeroState.noMatchClass, 'the input shows a visible no-match state').toBe(true);

  await page.evaluate(() => document.querySelector('.blk-find-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.querySelector('.blk-findbar').classList.contains('hidden')), 'Esc closes the bar').toBe(true);

  await page.screenshot({ path: 'scratchpad/t2435-canvas-find.png' });
});

test('a match inside a COLLAPSED block is expanded before it is revealed, so the match is actually visible', async ({ page }) => {
  await bootCornerPlaced(page);

  const target = await page.evaluate(() => {
    const blk = window.__blkws.getAllBlocks(false).find((b) => (b.inputList || []).some((i) => (i.fieldRow || []).some((f) => {
      try { return String(f.getText() || '').includes('Probe stylus radius'); } catch (_) { return false; }
    })));
    if (!blk) return null;
    blk.setCollapsed(true);
    return blk.id;
  });
  expect(target, 'found a block carrying a distinctive matchable caption to collapse for this test').not.toBeNull();
  expect(await page.evaluate((id) => window.__blkws.getBlockById(id).isCollapsed(), target), 'the target is actually collapsed before the search').toBe(true);

  await page.evaluate(() => document.querySelector('.blk-find-chip').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const inp = document.querySelector('.blk-find-input');
    inp.focus(); inp.value = 'stylus radius'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);

  // the query may legitimately match more than one block (a field's own caption can repeat) — cycle through
  // every match with Enter until the collapsed target itself is reached, rather than assume it's the first.
  let stillCollapsed = true;
  for (let i = 0; i < 3 && stillCollapsed; i++) {
    stillCollapsed = await page.evaluate((id) => window.__blkws.getBlockById(id).isCollapsed(), target);
    if (stillCollapsed) {
      await page.evaluate(() => document.querySelector('.blk-find-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      await page.waitForTimeout(150);
    }
  }
  expect(stillCollapsed, 'a collapsed match is expanded on reveal — a glow on a hidden collapsed summary would show nothing').toBe(false);
});
