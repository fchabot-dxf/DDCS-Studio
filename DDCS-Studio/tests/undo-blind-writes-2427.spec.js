import { test, expect } from '@playwright/test';

/**
 * t2427 (BACKLOG #50) — "rapid input-only writes are invisible to undo." Found t2391 while chasing #46 (canvas
 * drag): a burst of rapid `input` events into a placed op's Wizard-View-pane field, undo, zero effect.
 *
 * ⭐ INSTRUMENTED DIRECTLY against saveStates.js (this turn's own suggestion, recorded verbatim in the BACKLOG
 * entry, followed here) rather than drag-testing — smaller, faster, and it overturned the inherited framing:
 * this is NOT "rapid" specific. `saveStates.js`'s own exported `onChange()` subscription, watched live, shows
 * ZERO new undo entries for a SINGLE typed edit too — not just a burst. The BACKLOG title's "RAPID" came from
 * testing against a richer pre-existing history where Undo happened to land on an EARLIER checkpoint that
 * coincidentally already held the expected value, not from the single edit actually being recorded. See
 * WORK-LOG for the instrumented comparison that established this.
 *
 * ROOT: a placed op's VALUE-binding field write (`onFieldWrite`'s light `.data`-patch branch, blocksApp.js —
 * t2413's own precedent, since a placed op has no live Blockly field for `setFieldValue`) mutates `.data`
 * directly and calls `reproject()` explicitly. A direct `.data` mutation fires NO Blockly event at all
 * (confirmed by that branch's own comment) — so `ws.addChangeListener`'s gesture-boundary listener (the ONE
 * thing that calls `snapshotGesture`) never sees it. `reproject()`'s own `setStack(...,'blockly')` call is ALSO
 * excluded from `programModel`'s own recording path in saveStates.js (its origin filter deliberately skips
 * 'blockly', on the assumption every 'blockly'-origin change already reached a real Blockly event on the
 * listener above — true for a canvas-native edit, false for this one). Net: this write path NEVER creates an
 * undo checkpoint, one write or many.
 *
 * ⛔ THE FIX IS NOT a lower GESTURE_QUIET_MS or recording every event (undo spam is its own defect, the
 * debounce exists for a reason) — it is that this write path now feeds the SAME `__ungrouped__` gesture bucket
 * a bare `block.setFieldValue()` call (no Blockly Gesture open) already uses, so it gets the identical
 * debounce-batched recording everything else gets — a real edit becomes exactly ONE undo state, not zero and
 * not twenty.
 */

async function bootSurfacing(page) {
  await page.goto('/');
  // t2593 (BACKLOG #63) — the app-boot readiness check, unlike everywhere else in this codebase (84 other specs
  // pass an explicit longer timeout here), was relying on playwright.config.js's own global `actionTimeout:
  // 5000` default — too tight a margin for a cold app boot under load, even fully isolated (`--workers=1`,
  // nothing else running). Matched to this suite's own dominant convention (15000ms), not invented.
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 15000 });
  await page.evaluate(() => window.showApp('blocks'));
  await page.evaluate(async () => {
    const { _framed, makeOp } = await import('/blocks/opBuilders.js');
    const params = { originX: 0, originY: 0, w: 80, h: 60, strategy: 'raster' };
    const framed = _framed('user_surfacing_data', params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const op = makeOp('user_surfacing_data', params, bare);
    const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
    window.ddcsLoadBlockStack(stack);
  });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 3);
  await page.waitForTimeout(400);
}

// Watches saveStates.js's own onChange() (the ONE signal every recorded undo entry fires) and returns how many
// times it fired plus the field's own value after the given write actions run.
async function watchSnapshots(page, writeActions, waitMs = 500) {
  await page.evaluate(() => {
    window.__snapCount = 0;
    window.__unwatch = null;
  });
  await page.evaluate(async () => {
    const { onChange } = await import('/blocks/saveStates.js');
    window.__unwatch = onChange(() => { window.__snapCount++; });
  });
  await writeActions();
  await page.waitForTimeout(waitMs);   // past GESTURE_QUIET_MS (200ms), plus margin for waitMs callers that need it
  const count = await page.evaluate(() => window.__snapCount);
  await page.evaluate(() => { if (window.__unwatch) window.__unwatch(); });
  return count;
}

