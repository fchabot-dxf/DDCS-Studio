import { test, expect } from '@playwright/test';
import { clickBtn as clickBtnImpl } from './support/gatewaySend.js';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * t2065 — THE REAL PATH, DRIVEN, NOT MOCKED. Every existing spec near this feature mocks
 * `/api/descriptor`/`/api/queue`/`/api/history` with hand-typed JSON that was never produced by the real
 * bridge — exactly the "wired chain, never a working one" shape this arc has already found more than once.
 * This spec spawns the REAL `fairy.bridge` process, lets Studio's OWN zero-configuration local-gateway
 * auto-probe (`gateway-local-reach-1325`'s own mechanism — `127.0.0.1:8765` is the first registered port)
 * find it for real, and drives the ACTUAL Send button click and the ACTUAL rendered History DOM — no
 * `page.route` anywhere in this file.
 *
 * Server-side proof (real HTTP + a real background tick loop, no mocks) lives in
 * `bridge/bridge-app/tests/test_history_real_path_2065.py`. This spec closes the OTHER half: does clicking
 * Send in the real UI actually reach that real server and render back correctly.
 *
 * t2649 (BACKLOG #78) — was two tests: a "Beacons off" deliver-only send, and a "Beacons on" tracked send
 * that (with no real Modbus hardware on this dev machine) genuinely stalled and was proven to render honestly
 * as such. The beacon mechanism those exercised is REMOVED (owner-directed 2026-09-04, never demonstrably ran
 * end-to-end) — there is no more Beacons checkbox, no more tracked/stalled state, and the bridge's own
 * `--stall` CLI flag this spec used to spawn with is gone too. Every send is now what "deliver-only" already
 * was, so this collapses to the one real-path proof that still applies: a real send reaches the real bridge
 * and is recorded, for real, as delivered.
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
    // t2227 — a REAL SYSDISK firmware fixture, not a mock: ops.py's detect_controller()/_fingerprint_sysdisk()
    // reads the first *.out file (sorted) under <tmpRoot>/SYSDISK (the sibling _sysdisk_for() derives from
    // `dest`'s own "cncdisk" suffix) and string-scans it for family signals when the filename alone is
    // ambiguous. `parse.out` from a genuine Expert M350 capture (this repo's own ground truth for this
    // controller family, same standing as the M350 dumps elsewhere) — VERIFIED to fingerprint as
    // "expert-m350" by running _fingerprint_sysdisk's own exact scan against it directly (contains "M350" and
    // "Modbus", not "DDCSV4"), not assumed from its name or location.
    const sysdisk = path.join(tmpRoot, 'SYSDISK');
    mkdirSync(sysdisk, { recursive: true });
    copyFileSync(
        path.resolve(__dirname, '..', '..', 'bridge', 'controllers', 'expert-m350', 'assets', 'capture', '20260731T181343Z', 'SYSDISK', 'parse.out'),
        path.join(sysdisk, 'parse.out'),
    );
    bridgeProc = spawn(PY, [
        '-m', 'fairy.bridge', 'run',
        '--backend', 'local', '--root', tmpRoot, '--dest', dest,
        '--serve', '--host', '127.0.0.1', '--http-port', String(BRIDGE_PORT),
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
        // defaults < persisted config.json < explicit CLI. This machine has a REAL persisted
        // ~/.ddcs-bridge/config.json (the human's own actual prior bridge usage) — without isolating
        // HOME/USERPROFILE, this test would have silently read the human's own real config file. Pointing
        // HOME at the test's own throwaway tmpRoot makes os.path.expanduser("~") resolve there instead, so
        // default_config_path() finds nothing and falls back to class defaults — never touches the real file.
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

const stageAndSend = async (page) => {
    // Point at the real bridge EXPLICITLY, the same way a real user types a daemon URL in the Console tab
    // (gateway-local-reach-1325's own "typed URL" mechanism) — sidesteps the auto-probe's own backoff
    // timing (gateway-quiet-offline-1307: 5s/10s/20s) so the test doesn't depend on winning that race; the
    // SEND FLOW itself (submitJob -> real HTTP -> real server) is what this spec is proving, not the
    // auto-discovery mechanism, which has its own dedicated coverage already.
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
        ]);
        await new Promise((r) => setTimeout(r, 700));
    });
    // t2225 — was a local closure duplicated across 4 specs; now the one shared implementation
    // (support/gatewaySend.js).
    const clickBtn = (txt) => clickBtnImpl(page, txt);
    // t2145 — no longer a unique text match: the quick-menu identity line now also shows the PC role ("gateway"
    // / "client"), which matches this loose case-insensitive locator too. Target the real header tab directly.
    await page.locator('.tab[data-app="gateway"]').click();
    await page.waitForTimeout(2000);   // let the REAL local-gateway auto-probe find the real bridge (no page.route to shortcut it)
    expect(await clickBtn('Send'), 'the Send view opens').toBe(true);
    await page.waitForTimeout(700);
    expect(await clickBtn('Use current Studio program'), 'the current program stages').toBe(true);
    await page.waitForTimeout(500);
    // t2649 (BACKLOG #78) — plain 'Send' text-matching can't tell the submit button from the L1 GATEWAY nav
    // tab (also literally "Send") now that the removed Beacons checkbox's "Send (tracked)"/"Send
    // (deliver-only)" parenthetical no longer makes the two texts distinct. Target the submit button by its
    // OWN class instead (`button.primary`), never relying on label text for identity.
    expect(await page.locator('#gateway-app button.primary').count(), 'the send button rendered').toBeGreaterThan(0);
    await page.locator('#gateway-app button.primary').click();
    await page.waitForTimeout(1500);
};

test('a REAL send reaches the real bridge and renders "delivered" in the real History tab', async ({ page }) => {
    await stageAndSend(page);
    // t2241 — Jobs folded into Send: the merged job list is already ON this tab, no navigation needed. Just
    // let the REAL /api/history poll happen — no mocked route anywhere, and Send stays the active view so its
    // own onPoll (which fetches it) keeps running.
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        const rows = [...root.querySelectorAll('table tr')].slice(1);
        return rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()));
    });
    expect(r.length, 'the real send genuinely produced a real history row').toBeGreaterThan(0);
    expect(r[0][1], 'a real send is recorded as delivered, for real').toBe('delivered');
});
