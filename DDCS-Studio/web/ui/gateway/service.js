// ui/gateway/service.js — the OPTIONAL cloud-service seam.
//
// DDCS Studio is local-first / autonomous: by default the Gateway talks to the gateway on THIS PC (same-origin
// /api) — no account, no dependency on anyone's cloud. A user MAY connect an external service: a self-hosted or
// Cloudflare endpoint today, OAuth'd cloud storage (Google Drive, …) later. "Connecting a service" just sets the
// /api base + token that shared/js/client.js already reads (ddcs_api / ddcs_token) — so it's optional, removable,
// and BYO. The end goal is users never need the developer's Worker; it's just one selectable service.
const BASE_KEY = 'ddcs_api';
const TOK_KEY = 'ddcs_token';

/** Current service selection. mode 'local' = autonomous (no base); 'cloud' = pointed at an external /api. */
export function getService() {
    let base = '', token = '';
    try { base = localStorage.getItem(BASE_KEY) || ''; token = localStorage.getItem(TOK_KEY) || ''; } catch { /* */ }
    return { mode: base ? 'cloud' : 'local', base, token };
}

/** Persist the service selection (empty base => back to local/autonomous). Caller reloads so makeClient re-reads. */
export function setService({ base = '', token = '' } = {}) {
    try {
        if (base) localStorage.setItem(BASE_KEY, base); else localStorage.removeItem(BASE_KEY);
        if (token) localStorage.setItem(TOK_KEY, token); else localStorage.removeItem(TOK_KEY);
    } catch { /* localStorage may be unavailable */ }
}
