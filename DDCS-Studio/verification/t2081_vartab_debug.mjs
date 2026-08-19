import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true, isMobile: true });
await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, 'normal');
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
await page.locator('#controller-dock .header-handle').click();
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const tabs = document.querySelector('.dock-body .deck-tabs');
  const varsTab = document.querySelector('.dock-body .deck-tab[data-deck-tab="variables"]');
  const tabsRect = tabs.getBoundingClientRect();
  const varsRect = varsTab.getBoundingClientRect();
  const dockBodyRect = document.querySelector('.dock-body').getBoundingClientRect();
  const cs = getComputedStyle(tabs);
  return {
    tabsRect: { top: Math.round(tabsRect.top), left: Math.round(tabsRect.left), right: Math.round(tabsRect.right), bottom: Math.round(tabsRect.bottom) },
    varsRect: { top: Math.round(varsRect.top), left: Math.round(varsRect.left), right: Math.round(varsRect.right), bottom: Math.round(varsRect.bottom) },
    dockBodyRect: { top: Math.round(dockBodyRect.top), left: Math.round(dockBodyRect.left), right: Math.round(dockBodyRect.right), bottom: Math.round(dockBodyRect.bottom) },
    tabsOverflowX: cs.overflowX, tabsScrollWidth: tabs.scrollWidth, tabsClientWidth: tabs.clientWidth,
    elementAtVarsCenter: (() => {
      const cx = varsRect.left + varsRect.width / 2, cy = varsRect.top + varsRect.height / 2;
      const el = document.elementFromPoint(cx, cy);
      return el ? (el.id ? `#${el.id}` : el.className.toString()) : null;
    })(),
  };
});
console.log(JSON.stringify(info, null, 2));

// try scrolling the tabs strip programmatically and re-check
await page.evaluate(() => {
  const tabs = document.querySelector('.dock-body .deck-tabs');
  tabs.scrollLeft = tabs.scrollWidth;
});
await page.waitForTimeout(200);
const after = await page.evaluate(() => {
  const varsTab = document.querySelector('.dock-body .deck-tab[data-deck-tab="variables"]');
  const r = varsTab.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const el = document.elementFromPoint(cx, cy);
  return {
    rect: { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom) },
    elementAtCenter: el ? (el.id ? `#${el.id}` : el.className.toString()) : null,
    isTheVarsTab: el === varsTab,
  };
});
console.log('after programmatic scroll:', JSON.stringify(after, null, 2));
await browser.close();
