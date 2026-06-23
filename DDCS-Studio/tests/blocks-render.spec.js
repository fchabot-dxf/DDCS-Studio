import { test, expect } from '@playwright/test';

// Regression for "the G-code is there but I can't see the blocks": in Blockly v11 the old
// newBlock()+initSvg()+render() path made valid block MODELS that never rendered. We now load via
// serialization.workspaces.load, which drives the render queue. Assert the blocks have real SVG bounds.
test.use({ viewport: { width: 1400, height: 1000 } });

test('loaded op blocks are actually RENDERED (have SVG bounding boxes), not just modelled', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());

  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(400);   // render queue + RAF zoomToFit

  const r = await page.evaluate(() => {
    const ws = window.__blkws;
    const tops = ws.getTopBlocks(true);
    // a rendered block reports a non-zero height; an unrendered model reports 0
    const sized = tops.filter((b) => { try { return b.getHeightWidth().height > 0; } catch { return false; } });
    return {
      total: ws.getAllBlocks().length,
      tops: tops.length,
      sized: sized.length,
      svgRects: ws.getCanvas().querySelectorAll('.blocklyDraggable').length,
    };
  });

  expect(r.total, 'op produced blocks').toBeGreaterThan(0);
  expect(r.sized, 'top blocks have non-zero rendered height').toBeGreaterThan(0);
  expect(r.svgRects, 'draggable block SVG groups exist in the canvas').toBeGreaterThan(0);

  await page.screenshot({ path: 'tests/_blocks-render.png' });
});
