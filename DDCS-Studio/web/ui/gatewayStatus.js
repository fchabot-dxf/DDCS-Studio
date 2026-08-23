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
 * t2151 (BACKLOG #11, human ruling: "if im connected to a controller the worspace should be client unless the
 * controller match") — THE ROLE IS ALSO WORKSPACE-RELATIVE now, on top of t2145's daemon-reachability rule.
 * `baseRole` is the server's answer (a controller disk is configured on THIS PC, full stop — still what
 * governs whether this PC's OWN wiring fields exist in Setup, see admin.js). The EFFECTIVE role additionally
 * demotes gateway→client when the CONNECTED controller (`descriptor().controller_profile_id`, ops.py:287 —
 * the SAME id `controllerProfiles.js` uses, so this is a direct comparison, never a guess) does not match the
 * OPEN WORKSPACE's declared controller (`getMachine().controllerId`). Truthful, not advisory: if the workspace
 * targets an Expert and a V4.1 is plugged into THIS PC, this PC cannot deliver to the Expert — it is a gateway
 * for some OTHER workspace, and a client relative to the one that is open.
 * ⛔ `controller_profile_id` is `None`/absent when the fingerprint is unknown (ops.py:287) — UNKNOWN IS NOT A
 * MISMATCH, never demote on it (the same failure S1 was built to avoid: a confident wrong label).
 * ⚠ Role now depends on the OPEN WORKSPACE, so switching workspaces can flip it mid-session — correct under
 * this rule, but `reason` exists so nothing just silently flips the bare word (see `getRoleInfo()`).
 *
 * SCOPE THIS TURN (t2151): the comparison lives HERE, in ONE pure function (`roleInfoFromDescriptor`) — and
 * callers that used to read a raw descriptor's `.role` directly (admin.js's `isClient`, status.js's `!d`
 * branch, gatewayPanel.js's tab gating) now call THAT with their OWN freshly-fetched descriptor, so the
 * workspace-relative rule applies everywhere the role is consulted, not just the identity line. `getRoleInfo()`
 * (no descriptor to hand in) stays the identity line's own cached reader — see its own comment for why pure
 * vs cached is not a stylistic choice here: a hand-mounted view under test supplies its OWN mock descriptor
 * and never starts gatewayStatus.js's separate polling loop, so a cache read would silently see nothing.
 */
import { makeClient, deriveStatus, deviceName } from '../shared/js/client.js';
import { getMachine } from '../data/workspaceMachine.js';
import { CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';

export const EXE_DOWNLOAD_URL = 'https://github.com/fchabot-dxf/DDCS-Studio/releases/latest';

let _lastRole = '';        // t2145 — the CURRENT tick's SERVER-declared role only; never persisted (see above)
let _lastProfileId = null; // t2151 — this tick's connected controller's profile id, or null when unreachable/unknown

const ctrlLabel = (id) => (id && (CONTROLLER_PROFILES[id] || {}).name) || id || 'an unknown controller';

/**
 * t2151 — THE PURE COMPARISON, taking a descriptor directly. Callers that already fetched their OWN
 * `/api/descriptor` this tick (admin.js's render(), status.js's onPoll(), gatewayPanel's poll()) call this
 * with THAT descriptor — never the cached one below — so a hand-mounted view under test (which supplies its
 * own mock `client.descriptor()`, same pattern as settings-role-gate-2111/status-remote-machine-2112) is
 * compared against the descriptor it was actually given, not a stale/absent value from gatewayStatus.js's
 * OWN separate polling loop (which a unit-mounted view never starts).
 * Returns { role, baseRole, reason } — see the module header for what each means.
 */
export function roleInfoFromDescriptor(d) {
    const baseRole = (d && (d.role === 'gateway' || d.role === 'client')) ? d.role : 'client';
    if (baseRole !== 'gateway') return { role: 'client', baseRole, reason: '' };
    const profileId = (d && d.controller_profile_id) || null;
    if (profileId) {   // null/absent = fingerprint unknown — never demote on ignorance
        const wsId = getMachine().controllerId;
        if (wsId && wsId !== profileId) {
            return {
                role: 'client', baseRole,
                reason: `workspace targets ${ctrlLabel(wsId)}; ${ctrlLabel(profileId)} is connected`,
            };
        }
    }
    return { role: 'gateway', baseRole, reason: '' };
}

/**
 * t2173 (ROLES S3, human across three messages: "the status tab should be explicitly client or gateway by
 * presentation" / "it should be clear") — THE DECLARATION SEAM. `roleInfoFromDescriptor` answers WHICH role;
 * this answers WHAT TO SAY about it, once, in plain language — so the Status tab's identity line (this turn's
 * own consumer) and any LATER view that wants to state its own role stance (send.js, tracker.js, …) read the
 * SAME headline/detail instead of each hand-writing its own prose that drifts. Pure strings, no DOM — a caller
 * renders them however fits its own surface.
 * ⛔ Deliberately does NOT decide loud-vs-muted styling here — that is a presentation choice per caller (this
 * turn's Status tab reuses the pre-flight badge's PILL language for it; see styles.css `.role-identity`). This
 * function's job stops at "what is true and how to phrase it."
 */
export function roleIdentity(d) {
    const { role, reason } = roleInfoFromDescriptor(d);
    if (role === 'gateway') {
        return {
            kind: 'gateway',
            headline: 'This PC is the gateway',
            detail: `Serving ${ctrlLabel((d && d.controller_profile_id) || null)} from ${deviceName(d) || 'this machine'}`,
        };
    }
    if (reason) return { kind: 'mismatch', headline: 'This PC is a client', detail: reason };
    const wsId = getMachine().controllerId;
    return { kind: 'client', headline: 'This PC is a client', detail: wsId ? `Targets ${ctrlLabel(wsId)}` : '' };
}

/**
 * t2151 — the CACHED answer, off gatewayStatus.js's OWN polling loop (5-30s cadence). For callers with no
 * descriptor of their own to hand in — today, only the quick-menu identity line, which renders far more often
 * than any descriptor fetch and has nowhere to await one. Everywhere a descriptor IS already in hand, prefer
 * `roleInfoFromDescriptor(d)` directly (see its own comment for why that matters for testability).
 */
export function getRoleInfo() {
    return roleInfoFromDescriptor(_lastRole ? { role: _lastRole, controller_profile_id: _lastProfileId } : null);
}

/** t2145/t2151 — read the client-side-derived, workspace-relative role without waiting on a daemon.
 * Returns 'gateway' | 'client'. See `getRoleInfo()` for the WHY when it demotes. */
export function getEffectiveRole() {
    return getRoleInfo().role;
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
            // t2151 — the connected controller's fingerprinted profile id (ops.py:287), for the workspace-
            // relative comparison in getRoleInfo(). null/absent when unreadable — never a guess.
            _lastProfileId = (d && d.controller_profile_id) || null;
        } catch (e) {
            led.className = 'gateway-led';   // unlit — no gateway (standalone / hosted / dev preview)
            led.title = 'Gateway: off';
            bridged = false;
            _lastRole = '';   // t2145 — no reachable daemon this tick ⇒ getEffectiveRole() reports 'client'
            _lastProfileId = null;
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
