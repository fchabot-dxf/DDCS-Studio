import { test, expect } from '@playwright/test';

/**
 * t1327 — THE GATEWAY STATE CONTRACT, swept across every subtab, both ways.
 *
 * Three faults from the advisor's audit, all the same shape: a tab showing something it could not know.
 *   · FILES kept its last successful CNCDISK listing when the poll failed — rows naming files on a controller that
 *     is not there, with view and DELETE still armed. That delete fires at whatever gateway answers next.
 *   · SEND stayed fully armed with no gateway, so the failure arrived as an exception AFTER the click, on the one
 *     screen where the click means "push this at my machine".
 *   · TRACKING said IDLE while UNREACHABLE. Different facts: idle is "I asked and there is no job", unreachable is
 *     "I could not ask". Saying the calm one when the true one is unknown is the envelope check's cry-wolf pointed
 *     the other way — a false reassurance instead of a false alarm.
 *
 * THE RULE, declared in gateway/state.js: stale data is never shown as live. A tab either has an answer from THIS
 * state or says it has none. What survives is only what belongs to the operator and needs no machine to be true.
 */
test.use({ viewport: { width: 1280, height: 900 } });

// UNREACHABLE, deterministically: point at a dead base and mark the mode local so the auto-probe cannot rescue it
// (this machine really does run a gateway on 8765, which is exactly why the state has to be forced rather than hoped).
const openPanel = async (page, { reachable }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(({ reachable }) => {
        localStorage.setItem('ddcs_mode', 'local');
        localStorage.setItem('ddcs_api', reachable ? 'http://127.0.0.1:8765' : 'http://127.0.0.1:1');
        localStorage.removeItem('ddcs_api_auto');
    }, { reachable });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('gateway'));
    // t2687 (de-sleep) — was a flat waitForTimeout(1500). Status is the default tab (gatewayPanel.js's own
    // activate(statusView) at init); its .role-identity line is written UNCONDITIONALLY by onPoll(), but only
    // once (status.js — this.identity.replaceChildren(...) runs after `d = await ctx.client.descriptor()`
    // resolves, on every branch, unlike `.dot` which status.js explicitly omits for a client with no local
    // daemon — BACKLOG #83). That fetch and the panel's own poll() (gatewayPanel.js, triggered by
    // setGatewayPanelVisible(true) right after) are both kicked off in the same tick against the same endpoint,
    // so .role-identity appearing is a real, DOM-observable stand-in for "the gateway state has been asked at
    // least once" — never earlier than the real condition, on either connected or unreachable path.
    await page.waitForSelector('#gateway-app .gw-view .role-identity', { timeout: 10000 });
};

const goTab = async (page, label) => {
    await page.evaluate((label) => {
        const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === label);
        if (t) t.click();
    }, label);
    // t2687 (de-sleep) — was a flat waitForTimeout(900). Each view's own onPoll() fetch (files.js's listFiles(),
    // tracker.js's listQueue()) is what actually produces the markers below — waiting for one of them is the
    // real completion signal instead of a guessed duration. Send's data-gw-state is set synchronously at mount
    // (applyState() reads the panel's already-current ctx.desc, no fetch of its own), so that branch resolves
    // immediately, which is correct — there is nothing further to wait for there.
    await page.waitForFunction((label) => {
        const root = document.querySelector('#gateway-app .gw-view');
        if (!root) return false;
        if (label === 'Files') return !!(root.querySelector('table') || root.querySelector('[data-gw-state]'));
        if (label === 'Track') return !!root.querySelector('.bt-idle');
        if (label === 'Send') {
            const b = root.querySelector('.gw-state-banner');
            return !!b && b.getAttribute('data-gw-state') !== '';
        }
        return true;
    }, label, { timeout: 10000 });
};

test('THE CONTRACT IS DECLARED — every subtab says what it does when unreachable', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const st = await import('/ui/gateway/state.js');
        return { tabs: Object.keys(st.TAB_CONTRACT), contract: st.TAB_CONTRACT, unreachable: st.gatewayState(null).id, connected: st.gatewayState({ version: '1' }).id };
    });
    // the derivation is ONE thing: a descriptor means a machine answered. Not a dot colour, not a stale row.
    expect(r.unreachable).toBe('unreachable');
    expect(r.connected).toBe('connected');
    // EVERY tab is named — a new tab has to state its behaviour rather than defaulting to "keep whatever was there"
    // t2241 — merge deleted (a permanent stub, never wired); jobs folded into send (a merged queue+history list)
    for (const id of ['status', 'send', 'tracker', 'files', 'admin']) {
        expect(r.tabs, `the contract covers the ${id} tab`).toContain(id);
    }
    // the two tabs that legitimately KEEP something say what and why, so "keeps nothing" elsewhere is explicit
    expect(r.contract.send.clears, 'Send keeps the staged program — it is the operator’s own').toBe(false);
    expect(r.contract.send.keeps).toMatch(/staged program/i);
    expect(r.contract.send.arms, 'but sending is disarmed').toBe(false);
    expect(r.contract.admin.keeps, 'the Console keeps its controls — they are how you FIX being unreachable').toMatch(/fix/i);
    // …and the data tabs clear
    for (const id of ['files', 'tracker']) {
        expect(r.contract[id].clears, `${id} shows no data rows when it cannot ask`).toBe(true);
    }
});

