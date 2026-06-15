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
    const p = [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.viz3d-controls'));
    if (!p) return null;
    const c = p.querySelector('.viz3d-controls'), j = p.querySelector('.viz3d-jog-pendant');
    const cr = c.getBoundingClientRect(), pr = p.getBoundingClientRect();
    const jr = (j && getComputedStyle(j).display !== 'none') ? j.getBoundingClientRect() : null;
    return { ctlLeft: cr.left, ctlRight: cr.right, ctlBottom: cr.bottom, paneLeft: pr.left, paneRight: pr.right, jogTop: jr ? jr.top : null };
  });
  expect(ctl, 'preview controls present').not.toBeNull();
  expect(ctl.ctlLeft).toBeGreaterThanOrEqual(ctl.paneLeft - 1);
  expect(ctl.ctlRight).toBeLessThanOrEqual(ctl.paneRight + 1);
  if (ctl.jogTop !== null) expect(ctl.ctlBottom, 'sim controls sit ABOVE the jog bar (not overlapping)').toBeLessThanOrEqual(ctl.jogTop + 1);
  await page.screenshot({ path: 'tests/_mobile-layout.png' });
});
