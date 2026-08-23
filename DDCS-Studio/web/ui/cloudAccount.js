/**
 * ui/cloudAccount.js — BYO cloud account login, shared by Settings (Network tab) and the Project Manager drawer.
 *
 * FULLY BROWSER-DIRECT — no server, no Worker, no relay (R2/Worker are retired). The browser does PKCE OAuth with
 * the user's OWN provider (Google / Dropbox / OneDrive), gets a token, and later reads/writes the user's own cloud
 * directly (ui/cloud/*). Connect opens a modal that launches the provider sign-in in a popup; the popup returns to
 * oauth-callback.html which postMessages the code back; we exchange it (PKCE, no secret) and store the token.
 * PROJECTS only — the connected account backs the ☁ Cloud volume. See [[gateway-cloud-architecture]].
 */
import { getProvider, providerLabel, providerIcon, clientId, setClientId, redirectUri, AVAILABLE_PROVIDER_IDS } from './cloud/providers.js';
import { makeChallenge, makeState, buildAuthUrl, exchangeCode } from './cloud/pkce.js';
import { dlgConfirm, dlgPrompt, dlgNotice } from './dialog.js';   // in-app dialogs (t684 d — no bare confirm/prompt/alert)

const TOK = 'ddcs_cloud_token', PROV = 'ddcs_cloud_provider', EMAIL = 'ddcs_cloud_email', REFRESH = 'ddcs_cloud_refresh', NAME = 'ddcs_cloud_name';
const PIC = 'ddcs_cloud_pic';   // t2077 — the avatar, from Drive's own about.get (no extra OAuth scope)

export function getAccount() {
    try {
        return { connected: !!localStorage.getItem(TOK), provider: localStorage.getItem(PROV) || '', email: localStorage.getItem(EMAIL) || '', name: localStorage.getItem(NAME) || '', picture: localStorage.getItem(PIC) || '' };
    } catch (e) { return { connected: false, provider: '', email: '', name: '', picture: '' }; }
}

export function disconnect() {
    try { [TOK, PROV, EMAIL, REFRESH, NAME, PIC].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* */ }
    window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
}

/** Fetch the signed-in Google account's name + email (via Drive about.get) and cache it, then refresh the UI.
 *  Best-effort — the connection is valid whether or not identity resolves. */
async function captureGoogleIdentity() {
    try {
        const { getUserInfo } = await import('./cloud/googleDrive.js');
        const u = await getUserInfo();
        if (u.email) localStorage.setItem(EMAIL, u.email);
        if (u.name) localStorage.setItem(NAME, u.name);
        if (u.picture) localStorage.setItem(PIC, u.picture);
    } catch (e) { /* identity is optional */ }
    window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
}

/**
 * Backfill identity for a session that connected BEFORE we captured some part of it. Once per load, no loop
 * on failure.
 *
 * ⭐ t2113 - THIS ALREADY EXISTED AND COULD NOT FIRE FOR THE CASE IT WAS WRITTEN FOR. Its condition was
 * `!a.name && !a.email`, from when identity meant name + email. t2077 added the PICTURE, and anyone who had
 * already connected has name and email stored - so the condition is false, the backfill never runs, and the
 * avatar stays initials forever. The only way out was to disconnect and reconnect. ⇒ a missing PICTURE is
 * now equally a reason to re-ask.
 * ⚠ AND IT LIVED IN renderCloudLogin(), which only Settings (Network) and the Project Manager drawer call.
 * The HEADER AVATAR renders on every load and never triggered it - so the one surface that shows the
 * picture could not ask for it. It is exported now and called from there too.
 * ⚠ A Google account with NO photo set is a legitimate empty: `_tried` keeps it to one attempt per load, so
 * that case costs a single request and correctly keeps the initials.
 */
export function backfillIdentity() {
    const a = getAccount();
    if (!a.connected || captureGoogleIdentity._tried) return;
    if (a.name && a.email && a.picture) return;   // nothing missing
    captureGoogleIdentity._tried = true;
    captureGoogleIdentity();
}

