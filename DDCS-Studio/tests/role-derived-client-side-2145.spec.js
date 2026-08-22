import { test, expect } from '@playwright/test';

/**
 * t2145 (ROLES-PLAN S0/S1 corrected) — the PC role is now derivable CLIENT-SIDE, with no daemon required.
 *
 * The bug this closes (ROLES-PLAN.md "MEASURED 2026-08-22 — S0/S1/S2 ARE NOT ACTUALLY SHIPPED"): the role only
 * ever came from a reachable daemon's own `/api/descriptor`. On a phone with no daemon, `descriptor()` throws,
 * `admin.js`'s `render()` bails to "gateway unreachable", and NO role is ever computed — the client role was
 * only knowable from a machine that is NOT a client, which is circular.
 *
 * THE RULE (human ruling, overriding an earlier three-state design): daemon reachable → use ITS answer; daemon
 * NOT reachable → 'client', unconditionally, DERIVED PER TICK (never cached/persisted) so a gateway whose
 * daemon is merely down self-corrects to 'gateway' the moment it answers again, with no restart needed.
 *
 * This spec drives the REAL network path (`page.route('**\/api/descriptor', ...)`, the same technique
 * `gateway-quiet-offline-1307.spec.js` uses) rather than a hand-supplied descriptor object — the whole point,
 * per ROLES-PLAN's own "why the tests pass anyway" finding, is that a mocked-object test proves the gating is
 * correct GIVEN a role but never proves the role is actually reachable on the device that needs it.
 */

const GATEWAY_DESC = { role: 'gateway', role_conflict: false, dest: '\\\\10.0.0.50\\cncdisk', backend: 'local', version: '1', controller_connected: true, machine_name: 'Ultimate Bee' };

const openMenu = async (page) => { await page.click('#hdrPostBtn'); await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 4000 }); };
const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && document.querySelector('#hdrPostMenu .hq-identity-line'), null, { timeout: 15000 });
};
const identityText = (page) => page.evaluate(() => (document.querySelector('#hdrPostMenu .hq-identity-txt') || {}).textContent || '');

test('no daemon reachable at all (the phone case): the identity line reads client, not blank', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 404, body: 'no gateway here' }));
    await boot(page);
    await openMenu(page);
    const txt = await identityText(page);
    expect(txt, `identity line: ${JSON.stringify(txt)}`).toMatch(/·\s*client\s*·/);
    expect(txt, 'never the raw role field name or a blank gap').not.toMatch(/undefined|\[object/);
});

test('a daemon that answers "gateway" is shown as gateway', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GATEWAY_DESC) }));
    await boot(page);
    // let the poller's first tick land before opening the menu
    await page.waitForTimeout(600);
    await openMenu(page);
    const txt = await identityText(page);
    expect(txt, `identity line: ${JSON.stringify(txt)}`).toMatch(/·\s*gateway\s*·/);
});

test('SELF-CORRECTS, NOT CACHED: a gateway daemon that goes offline then comes back is never stuck on client', async ({ page }) => {
    let up = true;
    await page.route('**/api/descriptor', (route) => {
        if (up) route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GATEWAY_DESC) });
        else route.fulfill({ status: 404, body: 'daemon down' });
    });
    await boot(page);
    await page.waitForTimeout(600);
    await openMenu(page);
    expect(await identityText(page), 'starts as gateway while the daemon answers').toMatch(/·\s*gateway\s*·/);

    // the daemon goes down — per the human's ruling this reads as 'client' (it describes what the PC can do
    // right now), NOT a persisted downgrade
    up = false;
    await page.click('#hdrPostBtn');   // close the menu so the next open re-renders fresh
    await page.waitForTimeout(6000);   // past the poller's fast 5s cadence, so a fresh tick has landed
    await openMenu(page);
    expect(await identityText(page), 'daemon down: reads client, not stuck showing gateway').toMatch(/·\s*client\s*·/);

    // the daemon comes back — must self-correct to gateway with NO reload, proving the role was never persisted
    up = true;
    await page.click('#hdrPostBtn');
    await page.waitForTimeout(6000);
    await openMenu(page);
    expect(await identityText(page), 'daemon back: self-corrects to gateway with no reload — proves it is not cached-and-stuck').toMatch(/·\s*gateway\s*·/);
});
