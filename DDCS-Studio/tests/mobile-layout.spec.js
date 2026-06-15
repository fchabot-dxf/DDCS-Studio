import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 800 } });

test('mobile: header controls on-screen, zoom to 50%, wizard preview controls fit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.scaleManager);

  // header: the zoom button must be fully on-screen (not clipped by the wide post dropdown)
  const hdr = await page.evaluate(() => {
    const b = document.getElementById('scaleBtn').getBoundingClientRect();
    const p = document.querySelector('.hdr-post').getBoundingClientRect();
    return { zoomRight: b.right, postW: p.width, vw: window.innerWidth };
  });
  expect(hdr.zoomRight, `zoom button right (${hdr.zoomRight}) within viewport`).toBeLessThanOrEqual(hdr.vw + 1);
  expect(hdr.postW, 'post dropdown narrowed on mobile').toBeLessThanOrEqual(130);

  // zoom: slider goes down to 50%
  await page.click('#scaleBtn');
  const min = await page.getAttribute('#scaleSlider', 'min');
  expect(min).toBe('50');
  await page.evaluate(() => window.scaleManager.applyScale(50));
  expect(await page.evaluate(() => Math.round(parseFloat(document.body.style.zoom) * 100))).toBe(50);
  await page.evaluate(() => window.scaleManager.applyScale('auto'));   // restore

  // wizard preview controls fit within the pane (no horizontal overflow)
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(300);
  const ctl = await page.evaluate(() => {
    const c = document.querySelector('.wiz-viz3d .viz3d-controls') || document.querySelector('.viz3d-controls');
    if (!c) return null;
    const r = c.getBoundingClientRect(), pane = c.parentElement.getBoundingClientRect();
    return { ctlRight: r.right, ctlLeft: r.left, paneLeft: pane.left, paneRight: pane.right };
  });
  expect(ctl, 'preview controls present').not.toBeNull();
  expect(ctl.ctlLeft).toBeGreaterThanOrEqual(ctl.paneLeft - 1);
  expect(ctl.ctlRight).toBeLessThanOrEqual(ctl.paneRight + 1);
  await page.screenshot({ path: 'tests/_mobile-layout.png' });
});
