import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'studio'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
await page.locator('#controller-dock .header-handle').click();
await page.waitForTimeout(400);
const varsTab = page.locator('.dock-body .deck-tab[data-deck-tab="variables"]');
if (await varsTab.count()) { await varsTab.click(); await page.waitForTimeout(400); }
const info = await page.evaluate(() => {
  const el = document.querySelector('.var-item');
  if (!el) return { found: false };
  const s = getComputedStyle(el);
  return {
    found: true,
    background: s.backgroundImage !== 'none' ? s.backgroundImage : s.backgroundColor,
    borderRadius: s.borderRadius,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
