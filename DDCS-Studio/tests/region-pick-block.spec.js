import { test, expect } from '@playwright/test';

/**
 * Region-pick BLOCK parity (field_regionpick). The region-pick control draws in the Blockly block too — not just the
 * form — making it a genuine dual-adapter pick surface (the 2nd after the datum). The `regionpick` reporter renders
 * its `value` as the inline field_regionpick (shared core, ui/regionPickSvg.js); the SPEC rides the block's `data`
 * (a JSON-string param via stackBridge). Locks: registry + field classification, the extracted region-pick binding,
 * a Class-B render guard (the picker actually draws in the block), and the spec/value round-trip through the stack.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const SPEC = {
  viewBox: '0 0 200 120',
  regions: [
    { shape: 'rect', x: 10, y: 10, w: 80, h: 100, value: 100, label: 'Slow' },
    { shape: 'rect', x: 110, y: 10, w: 80, h: 45, value: 500, label: 'Med' },
    { shape: 'poly', points: '110,65 190,65 190,110 150,110', value: 1500, label: 'Fast' },
  ],
};

test('region-pick block: registered + classified; extracts a binding; draws in the block; round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  // registry + the value field renders as the region-pick control
  const reg = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind } = await import('/blocks/blockly/bridge.js');
    return { has: !!BLOCKS.regionpick, kind: BLOCKS.regionpick && BLOCKS.regionpick.kind, vfield: BLOCKS.regionpick && fieldKind(BLOCKS.regionpick, 'value') };
  });
  expect(reg.has).toBe(true);
  expect(reg.kind).toBe('reporter');
  expect(reg.vfield).toBe('regionpick');

  // extractParamBlocks → a region-pick binding with the parsed spec (the FORM adapter consumes this)
  const binding = await page.evaluate(async (SPEC) => {
    const U = await import('/blocks/userOps.js');
    const stack = [{ type: 'move', params: { x: 0, y: 0, z: -5, feed: { type: 'regionpick', params: { name: 'feed', value: 1500, spec: JSON.stringify(SPEC) } } } }];
    return U.extractParamBlocks(stack)[0];
  }, SPEC);
  expect(binding).toMatchObject({ param: 'feed', key: 'feed', type: 'number', default: 1500, widget: 'region-pick' });
  expect(binding.widgetConfig.regions).toHaveLength(3);

  // Class-B render guard: load a regionpick pill in a socket → the inline picker actually DRAWS in the block
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
  await page.evaluate((SPEC) => window.ddcsLoadBlockStack([
    { type: 'move', params: { x: 0, y: 0, z: -5, feed: { type: 'regionpick', params: { name: 'feed', value: 1500, spec: JSON.stringify(SPEC) } } } },
  ]), SPEC);
  await page.waitForTimeout(400);

  const render = await page.evaluate(() => {
    const p = window.__blkws.getAllBlocks().find((b) => b.type === 'regionpick');
    const svg = p && p.getSvgRoot ? p.getSvgRoot() : null;
    return { found: !!p, h: p ? p.getHeightWidth().height : 0, value: p ? p.getFieldValue('VALUE') : null, regions: svg ? svg.querySelectorAll('[data-ri]').length : 0 };
  });
  expect(render.found, 'regionpick block present in the socket').toBe(true);
  expect(render.h, 'regionpick block actually rendered (height > 0)').toBeGreaterThan(0);
  expect(render.value, 'the picked value loaded').toBe('1500');
  expect(render.regions, 'the spec regions drew in the block field').toBe(3);

  // round-trip: the pill survives the workspace→stack read with its spec + value (spec rode b.data)
  const rt = await page.evaluate(async () => {
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const move = workspaceToStack(window.__blkws).find((b) => b.type === 'move');
    return move && move.params && move.params.feed;
  });
  expect(rt.type).toBe('regionpick');
  expect(String(rt.params.value)).toBe('1500');
  expect(rt.params.name).toBe('feed');
  expect(JSON.parse(rt.params.spec).regions).toHaveLength(3);
});