test('FILES — a fresh profile with no gateway shows ZERO rows, and nothing is armed', async ({ page }) => {
    await openPanel(page, { reachable: false });
    await goTab(page, 'Files');
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        return {
            rows: root.querySelectorAll('table tr').length,
            deletes: root.querySelectorAll('button.danger').length,
            views: [...root.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'view').length,
            note: (root.querySelector('[data-gw-state="unreachable"]') || {}).textContent || '',
        };
    });
    // THE PHANTOM, GONE: no listing at all, so nothing describes a controller that is not there
    expect(r.rows, 'no CNCDISK rows without a gateway').toBe(0);
    // …and critically nothing DESTRUCTIVE is armed against a machine Studio cannot see
    expect(r.deletes, 'no armed delete buttons').toBe(0);
    expect(r.views, 'no armed view buttons').toBe(0);
    expect(r.note, `and it says why instead of going blank: ${r.note}`).toMatch(/No gateway answering/i);
});

test('SEND — disarmed with the reason ON the control, while staging stays fully usable', async ({ page }) => {
    await openPanel(page, { reachable: false });
    await goTab(page, 'Send');
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        const send = [...root.querySelectorAll('button')].find((b) => /^Send/.test(b.textContent.trim()));
        const banner = root.querySelector('.gw-state-banner');
        const drop = root.querySelector('.drop');
        const useStudio = [...root.querySelectorAll('button')].find((b) => /Use current Studio program/.test(b.textContent));
        const nameField = root.querySelector('input[type="text"]');
        return {
            bannerShown: !!banner && banner.style.display !== 'none',
            bannerText: banner ? banner.textContent : '',
            sendDisabled: send ? send.disabled : null,
            sendTitle: send ? send.title : '',
            dropDisabled: drop ? !!drop.disabled : null,
            useStudioDisabled: useStudio ? useStudio.disabled : null,
            nameDisabled: nameField ? nameField.disabled : null,
        };
    });
    // A STATE BANNER, not a silent failure after the click
    expect(r.bannerShown, 'the state is stated before you act, not after').toBe(true);
    expect(r.bannerText).toMatch(/No gateway answering/i);
    // GREY WITH THE REASON ON THE CONTROL (postGating's rule) — never a hidden button
    expect(r.sendDisabled, 'sending is disarmed').toBe(true);
    expect(r.sendTitle, 'and the control itself carries the reason').toMatch(/needs a machine/i);
    // …AND THE OFFLINE HALF STAYS USABLE: preparing a program needs no machine, so none of it is disabled
    expect(r.useStudioDisabled, 'staging the Studio program still works').toBe(false);
    expect(r.nameDisabled, 'naming the job still works').toBe(false);
    expect(r.dropDisabled, 'and the drop target is still live').toBe(false);
});

test('TRACKING — says UNREACHABLE, not IDLE: different facts, different words', async ({ page }) => {
    await openPanel(page, { reachable: false });
    await goTab(page, 'Track');
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        return { text: root.textContent, big: (root.querySelector('.bt-idle') || {}).textContent || '' };
    });
    // the calm word must NOT appear when Studio could not ask — that is a false reassurance about a live machine
    expect(r.big, `the headline reads: ${r.big}`).toMatch(/UNREACHABLE/);
    expect(r.big, 'and specifically not IDLE').not.toMatch(/^IDLE$/);
    expect(r.text, 'with the honest explanation').toMatch(/cannot see whether a job is running/i);
});

test('THE SWEEP — every data tab is clear when unreachable, and the state note is the SAME wording everywhere', async ({ page }) => {
    await openPanel(page, { reachable: false });
    const out = {};
    for (const [label, id] of [['Send', 'send'], ['Track', 'tracker'], ['Files', 'files']]) {
        await goTab(page, label);
        out[id] = await page.evaluate(() => {
            const root = document.querySelector('#gateway-app .gw-view');
            return {
                rows: root.querySelectorAll('table tr').length,
                stated: !!root.querySelector('[data-gw-state="unreachable"]'),
                text: root.textContent.slice(0, 400),
            };
        });
    }
    // NO TAB SHOWS DATA IT COULD NOT FETCH… (send included — t2241, its merged job list is fetched data too)
    for (const id of ['send', 'tracker', 'files']) {
        expect(out[id].rows, `${id} shows no data rows when unreachable (got ${out[id].rows})`).toBe(0);
    }
    // …AND EVERY TAB SAYS SO, in one wording rather than six near-synonyms
    for (const id of ['send', 'tracker', 'files']) {
        expect(out[id].stated, `${id} states the connection state explicitly`).toBe(true);
    }
});

