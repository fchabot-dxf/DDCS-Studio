import { test, expect } from '@playwright/test';

/**
 * Regression: the fill row generator (scanlineFill) must BOUND its row count, and selecting a filltext leaf must not
 * FREEZE the value-glow. fillText is a childless `fill` block whose height/strokeWidth multiply the toolpath; the
 * select/hover glow perturbs each numeric param to its ~1e6 sentinel → scanlineFill would scan ~1.3M rows synchronously
 * (a 5–8.5s tab freeze) BEFORE the eventual caught throw — so a runaway-row guard in scanlineFill is the load-bearing fix
 * (opGlow's try/catch can't interrupt a synchronous loop). Real fills are far under the cap → byte-identical.
 */

test('scanlineFill caps a runaway row count (no freeze) but leaves real fills untouched', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { scanlineFill } = await import('/wizards/clearing.js');
    const rect = (h) => [[{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: h }, { x: 0, y: h }]];   // a 40×h box
    const t0 = performance.now();
    const absurd = scanlineFill(rect(987654.321), 0.75);   // ~1.3M rows at the glow sentinel — pre-fix this froze
    const ms = performance.now() - t0;
    const normal = scanlineFill(rect(40), 0.75);            // a real fill (~53 rows)
    return { ms, absurdRows: absurd.length, normalRows: normal.length };
  });
  expect(r.ms, 'the absurd fill returns fast — no synchronous freeze').toBeLessThan(1500);
  expect(r.absurdRows, 'an absurd row count is capped to empty (no toolpath)').toBe(0);
  expect(r.normalRows, 'a real fill is untouched — full rows').toBeGreaterThan(20);
});

test('selecting a filltext leaf does not freeze the value-glow (it bails on height, boxes the rest)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsGetBlockProgram);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.__blkws, { timeout: 8000 });
  const r = await page.evaluate(async () => {
    const { newBlock } = await import('/blocks/blockEmitter.js');
    const { valueRangesForSubtree } = await import('/blocks/opGlow.js');
    const ft = newBlock('filltext');
    ft.params = { text: 'ABC', font: 'single-stroke', height: 12, spacing: 1.2, align: 'left', x: 0, y: 0, strokeWidth: 2.5, toolDia: 1.5, stepoverPct: 50, z: 'z', feed: 400, plunge: 120, clearance: 4 };
    window.ddcsLoadBlockStack([newBlock('progstart'), ft, newBlock('progend')]);
    await new Promise((res) => setTimeout(res, 300));
    const prog = window.ddcsGetBlockProgram();
    const find = (bs) => { for (const b of (bs || [])) { if (!b) continue; if (b.type === 'filltext') return b; const f = find(b.children); if (f) return f; } return null; };
    const b = find(prog);
    if (!b) return { found: false };
    const t0 = performance.now();
    const spans = valueRangesForSubtree(b.id);   // perturbs height→sentinel internally; pre-fix this froze the tab
    return { found: true, ms: performance.now() - t0, count: spans.length };
  });
  expect(r.found, 'seeded a filltext leaf').toBe(true);
  expect(r.ms, 'the glow returns quickly — no freeze on the height/strokeWidth multipliers').toBeLessThan(3000);
  expect(r.count, 'it still boxes the non-multiplier value tokens').toBeGreaterThan(0);
});
