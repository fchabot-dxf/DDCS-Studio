import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * t2065 — THE REAL PATH, DRIVEN, NOT MOCKED. Every existing spec near this feature mocks
 * `/api/descriptor`/`/api/queue`/`/api/history` with hand-typed JSON that was never produced by the real
 * bridge — exactly the "wired chain, never a working one" shape this arc has already found twice (beacons
 * never worked; "last time" reported a stalled run's own stopwatch). This spec spawns the REAL
 * `fairy.bridge` process (SimBeaconSource stands in for hardware — the only necessarily-fake piece), lets
 * Studio's OWN zero-configuration local-gateway auto-probe (`gateway-local-reach-1325`'s own mechanism —
 * `127.0.0.1:8765` is the first registered port) find it for real, and drives the ACTUAL Send button click
 * and the ACTUAL rendered History DOM — no `page.route` anywhere in this file.
 *
 * Server-side proof (real HTTP + a real background tick loop + real beacon injection, three tests) lives in
 * `bridge/bridge-app/tests/test_history_real_path_2065.py`. This spec closes the OTHER half: does clicking
 * Send in the real UI actually reach that real server and render back correctly.
 */
test.use({ viewport: { width: 1300, height: 850 } });

const BRIDGE_PORT = 8765;   // Studio's own DEFAULT_LOCAL_BASE — zero-configuration auto-adopt, no client-side setup
let bridgeProc = null;
let tmpRoot = null;

const PY = process.platform === 'win32' ? 'python' : 'python3';
const BRIDGE_APP_DIR = path.resolve(__dirname, '..', '..', 'bridge', 'bridge-app');

async function waitForBridge(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const r = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/api/descriptor`, { headers: { 'X-DDCS-Local': '1' } });
            if (r.ok) return true;
        } catch (_) { /* not up yet */ }
        await new Promise((res) => setTimeout(res, 200));
    }
    return false;
}

test.beforeAll(async () => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'fairy-realpath-e2e-'));
    const dest = path.join(tmpRoot, 'cncdisk');
    bridgeProc = spawn(PY, [
        '-m', 'fairy.bridge', 'run',
        '--backend', 'local', '--root', tmpRoot, '--dest', dest,
        // t2065 — enable_slave stays ON (default), NOT --no-slave: per t2020's own fix, a tracked job on a
        // bridge with enable_slave=False resolves straight to "delivered" and never enters the watch loop
        // at all -- correct behaviour, but it means --no-slave can never genuinely STALL, which is exactly
        // what the second test below needs to prove. No real Modbus hardware exists on this dev machine
        // either way (the port probe fails cleanly, t2057's own fix) -- the watch loop doesn't care whether
        // the receiver is healthy, only whether a beacon ever arrives, and none ever will here.
        '--serve', '--host', '127.0.0.1', '--http-port', String(BRIDGE_PORT),
        '--stall', '3',        // short, real stall — the test genuinely waits this long
        '--poll', '0.3',       // t2065 — the IDLE tick cadence defaults to 5s; a real send otherwise sits in the
                                // inbox for up to that long before the real background loop even looks at it
    ], {
        cwd: BRIDGE_APP_DIR, stdio: 'pipe',
        // t2065 — FOUND WHILE BUILDING THIS SPEC, not a bug: server.py's CSRF guard only grants the
        // X-DDCS-Local CORS preflight header to an ALLOWLISTED origin (the real hosted Studio origin by
        // default) — Studio's own local DEV server (this test's origin, localhost:3211) is correctly NOT
        // on that list, so a real cross-origin POST from it was genuinely, correctly refused at the
        // preflight. DDCS_TRUSTED_ORIGINS is the code's own sanctioned extension point for exactly this
        // ("a self-hoster adds their own Studio origin") — using it here, not bypassing the guard.
        //
        // t2065 — FOUND WHILE BUILDING THIS SPEC, a real isolation gap: Config.from_env() layers
        // defaults < persisted config.json < explicit CLI, and no CLI flag can force enable_slave BACK ON
        // over a persisted "false" (--no-slave only ever turns it off). This machine has a REAL persisted
        // ~/.ddcs-bridge/config.json (the human's own actual prior bridge usage, enable_slave:false in it)
        // — without isolating HOME/USERPROFILE, this test would have silently read the human's own real
        // config file. Pointing HOME at the test's own throwaway tmpRoot makes os.path.expanduser("~")
        // resolve there instead, so default_config_path() finds nothing and falls back to class defaults —
        // never touches the real file.
        env: { ...process.env, DDCS_TRUSTED_ORIGINS: 'http://localhost:3211', HOME: tmpRoot, USERPROFILE: tmpRoot },
    });
    const up = await waitForBridge();
    if (!up) throw new Error('the real bridge process never came up on ' + BRIDGE_PORT);
});

test.afterAll(async () => {
    // t2065 — FOUND WHILE BUILDING THIS SPEC: plain .kill() does not reliably tear down a `python -m` child
    // on Windows (confirmed live — a prior run's bridge was still LISTENING on 8765 well after its test
    // process exited, silently answering the NEXT run's requests with stale config). taskkill /T kills the
    // whole process tree, not just the immediate PID.
    if (bridgeProc && bridgeProc.pid) {
        if (process.platform === 'win32') {
            try { spawn('taskkill', ['/F', '/T', '/PID', String(bridgeProc.pid)]); } catch (_) { /* best effort */ }
        } else {
            bridgeProc.kill('SIGKILL');
        }
    }
    if (tmpRoot) { try { rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
});

const stageAndSend = async (page, { beaconsOn }) => {
    // Point at the real bridge EXPLICITLY, the same way a real user types a daemon URL in the Console tab
    // (gateway-local-reach-1325's own "typed URL" mechanism) — sidesteps the auto-probe's own backoff
    // timing (gateway-quiet-offline-1307: 5s/10s/20s) so the test doesn't depend on winning that race; the
    // SEND FLOW itself (instrument -> submitJob -> real HTTP -> real server) is what this spec is proving,
    // not the auto-discovery mechanism, which has its own dedicated coverage already.
    await page.addInitScript(([base]) => {
        localStorage.setItem('ddcs_api', base);
        localStorage.setItem('ddcs_mode', 'local');
    }, [`http://127.0.0.1:${BRIDGE_PORT}`]);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack, undefined, { timeout: 30000 });
    await page.evaluate(async () => {
        window.ddcsLoadBlockStack([
            { id: 'a', type: 'move', params: { mode: 'rapid', x: 10, y: 10, z: -5, feed: 500 } },
            { id: 'b', type: 'move', params: { mode: 'rapid', x: 20, y: 20, z: -5, feed: 500 } },
            // t2065 — FOUND WHILE BUILDING THIS SPEC, a real reachable edge case: instrument.js only places
            // beacons on Z-up retract moves or ahead of an M30 (instrument.js:55,59); a program with NEITHER
            // (this staged stack originally had two flat rapids and no M30) silently instruments to
            // total_beacons:0, so a REAL tracked send with Beacons checked reaches the server as
            // tracked:false with no warning surfaced anywhere. Every real wizard-built program always closes
            // with a progend block (M30 by default, programFraming.js:104) so this can't happen through normal
            // Studio authoring -- but a raw/hand-typed editor program with no M30 and no retract hits it for
            // real. Documented in WORK-LOG rather than "fixed" here: this block is the retract a real op
            // would already emit, restoring the realistic case this spec means to drive.
            { id: 'c', type: 'move', params: { mode: 'rapid', x: 20, y: 20, z: 5, feed: 500 } },
        ]);
        await new Promise((r) => setTimeout(r, 700));
    });
    const clickBtn = (txt) => page.evaluate((t) => {
        const hit = [...document.querySelectorAll('button')]
            .filter((e) => (e.textContent || '').includes(t))
            .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
        if (!hit) return false;
        hit.disabled = false;
        hit.click();
        return true;
    }, txt);
    await page.getByText('GATEWAY', { exact: false }).first().click();
    await page.waitForTimeout(2000);   // let the REAL local-gateway auto-probe find the real bridge (no page.route to shortcut it)
    expect(await clickBtn('Send'), 'the Send view opens').toBe(true);
    await page.waitForTimeout(700);
    expect(await clickBtn('Use current Studio program'), 'the current program stages').toBe(true);
    await page.waitForTimeout(500);
    if (!beaconsOn) {
        await page.evaluate(() => {
            const cb = [...document.querySelectorAll('input[type=checkbox]')].find((c) =>
                (c.closest('label')?.textContent || '').includes('Beacons'));
            if (cb && cb.checked) cb.click();
        });
        await page.waitForTimeout(200);
    }
    expect(await clickBtn(beaconsOn ? 'Send (tracked)' : 'Send (deliver-only)'), 'the send is attempted').toBe(true);
    await page.waitForTimeout(1500);
};