test('THE OTHER DIRECTION — with a gateway answering, the tabs show their data and nothing is greyed', async ({ page }) => {
    await openPanel(page, { reachable: true });
    const status = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        return { dot: (root.querySelector('.dot') || {}).className || '', label: (root.querySelector('.job') || {}).textContent || '' };
    });
    // This machine runs a real gateway on 8765. If it is not up, the connected half cannot be asserted honestly —
    // so the test says which state it is in rather than quietly passing an empty check.
    test.skip(!/ok|warn/.test(status.dot), `no local gateway answering on 8765 (dot=${status.dot}) — the connected half needs one`);
    await goTab(page, 'Send');
    const send = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        const banner = root.querySelector('.gw-state-banner');
        const btn = [...root.querySelectorAll('button')].find((b) => /^Send/.test(b.textContent.trim()));
        return { bannerShown: !!banner && banner.style.display !== 'none', title: btn ? btn.title : '' };
    });
    // CONNECTED-IDLE: the banner is gone and the control carries no refusal (the button stays disabled until a
    // program is staged — that is the ordinary empty-form state, not a connection refusal, and the title says so).
    expect(send.bannerShown, 'no unreachable banner when a gateway is answering').toBe(false);
    expect(send.title, 'and no connection reason on the control').toBe('');
    await goTab(page, 'Track');
    const tracking = await page.evaluate(() => (document.querySelector('#gateway-app .gw-view .bt-idle') || {}).textContent || '');
    // …and Track may now legitimately say IDLE, because it ASKED and there was no job
    expect(tracking, `connected tracking headline: ${tracking}`).not.toMatch(/UNREACHABLE/);
});

/**
 * THE DISCRIMINATING CASE, and the one the phantom actually comes from.
 *
 * A fresh profile with no gateway has no rows either way — that assert passes with or without the fix, so on its own
 * it proves nothing. The phantom appears when a gateway ANSWERED and then went away: the old code returned from the
 * failed poll without touching the list, so the last good listing stayed on screen with view and DELETE armed. This
 * connects, sees real rows, then pulls the gateway out from under the tab and requires them GONE.
 */
test('THE PHANTOM ITSELF — rows from a live gateway must VANISH when it goes away, not linger armed', async ({ page }) => {
    await openPanel(page, { reachable: true });
    await goTab(page, 'Files');
    const live = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        return { rows: root.querySelectorAll('table tr').length, deletes: root.querySelectorAll('button.danger').length };
    });
    // the connected half has to be real for this to mean anything — say so rather than passing on an empty screen
    test.skip(live.rows === 0, 'no files listed by the local gateway — nothing to go stale, so the phantom cannot be shown');

    // NOW THE GATEWAY GOES AWAY — unplugged, stopped, laptop carried out of the shop — with the page still open and
    // the tab still showing its listing. Simulated at the transport, by making the gateway's own calls fail, because
    // that is exactly what the app experiences; nothing in the product is reached into or stubbed.
    await page.evaluate(() => {
        const real = window.fetch.bind(window);
        window.fetch = (url, init) => (String(url).includes('127.0.0.1:8765')
            ? Promise.reject(new TypeError('Failed to fetch'))
            : real(url, init));
    });
    // t2687 (de-sleep) — was a flat waitForTimeout(3000) guessing how long gatewayPanel.js's own real
    // setInterval(poll, POLL_MS=1500) takes to tick and notice the fetch is now failing. This is the SAFE
    // pattern, not the forbidden one: the assertion is about the RESULTING STATE (rows gone), not about the
    // poll's timing itself, so polling the actual DOM for that state can only resolve once the real tick has
    // happened — it is never able to resolve early on a false signal, only faster than the flat guess.
    await page.waitForFunction(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        return !!root && root.querySelectorAll('table tr').length === 0;
    }, null, { timeout: 8000 });
    const after = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        return { rows: root.querySelectorAll('table tr').length, deletes: root.querySelectorAll('button.danger').length, note: !!root.querySelector('[data-gw-state="unreachable"]') };
    });
    expect(after.rows, `the stale listing is gone (was ${live.rows} rows)`).toBe(0);
    expect(after.deletes, `and no delete stays armed at a machine that is not there (was ${live.deletes})`).toBe(0);
    expect(after.note, 'with the state said plainly instead').toBe(true);
});
