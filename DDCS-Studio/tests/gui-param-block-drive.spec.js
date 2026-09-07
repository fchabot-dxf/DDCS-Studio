import { test, expect } from '@playwright/test';

/**
 * GUI blocks (A) — the `param` reporter, Class-B RENDER GUARD ONLY. The registry/emit/extraction logic split out
 * to tests/node/gui-param-block.test.mjs (t-tier migration); this file keeps the one assertion that needs a real
 * Blockly workspace/DOM — the param pill actually DRAWING in a socket (window.__blkws, getHeightWidth()).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const STACK = (val) => [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', widget: 'slider', value: val } } } }];

test('gui param block: the param pill actually draws in a socket (Class-B render guard)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
  await page.evaluate((s) => window.ddcsLoadBlockStack(s), STACK(5));
  await page.waitForTimeout(300);
  const render = await page.evaluate(() => {
    const p = window.__blkws.getAllBlocks().find((b) => b.type === 'param');
    return { found: !!p, h: p ? p.getHeightWidth().height : 0 };
  });
  expect(render.found, 'param pill present in the z socket').toBe(true);
  expect(render.h, 'param pill actually rendered (height > 0)').toBeGreaterThan(0);
});
