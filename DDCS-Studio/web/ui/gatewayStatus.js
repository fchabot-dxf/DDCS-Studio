/**
 * ui/gatewayStatus.js — live-gateway status LED + GATEWAY tab gating in the header.
 *
 * Polls the gateway's /api/descriptor through the shared client seam, backing off while nothing answers (t1307).
 * The LED is always visible:
 * green when a gateway answers (controller detail in the tooltip), red when it reports a fault, and
 * unlit grey when there is no gateway at all (hosted Studio / standalone) — in that state the GATEWAY
 * tab greys out too, and clicking it offers the desktop download (the full exe bundles the gateway;
 * the cloud never touches a machine).
 *
 * t2145 (ROLES-PLAN S0/S1 corrected) — ALSO the one place that derives the PC role CLIENT-SIDE. The server-side
 * derivation (`effective_role()`, bridge config.py) needs a reachable daemon to ask; on a phone with no daemon
 * `descriptor()` throws and the role was simply never computed. THE FIX: absence of a reachable daemon IS the
 * answer, not an error to bail on.
 *
 * THE RULE (human ruling, 2026-08-22, overriding an earlier three-state design this comment used to describe —
 * "i dont mind that its convert to client untill its restarted. or whatever the fix is."):
 *   daemon reachable      → use ITS answer (server-side `effective_role()` stays the source of truth)
 *   daemon NOT reachable  → CLIENT, unconditionally, no exceptions
 * A gateway PC whose daemon crashed shows 'client' too — deliberately: if the daemon is down, the gateway
 * features do not work anyway, so 'client' describes what this machine can actually DO right now, and it is
 * NEVER persisted — the very next successful tick derives 'gateway' again with no restart or reset needed.
 * ⛔ DO NOT reintroduce a remembered/cached role here. A downgrade that outlives the daemon-down condition
 * that caused it is exactly the "cached-and-stuck" shape the human explicitly ruled out.
 *
 * SCOPE THIS TURN: derivation + a getter for DISPLAY only (the quick-menu identity line). Tab/settings GATING
 * (`admin.js`'s `isClient`, still sourced from a reachable daemon's own descriptor only) is the next step.
 */
import { makeClient, deriveStatus } from '../shared/js/client.js';

export const EXE_DOWNLOAD_URL = 'https://github.com/fchabot-dxf/DDCS-Studio/releases/latest';

let _lastRole = '';   // t2145 — the CURRENT tick's role only; never written to storage, so a daemon-down
                       // downgrade to 'client' self-corrects the moment the daemon answers again

/** t2145 — read the client-side-derived role without waiting on a daemon. See the module header for the rule.
 * Returns 'gateway' | 'client' — the daemon's own answer when reachable, else 'client'. */
export function getEffectiveRole() {
    return _lastRole === 'gateway' ? 'gateway' : 'client';
}

