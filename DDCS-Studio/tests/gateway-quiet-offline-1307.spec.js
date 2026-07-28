import { test, expect } from '@playwright/test';

/**
 * t1307 — WATCHING WITHOUT SHOUTING (user-reported). Running the raw web app with no gateway filled the console with
 * a repeating 404 for /api/descriptor: the status poll asked every 5 seconds, forever. That line is the BROWSER's own
 * network log — a caught fetch still produces it — so the only way to quiet it is to stop asking so often.
 *
 * THE CHIP'S JOB IS UNCHANGED, and that is the harder half of this: it must still light the moment a gateway appears.
 * So the back-off is paired with the events that mean a person has just come back to the window, which is exactly
 * when they have started one.
 */
test.use({ viewport: { width: 1400, height: 950 } });

/** Boot with the gateway answering or not, counting every request the page makes for the descriptor. */
const boot = async (page, { answer }) => {
    const hits = [];
    await page.route('**/api/descriptor', (route) => {
        hits.push(Date.now());
        if (answer()) route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ service: 'gateway', controller_connected: true, device: 'M350' }) });
        else route.fulfill({ status: 404, body: 'no gateway here' });
    });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    return hits;
};

const ledClass = (page) => page.evaluate(() => (document.getElementById('gateway-led') || {}).className || '');

test('OFFLINE, IT BACKS OFF — 5s, 10s, 20s, instead of every 5 seconds forever', async ({ page }) => {
    const hits = await boot(page, { answer: () => false });
    await page.waitForTimeout(22000);
    const gaps = hits.slice(1).map((h, i) => Math.round((h - hits[i]) / 1000));
    // …the first ask is at boot; the waits after it double, capped. Twelve requests a minute becomes two.
    expect(hits.length, `three asks in 22 seconds, not five (${gaps})`).toBeLessThanOrEqual(3);
    expect(gaps[0], 'the first retry is the fast cadence').toBeGreaterThanOrEqual(4);
    expect(gaps[1], 'and the next wait is longer than the one before it').toBeGreaterThan(gaps[0] + 2);
    expect(await ledClass(page), 'and the LED says what it always said: unlit, no gateway').toBe('gateway-led');
});

test('AND IT STILL LIGHTS THE MOMENT A GATEWAY APPEARS — the window coming back is the cue', async ({ page }) => {
    let up = false;
    const hits = await boot(page, { answer: () => up });
    await page.waitForTimeout(7000);          // …long enough to be into the backed-off cadence
    const before = hits.length;
    expect(await ledClass(page)).toBe('gateway-led');
    // the operator starts their gateway and clicks back into Studio
    up = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => /led-ok/.test((document.getElementById('gateway-led') || {}).className || ''), null, { timeout: 4000 });
    expect(hits.length, 'coming back to the window asked immediately — it did not wait out the back-off').toBeGreaterThan(before);
    expect(await ledClass(page), 'and the chip is green, with no reload').toContain('led-ok');
});

test('ONCE CONNECTED, THE FAST CADENCE IS BACK — a gateway that goes away is noticed as quickly as before', async ({ page }) => {
    let up = true;
    const hits = await boot(page, { answer: () => up });
    await page.waitForFunction(() => /led-ok/.test((document.getElementById('gateway-led') || {}).className || ''), null, { timeout: 5000 });
    const from = hits.length;
    await page.waitForTimeout(11000);
    const gaps = hits.slice(from).map((h, i) => Math.round((h - (hits[from + i - 1] || h)) / 1000));
    expect(hits.length - from, 'connected, it keeps checking every 5 seconds').toBeGreaterThanOrEqual(2);
    expect(gaps.every((g) => g <= 6), `each gap is the fast cadence (${gaps})`).toBe(true);
});