/** Connect a provider (BYO). Uses the shipped public client ID; falls back to a one-time paste if none is set
 *  (dev/self-host). Google uses GIS (its token model); Dropbox/OneDrive use the PKCE popup. */
export async function connect(provider = 'google') {
    const p = getProvider(provider);
    if (!p) return;
    // Desktop (exe/webview): Google's popup can't open + Google blocks embedded webviews, so route Google
    // sign-in through the gateway's loopback flow (its client id lives in gateway config, not providers.js).
    if (provider === 'google' && window.pywebview && window.pywebview.api) { connectGoogleDesktop(); return; }
    if (!clientId(provider)) {
        const v = await dlgPrompt(
            `Connect ${p.label} — your OWN account (no server, no secret).\n\n`
            + `No client ID is configured. Register a PUBLIC / SPA OAuth app for ${p.label}`
            + (provider === 'google' ? ' (Authorized JavaScript origin = ' + location.origin + ')' : `, redirect URI:\n   ${redirectUri()}`)
            + `\n\nPaste its Client ID:`);
        if (!v) return;
        setClientId(provider, v.trim());
    }
    if (provider === 'google') { connectGoogleFlow(); return; }   // GIS token model (no PKCE code exchange)
    openConnectModal(provider);                                   // PKCE popup (Dropbox / OneDrive)
}

/** Google: GIS token-model sign-in (its own consent popup) → store the access token. */
async function connectGoogleFlow() {
    try {
        const { connectGoogle } = await import('./cloud/googleDrive.js');
        const tok = await connectGoogle(clientId('google'));
        localStorage.setItem(TOK, tok);
        localStorage.setItem(PROV, 'google');
        window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));   // show "Connected" now
        captureGoogleIdentity();                                       // fill in name + email when it resolves
    } catch (e) {
        if (String(e && e.message) !== 'sign-in cancelled') dlgNotice('Google sign-in failed: ' + (e && e.message));
    }
}

/** Desktop (exe): the gateway runs the loopback OAuth — opens the SYSTEM browser for consent and exchanges
 *  the code server-side (bridge/bridge-app/fairy/oauth.py). We kick it off, then poll for the access token. */
async function connectGoogleDesktop() {
    let r;
    try { r = await (await fetch('/oauth/google/start')).json(); }
    catch (e) { dlgNotice('Could not reach the gateway to start Google sign-in.'); return; }
    if (!r.ok) {
        dlgNotice('Google sign-in unavailable: ' + (r.error || 'set a Google Desktop client id in the gateway Setup.'));
        return;
    }
    // Consent is now open in the system browser; poll the gateway until it has exchanged a token (3 min cap).
    const deadline = Date.now() + 180000;
    const tick = async () => {
        let t = {};
        try { t = await (await fetch('/api/oauth/google/token', { headers: { 'X-DDCS-Local': '1' } })).json(); } catch (e) { /* keep polling */ }   // X-DDCS-Local: the token GET is CSRF-guarded (a Drive credential); same-origin Studio sends it
        if (t.access_token) {
            try { localStorage.setItem(TOK, t.access_token); localStorage.setItem(PROV, 'google'); } catch (e) { /* */ }
            window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
            captureGoogleIdentity();   // resolve + cache the account name + email
            return;
        }
        if (Date.now() < deadline) setTimeout(tick, 1500);
    };
    setTimeout(tick, 2000);
}

