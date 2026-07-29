// ui/gateway/service.js — the OPTIONAL cloud-service seam.
//
// DDCS Studio is local-first / autonomous: by default the Gateway talks to the gateway on THIS PC (same-origin
// /api) — no account, no dependency on anyone's cloud. A user MAY connect an external service: a self-hosted or
// Cloudflare endpoint today, OAuth'd cloud storage (Google Drive, …) later. "Connecting a service" just sets the
// /api base + token that shared/js/client.js already reads (ddcs_api / ddcs_token) — so it's optional, removable,
// and BYO. The end goal is users never need the developer's Worker; it's just one selectable service.
const BASE_KEY = 'ddcs_api';
const TOK_KEY = 'ddcs_token';
const AUTO_KEY = 'ddcs_api_auto';   // t1325 — a base the app FOUND, kept apart from one the user TYPED
const MODE_KEY = 'ddcs_mode';       // t1325 — the mode is DECLARED, not inferred from "is there a base"


// t1325 (USER, blocked live) — THE LOOPBACK PORTS. Declared HERE, once, because two things now need them: the
// Console's serve-port picker (which had this list inline) and the auto-probe below. They are the registered set,
// so the OAuth JS-origin list still covers whichever one is in use.
export const GATEWAY_PORTS = [8765, 8766, 8767, 8768, 8769];
export const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:' + GATEWAY_PORTS[0];

/**
 * Current service selection.
 *   mode 'local' = autonomous. 'cloud' = pointed at an external /api.
 *   base    — the base the client will actually use (explicit if typed, else an adopted local one)
 *   typed   — what the USER entered; '' means they have not chosen, so the auto-probe is free to act
 *   adopted — a loopback gateway the app FOUND on its own (t1325)
 *
 * THE TWO ARE KEPT APART deliberately: an explicit URL must WIN and must survive a failed probe, and clearing it
 * has to return to auto rather than to nothing. One key holding both could not express "cleared, now auto again".
 */
export function getService() {
    let base = '', token = '', auto = '';
    try {
        base = localStorage.getItem(BASE_KEY) || '';
        token = localStorage.getItem(TOK_KEY) || '';
        auto = localStorage.getItem(AUTO_KEY) || '';
    } catch { /* */ }
    const eff = base || auto;
    // THE MODE IS ITS OWN FACT. Deriving it from "is there a base" made typing a LOCAL DAEMON URL flip the UI into
    // Cloud mode — the same conflation this turn is fixing, one level down: a URL pointing at 127.0.0.1 is not a
    // cloud service. Stored explicitly; a config written before this key existed falls back to the old derivation,
    // so nobody's saved service moves.
    let mode = '';
    try { mode = localStorage.getItem(MODE_KEY) || ''; } catch { /* */ }
    if (mode !== 'local' && mode !== 'cloud') mode = base ? 'cloud' : 'local';
    return { mode, base: eff, typed: base, adopted: auto, token };
}

/** Remember a loopback gateway the probe found. Never overwrites an explicit base — that one is the user's word. */
export function adoptLocal(base) {
    try { if (base) localStorage.setItem(AUTO_KEY, base); else localStorage.removeItem(AUTO_KEY); } catch { /* */ }
}

/**
 * THE AUTO-PROBE. A page served from pages.dev has no gateway on its OWN origin, and "Local (this PC)" polling that
 * origin is a concept that predates the web deploy — it can only ever fail there. So when the origin has nothing,
 * look where a local daemon actually lives: 127.0.0.1 on the registered ports. Loopback is mixed-content exempt, so
 * an HTTPS page may call it, and the gateway already sends CORS.
 *
 * A gateway is only adopted if it ANSWERS ITS DESCRIPTOR — reachability is not identity, and adopting whatever
 * happens to accept a socket on 8765 would point the app at a stranger.
 */
export async function probeLocalGateway(fetchImpl) {
    const f = fetchImpl || ((typeof fetch === 'function') ? fetch.bind(globalThis) : null);
    if (!f) return null;
    for (const port of GATEWAY_PORTS) {
        const base = 'http://127.0.0.1:' + port;
        try {
            const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
            const t = ctl ? setTimeout(() => ctl.abort(), 1200) : null;   // a closed port must not stall the tick
            const r = await f(base + '/api/descriptor', ctl ? { signal: ctl.signal } : {});
            if (t) clearTimeout(t);
            if (!r || !r.ok) continue;
            const d = await r.json();
            if (d && typeof d === 'object') return { base, descriptor: d };
        } catch { /* nothing there — try the next port */ }
    }
    return null;
}

/** Persist the service selection (empty base => back to local/autonomous). Caller reloads so makeClient re-reads. */
export function setService({ base = '', token = '', mode = '' } = {}) {
    try {
        if (mode === 'local' || mode === 'cloud') localStorage.setItem(MODE_KEY, mode); else localStorage.removeItem(MODE_KEY);
        // CLEARING RETURNS TO AUTO, not to nothing: drop the adopted base too so the next probe re-decides, rather
        // than silently keeping whatever was found before the user typed their own.
        if (!base) localStorage.removeItem(AUTO_KEY);
        if (base) localStorage.setItem(BASE_KEY, base); else localStorage.removeItem(BASE_KEY);
        if (token) localStorage.setItem(TOK_KEY, token); else localStorage.removeItem(TOK_KEY);
    } catch { /* localStorage may be unavailable */ }
}
