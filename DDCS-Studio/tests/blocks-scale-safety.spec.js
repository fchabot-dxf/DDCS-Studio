import { test, expect } from '@playwright/test';

// ROOT-CAUSE GUARD: the app CSS-zooms <body> (ScaleManager). Blockly breaks inside a zoomed ancestor —
// invisible/mispositioned blocks + a DropDownDiv resize crash, because Blockly mounts popups on <body> and
// lays out via getBoundingClientRect. Fix: counter the zoom on #blocks-app (net 1.0) AND relocate Blockly's
// popups into #blocks-app (setParentContainer). This guards both so the "blank Blocks under app zoom" bug
// can't silently return.
// Big viewport so AUTO scale computes >100% (a real zoom to test against).
test.use({ viewport: { width: 1920, height: 1200 } });

test('Blockly survives app zoom: #blocks-app counter-zoomed + popups relocated, blocks render, no errors', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);   // AUTO applies at startup (~1.43 here)
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));    // the event that used to crash
  await page.waitForTimeout(200);

  const r = await page.evaluate(() => {
    const blk = document.getElementById('blocks-app');
    const parentId = (sel) => { const el = document.querySelector(sel); return el && el.parentElement ? el.parentElement.id : 'ABSENT'; };
    return {
      bodyZoom: parseFloat(document.body.style.zoom) || 1,
      blocksZoom: parseFloat(blk.style.zoom) || 1,
      dropdownParent: parentId('.blocklyDropDownDiv'),
      widgetParent: parentId('.blocklyWidgetDiv'),
      blocks: window.__blkws.getAllBlocks().length,
    };
  });

  expect(r.bodyZoom, 'app zoomed the body above 100%').toBeGreaterThan(1.1);
  expect(r.bodyZoom * r.blocksZoom, 'blocks tab counter-zoomed → net 1.0').toBeCloseTo(1, 1);   // body × counter = 1
  expect(r.dropdownParent, 'DropDownDiv relocated off <body>').toBe('blocks-app');
  expect(r.widgetParent, 'WidgetDiv relocated off <body>').toBe('blocks-app');
  expect(r.blocks, 'op rendered as blocks').toBeGreaterThan(0);
  expect(errs, 'no page errors (the DropDownDiv resize crash is gone)').toEqual([]);
});
