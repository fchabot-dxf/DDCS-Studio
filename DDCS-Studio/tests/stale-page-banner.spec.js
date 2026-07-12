import { test, expect } from '@playwright/test';

/**
 * DEV STALE-PAGE BANNER (t578) — a dev pitfall is the browser serving a CACHED page while the bumped build moved on (several
 * homing "bugs" this session were a stale page). On boot (localhost dev only) the app re-fetches the build stamp
 * (version.json, cache no-store) and, if it's NEWER than the loaded page's baked .ver chip, shows a persistent RED
 * 'stale page — reload' banner. Verified by forcing a stamp mismatch (a newer mocked version.json) + the no-false-positive
 * equal case. Runs on localhost:3211 = the dev server (isDevServer() true).
 */
test('stale-page banner FIRES when the served build stamp is NEWER than the loaded chip', async ({ page }) => {
  await page.route('**/version.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: '9999.9' }) }));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  const res = await page.evaluate(async () => {
    document.querySelectorAll('.ddcs-stale-bar').forEach((b) => b.remove());
    const shown = await window.__ddcsUpd.checkStalePage();
    const bar = document.querySelector('.ddcs-stale-bar');
    return { shown, text: bar ? bar.textContent : null, hasReload: !!(bar && bar.querySelector('.stale-reload')), isDev: window.__ddcsUpd.isDevServer() };
  });
  expect(res.isDev, 'localhost:3211 is the dev server').toBe(true);
  expect(res.shown, 'checkStalePage returned true (banner shown)').toBe(true);
  expect(res.text, 'the banner names the stale state + the server version').toContain('stale page');
  expect(res.text, 'and shows the newer server stamp').toContain('9999.9');
  expect(res.hasReload, 'the banner has a Reload button').toBe(true);
});

test('stale-page banner does NOT fire when the served stamp EQUALS the loaded chip (no false positive)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  const baked = await page.evaluate(() => window.__ddcsUpd.bakedVersion());
  await page.route('**/version.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: baked }) }));
  const res = await page.evaluate(async () => {
    document.querySelectorAll('.ddcs-stale-bar').forEach((b) => b.remove());
    const shown = await window.__ddcsUpd.checkStalePage();
    return { shown, bar: !!document.querySelector('.ddcs-stale-bar') };
  });
  expect(res.shown, 'equal stamp → not stale').toBe(false);
  expect(res.bar, 'no banner on a fresh (equal) boot').toBe(false);
});
