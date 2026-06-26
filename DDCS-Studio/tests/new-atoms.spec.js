import { test, expect } from '@playwright/test';

// New universal atoms: Stop (M0/M1), Plane (G17-19), Feed Mode (G94/95), Home (G28), Call (M98), Return (M99).
test('new atoms emit correct G-code and land in the right categories', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { buildToolbox } = await import('/blocks/blockly/bridge.js');
    const e = (t, p) => (BLOCKS[t] ? BLOCKS[t].emit(p || {}, 0, 0, {}) : ['MISSING'])[0];
    const tb = buildToolbox();
    const catOf = (type) => { for (const c of tb.contents) if (c.contents.some((b) => b.type === type)) return c.name; return null; };
    return {
      stop: e('stop', { stop: 'M1' }), plane: e('plane', { plane: 'G18' }), fmode: e('feedmode', { fmode: 'G95' }),
      home: e('home', { axes: 'XYZ' }), call: e('call', { prog: 9083 }), ret: e('return', {}),
      stopCat: catOf('stop'), planeCat: catOf('plane'), homeCat: catOf('home'), callCat: catOf('call'), fmodeCat: catOf('feedmode'),
    };
  });
  expect(r.stop).toContain('M1');
  expect(r.plane).toContain('G18');
  expect(r.fmode).toContain('G95');
  expect(r.home).toBe('G28 X0 Y0 Z0   ( reference return )');
  expect(r.call).toContain('M98 P9083');
  expect(r.ret).toContain('M99');
  expect(r.stopCat).toBe('Control');
  expect(r.planeCat).toBe('Coordinates');
  expect(r.homeCat).toBe('Move');
  expect(r.callCat).toBe('Control');
  expect(r.fmodeCat).toBe('Spindle & Feed');
});
