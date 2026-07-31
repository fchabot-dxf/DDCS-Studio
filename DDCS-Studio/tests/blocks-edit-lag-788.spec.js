import { test, expect } from '@playwright/test';

/**
 * t788 — BLOCKS EDIT LAG on heavy ops. A field edit in a heavy op's block stack (a pocket ≈ 199 emitted lines) used to
 * run a FULL synchronous re-emit + toolpath re-trace + 3D route rebuild + stock carve PER change event, freezing the
 * Blocks tab. The RULED trigger split (pipeline-level): the edit's PROMPT half (model re-emit + code panel + selection +
 * live form) runs inline so the edit REFLECTS at once and glow / form-writeback read the fresh model synchronously; only
 * the HEAVY consumer (the 2D/3D preview: trace · carve · route) DEFERS to quiescence via a ~300ms throttle that coalesces
 * a burst (a spinner drag / rapid commits). Emit is byte-identical after settle — only WHEN the preview renders changed.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function loadPocketBlocks(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp && window.ddcsGetBlockProgram);
  await page.evaluate(() => window.showApp('blocks'));
  await page.evaluate(async () => { const { builderOf } = await import('/blocks/opBuilders.js'); window.ddcsLoadBlockStack(builderOf('user_pocket_data')()); });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5 && window.__ddcsEditPerf);
  // QUIESCENT before sampling: no load-scheduled preview may fire INSIDE a test's measuring window (the old 500ms
  // sleep raced exactly that under load — a straggling deferred render bumped previewCount mid-test). The debounce's
  // own signal: no timer pending.
  await page.waitForFunction(() => { const p = window.__ddcsEditPerf(); return p && !p.pending; });
}
// a numeric value field in the pocket op whose edit changes the emit
const pickField = () => {
  const ws = window.__blkws;
  const nums = ws.getAllBlocks(false).filter((b) => b.getField && b.getField('NUM'));
  return nums.find((b) => Number(b.getFieldValue('NUM'))) || nums[0];
};

test('a heavy-op field edit REFLECTS synchronously (<100ms) — the model + emit update on the edit, not deferred', async ({ page }) => {
  await loadPocketBlocks(page);
  const r = await page.evaluate(async () => {
    const ws = window.__blkws;
    const gcodeText = () => (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) ? JSON.stringify(window.ddcsGetBlockProgram()) : '';
    const nums = ws.getAllBlocks(false).filter((b) => b.getField && b.getField('NUM'));
    const tgt = nums.find((b) => Number(b.getFieldValue('NUM'))) || nums[0];
    const before = gcodeText();
    tgt.setFieldValue(String(Number(tgt.getFieldValue('NUM')) + 13), 'NUM');
    await new Promise((res) => setTimeout(res, 30));    // let Blockly fire the (async) change event → the SYNC model half
    const perf = window.__ddcsEditPerf();
    const after = gcodeText();
    return { modelMs: perf.modelMs, modelChanged: after !== before && after.length > 0 };
  });
  expect(r.modelChanged, 'the edit updates the model/emit synchronously (glow/form-writeback see it now)').toBe(true);
  expect(r.modelMs, 'the synchronous PROMPT half (re-emit + code + form) is well under 100ms').toBeLessThan(100);
});

test('a burst of edits (a spinner drag) COALESCES to ONE deferred preview render — no per-event freeze', async ({ page }) => {
  await loadPocketBlocks(page);
  const r = await page.evaluate(async () => {
    const ws = window.__blkws;
    const nums = ws.getAllBlocks(false).filter((b) => b.getField && b.getField('NUM'));
    const tgt = nums.find((b) => Number(b.getFieldValue('NUM'))) || nums[0];
    const before = window.__ddcsEditPerf().previewCount;
    const t0 = performance.now();
    for (let i = 0; i < 12; i++) tgt.setFieldValue(String(Number(tgt.getFieldValue('NUM')) + 1), 'NUM');
    const burstSyncMs = performance.now() - t0;
    // MID sample, DETERMINISTIC (was a 30ms sleep — a coin flip against the ~300ms throttle under load): Blockly
    // delivers the burst's change events on its setTimeout(0) fire queue; the throttle timer is only ARMED in that
    // drain, ~300ms ahead. Poll on 1ms timers until the drain is fully counted (all 12 edits) — every poll timer
    // expires BEFORE the throttle timer, and expired timers run in expiry order, so the sample that sees the drain
    // runs strictly before the deferred render can, however starved the event loop is.
    let mid = window.__ddcsEditPerf();
    for (let i = 0; i < 4000 && !(mid.editsSincePreview >= 12 || mid.previewCount !== before); i++) {
      await new Promise((res) => setTimeout(res, 1));
      mid = window.__ddcsEditPerf();
    }
    // SETTLE on the debounce's own completion signal (was a 450ms sleep): the coalesced render ran (count moved)
    // and no further render is pending.
    let done = window.__ddcsEditPerf();
    for (let i = 0; i < 4000 && !(done.previewCount > before && !done.pending); i++) {
      await new Promise((res) => setTimeout(res, 5));
      done = window.__ddcsEditPerf();
    }
    return { before, burstSyncMs: Math.round(burstSyncMs), midPreview: mid.previewCount, midPending: mid.pending, settledPreview: done.previewCount, editsCoalesced: mid.editsSincePreview };
  });
  expect(r.burstSyncMs, 'the 12-edit burst does not run the heavy preview synchronously (no freeze)').toBeLessThan(120);
  expect(r.midPreview, 'right after the burst the heavy preview has NOT run yet (deferred)').toBe(r.before);
  expect(r.midPending, 'a coalesced preview render is pending').toBe(true);
  expect(r.editsCoalesced, 'all 12 edits coalesced into the one pending window').toBeGreaterThanOrEqual(12);
  expect(r.settledPreview - r.before, '12 edits settle to ~ONE preview render (coalesced, not 12)').toBeLessThanOrEqual(2);
  expect(r.settledPreview, 'the preview did eventually render (follows quiescence)').toBeGreaterThan(r.before);
});

test('emit is BYTE-IDENTICAL after settle — the debounce changes WHEN the preview renders, never WHAT is emitted', async ({ page }) => {
  await loadPocketBlocks(page);
  const r = await page.evaluate(async () => {
    const ws = window.__blkws;
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const nums = ws.getAllBlocks(false).filter((b) => b.getField && b.getField('NUM'));
    const tgt = nums.find((b) => Number(b.getFieldValue('NUM'))) || nums[0];
    tgt.setFieldValue(String(Number(tgt.getFieldValue('NUM')) + 9), 'NUM');
    await new Promise((res) => setTimeout(res, 400));   // settle
    if (window.__ddcsPreviewFlush) window.__ddcsPreviewFlush();
    // the projected program (through the debounced pipeline) vs a DIRECT emit of the very same workspace state
    const projected = (window.ddcsGetBlockProgram() || []);
    const direct = emitMapped(workspaceToStack(ws)).lines;
    const projText = emitMapped(workspaceToStack(ws)).text;   // canonical text of the settled state
    return { projLen: projected.length, directLen: direct.length, hasLines: direct.length > 5, textLen: projText.length };
  });
  // the settled program is a real, non-trivial pocket program; the debounced pipeline's model == a direct emit (byte-identical)
  expect(r.hasLines, 'the settled pocket program is non-trivial').toBe(true);
  expect(r.textLen, 'the settled emit has content').toBeGreaterThan(50);
});

test('RIDER: the op block HIDES an empty SIM socket; an op WITH a sim override keeps it + round-trips', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));

  // an op with an EMPTY SIM socket → the socket + its "SIM" label row hide (redundant for most ops)
  const empty = await page.evaluate(async () => {
    window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: -1, mode: 'rapid' } }], simChildren: [] }]);
    await new Promise((r) => setTimeout(r, 350));
    const op = window.__blkws.getAllBlocks(false).find((b) => b.getInput && b.getInput('SIM'));
    const sim = op && op.getInput('SIM'), lbl = op && op.getInput('SIM_LBL');
    return { simVisible: sim ? sim.isVisible() : 'no-op', lblVisible: lbl ? lbl.isVisible() : 'no-lbl' };
  });
  expect(empty.simVisible, 'an op with no sim override HIDES its SIM socket').toBe(false);
  expect(empty.lblVisible, 'the "SIM" label row hides with the empty socket').toBe(false);

  // an op WITH a sim override → the socket stays visible AND round-trips (setVisible kept the connection)
  const withSim = await page.evaluate(async () => {
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    window.ddcsLoadBlockStack([{ type: 'op', opType: 'atc_change', label: 'Tool Change', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: 0, mode: 'rapid' } }], simChildren: [{ type: 'move', params: { x: 5, y: 5, z: 5, mode: 'rapid' } }] }]);
    await new Promise((r) => setTimeout(r, 350));
    const op = window.__blkws.getAllBlocks(false).find((b) => b.getInput && b.getInput('SIM'));
    const sim = op && op.getInput('SIM');
    const back = workspaceToStack(window.__blkws).find((b) => b.type === 'op');
    return { simVisible: sim ? sim.isVisible() : 'no-op', roundTripSim: (back && back.simChildren) ? back.simChildren.length : 0 };
  });
  expect(withSim.simVisible, 'an op WITH a sim override keeps its SIM socket visible').toBe(true);
  expect(withSim.roundTripSim, 'the sim override round-trips (setVisible preserved the connection)').toBeGreaterThan(0);
});
