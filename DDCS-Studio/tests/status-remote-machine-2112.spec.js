import { test, expect } from '@playwright/test';

/**
 * t2112 — THE STATUS TAB REPORTS THE MACHINE, NOT THE DEVICE LOOKING AT IT.
 *
 * Found live: the human opened ddcs-studio.pages.dev on a PHONE, signed in, with the right workspace open,
 * and Status said *"unreachable — still looking on this PC. Enter a daemon URL in the Console tab"* over a
 * **Download DDCS Studio for desktop** button. Every word of that is about the phone, on a device that
 * cannot run an exe and will never host a gateway. Nothing had failed; the tab was asking the wrong
 * question and reporting the answer as a fault.
 *
 * ⭐ The gateway already answers the RIGHT question every 20s in `gateway/heartbeat.json` — is a gateway
 * alive, and is the mill powered — and the Send tab was taught to read it in t2105. Status was not, so the
 * two adjacent tabs could tell different stories about one fact: Send correctly greyed with "no gateway is
 * running" beside Status saying "install the desktop app".
 *
 * ⛔ REFRAME, NEVER HIDE (ROLES-PLAN §1): checking on the machine from somewhere else is most of why anyone
 * opens Studio on a phone. And the download card stays UNCONDITIONAL — the human ruled that separately
 * ("its not because i have the app open that i dont want to download it again").
 *
 * ⚠ THREE STATES, NOT TWO. The mill is observable ONLY through its gateway. With none running its state is
 * UNKNOWN, never "off" — drawing a guess as a fact is the habit this codebase keeps removing.
 */

/**
 * ⭐ THE HEARTBEAT IS STUBBED AT THE NETWORK, not at the module. An ES module namespace is SEALED, so
 * assigning over an export silently does nothing (my first attempt at this file) and the test then proves
 * only that the real, un-stubbed code returned "signed-out". Routing googleapis.com exercises the REAL
 * readGatewayHeartbeat - its folder walk, its modifiedTime freshness rule, its JSON parse - which is the
 * whole point: it is the code that was never covered.
 */
const routeDrive = async (page, hbState) => {
    await page.route(/googleapis\.com\/drive\/v3\/files/, async (route) => {
        const url = route.request().url();
        const q = decodeURIComponent(url);
        const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
        // ⚠ 'unreadable' means the LOOKUP ITSELF failed, so it can only be produced by an actual failure -
        //    fulfilling with a 200 makes the real code return 'unseen' and the test then proves nothing.
        if (hbState.state === 'unreadable') return route.fulfill({ status: 500, body: 'nope' });
        if (/alt=media/.test(url)) return json(hbState.hb || {});
        if (/DDCS Bridge/.test(q)) return json({ files: [{ id: 'rootId' }] });
        if (/'gateway'/.test(q)) return json({ files: hbState.state === 'unseen' ? [] : [{ id: 'gwId' }] });
        if (/heartbeat\.json/.test(q)) {
            if (hbState.state === 'unseen') return json({ files: [] });
            const age = (hbState.ageS != null ? hbState.ageS : 5) * 1000;
            return json({ files: [{ id: 'hbId', modifiedTime: new Date(Date.now() - age).toISOString() }] });
        }
        // the machine folder (any other name lookup)
        return json({ files: hbState.state === 'unseen' ? [] : [{ id: 'machineId' }] });
    });
};

const mountStatus = async (page, { hb, hasDaemon }) => {
    await routeDrive(page, hb);
    return page.evaluate(async ({ hasDaemon }) => {
        localStorage.setItem('ddcs_cloud_token', 'test-token');       // canSendViaDrive() reads this
        localStorage.setItem('ddcs_machine', JSON.stringify({ name: 'Ultimate Bee', controllerId: 'ddcs-v41', kind: 'mill' }));
        window.__hbCalls = 0;
        const mod = await import('/ui/gateway/views/status.js');
        document.getElementById('test-status-root')?.remove();
        const root = document.createElement('div');
        root.id = 'test-status-root';
        root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
        document.body.appendChild(root);
        window.__statusErr = null;
        const client = {
            descriptor: async () => { if (!hasDaemon) throw new Error('no gateway'); return { machine_name: 'Ultimate Bee', dest: 'x', backend: 'local', version: '1', controller_connected: true }; },
            readVars: async () => ({}),
        };
        try { await mod.default.mount({ root, client }); await mod.default.onPoll({ root, client }); }
        catch (e) { window.__statusErr = String((e && e.message) || e); }
    }, { hasDaemon });
};

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
};

