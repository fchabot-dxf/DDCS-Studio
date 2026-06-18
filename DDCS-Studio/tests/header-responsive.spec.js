import { test, expect } from '@playwright/test';

test('phone (390): header fits, Open/Save stay, post-selector hidden (it lives in Settings)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);

  const s = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    const macro = document.getElementById('macroBar');
    return {
      overflow: h.scrollWidth - h.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      postHidden: document.getElementById('hdrPost').offsetParent === null,
      macroVisible: macro.offsetParent !== null && macro.closest('.app-header') !== null,
      noBurger: document.getElementById('hdrBurger') === null,
    };
  });
  expect(s.overflow, 'header fits without the post selector').toBeLessThanOrEqual(0);
  expect(s.docScrollW, 'no horizontal page scroll').toBeLessThanOrEqual(s.vw + 1);
  expect(s.postHidden, 'post selector hidden on phone (set in Settings)').toBe(true);
  expect(s.macroVisible, 'Open/Save stay visible in the header').toBe(true);
  expect(s.noBurger, 'no ☰ burger').toBe(true);
  await page.screenshot({ path: 'tests/_header-390.png', clip: { x: 0, y: 0, width: 390, height: 60 } });
});

test('desktop (1100): post selector + Open/Save both visible inline', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    return {
      postVisible: document.getElementById('hdrPost').offsetParent !== null,
      macroVisible: document.getElementById('macroBar').offsetParent !== null,
      overflow: h.scrollWidth - h.clientWidth,
    };
  });
  expect(d.postVisible, 'post selector visible on desktop').toBe(true);
  expect(d.macroVisible, 'Open/Save visible on desktop').toBe(true);
  expect(d.overflow, 'no header overflow on desktop').toBeLessThanOrEqual(0);
});
