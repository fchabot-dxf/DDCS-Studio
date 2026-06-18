import { test, expect } from '@playwright/test';

test('phone (390): header fits, controls behind ☰, menu reveals post-select', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);

  const s1 = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    return {
      isBurger: h.classList.contains('is-burger'),
      overflow: h.scrollWidth - h.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      burgerShown: getComputedStyle(document.getElementById('hdrBurger')).display !== 'none',
      macroInMenu: document.getElementById('macroBar').parentElement.id === 'hdrMenu',
      ctrlInMenu: document.querySelector('.hdr-controls').parentElement.id === 'hdrMenu',
      menuOpen: document.getElementById('hdrMenu').classList.contains('open'),
      postVisible: document.getElementById('hdrPost').getBoundingClientRect().width > 0 && document.getElementById('hdrPost').offsetParent !== null,
    };
  });
  expect(s1.isBurger, 'is-burger at 390').toBe(true);
  expect(s1.overflow, 'header no longer overflows').toBeLessThanOrEqual(0);
  expect(s1.docScrollW, 'no horizontal page scroll').toBeLessThanOrEqual(s1.vw + 1);
  expect(s1.burgerShown, '☰ visible').toBe(true);
  expect(s1.macroInMenu, 'project bar reparented into #hdrMenu').toBe(true);
  expect(s1.ctrlInMenu, 'post/transfer reparented into #hdrMenu').toBe(true);
  expect(s1.menuOpen, 'menu closed initially').toBe(false);
  expect(s1.postVisible, 'post-select hidden while menu closed').toBe(false);
  await page.screenshot({ path: 'tests/_header-390-closed.png', clip: { x: 0, y: 0, width: 390, height: 60 } });

  await page.click('#hdrBurger');
  const s2 = await page.evaluate(() => ({
    menuOpen: document.getElementById('hdrMenu').classList.contains('open'),
    postVisible: document.getElementById('hdrPost').offsetParent !== null,
  }));
  expect(s2.menuOpen, 'menu opens on ☰ click').toBe(true);
  expect(s2.postVisible, 'post-select visible in open menu').toBe(true);
  await page.screenshot({ path: 'tests/_header-390-open.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
});

test('desktop (1100): no burger, controls inline in home positions', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    return {
      isBurger: h.classList.contains('is-burger'),
      burgerHidden: getComputedStyle(document.getElementById('hdrBurger')).display === 'none',
      macroHome: document.getElementById('macroBar').parentElement.id !== 'hdrMenu',
      ctrlHome: document.querySelector('.hdr-controls').parentElement.id !== 'hdrMenu',
      overflow: h.scrollWidth - h.clientWidth,
    };
  });
  expect(d.isBurger, 'no burger on desktop').toBe(false);
  expect(d.burgerHidden, '☰ hidden on desktop').toBe(true);
  expect(d.macroHome, 'project bar back in home position').toBe(true);
  expect(d.ctrlHome, 'post controls back in home position').toBe(true);
  expect(d.overflow, 'no header overflow on desktop').toBeLessThanOrEqual(0);
});
