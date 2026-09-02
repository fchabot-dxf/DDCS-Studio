import { test, expect } from '@playwright/test';

/**
 * GUI blocks — the `feature_canvas` block (t2515 — renamed from `panel`; the field it sets, `def.panel`, is
 * unchanged — see BACKLOG #72's own authorability sweep, which named the old `panel` string a three-way
 * collision: block type, this same type used as the render-side layout-node type, and the unrelated `panel`
 * FIELD on it). Declares a custom wizard's panel layout in the stack (form/form3d/form2d). It's metadata: emits
 * no G-code, read at save time → def.panel. Locks: registry + dropdown, emits nothing, and the Class-B render
 * guard (it actually draws as a statement block).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('gui feature_canvas block: registered, dropdown, emits nothing, renders', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind } = await import('/blocks/blockly/bridge.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const emitted = emitMapped([{ type: 'feature_canvas', params: { panel: 'form2d' } }, { type: 'move', params: { x: 1, y: 2, z: -5 } }]).text;
    return { has: !!BLOCKS.feature_canvas, dd: BLOCKS.feature_canvas && fieldKind(BLOCKS.feature_canvas, 'panel'), emitted };
  });
  expect(r.has).toBe(true);
  expect(r.dd).toBe('dropdown');
  expect(r.emitted.toLowerCase(), 'feature_canvas block emits no G-code').not.toContain('panel');
  expect(r.emitted.length, 'the move still emitted').toBeGreaterThan(0);

  // Class-B render guard: the feature_canvas block actually draws
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'feature_canvas', params: { panel: 'form2d' } }, { type: 'move', params: { x: 0, y: 0, z: -5 } }]));
  await page.waitForTimeout(300);
  const render = await page.evaluate(() => { const b = window.__blkws.getAllBlocks().find((x) => x.type === 'feature_canvas'); return { found: !!b, h: b ? b.getHeightWidth().height : 0 }; });
  expect(render.found, 'feature_canvas block present').toBe(true);
  expect(render.h, 'feature_canvas block rendered (height > 0)').toBeGreaterThan(0);
});
