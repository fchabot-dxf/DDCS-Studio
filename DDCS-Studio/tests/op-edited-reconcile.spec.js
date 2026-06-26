import { test, expect } from '@playwright/test';

/**
 * MID #1 — "one diff at three surfaces." `isOpBlockEdited` must mean exactly the valid-by-construction question:
 * "would regenerating this op from its params (a form Replace) LOSE something?" — not the forward-only over-report.
 *
 *   - A SURFACED value edited in Blocks (e.g. surfacing depth = stepdown.to) is fully form-representable: replaying
 *     the declared Replace path (reconcile → wizard generate) reproduces the live stack → nothing lost → FALSE.
 *   - An INJECTED atom (a `raw` with no form counterpart) is unrepresentable: Replace would drop it → TRUE.
 *
 * Asserted with the wizard CLOSED — the chip (editorOpHover) and the Blocks-tab guard (blocksApp) both query
 * isOpBlockEdited with no wizard open, so a wizard-open-only test would pass while those two surfaces still lie.
 * (Today this fails on the surfaced case: forward-only diffs BUILDERS(stale op.params) vs the edited children.)
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('isOpBlockEdited = "Replace would lose something": surfaced edit → false, injection → true (wizard closed)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz
    && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack);

  // insert a surfacing op, then CLOSE the wizard (the chip + Blocks-guard surfaces run with no wizard open)
  const opId = await page.evaluate(async () => {
    window.ddcsLoadBlockStack([]);
    window.openWiz('surfacing', undefined, true);   // bypass the hardware prereq prompt
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'surfacing');
    return op ? op.id : null;
  });
  expect(opId, 'surfacing op inserted').toBeTruthy();

  // baseline: a freshly-inserted op is NOT edited (sanity — params-complete)
  const fresh = await page.evaluate(async ({ opId }) => {
    const glow = await import('/blocks/opGlow.js');
    return glow.isOpBlockEdited(opId);
  }, { opId });
  expect(fresh, 'fresh insert is not block-edited').toBe(false);

  // SURFACED edit: change the StepDown depth (a value the form represents: sf_depth ← stepdown.to) to a sentinel.
  const surfaced = await page.evaluate(async ({ opId }) => {
    const glow = await import('/blocks/opGlow.js');
    const prog = (window.ddcsGetBlockProgram() || []).map((b) => ({ ...b }));
    const op = prog.find((b) => b && b.id === opId);
    op.children = JSON.parse(JSON.stringify(op.children || []));   // clone the subtree before mutating
    const findRec = (bs) => { for (const b of (bs || [])) { if (b.type === 'stepdown') return b; const f = findRec(b.children); if (f) return f; } return null; };
    const sd = findRec(op.children);   // surfacing nests stepdown under a PlaceOnStock wrapper
    sd.params.to = sd.params.to - 2.5;   // a surfaced value (sf_depth) — the form CAN represent this
    window.ddcsLoadBlockStack(prog);
    return glow.isOpBlockEdited(opId);
  }, { opId });

  // INJECTED edit: add a raw atom (no form counterpart) — Replace would drop it.
  const injected = await page.evaluate(async ({ opId }) => {
    const glow = await import('/blocks/opGlow.js');
    const prog = (window.ddcsGetBlockProgram() || []).map((b) => ({ ...b }));
    const op = prog.find((b) => b && b.id === opId);
    op.children = [...(op.children || []), { type: 'raw', params: { text: 'INJECT_MID1' } }];
    window.ddcsLoadBlockStack(prog);
    return glow.isOpBlockEdited(opId);
  }, { opId });

  expect(injected, 'injected raw atom → Replace would drop it → block-edited').toBe(true);
  expect(surfaced, 'surfaced depth edit → Replace regenerates it losslessly → NOT block-edited').toBe(false);
});

// The teeth of the wizard-closed requirement: a NON-default tool-Ø. The reconciler un-derives stepover% from the
// absolute block stepover ÷ tool-Ø — so replay MUST read tool-Ø from the op's STORED params, not the DOM. With the
// default tool-Ø (12) a stale DOM read would coincide and hide the bug; at tool-Ø=8 the DOM default (12) gives the
// wrong stepover% → the rebuild diverges → the op would falsely read "edited." Only stored-state sourcing passes.
test('isOpBlockEdited reconciles using STORED tool-Ø (non-default), not the DOM default — wizard closed', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz
    && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack);

  // insert surfacing with a NON-default tool diameter (8, default is 12), then CLOSE the wizard
  await page.evaluate(() => { window.ddcsLoadBlockStack([]); window.openWiz('surfacing', undefined, true); });
  await page.waitForSelector('#sf_toolDia', { state: 'visible' });
  await page.fill('#sf_toolDia', '8');
  const opId = await page.evaluate(async () => {
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'surfacing');
    return op ? op.id : null;
  });
  expect(opId, 'surfacing op (tool-Ø 8) inserted').toBeTruthy();

  // edit the surfaced depth in Blocks (wizard closed) — reconciling the stepover needs the STORED tool-Ø (8)
  const surfaced = await page.evaluate(async ({ opId }) => {
    const glow = await import('/blocks/opGlow.js');
    const prog = (window.ddcsGetBlockProgram() || []).map((b) => ({ ...b }));
    const op = prog.find((b) => b && b.id === opId);
    op.children = JSON.parse(JSON.stringify(op.children || []));
    const findRec = (bs) => { for (const b of (bs || [])) { if (b.type === 'stepdown') return b; const f = findRec(b.children); if (f) return f; } return null; };
    findRec(op.children).params.to -= 1.5;
    window.ddcsLoadBlockStack(prog);
    return glow.isOpBlockEdited(opId);
  }, { opId });
  expect(surfaced, 'depth edit reconciles via STORED tool-Ø (8), not the DOM default (12) → NOT edited').toBe(false);
});
