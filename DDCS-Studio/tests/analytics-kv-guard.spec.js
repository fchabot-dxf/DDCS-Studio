import { test, expect } from '@playwright/test';

/**
 * ANALYTICS KV-WRITE GUARDS (t616 amendment — Cloudflare free-tier protection). Two client-side guards in ui/analytics.js:
 * (1) automated browsers (navigator.webdriver → Playwright) + any window.__ddcsNoTrack harness fire ZERO beacons, so the
 *     suites' hundreds of app boots make no requests to the Worker (each dev boot would otherwise be a KV write).
 * (2) the dev-network refresh (a dev=1 visit/app_launch → a server-side KV write, Worker index.js:62-64) is throttled to
 *     ONCE PER DAY via a localStorage day-stamp: later same-day dev boots send dev=0 → the Worker READS KV (cheap) instead.
 */
test('a Playwright (automated) boot fires ZERO requests to the analytics Worker', async ({ page }) => {
    const hits = [];
    page.on('request', (r) => { if (r.url().includes('ddcs-analytics')) hits.push(r.url()); });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsTrack);
    // even an explicit track() call must be a no-op under webdriver
    await page.evaluate(() => window.ddcsTrack('feature', 'kv-guard-test'));
    await page.waitForTimeout(300);   // give any beacon a chance to fire (it won't)
    expect(hits, 'an automated browser sends no analytics beacons').toEqual([]);
});

test('the dev-network refresh is throttled to ONCE PER DAY (KV-write guard)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.__ddcsDevFlag);
    const r = await page.evaluate(() => {
        localStorage.setItem('ddcs_dev', '1');       // tag this browser as the developer's own
        localStorage.removeItem('ddcs_dev_day');      // no refresh yet today
        const first = window.__ddcsDevFlag('visit');        // → 1 (first refresh of the day)
        const second = window.__ddcsDevFlag('visit');       // → 0 (same day → Worker reads KV, no write)
        const feature = window.__ddcsDevFlag('feature');    // → 1 (non-visit event: dev-attributed, no KV write)
        localStorage.setItem('ddcs_dev_day', '2000-01-01'); // simulate a new day
        const nextDay = window.__ddcsDevFlag('visit');      // → 1 (new day → refresh again)
        return { first, second, feature, nextDay };
    });
    expect(r.first, 'day’s first visit → dev=1 (refresh the KV network tag)').toBe(1);
    expect(r.second, 'same-day second visit → dev=0 (Worker reads KV, no write)').toBe(0);
    expect(r.feature, 'non-visit events stay dev=1 (never a KV write)').toBe(1);
    expect(r.nextDay, 'a next-day visit → dev=1 again').toBe(1);
});
