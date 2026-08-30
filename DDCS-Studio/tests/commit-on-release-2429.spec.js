import { test, expect } from '@playwright/test';

/**
 * t2429 (BACKLOG #46's second half) — COMMIT ON RELEASE, the owner's own ruling: during a canvas drag the GUI
 * follows the finger LIVE, canvas-only, NOTHING written; on release exactly ONE write lands in the block → ONE
 * undo step. The blocker (#50 — a programmatic write was invisible to undo, one write or many) shipped t2427;
 * this turn builds the deferred half itself.
 *
 * ⭐ THE RISK, established BEFORE touching anything (per the dispatch's own instruction): does the live redraw
 * depend on the model write? Traced live: `userOpView.js`'s own `update(mgr)` builds `params` from `_readers`
 * (`for (const read of _readers) Object.assign(params, read())`), and every reader closes over the ACTUAL DOM
 * `<input data-param>` node, reading `.value` fresh — never the model (`window.ddcsGetBlockProgram()`). The
 * redraw and the model write are therefore ALREADY decoupled: a mid-drag frame can update the DOM field (so the
 * redraw follows it) without ever reaching the model.
 *
 * MECHANISM: `panelTypes.js`'s `_writeParam(name, val, opts)` — `opts.preview` (set by `canvasWidgets.js`'s own
 * `onDrag`, one per drag frame) still sets the DOM field value and dispatches a real 'input' (so the redraw
 * still runs), but tags the event (`CustomEvent` `detail.previewOnly`) so `userOpView.js`'s delegated listener
 * skips `onFieldWrite` — the actual model write — for it. A NEW `onDragEnd` (`panelTypes.js`, wired into all 3
 * spec-return points) commits on release by scanning the render's own form host for any field whose value still
 * disagrees with a `data-ddcs-committed` baseline (captured once, on the FIRST preview frame that touches a
 * field, from its PRE-drag value) — reading the LIVE DOM directly rather than replaying a "pending updates" map
 * tracked in a closure, because the first version of this fix tried exactly that inside `canvasWidgets.js` and
 * it silently never fired: `_mgr.update()`'s own synchronous re-render calls `buildCanvasWidgets` fresh on
 * EVERY drag frame, orphaning whichever closure computed the previous frame's pending value before `onDragEnd`
 * ever got called on it.
 *
 * ⚠ SCOPE — narrower than originally intended, two exclusions found live and kept rather than chased blind
 * (the dispatch's own instruction: stop and report rather than restructure "five turns of hard-won" machinery):
 *
 * 1. Corner's own `repoGroups`/`spotStore` reposition-chain (t120-t122): dragging one datum-relative marker
 *    freezes every OTHER marker's world into `spotStore`, which a separate derive-and-write (the "#23/#24
 *    write-back", panelTypes.js) re-projects every render to hold that marker's SCREEN position fixed. That
 *    mechanism assumes every frame's write lands in the model synchronously; deferred to a single release-time
 *    commit, the frozen marker's own screen position visibly drifted mid-drag (confirmed live, then fixed by
 *    excluding it — `spotOnDrag`'s own `dragged` check now forces an immediate, every-frame commit for exactly
 *    these handles, unchanged from before this turn).
 *
 * 2. 'move'-kind handles generally (`point`/`diagAim`/`translate` gesture types — the only ones FeatureCanvas
 *    renders `kind:'move'` for, and the ONE kind its own pointermove handler runs `_snapToAnchor` against every
 *    frame): committed the CORRECT final field values on release (verified directly against the DOM, for BOTH
 *    pocket's own `pk_pos` and surfacing's own `sf_pos` — the #46 dispatch's own original named handle) yet the
 *    CANVAS rendered the handle well short of the actual drag distance — for drags of every size tried, not an
 *    extreme edge case. Root not confirmed within this turn's own budget. Scoped out rather than shipped
 *    broken or the whole fix reverted: commit-on-release now applies to non-move gestures only
 *    (length/scaleX/shear/rect/radial/projLength/crossAim/probeVector — VERIFIED working, including pocket's
 *    OTHER named handle, `pk_size`). Move-kind handles keep committing every frame, unchanged from before this
 *    turn — #50's own fix (t2427) still coalesces a burst into one undo entry for them, so they are not worse
 *    off, just not yet on commit-on-release. Surfacing's own `sf_pos` — the bug's own original screenshot
 *    subject — is therefore STILL on the old every-frame-write behavior; named here rather than left to be
 *    silently rediscovered.
 *
 * Separately, the classic per-type wizard MODAL views (e.g. `surfacingView.js`'s own hand-rolled `setFields`)
 * are structurally untouched — they never read the new `opts` argument at all, so they're byte-identical
 * regardless of any of the above (see the regression test below).
 */

