import { test, expect } from '@playwright/test';

/**
 * Regression: the helical BORE kernel must BOUND its depth-driven pass count, and selecting a helical-bore leaf must
 * not FREEZE the value-glow. helicalBore builds 24·ceil(depth/pitch) lines; the select/hover glow perturbs `depth` to
 * its ~1e6 sentinel to localize that token → ~47M lines built SYNCHRONOUSLY → the tab hangs BEFORE the emitter's
 * push-spread can throw, so opGlow's try/catch can't catch it. The fix is a kernel cap in bore.js (a real bore never
 * reaches it, so normal emit is unchanged; an absurd pass count emits a tiny capped placeholder). Found by the
 * restructure-pass glow-safety audit — the one true hang the surfacing try/catch fix did NOT cover.
 */

test('helical bore kernel CAPS a runaway pass count (no hang) but leaves real bores untouched', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { helicalBore } = await import('/wizards/ops/bore.js');
    const base = { holeDia: 12, toolDia: 6, pitch: 0.5, feed: 100, clearance: 5 };
    const emit = (depth, ramp) => helicalBore({ x: 0, y: 0 }, { ...base, depth, ramp });
    const t0 = performance.now();
    const absurdHelix = emit(987654.321, 'helix');   // == the glow sentinel; pre-fix this hung for minutes
    const absurdStep = emit(987654.321, 'step');
    const ms = performance.now() - t0;
    const normalHelix = emit(5, 'helix');
    const normalStep = emit(5, 'step');
    return {
      ms,
      absurdHelixLen: absurdHelix.length, absurdHelixCapped: absurdHelix.join('\n').includes('capped'),
      absurdStepLen: absurdStep.length, absurdStepCapped: absurdStep.join('\n').includes('capped'),
      normalHelixLen: normalHelix.length, normalHelixCapped: normalHelix.join('\n').includes('capped'),
      normalStepLen: normalStep.length, normalStepCapped: normalStep.join('\n').includes('capped'),
    };
  });
  // The two absurd emits return tiny capped placeholders, near-instantly (the hang is gone).
  expect(r.ms, 'both absurd bores emit fast — no synchronous hang').toBeLessThan(2000);
  expect(r.absurdHelixCapped && r.absurdHelixLen < 10, 'absurd helix → capped placeholder').toBe(true);
  expect(r.absurdStepCapped && r.absurdStepLen < 10, 'absurd step → capped placeholder').toBe(true);
  // A real bore is well under the cap → full toolpath, NOT capped (emit unchanged → byte-identical preserved).
  expect(r.normalHelixCapped, 'a real helical bore is NOT capped').toBe(false);
  expect(r.normalHelixLen, 'a real helical bore emits its full helix').toBeGreaterThan(100);
  expect(r.normalStepCapped, 'a real step bore is NOT capped').toBe(false);
});

test('selecting a helical-bore leaf does not freeze the value-glow (it bails on depth, boxes the rest)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsGetBlockProgram);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.__blkws, { timeout: 8000 });
  const r = await page.evaluate(async () => {
    const { newBlock } = await import('/blocks/blockEmitter.js');
    const { valueRangesForSubtree } = await import('/blocks/opGlow.js');
    const bore = newBlock('bore');
    bore.params = { x: 0, y: 0, holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, ramp: 'helix', feed: 100, clearance: 5 };
    window.ddcsLoadBlockStack([newBlock('progstart'), bore, newBlock('progend')]);
    await new Promise((res) => setTimeout(res, 300));
    const prog = window.ddcsGetBlockProgram();
    const find = (bs) => { for (const b of (bs || [])) { if (!b) continue; if (b.type === 'bore') return b; const f = find(b.children); if (f) return f; } return null; };
    const b = find(prog);
    if (!b) return { found: false };
    const t0 = performance.now();
    const spans = valueRangesForSubtree(b.id);   // perturbs depth→sentinel internally; pre-fix this froze the tab
    return { found: true, ms: performance.now() - t0, count: spans.length };
  });
  expect(r.found, 'seeded a helical-bore leaf').toBe(true);
  expect(r.ms, 'the glow returns quickly — no freeze on the depth multiplier').toBeLessThan(3000);
  expect(r.count, 'it still boxes the non-multiplier value tokens (holeDia/toolDia/feed/clearance)').toBeGreaterThan(0);
});
