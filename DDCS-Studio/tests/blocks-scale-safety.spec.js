import { test, expect } from '@playwright/test';

// ROOT-CAUSE GUARD: the app CSS-zooms <body> (ScaleManager). Blockly breaks inside ANY CSS-scaled ancestor —
// its getBoundingClientRect viewport metrics go wrong, so zoomToFit mis-scales and parks the blocks far
// off-screen (we measured screenRect.y≈1604 at scale 1.87). A counter-zoom on #blocks-app made it worse
// (nested zoom). The fix: the Blocks tab forces body→zoom 1, a true 1.0 context; blocks scale via Blockly's
// own zoom. This guards that contract AND that the loaded op lands IN VIEW.
test.use({ viewport: { width: 1280, height: 900 } });

test('Blocks tab forces body-zoom 1 and the op renders IN VIEW (not parked off-screen)', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.scaleManager.applyScale(150));   // app scaled to 150% on the Studio side
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0);
  await page.waitForTimeout(400);   // frame retries settle

  const r = await page.evaluate(() => {
    const ws = window.__blkws, b = ws.getTopBlocks(false)[0];
    const br = b.getSvgRoot().getBoundingClientRect();
    const host = document.getElementById('blk-ws').getBoundingClientRect();
    return {
      bodyZoom: document.body.style.zoom,
      blocksAppZoom: document.getElementById('blocks-app').style.zoom,
      rendered: ws.getCanvas().querySelectorAll('.blocklyDraggable').length,
      block: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) },
      host: { x: Math.round(host.x), y: Math.round(host.y), w: Math.round(host.width), h: Math.round(host.height) },
    };
  });

  expect(r.bodyZoom, 'Blocks tab forces body zoom to 1 (Blockly cannot live under CSS zoom)').toBe('1');
  expect(r.blocksAppZoom, 'no counter-zoom on the blocks tab').toBe('');
  expect(r.rendered, 'blocks rendered').toBeGreaterThan(0);
  // The bug was the op parked off-screen (y≈1604). Assert the block overlaps the visible host box.
  const o = r.block, h = r.host;
  const inView = o.x < h.x + h.w && o.x + o.w > h.x && o.y < h.y + h.h && o.y + o.h > h.y;
  expect(inView, `block must be within the visible host (block=${JSON.stringify(o)} host=${JSON.stringify(h)})`).toBe(true);
  expect(errs, 'no page errors').toEqual([]);
});