const FRESH_ON = { state: 'fresh', ageS: 8, hb: { hostname: 'RenderRanchy', controller_connected: true, controller_family: 'v4.1' } };
const FRESH_OFF = { state: 'fresh', ageS: 12, hb: { hostname: 'RenderRanchy', controller_connected: false, controller_family: 'v4.1' } };
const UNSEEN = { state: 'unseen', hb: null };

const root = (page) => page.locator('#test-status-root');

test('NO DAEMON + the machine reported in: Status names the GATEWAY and the MILL, not this device', async ({ page }) => {
    await boot(page);
    await mountStatus(page, { hb: FRESH_ON, hasDaemon: false });
    expect(await page.evaluate(() => window.__statusErr), 'the status view rendered').toBeNull();
    await expect(root(page).getByText('Gateway (RenderRanchy) is running')).toHaveCount(1);
    await expect(root(page).getByText('Machine is powered on')).toHaveCount(1);
    // ⛔ the phone-hostile copy must be gone in this state
    await expect(root(page).getByText(/still looking on this PC/), 'no "looking on this PC" once the machine has answered').toHaveCount(0);
});

test('NO DAEMON + the mill is OFF: stated as off, and NOT confused with the gateway being down', async ({ page }) => {
    await boot(page);
    await mountStatus(page, { hb: FRESH_OFF, hasDaemon: false });
    await expect(root(page).getByText('Gateway (RenderRanchy) is running')).toHaveCount(1);
    await expect(root(page).getByText('Machine is switched off')).toHaveCount(1);
});

test('NO DAEMON + nothing has ever reported: the ORIGINAL guidance stands — it is the right message here', async ({ page }) => {
    await boot(page);
    await mountStatus(page, { hb: UNSEEN, hasDaemon: false });
    // ⚠ With no heartbeat there is genuinely nothing to say about the machine, so the daemon-URL path is
    //    correct. The bug was showing it when the machine HAD answered, not showing it at all.
    // t2113 - UPDATED PREMISE. This used to assert the daemon-URL fallback, which was correct when Status
    // only understood 'fresh'. It now answers the negative states too, off the same heartbeat Send uses.
    await expect(root(page).getByText(/cannot see a gateway for this machine/)).toHaveCount(1);
    await expect(root(page).getByText(/Machine state unknown/)).toHaveCount(1);
});

test('the desktop download card is present in EVERY state — unconditional, per the human ruling', async ({ page }) => {
    await boot(page);
    for (const hb of [FRESH_ON, FRESH_OFF, UNSEEN]) {
        await mountStatus(page, { hb, hasDaemon: false });
        await expect(root(page).getByText(/Download DDCS Studio for desktop/), 'download offer survives every state').toHaveCount(1);
    }
});

test('A LOCAL DAEMON answers: the heartbeat is never asked for — no needless Drive call', async ({ page }) => {
    await boot(page);
    let driveCalls = 0;
    page.on('request', (r) => { if (/googleapis\.com/.test(r.url())) driveCalls++; });
    await mountStatus(page, { hb: FRESH_ON, hasDaemon: true });
    // ⚠ onPoll runs whenever the tab is visible; a Google request per tick would be antisocial and is
    //    exactly what drive.py's own docstring warns about. With a daemon there is nothing to ask.
    expect(driveCalls, 'no Drive read when a local gateway answered').toBe(0);
    await expect(root(page).getByText('controller disk')).toHaveCount(1);
});

const STALE = { state: 'stale', ageS: 4 * 3600, hb: { hostname: 'RenderRanchy', controller_connected: true } };
const UNREADABLE = { state: 'unreadable', hb: null };

test('a gateway that STOPPED says when it was last seen — not "look for a daemon on this PC"', async ({ page }) => {
    await boot(page);
    await mountStatus(page, { hb: STALE, hasDaemon: false });
    await expect(root(page).getByText(/last checked in \d+ min ago/)).toHaveCount(1);
    await expect(root(page).getByText(/still looking on this PC/), 'the phone-hostile copy stays gone').toHaveCount(0);
});

test('a Drive that will not answer is IGNORANCE, not absence — amber, and it says so', async ({ page }) => {
    await boot(page);
    await mountStatus(page, { hb: UNREADABLE, hasDaemon: false });
    // ⛔ must never read as "no gateway": the browser reading a DESKTOP-written Drive file is the one
    //    visibility direction never measured, so a failed lookup may mean we cannot SEE rather than
    //    that nothing is THERE.
    await expect(root(page).getByText(/could not check whether a gateway is running/)).toHaveCount(1);
    const amber = await root(page).locator('.hb-dot.unknown').count();
    expect(amber, 'ignorance is drawn amber, not red').toBeGreaterThan(0);
});