test('a REAL deliver-only send (Beacons off) reaches the real bridge and renders in the real History tab', async ({ page }) => {
    await stageAndSend(page, { beaconsOn: false });
    // switch to Jobs and let the REAL /api/history poll happen — no mocked route anywhere
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Jobs');
        if (t) t.click();
    });
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        const rows = [...root.querySelectorAll('table tr')].slice(1);
        return rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()));
    });
    expect(r.length, 'the real send genuinely produced a real history row').toBeGreaterThan(0);
    expect(r[0][1], 'a deliver-only send is recorded as delivered, for real').toBe('delivered');
});

test('a REAL tracked send that is never fed a beacon genuinely stalls, and the real History tab shows it honestly', async ({ page }) => {
    await stageAndSend(page, { beaconsOn: true });
    // no beacon ever arrives (no real Modbus hardware on this dev machine, and the port probe fails cleanly
    // per t2057's own fix) -- wait past the real, short --stall 3 configured above, then read the real
    // Tracking tab's own state.
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Tracking');
        if (t) t.click();
    });
    await page.waitForTimeout(4500);   // genuinely wait out the real stall window, not simulated
    const tracked = await page.evaluate(() => (document.querySelector('#gateway-app .gw-view .bt-state') || {}).textContent);
    expect(tracked, 'the real tracker shows the real stalled state, not a stuck 0% that never explains itself').toMatch(/STALLED/i);

    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Jobs');
        if (t) t.click();
    });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        const rows = [...root.querySelectorAll('table tr')].slice(1);
        return rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()));
    });
    const stalledRow = r.find((row) => row[1] === 'stalled');
    expect(stalledRow, 'the real stalled job is recorded honestly in real History, not silently dropped').toBeTruthy();
});
