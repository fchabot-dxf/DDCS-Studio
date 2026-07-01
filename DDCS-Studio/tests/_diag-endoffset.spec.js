import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 1000, height: 800 } });
test('DIAG: RENDERED end position (e.pos + starts[finalPass]) vs the scene centre', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const w = new MiddleWizard();
    const stock = { x: 60, y: 60, z: 60, shape: 'boss', show: true };
    const pstock = { x: 100, y: 80, z: 20, shape: 'pocket', show: true };

    const run = (p, st) => {
      const code = w.generate(p);
      const starts = opSimStarts('middle', p, st);
      const e = new GcodeExecutionEngine({ autoAnswer: true, stock: st, stockOffset: w.inferStart(p, st) });
      e._passStarts = starts;
      const t = e.trace(code);
      const finalPass = Math.min(starts.length - 1, (t.stats.passes || 1) - 1);
      const anch = starts[finalPass] || starts[0] || { x: 0, y: 0 };
      const rx = +(e.pos.x + anch.x).toFixed(2), ry = +(e.pos.y + anch.y).toFixed(2);   // RENDERED final tool pos
      const cx = st.x / 2, cy = st.y / 2;
      return { rendered: { x: rx, y: ry }, centre: { x: cx, y: cy }, dx: +(rx - cx).toFixed(2), dy: +(ry - cy).toFixed(2),
               finalPass, passes: t.stats.passes, c53: +(e.vars.get(53) || 0).toFixed(1), c56: +(e.vars.get(56) || 0).toFixed(1) };
    };
    const base = { featureType: 'boss', axis: 'X', dir1: 'pos', dir2: 'neg', dist: 80, retract: 2, safeZ: 10, clearOver: 40, wcs: 'active' };
    return {
      bothAuto: run({ ...base, twoAxis: true, findBoth: true, inAxis: 'auto', transAxis: 'auto' }, stock),
      bothManualIn: run({ ...base, twoAxis: true, findBoth: true, inAxis: 'manual', transAxis: 'auto' }, stock),
      bothYfirst: run({ ...base, axis: 'Y', dir1: 'pos', dir2: 'neg', twoAxis: true, findBoth: true, inAxis: 'auto', transAxis: 'auto' }, stock),
      single: run({ ...base, inAxis: 'auto', transAxis: 'auto' }, stock),
      pocketBoth: run({ ...base, featureType: 'pocket', twoAxis: true, findBoth: true }, pstock),
    };
  });
  for (const [k, v] of Object.entries(r)) {
    console.log(`${k}: RENDERED=(${v.rendered.x},${v.rendered.y}) centre=(${v.centre.x},${v.centre.y}) Δ=(${v.dx},${v.dy}) finalPass=${v.finalPass}/${v.passes}`);
  }
  expect(true).toBe(true);
});
