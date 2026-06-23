import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 800 } });

test('mobile: header controls on-screen, no h-scroll, wizard preview controls fit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  // header: every visible header control stays on-screen on mobile (the auto-fit collapses labels/version
  // and the post-processor moved into the chevron quick-menu, so nothing overflows the viewport edge).
  const hdr = await page.evaluate(() => {
    const header = document.querySelector('.app-header');
    const vis = (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    const overflows = [...header.children].filter(vis)
      .map((c) => ({ cls: c.className, right: c.getBoundingClientRect().right }))
      .filter((c) => c.right > window.innerWidth + 1);
    return { innerW: window.innerWidth, headerRight: header.getBoundingClientRect().right, overflows };
  });
  expect(hdr.headerRight, 'header within the viewport').toBeLessThanOrEqual(hdr.innerW + 1);
  expect(hdr.overflows, 'no header control overflows the viewport edge').toEqual([]);

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
