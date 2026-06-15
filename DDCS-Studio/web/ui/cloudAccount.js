/**
 * ui/cloudAccount.js — BYO cloud account login, shared by Settings (Network tab) and the Project Manager drawer.
 *
 * FULLY BROWSER-DIRECT — no server, no Worker, no relay (R2/Worker are retired). The browser does PKCE OAuth with
 * the user's OWN provider (Google / Dropbox / OneDrive), gets a token, and later reads/writes the user's own cloud
 * directly (ui/cloud/*). Connect opens a modal that launches the provider sign-in in a popup; the popup returns to
 * oauth-callback.html which postMessages the code back; we exchange it (PKCE, no secret) and store the token.
 * PROJECTS only — the connected account backs the ☁ Cloud volume. See [[gateway-cloud-architecture]].
 */
import { getProvider, providerLabel, providerIcon, clientId, setClientId, redirectUri, PROVIDER_IDS } from './cloud/providers.js';
import { makeChallenge, makeState, buildAuthUrl, exchangeCode } from './cloud/pkce.js';

const TOK = 'ddcs_cloud_token', PROV = 'ddcs_cloud_provider', EMAIL = 'ddcs_cloud_email', REFRESH = 'ddcs_cloud_refresh';

export function getAccount() {
    try {
        return { connected: !!localStorage.getItem(TOK), provider: localStorage.getItem(PROV) || '', email: localStorage.getItem(EMAIL) || '' };
    } catch (e) { return { connected: false, provider: '', email: '' }; }
}

export function disconnect() {
    try { [TOK, PROV, EMAIL, REFRESH].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* */ }
    window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
}

/** Connect a provider (BYO). Needs the provider's PUBLIC client ID (no secret) — prompt for it once if unset. */
export function connect(provider = 'google') {
    const p = getProvider(provider);
    if (!p) return;
    if (!clientId(provider)) {
        const v = window.prompt(
            `Connect ${p.label} — your OWN account (no server, no secret).\n\n`
            + `1. Register a PUBLIC / SPA OAuth app for ${p.label}.\n`
            + `2. Add this redirect URI:\n   ${redirectUri()}\n\n`
            + `Paste its Client ID:`);
        if (!v) return;
        setClientId(provider, v.trim());
    }
    openConnectModal(provider);
}

async function openConnectModal(provider) {
    const p = getProvider(provider);
    const cid = clientId(provider);
    const ov = document.createElement('div');
    ov.className = 'cloud-modal';
    ov.innerHTML =
        '<div class="cloud-modal-panel">'
        + `<div class="proj-head"><span class="proj-title">🔗 Connect ${p.label}</span><button class="op-btn" data-cm="cancel" title="Cancel">✕</button></div>`
        + '<div class="cloud-modal-body">'
        + `<div class="cloud-modal-status">Opening ${p.label} sign-in…</div>`
        + `<div class="hint">A secure ${p.label} window opens — approve access and it returns here automatically. Your token stays in this browser; nothing is sent to a server.</div>`
        + '</div>'
        + '<div class="cloud-modal-foot"><button class="op-btn" data-cm="retry">Open sign-in</button><span style="flex:1"></span><button class="op-btn" data-cm="cancel">Cancel</button></div>'
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
    const wrap = document.createElement('div');
    wrap.className = 'cloud-login';
    const status = document.createElement('div');
    status.className = 'cloud-status' + (a.connected ? '' : ' muted');
    status.textContent = a.connected
        ? `Connected · ${providerLabel(a.provider)}${a.email ? ' · ' + a.email : ''}`
        : 'Not connected — projects stay local until you connect your own cloud account.';
    wrap.appendChild(status);

    if (a.connected) {
        const dc = document.createElement('button');
        dc.className = 'op-btn'; dc.textContent = 'Disconnect';
        dc.addEventListener('click', () => disconnect());
        wrap.appendChild(dc);
    } else {
        const row = document.createElement('div');
        row.className = 'cloud-providers';
        for (const id of PROVIDER_IDS) {
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