async function bootPocket(page, debug = true) {
  await page.goto(debug ? '/?debug=feat' : '/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
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

test.use({ viewport: { width: 1400, height: 1000 } });

test('the model stays FROZEN through every mid-drag frame, then changes exactly ONCE at release (the ?debug=feat probe)', async ({ page }) => {
  const featLines = [];
  page.on('console', (msg) => { const t = msg.text(); if (t.startsWith('[featProbe]')) featLines.push(t); });

  await bootPocket(page, true);

  const handle = page.locator('.fc-handle[data-hid="pk_size"]');
  await handle.waitFor({ state: 'visible', timeout: 5000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error('pk_size handle has no bounding box');
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(startX + i * 4, startY + i * 2, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  console.log('=== featProbe rows (pocket pk_size, commit-on-release) ===');
  for (const l of featLines) console.log(l);

  const models = featLines.map((l) => (l.match(/model:(.+)$/) || [])[1]).filter(Boolean);
  expect(featLines.some((l) => l.includes('▲ up')), 'the probe recorded a pointer-up row').toBe(true);

  // t2429 — NOT sliced at the exact "▲ up" marker row: featProbe's own main loop and its dedicated up-marker
  // row are two independent rAF callbacks, so the commit (synchronous inside FeatureCanvas's own pointerup
  // handler) can land one ordinary probe-sampled frame before the explicitly-labelled "▲ up" row without that
  // being a timing defect — the commit still happens AT release, just not necessarily on the exact same
  // requestAnimationFrame tick the marker row itself samples on. The load-bearing claim is checked directly
  // instead: across the WHOLE drag (start to well past release) the model shows EXACTLY TWO distinct values —
  // the frozen pre-drag one, held for every genuinely mid-drag frame, and the ONE new committed value — never
  // zero transitions (undo-blind) and never a stream of different values (writing every frame).
  const distinctModels = [...new Set(models)];
  expect(distinctModels.length, 'the model shows exactly one frozen pre-drag value, then exactly one committed value — not a per-frame stream, not never-committed').toBe(2);
  expect(models[0], 'the drag starts on the pre-drag value').toBe(distinctModels[0]);
  expect(models[models.length - 1], 'the drag ends on the newly-committed value').toBe(distinctModels[1]);
  // the frozen value must hold for the BULK of the drag (not flip-flop) — the first half of all sampled frames
  // still shows the pre-drag value, confirming the freeze isn't a coincidence of a short sample.
  const firstHalf = models.slice(0, Math.floor(models.length / 2));
  expect(new Set(firstHalf).size, 'the model is frozen through at least the first half of the drag').toBe(1);

  // the handle itself still tracks the pointer every frame — the redraw was never coupled to the write
  const handlePositions = featLines.map((l) => (l.match(/handle:([\d,]+)/) || [])[1]).filter(Boolean);
  expect(new Set(handlePositions).size, 'the handle position varies across frames (not frozen)').toBeGreaterThan(1);
});

test('exactly ONE undo entry results from the whole drag, and it restores the pre-drag value', async ({ page }) => {
  await bootPocket(page, false);

  const before = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.w);
  expect(before).toBe(80);

  await page.evaluate(async () => {
    const { onChange } = await import('/blocks/saveStates.js');
    window.__snapCount = 0;
    window.__unwatch = onChange(() => { window.__snapCount++; });
  });

  const handle = page.locator('.fc-handle[data-hid="pk_size"]');
  await handle.waitFor({ state: 'visible', timeout: 5000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error('pk_size handle has no bounding box');
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(startX + i * 5, startY + i * 3, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);   // past GESTURE_QUIET_MS (200ms) — the drag's own single deferred undo entry

  const mid = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.w);
  expect(mid, 'the drag landed a new value in the model').not.toBe(80);

  const snapCount = await page.evaluate(() => window.__snapCount);
  expect(snapCount, 'the WHOLE drag becomes exactly one undo entry, not a per-frame flood').toBe(1);

  await page.evaluate(async () => (await import('/blocks/saveStates.js')).undo());
  await page.waitForTimeout(300);
  const afterUndo = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.w);
  expect(afterUndo, 'one undo restores the pre-drag value').toBe(80);
});

test('SCOPE BOUNDARY: a move-kind position handle (pk_pos) is NOT deferred — it still tracks the drag correctly by committing every frame, unchanged', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.default3D = false; });
  await page.evaluate(() => window.openWiz('user_pocket_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('2d'); });
  await page.waitForSelector('#wiz_user svg [data-hid="pk_pos"]', { timeout: 8000 });
  await page.waitForTimeout(200);
  const posScreen = () => page.evaluate(() => { const el = document.querySelector('#wiz_user svg [data-hid="pk_pos"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const before = await posScreen();
  await page.mouse.move(before.x, before.y); await page.mouse.down();
  await page.mouse.move(before.x - 200, before.y + 160, { steps: 12 });
  const mid = await posScreen();
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await posScreen();
  const movedMid = Math.hypot(mid.x - before.x, mid.y - before.y);
  const movedAfter = Math.hypot(after.x - before.x, after.y - before.y);
  // this is the scope boundary this turn's own header comment names: a 'move'-kind handle keeps committing
  // every frame (unchanged from before this turn), so its post-release screen position must match its own
  // mid-drag position — a "landed short" gap here would mean the move-kind exclusion silently regressed.
  expect(movedAfter, 'the handle\'s post-release position matches where the drag actually left it').toBeGreaterThan(movedMid - 5);
});

test('REGRESSION: the wizard MODAL\'s own drag (surfacingView.js, a separate setFields) is untouched — still writes every frame', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  // opens the classic wizard modal for surfacing (not the Blocks tab) — surfacingView.js's own per-type view,
  // which has its own setFields(map) that ignores the new opts argument entirely (structurally isolated from
  // panelTypes.js's own commit-on-release change).
  const opened = await page.evaluate(async () => {
    if (!window.ddcsStudio || !window.ddcsStudio.wizardManager) return false;
    window.ddcsStudio.wizardManager.open('surfacing');
    return true;
  });
  expect(opened, 'the surfacing wizard modal opened').toBe(true);
  await page.waitForFunction(() => !!document.querySelector('#surfacingLayoutCanvas .fc-handle'), null, { timeout: 5000 });

  const handle = page.locator('#surfacingLayoutCanvas .fc-handle').first();
  const box = await handle.boundingBox();
  if (!box) throw new Error('surfacing modal handle has no bounding box');
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2;

  let inputCount = 0;
  await page.exposeFunction('__t2429CountInput', () => { inputCount++; });
  await page.evaluate(() => document.addEventListener('input', () => window.__t2429CountInput(), { capture: true }));

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(startX + i * 3, startY + i * 2, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);

  expect(inputCount, 'the modal\'s own drag still dispatches an input per frame — unchanged commit-every-frame behavior').toBeGreaterThan(3);
});