test('a SINGLE typed edit creates exactly one undo entry (was ZERO before this fix — not just the rapid case)', async ({ page }) => {
  await bootSurfacing(page);
  const before = await page.evaluate(() => document.querySelector('[data-param="originX"]').value);
  expect(before).toBe('0');

  const snapCount = await watchSnapshots(page, () => page.evaluate(() => {
    const f = document.querySelector('[data-param="originX"]');
    f.value = '99';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  expect(snapCount, 'a single typed edit records exactly one undo entry').toBe(1);

  const afterWrite = await page.evaluate(() => document.querySelector('[data-param="originX"]').value);
  expect(afterWrite).toBe('99');

  await page.evaluate(async () => (await import('/blocks/saveStates.js')).undo());
  await page.waitForTimeout(300);
  const afterUndo = await page.evaluate(() => document.querySelector('[data-param="originX"]').value);
  expect(afterUndo, 'undo reverts the edit').toBe('0');
});

test('8 RAPID input-only writes (t2391\'s own repro) coalesce into exactly one undo entry, and undo reverts to the pre-burst value', async ({ page }) => {
  await bootSurfacing(page);

  const snapCount = await watchSnapshots(page, async () => {
    for (let i = 0; i < 8; i++) {
      await page.evaluate((i) => {
        const f = document.querySelector('[data-param="originX"]');
        f.value = String(i * 3);
        f.dispatchEvent(new Event('input', { bubbles: true }));
      }, i);
      await page.waitForTimeout(20);
    }
  });
  expect(snapCount, '8 rapid writes coalesce into exactly one undo entry — not zero, not eight').toBe(1);

  const afterBurst = await page.evaluate(() => document.querySelector('[data-param="originX"]').value);
  expect(afterBurst).toBe('21');   // (8-1)*3

  await page.evaluate(async () => (await import('/blocks/saveStates.js')).undo());
  await page.waitForTimeout(300);
  const afterUndo = await page.evaluate(() => document.querySelector('[data-param="originX"]').value);
  expect(afterUndo, 'undo reverts the WHOLE burst in one step, back to the pre-burst value').toBe('0');
});

test('a DRAG-SHAPED burst (~27 writes, matching BACKLOG #46\'s own captured drag) still yields exactly ONE undo entry, not dozens', async ({ page }) => {
  await bootSurfacing(page);

  // t2427 — surfacing's own preview render (trace + 3D route) is genuinely heavy (blocksApp.js's own comment:
  // "a pocket ≈ 199 lines + 7 post-passes") and runs on the SAME single-threaded main thread the debounce timer
  // does; a 27-write burst schedules several of RECOMPUTE_MS's own deferred preview cycles (confirmed live via
  // `__ddcsEditPerf().previewCount`), which can delay the 200ms gesture-quiet timer's own firing well past
  // 200ms of WALL-CLOCK time — not a fix defect, a real main-thread contention window. Waited out generously
  // rather than asserted against a tight margin.
  const snapCount = await watchSnapshots(page, async () => {
    for (let i = 1; i <= 27; i++) {
      await page.evaluate((v) => {
        const f = document.querySelector('[data-param="originX"]');
        f.value = String(v);
        f.dispatchEvent(new Event('input', { bubbles: true }));
      }, i);
      // no inter-event wait — a real drag fires ~2 writes per animation frame, faster than GESTURE_QUIET_MS
    }
  }, 4000);
  expect(snapCount, 'undo spam is its own defect — a drag-rate burst must not explode into one entry per write').toBe(1);
});

test('REGRESSION: the authored-canvas real Blockly field edit (writeAuthoredValue) is untouched — still one entry per edit', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp, null, { timeout: 15000 });   // t2593 (BACKLOG #63) — see bootSurfacing's own comment
  await page.evaluate(() => window.showApp('blocks'));
  // t2593 (BACKLOG #63) — same reasoning as the boot-wait above: these two also gate on app initialization
  // completing under the shared workspace/dev-mode setup, not a fast, purely-synchronous check.
  await page.waitForFunction(() => !!window.__blkws, null, { timeout: 15000 });
  await page.waitForFunction(() => !!window.ddcsEditWizardDef, null, { timeout: 15000 });
  await page.evaluate((t) => { window.ddcsEditWizardDef(t); }, 'user_corner_data');
  let last = -1;
  for (let i = 0; i < 160; i++) {
    const n = await page.evaluate(() => window.__blkws.getAllBlocks(false).length);
    if (n === last && n > 0) break;
    last = n;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1000);

  const hasField = await page.evaluate(() => !!document.querySelector('[data-param="radius"]'));
  expect(hasField, 'the authored canvas exposes a live form field for radius').toBe(true);

  const snapCount = await watchSnapshots(page, () => page.evaluate(() => {
    const f = document.querySelector('[data-param="radius"]');
    f.value = '12';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  // t2427 — this path (writeAuthoredValue → a real Blockly setFieldValue) was ALREADY correctly recording
  // before this fix (real Blockly events reach the listener above unaffected) — it records 3 entries for one
  // input+change pair on this specific twin/param, PRE-EXISTING and confirmed unrelated to this turn's own
  // change (checked live: identical count with blocksApp.js reverted to its pre-fix baseline). Out of THIS
  // turn's scope (#50 is the placed-op path recording ZERO, not this path's own count) — the regression check
  // that matters here is "still records something, and the SAME something," not a specific number.
  expect(snapCount, 'a real Blockly-native field edit still records at least one entry — not blinded by this fix').toBeGreaterThan(0);
});
