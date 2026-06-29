import { test, expect } from '@playwright/test';

/**
 * B3 — the SIM-DECLARATION block: def.sim.starts (B1's per-pass ROWS) surfaced as a `simstart` block in the Blockly
 * view. It's the blocks-native twin of the rows — a DECLARATION that round-trips against def.sim.starts, NOT the macro
 * (it emits no line; the emit reverse-sync would drop it, so it's read like the `sim` block at save time). Locks:
 * registered + the Option-A vocabulary, emits nothing, the rows⇄blocks declaration round-trip (pure + through the live
 * workspace), and feeds B1's makeProvider. Mirrors gui-sim-block.spec.js (the `sim` precedent).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('simstart block: registered, vocabulary fields, emits nothing, rows⇄blocks round-trip, feeds makeProvider', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind } = await import('/blocks/blockly/bridge.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { makeProvider } = await import('/viz/opSimStarts.js');
    const U = await import('/blocks/userOps.js');

    // a simstart block emits NO G-code; the move beside it still emits
    const emitted = emitMapped([{ type: 'simstart', params: { anchor: 'centre' } }, { type: 'move', params: { x: 1, y: 2, z: -5 } }]).text;

    // PURE declaration round-trip: rows → block records → rows (the canonical, per-anchor-pruned shape)
    const rows = [
      { anchor: 'edge', axis: 'X', side: '@dir1', out: '@outset', plane: 'probe' },
      { anchor: 'centre', plane: 'top', when: { param: 'twoAxis', is: true } },
    ];
    const recs = U.simStartsToBlocks(rows);
    const back = U.simStartsFromStack(recs);

    // and the round-tripped rows still drive B1's makeProvider (2 passes, the gate keeps the 2nd)
    const starts = makeProvider(back)({ dir1: 'pos', dist: 100, twoAxis: true }, { x: 100, y: 80, z: 20 });

    return {
      has: !!BLOCKS.simstart,
      anchorKind: BLOCKS.simstart && fieldKind(BLOCKS.simstart, 'anchor'),
      wallKind: BLOCKS.simstart && fieldKind(BLOCKS.simstart, 'wall'),
      emitsNothing: BLOCKS.simstart && Array.isArray(BLOCKS.simstart.emit()) && BLOCKS.simstart.emit().length === 0,
      moveEmitted: emitted.length > 0 && /G/i.test(emitted),
      recType: recs[0] && recs[0].type,
      back, startsLen: starts.length,
    };
  });

  expect(r.has, 'simstart registered in the palette').toBe(true);
  expect(r.anchorKind, 'anchor renders as a dropdown').toBe('dropdown');
  expect(r.wallKind, 'wall (edge side) renders as a dropdown').toBe('dropdown');
  expect(r.emitsNothing, 'simstart emits no G-code (a declaration)').toBe(true);
  expect(r.moveEmitted, 'the move beside it still emits').toBe(true);
  expect(r.recType).toBe('simstart');
  expect(r.back, 'rows → blocks → rows is identity (canonical per-anchor shape)').toEqual([
    { anchor: 'edge', axis: 'X', side: '@dir1', out: '@outset', plane: 'probe' },
    { anchor: 'centre', plane: 'top', when: { param: 'twoAxis', is: true } },
  ]);
  expect(r.startsLen, 'the round-tripped rows still feed makeProvider (2 passes)').toBe(2);
});

test('REAL-SYMPTOM: def.sim.starts rows show AS BLOCKS in the Blockly view; editing a block updates the declaration', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

  // a custom op's def.sim.starts rows → blocks → render them in the workspace
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const rows = [
      { anchor: 'edge', axis: 'X', side: '@dir1', out: '@outset', plane: 'probe' },
      { anchor: 'centre', plane: 'top', when: { param: 'twoAxis', is: true } },
    ];
    window.ddcsLoadBlockStack(U.simStartsToBlocks(rows));
  });
  await page.waitForTimeout(350);

  // the rows SHOW as simstart blocks (drawn, height > 0)
  const shown = await page.evaluate(() => {
    const blks = window.__blkws.getAllBlocks().filter((b) => b.type === 'simstart');
    return { n: blks.length, h: blks[0] ? blks[0].getHeightWidth().height : 0, edgeWall: (blks.find((b) => b.getFieldValue('ANCHOR') === 'edge') || {}).getFieldValue ? blks.find((b) => b.getFieldValue('ANCHOR') === 'edge').getFieldValue('WALL') : null };
  });
  expect(shown.n, 'both rows render as simstart blocks').toBe(2);
  expect(shown.h, 'a simstart block actually draws').toBeGreaterThan(0);
  expect(shown.edgeWall, 'the edge block carries its declared wall side').toBe('@dir1');

  // EDIT a block field → read the workspace back → def.sim.starts reflects the edit (no macro line involved)
  const after = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const edge = window.__blkws.getAllBlocks().find((b) => b.type === 'simstart' && b.getFieldValue('ANCHOR') === 'edge');
    edge.setFieldValue('@dir2', 'WALL');   // change the wall side @dir1 → @dir2
    const stack = workspaceToStack(window.__blkws);
    return { rows: U.simStartsFromStack(stack) };
  });
  expect(after.rows.length, 'still two declared passes').toBe(2);
  expect(after.rows[0].side, 'the block edit flowed into def.sim.starts').toBe('@dir2');
  expect(after.rows[1].when, 'the conditional (when) survives the round-trip').toEqual({ param: 'twoAxis', is: true });
});
