import { test, expect } from '@playwright/test';

test('web analytics fires visit + feature beacons with the right payload', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ddcsForceTrack = true;   // opt this beacon-payload test back in past the automated-browser guard (endpoint below is a fake, captured locally — no real Worker request)
    window.DDCS_ANALYTICS_URL = 'https://example.test/e';
    window.__beacons = [];
    navigator.sendBeacon = (url, blob) => {
      const rec = { url, body: null };
      window.__beacons.push(rec);
      try { blob.text().then((t) => { rec.body = t; }); } catch (_) {}
      return true;
    };
  });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForFunction(() => window.__beacons.some((b) => b.body && b.body.includes('"event":"visit"')), { timeout: 15000 });

  await page.evaluate(() => window.openWiz && window.openWiz('drill'));
  await page.waitForFunction(() => window.__beacons.some((b) => b.body && b.body.includes('wizard:drill')), { timeout: 15000 });

  const out = await page.evaluate(() => window.__beacons.map((b) => ({ url: b.url, body: b.body })));
  console.log('BEACONS', JSON.stringify(out, null, 0));
  const visit = out.find((b) => b.body && b.body.includes('"event":"visit"'));
  const feat = out.find((b) => b.body && b.body.includes('wizard:drill'));
  expect(visit, 'visit beacon sent').toBeTruthy();
  expect(visit.url).toBe('https://example.test/e');
  const v = JSON.parse(visit.body);
  expect(v.app).toBe('web');
  expect(v.version).toMatch(/^\d+(\.\d+)+$/);
  expect(typeof v.id).toBe('string');
  expect(feat, 'feature beacon sent on openWiz').toBeTruthy();
});
