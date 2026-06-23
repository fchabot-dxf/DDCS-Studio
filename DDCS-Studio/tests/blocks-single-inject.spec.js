import { test, expect } from '@playwright/test';

// ROOT-CAUSE GUARD: the header tabs are double-wired (inline onclick in index.html + addEventListener in
// gatewayStatus.js), so ONE Blocks-tab click fires showApp('blocks') TWICE. Because `api` is only set at the
// end of initBlocks, both calls used to sail past the guard while awaiting loadBlockly() and inject TWO Blockly
// workspaces into #blk-ws — the 2nd stacked below the 1st (offset ≈ host height), with the loaded stack landing
// in the off-screen one, so the visible (first) workspace was empty ("nothing renders"). initBusy latches it.
test.use({ viewport: { width: 1366, height: 1100 } });

test('two concurrent showApp(blocks) inject exactly ONE workspace, op in view', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.text().includes('[BLK]')) console.log(m.text()); });

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());

  // Fire the double-click race: two synchronous showApp('blocks') before api is ever set.
  await page.evaluate(() => { window.showApp('blocks'); window.showApp('blocks'); });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0, { timeout: 8000 });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const host = document.getElementById('blk-ws');
    const ws = window.__blkws, b = ws.getTopBlocks(false)[0];
    const br = b.getSvgRoot().getBoundingClientRect(), hr = host.getBoundingClientRect();
    return {
      svgCount: host.querySelectorAll('svg.blocklySvg').length,
      injectionDivs: host.querySelectorAll('.injectionDiv').length,
      inView: br.x < hr.x + hr.width && br.x + br.width > hr.x && br.y < hr.y + hr.height && br.y + br.height > hr.y,
    };
  });

  expect(r.svgCount, 'exactly one Blockly workspace SVG (no double-inject)').toBe(1);
  expect(r.injectionDivs, 'exactly one injection div').toBe(1);
  expect(r.inView, 'loaded op renders inside the visible host').toBe(true);
  expect(errs, 'no page errors (DropDownDiv resize crash gone)').toEqual([]);
});
