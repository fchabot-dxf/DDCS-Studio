import { test, expect } from '@playwright/test';

/**
 * t2151 — BACKLOG #11: THE ROLE IS WORKSPACE-RELATIVE.
 *
 * S0/S1 (t2145) derived the role from "is a controller disk configured on this PC" alone. Human ruling:
 * that is not enough — "if im connected to a controller the worspace should be client unless the controller
 * match". A PC wired to an Expert is a gateway for an EXPERT workspace and a client for a V4.1 workspace
 * opened on the same PC at the same moment: it genuinely cannot deliver to the V4.1's machine from here.
 *
 * Driven the same way t2145's own spec is (`page.route('**\/api/descriptor', ...)`), because the whole point
 * of this rule is that it must fire on the DEVICE holding the workspace, not merely be correct given an
 * already-known role.
 */
const descFor = (profileId, extra = {}) => ({
    role: 'gateway', role_conflict: false, dest: '\\\\10.0.0.50\\cncdisk', backend: 'local', version: '1',
    controller_connected: true, machine_name: 'Ultimate Bee', controller_profile_id: profileId, ...extra,
});

const openMenu = async (page) => { await page.click('#hdrPostBtn'); await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 4000 }); };
const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsSetMachine && document.querySelector('#hdrPostMenu .hq-identity-line'), null, { timeout: 15000 });
};
const identityLine = (page) => page.evaluate(() => {
    const el = document.querySelector('#hdrPostMenu .hq-identity-txt');
    const roleSpan = [...(el ? el.querySelectorAll('.hq-cur') : [])].find((s) => /gateway|client/.test(s.textContent));
    return { text: el ? el.textContent : '', roleTitle: roleSpan ? roleSpan.title : '' };
});
const setWorkspaceController = (page, id) => page.evaluate((cid) => window.ddcsSetMachine({ controllerId: cid }, true), id);

test('MATCH: workspace declares the same controller that answers → gateway, no reason', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(descFor('ddcs-expert-m350')) }));
    await boot(page);
    await setWorkspaceController(page, 'ddcs-expert-m350');
    await page.waitForTimeout(600);   // let the poller's tick land
    await openMenu(page);
    const { text, roleTitle } = await identityLine(page);
    expect(text, `identity line: ${JSON.stringify(text)}`).toMatch(/·\s*gateway\s*·/);
    expect(roleTitle, 'no demotion reason when it matches').toBe('');
});

test('MISMATCH: workspace declares a DIFFERENT controller than the one connected → demoted to client, WHY stated', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(descFor('ddcs-v41')) }));
    await boot(page);
    await setWorkspaceController(page, 'ddcs-expert-m350');   // this workspace targets the Expert
    await page.waitForTimeout(600);
    await openMenu(page);
    const { text, roleTitle } = await identityLine(page);
    expect(text, `identity line: ${JSON.stringify(text)}`).toMatch(/·\s*client\s*·/);
    expect(roleTitle, 'the demotion is not a bare word flip — it names both controllers').toMatch(/DDCS Expert/);
    expect(roleTitle, '').toMatch(/DDCS V4\.1|v4\.1/i);
});

test('⛔ UNKNOWN IS NOT A MISMATCH: a fingerprint that failed (no controller_profile_id) never demotes a real gateway', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(descFor(null)) }));
    await boot(page);
    await setWorkspaceController(page, 'ddcs-expert-m350');
    await page.waitForTimeout(600);
    await openMenu(page);
    const { text, roleTitle } = await identityLine(page);
    expect(text, `an unreadable fingerprint must stay gateway, not silently demote: ${JSON.stringify(text)}`).toMatch(/·\s*gateway\s*·/);
    expect(roleTitle, 'no reason — there was nothing to compare').toBe('');
});

test('no daemon at all: still client, workspace comparison never runs (S0/S1 unchanged)', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 404, body: 'no gateway here' }));
    await boot(page);
    await setWorkspaceController(page, 'ddcs-expert-m350');
    await openMenu(page);
    const { text } = await identityLine(page);
    expect(text, `identity line: ${JSON.stringify(text)}`).toMatch(/·\s*client\s*·/);
});

test('admin.js Setup: a mismatch STATES ITSELF but never hides this PC\'s own real wiring fields', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(descFor('ddcs-v41')) }));
    await boot(page);
    await setWorkspaceController(page, 'ddcs-expert-m350');
    await page.waitForTimeout(600);
    await page.evaluate(() => window.showApp('gateway'));
    await page.waitForFunction(() => document.querySelectorAll('#gateway-app .settings-main-tab').length > 0);
    await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#gateway-app .settings-main-tab')];
        const consoleTab = tabs.find((t) => /Console/.test(t.textContent));
        consoleTab && consoleTab.click();
    });
    await page.waitForFunction(() => document.querySelector('#gateway-app input[placeholder*="10.0.0.50"]'), null, { timeout: 8000 });
    const s = await page.evaluate(() => ({
        diskFieldPresent: !!document.querySelector('#gateway-app input[placeholder*="10.0.0.50"]'),
        bannerText: document.body.textContent,
    }));
    expect(s.diskFieldPresent, 'this PC IS a real gateway (for a different controller) — its own wiring field must stay').toBe(true);
    expect(s.bannerText, 'the mismatch is stated, not silent').toMatch(/different controller than the WORKSPACE/);
});

test('Track tab: a workspace mismatch gates it off, stated, distinctly from the Modbus-capability gate', async ({ page }) => {
    await page.route('**/api/descriptor', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(descFor('ddcs-v41', { controller_family: 'v4.1' })) }));
    await boot(page);
    await setWorkspaceController(page, 'ddcs-expert-m350');
    await page.waitForTimeout(600);
    await page.evaluate(() => window.showApp('gateway'));
    await page.waitForFunction(() => document.querySelectorAll('#gateway-app .settings-main-tab').length > 0);
    await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#gateway-app .settings-main-tab')];
        const t = tabs.find((x) => /Track/.test(x.textContent));   // t2241 — was /Tracking/
        t && t.click();
    });
    const why = await page.evaluate(() => (document.querySelector('#gateway-app .gw-view .muted') || {}).textContent || '');
    expect(why.toLowerCase(), `Track's gated reason: ${JSON.stringify(why)}`).toMatch(/not the gateway for the open workspace/);
});
