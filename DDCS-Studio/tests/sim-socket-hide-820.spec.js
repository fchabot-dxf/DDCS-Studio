import { test, expect } from '@playwright/test';

/**
 * t820 (bundle 1) — THE OP BLOCK'S EMPTY SIM SOCKET GOES. GROUNDING (WORK-LOG): the adaptive hide already shipped as
 * t788 (syncSimSocket in blocksApp) — the SIM mouth + its "SIM" label show ONLY when a child is plugged in, else both
 * hide via setVisible (NOT removeInput, so the connection + round-trip survive). The ATC change's sim-OVERRIDE is a
 * declared function (def.simGcode via getUserSimGcode, applied at PREVIEW), not a SIM block — so it needs no socket. This
 * spec is the missing GUARD: an empty-SIM op hides the socket; a SIM-child op shows it; the hide keeps the round-trip.
 */

async function blocks(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws);
}
const simVis = (page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 500));
  const ws = window.__blkws;
  return ws.getAllBlocks(false).filter((b) => b.type === 'op' || (typeof b.type === 'string' && b.type.endsWith('_op'))).map((b) => {
    let m = {}; try { m = JSON.parse(b.data || '{}'); } catch (_) { /* */ }
    const s = b.getInput && b.getInput('SIM'), l = b.getInput && b.getInput('SIM_LBL');
    return { opType: m.opType, sim: s && s.isVisible ? s.isVisible() : null, lbl: l && l.isVisible ? l.isVisible() : null };
  });
});

test('an EMPTY-SIM op (pocket) hides the SIM socket + its label; a SIM-child op shows it', async ({ page }) => {
  await blocks(page);
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: -1, mode: 'feed' } }], simChildren: [] },
    { type: 'op', opType: 'edge', label: 'Edge (sim)', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: 0, mode: 'rapid' } }], simChildren: [{ type: 'move', params: { x: 5, y: 5, z: 5, mode: 'rapid' } }] },
  ]));
  const v = await simVis(page);
  const pocket = v.find((x) => x.opType === 'pocket'), withSim = v.find((x) => (x.opType || '') !== 'pocket');
  expect(pocket, 'the pocket op block is present').toBeTruthy();
  expect(pocket.sim, 'the empty-SIM pocket hides its SIM socket').toBe(false);
  expect(pocket.lbl, 'and hides the "SIM" label row too').toBe(false);
  expect(withSim.sim, 'an op holding a SIM child keeps the socket visible').toBe(true);
});

test('the empty-SIM hide is setVisible, NOT removeInput — simChildren still round-trip (emit unchanged)', async ({ page }) => {
  await blocks(page);
  const r = await page.evaluate(async () => {
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const stack = [{ type: 'op', opType: 'edge', label: 'Edge', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: 0, mode: 'rapid' } }], simChildren: [{ type: 'move', params: { x: 5, y: 5, z: 5, mode: 'rapid' } }] }];
    const emit0 = emitMapped(stack).text;
    window.ddcsLoadBlockStack(stack);
    await new Promise((r) => setTimeout(r, 500));
    const rt = workspaceToStack(window.__blkws);
    const op = rt.find((b) => b.type === 'op' || (typeof b.type === 'string' && b.type.endsWith('_op')));
    return { simKept: !!(op && op.simChildren && op.simChildren.length), emitSame: emitMapped(rt).text === emit0 };
  });
  expect(r.simKept, 'the SIM child survives the round-trip (hidden ≠ removed)').toBe(true);
  expect(r.emitSame, 'the emit is byte-identical (the SIM socket is preview-only)').toBe(true);
});
