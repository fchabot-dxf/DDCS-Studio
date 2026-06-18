import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 800 } });

test('mobile: header controls on-screen, no h-scroll, wizard preview controls fit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  // header: the post dropdown is narrowed on mobile so the header controls stay on-screen
  const hdr = await page.evaluate(() => {
    const p = document.querySelector('.hdr-post').getBoundingClientRect();
    return { postW: p.width };
  });
  expect(hdr.postW, 'post dropdown narrowed on mobile').toBeLessThanOrEqual(130);

  // page must never scroll horizontally
  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no horizontal page overflow').toBeLessThanOrEqual(391);

  // wizard preview controls fit within the pane (no horizontal overflow)
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(300);
  const ctl = await page.evaluate(() => {
    const p = [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.viz3d-controls'));
    if (!p) return null;
    const cr = p.querySelector('.viz3d-controls').getBoundingClientRect(), pr = p.getBoundingClientRect();
    return { ctlLeft: cr.left, ctlRight: cr.right, paneLeft: pr.left, paneRight: pr.right };
  });
  expect(ctl, 'preview controls present').not.toBeNull();
  expect(ctl.ctlLeft).toBeGreaterThanOrEqual(ctl.paneLeft - 1);
  expect(ctl.ctlRight, 'single controls bar fits within the pane').toBeLessThanOrEqual(ctl.paneRight + 1);
  await page.screenshot({ path: 'tests/_mobile-layout.png' });
});
