import { test, expect } from '@playwright/test';

/**
 * Coordinate-list BLOCK adapter (field_coordlist) — the positions positioner drawn in the Blocks view (the block
 * twin of the form's coord-list widget). A `coordlist` markup block holds the list as its `pts` field VALUE (a JSON
 * string of { points:[{x,y}], z }, serializable → round-trips) and renders a compact marker PREVIEW inline (rich
 * editing stays in the form / ✎ editor — FeatureCanvas can't live in a Blockly field). Locks: registry + field
 * classification, emits nothing, the preview draws in the block (Class-B), and the list round-trips through the stack.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const STATE = { points: [{ x: 10, y: 10 }, { x: 50, y: 30 }, { x: 30, y: 60 }], z: -5 };

test('coordlist block: registered, emits nothing, positions preview draws + round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  const reg = await page.evaluate(async (STATE) => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind } = await import('/blocks/blockly/bridge.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const emitted = emitMapped([{ type: 'coordlist', params: { pts: JSON.stringify(STATE) } }, { type: 'move', params: { x: 1, y: 2, z: -5 } }]).text;
    return { has: !!BLOCKS.coordlist, field: BLOCKS.coordlist && fieldKind(BLOCKS.coordlist, 'pts'), emitted };
  }, STATE);
  expect(reg.has).toBe(true);
  expect(reg.field).toBe('coordlist');
  expect(reg.emitted.toLowerCase(), 'coordlist emits no G-code').not.toContain('position');
  expect(reg.emitted, 'the move still emitted').toContain('X1 Y2');

  // Class-B render guard: the positions preview actually draws in the block
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
  await page.evaluate((STATE) => window.ddcsLoadBlockStack([{ type: 'coordlist', params: { pts: JSON.stringify(STATE) } }]), STATE);
  await page.waitForTimeout(400);

  const render = await page.evaluate(() => {
    const b = window.__blkws.getAllBlocks().find((x) => x.type === 'coordlist');
    const svg = b && b.getSvgRoot ? b.getSvgRoot() : null;
    let n = 0; try { n = JSON.parse(b.getFieldValue('PTS')).points.length; } catch (_) { /* */ }
    return { found: !!b, h: b ? b.getHeightWidth().height : 0, markers: svg ? svg.querySelectorAll('[data-pi]').length : 0, count: n };
  });
  expect(render.found, 'coordlist block present').toBe(true);
  expect(render.h, 'coordlist block rendered (height > 0)').toBeGreaterThan(0);
  expect(render.markers, 'the 3 position markers drew in the block').toBe(3);
  expect(render.count).toBe(3);

  // round-trip: the list survives workspace→stack (it's the field value, a JSON string)
  const rt = await page.evaluate(async () => {
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const b = workspaceToStack(window.__blkws).find((x) => x.type === 'coordlist');
    return b && b.params && b.params.pts;
  });
  const s = JSON.parse(rt);
  expect(s.points).toHaveLength(3);
  expect(s.z).toBe(-5);
});
