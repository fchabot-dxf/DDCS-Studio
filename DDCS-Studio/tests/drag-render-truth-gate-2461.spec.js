import { test, expect } from '@playwright/test';
import { dragHandleRenderTruth, assertDragRenderFaithful, handleScreenPos } from './support/dragRenderTruth.js';

/**
 * t2461 (BACKLOG #61, ARC A "Preview as data" — the GATE) — the ACCEPTANCE TEST for the new reusable harness
 * (`tests/support/dragRenderTruth.js`). Proves the harness on a DIFFERENT op (surfacing's `sf_pos`) than the
 * one `commit-on-release-2429.spec.js` already exercises (pocket's `pk_pos`/`pk_size`) — reusability across
 * ops, not a second copy of the same test. surfacing's `sf_pos` is the ORIGINAL bug's own screenshot subject
 * (t2447's own header note), so this is also the most direct possible re-proof.
 *
 * NON-VACUITY, per this project's own established discipline (`drawingCheck.js`'s own precedent: "blank the
 * canvas, watch it fail") and the dispatch's own explicit instruction ("a gate that has never failed on a real
 * defect is not proven — it is asserted"): the RETROSPECTIVE half of this proof — reverting t2447's own fix
 * (`web/viz/canvasWidgets.js`, `web/viz/featureCanvas.js`, `web/wizards/ops/panelTypes.js`, commit `ab59b869`)
 * and re-running THIS FILE against the broken code — was done manually as a scratch-backed, reverted-before-
 * commit verification pass, NOT committed as a permanent "expect failure" test (that would be testing a
 * hypothetical, not this harness). **REPORTED HONESTLY, not oversold**: the `pk_size` test (below) reproduced
 * the exact bug — RED, deterministically, identically across all 3 attempts ("post-release position (moved
 * 40.0px from start) must not snap back from mid-drag (47.2px)"), the snap-back symptom t2447's own bug report
 * describes exactly. The `sf_pos` test did NOT reproduce with THIS test's specific drag parameters — a real,
 * named limit of this ONE acceptance run, not glossed over: it does not mean the harness can't catch an sf_pos
 * regression, only that this particular drag delta/geometry combination didn't trigger the auto-refit race for
 * that handle on this pass. Full numbers in WORK-LOG t2461. Reverted files were restored byte-identical to
 * HEAD (`git diff` empty) before this file was committed — no broken code shipped.
 */

async function bootSurfacing(page) {
  await page.goto('/?debug=feat');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
  await page.evaluate(() => window.showApp('blocks'));
  await page.evaluate(async () => {
    const { _framed, makeOp } = await import('/blocks/opBuilders.js');
    const params = { w: 100, h: 60, toolDia: 10, stepoverPct: 60, depth: 1, originX: 0, originY: 0, wcs: 'active' };
    const framed = _framed('user_surfacing_data', params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const op = makeOp('user_surfacing_data', params, bare);
    const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
    window.ddcsLoadBlockStack(stack);
  });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 3);
  await page.waitForTimeout(400);
}

test.use({ viewport: { width: 1400, height: 1000 } });

test('t2461 GATE: surfacing sf_pos (move-kind) — real drag render truth via the reusable harness', async ({ page }) => {
  await bootSurfacing(page);

  const positions = await dragHandleRenderTruth(page, 'sf_pos', { dx: -150, dy: 100, steps: 12, settleMs: 500 });
  assertDragRenderFaithful(positions, { label: 'surfacing sf_pos' });

  // paired model check, same shape commit-on-release-2429.spec.js's own t2447 test uses: the committed VALUE
  // must also have moved (not just the pixels) — a render-faithful drag with a frozen model would be a
  // different bug this harness alone wouldn't catch, so this stays a companion assertion, not folded into
  // assertDragRenderFaithful itself (that function is pure geometry, deliberately).
  const originX = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.originX);
  expect(originX, 'the drag also landed a new committed value, not just a visual move').not.toBe(0);
});

test('t2461 GATE: reusable on a SECOND handle kind — pocket pk_size (resize-kind), same harness, no per-op code', async ({ page }) => {
  await page.goto('/?debug=feat');
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

  const positions = await dragHandleRenderTruth(page, 'pk_size', { dx: 40, dy: 25, steps: 8, settleMs: 400 });
  assertDragRenderFaithful(positions, { label: 'pocket pk_size' });
});

test('t2461: handleScreenPos returns null for a handle that is not rendered (the harness fails closed, not silently)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  const pos = await handleScreenPos(page, 'nonexistent_hid_2461');
  expect(pos, 'a missing handle reads null, not a stale/zero rect that would silently pass').toBeNull();
});
