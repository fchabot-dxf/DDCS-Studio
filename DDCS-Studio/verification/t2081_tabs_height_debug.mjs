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
  const cs = getComputedStyle(tabs);
  const varsTab = document.querySelector('.dock-body .deck-tab[data-deck-tab="variables"]');
  const csv = getComputedStyle(varsTab);
  return {
    tabsComputed: { height: cs.height, maxHeight: cs.maxHeight, overflowY: cs.overflowY, overflowX: cs.overflowX, display: cs.display, alignItems: cs.alignItems, marginBottom: cs.marginBottom },
    tabsOwnBoundingHeight: tabs.getBoundingClientRect().height,
    varsTabComputed: { height: csv.height, padding: csv.padding, boxSizing: csv.boxSizing },
    varsTabBoundingHeight: varsTab.getBoundingClientRect().height,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
