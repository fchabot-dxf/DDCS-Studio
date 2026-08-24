import { test, expect } from '@playwright/test';
import { clickBtn as clickBtnImpl } from './support/gatewaySend.js';

/**
 * t2057 — SAY SO AT THE MOMENT OF SENDING: `ops.submit_job`'s new `warning` field (bridge-side, tested in
 * `test_beacon_health_2057.py`) must actually reach the operator's screen, not just exist in the API response.
 * Mocks `/api/descriptor` (connected) and `/api/jobs` (returns a warning, matching what a bridge with
 * `enable_slave` off or a dead Modbus receiver now genuinely returns) — the REAL Send view, the REAL click,
 * the REAL "Use current Studio program" -> instrument -> submit chain, same discipline as
 * send-gate-wiring-1585 (drive the UI, don't call the handler directly).
 */
test.use({ viewport: { width: 1300, height: 850 } });

test('a warning from submitJob shows up on screen at send time, not buried in a log', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ service: 'gateway', controller_connected: true, device: 'M350' }),
    }));
    await page.route('**/api/jobs', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
            jobId: '20260817T000000_000000-part',
            name: 'part.nc',
            tracked: true,
            warning: 'Beacons were requested but the bridge\'s Modbus receiver is not running (could not open COM6: FileNotFoundError) — this job will deliver but will NOT show live progress.',
        }),
    }));

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack, undefined, { timeout: 30_000 });

    // A trivial, safe program: rapid moves only (matching send-gate-wiring-1585's own shape) — no G1/G2/G3
    // cutting move, so the "dead spindle" pre-flight never fires; t2057 isn't testing pre-flight at all.
    await page.evaluate(async () => {
        window.ddcsLoadBlockStack([
            { id: 'a', type: 'move', params: { mode: 'rapid', x: 10, y: 10, z: -5, feed: 500 } },
            { id: 'b', type: 'move', params: { mode: 'rapid', x: 20, y: 20, z: -5, feed: 500 } },
        ]);
        await new Promise((r) => setTimeout(r, 700));
    });

    // t2225 — was a local closure duplicated across 4 specs; now the one shared implementation
    // (support/gatewaySend.js). Same lift as send-gate-wiring-1585: the CONNECTION contract only.
    const clickBtn = (txt) => clickBtnImpl(page, txt);

    // t2145 — no longer a unique text match: the quick-menu identity line now also shows the PC role ("gateway"
    // / "client"), which matches this loose case-insensitive locator too. Target the real header tab directly.
    await page.locator('.tab[data-app="gateway"]').click();
    await page.waitForTimeout(600);
    expect(await clickBtn('Send'), 'the Send view opens').toBe(true);
    await page.waitForTimeout(700);
    expect(await clickBtn('Use current Studio program'), 'the current program stages').toBe(true);
    await page.waitForTimeout(500);

    // Beacons defaults CHECKED — confirm it, so this really is the tracked path the warning is about.
    const beaconsChecked = await page.evaluate(() => {
        const cb = [...document.querySelectorAll('input[type=checkbox]')].find((c) =>
            (c.closest('label')?.textContent || '').includes('Beacons'));
        return cb ? cb.checked : null;
    });
    expect(beaconsChecked, 'Beacons is ticked by default — this send genuinely requests tracking').toBe(true);

    expect(await clickBtn('Send (tracked)'), 'the send is attempted').toBe(true);
    await page.waitForTimeout(1200);

    const screenText = await page.evaluate(() => document.body.textContent || '');
    expect(screenText, 'the warning text reaches the screen, not just the API response').toContain('Modbus receiver is not running');
    expect(screenText, 'names the real reason, not a vague failure').toContain('COM6');
});
