import { test, expect } from '@playwright/test';

/**
 * gateway-position-stub-2073 — t2073: THE HONEST STUB, on the view a human actually reaches.
 *
 * Poll-mode position reads (t2059/2063) are bench-proven to reach the controller, but nothing yet turns
 * "the tool is at these numbers" into "this job is N% done" — that cursor stays gated on a real bench
 * session (JOB-PROGRESS-PLAN.md). So the Tracking tab gets a SEPARATE, small block showing exactly what
 * the bridge measures (raw, undecoded registers) and nothing more — never claiming job progress, and
 * silent (hidden) for the majority of gateways that use beacons instead and never enabled --position-poll.
 *
 * Same mock-the-three-endpoints technique as gateway-jobs-history-view-2026 — deterministic, no real bridge.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page, positionBody) => {
    // t2151 (BACKLOG #11/#9 dispatch) — Tracking now also gates on the WORKSPACE-RELATIVE role
    // (`requiresGateway`, tracker.js): a descriptor with no `.role` reads as a client and hides this tab's
    // content entirely, which is a real fixture gap this turn's role-awareness exposed, not a regression in
    // the gate — the mock never needed a role before Tracking started reading one. `controller_profile_id`
    // omitted deliberately: this test doesn't set a workspace controller either, so leaving it unset (unknown)
    // is the honest match, not a guess.
    await page.route('**/api/descriptor', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ service: 'gateway', controller_connected: true, device: 'M350', role: 'gateway' }),
    }));
    await page.route('**/api/queue', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/position', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(positionBody),
    }));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('gateway'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Tracking');
        if (t) t.click();
    });
    await page.waitForTimeout(900);
};

test('position not enabled (the common case — beacons, not Poll mode) → the stub stays hidden entirely', async ({ page }) => {
    await boot(page, { enabled: false });
    const visible = await page.evaluate(() => {
        const el = document.querySelector('.bt-position');
        return !!el && el.style.display !== 'none' && el.offsetParent !== null;
    });
    expect(visible, 'no position block appears for a gateway that never turned Poll mode on').toBe(false);
});

test('position enabled + connected → raw registers render, explicitly labelled as NOT job progress', async ({ page }) => {
    await boot(page, {
        enabled: true, connected: true, error: null,
        raw: { work_position: [1, 2, 3, 4, 5], state: [0, 0] },
        read_at: '2026-08-18T12:00:00Z',
    });
    const body = await page.evaluate(() => document.querySelector('.bt-position')?.textContent || '');
    expect(body, 'the stub is visible with the honest not-job-progress label').toMatch(/raw registers.*undecoded.*not linked to job progress/i);
    expect(body, 'the raw register values reach the screen').toContain('1,2,3,4,5');
    expect(body, 'the read timestamp reaches the screen').toContain('2026-08-18T12:00:00Z');
    // never implies a percent/ETA/job-progress claim — that would contradict the whole point of the stub
    expect(body, 'no fabricated job-progress language').not.toMatch(/%|ETA|percent/i);
});

test('position enabled but NOT connected → the honest error, not stale/fabricated numbers', async ({ page }) => {
    await boot(page, { enabled: true, connected: false, error: 'COM7: timeout', raw: {}, read_at: null });
    const body = await page.evaluate(() => document.querySelector('.bt-position')?.textContent || '');
    expect(body, 'the connection failure is shown honestly').toContain('COM7: timeout');
});
