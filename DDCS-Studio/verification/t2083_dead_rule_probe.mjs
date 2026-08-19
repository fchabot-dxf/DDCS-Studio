import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'studio'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

const info = await page.evaluate(() => {
  const dock = document.getElementById('controller-dock');
  const handle = document.querySelector('#controller-dock .header-handle');
  const chevron = document.querySelector('#controller-dock .chevron');
  const dockHeader = document.querySelector('#controller-dock .dock-header');
  const s = (el) => el ? {
    background: getComputedStyle(el).backgroundImage !== 'none' ? getComputedStyle(el).backgroundImage : getComputedStyle(el).backgroundColor,
    borderTop: getComputedStyle(el).borderTop,
    borderBottom: getComputedStyle(el).borderBottom,
    borderLeft: getComputedStyle(el).borderLeft,
    borderRight: getComputedStyle(el).borderRight,
    color: getComputedStyle(el).color,
  } : 'MISSING';
  return { dock: s(dock), handle: s(handle), chevron: s(chevron), dockHeader: s(dockHeader) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
