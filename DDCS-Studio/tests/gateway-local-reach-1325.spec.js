import { test, expect } from '@playwright/test';

/**
 * t1325 amendment (USER, BLOCKED LIVE) — THE WEB APP REACHES A LOCAL GATEWAY, AND THE UI STOPS LYING ABOUT IT.
 *
 * TWO FAULTS, one behaviour:
 *   1. "Local (this PC)" polled the PAGE'S OWN ORIGIN. On pages.dev there is no gateway there and never will be —
 *      the concept predates the web deploy, so the mode could only ever fail on a hosted page.
 *   2. The Status message said "connect one in the Console tab (a local daemon or a service URL)" while the Console
 *      had NO daemon-URL field — the only URL box lived behind the Cloud radio. The message described a control
 *      that did not exist.
 *
 * THE FIX: on an unreachable tick, LOCAL mode probes 127.0.0.1 on the registered ports (loopback is mixed-content
 * exempt, so an https page may call it) and ADOPTS a gateway that answers its descriptor; the Console gains the
 * daemon field the message promised; an explicit URL wins and clearing returns to auto.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE PORTS ARE ONE DECLARATION — the probe scans what the Console offers', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const svc = await import('/ui/gateway/service.js');
        return { ports: svc.GATEWAY_PORTS, dflt: svc.DEFAULT_LOCAL_BASE };
    });
    expect(r.ports, 'the registered loopback ports').toEqual([8765, 8766, 8767, 8768, 8769]);
    expect(r.dflt, 'and the default the field shows as its placeholder').toBe('http://127.0.0.1:8765');
});

test('WITH NOTHING TYPED, THE FIELD SAYS IT IS LOOKING — no silent nothing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        localStorage.removeItem('ddcs_api'); localStorage.removeItem('ddcs_api_auto'); localStorage.removeItem('ddcs_mode');
        window.showApp && window.showApp('gateway');
        await new Promise((res) => setTimeout(res, 800));
        window.ddcsGatewayGoConsole && window.ddcsGatewayGoConsole();
        await new Promise((res) => setTimeout(res, 400));
        const st = document.getElementById('gw-daemon-state');
        const field = document.getElementById('gw-daemon-url');
        return { state: st ? st.textContent : null, value: field ? field.value : null };
    });
    expect(r.value, 'the field starts empty — auto is the default, not a thing to configure').toBe('');
    // AN EMPTY FIELD IS NEVER SILENT. Which of the two it says depends on whether a gateway is actually running on
    // this machine, and BOTH are honest: "looking on 127.0.0.1 (ports …)" before one answers, "found automatically:
    // <base>" after. What must never happen is an empty box with no explanation — that is the state the user was
    // stuck in. (This machine happens to have one on 8765, so the run usually takes the second branch.)
    expect(r.state, `an empty field explains itself: ${r.state}`).toMatch(/Looking for a gateway|Found automatically/i);
    expect(r.state, 'and names the loopback address either way, so nothing is a mystery').toMatch(/127\.0\.0\.1/);
});

test('ZERO CONFIGURATION — a gateway answering on 127.0.0.1 is found and adopted', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const svc = await import('/ui/gateway/service.js');
        localStorage.removeItem('ddcs_api'); localStorage.removeItem('ddcs_api_auto');
        // a fairy answering its descriptor on the SECOND port — the probe must walk the list, not assume 8765
        const tried = [];
        const fakeFetch = async (url) => {
            tried.push(url);
            if (url.indexOf('127.0.0.1:8766') >= 0) return { ok: true, json: async () => ({ machine_name: 'shop PC', version: '1.2.3' }) };
            throw new Error('ECONNREFUSED');
        };
        const found = await svc.probeLocalGateway(fakeFetch);
        if (found) svc.adoptLocal(found.base);
        return { found, tried, after: svc.getService() };
    });
    expect(r.found.base, `the probe found it: tried ${JSON.stringify(r.tried)}`).toBe('http://127.0.0.1:8766');
    expect(r.found.descriptor.machine_name, 'and read its descriptor').toBe('shop PC');
    // ADOPTED, NOT TYPED: the app found this itself, and the two are kept apart so an explicit URL can outrank it
    expect(r.after.adopted).toBe('http://127.0.0.1:8766');
    expect(r.after.typed, 'the user typed nothing').toBe('');
    expect(r.after.base, 'and the client will use what was found').toBe('http://127.0.0.1:8766');
});

test('REACHABILITY IS NOT IDENTITY — a socket that answers but is not a gateway is NOT adopted', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const svc = await import('/ui/gateway/service.js');
        // something is listening on 8765 (a dev server, a printer, anything) and returns a non-descriptor
        const fakeFetch = async () => ({ ok: true, json: async () => null });
        return { found: await svc.probeLocalGateway(fakeFetch) };
    });
    // adopting whatever accepts a socket on 8765 would point the app at a stranger and call it the user's machine
    expect(r.found, 'nothing is adopted without a real descriptor').toBeNull();
});

test('THE TYPED URL WINS, AND CLEARING RETURNS TO AUTO', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const svc = await import('/ui/gateway/service.js');
        localStorage.removeItem('ddcs_api'); localStorage.removeItem('ddcs_api_auto');
        svc.adoptLocal('http://127.0.0.1:8769');
        const autoOnly = svc.getService();
        svc.setService({ mode: 'cloud', base: 'http://192.168.1.50:8765' });
        const typed = svc.getService();
        svc.setService({ mode: 'local', base: 'http://127.0.0.1:8767' });
        const typedLocal = svc.getService();
        svc.setService({});                       // the user clears the field
        const cleared = svc.getService();
        return { autoOnly, typed, typedLocal, cleared };
    });
    expect(r.autoOnly.base, 'with nothing typed, the adopted one is used').toBe('http://127.0.0.1:8769');
    // AN EXPLICIT URL IS THE USER'S WORD: it outranks anything the app found for itself
    expect(r.typed.base).toBe('http://192.168.1.50:8765');
    expect(r.typed.typed).toBe('http://192.168.1.50:8765');
    // …AND A DAEMON URL DOES NOT MAKE YOU A CLOUD USER: the mode is its own declared fact, so typing a local address
    // no longer flips the UI into Cloud mode and hides the very field you just used.
    expect(r.typedLocal.mode, 'a typed LOCAL daemon URL stays local mode').toBe('local');
    expect(r.typedLocal.base, 'with the address it was given').toBe('http://127.0.0.1:8767');
    // CLEARING RETURNS TO AUTO — not to nothing, and not to the stale adoption from before they typed
    expect(r.cleared.typed, 'the typed base is gone').toBe('');
    expect(r.cleared.adopted, 'and so is the old adoption, so the next probe re-decides').toBe('');
});

test('THE CLIENT SEAM RESPECTS THE PRECEDENCE — typed, then adopted, then same-origin', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { makeClient } = await import('/shared/js/client.js');
        const read = () => makeClient().mode;
        localStorage.removeItem('ddcs_api'); localStorage.removeItem('ddcs_api_auto');
        const bare = read();
        localStorage.setItem('ddcs_api_auto', 'http://127.0.0.1:8765');
        const adopted = read();
        localStorage.setItem('ddcs_api', 'http://192.168.1.50:8765');
        const typed = read();
        localStorage.removeItem('ddcs_api'); localStorage.removeItem('ddcs_api_auto');
        return { bare, adopted, typed };
    });
    // THE EXE AND THE GATEWAY-SERVED CONSOLE ARE UNCHANGED: neither ever has an adopted base, so both stay same-origin
    expect(r.bare, 'no base anywhere → same-origin, exactly as before').toBe('local');
    expect(r.adopted, 'an adopted loopback base makes it a remote client').toBe('remote');
    expect(r.typed, 'and a typed one likewise').toBe('remote');
});

test('THE MESSAGE AND THE CONTROLS AGREE — the Status path lands ON the field', async ({ page }) => {
    await boot(page);
    // REACH THE REAL STATE: the message only appears when nothing answers. Point at a dead base so the panel is
    // genuinely unreachable — a typed base also parks the auto-probe, which keeps this test about the CHAIN.
    await page.evaluate(() => { localStorage.setItem('ddcs_api', 'http://127.0.0.1:1'); localStorage.setItem('ddcs_mode', 'local'); });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        window.showApp && window.showApp('gateway');
        await new Promise((res) => setTimeout(res, 1600));
        const link = document.getElementById('gw-goto-console');
        const before = { hasLink: !!link, text: link ? link.textContent : null };
        if (link) link.click();
        await new Promise((res) => setTimeout(res, 400));
        const field = document.getElementById('gw-daemon-url');
        return {
            ...before,
            fieldExists: !!field,
            focused: !!field && document.activeElement === field,
            placeholder: field ? field.placeholder : null,
            state: (document.getElementById('gw-daemon-state') || {}).textContent || '',
        };
    });
    await page.evaluate(() => { localStorage.removeItem('ddcs_api'); localStorage.removeItem('ddcs_mode'); });
    expect(r.hasLink, 'the Status message offers a path, not just a description').toBe(true);
    expect(r.text, 'naming the daemon URL the Console now really has').toMatch(/daemon URL/i);
    // THE CHAIN, PROVEN TO THE PIXEL: clicking the message lands on the Console WITH the field focused
    expect(r.fieldExists, 'the daemon field exists — in LOCAL mode, where the message sends you').toBe(true);
    expect(r.focused, 'and the click focused it').toBe(true);
    expect(r.placeholder, 'its placeholder shows the default it probes').toContain('127.0.0.1:8765');
    // …and the field's own state line agrees with what is actually in it: this page was pointed at an explicit
    // address, so it says so rather than claiming to be auto-detecting.
    expect(r.state, `the state line: ${r.state}`).toMatch(/address you entered/i);
});
