import { test, expect } from '@playwright/test';

/**
 * gateway-job-tracking-2647 — BACKLOG #79: the DECODED half of gateway-position-stub-2073's own raw stub.
 *
 * register 10002 (run state) + 16062 (executing line) are float32 CDAB, CONFIRMED on the owner's own M350
 * (expert-m350/FINDINGS.md, 2026-09-05) — unlike work_position/machine_position, which stay raw because their
 * byte order is unattested. So this block shows DECODED state (RUNNING/IDLE) + line number, built on the SAME
 * PositionPoller machinery gateway-position-stub-2073 already exercises, via the new /api/tracking endpoint
 * (Ops.job_tracking_status).
 *
 * ⛔ NO PERCENT, on purpose — BACKLOG #79's own explicit constraint: whether register 16062 counts physical
 * file lines or executable blocks is untested, so drawing a percentage off it would assume an unconfirmed
 * denominator. This tab shows "line N" and nothing more.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page, trackingBody) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ service: 'gateway', controller_connected: true, device: 'M350', role: 'gateway' }),
    }));
    await page.route('**/api/queue', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/position', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false }) }));
    await page.route('**/api/tracking', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(trackingBody),
    }));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('gateway'));
    // t2687 (de-sleep) — was a flat waitForTimeout(1500). The Track tab's buttons are wired synchronously inside
    // initGatewayPanel() (gatewayPanel.js), already done by the time showApp()'s promise resolves above — waiting
    // for the tab strip to exist is the real (and much cheaper) precondition for the click below.
    await page.waitForSelector('#gateway-app .settings-main-tab', { timeout: 10000 });
    // The one fetch that matters for this file: tracker.js's mount() → onPoll() → renderJobTracking(ctx) calls
    // ctx.client.getTracking() (→ /api/tracking) only once the Track tab is clicked. Arm the listener BEFORE the
    // click so we can't miss it, then wait for the real response instead of guessing how long the mocked fetch +
    // DOM update takes.
    const trackResp = page.waitForResponse('**/api/tracking', { timeout: 10000 });
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Track');
        if (t) t.click();
    });
    await trackResp;
};

test('tracking not enabled (the common case — no --position-poll) → the block stays hidden entirely', async ({ page }) => {
    await boot(page, { enabled: false });
    const visible = await page.evaluate(() => {
        const el = document.querySelector('.bt-jobtrack');
        return !!el && el.style.display !== 'none' && el.offsetParent !== null;
    });
    expect(visible, 'no job-tracking block appears for a gateway that never turned Poll mode on').toBe(false);
});

test('tracking enabled + connected + running → DECODED state and line render, never a percent', async ({ page }) => {
    await boot(page, { enabled: true, connected: true, error: null, running: true, line: 10, read_at: '2026-09-05T12:00:00Z' });
    const body = await page.evaluate(() => document.querySelector('.bt-jobtrack')?.textContent || '');
    expect(body, 'the decoded run state reaches the screen').toContain('RUNNING');
    expect(body, 'the decoded line number reaches the screen').toContain('10');
    expect(body, 'the read timestamp reaches the screen').toContain('2026-09-05T12:00:00Z');
    expect(body, 'NO PERCENT — BACKLOG #79\'s own explicit constraint, 16062\'s unit is untested').not.toMatch(/%/);
});

test('tracking enabled + connected + idle → IDLE and line 0, still no percent', async ({ page }) => {
    await boot(page, { enabled: true, connected: true, error: null, running: false, line: 0, read_at: '2026-09-05T12:05:00Z' });
    const body = await page.evaluate(() => document.querySelector('.bt-jobtrack')?.textContent || '');
    expect(body).toContain('IDLE');
    expect(body).toContain('0');
    expect(body).not.toMatch(/%/);
});

test('tracking enabled but NOT connected → the honest error, not stale/fabricated state', async ({ page }) => {
    await boot(page, { enabled: true, connected: false, error: 'COM7: timeout', running: null, line: null, read_at: null });
    const body = await page.evaluate(() => document.querySelector('.bt-jobtrack')?.textContent || '');
    expect(body, 'the connection failure is shown honestly').toContain('COM7: timeout');
    expect(body, 'no fabricated RUNNING/IDLE claim while disconnected').not.toMatch(/RUNNING|IDLE/);
});
