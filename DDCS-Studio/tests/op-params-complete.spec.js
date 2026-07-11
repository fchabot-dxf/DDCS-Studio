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
 *
 * t710 FLAKE HARDENING — the original was ONE ~27s all-ops loop (open+update+insert+close every BUILDERS type,
 * each rendering the full 3D preview). ROOT CAUSE of the w=4 flake: DURATION, not a race — the loop's own wall
 * time approached the 30s test timeout, so 4-worker CPU contention pushed it over. No sampling race (the loop
 * awaits insertWiz per op; the glow read is synchronous). Fix = DECOMPOSE into a fast cores guard + 4 shards, so
 * no single test runs long enough to time out under contention (deterministic sizing, no added waits/retries).
 */
const CORES = ['surfacing', 'pocket', 'contour', 'slot', 'edge'];   // the region-bearing ops the nested-id bug bit + a clean control
const SHARDS = 4;

/** Insert every BUILDERS type matching `sel` and report which committed + which false-glowed. `sel` is either
 *  { list } (explicit types) or { s, n } (op index i where i%n===s). Runs entirely in-page (awaits insertWiz per op). */
async function runSlice(page, sel) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.insertWiz && window.ddcsGetBlockProgram
    && window.ddcsLoadBlockStack && typeof window.ddcsEditedLinesForOp === 'function');
  return page.evaluate(async (sel) => {
    const ops = await import('/blocks/opBuilders.js');
    const glowMod = await import('/blocks/opGlow.js');
    const committed = [], dirty = [];
    const keys = Object.keys(ops.BUILDERS);
    const want = (type, i) => sel.list ? sel.list.includes(type) : (i % sel.n === sel.s);
    for (let i = 0; i < keys.length; i++) {
      const type = keys[i];
      if (!want(type, i)) continue;
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
        const edited = glowMod.isOpBlockEdited ? glowMod.isOpBlockEdited(op.id) : false;
        if (glow || edited) dirty.push({ type, glow, edited });
      } catch (_) { /* opener threw — not a params-completeness failure */ }
    }
    return { committed, dirty };
  }, sel);
}

// The region-bearing cores (where the bug bit) MUST be exercised + clean — the explicit regression guard.
test('core region-bearing ops are params-complete (the nested-region-id guard)', async ({ page }) => {
  const r = await runSlice(page, { list: CORES });
  for (const core of CORES) expect(r.committed, `${core} is openable + insertable`).toContain(core);
  expect(r.dirty, 'no core op looks edited on fresh insert').toEqual([]);
});

// The full sweep — sharded so each test stays well under the 30s timeout even under 4-worker contention.
for (let s = 0; s < SHARDS; s++) {
  test(`fresh-inserted ops are params-complete — shard ${s + 1}/${SHARDS}`, async ({ page }) => {
    const r = await runSlice(page, { s, n: SHARDS });
    expect(r.dirty, `shard ${s + 1}: no fresh op looks edited`).toEqual([]);
  });
}
