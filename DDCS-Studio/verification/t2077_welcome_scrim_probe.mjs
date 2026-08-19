import { chromium } from '@playwright/test';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) {} }, theme);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd, undefined, { timeout: 20000 });
  await page.evaluate(() => {
    window.pywebview = {};
    localStorage.setItem('ddcs_seen_version', '0.0.1');
    window.__ddcsUpd.RELEASE_NOTES[window.__ddcsUpd.bakedVersion()] = [{ short: 'A', full: 'test' }];
  });
  await page.evaluate(() => window.__ddcsUpd.checkWelcomeNotice());
  await page.waitForSelector('.ddcs-welcome-modal');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.ddcs-welcome-modal')).backgroundColor);
  out[theme] = bg;
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
