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
// t1732 — 'edge' repointed to its twin 'user_edge_data': edge's coded view is retired (t1730), so a real user
// today only ever reaches it through the twin — confirmed live (openWiz('user_edge_data') gives 9 visible fields
// and inserts correctly; commandDeck's WIZ_SPECIAL_OPENER is empty and every probe entry routes via opensAs to
// its twin, so no user-clickable path still uses the raw type). Still serves the same "clean control" role
// (contrasted against surfacing/pocket/contour/slot's nested-region bug) via the door users actually use.
const CORES = ['surfacing', 'pocket', 'contour', 'slot', 'user_edge_data'];   // the region-bearing ops the nested-id bug bit + a clean control
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
    // t1732 — an explicit `sel.list` is iterated DIRECTLY (not intersected against ops.BUILDERS' keys): a twin
    // type like 'user_edge_data' is a real, live, openable/insertable op, but BUILDERS only holds the pristine
    // built-in (raw-type) layer — USER_BUILDERS (the twin layer) is a separate object, so a twin type would never
    // appear in Object.keys(ops.BUILDERS) at all and would be silently skipped forever under the old intersection.
    // The sharded sweep (no sel.list) is UNCHANGED — it still exhaustively walks the built-in layer only.
    const keys = sel.list ? sel.list : Object.keys(ops.BUILDERS);
    const want = (type, i) => sel.list ? true : (i % sel.n === sel.s);
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