async function openConnectModal(provider) {
    const p = getProvider(provider);
    const cid = clientId(provider);
    const ov = document.createElement('div');
    ov.className = 'cloud-modal';
    ov.innerHTML =
        '<div class="cloud-modal-panel modal-card">'
        + `<div class="proj-head"><span class="proj-title">🔗 Connect ${p.label}</span><button class="op-btn" data-cm="cancel" title="Cancel">✕</button></div>`
        + '<div class="cloud-modal-body">'
        + `<div class="cloud-modal-status">Opening ${p.label} sign-in…</div>`
        + `<div class="hint">A secure ${p.label} window opens — approve access and it returns here automatically. Your token stays in this browser; nothing is sent to a server.</div>`
        + '</div>'
        + '<div class="cloud-modal-foot"><button class="op-btn primary" data-cm="retry">Open sign-in</button><span style="flex:1"></span><button class="op-btn" data-cm="cancel">Cancel</button></div>'
        + '</div>';
    document.body.appendChild(ov);
    const statusEl = ov.querySelector('.cloud-modal-status');

    const { verifier, challenge } = await makeChallenge();
    const state = makeState();
    const ruri = redirectUri();
    const url = buildAuthUrl(p, { clientId: cid, redirectUri: ruri, challenge, state });
    let popup = null;

    const onMsg = async (e) => {
        if (e.origin !== location.origin) return;          // the callback page is same-origin
        const d = e.data || {};
        if (d.type !== 'ddcs-oauth-code' || d.state !== state) return;
        window.removeEventListener('message', onMsg);
        if (d.error) { statusEl.textContent = 'Sign-in failed: ' + d.error; return; }
        try {
            statusEl.textContent = 'Finishing…';
            if (!p.corsToken) throw new Error(`${p.label}: code received, but its token exchange needs the provider SDK (TODO).`);
            const tok = await exchangeCode(p, { code: d.code, clientId: cid, redirectUri: ruri, verifier });
            localStorage.setItem(TOK, tok.access_token || '');
            localStorage.setItem(PROV, provider);
            if (tok.refresh_token) localStorage.setItem(REFRESH, tok.refresh_token);
            cleanup(true);
        } catch (err) { statusEl.textContent = err.message; }
    };
    const open = () => {
        popup = window.open(url, 'ddcs_oauth', 'width=520,height=680');
        statusEl.textContent = popup ? `Waiting for ${p.label} sign-in…` : 'Popup blocked — allow popups, then “Open sign-in”.';
    };
    const cleanup = (ok) => {
        window.removeEventListener('message', onMsg);
        try { popup && popup.close(); } catch (_) { /* */ }
        ov.remove();
        if (ok) window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
    };
    window.addEventListener('message', onMsg);
    ov.addEventListener('click', (e) => {
        const t = e.target.closest('[data-cm]');
        if (!t) { if (e.target === ov) cleanup(false); return; }
        if (t.dataset.cm === 'cancel') cleanup(false); else open();
    });
    open();
}

/** Shared login UI rendered into `container` — used by Settings (Network) and the Project Manager drawer. */
export function renderCloudLogin(container) {
    if (!container) return;
    const a = getAccount();
    backfillIdentity();
    const wrap = document.createElement('div');
    wrap.className = 'cloud-login';
    const status = document.createElement('div');
    status.className = 'cloud-status' + (a.connected ? '' : ' muted');
    status.textContent = a.connected
        ? `Connected · ${providerLabel(a.provider)}${a.name ? ' · ' + a.name : ''}${a.email ? ' · ' + a.email : ''}`
        : 'Not connected — sign in to sync your projects to your own Google Drive.';
    wrap.appendChild(status);

    if (a.connected) {
        const dc = document.createElement('button');
        dc.className = 'op-btn'; dc.textContent = 'Disconnect';
        dc.addEventListener('click', () => disconnect());
        wrap.appendChild(dc);
    } else {
        const row = document.createElement('div');
        row.className = 'cloud-providers';
        for (const id of AVAILABLE_PROVIDER_IDS) {
            const b = document.createElement('button');
            b.className = 'op-btn cloud-connect';
            b.innerHTML = providerIcon(id) + '<span>Connect ' + providerLabel(id) + '</span>';
            b.addEventListener('click', () => connect(id));
            row.appendChild(b);
        }
        wrap.appendChild(row);
    }

    container.replaceChildren(wrap);
    if (!container._cloudWired) {   // keep this mount in sync with account changes from anywhere
        container._cloudWired = true;
        window.addEventListener('ddcs:cloud-account', () => renderCloudLogin(container));
    }
}
