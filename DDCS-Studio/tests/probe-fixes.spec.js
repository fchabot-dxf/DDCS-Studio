import { test, expect } from '@playwright/test';

// Two probe fixes: the edge wizard now compensates the stylus radius (was setting the WCS to the ball
// CENTRE, off by the radius), and the sim evaluator understands the Fanuc two-operand ATAN[a]/[b] = atan2.

test('edge wizard compensates the stylus radius (WCS lands on the edge, not the ball centre)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { edgeStack } = await import('/wizards/edgeWizard.js');
    const { emitMapped } = await import('/blocks/blockModel.js');
    const pos = emitMapped(edgeStack({ axis: 'X', dir: 'pos', wcs: 'G54', radius: 2 })).text;
    const neg = emitMapped(edgeStack({ axis: 'X', dir: 'neg', wcs: 'G54', radius: 2 })).text;
    const compLine = (t) => t.split('\n').find((l) => /#50\s*=/.test(l) && /#1925/.test(l)) || '';
    return { pos: compLine(pos), neg: compLine(neg), hasRadius: /#6\s*=\s*2/.test(pos) };
  });
  expect(r.hasRadius, 'radius stored in #6').toBe(true);
  expect(r.pos.replace(/\s/g, ''), 'probe +X → edge = trigger + radius').toContain('#50=[#1925+#6]');
  expect(r.neg.replace(/\s/g, ''), 'probe -X → edge = trigger - radius').toContain('#50=[#1925-#6]');
});

test('sim evaluator: ATAN[a]/[b] is atan2 (degrees); ATAN[a]/n stays a division', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { evalExpr } = await import('/engine/core/expression.js');
    const v = new Map([[52, 3], [53, 4]]);
    return {
      atan2: evalExpr('ATAN[#52]/[#53]', v, { unsetValue: 0 }),   // atan2(3,4) = 36.87°
      div: evalExpr('ATAN[1]/2', v, { unsetValue: 0 }),           // atan(1)/2 = 22.5°
      one: evalExpr('ATAN[1]', v, { unsetValue: 0 }),             // 45°
    };
  });
  expect(Math.abs(r.atan2 - 36.87), 'two-operand atan2').toBeLessThan(0.02);
  expect(Math.abs(r.div - 22.5), 'single-arg then divide').toBeLessThan(0.01);
  expect(Math.abs(r.one - 45), 'single-arg atan').toBeLessThan(0.01);
});
