import { test, expect } from '@playwright/test';

/**
 * t2413 (BACKLOG #55) — "the drag commits then reverts on release." t2409 fixed the Blocks pane's REDRAW
 * severance (the handle now tracks the pointer live) — but that only made the SYMPTOM visible: the drag's own
 * write never reached the canonical store in the first place, on ANY input method, not just a canvas drag.
 *
 * Root, confirmed live: `blkView`'s own `onFieldWrite` always called `writeAuthoredValue` (devMode.js), which
 * resolves its target through `deriveAuthoredDef`'s own bindings — an AUTHORING-canvas concept (exposed
 * knobs / `param_field` blocks) that is always empty for a normally PLACED op (no such blocks exist on its
 * canvas). Confirmed by direct call: `writeAuthoredValue(ws, 'w', 999)` returns `false` and
 * `window.ddcsGetBlockProgram()` never moves — not the write racing a later revert, the write never landing
 * at all. A second, independent bug compounded it: `deriveLiveWizard()` computes `opBlock` (the placed op's
 * own stack record) but never returned it, so even a `placedOpFallback`-gated fix had no `.id` to reach the
 * live block with.
 *
 * The fix: for a placed (not authored) op, `onFieldWrite` now patches the op's own Blockly block `.data` JSON
 * directly (the same store `deriveLiveWizard`'s `placedOpFallback` already reads to SEED the form/canvas on
 * every render — confirmed via `stackBridge.js`'s own `workspaceToStack`, which reads an op block's `params`
 * straight off `.data`, never by re-deriving from its exec atoms) and calls `reproject()` to refresh
 * `programModel.js`'s own cached stack (`window.ddcsGetBlockProgram()`), since a direct `.data` mutation fires
 * no Blockly change event and nothing else would refresh that cache. Deliberately does NOT rebuild the op's
 * own exec atoms (`mergeOpBlocks`'s heavier job, and the ruled commit-on-release redesign, #50) — scoped to
 * making the write reach the one authoritative store the form/canvas already reads from.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

async function bootPocketOp(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.evaluate(async () => {
    const { _framed, makeOp } = await import('/blocks/opBuilders.js');
    const params = { shape: 'rect', strategy: 'spiral', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wcs: 'active' };
    const framed = _framed('user_pocket_data', params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const op = makeOp('user_pocket_data', params, bare);
    const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
    window.ddcsLoadBlockStack(stack);
  });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5);
  await page.waitForTimeout(400);
}

test('a typed field edit on a PLACED op persists into window.ddcsGetBlockProgram() and does not revert', async ({ page }) => {
  await bootPocketOp(page);
  const before = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.w);
  expect(before).toBe(80);

  // t2413 — Playwright's own .fill() does not reliably commit on this specific field in this harness (a
  // tooling quirk unrelated to the app, confirmed live: a manual value+dispatch works cleanly where .fill()
  // silently no-ops) — driving the DOM directly the way any real keystroke would (set .value, dispatch a
  // real bubbling 'input') is both simpler and avoids that unrelated flake.
  await page.evaluate(() => {
    const el = document.querySelector('[data-param="w"]');
    el.focus(); el.value = '123';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const formValue = await page.evaluate(() => document.querySelector('[data-param="w"]').value);
  expect(formValue, 'the form field itself does not revert').toBe('123');

  const modelValue = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.w);
  expect(modelValue, 'the canonical model (window.ddcsGetBlockProgram) reflects the edit, not the entry-time value').toBe(123);
});

test('a canvas-handle drag on a PLACED op persists the size through release and 2s of settle, with no revert', async ({ page }) => {
  await bootPocketOp(page);
  const handle = page.locator('.fc-handle[data-hid="pk_size"]');
  await handle.waitFor({ state: 'visible', timeout: 5000 });
  const box = await handle.boundingBox();
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(startX + i * 4, startY + i * 2, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();

  const rightAfterUp = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.w);
  expect(rightAfterUp, 'the drag already changed w by release time').not.toBe(80);

  await page.waitForTimeout(2000);   // the exact window BACKLOG #55's own report happens in
  const afterSettle = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.w);
  expect(afterSettle, 'the value 2s after release is UNCHANGED from right-after-release — no revert').toBe(rightAfterUp);
});
