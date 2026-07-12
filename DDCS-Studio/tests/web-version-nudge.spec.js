import { test, expect } from '@playwright/test';

// WEB version-nudge: the hosted app polls the DECLARED version.json and toasts a reload nudge when a newer version is
// live (the exe has the GitHub banner; the web had nothing → a stale cached bundle went unnoticed). Mocked fetch.
// The exe is harmless: its relative fetch hits the bundled copy (== baked) → the "equal" case below (no toast).

test('web version-nudge: toasts a reload nudge when a NEWER version is live', async ({ page }) => {
  await page.route('**/version.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: '9999.9' }) }));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  const text = await page.evaluate(async () => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    window.__ddcsUpd._resetNudgeThrottle();
    await window.__ddcsUpd.checkWebVersion();
    const t = document.querySelector('.toast');
    return t ? t.textContent : null;
  });
  expect(text, 'the nudge names the live version').toContain('9999.9');
  expect(text, 'and prompts a reload').toContain('reload');
});

test('web version-nudge: NO toast when the live version EQUALS the baked chip (the exe-harmless path)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  const baked = await page.evaluate(() => window.__ddcsUpd.bakedVersion());   // the chip, e.g. "10.67"
  await page.route('**/version.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: baked }) }));
  const text = await page.evaluate(async () => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    window.__ddcsUpd._resetNudgeThrottle();
    await window.__ddcsUpd.checkWebVersion();
    const t = document.querySelector('.toast');
    return t ? t.textContent : null;
  });
  expect(text, 'live == baked → no nudge (this is exactly the exe local-copy case)').toBeNull();
});

test('web version-nudge: throttled — two rapid checks fetch only ONCE', async ({ page }) => {
  let hits = 0;
  await page.route('**/version.json', (r) => { hits += 1; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: '10.67' }) }); });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.waitForTimeout(150);   // let the on-load check settle
  const before = hits;
  await page.evaluate(async () => {
    window.__ddcsUpd._resetNudgeThrottle();
    await window.__ddcsUpd.checkWebVersion();   // proceeds → 1 fetch
    await window.__ddcsUpd.checkWebVersion();   // within the window → throttled, no fetch
  });
  expect(hits - before, 'two rapid checks → exactly one fetch (throttle respected)').toBe(1);
});
