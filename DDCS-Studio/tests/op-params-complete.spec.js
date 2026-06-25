import { test, expect } from '@playwright/test';

/**
 * PARAMS-COMPLETENESS — a freshly-inserted op must not look hand-edited. `op.params` is the single source of
 * truth, so `BUILDERS(op.params)` must reproduce `op.children` (block ids aside). When it doesn't, the editor
 * false-glows the op and `isOpBlockEdited` returns true (the spurious "block edited — Merge/Replace?" notice).
 *
 * Regression guard for the nested-region-id bug: surfacing/pocket/contour embed a `region` block inside
 * `stepover.params`, and that block's counter-based `id` is regenerated on every BUILDERS() call — so the whole
 * toolpath glowed on insert until the structural compares (`isOpBlockEdited`, the glow's `_paramsDiffer`) were
 * made block-id-insensitive. Also the construction-by-validity guard for the future user-made ops.
 */
test('fresh-inserted ops are params-complete (no false glow / block-edited)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.insertWiz && window.ddcsGetBlockProgram
    && window.ddcsLoadBlockStack && typeof window.ddcsEditedLinesForOp === 'function');

  const r = await page.evaluate(async () => {
    const ops = await import('/blocks/opStacks.js');
    const committed = [], dirty = [];
    for (const type of Object.keys(ops.BUILDERS)) {
      try {
        window.ddcsLoadBlockStack([]);
        window.openWiz(type, undefined, true);   // bypass the hardware prereq prompt
        window.updateWiz();
        await window.insertWiz();
        window.closeWiz && window.closeWiz();
        const prog = window.ddcsGetBlockProgram() || [];
        const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === type);
        if (!op) continue;   // no openWiz opener (retired circular / special ATC openers) — out of scope here
        committed.push(type);
        const glow = (window.ddcsEditedLinesForOp(op.id) || []).length;
        const edited = ops.isOpBlockEdited ? ops.isOpBlockEdited(op.id) : false;
        if (glow || edited) dirty.push({ type, glow, edited });
      } catch (_) { /* opener threw — not a params-completeness failure */ }
    }
    return { committed, dirty };
  });

  // the region-bearing cutting ops (where the bug bit) + a clean control must actually be exercised
  for (const core of ['surfacing', 'pocket', 'contour', 'slot', 'edge']) expect(r.committed).toContain(core);
  // …and no freshly-inserted op may look edited
  expect(r.dirty).toEqual([]);
});