export function initGatewayStatus() {
    const led = document.getElementById('gateway-led');
    if (!led) return;
    const tab = document.querySelector('.hdr-tabs .tab[data-app="gateway"]');
    const studioTab = document.querySelector('.hdr-tabs .tab[data-app="studio"]');
    const settingsTab = document.querySelector('.hdr-tabs .tab[data-app="settings"]');
    const blocksTab = document.querySelector('.hdr-tabs .tab[data-app="blocks"]');
    const macrosTab = document.querySelector('.hdr-tabs .tab[data-app="macros"]');
    const client = makeClient();
    let bridged = false;

    async function tick() {
        try {
            const d = await client.descriptor();
            const s = deriveStatus(client, d);
            // Gateway answers => green (controller detail lives in the tooltip); red only on a fault.
            led.className = 'gateway-led ' + (s.dot === 'bad' ? 'led-bad' : 'led-ok');
            led.title = 'Gateway: ' + s.label + (s.device ? ' · ' + s.device : '');
            bridged = true;
            // t2145 — only a LOCAL daemon's descriptor carries `.role` (a cloud-mirror descriptor has `online`
            // instead and describes a REMOTE gateway, not this device). Not persisted anywhere — see the
            // module header: a daemon-down downgrade must self-correct the moment the daemon answers again.
            _lastRole = (d && (d.role === 'gateway' || d.role === 'client')) ? d.role : '';
        } catch (e) {
            led.className = 'gateway-led';   // unlit — no gateway (standalone / hosted / dev preview)
            led.title = 'Gateway: off';
            bridged = false;
            _lastRole = '';   // t2145 — no reachable daemon this tick ⇒ getEffectiveRole() reports 'client'
            // Don't auto-kick out of the Gateway tab when nothing answers — its Console → Service picker is
            // how you point at one (a local daemon, the desktop exe's gateway, or a remote service).
        }
        // The tab always opens now (the LED shows connection state), so it stays styled like the other tabs —
        // no 'unavailable' dimming. Only the tooltip reflects status.
        if (tab) tab.title = bridged ? 'Gateway' : 'Gateway — connect a service in the Console tab';
        // Anything else that gates on the gateway (TRANSFER button, …) listens for this.
        document.dispatchEvent(new CustomEvent('ddcs:gateway-status', { detail: { bridged } }));
    }

    async function showApp(which) {
        window.ddcsTrack?.('feature', 'tab:' + which);

        // Settings is a MODAL, not an app view — open it over whatever's showing and return.
        if (which === 'settings') { (await import('./settingsPanel.js')).openSettings(); return; }

        const studioApp = document.getElementById('studio-app');
        const gatewayApp = document.getElementById('gateway-app');
        const blocksApp = document.getElementById('blocks-app');
        const macrosApp = document.getElementById('macros-app');

        const isStudio = which === 'studio';
        const isGateway = which === 'gateway';
        const isBlocks = which === 'blocks';
        const isMacros = which === 'macros';

        // Any tab change stops every preview's run — otherwise a run keeps executing off-screen and its snapshot
        // can clobber the editor on the way back (see REMINDERS / decode-standby). The event reaches every mounted
        // preview panel; ddcsStopPreview covers Studio's drawer engine specifically.
        window.dispatchEvent(new CustomEvent('ddcs:stop-previews'));
        if (!isStudio && window.ddcsStopPreview) window.ddcsStopPreview();

        if (isGateway) {
            const mod = await import('./gatewayPanel.js');
            mod.initGatewayPanel();
            mod.setGatewayPanelVisible(true);
        } else {
            try { (await import('./gatewayPanel.js')).setGatewayPanelVisible(false); } catch { /* not loaded */ }
        }

        if (isMacros) {
            const mod = await import('./macrosApp.js');
            mod.initMacrosApp();
        }

        // (Blocks → STUDIO editor round-trip is LIVE: the Blocks tab projects its G-code straight into the editor
        // on every change — see blocksApp.reproject.) The open WIZARD's FORM is pulled back here, on the way in, so
        // block edits to the PlaceOnStock cornergrid / params show up on the form too (reverse-sync).
        if (isStudio) { try { window.ddcsStudio?.wizardManager?.pullFromBlocks?.(); } catch (_) { /* not ready */ } }

        studioApp?.classList.toggle('hidden', !isStudio);
        gatewayApp?.classList.toggle('hidden', !isGateway);
        blocksApp?.classList.toggle('hidden', !isBlocks);
        macrosApp?.classList.toggle('hidden', !isMacros);

        studioTab?.classList.toggle('active', isStudio);
        tab?.classList.toggle('active', isGateway);
        blocksTab?.classList.toggle('active', isBlocks);
        macrosTab?.classList.toggle('active', isMacros);

        // Build/refresh the Blocks tab only after it's visible (canvas + three.js need layout). All Blocks logic
        // lives in blocksApp.showBlocks — this router just routes (the showApp router itself moves out of this
        // gateway-status module when the Gateway UI is built).
        if (isBlocks) {
            try {
                await (await import('../blocks/blocksApp.js')).showBlocks();
            } catch (err) { console.error('blocks init failed', err); }
        }
    }

    window.showApp = showApp;

    if (tab) tab.addEventListener('click', () => showApp('gateway'));   // always opens; connect a service in Console
    if (studioTab) studioTab.addEventListener('click', () => showApp('studio'));
    if (settingsTab) settingsTab.addEventListener('click', () => showApp('settings'));
    if (blocksTab) blocksTab.addEventListener('click', () => showApp('blocks'));

    // t1307 — WATCH WITHOUT SHOUTING. The poll ran every 5 s forever, so a Studio with no gateway (the hosted app,
    // or the raw web app in a browser) filled the console with a 404 for /api/descriptor twelve times a minute. That
    // line is the BROWSER's own network log, not ours — a caught fetch still logs it — so the only way to quiet it is
    // to stop asking so often.
    //
    // The chip's job is unchanged: it must light the moment a gateway appears. So the back-off is paired with the
    // events that mean "a person just came back to this window", which is exactly when they have started one:
    //   • connected      → 5 s, as before
    //   • offline        → 5 s, then 10, 20, 30 — capped, so a steady offline session costs 2 requests a minute
    //   • focus/visible  → check NOW and reset the cadence (throttled, so a flurry of focus events is one request)
    //   • back online    → check NOW (the browser's own signal that a network came back)
    const FAST = 5000, MAX = 30000;
    let delay = FAST, timer = null, last = 0;

    const schedule = () => { clearTimeout(timer); timer = setTimeout(run, delay); };
    async function run() {
        last = Date.now();
        await tick();
        // `bridged` is what tick() just decided — one source, no second flag to keep in step. The NEXT wait is the
        // current delay (so the sequence really is 5, 10, 20, 30), and the doubling is for the wait after that.
        if (bridged) { delay = FAST; schedule(); }
        else { schedule(); delay = Math.min(MAX, delay * 2); }
    }
    /** A person is back at the window (or the network returned): ask now, and go back to watching closely. */
    const wake = () => {
        if (document.hidden) return;
        if (Date.now() - last < 1500) return;   // …a burst of focus/visibility events is still one request
        delay = FAST;
        clearTimeout(timer);
        run();
    };
    try {
        window.addEventListener('focus', wake);
        window.addEventListener('online', wake);
        document.addEventListener('visibilitychange', wake);
    } catch (_) { /* the poll alone still works */ }

    run();
}
